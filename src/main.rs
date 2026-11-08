mod api;
mod db;
mod http_client;
mod net;
mod server;

use server::{Request, Response};
use std::net::TcpListener;
use std::sync::{Arc, Mutex};

// The web app, gzipped by web/scripts/pack.mjs and embedded by build.rs: `ASSETS: &[(name, gzip bytes)]`.
include!(concat!(env!("OUT_DIR"), "/assets.rs"));

fn asset(name: &str) -> Option<&'static [u8]> {
    ASSETS.iter().find(|(n, _)| *n == name).map(|(_, b)| *b)
}

pub type Shared = Arc<Mutex<rusqlite::Connection>>;

/// The web app. Single-page: unknown paths get index.html. Everything is stored gzipped and sent as it is, so a
/// client that does not accept gzip (a bare `curl`) is told how to ask for it instead of being sent bytes it cannot read.
fn static_files(req: &Request) -> Response {
    if req.method != "GET" && req.method != "HEAD" {
        return Response::new(405).with("Allow", "GET, HEAD");
    }
    let accepts_gzip = req.header("accept-encoding").is_some_and(|v| v.to_ascii_lowercase().contains("gzip"));
    if !accepts_gzip {
        return Response::new(406).bytes("text/plain; charset=utf-8", b"Home Screen sends its pages gzip-compressed. Use a browser, or curl --compressed.\n".to_vec());
    }
    let path = req.path.trim_start_matches('/');
    let path = if path.is_empty() { "index.html" } else { path };
    let (data, name) = match asset(path) {
        Some(f) => (f, path),
        None => match asset("index.html") {
            Some(f) => (f, "index.html"),
            None => return Response::new(404),
        },
    };
    let cache = if name == "index.html" { "no-cache" } else { "public, max-age=31536000, immutable" };
    Response::new(200)
        .static_bytes(mime_for(name), data)
        .with("Cache-Control", cache)
        .with("Content-Encoding", "gzip")
        .with("Vary", "Accept-Encoding")
}

fn mime_for(name: &str) -> &'static str {
    match name.rsplit('.').next().unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "js" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "ico" => "image/x-icon",
        "json" => "application/json",
        _ => "application/octet-stream",
    }
}

fn arg(name: &str) -> Option<String> {
    let a: Vec<String> = std::env::args().collect();
    a.iter().position(|x| x == name).and_then(|i| a.get(i + 1).cloned())
}

/// A setting from the command line, else from the environment (non-empty), else None.
fn setting(flag: &str, env: &str) -> Option<String> {
    arg(flag).or_else(|| std::env::var(env).ok().filter(|v| !v.trim().is_empty()))
}

fn main() {
    let port: u16 = setting("--port", "PORT")
        .and_then(|p| p.parse().ok())
        .unwrap_or(7878);
    let db_path = setting("--db", "HOME_SCREEN_DB").unwrap_or_else(|| {
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join("home_screen.db")))
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_else(|| "home_screen.db".into())
    });
    if let Some(hosts) = setting("--allowed-hosts", "HOME_SCREEN_ALLOWED_HOSTS") {
        api::set_allowed_hosts(&hosts);
    }
    let conn = db::open(&db_path).expect("open database");
    let state: Shared = Arc::new(Mutex::new(conn));

    // Loopback only by default: there is no sign-in. Containers set --host 0.0.0.0 (HOME_SCREEN_HOST).
    let host = setting("--host", "HOME_SCREEN_HOST").unwrap_or_else(|| "127.0.0.1".into());
    let addr = if host.contains(':') { format!("[{host}]:{port}") } else { format!("{host}:{port}") };
    let listener = TcpListener::bind(&addr).unwrap_or_else(|e| {
        eprintln!("Cannot bind {addr}: {e}");
        std::process::exit(1);
    });
    println!("Home Screen running at http://localhost:{port}  (db: {db_path})");

    let handler: Arc<server::Handler> = Arc::new(move |req: &Request| {
        if req.path == "/api" || req.path.starts_with("/api/") { api::handle(req, &state) } else { static_files(req) }
    });
    server::serve(listener, handler, server::Limits::default());
}
