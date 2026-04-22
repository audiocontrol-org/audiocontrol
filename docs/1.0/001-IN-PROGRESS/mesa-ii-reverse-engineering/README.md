# mesa-ii-reverse-engineering

Reverse-engineer MESA II's sample data transfer protocol to fix S3000XL sample upload SLNGTH issue.

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Disassembly Infrastructure | Mostly Complete | m68k-elf-objdump + annotate_function.py pipeline (1241 funcs indexed). SendAudioBufferToSampler (443 instr) and BuildSampleHeaderFromMAH (224 instr) fully decoded with zero placeholders. Findings: 200-byte Akai header layout, BULK/SRAW/BOFF/UALL emission sequence, SLNGTH at bytes 26-29 in BYTES not words. |
| Phase 2: Protocol Validation | **Closed (decided #315; redirected per decision-record-2026-04-18.md)** | Dispatch chain fully decoded except SRAW; `ActivateThisSocket` and `UALL` confirmed application-side with zero wire output. The BULK upload is irreducibly stateful — not feasibly replicable from a stateless Node test. **Initial decision (#315):** pivot to Phase 3 via SDS optimization (Option 1). **Superseded same day** after Phase 3.1-3.3 data showed SDS at 2.91 KB/s ≈ 1.4x serial MIDI — not enough to justify the SCSI bridge complexity. **Current direction:** continue MESA II RE until we have a testable, data-backed hypothesis (next: SRAW decode, task #30). The MESA II reference in `mesa-ii-analysis/` is now an active working set, not just preserved documentation. |
| Phase 3: Bridge Implementation | **EMULATOR-FORWARD ACTIVE — major artifact landed 2026-04-22** | **Sole goal:** make MESA run in emulation, satisfy the SCSI contract it expects, capture the real fast sample-transfer path. **MEASURED 2026-04-22 (Path E.1, eight bounded harness iterations against `mesa-plug-harness`):** plug INIT entry drives cleanly through main dispatch + INIT magic check; `$1106E` patched to `$1160c` (SMSendData); CDB construction at file `0x163c-0x167e` empirically confirmed byte-for-byte against Codex's static decode. **Original ship-vs-no-ship question answered:** MESA emits `CDB[5]=0x00` for BULK/SDATA SysEx wrapper, `CDB[5]=0x80` for SRAW raw audio. Different transfer phases use different flag values. Prior hardware test rejected `0x80` because it was sent for ALL `0x0C` commands; MESA only sends `0x80` for SRAW. **OPEN:** identity of `JSR $1620.l` at file 0x169a (5 call sites, recurses in our harness; presumably resolves to actual SCSI Manager call in real Mac OS — handed to Codex's static decode). **Static-decode arc (Path A → A.18) preserved for reference;** the prior "ship current bridge" framing is retracted as an anti-goal per the [#315 joint charter](https://github.com/audiocontrol-org/audiocontrol/issues/315). **Active division of labor:** Claude owns emulator-forward execution; Codex owns static decode + contract identification. See [`project-state-2026-04-22-converged.md`](./project-state-2026-04-22-converged.md) for the static-decode reference; the "converged/ship" conclusion in that doc is retracted. |

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
