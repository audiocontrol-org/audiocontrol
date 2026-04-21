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
- [x] ~~Strategic decision (task #23)~~ — initially decided as Option 1 (SDS optimize) via [#315](https://github.com/audiocontrol-org/audiocontrol/issues/315), then **SUPERSEDED later that day** after Phase 3.1-3.3 hardware data showed SCSI SDS = 2.91 KB/s ≈ 1.4x serial MIDI (not the 10x needed to justify the bridge infrastructure). New direction: continue MESA II RE until we have a testable, data-backed hypothesis. See [`decision-record-2026-04-18.md`](./decision-record-2026-04-18.md) for full rationale and guard rails. Option 2 (harness end-to-end) is now effectively the active path in narrower form (decode-driven, not full harness expansion up front). Option 3 (opcode scan) still rejected.
- [ ] ~~Hardware-verify the BULK SDATA finding (task #14)~~ — **dropped per #315 decision**. The BULK upload is irreducibly stateful; not pursuing.
- [ ] **Decode SRAW wire bytes (task #30)** — **NOW THE CRITICAL PATH** per `decision-record-2026-04-18.md`. SRAW is the only undecoded piece of MESA's upload chain. Find primary-evidence answer to "what bytes does the SCSI Plug emit when called with `SendData(socket, 'SRAW', byte_count, audio_buf_ptr)`?" Approaches: (a) decode SCSI Plug Open() to find what patches `$1106E`, (b) decode the unpatched `$001160` stub, (c) extend harness to actually run SRAW path, or (d) search for direct writes to `$1106E`. Pick cheapest. (Replaces the earlier "task #15" entry which was deferred under the now-superseded Option 1 framing.)
- [ ] ~~Find UALL handler (task #16)~~ — still deferred. UALL is confirmed application-side per #314 (closed). Not on the SRAW-decode critical path; revisit only if SRAW decode reveals UALL is part of the answer.
- [ ] **Capture SRAW wire bytes (task #15)**: agent's "would need ASPACK wrap" was an inference, not a finding
- [ ] **Find UALL handler (task #16)**: not in SendData TagDispatch, uses vtable[0x28]
- [ ] Document validated protocol specification with message sequence diagrams (after #15/#16/#17)

## Phase 3: Option 2 — Harness End-to-End via Terrain-as-Necessary

**Decision context:** [`decision-record-2026-04-19.md`](./decision-record-2026-04-19.md) supersedes the earlier 2026-04-18 commitment. After task #30 reached Outcome B (SCSI Plug static decode exhausted at two runtime boundaries) and Codex parity confirmed no ordinary install edge in the Sampler Editor binary either, the remaining question (how MESA's live sender is installed/redirected at runtime) can only be answered by extending `mesa-plug-harness` to execute the Sampler Editor binary end-to-end.

**Approach:** "Terrain-as-necessary." Build minimum harness extension needed per priority test, stop between each, reassess. Don't build the whole Mac toolbox emulator up front.

### Priority tests (from Codex's #315 recommendation)

- [x] **Step 0 (task #31): Path A — static decode of the install-edge path in `sampler-editor-rsrc.bin`.** ✅ COMPLETE. Path A → A.5 → A.6 → A.7 chain settled the install edge: editor ctor installs fn_ptr `0x212` (file 0x028169 = `main`) into `SocketInfo[+0]` at file 0x0596e7; CONS SCSI command transmits SocketInfo to plug; plug copies into `plug_slot[+0]`; `$11fe` JSRs to editor's `main`. `main` is a generic dispatcher (only INIT magic check; everything else routes via `vtable[+0xA8]` of a global handle built at INIT time by JSR 0x272a4). No external runtime patching. Docs: `path-a-install-edge.md`, `path-a5-socketinfo-construction.md`, `path-a6-plug-slot-origin.md`, `path-a7-cons-construction.md`. `sraw-decoded.md` correction banner reflects the closed state.
- [x] **Step 0.5 (task #32): Path A.8 — decode JSR 0x272a4 + vtable[+0xA8].** ✅ COMPLETE. Traced REPLY direction (sampler→editor): main → dispatcher at file 0x0287C5 → ADAT handler at 0x599a7 → `CMESASocket::AcceptData` at file 0x5A1E1. AcceptData `_BlockMove`s reply bytes into `CMESASocket[+8]`, stores 'SRAW'/'SYSX' tag at `CMESASocket[+12]`, byte count at `CMESASocket[+4]`. Error path writes 'OVER' to [+12] and returns 0xD503. Doc: `path-a8-sraw-handler.md`. **Re-orientation:** A.8 answered the wrong direction — REPLY path was traced; OUTBOUND CDB emission (the original Phase 3 question) is still unresolved.
- [ ] **Step 0.6 (task #33): Path A.9 — decode `CSCSIPlug::SendData` SRAW handler body for outbound CDB emission.** The SRAW handler at scsi-plug file 0x0ec0 has CDB construction + SCSI bus emission call BEFORE the shared-entry JSR at $106e. Decode that body to find what bytes get sent. **This directly answers the original Phase 3 question.** 1-2 hours of agent work.
- [ ] **Step 0.7 (task #34, optional): Path A.10 — close Codex pressure point on editor→plug SocketInfo transmission.** Codex flagged via #315 (2026-04-21): A.7 hand-waved how editor's `CMESASocket[+24]` (= 0x212) actually reaches the plug's incoming SocketInfo arg. Likely architecture is in-process function call (plug loaded as code resource in editor's address space), not SCSI wire transmission. Lower priority than A.9.
- [ ] **P1: Init-time state snapshots.** Harness terrain: load `sampler-editor-rsrc.bin` alongside `scsi-plug-rsrc.bin`; execute init sequence. Snapshot plug-slot state (especially $106e effective call target) at phase boundaries: pre-init, post-InitModule, at transfer start. Success: concrete runtime redirection/install event OR show none occurs.
- [ ] **P2: Wire capture for state-only vs wire-emitting phases.** Harness terrain: P1 + enough send-path execution to reach the boundaries. Isolate `ActivateThisSocket`, plug selection/connection, pre- and post-BULK phases. Success: confirm or refute that `ActivateThisSocket` is state-only in real operation (vs wire-emitting).
- [ ] **P3: Module-side post-transfer dependency test.** Harness terrain: P1 + P2 + interruption mechanism. Compare normal vs interrupted post-transfer flow. Watch for: sampler accepting data but not committing, UI/state mismatch, transfer completing but sample unusable. Success: determine whether module-side post-transfer behavior is the remaining correctness dependency.
- [ ] **P4: Throughput decision check.** Measure real throughput for any runtime-discovered alternative path. Compare against 8 KB/s ship target, 15 KB/s aspirational, serial-MIDI baseline. Success: justify continued RE or kill decisively.

### What NOT to do (from Codex's explicit prohibitions)

- Don't handcraft speculative SRAW/SYSX payloads as if they were MESA's
- Don't re-decode ordinary `CSCSIPlug::SendData` helpers
- Don't treat static guesses about low-address call targets as hardware hypotheses
- Don't abandon the guard rails carried forward from `decision-record-2026-04-18.md`: primary evidence only, measured > inferred, mark unknowns as unknowns

### Community writeup (planned terminal deliverable)

After Option 2 reaches a natural terminal point (success or definitive negative result), package findings for the vintage-computing RE community. Content: project arc, tools built, findings, process lessons, Option 2 results. Defer packaging until terminal. Tracked informally; will be created as a separate doc when the time comes.

### Phase 3.1-3.3 archive (SDS optimization — superseded, preserved as evidence of why Option 2 was chosen)

### Phase 3.1-3.3 archive: SDS optimization data (kept as evidence of supersession)

**Throughput targets (per #315 decision comment):**

| Threshold | Throughput | A 1MB sample takes |
|---|---|---|
| Current baseline | ~2.2 KB/s | ~7.5 min |
| **Minimum acceptable (ship)** | **8 KB/s** | **~2 min** |
| Aspirational | 15 KB/s | ~70 sec |
| Reassessment threshold | <4 KB/s after optimization | re-open strategic conversation |

**Tasks (in order of expected payoff):**

- [x] **Phase 3.1 (task #24): Measure current SDS baseline on hardware** — done. **2.91 KB/s steady-state** at batch=20 depth=1 on 16000-sample upload. Per-packet floors at 26.2ms. Doc: `sds-baseline.md`.
- [x] **Phase 3.2 (task #25): Try larger CDB batches** — done, NEGATIVE. batch=20 is the optimum; batch=40 → 0.76x; batch=60+ → 0.42x plateau. Device-side MIDI buffer is the bottleneck, not per-CDB overhead. `batch_size` JSON knob added (default 20). Doc: `sds-phase-3.2-batch-sweep.md`.
- [x] **Phase 3.3 (task #26): Pipeline ACK validation** — done, NEGATIVE. depth=1 is the optimum at 2.89 KB/s; depth=2-8 → 0.59-0.70x. Combined with 3.2, confirms the device's natural SDS rate is ~27ms/packet = 2.9 KB/s — the bridge is NOT the bottleneck. `pipeline_depth` JSON knob added (default 1). **Triggers #315 stop criterion.** Doc: `sds-phase-3.3-pipeline-sweep.md`.
- [x] ~~Phase 3.4 (task #27): Skip per-packet ACK validation~~ — **DROPPED** per `decision-record-2026-04-18.md`. The bottleneck is device processing time; bridge-side ACK handling won't change throughput. Task #27 deleted.
- [x] ~~Try larger SDS data packets~~ — DROPPED. SDS protocol spec is 120 bytes/packet; deviating is non-standard. SDS path itself is no longer the critical work.
- [ ] **Phase 3.5 (task #28): Hardware-verify the chosen delivery path** — re-scoped per Codex guidance: waits for the SRAW decode (task #30) to produce a testable hypothesis, then verifies whatever we end up shipping. Round-trip E2E test required.
- [x] **Stop criterion check** — TRIGGERED at 2.9 KB/s. Result was the supersession of Option 1, not a "stop and ship" — see decision record.

**Deferred (per #315):** Sample download (`GetSampleData`/`ExportSampleData`) parity with MESA. Not blocking the SLNGTH bug fix.

---

## GitHub Tracking

| Phase | Issue |
|-------|-------|
| Parent feature | [#304](https://github.com/audiocontrol-org/audiocontrol/issues/304) |
| Phase 1: Disassembly Infrastructure | [#305](https://github.com/audiocontrol-org/audiocontrol/issues/305) |
| Phase 2: Protocol Validation | [#306](https://github.com/audiocontrol-org/audiocontrol/issues/306) |
| Phase 3: Bridge Implementation | [#307](https://github.com/audiocontrol-org/audiocontrol/issues/307) |
