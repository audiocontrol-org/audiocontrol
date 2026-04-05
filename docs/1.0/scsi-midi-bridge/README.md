# SCSI MIDI Bridge

**Status:** Implemented (Phases 2-5), hardware validated
**Feature Branch:** `feature/scsi-midi-bridge`

## Overview

Bidirectional audio sample transfer and parameter editing between audiocontrol and the Akai S3000XL over WiFi via SCSI. A Raspberry Pi running SCSI2Pi bridges the SCSI bus to the network via HTTP/WebSocket, enabling MIDI SysEx to be transmitted over the SCSI bus instead of a MIDI cable. The payload is byte-for-byte identical to standard MIDI; only the physical transport changes.

## Tracking

- **GitHub Issue:** TBD
- **GitHub Milestone:** TBD

## Documentation

- [Product Requirements (PRD)](https://github.com/audiocontrol-org/audiocontrol/blob/feature/scsi-midi-bridge/docs/1.0/scsi-midi-bridge/prd.md)
- [Workplan](https://github.com/audiocontrol-org/audiocontrol/blob/feature/scsi-midi-bridge/docs/1.0/scsi-midi-bridge/workplan.md)
- [Implementation Summary](https://github.com/audiocontrol-org/audiocontrol/blob/feature/scsi-midi-bridge/docs/1.0/scsi-midi-bridge/implementation-summary.md)

## Research

- [Capture Notes](https://github.com/audiocontrol-org/audiocontrol/blob/feature/scsi-midi-bridge/docs/1.0/scsi-midi-bridge/capture-notes.md) — Full MIDI-via-SCSI protocol decode
- [MESA II Analysis](https://github.com/audiocontrol-org/audiocontrol/blob/feature/scsi-midi-bridge/docs/1.0/scsi-midi-bridge/mesa-ii-analysis.md) — Reverse-engineered Akai SCSI Plug binary
- [Phase 2 Findings](https://github.com/audiocontrol-org/audiocontrol/blob/feature/scsi-midi-bridge/docs/1.0/scsi-midi-bridge/findings-phase2.md) — s2pexec/s2p bus contention
- [E2E Test Plan](https://github.com/audiocontrol-org/audiocontrol/blob/feature/scsi-midi-bridge/docs/1.0/scsi-midi-bridge/e2e-test-plan.md) — 7 test suites, 40+ tests
