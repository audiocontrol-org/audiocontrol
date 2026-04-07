# SCSI Disk Browser - Product Requirements Document

**Created:** 2026-04-06
**Updated:** 2026-04-07
**Status:** In Progress
**Owner:** Orion Letizi

## Problem Statement

The S3000XL web editor can read and write device parameters over SCSI via SysEx, and can transfer sample audio via SDS over SCSI. But programs and samples stored on Akai-formatted SCSI disk images — the primary long-term storage for the S3000XL — are not accessible from the browser. Users cannot browse, download, upload, or organize disk content without physical access to the sampler.

The infrastructure exists across three repos (scsi2pi fork, Rust bridge daemon, browser-safe Akai parser), and Phases 1-3 of the disk browser are complete (SCSI block I/O, Akai format parsing, basic browser UI). What's missing is the integration layer that connects disk content to the editor's library system.

## User Stories

### Disk Browsing (COMPLETE)
- As a musician, I want to browse the contents of Akai disks mounted on the sampler's SCSI bus from my browser so that I can see what programs and samples are stored on each disk

### Disk ↔ S3K Library (NEW)
- As a musician, I want to download programs and samples from an Akai disk to my S3K library so that I can back up sounds without physically removing the disk
- As a musician, I want to upload programs and samples from my S3K library to an Akai disk so that I can load new content onto disk images without floppy disks or SCSI cables to my laptop
- As a musician, I want to download or upload entire volumes (all programs and samples in a volume) in a single operation

### Disk ↔ Common Library with Translation (NEW)
- As a musician, I want to download a sample from an Akai disk directly into my common library as a vendor-neutral WAV+metadata bundle so I can use it with other samplers
- As a musician, I want to upload a sample from my common library to an Akai disk, with automatic format conversion, so I can load content from any source onto the S3000XL
- As a musician, I want to download a program from an Akai disk into my common library as a vendor-neutral program (zones, key/velocity mappings, sample references) so I can translate it to other sampler formats

### S3K Library ↔ Common Library with Translation (NEW)
- As a musician, I want to promote an S3K-native program from my S3K library to the common library with automatic translation to vendor-neutral format
- As a musician, I want to import a program from the common library into my S3K library with automatic translation to Akai format

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Common Library                         │
│         (vendor-neutral: ProgramYaml, SampleYaml)        │
│         library/common/samples/{name}/                   │
│         library/common/programs/{name}/                  │
└──────────────────┬───────────────────────────────────────┘
                   │ translation (Akai ↔ vendor-neutral)
┌──────────────────▼───────────────────────────────────────┐
│                  S3K Library Section                      │
│         (Akai-native: raw disk bytes as base64)          │
│         library/s3k/programs/{name}/                     │
│         library/s3k/samples/{name}/                      │
└──────────────────┬───────────────────────────────────────┘
                   │ raw bytes (no translation needed)
┌──────────────────▼───────────────────────────────────────┐
│              PiSCSI Disk Images (.hds)                    │
│         SCSI block reads/writes via bridge               │
│         ID 0-5: disk images, ID 6: sampler               │
└──────────────────────────────────────────────────────────┘
```

Three bidirectional transfer paths:
1. **Disk ↔ S3K Library** — raw Akai disk bytes, no format conversion
2. **Disk ↔ Common Library** — Akai format ↔ vendor-neutral translation
3. **S3K Library ↔ Common Library** — same translation, different storage source

Four object granularities: whole disks, volumes, programs, samples.

## Success Criteria

### Already Complete (Phases 1-3)
- [x] Bridge supports SCSI_EXEC for READ/WRITE/INQUIRY/READ CAPACITY
- [x] Bridge exposes HTTP endpoints for SCSI block I/O
- [x] Browser-safe Akai disk parser reads partition tables, volumes, files, programs, samples
- [x] SDS sample transfer (download + upload) via SCSI_EXEC with WebSocket streaming
- [x] Disk browser UI panel shows Akai disk contents (targets → volumes → files)
- [x] TypeScript ScsiDiskClient with downloadSample/uploadSample

### New (Phases 5-7)
- [ ] User can download a program from disk to S3K library (preserving raw Akai bytes)
- [ ] User can download a sample from disk to S3K library (raw Akai header + WAV audio)
- [ ] User can upload a program from S3K library to disk
- [ ] User can upload a sample from S3K library to disk
- [ ] User can download a volume (all files) from disk to S3K library
- [ ] User can download a sample from disk to common library (translated to SampleYaml + WAV)
- [ ] User can download a program from disk to common library (translated to ProgramYaml + sample bundles)
- [ ] User can upload a common library sample to disk (translated from SampleYaml to Akai format)
- [ ] User can promote S3K library program to common library (translation)
- [ ] User can import common library program to S3K library (translation)
- [ ] Disk write serialization: programs and samples can be written back to Akai disk format (round-trip verified)

## Scope

### In Scope

**Disk ↔ S3K Library transfer:**
- Read raw file bytes from disk via FAT chain, store as base64 in S3K library YAML
- Write raw file bytes from S3K library back to disk (allocate blocks, update FAT, update directory)
- Program transfers include all keygroups
- Sample transfers include header + PCM waveform data
- Volume-level batch transfer (all files in a volume)

**Akai disk write serialization:**
- Write file data to disk blocks
- Allocate free blocks in volume FAT
- Create/update directory entries
- Round-trip verified: read → store → write → read → compare

**Translation layer (Akai ↔ vendor-neutral):**
- Akai program → ProgramYaml: map keygroups to zones (key range, velocity range, sample references)
- Akai sample → SampleYaml + WAV: extract metadata (rate, loop points, root key) and PCM audio
- ProgramYaml → Akai program: reverse mapping (zones to keygroups)
- SampleYaml + WAV → Akai sample: encode header + PCM in Akai on-disk format

**UI:**
- Download/upload actions on disk browser items (context menu or action buttons)
- Target selection (which library section, which volume for uploads)
- Progress indication for multi-block transfers
- Batch transfer for volumes

### Out of Scope

- Formatting Akai disks from the browser
- Partition creation or resizing
- Non-Akai disk formats
- Direct access to sampler RAM (use SysEx for that)

## Dependencies

- `sampler-library` — storage abstractions, common area schemas (ProgramYaml, SampleYaml)
- `sampler-translate` — existing abstract program/keygroup/zone types
- `sampler-devices` — Akai disk parser (existing), disk writer (new)
- `midi-core` — ScsiDiskClient (existing)
- `akai-s3k-editor` — library page UI, program storage/serialization

## Open Questions

- [ ] Should Akai disk write allocate blocks contiguously or use first-fit? (Contiguous is simpler and matches how Akai formats disks.)
- [ ] How should the sampler be notified after writing to a disk image? (May need to unmount/remount via s2p API, or the sampler may re-read on next access.)
- [ ] Should volume-level transfers be atomic (all-or-nothing) or best-effort?
