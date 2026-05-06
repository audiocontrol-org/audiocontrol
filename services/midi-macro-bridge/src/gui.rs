//! Native AppKit window hosting the embedded web UI via wry/WebView.
//!
//! Compiled only on macOS. Other platforms skip the module entirely
//! (the `mod gui;` declaration in main.rs is also cfg-gated).

use tao::event::{Event, WindowEvent};
use tao::event_loop::{ControlFlow, EventLoop};
use tao::window::WindowBuilder;
use wry::WebViewBuilder;

/// Open a native AppKit window pointing at `url`. Blocks the calling thread
/// (must be the main thread on macOS) until the user closes the window or
/// `halt` is invoked from another source (e.g., the in-page HALT button).
///
/// `halt` is a closure rather than a typed channel sender so that callers can
/// bridge to whatever shutdown mechanism they use (e.g. `mpsc::Sender<Cmd>`)
/// without gui.rs depending on the caller's channel types.
pub fn run_window(url: &str, halt: impl Fn() + Send + 'static) -> anyhow::Result<()> {
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
            // Ignore errors: an already-closed channel means the bridge is
            // already shutting down.
            halt();
            *control_flow = ControlFlow::Exit;
        }
    });
    // event_loop.run never returns on macOS; this line is unreachable but
    // keeps the function signature honest for non-macOS callers.
    #[allow(unreachable_code)]
    Ok(())
}
