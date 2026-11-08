//! Network tools for the launcher: ping, traceroute and DNS lookups, done by this program itself (no helper
//! programs are started), so the answers look the same on Windows, Linux and macOS.
//!
//! The same rules as the curl runner apply: only our own page may call them (see `api::run`). On top of that the
//! number of probes, hops and time is capped, and at most two of these jobs run at once.

pub mod dns;
pub mod icmp;

use icmp::Probe;
use serde_json::{json, Value};
use std::net::{IpAddr, Ipv4Addr, SocketAddr, TcpStream, ToSocketAddrs};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};

const MAX_JOBS: usize = 2;
static JOBS: AtomicUsize = AtomicUsize::new(0);

/// Holds one of the few job slots; released when dropped.
pub struct Slot;
impl Slot {
    pub fn take() -> Option<Slot> {
        let mut n = JOBS.load(Ordering::Relaxed);
        loop {
            if n >= MAX_JOBS {
                return None;
            }
            match JOBS.compare_exchange(n, n + 1, Ordering::AcqRel, Ordering::Relaxed) {
                Ok(_) => return Some(Slot),
                Err(now) => n = now,
            }
        }
    }
}
impl Drop for Slot {
    fn drop(&mut self) {
        JOBS.fetch_sub(1, Ordering::AcqRel);
    }
}

pub fn busy() -> Value {
    json!({"error": "Other network checks are still running. Try again in a moment."})
}

/// A host name or an IP address, nothing else. Letters, digits, dots and dashes (and `_` when `underscore` is set,
/// for service names such as `_dmarc.example.com`); no leading dash or dot.
pub fn valid_host(s: &str, underscore: bool) -> bool {
    if s.parse::<IpAddr>().is_ok() {
        return true;
    }
    let s = s.strip_suffix('.').unwrap_or(s);
    !s.is_empty()
        && s.len() <= 253
        && !s.starts_with(['-', '.'])
        && s.split('.').all(|l| !l.is_empty() && l.len() <= 63)
        && s.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'.' || (underscore && b == b'_'))
}

fn ms(x: f64) -> f64 {
    (x * 10.0).round() / 10.0
}

/// The IPv4 address to probe. A name with several addresses uses the first IPv4 one.
fn resolve_v4(host: &str) -> Result<Ipv4Addr, String> {
    if let Ok(ip) = host.parse::<IpAddr>() {
        return match ip {
            IpAddr::V4(a) => Ok(a),
            IpAddr::V6(_) => Err("ping and traceroute use IPv4 for now; give an IPv4 address or a name that has one.".into()),
        };
    }
    let addrs: Vec<SocketAddr> = (host, 0).to_socket_addrs().map_err(|_| format!("Could not find {host}. Check the spelling, or your DNS."))?.collect();
    addrs
        .iter()
        .find_map(|a| if let IpAddr::V4(v) = a.ip() { Some(v) } else { None })
        .ok_or_else(|| format!("{host} has no IPv4 address; ping and traceroute use IPv4 for now."))
}

fn why(p: &Probe) -> String {
    match p {
        Probe::Timeout => "timeout".into(),
        Probe::Unreachable { why, from, .. } => format!("{why} (from {from})"),
        Probe::Expired { from, .. } => format!("TTL expired (from {from})"),
        Probe::Failed(e) | Probe::Denied(e) => e.clone(),
        Probe::Reply { .. } => String::new(),
    }
}

fn summary(rtts: &[f64], sent: usize) -> Value {
    let got = rtts.len();
    let (min, max) = rtts.iter().fold((f64::MAX, 0.0f64), |(a, b), &x| (a.min(x), b.max(x)));
    let avg = if got > 0 { rtts.iter().sum::<f64>() / got as f64 } else { 0.0 };
    json!({
        "sent": sent, "received": got,
        "loss": if sent > 0 { ((sent - got) as f64 * 100.0 / sent as f64).round() } else { 0.0 },
        "min": if got > 0 { json!(ms(min)) } else { Value::Null },
        "avg": if got > 0 { json!(ms(avg)) } else { Value::Null },
        "max": if got > 0 { json!(ms(max)) } else { Value::Null },
    })
}

/// Ping `host` `count` times (1 to 10), waiting up to `timeout_ms` for each. Falls back to measuring TCP connect time
/// (port 443, then 80) when this machine does not allow ICMP, and says so.
pub fn ping(host: &str, count: u32, timeout_ms: u64) -> Value {
    ping_with(host, count, timeout_ms, &icmp::probe, &tcp_connect)
}

fn ping_with(host: &str, count: u32, timeout_ms: u64, probe: &dyn Fn(Ipv4Addr, u8, Duration) -> Probe, tcp: &dyn Fn(Ipv4Addr, Duration) -> Option<f64>) -> Value {
    if !valid_host(host, false) {
        return json!({"error": "That is not a host name or IP address."});
    }
    let dst = match resolve_v4(host) {
        Ok(d) => d,
        Err(e) => return json!({"error": e}),
    };
    let count = count.clamp(1, 10) as usize;
    let timeout = Duration::from_millis(timeout_ms.clamp(200, 5000));
    let started = Instant::now();
    let mut results = Vec::new();
    let mut rtts = Vec::new();
    let mut mode = "icmp";
    let mut note = Value::Null;
    for i in 0..count {
        if started.elapsed() > Duration::from_secs(30) {
            note = json!("Stopped early: the check took too long.");
            break;
        }
        let p = probe(dst, 64, timeout);
        match &p {
            Probe::Reply { ms: t, .. } => {
                rtts.push(*t);
                results.push(json!({"seq": i + 1, "ms": ms(*t)}));
            }
            Probe::Denied(why_not) => {
                // ICMP is not allowed here: measure a TCP handshake instead, and say that is what it is.
                mode = "tcp";
                note = json!(format!("{why_not} Showing TCP connect time to port 443 or 80 instead."));
                results.clear();
                rtts.clear();
                for j in 0..count {
                    match tcp(dst, timeout) {
                        Some(t) => {
                            rtts.push(t);
                            results.push(json!({"seq": j + 1, "ms": ms(t)}));
                        }
                        None => results.push(json!({"seq": j + 1, "error": "no connection"})),
                    }
                }
                break;
            }
            other => results.push(json!({"seq": i + 1, "error": why(other)})),
        }
        if i + 1 < count {
            std::thread::sleep(Duration::from_millis(250));
        }
    }
    let sent = results.len();
    let mut out = summary(&rtts, sent);
    let o = out.as_object_mut().unwrap();
    o.insert("host".into(), json!(host));
    o.insert("addr".into(), json!(dst.to_string()));
    o.insert("mode".into(), json!(mode));
    o.insert("results".into(), json!(results));
    o.insert("note".into(), note);
    out
}

fn tcp_connect(dst: Ipv4Addr, timeout: Duration) -> Option<f64> {
    for port in [443u16, 80] {
        let t = Instant::now();
        let r = TcpStream::connect_timeout(&SocketAddr::new(IpAddr::V4(dst), port), timeout);
        match r {
            Ok(_) => return Some(t.elapsed().as_secs_f64() * 1000.0),
            // A refused connection still proves the host answered, and how fast.
            Err(e) if e.kind() == std::io::ErrorKind::ConnectionRefused => return Some(t.elapsed().as_secs_f64() * 1000.0),
            Err(_) => {}
        }
    }
    None
}

/// Trace the route to `host`: probes with TTL 1, 2, 3 and so on, three per hop, until the host answers or `max_hops`
/// (1 to 30) is reached.
pub fn trace(host: &str, max_hops: u32, timeout_ms: u64) -> Value {
    trace_with(host, max_hops, timeout_ms, &icmp::probe, Duration::from_secs(60))
}

fn trace_with(host: &str, max_hops: u32, timeout_ms: u64, probe: &dyn Fn(Ipv4Addr, u8, Duration) -> Probe, budget: Duration) -> Value {
    if !valid_host(host, false) {
        return json!({"error": "That is not a host name or IP address."});
    }
    let dst = match resolve_v4(host) {
        Ok(d) => d,
        Err(e) => return json!({"error": e}),
    };
    let max_hops = max_hops.clamp(1, 30) as u8;
    let timeout = Duration::from_millis(timeout_ms.clamp(200, 3000));
    let started = Instant::now();
    let mut hops = Vec::new();
    let mut reached = false;
    let mut cut = false;
    'hops: for ttl in 1..=max_hops {
        let mut addr: Option<Ipv4Addr> = None;
        let mut times: Vec<Value> = Vec::new();
        let mut note = String::new();
        let mut done = false;
        for _ in 0..3 {
            if started.elapsed() > budget {
                cut = true;
                break 'hops;
            }
            match probe(dst, ttl, timeout) {
                Probe::Reply { from, ms: t } => {
                    addr = Some(from);
                    times.push(json!(ms(t)));
                    done = true;
                }
                Probe::Expired { from, ms: t } => {
                    addr = Some(from);
                    times.push(json!(ms(t)));
                }
                Probe::Unreachable { from, ms: t, why } => {
                    addr = Some(from);
                    times.push(json!(ms(t)));
                    note = why;
                    done = true;
                }
                Probe::Timeout => times.push(Value::Null),
                Probe::Denied(e) | Probe::Failed(e) => return json!({"error": e}),
            }
        }
        hops.push(json!({"hop": ttl, "addr": addr.map(|a| a.to_string()), "ms": times, "note": note}));
        if done {
            reached = addr == Some(dst) || !note.is_empty();
            break;
        }
    }
    // Every probe timing out on every hop means no router could answer here: say so instead of printing stars.
    let any = hops.iter().any(|h| h["addr"].is_string());
    json!({
        "host": host, "addr": dst.to_string(), "hops": hops, "reached": reached && any, "max_hops": max_hops,
        "note": if cut { json!("Stopped early: the trace took too long.") } else if !any && !hops.is_empty() { json!("No router answered. A firewall may be dropping the probes, or this network does not return time-exceeded messages to programs without special rights.") } else { Value::Null },
    })
}

/// Look up DNS records of one type for a name (or a reverse lookup when `name` is an IP address and the type is PTR).
pub fn dns_lookup(name: &str, rtype: &str, resolver: Option<&str>) -> Value {
    let rtype = rtype.trim();
    let rtype = if rtype.is_empty() { "A" } else { rtype };
    let Some(code) = dns::type_code(rtype) else { return json!({"error": format!("Unknown record type {rtype}. Try A, AAAA, MX, TXT, NS, CNAME, SOA, PTR, SRV or CAA.")}) };
    let name = name.trim();
    if !valid_host(name, true) {
        return json!({"error": "That is not a valid domain name. Use letters, digits, dots and dashes (international names in their xn-- form)."});
    }
    let qname = match (code, name.parse::<IpAddr>()) {
        (12, Ok(ip)) => dns::ptr_name(ip),
        (_, Ok(_)) => return json!({"error": "Give a domain name, or choose PTR to look up an IP address."}),
        _ => name.to_string(),
    };
    let (servers, used): (Vec<SocketAddr>, String) = match resolver.map(str::trim).filter(|r| !r.is_empty()) {
        Some(r) => match r.parse::<IpAddr>().map(|ip| SocketAddr::new(ip, 53)).or_else(|_| r.parse::<SocketAddr>()) {
            Ok(a) => (vec![a], format!("{r} (chosen)")),
            Err(_) => return json!({"error": "The resolver must be an IP address such as 1.1.1.1."}),
        },
        None => {
            let sys = dns::system_resolvers();
            if sys.is_empty() {
                (vec![SocketAddr::new(IpAddr::V4(Ipv4Addr::new(1, 1, 1, 1)), 53)], "1.1.1.1 (no system resolver was found)".into())
            } else {
                (sys.iter().map(|ip| SocketAddr::new(*ip, 53)).collect(), format!("{} (this system's)", sys[0]))
            }
        }
    };
    let started = Instant::now();
    let mut last = String::new();
    for (i, s) in servers.iter().take(3).enumerate() {
        match dns::query(&qname, code, *s, Duration::from_secs(3)) {
            Ok(a) => {
                let rec = |r: &dns::Record| json!({"name": r.name, "type": r.rtype, "ttl": r.ttl, "data": r.data});
                return json!({
                    "name": qname, "type": rtype.to_ascii_uppercase(), "resolver": if i == 0 { used.clone() } else { format!("{s}") },
                    "status": dns::rcode_name(a.rcode), "truncated": a.truncated, "ms": started.elapsed().as_millis() as u64,
                    "answers": a.answers.iter().map(rec).collect::<Vec<_>>(),
                    "authority": a.authority.iter().map(rec).collect::<Vec<_>>(),
                });
            }
            Err(e) => last = e,
        }
    }
    json!({"error": last, "resolver": used})
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;

    #[test]
    fn host_validation_blocks_anything_that_is_not_a_name_or_address() {
        for ok in ["example.com", "a-b.example.co.uk", "10.0.0.1", "::1", "2001:db8::1", "localhost", "example.com."] {
            assert!(valid_host(ok, false), "{ok}");
        }
        for bad in ["", "-f", "--help", "a b", "a;b", "a|b", "$(id)", "a`b`", "a&b", "http://x", "a/b", ".x", "a..b", "x\n", "-", "é.com", "_dmarc.example.com"] {
            assert!(!valid_host(bad, false), "{bad:?}");
        }
        assert!(valid_host("_dmarc.example.com", true));
        assert!(!valid_host(&"a".repeat(64), false));
        assert!(!valid_host(&format!("{}.com", "a.".repeat(130)), false));
    }

    #[test]
    fn only_a_few_jobs_run_at_once() {
        let a = Slot::take().unwrap();
        let b = Slot::take();
        // Another test may hold a slot; with two taken a third is always refused.
        if b.is_some() {
            assert!(Slot::take().is_none());
        }
        drop(a);
        drop(b);
    }

    fn script(list: Vec<Probe>) -> impl Fn(Ipv4Addr, u8, Duration) -> Probe {
        let q = RefCell::new(list.into_iter());
        move |_, _, _| q.borrow_mut().next().unwrap_or(Probe::Timeout)
    }

    #[test]
    fn ping_summarises_replies_and_losses() {
        let lo = Ipv4Addr::LOCALHOST;
        let p = script(vec![Probe::Reply { from: lo, ms: 10.0 }, Probe::Timeout, Probe::Reply { from: lo, ms: 30.0 }, Probe::Reply { from: lo, ms: 20.0 }]);
        let r = ping_with("127.0.0.1", 4, 1000, &p, &|_, _| None);
        assert_eq!(r["mode"], "icmp");
        assert_eq!((r["sent"].as_u64(), r["received"].as_u64()), (Some(4), Some(3)));
        assert_eq!(r["loss"], 25.0);
        assert_eq!((r["min"].as_f64(), r["avg"].as_f64(), r["max"].as_f64()), (Some(10.0), Some(20.0), Some(30.0)));
        assert_eq!(r["results"][1]["error"], "timeout");
    }

    #[test]
    fn ping_falls_back_to_tcp_and_says_so() {
        let p = script(vec![Probe::Denied("No ICMP.".into())]);
        let r = ping_with("127.0.0.1", 3, 1000, &p, &|_, _| Some(4.0));
        assert_eq!(r["mode"], "tcp");
        assert_eq!(r["received"], 3);
        assert!(r["note"].as_str().unwrap().contains("TCP"));
    }

    #[test]
    fn ping_rejects_bad_hosts_before_probing() {
        let never = |_: Ipv4Addr, _: u8, _: Duration| -> Probe { panic!("must not probe") };
        assert!(ping_with("-f", 1, 1000, &never, &|_, _| None)["error"].is_string());
        assert!(ping_with("a;b", 1, 1000, &never, &|_, _| None)["error"].is_string());
        assert!(ping_with("::1", 1, 1000, &never, &|_, _| None)["error"].as_str().unwrap().contains("IPv4"));
    }

    #[test]
    fn trace_walks_the_hops_until_the_host_answers() {
        let r1 = "10.0.0.1".parse().unwrap();
        let r2 = "172.16.0.1".parse().unwrap();
        let dst: Ipv4Addr = "127.0.0.1".parse().unwrap();
        let p = script(vec![
            Probe::Expired { from: r1, ms: 1.0 }, Probe::Expired { from: r1, ms: 2.0 }, Probe::Expired { from: r1, ms: 3.0 },
            Probe::Timeout, Probe::Expired { from: r2, ms: 8.0 }, Probe::Timeout,
            Probe::Reply { from: dst, ms: 12.0 }, Probe::Reply { from: dst, ms: 13.0 }, Probe::Reply { from: dst, ms: 14.0 },
        ]);
        let r = trace_with("127.0.0.1", 30, 1000, &p, Duration::from_secs(60));
        let hops = r["hops"].as_array().unwrap();
        assert_eq!(hops.len(), 3);
        assert_eq!(hops[0]["addr"], "10.0.0.1");
        assert_eq!(hops[1]["addr"], "172.16.0.1");
        assert!(hops[1]["ms"][0].is_null());
        assert_eq!(hops[2]["addr"], "127.0.0.1");
        assert_eq!(r["reached"], true);
    }

    #[test]
    fn trace_explains_when_nothing_answers_and_stops_at_the_limit() {
        let r = trace_with("127.0.0.1", 3, 1000, &|_, _, _| Probe::Timeout, Duration::from_secs(60));
        assert_eq!(r["hops"].as_array().unwrap().len(), 3);
        assert_eq!(r["reached"], false);
        assert!(r["note"].as_str().unwrap().contains("No router answered"));
        assert!(trace_with("127.0.0.1", 3, 1000, &|_, _, _| Probe::Denied("nope".into()), Duration::from_secs(60))["error"].is_string());
        let cut = trace_with("127.0.0.1", 30, 1000, &|_, _, _| Probe::Timeout, Duration::ZERO);
        assert!(cut["note"].as_str().unwrap().contains("too long"));
    }

    #[test]
    fn dns_rejects_bad_input_without_asking_anyone() {
        assert!(dns_lookup("a b", "A", None)["error"].is_string());
        assert!(dns_lookup("example.com", "BOGUS", None)["error"].as_str().unwrap().contains("Unknown record type"));
        assert!(dns_lookup("example.com", "A", Some("not-an-ip"))["error"].as_str().unwrap().contains("resolver"));
        assert!(dns_lookup("1.2.3.4", "MX", None)["error"].as_str().unwrap().contains("PTR"));
    }
}
