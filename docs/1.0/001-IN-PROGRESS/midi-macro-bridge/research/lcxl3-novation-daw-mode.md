# Novation Launch Control XL 3 — programmer's DAW mode (extract)

Source: https://userguides.novationmusic.com/hc/en-gb/articles/27840466544402-Launch-Control-XL-3-programmer-s-DAW-mode
Captured 2026-04-29 via Playwright (WebFetch returns 403 on this domain).

## Mode hierarchy

- **Standalone (MIDI) mode** — default; outputs on DIN + USB
- **DAW mode** — host-claimed; outputs on USB only. The umbrella mode.
  - **DAW Control Mode** — what Phase 5 ships (transport buttons, jog wheel)
  - **DAW Mixer Mode** — Phase 9 target (faders + V-pots + fader buttons as channel strips)
  - **Custom Modes 1-16** — out of scope

## DAW mode enable / disable

Two equivalent forms each — both supported by the device:

| Action | Note form | SysEx form |
|--------|-----------|------------|
| Enable DAW Mode | `9F 0C 7F` | `F0 00 20 29 02 15 02 7F F7` |
| Disable DAW Mode | `9F 0C 00` | `F0 00 20 29 02 15 02 00 F7` |

The SysEx forms are what Phase 5's `lcxl3::handshake_send` and `lcxl3::deactivate_send` use today. Confirmed correct.

## Mode select + report — **the Phase 9 key finding**

Mode is changed (host → device) AND reported (device → host) via the same MIDI event:

```
Channel 7 (status: B6h, 182), Control Change 1Eh (30)
```

Mode values:

| Value | Mode |
|-------|------|
| `01h` (1)   | DAW Mixer |
| `02h` (2)   | DAW Control |
| `06h-09h`   | Custom Modes 1-4 |
| `12h-1Dh`   | Custom Modes 5-16 |

So:
- **To put device in DAW Mixer:** send `B6 1E 01` after the activation handshake
- **To put device in DAW Control:** send `B6 1E 02`
- **To listen for user-toggled mode changes:** parse incoming `B6 1E vv` bytes; the device emits this when the user toggles via on-device button

**This is exactly the byte sequence Phase 5e initially mis-decoded as jog encoder data.** Phase 5e correctly identified the real jog wheel as `BF 5D nn` (channel 16, CC 0x5D, center-at-64), but the `B6 1E nn` bytes that confused the early parser are the canonical mode-report channel. The bridge should now treat `B6 1E nn` as "mode change notification".

## Surface mapping in DAW mode (general)

- **Encoders + faders**: channel 16 (status `BF`)
- **Buttons**: channel 1 (status `B0`)
- **Shift button**: channel 7 (status `B6`) — feature-control linked

The article references "Decimal values" / "Hexadecimal values" mapping tables which render as images in the Zendesk page; alt text not captured in the textContent extraction. Need to check the rendered DOM for image-level data, or rely on byte-level capture (Phase 9a hardware capture step).

## Encoder modes (absolute vs relative)

Default is **absolute** — encoder sends position as a 7-bit CC value. If the DAW pushes position info, the device picks it up.

Each of the 3 encoder rows can be independently switched to **relative** mode:

```
B6 <RowID> 7F  (relative on)
B6 <RowID> 00  (relative off)
```

Row IDs:

| Row | RowID byte |
|-----|------------|
| Row 1 | `45h` (69) |
| Row 2 | `48h` (72) |
| Row 3 | `49h` (73) |

In relative mode: pivot at `40h` (64). Values above = clockwise (+1 = `41`, +2 = `42`...); values below = anticlockwise (-1 = `3F`, -2 = `3E`...). Same encoding the jog wheel uses (`BF 5D nn`).

In relative mode, encoder CCs shift by 0x40 per row:
- Row 1: `4D-54` (77-84)
- Row 2: `55-5C` (85-92)
- Row 3: `5D-64` (93-100)

## Continuous control touch events (faders)

```
B6 47 7F    enable touch events
B6 47 00    disable
```

When enabled, fader touch on/off is sent on channel 15 (status `BE`):

```
BE <CC> 7F   touch on
BE <CC> 00   touch off
```

Where `<CC>` matches the fader's index (e.g. leftmost fader = `BE 05 7F` for touch-on, `BE 05 00` for touch-off).

## Colouring the surface (LED feedback)

For each control, send a CC on channel 1 with the colour-palette index:

```
B0 <control index> <colour index>
```

The "control index" is the same as the CC byte the control emits. Phase 5 uses this for transport LEDs (`B0 74 27` for Play/Stop idle, `B0 74 21` for playing).

For RGB custom colour:

```
F0 00 20 29 02 15 01 53 <control index> <R> <G> <B> F7
```

## Display control

Heavy SysEx vocabulary for the device's segment LCD strips. Phase 9b might consume this for track-name display. Phase 5 already uses `04 36 ...` and `06 36 01 <ascii>` for the host-name page — same family.

Targets:
- `05h-0Ch` (5-12): Faders (per-fader temp display)
- `0Dh-24h` (13-36): Encoders (per-encoder temp display)
- `35h` (53): Permanent / stationary display
- `36h` (54): Overlay / temporary display

## What's NOT here (need more articles)

- The actual per-control CC index map (faders, V-pots row 1/2/3, fader buttons by index — these were in image-rendered tables in the page that didn't extract as text)
- Behaviour differences between DAW Control and DAW Mixer modes — the article says "additional functionality" but doesn't enumerate
- Plugin-control mode specifics — referenced obliquely via the encoder relative-mode + display features

Next: fetch the "feature Controls" article and the "MIDI on Launch Control XL 3" article for the per-control CC map.
