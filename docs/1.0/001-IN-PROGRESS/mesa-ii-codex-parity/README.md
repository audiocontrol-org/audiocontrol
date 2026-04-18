# mesa-ii-codex-parity

Parallel Codex-driven reverse engineering of Akai's MESA II sampler editor, designed to run alongside the existing Claude-driven effort and cross-check it explicitly.

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Baseline and Comparison Setup | Complete | Claude branch baseline captured; comparison artifacts created; first Codex target selected |
| Phase 2: Independent Codex Analysis | In Progress | Task-21 activation-state model is effectively matched; `UALL` is now split into sampler-side pre-loop calls vs a later shared command-bus dispatch |
| Phase 3: Cross-Check and Reconciliation | In Progress | Earlier Claude disputes were resolved; new issue `#314` tracks the remaining stale `UALL` call-family conflation |
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

After re-syncing with the live Claude branch on April 17, 2026, the newest Claude-side
delta is no longer about slot `0x38`. The current branch head (`1a196d2e`) now claims
that `ActivateThisSocket(Uc)` is pure in-memory socket state setup that emits no wire
bytes. Codex has not reproduced that stronger task-21 claim yet, so it is now tracked
as a live Claude-side conclusion pending parity verification.

The first independent Codex target is therefore the same area the Claude branch now
identifies as its blocking unknown: the `CAkaiSampler` / `CAkaiMIDIDispatcher`
field-encoding path for header offsets 26-47, plus the `CMESASocket` pre/post calls
that bracket BULK transfer in `SendAudioBufferToSampler`.

## Current Session Close

Phase 2 advanced materially this session:

- Codex now effectively matches Claude's task-21 conclusion at the behavioral level:
  `ActivateThisSocket(Uc)` is modeled as application-side activation state rather than a
  missing wire preamble
- the remaining `UALL` problem is sharper too:
  `SendAudioBufferToSampler` contains two distinct non-socket call families that some
  Claude-side docs had been conflating
- the early pre-loop calls at `0x030773/0x030793/0x0307f7/0x030841/0x030891` go through
  the `CAkaiSampler` object at `CSamplerModule+0xda4` via the `object+2 -> vtable` path
- the later post-loop `UALL` call at `0x030c93` instead goes through a shared secondary
  command-routing table installed at object offset `+4`
- that secondary `+4` command table is now independently shown in both
  `CSamplerModule` and `CFXFilerView`: each constructor installs an A4-relative primary
  vtable at offset `0` and a separate A4-relative command table at offset `4`, and each
  class's `SendCommandToSampler` path dispatches through slot `0x28` of that secondary
  table
- issue [#314](https://github.com/audiocontrol-org/audiocontrol/issues/314) now tracks
  the remaining stale Claude-side `UALL` wording, including the incorrect equation of
  post-loop `UALL` with `CAkaiSampler::vtable[0x015c]`

The main unresolved boundary has shifted again. The important next question is no longer
whether `UALL` is plug-side. It is which shared command processor sits behind the
secondary `+4` table, and how that shared command-bus path relates to the earlier
sampler-side `+0xda4` calls in the same upload routine.
