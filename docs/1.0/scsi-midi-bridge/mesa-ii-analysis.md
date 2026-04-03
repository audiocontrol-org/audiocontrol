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

1. **Sample data uses Akai proprietary commands** — `BuildSampleDataRequest` builds RSPACK (opcode 0x0C) requests with offset and length parameters. The response comes back via the standard SCSI MIDI response buffer (poll 0x0D, read 0x0E), same as RPDATA/PDATA.

2. **No SDS over SCSI** — MESA does not use standard MIDI SDS for sample transfer. The "Sample data can only be transferred... using SCSI" message confirms sample data goes exclusively through the SCSI path using Akai proprietary commands.

3. **`GetSampleData(sampleIdx, offset, length, outPtr)`** — reads sample data in chunks with explicit offset and length. This is a request/response pattern, not streaming. Each chunk request gets a response through the SCSI MIDI poll/read cycle.

4. **The SCSI Plug's `SetSCSIMIDIMode`** — may be required before any MIDI-via-SCSI communication. We send CDB 0x09 (init) but may be missing the SET INTERFACE MODE configuration step.

## Next Steps

1. **Test RSPACK (opcode 0x0C) for reading sample waveform data** — this should work the same as RPDATA since it's a request/response pattern
2. **Test ASPACK (opcode 0x0D) for writing sample waveform data** — same pattern as PDATA writes
3. **Investigate `SetSCSIMIDIMode`** — the 84-byte config may be needed for full protocol support
4. **Consider disassembly** — if the opcode formats don't match expectations, the 68k code in the SCSI Plug (12KB) is small enough to disassemble fully
