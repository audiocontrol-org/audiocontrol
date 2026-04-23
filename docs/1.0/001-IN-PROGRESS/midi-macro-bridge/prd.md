# MIDI Macro Bridge — Product Requirements Document

**Status:** Approved
**Owner:** Orion
**Created:** 2026-04-22

## Problem Statement

There is no way to control LUNA's transport from the MC-500mkII sequencer. LUNA does not support MMC, and MCU lacks locate-to-position. The validated approach is translating MIDI transport bytes into keyboard events. A working Rust implementation exists in a standalone zip but needs to be integrated into the audiocontrol monorepo as a service.

## User Stories

- As a studio user, I want to hit Play/Stop/Continue on the MC-500 and have LUNA follow, so I can use the hardware sequencer as my transport controller.
- As a developer, I want the bridge integrated into the monorepo build system, so it is built and tested alongside other services.
- As a studio user, I want locating on the MC-500 (LOCATE button, numeric entry, or locate-memory recall) to move LUNA's playhead to the same bar, so I can use the MC-500 as a positioning controller. Bar-accurate is sufficient — audio tape sync covers the rest.

## Success Criteria

- `services/midi-macro-bridge/` exists as a Rust service in the monorepo
- `cargo test` passes for all unit tests (state machine, MIDI parser, config, locate)
- `cargo build --release` produces a working macOS binary
- `--list-ports` shows available MIDI inputs
- `--self-test` emits keystrokes to LUNA when focused
- Root Makefile has a `build-midi-macro-bridge` target
- Hardware-validated: MC-500 Play/Stop/Continue controls LUNA transport
- Hardware-validated: MC-500 LOCATE drives LUNA to the matching bar, regardless of time signature, via closed-loop nudging against LUNA's MCU position output

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

- SPP-driven locate: parse Song Position Pointer (`0xF2 ll hh`) as the *target* (bar destination requested by the MC-500); drive LUNA's playhead to that target by iteratively emitting `[` / `]` keystrokes and reading LUNA's MCU position output to verify each nudge landed where expected.
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

## Appendix: Open-Loop Locate Fallback (deferred unless needed)

If closed-loop locate (Phase 3-4 primary approach) turns out to be unworkable in practice — for example, LUNA's MCU position output doesn't report position reliably enough, or the round-trip latency between keystroke and position update is too high to run an iterative loop — the following open-loop strategy is the fallback:

- Parse SPP, compute target bar from a configured time signature
- Always rewind to bar 0 (Return), then emit *N* `BarForward` keystrokes to advance
- User-configured time signature in the `[locate]` TOML section; documented LUNA nudge-value precondition (nudge must equal one bar)
- Atomic-locate state machine stays the same (`Locating` state, coalesce SPP while locating, Stop cancels, Start-during-locate becomes Continue)

Downsides that motivate trying closed-loop first:

- Locate to bar 200 emits 200 keystrokes (4 s at 20 ms per stroke)
- Time signature changes mid-song are not handled — first-TS assumption drifts
- LUNA nudge-value setting must match the bridge's expectations or locates land on the wrong bar

Revisit only if Phase 4 hardware validation shows closed-loop cannot be made reliable.
