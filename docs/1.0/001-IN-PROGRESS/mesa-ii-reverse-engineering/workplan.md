# Workplan: MESA II Reverse Engineering

## Technical Approach

Iterative reverse engineering cycle: **disassemble -> hypothesize -> test -> document**.

Each cycle produces a testable hypothesis about MESA II's protocol behavior, validates it against real hardware, and documents the results with confidence levels. We do not proceed to implementation until the protocol is validated end-to-end on hardware.

## Modules Affected

- `services/scsi-midi-bridge/` -- sample upload implementation
- `modules/e2e-infra/` -- hardware test scripts
- `docs/` -- protocol documentation, SCSI-NOTES.md

## Dependencies

- MESA II binaries (extracted in `akai-ux-improvement` feature)
- Disassembly tooling (`disassemble.py` in mesa-ii-analysis)
- S3000XL hardware (connected via SCSI on orion-m4)
- SCSI-NOTES.md (running log of all hardware experiments)

---

## Phase 1: Disassembly Infrastructure

Goal: Improve the 68k disassembler and fully annotate all sample transfer functions in both MESA II binaries.

- [ ] Improve `disassemble.py` to handle all 68000 addressing modes used by MESA II
- [ ] Annotate `SendAudioBufferToSampler` call graph completely (Sampler Editor side)
- [ ] Annotate SCSI Plug BULK handler (`ProcessBulkSend`, `ProcessBulkReceive`)
- [ ] Annotate `GetSampleData` / `ExportSampleData` call graph
- [ ] Document the BULK vs SRAW distinction: what data format does each use?
- [ ] Identify all SysEx message types constructed during sample transfer
- [ ] Map out the two-phase send sequence: what happens in phase 1 (BULK) vs phase 2 (SRAW)?
- [ ] Document all CDB opcodes used by SCSI Plug (confirm whether 0x0C is the only one)

## Phase 2: Protocol Validation

Goal: Validate the disassembly findings against real hardware with test scripts.

- [ ] Write a hardware test script that sends a minimal SDS sample via SCSI MIDI
- [ ] Test the two-phase send hypothesis: BULK header + SRAW audio data
- [ ] Measure MESA II's actual throughput (if testable without SheepShaver, use protocol replay)
- [ ] Confirm whether SLNGTH is set by the SDS header, by SRAW data length, or by a separate command
- [ ] Test for undocumented vendor-specific SCSI commands (scan CDB opcode space)
- [ ] Validate the complete upload sequence end-to-end: sample appears on device with correct SLNGTH
- [ ] Document validated protocol specification with message sequence diagrams

## Phase 3: Bridge Implementation

Goal: Implement the validated protocol in the bridge so sample uploads produce correct SLNGTH.

- [ ] Implement SDS-over-SCSI sample upload in the bridge using validated protocol
- [ ] Implement sample download (read audio from device) using validated protocol
- [ ] Add E2E test: upload sample, read it back, compare audio data
- [ ] Measure upload throughput and compare to MESA II baseline
- [ ] Update SCSI-NOTES.md with final protocol specification
- [ ] Update bridge API documentation

---

## GitHub Tracking

| Phase | Issue |
|-------|-------|
| Parent feature | [#304](https://github.com/audiocontrol-org/audiocontrol/issues/304) |
| Phase 1: Disassembly Infrastructure | [#305](https://github.com/audiocontrol-org/audiocontrol/issues/305) |
| Phase 2: Protocol Validation | [#306](https://github.com/audiocontrol-org/audiocontrol/issues/306) |
| Phase 3: Bridge Implementation | [#307](https://github.com/audiocontrol-org/audiocontrol/issues/307) |
