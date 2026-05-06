//! Native AppKit window hosting the embedded web UI via wry/WebView.
//!
//! Compiled only on macOS. Other platforms skip the module entirely
//! (the `mod gui;` declaration in main.rs is also cfg-gated).

use std::sync::mpsc;
use tao::event::{Event, WindowEvent};
use tao::event_loop::{ControlFlow, EventLoop};
use tao::window::WindowBuilder;
use wry::WebViewBuilder;

/// Channel sender used by the existing HALT button path. The window-close
/// handler reuses this to graceful-shutdown the bridge — no second shutdown
/// path to maintain.
pub type HaltSender = mpsc::Sender<()>;

/// Open a native AppKit window pointing at `url`. Blocks the calling thread
/// (must be the main thread on macOS) until the user closes the window or
/// `halt` fires from another source (e.g., the in-page HALT button).
pub fn run_window(url: &str, halt: HaltSender) -> anyhow::Result<()> {
    let event_loop = EventLoop::new();
    let window = WindowBuilder::new()
        .with_title("MIDI Macro Bridge")
        .with_inner_size(tao::dpi::LogicalSize::new(900.0, 700.0))
        .build(&event_loop)?;

    // wry 0.45 takes the window reference in WebViewBuilder::new(), not in build().
    let _webview = WebViewBuilder::new(&window)
        .with_url(url)
        .build()?;

    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;
        if let Event::WindowEvent {
            event: WindowEvent::CloseRequested,
            ..
        } = event
        {
            // Window close = same graceful shutdown path as the HALT button.
            // The receiver side is the main MIDI loop; ignore send errors
            // (already-closed channel = bridge is already shutting down).
            let _ = halt.send(());
            *control_flow = ControlFlow::Exit;
        }
    });
    // event_loop.run never returns on macOS; this line is unreachable but
    // keeps the function signature honest for non-macOS callers.
    #[allow(unreachable_code)]
    Ok(())
}
