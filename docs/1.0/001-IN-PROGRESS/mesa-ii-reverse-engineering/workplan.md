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

- [x] ~~Improve `disassemble.py`~~ — replaced with `m68k-elf-objdump` + `annotate_function.py` (1241 funcs indexed)
- [x] Annotate `SendAudioBufferToSampler` call graph completely (Sampler Editor side) — 443 instr decoded, zero placeholders
- [x] Annotate SCSI Plug BULK handler — full SendData + TagDispatch traced; BULK→0x10e9e, SRAW→0x10ec0, BOFF→0x10e82
- [ ] Annotate `GetSampleData` / `ExportSampleData` call graph (deferred until upload path is solved)
- [x] Document the BULK vs SRAW distinction: BULK uses opcode 0x0B SDATA with nibble-encoded 200-byte Akai header; SRAW shares same code path with flag=1 (wire bytes not yet captured — task #15)
- [x] Identify all SysEx message types constructed during sample transfer — `F0 47 ch 0B 48 [400 nibble bytes] F7` for BULK; SRAW unknown
- [x] Map out the multi-phase send sequence: SDS-header → BULK open → SRAW chunks → BOFF (local cleanup) → UALL (vtable[0x28], path TBD)
- [x] Document all CDB opcodes used by SCSI Plug — only 0x0C confirmed for BULK; SRAW unknown

## Phase 2: Protocol Validation

Goal: Validate the disassembly findings against real hardware with test scripts.

- [x] ~~Hardware test script for minimal SDS~~ — superseded by harness-based dynamic trace
- [x] Test the multi-phase send hypothesis — confirmed via live trace: BULK SDATA + SRAW (path TBD) + BOFF cleanup + UALL terminator
- [ ] Measure MESA II's actual throughput (deferred to Phase 3)
- [x] Confirm SLNGTH source — set by 200-byte Akai header bytes 26-29 (nibble-encoded from total_byte_length IN BYTES) sent via SDATA opcode 0x0B
- [x] Test for undocumented vendor-specific SCSI commands — none found; MESA uses standard CDB 0x0C with Akai SysEx framing
- [x] ~~Hardware-verify BULK finding (task #14)~~ — attempted, FAILED. Sending the harness-captured bytes produces no reply and no sample. The harness Phase 5 trace was of a synthetic IP_Data call path that MESA's real code never makes.
- [x] ~~Decode vtable[0x017c] (task #17)~~ — done. It's `CAkaiSampler::AcceptSampleHeader` at file 0x06ae09 in the Sampler Editor binary (NOT in the SCSI Plug as initially suspected). Dispatch chain matches the harness Phase 5 trace. See `mesa-ii-analysis/send-sample-header-decoded.md`.
- [x] ~~Decode CAkaiSampler::vtable[0x14] (task #18)~~ — done. It's `CAkaiMIDIDispatcher::BuildCommand` at file 0x06ca97. Real SysEx is 392 bytes (5-byte header + 2-byte sample_number + 384 nibble bytes + F7). Nibbleize covers only header_buf[0..191]. See `mesa-ii-analysis/sysex-builder-decoded.md`. Test corrected with new format — still fails, blocking on SLNGTH encoding.
- [x] ~~Decode vtable[0x38] called by BuildSampleHeaderFromMAH (task #19)~~ — done. The 6 calls dispatch through `CSamplerModule@(0xDA4)` = `CAkaiSampler*` (NOT CMESASocket; see issue #309). Its vtable is `CAkaiMIDIDispatcher`'s at file 0x06f74b, stored at `object+2`. Slot 0x38 = `SwapLongWord` (32-bit byte reversal). Test updated with `swapLongWord()` encoding. See `mesa-ii-analysis/cakaidispatcher-slot38-swaplongword.md`.
- [x] ~~Preamble hypothesis (task #20)~~ — partially confirmed but model revised. Tested SDS-create preamble + Akai SDATA: device replies (was silent before) but does NOT apply SDATA content. Codex #313 then revealed `vtable[0x30]` is `CMESASocket::ActivateThisSocket(Uc)` (file 0x05a0a7) — a socket-state/channel-activation function, NOT a transport primitive. The "preamble" we've been chasing is in-memory state setup on the application-side socket, not wire protocol. See `disassembly-full/CMESASocket-vtable30-ActivateThisSocket.annotated.txt`.
- [x] ~~Replicate ActivateThisSocket sequence (task #21)~~ — decoded: pure in-memory state via `CMESAPlugIn::ActivateSocket` at SCSI Plug file 0x000a5e (3 writes: `activation_code`, `buffer_ptr`, status long). Zero wire bytes. See `mesa-ii-analysis/activate-this-socket-decoded.md`.
- [x] ~~Decode UALL/LALL handshake (task #22)~~ — resolved via primary-evidence verification. UALL dispatched through `*(this+4) -> vtable[0x28]` (NOT through the socket; verified at file 0x030c89-0x030c93). UALL string absent from `scsi-plug-rsrc.bin` (0 of 26 occurrences). It's a `CSamplerModule` command-bus token, not a wire-protocol tag. See sampler-editor-decoded.md §6 (corrected) and Codex issue #314.
- [x] ~~Strategic decision (task #23)~~ — **DECIDED via [#315](https://github.com/audiocontrol-org/audiocontrol/issues/315): Option 1 (SDS optimization)**. Codex parity review aligned. Phase 2 closed; Phase 3 active. Defer Option 2 (harness end-to-end) as later research. Reject Option 3 (opcode scan) — firmware risk. The MESA II reference is preserved in `mesa-ii-analysis/` for any future Option 2 attempt.
- [ ] ~~Hardware-verify the BULK SDATA finding (task #14)~~ — **dropped per #315 decision**. The BULK upload is irreducibly stateful; not pursuing.
- [ ] ~~Trace SRAW on the wire (task #15)~~ — **deferred per #315**. Not on the Option 1 critical path.
- [ ] ~~Find UALL handler (task #16)~~ — **deferred per #315**. UALL is application-side per #314; not on the Option 1 critical path.
- [ ] **Capture SRAW wire bytes (task #15)**: agent's "would need ASPACK wrap" was an inference, not a finding
- [ ] **Find UALL handler (task #16)**: not in SendData TagDispatch, uses vtable[0x28]
- [ ] Document validated protocol specification with message sequence diagrams (after #15/#16/#17)

## Phase 3: Bridge Implementation — Option 1 (SDS Optimization)

**Decision context:** Per [#315](https://github.com/audiocontrol-org/audiocontrol/issues/315), MESA's BULK upload is irreducibly stateful and not feasibly replicable from a stateless Node test. The pragmatic path is to optimize the existing batched-SDS upload, which already produces correct SLNGTH at sample creation time (per Theory B verification in SCSI-NOTES.md).

**Throughput targets (per #315 decision comment):**

| Threshold | Throughput | A 1MB sample takes |
|---|---|---|
| Current baseline | ~2.2 KB/s | ~7.5 min |
| **Minimum acceptable (ship)** | **8 KB/s** | **~2 min** |
| Aspirational | 15 KB/s | ~70 sec |
| Reassessment threshold | <4 KB/s after optimization | re-open strategic conversation |

**Tasks (in order of expected payoff):**

- [ ] **Phase 3.1 (task #24): Measure current SDS baseline on hardware** — confirm the ~2.2 KB/s number, capture per-stage timing (CDB write, ACK wait, end-of-transfer). Establishes a real number to optimize against.
- [ ] **Phase 3.2 (task #25): Try larger CDB batches** — currently 20 packets/CDB. Test 40, 60, 100. Cheap to try; could 2-5x throughput.
- [ ] **Phase 3.3 (task #26): Pipeline ACK validation** — stream the whole batch and validate ACK count at the end. May yield another 1.5-2x.
- [ ] **Phase 3.4 (task #27): Skip per-packet ACK validation** — rely on end-of-transfer success indicator + post-transfer sample readback validation.
- [ ] **Try larger SDS data packets** if the protocol permits — currently 120-byte payload (40 samples).
- [ ] **Phase 3.5 (task #28): Hardware-verify final implementation** + add atomic round-trip E2E test (per memory `feedback_e2e_roundtrip.md`).
- [ ] **Stop criterion check** — once throughput hits 8 KB/s, declare Option 1 done; if plateau below 4 KB/s, reopen strategic conversation.
- [ ] Update SCSI-NOTES.md with final SDS-optimization findings.
- [ ] Update bridge API documentation.

**Deferred (per #315):** Sample download (`GetSampleData`/`ExportSampleData`) parity with MESA. Not blocking the SLNGTH bug fix.

---

## GitHub Tracking

| Phase | Issue |
|-------|-------|
| Parent feature | [#304](https://github.com/audiocontrol-org/audiocontrol/issues/304) |
| Phase 1: Disassembly Infrastructure | [#305](https://github.com/audiocontrol-org/audiocontrol/issues/305) |
| Phase 2: Protocol Validation | [#306](https://github.com/audiocontrol-org/audiocontrol/issues/306) |
| Phase 3: Bridge Implementation | [#307](https://github.com/audiocontrol-org/audiocontrol/issues/307) |
