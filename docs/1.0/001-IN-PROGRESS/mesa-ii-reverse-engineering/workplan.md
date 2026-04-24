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

- [~] **Step 0 (task #31): Path A — static decode of the install-edge path in `sampler-editor-rsrc.bin`.** Decode chain (A → A.5 → A.6 → A.7) ran to candidate completion. Per Codex parity calibration (#315 idx 4), claims downgraded from PROVED to MEASURED / CANDIDATE / OPEN: **MEASURED** = plug-side `CONS → ConnectToSocket` handler, `plug_slot[+0] ← SocketInfo[+0]` copy in plug's `ConnectToSocket`, ctor's `LEA $0x212; MOVE.L A0, A2@(0x8c)` at file 0x0596e7, `0x212 + EDIT_BASE = file 0x028169` is a real function with INIT magic check. **CANDIDATE** = the editor-side callback identity (`0x212 = file 0x028169 = main`) and `editor[+0x8c] = CMESASocket[+24] = SocketInfo[+0]` mapping. The link from "ctor sets this field" to "plug receives this exact byte at CONS time" is the editor-side packing step, which is **OPEN** (task #34 / Path A.10). **NOT** decoded as the prior framing implied: a "CONS SCSI command transmits SocketInfo" is speculative until A.10 settles whether it's wire-bus or in-process function call. Docs: `path-a-install-edge.md`, `path-a5-socketinfo-construction.md`, `path-a6-plug-slot-origin.md`, `path-a7-cons-construction.md` (each carries a calibration banner downgrading their bottom-line framing).
- [x] **Step 0.5 (task #32): Path A.8 — decode JSR 0x272a4 + vtable[+0xA8].** ✅ COMPLETE. Traced REPLY direction (sampler→editor): main → dispatcher at file 0x0287C5 → ADAT handler at 0x599a7 → `CMESASocket::AcceptData` at file 0x5A1E1. AcceptData `_BlockMove`s reply bytes into `CMESASocket[+8]`, stores 'SRAW'/'SYSX' tag at `CMESASocket[+12]`, byte count at `CMESASocket[+4]`. Error path writes 'OVER' to [+12] and returns 0xD503. Doc: `path-a8-sraw-handler.md`. **Re-orientation:** A.8 answered the wrong direction — REPLY path was traced; OUTBOUND CDB emission (the original Phase 3 question) is still unresolved.
- [x] **Step 0.6 (task #33): Path A.9 — decode `CSCSIPlug::SendData` SRAW handler body for outbound CDB emission.** ✅ COMPLETE. CDB shape `0C 00 [len] [len] [len] 80` MEASURED inside SMSendData candidate body. Driver: old Mac SCSI Manager `_SCSIWrite` trap `$A981`. Audio bytes sent raw (no encoding). Doc: `path-a9-sraw-outbound.md`. Reframed per Codex calibration: MEASURED-conditional-on-CANDIDATE (whether production reaches this body is a separate question).
- [~] **Step 0.7 (task #34, optional): Path A.10 — close Codex pressure point on editor→plug SocketInfo transmission.** **Effectively closed by A.16+A.18:** the loader (MESA II app's `LoadMESAPlugIn`) transmits SocketInfo via in-process function call + INIT struct (callback `$0x1E5A` = `SendCommandToEditor`), confirmed by both my A.18 and Codex's parallel decode. The editor-side packing question is settled at the architectural level — formal A.10 not needed.
- [x] **Path A.11 (task #35): identify patcher of scsi-plug 0x1070-0x1071.** ✅ COMPLETE Outcome B — patcher not in either binary. SHA256 equality with disk-image canonical (2026-04-22) refuted B1 extraction-artifact sub-hypothesis.
- [x] **Path A.12 (task #36): mode-byte semantics.** ✅ COMPLETE. 6 JSR 0x106e sites; mode=0x01→CDB[5]=0x80; BULK falls into SRAW handler under SCSI mode.
- [x] **Path A.13 (task #37): SMSendData bus-emission body.** ✅ COMPLETE. No encoding below CDB layer; raw-bytes claim MEASURED.
- [x] **Path A.14 (task #38): mode mutation trace.** ✅ COMPLETE Outcome B — mode preserved deterministically; SMSendData candidate emits `0x80` for mode=0x01.
- [x] **Path A.15 (task #39): patch-mechanism hunt.** ✅ COMPLETE Outcome B — no mechanism in either binary; first complete resource-type enumeration.
- [x] **Path A.16 (task #40): MESA II runtime patch hunt.** ✅ COMPLETE Outcome C — `LoadMESAPlugIn` identified; loader doesn't write to plug bytes; runtime boundary at `JSR (A4)` vtable dispatch.
- [x] **Path A.17 (task #41): plug INIT/entry decode.** ✅ COMPLETE Outcome B — plug entry has no writes via any addressing mode; PC-relative LEA scan returned 3 hits all targeting PLUG base; zero in 0x1060-0x1080 range.
- [x] **Path A.18 (task #42): callback at $0x1E5A.** ✅ COMPLETE Outcome B (parity-confirmed) — callback is `SendCommandToEditor`, inline tag-dispatcher with 122 editor commands; doesn't patch plug. Cross-verified with Codex's parallel decode.
- [x] **Phase A-D hardware verification (task #28):** ✅ COMPLETE. flag=0x00 universally accepted; flag=0x80 universally rejected. Bridge ships with current behavior.
- [x] ~~P1-P4 harness terrain~~ — **NO LONGER NEEDED.** Patch hypothesis closed without harness work. Per Codex agreement: investigation converged at static + hardware level.

**INVESTIGATION CONVERGED 2026-04-22.** See [`project-state-2026-04-22-converged.md`](./project-state-2026-04-22-converged.md). Bridge ships `CDB[5]=0x00`. State-precondition is STRONGEST RESIDUAL (not active blocker). Reopening criteria: regression → reopen from `DispatchCommandFromModule` / runtime-state terrain.

### Path E (Emulator-Forward 2026-04-22) — UNCONVERGED, ACTIVE

Per [#315 joint charter](https://github.com/audiocontrol-org/audiocontrol/issues/315), the "ship current bridge" framing is retracted as anti-goal. Sole charter goal: capture MESA's actual fast sample-transfer path under emulation.

- [x] **Path E.1 (8 bounded iterations 2026-04-22): drive plug SEND under harness; capture CDB.**
   - Iter 1: identified A-line trap dispatch wiring missing; first contract requirement
   - Iter 2: plug INIT path completes through main dispatch; `$A918` (SetWRefCon) identified as next trap
   - Iter 3: `$A918` confirmed via macemu trap table; "return 0" stub semantically correct
   - Iter 4: drove SEND, captured arg shapes at `$1106E` boundary — **RETRACTED** (CDB[5]=0x80 was harness-substituted, not plug-emitted)
   - Iter 5: patched `$1106E → $1160c` (mimicking editor install of SMSendData); SMSendData reached; new blocker = C++ runtime stubs
   - Iter 6: stubs + log-helper bypass → CDB construction observed; **BULK CDB[5]=0x00 MEASURED**
   - Iter 7: SRAW driven first; **SRAW CDB[5]=0x80 MEASURED**; Codex `0x163c-0x167e` static decode empirically confirmed byte-for-byte in both branches
   - Iter 8: tried bypassing recursive `JSR $1620.l` — insufficient; multiple call sites; deferred to Codex static identification
- [x] **Path E.2 (2026-04-24 via Codex): `JSR $1620.l` = `0x11620` is internal PB/SCSIDispatch helper inside plug.** Receives CDB pointer at `fp@(14)` as arg from caller. Reads 6 bytes from that pointer, copies them to SCSI Manager 4.3 PB at PB+0x44..+0x49, sets flags at PB+0x14, then emits `$A089 SCSIDispatch`.
- [x] **Path E.3 (2026-04-23/24): full post-CDB-construction path observed; `$A089 SCSIDispatch` fires.** Real CDB built in SMSendData's local frame at `fp@(-6..-1)`, copied via `0x11620` helper into PB, dispatched. Target/LUN correct. Harness display was reading wrong PB offset (+0x2a vs plug's +0x44); display bug confirmed, actual wire bytes validated.
- [x] **Path E.4 (2026-04-22/23): adopt resource-fork load model + fix `$A055` D0 clobber bug.** Plug self-relocation now functions; manual JSR/JMP relocation confirmed redundant. Full INIT→CONS→ASOK→SEND chain runs end-to-end; SendData hits real plug error (D0=0xc950 "no socket selected") rather than OOB cascade.
- [x] **Path E.5 (2026-04-23): implement `$A998` UseResFile + `$A994` CurResFile pair.** Per Codex static decode: ctor seeds `this+0x0938` from CurResFile; `main` save/switch/restores around DoMESACommand. UseResFile now correctly pops stack arg and updates harness state.
- [x] **Path E.6 (2026-04-23): CONS mutates persistent object state on correct object.** Root cause: inspecting wrong object. Harness seeded `CSCSIPLUG_OBJ` at 0x91000, but plug's `main` reads `this` from `a4@(0x262)` (set by INIT to a NewHandle-allocated object at 0x0005f1b8). Fixed: read `a4@(0x262)` first, then inspect. Also fixed: `init_struct` was at `SCSI_BUFFER` (0x50000) and plug's first `NewPtrClear(0x10000)` wiped it, so INIT setter at `0x102b8` stored callback=0 to `this+4`, tripping DoMESACommand's precondition gate. Moved `init_struct` to 0x70000.
- [x] **Path E.7 (2026-04-23): ASOK fully validated on persistent obj.** ActivateSocket at `vtable+0x34` (runtime 0x104c0) scans registered sockets matching `this+0x62+N*46` against `SocketInfo+0x26`. On match, copies `SocketInfo+0x24` (W) → `this+0x60+N*46` and `SocketInfo+0x2a` (L) → `this+0x66+N*46`. Probe with BEEF/DEADC0DE values confirmed byte-for-byte.
- [x] **Path E.8 (2026-04-23): SEND command's success path decoded.** vtable+0x14 (runtime 0x10854) clears `this+0xd6e`, loops sockets matching `SocketInfo+0xc` against `this+0x62+N*46`, copies `mem16(this + N*4 + 0xd72)` → `this+0xd6e` on match. If `this+0xd6e` remains zero → `MOVE.W #0xc950, D0` (source of 0xc950 error). Then success path loads `SocketInfo+8` as sub-tag, dispatches via `$148` to BOFF/BULK/SRAW/MIDI/SYSX handler.
- [x] **Path E.9 (2026-04-23/24): productive SRAW path proven.** SEND sub-tag='SRAW' → handler 0x10922 → gates on `this+0xe40` (seeded) → loads IP_Data+4, BNE to productive arm at 0x109a2 → matches 'SRAW' against IP_Data+8 → pushes 7-arg frame → JSR SMSendData at 0x1106e. Chooser/dialog routine at `$1187e` bypassed via bounded shortcut.
- [x] **Path E.10 (2026-04-24): real CDB captured end-to-end.** With BYPASS_1187E shortcut, SMSendData's local CDB builder at 0x1109e-0x110e0 runs. **MEASURED:** BULK opener = `0c 00 00 01 00 00`, BULK continuation = `0c 00 00 01 00 00`, SRAW payload = `0c 00 00 01 00 80`. CDB family: opcode 0x0C (Akai MIDI Send), 24-bit BE count, mode byte 0x00/0x80. WRITE direction, target = chooser-selected device.
- [x] **Path E.11 (2026-04-24): bridge parity divergence discovered.** Current `scsi-midi-bridge`'s `scsi_midi_send()` hardcodes `CDB[5]=0x00` with comment "S3000XL rejects 0x80". But MESA II emits `0x80` for SRAW. Bridge matches BULK but not SRAW. No current bridge path emits `0x0c ... 0x80`. May explain long-standing SLNGTH slow-upload issue — bridge potentially sends 7-bit SysEx-encoded (2× overhead) instead of raw binary.

**Charter deliverable — ACHIEVED:** the actual CDB MESA emits is `0x0C 00 <len24> <mode>` where mode=0x80 for SRAW, 0x00 for BULK. "Wire-side conditions" open: needs hardware acceptance test to verify S3000XL accepts 0x80 in proper BULK→SRAW→BOFF sequence.

**Next natural phase (Path F — hardware acceptance):**
- [ ] **Path F.1: test CDB[5]=0x80 on real S3000XL in BULK→SRAW sequence.** Send BULK opener (flag=0x00) then SRAW payload (flag=0x80); check whether device accepts or rejects.
- [ ] **Path F.2: if accepted, add mode-aware send helper to bridge.** `scsi_midi_send_raw()` variant that takes a mode byte; use 0x80 for actual sample data payloads.
- [ ] **Path F.3: measure throughput difference.** 0x80 path should be ~2× faster than 0x00 (raw binary vs 7-bit SysEx encoded).
- [ ] **Path F.4: confirm SLNGTH issue resolved.** Test sample upload end-to-end via the new path; verify SLNGTH fields land correctly.

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
