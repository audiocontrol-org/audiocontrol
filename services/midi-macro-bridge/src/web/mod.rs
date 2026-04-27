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

pub mod handlers;
pub mod state;
pub mod views;

use std::net::SocketAddr;
use std::thread::JoinHandle;

use axum::response::IntoResponse;
use axum::routing::get;
use axum::Router;
use tracing::info;

use crate::web::state::WebState;

/// Build the axum `Router`.
pub fn build_app(state: WebState) -> Router {
    Router::new()
        .route("/", get(placeholder_handler))
        .route("/api/ports", get(handlers::ports))
        .route("/api/status", get(handlers::status))
        .route("/api/events", get(handlers::events))
        .with_state(state)
}

async fn placeholder_handler() -> impl IntoResponse {
    (
        axum::http::StatusCode::OK,
        [(axum::http::header::CONTENT_TYPE, "text/plain")],
        "MIDI Macro Bridge — Phase 6a placeholder",
    )
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
        WebState::new(status_rx, events_tx, cmd_tx, history)
    }

    fn empty_request(uri: &str) -> Request<axum::body::Body> {
        Request::builder()
            .uri(uri)
            .body(axum::body::Body::empty())
            .unwrap()
    }

    #[tokio::test]
    async fn placeholder_route_returns_200() {
        let app = build_app(make_test_state());
        let resp = app
            .oneshot(empty_request("/"))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn placeholder_route_returns_expected_body() {
        let app = build_app(make_test_state());
        let resp = app
            .oneshot(empty_request("/"))
            .await
            .unwrap();
        let body = to_bytes(resp.into_body(), usize::MAX).await.unwrap();
        assert_eq!(
            body.as_ref(),
            b"MIDI Macro Bridge \xe2\x80\x94 Phase 6a placeholder"
        );
    }

    #[tokio::test]
    async fn placeholder_route_content_type_is_text_plain() {
        let app = build_app(make_test_state());
        let resp = app
            .oneshot(empty_request("/"))
            .await
            .unwrap();
        let ct = resp
            .headers()
            .get(axum::http::header::CONTENT_TYPE)
            .and_then(|v: &axum::http::HeaderValue| v.to_str().ok())
            .unwrap_or("");
        assert!(ct.contains("text/plain"), "content-type was: {ct}");
    }
}
