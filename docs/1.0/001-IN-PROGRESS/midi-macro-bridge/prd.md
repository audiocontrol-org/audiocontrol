# MIDI Macro Bridge — Product Requirements Document

**Status:** Approved
**Owner:** Orion
**Created:** 2026-04-22

## Problem Statement

There is no way to control LUNA's transport from the MC-500mkII sequencer. LUNA does not support MMC, and MCU lacks locate-to-position. The validated approach is translating MIDI transport bytes into keyboard events. A working Rust implementation exists in a standalone zip but needs to be integrated into the audiocontrol monorepo as a service.

## User Stories

- As a studio user, I want to hit Play/Stop/Continue on the MC-500 and have LUNA follow, so I can use the hardware sequencer as my transport controller.
- As a developer, I want the bridge integrated into the monorepo build system, so it is built and tested alongside other services.

## Success Criteria

- `services/midi-macro-bridge/` exists as a Rust service in the monorepo
- `cargo test` passes for all unit tests (state machine, MIDI parser, config)
- `cargo build --release` produces a working macOS binary
- `--list-ports` shows available MIDI inputs
- `--self-test` emits keystrokes to LUNA when focused
- Root Makefile has a `build-midi-macro-bridge` target
- Hardware-validated: MC-500 Play/Stop/Continue controls LUNA transport

## In Scope

- Integrate existing Rust code into `services/midi-macro-bridge/`
- MIDI transport byte translation (0xFA Start, 0xFB Continue, 0xFC Stop)
- Keystroke synthesis via enigo (Space for play/stop toggle, Return for return-to-zero)
- Frontmost-app check (macOS only, via osascript)
- Config file (TOML) with port name, delay, frontmost app filter
- State machine for echo/feedback resilience
- `--list-ports` and `--self-test` CLI modes
- Makefile build target

## Out of Scope

- SPP (Song Position Pointer) -- LUNA cannot accept absolute position
- MIDI clock forwarding
- MCU feedback / bidirectional sync
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
