//! Configuration file loading.

use anyhow::{Context, Result};
use serde::Deserialize;
use std::path::Path;

#[derive(Debug, Deserialize)]
pub struct Config {
    /// Substring match against MIDI port names (case-insensitive).
    pub midi_input_port: String,

    /// Delay in ms between chained keystrokes.
    #[serde(default = "default_delay")]
    pub keystroke_delay_ms: u64,

    /// Only emit keystrokes when this app is frontmost.
    /// Empty string disables the check.
    #[serde(default = "default_frontmost")]
    pub require_frontmost_app: String,

    /// Reserved for future use (e.g., menu bar enable/disable).
    #[serde(default = "default_true")]
    pub enabled_on_startup: bool,
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

    /// Returns the frontmost-app filter, or None if disabled.
    pub fn frontmost_filter(&self) -> Option<String> {
        if self.require_frontmost_app.is_empty() {
            None
        } else {
            Some(self.require_frontmost_app.clone())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_minimal_config() {
        let toml_text = r#"
            midi_input_port = "MC-500"
        "#;
        let cfg: Config = toml::from_str(toml_text).unwrap();
        assert_eq!(cfg.midi_input_port, "MC-500");
        assert_eq!(cfg.keystroke_delay_ms, 20);
        assert_eq!(cfg.require_frontmost_app, "LUNA");
        assert!(cfg.enabled_on_startup);
    }

    #[test]
    fn parses_full_config() {
        let toml_text = r#"
            midi_input_port = "UM-ONE"
            keystroke_delay_ms = 50
            require_frontmost_app = ""
            enabled_on_startup = false
        "#;
        let cfg: Config = toml::from_str(toml_text).unwrap();
        assert_eq!(cfg.keystroke_delay_ms, 50);
        assert_eq!(cfg.frontmost_filter(), None);
        assert!(!cfg.enabled_on_startup);
    }

    #[test]
    fn frontmost_filter_returns_none_when_empty() {
        let toml_text = r#"
            midi_input_port = "x"
            require_frontmost_app = ""
        "#;
        let cfg: Config = toml::from_str(toml_text).unwrap();
        assert_eq!(cfg.frontmost_filter(), None);
    }

    #[test]
    fn frontmost_filter_returns_some_when_set() {
        let toml_text = r#"
            midi_input_port = "x"
            require_frontmost_app = "LUNA"
        "#;
        let cfg: Config = toml::from_str(toml_text).unwrap();
        assert_eq!(cfg.frontmost_filter(), Some("LUNA".to_string()));
    }
}
