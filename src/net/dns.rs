//! A small DNS client: build a query, parse the answer (with name compression), ask a resolver over UDP and fall
//! back to TCP when the answer is truncated. Only what the "DNS records" tool needs; no caching, no DNSSEC.

use std::io::{Read, Write};
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr, TcpStream, UdpSocket};
use std::time::{Duration, Instant};

#[derive(Debug, PartialEq, Clone)]
pub struct Record {
    pub name: String,
    pub rtype: String,
    pub ttl: u32,
    pub data: String,
}

#[derive(Debug, PartialEq)]
pub struct Answer {
    pub rcode: u8,
    pub truncated: bool,
    pub answers: Vec<Record>,
    pub authority: Vec<Record>,
}

pub const TYPES: &[(&str, u16)] = &[
    ("A", 1),
    ("NS", 2),
    ("CNAME", 5),
    ("SOA", 6),
    ("PTR", 12),
    ("MX", 15),
    ("TXT", 16),
    ("AAAA", 28),
    ("SRV", 33),
    ("CAA", 257),
    ("ANY", 255),
];

pub fn type_code(name: &str) -> Option<u16> {
    let n = name.to_ascii_uppercase();
    TYPES.iter().find(|(t, _)| *t == n).map(|(_, c)| *c)
}

fn type_name(code: u16) -> String {
    TYPES.iter().find(|(_, c)| *c == code).map(|(t, _)| t.to_string()).unwrap_or_else(|| format!("TYPE{code}"))
}

pub fn rcode_name(rcode: u8) -> &'static str {
    match rcode {
        0 => "NOERROR",
        1 => "FORMERR",
        2 => "SERVFAIL",
        3 => "NXDOMAIN",
        4 => "NOTIMP",
        5 => "REFUSED",
        _ => "ERROR",
    }
}

/// The reverse-lookup name of an address: `1.2.3.4` becomes `4.3.2.1.in-addr.arpa`.
pub fn ptr_name(ip: IpAddr) -> String {
    match ip {
        IpAddr::V4(a) => {
            let o = a.octets();
            format!("{}.{}.{}.{}.in-addr.arpa", o[3], o[2], o[1], o[0])
        }
        IpAddr::V6(a) => {
            let mut s = String::new();
            for b in a.octets().iter().rev() {
                s.push_str(&format!("{:x}.{:x}.", b & 0xf, b >> 4));
            }
            s + "ip6.arpa"
        }
    }
}

/// A query for one name and type, recursion desired. The name must already be ASCII (punycode for international names).
pub fn build_query(id: u16, name: &str, qtype: u16) -> Result<Vec<u8>, String> {
    let name = name.trim_end_matches('.');
    if name.len() > 253 {
        return Err("That name is too long.".into());
    }
    let mut out = Vec::with_capacity(18 + name.len());
    out.extend_from_slice(&id.to_be_bytes());
    out.extend_from_slice(&[0x01, 0x00, 0, 1, 0, 0, 0, 0, 0, 0]);
    if !name.is_empty() {
        for label in name.split('.') {
            if label.is_empty() || label.len() > 63 {
                return Err("Each part of a name must be 1 to 63 characters.".into());
            }
            out.push(label.len() as u8);
            out.extend_from_slice(label.as_bytes());
        }
    }
    out.push(0);
    out.extend_from_slice(&qtype.to_be_bytes());
    out.extend_from_slice(&1u16.to_be_bytes());
    Ok(out)
}

fn u16_at(b: &[u8], i: usize) -> Result<u16, String> {
    b.get(i..i + 2).map(|s| u16::from_be_bytes([s[0], s[1]])).ok_or_else(|| "The answer was cut short.".to_string())
}

fn u32_at(b: &[u8], i: usize) -> Result<u32, String> {
    b.get(i..i + 4).map(|s| u32::from_be_bytes([s[0], s[1], s[2], s[3]])).ok_or_else(|| "The answer was cut short.".to_string())
}

/// Read a (possibly compressed) name starting at `pos`. Returns the name and the position after it in the message.
fn read_name(msg: &[u8], pos: usize) -> Result<(String, usize), String> {
    let mut labels: Vec<String> = Vec::new();
    let mut i = pos;
    let mut after = None;
    let mut hops = 0;
    loop {
        let len = *msg.get(i).ok_or("The answer was cut short.")? as usize;
        if len == 0 {
            i += 1;
            break;
        }
        if len & 0xc0 == 0xc0 {
            let lo = *msg.get(i + 1).ok_or("The answer was cut short.")? as usize;
            if after.is_none() {
                after = Some(i + 2);
            }
            hops += 1;
            if hops > 32 {
                return Err("The answer has a name that loops.".into());
            }
            i = ((len & 0x3f) << 8) | lo;
            continue;
        }
        if len > 63 {
            return Err("The answer has an invalid name.".into());
        }
        let bytes = msg.get(i + 1..i + 1 + len).ok_or("The answer was cut short.")?;
        labels.push(String::from_utf8_lossy(bytes).into_owned());
        i += 1 + len;
        if labels.len() > 127 {
            return Err("The answer has an invalid name.".into());
        }
    }
    let name = if labels.is_empty() { ".".to_string() } else { labels.join(".") };
    Ok((name, after.unwrap_or(i)))
}

fn quote_txt(parts: &[&[u8]]) -> String {
    parts
        .iter()
        .map(|p| format!("\"{}\"", String::from_utf8_lossy(p).replace('\\', "\\\\").replace('"', "\\\"")))
        .collect::<Vec<_>>()
        .join(" ")
}

fn rdata_text(msg: &[u8], rtype: u16, start: usize, len: usize) -> Result<String, String> {
    let end = start + len;
    let rd = msg.get(start..end).ok_or("The answer was cut short.")?;
    Ok(match rtype {
        1 if len == 4 => Ipv4Addr::new(rd[0], rd[1], rd[2], rd[3]).to_string(),
        28 if len == 16 => {
            let mut o = [0u8; 16];
            o.copy_from_slice(rd);
            Ipv6Addr::from(o).to_string()
        }
        2 | 5 | 12 => read_name(msg, start)?.0,
        15 => format!("{} {}", u16_at(msg, start)?, read_name(msg, start + 2)?.0),
        16 => {
            let mut parts: Vec<&[u8]> = Vec::new();
            let mut i = 0;
            while i < rd.len() {
                let l = rd[i] as usize;
                parts.push(rd.get(i + 1..i + 1 + l).ok_or("The answer was cut short.")?);
                i += 1 + l;
            }
            quote_txt(&parts)
        }
        6 => {
            let (m, p) = read_name(msg, start)?;
            let (r, p) = read_name(msg, p)?;
            format!("{m} {r} {} {} {} {} {}", u32_at(msg, p)?, u32_at(msg, p + 4)?, u32_at(msg, p + 8)?, u32_at(msg, p + 12)?, u32_at(msg, p + 16)?)
        }
        33 => format!("{} {} {} {}", u16_at(msg, start)?, u16_at(msg, start + 2)?, u16_at(msg, start + 4)?, read_name(msg, start + 6)?.0),
        257 if len >= 2 => {
            let tag_len = rd[1] as usize;
            let tag = rd.get(2..2 + tag_len).ok_or("The answer was cut short.")?;
            let value = &rd[2 + tag_len..];
            format!("{} {} \"{}\"", rd[0], String::from_utf8_lossy(tag), String::from_utf8_lossy(value))
        }
        _ => rd.iter().map(|b| format!("{b:02x}")).collect(),
    })
}

fn read_records(msg: &[u8], pos: &mut usize, count: u16) -> Result<Vec<Record>, String> {
    let mut out = Vec::new();
    for _ in 0..count {
        let (name, p) = read_name(msg, *pos)?;
        let rtype = u16_at(msg, p)?;
        let ttl = u32_at(msg, p + 4)?;
        let rdlen = u16_at(msg, p + 8)? as usize;
        let data = rdata_text(msg, rtype, p + 10, rdlen)?;
        *pos = p + 10 + rdlen;
        // The pseudo record that carries EDNS options is not an answer.
        if rtype != 41 {
            out.push(Record { name, rtype: type_name(rtype), ttl, data });
        }
    }
    Ok(out)
}

/// Parse a response to a query with this id.
pub fn parse_response(msg: &[u8], id: u16) -> Result<Answer, String> {
    if msg.len() < 12 {
        return Err("The answer was cut short.".into());
    }
    if u16_at(msg, 0)? != id {
        return Err("The answer does not match the question.".into());
    }
    let flags = u16_at(msg, 2)?;
    if flags & 0x8000 == 0 {
        return Err("That was a question, not an answer.".into());
    }
    let (qd, an, ns) = (u16_at(msg, 4)?, u16_at(msg, 6)?, u16_at(msg, 8)?);
    let mut pos = 12;
    for _ in 0..qd {
        let (_, p) = read_name(msg, pos)?;
        pos = p + 4;
    }
    let truncated = flags & 0x0200 != 0;
    // A truncated answer may stop anywhere: keep what could be read.
    let answers = match read_records(msg, &mut pos, an) {
        Ok(a) => a,
        Err(e) if truncated => {
            let _ = e;
            Vec::new()
        }
        Err(e) => return Err(e),
    };
    let authority = read_records(msg, &mut pos, ns).unwrap_or_default();
    Ok(Answer { rcode: (flags & 0xf) as u8, truncated, answers, authority })
}

/// Ask one resolver. UDP first; TCP when the answer is truncated. `timeout` covers the whole exchange.
pub fn query(name: &str, qtype: u16, resolver: SocketAddr, timeout: Duration) -> Result<Answer, String> {
    let deadline = Instant::now() + timeout;
    let id = (std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.subsec_nanos()).unwrap_or(7) ^ std::process::id()) as u16;
    let q = build_query(id, name, qtype)?;
    let left = |d: Instant| d.saturating_duration_since(Instant::now()).max(Duration::from_millis(50));

    let bind: SocketAddr = if resolver.is_ipv4() { "0.0.0.0:0" } else { "[::]:0" }.parse().unwrap();
    let sock = UdpSocket::bind(bind).map_err(|e| format!("Could not open a network socket: {e}"))?;
    sock.connect(resolver).map_err(|e| format!("Could not reach {resolver}: {e}"))?;
    sock.send(&q).map_err(|e| format!("Could not send the question to {resolver}: {e}"))?;
    let mut buf = vec![0u8; 4096];
    let answer = loop {
        sock.set_read_timeout(Some(left(deadline))).ok();
        let n = match sock.recv(&mut buf) {
            Ok(n) => n,
            Err(e) if matches!(e.kind(), std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut) => {
                return Err(format!("{resolver} did not answer in time."))
            }
            Err(e) => return Err(format!("{resolver}: {e}")),
        };
        // A reply with another id is a stray packet: ignore it and keep waiting.
        if let Ok(a) = parse_response(&buf[..n], id) {
            break a;
        }
        if Instant::now() >= deadline {
            return Err(format!("{resolver} did not answer in time."));
        }
    };
    if !answer.truncated {
        return Ok(answer);
    }

    let mut tcp = TcpStream::connect_timeout(&resolver, left(deadline)).map_err(|e| format!("Could not reach {resolver} over TCP: {e}"))?;
    tcp.set_read_timeout(Some(left(deadline))).ok();
    tcp.set_write_timeout(Some(left(deadline))).ok();
    let mut framed = (q.len() as u16).to_be_bytes().to_vec();
    framed.extend_from_slice(&q);
    tcp.write_all(&framed).map_err(|e| format!("{resolver}: {e}"))?;
    let mut len = [0u8; 2];
    tcp.read_exact(&mut len).map_err(|e| format!("{resolver}: {e}"))?;
    let mut body = vec![0u8; u16::from_be_bytes(len) as usize];
    tcp.read_exact(&mut body).map_err(|e| format!("{resolver}: {e}"))?;
    parse_response(&body, id)
}

/// The resolvers this machine is configured to use (empty when they cannot be found).
pub fn system_resolvers() -> Vec<IpAddr> {
    system_resolvers_impl()
}

#[cfg(unix)]
fn system_resolvers_impl() -> Vec<IpAddr> {
    std::fs::read_to_string("/etc/resolv.conf").map(|t| parse_resolv_conf(&t)).unwrap_or_default()
}

#[cfg(windows)]
fn system_resolvers_impl() -> Vec<IpAddr> {
    use windows_sys::Win32::NetworkManagement::IpHelper::{GetNetworkParams, FIXED_INFO_W2KSP1};
    unsafe {
        let mut len: u32 = 0;
        GetNetworkParams(std::ptr::null_mut(), &mut len);
        if len == 0 {
            return Vec::new();
        }
        let mut buf = vec![0u8; len as usize];
        let info = buf.as_mut_ptr() as *mut FIXED_INFO_W2KSP1;
        if GetNetworkParams(info, &mut len) != 0 {
            return Vec::new();
        }
        let mut out = Vec::new();
        let mut node: *const windows_sys::Win32::NetworkManagement::IpHelper::IP_ADDR_STRING = &(*info).DnsServerList;
        while !node.is_null() {
            let s: Vec<u8> = (*node).IpAddress.String.iter().map(|&c| c as u8).collect();
            let end = s.iter().position(|&c| c == 0).unwrap_or(s.len());
            if let Ok(ip) = String::from_utf8_lossy(&s[..end]).parse::<IpAddr>() {
                if !ip.is_unspecified() {
                    out.push(ip);
                }
            }
            node = (*node).Next;
        }
        out
    }
}

#[cfg(not(any(unix, windows)))]
fn system_resolvers_impl() -> Vec<IpAddr> {
    Vec::new()
}

#[cfg_attr(windows, allow(dead_code))]
pub fn parse_resolv_conf(text: &str) -> Vec<IpAddr> {
    text.lines()
        .filter_map(|l| {
            let l = l.split('#').next()?.trim();
            let rest = l.strip_prefix("nameserver")?.trim();
            // Link-local addresses may carry a zone ("fe80::1%eth0"): drop it.
            rest.split('%').next()?.parse::<IpAddr>().ok()
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A response for example.com with the answer name compressed to a pointer at the question.
    fn response(id: u16, flags: u16, answers: &[(u16, &[u8])]) -> Vec<u8> {
        let mut m = Vec::new();
        m.extend_from_slice(&id.to_be_bytes());
        m.extend_from_slice(&flags.to_be_bytes());
        m.extend_from_slice(&[0, 1]);
        m.extend_from_slice(&(answers.len() as u16).to_be_bytes());
        m.extend_from_slice(&[0, 0, 0, 0]);
        m.extend_from_slice(&[7]);
        m.extend_from_slice(b"example");
        m.extend_from_slice(&[3]);
        m.extend_from_slice(b"com");
        m.extend_from_slice(&[0, 0, 1, 0, 1]);
        for (t, rd) in answers {
            m.extend_from_slice(&[0xc0, 12]);
            m.extend_from_slice(&t.to_be_bytes());
            m.extend_from_slice(&[0, 1, 0, 0, 1, 0x2c]); // class IN, ttl 300
            m.extend_from_slice(&(rd.len() as u16).to_be_bytes());
            m.extend_from_slice(rd);
        }
        m
    }

    #[test]
    fn builds_a_query() {
        let q = build_query(0x1234, "www.example.com.", 15).unwrap();
        assert_eq!(&q[..12], &[0x12, 0x34, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0]);
        assert_eq!(&q[12..], b"\x03www\x07example\x03com\x00\x00\x0f\x00\x01");
        assert!(build_query(1, "a..b", 1).is_err());
        assert!(build_query(1, &"a".repeat(64), 1).is_err());
        assert!(build_query(1, &format!("{}.com", "a.".repeat(130)), 1).is_err());
    }

    #[test]
    fn parses_address_records_with_compressed_names() {
        let m = response(7, 0x8180, &[(1, &[93, 184, 216, 34]), (28, &[0x26, 6, 0x28, 0, 0x2, 0x20, 0, 1, 0x2, 0x48, 0x18, 0x93, 0x25, 0xc8, 0x19, 0x46])]);
        let a = parse_response(&m, 7).unwrap();
        assert_eq!(a.rcode, 0);
        assert!(!a.truncated);
        assert_eq!(a.answers[0], Record { name: "example.com".into(), rtype: "A".into(), ttl: 300, data: "93.184.216.34".into() });
        assert_eq!(a.answers[1].rtype, "AAAA");
        assert_eq!(a.answers[1].data, "2606:2800:220:1:248:1893:25c8:1946");
    }

    #[test]
    fn parses_mx_txt_ns_soa_srv_caa() {
        let mut mx = vec![0, 10];
        mx.extend_from_slice(b"\x04mail\xc0\x0c"); // mail.example.com via a pointer
        let txt = b"\x05hello\x06wor\"ld";
        let ns = b"\x03ns1\xc0\x0c";
        let mut soa = Vec::new();
        soa.extend_from_slice(b"\x03ns1\xc0\x0c\x05admin\xc0\x0c");
        for v in [2024010101u32, 7200, 3600, 1209600, 300] {
            soa.extend_from_slice(&v.to_be_bytes());
        }
        let mut srv = vec![0, 5, 0, 6, 0x1f, 0x90];
        srv.extend_from_slice(b"\x03srv\xc0\x0c");
        let caa = b"\x00\x05issueletsencrypt.org";
        let m = response(9, 0x8180, &[(15, &mx), (16, txt), (2, ns), (6, &soa), (33, &srv), (257, caa)]);
        let a = parse_response(&m, 9).unwrap();
        let d: Vec<&str> = a.answers.iter().map(|r| r.data.as_str()).collect();
        assert_eq!(d[0], "10 mail.example.com");
        assert_eq!(d[1], "\"hello\" \"wor\\\"ld\"");
        assert_eq!(d[2], "ns1.example.com");
        assert_eq!(d[3], "ns1.example.com admin.example.com 2024010101 7200 3600 1209600 300");
        assert_eq!(d[4], "5 6 8080 srv.example.com");
        assert_eq!(d[5], "0 issue \"letsencrypt.org\"");
    }

    #[test]
    fn reports_rcodes_truncation_and_bad_input() {
        let nx = parse_response(&response(1, 0x8183, &[]), 1).unwrap();
        assert_eq!(rcode_name(nx.rcode), "NXDOMAIN");
        assert!(nx.answers.is_empty());
        assert!(parse_response(&response(1, 0x8380, &[]), 1).unwrap().truncated);
        assert!(parse_response(&response(1, 0x8180, &[]), 2).is_err()); // wrong id
        assert!(parse_response(&response(1, 0x0100, &[]), 1).is_err()); // not a response
        assert!(parse_response(&[0; 5], 1).is_err());
        let mut cut = response(1, 0x8180, &[(1, &[1, 2, 3, 4])]);
        cut.truncate(cut.len() - 2);
        assert!(parse_response(&cut, 1).is_err());
    }

    #[test]
    fn a_name_pointer_loop_is_an_error_not_a_hang() {
        let mut m = response(1, 0x8180, &[(1, &[1, 2, 3, 4])]);
        let at = m.len() - 16; // the answer's name pointer
        m[at] = 0xc0;
        m[at + 1] = at as u8; // points at itself
        assert!(parse_response(&m, 1).is_err());
    }

    #[test]
    fn reverse_names_and_types() {
        assert_eq!(ptr_name("1.2.3.4".parse().unwrap()), "4.3.2.1.in-addr.arpa");
        assert_eq!(
            ptr_name("2001:db8::1".parse().unwrap()),
            "1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa"
        );
        assert_eq!(type_code("mx"), Some(15));
        assert_eq!(type_code("nope"), None);
    }

    #[test]
    fn reads_resolv_conf() {
        let t = "# comment\nsearch lan\nnameserver 192.168.1.1\nnameserver fe80::1%eth0 # zone\nnameserver nonsense\noptions edns0\n";
        assert_eq!(parse_resolv_conf(t), vec!["192.168.1.1".parse::<IpAddr>().unwrap(), "fe80::1".parse().unwrap()]);
    }

    #[test]
    fn asks_a_resolver_over_udp() {
        let server = UdpSocket::bind("127.0.0.1:0").unwrap();
        let addr = server.local_addr().unwrap();
        let t = std::thread::spawn(move || {
            let mut buf = [0u8; 512];
            let (n, from) = server.recv_from(&mut buf).unwrap();
            let id = u16::from_be_bytes([buf[0], buf[1]]);
            assert!(n > 12);
            server.send_to(&response(id, 0x8180, &[(1, &[10, 0, 0, 1])]), from).unwrap();
        });
        let a = query("example.com", 1, addr, Duration::from_secs(3)).unwrap();
        assert_eq!(a.answers[0].data, "10.0.0.1");
        t.join().unwrap();
    }

    #[test]
    fn a_silent_resolver_times_out() {
        let server = UdpSocket::bind("127.0.0.1:0").unwrap();
        let e = query("example.com", 1, server.local_addr().unwrap(), Duration::from_millis(300)).unwrap_err();
        assert!(e.contains("did not answer") || e.contains("refused") || e.contains("reset"), "{e}");
    }
}
