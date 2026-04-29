# LCXL3 DAW Mixer mode — decoded byte map

Captured 2026-04-29 against a real LCXL3 connected via USB. Bridge run
in `--lcxl3-activate LCXL3 --lcxl3-mode 01` mode; full byte trace at
`research/lcxl3-mixer-mode-capture-2026-04-29.log` (6091 lines).

This decode confirms the canonical byte map (from
`research/lcxl3-cc-map.md`) holds in DAW Mixer mode AND surfaces several
previously-unknown facts.

## Confirmed bytes — every documented control matches the canonical map

### Faders — channel 16 (`BF`)

| Fader | CC byte | Encoding |
|-------|---------|----------|
| 1 | `BF 05 vv` | 7-bit absolute, vv = 0..127 |
| 2 | `BF 06 vv` | 7-bit absolute |
| 3 | `BF 07 vv` | 7-bit absolute |
| 4 | `BF 08 vv` | 7-bit absolute |
| 5 | `BF 09 vv` | 7-bit absolute |
| 6 | `BF 0A vv` | 7-bit absolute |
| 7 | `BF 0B vv` | 7-bit absolute |
| 8 | `BF 0C vv` | 7-bit absolute |

Smooth sweeps from 0 to 127 captured; values monotonic per direction
of throw. No mid-stream gaps or unexpected bytes.

### V-pots (encoders) — channel 16 (`BF`), absolute mode by default

In **DAW Mixer mode the V-pots default to absolute mode**, not relative.
This is a key Phase 9b finding: the same physical V-pot row 3 col 1 that
emits `BF 5D nn` (relative, center-at-64) in DAW Control mode emits
`BF 1D nn` (absolute 7-bit) in DAW Mixer mode. The bridge parser must
key off the active sub-mode, not the CC byte alone.

| V-pot position | CC byte | Encoding |
|----------------|---------|----------|
| Row 1 col 1-8  | `BF 0D` to `BF 14` | 7-bit absolute |
| Row 2 col 1-8  | `BF 15` to `BF 1C` | 7-bit absolute |
| Row 3 col 1-8  | `BF 1D` to `BF 24` | 7-bit absolute |

### Fader buttons — channel 1 (`B0`)

| Strip | Top row (Solo/Arm) | Bottom row (Mute/Select) |
|-------|--------------------|--------------------------|
| 1 | `B0 25 7F`/`00` | `B0 2D 7F`/`00` |
| 2 | `B0 26 7F`/`00` | `B0 2E 7F`/`00` |
| 3 | `B0 27 7F`/`00` | `B0 2F 7F`/`00` |
| 4 | `B0 28 7F`/`00` | `B0 30 7F`/`00` |
| 5 | `B0 29 7F`/`00` | `B0 31 7F`/`00` |
| 6 | `B0 2A 7F`/`00` | `B0 32 7F`/`00` |
| 7 | `B0 2B 7F`/`00` | `B0 33 7F`/`00` |
| 8 | `B0 2C 7F`/`00` | `B0 34 7F`/`00` |

Press = `7F`, release = `00`. Standard CC button encoding.

### Side-panel buttons — channel 1 (`B0`) and channel 7 (`B6`)

| Button | CC byte | Notes |
|--------|---------|-------|
| Page Up | `B0 6A 7F`/`00` | upper of "Page" pair |
| Page Down | `B0 6B 7F`/`00` | lower of "Page" pair |
| Track Right | `B0 66 7F`/`00` | mixer-bank-next analogue |
| Track Left | `B0 67 7F`/`00` | mixer-bank-prev analogue |
| Record | `B0 76 7F`/`00` | LED-set via `B0 76 <colour>` |
| Play | `B0 74 7F`/`00` | LED-set via `B0 74 <colour>` |
| Shift | `B6 3F 7F`/`00` | channel 7 (feature-control linked) |
| Solo / Arm toggle | `B0 41 7F`/`00` | host-managed; no separate state report |
| Mute / Select toggle | `B0 42 7F`/`00` | host-managed; no separate state report |
| Small button (left of fader 1) | `B0 68 7F`/`00` | function unclear — possibly "Note" or "scene" |

The Solo/Arm and Mute/Select toggles emit MIDI press/release but **do
not appear to have a separate state byte** that reports which sub-mode
(Solo vs Arm; Mute vs Select) the device is currently in. The host is
expected to track the toggle state itself and adjust how it interprets
the corresponding fader-button row.

## **NEW FINDING — undocumented `B6 1F vv` mode-report companion**

The user toggled the on-device Mode button. Each toggle emits a PAIR of
CCs in the same MIDI packet (~100 µs apart):

```
796017999us  CC  B6 1E 02     ← documented mode-report (DAW Control = 02)
796018093us  CC  B6 1F 02     ← UNDOCUMENTED, matches B6 1E value
```

The `B6 1F` byte is **not in Novation's published feature-controls list**
(`research/lcxl3-novation-daw-mode.md` — confirmed neither in the
DAW-mode article nor in the feature-Controls article). It pairs with
`B6 1E` on every mode change, with the same `vv` value. Across four
captured mode changes, `B6 1F` and `B6 1E` were always co-emitted with
identical values.

**Hypothesis:** `B6 1F` is a redundant / paired report — possibly a
"previous mode" or "ack" byte emitted by some firmware versions. The
bridge parser should treat the pair as a single mode-change event,
keying off `B6 1E vv` (documented) and ignoring `B6 1F vv` (undocumented
companion).

The on-device "Mode" button itself doesn't have its own discrete CC —
pressing it triggers the mode change and the device reports the new
mode via the `B6 1E + B6 1F` pair.

## **NEW FINDING — initial LED state after activation**

After `lcxl3::handshake_send` runs (which sends Phase 5's LED preset
bytes `B0 76 07` Record idle, `B0 74 27` Play idle) AND the
`B6 1E 01` mode-select for DAW Mixer, the device's LED state is:

- Record button: **lit** (Phase 5 preset colour `0x07`)
- Play button: **lit** (Phase 5 preset colour `0x27`)
- Shift button: device-managed
- Mode button: device-managed
- **Everything else dark** (V-pots, faders' top labels, all 16 fader
  buttons, all four side-panel page/track buttons, Solo/Arm + Mute/Select
  toggles, the small `0x68` button)

No automatic "Mixer mode default illumination" — the bridge will need
to push initial LED colours for any control it wants lit. Phase 9b
deliverable: send `B0 <ctrl> <colour>` for the 16 fader buttons (with
appropriate Solo/Mute/Arm-state colours) and the 4 page/track buttons
(maybe a dim "available" colour).

## **NEW FINDING — V-pot LED rings**

The LCXL3's V-pots have 12-LED rings around each encoder for visual
position feedback. **The capture did not exercise V-pot LED rings**
because the bridge wasn't pushing any V-pot LED bytes. This is a
deliberate gap: Phase 9a's scope was input capture, not output
exploration. Phase 9b will need to discover the LED-ring control
protocol — likely a separate SysEx that addresses each V-pot ring with
a 12-bit pattern, OR a CC-style command with pattern bits packed into
a 7-bit value. Cross-reference Novation's "Colouring the surface" SysEx
and the `01 53 <ctrl> <R> <G> <B>` RGB mode mentioned in the DAW mode
article.

## Open questions surfaced by this capture

1. **Touch events** — the user did not enable touch events
   (`B6 47 7F`). Phase 9b can opt in if useful (would let LUNA know
   when the user is actively grabbing a fader, useful for fader pickup).
2. **V-pot LED ring protocol** — needs Phase 9b output exploration.
3. **The "small button" `0x68` purpose** — emits MIDI but its function
   in Mixer mode (vs Custom modes) is unclear. Could be a "Note" toggle
   for pad-style entry. Defer.
4. **DAW Control mode capture** — we have a mode-change to DAW Control
   mid-capture (`B6 1E 02`) but the user didn't exercise the controls
   while in that mode. Phase 5 covers DAW Control mode for transport
   buttons + jog wheel; the V-pot bytes in DAW Control mode are
   covered by the existing `lcxl3-handshake-trace.md`. No additional
   capture needed for DAW Control.
5. **LUNA MCU mixer vocabulary** — separate Phase 9a hardware step,
   not addressed in this capture. Needs LUNA running + `--send-mcu`
   probing to discover what bytes drive volume / pan / mute / solo / arm.

## Summary — what Phase 9b's parser needs to handle

For DAW Mixer mode input:

```
BF 05-0C nn       Faders 1-8 (7-bit absolute)
BF 0D-14 nn       V-pots row 1 (7-bit absolute by default)
BF 15-1C nn       V-pots row 2 (7-bit absolute)
BF 1D-24 nn       V-pots row 3 (7-bit absolute)
B0 25-2C 7F/00    Top fader buttons press/release
B0 2D-34 7F/00    Bottom fader buttons press/release
B0 6A 7F/00       Page Up
B0 6B 7F/00       Page Down
B0 66 7F/00       Track Right
B0 67 7F/00       Track Left
B0 76 7F/00       Record
B0 74 7F/00       Play
B6 3F 7F/00       Shift
B0 41 7F/00       Solo/Arm row toggle
B0 42 7F/00       Mute/Select row toggle
B0 68 7F/00       Small button (function unclear)
B6 1E vv          Mode change: 01=Mixer, 02=Control, 06-09/12-1D Custom
B6 1F vv          Mode change companion (undocumented, ignore)
```

For DAW Mixer mode output (LED feedback + V-pot ring):

```
B0 <ctrl> <col>   Set LED colour on any control with a single LED
F0 00 20 29 02 15 01 53 <ctrl> <R> <G> <B> F7    RGB custom colour
... V-pot LED ring protocol (Phase 9b output exploration)
```

Phase 9b can implement against this byte map without further LCXL3
profiling. The remaining Phase 9a work is LUNA-side MCU profiling
(separate hardware-collaborative session).
