# SCSI Disk Browser - Implementation Summary

**Status:** In Progress
**Feature Branch:** `feature/scsi-disk-browser`

## Summary

Read and write Akai-formatted SCSI disk images over the network from the S3000XL web editor. Extends the SCSI bridge with SCSI_EXEC block I/O, adds a browser-safe Akai disk format parser, and integrates a disk browser panel into the editor's library page.

## What Was Built

### Phase 1: Bridge SCSI_EXEC Extension

**Rust bridge (`services/scsi-midi-bridge/src/`):**
- `s2p_client.rs`: Added `execute_scsi()` with hand-rolled PbScsiRequest/PbScsiResponse protobuf encoding (operation 210, field 21/102)
- `routes.rs`: Five new HTTP endpoints — `POST /scsi/exec`, `POST /scsi/read`, `POST /scsi/write`, `GET /scsi/inquiry/:id`, `GET /scsi/capacity/:id`
- `main.rs`: Route registration

**TypeScript client (`modules/midi-core/src/transports/scsi-disk-client.ts`):**
- `createScsiDiskClient(bridgeUrl)` — browser-safe client with `inquiry()`, `readCapacity()`, `readBlocks()`, `writeBlocks()`

### Phase 2: Browser-Safe Akai Disk Parser

**New files in `modules/sampler-devices/src/devices/s3000xl/`:**
- `akai-disk-format.ts`: Constants, types, Akai character encoding. Key values: BLOCK_SIZE=8192, FAT at 0x70A, directory at 0xCA, partition table at 0x4500
- `akai-disk-parser.ts`: Partition table, volume list, file list, FAT chain, file data extraction — all on `Uint8Array`
- `akai-disk-program.ts`: Parse program headers and keygroups from on-disk binary format
- `akai-disk-sample.ts`: Parse sample headers, extract 16-bit PCM audio
- `akai-wav-convert.ts`: Bidirectional WAV ↔ Akai sample conversion

### Phase 3: Disk Browser UI

- `modules/akai-s3k-editor/src/hooks/useDiskBrowser.ts`: Hook managing SCSI target scanning, disk data loading, sample download
- `modules/akai-s3k-editor/src/components/library/DiskBrowserPanel.tsx`: Collapsible tree view of SCSI targets → volumes → files
- Wired into `LibraryPage.tsx` as a right sidebar panel, active when SCSI transport is enabled

### Phase 4: Tests

- 15 unit tests for Akai character encoding and disk parser (partition table, volume list, FAT chain)
- Playwright E2E spec using `?midi=scsi&scsiBridgeUrl=...` query params for transport selection

## Key Decisions

- **SCSI_EXEC not MIDI** — Disk I/O uses standard SCSI READ/WRITE commands through the SCSI_EXEC protobuf operation, not the MIDI-via-SCSI channel. Same approach MESA II uses.
- **Browser-safe parser** — All Akai format parsing operates on `Uint8Array` with no filesystem or child process dependencies. Ported from `akaitools` Perl source.
- **BlockReader abstraction** — Parser functions take raw bytes, not network clients. Unit tests use in-memory fixtures, production uses ScsiDiskClient.
- **S3000 file type codes** — S3000 uses 0xFx (0xF0=program, 0xF3=sample), not 0x7x as S1000 docs suggest. Added `isAkaiProgram()`/`isAkaiSample()` helpers that work for both.
- **Query param transport selection** — `?midi=scsi&scsiBridgeUrl=...` sets SCSI mode without UI interaction, enabling Playwright tests.

## Test Results

**Hardware verified:**
- INQUIRY on disk image: `{"device_type":0,"vendor":"SCSI2Pi","product":"SCSI HD 540 MiB"}`
- READ CAPACITY: 1,105,924 blocks × 512 bytes = 540 MB
- Block 0 read: 512 bytes of Akai partition data
- Partition parser: 9 × 60 MB partitions
- Volume parser: "MOOGB" volume found
- File parser: 27 files — 1 program, 22 stereo sample pairs, effects, drums, multi

**Unit tests:** 15 passing (character encoding + parser)

## Known Limitations

1. **512-byte block alignment** — s2p serves disk images with 512-byte blocks but Akai uses 8192-byte blocks internally. The parser handles this via byte offsets, but multi-block reads require calculating the correct LBA.
2. **Read-only first pass** — Write support (upload to disk) is implemented in the bridge but the parser's serialization functions haven't been tested against hardware.
3. **Sample extraction offsets** — The program keygroup velocity zone sample name offsets and sample header size are first-pass estimates. Need validation against more disk images.
4. **Large transfer performance** — Reading a full sample (1+ MB) requires many 512-byte block reads. A batch/chunked read endpoint could improve performance.
