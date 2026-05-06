//! macOS application menubar (App menu + Window menu).
//!
//! Built on `muda` via `tray_icon::menu` re-export — the same crate already
//! in the dependency tree for the status bar menu.  tao 0.30 does not ship
//! its own `menu` module; muda is the correct API surface.
//!
//! Menu API choice: `PredefinedMenuItem` handles About (via `AboutMetadata`
//! populated from `CARGO_PKG_*`) and CloseWindow (routes to `performClose:`
//! which fires `WindowEvent::CloseRequested`, handled by the existing hide
//! logic).  Quit and Preferences are custom `MenuItem`s so they route through
//! the `UserEvent` channel for graceful shutdown and browser-open respectively.

use tray_icon::menu::{
    AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu,
    accelerator::Accelerator,
};

use crate::gui::UserEvent;
use tao::event_loop::EventLoopProxy;

/// IDs for custom menu items that need event-loop routing.
///
/// `PredefinedMenuItem` variants (About, CloseWindow) are handled natively by
/// muda/AppKit and do not appear here.
pub struct MenuIds {
    pub preferences: tray_icon::menu::MenuId,
    pub quit: tray_icon::menu::MenuId,
}

/// Build and install the macOS application menubar.
///
/// Calls `Menu::init_for_nsapp()` to attach the menu as the NSApplication
/// main menu.  Returns the `Menu` (must stay alive for the duration of the
/// process) and the IDs needed by `route_menu_event`.
///
/// `AboutMetadata::default_from_cargo_env!()` macro reads version, authors,
/// and license from the compile-time `CARGO_PKG_*` env vars.
pub fn build_menubar() -> anyhow::Result<(Menu, MenuIds)> {
    let menu = Menu::new();

    let about = PredefinedMenuItem::about(
        None,
        Some(AboutMetadata {
            version: Some(env!("CARGO_PKG_VERSION").to_string()),
            authors: {
                let raw = env!("CARGO_PKG_AUTHORS");
                let v: Vec<String> = raw
                    .split(':')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect();
                if v.is_empty() { None } else { Some(v) }
            },
            license: {
                let l = env!("CARGO_PKG_LICENSE");
                if l.is_empty() { None } else { Some(l.to_string()) }
            },
            ..Default::default()
        }),
    );

    let prefs_accel: Accelerator = "CMD+COMMA".parse()?;
    let preferences = MenuItem::new("Preferences\u{2026}", true, Some(prefs_accel));

    let quit_accel: Accelerator = "CMD+Q".parse()?;
    let quit = MenuItem::new("Quit MIDI Macro Bridge", true, Some(quit_accel));

    let menu_ids = MenuIds {
        preferences: preferences.id().clone(),
        quit: quit.id().clone(),
    };

    let app_menu = Submenu::with_items(
        "MIDI Macro Bridge",
        true,
        &[
            &about,
            &PredefinedMenuItem::separator(),
            &preferences,
            &PredefinedMenuItem::separator(),
            &quit,
        ],
    )?;

    let close_window = PredefinedMenuItem::close_window(None);
    let window_menu = Submenu::with_items("Window", true, &[&close_window])?;
    window_menu.set_as_windows_menu_for_nsapp();

    menu.append_items(&[&app_menu, &window_menu])?;
    menu.init_for_nsapp();

    Ok((menu, menu_ids))
}

/// Route a menu event ID to a `UserEvent` on the event-loop proxy.
///
/// Returns `true` if the event was handled, `false` if it was unrecognised
/// (so the caller can pass it on or ignore it).
pub fn route_menu_event(
    id: &tray_icon::menu::MenuId,
    ids: &MenuIds,
    proxy: &EventLoopProxy<UserEvent>,
) -> bool {
    if id == &ids.quit {
        let _ = proxy.send_event(UserEvent::Quit);
        true
    } else if id == &ids.preferences {
        let _ = proxy.send_event(UserEvent::OpenPreferences);
        true
    } else {
        false
    }
}
