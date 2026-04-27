//! Server-rendered HTML fragment helpers for the MIDI Macro Bridge web UI.
//!
//! All public functions return `String` fragments suitable for direct
//! insertion into an HTTP response body. No template engine is used —
//! output is built with plain Rust string formatting.
//!
//! CSS class names are established here for Phase 6d's stylesheet;
//! no `<style>` blocks appear in this file.

use std::time::{Duration, SystemTime, UNIX_EPOCH};

use crate::config::{BackendKind, Config};
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

// ── Config form ───────────────────────────────────────────────────────────────

/// Render the configuration form as a self-contained HTML fragment.
///
/// The fragment includes inline `<datalist>` elements (empty by default;
/// the page calls `/api/ports` on load to populate them) so the form can
/// function even before the ports endpoint responds.
///
/// The form posts via htmx to `POST /api/config`. While the request is
/// in flight htmx adds `.htmx-request` to `#mmb-routing` (the
/// `hx-indicator` target on the form), which triggers the reconnecting
/// animation in `app.css`.
pub fn render_config_form(cfg: &Config) -> String {
    let mi = escape_html(&cfg.midi_input_port);
    let mo = escape_html(&cfg.mc500_output_port);
    let li = escape_html(&cfg.lcxl3.input_port);
    let lo = escape_html(&cfg.lcxl3.output_port);
    let hn = escape_html(&cfg.lcxl3.host_name);
    let lcxl3_checked = if cfg.lcxl3.enabled { " checked" } else { "" };
    let mcu_checked = if cfg.transport.backend == BackendKind::Mcu { " checked" } else { "" };
    let keys_checked = if cfg.transport.backend == BackendKind::Keystrokes { " checked" } else { "" };
    let keys_delay = cfg.transport.keystroke_delay_ms;
    let fa = escape_html(&cfg.transport.require_frontmost_app);
    let keys_display = if cfg.transport.backend == BackendKind::Keystrokes { "block" } else { "none" };

    // Build with string concatenation to avoid raw-string delimiter collisions
    // with `"#` sequences inside HTML attribute values.
    let mut html = String::with_capacity(2048);

    html.push_str("<form id=\"mmb-config-form\" hx-post=\"/api/config\"\n");
    html.push_str("      hx-target=\"#mmb-config-result\" hx-swap=\"innerHTML\"\n");
    html.push_str("      hx-indicator=\"#mmb-routing\">\n\n");

    // MC-500 panel
    html.push_str("  <fieldset class=\"mmb-device-panel\" data-device=\"mc500\">\n");
    html.push_str("    <legend class=\"mmb-section-label\">MC-500</legend>\n");
    html.push_str("    <label class=\"mmb-field\">\n");
    html.push_str("      <span class=\"mmb-field-label\">Input port</span>\n");
    html.push_str(&format!(
        "      <input type=\"text\" name=\"midi_input_port\" list=\"mmb-input-ports\"\n             value=\"{mi}\" autocomplete=\"off\">\n"
    ));
    html.push_str("    </label>\n");
    html.push_str("    <label class=\"mmb-field\">\n");
    html.push_str("      <span class=\"mmb-field-label\">Sync output port</span>\n");
    html.push_str(&format!(
        "      <input type=\"text\" name=\"mc500_output_port\" list=\"mmb-output-ports\"\n             value=\"{mo}\" autocomplete=\"off\">\n"
    ));
    html.push_str("    </label>\n");
    html.push_str("  </fieldset>\n\n");

    // LCXL3 panel
    html.push_str("  <fieldset class=\"mmb-device-panel\" data-device=\"lcxl3\">\n");
    html.push_str("    <legend class=\"mmb-section-label\">LCXL3</legend>\n");
    html.push_str("    <label class=\"mmb-field mmb-toggle\">\n");
    html.push_str(&format!(
        "      <input type=\"checkbox\" name=\"lcxl3_enabled\"{lcxl3_checked}>\n"
    ));
    html.push_str("      <span class=\"mmb-field-label\">Enabled</span>\n");
    html.push_str("    </label>\n");
    html.push_str("    <label class=\"mmb-field\">\n");
    html.push_str("      <span class=\"mmb-field-label\">Input port (DAW Out)</span>\n");
    html.push_str(&format!(
        "      <input type=\"text\" name=\"lcxl3_input_port\" list=\"mmb-input-ports\" value=\"{li}\" autocomplete=\"off\">\n"
    ));
    html.push_str("    </label>\n");
    html.push_str("    <label class=\"mmb-field\">\n");
    html.push_str("      <span class=\"mmb-field-label\">Output port (DAW In)</span>\n");
    html.push_str(&format!(
        "      <input type=\"text\" name=\"lcxl3_output_port\" list=\"mmb-output-ports\" value=\"{lo}\" autocomplete=\"off\">\n"
    ));
    html.push_str("    </label>\n");
    html.push_str("    <label class=\"mmb-field\">\n");
    html.push_str("      <span class=\"mmb-field-label\">Host name</span>\n");
    html.push_str(&format!(
        "      <input type=\"text\" name=\"lcxl3_host_name\" value=\"{hn}\" maxlength=\"32\">\n"
    ));
    html.push_str("    </label>\n");
    html.push_str("  </fieldset>\n\n");

    // Backend panel
    html.push_str("  <fieldset class=\"mmb-device-panel\" data-device=\"backend\">\n");
    html.push_str("    <legend class=\"mmb-section-label\">Backend</legend>\n");
    html.push_str("    <div class=\"mmb-segmented\" role=\"radiogroup\">\n");
    html.push_str(&format!(
        "      <input type=\"radio\" name=\"backend\" value=\"mcu\" id=\"mmb-backend-mcu\"{mcu_checked}>\n"
    ));
    html.push_str("      <label for=\"mmb-backend-mcu\">MCU</label>\n");
    html.push_str(&format!(
        "      <input type=\"radio\" name=\"backend\" value=\"keystrokes\" id=\"mmb-backend-keys\"{keys_checked}>\n"
    ));
    html.push_str("      <label for=\"mmb-backend-keys\">Keystrokes</label>\n");
    html.push_str("    </div>\n");
    html.push_str(&format!(
        "    <div class=\"mmb-keys-only\" data-show-when-backend=\"keystrokes\" style=\"display:{keys_display}\">\n"
    ));
    html.push_str("      <label class=\"mmb-field\">\n");
    html.push_str("        <span class=\"mmb-field-label\">Keystroke delay (ms)</span>\n");
    html.push_str(&format!(
        "        <input type=\"number\" name=\"keystroke_delay_ms\" value=\"{keys_delay}\" min=\"1\" max=\"500\">\n"
    ));
    html.push_str("      </label>\n");
    html.push_str("      <label class=\"mmb-field\">\n");
    html.push_str("        <span class=\"mmb-field-label\">Frontmost app</span>\n");
    html.push_str(&format!(
        "        <input type=\"text\" name=\"require_frontmost_app\" value=\"{fa}\">\n"
    ));
    html.push_str("      </label>\n");
    html.push_str("    </div>\n");
    html.push_str("  </fieldset>\n\n");

    // Inline datalists — start empty; /api/ports populates them on page load.
    html.push_str("  <datalist id=\"mmb-input-ports\"></datalist>\n");
    html.push_str("  <datalist id=\"mmb-output-ports\"></datalist>\n\n");

    html.push_str("  <button type=\"submit\" class=\"mmb-apply\" id=\"mmb-apply-btn\">APPLY CHANGES</button>\n");
    html.push_str("</form>\n");
    html.push_str("<div id=\"mmb-config-result\" aria-live=\"polite\"></div>\n");

    html
}

// ── Master LED rollup ─────────────────────────────────────────────────────────

/// Compute the master LED colour from the current `Status` snapshot.
///
/// Returns one of: `"green"`, `"amber"`, `"red"`, `"off"`.
///
/// | Bridge state      | LED    | Notes                                      |
/// |-------------------|--------|--------------------------------------------|
/// | Initialising      | amber  | startup in progress                        |
/// | Reconnecting      | amber  | config reload in progress                  |
/// | Panicked          | red    | fatal error; manual intervention required  |
/// | Running (healthy) | green  | all configured ports connected             |
/// | Running (degraded)| amber  | a configured port is disconnected, or MCU  |
/// |                   |        | heartbeat stale (port configured + active) |
pub fn master_led_state(status: &Status) -> &'static str {
    match status.bridge_state {
        BridgeState::Initialising | BridgeState::Reconnecting => "amber",
        BridgeState::Panicked => "red",
        BridgeState::Running => {
            let any_disconnected = status.ports.is_any_configured_port_disconnected();
            let stale_heartbeat = if status.ports.mcu_virtual.connected {
                match status.mcu_heartbeat_at {
                    None => true, // virtual endpoint active but heartbeat never seen
                    Some(t) => t.elapsed() > Duration::from_secs(5),
                }
            } else {
                false
            };
            if any_disconnected || stale_heartbeat {
                "amber"
            } else {
                "green"
            }
        }
    }
}

/// Build a human-readable tooltip explaining the current master LED state.
///
/// Returns `"bridge healthy"` for green. For non-green states, lists
/// the reasons separated by `", "`.
pub fn master_led_reason(status: &Status) -> String {
    match status.bridge_state {
        BridgeState::Initialising => "starting up...".to_string(),
        BridgeState::Reconnecting => "reloading configuration".to_string(),
        BridgeState::Panicked => "bridge in panic state".to_string(),
        BridgeState::Running => {
            let mut reasons: Vec<String> = Vec::new();

            // Check each physical port slot.
            let slots: [(&crate::web::state::PortStatus, &str); 4] = [
                (&status.ports.mc500_input, "MC-500 input"),
                (&status.ports.mc500_sync, "MC-500 sync"),
                (&status.ports.lcxl3_input, "LCXL3 input"),
                (&status.ports.lcxl3_output, "LCXL3 output"),
            ];
            for (slot, label) in &slots {
                if slot.configured.is_some() && !slot.connected {
                    reasons.push(format!("{label} disconnected"));
                }
            }

            // Check MCU heartbeat staleness.
            if status.ports.mcu_virtual.connected {
                match status.mcu_heartbeat_at {
                    None => reasons.push("MCU heartbeat not seen".to_string()),
                    Some(t) => {
                        let elapsed = t.elapsed();
                        if elapsed > Duration::from_secs(5) {
                            reasons.push(format!(
                                "MCU heartbeat stale ({}s ago)",
                                elapsed.as_secs()
                            ));
                        }
                    }
                }
            }

            if reasons.is_empty() {
                "bridge healthy".to_string()
            } else {
                reasons.join(", ")
            }
        }
    }
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

    // Master LED OOB block — htmx swaps this into the header LED element
    // independently of the main #mmb-status swap.
    let led_state = master_led_state(status);
    let led_reason = escape_html(&master_led_reason(status));

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
</div>
<div class="mmb-master-led" id="mmb-master-led" data-state="{led_state}" title="{led_reason}" hx-swap-oob="true"></div>"#
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

    // ── master_led_state ──────────────────────────────────────────────────────

    fn make_running_status() -> Status {
        Status {
            bridge_state: BridgeState::Running,
            transport: crate::state::TransportState::Stopped,
            last_bar: None,
            last_event_at: None,
            ports: PortStatuses::default(),
            mcu_heartbeat_at: None,
            config: Config::default(),
        }
    }

    #[test]
    fn master_led_state_running_no_ports_green() {
        // All unconfigured (default) ports + no MCU virtual connection = green.
        let status = make_running_status();
        assert_eq!(master_led_state(&status), "green");
    }

    #[test]
    fn master_led_state_running_all_configured_connected_green() {
        use crate::web::state::PortStatus;
        let mut status = make_running_status();
        let connected = PortStatus { configured: Some("x".into()), connected: true, error: None };
        status.ports.mc500_input = connected.clone();
        status.ports.mc500_sync = connected.clone();
        status.ports.lcxl3_input = connected.clone();
        status.ports.lcxl3_output = connected;
        assert_eq!(master_led_state(&status), "green");
    }

    #[test]
    fn master_led_state_running_configured_port_disconnected_amber() {
        use crate::web::state::PortStatus;
        let mut status = make_running_status();
        status.ports.mc500_input = PortStatus {
            configured: Some("MC-500".into()),
            connected: false,
            error: None,
        };
        assert_eq!(master_led_state(&status), "amber");
    }

    #[test]
    fn master_led_state_running_stale_heartbeat_amber() {
        use crate::web::state::PortStatus;
        use std::time::Instant;
        let mut status = make_running_status();
        // Mark the virtual port as connected so heartbeat staleness is checked.
        status.ports.mcu_virtual = PortStatus {
            configured: Some("MCU Virtual".into()),
            connected: true,
            error: None,
        };
        // Set heartbeat to 6 seconds ago (stale threshold is 5s).
        status.mcu_heartbeat_at = Some(Instant::now() - Duration::from_secs(6));
        assert_eq!(master_led_state(&status), "amber");
    }

    #[test]
    fn master_led_state_running_fresh_heartbeat_green() {
        use crate::web::state::PortStatus;
        use std::time::Instant;
        let mut status = make_running_status();
        status.ports.mcu_virtual = PortStatus {
            configured: Some("MCU Virtual".into()),
            connected: true,
            error: None,
        };
        status.mcu_heartbeat_at = Some(Instant::now());
        assert_eq!(master_led_state(&status), "green");
    }

    #[test]
    fn master_led_state_reconnecting_amber() {
        let mut status = make_running_status();
        status.bridge_state = BridgeState::Reconnecting;
        assert_eq!(master_led_state(&status), "amber");
    }

    #[test]
    fn master_led_state_panicked_red() {
        let mut status = make_running_status();
        status.bridge_state = BridgeState::Panicked;
        assert_eq!(master_led_state(&status), "red");
    }

    #[test]
    fn master_led_state_initialising_amber() {
        let mut status = make_running_status();
        status.bridge_state = BridgeState::Initialising;
        assert_eq!(master_led_state(&status), "amber");
    }

    // ── master_led_reason ─────────────────────────────────────────────────────

    #[test]
    fn master_led_reason_running_healthy_is_bridge_healthy() {
        let status = make_running_status();
        assert_eq!(master_led_reason(&status), "bridge healthy");
    }

    #[test]
    fn master_led_reason_initialising() {
        let mut status = make_running_status();
        status.bridge_state = BridgeState::Initialising;
        assert_eq!(master_led_reason(&status), "starting up...");
    }

    #[test]
    fn master_led_reason_reconnecting() {
        let mut status = make_running_status();
        status.bridge_state = BridgeState::Reconnecting;
        assert_eq!(master_led_reason(&status), "reloading configuration");
    }

    #[test]
    fn master_led_reason_panicked() {
        let mut status = make_running_status();
        status.bridge_state = BridgeState::Panicked;
        assert_eq!(master_led_reason(&status), "bridge in panic state");
    }

    #[test]
    fn master_led_reason_disconnected_port_names_slot() {
        use crate::web::state::PortStatus;
        let mut status = make_running_status();
        status.ports.mc500_input = PortStatus {
            configured: Some("MC-500 In".into()),
            connected: false,
            error: None,
        };
        let reason = master_led_reason(&status);
        assert!(
            reason.contains("MC-500 input"),
            "expected 'MC-500 input' in reason: {reason}"
        );
    }

    #[test]
    fn master_led_reason_stale_heartbeat_includes_elapsed() {
        use crate::web::state::PortStatus;
        use std::time::Instant;
        let mut status = make_running_status();
        status.ports.mcu_virtual = PortStatus {
            configured: Some("MCU Virtual".into()),
            connected: true,
            error: None,
        };
        status.mcu_heartbeat_at = Some(Instant::now() - Duration::from_secs(8));
        let reason = master_led_reason(&status);
        assert!(
            reason.contains("MCU heartbeat stale"),
            "expected 'MCU heartbeat stale' in reason: {reason}"
        );
    }

    // ── render_status_fragment master LED OOB ─────────────────────────────────

    #[test]
    fn render_status_fragment_includes_master_led_oob_block() {
        let status = make_running_status();
        let html = render_status_fragment(&status);
        assert!(
            html.contains(r#"id="mmb-master-led""#),
            "missing mmb-master-led id in OOB block: {html}"
        );
        assert!(
            html.contains(r#"hx-swap-oob="true""#),
            "missing hx-swap-oob attribute in OOB block: {html}"
        );
        assert!(
            html.contains(r#"data-state="green""#),
            "expected green state for healthy running bridge: {html}"
        );
    }

    #[test]
    fn render_status_fragment_master_led_oob_amber_for_initialising() {
        let status = Status {
            bridge_state: BridgeState::Initialising,
            transport: crate::state::TransportState::Stopped,
            last_bar: None,
            last_event_at: None,
            ports: PortStatuses::default(),
            mcu_heartbeat_at: None,
            config: Config::default(),
        };
        let html = render_status_fragment(&status);
        assert!(
            html.contains(r#"data-state="amber""#),
            "expected amber state for initialising bridge: {html}"
        );
    }

    #[test]
    fn render_status_fragment_master_led_oob_red_for_panicked() {
        let status = Status {
            bridge_state: BridgeState::Panicked,
            transport: crate::state::TransportState::Stopped,
            last_bar: None,
            last_event_at: None,
            ports: PortStatuses::default(),
            mcu_heartbeat_at: None,
            config: Config::default(),
        };
        let html = render_status_fragment(&status);
        assert!(
            html.contains(r#"data-state="red""#),
            "expected red state for panicked bridge: {html}"
        );
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

    // ── render_config_form ────────────────────────────────────────────────────

    fn make_config_for_form() -> Config {
        use crate::config::{LcxlConfig, TransportConfig, BackendKind};
        Config {
            midi_input_port: "My MC-500 In".to_string(),
            mc500_output_port: "My MC-500 Out".to_string(),
            transport: TransportConfig {
                backend: BackendKind::Mcu,
                keystroke_delay_ms: 30,
                require_frontmost_app: "LUNA".to_string(),
            },
            lcxl3: LcxlConfig {
                enabled: true,
                input_port: "LCXL3 1 DAW Out".to_string(),
                output_port: "LCXL3 1 DAW In".to_string(),
                host_name: "Bridge".to_string(),
            },
            ..Config::default()
        }
    }

    #[test]
    fn render_config_form_has_all_field_name_attributes() {
        let html = render_config_form(&make_config_for_form());
        for name in &[
            "midi_input_port",
            "mc500_output_port",
            "lcxl3_enabled",
            "lcxl3_input_port",
            "lcxl3_output_port",
            "lcxl3_host_name",
            "backend",
            "keystroke_delay_ms",
            "require_frontmost_app",
        ] {
            assert!(
                html.contains(&format!(r#"name="{name}""#)),
                "missing name={name}: {html}"
            );
        }
    }

    #[test]
    fn render_config_form_has_inline_datalists() {
        let html = render_config_form(&make_config_for_form());
        assert!(
            html.contains(r#"<datalist id="mmb-input-ports">"#),
            "missing inline input datalist: {html}"
        );
        assert!(
            html.contains(r#"<datalist id="mmb-output-ports">"#),
            "missing inline output datalist: {html}"
        );
    }

    #[test]
    fn render_config_form_mcu_backend_checked() {
        use crate::config::{TransportConfig, BackendKind};
        let mut cfg = make_config_for_form();
        cfg.transport = TransportConfig { backend: BackendKind::Mcu, ..cfg.transport };
        let html = render_config_form(&cfg);
        assert!(
            html.contains(r#"value="mcu" id="mmb-backend-mcu" checked"#),
            "mcu radio not checked: {html}"
        );
        // When mcu is selected, keystrokes radio is present but not checked.
        assert!(
            html.contains(r#"value="keystrokes" id="mmb-backend-keys""#),
            "keystrokes radio missing: {html}"
        );
        assert!(
            !html.contains(r#"value="keystrokes" id="mmb-backend-keys" checked"#),
            "keystrokes radio unexpectedly checked: {html}"
        );
    }

    #[test]
    fn render_config_form_keystrokes_backend_checked() {
        use crate::config::{TransportConfig, BackendKind};
        let mut cfg = make_config_for_form();
        cfg.transport = TransportConfig { backend: BackendKind::Keystrokes, ..cfg.transport };
        let html = render_config_form(&cfg);
        assert!(
            html.contains(r#"value="keystrokes" id="mmb-backend-keys" checked"#),
            "keystrokes radio not checked: {html}"
        );
    }

    #[test]
    fn render_config_form_lcxl3_enabled_checkbox_checked_when_enabled() {
        let html = render_config_form(&make_config_for_form());
        assert!(
            html.contains(r#"name="lcxl3_enabled" checked"#),
            "lcxl3_enabled checkbox not checked when enabled: {html}"
        );
    }

    #[test]
    fn render_config_form_lcxl3_enabled_checkbox_unchecked_when_disabled() {
        let mut cfg = make_config_for_form();
        cfg.lcxl3.enabled = false;
        let html = render_config_form(&cfg);
        // The checkbox should be present but NOT have "checked".
        assert!(
            html.contains(r#"name="lcxl3_enabled""#),
            "lcxl3_enabled checkbox missing: {html}"
        );
        assert!(
            !html.contains(r#"name="lcxl3_enabled" checked"#),
            "lcxl3_enabled checkbox unexpectedly checked: {html}"
        );
    }

    #[test]
    fn render_config_form_port_values_are_present() {
        let cfg = make_config_for_form();
        let html = render_config_form(&cfg);
        assert!(html.contains("My MC-500 In"), "midi_input_port value missing");
        assert!(html.contains("My MC-500 Out"), "mc500_output_port value missing");
        assert!(html.contains("LCXL3 1 DAW Out"), "lcxl3_input_port value missing");
        assert!(html.contains("LCXL3 1 DAW In"), "lcxl3_output_port value missing");
        assert!(html.contains("Bridge"), "lcxl3_host_name value missing");
    }

    #[test]
    fn render_config_form_escapes_special_chars_in_values() {
        let mut cfg = make_config_for_form();
        cfg.midi_input_port = r#"Port "test" & <more>"#.to_string();
        let html = render_config_form(&cfg);
        assert!(
            !html.contains(r#"Port "test" & <more>"#),
            "unescaped special chars in: {html}"
        );
        assert!(html.contains("&amp;"), "missing &amp; escape in: {html}");
    }

    #[test]
    fn render_config_form_has_hx_post_attribute() {
        let html = render_config_form(&make_config_for_form());
        assert!(
            html.contains(r#"hx-post="/api/config""#),
            "missing hx-post: {html}"
        );
    }

    #[test]
    fn render_config_form_has_apply_button() {
        let html = render_config_form(&make_config_for_form());
        assert!(
            html.contains(r#"id="mmb-apply-btn""#),
            "missing apply button: {html}"
        );
    }
}
