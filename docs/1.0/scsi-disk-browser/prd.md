# SCSI Disk Browser - Product Requirements Document

**Created:** 2026-04-06
**Status:** Draft
**Owner:** Orion Letizi

## Problem Statement

The audiocontrol SCSI-over-network stack can send SysEx commands and SDS sample uploads to the Akai S3000XL over SCSI, but **receiving sample waveform data over SCSI remains unsolved** — the S3000XL firmware does not route SDS Data Packets through its SCSI response buffer, and the RSPACK opcode returns empty responses over the SCSI MIDI channel.

Meanwhile, the MESA II reverse-engineering effort revealed that Akai's own software **never transfers sample data via SysEx**. MESA II reads and writes sample waveform data by directly accessing the Akai-formatted SCSI disks using native SCSI READ/WRITE block commands. The "Sample data can only be transferred using SCSI" message in MESA refers to native SCSI block I/O, not the MIDI-via-SCSI channel.

The infrastructure to do this over the network already exists across three repos:

1. **scsi2pi fork** (`audiocontrol-org/scsi2pi`) — The `SCSI_EXEC` protobuf operation (op 210) supports READ(6/10) and WRITE(6/10) against emulated disk images served by s2p. This is the same operation the SheepShaver network SCSI backend uses to boot Mac OS 9 and mount disk images remotely.

2. **Rust bridge daemon** (`services/scsi-midi-bridge/`) — Runs on the Pi and bridges browser HTTP/WebSocket to the s2p protobuf API. Currently only supports MIDI operations (200-203); needs extension to support `SCSI_EXEC` (210) for disk block I/O.

3. **Akai disk format knowledge** — The codebase has complete TypeScript types for the Akai disk hierarchy (partitions, volumes, programs, samples) in `sampler-devices`, and `sampler-export` has a disk image extractor. However, the existing disk I/O shells out to Perl `akaitools` binaries and cannot run in the browser.

This feature connects these pieces: extend the bridge with SCSI block I/O endpoints, build a browser-safe TypeScript Akai disk parser, and add a disk browser to the S3000XL editor library page that reads and writes Akai disks over the network.

## User Stories

- As a musician, I want to browse the contents of Akai disks mounted on the sampler's SCSI bus from my browser so that I can see what programs and samples are stored on each disk
- As a musician, I want to download samples from an Akai disk to my library over the network so that I can back up and edit sounds without physically removing the disk
- As a musician, I want to upload samples and programs to an Akai disk over the network so that I can load new content onto the sampler without floppy disks or SCSI cables to my laptop
- As a sound designer, I want to copy programs between Akai disks and my browser-based library so that I can organize sounds across multiple disks
- As a developer, I want a browser-safe Akai disk format parser so that I can read and write Akai disk structures without shelling out to Perl

## Success Criteria

- [ ] Rust bridge daemon supports `SCSI_EXEC` for arbitrary SCSI commands (READ, WRITE, INQUIRY, READ CAPACITY)
- [ ] Bridge exposes HTTP endpoints for SCSI block read/write
- [ ] Browser-safe TypeScript Akai disk parser can read partition tables, volume directories, program headers, and sample headers from raw disk blocks
- [ ] Browser-safe TypeScript Akai disk writer can create/update programs, samples, and volume directory entries
- [ ] S3000XL editor library page includes a disk browser panel showing Akai disk contents (partitions → volumes → programs/samples)
- [ ] User can download a sample from an Akai disk to the browser library (reads blocks over network, extracts WAV)
- [ ] User can upload a sample from the browser library to an Akai disk (converts WAV to Akai format, writes blocks over network)
- [ ] User can download/upload programs (with keygroup data) between Akai disk and browser library

## Scope

### In Scope

**Rust bridge daemon extension:**
- Add `SCSI_EXEC` protobuf encoding to `S2pClient` (hand-rolled, matching existing pattern)
- Add HTTP endpoints: `POST /scsi/exec` (generic), plus convenience endpoints `POST /scsi/read` and `POST /scsi/write` for block I/O
- Support READ(10), WRITE(10), INQUIRY, READ CAPACITY, TEST UNIT READY

**TypeScript SCSI disk client** (new module or in `midi-core`):
- `ScsiDiskClient` that talks to bridge HTTP endpoints
- Methods: `readSectors(targetId, lba, count)`, `writeSectors(targetId, lba, data)`, `inquiry(targetId)`, `readCapacity(targetId)`
- Browser-safe (uses `fetch()`)

**Browser-safe Akai disk format parser** (new module or in `sampler-devices`):
- Parse Akai partition table from raw blocks
- Parse volume directory entries (programs, samples, file allocation)
- Parse program headers from raw blocks (nibble decoding)
- Parse sample headers from raw blocks
- Extract sample waveform data (raw PCM) from disk blocks
- Using the Perl `akaitools` source as a reference implementation
- All operations on `Uint8Array` / `ArrayBuffer` — no filesystem, no child processes

**Browser-safe Akai disk writer:**
- Write volume directory entries
- Write program headers (nibble encoding)
- Write sample headers and waveform data
- Allocate free blocks in volume

**Disk browser UI in S3000XL editor:**
- Disk browser panel on the library page (or as a new tab)
- Tree view: SCSI targets → partitions → volumes → programs/samples
- Select a program or sample to view metadata
- "Download to Library" action: reads blocks, extracts data, saves to browser library
- "Upload to Disk" action: reads from library, converts to Akai format, writes blocks
- Progress indicator for multi-block transfers

### Out of Scope

- Formatting Akai disks from the browser (too destructive for a first pass; use the sampler's built-in format function)
- Partition creation or resizing
- Supporting non-Akai disk formats on the SCSI bus
- Direct block-level access to the physical sampler's internal memory (we access the disk images s2p serves, not the sampler's RAM)
- Replacing the existing `sampler-export` Perl-based extractor (it continues to work for CLI/server use cases)

## Dependencies

- `audiocontrol-org/scsi2pi` fork (branch `feature/midi-processor`) — `SCSI_EXEC` already implemented and tested
- Rust bridge daemon (`services/scsi-midi-bridge/`) — needs extension
- `sampler-devices` — existing Akai type definitions (`AkaiDisk`, `AkaiPartition`, `AkaiVolume`, `AkaiRecord`)
- `sampler-export` — reference for disk image parsing logic
- Perl `akaitools` source — reference for Akai binary format details
- S3000XL editor library page (`akai-s3k-editor`) — UI integration point

## Open Questions

- [ ] Which SCSI IDs on the Pi are disk images vs the sampler itself? The sampler is at ID 6; disk images are typically at IDs 0-5. Need to enumerate and filter.
- [ ] What block size does s2p use for Akai disk images? Standard is 512 bytes but should verify via READ CAPACITY.
- [ ] Should the Akai disk parser be a standalone module (e.g., `akai-disk`) or added to `sampler-devices`?
- [ ] How should concurrent access be handled — can the sampler and the browser both access the same disk image simultaneously without corruption?
- [ ] Do we need to send a SCSI bus reset or re-mount command to the sampler after writing blocks to a disk image so it picks up changes?

## Appendix

### Architecture

```
┌───────────────────────────────────┐
│  Browser (S3000XL Editor)         │
│  ├─ Disk Browser UI               │
│  ├─ ScsiDiskClient (fetch)        │
│  └─ AkaiDiskParser (Uint8Array)   │
└──────────────┬────────────────────┘
               │ HTTP (JSON + binary)
               │
┌──────────────▼────────────────────┐
│  Rust Bridge Daemon (Pi)          │
│  ├─ /scsi/exec  → SCSI_EXEC      │
│  ├─ /scsi/read  → READ(10)       │
│  ├─ /scsi/write → WRITE(10)      │
│  └─ /sds/send   → MIDI_SEND      │  (existing)
└──────────────┬────────────────────┘
               │ Protobuf (port 6868)
               │
┌──────────────▼────────────────────┐
│  s2p (scsi2pi fork)               │
│  ├─ SCSI_EXEC handler             │
│  ├─ Emulated disk devices (SCHD)  │
│  │   ├─ ID 0: disk0.hds           │
│  │   ├─ ID 1: disk1.hds           │
│  │   └─ ...                       │
│  └─ Physical bus (ID 6: S3000XL)  │
└───────────────────────────────────┘
```

### Akai Disk Structure

```
Disk Image (.hds)
├── Partition 1
│   └── Volume "VOLUME 1"
│       ├── Program "PIANO   " (.a3p)
│       │   ├── Program Header (192 bytes)
│       │   └── Keygroups 0-N
│       ├── Sample "PIANO-C3" (.a3s)
│       │   ├── Sample Header
│       │   └── Waveform Data (16-bit PCM)
│       └── Sample "PIANO-G3" (.a3s)
├── Partition 2
│   └── Volume "VOLUME 2"
│       └── ...
└── ...
```

### Existing Code to Leverage

| What | Where | Browser-Safe? |
|------|-------|---------------|
| Akai type definitions (AkaiDisk, AkaiPartition, etc.) | `sampler-devices/src/io/akaitools-core.ts` | Types only — yes |
| Program header types (ProgramHeader, KeygroupHeader) | `sampler-devices/src/devices/s3000xl/` | Yes |
| Nibble encoding/decoding | `sampler-devices/src/devices/s3000xl/` | Yes |
| Disk extractor logic | `sampler-export/src/lib/extractor/disk-extractor.ts` | No (Node.js) |
| akaitools Perl source | External dependency | No (reference only) |
| SCSI_EXEC protobuf format | `scsi2pi/api/s2p_interface.proto` | N/A (server) |
| Hand-rolled protobuf encoding | `scsi-midi-bridge/src/s2p_client.rs` | N/A (Rust) |

### SCSI Commands for Disk Access

| Command | CDB | Purpose |
|---------|-----|---------|
| INQUIRY | `12 00 00 00 24 00` | Identify device type, vendor, product |
| TEST UNIT READY | `00 00 00 00 00 00` | Check if disk is accessible |
| READ CAPACITY | `25 00 00 00 00 00 00 00 00 00` | Get total blocks and block size |
| READ(10) | `28 00 [LBA 4B] 00 [count 2B] 00` | Read disk blocks |
| WRITE(10) | `2A 00 [LBA 4B] 00 [count 2B] 00` | Write disk blocks |
