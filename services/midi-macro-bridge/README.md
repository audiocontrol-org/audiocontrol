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

## Setup

### Prerequisites

- macOS
- Rust toolchain (1.70+)
- A MIDI interface connected to the MC-500's MIDI OUT
- LUNA installed

### Build

```sh
cargo build --release
```

### Configure

```sh
cp config.example.toml config.toml
# Edit config.toml — at minimum set midi_input_port
```

Find your MIDI port name:

```sh
./target/release/midi-macro-bridge --list-ports
```

### Grant Accessibility permission

First run will fail to emit keystrokes until you grant the binary
Accessibility permission:

1. **System Settings → Privacy & Security → Accessibility**
2. Add `midi-macro-bridge` (or the terminal you're running it from)
3. Toggle it on

If keystrokes silently don't fire, this is the first thing to check.

### Run

```sh
./target/release/midi-macro-bridge config.toml
```

Logs stream to stderr. Set `RUST_LOG=debug` for verbose output.

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

- No SPP. Discussed above; no workaround.
- Cross-app keystroke leakage is mitigated by frontmost-app check but
  not fully prevented. Don't Cmd-Tab mid-session.
- State drift if you use LUNA's transport via mouse/keyboard directly
  while the bridge is running. Hit Stop on the MC-500 twice to re-sync.
