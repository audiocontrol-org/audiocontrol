//! Keystroke synthesis via enigo, with macOS frontmost-app filtering.
//!
//! ## Threading
//!
//! The `Emitter` is not thread-safe and must be used from a single
//! thread — specifically, NOT from midir's callback thread. See
//! `midi.rs` for the mpsc pattern that keeps things on the main thread.
//!
//! ## macOS Accessibility permission
//!
//! `Enigo::new` will succeed even without Accessibility permission,
//! but `key()` calls will silently no-op. There's no clean way to
//! detect this at runtime — the user just has to grant permission
//! via System Settings → Privacy & Security → Accessibility.
//!
//! Make the error message loud if enigo init fails, and document
//! the permission requirement in README.

use anyhow::{Context, Result};
use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use std::thread;
use std::time::Duration;
use tracing::{debug, trace, warn};

/// The set of individual keystrokes the emitter knows how to send.
/// `KeystrokeBackend` maps each `Action` to one of these.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeyStroke {
    /// Space — LUNA's play/stop toggle.
    Space,
    /// Return — LUNA's return-to-zero.
    Return,
    /// `[` — LUNA's nudge-backward-one-bar (Pro Tools convention).
    BracketLeft,
    /// `]` — LUNA's nudge-forward-one-bar (Pro Tools convention).
    BracketRight,
}

pub struct Emitter {
    enigo: Enigo,
    delay: Duration,
    require_frontmost: Option<String>,
}

impl Emitter {
    /// Construct a new Emitter.
    ///
    /// - `delay_ms`: delay between chained keystrokes in a sequence.
    /// - `require_frontmost`: if Some, only emit when this app is
    ///   frontmost (macOS only; no-op on other platforms).
    pub fn new(delay_ms: u64, require_frontmost: Option<String>) -> Result<Self> {
        let enigo = Enigo::new(&Settings::default()).context(
            "failed to initialize Enigo. On macOS, grant Accessibility \
             permission to this binary in System Settings → Privacy & \
             Security → Accessibility.",
        )?;
        Ok(Self {
            enigo,
            delay: Duration::from_millis(delay_ms),
            require_frontmost,
        })
    }

    /// Emit a sequence of keystrokes, with `self.delay` between each.
    /// Skips emission entirely if the frontmost-app filter doesn't match.
    pub fn emit_sequence(&mut self, strokes: &[KeyStroke]) -> Result<()> {
        if strokes.is_empty() {
            return Ok(());
        }

        if let Some(ref app) = self.require_frontmost {
            match is_frontmost(app) {
                Ok(true) => {}
                Ok(false) => {
                    debug!(app = %app, "skipping keystrokes; not frontmost");
                    return Ok(());
                }
                Err(e) => {
                    // Fail closed: if we can't verify the frontmost app,
                    // don't emit. Leaking a Spacebar into Finder or
                    // Safari is worse than missing a transport event,
                    // since the state machine will typically re-sync on
                    // the next event.
                    warn!(?e, app = %app, "frontmost check failed; skipping keystrokes");
                    return Ok(());
                }
            }
        }

        for (i, stroke) in strokes.iter().enumerate() {
            if i > 0 {
                thread::sleep(self.delay);
            }
            let key = match stroke {
                KeyStroke::Space => Key::Space,
                KeyStroke::Return => Key::Return,
                KeyStroke::BracketLeft => Key::Unicode('['),
                KeyStroke::BracketRight => Key::Unicode(']'),
            };
            trace!(?stroke, "emitting keystroke");
            self.enigo
                .key(key, Direction::Click)
                .map_err(|e| anyhow::anyhow!("keystroke failed: {e}"))?;
        }
        Ok(())
    }
}

/// Check whether the given app name is frontmost.
///
/// macOS implementation uses `osascript` — ~10-20ms overhead,
/// imperceptible for transport events.
///
/// For sub-millisecond performance, this could be rewritten using
/// the `objc2-app-kit` crate to call `NSWorkspace.frontmostApplication`
/// directly. Not worth it for v1.
#[cfg(target_os = "macos")]
fn is_frontmost(app_name: &str) -> Result<bool> {
    use std::process::Command;

    let script = r#"tell application "System Events" to return name of first application process whose frontmost is true"#;

    let output = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .context("running osascript")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow::anyhow!("osascript failed: {}", stderr.trim()));
    }

    let front = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(front.eq_ignore_ascii_case(app_name))
}

#[cfg(not(target_os = "macos"))]
fn is_frontmost(_app_name: &str) -> Result<bool> {
    // No-op on non-macOS. If cross-platform support is added later,
    // implement per-platform here.
    Ok(true)
}
