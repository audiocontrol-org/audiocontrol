# mesa-ii-reverse-engineering

Reverse-engineer MESA II's sample data transfer protocol to fix S3000XL sample upload SLNGTH issue.

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Disassembly Infrastructure | Mostly Complete | m68k-elf-objdump + annotate_function.py pipeline (1241 funcs indexed). SendAudioBufferToSampler (443 instr) and BuildSampleHeaderFromMAH (224 instr) fully decoded with zero placeholders. Findings: 200-byte Akai header layout, BULK/SRAW/BOFF/UALL emission sequence, SLNGTH at bytes 26-29 in BYTES not words. |
| Phase 2: Protocol Validation | **Closed (decided #315; redirected per decision-record-2026-04-18.md)** | Dispatch chain fully decoded except SRAW; `ActivateThisSocket` and `UALL` confirmed application-side with zero wire output. The BULK upload is irreducibly stateful — not feasibly replicable from a stateless Node test. **Initial decision (#315):** pivot to Phase 3 via SDS optimization (Option 1). **Superseded same day** after Phase 3.1-3.3 data showed SDS at 2.91 KB/s ≈ 1.4x serial MIDI — not enough to justify the SCSI bridge complexity. **Current direction:** continue MESA II RE until we have a testable, data-backed hypothesis (next: SRAW decode, task #30). The MESA II reference in `mesa-ii-analysis/` is now an active working set, not just preserved documentation. |
| Phase 3: Bridge Implementation | **Option 2 committed; SRAW outbound CANDIDATE wire format (CANDIDATE-backed, MEASURED-at-candidate-body); hardware validation pending** | After A.9 + A.12 + A.13 (2026-04-21), the candidate SRAW upload wire format is **MEASURED inside the candidate target body (`SMSendData` at file 0x160c)**: **CDB** = `0C 00 [len_hi] [len_mid] [len_lo] 80`; **Data** = raw audio bytes (no encoding, A.13); **Driver** = old Mac SCSI Manager `_SCSIWrite` trap `$A981`. **CANDIDATE link that remains:** that production `0x106e` actually dispatches to `SMSendData` (or to a wire-equivalent body). The structural fit is very strong (calling-convention exact match; 0x139a optional branch consistent with the mode-byte split per Codex parity 2026-04-22), but it is not proved that the live hardware path reaches that exact body. **Mode semantics (A.12)**: 6 JSR 0x106e caller sites; mode=0x01 → CDB[5]=0x80 (SRAW + BULK-via-SCSI fallthrough); mode=0x00 → CDB[5]=0x00 (SYSX/MIDI). BULK handler falls into SRAW handler at 0x0ec0 when SCSI mode flag `CSCSIPlug+0xe40` is set. **Tag dispatch (A.12)**: BOFF→0x0e82, BULK→0x0e9e (→0x0ec0), MIDI→0x1116, SRAW→0x0ec0, SYSX→0x10c6. Note that the mode-byte split may also carry control-path consequences beyond CDB[5] (Codex 2026-04-22 — 0x139a body suggests mutable count/control state). **REPLY-direction findings** (A.6/A.7/A.8) remain MEASURED. **Remaining OPEN (not blocking bridge fix):** (a) who patches 0x1070-0x1071 in production (task #35 = Path A.11; B1 vs B2 hypothesis matrix); (b) editor→plug SocketInfo transmission step (task #34 = Path A.10); (c) whether the live sender reaches `SMSendData` or an equivalent body. **Next critical-path move:** hardware-validate the candidate CDB shape on real S3000XL via the existing bridge per [`test-plan-2026-04-21-mesa-cdb-flag.md`](./test-plan-2026-04-21-mesa-cdb-flag.md). Community writeup planned as terminal deliverable. |

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
