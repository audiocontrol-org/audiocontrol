//! Server-rendered HTML fragment helpers for the MIDI Macro Bridge web UI.
//!
//! All public functions return `String` fragments suitable for direct
//! insertion into an HTTP response body. No template engine is used —
//! output is built with plain Rust string formatting.
//!
//! CSS class names are established here for Phase 6d's stylesheet;
//! no `<style>` blocks appear in this file.

use std::time::{Duration, SystemTime, UNIX_EPOCH};

use crate::web::state::{BridgeState, EventLine, EventSource, PortStatus, Status};

// ── HTML escaping ─────────────────────────────────────────────────────────────

/// Escape a string for safe inclusion in HTML text content or attribute
/// values. Replaces `&`, `<`, `>`, `"`, and `'` with their named HTML
/// entities.
pub fn escape_html(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for ch in s.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            other => out.push(other),
        }
    }
    out
}

// ── Port list ─────────────────────────────────────────────────────────────────

/// Render a fragment containing two `<datalist>` elements for MIDI port
/// pickers. The lists are referenced by `<input list="mmb-input-ports">`
/// and `<input list="mmb-output-ports">` elements in the config form
/// (Phase 6e).
pub fn render_ports_fragment(inputs: &[String], outputs: &[String]) -> String {
    let mut html = String::new();

    html.push_str(r#"<datalist id="mmb-input-ports">"#);
    for port in inputs {
        html.push_str(&format!(r#"<option value="{}"></option>"#, escape_html(port)));
    }
    html.push_str("</datalist>\n");

    html.push_str(r#"<datalist id="mmb-output-ports">"#);
    for port in outputs {
        html.push_str(&format!(r#"<option value="{}"></option>"#, escape_html(port)));
    }
    html.push_str("</datalist>\n");

    html
}

// ── Status fragment ───────────────────────────────────────────────────────────

/// Render the full status panel as an HTML fragment. Wrapped in
/// `<div id="mmb-status">` so htmx can target it for an OOB swap.
pub fn render_status_fragment(status: &Status) -> String {
    let bridge_badge = render_bridge_state_badge(&status.bridge_state);
    let transport_badge = render_transport_badge(&status.transport);

    let bar_text = match status.last_bar {
        Some(b) => b.to_string(),
        None => "--".to_string(),
    };

    let secs_since = match status.last_event_at {
        Some(inst) => format!("{:.1}s ago", inst.elapsed().as_secs_f64()),
        None => "never".to_string(),
    };

    let hb_text = match status.mcu_heartbeat_at {
        Some(inst) => format!("{:.1}s ago", inst.elapsed().as_secs_f64()),
        None => "never".to_string(),
    };

    let ports_html = render_port_statuses(&status.ports);

    format!(
        r#"<div id="mmb-status">
  <div class="status-row">
    {bridge_badge}
    {transport_badge}
    <span class="status-bar">Bar: <strong>{bar_text}</strong></span>
    <span class="status-last-event">Last event: {secs_since}</span>
    <span class="status-heartbeat">MCU heartbeat: {hb_text}</span>
  </div>
  <div class="status-ports">
    {ports_html}
  </div>
</div>"#
    )
}

fn render_bridge_state_badge(state: &BridgeState) -> String {
    let (cls, label) = match state {
        BridgeState::Initialising => ("badge-init", "INIT"),
        BridgeState::Running => ("badge-run", "RUN"),
        BridgeState::Reconnecting => ("badge-reconnect", "RECONNECT"),
        BridgeState::Panicked => ("badge-panic", "PANIC"),
    };
    format!(r#"<span class="badge {cls}">{label}</span>"#)
}

fn render_transport_badge(state: &crate::state::TransportState) -> String {
    use crate::state::TransportState;
    let (cls, label) = match state {
        TransportState::Stopped => ("badge-stopped", "STOPPED"),
        TransportState::Playing => ("badge-playing", "PLAYING"),
        TransportState::Locating { .. } => ("badge-locating", "LOCATING"),
    };
    format!(r#"<span class="badge {cls}">{label}</span>"#)
}

fn render_port_statuses(ports: &crate::web::state::PortStatuses) -> String {
    let mut html = String::new();
    html.push_str(&render_port_led("mc500-input", "MC-500 In", &ports.mc500_input));
    html.push_str(&render_port_led("mc500-sync", "MC-500 Sync", &ports.mc500_sync));
    html.push_str(&render_port_led("lcxl3-input", "LCXL3 In", &ports.lcxl3_input));
    html.push_str(&render_port_led("lcxl3-output", "LCXL3 Out", &ports.lcxl3_output));
    html.push_str(&render_port_led("mcu-virtual", "MCU Virtual", &ports.mcu_virtual));
    html
}

fn render_port_led(slot: &str, label: &str, status: &PortStatus) -> String {
    let led_class = if status.configured.is_none() {
        "led-off"
    } else if status.error.is_some() {
        "led-red"
    } else if status.connected {
        "led-green"
    } else {
        "led-amber"
    };

    let title = if let Some(err) = &status.error {
        format!("{}: {}", label, escape_html(err))
    } else if let Some(port) = &status.configured {
        format!("{}: {}", label, escape_html(port))
    } else {
        format!("{}: not configured", label)
    };

    format!(
        r#"<div class="led {led_class}" data-slot="{slot}" title="{title}"><span class="led-label">{label}</span></div>"#,
        led_class = led_class,
        slot = slot,
        title = escape_html(&title),
        label = label,
    )
}

// ── Event line ────────────────────────────────────────────────────────────────

/// Render a single event as an HTML fragment for the SSE stream.
///
/// Format: `<div class="event-line">…</div>` with child spans for the
/// timestamp, source tag, and event text. Source-class names are
/// `ev-mc500`, `ev-lcxl3`, `ev-mcu-out`, `ev-bridge`.
pub fn render_event_line(event: &EventLine) -> String {
    let ts = format_system_time(event.at);
    let (source_class, source_label) = match event.source {
        EventSource::Mc500 => ("ev-mc500", "MC500"),
        EventSource::Lcxl3 => ("ev-lcxl3", "LCXL3"),
        EventSource::McuOut => ("ev-mcu-out", "MCU-OUT"),
        EventSource::Bridge => ("ev-bridge", "BRIDGE"),
    };
    let text_escaped = escape_html(&event.text);

    format!(
        r#"<div class="event-line"><span class="ev-ts">{ts}</span><span class="ev-source {source_class}">{source_label}</span><span class="ev-text">{text_escaped}</span></div>"#
    )
}

/// Format a `SystemTime` as `HH:MM:SS.mmm` in local time (best-effort;
/// falls back to elapsed-since-unix-epoch if local-time conversion is
/// unavailable in a `no_std` context — not applicable here, but noted).
fn format_system_time(t: SystemTime) -> String {
    let duration_since_epoch = t.duration_since(UNIX_EPOCH).unwrap_or(Duration::ZERO);
    let total_secs = duration_since_epoch.as_secs();
    let millis = duration_since_epoch.subsec_millis();

    // Extract HH:MM:SS from the unix timestamp (UTC).
    let secs_of_day = total_secs % 86400;
    let h = secs_of_day / 3600;
    let m = (secs_of_day % 3600) / 60;
    let s = secs_of_day % 60;

    format!("{h:02}:{m:02}:{s:02}.{millis:03}")
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use std::time::SystemTime;

    use super::*;
    use crate::config::Config;
    use crate::web::state::{BridgeState, EventSource, PortStatuses, Status};

    // ── escape_html ───────────────────────────────────────────────────────────

    #[test]
    fn escape_html_leaves_plain_text_unchanged() {
        assert_eq!(escape_html("hello world"), "hello world");
    }

    #[test]
    fn escape_html_escapes_ampersand() {
        assert_eq!(escape_html("a&b"), "a&amp;b");
    }

    #[test]
    fn escape_html_escapes_angle_brackets() {
        assert_eq!(escape_html("<tag>"), "&lt;tag&gt;");
    }

    #[test]
    fn escape_html_escapes_double_quote() {
        assert_eq!(escape_html(r#"say "hi""#), "say &quot;hi&quot;");
    }

    #[test]
    fn escape_html_escapes_single_quote() {
        assert_eq!(escape_html("it's"), "it&#39;s");
    }

    // ── render_ports_fragment ─────────────────────────────────────────────────

    #[test]
    fn render_ports_fragment_contains_input_datalist() {
        let html = render_ports_fragment(&["Port A".to_string()], &[]);
        assert!(
            html.contains(r#"<datalist id="mmb-input-ports">"#),
            "missing input datalist: {html}"
        );
    }

    #[test]
    fn render_ports_fragment_contains_output_datalist() {
        let html = render_ports_fragment(&[], &["Port B".to_string()]);
        assert!(
            html.contains(r#"<datalist id="mmb-output-ports">"#),
            "missing output datalist: {html}"
        );
    }

    #[test]
    fn render_ports_fragment_includes_port_names() {
        let html = render_ports_fragment(
            &["MC-500 In 1".to_string()],
            &["MCU Virtual Out".to_string()],
        );
        assert!(html.contains("MC-500 In 1"), "input port missing: {html}");
        assert!(html.contains("MCU Virtual Out"), "output port missing: {html}");
    }

    #[test]
    fn render_ports_fragment_escapes_port_names() {
        let html = render_ports_fragment(&["Port <\"weird\">".to_string()], &[]);
        assert!(
            !html.contains("<\"weird\">"),
            "unescaped angle brackets in: {html}"
        );
        assert!(html.contains("&lt;"), "expected escaped < in: {html}");
    }

    #[test]
    fn render_ports_fragment_empty_lists() {
        let html = render_ports_fragment(&[], &[]);
        assert!(html.contains(r#"<datalist id="mmb-input-ports">"#));
        assert!(html.contains(r#"<datalist id="mmb-output-ports">"#));
    }

    // ── render_status_fragment ────────────────────────────────────────────────

    fn make_status(bridge_state: BridgeState) -> Status {
        Status {
            bridge_state,
            transport: crate::state::TransportState::Stopped,
            last_bar: None,
            last_event_at: None,
            ports: PortStatuses::default(),
            mcu_heartbeat_at: None,
            config: Config::default(),
        }
    }

    #[test]
    fn render_status_fragment_has_wrapper_id() {
        let status = make_status(BridgeState::Running);
        let html = render_status_fragment(&status);
        assert!(
            html.contains(r#"id="mmb-status""#),
            "missing wrapper id: {html}"
        );
    }

    #[test]
    fn render_status_fragment_has_all_port_slot_leds() {
        let status = make_status(BridgeState::Running);
        let html = render_status_fragment(&status);
        for slot in &["mc500-input", "mc500-sync", "lcxl3-input", "lcxl3-output", "mcu-virtual"] {
            assert!(
                html.contains(&format!("data-slot=\"{slot}\"")),
                "missing LED slot {slot} in: {html}"
            );
        }
    }

    #[test]
    fn render_status_fragment_led_off_for_unconfigured_port() {
        let status = make_status(BridgeState::Running);
        let html = render_status_fragment(&status);
        // All ports are default (unconfigured) — should have led-off class.
        assert!(html.contains("led-off"), "expected led-off in: {html}");
    }

    #[test]
    fn render_status_fragment_led_green_for_connected_port() {
        use crate::web::state::PortStatus;
        let mut status = make_status(BridgeState::Running);
        status.ports.mc500_input = PortStatus {
            configured: Some("MC-500".to_string()),
            connected: true,
            error: None,
        };
        let html = render_status_fragment(&status);
        assert!(html.contains("led-green"), "expected led-green in: {html}");
    }

    #[test]
    fn render_status_fragment_led_amber_for_configured_but_not_connected() {
        use crate::web::state::PortStatus;
        let mut status = make_status(BridgeState::Running);
        status.ports.mc500_input = PortStatus {
            configured: Some("MC-500".to_string()),
            connected: false,
            error: None,
        };
        let html = render_status_fragment(&status);
        assert!(html.contains("led-amber"), "expected led-amber in: {html}");
    }

    #[test]
    fn render_status_fragment_led_red_for_error() {
        use crate::web::state::PortStatus;
        let mut status = make_status(BridgeState::Running);
        status.ports.mc500_input = PortStatus {
            configured: Some("MC-500".to_string()),
            connected: false,
            error: Some("port not found".to_string()),
        };
        let html = render_status_fragment(&status);
        assert!(html.contains("led-red"), "expected led-red in: {html}");
    }

    #[test]
    fn render_status_fragment_shows_bar_when_present() {
        let mut status = make_status(BridgeState::Running);
        status.last_bar = Some(42);
        let html = render_status_fragment(&status);
        assert!(html.contains("42"), "expected bar number in: {html}");
    }

    #[test]
    fn render_status_fragment_shows_dash_dash_when_no_bar() {
        let status = make_status(BridgeState::Running);
        let html = render_status_fragment(&status);
        assert!(html.contains("--"), "expected -- for missing bar in: {html}");
    }

    // ── render_event_line ─────────────────────────────────────────────────────

    fn make_event(source: EventSource, text: &str) -> EventLine {
        EventLine {
            at: SystemTime::now(),
            source,
            text: text.to_string(),
        }
    }

    #[test]
    fn render_event_line_has_event_line_class() {
        let html = render_event_line(&make_event(EventSource::Bridge, "test"));
        assert!(
            html.contains(r#"class="event-line""#),
            "missing event-line class: {html}"
        );
    }

    #[test]
    fn render_event_line_mc500_source_class() {
        let html = render_event_line(&make_event(EventSource::Mc500, "start"));
        assert!(html.contains("ev-mc500"), "missing ev-mc500 in: {html}");
    }

    #[test]
    fn render_event_line_lcxl3_source_class() {
        let html = render_event_line(&make_event(EventSource::Lcxl3, "toggle"));
        assert!(html.contains("ev-lcxl3"), "missing ev-lcxl3 in: {html}");
    }

    #[test]
    fn render_event_line_mcu_out_source_class() {
        let html = render_event_line(&make_event(EventSource::McuOut, "heartbeat reply"));
        assert!(html.contains("ev-mcu-out"), "missing ev-mcu-out in: {html}");
    }

    #[test]
    fn render_event_line_bridge_source_class() {
        let html = render_event_line(&make_event(EventSource::Bridge, "ready"));
        assert!(html.contains("ev-bridge"), "missing ev-bridge in: {html}");
    }

    #[test]
    fn render_event_line_escapes_text() {
        let html = render_event_line(&make_event(EventSource::Bridge, "<script>alert(1)</script>"));
        assert!(
            !html.contains("<script>"),
            "unescaped script tag in: {html}"
        );
        assert!(html.contains("&lt;script&gt;"), "expected escaped in: {html}");
    }

    #[test]
    fn render_event_line_has_timestamp_span() {
        let html = render_event_line(&make_event(EventSource::Bridge, "test"));
        assert!(html.contains(r#"class="ev-ts""#), "missing ev-ts span in: {html}");
    }

    #[test]
    fn render_event_line_has_text_span() {
        let html = render_event_line(&make_event(EventSource::Mc500, "start event"));
        assert!(html.contains("start event"), "text missing from: {html}");
        assert!(html.contains(r#"class="ev-text""#), "missing ev-text span in: {html}");
    }
}
