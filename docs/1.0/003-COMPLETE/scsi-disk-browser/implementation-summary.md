# SCSI Disk Browser - Implementation Summary

**Status:** Complete
**Feature Branch:** `feature/scsi-disk-browser` (merged to main via PR #164)

## Summary

Browse, read, and write Akai-formatted SCSI disk images over the network from the S3000XL web editor. Transfer programs and samples between SCSI disks and the browser library — both S3K-native (raw Akai bytes) and vendor-neutral (ProgramYaml/SampleYaml) formats. Includes bidirectional SDS sample transfer via WebSocket streaming.

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

### Phase 5: Disk ↔ S3K Library Transfer

- `akai-disk-writer.ts`: FAT allocation, directory entry creation, block-level writes with dirty block tracking (12 unit tests, round-trip verified)
- `program-serialization.ts`: `SerializedDiskProgram` format (`s3000xl-disk-program`) storing raw on-disk bytes as base64
- `DiskToLibraryDialog.tsx`: save programs/samples from disk to S3K library with sample extraction
- `LibraryToDiskDialog.tsx`: write disk-origin programs back to Akai disk with volume/target selection

### Phase 6: Akai ↔ Common Library Translation

- `akai-to-common.ts`: `akaiSampleToCommon()`, `akaiProgramToCommon()`, `akaiKeygroupToZones()` — Akai → vendor-neutral (12 unit tests)
- `common-to-akai.ts`: `commonToAkaiProgram()`, `commonToAkaiSample()` — vendor-neutral → Akai
- DiskToLibraryDialog updated with destination selector (S3K Library or Common Library)

### Phase 7: Integration Tests

- `test-disk-write.ts`: disk write round-trip e2e test (read → write → read → compare bytes) — hardware verified
- `test-scsi-sds-transfer.ts`: SDS download + upload round-trip e2e test — hardware verified
- `create-test-disk.ts`: generates minimal Akai-formatted disk image with free space for write testing
- Make targets: `test-scsi-sds-transfer`, `test-scsi-disk-write`

### SDS Sample Transfer (SCSI MIDI Bridge Phase 6)

- `scsi_midi.rs`: `download_sample()` and `upload_sample()` — full SDS protocol over SCSI_EXEC with raw CDBs
- `routes.rs`: WebSocket handlers for `sample-download` and `sample-upload` with mpsc channel streaming
- `scsi-disk-client.ts`: `downloadSample()` and `uploadSample()` with streaming callbacks
- Bridge build ID (`buildId` in `/status`) for deployment verification

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

## Test Summary

| Category | Count | Coverage |
|----------|-------|----------|
| Disk parser unit tests | 15 | Partition table, volumes, FAT chain, file list |
| Disk writer unit tests | 12 | FAT allocation, block writes, directory entries, round-trip |
| Translation unit tests | 12 | Akai ↔ vendor-neutral (both directions) |
| Rust unit tests | 10 | SDS encode/decode, RSDATA parsing, Akai char table |
| SDS transfer e2e | 2 | Download + upload round-trip (hardware verified) |
| Disk write e2e | 1 | Read → write → read → compare bytes (hardware verified) |

## Known Limitations

1. **512-byte block alignment** — s2p serves disk images with 512-byte blocks but Akai uses 8192-byte blocks internally. The parser handles this via byte offsets, but multi-block reads require calculating the correct LBA.
2. **Sample extraction offsets** — The program keygroup velocity zone sample name offsets and sample header size are first-pass estimates. Need validation against more disk images.
3. **Large transfer performance** — Reading a full sample (1+ MB) requires many 512-byte block reads. A batch/chunked read endpoint could improve performance.
