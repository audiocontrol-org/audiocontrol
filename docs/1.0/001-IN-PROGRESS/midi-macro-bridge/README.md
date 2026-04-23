# MIDI Macro Bridge

**Branch:** `feature/midi-macro-bridge`
**Worktree:** `~/work/audiocontrol-work/audiocontrol-midi-macro-bridge`
**Overall Status:** Phases 1-2 shipped via [#316](https://github.com/audiocontrol-org/audiocontrol/pull/316); Phases 3-4 (SPP-driven locate) in progress.

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Integration and Build | Complete | Shipped in #316. |
| Phase 2: Hardware Validation | Complete | MC-500 → 828mk3 → LUNA transport round trip verified. Shipped in #316. |
| Phase 3: SPP Locate Implementation | Not Started | Adds `Locating` state, SPP parsing, bar-step keystrokes, `[locate]` config. |
| Phase 4: SPP Locate Hardware Validation | Not Started | Verify MC-500 LOCATE drives LUNA's playhead in 4/4. |

## Documentation

- [PRD](prd.md)
- [Workplan](workplan.md)
- [Implementation Summary](implementation-summary.md)

## GitHub Tracking

- Phases 1-2 Pull Request: [#316](https://github.com/audiocontrol-org/audiocontrol/pull/316) (merged)
- Phases 3-4 Pull Request: TBD
- Milestone: TBD
- Parent Issue: TBD
