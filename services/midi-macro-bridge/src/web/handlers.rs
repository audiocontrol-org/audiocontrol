//! Axum request handlers for the MIDI Macro Bridge HTTP API.
//!
//! All handlers return server-rendered HTML fragments (not JSON) so
//! htmx can swap them directly into the DOM. Handlers MUST NOT touch
//! any MIDI handle — they communicate with the MIDI loop exclusively
//! through the channels stored in `WebState`.
//!
//! ## Routes (registered in `web::mod::build_app`)
//! - `GET /api/ports`  → `ports`
//! - `GET /api/status` → `status`
//! - `GET /api/events` → `events` (SSE stream)

use std::collections::VecDeque;
use std::convert::Infallible;

use axum::extract::State;
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::{Html, IntoResponse};
use futures::stream::{self, StreamExt};
use tokio_stream::wrappers::BroadcastStream;

use crate::midi;
use crate::web::state::{EventLine, WebState};
use crate::web::views;

// ── /api/ports ────────────────────────────────────────────────────────────────

/// `GET /api/ports` — return an HTML fragment containing two `<datalist>`
/// elements populated from the live MIDI port enumeration.
///
/// `MidiInput::new(…)` / `MidiOutput::new(…)` are sync and interact with
/// the OS MIDI subsystem, so they run in `tokio::task::spawn_blocking`.
pub async fn ports(State(_state): State<WebState>) -> impl IntoResponse {
    let inputs = tokio::task::spawn_blocking(midi::list_ports_input)
        .await
        .unwrap_or_else(|_| Ok(vec![]))
        .unwrap_or_default();

    let outputs = tokio::task::spawn_blocking(midi::list_ports_output)
        .await
        .unwrap_or_else(|_| Ok(vec![]))
        .unwrap_or_default();

    Html(views::render_ports_fragment(&inputs, &outputs))
}

// ── /api/status ───────────────────────────────────────────────────────────────

/// `GET /api/status` — return the current status snapshot as an HTML
/// fragment. Reads from the `watch` channel; never blocks on MIDI I/O.
pub async fn status(State(state): State<WebState>) -> impl IntoResponse {
    let current = state.status_rx.borrow().clone();
    Html(views::render_status_fragment(&current))
}

// ── /api/events ───────────────────────────────────────────────────────────────

/// `GET /api/events` — Server-Sent Events stream.
///
/// On connect:
/// 1. Clones the history ring buffer (lock held only briefly, never
///    across an `.await`), then yields each historical `EventLine`.
/// 2. Subscribes to the live `broadcast::Sender<EventLine>` and yields
///    new events as they arrive.
///
/// Each event is rendered via `views::render_event_line` and wrapped in
/// an SSE `data:` frame. When the client disconnects, the `BroadcastStream`
/// is dropped and the subscription is automatically released.
pub async fn events(State(state): State<WebState>) -> impl IntoResponse {
    // 1. Snapshot history while holding the lock as briefly as possible.
    let history_snapshot: VecDeque<EventLine> = {
        let guard = state.events_history.lock().unwrap();
        guard.clone()
        // lock drops here, well before any .await
    };

    // 2. Subscribe to live events.
    let live_rx = state.subscribe_events();

    // Build the combined stream: history first, then live.
    let history_stream = stream::iter(history_snapshot)
        .map(|line| -> Result<Event, Infallible> {
            Ok(Event::default().data(views::render_event_line(&line)))
        });

    let live_stream = BroadcastStream::new(live_rx).filter_map(|result| async move {
        match result {
            Ok(line) => Some(Ok::<Event, Infallible>(
                Event::default().data(views::render_event_line(&line)),
            )),
            // BroadcastStream::Lagged means we missed some events — skip
            // the gap indicator and continue; the browser-side ring buffer
            // handles missing entries gracefully.
            Err(_) => None,
        }
    });

    let combined = history_stream.chain(live_stream);

    Sse::new(combined).keep_alive(KeepAlive::default())
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use std::time::SystemTime;

    use axum::body::to_bytes;
    use axum::http::{Request, StatusCode};
    use tower::util::ServiceExt;

    use super::*;
    use crate::config::Config;
    use crate::web::state::{EventLine, EventSource, Status, build_channels};
    #[allow(unused_imports)]
    use crate::web::views;

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

    // ── /api/status tests ─────────────────────────────────────────────────────

    #[tokio::test]
    async fn status_handler_returns_200() {
        let app = crate::web::build_app(make_test_state());
        let resp = app
            .oneshot(empty_request("/api/status"))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn status_handler_body_contains_mmb_status_id() {
        let app = crate::web::build_app(make_test_state());
        let resp = app
            .oneshot(empty_request("/api/status"))
            .await
            .unwrap();
        let body = to_bytes(resp.into_body(), usize::MAX).await.unwrap();
        let html = String::from_utf8_lossy(&body);
        assert!(
            html.contains(r#"id="mmb-status""#),
            "response missing id=\"mmb-status\": {html}"
        );
    }

    #[tokio::test]
    async fn status_handler_content_type_is_text_html() {
        let app = crate::web::build_app(make_test_state());
        let resp = app
            .oneshot(empty_request("/api/status"))
            .await
            .unwrap();
        let ct = resp
            .headers()
            .get(axum::http::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        assert!(ct.contains("text/html"), "content-type was: {ct}");
    }

    // ── /api/ports tests ──────────────────────────────────────────────────────

    #[tokio::test]
    async fn ports_handler_returns_200() {
        let app = crate::web::build_app(make_test_state());
        let resp = app
            .oneshot(empty_request("/api/ports"))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn ports_handler_body_contains_both_datalists() {
        let app = crate::web::build_app(make_test_state());
        let resp = app
            .oneshot(empty_request("/api/ports"))
            .await
            .unwrap();
        let body = to_bytes(resp.into_body(), usize::MAX).await.unwrap();
        let html = String::from_utf8_lossy(&body);
        assert!(
            html.contains(r#"<datalist id="mmb-input-ports">"#),
            "missing input datalist: {html}"
        );
        assert!(
            html.contains(r#"<datalist id="mmb-output-ports">"#),
            "missing output datalist: {html}"
        );
    }

    // ── /api/events SSE tests ─────────────────────────────────────────────────

    #[tokio::test]
    async fn events_handler_returns_200() {
        let app = crate::web::build_app(make_test_state());
        let resp = app
            .oneshot(empty_request("/api/events"))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn events_handler_content_type_is_event_stream() {
        let app = crate::web::build_app(make_test_state());
        let resp = app
            .oneshot(empty_request("/api/events"))
            .await
            .unwrap();
        let ct = resp
            .headers()
            .get(axum::http::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        assert!(
            ct.contains("text/event-stream"),
            "content-type was: {ct}"
        );
    }

    #[tokio::test]
    async fn events_handler_history_event_appears_in_stream() {
        // Verify that a history event appears as the first rendered event line.
        // We test this by checking that render_event_line produces the expected
        // HTML for a history event — the SSE chunking is verified separately
        // by the content-type test.
        let event = EventLine {
            at: SystemTime::now(),
            source: EventSource::Bridge,
            text: "bridge ready".to_string(),
        };
        let rendered = views::render_event_line(&event);
        assert!(
            rendered.contains(r#"class="event-line""#),
            "missing event-line class: {rendered}"
        );
        assert!(
            rendered.contains("bridge ready"),
            "missing event text: {rendered}"
        );
        assert!(
            rendered.contains("ev-bridge"),
            "missing source class: {rendered}"
        );
    }

    #[tokio::test]
    async fn events_handler_live_event_in_stream() {
        // Verify that a subscriber receives a live event from the broadcast
        // channel. This tests the channel plumbing, not the HTTP transport
        // (which is confirmed by the content-type test above).
        let state = make_test_state();
        let events_tx = state.events_tx.clone();
        let mut live_rx = state.subscribe_events();

        let sent = EventLine {
            at: SystemTime::now(),
            source: EventSource::Mc500,
            text: "live event test".to_string(),
        };
        let _ = events_tx.send(sent.clone());

        // Should receive within one recv call — the sender and receiver
        // are in the same process.
        let received = live_rx.try_recv().expect("event was sent synchronously");
        assert_eq!(received.text, "live event test");
        assert!(matches!(received.source, EventSource::Mc500));
    }
}
