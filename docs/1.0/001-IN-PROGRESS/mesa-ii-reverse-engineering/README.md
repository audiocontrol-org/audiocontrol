# mesa-ii-reverse-engineering

Reverse-engineer MESA II's sample data transfer protocol to fix S3000XL sample upload SLNGTH issue.

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Disassembly Infrastructure | Mostly Complete | m68k-elf-objdump + annotate_function.py pipeline (1241 funcs indexed). SendAudioBufferToSampler (443 instr) and BuildSampleHeaderFromMAH (224 instr) fully decoded with zero placeholders. Findings: 200-byte Akai header layout, BULK/SRAW/BOFF/UALL emission sequence, SLNGTH at bytes 26-29 in BYTES not words. |
| Phase 2: Protocol Validation | **Closed (decided #315; redirected per decision-record-2026-04-18.md)** | Dispatch chain fully decoded except SRAW; `ActivateThisSocket` and `UALL` confirmed application-side with zero wire output. The BULK upload is irreducibly stateful — not feasibly replicable from a stateless Node test. **Initial decision (#315):** pivot to Phase 3 via SDS optimization (Option 1). **Superseded same day** after Phase 3.1-3.3 data showed SDS at 2.91 KB/s ≈ 1.4x serial MIDI — not enough to justify the SCSI bridge complexity. **Current direction:** continue MESA II RE until we have a testable, data-backed hypothesis (next: SRAW decode, task #30). The MESA II reference in `mesa-ii-analysis/` is now an active working set, not just preserved documentation. |
| Phase 3: Bridge Implementation | **MEASURED static determinism; MEASURED hardware rejection; live production path narrowed to NOT-`SMSendData`** | **MEASURED on hardware (Phase A-D, 2026-04-22):** `flag=0x80` rejected for both `0x0A` (RSDATA) and `0x0B` (SDATA) with sense `03 00 00 00`. flag=0x00 universally accepted. Flag byte is the discriminator, not opcode direction. **MEASURED on static side (A.9+A.12+A.13+A.14):** `SMSendData` body at scsi-plug file 0x160c **deterministically** builds CDB `0C 00 [len] [len] [len] 80` for mode=0x01 callers — A.14 confirmed no mutation between 0x160c entry and 0x1670 CDB-construction nullifies the mode byte; SMDispatchReply (0x139a) is called AFTER the SCSI write and cannot retroactively affect CDB. **Strongest current explanation (per Codex 2026-04-22 calibration):** the live production path likely does NOT reach `SMSendData` — it would emit `flag=0x80` deterministically; hardware rejects `0x80`; MESA works on hardware. **Still OPEN:** whether some unreproduced state/path condition could change the meaning/acceptability of the same emitted `0x80` form (i.e., production reaches the same body but the sampler accepts `0x80` in a state we haven't entered). **Hypothesis ranking after A.14:** (1) **STRONGEST CANDIDATE** — production reaches a different target (patches `0x106e` elsewhere) or a non-wire-equivalent live path; (2) state-precondition under which `0x80` is acceptable — STILL OPEN; (3) our interpretation of the candidate body — refuted by A.14. **Next critical-path move:** binary-source hunt (A.11/B1) — find a known-working MESA II distribution to byte-compare at file 0x1070-0x1071. **Narrow static subtrack also worth one pass (Codex 2026-04-22):** patch-mechanism / relocation-table hunt (A.15 = task #39) — look for non-literal patch references to the `0x106e/0x1070` neighborhood (resource-fork patch tables, import/loader records, indirect fixups). Bounded scope; stops at "no patch mechanism found" or "patch mechanism identified." **REPLY-direction findings** (A.6/A.7/A.8) remain MEASURED. Community writeup planned as terminal deliverable. |

See `SCSI-NOTES.md` (entries dated 2026-04-16) for detailed hardware findings.

## Links

| Item | Link |
|------|------|
| Branch | `feature/mesa-ii-reverse-engineering` |
| Worktree | `~/work/audiocontrol-work/audiocontrol-mesa-ii-reverse-engineering` |
| PRD | [prd.md](./prd.md) |
| Workplan | [workplan.md](./workplan.md) |
| MESA II Analysis | [mesa-ii-analysis/](./mesa-ii-analysis/) |
| SCSI Notes | [SCSI-NOTES.md](/SCSI-NOTES.md) |
| Parent Issue | [#304](https://github.com/audiocontrol-org/audiocontrol/issues/304) |
| Phase 1 Issue | [#305](https://github.com/audiocontrol-org/audiocontrol/issues/305) |
| Phase 2 Issue | [#306](https://github.com/audiocontrol-org/audiocontrol/issues/306) |
| Phase 3 Issue | [#307](https://github.com/audiocontrol-org/audiocontrol/issues/307) |
| Phase 2/3 Decision | [#315](https://github.com/audiocontrol-org/audiocontrol/issues/315) — Option 1 superseded → Option 2 committed per [decision-record-2026-04-19.md](./decision-record-2026-04-19.md) (supersedes [decision-record-2026-04-18.md](./decision-record-2026-04-18.md)) |
| Codex Parity Wave (closed 2026-04-18) | [#309](https://github.com/audiocontrol-org/audiocontrol/issues/309), [#310](https://github.com/audiocontrol-org/audiocontrol/issues/310), [#311](https://github.com/audiocontrol-org/audiocontrol/issues/311), [#312](https://github.com/audiocontrol-org/audiocontrol/issues/312), [#313](https://github.com/audiocontrol-org/audiocontrol/issues/313), [#314](https://github.com/audiocontrol-org/audiocontrol/issues/314) |
