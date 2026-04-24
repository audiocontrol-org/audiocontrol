# MIDI Macro Bridge — Product Requirements Document

**Status:** Approved
**Owner:** Orion
**Created:** 2026-04-22

## Problem Statement

There is no way to control LUNA's transport from the MC-500mkII sequencer. LUNA does not support MMC, and MCU lacks locate-to-position. The originally validated workaround was translating MIDI transport bytes into keyboard events, and that's what Phases 1-2 shipped. In practice, keystroke emulation has real limitations: it requires LUNA to be the frontmost app (transport commands get swallowed or leak into other apps when focus is elsewhere), it depends on macOS Accessibility permission (a brittle onboarding step for non-technical users), and the OS can rate-limit or drop synthesised keystrokes under load. MCU output bypasses all three: LUNA accepts control-surface input regardless of which app is frontmost, there is no Accessibility gate, and MCU messages are delivered via the same MIDI plumbing that already carries the MC-500's transport.

Beyond basic transport, the user needs LUNA's playhead to follow the MC-500's locate operations bar-for-bar. Audio tape sync is *not* a forgiveness mechanism here: the MC-500 chases sync to lock its own tempo and nearest-bar reference, but it preserves whatever bar-offset exists at the moment sync is established — if the MC-500 thinks it's on bar 17 while the DAW is on bar 25, the MC-500 holds that 8-bar gap indefinitely. An open-loop locate that misses the target bar by any amount therefore desyncs the two machines *permanently* for the duration of the session. Bar-exact is the requirement, not a nice-to-have.

## User Stories

- As a studio user, I want to hit Play/Stop/Continue on the MC-500 and have LUNA follow, so I can use the hardware sequencer as my transport controller.
- As a developer, I want the bridge integrated into the monorepo build system, so it is built and tested alongside other services.
- As a studio user, I want locating on the MC-500 (LOCATE button, numeric entry, or locate-memory recall) to move LUNA's playhead to the *exact* same bar, so audio tape sync locks the two machines together without a persistent offset. Closed-loop verification against LUNA's MCU position output is what makes this reliable; open-loop keystroke counting is not trustworthy enough given that any mistake is permanent.

## Success Criteria

- `services/midi-macro-bridge/` exists as a Rust service in the monorepo
- `cargo test` passes for all unit tests (state machine, MIDI parser, config, locate)
- `cargo build --release` produces a working macOS binary
- `--list-ports` shows available MIDI inputs
- `--self-test` emits keystrokes to LUNA when focused
- Root Makefile has a `build-midi-macro-bridge` target
- Hardware-validated: MC-500 Play/Stop/Continue controls LUNA transport via MCU (works with LUNA in the background; no Accessibility permission required)
- Hardware-validated: MC-500 LOCATE drives LUNA to the matching bar *exactly* (no 1-bar-off errors), regardless of time signature, via closed-loop nudging against LUNA's MCU position output
- Keystroke backend remains selectable via `[transport] backend = "keystrokes"` for environments where MCU isn't available, preserving Phase 1-2 behaviour as an opt-in fallback

## In Scope

### Phases 1–2 (shipped in PR #316)

- Integrate existing Rust code into `services/midi-macro-bridge/`
- MIDI transport byte translation (0xFA Start, 0xFB Continue, 0xFC Stop)
- Keystroke synthesis via enigo (Space for play/stop toggle, Return for return-to-zero)
- Frontmost-app check (macOS only, via osascript) — fails closed on error
- Config file (TOML) with port name, delay, frontmost app filter
- State machine for echo/feedback resilience
- `--list-ports` and `--self-test` CLI modes
- Makefile build target

### Phases 3–4 (this extension) — MCU transport + closed-loop locate

Two structural changes ship together in this phase: replace the keystroke transport path with MCU output (with keystrokes demoted to an opt-in fallback backend), and add SPP-driven closed-loop locate that reuses the same MCU plumbing.

- Register the bridge as a virtual MIDI device named `MIDI Macro Bridge` (input + output pair via CoreMIDI virtual endpoints) so it appears in LUNA's MIDI Control Surfaces dropdown and can be selected as both INPUT DEVICE and OUTPUT DEVICE on a control-surface row. This is how MCU routing is established — no IAC bus or manual routing required. **Scaffolded in an earlier Phase 3 commit; extended here to emit.**
- Respond to LUNA's MCU heartbeat probe (`F0 00 00 66 1X 00 F7`, every 5 s) with a proper identity reply so the surface stays alive for long-running sessions and so LUNA reliably accepts the bridge's input.
- Emit MCU button messages on the virtual output for transport actions: **Play**, **Stop**, **Continue (= play-from-position)**, **Return-to-zero**, **Bar-forward**, **Bar-backward**. The exact MCU note numbers / sequences are discovered empirically during Phase 3c against the live LUNA instance — the MCU standard gives strong candidates (transport 0x5B-0x5F, navigation 0x62/0x63) but DAWs vary on how "return to zero" and "1-bar nudge" map.
- Parse LUNA's MCU position output (bars/beats/subdivisions — `B0 40-49` per MCU-NOTES.md) and maintain a tracked-playhead model used for both closed-loop verification and deciding nudge direction.
- SPP-driven locate: parse Song Position Pointer (`0xF2 ll hh`) as the *target* (bar destination requested by the MC-500); drive LUNA's playhead to that target by iteratively emitting bar-nudge actions (via the configured backend) and reading LUNA's MCU position output to verify each nudge landed where expected. Closed-loop is required, not optimising — a bar-off locate would leave the MC-500 running with a persistent bar-offset against LUNA for the rest of the session.
- Introduce an `Action` enum (`Play`, `Stop`, `Continue`, `ReturnToZero`, `BarForward`, `BarBackward`) emitted by the state machine. Introduce a `Backend` trait implemented by `McuBackend` (default) and `KeystrokeBackend` (existing Phase 1-2 logic, preserved). A `[transport] backend = "mcu" | "keystrokes"` config switches between them; default is `"mcu"`.
- Extend state machine with a `Locating` state and atomic-locate semantics: SPP events coalesced while locating, Stop cancels the in-flight locate, Start arriving during locate is queued as Continue so a return-to-zero doesn't undo the locate.
- Add `[locate]` TOML section: `enabled`, `max_iterations` safety cap, `position_timeout_ms`.
- `info!`-level logging of every locate: target bar (from SPP), starting bar (from MCU), per-iteration action + delta, final bar, total iterations — fully diagnosable when locates misfire.
- Closed-loop naturally supports bidirectional navigation: move in whichever direction (forward or backward) is closer to the target; no always-rewind penalty.

**Deliberate closed-loop constraint:** the approach only works if LUNA's bar-nudge primitive moves the playhead by ≤ 1 bar per invocation. The hardware probe confirms this for the bracket keystrokes; the MCU-equivalent primitive needs the same property. If an unexpected nudge size is discovered in Phase 3c or seen at runtime (delta reverses sign between iterations), the controller aborts with a clear configuration error — it does not silently oscillate.

## Out of Scope

- MIDI clock forwarding
- **Full** MCU surface emulation. Phases 3-4 consume the MCU position output stream and emit a **limited** set of outbound MCU messages: transport button presses (Play/Stop/Continue/Return-to-zero), bar-nudge button presses (Bar-forward/Bar-backward), and the heartbeat identity reply. We do not emit faders, V-Pot rotations, jog-wheel moves, channel-strip selects, automation mode changes, or any of the rest of the MCU vocabulary. We do not parse those inbound either (LUNA sends the full surface state for an 8-strip mixer, which we ignore aside from the 10-digit position display).
- Sample-accurate positioning — bar-accurate is the bar; tape audio sync handles finer chase
- Locate during playback — SPP received while LUNA is playing is ignored
- LUNA nudge value greater than 1 bar — closed-loop assumes `[` / `]` moves ≤ 1 bar; larger nudge values are detected at runtime and surfaced as a configuration error rather than silently misbehaving
- GUI -- CLI with config file only
- Windows support in v1
- Program Change to marker navigation (future feature)
- Novation LaunchControl XL integration (future use case)
- General-purpose preset system (future -- v1 is hardcoded MC-500 to LUNA mapping)

## Dependencies

- None on other audiocontrol modules -- standalone Rust binary
- Hardware (Phases 1-2): MC-500mkII connected via MIDI interface, LUNA installed
- Hardware (Phases 3-4): the user configures LUNA's MIDI Control Surfaces to select `MIDI Macro Bridge` (the virtual endpoint pair registered by the bridge at startup) as both INPUT DEVICE and OUTPUT DEVICE on a free control-surface row, protocol MCU. No additional MIDI cabling or routing is required — the bridge is the endpoint LUNA talks to.

## Open Questions

- enigo 0.2 API compatibility -- need to verify current crate version matches scaffolded code *(resolved in Phase 1: enigo 0.2.1 API matches)*
- midir 0.10 API compatibility -- similar concern *(resolved in Phase 1: midir 0.10.4 API matches)*
- **What exact position messages does LUNA emit on the MCU output, and at what rate?** The MCU protocol defines multiple position-reporting paths (timecode display SysEx, BEATS-mode display). Phase 3's first task is reverse-engineering the actual byte stream; this informs the parser design.
- **Does LUNA's `[` / `]` keystroke honour the nudge-value setting, and does that setting map to musical bars or to some raw tick count?** Phase 4 hardware validation answers this empirically.

## Appendix: Known MC-500 hardware quirks

Documented after 2026-04-23 hardware testing — not bridge bugs,
hardware limitations of the Roland MC-500mkII.

**SPP is gated by MIDI sync mode, and the gate is one-way at a time.**
The MC-500 only accepts inbound SPP when in MIDI sync mode, and it
only sends outbound SPP when *not* in MIDI sync mode. The two paths
are mutually exclusive — the user picks which direction to enable:

- **MIDI sync mode OFF** (default for the bridge's locate feature):
  MC-500 sends SPP when the user hits LOCATE → bridge drives LUNA
  via closed-loop locate. But sync-on-stop (bridge → MC-500 SPP)
  is ignored.
- **MIDI sync mode ON**: MC-500 accepts SPP from the bridge →
  sync-on-stop works (MC-500 follows LUNA's snapped position). But
  the MC-500 no longer sends SPP on LOCATE, so closed-loop locate
  from the MC-500 side stops working.

**Implication for users:** if you want the bridge to drive LUNA
from MC-500 LOCATE, keep the MC-500 out of MIDI sync mode and
accept that sync-on-stop is a no-op (manually return the MC-500
to bar 1 as part of your Stop workflow). If you want sync-on-stop
to mirror LUNA's behaviour, enable MIDI sync mode and drive locate
some other way.

This is not something the bridge can solve — SPP is the only
position-exchange primitive in the MIDI spec that the MC-500
honours, and the MC-500 firmware gates it by mode.

## Appendix: Future Direction

This service will evolve into a general-purpose MIDI-to-macro translator with:

- Device presets (MC-500, Novation LaunchControl XL)
- DAW presets (LUNA, Logic, Ableton)
- Configurable MIDI CC/note to keystroke/macro mappings
- Possibly a menu bar app wrapper

## Appendix: Open-Loop Locate Fallback (fragile, documented for completeness only)

If closed-loop locate (Phase 3-4 primary approach) turns out to be unworkable in practice — for example, LUNA's MCU position output doesn't report position reliably enough, or the round-trip latency between keystroke and position update is too high to run an iterative loop — an open-loop strategy exists but is **not a drop-in substitute**:

- Parse SPP, compute target bar from a configured time signature
- Always rewind to bar 0 (Return), then emit *N* `BarForward` keystrokes to advance
- User-configured time signature in the `[locate]` TOML section; documented LUNA nudge-value precondition (nudge must equal one bar)
- Atomic-locate state machine stays the same (`Locating` state, coalesce SPP while locating, Stop cancels, Start-during-locate becomes Continue)

Why this is a last resort, not a graceful fallback — the MC-500's sync behaviour doesn't forgive landing-error:

- **Any bar-off locate is permanent.** Tape sync preserves whatever offset exists at sync-lock time; it does not chase LUNA's absolute position. A single keystroke miscount puts MC-500 and LUNA out of sync for the rest of the session.
- **The bridge cannot verify correctness.** Without an MCU position feed there is no way to detect that a locate landed wrong — the error only surfaces when the user notices audio isn't on the expected downbeat.
- **Three silent failure modes stack.** LUNA's nudge-value setting not matching 1 bar, time-signature mismatches mid-song, or LUNA dropping a keystroke under load all produce bar-off locates with no in-band signal.
- **Large locates are slow regardless.** Locate to bar 200 emits 200 keystrokes (~4 s at 20 ms per stroke) even when nothing goes wrong.

If Phase 4 shows closed-loop cannot be made reliable, the right response is to re-evaluate the problem rather than ship open-loop — perhaps by finding another LUNA output path that reports position, by constraining the user to session layouts where MC-500 and LUNA both reset to bar 1 on every locate, or by marking the feature unsupported until LUNA exposes a machine-readable position feed. Open-loop without closed-loop verification is not safe enough to ship as the primary path for this user's workflow.
