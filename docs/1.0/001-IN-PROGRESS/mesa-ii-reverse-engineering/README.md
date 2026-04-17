# mesa-ii-reverse-engineering

Reverse-engineer MESA II's sample data transfer protocol to fix S3000XL sample upload SLNGTH issue.

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Disassembly Infrastructure | Mostly Complete | m68k-elf-objdump + annotate_function.py pipeline (1241 funcs indexed). SendAudioBufferToSampler (443 instr) and BuildSampleHeaderFromMAH (224 instr) fully decoded with zero placeholders. Findings: 200-byte Akai header layout, BULK/SRAW/BOFF/UALL emission sequence, SLNGTH at bytes 26-29 in BYTES not words. |
| Phase 2: Protocol Validation | In Progress | Dispatch chain fully decoded: `AcceptSampleHeader` → `BuildCommand` (392-byte SysEx) → `CMESASocket::SendData` → CDB `0c 00 00 01 88 80`. SLNGTH encoding via `SwapLongWord` (not nibble-encode). Hardware test with SDS preamble + Akai SDATA: device replies but does NOT apply SDATA content (SLNGTH and name unchanged). **Codex parity review (#309-#313) revised the model:** `vtable[0x30]` is `CMESASocket::ActivateThisSocket(Uc)`, NOT a wire-protocol preamble — it's in-memory socket state setup. The "missing preamble" is application-side state, not a SysEx message. May mean the BULK upload is irreducibly stateful and not replicable from a stateless Node test. Strategic decision pending: continue decoding (task #21), expand harness to drive full SendAudioBufferToSampler end-to-end, or pivot to alternate fast-upload approach. SRAW (#15) and UALL (#16) still open. |
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
