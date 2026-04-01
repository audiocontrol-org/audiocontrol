# SCSI MIDI Bridge

**Status:** Planning
**Feature Branch:** `feature/midi-sds`

## Overview

Bidirectional audio sample transfer between audiocontrol and vintage SCSI-equipped samplers (initially Akai S3000XL) over WiFi. A Raspberry Pi running SCSI2Pi bridges the SCSI bus to the network via HTTP/WebSocket, enabling MIDI SysEx (including SDS) to be transmitted over the SCSI bus instead of a MIDI cable. The payload is byte-for-byte identical to standard MIDI; only the physical transport changes. SCSI is orders of magnitude faster than MIDI's 31.25 kbaud.

This feature builds on the completed [MIDI SDS](https://github.com/audiocontrol-org/audiocontrol/blob/feature/midi-sds/docs/1.0/midi-sds/README.md) feature, which delivered the generic SDS protocol layer, S3000XL client integration, and editor UI.

## Tracking

- **GitHub Issue:** TBD
- **GitHub Milestone:** TBD

## Documentation

- [Product Requirements (PRD)](https://github.com/audiocontrol-org/audiocontrol/blob/feature/midi-sds/docs/1.0/scsi-midi-bridge/prd.md)
- [Workplan](https://github.com/audiocontrol-org/audiocontrol/blob/feature/midi-sds/docs/1.0/scsi-midi-bridge/workplan.md)
- [Implementation Summary](https://github.com/audiocontrol-org/audiocontrol/blob/feature/midi-sds/docs/1.0/scsi-midi-bridge/implementation-summary.md)
