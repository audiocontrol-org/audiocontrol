# MIDI Macro Bridge — Product Requirements Document

**Status:** Approved
**Owner:** Orion
**Created:** 2026-04-22

## Problem Statement

There is no way to control LUNA's transport from the MC-500mkII sequencer. LUNA does not support MMC, and MCU lacks locate-to-position. The validated approach is translating MIDI transport bytes into keyboard events. A working Rust implementation exists in a standalone zip but needs to be integrated into the audiocontrol monorepo as a service.

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
- Hardware-validated: MC-500 Play/Stop/Continue controls LUNA transport
- Hardware-validated: MC-500 LOCATE drives LUNA to the matching bar *exactly* (no 1-bar-off errors), regardless of time signature, via closed-loop nudging against LUNA's MCU position output

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

### Phases 3–4 (this extension) — closed-loop locate

- SPP-driven locate: parse Song Position Pointer (`0xF2 ll hh`) as the *target* (bar destination requested by the MC-500); drive LUNA's playhead to that target by iteratively emitting `[` / `]` keystrokes and reading LUNA's MCU position output to verify each nudge landed where expected. Closed-loop is required, not optimising — a bar-off locate would leave the MC-500 running with a persistent bar-offset against LUNA for the rest of the session.
- Parse LUNA's MCU position output (bars/beats/subdivisions) and maintain a tracked-playhead model used for both closed-loop verification and deciding nudge direction.
- Extend `KeyAction` with `BarForward` / `BarBackward` (bracket keys; numpad 1/2 opt-in via config).
- Extend state machine with a `Locating` state and atomic-locate semantics: SPP events coalesced while locating, Stop cancels the in-flight locate, Start arriving during locate is queued as Continue so the played-from-zero rewind doesn't undo the locate.
- Add `[locate]` TOML section: `enabled`, `mcu_input_port` (substring match, may be the same port as transport or separate), `max_iterations` safety cap, `use_numpad_keys`.
- `info!`-level logging of every locate: target bar (from SPP), starting bar (from MCU), per-iteration keystroke + delta, final bar, total iterations — fully diagnosable when locates misfire.
- Closed-loop naturally supports bidirectional navigation: move in whichever direction (forward or backward) is closer to the target; no always-rewind penalty.

**Deliberate closed-loop constraint:** the approach only works if LUNA's `[` / `]` keystroke moves the playhead by ≤ 1 bar. If the user has configured a nudge value larger than 1 bar, closed-loop will overshoot and potentially oscillate — detect this (delta reverses sign between iterations) and abort with a clear error message directing the user to reconfigure LUNA's nudge value to ≤ 1 bar. Falling back to open-loop is an option if this turns out to be unworkable (see Appendix: Open-Loop Locate Fallback).

## Out of Scope

- MIDI clock forwarding
- **Full** MCU surface emulation (transport, automation, channel strip control). Phases 3-4 consume only the MCU *position* output stream for closed-loop locate verification — we do not emit MCU messages back toward LUNA, nor parse the rest of the MCU protocol.
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
- Hardware (Phases 3-4): LUNA's MCU position output reaching the bridge's MIDI input (either LUNA's MCU virtual output routed to the same 828mk3 input the MC-500 uses, or a second MIDI input the bridge is configured to read)

## Open Questions

- enigo 0.2 API compatibility -- need to verify current crate version matches scaffolded code *(resolved in Phase 1: enigo 0.2.1 API matches)*
- midir 0.10 API compatibility -- similar concern *(resolved in Phase 1: midir 0.10.4 API matches)*
- **What exact position messages does LUNA emit on the MCU output, and at what rate?** The MCU protocol defines multiple position-reporting paths (timecode display SysEx, BEATS-mode display). Phase 3's first task is reverse-engineering the actual byte stream; this informs the parser design.
- **Does LUNA's `[` / `]` keystroke honour the nudge-value setting, and does that setting map to musical bars or to some raw tick count?** Phase 4 hardware validation answers this empirically.

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
