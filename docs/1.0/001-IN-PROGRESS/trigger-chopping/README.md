# Trigger Chopping

**Status:** Planning
**Branch:** `feature/s550-support`
**Milestone:** TBD

## Overview

Real-time trigger-based sample chopping for the `@audiocontrol/sample-chopper` module. Audio plays back and the user marks slice points by hitting keys or MIDI pads as they listen — the workflow used by MPC, SP-404mkII, Maschine, and other hardware samplers.

## Documentation

- [PRD](./prd.md) - Product requirements, user stories, scope
- [Workplan](./workplan.md) - Implementation phases and technical approach

## Quick Links

- **Module:** `modules/sample-chopper/`
- **Dev Harness:** `pnpm --filter sample-chopper dev` → http://localhost:3331

## Key Design Decisions

1. **New "Trigger" tab** — distinct from manual mode, with idle/armed/recording/complete states
2. **Keyboard-first, MIDI optional** — works without MIDI, enhanced with it
3. **No new algorithm types** — produces manual slices, same data model
4. **Two hooks** — `useTriggerInput` (capture) + `useTriggerRecording` (slices)

## Implementation Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Low-latency position tracking | Pending |
| 2 | Extend slice method types | Pending |
| 3 | Trigger input hook | Pending |
| 4 | Trigger recording hook | Pending |
| 5 | Trigger tab UI | Pending |
| 6 | Dialog integration | Pending |
| 7 | Verification | Pending |
