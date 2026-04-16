# MESA II Binary Analysis — Sample Upload Investigation

## Purpose

Reverse-engineer how MESA II (Akai's official Mac OS 9 editor) uploads sample audio data to the S3000XL. This is needed to solve the ASPACK SLNGTH problem: our ASPACK uploads create samples with truncated playback length.

## Source Material

### Binaries

All extracted from the Mac OS 9 HFS disk image at `~/Downloads/Macintosh HD` using `hfsutils`.

| File | Source | Size | Description |
|------|--------|------|-------------|
| `binaries/sampler-editor-rsrc.bin` | `Applications:MESA II v1.2 ƒ copy:MESA Pouch:Editors:Sampler Editor 2.3` | 506,909 bytes | Resource fork — contains all 68k code |
| `binaries/scsi-plug-rsrc.bin` | `Applications:MESA II v1.2 ƒ copy:MESA Pouch:PlugIns:SCSI Plug 2.1.2` | 12,053 bytes | Resource fork — SCSI MIDI transport layer |
| `binaries/sampler-editor.macbin` | Same as above | 507,136 bytes | MacBinary wrapper (resource fork at offset 128) |
| `binaries/scsi-plug.macbin` | Same as above | 12,288 bytes | MacBinary wrapper (resource fork at offset 128) |

### Extraction Commands

```bash
brew install hfsutils
hmount ~/Downloads/Macintosh\ HD
hcd "Applications:MESA II v1.2 $(printf '\xc4') copy:MESA Pouch:Editors"
hcopy -m "Sampler Editor 2.3" sampler-editor.macbin
# Resource fork: dd if=sampler-editor.macbin of=sampler-editor-rsrc.bin bs=1 skip=128 count=506909

hcd "../PlugIns"
hcopy -m "SCSI Plug 2.1.2" scsi-plug.macbin
# Resource fork: dd if=scsi-plug.macbin of=scsi-plug-rsrc.bin bs=1 skip=128 count=12053
humount
```

### Address Mapping

**Sampler Editor 2.3:**
- All code is 68k (Motorola 68000)
- Function names follow THINK C mangling (name string after UNLK A6 / RTS, with high-bit-set length byte)

**SCSI Plug 2.1.2:**
- 68k code
- A4-relative data base = file offset `$2BD2`
- Absolute-to-file address offset = `$061E` (file_offset = abs_addr + $061E)
- See `/Users/orion/work/scsi2pi-work/mesa-plug-harness/SCSI-PROTOCOL.md` for full CDB reference

## Key Functions

### Sampler Editor

| Function | File Offset | Size | Purpose |
|----------|-------------|------|---------|
| `SendAudioBufferToSampler` | 0x030713 - 0x030cc5 | 1,458 bytes | **Primary target** — uploads audio to device |
| `SendAudioFileToSampler` | (not yet located) | — | File-based upload variant |
| `GetSampleData` | 0x06ae09 (from prior analysis) | — | Downloads sample data (uses 'BULK' + opcode 0x0B) |
| `BuildSampleDataRequest` | (called from GetSampleData) | — | Builds SysEx for sample data ops |

### SCSI Plug

| Function | File Offset | Name Offset | Purpose |
|----------|-------------|-------------|---------|
| `SendData` | (TBD) | 0x121f | High-level send with mode dispatch |
| `SMSendData` | (TBD) | 0x16dc | Low-level SCSI MIDI send |
| `SMDataByteEnquiry` | (from SCSI-PROTOCOL.md) | — | Poll for pending bytes |
| `SMDispatchReply` | (from SCSI-PROTOCOL.md) | — | Read response |

### SCSI Plug Transfer Mode Dispatch Table

Located at file offset 0x0e58:

| Tag | Offset | Purpose |
|-----|--------|---------|
| `BOFF` → `SYSX` | 0x04 | Normal SysEx mode |
| `BOFF` | 0x1a | Buffer off |
| `BULK` | 0x30 | **Bulk sample data transfer — primary target** |
| `MIDI` | 0x2a2 | Raw MIDI passthrough |
| `SRAW` | 0x46 | Raw SysEx without handshake |
| `SYSX` | 0x246 | SysEx with handshake |

## Findings So Far

### SendAudioBufferToSampler (Sampler Editor)

1. **Uses SDS, not ASPACK.** No ASPACK opcode (0x0D) in the function. Multiple SDS dump header (0x01) references.
2. **Uses BULK transfer mode.** `MOVE.L #'BULK',-(SP)` before calling the SCSI Plug's SendData.
3. **No SDS data packet (0x02) construction.** The BULK handler in the SCSI Plug likely constructs and sends data packets internally.

### SCSI Plug BULK Handler

Not yet fully disassembled. The dispatch table at 0x0e58 routes 'BULK' to offset 0x30 from some base. Need to:
1. Determine the base address for the dispatch offsets
2. Disassemble the BULK handler
3. Understand how it sends SDS data packets over SCSI

## Decompiled Output

See `disassembly/` directory for function-level disassembly output.

## Related Documents

- `SCSI-NOTES.md` — Hardware testing notes, ASPACK protocol details
- `/Users/orion/work/scsi2pi-work/mesa-plug-harness/SCSI-PROTOCOL.md` — Full SCSI Plug CDB reference
- `docs/1.0/003-COMPLETE/scsi-midi-bridge/mesa-ii-analysis.md` — Original MESA II analysis
