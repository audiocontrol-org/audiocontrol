# Phase 9 design — mixer event taxonomy + parser shape

This document ratifies the structural decisions Phase 9a's research
needs to settle before Phase 9b code lands. Two questions:

1. **Event taxonomy:** how do we represent the new mixer events
   alongside the existing `TransportEvent`?
2. **V-pot encoding:** do we force the device into relative mode at
   startup, or accept absolute values and translate to deltas?

## Decision 1 (RATIFIED) — generalised `SurfaceEvent` enum

**Plain-language framing of the issue (added after user push-back: "I don't understand the issue"):**

The existing channel between MIDI input callbacks and the main loop carries `TransportEvent` values — `Start`, `Stop`, `TogglePlay`, `NudgeForward(n)`, etc. The state machine (`Machine::handle`) consumes `TransportEvent` directly and decides what `Action`s to emit. Phase 9 adds *new event kinds* — fader moved, V-pot turned, fader button pressed — that don't belong in the state machine (they don't have echo dedup, don't transition transport state, don't get arbitrated).

Three implementation shapes, only two reasonable:

1. **Add new variants to `TransportEvent`** — would force `Machine::handle` to handle (or default-ignore) each mixer variant. Misleading name; mixer-event matches in the state machine become noise.
2. **Wrap `TransportEvent` inside `SurfaceEvent`** — the channel carries `SurfaceEvent`; main loop pattern-matches and routes Transport variants to the state machine, mixer variants to a new mixer translation function. State machine code is untouched.
3. **Run two parallel channels** — one for transport, one for mixer. Two drains, two error paths, no real benefit since the main loop sees both anyway.

Picking option 2 (wrap) because it's the cleanest separation and reuses the existing channel/dispatch wiring with a one-line type shift. Doesn't affect user-visible behaviour — purely internal architecture.

```rust
pub enum SurfaceEvent {
    /// Phase 5 transport vocabulary, unchanged. State machine still
    /// arbitrates via Machine::handle.
    Transport(TransportEvent),

    /// Phase 9 mixer events.
    Fader { strip: u8, value: u8 },                       // strip 0..=7, value 0..=127
    VPotDelta { row: VRow, col: u8, delta: i8 },          // signed nudge after relative-mode toggle
    FaderButton { row: ButtonRow, strip: u8, pressed: bool },
    SidePanelButton { button: SideButton, pressed: bool }, // Page Up/Down, Track L/R, Solo-Arm-toggle, etc.
    ModeChange(LcxlMode),                                  // Mixer | Control | Custom(N)
}

pub enum VRow      { Top, Middle, Bottom }
pub enum ButtonRow { TopSoloArm, BottomMuteSelect }
pub enum SideButton {
    PageUp, PageDown, TrackLeft, TrackRight,
    SoloArmRowToggle, MuteSelectRowToggle, SmallButton,
    // Record / Play / Shift handled via TransportEvent already
}
pub enum LcxlMode { DawMixer, DawControl, Custom(u8) }
```

### Why this shape over a parallel mixer-event channel

- **Existing channel pattern reuses cleanly.** Today the channel type
  is `mpsc::Sender<(EventSource, TransportEvent)>`. Phase 9 changes
  it to `mpsc::Sender<(EventSource, SurfaceEvent)>` — one-line type
  shift across the existing wiring.
- **Single dispatch point.** Main loop's `match` over received events
  pattern-matches on `SurfaceEvent::Transport(t) => machine.handle(t)`
  for the existing path, plus new arms for mixer events. No two
  parallel pipelines to keep in sync.
- **Backend dispatch is clean.** New `MixerBackend` trait method
  `emit_mixer(&MixerAction)` (in addition to existing `emit(&[Action])`
  for transport). The main loop routes:
  - `SurfaceEvent::Transport(t)` → `Machine::handle(t)` →
    `Action[]` → `Backend::emit`
  - `SurfaceEvent::Fader / VPotDelta / FaderButton / SidePanelButton`
    → translation layer → `MixerAction[]` → `MixerBackend::emit_mixer`
- **Future custom-mode work fits naturally.** A future Phase 10 custom
  mode emits `SurfaceEvent::CustomMode { ... }` without disturbing
  the existing variants.
- **Match exhaustiveness keeps callers honest.** Any caller pattern-
  matching on `SurfaceEvent` will need to handle the mixer variants
  (or explicitly ignore them) — surfaces "you forgot to wire X" at
  compile time.

### Why this shape over a brand-new mixer channel

Two channels would mean two main-loop drains, two backend traits to
dispatch, two error-handling paths. The state machine doesn't run on
mixer events anyway (no echo dedup, no arbitration), so isolating
mixer events in a separate channel buys nothing — they're already
visible to the main loop and routable via match.

## Decision 2 (RATIFIED — refined per user feedback) — V-pots relative, faders pickup

User push-back: "I don't like either absolute or relative mode; I like catch mode, where values below or above the current value are ignored until the encoder catches up to the current value, then the encoder is in sync with the software. Also, these are continuous controllers, so this only matters if they only ever send out CC values (or equivalent) instead of +1/-1."

The user's preference is **catch / pickup mode** as the user-facing model. The Phase 9a research clarifies that catch matters differently for V-pots vs faders, so the implementation splits along that axis:

### V-pots — relative mode (no catch needed)

V-pots are continuous rotary encoders (no end stops). In relative mode they emit `+1`/`-1` deltas per detent — there's no notion of an "absolute value" the encoder could be ahead of or behind. Catch mode is simply not applicable. The bridge forces relative mode at startup so V-pots emit deltas, and the bridge translates each delta into the corresponding LUNA pan-CC tick.

After the activation handshake + `B6 1E 01`, also send:

```
B6 45 7F   row 1 → relative
B6 48 7F   row 2 → relative
B6 49 7F   row 3 → relative
```

This puts all 24 V-pots into delta mode (`BF 4D-64 nn`, centre-at-`40`).
Each detent of rotation emits one CC; `value > 40` = clockwise, `value
< 40` = counter-clockwise; magnitude = how many detents in that one
packet. Same encoding Phase 5 already handles for the row-3-col-1 V-pot
in DAW Control mode (the "jog wheel"). Phase 9b's parser reuses Phase
5's relative-decode path.

### Faders — DAW Fader Pickup ON (catch mode at the device level)

Faders are physical motorless controls. They DO have an absolute
position the user sets by hand, and they CAN be out of sync with
LUNA's stored value. This is exactly where catch matters.

The LCXL3 has a built-in feature for this: feature control CC `0x46`
(decimal 70) — "DAW Fader Pickup". When enabled, the device only
starts emitting fader-CC events once the fader passes through its
current "DAW value" position. Below catch-up: silent. Above catch-up:
silent. At catch-up: engaged, emits subsequent values normally.

Send at startup:

```
B6 46 7F   DAW Fader Pickup ON
```

The device handles catch-up internally. The bridge just consumes
`BF 05-0C nn` events as they arrive and forwards as 14-bit pitch-bend
to LUNA. No bridge-side per-fader state needed.

The DAW (LUNA) needs to push fader positions back to the device for
this to work — when the user changes a track's volume in LUNA's UI,
LUNA pushes the new value via inbound MCU bytes; the LCXL3 picks that
up as the fader's "current DAW value" reference for catch. Phase 9a's
LUNA profiling step confirms this push-back behaviour.

### Why this two-track approach instead of bridge-side catch logic

- **The device implements pickup natively for faders.** Reusing the
  built-in feature avoids reinventing it in Rust.
- **V-pots in relative mode sidestep the problem entirely.** No
  absolute-vs-DAW divergence is even possible with deltas.
- **No per-control state in the bridge parser.** Stateless `parse`
  function stays pure. Mode-tracking state (which sub-mode is active,
  which row is in relative mode) lives in the caller, not the parser.
- **Reuses Phase 5's relative-encoding code path.** Same byte format
  the existing jog-wheel parser handles.

## Phase 9b implementation order (proposed)

Once this design is ratified, Phase 9b can land in stages:

1. **Parser extension (`lcxl3.rs`)** — new `parse(bytes) ->
   Option<SurfaceEvent>` that wraps Phase 5's `parse` and adds Mixer
   recognition. Mode-tracking state moves out of the parser (the
   parser is stateless; mode tracking is in the caller, which holds
   `current_mode: LcxlMode` and routes events accordingly).

2. **State + Backend trait extensions** — `state.rs` keeps
   `TransportEvent` and `Machine` unchanged. New types: `SurfaceEvent`,
   `MixerAction`, `MixerBackend`. `McuBackend` implements
   `MixerBackend`; `KeystrokeBackend` does not.

3. **Main loop — channel retype + routing** — change channel type to
   `mpsc::Sender<(EventSource, SurfaceEvent)>`. Add mode-tracking
   state. Route `SurfaceEvent::Transport(t)` to existing path; route
   mixer events to a new `mixer_translate_and_emit` function.

4. **Mode lifecycle** — on startup with LCXL3 enabled, after the
   activation handshake send `B6 1E 01` (Mixer) and the three
   relative-mode toggles. On `B6 1E vv` arrivals from the device,
   update `current_mode`. When mode changes back to DAW Control,
   the relative-mode toggle sticks (the device remembers per-row).

5. **LUNA MCU translation** — depends on Phase 9a's LUNA profiling
   (still pending). Until that lands: emit log lines for what we'd
   send and stub out the actual MCU bytes. Or block 9b on the LUNA
   profile being complete.

6. **LED feedback** — depends on LUNA pushing mute/solo/arm state
   back via inbound MCU bytes. Same dependency on LUNA profiling.

7. **Banking** — depends on LUNA's bank-navigation byte vocabulary.

8. **Configuration** — `[lcxl3.mixer]` config section, opt-in.

Stages 1-4 can land BEFORE LUNA profiling completes. Stages 5-7
need the LUNA profile.

## Ratification

Both decisions ratified 2026-04-29:

- **Decision 1**: `SurfaceEvent` enum wraps `TransportEvent`. User had no preference between options once the issue was reframed in plain language; picked the wrap because it's the cleanest separation.
- **Decision 2**: V-pots → relative (no catch needed), faders → built-in pickup mode (`B6 46 7F`). Refined from the original "everything relative" proposal after user clarified their preference for catch-mode behaviour where it matters (the faders).

Phase 9b stages 1-4 (parser, types, routing, mode lifecycle) can now land. Stages 5-7 (MCU translation, LED feedback, banking) wait for the LUNA profiling.
