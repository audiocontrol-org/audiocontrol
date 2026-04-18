# mesa-ii-reverse-engineering

Reverse-engineer MESA II's sample data transfer protocol to fix S3000XL sample upload SLNGTH issue.

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Disassembly Infrastructure | Mostly Complete | m68k-elf-objdump + annotate_function.py pipeline (1241 funcs indexed). SendAudioBufferToSampler (443 instr) and BuildSampleHeaderFromMAH (224 instr) fully decoded with zero placeholders. Findings: 200-byte Akai header layout, BULK/SRAW/BOFF/UALL emission sequence, SLNGTH at bytes 26-29 in BYTES not words. |
| Phase 2: Protocol Validation | **Closed (decided #315)** | Dispatch chain fully decoded; both `ActivateThisSocket` and `UALL` confirmed application-side with zero wire output. The BULK upload is irreducibly stateful — not feasibly replicable from a stateless Node test. **Decision (issue #315):** pivot to Phase 3 via SDS optimization. Codex parity wave aligned: Option 1 endorsed, Option 2 (harness end-to-end) deferred as later research, Option 3 (opcode scan) rejected (firmware risk). The MESA II reference is preserved in `mesa-ii-analysis/` as documentation for any future Option 2 attempt. |
| Phase 3: Bridge Implementation | **Decision superseded — continue MESA II RE** | Option 1 (SDS optimize) is dead. Phase 3.1-3.3 data: SDS = 2.91 KB/s, device-limited; serial MIDI = ~2.1 KB/s. SCSI is only ~1.4x MIDI — not enough to justify the SCSI bridge infrastructure. **New direction (decision-record-2026-04-18.md):** SCSI bridge is only worthwhile at ~10x MIDI (20+ KB/s), which MESA II demonstrably achieves. We can't measure MESA directly (no vintage hardware), so we continue reverse-engineering its binaries until we have a testable, data-backed hypothesis. Next decode target: SRAW wire bytes (the only undecoded piece of MESA's upload chain). Guard rails: primary evidence only, no inferences from comments, no speculation about MESA's throughput. See `decision-record-2026-04-18.md` for full context and rationale. |

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
| Phase 2/3 Decision | [#315](https://github.com/audiocontrol-org/audiocontrol/issues/315) — Option 1 superseded; continue MESA II RE per [decision-record-2026-04-18.md](./decision-record-2026-04-18.md) |
| Codex Parity Wave (open, awaiting review) | [#309](https://github.com/audiocontrol-org/audiocontrol/issues/309), [#310](https://github.com/audiocontrol-org/audiocontrol/issues/310), [#311](https://github.com/audiocontrol-org/audiocontrol/issues/311), [#312](https://github.com/audiocontrol-org/audiocontrol/issues/312), [#313](https://github.com/audiocontrol-org/audiocontrol/issues/313), [#314](https://github.com/audiocontrol-org/audiocontrol/issues/314) |
