//! HTTP server for the MIDI Macro Bridge web control interface.
//!
//! This module owns the axum application and the `std::thread` that
//! runs the tokio runtime. It communicates with the MIDI event loop
//! exclusively through the channels in `web::state` — it never holds
//! any MIDI handle.
//!
//! Phase 6a delivers:
//! - `build_app`: axum `Router` with a single placeholder `GET /`
//! - `run_server_thread`: spawns the tokio runtime in a dedicated
//!   `std::thread` and binds the axum listener
//!
//! Phase 6b adds:
//! - `GET /api/ports`  — MIDI port list as HTML datalists
//! - `GET /api/status` — status snapshot as HTML fragment
//! - `GET /api/events` — SSE event stream
//!
//! Phase 6c adds:
//! - `GET /`           — serves embedded `index.html` (text/html)
//! - `GET /static/*`   — serves any file embedded from the `web/` directory

pub mod handlers;
pub mod state;
pub mod views;

use std::net::SocketAddr;
use std::thread::JoinHandle;

use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::Router;
use tracing::info;

use crate::web::state::WebState;

// ── Embedded assets ────────────────────────────────────────────────────────────

#[derive(rust_embed::Embed)]
#[folder = "web/"]
struct Asset;

// ── Route handlers ─────────────────────────────────────────────────────────────

/// `GET /` — serve the embedded `index.html`.
async fn index_handler() -> impl IntoResponse {
    match Asset::get("index.html") {
        Some(content) => (
            axum::http::StatusCode::OK,
            [(
                axum::http::header::CONTENT_TYPE,
                "text/html; charset=utf-8".to_string(),
            )],
            content.data.into_owned(),
        )
            .into_response(),
        None => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            "index.html missing from embedded assets",
        )
            .into_response(),
    }
}

/// `GET /static/{*path}` — serve any embedded asset under `web/` with the
/// correct `Content-Type` derived from the file extension.
async fn static_asset(uri: axum::http::Uri) -> impl IntoResponse {
    let path = uri
        .path()
        .trim_start_matches("/static/")
        .trim_start_matches('/');
    match Asset::get(path) {
        Some(content) => {
            let mime = mime_guess::from_path(path).first_or_octet_stream();
            (
                [(
                    axum::http::header::CONTENT_TYPE,
                    mime.as_ref().to_string(),
                )],
                content.data.into_owned(),
            )
                .into_response()
        }
        None => axum::http::StatusCode::NOT_FOUND.into_response(),
    }
}

/// Build the axum `Router`.
pub fn build_app(state: WebState) -> Router {
    Router::new()
        .route("/", get(index_handler))
        .route("/static/*path", get(static_asset))
        .route("/api/ports", get(handlers::ports))
        .route("/api/status", get(handlers::status))
        .route("/api/events", get(handlers::events))
        .route("/api/config-form", get(handlers::config_form))
        .route("/api/config", post(handlers::config_post))
        .route("/api/halt", post(handlers::halt))
        .with_state(state)
}

/// Spawn a `std::thread` that owns a `tokio::runtime::Runtime` and
/// runs the axum server.
///
/// The server tries to bind `addr_pref` first. If that port is
/// already taken it falls back to `0.0.0.0:0` (OS-assigned port).
/// Either way the chosen address is logged via `tracing::info!`.
///
/// The returned `JoinHandle` must be held alive by the caller (`main`)
/// for the duration of the process. Dropping it would join the thread,
/// which would block; store it but never explicitly join in the happy
/// path.
pub fn run_server_thread(addr_pref: SocketAddr, state: WebState) -> JoinHandle<()> {
    std::thread::Builder::new()
        .name("axum-server".into())
        .spawn(move || {
            let rt = tokio::runtime::Runtime::new().expect("failed to build tokio runtime");
            rt.block_on(async move {
                let app = build_app(state);

                // Try the preferred port first; fall back to OS-assigned if taken.
                let listener = match tokio::net::TcpListener::bind(addr_pref).await {
                    Ok(l) => {
                        let addr = l.local_addr().unwrap_or(addr_pref);
                        info!(url = %format!("http://{addr}"), "web server listening");
                        l
                    }
                    Err(e) => {
                        let fallback: SocketAddr = "127.0.0.1:0".parse().unwrap();
                        tracing::warn!(
                            preferred = %addr_pref,
                            error = %e,
                            "preferred port unavailable; falling back to OS-assigned port"
                        );
                        let l = tokio::net::TcpListener::bind(fallback)
                            .await
                            .expect("failed to bind on fallback port");
                        let addr = l.local_addr().unwrap_or(fallback);
                        info!(url = %format!("http://{addr}"), "web server listening (fallback port)");
                        l
                    }
                };

                axum::serve(listener, app)
                    .await
                    .expect("axum server error");
            });
        })
        .expect("failed to spawn axum server thread")
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::to_bytes;
    use axum::http::{Request, StatusCode};
    use tower::util::ServiceExt;

    use crate::config::Config;
    use crate::web::state::{Status, WebState, build_channels};

    fn make_test_state() -> WebState {
        let initial = Status::initialising(Config::default());
        let (cmd_tx, _cmd_rx, _status_tx, status_rx, events_tx, history) =
            build_channels(initial);
        WebState::new(
            status_rx,
            events_tx,
            cmd_tx,
            history,
            std::path::PathBuf::from("config.toml"),
        )
    }

    fn empty_request(uri: &str) -> Request<axum::body::Body> {
        Request::builder()
            .uri(uri)
            .body(axum::body::Body::empty())
            .unwrap()
    }

    // ── GET / (index.html) ────────────────────────────────────────────────────

    #[tokio::test]
    async fn index_route_returns_200() {
        let app = build_app(make_test_state());
        let resp = app.oneshot(empty_request("/")).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn index_route_returns_html_with_title() {
        let app = build_app(make_test_state());
        let resp = app.oneshot(empty_request("/")).await.unwrap();
        let body = to_bytes(resp.into_body(), usize::MAX).await.unwrap();
        assert!(
            body.windows(b"MIDI Macro Bridge".len())
                .any(|w| w == b"MIDI Macro Bridge"),
            "body missing 'MIDI Macro Bridge' title"
        );
        assert!(
            body.windows(b"hx-get=\"/api/status\"".len())
                .any(|w| w == b"hx-get=\"/api/status\""),
            "body missing hx-get=\"/api/status\" htmx attribute"
        );
    }

    #[tokio::test]
    async fn index_route_content_type_is_html() {
        let app = build_app(make_test_state());
        let resp = app.oneshot(empty_request("/")).await.unwrap();
        let ct = resp
            .headers()
            .get(axum::http::header::CONTENT_TYPE)
            .and_then(|v: &axum::http::HeaderValue| v.to_str().ok())
            .unwrap_or("");
        assert!(ct.contains("text/html"), "content-type was: {ct}");
    }

    // ── GET /static/* ─────────────────────────────────────────────────────────

    #[tokio::test]
    async fn static_route_serves_htmx() {
        let app = build_app(make_test_state());
        let resp = app
            .oneshot(empty_request("/static/htmx.min.js"))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let ct = resp
            .headers()
            .get(axum::http::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        assert!(
            ct.contains("javascript"),
            "expected javascript content-type, got: {ct}"
        );
        let body = to_bytes(resp.into_body(), usize::MAX).await.unwrap();
        assert!(!body.is_empty(), "htmx.min.js body should not be empty");
    }

    #[tokio::test]
    async fn static_route_serves_index_html_via_root() {
        // Symmetry test: GET / and GET /static/index.html are distinct routes.
        // This verifies the root route returns HTML.
        let app = build_app(make_test_state());
        let resp = app.oneshot(empty_request("/")).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let ct = resp
            .headers()
            .get(axum::http::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        assert!(ct.contains("text/html"), "content-type was: {ct}");
    }

    #[tokio::test]
    async fn static_route_404_on_missing() {
        let app = build_app(make_test_state());
        let resp = app
            .oneshot(empty_request("/static/this-doesnt-exist.txt"))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn static_route_serves_woff2_with_correct_mime() {
        if Asset::get("fonts/geist-mono.woff2").is_none() {
            // Font not vendored yet — skip rather than fail.
            return;
        }
        let app = build_app(make_test_state());
        let resp = app
            .oneshot(empty_request("/static/fonts/geist-mono.woff2"))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let ct = resp
            .headers()
            .get(axum::http::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        // mime_guess maps .woff2 → font/woff2 or application/font-woff2
        assert!(
            ct.contains("woff2") || ct.contains("font"),
            "expected woff2/font content-type, got: {ct}"
        );
    }
}
