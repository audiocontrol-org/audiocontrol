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
- Hardware-validated: MC-500 LOCATE drives LUNA to the matching bar (4/4 time, bar-accurate, audio-sync covers finer alignment)

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

### Phases 3–4 (this extension)

- SPP-driven locate: parse Song Position Pointer (`0xF2 ll hh`), convert to target bar using configured time signature, drive LUNA's playhead with `[` / `]` keystrokes (Pro Tools style bar-step, inherited by LUNA). Open-loop; tape audio-sync covers finer alignment.
- Extend `KeyAction` with `BarForward` / `BarBackward` (bracket keys; numpad 1/2 opt-in via config)
- Extend state machine with a `Locating` state and atomic-locate semantics: SPP events coalesced while locating, Stop cancels the in-flight locate, Start arriving during locate is queued as Continue so the played-from-zero rewind doesn't undo the locate
- Add `[locate]` TOML section: `enabled`, `time_signature_numerator`, `time_signature_denominator`, `use_numpad_keys`
- `info!`-level logging of every locate (raw SPP, target bar, time signature, keystroke count) for diagnosability
- Document the LUNA nudge-value precondition in README (or drop it once we confirm empirically that `[` / `]` always move exactly one bar)

## Out of Scope

- MIDI clock forwarding
- MCU feedback / bidirectional sync (closed-loop position tracking, MCU surface emulation)
- Tempo / time-signature changes mid-song — v1 assumes a single time signature per session, set in config
- Sample-accurate positioning — bar-accurate is the bar; tape audio sync handles finer chase
- Locate during playback — SPP received while LUNA is playing is ignored
- Backward-locate optimisation (skipping the rewind when moving a short distance back) — always-rewind-on-locate is sufficient for v1
- GUI -- CLI with config file only
- Windows support in v1
- Program Change to marker navigation (future feature)
- Novation LaunchControl XL integration (future use case)
- General-purpose preset system (future -- v1 is hardcoded MC-500 to LUNA mapping)

## Dependencies

- None on other audiocontrol modules -- standalone Rust binary
- Hardware: MC-500mkII connected via MIDI interface, LUNA installed

## Open Questions

- enigo 0.2 API compatibility -- need to verify current crate version matches scaffolded code
- midir 0.10 API compatibility -- similar concern

## Appendix: Future Direction

This service will evolve into a general-purpose MIDI-to-macro translator with:

- Device presets (MC-500, Novation LaunchControl XL)
- DAW presets (LUNA, Logic, Ableton)
- Configurable MIDI CC/note to keystroke/macro mappings
- Possibly a menu bar app wrapper
