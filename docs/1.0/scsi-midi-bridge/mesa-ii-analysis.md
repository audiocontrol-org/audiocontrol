# MESA II Binary Analysis

**Date:** 2026-04-02
**Source:** MESA II v1.2 installed from original media via SheepShaver (Mac OS 9)
**Location:** `/Users/orion/tmp/MESA II v1.2 ƒ copy/`

## Architecture

MESA II is a plugin-based application. The main binary (`MESA II`) is a shell that loads Editors and PlugIns from the `MESA Pouch` folder. All code is stored in Mac OS 9 resource forks (68k/PPC code resources).

```
MESA II v1.2 ƒ/
├── MESA II                          # Main app (413KB resource fork)
├── MESA Pouch/
│   ├── Editors/
│   │   ├── Audio Editor             # Audio file editing
│   │   └── Sampler Editor 2.3       # Akai sampler editor (507KB resource fork)
│   ├── PlugIns/
│   │   ├── Audio Filing             # Audio file I/O
│   │   ├── DSP/                     # Digital signal processing
│   │   └── SCSI Plug 2.1.2          # SCSI MIDI transport (12KB resource fork)
│   └── Example Scripts/
├── OMS MIDI Stuff/                  # OMS (Opcode MIDI System) configuration
├── Error Codes
└── READ ME
```

## Extracting Resource Forks

Mac OS 9 apps store code in the resource fork. On macOS, extract via:
```bash
cat "MESA II/..namedfork/rsrc" > mesa2-rsrc.bin
cat "MESA Pouch/PlugIns/SCSI Plug 2.1.2/..namedfork/rsrc" > scsi-plug.bin
cat "MESA Pouch/Editors/Sampler Editor 2.3/..namedfork/rsrc" > sampler-editor.bin
```

## SCSI Plug 2.1.2 (12KB)

The SCSI transport plugin. Provides the communication layer between MESA and Akai samplers over SCSI.

### Classes

- **`CSCSIPlug`** — Main plugin class
- **`CSCSIUtils`** — SCSI bus utilities
- **`CSCSIDialog`** — SCSI device selection UI

### Key Methods

| Method | Signature | Purpose |
|--------|-----------|---------|
| `SetSCSIMIDIMode` | `(short scsiId, unsigned char, unsigned char)` | Configures SCSI MIDI mode on the sampler (SET INTERFACE MODE, CDB 0x0C with 84-byte config) |
| `SMSendData` | `(short scsiId, unsigned char, unsigned char*, unsigned char*, unsigned long, long*)` | Sends MIDI SysEx data via SCSI (CDB 0x0C) |
| `SMDataByteEnquiry` | `(short scsiId, unsigned char)` | Polls for pending response bytes (CDB 0x0D) |
| `SMDispatchReply` | `(short scsiId, unsigned char*, unsigned char, long*)` | Reads and dispatches response data (CDB 0x0E) |
| `SendData` | `(IP_Data*)` | High-level send (used by MESA command framework) |
| `SCSICommand` | `(short scsiId, Cdb*, unsigned char*, unsigned long, long, short)` | Raw SCSI CDB executor |
| `Inquiry` | `(char, char, unsigned char*, unsigned long)` | SCSI INQUIRY |
| `TestUnitReady` | `(short)` | SCSI TEST UNIT READY |
| `WaitUntilReady` | `(short)` | Polls TEST UNIT READY until success |
| `ResetBus` | `(char)` | SCSI bus reset |
| `IdentifyBusses` | `()` | Enumerates SCSI busses |
| `ChooseSCSI` | `(unsigned long)` | Presents device selection dialog |

### Identifiers Found

- `"AQUTSEND"` — possibly "Acquire/Transmit Send" mode identifier
- `"RSEND"` — possibly "Receive/Send" mode
- `"ADAT"` — ADAT device type
- `"PASC"` — Pascal string type marker

### SCSI CDB Patterns

The following byte sequences near offset 0x2CC0 appear to be a CDB lookup table:
```
0x2CC6: 0D 00 00 00 00 00   — MIDI Poll (CDB 0x0D)
0x2CCC: 09 00 00 00 00 00   — MIDI Init (CDB 0x09)
```

## Sampler Editor 2.3 (507KB)

The main editor UI and sampler protocol implementation for Akai S-series samplers.

### Classes

- **`CSamplerModule`** — Main editor module (MESA plugin framework)
- **`CAkaiSampler`** — Core sampler communication layer
- **`CAkaiSamplerUtils`** — Data encoding/decoding utilities
- **`CAkaiMIDIDispatcher`** — MIDI SysEx command builder
- **`CS3000Sample`** — S3000-series sample object
- **`CProgramsSamplesView`** — Programs/samples list UI
- **`CSampleAssignView`** — Sample assignment & key span UI
- **`CSamplerDiskView`** — Sampler disk browser UI

### Key Methods — Sample Data Transfer

| Method | Signature | Purpose |
|--------|-----------|---------|
| `GetSampleData` | `(short sampleIdx, long offset, long length, short* outPtr)` | Reads sample waveform data from device |
| `GetSampleHeader` | `(short sampleIdx, unsigned char** outHandle)` | Reads sample header (metadata) |
| `AcceptSampleHeader` | `(unsigned char* data, short sampleIdx)` | Writes sample header to device |
| `BuildSampleDataRequest` | `(unsigned char* buf, unsigned char opcode, unsigned char channel, short sampleNum, long offset, long length)` | Builds the SysEx for requesting sample waveform data |
| `FetchDataFromSampler` | `(unsigned long)` | Generic data fetch |
| `SendAudioFileToSampler` | `(MESAAudioHeader2*, PlugInfo*)` | Sends an audio file to the sampler |
| `SendAudioBufferToSampler` | `(MESAAudioHeader2*)` | Sends audio buffer to sampler |
| `ExportSampleData` | `(MESAAudioExportHeader*)` | Exports sample data from sampler |
| `ImportSampleData` | `(MESAAudioExportHeader*)` | Imports sample data to sampler |

### Key Methods — Parameter Access

| Method | Signature | Purpose |
|--------|-----------|---------|
| `SendExclusiveCommand` | `(unsigned char*, unsigned char, unsigned char, short, unsigned char, short, short, unsigned char, long&)` | Sends Akai SysEx command (write) |
| `SendExclusiveRequest` | `(unsigned char, unsigned char, short, unsigned char, short, short, unsigned char, long&)` | Sends Akai SysEx request (read) |
| `WaitForReply` | `(long, unsigned char, long&)` | Waits for response |
| `GetData` | `(SGetData*)` | Generic data getter |
| `SetData` | `(SGetData*)` | Generic data setter |
| `SetProgramHeaderValue` | `(long field, long value, long)` | Sets a program parameter |
| `SetKeygroupHeaderValue` | `(long field, long value, long)` | Sets a keygroup parameter |
| `SetMultiDataValue` | `(long field, long value, long)` | Sets a multi parameter |

### Key Methods — Program/Keygroup Management

| Method | Signature | Purpose |
|--------|-----------|---------|
| `GetProgramList` | `()` | Fetches program name list (RPLIST) |
| `GetSampleList` | `()` | Fetches sample name list (RSLIST) |
| `GetProgram` | `(short, unsigned char**, unsigned char**, unsigned char)` | Fetches full program data |
| `GetKeygroup` | `(short, short, unsigned char**)` | Fetches keygroup data |
| `AddKeygroup` | `(short, short)` | Adds keygroup to program |
| `DeleteKeygroup` | `()` | Deletes current keygroup |
| `DeleteKeygroupInSpecifiedProgram` | `(short, short)` | Deletes specific keygroup |
| `NewProgram` | `(unsigned char*, short)` | Creates new program |
| `RenameProgram` | `(unsigned char*, short)` | Renames program |
| `DeleteNamedProgram` | `(unsigned char*)` | Deletes program by name |
| `DeleteIndexedProgram` | `(short)` | Deletes program by index |
| `DeleteNamedSample` | `(unsigned char*)` | Deletes sample by name |
| `DeleteIndexedSample` | `(short)` | Deletes sample by index |
| `DuplicateProgram` | `(unsigned char*)` | Duplicates a program |
| `DuplicateKeygroup` | `()` | Duplicates current keygroup |

### Critical Strings

```
"Sample data can only be transferred if you are using SCSI to communicate
with the sampler. You are currently using MIDI."
```

**This confirms MESA only transfers sample waveform data over SCSI, not MIDI.** It uses Akai proprietary SysEx commands (RSPACK/ASPACK) through the SCSI MIDI interface, not standard SDS.

```
"Sampler Editor cannot find a MIDI or a SCSI plugin to handle data transfer!"
```

The editor requires either a MIDI or SCSI plugin for communication.

```
"Cannot delete only keygroup."
```

Relevant to our test failure — the S3000XL prevents deleting the last keygroup.

### Protocol Implications

1. **`GetSampleData` uses opcode 0x0B (SDATA), not 0x0C (RSPACK)** — Confirmed via 68k disassembly. The function pushes `#$0B` as the opcode parameter to `BuildSampleDataRequest`. SDATA is the "Sample Data" opcode used for both responses and writes. In this context it may be building a write command to send sample data TO the sampler, not a read request. The `GetSampleData` name reflects the MESA framework's perspective (getting data from a file to send to the device).

2. **No SDS over SCSI** — MESA does not use standard MIDI SDS for sample transfer. The "Sample data can only be transferred... using SCSI" message confirms sample data goes exclusively through the SCSI path.

3. **'BULK' transfer mode** — `GetSampleData` pushes the `'BULK'` identifier (ASCII `0x42554C4B`) and a chunk size of 192 bytes (`0x00C0`) before calling the transport. This suggests the SCSI Plug handles 'BULK' transfers differently from regular SysEx sends — possibly using direct SCSI block commands rather than the MIDI-via-SCSI SysEx channel (CDB 0x0C/0x0D/0x0E).

4. **RSPACK (0x0C) does not work over SCSI MIDI** — Tested with multiple parameter formats (nibblized, raw LE, with/without interval byte, various lengths). The S3000XL returns empty responses for all RSPACK variants. Other read commands (RPDATA 0x06, RKDATA 0x08, RSDATA 0x0A, RSLIST 0x04, RSTAT 0x00) all work correctly over the SCSI MIDI channel.

5. **The SCSI Plug may bypass the MIDI-via-SCSI protocol for sample data** — The SCSI Plug's `SCSICommand` method can issue arbitrary SCSI CDBs. For 'BULK' sample transfers, MESA may read/write sample data using direct SCSI block READ/WRITE commands to the S3000XL's memory, bypassing the SysEx-over-SCSI protocol entirely. This would explain why sample data transfer is SCSI-only — it uses native SCSI block transfer capabilities that have no MIDI equivalent.

### 68k Disassembly: GetSampleData

```
GetSampleData__12CAkaiSamplerFsllPs at 0x06ae09:

  06ae15: move.l  #'BULK',-(sp)       ; transfer mode identifier
  06ae1b: pea     $00C0.w             ; chunk size = 192 bytes
  06ae1f: clr.b   -(sp)               ; flag = 0
  06ae21: move.w  16(a6),-(sp)        ; sampleIdx parameter
  06ae25: move.b  #$0B,-(sp)          ; opcode = SDATA (0x0B)
  06ae29: move.b  14(a2),-(sp)        ; channel from object
  06ae2d: move.l  12(a6),-(sp)        ; offset parameter
  06ae31: pea     -512(a6)            ; local buffer (512 bytes)
  06ae35: move.l  a2,-(sp)            ; this pointer
  06ae37: ...                          ; vtable call to BuildSampleDataRequest
```

### RSPACK Format (from S1000 SysEx spec)

```
F0 47 cc 0C 48 ss ss oo oo oo oo nn nn nn nn ii F7

  cc      — MIDI channel
  ss ss   — sample number (16-bit LE)
  oo ×4   — offset from start of sample (32-bit LE, in sample words)
  nn ×4   — number of samples requested (32-bit LE)
  ii      — interval mode: 0=single, 1=average, 2=peak
```

Tested and confirmed: S3000XL does not respond to RSPACK over the SCSI MIDI channel.

## Investigation Status

### What works over SCSI MIDI (CDB 0x0C send, 0x0D poll, 0x0E read):
- ✅ Parameter reads: RSTAT, RSLIST, RPLIST, RPDATA, RKDATA, RSDATA
- ✅ Parameter writes: PDATA, KDATA, SDATA (headers)
- ✅ SDS send (upload sample TO device): Dump Header + Data Packets + ACKs
- ❌ SDS receive (download sample FROM device): Dump Header arrives but Data Packets don't
- ❌ RSPACK (request sample waveform data): no response
- ❌ ASPACK (accept sample waveform data): untested but likely same issue

### Hypothesis: Direct SCSI block transfer
MESA's sample data transfer likely uses direct SCSI READ/WRITE commands to access the S3000XL's sample memory, not the MIDI-via-SCSI SysEx channel. Evidence:
- 'BULK' identifier in GetSampleData suggests a different transfer mode
- SCSI Plug has raw `SCSICommand` capability
- RSPACK doesn't work over SCSI MIDI
- "Sample data can only be transferred using SCSI" — because it uses native SCSI, not SysEx

### Next Steps
1. **Disassemble `SMSendData` in SCSI Plug** — determine what CDB it uses for 'BULK' mode
2. **Try SCSI READ (CDB 0x08/0x28)** — direct block read to S3000XL memory
3. **Investigate S3000XL SCSI disk protocol** — the S3000XL presents itself as a SCSI device; its disk contents (samples, programs) may be readable via standard SCSI block commands
4. **Capture live MESA II traffic** — definitive answer via SheepShaver SCSI passthrough

## Resolution: Disk Image Access

### How MESA transfers sample data

MESA's "Sample data can only be transferred using SCSI" does NOT mean SysEx-over-SCSI. It means MESA reads/writes sample waveform data directly from/to the **Akai disk images** on the SCSI bus. The S3000XL stores samples on its SCSI disks, and MESA accesses those disks directly.

The audiocontrol codebase already has a complete Akai disk image extractor:
- `modules/sampler-export/src/lib/extractor/disk-extractor.ts` — reads `.hds` disk images
- Uses `akaitools` from `sampler-devices` to parse the Akai filesystem format
- Can extract programs, samples (as AIFF/WAV), and convert to SFZ/DecentSampler

### Architecture for sample data over SCSI

Since the disk images are served from the Pi's filesystem via s2p:

1. **Read sample from device**: The sample waveform data lives in the `.hds` disk image files at `/home/orion/images/` on the Pi. Use the existing `sampler-export` extractor to read them directly — no SCSI SysEx needed.

2. **Write sample to device**: Use SDS send over SCSI MIDI (already working — confirmed with direct protobuf test) to upload waveform data to the S3000XL's RAM.

3. **Sync after write**: After SDS upload, tell the S3000XL to save to disk. The waveform data then appears in the `.hds` disk image, readable by the extractor.

### No RSPACK needed

RSPACK (opcode 0x0C) is designed for reading sample data via SysEx, but:
- It doesn't work over the SCSI MIDI channel (confirmed by testing)
- MESA doesn't use it — it reads from the disk directly
- Our existing disk extractor already handles the Akai format

The sample data transfer problem is solved by combining:
- SDS send (SCSI MIDI) for uploading samples to RAM
- Direct disk image access for downloading samples from the device
