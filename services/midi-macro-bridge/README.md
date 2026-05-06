# midi-macro-bridge

A small macOS daemon that translates MIDI events into keystrokes /
macros on the host computer.

**v1 scope:** translates MIDI transport messages from a Roland
MC-500mkII (or any MIDI device emitting real-time transport bytes)
into keyboard events for Universal Audio LUNA.

- Hit **PLAY** on the MC-500 → LUNA returns to zero and plays
- Hit **STOP** on the MC-500 → LUNA stops
- Hit **CONTINUE** on the MC-500 → LUNA resumes from playhead

**Not supported:** Song Position Pointer (SPP). LUNA does not accept
absolute position from any external source. This is a fundamental
limitation of LUNA, not of this tool.

## Install

### macOS (Apple Silicon) — drag-to-Applications .dmg (easiest, no Terminal)

Download `MidiMacroBridge-vX.Y.Z.dmg` from the
[latest release](https://github.com/audiocontrol-org/audiocontrol/releases),
double-click to mount, drag `MidiMacroBridge.app` to Applications,
double-click the app to launch.

A native window opens showing the bridge's web UI. Close the window
to quit; the bridge runs only while the window is open. The .dmg is
signed and notarized — no Gatekeeper workaround needed.

For service / daemon / always-on use, see Homebrew below or
[INSTALL.md](INSTALL.md).

### macOS (Apple Silicon) — Homebrew (recommended)

    brew tap audiocontrol-org/audiocontrol
    brew install midi-macro-bridge

### macOS / Linux — release tarball

Download the latest release tarball from
https://github.com/audiocontrol-org/audiocontrol/releases, then:

    tar -xzf midi-macro-bridge-vX.Y.Z-<triple>.tar.gz
    cd midi-macro-bridge-vX.Y.Z-<triple>
    ./install.sh           # installs to $HOME/.local (or /usr/local if root)

On macOS, unsigned binaries are quarantined by Gatekeeper. See
[QUARANTINE.md](QUARANTINE.md) for the recovery one-liner.

### From source

    cd services/midi-macro-bridge
    cargo build --release
    cp config.example.toml config.toml

### Find your MIDI port name

    midi-macro-bridge --list-ports

### Grant Accessibility permission (keystrokes backend only)

Only required if you set `[transport] backend = "keystrokes"` in `config.toml`.
The default MCU backend doesn't need Accessibility permission and works regardless
of which app is frontmost. For the keystrokes backend:

1. **System Settings → Privacy & Security → Accessibility**
2. Add `midi-macro-bridge` (or the terminal you're running it from)
3. Toggle it on

## Run

    midi-macro-bridge                              # foreground; auto-opens browser
    midi-macro-bridge --no-open                    # foreground; no browser
    midi-macro-bridge --config /path/to/config.toml

The bridge reads its config from (in order):

  1. `--config <path>` flag
  2. `$MIDI_MACRO_BRIDGE_CONFIG` environment variable
  3. macOS: `~/Library/Application Support/audiocontrol/midi-macro-bridge/config.toml`
     Linux: `~/.config/audiocontrol/midi-macro-bridge/config.toml`
  4. `./config.toml` (legacy / dev fallback)

Logs stream to stderr. Set `RUST_LOG=debug` for verbose output.

To run as a background service, see [INSTALL.md](INSTALL.md).

## How it works

When LUNA is the frontmost app (configurable), this tool watches for
the three MIDI real-time transport bytes and emits keystrokes:

| MIDI byte | Meaning  | LUNA keystrokes (from Stopped) | From Playing                  |
|-----------|----------|--------------------------------|-------------------------------|
| `0xFA`    | Start    | Return, Space                  | Space, Return, Space          |
| `0xFB`    | Continue | Space                          | (no-op; already playing)      |
| `0xFC`    | Stop     | (no-op; already stopped)       | Space                         |

A small internal state machine tracks what LUNA is doing based on
what we last told it, so duplicate/spurious events don't double-fire.
If state drifts (e.g., you hit spacebar directly in LUNA), the next
transport event will typically re-sync.

## Troubleshooting

**Keystrokes aren't reaching LUNA.** Grant Accessibility permission.

**Keystrokes go to the wrong app.** Make sure LUNA is frontmost, or
set `require_frontmost_app = ""` in config.toml to disable the check
(not recommended).

**LUNA starts and immediately stops.** Inter-keystroke delay is too
short. Bump `keystroke_delay_ms` to 50 or higher.

**The MC-500 sends transport but the tool doesn't react.** Check
`RUST_LOG=debug` output. Make sure `midi_input_port` matches your
interface. The substring match is case-insensitive.

**Feedback loop / stuttery sync.** Make sure LUNA is NOT sending MIDI
transport back to the same interface that reaches this tool's input
port. LUNA's MIDI output should only route to the MC-500's MIDI IN
(for clock chase, if you want that), not to anything this tool
listens to.

## Known limitations

- **MC-500 SPP is gated by MIDI sync mode.** The MC-500 only
  *accepts* SPP when in MIDI sync mode, and only *sends* SPP when
  NOT in MIDI sync mode. The two directions are mutually exclusive
  — the user picks one:
  - **MIDI sync OFF** (default for closed-loop locate): MC-500
    LOCATE → SPP → bridge → LUNA. But sync-on-stop's SPP from the
    bridge back to the MC-500 is ignored; the user has to manually
    reset the MC-500 position after a Stop.
  - **MIDI sync ON**: sync-on-stop works (MC-500 follows LUNA's
    snapped position). But MC-500 LOCATE stops sending SPP, so the
    closed-loop locate feature is unavailable.

  This is a Roland firmware quirk, not a bridge limitation; there's
  no workaround at the MIDI protocol layer.
- Cross-app keystroke leakage (keystroke backend only, opt-in) is
  mitigated by the frontmost-app check but not fully prevented.
  Don't Cmd-Tab mid-session.
- State drift if you use LUNA's transport via mouse/keyboard directly
  while the bridge is running. Hit Stop on the MC-500 twice to re-sync.

> **Note:** the rest of this README reflects the pre-Phase-3
> keystroke-only architecture and needs a refresh before release.
> The MCU backend (default today) doesn't require Accessibility
> permission and works with LUNA in the background — the
> Accessibility / frontmost-app instructions above are only
> relevant if you set `[transport] backend = "keystrokes"` in
> config.toml.
