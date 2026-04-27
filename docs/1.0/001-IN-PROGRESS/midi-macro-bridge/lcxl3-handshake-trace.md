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

## What this document deliberately does not cover

- **Page-metadata SysEx for the strips and knobs.** Phase 5 doesn't use
  these. If a future phase maps V-pots to LUNA parameters, document the
  per-strip page IDs (`0x05–0x24` block, four banks of eight) here.
- **Fader / V-pot bytes.** Faders emit pitch-bend messages on channels
  1–8 (one fader per channel); V-pots emit relative CCs on channels
  1–8. Documented in Novation's published programmer reference and not
  currently consumed.
- **Pad RGB lighting.** The pads support per-pad RGB via SysEx (cmd
  `0x09`-ish). Not used in v1.
