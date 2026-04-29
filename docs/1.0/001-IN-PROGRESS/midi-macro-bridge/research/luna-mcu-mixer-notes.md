# LUNA MCU vocabulary — mixer + plugin profiling

Captured 2026-04-29 against UAD LUNA via the bridge's `--probe-mcu-interactive` mode. Probe sequence sent through the bridge's stdin while the bridge's virtual `MIDI Macro Bridge` MCU surface was bound as an active control surface in LUNA's preferences.

Raw probe log: `research/luna-mcu-probe-2026-04-29.txt`
Probe commands sent: `research/luna-mcu-probe-commands-2026-04-29.txt`

## Confirmed byte vocabulary

### Volume — pitch-bend per channel + fader-touch protocol

```
90 (0x67+N) 7F   touch-on for channel N (note 0x68 = ch1, 0x69 = ch2, ...)
EN-1 lo hi       pitch-bend value (14-bit, lo+hi<<7)
90 (0x67+N) 00   touch-off
```

Channel index is on the pitch-bend status byte: `E0` = ch 1, `E1` = ch 2, ..., `E7` = ch 8.

**Critical:** without the touch-on context, LUNA silently discards pitch-bend values. We confirmed this by:
- Sending `E0 7F 7F` alone → no response from LUNA, no fader move
- Sending `90 68 7F` + `E0 7F 7F` + `90 68 00` → echoed back `E0 6F 7F` (14-bit value 0x3FEF — max), fader visibly jumped to +12 dB on UAD MINI

LUNA echoes the resulting fader position as a pitch-bend on the same channel. Useful for the bridge to know what value LUNA actually applied (versus what we asked for — they may differ if LUNA clamps or has automation overrides).

LUNA also pushes a fader-display SysEx (parameter name + dB value) during the move; details below.

### Pan — relative CC per channel, sign-magnitude encoding

```
B0 (0x0F+N) vv
```

Channel index: CC `0x10` = ch 1, `0x11` = ch 2, ..., `0x17` = ch 8.

`vv` encoding (sign-magnitude, MCU standard):
- Bit 6 (`0x40`) clear: clockwise / right
- Bit 6 set: counter-clockwise / left
- Bits 0-5 (`0x3F` mask): magnitude

Examples:
- `B0 10 01` → +1R (one click clockwise)
- `B0 10 41` → -1L (one click counter-clockwise; `0x41` = bit 6 set + magnitude 1)

LUNA pushes a parameter-display SysEx (`Pan` name + `Nx` left/right value) during the move.

### Mute — note per channel (toggle)

```
90 (0x0F+N) 7F   press
90 (0x0F+N) 00   release
```

Channel index: note `0x10` = ch 1, ..., `0x17` = ch 8. **Toggle on press** — each press flips state. LUNA echoes back the new state (`90 10 7F` = mute on for ch 1; `90 10 00` = mute off).

### Solo — note per channel (toggle)

```
90 (0x07+N) 7F   press
90 (0x07+N) 00   release
```

Note `0x08` = ch 1, ..., `0x0F` = ch 8. Toggle on press. LUNA also echoes a global "Solo active" indicator at note `0x5A` whenever any channel is solo'd.

### Record arm — note per channel (toggle)

```
90 (N-1) 7F   press
90 (N-1) 00   release
```

Note `0x00` = ch 1, ..., `0x07` = ch 8. Toggle on press.

### Channel select — note per channel (transient)

```
90 (0x17+N) 7F   press
90 (0x17+N) 00   release
```

Note `0x18` = ch 1, ..., `0x1F` = ch 8. **Status uncertain:** LUNA echoes back the press/release but the visual "selected" border in LUNA's mixer didn't move from STRIPE to UAD MINI when we sent `90 18 7F`. Possibly LUNA distinguishes between "MCU-focused channel" (which our note may have set internally) and the DAW UI's selected-channel-indicator (which appears stuck on STRIPE).

When a channel is selected, LUNA also pushes the channel's automation-mode state via note `0x4A` ("Read" indicator). E.g. selecting an auto=READ channel echoes `90 18 7F` + `90 4A 7F`. Useful for the bridge to mirror automation mode to the LCXL3.

### Bank navigation — notes 0x2E / 0x2F

```
90 2E 7F   bank prev (press), 90 2E 00 (release)
90 2F 7F   bank next
```

Confirmed by visible strip-name shift via SysEx push-back. Apparent shift size in LUNA was ~5-9 strips (not strict +/-8). The bridge doesn't need to track absolute position — just send the byte; LUNA pushes the new strip-name SysEx after each shift.

LUNA also emits the directional state via notes `0x30`/`0x31` (probably "channel-prev/next available" LED state). E.g. after a bank-next we see `90 2E 7F` + `90 30 7F` echoed.

## Plugin / Sends / Cue / EQ mode buttons (channel 1)

Each press toggles the surface into a "mode" where the V-Pots become parameter selectors and the per-strip LCDs show parameter names + values. Pressing a different mode button switches between modes (and the previous mode's note echoes its OFF state).

| Button | Note | Mode entered |
|--------|------|--------------|
| Send | `90 29` | "Pick a Send to assign to VPots" → `Send 1`-`Send 8` selectable on V-Pots; bottom row shows current send state per strip; `Pg 1/5` paginated across 5 pages |
| Pan/Surround | `90 2A` | refreshed strip names; effect not fully clear |
| Plug-In | `90 2B` | "Pick a plugin type" → `Tape \| Consol \| Insrts` selectable on V-Pots 1-3; subsequent V-Pot navigation drills into plugin instances and parameters |
| Cue / EQ | `90 2C` | "Cue to assign to VPots" → `No Cue` per strip, `Pg 1/3` paginated |
| Track | `90 2D` | partial response (offset-0x31 SysEx); function unclear, possibly not implemented |

The mode-switch pattern: bridge sends `90 2B 7F` + `90 2B 00` (toggle); LUNA echoes `90 2B 7F` + `90 (previous_mode) 00` (turning off the last mode), clears the V-Pot LED rings (`B0 30-37 00`), and pushes a new strip-name SysEx with the mode's prompt + options.

This means **Phase 9c can implement plugin control** — the LCXL3's V-Pots in DAW Mixer mode become plugin parameter selectors when the bridge sends `90 2B 7F` to LUNA. The bridge then forwards V-Pot CC ticks (relative-encoded) and LUNA navigates/adjusts the plugin parameters.

## SysEx push-back from LUNA

LUNA pushes display updates to the surface as it changes state. Two SysEx forms appear:

### Strip-name display (`F0 00 00 66 14 12 <offset> <ascii> F7`)

The full LCD display buffer is 112 ASCII characters: 8 strips × 14 chars (7-char top row + 7-char bottom row, but actually the data layout is [56 chars top row][56 chars bottom row] with 7 chars per strip).

Examples:
- After bank next to TRACK6-13 view:
  ```
  F0 00 00 66 14 12 00 [ASCII for: TRACK6 TRACK7 TRACK8 TRACK9 TRCK10 TRCK11 TRCK12 TRCK13]
                       [ASCII for: C    C    C    C    C    C    C    C       ]
  F7
  ```
  Top row = strip names. Bottom row = pan position (`C` = centre, `Nx` = position).

- After a fader move (volume display):
  ```
  F0 00 00 66 14 12 00 [Gain   KICK   STRIPE MAIN  ...]
                       [+12.0  ...]
  F7
  ```
  Top row strip 1 changes from track name "UADMIN" to parameter name "Gain"; bottom row strip 1 shows "+12.0" (the dB value). After a short timeout (~500ms? not measured) LUNA reverts to strip names.

- After plugin-mode entry:
  ```
  Pick   a      plugin type
  Tape   Consol Insrts
  ```
  Top row = prompt, bottom row = selectable options on V-Pots 1-3.

The `<offset>` byte after `12` is the start position in the 112-char buffer (e.g. `0x0E` to update only the second strip onwards).

### V-Pot LED ring state (`B0 30-37 vv`)

CC `0x30`-`0x37` on channel 1 control the V-Pot LED rings for strips 1-8. Value encodes the ring pattern (which LEDs light, in which mode — single-dot, fill-from-centre, fill-from-left, etc.). MCU standard format: bits 6-7 = mode, bits 0-5 = position.

LUNA pushes these whenever V-Pot state changes (mode-switch clears all rings; pan changes update the affected strip's ring; etc.).

### Heartbeat / identity SysEx (`F0 00 00 66 1X 00 F7`)

LUNA periodically probes the surface with these heartbeat queries (Phase 3 already documented). The bridge replies with `F0 00 00 66 14 02 <serial> <version> F7` to keep the surface alive.

## Implications for Phase 9b stages 5-7

### Stage 5 — MCU translation (the `MixerBackend::emit_mixer` impl)

For each `MixerAction` variant the bridge currently logs as a stub:

| MixerAction | MCU bytes |
|-------------|-----------|
| `Volume { channel, value14 }` | `90 (0x67+ch+1) 7F` + `EN-1 lo hi` + `90 (0x67+ch+1) 00` (with channel = 0..7, ch_byte = 0x68..0x6F) |
| `Pan { channel, delta }` | `B0 (0x10+channel) vv` where `vv` = `delta as u8` (positive) or `0x40 + (-delta) as u8` (negative) |
| `Mute { channel }` | `90 (0x10+channel) 7F` then `90 (0x10+channel) 00` |
| `Solo { channel }` | `90 (0x08+channel) 7F` then `00` |
| `Arm { channel }` | `90 (0x00+channel) 7F` then `00` |
| `Select { channel }` | `90 (0x18+channel) 7F` then `00` |
| `BankPrev` | `90 2E 7F` then `00` |
| `BankNext` | `90 2F 7F` then `00` |

Channel index in `MixerAction` is bank-relative 0..7. Bridge handles bank state internally; LUNA's strip view follows along.

### Stage 6 — LED feedback

LUNA pushes button state via note echoes (mute, solo, arm). Bridge should:
1. Track LUNA's view of mute/solo/arm/select state per current-bank channel
2. Mirror state to LCXL3's fader-button LEDs (`B0 (button_cc) (colour)`)

Colours (per LCXL3 colour palette in `research/lcxl3-color-palette-hex.png`):
- Mute on: amber/red
- Solo on: green/yellow
- Arm on: red
- All off: dim

Bridge also parses LUNA's fader-display SysEx to update the LCXL3's per-strip LCD:
- During fader/pan move: show parameter name + value on the affected strip's LCD
- After timeout: revert to strip name

### Stage 7 — banking

Bridge maintains a single `current_bank_offset` integer. On `BankPrev`/`BankNext` action, send the corresponding `90 2E`/`2F` to LUNA; LUNA pushes back new strip names; bridge updates LCXL3 LCDs with the new strip names. No bridge-side per-strip remapping — LUNA does that.

## Open issues to keep documented

- **Channel select doesn't visually highlight the selected strip.** Note `0x18` echoes back (LUNA accepts the input) but LUNA's mixer UI continues to show the previously-selected channel (STRIPE) with the blue border, even after we sent `90 18 7F` for channel 1. The MCU "focused channel" concept may differ from LUNA's "DAW-UI-selected" concept. Phase 9b can still send select on V-Pot-button presses; LUNA's internal state likely tracks it for plugin parameter focus etc.
- **Bank shift size variable.** LUNA's `90 2F` shift wasn't strictly +8. Phase 9b doesn't depend on knowing the exact shift; it forwards the byte and relies on LUNA's strip-name SysEx push-back.
- **MAIN bus excluded from MCU strip view.** LUNA's master/main bus is not exposed as a strip in the MCU surface. Phase 9b's banking will navigate audio tracks only.
- **Unsynced echoes during rapid probes.** Some echoes arrived in different order than expected (e.g. select-release echo arriving after a subsequent bank-prev press). The bridge's bank-aware state machine should be tolerant of out-of-order LUNA echoes.

## What's NOT yet captured

- **Plugin parameter editing flow** — we entered "Pick a plugin type" mode but didn't drill in. Phase 9c will need a follow-up session to navigate: pick "Insrts" → pick a track → pick a plugin instance → V-Pots become 8 plugin parameters. Each of those steps needs profiling.
- **Sends parameter editing** — same: we saw the "Pick a Send" menu but didn't drill in.
- **LCXL3 V-Pot LED ring control** — output protocol from bridge to LCXL3 to drive the 12-LED ring on each V-Pot. Probably a SysEx command. Out-of-scope for this session; deferred to Phase 9b stage 6 implementation work.
- **Touch-events from LCXL3 → LUNA** — Phase 9b stage 5 needs to either enable LCXL3 touch events (`B6 47 7F`) OR synthesize touch-on/off in the bridge around fader CC events. Both work; capture wasn't run in this session.
