//! A small HTTP/1.1 client for the curl runner: http and https (through the operating system's TLS via `native-tls`),
//! any method, headers, a text body, redirects, chunked and close-delimited responses, and one overall time limit.
//!
//! It exists because the general-purpose clients pull in a full URL parser with Unicode (IDN) tables, which were
//! several hundred KB of the exe for a feature the runner does not need. What it does not do, on purpose:
//! IDN host names (give the `xn--` form), proxies, response decompression (no `Accept-Encoding` is sent) and
//! connection reuse (`Connection: close`).

use std::io::{self, BufRead, BufReader, Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::time::{Duration, Instant};

pub struct Request {
    pub method: String,
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: Option<String>,
    pub timeout: Duration,
    pub follow: bool,
    pub insecure: bool,
}

#[derive(Debug)]
pub struct Response {
    pub status: u16,
    pub status_text: String,
    pub headers: Vec<(String, String)>,
    /// At most `max_body + 1` bytes: one extra byte tells the caller the body was cut.
    pub body: Vec<u8>,
}

const MAX_REDIRECTS: usize = 10;
const MAX_HEAD: usize = 64 * 1024;

// ---------------------------------------------------------------------------------------------------- URLs

#[derive(Clone, Debug, PartialEq)]
pub struct Url {
    pub https: bool,
    pub host: String, // without brackets
    pub port: u16,
    pub target: String, // path + query, always starts with '/'
    pub userinfo: Option<(String, String)>,
}

impl Url {
    fn default_port(&self) -> bool {
        self.port == if self.https { 443 } else { 80 }
    }
    /// The value of the Host header.
    fn host_header(&self) -> String {
        let h = if self.host.contains(':') { format!("[{}]", self.host) } else { self.host.clone() };
        if self.default_port() { h } else { format!("{h}:{}", self.port) }
    }
}

pub(crate) fn percent_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() && b[i + 1].is_ascii_hexdigit() && b[i + 2].is_ascii_hexdigit() {
            out.push(u8::from_str_radix(&s[i + 1..i + 3], 16).unwrap());
            i += 3;
        } else {
            out.push(b[i]);
            i += 1;
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Percent-encode what may not appear raw in a request target (spaces, controls, non-ASCII, a few delimiters),
/// leaving existing %XX escapes and reserved characters alone.
fn encode_target(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for &b in s.as_bytes() {
        if b <= b' ' || b >= 0x7f || matches!(b, b'"' | b'<' | b'>' | b'`' | b'{' | b'}' | b'|' | b'\\' | b'^') {
            out.push_str(&format!("%{b:02X}"));
        } else {
            out.push(b as char);
        }
    }
    out
}

pub fn parse_url(input: &str) -> Result<Url, String> {
    let input = input.trim();
    let (https, rest) = if let Some(r) = strip_prefix_ci(input, "https://") {
        (true, r)
    } else if let Some(r) = strip_prefix_ci(input, "http://") {
        (false, r)
    } else {
        return Err("Only http:// and https:// URLs are supported".into());
    };
    let rest = rest.split('#').next().unwrap_or("");
    let end = rest.find(['/', '?']).unwrap_or(rest.len());
    let (authority, tail) = rest.split_at(end);
    let (userinfo, hostport) = match authority.rfind('@') {
        Some(i) => {
            let (u, p) = authority[..i].split_once(':').unwrap_or((&authority[..i], ""));
            (Some((percent_decode(u), percent_decode(p))), &authority[i + 1..])
        }
        None => (None, authority),
    };
    let (host, port_str) = if let Some(r) = hostport.strip_prefix('[') {
        let close = r.find(']').ok_or("Invalid IPv6 address in URL")?;
        let after = &r[close + 1..];
        (r[..close].to_string(), after.strip_prefix(':'))
    } else {
        match hostport.rsplit_once(':') {
            Some((h, p)) => (h.to_string(), Some(p)),
            None => (hostport.to_string(), None),
        }
    };
    if host.is_empty() {
        return Err("The URL has no host name".into());
    }
    if !host.is_ascii() {
        return Err("Non-ASCII host names are not supported: use the punycode form (xn--…)".into());
    }
    if host.bytes().any(|b| b <= b' ' || b == 0x7f) {
        return Err("Invalid character in host name".into());
    }
    let port = match port_str {
        None | Some("") => if https { 443 } else { 80 },
        Some(p) => p.parse::<u16>().ok().filter(|p| *p != 0).ok_or("Invalid port in URL")?,
    };
    let target = if tail.is_empty() || tail.starts_with('?') { format!("/{tail}") } else { tail.to_string() };
    Ok(Url { https, host: host.to_ascii_lowercase(), port, target: encode_target(&target), userinfo })
}

fn strip_prefix_ci<'a>(s: &'a str, prefix: &str) -> Option<&'a str> {
    (s.len() >= prefix.len() && s.is_char_boundary(prefix.len()) && s[..prefix.len()].eq_ignore_ascii_case(prefix))
        .then(|| &s[prefix.len()..])
}

/// Resolve a Location header against the URL it came from.
pub fn resolve_location(base: &Url, location: &str) -> Result<Url, String> {
    let loc = location.trim();
    if strip_prefix_ci(loc, "http://").is_some() || strip_prefix_ci(loc, "https://").is_some() {
        return parse_url(loc);
    }
    let scheme = if base.https { "https" } else { "http" };
    if let Some(rest) = loc.strip_prefix("//") {
        return parse_url(&format!("{scheme}://{rest}"));
    }
    let loc = loc.split('#').next().unwrap_or("");
    let path = if loc.starts_with('/') {
        loc.to_string()
    } else if loc.starts_with('?') {
        format!("{}{}", base.target.split('?').next().unwrap_or("/"), loc)
    } else {
        let dir = base.target.split('?').next().unwrap_or("/");
        let dir = &dir[..dir.rfind('/').map_or(0, |i| i + 1)];
        format!("{dir}{loc}")
    };
    let (p, q) = match path.split_once('?') {
        Some((p, q)) => (p.to_string(), Some(q.to_string())),
        None => (path, None),
    };
    let mut segs: Vec<&str> = Vec::new();
    let ends_slash = p.ends_with('/') || p.ends_with("/.") || p.ends_with("/..");
    for s in p.split('/').skip(1) {
        match s {
            "." | "" => {}
            ".." => { segs.pop(); }
            s => segs.push(s),
        }
    }
    let mut target = format!("/{}", segs.join("/"));
    if ends_slash && !target.ends_with('/') {
        target.push('/');
    }
    if let Some(q) = q {
        target.push('?');
        target.push_str(&q);
    }
    Ok(Url { target: encode_target(&target), userinfo: None, ..base.clone() })
}

// ----------------------------------------------------------------------------------------------- connection

enum Conn {
    Plain(TcpStream),
    Tls(Box<native_tls::TlsStream<TcpStream>>),
}

impl Conn {
    fn tcp(&self) -> &TcpStream {
        match self {
            Conn::Plain(s) => s,
            Conn::Tls(s) => s.get_ref(),
        }
    }
}

impl Read for Conn {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        match self {
            Conn::Plain(s) => s.read(buf),
            Conn::Tls(s) => s.read(buf),
        }
    }
}

impl Write for Conn {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        match self {
            Conn::Plain(s) => s.write(buf),
            Conn::Tls(s) => s.write(buf),
        }
    }
    fn flush(&mut self) -> io::Result<()> {
        match self {
            Conn::Plain(s) => s.flush(),
            Conn::Tls(s) => s.flush(),
        }
    }
}

fn remaining(deadline: Instant) -> Result<Duration, String> {
    let left = deadline.saturating_duration_since(Instant::now());
    if left.is_zero() { Err("Timed out".into()) } else { Ok(left) }
}

fn connect(url: &Url, insecure: bool, deadline: Instant) -> Result<Conn, String> {
    let addrs: Vec<_> = (url.host.as_str(), url.port)
        .to_socket_addrs()
        .map_err(|e| format!("Could not resolve {}: {e}", url.host))?
        .collect();
    let mut last = format!("Could not resolve {}", url.host);
    let mut stream = None;
    for a in addrs {
        match TcpStream::connect_timeout(&a, remaining(deadline)?) {
            Ok(s) => { stream = Some(s); break; }
            Err(e) => last = format!("Connection failed: {e}"),
        }
    }
    let stream = stream.ok_or(last)?;
    let _ = stream.set_nodelay(true);
    stream.set_write_timeout(Some(remaining(deadline)?)).map_err(|e| e.to_string())?;
    if !url.https {
        return Ok(Conn::Plain(stream));
    }
    stream.set_read_timeout(Some(remaining(deadline)?)).map_err(|e| e.to_string())?;
    let mut b = native_tls::TlsConnector::builder();
    if insecure {
        b.danger_accept_invalid_certs(true).danger_accept_invalid_hostnames(true);
    }
    let connector = b.build().map_err(|e| e.to_string())?;
    let tls = connector.connect(&url.host, stream).map_err(|e| format!("TLS handshake failed: {e}"))?;
    Ok(Conn::Tls(Box::new(tls)))
}

// ---------------------------------------------------------------------------------------------------- send

fn is_token(s: &str) -> bool {
    !s.is_empty() && s.bytes().all(|b| b.is_ascii_alphanumeric() || b"!#$%&'*+-.^_`|~".contains(&b))
}

fn base64(data: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(data.len().div_ceil(3) * 4);
    for c in data.chunks(3) {
        let n = (c[0] as u32) << 16 | (*c.get(1).unwrap_or(&0) as u32) << 8 | *c.get(2).unwrap_or(&0) as u32;
        out.push(T[(n >> 18) as usize & 63] as char);
        out.push(T[(n >> 12) as usize & 63] as char);
        out.push(if c.len() > 1 { T[(n >> 6) as usize & 63] as char } else { '=' });
        out.push(if c.len() > 2 { T[n as usize & 63] as char } else { '=' });
    }
    out
}

fn has_header(headers: &[(String, String)], name: &str) -> bool {
    headers.iter().any(|(k, _)| k.eq_ignore_ascii_case(name))
}

/// Perform the request, following redirects when asked. Errors are human-readable strings for the UI.
pub fn send(req: &Request, max_body: usize) -> Result<Response, String> {
    if !is_token(&req.method) {
        return Err("Invalid HTTP method".into());
    }
    for (k, v) in &req.headers {
        if !is_token(k) || v.bytes().any(|b| b == b'\r' || b == b'\n' || b == 0) {
            return Err(format!("Invalid header: {k}"));
        }
    }
    let deadline = Instant::now() + req.timeout;
    let mut url = parse_url(&req.url)?;
    let mut method = req.method.to_ascii_uppercase();
    let mut body = req.body.clone();
    let mut headers = req.headers.clone();
    let mut hops = 0;
    loop {
        let resp = exchange(&url, &method, &headers, body.as_deref(), req.insecure, deadline, max_body)?;
        let location = resp.headers.iter().find(|(k, _)| k.eq_ignore_ascii_case("location")).map(|(_, v)| v.clone());
        let redirect = matches!(resp.status, 301 | 302 | 303 | 307 | 308);
        let Some(location) = location.filter(|_| req.follow && redirect && hops < MAX_REDIRECTS) else {
            return Ok(resp);
        };
        hops += 1;
        let next = resolve_location(&url, &location)?;
        if resp.status != 307 && resp.status != 308 && method != "HEAD" {
            // the browser/curl rule: these redirects turn into a plain GET
            method = "GET".into();
            body = None;
            headers.retain(|(k, _)| !k.to_ascii_lowercase().starts_with("content-"));
        }
        if next.host != url.host || next.port != url.port || next.https != url.https {
            // never hand credentials to another origin
            headers.retain(|(k, _)| !["authorization", "cookie", "proxy-authorization"].contains(&k.to_ascii_lowercase().as_str()));
        }
        url = next;
    }
}

fn exchange(url: &Url, method: &str, extra: &[(String, String)], body: Option<&str>, insecure: bool, deadline: Instant, max_body: usize) -> Result<Response, String> {
    let mut conn = connect(url, insecure, deadline)?;

    let mut head = format!("{method} {} HTTP/1.1\r\n", url.target);
    let mut put = |k: &str, v: &str| {
        head.push_str(k);
        head.push_str(": ");
        head.push_str(v);
        head.push_str("\r\n");
    };
    if !has_header(extra, "host") {
        put("Host", &url.host_header());
    }
    if !has_header(extra, "user-agent") {
        put("User-Agent", "home-screen");
    }
    if !has_header(extra, "accept") {
        put("Accept", "*/*");
    }
    if !has_header(extra, "authorization") {
        if let Some((u, p)) = &url.userinfo {
            put("Authorization", &format!("Basic {}", base64(format!("{u}:{p}").as_bytes())));
        }
    }
    for (k, v) in extra {
        // the client frames the message itself
        if ["content-length", "transfer-encoding", "connection"].contains(&k.to_ascii_lowercase().as_str()) {
            continue;
        }
        put(k, v);
    }
    if let Some(b) = body {
        if !has_header(extra, "content-type") {
            put("Content-Type", "text/plain; charset=utf-8");
        }
        put("Content-Length", &b.len().to_string());
    } else if !matches!(method, "GET" | "HEAD" | "DELETE" | "OPTIONS" | "TRACE") {
        put("Content-Length", "0");
    }
    put("Connection", "close");
    head.push_str("\r\n");

    conn.write_all(head.as_bytes()).map_err(|e| format!("Send failed: {e}"))?;
    if let Some(b) = body {
        conn.write_all(b.as_bytes()).map_err(|e| format!("Send failed: {e}"))?;
    }
    conn.flush().map_err(|e| format!("Send failed: {e}"))?;

    let mut rd = Reader { r: BufReader::new(conn), deadline };
    loop {
        let (status, status_text, headers) = rd.read_head()?;
        if (100..200).contains(&status) && status != 101 {
            continue; // interim response (100 Continue, 103 Early Hints): the real one follows
        }
        let header = |n: &str| headers.iter().find(|(k, _)| k.eq_ignore_ascii_case(n)).map(|(_, v)| v.as_str());
        let no_body = method == "HEAD" || status == 204 || status == 304 || status == 101;
        let mut data = Vec::new();
        if !no_body {
            let chunked = header("transfer-encoding").is_some_and(|v| v.to_ascii_lowercase().split(',').next_back().is_some_and(|t| t.trim() == "chunked"));
            if chunked {
                rd.read_chunked(&mut data, max_body + 1)?;
            } else if let Some(n) = header("content-length").and_then(|v| v.trim().parse::<u64>().ok()) {
                rd.read_exact_capped(&mut data, n, max_body + 1)?;
            } else {
                rd.read_to_close(&mut data, max_body + 1)?;
            }
        }
        return Ok(Response { status, status_text, headers, body: data });
    }
}

struct Reader {
    r: BufReader<Conn>,
    deadline: Instant,
}

impl Reader {
    fn arm(&mut self) -> Result<(), String> {
        let left = remaining(self.deadline)?;
        self.r.get_ref().tcp().set_read_timeout(Some(left)).map_err(|e| e.to_string())
    }

    fn io_err(e: io::Error) -> String {
        match e.kind() {
            io::ErrorKind::WouldBlock | io::ErrorKind::TimedOut => "Timed out".into(),
            _ => format!("Read failed: {e}"),
        }
    }

    fn line(&mut self, limit: usize) -> Result<String, String> {
        self.arm()?;
        let mut buf = Vec::new();
        let n = (&mut self.r).take(limit as u64 + 1).read_until(b'\n', &mut buf).map_err(Self::io_err)?;
        if n == 0 {
            return Err("The server closed the connection without answering".into());
        }
        if buf.len() > limit {
            return Err("Response header line is too long".into());
        }
        while matches!(buf.last(), Some(b'\n' | b'\r')) {
            buf.pop();
        }
        Ok(String::from_utf8_lossy(&buf).into_owned())
    }

    fn read_head(&mut self) -> Result<(u16, String, Vec<(String, String)>), String> {
        let status_line = self.line(MAX_HEAD)?;
        let mut parts = status_line.splitn(3, ' ');
        let version = parts.next().unwrap_or("");
        if !version.starts_with("HTTP/1.") {
            return Err(format!("Not an HTTP/1.x response: {}", status_line.chars().take(60).collect::<String>()));
        }
        let status: u16 = parts.next().and_then(|s| s.parse().ok()).filter(|s| (100..1000).contains(s)).ok_or("Invalid status line")?;
        let text = parts.next().unwrap_or("").trim().to_string();
        let mut headers = Vec::new();
        let mut size = status_line.len();
        loop {
            let l = self.line(MAX_HEAD)?;
            size += l.len();
            if size > MAX_HEAD {
                return Err("Response headers are too large".into());
            }
            if l.is_empty() {
                break;
            }
            if let Some((k, v)) = l.split_once(':') {
                headers.push((k.trim().to_string(), v.trim().to_string()));
            }
        }
        Ok((status, text, headers))
    }

    fn read_exact_capped(&mut self, out: &mut Vec<u8>, len: u64, cap: usize) -> Result<(), String> {
        let want = len.min(cap as u64);
        let mut left = want;
        let mut buf = [0u8; 8192];
        while left > 0 {
            self.arm()?;
            let n = self.r.read(&mut buf[..left.min(8192) as usize]).map_err(Self::io_err)?;
            if n == 0 {
                break; // a short body: show what arrived
            }
            out.extend_from_slice(&buf[..n]);
            left -= n as u64;
        }
        Ok(())
    }

    fn read_to_close(&mut self, out: &mut Vec<u8>, cap: usize) -> Result<(), String> {
        let mut buf = [0u8; 8192];
        while out.len() < cap {
            self.arm()?;
            match self.r.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => out.extend_from_slice(&buf[..n.min(cap - out.len())]),
                // TLS servers often drop the connection without close_notify at the end of the body
                Err(e) if e.kind() == io::ErrorKind::UnexpectedEof || e.kind() == io::ErrorKind::ConnectionAborted || e.kind() == io::ErrorKind::ConnectionReset => break,
                Err(e) => return Err(Self::io_err(e)),
            }
        }
        Ok(())
    }

    fn read_chunked(&mut self, out: &mut Vec<u8>, cap: usize) -> Result<(), String> {
        loop {
            let l = self.line(1024)?;
            let size_text = l.split(';').next().unwrap_or("").trim();
            let size = u64::from_str_radix(size_text, 16).map_err(|_| "Invalid chunk size in response".to_string())?;
            if size == 0 {
                // trailers: skip to the blank line
                while !self.line(MAX_HEAD)?.is_empty() {}
                return Ok(());
            }
            let before = out.len();
            self.read_exact_capped(out, size, cap.saturating_sub(out.len()))?;
            if out.len() >= cap {
                return Ok(());
            }
            if (out.len() - before) as u64 != size {
                return Ok(()); // truncated stream
            }
            self.line(8)?; // the CRLF after the chunk
        }
    }
}

// ------------------------------------------------------------------------------------------------------ tests

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;
    use std::thread;

    /// Serves each canned response to one connection, in order; returns the port and the received request heads.
    fn serve(responses: Vec<Vec<u8>>) -> (u16, thread::JoinHandle<Vec<String>>) {
        let l = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = l.local_addr().unwrap().port();
        let h = thread::spawn(move || {
            let mut seen = Vec::new();
            for r in responses {
                let (mut s, _) = l.accept().unwrap();
                let mut head = Vec::new();
                let mut b = [0u8; 1];
                while !head.ends_with(b"\r\n\r\n") {
                    if s.read(&mut b).unwrap() == 0 {
                        break;
                    }
                    head.push(b[0]);
                }
                let text = String::from_utf8_lossy(&head).into_owned();
                // read a request body if one is announced
                let len = text.lines().find_map(|l| l.to_ascii_lowercase().strip_prefix("content-length:").map(|v| v.trim().parse::<usize>().unwrap())).unwrap_or(0);
                let mut body = vec![0u8; len];
                s.read_exact(&mut body).unwrap();
                seen.push(format!("{text}{}", String::from_utf8_lossy(&body)));
                s.write_all(&r).unwrap();
            }
            seen
        });
        (port, h)
    }

    fn req(url: &str) -> Request {
        Request { method: "GET".into(), url: url.into(), headers: vec![], body: None, timeout: Duration::from_secs(5), follow: false, insecure: false }
    }

    fn ok(body: &str) -> Vec<u8> {
        format!("HTTP/1.1 200 OK\r\nContent-Length: {}\r\nX-Test: a\r\nX-Test: b\r\n\r\n{body}", body.len()).into_bytes()
    }

    #[test]
    fn parses_urls() {
        let u = parse_url("https://User:p%40ss@Example.COM:8443/a b/c?x=1&y=é#frag").unwrap();
        assert_eq!((u.https, u.host.as_str(), u.port), (true, "example.com", 8443));
        assert_eq!(u.target, "/a%20b/c?x=1&y=%C3%A9");
        assert_eq!(u.userinfo, Some(("User".into(), "p@ss".into())));
        assert_eq!(parse_url("http://localhost").unwrap().target, "/");
        assert_eq!(parse_url("http://localhost?q=1").unwrap().target, "/?q=1");
        assert_eq!(parse_url("http://[::1]:7878/x").unwrap().host_header(), "[::1]:7878");
        assert_eq!(parse_url("https://a.test/").unwrap().host_header(), "a.test");
        assert!(parse_url("ftp://x").is_err());
        assert!(parse_url("http://").is_err());
        assert!(parse_url("http://host:99999/").is_err());
        assert!(parse_url("http://bücher.example/").unwrap_err().contains("punycode"));
        assert!(parse_url("http://ex ample.com/").is_err());
    }

    #[test]
    fn resolves_redirect_locations() {
        let base = parse_url("http://a.test:8080/dir/page?x=1").unwrap();
        let r = |l: &str| resolve_location(&base, l).unwrap();
        assert_eq!(r("/abs").target, "/abs");
        assert_eq!(r("rel").target, "/dir/rel");
        assert_eq!(r("../up").target, "/up");
        assert_eq!(r("./here/").target, "/dir/here/");
        assert_eq!(r("?y=2").target, "/dir/page?y=2");
        assert_eq!(r("//other.test/p").host, "other.test");
        assert_eq!(r("https://b.test/x").https, true);
        assert_eq!(r("/abs").port, 8080);
    }

    #[test]
    fn base64_matches_the_standard() {
        assert_eq!(base64(b""), "");
        assert_eq!(base64(b"f"), "Zg==");
        assert_eq!(base64(b"fo"), "Zm8=");
        assert_eq!(base64(b"foo"), "Zm9v");
        assert_eq!(base64(b"user:pass"), "dXNlcjpwYXNz");
    }

    #[test]
    fn plain_response_with_duplicate_headers_and_defaults_sent() {
        let (port, h) = serve(vec![ok("hello")]);
        let r = send(&req(&format!("http://user:pw@127.0.0.1:{port}/p?q=1")), 1000).unwrap();
        assert_eq!((r.status, r.status_text.as_str(), r.body.as_slice()), (200, "OK", &b"hello"[..]));
        assert_eq!(r.headers.iter().filter(|(k, _)| k == "X-Test").count(), 2);
        let sent = h.join().unwrap().remove(0).to_lowercase();
        assert!(sent.starts_with("get /p?q=1 http/1.1\r\n"));
        assert!(sent.contains(&format!("host: 127.0.0.1:{port}\r\n")));
        assert!(sent.contains("authorization: basic dxnlcjpwdw==\r\n"), "{sent}");
        assert!(sent.contains("connection: close\r\n") && sent.contains("user-agent: home-screen\r\n"));
    }

    #[test]
    fn post_sends_body_and_content_type_and_honours_user_headers() {
        let (port, h) = serve(vec![ok("{}")]);
        let mut q = req(&format!("http://127.0.0.1:{port}/api"));
        q.method = "post".into();
        q.body = Some("{\"a\":1}".into());
        q.headers = vec![("X-Custom".into(), "yes".into()), ("User-Agent".into(), "mine".into()), ("Content-Length".into(), "999".into())];
        send(&q, 1000).unwrap();
        let sent = h.join().unwrap().remove(0);
        assert!(sent.starts_with("POST /api HTTP/1.1\r\n"));
        assert!(sent.contains("X-Custom: yes\r\n") && sent.contains("User-Agent: mine\r\n") && !sent.contains("home-screen"));
        assert!(sent.contains("Content-Type: text/plain; charset=utf-8\r\n") && sent.contains("Content-Length: 7\r\n") && !sent.contains("Content-Length: 999"));
        assert!(sent.ends_with("{\"a\":1}"));
    }

    #[test]
    fn decodes_chunked_bodies_with_extensions_and_trailers() {
        let raw = b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n5;ext=1\r\nhello\r\n6\r\n world\r\n0\r\nTrailer: x\r\n\r\n".to_vec();
        let (port, _h) = serve(vec![raw]);
        let r = send(&req(&format!("http://127.0.0.1:{port}/")), 1000).unwrap();
        assert_eq!(r.body, b"hello world");
    }

    #[test]
    fn reads_until_close_and_skips_interim_responses() {
        let raw = b"HTTP/1.1 100 Continue\r\n\r\nHTTP/1.0 201 Created\r\nX: y\r\n\r\nbody until close".to_vec();
        let (port, _h) = serve(vec![raw]);
        let r = send(&req(&format!("http://127.0.0.1:{port}/")), 1000).unwrap();
        assert_eq!((r.status, r.body.as_slice()), (201, &b"body until close"[..]));
    }

    #[test]
    fn caps_the_body_one_byte_past_the_limit() {
        let (port, _h) = serve(vec![ok(&"x".repeat(500))]);
        let r = send(&req(&format!("http://127.0.0.1:{port}/")), 100).unwrap();
        assert_eq!(r.body.len(), 101);
    }

    #[test]
    fn head_and_204_have_no_body() {
        let (port, _h) = serve(vec![b"HTTP/1.1 200 OK\r\nContent-Length: 50\r\n\r\n".to_vec()]);
        let mut q = req(&format!("http://127.0.0.1:{port}/"));
        q.method = "HEAD".into();
        assert!(send(&q, 1000).unwrap().body.is_empty());
    }

    #[test]
    fn follows_redirects_only_when_asked() {
        let redirect = |to: &str, code: u16| format!("HTTP/1.1 {code} Moved\r\nLocation: {to}\r\nContent-Length: 0\r\n\r\n").into_bytes();
        let (port, _h) = serve(vec![redirect("/next", 302)]);
        let r = send(&req(&format!("http://127.0.0.1:{port}/")), 1000).unwrap();
        assert_eq!(r.status, 302);

        let (port, h) = serve(vec![redirect("/a", 301), redirect("b", 302), ok("done")]);
        let mut q = req(&format!("http://127.0.0.1:{port}/start"));
        q.follow = true;
        let r = send(&q, 1000).unwrap();
        assert_eq!((r.status, r.body.as_slice()), (200, &b"done"[..]));
        let seen = h.join().unwrap();
        assert!(seen[1].starts_with("GET /a ") && seen[2].starts_with("GET /b "), "{seen:?}");
    }

    #[test]
    fn post_becomes_get_on_303_but_307_keeps_method_and_body() {
        let redirect = |to: &str, code: u16| format!("HTTP/1.1 {code} X\r\nLocation: {to}\r\nContent-Length: 0\r\n\r\n").into_bytes();
        let (port, h) = serve(vec![redirect("/see", 303), ok("")]);
        let mut q = req(&format!("http://127.0.0.1:{port}/"));
        (q.method, q.body, q.follow) = ("POST".into(), Some("data".into()), true);
        send(&q, 1000).unwrap();
        let seen = h.join().unwrap();
        assert!(seen[1].starts_with("GET /see ") && !seen[1].contains("data"), "{seen:?}");

        let (port, h) = serve(vec![redirect("/same", 307), ok("")]);
        let mut q = req(&format!("http://127.0.0.1:{port}/"));
        (q.method, q.body, q.follow) = ("POST".into(), Some("data".into()), true);
        send(&q, 1000).unwrap();
        let seen = h.join().unwrap();
        assert!(seen[1].starts_with("POST /same ") && seen[1].ends_with("data"), "{seen:?}");
    }

    #[test]
    fn does_not_forward_credentials_to_another_origin() {
        let (port_b, hb) = serve(vec![ok("b")]);
        let to = format!("http://localhost:{port_b}/");
        let a = format!("HTTP/1.1 302 Found\r\nLocation: {to}\r\nContent-Length: 0\r\n\r\n").into_bytes();
        let (port_a, _ha) = serve(vec![a]);
        let mut q = req(&format!("http://127.0.0.1:{port_a}/"));
        q.follow = true;
        q.headers = vec![("Authorization".into(), "Bearer secret".into()), ("X-Keep".into(), "1".into())];
        send(&q, 1000).unwrap();
        let seen = hb.join().unwrap().remove(0).to_lowercase();
        assert!(!seen.contains("secret") && seen.contains("x-keep: 1"), "{seen}");
    }

    #[test]
    fn stops_after_ten_redirects_and_returns_the_last_response() {
        let r = b"HTTP/1.1 302 Found\r\nLocation: /loop\r\nContent-Length: 0\r\n\r\n".to_vec();
        let (port, _h) = serve(vec![r; 11]);
        let mut q = req(&format!("http://127.0.0.1:{port}/loop"));
        q.follow = true;
        assert_eq!(send(&q, 1000).unwrap().status, 302);
    }

    #[test]
    fn times_out_on_a_silent_server() {
        let l = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = l.local_addr().unwrap().port();
        let _t = thread::spawn(move || {
            let (_s, _) = l.accept().unwrap();
            thread::sleep(Duration::from_secs(3));
        });
        let mut q = req(&format!("http://127.0.0.1:{port}/"));
        q.timeout = Duration::from_millis(300);
        let started = Instant::now();
        let e = send(&q, 1000).unwrap_err();
        assert!(e.to_lowercase().contains("timed out"), "{e}");
        assert!(started.elapsed() < Duration::from_secs(2));
    }

    #[test]
    fn reports_errors_for_bad_input_and_bad_servers() {
        assert!(send(&req("http://127.0.0.1:1/"), 10).is_err()); // refused
        let mut q = req("http://127.0.0.1:1/");
        q.method = "GE T".into();
        assert!(send(&q, 10).unwrap_err().contains("method"));
        let mut q = req("http://127.0.0.1:1/");
        q.headers = vec![("X-Bad".into(), "a\r\nInjected: 1".into())];
        assert!(send(&q, 10).unwrap_err().contains("Invalid header"));
        let (port, _h) = serve(vec![b"SSH-2.0-OpenSSH\r\n\r\n".to_vec()]);
        assert!(send(&req(&format!("http://127.0.0.1:{port}/")), 10).unwrap_err().contains("HTTP/1"));
        let (port, _h) = serve(vec![Vec::new()]);
        assert!(send(&req(&format!("http://127.0.0.1:{port}/")), 10).unwrap_err().contains("closed"));
    }
}
