# mesa-ii-reverse-engineering

Reverse-engineer MESA II's sample data transfer protocol to fix S3000XL sample upload SLNGTH issue.

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Disassembly Infrastructure | Mostly Complete | m68k-elf-objdump + annotate_function.py pipeline (1241 funcs indexed). SendAudioBufferToSampler (443 instr) and BuildSampleHeaderFromMAH (224 instr) fully decoded with zero placeholders. Findings: 200-byte Akai header layout, BULK/SRAW/BOFF/UALL emission sequence, SLNGTH at bytes 26-29 in BYTES not words. |
| Phase 2: Protocol Validation | **Closed (decided #315; redirected per decision-record-2026-04-18.md)** | Dispatch chain fully decoded except SRAW; `ActivateThisSocket` and `UALL` confirmed application-side with zero wire output. The BULK upload is irreducibly stateful — not feasibly replicable from a stateless Node test. **Initial decision (#315):** pivot to Phase 3 via SDS optimization (Option 1). **Superseded same day** after Phase 3.1-3.3 data showed SDS at 2.91 KB/s ≈ 1.4x serial MIDI — not enough to justify the SCSI bridge complexity. **Current direction:** continue MESA II RE until we have a testable, data-backed hypothesis (next: SRAW decode, task #30). The MESA II reference in `mesa-ii-analysis/` is now an active working set, not just preserved documentation. |
| Phase 3: Bridge Implementation | **Option 2 committed; install-edge + reply path decoded (#31, #32 done); outbound CDB emission remains (#33)** | Path A → A.5 → A.6 → A.7 fully decoded the install edge. A.8 traced the REPLY direction (sampler→editor) through vtable[+0xA8] → dispatcher at file 0x0287C5 → ADAT handler → `CMESASocket::AcceptData` at file 0x5A1E1 (`_BlockMove` reply bytes into `CMESASocket[+8]`; store 'SRAW'/'SYSX' tag at `CMESASocket[+12]`). **'SRAW'/'SYSX' are also tags in the sampler's reply protocol, not just outbound command tags.** Earlier "external runtime patching" hypothesis is dissolved. **Still open:** (a) outbound CDB emission for SRAW audio uploads (in `CSCSIPlug::SendData` SRAW handler at file 0x0ec0 before the shared-entry JSR; task #33 = Path A.9) — this directly answers the original Phase 3 question; (b) Codex pressure point on editor→plug SocketInfo transmission (task #34 = Path A.10, lower priority). Community writeup planned as terminal deliverable. |

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
