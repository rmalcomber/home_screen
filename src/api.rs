//! The JSON API behind the dashboard. `handle` routes a request to a handler; handlers return `Err(status)` for an
//! empty error response. JSON bodies must be sent as `application/json`: that is not a CORS "simple" content type, so
//! another website cannot make a visitor's browser POST to this server without a pre-flight request that it never
//! answers.

use crate::server::{Request, Response};
use crate::{db, http_client, net, Shared};
use serde::de::DeserializeOwned;
use serde::Deserialize;
use serde_json::{json, Value};

type R = Result<Response, u16>;

fn ise<E>(_: E) -> u16 {
    500
}

fn no_content() -> R {
    Ok(Response::new(204))
}

/// The request body as JSON. Wrong content type: 415. Not JSON: 400. JSON of the wrong shape: 422.
fn json_body<T: DeserializeOwned>(req: &Request) -> Result<T, u16> {
    let ct = req.header("content-type").unwrap_or("").to_ascii_lowercase();
    let mime = ct.split(';').next().unwrap_or("").trim();
    if mime != "application/json" && !mime.ends_with("+json") {
        return Err(415);
    }
    serde_json::from_slice(&req.body).map_err(|e| if e.is_data() { 422 } else { 400 })
}

fn id_of(s: &str) -> Result<i64, u16> {
    s.parse::<i64>().map_err(|_| 404)
}

fn known_path(segs: &[&str]) -> bool {
    matches!(
        segs,
        ["api", "tiles" | "layout" | "pages" | "icons" | "images" | "settings" | "run"]
            | ["api", "tiles" | "pages" | "icons" | "images", _]
            | ["api", "net", "ping" | "trace" | "dns"]
    )
}

/// Route an `/api/...` request.
pub fn handle(req: &Request, s: &Shared) -> Response {
    let segs: Vec<&str> = req.path.trim_matches('/').split('/').collect();
    let result: R = match (req.method.as_str(), segs.as_slice()) {
        ("GET", ["api", "tiles"]) => list_tiles(s),
        ("POST", ["api", "tiles"]) => create_tile(req, s),
        ("PUT", ["api", "tiles", id]) => id_of(id).and_then(|id| update_tile(req, s, id)),
        ("DELETE", ["api", "tiles", id]) => id_of(id).and_then(|id| delete_tile(s, id)),
        ("PUT", ["api", "layout"]) => save_layout(req, s),
        ("GET", ["api", "pages"]) => list_pages(s),
        ("POST", ["api", "pages"]) => create_page(req, s),
        ("PUT", ["api", "pages", id]) => id_of(id).and_then(|id| update_page(req, s, id)),
        ("DELETE", ["api", "pages", id]) => id_of(id).and_then(|id| delete_page(s, id)),
        ("GET", ["api", "icons"]) => list_icons(s),
        ("POST", ["api", "icons"]) => add_icon(req, s),
        ("GET", ["api", "icons", id]) => id_of(id).and_then(|id| get_icon(s, id)),
        ("DELETE", ["api", "icons", id]) => id_of(id).and_then(|id| delete_icon(s, id)),
        ("POST", ["api", "images"]) => add_image(req, s),
        ("GET", ["api", "images", id]) => id_of(id).and_then(|id| get_image(s, id)),
        ("DELETE", ["api", "images", id]) => id_of(id).and_then(|id| delete_image(s, id)),
        ("GET", ["api", "settings"]) => get_settings(s),
        ("PUT", ["api", "settings"]) => put_settings(req, s),
        ("POST", ["api", "run"]) => run(req),
        ("POST", ["api", "net", "ping"]) => net_ping(req),
        ("POST", ["api", "net", "trace"]) => net_trace(req),
        ("POST", ["api", "net", "dns"]) => net_dns(req),
        _ => Err(if known_path(&segs) { 405 } else { 404 }),
    };
    result.unwrap_or_else(Response::new)
}

fn list_tiles(s: &Shared) -> R {
    let c = s.lock().unwrap();
    Ok(Response::json(&db::list_tiles(&c).map_err(ise)?))
}

fn create_tile(req: &Request, s: &Shared) -> R {
    let t: db::Tile = json_body(req)?;
    let c = s.lock().unwrap();
    Ok(Response::json(&db::create_tile(&c, &t).map_err(ise)?))
}

fn update_tile(req: &Request, s: &Shared, id: i64) -> R {
    let t: db::Tile = json_body(req)?;
    let c = s.lock().unwrap();
    match db::update_tile(&c, id, &t).map_err(ise)? {
        Some(t) => Ok(Response::json(&t)),
        None => Err(404),
    }
}

fn delete_tile(s: &Shared, id: i64) -> R {
    let c = s.lock().unwrap();
    if db::delete_tile(&c, id).map_err(ise)? { no_content() } else { Err(404) }
}

fn save_layout(req: &Request, s: &Shared) -> R {
    let items: Vec<db::LayoutItem> = json_body(req)?;
    let mut c = s.lock().unwrap();
    db::save_layout(&mut c, &items).map_err(ise)?;
    no_content()
}

fn list_pages(s: &Shared) -> R {
    let c = s.lock().unwrap();
    Ok(Response::json(&db::list_pages(&c).map_err(ise)?))
}

fn create_page(req: &Request, s: &Shared) -> R {
    let p: db::Page = json_body(req)?;
    let c = s.lock().unwrap();
    Ok(Response::json(&db::create_page(&c, &p).map_err(ise)?))
}

fn update_page(req: &Request, s: &Shared, id: i64) -> R {
    let p: db::Page = json_body(req)?;
    let c = s.lock().unwrap();
    match db::update_page(&c, id, &p).map_err(ise)? {
        Some(p) => Ok(Response::json(&p)),
        None => Err(404),
    }
}

fn delete_page(s: &Shared, id: i64) -> R {
    let c = s.lock().unwrap();
    // false: the last page, or an unknown id
    if db::delete_page(&c, id).map_err(ise)? { no_content() } else { Err(409) }
}

fn list_icons(s: &Shared) -> R {
    let c = s.lock().unwrap();
    Ok(Response::json(&db::list_icons(&c).map_err(ise)?))
}

#[derive(Deserialize)]
struct NewIcon {
    name: String,
    svg: String,
}

fn add_icon(req: &Request, s: &Shared) -> R {
    let i: NewIcon = json_body(req)?;
    let svg = db::sanitize_svg(&i.svg).ok_or(400u16)?;
    let c = s.lock().unwrap();
    let id = db::add_icon(&c, &i.name, &svg).map_err(ise)?;
    Ok(Response::json(&json!({"id": id, "name": i.name})))
}

fn get_icon(s: &Shared, id: i64) -> R {
    let c = s.lock().unwrap();
    match db::get_icon(&c, id).map_err(ise)? {
        Some(svg) => Ok(Response::new(200)
            .bytes("image/svg+xml", svg.into_bytes())
            .with("Cache-Control", "public, max-age=86400")
            .with("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'")),
        None => Err(404),
    }
}

fn delete_icon(s: &Shared, id: i64) -> R {
    let c = s.lock().unwrap();
    if db::delete_icon(&c, id).map_err(ise)? { no_content() } else { Err(404) }
}

const IMAGE_TYPES: [&str; 5] = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"];

/// Raw image bytes in the body; Content-Type must be a raster image type (no SVG).
fn add_image(req: &Request, s: &Shared) -> R {
    let mime = req.header("content-type").unwrap_or("").to_ascii_lowercase();
    if !IMAGE_TYPES.contains(&mime.as_str()) || req.body.is_empty() {
        return Err(415);
    }
    let name = req.query_param("name").unwrap_or_else(|| "image".into());
    let c = s.lock().unwrap();
    let id = db::add_image(&c, &name, &mime, &req.body).map_err(ise)?;
    Ok(Response::json(&json!({"id": id, "src": format!("/api/images/{id}")})))
}

fn get_image(s: &Shared, id: i64) -> R {
    let c = s.lock().unwrap();
    match db::get_image(&c, id).map_err(ise)? {
        Some((mime, data)) => Ok(Response::new(200).bytes(&mime, data).with("Cache-Control", "public, max-age=31536000, immutable")),
        None => Err(404),
    }
}

fn delete_image(s: &Shared, id: i64) -> R {
    let c = s.lock().unwrap();
    if db::delete_image(&c, id).map_err(ise)? { no_content() } else { Err(404) }
}

fn get_settings(s: &Shared) -> R {
    let c = s.lock().unwrap();
    Ok(Response::json(&db::get_settings(&c).map_err(ise)?))
}

fn put_settings(req: &Request, s: &Shared) -> R {
    let v: Value = json_body(req)?;
    let c = s.lock().unwrap();
    db::put_settings(&c, &v).map_err(ise)?;
    no_content()
}

// ---- curl runner: performs an HTTP request on behalf of the launcher (CORS makes this impossible from the page) ----

#[derive(Deserialize)]
struct RunReq {
    method: String,
    url: String,
    #[serde(default)]
    headers: Vec<(String, String)>,
    #[serde(default)]
    body: Option<String>,
    #[serde(default)]
    follow: bool,
    #[serde(default)]
    insecure: bool,
    #[serde(default)]
    timeout: Option<u64>,
}

const MAX_BODY: usize = 2 * 1024 * 1024;

static ALLOWED_HOSTS: std::sync::OnceLock<Vec<String>> = std::sync::OnceLock::new();

/// Extra host names (beyond localhost) that may use the curl runner, e.g. the name a reverse proxy serves.
pub fn set_allowed_hosts(list: &str) {
    let hosts = list
        .split(',')
        .map(|h| h.trim().to_ascii_lowercase())
        .filter(|h| !h.is_empty())
        .collect();
    let _ = ALLOWED_HOSTS.set(hosts);
}

/// Only our own page may use the proxy: blocks other websites and DNS-rebinding tricks. The page must
/// be opened via localhost or a host name listed in HOME_SCREEN_ALLOWED_HOSTS.
fn local_origin_only(req: &Request) -> bool {
    host_allowed(req.header("host"), req.header("origin"), ALLOWED_HOSTS.get().map(|v| v.as_slice()).unwrap_or(&[]))
}

fn host_allowed(host: Option<&str>, origin: Option<&str>, extra: &[String]) -> bool {
    let host = host.unwrap_or("");
    let name = match host.strip_prefix('[') {
        Some(rest) => rest.split(']').next().unwrap_or(""),
        None => host.split(':').next().unwrap_or(""),
    }
    .to_ascii_lowercase();
    if !(matches!(name.as_str(), "localhost" | "127.0.0.1" | "::1") || extra.iter().any(|e| *e == name)) {
        return false;
    }
    match origin {
        None => true,
        Some(o) => o.split("://").nth(1) == Some(host),
    }
}

fn perform(r: RunReq) -> Value {
    use std::time::{Duration, Instant};

    let started = Instant::now();
    let req = http_client::Request {
        method: r.method.to_uppercase(),
        url: r.url,
        headers: r.headers,
        body: r.body,
        timeout: Duration::from_secs(r.timeout.unwrap_or(30).clamp(1, 120)),
        follow: r.follow,
        insecure: r.insecure,
    };
    let resp = match http_client::send(&req, MAX_BODY) {
        Ok(resp) => resp,
        Err(e) => return json!({"error": e, "ms": started.elapsed().as_millis() as u64}),
    };
    let headers: Vec<Value> = resp.headers.iter().map(|(k, v)| json!([k, v])).collect();
    let mut buf = resp.body;
    let truncated = buf.len() > MAX_BODY;
    buf.truncate(MAX_BODY);
    let binary = buf.contains(&0);
    let size = buf.len();
    let body = if binary { String::new() } else { String::from_utf8_lossy(&buf).into_owned() };
    json!({
        "status": resp.status, "status_text": resp.status_text, "ms": started.elapsed().as_millis() as u64,
        "headers": headers, "body": body, "binary": binary, "truncated": truncated, "size": size,
    })
}

fn run(req: &Request) -> R {
    if !local_origin_only(req) {
        return Err(403);
    }
    let r: RunReq = json_body(req)?;
    Ok(Response::json(&perform(r)))
}

// ---- network tools: ping, traceroute and DNS lookups (see net/mod.rs) ----

#[derive(Deserialize)]
struct PingReq {
    host: String,
    #[serde(default)]
    count: Option<u32>,
    #[serde(default)]
    timeout: Option<u64>,
}

#[derive(Deserialize)]
struct TraceReq {
    host: String,
    #[serde(default)]
    max_hops: Option<u32>,
    #[serde(default)]
    timeout: Option<u64>,
}

#[derive(Deserialize)]
struct DnsReq {
    name: String,
    #[serde(default, rename = "type")]
    rtype: Option<String>,
    #[serde(default)]
    resolver: Option<String>,
}

/// Same gate as the curl runner: our own page only, JSON only; then one of the few job slots.
fn net_job<T: DeserializeOwned>(req: &Request, work: impl FnOnce(T) -> Value) -> R {
    if !local_origin_only(req) {
        return Err(403);
    }
    let r: T = json_body(req)?;
    let Some(_slot) = net::Slot::take() else { return Ok(Response::json(&net::busy())) };
    Ok(Response::json(&work(r)))
}

fn net_ping(req: &Request) -> R {
    net_job(req, |r: PingReq| net::ping(r.host.trim(), r.count.unwrap_or(4), r.timeout.unwrap_or(2000)))
}

fn net_trace(req: &Request) -> R {
    net_job(req, |r: TraceReq| net::trace(r.host.trim(), r.max_hops.unwrap_or(20), r.timeout.unwrap_or(1500)))
}

fn net_dns(req: &Request) -> R {
    net_job(req, |r: DnsReq| net::dns_lookup(&r.name, r.rtype.as_deref().unwrap_or("A"), r.resolver.as_deref()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};

    #[test]
    fn runner_accepts_localhost_only_by_default() {
        assert!(host_allowed(Some("localhost:7878"), None, &[]));
        assert!(host_allowed(Some("127.0.0.1:7878"), Some("http://127.0.0.1:7878"), &[]));
        assert!(!host_allowed(Some("home.example.com"), None, &[]));
        assert!(!host_allowed(Some("localhost:7878"), Some("https://evil.example"), &[]));
        assert!(!host_allowed(None, None, &[]));
    }

    #[test]
    fn runner_accepts_configured_hosts_with_matching_origin() {
        let extra = vec!["home.example.com".to_string()];
        assert!(host_allowed(Some("Home.Example.com"), Some("https://Home.Example.com"), &extra));
        assert!(!host_allowed(Some("other.example.com"), None, &extra));
        assert!(!host_allowed(Some("home.example.com"), Some("https://evil.example"), &extra));
    }

    // ---- the router, against an in-memory database ----

    fn state() -> Shared {
        Arc::new(Mutex::new(db::open(":memory:").unwrap()))
    }

    fn req(method: &str, path: &str, ctype: Option<&str>, body: &[u8]) -> Request {
        let mut headers = vec![("Host".to_string(), "localhost:7878".to_string())];
        if let Some(c) = ctype {
            headers.push(("Content-Type".into(), c.into()));
        }
        let (path, query) = path.split_once('?').unwrap_or((path, ""));
        Request { method: method.into(), path: path.into(), query: query.into(), headers, body: body.to_vec() }
    }

    fn json_req(method: &str, path: &str, body: &str) -> Request {
        req(method, path, Some("application/json"), body.as_bytes())
    }

    fn body_json(r: &Response) -> Value {
        let b = match &r.body {
            crate::server::Body::Owned(v) => v.clone(),
            crate::server::Body::Static(s) => s.to_vec(),
        };
        serde_json::from_slice(&b).unwrap_or(Value::Null)
    }

    #[test]
    fn tiles_pages_layout_and_settings_round_trip() {
        let s = state();
        let r = handle(&json_req("POST", "/api/tiles", r#"{"type":"bookmarks","title":"A","config":{"links":[]}}"#), &s);
        assert_eq!(r.status, 200);
        let t = body_json(&r);
        let id = t["id"].as_i64().unwrap();
        assert_eq!((t["page_id"].as_i64(), t["parent_id"].clone()), (Some(1), Value::Null));

        let put = handle(&json_req("PUT", &format!("/api/tiles/{id}"), r#"{"type":"bookmarks","title":"B","config":{},"color":"blue"}"#), &s);
        assert_eq!((put.status, body_json(&put)["color"].clone()), (200, json!("blue")));
        assert_eq!(handle(&json_req("PUT", "/api/layout", &format!(r#"[{{"id":{id},"x":2,"y":3,"w":5,"h":7,"collapsed":true}}]"#)), &s).status, 204);
        let list = body_json(&handle(&req("GET", "/api/tiles", None, b""), &s));
        assert_eq!((list[0]["x"].clone(), list[0]["collapsed"].clone()), (json!(2), json!(true)));

        let page = body_json(&handle(&json_req("POST", "/api/pages", r#"{"name":"Work","mode":"columns","cols":3}"#), &s));
        assert_eq!(page["name"], "Work");
        assert_eq!(handle(&req("DELETE", &format!("/api/pages/{}", page["id"]), None, b""), &s).status, 204);
        assert_eq!(handle(&req("DELETE", "/api/pages/1", None, b""), &s).status, 409, "the last page stays");

        assert_eq!(handle(&json_req("PUT", "/api/settings", r#"{"glass":30}"#), &s).status, 204);
        assert_eq!(body_json(&handle(&req("GET", "/api/settings", None, b""), &s))["glass"], 30);
        assert_eq!(handle(&req("DELETE", &format!("/api/tiles/{id}"), None, b""), &s).status, 204);
        assert_eq!(handle(&req("DELETE", &format!("/api/tiles/{id}"), None, b""), &s).status, 404);
    }

    #[test]
    fn json_endpoints_demand_a_json_content_type() {
        let s = state();
        let body = br#"{"type":"bookmarks","title":"A","config":{}}"#;
        for ct in [None, Some("text/plain"), Some("application/x-www-form-urlencoded"), Some("multipart/form-data")] {
            assert_eq!(handle(&req("POST", "/api/tiles", ct, body), &s).status, 415, "{ct:?}");
        }
        assert_eq!(handle(&req("POST", "/api/tiles", Some("application/json; charset=utf-8"), body), &s).status, 200);
        assert_eq!(handle(&req("POST", "/api/tiles", Some("application/vnd.api+json"), body), &s).status, 200);
        assert_eq!(handle(&req("POST", "/api/tiles", Some("application/json"), b"{not json"), &s).status, 400);
        assert_eq!(handle(&req("POST", "/api/tiles", Some("application/json"), br#"{"nope":1}"#), &s).status, 422);
    }

    #[test]
    fn unknown_routes_and_methods() {
        let s = state();
        assert_eq!(handle(&req("GET", "/api/nothing", None, b""), &s).status, 404);
        assert_eq!(handle(&req("GET", "/api/tiles/abc", None, b""), &s).status, 405);
        assert_eq!(handle(&req("PATCH", "/api/tiles", None, b""), &s).status, 405);
        assert_eq!(handle(&req("DELETE", "/api/tiles/notanumber", None, b""), &s).status, 404);
        assert_eq!(handle(&req("GET", "/api/run", None, b""), &s).status, 405);
    }

    #[test]
    fn icons_are_sanitised_and_served_with_a_locked_down_policy() {
        let s = state();
        let r = handle(&json_req("POST", "/api/icons", r#"{"name":"x","svg":"<svg onload=\"a()\"><path d=\"M0\"/></svg>"}"#), &s);
        assert_eq!(r.status, 200);
        let id = body_json(&r)["id"].clone();
        let got = handle(&req("GET", &format!("/api/icons/{id}"), None, b""), &s);
        assert_eq!(got.status, 200);
        assert!(got.headers.iter().any(|(k, v)| k == "Content-Security-Policy" && v.contains("default-src 'none'")));
        assert_eq!(handle(&json_req("POST", "/api/icons", r#"{"name":"x","svg":"not an svg"}"#), &s).status, 400);
    }

    #[test]
    fn images_accept_only_raster_types_and_read_the_name_from_the_query() {
        let s = state();
        assert_eq!(handle(&req("POST", "/api/images?name=a.svg", Some("image/svg+xml"), b"<svg/>"), &s).status, 415);
        assert_eq!(handle(&req("POST", "/api/images", Some("image/png"), b""), &s).status, 415);
        let r = handle(&req("POST", "/api/images?name=my%20pic.png", Some("image/png"), b"\x89PNG"), &s);
        assert_eq!(r.status, 200);
        let src = body_json(&r)["src"].as_str().unwrap().to_string();
        let got = handle(&req("GET", &src, None, b""), &s);
        assert!(got.headers.iter().any(|(k, v)| k == "Content-Type" && v == "image/png"));
        assert_eq!(handle(&req("GET", "/api/images/999", None, b""), &s).status, 404);
    }

    #[test]
    fn the_network_tools_are_gated_like_the_runner_and_validate_hosts() {
        let s = state();
        for path in ["/api/net/ping", "/api/net/trace", "/api/net/dns"] {
            let body = r#"{"host":"127.0.0.1","name":"example.com"}"#;
            let mut r = json_req("POST", path, body);
            r.headers[0].1 = "evil.example".into();
            assert_eq!(handle(&r, &s).status, 403, "{path}");
            let mut r = json_req("POST", path, body);
            r.headers.push(("Origin".into(), "https://evil.example".into()));
            assert_eq!(handle(&r, &s).status, 403, "{path}");
            assert_eq!(handle(&req("POST", path, Some("text/plain"), body.as_bytes()), &s).status, 415, "{path}");
            assert_eq!(handle(&req("GET", path, None, b""), &s).status, 405, "{path}");
        }
        // Bad input is an error in a normal 200 response, like the runner.
        for (path, body) in [("/api/net/ping", r#"{"host":"-f"}"#), ("/api/net/trace", r#"{"host":"a;b"}"#), ("/api/net/dns", r#"{"name":"a b"}"#)] {
            let r = handle(&json_req("POST", path, body), &s);
            assert_eq!(r.status, 200, "{path}");
            assert!(body_json(&r)["error"].is_string(), "{path}");
        }
        assert_eq!(handle(&json_req("POST", "/api/net/ping", "{}"), &s).status, 422);
    }

    #[test]
    fn the_runner_refuses_foreign_hosts_before_doing_anything() {
        let s = state();
        let mut r = json_req("POST", "/api/run", r#"{"method":"GET","url":"http://127.0.0.1:9/"}"#);
        r.headers[0].1 = "evil.example".into();
        assert_eq!(handle(&r, &s).status, 403);
        let mut r = json_req("POST", "/api/run", r#"{"method":"GET","url":"http://127.0.0.1:9/"}"#);
        r.headers.push(("Origin".into(), "https://evil.example".into()));
        assert_eq!(handle(&r, &s).status, 403);
        let ok = handle(&json_req("POST", "/api/run", r#"{"method":"GET","url":"ftp://x"}"#), &s);
        assert_eq!(ok.status, 200);
        assert!(body_json(&ok)["error"].as_str().unwrap().contains("http"));
    }
}
