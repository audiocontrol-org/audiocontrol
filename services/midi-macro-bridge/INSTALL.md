# Installing midi-macro-bridge as a service

## .app installed from .dmg (interactive launch)

The .dmg distribution installs `MidiMacroBridge.app` to `/Applications`.
Launch it like any macOS app — by double-clicking. **The .app does not
register itself as a daemon, LaunchAgent, or Login Item.** This is
intentional: the .app is for interactive use; if you want the bridge
running continuously in the background, use the Homebrew install path
with `brew services start midi-macro-bridge` instead.

Quitting:
- Click the **HALT** button in the app window (3-second hold), or
- Close the window (red X / Cmd-W), or
- Cmd-Q (when implemented in a future version with proper menubar)

All three trigger the same graceful shutdown.

## Homebrew (macOS, Linux)

After `brew install midi-macro-bridge`:

    brew services start midi-macro-bridge

Restart on each login. Stop with `brew services stop midi-macro-bridge`.

## Tarball install — macOS (launchd, per-user)

    cp ~/.local/share/midi-macro-bridge/launchd/com.audiocontrol.midi-macro-bridge.plist \
       ~/Library/LaunchAgents/
    launchctl load ~/Library/LaunchAgents/com.audiocontrol.midi-macro-bridge.plist

The plist's `ProgramArguments` assumes `/usr/local/bin/midi-macro-bridge`. If
you installed under `~/.local/bin`, edit the path before loading.

To stop:

    launchctl unload ~/Library/LaunchAgents/com.audiocontrol.midi-macro-bridge.plist

## Tarball install — Linux (systemd user)

    mkdir -p ~/.config/systemd/user
    cp ~/.local/share/midi-macro-bridge/systemd/midi-macro-bridge.service \
       ~/.config/systemd/user/
    systemctl --user enable --now midi-macro-bridge.service

The unit assumes `/usr/local/bin/midi-macro-bridge`. Edit `ExecStart=` if you
installed elsewhere.

To stop:

    systemctl --user disable --now midi-macro-bridge.service
