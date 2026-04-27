//! Configuration file loading.

use anyhow::{Context, Result};
use serde::Deserialize;
use std::path::Path;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    /// Substring match against the MC-500 transport MIDI input port.
    /// Case-insensitive.
    ///
    /// Defaults to `"828mk3 Hybrid MIDI"` — the interface used on
    /// Orion's primary rig. That's a placeholder default to make
    /// the out-of-the-box bridge useful without any config; a
    /// general port-discovery approach will come during release
    /// hardening. Set this explicitly if your MC-500 is routed
    /// through a different interface.
    ///
    /// If no port matches the substring, midir's connect fails with
    /// an actionable error pointing at `--list-ports`.
    #[serde(default = "default_midi_input_port")]
    pub midi_input_port: String,

    /// Substring match against the MC-500 MIDI input port — the
    /// *output side* of the bridge, routed back to the MC-500's
    /// MIDI IN. Used only for sync-on-stop: after LUNA snaps to its
    /// play-start position, the bridge sends Song Position Pointer
    /// to the MC-500 so both machines agree on where the playhead
    /// is.
    ///
    /// Defaults to the same port name as `midi_input_port` (the
    /// 828mk3) — midir distinguishes inputs from outputs at the
    /// port-enumeration level, so the same substring resolves to
    /// two different endpoints.
    ///
    /// Empty string disables the sync feature. If the port exists
    /// but isn't reachable (MC-500 unplugged, cable routed
    /// elsewhere), the bridge warns at startup and continues
    /// without the sync — MC-500 → LUNA direction still works.
    #[serde(default = "default_mc500_output_port")]
    pub mc500_output_port: String,

    /// Reserved for future use (e.g., menu bar enable/disable).
    #[serde(default = "default_true")]
    pub enabled_on_startup: bool,

    /// Transport-backend selection + backend-specific knobs. Optional
    /// in the TOML; defaults to the MCU backend with sensible
    /// keystroke-backend fallback settings if the user ever switches
    /// to keystrokes mid-session.
    #[serde(default)]
    pub transport: TransportConfig,

    /// SPP-driven closed-loop locate settings. Optional; when absent
    /// from the TOML, defaults are used — `enabled = true` so the
    /// feature is on out of the box (see LocateConfigToml::default()).
    #[serde(default)]
    pub locate: LocateConfigToml,

    /// Novation Launch Control XL Mk3 input + LED-output settings.
    /// Optional; defaults to `enabled = false` so MC-500-only users
    /// see no behaviour change. When enabled, the bridge opens the
    /// LCXL3's DAW Out / DAW In ports, runs the activation handshake
    /// at startup, listens for transport events, and mirrors LED
    /// state back. See `LcxlConfig::default()`.
    #[serde(default)]
    pub lcxl3: LcxlConfig,

    /// Embedded HTTP control interface settings. Optional; defaults to
    /// `enabled = true` so the web UI starts automatically. Set
    /// `enabled = false` to run in CLI-only mode (useful under launchd
    /// or on headless machines). See `WebConfig::default()`.
    #[serde(default)]
    pub web: WebConfig,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            midi_input_port: default_midi_input_port(),
            mc500_output_port: default_mc500_output_port(),
            enabled_on_startup: true,
            transport: TransportConfig::default(),
            locate: LocateConfigToml::default(),
            lcxl3: LcxlConfig::default(),
            web: WebConfig::default(),
        }
    }
}

fn default_midi_input_port() -> String {
    // Placeholder; general port discovery deferred to release
    // hardening. See Config::midi_input_port docs.
    "828mk3 Hybrid MIDI".to_string()
}

fn default_mc500_output_port() -> String {
    // Same default as the input; midir separates inputs from
    // outputs so the same substring resolves to distinct endpoints.
    "828mk3 Hybrid MIDI".to_string()
}

#[derive(Debug, Clone, Deserialize)]
pub struct TransportConfig {
    /// Which Backend the bridge should use to drive the DAW. `mcu`
    /// (default) emits MCU control-surface messages on the virtual
    /// endpoint pair, which works regardless of keyboard focus or
    /// macOS Accessibility state. `keystrokes` falls back to the
    /// Phase 1-2 keystroke path via enigo — preserved for
    /// environments where MCU isn't available.
    #[serde(default)]
    pub backend: BackendKind,

    /// Delay in ms between chained keystrokes. Only used when
    /// `backend = "keystrokes"`.
    #[serde(default = "default_delay")]
    pub keystroke_delay_ms: u64,

    /// Only emit keystrokes when this app is frontmost. Empty string
    /// disables the check. Only used when `backend = "keystrokes"`.
    #[serde(default = "default_frontmost")]
    pub require_frontmost_app: String,
}

impl Default for TransportConfig {
    fn default() -> Self {
        Self {
            backend: BackendKind::default(),
            keystroke_delay_ms: default_delay(),
            require_frontmost_app: default_frontmost(),
        }
    }
}

impl TransportConfig {
    /// Returns the frontmost-app filter, or None if disabled. Only
    /// meaningful in the keystrokes backend.
    pub fn frontmost_filter(&self) -> Option<String> {
        if self.require_frontmost_app.is_empty() {
            None
        } else {
            Some(self.require_frontmost_app.clone())
        }
    }
}

#[derive(Debug, Clone, Copy, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum BackendKind {
    #[default]
    Mcu,
    Keystrokes,
}

/// Serde-visible form of the locate config. The fields are simple
/// scalars so TOML users don't have to think about Duration types.
/// `TryInto<LocateConfig>` converts the ms values into the Duration
/// form the `LocateController` uses.
#[derive(Debug, Clone, Deserialize)]
pub struct LocateConfigToml {
    /// Enable closed-loop locate. On by default — if LUNA hasn't been
    /// set up as an MCU control surface the controller times out
    /// cleanly with an actionable error, so there's no real downside
    /// to leaving this enabled.
    #[serde(default = "default_locate_enabled")]
    pub enabled: bool,

    /// Hard cap on bar-nudge iterations. At 1 bar per iteration this
    /// is also the maximum locate distance.
    #[serde(default = "default_max_iterations")]
    pub max_iterations: u32,

    /// Per-iteration timeout, in milliseconds. If LUNA hasn't pushed
    /// a new bar value within this window after our nudge, abort.
    #[serde(default = "default_position_timeout_ms")]
    pub position_timeout_ms: u64,

    /// Initial-position timeout, in milliseconds. Longer than
    /// per-iteration because the surface-init "dead window" can
    /// exceed a normal iteration budget.
    #[serde(default = "default_initial_position_timeout_ms")]
    pub initial_position_timeout_ms: u64,
}

impl Default for LocateConfigToml {
    fn default() -> Self {
        Self {
            enabled: default_locate_enabled(),
            max_iterations: default_max_iterations(),
            position_timeout_ms: default_position_timeout_ms(),
            initial_position_timeout_ms: default_initial_position_timeout_ms(),
        }
    }
}

impl LocateConfigToml {
    /// Convert to the `LocateController`'s runtime config form.
    pub fn to_runtime(&self) -> crate::locate::LocateConfig {
        crate::locate::LocateConfig {
            max_iterations: self.max_iterations,
            position_timeout: std::time::Duration::from_millis(self.position_timeout_ms),
            initial_position_timeout: std::time::Duration::from_millis(
                self.initial_position_timeout_ms,
            ),
        }
    }
}

fn default_locate_enabled() -> bool {
    true
}
fn default_max_iterations() -> u32 {
    128
}
fn default_position_timeout_ms() -> u64 {
    500
}
fn default_initial_position_timeout_ms() -> u64 {
    3000
}

/// Novation Launch Control XL Mk3 settings. Disabled by default so
/// existing MC-500-only users see no behaviour change. When enabled,
/// the bridge opens the device's DAW Out / DAW In ports at startup,
/// runs the activation handshake (the `lcxl3::handshake_send`
/// sequence), listens for transport events, and pushes LED state
/// back when the transport state changes.
#[derive(Debug, Clone, Deserialize)]
pub struct LcxlConfig {
    /// Master switch. False by default — explicit opt-in keeps the
    /// existing MC-500-only path unaffected.
    #[serde(default = "default_lcxl3_enabled")]
    pub enabled: bool,

    /// Substring match for the LCXL3's DAW Out port (the device's
    /// output → bridge's input). Default `"LCXL3 1 DAW Out"` matches
    /// the macOS port name as Novation registers it.
    #[serde(default = "default_lcxl3_input_port")]
    pub input_port: String,

    /// Substring match for the LCXL3's DAW In port (bridge's output
    /// → device's input). Default `"LCXL3 1 DAW In"`.
    #[serde(default = "default_lcxl3_output_port")]
    pub output_port: String,

    /// ASCII text shown on the device's display as the host name
    /// during DAW mode. Mirrored from Live's pattern (Live sends
    /// `"Live 12"`); `"Bridge"` is short and identifies what's
    /// actually driving the device.
    #[serde(default = "default_lcxl3_host_name")]
    pub host_name: String,
}

impl Default for LcxlConfig {
    fn default() -> Self {
        Self {
            enabled: default_lcxl3_enabled(),
            input_port: default_lcxl3_input_port(),
            output_port: default_lcxl3_output_port(),
            host_name: default_lcxl3_host_name(),
        }
    }
}

fn default_lcxl3_enabled() -> bool {
    false
}
fn default_lcxl3_input_port() -> String {
    "LCXL3 1 DAW Out".to_string()
}
fn default_lcxl3_output_port() -> String {
    "LCXL3 1 DAW In".to_string()
}
fn default_lcxl3_host_name() -> String {
    "Bridge".to_string()
}

fn default_delay() -> u64 {
    20
}
fn default_frontmost() -> String {
    "LUNA".to_string()
}
fn default_true() -> bool {
    true
}

// ── Web config ────────────────────────────────────────────────────────────────

/// Settings for the embedded HTTP control interface (Phase 6).
/// All fields default to on so the web UI starts out of the box.
#[derive(Debug, Clone, Deserialize)]
pub struct WebConfig {
    /// Master switch. `true` by default — the web UI starts
    /// automatically unless the user opts out. Set `enabled = false`
    /// in `[web]` for headless / launchd-managed deployments.
    #[serde(default = "default_web_enabled")]
    pub enabled: bool,

    /// TCP port the HTTP listener binds to. Defaults to 8765. If the
    /// port is taken at startup, the bridge falls back to an
    /// OS-assigned port and logs the chosen URL.
    #[serde(default = "default_web_bind_port")]
    pub bind_port: u16,

    /// Whether to run `open http://127.0.0.1:<port>` after the
    /// listener binds. Defaults to `true` on macOS for first-run UX;
    /// set `false` when running under launchd or SSH where browser
    /// launch would be wrong or impossible.
    ///
    /// NOTE: not acted upon until Phase 6h. Field exists so
    /// configs written now are forward-compatible.
    // Phase 6h wires this; suppress dead_code until then.
    #[allow(dead_code)]
    #[serde(default = "default_web_auto_open")]
    pub auto_open_browser: bool,
}

impl Default for WebConfig {
    fn default() -> Self {
        Self {
            enabled: default_web_enabled(),
            bind_port: default_web_bind_port(),
            auto_open_browser: default_web_auto_open(),
        }
    }
}

fn default_web_enabled() -> bool {
    true
}
fn default_web_bind_port() -> u16 {
    8765
}
fn default_web_auto_open() -> bool {
    true
}

/// Result of attempting to load a config file. `Ok(Some(cfg))` on
/// successful load; `Ok(None)` when the file wasn't found (caller
/// should fall back to `Config::default()`); `Err` on other I/O
/// problems or TOML parse failures.
pub enum LoadOutcome {
    Loaded(Config),
    NotFound,
}

impl Config {
    pub fn load(path: &Path) -> Result<LoadOutcome> {
        match std::fs::read_to_string(path) {
            Ok(text) => {
                let cfg = toml::from_str(&text)
                    .with_context(|| format!("parsing TOML from {}", path.display()))?;
                Ok(LoadOutcome::Loaded(cfg))
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(LoadOutcome::NotFound),
            Err(e) => Err(anyhow::anyhow!(e))
                .with_context(|| format!("reading config from {}", path.display())),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_minimal_config_defaults_to_mcu_backend() {
        let toml_text = r#"
            midi_input_port = "MC-500"
        "#;
        let cfg: Config = toml::from_str(toml_text).unwrap();
        assert_eq!(cfg.midi_input_port, "MC-500");
        assert!(cfg.enabled_on_startup);
        // Default transport: MCU backend, keystroke knobs set to
        // defaults but unused.
        assert_eq!(cfg.transport.backend, BackendKind::Mcu);
        assert_eq!(cfg.transport.keystroke_delay_ms, 20);
        assert_eq!(cfg.transport.require_frontmost_app, "LUNA");
    }

    #[test]
    fn empty_toml_parses_to_all_defaults() {
        // Users who launch the bridge without a config file get
        // Config::default() via the NotFound branch in Config::load;
        // an empty TOML takes the same path via serde's defaults.
        let cfg: Config = toml::from_str("").unwrap();
        assert_eq!(cfg.midi_input_port, "828mk3 Hybrid MIDI");
        assert!(cfg.enabled_on_startup);
        assert_eq!(cfg.transport.backend, BackendKind::Mcu);
        assert!(cfg.locate.enabled);
    }

    #[test]
    fn config_default_matches_empty_toml() {
        // Config::default() (used by main.rs when the config file is
        // missing) must agree with what we'd get from parsing an
        // empty TOML. If these drift, the in-the-wild behaviour of
        // "no config" and "empty config" would differ subtly.
        let from_toml: Config = toml::from_str("").unwrap();
        let from_default = Config::default();
        assert_eq!(from_toml.midi_input_port, from_default.midi_input_port);
        assert_eq!(from_toml.enabled_on_startup, from_default.enabled_on_startup);
        assert_eq!(from_toml.transport.backend, from_default.transport.backend);
        assert_eq!(from_toml.locate.enabled, from_default.locate.enabled);
    }

    #[test]
    fn parses_explicit_mcu_backend() {
        let toml_text = r#"
            midi_input_port = "828"

            [transport]
            backend = "mcu"
        "#;
        let cfg: Config = toml::from_str(toml_text).unwrap();
        assert_eq!(cfg.transport.backend, BackendKind::Mcu);
    }

    #[test]
    fn parses_keystrokes_backend_with_custom_knobs() {
        let toml_text = r#"
            midi_input_port = "UM-ONE"
            enabled_on_startup = false

            [transport]
            backend = "keystrokes"
            keystroke_delay_ms = 50
            require_frontmost_app = ""
        "#;
        let cfg: Config = toml::from_str(toml_text).unwrap();
        assert!(!cfg.enabled_on_startup);
        assert_eq!(cfg.transport.backend, BackendKind::Keystrokes);
        assert_eq!(cfg.transport.keystroke_delay_ms, 50);
        assert_eq!(cfg.transport.frontmost_filter(), None);
    }

    #[test]
    fn frontmost_filter_returns_none_when_empty() {
        let toml_text = r#"
            midi_input_port = "x"

            [transport]
            require_frontmost_app = ""
        "#;
        let cfg: Config = toml::from_str(toml_text).unwrap();
        assert_eq!(cfg.transport.frontmost_filter(), None);
    }

    #[test]
    fn frontmost_filter_returns_some_when_set() {
        let toml_text = r#"
            midi_input_port = "x"

            [transport]
            require_frontmost_app = "LUNA"
        "#;
        let cfg: Config = toml::from_str(toml_text).unwrap();
        assert_eq!(cfg.transport.frontmost_filter(), Some("LUNA".to_string()));
    }

    /// Phase 1-2 configs had keystroke_delay_ms and
    /// require_frontmost_app at the top level. With the refactor
    /// they've moved under [transport]. serde silently ignores
    /// unknown top-level fields by default, so legacy configs still
    /// parse — they just don't pick up their old settings. Document
    /// this behaviour via test so migration is predictable.
    #[test]
    fn legacy_top_level_keystroke_fields_are_ignored_gracefully() {
        let toml_text = r#"
            midi_input_port = "MC-500"
            keystroke_delay_ms = 99
            require_frontmost_app = "LegacyApp"
        "#;
        let cfg: Config = toml::from_str(toml_text).unwrap();
        // Legacy fields ignored; defaults prevail.
        assert_eq!(cfg.transport.backend, BackendKind::Mcu);
        assert_eq!(cfg.transport.keystroke_delay_ms, 20);
        assert_eq!(cfg.transport.require_frontmost_app, "LUNA");
    }

    #[test]
    fn locate_defaults_to_enabled() {
        let toml_text = r#"
            midi_input_port = "MC-500"
        "#;
        let cfg: Config = toml::from_str(toml_text).unwrap();
        assert!(cfg.locate.enabled);
        assert_eq!(cfg.locate.max_iterations, 128);
        assert_eq!(cfg.locate.position_timeout_ms, 500);
        assert_eq!(cfg.locate.initial_position_timeout_ms, 3000);
    }

    #[test]
    fn locate_can_be_explicitly_disabled() {
        let toml_text = r#"
            midi_input_port = "MC-500"

            [locate]
            enabled = false
        "#;
        let cfg: Config = toml::from_str(toml_text).unwrap();
        assert!(!cfg.locate.enabled);
    }

    #[test]
    fn lcxl3_defaults_to_disabled() {
        // Existing MC-500-only configs must continue to behave
        // identically — no [lcxl3] section means feature is off.
        let toml_text = r#"
            midi_input_port = "MC-500"
        "#;
        let cfg: Config = toml::from_str(toml_text).unwrap();
        assert!(!cfg.lcxl3.enabled);
        assert_eq!(cfg.lcxl3.input_port, "LCXL3 1 DAW Out");
        assert_eq!(cfg.lcxl3.output_port, "LCXL3 1 DAW In");
        assert_eq!(cfg.lcxl3.host_name, "Bridge");
    }

    #[test]
    fn lcxl3_partial_section_uses_per_field_defaults() {
        // Setting just `enabled = true` keeps everything else at
        // default — important for a "smallest opt-in" UX.
        let toml_text = r#"
            midi_input_port = "MC-500"

            [lcxl3]
            enabled = true
        "#;
        let cfg: Config = toml::from_str(toml_text).unwrap();
        assert!(cfg.lcxl3.enabled);
        assert_eq!(cfg.lcxl3.input_port, "LCXL3 1 DAW Out");
        assert_eq!(cfg.lcxl3.output_port, "LCXL3 1 DAW In");
        assert_eq!(cfg.lcxl3.host_name, "Bridge");
    }

    #[test]
    fn lcxl3_full_section_parses_overrides() {
        let toml_text = r#"
            midi_input_port = "MC-500"

            [lcxl3]
            enabled = true
            input_port = "Custom Device DAW Out"
            output_port = "Custom Device DAW In"
            host_name = "MyBridge"
        "#;
        let cfg: Config = toml::from_str(toml_text).unwrap();
        assert!(cfg.lcxl3.enabled);
        assert_eq!(cfg.lcxl3.input_port, "Custom Device DAW Out");
        assert_eq!(cfg.lcxl3.output_port, "Custom Device DAW In");
        assert_eq!(cfg.lcxl3.host_name, "MyBridge");
    }

    #[test]
    fn lcxl3_default_matches_empty_toml() {
        // Same invariant as the top-level config: the no-config
        // path (Config::default) must agree with empty-TOML parsing.
        let from_toml: Config = toml::from_str("").unwrap();
        let from_default = Config::default();
        assert_eq!(from_toml.lcxl3.enabled, from_default.lcxl3.enabled);
        assert_eq!(from_toml.lcxl3.input_port, from_default.lcxl3.input_port);
        assert_eq!(from_toml.lcxl3.output_port, from_default.lcxl3.output_port);
        assert_eq!(from_toml.lcxl3.host_name, from_default.lcxl3.host_name);
    }

    #[test]
    fn locate_config_fields_parse() {
        let toml_text = r#"
            midi_input_port = "MC-500"

            [locate]
            enabled = true
            max_iterations = 200
            position_timeout_ms = 1000
            initial_position_timeout_ms = 5000
        "#;
        let cfg: Config = toml::from_str(toml_text).unwrap();
        assert!(cfg.locate.enabled);
        assert_eq!(cfg.locate.max_iterations, 200);
        assert_eq!(cfg.locate.position_timeout_ms, 1000);
        assert_eq!(cfg.locate.initial_position_timeout_ms, 5000);

        // to_runtime() wraps the ms values as Durations for the
        // LocateController.
        let rt = cfg.locate.to_runtime();
        assert_eq!(rt.max_iterations, 200);
        assert_eq!(rt.position_timeout, std::time::Duration::from_millis(1000));
        assert_eq!(
            rt.initial_position_timeout,
            std::time::Duration::from_millis(5000)
        );
    }
}
