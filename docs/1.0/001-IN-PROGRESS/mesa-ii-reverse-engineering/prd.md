# PRD: MESA II Reverse Engineering

## Problem Statement

Sample uploads to the S3000XL produce truncated playback: SLNGTH is stuck at ~48 regardless of actual data size. We need to understand how MESA II (Akai's official editor) transfers sample data over SCSI to replicate its approach.

The current bridge implementation can write sample audio data via SDATA/ASPACK nibble encoding, and the device accepts the writes without error, but SLNGTH never updates to reflect the actual sample length. This means the device only plays back the first ~48 words of any uploaded sample.

## Acceptance Criteria

1. Complete understanding of how MESA II's `SendAudioBufferToSampler` creates samples with correct SLNGTH
2. Complete understanding of how MESA II's `GetSampleData` / `ExportSampleData` reads sample audio from the device
3. Documented protocol specification for sample data upload that produces correct SLNGTH
4. A working sample upload implementation in the bridge that creates samples with correct length at acceptable speed
5. All findings documented in SCSI-NOTES.md with timestamps and confidence levels

## Out of Scope

- UI changes to the web editor
- Non-sample protocol reverse engineering
- MESA II disk-based operations
- Running MESA II in SheepShaver

## Open Questions

1. Does the SCSI Plug's BULK handler use a different CDB than 0x0C?
2. Does MESA send a complete SDS transfer or a hybrid approach?
3. What throughput does MESA achieve?
4. Are there undocumented vendor-specific SCSI commands?

## Prior Work

From the `akai-ux-improvement` feature:

- MESA II binaries extracted (Sampler Editor 507KB, SCSI Plug 12KB)
- Disassembly script and initial disassembly of key functions
- `SendAudioBufferToSampler` uses SDS opcode 0x01 with BULK mode, two-phase send (BULK + SRAW)
- SDATA/ASPACK nibble writes accepted by device but don't update SLNGTH
- SLNGTH appears read-only via SDATA
- SDATA with offset/length (`BuildSampleDataRequest` format) gets no response over SCSI MIDI
- Full findings in SCSI-NOTES.md dated 2026-04-16
