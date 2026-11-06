use crate::{db, Shared};
use axum::{
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

type R = Result<Response, StatusCode>;
fn ise<E>(_: E) -> StatusCode {
    StatusCode::INTERNAL_SERVER_ERROR
}

pub async fn list_tiles(State(s): State<Shared>) -> R {
    let c = s.lock().unwrap();
    Ok(Json(db::list_tiles(&c).map_err(ise)?).into_response())
}

pub async fn create_tile(State(s): State<Shared>, Json(t): Json<db::Tile>) -> R {
    let c = s.lock().unwrap();
    Ok(Json(db::create_tile(&c, &t).map_err(ise)?).into_response())
}

pub async fn update_tile(State(s): State<Shared>, Path(id): Path<i64>, Json(t): Json<db::Tile>) -> R {
    let c = s.lock().unwrap();
    match db::update_tile(&c, id, &t).map_err(ise)? {
        Some(t) => Ok(Json(t).into_response()),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn delete_tile(State(s): State<Shared>, Path(id): Path<i64>) -> R {
    let c = s.lock().unwrap();
    if db::delete_tile(&c, id).map_err(ise)? {
        Ok(StatusCode::NO_CONTENT.into_response())
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn save_layout(State(s): State<Shared>, Json(items): Json<Vec<db::LayoutItem>>) -> R {
    let mut c = s.lock().unwrap();
    db::save_layout(&mut c, &items).map_err(ise)?;
    Ok(StatusCode::NO_CONTENT.into_response())
}

pub async fn list_pages(State(s): State<Shared>) -> R {
    let c = s.lock().unwrap();
    Ok(Json(db::list_pages(&c).map_err(ise)?).into_response())
}

pub async fn create_page(State(s): State<Shared>, Json(p): Json<db::Page>) -> R {
    let c = s.lock().unwrap();
    Ok(Json(db::create_page(&c, &p).map_err(ise)?).into_response())
}

pub async fn update_page(State(s): State<Shared>, Path(id): Path<i64>, Json(p): Json<db::Page>) -> R {
    let c = s.lock().unwrap();
    match db::update_page(&c, id, &p).map_err(ise)? {
        Some(p) => Ok(Json(p).into_response()),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn delete_page(State(s): State<Shared>, Path(id): Path<i64>) -> R {
    let c = s.lock().unwrap();
    if db::delete_page(&c, id).map_err(ise)? {
        Ok(StatusCode::NO_CONTENT.into_response())
    } else {
        // the last page, or an unknown id
        Err(StatusCode::CONFLICT)
    }
}

pub async fn list_icons(State(s): State<Shared>) -> R {
    let c = s.lock().unwrap();
    Ok(Json(db::list_icons(&c).map_err(ise)?).into_response())
}

#[derive(Deserialize)]
pub struct NewIcon {
    name: String,
    svg: String,
}

pub async fn add_icon(State(s): State<Shared>, Json(i): Json<NewIcon>) -> R {
    let svg = db::sanitize_svg(&i.svg).ok_or(StatusCode::BAD_REQUEST)?;
    let c = s.lock().unwrap();
    let id = db::add_icon(&c, &i.name, &svg).map_err(ise)?;
    Ok(Json(json!({"id": id, "name": i.name})).into_response())
}

pub async fn get_icon(State(s): State<Shared>, Path(id): Path<i64>) -> R {
    let c = s.lock().unwrap();
    match db::get_icon(&c, id).map_err(ise)? {
        Some(svg) => Ok((
            [
                (header::CONTENT_TYPE, "image/svg+xml"),
                (header::CACHE_CONTROL, "public, max-age=86400"),
                (header::CONTENT_SECURITY_POLICY, "default-src 'none'; style-src 'unsafe-inline'"),
            ],
            svg,
        )
            .into_response()),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn delete_icon(State(s): State<Shared>, Path(id): Path<i64>) -> R {
    let c = s.lock().unwrap();
    if db::delete_icon(&c, id).map_err(ise)? {
        Ok(StatusCode::NO_CONTENT.into_response())
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

const IMAGE_TYPES: [&str; 5] = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"];

#[derive(Deserialize)]
pub struct ImgQuery {
    name: Option<String>,
}

/// Raw image bytes in the body; Content-Type must be a raster image type (no SVG).
pub async fn add_image(
    State(s): State<Shared>,
    Query(q): Query<ImgQuery>,
    headers: axum::http::HeaderMap,
    body: axum::body::Bytes,
) -> R {
    let mime = headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !IMAGE_TYPES.contains(&mime.as_str()) || body.is_empty() {
        return Err(StatusCode::UNSUPPORTED_MEDIA_TYPE);
    }
    let name = q.name.unwrap_or_else(|| "image".into());
    let c = s.lock().unwrap();
    let id = db::add_image(&c, &name, &mime, &body).map_err(ise)?;
    Ok(Json(json!({"id": id, "src": format!("/api/images/{id}")})).into_response())
}

pub async fn get_image(State(s): State<Shared>, Path(id): Path<i64>) -> R {
    let c = s.lock().unwrap();
    match db::get_image(&c, id).map_err(ise)? {
        Some((mime, data)) => Ok((
            [
                (header::CONTENT_TYPE, mime),
                (header::CACHE_CONTROL, "public, max-age=31536000, immutable".to_string()),
            ],
            data,
        )
            .into_response()),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn delete_image(State(s): State<Shared>, Path(id): Path<i64>) -> R {
    let c = s.lock().unwrap();
    if db::delete_image(&c, id).map_err(ise)? {
        Ok(StatusCode::NO_CONTENT.into_response())
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn get_settings(State(s): State<Shared>) -> R {
    let c = s.lock().unwrap();
    Ok(Json(db::get_settings(&c).map_err(ise)?).into_response())
}

pub async fn put_settings(State(s): State<Shared>, Json(v): Json<Value>) -> R {
    let c = s.lock().unwrap();
    db::put_settings(&c, &v).map_err(ise)?;
    Ok(StatusCode::NO_CONTENT.into_response())
}

// ---- curl runner: performs an HTTP request on behalf of the launcher (CORS makes this impossible from the page) ----

#[derive(Deserialize)]
pub struct RunReq {
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
fn local_origin_only(h: &axum::http::HeaderMap) -> bool {
    host_allowed(h, ALLOWED_HOSTS.get().map(|v| v.as_slice()).unwrap_or(&[]))
}

fn host_allowed(h: &axum::http::HeaderMap, extra: &[String]) -> bool {
    let host = h.get(header::HOST).and_then(|v| v.to_str().ok()).unwrap_or("");
    let name = match host.strip_prefix('[') {
        Some(rest) => rest.split(']').next().unwrap_or(""),
        None => host.split(':').next().unwrap_or(""),
    }
    .to_ascii_lowercase();
    if !(matches!(name.as_str(), "localhost" | "127.0.0.1" | "::1") || extra.iter().any(|e| *e == name)) {
        return false;
    }
    match h.get(header::ORIGIN).and_then(|v| v.to_str().ok()) {
        None => true,
        Some(o) => o.split("://").nth(1) == Some(host),
    }
}

fn perform(r: RunReq) -> Value {
    use std::io::Read;
    use std::sync::Arc;
    use std::time::{Duration, Instant};

    if !(r.url.starts_with("http://") || r.url.starts_with("https://")) {
        return json!({"error": "Only http:// and https:// URLs are supported"});
    }
    let started = Instant::now();
    let mut b = ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(r.timeout.unwrap_or(30).clamp(1, 120)))
        .redirects(if r.follow { 10 } else { 0 });
    // ureq has no default TLS backend with native-tls: always supply the OS (schannel) connector.
    let mut tls = native_tls::TlsConnector::builder();
    if r.insecure {
        tls.danger_accept_invalid_certs(true).danger_accept_invalid_hostnames(true);
    }
    match tls.build() {
        Ok(c) => b = b.tls_connector(Arc::new(c)),
        Err(e) => return json!({"error": e.to_string()}),
    }
    let agent = b.build();
    let mut req = agent.request(&r.method.to_uppercase(), &r.url);
    for (k, v) in &r.headers {
        req = req.set(k, v);
    }
    let res = match &r.body {
        Some(body) => req.send_string(body),
        None => req.call(),
    };
    let resp = match res {
        Ok(resp) => resp,
        Err(ureq::Error::Status(_, resp)) => resp,
        Err(e) => return json!({"error": e.to_string(), "ms": started.elapsed().as_millis() as u64}),
    };
    let status = resp.status();
    let status_text = resp.status_text().to_string();
    let mut headers = Vec::new();
    for name in resp.headers_names() {
        for v in resp.all(&name) {
            headers.push(json!([name, v]));
        }
    }
    let mut buf = Vec::new();
    let _ = resp.into_reader().take(MAX_BODY as u64 + 1).read_to_end(&mut buf);
    let truncated = buf.len() > MAX_BODY;
    buf.truncate(MAX_BODY);
    let binary = buf.contains(&0);
    let size = buf.len();
    let body = if binary { String::new() } else { String::from_utf8_lossy(&buf).into_owned() };
    json!({
        "status": status, "status_text": status_text, "ms": started.elapsed().as_millis() as u64,
        "headers": headers, "body": body, "binary": binary, "truncated": truncated, "size": size,
    })
}

pub async fn run(headers: axum::http::HeaderMap, Json(r): Json<RunReq>) -> R {
    if !local_origin_only(&headers) {
        return Err(StatusCode::FORBIDDEN);
    }
    let out = tokio::task::spawn_blocking(move || perform(r)).await.map_err(ise)?;
    Ok(Json(out).into_response())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderMap;

    fn headers(host: &str, origin: Option<&str>) -> HeaderMap {
        let mut h = HeaderMap::new();
        h.insert(header::HOST, host.parse().unwrap());
        if let Some(o) = origin {
            h.insert(header::ORIGIN, o.parse().unwrap());
        }
        h
    }

    #[test]
    fn runner_accepts_localhost_only_by_default() {
        assert!(host_allowed(&headers("localhost:7878", None), &[]));
        assert!(host_allowed(&headers("127.0.0.1:7878", Some("http://127.0.0.1:7878")), &[]));
        assert!(!host_allowed(&headers("home.example.com", None), &[]));
        assert!(!host_allowed(&headers("localhost:7878", Some("https://evil.example")), &[]));
    }

    #[test]
    fn runner_accepts_configured_hosts_with_matching_origin() {
        let extra = vec!["home.example.com".to_string()];
        assert!(host_allowed(&headers("Home.Example.com", Some("https://Home.Example.com")), &extra));
        assert!(!host_allowed(&headers("other.example.com", None), &extra));
        assert!(!host_allowed(&headers("home.example.com", Some("https://evil.example")), &extra));
    }
}
