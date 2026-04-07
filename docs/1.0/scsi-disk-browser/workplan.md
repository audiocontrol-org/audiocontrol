# SCSI Disk Browser - Workplan

**GitHub Milestone:** [Week of Apr 6-10](https://github.com/audiocontrol-org/audiocontrol/milestone/9)
**GitHub Issues:**

- [Parent: [scsi-bridge] SCSI Disk Browser (#148)](https://github.com/audiocontrol-org/audiocontrol/issues/148)
- [Add SCSI_EXEC protobuf encoding to bridge S2pClient (#149)](https://github.com/audiocontrol-org/audiocontrol/issues/149)
- [Add HTTP endpoints for SCSI block read/write/inquiry/capacity (#150)](https://github.com/audiocontrol-org/audiocontrol/issues/150)
- [Build TypeScript ScsiDiskClient for browser (#151)](https://github.com/audiocontrol-org/audiocontrol/issues/151)
- [Implement Akai partition table and volume directory parser (#152)](https://github.com/audiocontrol-org/audiocontrol/issues/152)
- [Implement Akai program and sample header disk parser/serializer (#153)](https://github.com/audiocontrol-org/audiocontrol/issues/153)
- [Implement browser-safe WAV to/from Akai sample conversion (#154)](https://github.com/audiocontrol-org/audiocontrol/issues/154)
- [Build disk browser UI component and store (#155)](https://github.com/audiocontrol-org/audiocontrol/issues/155)
- [Build disk download dialog (#156)](https://github.com/audiocontrol-org/audiocontrol/issues/156)
- [Build disk upload dialog (#157)](https://github.com/audiocontrol-org/audiocontrol/issues/157)
- [Write unit tests for Akai disk format parser (#158)](https://github.com/audiocontrol-org/audiocontrol/issues/158)
- [Write integration tests with hardware (#159)](https://github.com/audiocontrol-org/audiocontrol/issues/159)

## Technical Approach

Layer disk block I/O on top of the existing SCSI-over-network infrastructure. The scsi2pi fork already handles `SCSI_EXEC` with READ/WRITE for emulated disk images. The Rust bridge daemon needs a thin extension to proxy these commands over HTTP. The main new work is a browser-safe Akai disk format parser and the editor UI.

**Key architectural decisions:**

- **Extend the bridge, don't replace it** — Add `SCSI_EXEC` support to the existing Rust bridge daemon alongside the MIDI operations. Same s2p connection, same protobuf encoding pattern.
- **Browser-safe Akai parser from scratch** — Port the essential Akai disk format parsing from the `akaitools` Perl reference to TypeScript operating on `Uint8Array`. No filesystem, no child processes, no Node.js dependencies.
- **Block-level caching in the browser** — Reading disk structure requires multiple round-trips (partition table, volume directory, file entries). Cache blocks in memory to avoid redundant network reads during a browsing session.
- **Composition with existing library page** — The disk browser is a new panel/tab on the library page, not a separate page. It shares the library store and can transfer items between disk and browser library.

## MESA II SCSI Protocol Findings

Static analysis of MESA II's SCSI Plug binary (`~/work/scsi2pi-work/mesa-plug-harness/SCSI-PROTOCOL.md`) revealed the exact SCSI CDB protocol used by Akai's own software. Key findings relevant to this feature:

**For the disk browser:** MESA II uses standard SCSI commands (INQUIRY `$12`, TEST UNIT READY `$00`) alongside vendor-specific MIDI commands (`$09`, `$0C`, `$0D`, `$0E`). The disk browser only needs standard SCSI commands, which are already supported by SCSI_EXEC.

**For the SDS sample data issue (related to #141):** MESA II sets CDB byte 5 as a flag (`$80` = expecting reply, `$00` = fire-and-forget). Our s2p MIDI CDB handlers always send `$00` in byte 5. This flag may be what tells the device to buffer its SDS response for retrieval via the poll/read channel. Additionally, MESA drains pending data before every send and calls TestUnitReady before every command.

**Protobuf field mappings (from `s2p_interface.proto`):**

PbScsiRequest (field 21 of PbCommand):
- field 1 (varint): target_id
- field 2 (varint): target_lun  
- field 3 (bytes): cdb
- field 4 (bytes): data_out
- field 5 (varint): expected_data_in
- field 6 (varint): timeout_seconds

PbScsiResponse (field 102 of PbResult):
- field 1 (varint): status
- field 2 (bytes): sense_data
- field 3 (bytes): data_in
- field 4 (varint): bytes_transferred

## Implementation Phases

### Phase 1: Bridge SCSI_EXEC Extension

Extend the Rust bridge daemon to support generic SCSI command execution.

#### 1.1 Add SCSI_EXEC to S2pClient

**Files to modify:**
- `services/scsi-midi-bridge/src/s2p_client.rs`

**New method:**

```rust
pub async fn execute_scsi(
    &self,
    target_id: u8,
    lun: u8,
    cdb: &[u8],
    data_out: &[u8],
    expected_data_in: u32,
) -> Result<ScsiResponse, String>
```

Hand-encode `PbScsiRequest` protobuf (field 21 in `PbCommand`) following the same pattern as the existing MIDI message encoding. Parse `PbScsiResponse` from field 102 of `PbResult`.

**Success criteria:**
- Can issue INQUIRY, READ CAPACITY, READ(10), WRITE(10) through the bridge
- Response includes SCSI status, sense data, and data_in bytes
- Existing MIDI operations continue to work unchanged

#### 1.2 Add HTTP Endpoints

**Files to modify:**
- `services/scsi-midi-bridge/src/routes.rs`

**New endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `POST /scsi/exec` | POST | Generic SCSI command (CDB + data) |
| `POST /scsi/read` | POST | Convenience: READ(10) for N sectors at LBA |
| `POST /scsi/write` | POST | Convenience: WRITE(10) for N sectors at LBA |
| `GET /scsi/capacity/:target_id` | GET | READ CAPACITY (returns block count + size) |
| `GET /scsi/inquiry/:target_id` | GET | INQUIRY (returns vendor/product/revision) |

**Request/Response formats:**

```typescript
// POST /scsi/read
{ target_id: number, lba: number, count: number }
→ { status: number, data: number[] }  // data is raw sector bytes

// POST /scsi/write
{ target_id: number, lba: number, data: number[] }
→ { status: number }

// GET /scsi/capacity/0
→ { block_count: number, block_size: number }

// GET /scsi/inquiry/0
→ { device_type: number, vendor: string, product: string, revision: string }
```

**Success criteria:**
- `GET /scsi/inquiry/0` returns valid Akai disk identification
- `GET /scsi/capacity/0` returns correct block count and size (512 bytes)
- `POST /scsi/read` returns raw sector data for any valid LBA
- `POST /scsi/write` writes data and returns GOOD status

#### 1.3 TypeScript SCSI Disk Client

**Files to create:**
- `modules/midi-core/src/transports/scsi-disk-client.ts`

**Interface:**

```typescript
interface ScsiDiskClient {
  inquiry(targetId: number): Promise<ScsiInquiryResult>;
  readCapacity(targetId: number): Promise<{ blockCount: number; blockSize: number }>;
  readSectors(targetId: number, lba: number, count: number): Promise<Uint8Array>;
  writeSectors(targetId: number, lba: number, data: Uint8Array): Promise<void>;
}
```

Factory: `createScsiDiskClient(bridgeUrl: string): ScsiDiskClient`

**Success criteria:**
- Browser-safe (uses `fetch()`)
- Round-trips data correctly for single and multi-sector reads
- Throws descriptive errors on SCSI CHECK CONDITION

### Phase 2: Browser-Safe Akai Disk Parser

Build a TypeScript Akai disk format parser that operates on raw blocks (`Uint8Array`).

#### 2.1 Low-Level Block Reader

**Files to create:**
- `modules/sampler-devices/src/devices/s3000xl/akai-disk-format.ts`

**Functions:**

| Function | Purpose |
|----------|---------|
| `parsePartitionTable(blocks)` | Read partition entries from block 0 |
| `parseVolumeDirectory(blocks, partitionOffset)` | Read file entries in a volume |
| `parseFileAllocationTable(blocks, volumeOffset)` | Read FAT to locate file blocks |
| `readFileBlocks(client, targetId, fat, fileEntry)` | Read all blocks of a file |

**Reference:** Use the `akaitools` Perl source for byte offsets, magic numbers, and structure layouts. Key structures:
- Block 0: partition table (partition count, offsets, sizes)
- Volume header: name, file count, FAT offset
- Directory entries: file name (12 chars), type (program/sample), size, start block
- FAT: block chain (linked list of block numbers)

**Success criteria:**
- Can list all partitions, volumes, and files from raw disk blocks
- Matches output of `akaitools` Perl `akailist` command

#### 2.2 Program and Sample Header Parsing

**Files to create/modify:**
- `modules/sampler-devices/src/devices/s3000xl/akai-disk-program.ts`
- `modules/sampler-devices/src/devices/s3000xl/akai-disk-sample.ts`

**Functions:**

| Function | Purpose |
|----------|---------|
| `parseProgramFromDisk(rawBytes)` | Parse program header + keygroups from on-disk format |
| `parseSampleHeaderFromDisk(rawBytes)` | Parse sample header from on-disk format |
| `extractSampleWaveform(rawBytes, header)` | Extract PCM audio data following the header |
| `serializeProgramToDisk(program, keygroups)` | Convert program + keygroups to on-disk binary format |
| `serializeSampleToDisk(header, pcmData)` | Convert sample header + audio to on-disk binary format |

**Note:** The on-disk format may differ from the SysEx format (which uses nibble encoding). The Perl `akaitools` source is the reference for on-disk byte layouts.

**Success criteria:**
- Programs parsed from disk match those read via SysEx (same field values)
- Sample waveform data extracted correctly (compare with known samples)
- Serialized programs/samples can be written back and read again (round-trip)

#### 2.3 WAV Conversion

**Files to create:**
- `modules/sampler-devices/src/devices/s3000xl/akai-wav-convert.ts`

**Functions:**

| Function | Purpose |
|----------|---------|
| `akaiSampleToWav(header, pcmData)` | Convert Akai sample to WAV Uint8Array |
| `wavToAkaiSample(wavData, name)` | Convert WAV to Akai sample header + PCM |

**Success criteria:**
- Extracted samples play back correctly as WAV
- Uploaded WAV files are audible on the sampler after writing to disk

### Phase 3: Disk Browser UI

Add a disk browser panel to the S3000XL editor.

#### 3.1 Disk Browser Component

**Files to create:**
- `modules/akai-s3k-editor/src/components/library/DiskBrowserPanel.tsx`
- `modules/akai-s3k-editor/src/hooks/useDiskBrowser.ts`
- `modules/akai-s3k-editor/src/stores/diskStore.ts`

**UI layout:**

```
┌─────────────────────────────────────┐
│ Disk Browser                    [↻] │
├─────────────────────────────────────┤
│ SCSI Targets:                       │
│  ▸ ID 0: AKAI DISK (1.0 GB)        │
│  ▾ ID 1: AKAI DISK (512 MB)        │
│    ▾ Partition 1                    │
│      ▾ VOLUME 1                     │
│        📁 PIANO    (Program, 3 KG)  │
│        📁 BASS     (Program, 1 KG)  │
│        🎵 PIANO-C3 (Sample, 44.1k)  │
│        🎵 PIANO-G3 (Sample, 44.1k)  │
│        🎵 BASS-E1  (Sample, 22.0k)  │
│      ▸ VOLUME 2                     │
│  ▸ ID 2: AKAI DISK (512 MB)        │
└─────────────────────────────────────┘
```

**Features:**
- Enumerate SCSI targets via INQUIRY (skip ID 6 = sampler, ID 7 = Pi)
- Lazy-load: partition/volume/file list fetched on expand
- Block-level cache: fetched blocks stored in memory for the session
- Selection drives the preview/actions panel

#### 3.2 Disk Transfer Actions

**Files to create:**
- `modules/akai-s3k-editor/src/components/library/DiskDownloadDialog.tsx`
- `modules/akai-s3k-editor/src/components/library/DiskUploadDialog.tsx`

**Download (disk → library):**
1. User selects a sample or program on disk
2. Clicks "Download to Library"
3. Dialog shows: file name, type, size estimate
4. Reads all blocks for the file over the network
5. Parses Akai format, converts sample to WAV (if sample)
6. Saves to browser library (OPFS or local filesystem)
7. Progress bar during block reads

**Upload (library → disk):**
1. User selects a sample or program in the browser library
2. Clicks "Upload to Disk"
3. Dialog shows: target volume picker, file name, size
4. Converts from library format to Akai on-disk format
5. Allocates free blocks in volume FAT
6. Writes blocks over the network
7. Progress bar during block writes

**Success criteria:**
- Can browse all disks served by s2p
- Can download samples and programs to browser library
- Can upload samples and programs to disk
- Progress updates during transfers
- Errors displayed clearly

### Phase 4: Testing

#### 4.1 Unit Tests

**Files to create:**
- `modules/sampler-devices/src/devices/s3000xl/__tests__/akai-disk-format.test.ts`
- `modules/sampler-devices/src/devices/s3000xl/__tests__/akai-disk-program.test.ts`
- `modules/sampler-devices/src/devices/s3000xl/__tests__/akai-disk-sample.test.ts`
- `modules/midi-core/src/transports/__tests__/scsi-disk-client.test.ts`

**Coverage:**
- Partition table parsing from known disk image bytes
- Volume directory parsing
- Program header round-trip (parse → serialize → parse)
- Sample header round-trip
- WAV conversion round-trip
- SCSI disk client request/response encoding

#### 4.2 Integration Tests with Hardware

**Test scenarios:**
- Read partition table from disk image served by s2p
- List all files in a volume
- Download a known program, verify all fields match SysEx readback
- Download a known sample, verify WAV audio matches
- Upload a new sample, verify it appears on the sampler
- Upload a new program, verify it loads correctly

### Phase 5: Disk ↔ S3K Library Transfer — PLANNING

Transfer Akai disk objects to and from the S3K-specific section of the browser library. No format translation — raw Akai disk bytes are stored as base64 in the library, identical to how the SysEx path stores raw SysEx bytes.

#### 5.1 S3K Library Storage for Disk Objects

Extend `program-storage.ts` and `program-serialization.ts` to support disk-origin objects. A disk-origin program bundle in the S3K library contains:

```
library/s3k/programs/{name}/
├── program.s3k.yaml          # manifest with raw disk bytes (base64)
└── samples/
    ├── SAMPLE1.wav           # extracted PCM as WAV
    └── SAMPLE2.wav
```

The YAML manifest stores the raw on-disk bytes so they can be written back to any Akai disk without loss. The WAV files are derived from the disk sample data for playback/preview.

**Files to modify:**
- `modules/akai-s3k-editor/src/lib/program-serialization.ts` — add `serializeDiskProgram()` / `deserializeDiskProgram()` for disk-origin data
- `modules/akai-s3k-editor/src/lib/program-storage.ts` — extend save/load for disk-origin bundles

#### 5.2 Disk Write Serialization

Write Akai-formatted objects back to disk images. Required functions:

**Files to modify:**
- `modules/sampler-devices/src/devices/s3000xl/akai-disk-parser.ts`

| Function | Purpose |
|----------|---------|
| `writeFileData(partitionData, fatData, fileBytes)` | Allocate blocks in FAT, write file bytes to allocated blocks |
| `createDirectoryEntry(name, type, startBlock, size)` | Build a 24-byte directory entry |
| `addFileToVolume(partitionData, volumeIndex, entry, fileBytes)` | Insert directory entry + write file data |

**Files to create:**
- `modules/sampler-devices/src/devices/s3000xl/akai-disk-writer.ts`

| Function | Purpose |
|----------|---------|
| `allocateBlocks(fatData, count)` | Find `count` free blocks in FAT, chain them, return start block |
| `writeU16LE(buf, offset, value)` | Write little-endian u16 |
| `updateFatEntry(fatData, block, nextBlock)` | Set FAT entry for a block |

#### 5.3 Download Dialog (Disk → S3K Library)

User selects a program or sample in the disk browser, clicks "Save to Library":
1. Read all blocks for the file via FAT chain
2. If program: parse to extract sample references, read each referenced sample
3. Store raw bytes in S3K library YAML, extract WAV for each sample
4. Progress indicator for multi-block reads

**Files to create:**
- `modules/akai-s3k-editor/src/components/library/DiskToLibraryDialog.tsx`

#### 5.4 Upload Dialog (S3K Library → Disk)

User selects a program or sample in the library, clicks "Send to Disk":
1. Load raw bytes from S3K library YAML
2. User selects target disk (SCSI ID) and volume
3. Allocate blocks, write file data, update directory and FAT
4. Progress indicator for multi-block writes

**Files to create:**
- `modules/akai-s3k-editor/src/components/library/LibraryToDiskDialog.tsx`

### Phase 6: Akai ↔ Common Library Translation — PLANNING

Translate between Akai-native disk format and the vendor-neutral common library format (`ProgramYaml`, `SampleYaml` from `sampler-library`).

#### 6.1 Akai → Common Library Translation

| Akai Concept | Common Library Concept |
|---|---|
| Program + keygroups | `ProgramYaml` with zones |
| Keygroup (low note, high note, velocity zones) | `Zone` (keyRange, velocityRange, sample ref) |
| Sample header (rate, loop points, root key) + PCM | `SampleYaml` + `sample.wav` |
| Volume (collection of programs + samples) | Directory of program + sample bundles |

**Files to create:**
- `modules/sampler-devices/src/devices/s3000xl/akai-to-common.ts`

| Function | Purpose |
|----------|---------|
| `akaiProgramToCommon(program, keygroups, samples)` | Convert parsed Akai program → `ProgramYaml` |
| `akaiSampleToCommon(header, pcmData)` | Convert parsed Akai sample → `SampleYaml` + WAV blob |
| `akaiKeygroupToZones(keygroup)` | Map one Akai keygroup → 1-4 `Zone` entries (one per velocity zone with a sample) |

#### 6.2 Common Library → Akai Translation

| Common Library Concept | Akai Concept |
|---|---|
| `ProgramYaml` zones | Keygroups (group zones by key range, assign velocity zones) |
| `SampleYaml` + WAV | Akai sample header + PCM (set rate, loop points, root key from metadata) |

**Files to create:**
- `modules/sampler-devices/src/devices/s3000xl/common-to-akai.ts`

| Function | Purpose |
|----------|---------|
| `commonToAkaiProgram(programYaml, sampleMap)` | Convert `ProgramYaml` → Akai program + keygroup bytes |
| `commonToAkaiSample(sampleYaml, wavData)` | Convert `SampleYaml` + WAV → Akai sample header + PCM bytes |
| `zonesToAkaiKeygroups(zones)` | Group zones into keygroups (by key range), assign velocity zones |

#### 6.3 Translation UI

Extend disk browser and library UI with translation-aware transfer actions:
- "Save to Common Library" on disk browser items (translates Akai → vendor-neutral)
- "Send to Disk" on common library items (translates vendor-neutral → Akai)
- "Promote to Common Library" on S3K library items
- "Import from Common Library" in S3K library section

### Phase 7: Integration Tests — PLANNING

#### 7.1 Disk Write Round-Trip Tests

`make test-scsi-disk-write` — Node.js CLI e2e test:
1. Read a known program from disk via SCSI
2. Write it to a different volume/location on the same disk
3. Read it back from the new location
4. Compare raw bytes — must be identical

#### 7.2 Library Transfer Round-Trip Tests

1. Download program from disk → S3K library → upload to different volume → read back → compare
2. Download sample from disk → common library (translated) → upload back to disk (translated) → verify playback on device

## Task Breakdown

| # | Task | Phase | Status |
|---|------|-------|--------|
| 1 | Add SCSI_EXEC to bridge S2pClient | 1.1 | DONE |
| 2 | Add HTTP endpoints for block read/write/inquiry/capacity | 1.2 | DONE |
| 3 | Build TypeScript ScsiDiskClient | 1.3 | DONE |
| 4 | Implement Akai partition table parser | 2.1 | DONE |
| 5 | Implement volume directory and FAT parser | 2.1 | DONE |
| 6 | Implement program header disk parser | 2.2 | DONE |
| 7 | Implement sample header disk parser | 2.2 | DONE |
| 8 | Implement WAV conversion (both directions) | 2.3 | DONE |
| 9 | Build disk browser UI component | 3.1 | DONE |
| 10 | Build disk store and useDiskBrowser hook | 3.1 | DONE |
| 11 | Build download dialog (disk → library) | 3.2 | PLANNING |
| 12 | Build upload dialog (library → disk) | 3.2 | PLANNING |
| 13 | Write unit tests for disk format parser | 4.1 | DONE (15 tests) |
| 14 | Write integration tests with hardware | 4.2 | DONE (SDS transfer e2e) |
| 15 | S3K library storage for disk-origin objects | 5.1 | PLANNING |
| 16 | Disk write serialization (FAT alloc, directory update) | 5.2 | PLANNING |
| 17 | Disk → S3K Library download dialog | 5.3 | PLANNING |
| 18 | S3K Library → Disk upload dialog | 5.4 | PLANNING |
| 19 | Akai → common library translation | 6.1 | PLANNING |
| 20 | Common library → Akai translation | 6.2 | PLANNING |
| 21 | Translation-aware transfer UI | 6.3 | PLANNING |
| 22 | Disk write round-trip e2e tests | 7.1 | PLANNING |
| 23 | Library transfer round-trip e2e tests | 7.2 | PLANNING |

## Dependencies

- Phases 1-4: COMPLETE
- Phase 5 depends on Phase 2 (disk parser) — can begin immediately
- Phase 6 depends on Phase 5 (needs S3K library storage before translation)
- Phase 7 depends on Phases 5-6
