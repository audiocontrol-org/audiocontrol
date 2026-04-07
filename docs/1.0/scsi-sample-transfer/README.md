# SCSI Sample Transfer

**Status:** Planning
**Feature Branch:** `feature/scsi-transport-optimization`

## Overview

Retrieve sample audio data from the Akai S3000XL over the SCSI-over-network transport chain. The standard SDS (Sample Dump Standard) protocol requires per-packet ACK handshaking at SCSI bus speed, which is impossible over the network path (~500ms round trip vs microsecond requirement). This feature moves the SDS conversation inside the s2p streaming server on the Pi, where ACK timing is at bus speed. The client sends a single request and receives assembled PCM audio data.

## Tracking

- **GitHub Issue:** TBD
- **GitHub Milestone:** TBD

## Documentation

- [Product Requirements (PRD)](https://github.com/audiocontrol-org/audiocontrol/blob/feature/scsi-transport-optimization/docs/1.0/scsi-sample-transfer/prd.md)
- [Workplan](https://github.com/audiocontrol-org/audiocontrol/blob/feature/scsi-transport-optimization/docs/1.0/scsi-sample-transfer/workplan.md)
- [Implementation Summary](https://github.com/audiocontrol-org/audiocontrol/blob/feature/scsi-transport-optimization/docs/1.0/scsi-sample-transfer/implementation-summary.md)
