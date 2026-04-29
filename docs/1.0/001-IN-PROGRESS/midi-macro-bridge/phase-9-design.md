# Phase 9 design — mixer event taxonomy + parser shape

This document ratifies the structural decisions Phase 9a's research
needs to settle before Phase 9b code lands. Two questions:

1. **Event taxonomy:** how do we represent the new mixer events
   alongside the existing `TransportEvent`?
2. **V-pot encoding:** do we force the device into relative mode at
   startup, or accept absolute values and translate to deltas?

## Decision 1 — generalised `SurfaceEvent` enum (NOT a parallel channel)

Wrap the existing `TransportEvent` inside a broader `SurfaceEvent` enum.
The transport-event channel becomes a surface-event channel; existing
state-machine code keeps consuming the wrapped `TransportEvent` variants
exactly as today.

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

## Decision 2 — V-pots in relative mode (force at startup)

After the activation handshake and `B6 1E 01` mode-select, the bridge
ALSO sends:

```
B6 45 7F   row 1 → relative
B6 48 7F   row 2 → relative
B6 49 7F   row 3 → relative
```

This puts all 24 V-pots in relative mode (`BF 4D-64 nn`,
centre-at-`40`) instead of absolute mode (`BF 0D-24 nn`, raw 7-bit).

### Why force relative

- **Matches LUNA's MCU input expectation.** The MCU spec specifies
  pan (CC `0x10-0x17`) as relative-encoded values (positive = clockwise,
  negative = counter-clockwise). LUNA presumably implements this. If
  the bridge accepted absolute values, it'd need to do
  `current_absolute - last_absolute = delta` per V-pot tick anyway —
  doing the conversion at the source is simpler.
- **Stateless parser.** Relative mode doesn't require the parser to
  remember the previous value per V-pot. Absolute mode does (without
  it, every initial absolute value would look like a huge delta). The
  parser stays a pure function `parse(bytes) -> Option<SurfaceEvent>`.
- **Reuses Phase 5's existing relative encoding.** Phase 5's jog wheel
  parser already handles `BF 5D nn` centre-at-`40` correctly. Same
  encoding for all 24 V-pots — same code path.
- **Initial-position consistency.** In absolute mode the V-pot's
  emitted value depends on the encoder's last-touched physical position
  (the device remembers across power cycles). The first byte after
  Mixer-mode entry could be any value, looking like an unintended jump.
  Relative mode emits no initial byte at all (only on user motion),
  avoiding the spurious initial event.

### Trade-off — absolute mode would have given automatic LED ring positioning

Some MCU surfaces use absolute V-pot values to drive their own LED
rings (the device displays its current value). On the LCXL3, the V-pot
LED rings are controlled separately via SysEx, not via the absolute
value. So we lose nothing by going relative.

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

## Open question — does the user ratify?

If you're OK with:
- **`SurfaceEvent` enum** (Decision 1)
- **Force V-pots to relative at startup** (Decision 2)
- **Stages 1-4 land first; 5-7 wait for LUNA profile**

… reply "ratified" and I'll start Phase 9b stage 1 (parser extension).

If you want to adjust either decision, this doc is the canonical place
to capture the rationale — please push back here.
