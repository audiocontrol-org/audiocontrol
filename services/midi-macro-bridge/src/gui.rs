//! Native AppKit window hosting the embedded web UI via wry/WebView,
//! plus a persistent status bar item and signal-driven shutdown.
//!
//! Compiled only on macOS. Other platforms skip the module entirely
//! (the `mod gui;` declaration in main.rs is also cfg-gated).

use tao::dpi::LogicalSize;
use tao::event::{Event, WindowEvent};
use tao::event_loop::{ControlFlow, EventLoop, EventLoopBuilder};
use tao::window::{Window, WindowBuilder};
use tray_icon::menu::{Menu, MenuEvent, MenuItem};
use tray_icon::{Icon, TrayIconBuilder};
use wry::WebViewBuilder;

use crate::gui_menu;

const STATUS_BAR_ICON_PNG: &[u8] =
    include_bytes!("../packaging/macos/StatusBarIcon.png");

/// Events routed through the tao event-loop proxy so that tray-icon menu
/// callbacks can safely cross the thread boundary into the main event loop.
///
/// `pub` so that Tasks 8.2 and 8.3 can add new variants without touching
/// the internals of `run_window`.
#[derive(Debug, Clone)]
pub enum UserEvent {
    ShowWindow,
    Quit,
    /// Hide the window (same effect as clicking the red close button).
    CloseWindow,
    /// Open Preferences in the default browser at /api/config-form.
    OpenPreferences,
}

/// Open the bridge UI window and run the macOS event loop until the user
/// quits via the status bar menu or `halt` fires from another source.
///
/// `url` is the local HTTP URL for the embedded web UI; `halt` is a
/// zero-argument closure that triggers the bridge's graceful shutdown path
/// (e.g. sends a Cmd::Halt to the runtime).
///
/// `setup` is called once, synchronously, immediately after the event-loop
/// proxy is constructed and before `run()` is called. The proxy is passed to
/// the closure so callers can stash it (e.g. to forward single-instance
/// "show" wakeups into the loop via `UserEvent::ShowWindow`).
///
/// The function blocks the calling thread (must be the main thread on macOS)
/// for the lifetime of the process. It returns only when the event loop exits.
pub fn run_window(
    url: &str,
    halt: impl Fn() + Send + 'static,
    setup: impl FnOnce(tao::event_loop::EventLoopProxy<UserEvent>) + Send + 'static,
) -> anyhow::Result<()> {
    let event_loop: EventLoop<UserEvent> = EventLoopBuilder::with_user_event().build();
    let event_loop_proxy = event_loop.create_proxy();
    setup(event_loop_proxy.clone());

    let window = build_window(&event_loop)?;
    let _webview = WebViewBuilder::new(&window)
        .with_url(url)
        .build()?;

    let (_tray, _menu_show, _menu_quit, tray_show_id, tray_quit_id) =
        build_tray_icon(&event_loop_proxy)?;

    let (_menubar, menu_ids) = gui_menu::build_menubar()?;

    // Route all muda/tray menu events through the tao user-event channel.
    // `MenuEvent::set_event_handler` is global and may only be called once;
    // both the status-bar tray menu IDs and the app menubar IDs are merged
    // into this single handler.
    let proxy_clone = event_loop_proxy.clone();
    MenuEvent::set_event_handler(Some(move |event: MenuEvent| {
        let _ = if event.id == tray_show_id {
            proxy_clone.send_event(UserEvent::ShowWindow)
        } else if event.id == tray_quit_id || event.id == menu_ids.quit {
            proxy_clone.send_event(UserEvent::Quit)
        } else if event.id == menu_ids.preferences {
            proxy_clone.send_event(UserEvent::OpenPreferences)
        } else {
            Ok(())
        };
    }));

    // Capture the URL for the Preferences handler.
    let prefs_url = format!("{}/api/config-form", url);

    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;
        match event {
            // Window close button or CloseWindow menu item → hide the window;
            // keep the app alive via the status bar.
            Event::WindowEvent {
                event: WindowEvent::CloseRequested,
                ..
            }
            | Event::UserEvent(UserEvent::CloseWindow) => {
                window.set_visible(false);
            }
            Event::UserEvent(UserEvent::ShowWindow) => {
                window.set_visible(true);
                window.set_focus();
            }
            Event::UserEvent(UserEvent::Quit) => {
                halt();
                *control_flow = ControlFlow::Exit;
            }
            Event::UserEvent(UserEvent::OpenPreferences) => {
                let _ = std::process::Command::new("open").arg(&prefs_url).spawn();
            }
            _ => {}
        }
    });

    // event_loop.run never returns on macOS; this is unreachable but keeps
    // the return type honest for the compiler.
    #[allow(unreachable_code)]
    Ok(())
}

fn build_window(event_loop: &EventLoop<UserEvent>) -> anyhow::Result<Window> {
    Ok(WindowBuilder::new()
        .with_title("MIDI Macro Bridge")
        .with_inner_size(LogicalSize::new(900.0_f64, 700.0_f64))
        .build(event_loop)?)
}

/// Decode a PNG byte slice to raw RGBA pixels and build a `tray_icon::Icon`.
///
/// API deviation from workplan: `Icon::from_rgba_bytes` does not exist in
/// tray-icon 0.23. The actual API is `Icon::from_rgba(rgba: Vec<u8>, w, h)`,
/// which takes pre-decoded RGBA bytes. We decode the embedded PNG via the
/// `png` crate (already a transitive dependency of `tray-icon`; declared
/// explicitly in the macOS-gated `[target.*.dependencies]` block).
fn icon_from_png_bytes(png_bytes: &[u8]) -> anyhow::Result<Icon> {
    let decoder = png::Decoder::new(std::io::Cursor::new(png_bytes));
    let mut reader = decoder.read_info()?;
    let buf_size = reader
        .output_buffer_size()
        .ok_or_else(|| anyhow::anyhow!("png: output_buffer_size unavailable before first frame"))?;
    let mut buf = vec![0u8; buf_size];
    let info = reader.next_frame(&mut buf)?;
    let rgba = buf[..info.buffer_size()].to_vec();
    Ok(Icon::from_rgba(rgba, info.width, info.height)?)
}

/// Build the system status-bar (tray) icon and its context menu.
///
/// Returns the tray icon handle (must stay alive), the show/quit `MenuItem`
/// handles (must stay alive for ID validity), and the two menu-item IDs for
/// routing in the combined `MenuEvent` handler in `run_window`.
///
/// Note: `MenuEvent::set_event_handler` is NOT called here; the combined
/// handler in `run_window` covers both tray and app-menubar events.
fn build_tray_icon(
    _proxy: &tao::event_loop::EventLoopProxy<UserEvent>,
) -> anyhow::Result<(
    tray_icon::TrayIcon,
    MenuItem,
    MenuItem,
    tray_icon::menu::MenuId,
    tray_icon::menu::MenuId,
)> {
    let icon = icon_from_png_bytes(STATUS_BAR_ICON_PNG)?;

    let menu = Menu::new();
    let show = MenuItem::new("Show Window", true, None);
    let quit = MenuItem::new("Quit MIDI Macro Bridge", true, None);
    let show_id = show.id().clone();
    let quit_id = quit.id().clone();
    menu.append(&show)?;
    menu.append(&quit)?;

    let tray = TrayIconBuilder::new()
        .with_menu(Box::new(menu))
        .with_icon(icon)
        .with_icon_as_template(true) // black-on-transparent → macOS tints per menubar appearance
        .with_tooltip("MIDI Macro Bridge")
        .build()?;

    Ok((tray, show, quit, show_id, quit_id))
}
