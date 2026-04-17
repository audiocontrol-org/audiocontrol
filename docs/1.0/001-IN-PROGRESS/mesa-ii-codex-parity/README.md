# mesa-ii-codex-parity

Parallel Codex-driven reverse engineering of Akai's MESA II sampler editor, designed to run alongside the existing Claude-driven effort and cross-check it explicitly.

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Baseline and Comparison Setup | Complete | Claude branch baseline captured; comparison artifacts created; first Codex target selected |
| Phase 2: Independent Codex Analysis | In Progress | Object identity corrected; slot `0x38` matched to `SwapLongWord`; socket/transport lifecycle now traced through `OpenModule`, `ActivateModule`, `DeactivateModule`, and a runtime transport-toggle path |
| Phase 3: Cross-Check and Reconciliation | Not Started | Compare the two efforts and resolve or narrow disputes |
| Phase 4: Downstream Integration Guidance | Not Started | Summarize validated findings and next experiments |

## Links

| Item | Link |
|------|------|
| Branch | `feature/mesa-ii-codex-parity` |
| Worktree | `~/work/audiocontrol-work/audiocontrol-mesa-ii-codex-parity` |
| PRD | [prd.md](./prd.md) |
| Workplan | [workplan.md](./workplan.md) |
| Claude Branch Baseline | [claude-baseline.md](./claude-baseline.md) |
| Comparison Record | [comparison-record.md](./comparison-record.md) |
| Codex Findings Log | [codex-findings.md](./codex-findings.md) |
| Parent Issue | TBD |

## Overview

This feature creates a second, independent reverse-engineering track for Akai MESA II. The existing Claude-driven effort remains in place. The Codex-driven effort exists to reproduce, challenge, compare, and refine those findings rather than treating them as canonical by default.

The main output is not just new findings. The main output is a durable comparison record showing:

- what both efforts agree on
- what remains disputed
- what evidence supports each conclusion
- what next experiment should resolve the remaining uncertainty

## Current Baseline

The active Claude-side effort is not the older `main` branch snapshot under
`docs/1.0/001-IN-PROGRESS/akai-ux-improvement/mesa-ii-analysis/`. The current source
of truth for the parallel effort lives on branch `feature/mesa-ii-reverse-engineering`
in `docs/1.0/001-IN-PROGRESS/mesa-ii-reverse-engineering/`.

The most important Phase 1 finding is that the Claude-side work already corrected some
earlier MESA conclusions:

- the earlier "definitive" BULK trace came from a synthetic harness call path, not
  MESA's real caller path
- `BuildCommand` is now decoded as a 392-byte SysEx builder, not the earlier 406-byte
  format
- the remaining blocker is the content encoding of the 200-byte Akai header,
  especially the fields written through the `CAkaiSampler` /
  `CAkaiMIDIDispatcher` object path and the socket-level sequencing around BULK
- SRAW wire-byte claims and some earlier vtable semantics were explicitly downgraded
  from findings to unresolved inference

The first independent Codex target is therefore the same area the Claude branch now
identifies as its blocking unknown: the `CAkaiSampler` / `CAkaiMIDIDispatcher`
field-encoding path for header offsets 26-47, plus the `CMESASocket` pre/post calls
that bracket BULK transfer in `SendAudioBufferToSampler`.

## Current Session Close

Phase 2 advanced materially this session:

- `CMESASocket` slot `0x30` is now modeled as activation state rather than packet
  content, with `OpenModule` and `ActivateModule` calling it with `1` and
  `DeactivateModule` calling it with `0`
- `CSamplerModule+0xda0` is no longer just a read-side hint; a pre-`OpenModule`
  command path actively flips it, deactivates the socket, re-selects the other plug,
  and reactivates the socket
- `CSamplerModule+0xdaa` still looks like MIDI-plug availability state, with the only
  observed write in the checked-in artifact window occurring after successful `'MIDI'`
  `ConnectToPlug(...)`
- `CSamplerModule+0xb1` save/restore behavior is now confirmed across both
  `SendAudioBufferToSampler` and `SendAudioFileToSampler`

The main unresolved boundary is still initialization provenance for `CSamplerModule+0xb0`
and `+0xb1`. The current checked-in primary artifacts show repeated reads of those bytes
but no obvious plain stores, even after a whole-binary `objdump` pass. The next analysis
move is to widen or hand-decode earlier creation paths or less-obvious callees rather
than keep re-grepping the same upload-region slices.
