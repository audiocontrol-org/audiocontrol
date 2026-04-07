# SCSI Disk Browser

**Status:** Planning
**Feature Branch:** `feature/scsi-disk-browser`

## Overview

Read and write Akai-formatted SCSI disks over the network from the S3000XL web editor. Extends the existing SCSI bridge daemon with block I/O endpoints, adds a browser-safe Akai disk format parser, and integrates a disk browser into the editor's library page. Enables sample and program transfer between Akai disks and the browser library without SDS — using native SCSI READ/WRITE, the same approach Akai's own MESA II software uses.

## Tracking

- **GitHub Issue:** TBD
- **GitHub Milestone:** TBD

## Documentation

- [Product Requirements (PRD)](https://github.com/audiocontrol-org/audiocontrol/blob/feature/scsi-disk-browser/docs/1.0/scsi-disk-browser/prd.md)
- [Workplan](https://github.com/audiocontrol-org/audiocontrol/blob/feature/scsi-disk-browser/docs/1.0/scsi-disk-browser/workplan.md)
- [Implementation Summary](https://github.com/audiocontrol-org/audiocontrol/blob/feature/scsi-disk-browser/docs/1.0/scsi-disk-browser/implementation-summary.md)

## Related Features

- [SCSI MIDI Bridge](https://github.com/audiocontrol-org/audiocontrol/blob/main/docs/1.0/scsi-midi-bridge/README.md) — The bridge daemon this feature extends
- [SCSI Efforts Reconciliation](https://github.com/audiocontrol-org/audiocontrol/blob/main/docs/1.0/scsi-midi-bridge/reconciliation-scsi2pi-efforts.md) — How SCSI_EXEC relates to MIDI_* operations
- [S3K Library Page](https://github.com/audiocontrol-org/audiocontrol/blob/feature/s3k-library-page/docs/1.0/s3k-library-page/README.md) — UI integration target
