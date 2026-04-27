# MIDI Macro Bridge

**Branch:** `feature/midi-macro-bridge-ableton`
**Worktree:** `~/work/audiocontrol-work/audiocontrol-midi-macro-bridge`
**Overall Status:** Phases 1-2 shipped via [#316](https://github.com/audiocontrol-org/audiocontrol/pull/316). Phases 3-4 shipped via [#317](https://github.com/audiocontrol-org/audiocontrol/pull/317). Decade-boundary tolerance fix shipped via [#318](https://github.com/audiocontrol-org/audiocontrol/pull/318). Idle byte-trace shipped via [#319](https://github.com/audiocontrol-org/audiocontrol/pull/319). Phase 5 (LCXL3 multi-input) + Ableton compatibility open for review in [#326](https://github.com/audiocontrol-org/audiocontrol/pull/326).

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Integration and Build | Complete | Shipped in #316. |
| Phase 2: Hardware Validation | Complete | MC-500 → 828mk3 → LUNA transport round trip verified. Shipped in #316. |
| Phase 3: MCU Transport + Closed-Loop Locate Implementation | Complete | MCU input parser, heartbeat responder, byte-sequence discovery, Backend trait (MCU default / keystrokes fallback), Locating state, LocateController, main-loop integration, stable CoreMIDI UniqueIDs, sync-on-stop. 84 unit tests passing. |
| Phase 4: Hardware Validation | Complete (core scenarios) | User confirmed MCU transport with LUNA backgrounded + forward/backward locate + post-locate PLAY + sync-on-stop. Edge-case scenarios (TS changes, nudge-size misconfig, LUNA disconnect mid-locate, keystrokes regression) covered by unit tests; not exercised on hardware this session. |
| Tolerance: decade-boundary overshoot | Complete | Shipped in [#318](https://github.com/audiocontrol-org/audiocontrol/pull/318). Closed-loop locate to LUNA was overshooting at every decade crossing because the controller consumed only the first of LUNA's two-phase d7+d8 CC pair. Fixed by draining companion CCs (5 ms settle) before reporting bar; tracker filter for bar=0 transient as defense-in-depth. Hardware-validated. |
| Idle byte-trace | Complete | Shipped in [#319](https://github.com/audiocontrol-org/audiocontrol/pull/319). Mirrored locate-window debug logging into `handle_mcu_byte_idle` so a single `RUST_LOG=debug` run captures every byte the DAW emits. Earned its keep diagnosing the Ableton multi-message-packet issue. |
| Ableton parser fixes | PR Open ([#326](https://github.com/audiocontrol-org/audiocontrol/pull/326)) | Multi-message MIDI splitter in `midi.rs` plus BBT separator-bit mask in `mcu.rs::DigitChar::from_byte`. Ableton bundles 10+ messages per CoreMIDI packet and uses `0x70-0x79` for "digit + dot" — both prevented its position CCs from being parsed. Tests added; bridge correctly tracks Ableton's playhead. |
| Phase 5: LCXL3 multi-input | PR Open ([#326](https://github.com/audiocontrol-org/audiocontrol/pull/326)) | LCXL3 as a second input source alongside MC-500. Sub-phases 5a (lcxl3 protocol module), 5b (state-machine variants), 5c (config), 5d (main wiring), 5e (hardware validation) all on `feature/midi-macro-bridge-ableton`. Hardware-validated 2026-04-27: Play/Stop toggle drives LUNA, jog encoder nudges bars, LED follows state, encoder during playback ignored, sync-on-stop still fires. 122 unit tests passing. |

## Documentation

- [PRD](prd.md)
- [Workplan](workplan.md)
- [Implementation Summary](implementation-summary.md)
- [LCXL3 handshake trace](lcxl3-handshake-trace.md) — annotated decode of the captured Live → LCXL3 init sequence (Phase 5 reference)

## GitHub Tracking

- Phases 1-2 Pull Request: [#316](https://github.com/audiocontrol-org/audiocontrol/pull/316) (merged)
- Phases 3-4 Pull Request: [#317](https://github.com/audiocontrol-org/audiocontrol/pull/317) (merged)
- Tolerance fix Pull Request: [#318](https://github.com/audiocontrol-org/audiocontrol/pull/318) (merged)
- Idle byte-trace Pull Request: [#319](https://github.com/audiocontrol-org/audiocontrol/pull/319) (merged)
- Phase 5 Parent Issue: [#320](https://github.com/audiocontrol-org/audiocontrol/issues/320)
- Phase 5a–5e Issues: [#321](https://github.com/audiocontrol-org/audiocontrol/issues/321), [#322](https://github.com/audiocontrol-org/audiocontrol/issues/322), [#323](https://github.com/audiocontrol-org/audiocontrol/issues/323), [#324](https://github.com/audiocontrol-org/audiocontrol/issues/324), [#325](https://github.com/audiocontrol-org/audiocontrol/issues/325)
- Milestone: TBD
