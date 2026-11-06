//! A small blocking HTTP/1.1 server on `std::net`: one thread per connection, keep-alive, strict parsing.
//!
//! It serves the dashboard and its JSON API, which is about fifteen routes on a loopback port, so a general-purpose
//! async stack (hyper, tokio, tower, axum and their dependencies) was most of the exe for nothing. The trade is
//! that this parser is ours, so it is deliberately narrow and rejects anything ambiguous:
//!
//! * request line + headers at most 16 KB and 64 headers, bodies at most 8 MiB, at most 64 connections;
//! * `Content-Length` bodies only (`Transfer-Encoding`, including chunked uploads, is refused with 501);
//! * duplicate or non-numeric `Content-Length`, folded headers, bare line feeds, control characters, a missing
//!   `Host` on HTTP/1.1, absolute-form targets and unknown HTTP versions are refused;
//! * an idle keep-alive connection is closed after 30 s, and a request must arrive within 15 s of its first byte.

use std::io::{self, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

pub struct Limits {
    pub max_head: usize,
    pub max_headers: usize,
    pub max_body: usize,
    pub max_connections: usize,
    pub idle: Duration,
    pub read: Duration,
    pub write: Duration,
}

impl Default for Limits {
    fn default() -> Self {
        Limits {
            max_head: 16 * 1024,
            max_headers: 64,
            max_body: 8 * 1024 * 1024,
            max_connections: 64,
            idle: Duration::from_secs(30),
            read: Duration::from_secs(15),
            write: Duration::from_secs(30),
        }
    }
}

pub struct Request {
    pub method: String,
    pub path: String,
    pub query: String,
    pub headers: Vec<(String, String)>,
    pub body: Vec<u8>,
}

impl Request {
    /// First header with this name (case-insensitive).
    pub fn header(&self, name: &str) -> Option<&str> {
        self.headers.iter().find(|(k, _)| k.eq_ignore_ascii_case(name)).map(|(_, v)| v.as_str())
    }

    /// A decoded value from the query string (`a=b&c=d`); `+` means a space, as in a submitted form.
    pub fn query_param(&self, key: &str) -> Option<String> {
        self.query.split('&').find_map(|pair| {
            let (k, v) = pair.split_once('=').unwrap_or((pair, ""));
            (crate::http_client::percent_decode(&k.replace('+', " ")) == key).then(|| crate::http_client::percent_decode(&v.replace('+', " ")))
        })
    }
}

pub enum Body {
    Owned(Vec<u8>),
    Static(&'static [u8]),
}

pub struct Response {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: Body,
}

impl Response {
    pub fn new(status: u16) -> Self {
        Response { status, headers: Vec::new(), body: Body::Owned(Vec::new()) }
    }
    pub fn with(mut self, name: &str, value: &str) -> Self {
        self.headers.push((name.to_string(), value.to_string()));
        self
    }
    pub fn bytes(mut self, content_type: &str, body: Vec<u8>) -> Self {
        self.headers.push(("Content-Type".into(), content_type.into()));
        self.body = Body::Owned(body);
        self
    }
    pub fn static_bytes(mut self, content_type: &str, body: &'static [u8]) -> Self {
        self.headers.push(("Content-Type".into(), content_type.into()));
        self.body = Body::Static(body);
        self
    }
    pub fn json(value: &impl serde::Serialize) -> Self {
        match serde_json::to_vec(value) {
            Ok(b) => Response::new(200).bytes("application/json", b),
            Err(_) => Response::new(500),
        }
    }
    fn body_bytes(&self) -> &[u8] {
        match &self.body {
            Body::Owned(v) => v,
            Body::Static(s) => s,
        }
    }
}

fn reason(status: u16) -> &'static str {
    match status {
        100 => "Continue",
        200 => "OK",
        204 => "No Content",
        400 => "Bad Request",
        403 => "Forbidden",
        404 => "Not Found",
        405 => "Method Not Allowed",
        406 => "Not Acceptable",
        408 => "Request Timeout",
        409 => "Conflict",
        413 => "Content Too Large",
        415 => "Unsupported Media Type",
        417 => "Expectation Failed",
        422 => "Unprocessable Content",
        431 => "Request Header Fields Too Large",
        500 => "Internal Server Error",
        501 => "Not Implemented",
        503 => "Service Unavailable",
        505 => "HTTP Version Not Supported",
        _ => "Unknown",
    }
}

struct Failure(u16);

struct Guard(Arc<AtomicUsize>);
impl Guard {
    fn new(n: &Arc<AtomicUsize>) -> Self {
        n.fetch_add(1, Ordering::SeqCst);
        Guard(n.clone())
    }
}
impl Drop for Guard {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::SeqCst);
    }
}

pub type Handler = dyn Fn(&Request) -> Response + Send + Sync;

/// Accept connections forever, one thread each, up to the connection limit.
pub fn serve(listener: TcpListener, handler: Arc<Handler>, limits: Limits) {
    let limits = Arc::new(limits);
    let active = Arc::new(AtomicUsize::new(0));
    for stream in listener.incoming() {
        let Ok(stream) = stream else {
            thread::sleep(Duration::from_millis(50)); // out of descriptors or similar: do not spin
            continue;
        };
        let guard = Guard::new(&active);
        if active.load(Ordering::SeqCst) > limits.max_connections {
            drop(guard);
            let mut s = stream;
            let _ = s.write_all(b"HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\nRetry-After: 1\r\nConnection: close\r\n\r\n");
            linger(&mut s, Duration::from_millis(50), 4096);
            continue;
        }
        let (h, l) = (handler.clone(), limits.clone());
        let _ = thread::Builder::new().stack_size(1 << 20).spawn(move || {
            let _guard = guard;
            connection(stream, &*h, &l);
        });
    }
}

/// Close politely after an early answer: signal the end of our side, then swallow what the client is still
/// sending for a moment. Closing with unread data makes the operating system reset the connection, and the client
/// may then never see the response (a 413 for an oversized upload would show up as a network error).
fn linger(s: &mut TcpStream, wait: Duration, mut budget: usize) {
    let _ = s.shutdown(std::net::Shutdown::Write);
    let _ = s.set_read_timeout(Some(wait));
    let mut tmp = [0u8; 4096];
    while budget > 0 {
        match s.read(&mut tmp) {
            Ok(0) | Err(_) => break,
            Ok(n) => budget = budget.saturating_sub(n),
        }
    }
}

struct Conn {
    s: TcpStream,
    buf: Vec<u8>,
}

impl Conn {
    /// Read more bytes into `buf` before `deadline`. Ok(0) means the peer closed the connection.
    fn fill(&mut self, deadline: Instant) -> io::Result<usize> {
        let left = deadline.saturating_duration_since(Instant::now());
        if left.is_zero() {
            return Err(io::ErrorKind::TimedOut.into());
        }
        self.s.set_read_timeout(Some(left))?;
        let mut tmp = [0u8; 16 * 1024];
        let n = self.s.read(&mut tmp)?;
        self.buf.extend_from_slice(&tmp[..n]);
        Ok(n)
    }
}

fn timed_out(e: &io::Error) -> bool {
    matches!(e.kind(), io::ErrorKind::TimedOut | io::ErrorKind::WouldBlock)
}

fn find(hay: &[u8], needle: &[u8]) -> Option<usize> {
    hay.windows(needle.len()).position(|w| w == needle)
}

fn is_token(s: &str) -> bool {
    !s.is_empty() && s.bytes().all(|b| b.is_ascii_alphanumeric() || b"!#$%&'*+-.^_`|~".contains(&b))
}

fn connection(stream: TcpStream, handler: &Handler, limits: &Limits) {
    let _ = stream.set_nodelay(true);
    let _ = stream.set_write_timeout(Some(limits.write));
    let mut conn = Conn { s: stream, buf: Vec::new() };
    loop {
        match read_request(&mut conn, limits) {
            Ok(Some((req, keep))) => {
                let resp = handler(&req);
                if write_response(&mut conn.s, &req.method, &resp, keep).is_err() || !keep {
                    return;
                }
            }
            Ok(None) => return,
            Err(Failure(status)) => {
                let _ = write_response(&mut conn.s, "GET", &Response::new(status), false);
                linger(&mut conn.s, Duration::from_millis(500), 256 * 1024);
                return;
            }
        }
    }
}

/// `Ok(None)`: the peer went away or was idle. `Err`: answer with that status and close.
fn read_request(conn: &mut Conn, limits: &Limits) -> Result<Option<(Request, bool)>, Failure> {
    // Blank lines before a request line are tolerated (RFC 9112 2.2).
    while conn.buf.starts_with(b"\r\n") {
        conn.buf.drain(..2);
    }
    let mut deadline = Instant::now() + if conn.buf.is_empty() { limits.idle } else { limits.read };
    let mut first = conn.buf.is_empty();
    let head_end = loop {
        if let Some(p) = find(&conn.buf, b"\r\n\r\n") {
            break p;
        }
        if conn.buf.len() > limits.max_head {
            return Err(Failure(431));
        }
        match conn.fill(deadline) {
            Ok(0) => return Ok(None),
            Ok(_) => {
                if first {
                    first = false;
                    deadline = Instant::now() + limits.read; // the whole request must follow promptly
                }
                while conn.buf.starts_with(b"\r\n") {
                    conn.buf.drain(..2);
                }
            }
            Err(e) if timed_out(&e) => return if first { Ok(None) } else { Err(Failure(408)) },
            Err(_) => return Ok(None),
        }
    };
    if head_end > limits.max_head {
        return Err(Failure(431));
    }

    let head = String::from_utf8_lossy(&conn.buf[..head_end]).into_owned();
    let mut lines = head.split("\r\n");
    let request_line = lines.next().unwrap_or("");
    let mut parts = request_line.split(' ');
    let (method, target, version) = match (parts.next(), parts.next(), parts.next(), parts.next()) {
        (Some(m), Some(t), Some(v), None) => (m, t, v),
        _ => return Err(Failure(400)),
    };
    if !is_token(method) || target.bytes().any(|b| b <= b' ' || b == 0x7f) || request_line.contains(['\r', '\n']) {
        return Err(Failure(400));
    }
    let http11 = match version {
        "HTTP/1.1" => true,
        "HTTP/1.0" => false,
        v if v.starts_with("HTTP/") => return Err(Failure(505)),
        _ => return Err(Failure(400)),
    };
    if !target.starts_with('/') || target.len() > 8 * 1024 {
        return Err(Failure(400));
    }
    let (path, query) = target.split_once('?').unwrap_or((target, ""));

    let mut headers = Vec::new();
    for line in lines {
        if line.starts_with([' ', '\t']) || line.contains(['\r', '\n', '\0']) {
            return Err(Failure(400)); // folded header lines and bare line feeds are how request smuggling starts
        }
        let (name, value) = line.split_once(':').ok_or(Failure(400))?;
        if !is_token(name) {
            return Err(Failure(400));
        }
        if headers.len() >= limits.max_headers {
            return Err(Failure(431));
        }
        headers.push((name.to_string(), value.trim_matches([' ', '\t']).to_string()));
    }
    let header = |n: &str| headers.iter().find(|(k, _)| k.eq_ignore_ascii_case(n)).map(|(_, v)| v.as_str());

    if http11 && header("host").is_none() {
        return Err(Failure(400));
    }
    if header("transfer-encoding").is_some() {
        return Err(Failure(501)); // chunked uploads are not supported; the dashboard never sends them
    }
    let lengths: Vec<&str> = headers.iter().filter(|(k, _)| k.eq_ignore_ascii_case("content-length")).map(|(_, v)| v.as_str()).collect();
    let content_length = match lengths.as_slice() {
        [] => 0usize,
        [first, rest @ ..] => {
            if rest.iter().any(|l| l != first) || first.is_empty() || first.len() > 10 || !first.bytes().all(|b| b.is_ascii_digit()) {
                return Err(Failure(400));
            }
            first.parse::<usize>().map_err(|_| Failure(400))?
        }
    };
    if content_length > limits.max_body {
        return Err(Failure(413));
    }
    if let Some(expect) = header("expect") {
        if !expect.eq_ignore_ascii_case("100-continue") {
            return Err(Failure(417));
        }
        if content_length > 0 && conn.buf.len() < head_end + 4 + content_length {
            let _ = conn.s.write_all(b"HTTP/1.1 100 Continue\r\n\r\n");
        }
    }

    let body_start = head_end + 4;
    while conn.buf.len() < body_start + content_length {
        match conn.fill(deadline) {
            Ok(0) => return Ok(None),
            Ok(_) => {}
            Err(e) if timed_out(&e) => return Err(Failure(408)),
            Err(_) => return Ok(None),
        }
    }
    let body = conn.buf[body_start..body_start + content_length].to_vec();
    let conn_tokens = header("connection").map(|v| v.to_ascii_lowercase()).unwrap_or_default();
    let has = |t: &str| conn_tokens.split(',').any(|x| x.trim() == t);
    let keep = if http11 { !has("close") } else { has("keep-alive") };
    let req = Request { method: method.to_string(), path: path.to_string(), query: query.to_string(), headers, body };
    conn.buf.drain(..body_start + content_length);
    Ok(Some((req, keep)))
}

fn write_response(s: &mut TcpStream, method: &str, resp: &Response, keep: bool) -> io::Result<()> {
    let body = resp.body_bytes();
    let mut head = format!("HTTP/1.1 {} {}\r\nContent-Length: {}\r\n", resp.status, reason(resp.status), body.len());
    for (k, v) in &resp.headers {
        head.push_str(k);
        head.push_str(": ");
        head.push_str(v);
        head.push_str("\r\n");
    }
    head.push_str(if keep { "Connection: keep-alive\r\n\r\n" } else { "Connection: close\r\n\r\n" });
    let send_body = method != "HEAD" && resp.status != 204;
    if send_body && body.len() <= 16 * 1024 {
        let mut all = head.into_bytes();
        all.extend_from_slice(body);
        s.write_all(&all)?;
    } else {
        s.write_all(head.as_bytes())?;
        if send_body {
            s.write_all(body)?;
        }
    }
    s.flush()
}

// ------------------------------------------------------------------------------------------------------ tests

#[cfg(test)]
mod tests {
    use super::*;

    fn start(limits: Limits) -> u16 {
        let l = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = l.local_addr().unwrap().port();
        let h: Arc<Handler> = Arc::new(|r: &Request| {
            let echo = format!("{} {} q={} body={} ua={:?}", r.method, r.path, r.query, String::from_utf8_lossy(&r.body), r.header("user-agent"));
            Response::new(200).bytes("text/plain", echo.into_bytes()).with("X-Test", "1")
        });
        thread::spawn(move || serve(l, h, limits));
        port
    }

    fn short() -> Limits {
        Limits { idle: Duration::from_millis(400), read: Duration::from_millis(400), ..Limits::default() }
    }

    /// Send raw bytes, read until the server closes (or `wait`), return the text.
    fn raw(port: u16, request: &[u8]) -> String {
        let mut s = TcpStream::connect(("127.0.0.1", port)).unwrap();
        s.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
        s.write_all(request).unwrap();
        let mut out = Vec::new();
        let _ = s.read_to_end(&mut out);
        String::from_utf8_lossy(&out).into_owned()
    }

    fn status(resp: &str) -> u16 {
        resp.split(' ').nth(1).and_then(|s| s.parse().ok()).unwrap_or(0)
    }

    /// Read exactly one response (by Content-Length) from a stream that stays open.
    fn read_one(s: &mut TcpStream) -> String {
        let mut buf = Vec::new();
        let mut b = [0u8; 1];
        while !buf.ends_with(b"\r\n\r\n") {
            assert_eq!(s.read(&mut b).unwrap(), 1, "connection closed early");
            buf.push(b[0]);
        }
        let head = String::from_utf8_lossy(&buf).into_owned();
        let len: usize = head.lines().find_map(|l| l.strip_prefix("Content-Length: ")).unwrap().parse().unwrap();
        let mut body = vec![0u8; len];
        s.read_exact(&mut body).unwrap();
        format!("{head}{}", String::from_utf8_lossy(&body))
    }

    #[test]
    fn answers_a_simple_get_and_closes_on_request() {
        let p = start(Limits::default());
        let r = raw(p, b"GET /a/b?x=1&y=2 HTTP/1.1\r\nHost: localhost\r\nUser-Agent: t\r\nConnection: close\r\n\r\n");
        assert_eq!(status(&r), 200);
        assert!(r.contains("Connection: close") && r.contains("X-Test: 1") && r.contains("Content-Type: text/plain"));
        assert!(r.ends_with("GET /a/b q=x=1&y=2 body= ua=Some(\"t\")"), "{r}");
    }

    #[test]
    fn keeps_the_connection_alive_for_several_requests() {
        let p = start(Limits::default());
        let mut s = TcpStream::connect(("127.0.0.1", p)).unwrap();
        s.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
        for i in 0..3 {
            s.write_all(format!("GET /n{i} HTTP/1.1\r\nHost: x\r\n\r\n").as_bytes()).unwrap();
            let r = read_one(&mut s);
            assert!(r.contains("Connection: keep-alive") && r.contains(&format!("/n{i} ")), "{r}");
        }
    }

    #[test]
    fn handles_pipelined_requests_and_post_bodies() {
        let p = start(Limits::default());
        let r = raw(p, b"POST /one HTTP/1.1\r\nHost: x\r\nContent-Length: 5\r\n\r\nhelloGET /two HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n");
        assert!(r.contains("POST /one q= body=hello") && r.contains("GET /two"), "{r}");
        assert_eq!(r.matches("HTTP/1.1 200").count(), 2);
    }

    #[test]
    fn sends_100_continue_when_asked() {
        let p = start(Limits::default());
        let mut s = TcpStream::connect(("127.0.0.1", p)).unwrap();
        s.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
        s.write_all(b"POST /x HTTP/1.1\r\nHost: x\r\nContent-Length: 4\r\nExpect: 100-continue\r\nConnection: close\r\n\r\n").unwrap();
        let mut interim = [0u8; 25];
        s.read_exact(&mut interim).unwrap();
        assert_eq!(&interim, b"HTTP/1.1 100 Continue\r\n\r\n");
        s.write_all(b"data").unwrap();
        let mut rest = String::new();
        s.read_to_string(&mut rest).unwrap();
        assert!(rest.contains("body=data"), "{rest}");
    }

    #[test]
    fn head_has_headers_but_no_body_and_http10_closes() {
        let p = start(Limits::default());
        let r = raw(p, b"HEAD /h HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n");
        assert!(r.starts_with("HTTP/1.1 200") && r.ends_with("\r\n\r\n") && r.contains("Content-Length: "), "{r}");
        let r = raw(p, b"GET /old HTTP/1.0\r\n\r\n");
        assert!(status(&r) == 200 && r.contains("Connection: close") && r.contains("GET /old"), "{r}");
    }

    #[test]
    fn refuses_ambiguous_or_unsupported_requests() {
        let p = start(Limits::default());
        let cases: &[(&str, u16)] = &[
            ("GET / HTTP/1.1\r\nHost: x\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n", 501),
            ("POST / HTTP/1.1\r\nHost: x\r\nContent-Length: 3\r\nTransfer-Encoding: chunked\r\n\r\n", 501),
            ("POST / HTTP/1.1\r\nHost: x\r\nContent-Length: 3\r\nContent-Length: 4\r\n\r\nabcd", 400),
            ("POST / HTTP/1.1\r\nHost: x\r\nContent-Length: -1\r\n\r\n", 400),
            ("POST / HTTP/1.1\r\nHost: x\r\nContent-Length: 1e3\r\n\r\n", 400),
            ("POST / HTTP/1.1\r\nHost: x\r\nContent-Length: 99999999999\r\n\r\n", 400),
            ("POST / HTTP/1.1\r\nHost: x\r\nContent-Length: 9000000\r\n\r\n", 413),
            ("GET / HTTP/1.1\r\nHost: x\r\n folded: header\r\n\r\n", 400),
            ("GET / HTTP/1.1\r\nHost: x\r\nBad Name: v\r\n\r\n", 400),
            ("GET / HTTP/1.1\r\nHost: x\r\nNoColon\r\n\r\n", 400),
            ("GET / HTTP/1.1\r\nHost: x\nX: bare-lf\r\n\r\n", 400),
            ("GET / HTTP/1.1\r\n\r\n", 400),
            ("GET http://example.com/ HTTP/1.1\r\nHost: x\r\n\r\n", 400),
            ("GET * HTTP/1.1\r\nHost: x\r\n\r\n", 400),
            ("GE T / HTTP/1.1\r\nHost: x\r\n\r\n", 400),
            ("GET /sp ace HTTP/1.1\r\nHost: x\r\n\r\n", 400),
            ("GET / HTTP/2.0\r\nHost: x\r\n\r\n", 505),
            ("GET / SPDY/3\r\nHost: x\r\n\r\n", 400),
            ("POST / HTTP/1.1\r\nHost: x\r\nContent-Length: 1\r\nExpect: nonsense\r\n\r\nx", 417),
        ];
        for (req, want) in cases {
            let r = raw(p, req.as_bytes());
            assert_eq!(status(&r), *want, "request {req:?} got {r:?}");
            assert!(r.contains("Connection: close"), "{r}");
        }
    }

    #[test]
    fn an_oversized_upload_still_receives_its_413() {
        let p = start(Limits { max_body: 1000, ..Limits::default() });
        let mut s = TcpStream::connect(("127.0.0.1", p)).unwrap();
        s.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
        s.write_all(b"POST / HTTP/1.1\r\nHost: x\r\nContent-Length: 200000\r\n\r\n").unwrap();
        // the client keeps sending while the server answers; closing early would reset the connection
        let chunk = vec![b'z'; 20_000];
        for _ in 0..10 {
            if s.write_all(&chunk).is_err() {
                break;
            }
        }
        let mut out = String::new();
        let _ = s.read_to_string(&mut out);
        assert_eq!(status(&out), 413, "{out:?}");
    }

    #[test]
    fn enforces_header_limits() {
        let p = start(Limits::default());
        let big = format!("GET / HTTP/1.1\r\nHost: x\r\nX-Big: {}\r\n\r\n", "a".repeat(20 * 1024));
        assert_eq!(status(&raw(p, big.as_bytes())), 431);
        let many: String = (0..70).map(|i| format!("X-{i}: v\r\n")).collect();
        assert_eq!(status(&raw(p, format!("GET / HTTP/1.1\r\nHost: x\r\n{many}\r\n").as_bytes())), 431);
        let no_end = format!("GET / HTTP/1.1\r\nHost: x\r\nX-Big: {}", "a".repeat(20 * 1024));
        assert_eq!(status(&raw(p, no_end.as_bytes())), 431);
    }

    #[test]
    fn accepts_a_body_right_at_the_limit_and_refuses_more() {
        let p = start(Limits { max_body: 1000, ..Limits::default() });
        let at = format!("POST / HTTP/1.1\r\nHost: x\r\nContent-Length: 1000\r\nConnection: close\r\n\r\n{}", "b".repeat(1000));
        assert_eq!(status(&raw(p, at.as_bytes())), 200);
        assert_eq!(status(&raw(p, b"POST / HTTP/1.1\r\nHost: x\r\nContent-Length: 1001\r\n\r\n")), 413);
    }

    #[test]
    fn a_stalled_request_gets_408_and_an_idle_connection_is_dropped_quietly() {
        let p = start(short());
        let r = raw(p, b"POST / HTTP/1.1\r\nHost: x\r\nContent-Length: 10\r\n\r\nonly5");
        assert_eq!(status(&r), 408, "{r}");
        let r = raw(p, b"GET / HTTP/1.1\r\nHo"); // half a head, then silence
        assert_eq!(status(&r), 408, "{r}");
        let mut s = TcpStream::connect(("127.0.0.1", p)).unwrap();
        s.set_read_timeout(Some(Duration::from_secs(3))).unwrap();
        let mut b = [0u8; 8];
        assert_eq!(s.read(&mut b).unwrap(), 0, "an idle connection is closed without a response");
    }

    #[test]
    fn refuses_connections_over_the_limit() {
        let p = start(Limits { max_connections: 2, ..Limits::default() });
        let _a = TcpStream::connect(("127.0.0.1", p)).unwrap();
        let _b = TcpStream::connect(("127.0.0.1", p)).unwrap();
        thread::sleep(Duration::from_millis(100));
        let r = raw(p, b"GET / HTTP/1.1\r\nHost: x\r\n\r\n");
        assert_eq!(status(&r), 503, "{r}");
        drop(_a);
        thread::sleep(Duration::from_millis(200));
        assert_eq!(status(&raw(p, b"GET / HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n")), 200);
    }

    #[test]
    fn decodes_query_parameters() {
        let r = Request { method: "GET".into(), path: "/".into(), query: "a=1&name=my%20photo+1.png&empty=&flag".into(), headers: vec![], body: vec![] };
        assert_eq!(r.query_param("name").as_deref(), Some("my photo 1.png"));
        assert_eq!(r.query_param("a").as_deref(), Some("1"));
        assert_eq!(r.query_param("empty").as_deref(), Some(""));
        assert_eq!(r.query_param("flag").as_deref(), Some(""));
        assert_eq!(r.query_param("missing"), None);
    }
}
