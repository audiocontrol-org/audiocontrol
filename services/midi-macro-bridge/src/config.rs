//! Configuration file loading.

use anyhow::{Context, Result};
use serde::Deserialize;
use std::path::Path;

#[derive(Debug, Deserialize)]
pub struct Config {
    /// Substring match against the MC-500 transport MIDI input port.
    /// Case-insensitive.
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

fn default_delay() -> u64 {
    20
}
fn default_frontmost() -> String {
    "LUNA".to_string()
}
fn default_true() -> bool {
    true
}

impl Config {
    pub fn load(path: &Path) -> Result<Self> {
        let text = std::fs::read_to_string(path)
            .with_context(|| format!("reading config from {}", path.display()))?;
        toml::from_str(&text).context("parsing config TOML")
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
}
