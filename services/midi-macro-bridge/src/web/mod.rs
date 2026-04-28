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

use anyhow::{Context, Result};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::Router;
use tracing::info;

use crate::web::state::{spawn_status_broadcaster, WebState};

// ── ServerHandle ───────────────────────────────────────────────────────────────

/// Return value from `run_server_thread`. The caller receives both the
/// thread's `JoinHandle` (to keep alive for the process lifetime) and the
/// `SocketAddr` the listener actually bound to (preferred port or OS-assigned
/// fallback). Having the bound address lets `main` open a browser tab to
/// the correct URL and persist it to disk.
pub struct ServerHandle {
    pub join_handle: JoinHandle<()>,
    pub bound_addr: SocketAddr,
}

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
/// The server tries to bind `addr_pref` first. If that port is already
/// taken it falls back to `127.0.0.1:0` (OS-assigned port). Either way
/// the chosen address is reported back to the caller via a sync channel
/// before this function returns, so the caller knows the actual port
/// before the first HTTP request is possible.
///
/// The returned `ServerHandle` contains:
/// - `join_handle` — must be held alive by `main` for the process lifetime
///   (never explicitly joined in the happy path)
/// - `bound_addr` — the `SocketAddr` the listener actually bound to
///
/// Returns `Err` only if the OS refuses to spawn the server thread or the
/// inner server fails to bind before reporting back (which would be a
/// fatal OS-level failure).
pub fn run_server_thread(addr_pref: SocketAddr, state: WebState) -> Result<ServerHandle> {
    // A one-shot channel: the server thread fires the bound address once
    // the listener is up, before `axum::serve` takes over.
    let (addr_tx, addr_rx) = std::sync::mpsc::channel::<SocketAddr>();

    let join_handle = std::thread::Builder::new()
        .name("axum-server".into())
        .spawn(move || {
            let rt = tokio::runtime::Runtime::new().expect("failed to build tokio runtime");
            rt.block_on(async move {
                // Spawn the status broadcaster before building the app so
                // the first status frame fires as soon as the runtime starts.
                let _status_broadcaster = spawn_status_broadcaster(&state);

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

                // Report the bound address to the caller before blocking on serve.
                let bound = listener.local_addr().expect("listener has no local addr");
                let _ = addr_tx.send(bound);

                axum::serve(listener, app)
                    .await
                    .expect("axum server error");
            });
        })
        .context("failed to spawn axum server thread")?;

    let bound_addr = addr_rx
        .recv()
        .context("server thread failed to report bound address")?;

    Ok(ServerHandle {
        join_handle,
        bound_addr,
    })
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
        // Phase 8a: status updates are push-driven via SSE, not polling.
        // The page must have the SSE event connector that listens for status-updated.
        assert!(
            body.windows(b"sse-connect=\"/api/events\"".len())
                .any(|w| w == b"sse-connect=\"/api/events\""),
            "body missing sse-connect=\"/api/events\" SSE attribute"
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
