mod api;
mod db;

use axum::{
    http::{header, StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::{get, post, put},
    Router,
};
use rust_embed::RustEmbed;
use std::sync::{Arc, Mutex};

#[derive(RustEmbed)]
#[folder = "web/dist/"]
struct Assets;

pub type Shared = Arc<Mutex<rusqlite::Connection>>;

async fn static_files(uri: Uri) -> Response {
    let path = uri.path().trim_start_matches('/');
    let path = if path.is_empty() { "index.html" } else { path };
    let (file, name) = match Assets::get(path) {
        Some(f) => (f, path),
        None => match Assets::get("index.html") {
            Some(f) => (f, "index.html"),
            None => return StatusCode::NOT_FOUND.into_response(),
        },
    };
    let cache = if name == "index.html" {
        "no-cache"
    } else {
        "public, max-age=31536000, immutable"
    };
    (
        [(header::CONTENT_TYPE, mime_for(name)), (header::CACHE_CONTROL, cache)],
        file.data.into_owned(),
    )
        .into_response()
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

#[tokio::main]
async fn main() {
    let port: u16 = arg("--port")
        .or_else(|| std::env::var("PORT").ok())
        .and_then(|p| p.parse().ok())
        .unwrap_or(7878);
    let db_path = arg("--db").unwrap_or_else(|| {
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join("home_screen.db")))
            .map(|p| p.to_string_lossy().into_owned())
            .unwrap_or_else(|| "home_screen.db".into())
    });
    let conn = db::open(&db_path).expect("open database");
    let state: Shared = Arc::new(Mutex::new(conn));

    let app = Router::new()
        .route("/api/tiles", get(api::list_tiles).post(api::create_tile))
        .route("/api/tiles/{id}", put(api::update_tile).delete(api::delete_tile))
        .route("/api/layout", put(api::save_layout))
        .route("/api/icons", get(api::list_icons).post(api::add_icon))
        .route("/api/icons/{id}", get(api::get_icon).delete(api::delete_icon))
        .route("/api/images", post(api::add_image))
        .route("/api/images/{id}", get(api::get_image).delete(api::delete_image))
        .route("/api/run", post(api::run))
        .route("/api/settings", get(api::get_settings).put(api::put_settings))
        .fallback(static_files)
        .layer(axum::extract::DefaultBodyLimit::max(8 * 1024 * 1024))
        .with_state(state);

    let addr = format!("127.0.0.1:{port}");
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap_or_else(|e| {
        eprintln!("Cannot bind {addr}: {e}");
        std::process::exit(1);
    });
    println!("Home Screen running at http://localhost:{port}  (db: {db_path})");
    axum::serve(listener, app).await.unwrap();
}
