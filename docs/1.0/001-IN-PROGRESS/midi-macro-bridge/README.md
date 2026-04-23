# MIDI Macro Bridge

**Branch:** `feature/midi-macro-bridge`
**Worktree:** `~/work/audiocontrol-work/audiocontrol-midi-macro-bridge`
**Overall Status:** Phases 1-2 shipped via [#316](https://github.com/audiocontrol-org/audiocontrol/pull/316); Phases 3-4 (SPP-driven locate) in progress.

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Integration and Build | Complete | Shipped in #316. |
| Phase 2: Hardware Validation | Complete | MC-500 → 828mk3 → LUNA transport round trip verified. Shipped in #316. |
| Phase 3: MCU Transport + Closed-Loop Locate Implementation | In Progress | Probe complete (MCU-NOTES.md). Broken into 6 sub-phases (3a–3f): MCU input parser, heartbeat responder, MCU output discovery, Backend trait refactor (MCU default, keystrokes fallback), LocateController, integration. |
| Phase 4: Hardware Validation | Not Started | Transport via MCU with LUNA backgrounded; closed-loop locate across TS changes; keystroke-backend regression. |

## Documentation

- [PRD](prd.md)
- [Workplan](workplan.md)
- [Implementation Summary](implementation-summary.md)

## GitHub Tracking

- Phases 1-2 Pull Request: [#316](https://github.com/audiocontrol-org/audiocontrol/pull/316) (merged)
- Phases 3-4 Pull Request: TBD
- Milestone: TBD
- Parent Issue: TBD
