# Systematic exploration of S3000XL bulk sample transfer (ASPACK)

## Context

ASPACK (opcode 0x0D) writes sample PCM data at 23.4 KB/s — 10.6x faster than batched SDS (2.2 KB/s). But two critical gaps block production use:

1. **Multi-chunk writes fail** — offset > 0 returns empty reply. MESA II uses 192-byte chunks with offsets, so this must work. The encoding or sequencing is wrong.
2. **Cannot create new samples** — ASPACK only overwrites existing samples. Need to find how MESA creates sample slots.

## Exploration plan

### Phase 1: Fix CDB flag byte and protocol flow

The `mesa-plug-harness` repo (`/Users/orion/work/scsi2pi-work/mesa-plug-harness/SCSI-PROTOCOL.md`) reveals critical details about how MESA communicates:

**CDB flag byte (byte 5):** MESA uses `$80` on CDB 0x0C when a reply is expected, `$00` for fire-and-forget. Our bridge always uses `0x00`. This may explain why multi-chunk ASPACK fails — the device might not buffer the REPLY without the flag.

**MESA's protocol flow before each send:**
1. Enable MIDI mode
2. **Drain pending data** (poll + read any buffered bytes)
3. Send MIDI data with flag `$80`
4. Read reply

Our multi-chunk test skips the drain step between chunks.

#### Steps

1. **Test CDB flag byte $80 on send**
   - Change CDB 0x0C byte 5 from `0x00` to `0x80` for ASPACK sends
   - Test if multi-chunk writes work with the flag

2. **Test draining pending data between chunks**
   - After each ASPACK REPLY, poll (0x0D) and read (0x0E) any pending bytes before sending next chunk
   - MESA does this before every send

3. **Test opcode 0x0B (SDATA) for bulk data writes**
   - MESA's disassembly shows opcode 0x0B pushed to `BuildSampleDataRequest`
   - Try sending sample data with opcode 0x0B instead of 0x0D

4. **Test nibble encoding variations for offset parameter**
   - Current test uses LE nibble pairs. Try 7-bit encoding, BE nibbles, raw bytes

### Phase 2: Find sample creation mechanism

5. **Search MESA for `NewProgram`/`NewSample` SysEx commands**
   - MESA has `NewProgram(name, short)` — there may be an equivalent for samples
   - Check if there's an undocumented opcode for creating empty sample slots
   - Read the akaitools source for sample creation commands

6. **Test creating sample via SDATA (header write) before ASPACK**
   - Write a sample header (SDATA 0x0B) with correct SLNGTH field first
   - Then write audio data via ASPACK (0x0D)
   - The header write might allocate memory without needing SDS

7. **Test minimal SDS to create slot**
   - Send SDS dump header + just ONE data packet + observe if sample appears
   - Find the minimum SDS interaction needed to register a sample in RSLIST

### Phase 3: Optimize multi-chunk transfer

8. **Test `SetSCSIMIDIMode` (CDB 0x09 variations)**
   - MESA's SCSI Plug has `SetSCSIMIDIMode(short scsiId, uchar midiMode, uchar thruMode)` which sets byte 2 (MIDI on/off) and byte 3 (thru on/off)
   - We only set byte 2. Test if byte 3 (thru mode) affects bulk transfer behavior

9. **Test keeping MIDI mode enabled across chunks**
   - Current multi-chunk test enables MIDI mode once, sends all chunks
   - Verify the device doesn't auto-disable after receiving REPLY
   - Add delays between chunks to test timing sensitivity

10. **Measure maximum reliable chunk size**
    - Test increasing chunk sizes until failure
    - Find the SysEx message size limit for the SCSI MIDI interface

### Phase 4: Integration

11. **Implement ASPACK upload path in scsi-midi-bridge**
    - New bridge endpoint or extend `/sds/stream` WebSocket
    - Keep MIDI mode enabled for entire transfer
    - Chunk data into optimal size
    - Progress reporting per chunk

## Reference files

- Protocol reference: [`docs/1.0/s3000xl-editor/s3000xl-sysex-protocol.md`](../s3000xl-editor/s3000xl-sysex-protocol.md)
- MESA II analysis: [`docs/1.0/scsi-midi-bridge/mesa-ii-analysis.md`](../scsi-midi-bridge/mesa-ii-analysis.md)
- SCSI sample transfer findings: [`docs/1.0/scsi-sample-transfer/scsi-sample-data-findings.md`](scsi-sample-data-findings.md)
- MESA SCSI Plug protocol: `/Users/orion/work/scsi2pi-work/mesa-plug-harness/SCSI-PROTOCOL.md`
- Test scripts: `modules/e2e-infra/src/node/lib/test-aspack-*.ts`

## Verification

Each step produces a test script in `modules/e2e-infra/src/node/lib/` runnable with:
```
E2E_SCSI_BRIDGE_URL=http://s3k.local:7033 tsx modules/e2e-infra/src/node/lib/test-<name>.ts
```

Results are documented in the protocol reference and findings docs before moving to the next step.
