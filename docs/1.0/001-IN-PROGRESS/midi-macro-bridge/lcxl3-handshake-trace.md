# LCXL3 ↔ DAW Handshake — Decoded Reference

This is the annotated decode of the byte sequence Ableton Live 12 sends to a
freshly-power-cycled Novation Launch Control XL Mk3 to bring it into "DAW
connected" mode. It is the empirical foundation of the Phase 5 LCXL3
integration (`services/midi-macro-bridge/src/lcxl3.rs`) — every byte the
bridge sends to the device on startup is one of the bytes documented here.

The trace was captured against a real LCXL3 (USB-connected) plus Ableton
Live 12 running on macOS, with a MIDI monitor recording both directions of
the device's `LCXL3 1 DAW In` (host → device) and `LCXL3 1 DAW Out`
(device → host) ports. Two captures inform this document:

1. **Live activates LCXL3** — the full handshake plus initial state push.
2. **Bridge `--lcxl3-activate` activates LCXL3** — confirms the same
   handshake works without Live involved.

## Vendor SysEx framing

All Novation/Focusrite SysEx messages share a common 6-byte prefix and end
with `F7`:

```
F0 00 20 29 02 15 <cmd> [<data>...] F7
   └────┬─────┘  └─┬─┘  └────┬────┘
        │          │         └─ command-specific payload
        │          └─ command byte
        └─ Manufacturer ID: Focusrite/Novation (0x00 0x20 0x29) +
           product family 0x02 0x15
```

Three commands appear in the handshake:

| Cmd | Form                              | Meaning                          |
|-----|-----------------------------------|----------------------------------|
| `02` | `02 nn` — `nn=00` disconnect, `nn=7F` activate | DAW connection state |
| `04` | `04 page 62` open / `04 page 7F` close | begin / commit a page metadata block |
| `06` | `06 page sub <ascii>` — `sub=00` name, `01` sub-label, `02` value | LCD text on a page |

Pages encountered: `0x36` for the host name, `0x35` for the strip-bank
name, `0x05–0x24` for per-strip / per-knob LCD text. Phase 5 only needs
page `0x36` (the host name) — the strip / knob pages are state mirroring
that the bridge has nothing to put in.

## Phase-by-phase decode

### Phase 1 — Pre-init (visual reset)

Live sends ~120 CC messages clearing every LED on the device and
pre-painting the transport buttons. Examples:

```
B0 74 27   Play LED → "stopped" colour
B0 76 07   Record LED → "dim / not armed" colour
B0 72 00   (other transport-row LEDs cleared)
BF 09 00   right-column buttons cleared (channel 16)
```

The bridge does **not** need this phase — a freshly-power-cycled LCXL3
already has all LEDs off, and we set the transport-button LED colours
ourselves at the end of Phase 3. We could send this burst for symmetry
but it adds 120 messages of latency for no observable change.

### Phase 2 — Handshake

Five SysEx messages plus two responses, in this order:

```
host → device  F0 00 20 29 02 15 02 00 F7    DAW probe ("are you there?")
device → host  F0 00 20 29 02 15 02 00 F7    echo / acknowledgement
host → device  F0 7E 7F 06 01 F7             Universal Device Inquiry
device → host  F0 7E 00 06 02 00 20 29 48
                  01 00 01 01 01 0B 39 F7    UDI response (identifies as Focusrite/Novation product 0x4801, firmware 0x01010B39)
host → device  F0 00 20 29 02 15 02 7F F7    DAW claim ("I'm a DAW, take this device")
host → device  F0 00 20 29 02 15 04 36 62 F7   page 0x36 open
host → device  F0 00 20 29 02 15 06 36 01
                  4C 69 76 65 20 31 32 F7    page 0x36 sub-label set to "Live 12" (ASCII)
host → device  F0 00 20 29 02 15 04 36 7F F7   page 0x36 close
device → host  F0 00 20 29 02 15 02 7F F7    DAW claim acknowledged — device is now in DAW mode
```

The bridge sends an equivalent sequence with `"Bridge"` as the host name
string (the user-visible LCD text on the device). The device shows this
name in its display when it has nothing else to show.

### Phase 3 — Initial state push

Live follows the handshake with ~40 CCs setting initial LED colours for
transport, V-pots, fader buttons, channel selects, etc. The bridge needs
a tiny subset:

```
B0 74 27   Play LED → "stopped"  (idle state colour)
B0 76 07   Record LED → "dim"
```

Other LEDs (V-pots, faders, pads) stay off — Phase 5 doesn't map those
controls, so we don't need to light them.

### Phase 4 — Page metadata (skipped by the bridge)

Live sends ~120 SysEx messages setting the LCD text labels for every knob
and fader across all 4 pages of the LCXL3:

```
F0 00 20 29 02 15 04 0D 62 F7        page 0x0D (knob row 1) open
F0 00 20 29 02 15 06 0D 00 31 2D 4D 49 44 49 F7    name = "1-MIDI"
F0 00 20 29 02 15 06 0D 01 41 2D 52 65 76 65 72 62 F7  sub-label = "A-Reverb"
F0 00 20 29 02 15 06 0D 02 2D 69 6E 66 20 64 42 F7  value = "-inf dB"
F0 00 20 29 02 15 04 0D 7F F7        page 0x0D close
```

Phase 5 skips this — the bridge has no track names, send levels, or
parameter values to put on the device's LCD. The display stays
"uninitialised" for these knobs / faders which renders as blank or
generic text. Acceptable for v1; future phases that map V-pots can add
the relevant page metadata then.

### Phase 5 — Steady state (transport bytes)

After init quiets down, the device emits one byte sequence per transport
event:

```
device → host  B0 74 7F     Play button press
device → host  B0 74 00     Play button release  (typically ~100 ms after press)
host → device  B0 74 21     LED → green (Live is now playing)

device → host  B0 74 7F     Play button press again (toggle)
device → host  B0 74 00     release
host → device  B0 74 27     LED → idle (Live stopped)
```

The Play/Stop button is a **single toggle**: same byte for "start" and
"stop", with the host responsible for resolving the toggle into the
right action based on its current transport state.

The dedicated transport jog wheel is on **channel 16, CC `0x5D`**, with
**center-at-64** encoding — the value is `64 + delta`, where positive
delta means forward and negative means backward. Each tick of the
wheel produces one CC; a fast spin produces a stream:

```
device → host  BF 5D 41     +1 forward (value 65 = 64 + 1)
device → host  BF 5D 42     +2 forward (faster spin)
device → host  BF 5D 3F     −1 backward (value 63 = 64 - 1)
device → host  BF 5D 3E     −2 backward
device → host  BF 5D 40     (would be no-op at rest; not normally seen)
```

The bridge clamps `|delta|` to `MAX_NUDGE_PER_PACKET` (= 4) so a fast
spin can't queue a runaway sequence of `BarForward` actions to the
state machine.

The other encoders / V-pots produce CCs on channels 1–8 (and a few on
ch16); the bridge ignores all of them in v1. Notably, the device
streams its **current encoder absolute positions** on
`B6 1E xx` / `B6 1F xx` (and similar) on every DAW handshake — those
are state-mirror CCs, not relative ticks, and the bridge's parser
explicitly ignores them.

## Bridge → LCXL3 protocol summary

Everything the bridge sends in v1, with byte values:

| Action                     | Bytes                                                    |
|----------------------------|----------------------------------------------------------|
| DAW probe                  | `F0 00 20 29 02 15 02 00 F7`                             |
| Universal Device Inquiry   | `F0 7E 7F 06 01 F7`                                      |
| DAW claim                  | `F0 00 20 29 02 15 02 7F F7`                             |
| Host name page open        | `F0 00 20 29 02 15 04 36 62 F7`                          |
| Host name page name        | `F0 00 20 29 02 15 06 36 01 <ASCII bytes> F7`            |
| Host name page close       | `F0 00 20 29 02 15 04 36 7F F7`                          |
| Play LED → idle            | `B0 74 27`                                               |
| Play LED → playing         | `B0 74 21`                                               |
| Record LED → idle          | `B0 76 07`                                               |
| DAW disconnect (shutdown)  | `F0 00 20 29 02 15 02 00 F7`                             |

## LCXL3 → Bridge protocol summary

Everything the bridge consumes in v1:

| LCXL3 control           | Bytes                       | `TransportEvent`           |
|-------------------------|-----------------------------|----------------------------|
| Play/Stop press         | `B0 74 7F`                  | `TogglePlay`               |
| Play/Stop release       | `B0 74 00`                  | (ignored — only press fires the event) |
| Jog wheel forward (continuous rotary, +N) | `BF 5D nn` (nn = 64+delta, e.g. `0x41` = +1, `0x42` = +2) | `NudgeForward(min(delta, 4))` |
| Jog wheel backward (-N)                    | `BF 5D nn` (nn = 64-delta, e.g. `0x3F` = -1, `0x3E` = -2) | `NudgeBackward(min(delta, 4))`|
| Jog wheel at rest                          | `BF 5D 40`                  | (ignored, no movement)        |
| Everything else         | (any other CC)              | (ignored)                  |

Center-at-64 encoding for the jog wheel: the value is `64 + delta`,
where `delta` is signed and represents the change in playhead position
since the last CC. `value > 64` is forward, `value < 64` is backward,
exactly `64` is "no movement". The parser computes `|delta|` and
clamps it to `MAX_NUDGE_PER_PACKET` (= 4) so a fast spin can't queue
a runaway sequence of nudges. Each CC the device emits during a spin
becomes one `NudgeForward(n)` / `NudgeBackward(n)` event.

(An earlier parser version assumed sign-magnitude encoding with the
direction in bit 6 — that turned out to be the wrong model and was
mapped to the wrong CC pair entirely. The Phase 5e hardware probe
captured the actual byte stream and corrected both.)

## Phase 9a — DAW Mixer mode and the full CC byte map

Phase 9 adds DAW Mixer-mode support (faders + V-pots + fader buttons →
LUNA channel volume / pan / mute / solo / arm). Phase 9a captured the
full surface byte map against real hardware on 2026-04-29 — see
`research/lcxl3-mixer-mode-decode.md` for the source decode and
`research/lcxl3-mixer-mode-capture-2026-04-29.txt` for the raw byte
trace (6091 lines).

Earlier in this doc the "What this document deliberately does not
cover" section noted that fader / V-pot bytes were "documented in
Novation's published programmer reference and not currently consumed".
That guess about pitch-bend encoding turned out to be **wrong** —
Phase 9a confirmed faders + V-pots emit on channel 16 (status `BF`)
with 7-bit absolute values, NOT pitch-bend on per-strip channels.

### Mode hierarchy

```
Standalone (MIDI) mode  ← default after power-on; outputs on DIN + USB
DAW mode                ← claimed by sending `02 7F` SysEx (Phase 5 handshake)
  ├── DAW Control mode  ← Phase 5 ships transport + jog (V-pot row 3 col 1
  │                       in relative mode emits BF 5D nn)
  └── DAW Mixer mode    ← Phase 9 target (full mixer surface)
Custom Modes 1-16       ← out of scope
```

### Sub-mode select / report

Channel 7 (status `B6`), CC `0x1E` (30). Bidirectional:

```
B6 1E 01    DAW Mixer
B6 1E 02    DAW Control
B6 1E 06-09 Custom Mode 1-4
B6 1E 12-1D Custom Mode 5-16
```

The bridge sends this to switch the device into the desired sub-mode;
the device emits the same byte when the user toggles via on-device Mode
button.

**Undocumented finding:** every mode change emits a PAIR (~100 µs apart):

```
B6 1E 02    documented mode-report
B6 1F 02    UNDOCUMENTED companion (identical value)
```

`B6 1F vv` is not in Novation's published feature-controls reference
but reliably co-emits with `B6 1E vv` on every mode change. The
parser should treat the pair as a single event keyed off `B6 1E`,
ignoring the `B6 1F` companion.

### The full DAW Mixer CC byte map (canonical, hardware-confirmed)

#### Faders — channel 16 (status `BF`)

| Strip | CC byte | Encoding |
|-------|---------|----------|
| 1-8 | `BF 05-0C nn` | 7-bit absolute, nn = 0..127 |

#### V-pots (encoders) — channel 16 (status `BF`), absolute by default in Mixer mode

| Position | CC byte (absolute) | CC byte (relative, after `B6 45/48/49 7F` toggle) |
|----------|--------------------|-----------------------------------------------------|
| Row 1 col 1-8 | `BF 0D-14 nn` | `BF 4D-54 nn` (centre-at-`40`) |
| Row 2 col 1-8 | `BF 15-1C nn` | `BF 55-5C nn` |
| Row 3 col 1-8 | `BF 1D-24 nn` | `BF 5D-64 nn` ← Phase 5's "jog wheel" is row 3 col 1 in relative mode |

**Mode discrimination matters for parsing:** the same physical row 3
col 1 V-pot emits `BF 5D nn` (relative, Phase 5 jog) in DAW Control
mode and `BF 1D nn` (absolute) in DAW Mixer mode. The parser must
key off the active sub-mode, not the CC byte alone.

#### Fader buttons — channel 1 (status `B0`), press `7F` / release `00`

| Strip | Top row (Solo/Arm) | Bottom row (Mute/Select) |
|-------|--------------------|--------------------------|
| 1-8 | `B0 25-2C 7F`/`00` | `B0 2D-34 7F`/`00` |

#### Side-panel buttons — channel 1 (`B0`) and channel 7 (`B6`)

| Button | Byte | Notes |
|--------|------|-------|
| Page Up | `B0 6A 7F`/`00` | upper of "Page" pair |
| Page Down | `B0 6B 7F`/`00` | lower of "Page" pair |
| Track Right | `B0 66 7F`/`00` | mixer-bank-next analogue |
| Track Left | `B0 67 7F`/`00` | mixer-bank-prev analogue |
| Record | `B0 76 7F`/`00` | LED-set via `B0 76 <colour>` |
| Play | `B0 74 7F`/`00` | LED-set via `B0 74 <colour>` |
| Shift | `B6 3F 7F`/`00` | channel 7 (feature-control linked) |
| Solo / Arm row toggle | `B0 41 7F`/`00` | host-managed sub-state |
| Mute / Select row toggle | `B0 42 7F`/`00` | host-managed sub-state |
| Small unlabelled (left of fader 1) | `B0 68 7F`/`00` | function unclear |

The Solo/Arm and Mute/Select toggles emit MIDI press/release but **do
not separately report which sub-mode** (Solo vs Arm; Mute vs Select)
the device is currently in. The host tracks this state itself.

The on-device "Mode" button has no discrete CC of its own — pressing
it triggers the device's mode-change report (`B6 1E + B6 1F` pair).

### Initial LED state after handshake + DAW Mixer mode-select

After the Phase 5 activation handshake plus a `B6 1E 01` mode-select,
the device's LED state is:

- **Lit:** Record button (Phase 5 preset `B0 76 07`), Play button
  (`B0 74 27`), Shift + Mode (device-managed)
- **Dark:** all 24 V-pots, all 16 fader buttons, all 4 page/track
  side buttons, the 3 left-side toggles (Solo/Arm, Mute/Select, small)

Phase 9b will need to push initial LED colours for any control it
wants illuminated. Reference for V-pot LED rings (12-LED rings around
each encoder) needs further capture — Phase 9a only exercised input,
not output.

### Open questions for Phase 9a continued (LUNA-side)

Independent of the LCXL3 capture above:

- LUNA's MCU mixer vocabulary: what bytes drive volume / pan /
  mute / solo / arm / select / bank-nav?
- LUNA's plugin-parameter vocabulary: focused-plugin section, HUI
  extension, or UA-specific?
- V-pot LED ring control protocol on the LCXL3 (output direction,
  not yet captured).

These are addressed in a separate hands-on session against LUNA + the
bridge's `--send-mcu` discovery mode.

## What this document deliberately does not cover

- **Custom Modes 1-16** — out of scope for Phase 5 and Phase 9.
- **Pad RGB lighting** — out of scope for Phase 9 (mixer surface
  doesn't include the pads). Future work if pad mappings are added.
- **Touch events on faders** — supported via `B6 47 7F` enable, then
  fader touches emit on channel 15 (`BE`). Phase 9 doesn't enable
  by default; could be added if LUNA's fader-pickup behaviour needs it.
- **Per-strip / per-V-pot LCD page metadata** (the `0x05-0x24` block
  of display targets). Phase 5 only uses page `0x36` for the host name.
  Phase 9b might add per-strip channel-name display as a polish item.
