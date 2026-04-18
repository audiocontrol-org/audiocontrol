# mesa-ii-reverse-engineering

Reverse-engineer MESA II's sample data transfer protocol to fix S3000XL sample upload SLNGTH issue.

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Disassembly Infrastructure | Mostly Complete | m68k-elf-objdump + annotate_function.py pipeline (1241 funcs indexed). SendAudioBufferToSampler (443 instr) and BuildSampleHeaderFromMAH (224 instr) fully decoded with zero placeholders. Findings: 200-byte Akai header layout, BULK/SRAW/BOFF/UALL emission sequence, SLNGTH at bytes 26-29 in BYTES not words. |
| Phase 2: Protocol Validation | **Closed (decided #315)** | Dispatch chain fully decoded; both `ActivateThisSocket` and `UALL` confirmed application-side with zero wire output. The BULK upload is irreducibly stateful — not feasibly replicable from a stateless Node test. **Decision (issue #315):** pivot to Phase 3 via SDS optimization. Codex parity wave aligned: Option 1 endorsed, Option 2 (harness end-to-end) deferred as later research, Option 3 (opcode scan) rejected (firmware risk). The MESA II reference is preserved in `mesa-ii-analysis/` as documentation for any future Option 2 attempt. |
| Phase 3: Bridge Implementation | **Stop criterion triggered (#315 reassessment posted)** | Phase 3.1 baseline measured: **2.91 KB/s** steady-state on real hardware. Phase 3.2 (batch-size sweep, batch=20-200) and Phase 3.3 (pipeline-depth sweep, depth=1-8) BOTH negative — neither knob improves throughput. Per-packet math (27ms × 80 audio bytes = 2.96 KB/s) confirms the device IS the rate-limiter, not the bridge. The original 8 KB/s target was set without device-rate knowledge; the device's natural SDS ceiling appears to be ~3 KB/s. **Stop criterion (<4 KB/s plateau) triggered.** Eng team reassessment posted on #315; awaiting product call between: (B) revise target to 3 KB/s and ship honest SDS, (C) ASPACK 16-23 KB/s with broken SLNGTH (advanced/expert mode only), (D) re-evaluate Option 2 (harness end-to-end) given SDS cap. See `sds-baseline.md`, `sds-phase-3.2-batch-sweep.md`, `sds-phase-3.3-pipeline-sweep.md`. |

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
| Phase 2/3 Decision | [#315](https://github.com/audiocontrol-org/audiocontrol/issues/315) — Option 1 (SDS optimize) chosen |
| Codex Parity Wave (open, awaiting review) | [#309](https://github.com/audiocontrol-org/audiocontrol/issues/309), [#310](https://github.com/audiocontrol-org/audiocontrol/issues/310), [#311](https://github.com/audiocontrol-org/audiocontrol/issues/311), [#312](https://github.com/audiocontrol-org/audiocontrol/issues/312), [#313](https://github.com/audiocontrol-org/audiocontrol/issues/313), [#314](https://github.com/audiocontrol-org/audiocontrol/issues/314) |
