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

### 3. Timecode display: CC `B0 40`-`B0 49` **(parser target — decoded)**

Format: `B0 4d vv` where `d` is the digit position and `vv` is a 7-bit
ASCII character (`0x20` = blank, `0x30`-`0x39` = digits '0'-'9').

**Digit numbering:** the MCU display has 10 digits arranged left-to-
right on the physical surface. `B0 40` is the **rightmost** digit,
`B0 49` is the **leftmost**. So CC indices run right-to-left across
the display.

**Decoded layout for LUNA in BEATS/BBT mode (from `probe-playback.log`):**

```
CC:         49 48 47   46 45    44 43 42 41 40
Digit:      d9 d8 d7   d6 d5    d4 d3 d2 d1 d0
Field:      [   BAR  ] [ BEAT ] [     TICK    ]
Width:       3 digits   2 digits  5 digits
Blank when:   bar<100    beat<10   (unused hi digits blank)
             bar<10
```

Only `d7`, `d5`, and `d0`-`d2` update during 4/4 playback through the
first 9 bars. `d3`, `d4`, `d6`, `d8`, `d9` only appear in the initial
blank-out; they would activate when bar≥10 or the TS pushes beat≥10.

**Verification from the 18.6-second playback capture:**

- `d7` increments monotonically every ~2.19 s: `1 → 2 → 3 → ... → 9`,
  then wraps back to `1` when the user stopped and LUNA rewound.
  At ~2.19 s per bar, that's ≈ 109 BPM (4/4) — the song's tempo.
- `d5` cycles `1 → 2 → 3 → 4` every ~555 ms, repeating 4 cycles per
  `d7` increment. That's the beat within the bar (4/4).
- `d2` cycles `0 → 1 → ... → 9` every ~555 ms (one cycle per beat).
- `d1` and `d0` cycle faster; together with `d2` they carry the tick
  within the beat.

**LUNA's update rate is ~16 position-display updates per second**
(a new position snapshot every ~62 ms). This sets the floor on the
closed-loop per-iteration timeout: a `]` keystroke should produce a
visible digit change within ~60–100 ms. A 500 ms per-iteration
timeout gives comfortable headroom for OS keystroke latency and any
LUNA processing delay.

**Tick precision:** we see `d0`-`d2` as three decimal digits (0-999)
but the rate is slower than a clean 480-PPQN tick counter would
produce. Probably LUNA is emitting tens/hundreds of some finer
subdivision. For closed-loop locate we only need bar-level accuracy,
so the tick digits are useful for debugging but not required by the
LocateController.

**Separator encoding:** no decimal-separator characters observed.
LUNA just leaves `d3`, `d4`, `d6` blank (`0x20`), relying on the
physical display's static period/colon LEDs between fields. The
parser treats these positions as "ignore".

**Important parsing rule:** when LUNA rewinds to bar 1 beat 1, the
tick digits (`d0`-`d2`) go **back to blank** (`0x20`), not to `0`.
The parser must treat blank as equivalent to 0 for numeric value,
but must not confuse blank with "stale / unset". Safe rule: on
receiving a blank (`0x20`) for a digit, treat it as `0` in the
decoded position, but retain the blank/set distinction if needed
for display purposes.

**The parser only cares about `d7`, `d8`, `d9` for bar number.** In
4/4 with fewer than 100 bars, that's just `d7` (ones) and `d8`
(tens); `d9` appears at bar ≥ 100.

Pseudocode:

```
bar_value = digit_to_u32(d9) * 100 + digit_to_u32(d8) * 10 + digit_to_u32(d7)

fn digit_to_u32(c: u8) -> u32 {
    if c == 0x20 { 0 }           // blank = 0
    else if c >= 0x30 && c <= 0x39 { (c - 0x30) as u32 }
    else { /* unexpected; log and ignore */ 0 }
}
```

A "PositionUpdate" event should be emitted whenever any of `d7`,
`d8`, `d9` changes and the resulting 3-digit bar value is different
from the last emitted bar.

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

- [x] `probe-idle.log` — surface init + 5 s heartbeat — decoded
- [x] `probe-playback.log` — 18.6 s of 4/4 playback at ~109 BPM —
      decoded the `B0 40-49` BBT layout (see section 3 above)
- [x] `probe-barstep.log` — `]` × 5 forward, `[` × 5 back, from a
      stopped position. Results below.
- [ ] `probe-scrub.log` — mouse-drag the playhead. Check whether
      mid-scrub produces a burst of position updates or coalesces
      to one at drag-end (affects whether scrubbing could trigger
      spurious closed-loop activity).
- [x] `probe-ts.log` — playback across 4/4 → 3/4 → 4/4. Results
      below.

## Time-signature transition results (the last structural check)

Capture started mid-session (user cued to bar 65, played four bars
of 4/4, five bars of 3/4, then four bars of 4/4 back into the 4/4
section).

| Bar | `d47`/`d48`  | Beats observed | Time signature |
|-----|--------------|----------------|----------------|
| 65  | `35`         | 2, 3, 4        | 4/4 (caught mid-bar)|
| 66  | `36`         | 1, 2, 3, 4     | 4/4            |
| 67  | `37`         | 1, 2, 3, 4     | 4/4            |
| 68  | `38`         | 1, 2, 3, 4     | 4/4            |
| 69  | `39`         | 1, 2, 3        | **3/4**        |
| 70  | `30`,`48=37` | 1, 2, 3        | 3/4            |
| 71  | `31`         | 1, 2, 3        | 3/4            |
| 72  | `32`         | 1, 2, 3        | 3/4            |
| 73  | `33`         | 1, 2, 3        | 3/4            |
| 74  | `34`         | 1, 2, 3, 4     | **4/4**        |
| 75  | `35`         | 1, 2, 3, 4     | 4/4            |
| 76  | `36`         | 1, 2, 3, 4     | 4/4            |
| 77  | `37`         | 1, 2, 3, 4     | 4/4            |

**Structural findings:**

1. **LUNA's bar counter is strictly monotonic across TS changes.**
   65 → 66 → ... → 77 is an unbroken `+1` increment sequence. No
   reset, no jump, no discontinuity at either boundary.
2. **The TS change is observable *only* via the `d5` cycle length**
   — 1→3 in 3/4 bars, 1→4 in 4/4 bars. The bar counter (`d7`/`d8`/`d9`)
   has no knowledge of the current time signature.
3. **The bar-wrap at 69 → 70 correctly carried into `d8`**: the
   message batch at t=26.16 s sent `d47=30` *and* `d48=37`
   simultaneously (i.e., `bar 69 (d48=6, d47=9)` → `bar 70 (d48=7, d47=0)`).
   Our parser can process these per-digit updates in order — by the
   time the batch's last CC is consumed, the composed bar value is
   correct.

**Closed-loop design implication (confirmed):** `mcu.rs` needs no
TS-aware logic at all. The `PositionTracker` just reads digits 7-9
as a 3-digit decimal bar number; the `LocateController` doesn't
care whether intermediate bars were 4/4, 3/4, 7/8, or anything
else. The closed-loop algorithm is correct across arbitrary mixed
time signatures.

## LUNA MCU input mapping (Phase 3c discovery — in progress)

Byte sequences LUNA accepts from the bridge's virtual output. Each
entry is verified against live LUNA by `--send-mcu <spec>` and a
visual / log-trace confirmation of the effect.

| Action      | Byte sequence            | Notes                                  |
|-------------|--------------------------|----------------------------------------|
| Continue    | `90 5E 7F` + `90 5E 00`  | Standard MCU PLAY button tap. See below. |
| Stop        | `90 5D 7F` + `90 5D 00`  | Standard MCU STOP button tap. See below. |
| Start       | *(composite: ReturnToZero + Continue — pending)* |              |
| Return-to-zero | *(pending 3c test)*   |                                        |
| Bar-forward    | *(pending 3c test)*   |                                        |
| Bar-backward   | *(pending 3c test)*   |                                        |

### Continue — `90 5E 7F; 90 5E 00`

Standard MCU transport PLAY (note 0x5E) press + release, 50 ms apart.
Verified 2026-04-23 via `probe-send-play.log` against live LUNA with
the playhead stopped at bar 9 beat 1. Observed behaviour:

- LUNA starts playing from the current playhead position (bar 9 in
  the test), not from bar 1. That's Continue semantics, not Start.
- LUNA echoes the button press back as MCU state feedback
  (`90 5E 7F` ~15 ms after our press, `90 5E 00` ~280 ms after our
  release). The echoed LED event is a single flash, not held for the
  duration of playback — so we can't use the LED echo as a play-state
  indicator. Position updates on `B0 40-49` are the authoritative
  playback signal.
- Position updates begin flowing within ~40 ms of the button press.
- LUNA briefly blanks the position digits (`B0 45 20`, `B0 47 20`)
  for ~650 ms right after the button release, then resumes sending
  position CCs with the playback advancing. Harmless quirk; the
  PositionTracker will see the intermediate blank and immediately
  re-sync on the next update.

### Stop — `90 5D 7F; 90 5D 00`

Standard MCU transport STOP (note 0x5D) press + release, 50 ms
apart. Verified 2026-04-23 via `probe-send-stop.log` against live
LUNA that had been playing. Observed behaviour:

- Position-update stream ceases within ~230 ms of the press.
- LUNA echoes the button press (`90 5D 7F`) as LED-on feedback, same
  pattern as PLAY.
- **LUNA returns the playhead to the play-start position on stop.**
  In the test, playback started at bar 9; STOP returned the playhead
  to bar 9 beat 1 tick 0, not the position where the audio was at
  the moment STOP fired. Pro Tools / Logic convention. Our
  PositionTracker sees the "return" position naturally and
  doesn't need special handling.
- Audio-tail VU-meter activity (channel-pressure `D0 XX` at ~50 Hz)
  continues for ~1-2 s after STOP as the audio ramps down. Not
  relevant to our parser; VU meters aren't on `B0 40-49`.

### Reconnection quirk — position stream pauses during handshake

After the bridge reconnects (on startup, after a LUNA row toggle),
LUNA does its init-burst handshake — blanks all digits, pushes
surface state, starts heartbeats — but **does not resume the
position-display stream until the next transport event**. If the
DAW was playing, the audio continues but the MCU surface shows the
display frozen until something prods it (e.g., STOP, PLAY, or a
scrub on LUNA's side).

Implication for Phase 3e: the `LocateController` must not assume
the `PositionTracker` has valid state immediately on startup. Block
on the first real `PositionUpdate` (or emit a "wake" message of
some kind) before starting the nudge loop; otherwise a locate that
fires before LUNA has pushed a position will read `bar 0` and
nudge wildly.

### How Start composes

Phase 1-2's Start event ("rewind and play from bar 1") has no direct
MCU equivalent. We'll build it from `ReturnToZero; Continue` once we
discover the Return-to-zero mapping. The state machine already
separates these two primitives, so no refactor needed.

## Bar-step results (decisive for closed-loop locate)

Timeline from `probe-barstep.log` (LUNA stopped at bar 1):

| t (s) | Gap   | Keystroke | `d7` (bar) | Other updates          |
|-------|-------|-----------|------------|------------------------|
| 25.63 |   —   | `]` #1    | blank → 2  | `d0/d1/d2=0`, `d5=1` † |
| 26.17 | 540ms | `]` #2    | 2 → 3      | —                      |
| 26.70 | 530ms | `]` #3    | 3 → 4      | —                      |
| 27.36 | 660ms | `]` #4    | 4 → 5      | —                      |
| 28.91 | 1550ms| `]` #5    | 5 → 6      | —                      |
| 31.25 | 2340ms| `[` #1    | 6 → 5      | —                      |
| 31.60 | 350ms | `[` #2    | 5 → 4      | —                      |
| 31.95 | 350ms | `[` #3    | 4 → 3      | —                      |
| 32.33 | 380ms | `[` #4    | 3 → 2      | —                      |
| 32.69 | 370ms | `[` #5    | 2 → 1      | —                      |

† The first bar-step after surface init also gets a full refresh of
the tick (`d0/d1/d2 = 000`) and beat (`d5 = 1`) digits. Subsequent
stepped moves only touch `d7`. Parser implication: never *assume*
the tick/beat are still at their last values after a long quiet
period; the refresh is free information, just consume it.

**Findings:**

1. **Each `]` / `[` keystroke moves LUNA exactly ±1 bar.** 10/10
   keystrokes, 10/10 single-bar updates. No missed presses, no
   fractional moves, no double-steps. The `Key::Layout` / bracket-
   keystroke primitive is reliable for closed-loop.
2. **Only `d7` (bar ones digit) updates during bar-step moves** in
   the 1-9 range. The parser only needs to watch `d7` / `d8` / `d9`
   changes to detect bar transitions while stopped.
3. **Position updates arrive tightly after keystrokes.** The user's
   fastest inter-keystroke gap was ~350 ms and *included* human
   reaction time and the 62 ms MCU display refresh interval — LUNA's
   own keystroke → position-update latency is clearly well under
   100 ms. A 500 ms per-iteration timeout has order-of-magnitude
   headroom.
4. **Backward and forward move at the same rate.** `[` gaps (350 ms)
   were indistinguishable from `]` gaps (540 ms for the first four);
   the variance is human, not LUNA.
5. **Heartbeat SysEx (`F0 00 00 66 1X 00 F7`) doesn't interfere.**
   The 5-second heartbeat bursts interleave cleanly with the
   position updates and don't need to be filtered out for the
   parser to do its job — it's watching `B0 47-49`.

**Closed-loop controller implications:**

- Algorithm simplifies to: `loop { emit(sign(delta) ? ']' : '['); wait_for_new_bar(); recompute_delta(); if delta == 0 { done } }`
- No overshoot: since each keystroke is exactly ±1 bar, the delta
  monotonically decreases toward zero. The oscillation detector in
  the PRD/workplan becomes a belt-and-braces safety net for the
  "LUNA nudge > 1 bar" misconfiguration case, which this capture
  shows isn't happening under normal LUNA defaults.
- Iteration count = exact bar distance. A locate from bar 1 to bar
  100 emits 99 keystrokes — still fast at <100 ms each, well under
  10 seconds for even large jumps. No 200-keystroke concern from
  the open-loop fallback appendix.

## Answered questions

1. **BBT vs SMPTE on the MCU surface:** LUNA sent BEATS-mode output
   (note `0x2A` BEATS LED lit, and the observed digit cycling rates
   match 4/4 at ~109 BPM). Whether LUNA's main transport display
   affects the MCU output needs confirmation, but for Phase 3 we'll
   assume BEATS mode. A runtime-detectable "this isn't BBT" error
   (e.g., if the bar digit cycles too fast to be bars) would be a
   good defensive check in `mcu.rs`.
2. **Partial updates vs full refreshes:** LUNA sends **only the
   digits that changed**. The parser must maintain display state
   across messages and apply deltas. Initial state: all 10 digits
   start blank (`0x20`) after the activation burst.
3. **Separators:** LUNA does not encode separators as characters;
   `d3`, `d4`, `d6` are left blank, and the MCU's physical display
   has fixed separator LEDs between BAR-BEAT and BEAT-TICK.
4. **Stream during playback:** LUNA pushes ~16 position updates per
   second while playing; when stopped, the position display holds
   its last value and LUNA only re-emits it on transport events.

## Still-open questions

- Does the bar-step keystroke (`]`) while LUNA is **stopped** produce
  a single position update, or a burst? (Affects parser's
  `PositionUpdate` debouncing.)
- What does LUNA do when scrubbing? (Continuous updates could flood
  the parser mid-scrub — but closed-loop locate is only active in
  the Locating state, so scrub outside a locate should be harmless
  unless it somehow triggers a spurious SPP.)
- Does LUNA emit a position update at the exact moment the user
  presses the transport Stop key, reflecting the stopped bar? (Yes,
  based on line 3019: after Stop, `d7=1` and `d5=1` confirm the
  rewind.)
