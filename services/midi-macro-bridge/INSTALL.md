# Installing midi-macro-bridge as a service

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
