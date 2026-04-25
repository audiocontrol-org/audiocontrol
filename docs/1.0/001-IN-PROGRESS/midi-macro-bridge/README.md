# MIDI Macro Bridge

**Branch:** `feature/midi-macro-bridge`
**Worktree:** `~/work/audiocontrol-work/audiocontrol-midi-macro-bridge`
**Overall Status:** Phases 1-2 shipped via [#316](https://github.com/audiocontrol-org/audiocontrol/pull/316). Phases 3-4 shipped via [#317](https://github.com/audiocontrol-org/audiocontrol/pull/317). Decade-boundary tolerance fix open in [#318](https://github.com/audiocontrol-org/audiocontrol/pull/318).

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Integration and Build | Complete | Shipped in #316. |
| Phase 2: Hardware Validation | Complete | MC-500 → 828mk3 → LUNA transport round trip verified. Shipped in #316. |
| Phase 3: MCU Transport + Closed-Loop Locate Implementation | Complete | MCU input parser, heartbeat responder, byte-sequence discovery, Backend trait (MCU default / keystrokes fallback), Locating state, LocateController, main-loop integration, stable CoreMIDI UniqueIDs, sync-on-stop. 84 unit tests passing. |
| Phase 4: Hardware Validation | Complete (core scenarios) | User confirmed MCU transport with LUNA backgrounded + forward/backward locate + post-locate PLAY + sync-on-stop. Edge-case scenarios (TS changes, nudge-size misconfig, LUNA disconnect mid-locate, keystrokes regression) covered by unit tests; not exercised on hardware this session. |
| Tolerance: decade-boundary overshoot | PR Open ([#318](https://github.com/audiocontrol-org/audiocontrol/pull/318)) | Closed-loop locate to LUNA was overshooting at every decade crossing because the controller consumed only the first of LUNA's two-phase d7+d8 CC pair. Fixed by draining companion CCs (5 ms settle) before reporting bar; tracker filter for bar=0 transient as defense-in-depth. Hardware-validated. |

## Documentation

- [PRD](prd.md)
- [Workplan](workplan.md)
- [Implementation Summary](implementation-summary.md)

## GitHub Tracking

- Phases 1-2 Pull Request: [#316](https://github.com/audiocontrol-org/audiocontrol/pull/316) (merged)
- Phases 3-4 Pull Request: [#317](https://github.com/audiocontrol-org/audiocontrol/pull/317) (merged)
- Tolerance fix Pull Request: [#318](https://github.com/audiocontrol-org/audiocontrol/pull/318) (open)
- Milestone: TBD
- Parent Issue: TBD
