//! Native AppKit window hosting the embedded web UI via wry/WebView.
//!
//! Compiled only on macOS. Other platforms skip the module entirely
//! (the `mod gui;` declaration in main.rs is also cfg-gated).

use std::sync::mpsc;

/// Channel sender used by the existing HALT button path. The window-close
/// handler reuses this to graceful-shutdown the bridge — no second shutdown
/// path to maintain.
pub type HaltSender = mpsc::Sender<()>;

/// Open a native AppKit window pointing at `url`. Blocks the calling thread
/// (must be the main thread on macOS) until the user closes the window or
/// `halt` fires from another source (e.g., the in-page HALT button).
pub fn run_window(_url: &str, _halt: HaltSender) -> anyhow::Result<()> {
    // Real implementation lands in Task 7.2.
    Ok(())
}
