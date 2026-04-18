# mesa-ii-reverse-engineering

Reverse-engineer MESA II's sample data transfer protocol to fix S3000XL sample upload SLNGTH issue.

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Disassembly Infrastructure | Mostly Complete | m68k-elf-objdump + annotate_function.py pipeline (1241 funcs indexed). SendAudioBufferToSampler (443 instr) and BuildSampleHeaderFromMAH (224 instr) fully decoded with zero placeholders. Findings: 200-byte Akai header layout, BULK/SRAW/BOFF/UALL emission sequence, SLNGTH at bytes 26-29 in BYTES not words. |
| Phase 2: Protocol Validation | Decision Point | Dispatch chain fully decoded; hardware test with SDS preamble + Akai SDATA gets device reply but does NOT apply content (SLNGTH/name unchanged). **Two Codex parity issues this session (#313, #314) confirmed both `ActivateThisSocket` (slot 0x30) AND `UALL` (slot 0x28 via this+4) are application-side, no wire output.** UALL string verified absent from scsi-plug binary (0 of 26 occurrences). The "MESA's BULK upload is irreducibly stateful" case is now strong. Strategic decision pending (task #23): (A) one more incremental decode of the command-bus handler, (B) expand harness to drive `SendAudioBufferToSampler` end-to-end (load sampler-editor binary alongside scsi-plug), or (C) pivot to alternate fast-upload approach. SRAW (#15) and UALL handler-side investigation (#16) deferred until strategic call. |
| Phase 3: Bridge Implementation | Not Started | Working upload with correct SLNGTH |

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
