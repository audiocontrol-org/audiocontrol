# MCU-NOTES

Findings from probing LUNA's MCU control-surface output against the
`midi-macro-bridge` virtual MIDI endpoint. Captured with
`./target/release/midi-macro-bridge --probe-mcu | tee probe-<scenario>.log`
on macOS (CoreMIDI), 828mk3 interface in the rig but not involved in
the MCU routing (the bridge is the device LUNA selects, not a
physical port).

The goal of this file is to document what LUNA sends on its MCU
output so we can write a robust parser in `src/mcu.rs` — specifically
the bar/beat/tick display stream we need for closed-loop locate.

## Summary of LUNA's MCU dialect

- **Device ID:** `0x14` (MCU Pro / Logic Control)
- **Mackie manufacturer SysEx header:** `F0 00 00 66 <id> ...`
- LUNA emits the full MCU surface state: 8 channel strips, faders,
  V-Pots, VU meters, button LEDs, LCD track names, and a 10-digit
  7-segment display for position/timecode.
- LUNA probes for surface presence every 5 seconds by sending an
  unanswered SysEx across device IDs `0x10`–`0x15`.

## Message catalog (from idle capture)

See `probe-idle.log` for the raw stream. Captured immediately after
the ON checkbox was ticked on the MIDI Control Surfaces row.

### 1. Button LED state: Note On

Format: `9c nn vv`

- Channel is always 0 in what we've seen (`0x90`).
- Note number `nn` encodes which button LED (MCU standard mapping).
- Velocity `vv`: `0x00` = LED off, `0x7F` = LED on.

LUNA pushes a burst of `90 NN 00` messages on surface activation to
zero every LED. Note numbers observed so far:

| Range        | MCU meaning                              |
|--------------|------------------------------------------|
| `0x00`-`0x07`| REC buttons, strips 1-8                  |
| `0x08`-`0x0F`| SOLO buttons, strips 1-8                 |
| `0x10`-`0x17`| MUTE buttons, strips 1-8                 |
| `0x18`-`0x1F`| SELECT buttons, strips 1-8               |
| `0x28`-`0x2F`| V-Pot press LEDs, strips 1-8             |
| `0x2A`       | BEATS mode LED — see "Display mode" below|
| `0x32`-`0x63`| Function buttons (varies by map)         |

After the initial burst, a single `90 2A 7F` fired late in the idle
capture (line 132). Note `0x2A` in the standard MCU map is the
**BEATS** mode indicator LED. LUNA appears to be declaring itself
in bars/beats mode — good news for closed-loop locate since we want
bars, not timecode.

### 2. V-Pot LED rings: CC `B0 30`-`B0 37`

Format: `B0 3c vv` where `c` is the strip index (0-7). Encodes the
V-Pot LED ring state (dot, bar, boost/cut). Not relevant for locate.

### 3. Timecode display: CC `B0 40`-`B0 49` **(parser target)**

Format: `B0 4d vv` where `d` is the digit position (0-9, most-sig to
least-sig) and `vv` is a 7-bit ASCII character.

Observed idle values: `0x20` (space/blank) on most digits, with a
later burst setting digits `0, 1, 2, 5, 7` to `0x30` ('0'). This
looks like the display being initialized to a "0 0 0 0" layout
consistent with a BBT readout of `0.0.0.0` or `000.0.00.00` in
some layout.

**What we still need from the playback capture:**

- The full 10-digit display layout while playing. Likely formats:
  - BBT: `BAR.BEAT.SUB.TICK` e.g. `001.01.000` (10 chars including
    separators encoded as periods or spaces between digits)
  - SMPTE: `HH:MM:SS:FF`
- Which digit positions carry bars, and how many leading digits bars
  can occupy (e.g., is it 3-digit bars like `001`–`999`, or more?)
- Whether the decimal separators are separate characters or baked
  into the digit encoding (some MCU firmware encodes `.` as the
  high bit of the preceding digit byte; unclear if LUNA does this)
- Update rate during playback (per beat? per tick?) — relevant to
  the closed-loop per-iteration timeout

### 4. VU meters: Channel Pressure `D0 xy`

Format: `D0 xy` where `x` is the strip index (0-7) and `y` is the
VU level (0x0-0xF in 12 dB steps). Not relevant for locate.

### 5. Fader positions: Pitch Bend `E0`-`E8`

Format: `Ec ll mm` where `c` is the strip (0-7) or master (8). The
14-bit value `(mm << 7) | ll` is the fader position (0-0x3FFF).
Not relevant for locate.

### 6. LCD display: SysEx `F0 00 00 66 14 12 <offset> <ASCII> F7`

LUNA pushes the 2x56-character MCU LCD in one SysEx (offset `0x00`,
112 ASCII bytes). Observed content: top row holds the 8 track names
(7 chars wide each = 56 chars). Bottom row carries V-Pot mode labels
or parameter values.

From the idle capture, row 1 spelled `"SCNCBS LAMBDA ARP DRUMS STRIPE REVERB MAIN"` + padding — i.e., the user's actual LUNA session track names. Not relevant for locate but confirms the handshake is live.

### 7. Surface-config SysEx: `F0 00 00 66 14 21 01 F7` and `20 NN 07 F7` × 8

Fired once, right before the LCD dump. Command `0x21` is likely the
display/config mode toggle; `0x20 NN 07` per strip looks like a
per-strip config push (`NN` = strip index 0-7).

### 8. Heartbeat / presence probe: **`F0 00 00 66 1X 00 F7`** every 5 s

Repeating exactly every 5 seconds (lines 157+ in `probe-idle.log`),
LUNA sends **six SysEx messages in rapid succession**, one per
device ID in `0x10`–`0x15`:

```
F0 00 00 66 10 00 F7
F0 00 00 66 11 00 F7
F0 00 00 66 12 00 F7
F0 00 00 66 13 00 F7
F0 00 00 66 14 00 F7
F0 00 00 66 15 00 F7
```

LUNA is asking "are you still there, device `0x1X`?" across the
range of MCU variants. A real MCU would respond with its identity
SysEx to claim one of the IDs. Without a response, LUNA may
eventually mark the surface as offline and stop pushing updates.

**Implementation implication:** the bridge's virtual OUTPUT will
need to reply to (at least) the `0x14` probe with a proper MCU
identity response so the surface stays alive long-term. For Phase 3
short probe sessions (<60 s) this is tolerable — LUNA keeps talking
even without a response, judging from this capture — but a
production locate session that runs for an hour will need it.

## Pending captures

- [ ] `probe-playback.log` — stream during Space-play, 8 bars, Space-stop
- [ ] `probe-barstep.log` — `]` 5× then `[` 5× from stopped
- [ ] `probe-scrub.log` — mouse-drag the playhead
- [ ] `probe-tschange.log` — playback across a 4/4 → 3/4 boundary (needs
      a session with an authored TS change)

Each capture should be fresh (Ctrl-C the probe between runs so the
timestamps restart, making it easier to correlate events to actions).

## Open questions for the parser

1. Does LUNA always emit BBT on `B0 40-49`, or does it depend on
   LUNA's own display-mode toggle (the BBT vs SMPTE switch near the
   transport bar)? If the user has LUNA set to timecode display,
   does LUNA still send BBT on the MCU surface, or does it mirror?
2. Are all 10 digits updated every tick, or only the digits that
   changed? (Partial updates are common on MCU; the parser will
   need to maintain display state and apply deltas.)
3. What character does LUNA emit for the BBT separator — ASCII `.`
   (0x2E), or are separators encoded by setting the high bit of the
   preceding digit byte (some MCU firmwares do this)?
4. Does the position-display stream pause when LUNA is stopped, or
   does it keep emitting at some reduced rate?

Answer these from the playback and bar-step captures.
