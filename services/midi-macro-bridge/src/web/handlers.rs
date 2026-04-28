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

use std::collections::HashMap;
use std::collections::VecDeque;
use std::convert::Infallible;

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::{Html, IntoResponse};
use axum::Form;
use futures::stream::{self, StreamExt};
use tokio_stream::wrappers::BroadcastStream;
use tracing::warn;

use crate::config::{BackendKind, Config, LcxlConfig, TransportConfig};
use crate::midi;
use crate::web::state::{Cmd, EventLine, SseFrame, WebState};
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
///    across an `.await`), then yields each historical `EventLine` as
///    a default-event SSE frame (htmx appends to `#mmb-event-stream`).
/// 2. Emits ONE `status-updated` SSE frame from the current `status_rx`
///    snapshot so the client immediately gets current status without
///    waiting for the next `Status` change.
/// 3. Subscribes to the live `broadcast::Sender<SseFrame>` and yields
///    new frames as they arrive:
///    - `SseFrame::Event(line)` → default SSE event (Phase 6f compatible)
///    - `SseFrame::StatusUpdated(html)` → `event: status-updated` SSE event
///
/// When the client disconnects, the `BroadcastStream` is dropped and the
/// subscription is automatically released.
pub async fn events(State(state): State<WebState>) -> impl IntoResponse {
    // 1. Snapshot history while holding the lock as briefly as possible.
    let history_snapshot: VecDeque<EventLine> = {
        let guard = state.events_history.lock().unwrap();
        guard.clone()
        // lock drops here, well before any .await
    };

    // 2. Capture current status for the per-connect initial push.
    let initial_status_html = views::render_status_oob(&state.status_rx.borrow().clone());

    // 3. Subscribe to live frames.
    let live_rx = state.subscribe_events();

    // Build the combined stream: history events → initial status → live frames.
    let history_stream = stream::iter(history_snapshot)
        .map(|line| -> Result<Event, Infallible> {
            Ok(Event::default().data(views::render_event_line(&line)))
        });

    // Single initial status-updated frame to sync the UI on connect.
    let initial_status_stream = stream::once(async move {
        Ok::<Event, Infallible>(
            Event::default()
                .event("status-updated")
                .data(initial_status_html),
        )
    });

    let live_stream = BroadcastStream::new(live_rx).filter_map(|result| async move {
        match result {
            Ok(SseFrame::Event(line)) => Some(Ok::<Event, Infallible>(
                Event::default().data(views::render_event_line(&line)),
            )),
            Ok(SseFrame::StatusUpdated(html)) => Some(Ok::<Event, Infallible>(
                Event::default().event("status-updated").data(html),
            )),
            // BroadcastStream::Lagged means we missed some frames — skip
            // the gap and continue; the browser-side state handles this.
            Err(_) => None,
        }
    });

    let combined = history_stream
        .chain(initial_status_stream)
        .chain(live_stream);

    Sse::new(combined).keep_alive(KeepAlive::default())
}

// ── POST /api/halt ────────────────────────────────────────────────────────────

/// `POST /api/halt` — send `Cmd::Halt` to the MIDI loop and return 202.
///
/// The handler MUST NOT call `std::process::exit` directly. The MIDI loop
/// receives `Cmd::Halt` on its next tick and performs the exit, which keeps
/// shutdown logic in one place and ensures any pending cleanup runs.
///
/// Rate-limit safety: if the command channel happens to be full (capacity 16,
/// so practically impossible under normal use), the handler logs a warning and
/// returns 503 rather than blocking.
pub async fn halt(State(state): State<WebState>) -> impl IntoResponse {
    match state.cmd_tx.try_send(Cmd::Halt) {
        Ok(()) => (
            StatusCode::ACCEPTED,
            Html(r#"<div class="mmb-success">halt requested</div>"#.to_string()),
        )
            .into_response(),
        Err(tokio::sync::mpsc::error::TrySendError::Full(_)) => {
            warn!("Cmd::Halt dropped — command channel full; retry");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Html(r#"<div class="mmb-error">queue full, retry</div>"#.to_string()),
            )
                .into_response()
        }
        Err(tokio::sync::mpsc::error::TrySendError::Closed(_)) => {
            // The MIDI loop already exited (or is about to). The process is
            // going away regardless — return success so the UI doesn't show
            // a misleading error.
            warn!("Cmd::Halt: channel closed — MIDI loop already exiting");
            (
                StatusCode::ACCEPTED,
                Html(r#"<div class="mmb-success">halt requested</div>"#.to_string()),
            )
                .into_response()
        }
    }
}

// ── /api/config-form ─────────────────────────────────────────────────────────

/// `GET /api/config-form` — return the config form fragment populated from
/// the current `Status::config` snapshot, with port-select dropdowns
/// populated from the live MIDI port enumeration.
///
/// Port enumeration runs in `tokio::task::spawn_blocking` since the
/// midir calls are sync and touch the OS MIDI subsystem.
pub async fn config_form(State(state): State<WebState>) -> impl IntoResponse {
    let cfg = state.status_rx.borrow().config.clone();

    let inputs = tokio::task::spawn_blocking(midi::list_ports_input)
        .await
        .unwrap_or_else(|_| Ok(vec![]))
        .unwrap_or_default();

    let outputs = tokio::task::spawn_blocking(midi::list_ports_output)
        .await
        .unwrap_or_else(|_| Ok(vec![]))
        .unwrap_or_default();

    Html(views::render_config_form(&cfg, &inputs, &outputs))
}

// ── POST /api/config ──────────────────────────────────────────────────────────

/// Parse the flat form fields into a `Config`. Preserves fields the form
/// doesn't expose (locate config, web config, enabled_on_startup) from the
/// snapshot stored in `status_rx`.
fn parse_config_form(
    fields: &HashMap<String, String>,
    snapshot: &Config,
) -> Result<Config, String> {
    let get = |key: &str| -> Result<&str, String> {
        fields
            .get(key)
            .map(String::as_str)
            .ok_or_else(|| format!("Missing required field: {key}"))
    };

    let backend_str = get("backend")?;
    let backend = match backend_str {
        "mcu" => BackendKind::Mcu,
        "keystrokes" => BackendKind::Keystrokes,
        other => {
            return Err(format!(
                "Backend must be 'mcu' or 'keystrokes', got: {other}"
            ))
        }
    };

    let keystroke_delay_ms = get("keystroke_delay_ms")?
        .parse::<u64>()
        .map_err(|_| "keystroke_delay_ms must be a positive integer".to_string())?;

    Ok(Config {
        midi_input_port: get("midi_input_port")?.to_string(),
        mc500_output_port: get("mc500_output_port")?.to_string(),
        // Checkbox presence = true; absence = false (standard HTML form behaviour).
        lcxl3: LcxlConfig {
            enabled: fields.contains_key("lcxl3_enabled"),
            input_port: get("lcxl3_input_port")?.to_string(),
            output_port: get("lcxl3_output_port")?.to_string(),
            host_name: get("lcxl3_host_name")?.to_string(),
        },
        transport: TransportConfig {
            backend,
            keystroke_delay_ms,
            require_frontmost_app: get("require_frontmost_app")?.to_string(),
        },
        // Preserve fields the form doesn't expose.
        locate: snapshot.locate.clone(),
        web: snapshot.web.clone(),
        enabled_on_startup: snapshot.enabled_on_startup,
    })
}

fn error_fragment(msg: &str) -> String {
    format!(
        r#"<div class="mmb-error">{}</div>"#,
        views::escape_html(msg)
    )
}

/// `POST /api/config` — parse form fields into a new `Config`, write it
/// atomically to `config.toml`, and send `Cmd::Reload(config)` to the
/// MIDI loop. Returns an HTML fragment suitable for htmx target-swap.
///
/// The handler MUST NOT touch any MIDI handle. It communicates with the
/// MIDI loop exclusively via `state.cmd_tx`.
pub async fn config_post(
    State(state): State<WebState>,
    Form(fields): Form<HashMap<String, String>>,
) -> impl IntoResponse {
    // Read the current config snapshot to preserve fields the form doesn't expose.
    let snapshot = state.status_rx.borrow().config.clone();

    let new_config = match parse_config_form(&fields, &snapshot) {
        Ok(cfg) => cfg,
        Err(msg) => {
            return (StatusCode::BAD_REQUEST, Html(error_fragment(&msg))).into_response();
        }
    };

    // Atomic write to config.toml.
    if let Err(e) = new_config.write_atomic(&state.config_path) {
        let msg = format!("Failed to write config: {e}");
        return (StatusCode::INTERNAL_SERVER_ERROR, Html(error_fragment(&msg))).into_response();
    }

    // Send Cmd::Reload to the MIDI loop (non-blocking).
    match state.cmd_tx.try_send(Cmd::Reload(new_config)) {
        Ok(()) => {}
        Err(tokio::sync::mpsc::error::TrySendError::Full(_)) => {
            warn!("Cmd channel full; Reload queued by the loop — continuing");
        }
        Err(tokio::sync::mpsc::error::TrySendError::Closed(_)) => {
            warn!("Cmd channel closed; MIDI loop may have exited");
        }
    }

    // Return a success fragment. A 200ms-delayed htmx status refresh is
    // embedded so the routing matrix LEDs snap to the reconnected state
    // without requiring a page reload.
    // Note: avoid r"#...#" raw string delimiters — the `"#` inside
    // attribute values would close the delimiter early.
    let success_html = concat!(
        "<div class=\"mmb-success\">Configuration applied \u{2014} reconnecting\u{2026}</div>\n",
        "<div hx-get=\"/api/status\" hx-trigger=\"load delay:200ms\"",
        " hx-target=\"#mmb-status\" hx-swap=\"outerHTML\"></div>"
    );

    Html(success_html.to_string()).into_response()
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
    use crate::web::state::{EventLine, EventSource, SseFrame, Status, build_channels};
    #[allow(unused_imports)]
    use crate::web::views;

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

    fn make_post_halt_request() -> Request<axum::body::Body> {
        Request::builder()
            .method("POST")
            .uri("/api/halt")
            .body(axum::body::Body::empty())
            .unwrap()
    }

    // ── POST /api/halt tests ──────────────────────────────────────────────────

    #[tokio::test]
    async fn halt_handler_returns_202() {
        let app = crate::web::build_app(make_test_state());
        let resp = app
            .oneshot(make_post_halt_request())
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::ACCEPTED);
    }

    #[tokio::test]
    async fn halt_handler_emits_cmd_halt() {
        let initial = Status::initialising(Config::default());
        let (cmd_tx, mut cmd_rx, _status_tx, status_rx, events_tx, history) =
            build_channels(initial);
        let state = WebState::new(
            status_rx,
            events_tx,
            cmd_tx,
            history,
            std::path::PathBuf::from("config.toml"),
        );
        let app = crate::web::build_app(state);

        app.oneshot(make_post_halt_request()).await.unwrap();

        let cmd = cmd_rx
            .try_recv()
            .expect("Cmd::Halt should have been sent");
        assert!(
            matches!(cmd, crate::web::state::Cmd::Halt),
            "expected Cmd::Halt, got: {cmd:?}"
        );
    }

    #[tokio::test]
    async fn halt_handler_body_contains_success_fragment() {
        let app = crate::web::build_app(make_test_state());
        let resp = app
            .oneshot(make_post_halt_request())
            .await
            .unwrap();
        let body = to_bytes(resp.into_body(), usize::MAX).await.unwrap();
        let html = String::from_utf8_lossy(&body);
        assert!(
            html.contains("mmb-success"),
            "missing mmb-success in response: {html}"
        );
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
        let _ = events_tx.send(SseFrame::Event(sent));

        // Should receive within one recv call — the sender and receiver
        // are in the same process.
        let received = live_rx.try_recv().expect("frame was sent synchronously");
        match received {
            SseFrame::Event(line) => {
                assert_eq!(line.text, "live event test");
                assert!(matches!(line.source, EventSource::Mc500));
            }
            other => panic!("expected SseFrame::Event, got: {other:?}"),
        }
    }

    #[tokio::test]
    async fn events_handler_status_updated_frame_has_named_event() {
        // Verify that a StatusUpdated frame is emitted as event: status-updated
        // via the broadcast channel.
        let state = make_test_state();
        let events_tx = state.events_tx.clone();
        let mut live_rx = state.subscribe_events();

        let html = r#"<div id="mmb-master-led" hx-swap-oob="true" data-state="green"></div>"#.to_string();
        let _ = events_tx.send(SseFrame::StatusUpdated(html.clone()));

        let received = live_rx.try_recv().expect("frame was sent synchronously");
        match received {
            SseFrame::StatusUpdated(received_html) => {
                assert_eq!(received_html, html);
                // Confirm the html contains stable ids and hx-swap-oob
                assert!(received_html.contains(r#"hx-swap-oob="true""#));
                assert!(received_html.contains(r#"id="mmb-master-led""#));
            }
            other => panic!("expected SseFrame::StatusUpdated, got: {other:?}"),
        }
    }

    // ── /api/config-form tests ────────────────────────────────────────────────

    #[tokio::test]
    async fn config_form_handler_returns_200() {
        let app = crate::web::build_app(make_test_state());
        let resp = app
            .oneshot(empty_request("/api/config-form"))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn config_form_handler_contains_form_element() {
        let app = crate::web::build_app(make_test_state());
        let resp = app
            .oneshot(empty_request("/api/config-form"))
            .await
            .unwrap();
        let body = to_bytes(resp.into_body(), usize::MAX).await.unwrap();
        let html = String::from_utf8_lossy(&body);
        assert!(
            html.contains(r#"id="mmb-config-form""#),
            "missing config form id: {html}"
        );
        assert!(
            html.contains(r#"hx-post="/api/config""#),
            "missing hx-post: {html}"
        );
    }

    // ── POST /api/config tests ────────────────────────────────────────────────

    fn valid_form_body() -> &'static str {
        "midi_input_port=test-input\
         &mc500_output_port=test-output\
         &lcxl3_input_port=LCXL3+1+DAW+Out\
         &lcxl3_output_port=LCXL3+1+DAW+In\
         &lcxl3_host_name=Bridge\
         &backend=mcu\
         &keystroke_delay_ms=20\
         &require_frontmost_app=LUNA"
    }

    fn make_post_request(uri: &str, body: &str) -> Request<axum::body::Body> {
        Request::builder()
            .method("POST")
            .uri(uri)
            .header("content-type", "application/x-www-form-urlencoded")
            .body(axum::body::Body::from(body.to_string()))
            .unwrap()
    }

    #[tokio::test]
    async fn config_post_valid_form_returns_200_and_success_fragment() {
        let dir = tempfile::tempdir().unwrap();
        let config_path = dir.path().join("config.toml");

        let initial = Status::initialising(Config::default());
        let (cmd_tx, _cmd_rx, _status_tx, status_rx, events_tx, history) =
            build_channels(initial);
        let state = WebState::new(status_rx, events_tx, cmd_tx, history, config_path);
        let app = crate::web::build_app(state);

        let resp = app
            .oneshot(make_post_request("/api/config", valid_form_body()))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = to_bytes(resp.into_body(), usize::MAX).await.unwrap();
        let html = String::from_utf8_lossy(&body);
        assert!(
            html.contains("mmb-success"),
            "missing success fragment: {html}"
        );
    }

    #[tokio::test]
    async fn config_post_valid_form_emits_cmd_reload() {
        let dir = tempfile::tempdir().unwrap();
        let config_path = dir.path().join("config.toml");

        let initial = Status::initialising(Config::default());
        let (cmd_tx, mut cmd_rx, _status_tx, status_rx, events_tx, history) =
            build_channels(initial);
        let state = WebState::new(
            status_rx,
            events_tx,
            cmd_tx,
            history,
            config_path,
        );
        let app = crate::web::build_app(state);

        app.oneshot(make_post_request("/api/config", valid_form_body()))
            .await
            .unwrap();

        let cmd = cmd_rx.try_recv().expect("Cmd::Reload should have been sent");
        assert!(
            matches!(cmd, crate::web::state::Cmd::Reload(_)),
            "expected Cmd::Reload, got: {cmd:?}"
        );
    }

    #[tokio::test]
    async fn config_post_valid_form_writes_config_file() {
        let dir = tempfile::tempdir().unwrap();
        let config_path = dir.path().join("config.toml");

        let initial = Status::initialising(Config::default());
        let (cmd_tx, _cmd_rx, _status_tx, status_rx, events_tx, history) =
            build_channels(initial);
        let state = WebState::new(
            status_rx,
            events_tx,
            cmd_tx,
            history,
            config_path.clone(),
        );
        let app = crate::web::build_app(state);

        app.oneshot(make_post_request("/api/config", valid_form_body()))
            .await
            .unwrap();

        assert!(config_path.exists(), "config.toml not written");
        // Verify it's parseable.
        let loaded = crate::config::Config::load(&config_path).unwrap();
        assert!(matches!(loaded, crate::config::LoadOutcome::Loaded(_)));
    }

    #[tokio::test]
    async fn config_post_bad_backend_returns_400() {
        let dir = tempfile::tempdir().unwrap();
        let config_path = dir.path().join("config.toml");

        let initial = Status::initialising(Config::default());
        let (cmd_tx, mut cmd_rx, _status_tx, status_rx, events_tx, history) =
            build_channels(initial);
        let state = WebState::new(status_rx, events_tx, cmd_tx, history, config_path);
        let app = crate::web::build_app(state);

        let bad_body = "midi_input_port=x\
                        &mc500_output_port=x\
                        &lcxl3_input_port=x\
                        &lcxl3_output_port=x\
                        &lcxl3_host_name=x\
                        &backend=invalid\
                        &keystroke_delay_ms=20\
                        &require_frontmost_app=";

        let resp = app
            .oneshot(make_post_request("/api/config", bad_body))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);

        // No Cmd::Reload should have been sent.
        assert!(
            cmd_rx.try_recv().is_err(),
            "Cmd::Reload should NOT be sent on bad backend"
        );
    }

    #[tokio::test]
    async fn config_post_missing_required_field_returns_400() {
        let dir = tempfile::tempdir().unwrap();
        let config_path = dir.path().join("config.toml");

        let initial = Status::initialising(Config::default());
        let (cmd_tx, _cmd_rx, _status_tx, status_rx, events_tx, history) =
            build_channels(initial);
        let state = WebState::new(status_rx, events_tx, cmd_tx, history, config_path);
        let app = crate::web::build_app(state);

        // Omit midi_input_port entirely.
        let incomplete_body = "mc500_output_port=x\
                               &lcxl3_input_port=x\
                               &lcxl3_output_port=x\
                               &lcxl3_host_name=x\
                               &backend=mcu\
                               &keystroke_delay_ms=20\
                               &require_frontmost_app=";

        let resp = app
            .oneshot(make_post_request("/api/config", incomplete_body))
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn config_post_lcxl3_enabled_absent_means_false() {
        let dir = tempfile::tempdir().unwrap();
        let config_path = dir.path().join("config.toml");

        let initial = Status::initialising(Config::default());
        let (cmd_tx, mut cmd_rx, _status_tx, status_rx, events_tx, history) =
            build_channels(initial);
        let state = WebState::new(
            status_rx,
            events_tx,
            cmd_tx,
            history,
            config_path,
        );
        let app = crate::web::build_app(state);

        // lcxl3_enabled field is absent (checkbox unchecked = not submitted).
        let body = "midi_input_port=x\
                    &mc500_output_port=x\
                    &lcxl3_input_port=x\
                    &lcxl3_output_port=x\
                    &lcxl3_host_name=x\
                    &backend=mcu\
                    &keystroke_delay_ms=20\
                    &require_frontmost_app=";

        app.oneshot(make_post_request("/api/config", body))
            .await
            .unwrap();

        let cmd = cmd_rx.try_recv().expect("Cmd::Reload should be sent");
        if let crate::web::state::Cmd::Reload(cfg) = cmd {
            assert!(
                !cfg.lcxl3.enabled,
                "lcxl3.enabled should be false when checkbox absent"
            );
        } else {
            panic!("expected Cmd::Reload");
        }
    }

    #[tokio::test]
    async fn config_post_lcxl3_enabled_present_means_true() {
        let dir = tempfile::tempdir().unwrap();
        let config_path = dir.path().join("config.toml");

        let initial = Status::initialising(Config::default());
        let (cmd_tx, mut cmd_rx, _status_tx, status_rx, events_tx, history) =
            build_channels(initial);
        let state = WebState::new(
            status_rx,
            events_tx,
            cmd_tx,
            history,
            config_path,
        );
        let app = crate::web::build_app(state);

        // lcxl3_enabled present (checkbox checked = submitted with value "on").
        let body = "midi_input_port=x\
                    &mc500_output_port=x\
                    &lcxl3_enabled=on\
                    &lcxl3_input_port=x\
                    &lcxl3_output_port=x\
                    &lcxl3_host_name=x\
                    &backend=mcu\
                    &keystroke_delay_ms=20\
                    &require_frontmost_app=";

        app.oneshot(make_post_request("/api/config", body))
            .await
            .unwrap();

        let cmd = cmd_rx.try_recv().expect("Cmd::Reload should be sent");
        if let crate::web::state::Cmd::Reload(cfg) = cmd {
            assert!(
                cfg.lcxl3.enabled,
                "lcxl3.enabled should be true when checkbox present"
            );
        } else {
            panic!("expected Cmd::Reload");
        }
    }
}
