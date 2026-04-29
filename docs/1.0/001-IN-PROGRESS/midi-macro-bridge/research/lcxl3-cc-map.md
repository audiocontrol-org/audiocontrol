# Launch Control XL 3 — DAW Mode CC index map

Decoded from the canonical reference image at
`research/lcxl3-cc-map-hex.png` (downloaded from Novation's
programmer's reference, "Launch Control XL 3 programmer's DAW mode"
article).

All bytes shown are hex. In DAW mode all controls emit on either:
- Channel 1 (status `B0`) for buttons, except the Shift button
- Channel 7 (status `B6`) for Shift and feature controls
- Channel 16 (status `BF`) for encoders and faders

The same CC index doubles as the LED address for that control —
sending `B0 <index> <colour>` colours its LED (per the colour palette
in `lcxl3-color-palette-hex.png`).

## Encoders (V-pots) — channel 16, status `BF` in absolute mode

The LCXL3 has 24 encoders arranged in 3 rows of 8. In default (absolute)
mode they emit 7-bit position values directly. In relative mode (per row)
the CC index shifts by `+0x40` and value is centre-at-`0x40`.

| Position    | Absolute CC | Relative CC |
|-------------|-------------|-------------|
| Row 1, col 1 | `0D` (13)  | `4D` (77)   |
| Row 1, col 2 | `0E` (14)  | `4E` (78)   |
| Row 1, col 3 | `0F` (15)  | `4F` (79)   |
| Row 1, col 4 | `10` (16)  | `50` (80)   |
| Row 1, col 5 | `11` (17)  | `51` (81)   |
| Row 1, col 6 | `12` (18)  | `52` (82)   |
| Row 1, col 7 | `13` (19)  | `53` (83)   |
| Row 1, col 8 | `14` (20)  | `54` (84)   |
| Row 2, col 1 | `15` (21)  | `55` (85)   |
| Row 2, col 2 | `16` (22)  | `56` (86)   |
| Row 2, col 3 | `17` (23)  | `57` (87)   |
| Row 2, col 4 | `18` (24)  | `58` (88)   |
| Row 2, col 5 | `19` (25)  | `59` (89)   |
| Row 2, col 6 | `1A` (26)  | `5A` (90)   |
| Row 2, col 7 | `1B` (27)  | `5B` (91)   |
| Row 2, col 8 | `1C` (28)  | `5C` (92)   |
| Row 3, col 1 | `1D` (29)  | `5D` (93)   |
| Row 3, col 2 | `1E` (30)  | `5E` (94)   |
| Row 3, col 3 | `1F` (31)  | `5F` (95)   |
| Row 3, col 4 | `20` (32)  | `60` (96)   |
| Row 3, col 5 | `21` (33)  | `61` (97)   |
| Row 3, col 6 | `22` (34)  | `62` (98)   |
| Row 3, col 7 | `23` (35)  | `63` (99)   |
| Row 3, col 8 | `24` (36)  | `64` (100)  |

**Phase 5 jog wheel insight:** the bytes Phase 5 calls "the jog wheel"
(`BF 5D nn` with centre-at-64) are **Row 3 Encoder 1 in relative mode**.
The bridge is currently driving that one encoder as a transport jog.
In Mixer mode that same encoder either stays in relative mode for
something else (likely pan for channel 1) or switches to absolute mode
emitting `BF 1D nn` — needs hardware capture to confirm.

To switch row N to relative mode (host → device):

```
B6 45 7F   row 1 relative on
B6 48 7F   row 2 relative on
B6 49 7F   row 3 relative on
```

Replace `7F` with `00` to disable.

## Faders — channel 16, status `BF`

| Position | CC index   |
|----------|------------|
| Fader 1  | `05` (5)   |
| Fader 2  | `06` (6)   |
| Fader 3  | `07` (7)   |
| Fader 4  | `08` (8)   |
| Fader 5  | `09` (9)   |
| Fader 6  | `0A` (10)  |
| Fader 7  | `0B` (11)  |
| Fader 8  | `0C` (12)  |

7-bit motorless fader, 0 (bottom) to 127 (top). Touch on/off is a
separate event — see DAW mode article.

## Fader buttons — channel 1, status `B0`

The LCXL3 has two rows of 8 small buttons below the faders. The
device-printed labels are "Solo / Arm" (top row) and "Mute / Select"
(bottom row), with the function dependent on a left-hand mode toggle.

| Position | Top row (Solo/Arm)  | Bottom row (Mute/Select) |
|----------|---------------------|--------------------------|
| Strip 1  | `25` (37)           | `2D` (45)                |
| Strip 2  | `26` (38)           | `2E` (46)                |
| Strip 3  | `27` (39)           | `2F` (47)                |
| Strip 4  | `28` (40)           | `30` (48)                |
| Strip 5  | `29` (41)           | `31` (49)                |
| Strip 6  | `2A` (42)           | `32` (50)                |
| Strip 7  | `2B` (43)           | `33` (51)                |
| Strip 8  | `2C` (44)           | `34` (52)                |

## Side buttons (left-hand panel) — channel 1, status `B0`

Top to bottom on the left-hand strip:

| Button         | CC index    | Notes |
|----------------|-------------|-------|
| Page Up        | `6A` (106)  | upper of "Page" pair |
| Page Down      | `6B` (107)  | lower of "Page" pair |
| Track Right    | `66` (102)  | Mixer-mode bank-next analogue |
| Track Left     | `67` (103)  | Mixer-mode bank-prev analogue. Doubles as "Settings" combo |
| Record (●)     | `76` (118)  | Phase 5 sets `B0 76 07` for idle LED |
| Play (▶)       | `74` (116)  | Phase 5 uses for Play/Stop toggle (`B0 74 7F` press, `B0 74 21` LED green/playing, `B0 74 27` LED idle) |
| Shift / Mode   | `3F` (63)   | Channel 7 (status `B6`), not channel 1 — feature-control linked |
| Solo / Arm     | `41` (65)   | Mode toggle for fader-button top row |
| Mute / Select  | `42` (66)   | Mode toggle for fader-button bottom row |
| (small button left of fader 1, between fader area and side strip) | `68` (104) | Function unclear from reference image — possibly "Note" or "scene" toggle. Hardware capture needed. |
| (button below Shift, no MIDI) | `n/a` | "n/a" labelled in the reference image |

## Feature controls — channel 7, status `B6`

These are controls the device responds to AND reports its state on.
All are listening in DAW mode; only a few echo confirmations.

| CC | Hex | Feature | Values |
|----|-----|---------|--------|
| 30 | `1E` | **Surface mode select / report** | `01`=DAW Mixer, `02`=DAW Control, `06-09`=Custom 1-4, `12-1D`=Custom 5-16 |
| 63 | `3F` | Shift on/off | `7F`/`00` |
| 69 | `45` | Encoder Row 1 relative-mode toggle | `7F`/`00` |
| 70 | `46` | Fader Pickup | `7F`/`00` |
| 71 | `47` | Touch events on/off | `7F`/`00` |
| 72 | `48` | Encoder Row 2 relative-mode toggle | `7F`/`00` |
| 73 | `49` | Encoder Row 3 relative-mode toggle | `7F`/`00` |
| 100 | `64` | Global MIDI channel (persisted) | `00-0E` (channels 1-15) |
| 111 | `6F` | LED brightness (persisted) | `00-7F` |
| 112 | `70` | Screen brightness (persisted) | `00-7F` |
| 113 | `71` | Temporary display timeout (persisted) | `00-63` (1/10s units, min 1s at 0) |
| 120 | `78` | Out2 MIDI Thru (persisted) | `7F`/`00` |

Querying any of the above CCs is done by sending the same CC on
channel 8 (status `B7`). Replies always come back on channel 7.

## DAW mode enable / disable

Either form works:

```
9F 0C 7F                        Enable DAW Mode (note form)
F0 00 20 29 02 15 02 7F F7      Enable DAW Mode (SysEx — Phase 5 uses this)

9F 0C 00                        Disable DAW Mode (note form)
F0 00 20 29 02 15 02 00 F7      Disable DAW Mode (SysEx — Phase 5 uses this)
```

## Continuous control touch (faders)

Enabled via feature control `B6 47 7F`. When enabled, fader touch is on
**channel 15, status `BE`**:

```
BE <fader_cc> 7F   touch on
BE <fader_cc> 00   touch off
```

## SysEx framing

All Novation SysEx for LCXL3 share the prefix:

```
F0 00 20 29 02 15 <cmd> [<payload>...] F7
```

Common commands:

| Cmd | Form | Meaning |
|-----|------|---------|
| `01 53` | RGB colour: `01 53 <ctrl> <R> <G> <B>` | Custom RGB colour for any LED |
| `02` | DAW state: `02 <00|7F>` | DAW disconnect / claim |
| `04` | Configure display: `04 <target> <config>` | Set up a display target |
| `06` | Set text: `06 <target> <field> <ascii>` | Fill text in a configured display |
| `09` | Bitmap: `09 <target> <1216 bytes>` | Custom 128×64 bitmap |

Display targets:

| Target | Purpose |
|--------|---------|
| `05`-`0C` (5-12) | Per-fader temporary display |
| `0D`-`24` (13-36) | Per-encoder temporary display |
| `35` (53) | Permanent / stationary display |
| `36` (54) | Overlay / temporary display |

Phase 5 uses `04 36 62` / `06 36 01 <ascii>` / `04 36 7F` to write
"Bridge" to the overlay display during the activation handshake.

## Open questions for hardware capture (Phase 9a continued)

1. **Does the device emit `B6 1E 01` automatically when the user
   presses an on-device "Mixer" button, or does the bridge have to
   poll/probe to detect mode?** The reference says mode changes are
   "reported back by the Launch Control XL 3 whenever it changes mode
   due to user activity" — so spontaneous emission is expected.

2. **Are encoder rows in absolute mode by default in DAW Mixer mode,
   or does the device pre-set them to relative for Mixer use?** Phase
   5 saw row 3 encoder 1 in relative mode (`BF 5D nn`) — was that
   because the device defaults that way in DAW Control mode, or
   because Live's handshake set it? Need to capture a fresh DAW Mode
   entry without any prior session and inspect the encoder bytes.

3. **What happens to the jog encoder (Row 3 encoder 1) in Mixer mode?**
   Does it switch to absolute mode (`BF 1D nn` raw position) and become
   the channel 1 V-pot? Or stay in relative mode and serve some
   Mixer-specific role?

4. **Does the LCXL3 push back fader / button state changes from a
   "DAW push"?** The reference says "If the DAW sends them position
   information, [encoders] automatically pick that up" — so DAW-side
   push is supported. But for faders (motorless) and fader buttons
   (state LEDs), the bridge will push state via CC LED-colour messages
   on channel 1.
