//! One ICMP echo ("ping") probe with a chosen TTL, without needing administrator rights.
//!
//! Windows uses the IP Helper API (`IcmpSendEcho`), which any user may call. Linux and macOS use unprivileged
//! ICMP datagram sockets. A TTL that runs out on the way back is reported as `Expired` with the router's
//! address, which is what a traceroute is made of. IPv4 only.

use std::net::Ipv4Addr;
use std::time::Duration;

#[derive(Debug, PartialEq, Clone)]
pub enum Probe {
    /// The destination answered.
    Reply { from: Ipv4Addr, ms: f64 },
    /// The TTL ran out at this router.
    Expired { from: Ipv4Addr, ms: f64 },
    /// A router said it cannot deliver the packet.
    Unreachable { from: Ipv4Addr, ms: f64, why: String },
    /// Nothing came back in time.
    Timeout,
    /// This machine does not let this program send ICMP (the string says why). Windows never says this.
    #[cfg_attr(windows, allow(dead_code))]
    Denied(String),
    /// Something else went wrong.
    Failed(String),
}

/// The Internet checksum of an ICMP message.
pub fn checksum(data: &[u8]) -> u16 {
    let mut sum: u32 = 0;
    let mut chunks = data.chunks_exact(2);
    for c in &mut chunks {
        sum += u32::from(u16::from_be_bytes([c[0], c[1]]));
    }
    if let [last] = chunks.remainder() {
        sum += u32::from(*last) << 8;
    }
    while sum > 0xffff {
        sum = (sum & 0xffff) + (sum >> 16);
    }
    !(sum as u16)
}

/// An ICMP echo request with a 32 byte payload.
#[cfg_attr(windows, allow(dead_code))]
pub fn echo_packet(id: u16, seq: u16) -> Vec<u8> {
    let mut p = vec![8, 0, 0, 0];
    p.extend_from_slice(&id.to_be_bytes());
    p.extend_from_slice(&seq.to_be_bytes());
    p.extend((0..32u8).map(|i| b'a' + i % 26));
    let c = checksum(&p);
    p[2..4].copy_from_slice(&c.to_be_bytes());
    p
}

#[derive(Debug, PartialEq)]
#[cfg_attr(windows, allow(dead_code))]
pub enum Kind {
    EchoReply { seq: u16 },
    TimeExceeded { seq: u16 },
    Unreachable { code: u8, seq: u16 },
}

/// Classify an ICMP message (starting at its type byte). For errors, the original packet is quoted after the
/// 8 byte ICMP header: an IP header, then the first 8 bytes of our echo request.
#[cfg_attr(windows, allow(dead_code))]
pub fn classify(icmp: &[u8]) -> Option<Kind> {
    let ty = *icmp.first()?;
    let code = *icmp.get(1)?;
    match ty {
        0 => Some(Kind::EchoReply { seq: u16::from_be_bytes([*icmp.get(6)?, *icmp.get(7)?]) }),
        3 | 11 => {
            let inner = icmp.get(8..)?;
            let ihl = usize::from(inner.first()? & 0x0f) * 4;
            let quoted = inner.get(ihl..)?;
            // The quoted echo request: type 8, code 0, checksum, id, seq.
            let seq = u16::from_be_bytes([*quoted.get(6)?, *quoted.get(7)?]);
            if *quoted.first()? != 8 {
                return None;
            }
            Some(if ty == 11 { Kind::TimeExceeded { seq } } else { Kind::Unreachable { code, seq } })
        }
        _ => None,
    }
}

pub fn unreachable_text(code: u8) -> String {
    match code {
        0 => "network unreachable",
        1 => "host unreachable",
        2 => "protocol unreachable",
        3 => "port unreachable",
        4 => "fragmentation needed",
        13 => "administratively prohibited",
        _ => "destination unreachable",
    }
    .to_string()
}

static SEQ: std::sync::atomic::AtomicU16 = std::sync::atomic::AtomicU16::new(1);
#[cfg_attr(windows, allow(dead_code))]
fn next_seq() -> u16 {
    SEQ.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
}

/// Send one echo request to `dst` with this TTL and wait up to `timeout` for the answer.
pub fn probe(dst: Ipv4Addr, ttl: u8, timeout: Duration) -> Probe {
    sys::probe(dst, ttl, timeout)
}

// ------------------------------------------------------------------------------------------------ Windows
#[cfg(windows)]
mod sys {
    use super::*;
    use windows_sys::Win32::Foundation::{GetLastError, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::NetworkManagement::IpHelper::{IcmpCloseHandle, IcmpCreateFile, IcmpSendEcho, ICMP_ECHO_REPLY, IP_OPTION_INFORMATION};

    const IP_SUCCESS: u32 = 0;
    const IP_DEST_NET_UNREACHABLE: u32 = 11002;
    const IP_DEST_HOST_UNREACHABLE: u32 = 11003;
    const IP_DEST_PROT_UNREACHABLE: u32 = 11004;
    const IP_DEST_PORT_UNREACHABLE: u32 = 11005;
    const IP_REQ_TIMED_OUT: u32 = 11010;
    const IP_TTL_EXPIRED_TRANSIT: u32 = 11013;
    const IP_TTL_EXPIRED_REASSEM: u32 = 11014;

    pub fn probe(dst: Ipv4Addr, ttl: u8, timeout: Duration) -> Probe {
        unsafe {
            let h = IcmpCreateFile();
            if h.is_null() || h == INVALID_HANDLE_VALUE {
                return Probe::Failed("Could not open the Windows ICMP service.".into());
            }
            let payload = [b'h'; 32];
            let opts = IP_OPTION_INFORMATION { Ttl: ttl, Tos: 0, Flags: 0, OptionsSize: 0, OptionsData: std::ptr::null_mut() };
            // Room for the reply, the echoed data, and an ICMP error (8 bytes) as the API requires.
            let mut buf = vec![0u8; std::mem::size_of::<ICMP_ECHO_REPLY>() + payload.len() + 64];
            // The address is passed as a u32 whose in-memory bytes are the address in network order.
            let addr = u32::from_ne_bytes(dst.octets());
            let n = IcmpSendEcho(
                h,
                addr,
                payload.as_ptr() as *const _,
                payload.len() as u16,
                &opts,
                buf.as_mut_ptr() as *mut _,
                buf.len() as u32,
                timeout.as_millis().clamp(1, 60_000) as u32,
            );
            let err = if n == 0 { GetLastError() } else { 0 };
            let reply = std::ptr::read_unaligned(buf.as_ptr() as *const ICMP_ECHO_REPLY);
            IcmpCloseHandle(h);
            if n == 0 {
                return match err {
                    IP_REQ_TIMED_OUT => Probe::Timeout,
                    other => Probe::Failed(format!("Windows could not send the request (error {other}).")),
                };
            }
            let from = Ipv4Addr::from(reply.Address.to_ne_bytes());
            let ms = f64::from(reply.RoundTripTime);
            match reply.Status {
                IP_SUCCESS => Probe::Reply { from, ms },
                IP_TTL_EXPIRED_TRANSIT | IP_TTL_EXPIRED_REASSEM => Probe::Expired { from, ms },
                IP_DEST_NET_UNREACHABLE => Probe::Unreachable { from, ms, why: super::unreachable_text(0) },
                IP_DEST_HOST_UNREACHABLE => Probe::Unreachable { from, ms, why: super::unreachable_text(1) },
                IP_DEST_PROT_UNREACHABLE => Probe::Unreachable { from, ms, why: super::unreachable_text(2) },
                IP_DEST_PORT_UNREACHABLE => Probe::Unreachable { from, ms, why: super::unreachable_text(3) },
                IP_REQ_TIMED_OUT => Probe::Timeout,
                other => Probe::Unreachable { from, ms, why: format!("status {other}") },
            }
        }
    }
}

// ------------------------------------------------------------------------------------------- Linux, macOS
#[cfg(unix)]
mod sys {
    use super::*;
    use std::time::Instant;

    struct Fd(libc::c_int);
    impl Drop for Fd {
        fn drop(&mut self) {
            unsafe { libc::close(self.0) };
        }
    }

    fn last_error() -> std::io::Error {
        std::io::Error::last_os_error()
    }

    fn open_socket(ttl: u8) -> Result<Fd, Probe> {
        unsafe {
            let fd = libc::socket(libc::AF_INET, libc::SOCK_DGRAM, libc::IPPROTO_ICMP);
            if fd < 0 {
                let e = last_error();
                let denied = matches!(e.raw_os_error(), Some(libc::EACCES) | Some(libc::EPERM) | Some(libc::EPROTONOSUPPORT) | Some(libc::EAFNOSUPPORT));
                let msg = if denied {
                    "This system does not let programs without special rights send ping (on Linux, see net.ipv4.ping_group_range).".to_string()
                } else {
                    format!("Could not open an ICMP socket: {e}")
                };
                return Err(if denied { Probe::Denied(msg) } else { Probe::Failed(msg) });
            }
            let fd = Fd(fd);
            let ttl = libc::c_int::from(ttl);
            if libc::setsockopt(fd.0, libc::IPPROTO_IP, libc::IP_TTL, &ttl as *const _ as *const libc::c_void, std::mem::size_of::<libc::c_int>() as libc::socklen_t) < 0 {
                return Err(Probe::Failed(format!("Could not set the TTL: {}", last_error())));
            }
            #[cfg(target_os = "linux")]
            {
                // Time-exceeded and unreachable replies come back through the socket's error queue.
                let on: libc::c_int = 1;
                libc::setsockopt(fd.0, libc::IPPROTO_IP, libc::IP_RECVERR, &on as *const _ as *const libc::c_void, std::mem::size_of::<libc::c_int>() as libc::socklen_t);
            }
            Ok(fd)
        }
    }

    pub fn probe(dst: Ipv4Addr, ttl: u8, timeout: Duration) -> Probe {
        let fd = match open_socket(ttl) {
            Ok(fd) => fd,
            Err(p) => return p,
        };
        let seq = next_seq();
        let id = (std::process::id() & 0xffff) as u16;
        let pkt = echo_packet(id, seq);
        unsafe {
            let mut sa: libc::sockaddr_in = std::mem::zeroed();
            sa.sin_family = libc::AF_INET as libc::sa_family_t;
            sa.sin_addr.s_addr = u32::from(dst).to_be();
            let started = Instant::now();
            let sent = libc::sendto(fd.0, pkt.as_ptr() as *const libc::c_void, pkt.len(), 0, &sa as *const _ as *const libc::sockaddr, std::mem::size_of::<libc::sockaddr_in>() as libc::socklen_t);
            if sent < 0 {
                let e = last_error();
                return match e.raw_os_error() {
                    Some(libc::ENETUNREACH) | Some(libc::EHOSTUNREACH) => Probe::Unreachable { from: dst, ms: 0.0, why: "network unreachable".into() },
                    _ => Probe::Failed(format!("Could not send the request: {e}")),
                };
            }
            loop {
                let left = timeout.saturating_sub(started.elapsed());
                if left.is_zero() {
                    return Probe::Timeout;
                }
                let mut pfd = libc::pollfd { fd: fd.0, events: libc::POLLIN, revents: 0 };
                let r = libc::poll(&mut pfd, 1, left.as_millis().clamp(1, i32::MAX as u128) as libc::c_int);
                if r < 0 {
                    if last_error().kind() == std::io::ErrorKind::Interrupted {
                        continue;
                    }
                    return Probe::Failed(format!("Waiting for the answer failed: {}", last_error()));
                }
                if r == 0 {
                    return Probe::Timeout;
                }
                let ms = started.elapsed().as_secs_f64() * 1000.0;
                #[cfg(target_os = "linux")]
                if pfd.revents & libc::POLLERR != 0 {
                    if let Some(p) = read_error_queue(fd.0, seq, ms) {
                        return p;
                    }
                    continue;
                }
                if pfd.revents & libc::POLLIN != 0 {
                    let mut buf = [0u8; 1500];
                    let mut from: libc::sockaddr_in = std::mem::zeroed();
                    let mut flen = std::mem::size_of::<libc::sockaddr_in>() as libc::socklen_t;
                    let n = libc::recvfrom(fd.0, buf.as_mut_ptr() as *mut libc::c_void, buf.len(), 0, &mut from as *mut _ as *mut libc::sockaddr, &mut flen);
                    if n < 0 {
                        continue;
                    }
                    let src = Ipv4Addr::from(u32::from_be(from.sin_addr.s_addr));
                    let mut msg = &buf[..n as usize];
                    // macOS hands over the IP header too; Linux does not.
                    if msg.first().map(|b| b >> 4) == Some(4) {
                        let ihl = usize::from(msg[0] & 0x0f) * 4;
                        msg = msg.get(ihl..).unwrap_or(&[]);
                    }
                    match classify(msg) {
                        Some(Kind::EchoReply { seq: s }) if s == seq || cfg!(target_os = "linux") => return Probe::Reply { from: src, ms },
                        Some(Kind::TimeExceeded { seq: s }) if s == seq => return Probe::Expired { from: src, ms },
                        Some(Kind::Unreachable { code, seq: s }) if s == seq => return Probe::Unreachable { from: src, ms, why: unreachable_text(code) },
                        _ => {}
                    }
                } else if pfd.revents & (libc::POLLHUP | libc::POLLNVAL) != 0 {
                    return Probe::Failed("The socket closed unexpectedly.".into());
                }
            }
        }
    }

    /// Linux: the offending router's address for a time-exceeded or unreachable reply.
    #[cfg(target_os = "linux")]
    unsafe fn read_error_queue(fd: libc::c_int, _seq: u16, ms: f64) -> Option<Probe> {
        // Layout of the kernel's struct sock_extended_err, which is followed by the offender's sockaddr.
        #[repr(C)]
        struct ExtErr {
            errno: u32,
            origin: u8,
            typ: u8,
            code: u8,
            pad: u8,
            info: u32,
            data: u32,
        }
        const ORIGIN_ICMP: u8 = 2;
        let mut buf = [0u8; 1500];
        let mut ctrl = [0u8; 512];
        let mut name: libc::sockaddr_in = std::mem::zeroed();
        let mut iov = libc::iovec { iov_base: buf.as_mut_ptr() as *mut libc::c_void, iov_len: buf.len() };
        let mut msg: libc::msghdr = std::mem::zeroed();
        msg.msg_name = &mut name as *mut _ as *mut libc::c_void;
        msg.msg_namelen = std::mem::size_of::<libc::sockaddr_in>() as libc::socklen_t;
        msg.msg_iov = &mut iov;
        msg.msg_iovlen = 1;
        msg.msg_control = ctrl.as_mut_ptr() as *mut libc::c_void;
        msg.msg_controllen = ctrl.len() as _;
        if libc::recvmsg(fd, &mut msg, libc::MSG_ERRQUEUE) < 0 {
            return None;
        }
        let mut cm = libc::CMSG_FIRSTHDR(&msg);
        while !cm.is_null() {
            if (*cm).cmsg_level == libc::IPPROTO_IP && (*cm).cmsg_type == libc::IP_RECVERR {
                let data = libc::CMSG_DATA(cm);
                let ee = std::ptr::read_unaligned(data as *const ExtErr);
                let off = std::ptr::read_unaligned(data.add(std::mem::size_of::<ExtErr>()) as *const libc::sockaddr_in);
                let from = Ipv4Addr::from(u32::from_be(off.sin_addr.s_addr));
                if ee.origin == ORIGIN_ICMP {
                    return Some(match ee.typ {
                        11 => Probe::Expired { from, ms },
                        3 => Probe::Unreachable { from, ms, why: unreachable_text(ee.code) },
                        _ => Probe::Unreachable { from, ms, why: "destination unreachable".into() },
                    });
                }
                return Some(Probe::Failed(format!("The network reported an error ({}).", std::io::Error::from_raw_os_error(ee.errno as i32))));
            }
            cm = libc::CMSG_NXTHDR(&msg, cm);
        }
        None
    }
}

#[cfg(not(any(unix, windows)))]
mod sys {
    use super::*;
    pub fn probe(_: Ipv4Addr, _: u8, _: Duration) -> Probe {
        Probe::Denied("ICMP is not supported on this platform.".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checksums_a_known_packet() {
        // RFC 1071 example data.
        assert_eq!(checksum(&[0x00, 0x01, 0xf2, 0x03, 0xf4, 0xf5, 0xf6, 0xf7]), 0x220d);
        assert_eq!(checksum(&[0xff]), 0x00ff);
    }

    #[test]
    fn an_echo_request_verifies_to_zero() {
        let p = echo_packet(0xabcd, 7);
        assert_eq!(p.len(), 40);
        assert_eq!(&p[..2], &[8, 0]);
        assert_eq!(&p[4..8], &[0xab, 0xcd, 0, 7]);
        assert_eq!(checksum(&p), 0);
    }

    fn quoted(seq: u16) -> Vec<u8> {
        let mut v = vec![0x45, 0, 0, 60, 0, 0, 0, 0, 1, 1, 0, 0, 10, 0, 0, 1, 8, 8, 8, 8]; // IP header (ihl 5)
        v.extend_from_slice(&[8, 0, 0, 0, 0xab, 0xcd]);
        v.extend_from_slice(&seq.to_be_bytes());
        v
    }

    #[test]
    fn classifies_replies_and_errors() {
        assert_eq!(classify(&[0, 0, 0, 0, 0xab, 0xcd, 0, 9]), Some(Kind::EchoReply { seq: 9 }));
        let mut te = vec![11, 0, 0, 0, 0, 0, 0, 0];
        te.extend(quoted(5));
        assert_eq!(classify(&te), Some(Kind::TimeExceeded { seq: 5 }));
        let mut un = vec![3, 1, 0, 0, 0, 0, 0, 0];
        un.extend(quoted(6));
        assert_eq!(classify(&un), Some(Kind::Unreachable { code: 1, seq: 6 }));
        assert_eq!(unreachable_text(1), "host unreachable");
    }

    #[test]
    fn ignores_other_and_short_messages() {
        assert_eq!(classify(&[]), None);
        assert_eq!(classify(&[8, 0]), None);
        assert_eq!(classify(&[11, 0, 0, 0, 0, 0, 0, 0, 0x45]), None);
        assert_eq!(classify(&[5, 0, 0, 0, 0, 0, 0, 0]), None);
    }

    /// Loopback always answers when this machine lets the program send ICMP; otherwise the test says nothing.
    #[test]
    fn pings_loopback_when_allowed() {
        match probe(Ipv4Addr::LOCALHOST, 64, Duration::from_secs(2)) {
            Probe::Reply { from, .. } => assert_eq!(from, Ipv4Addr::LOCALHOST),
            Probe::Denied(_) | Probe::Failed(_) | Probe::Timeout => eprintln!("ICMP not available here; skipped"),
            other => panic!("unexpected {other:?}"),
        }
    }
}
