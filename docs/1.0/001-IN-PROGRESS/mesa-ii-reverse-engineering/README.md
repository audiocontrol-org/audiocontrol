# mesa-ii-reverse-engineering

Reverse-engineer MESA II's sample data transfer protocol to fix S3000XL sample upload SLNGTH issue.

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Disassembly Infrastructure | Mostly Complete | m68k-elf-objdump + annotate_function.py pipeline (1241 funcs indexed). SendAudioBufferToSampler (443 instr) and BuildSampleHeaderFromMAH (224 instr) fully decoded with zero placeholders. Findings: 200-byte Akai header layout, BULK/SRAW/BOFF/UALL emission sequence, SLNGTH at bytes 26-29 in BYTES not words. |
| Phase 2: Protocol Validation | **Closed (decided #315; redirected per decision-record-2026-04-18.md)** | Dispatch chain fully decoded except SRAW; `ActivateThisSocket` and `UALL` confirmed application-side with zero wire output. The BULK upload is irreducibly stateful — not feasibly replicable from a stateless Node test. **Initial decision (#315):** pivot to Phase 3 via SDS optimization (Option 1). **Superseded same day** after Phase 3.1-3.3 data showed SDS at 2.91 KB/s ≈ 1.4x serial MIDI — not enough to justify the SCSI bridge complexity. **Current direction:** continue MESA II RE until we have a testable, data-backed hypothesis (next: SRAW decode, task #30). The MESA II reference in `mesa-ii-analysis/` is now an active working set, not just preserved documentation. |
| Phase 3: Bridge Implementation | **CANDIDATE static wire shape; MEASURED hardware rejection of flag=0x80; production-emission OPEN** | **MEASURED on hardware (Phase A-D, 2026-04-22):** `flag=0x80` is rejected for both `0x0A` (RSDATA) and `0x0B` (SDATA) with non-standard sense `03 00 00 00`. Sampler distinguishes `02` (invalid command) from `03` (recognized but rejected). flag=0x00 is universally accepted. Codex's READ-vs-WRITE ambiguity hypothesis refuted — flag byte is the discriminator, not opcode direction. **CANDIDATE from static side (A.9+A.12+A.13):** `SMSendData` body at scsi-plug file 0x160c builds CDB `0C 00 [len_hi] [len_mid] [len_lo] 80` on the mode!=0 path; uses old Mac SCSI Manager `_SCSIWrite` trap `$A981`; raw audio bytes (no encoding). **OPEN:** whether the production sampler-editor binary actually reaches that exact body or a wire-equivalent path that emits `0x80`. Three live explanations (Codex ranking 2026-04-22): (1) production patches `0x106e` to a target that emits `CDB[5]=0x00` — strongest; (2) `0x80` valid only behind a state precondition we're not reproducing — viable; (3) our interpretation of the candidate body is wrong — weaker. **Next critical-path move:** ONE focused static pass on the `0x160c → 0x139a → 0x1670` mutation relationship (does the `+0x0e3c` arg path plausibly alter the flag-byte decision before CDB build?) — task #38 = Path A.14. Hardware preconditioning experiments deferred unless static decode produces a strongly-evidenced setup step. **REPLY-direction findings** (A.6/A.7/A.8) remain MEASURED. **Other OPEN:** patcher of 0x1070-0x1071 (#35), editor→plug SocketInfo transmission (#34). Community writeup planned as terminal deliverable. |

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
