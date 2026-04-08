# SCSI Transport Optimization

**Status:** Planning
**Feature Branch:** `feature/scsi-transport-optimization`

## Overview

Optimize the SCSI-over-network transport chain for communicating with the Akai S3000XL. Current median round-trip latency is ~865ms, of which 87% is overhead from polling and per-command TCP reconnection. This feature introduces a persistent, event-driven communication path -- a MIDI streaming server in the scsi2pi fork, a persistent bridge client, and a bidirectional WebSocket to the browser -- to approach the hardware minimum of ~120ms.

## Tracking

- **GitHub Issue:** TBD
- **GitHub Milestone:** TBD

## Documentation

- [Product Requirements (PRD)](https://github.com/audiocontrol-org/audiocontrol/blob/feature/scsi-transport-optimization/docs/1.0/scsi-transport-optimization/prd.md)
- [Workplan](https://github.com/audiocontrol-org/audiocontrol/blob/feature/scsi-transport-optimization/docs/1.0/scsi-transport-optimization/workplan.md)
- [Implementation Summary](https://github.com/audiocontrol-org/audiocontrol/blob/feature/scsi-transport-optimization/docs/1.0/scsi-transport-optimization/implementation-summary.md)
