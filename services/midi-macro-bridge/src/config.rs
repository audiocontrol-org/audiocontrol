//! Configuration file loading.

use anyhow::{Context, Result};
use serde::Deserialize;
use std::path::Path;

#[derive(Debug, Deserialize)]
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
}

impl Default for Config {
    fn default() -> Self {
        Self {
            midi_input_port: default_midi_input_port(),
            enabled_on_startup: true,
            transport: TransportConfig::default(),
            locate: LocateConfigToml::default(),
        }
    }
}

fn default_midi_input_port() -> String {
    // Placeholder; general port discovery deferred to release
    // hardening. See Config::midi_input_port docs.
    "828mk3 Hybrid MIDI".to_string()
}

#[derive(Debug, Deserialize)]
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

#[derive(Debug, Deserialize, Default, PartialEq, Eq, Clone, Copy)]
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
#[derive(Debug, Deserialize)]
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

fn default_delay() -> u64 {
    20
}
fn default_frontmost() -> String {
    "LUNA".to_string()
}
fn default_true() -> bool {
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
