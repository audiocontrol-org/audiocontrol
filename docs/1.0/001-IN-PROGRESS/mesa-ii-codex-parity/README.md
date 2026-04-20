# mesa-ii-codex-parity

Parallel Codex-driven reverse engineering of Akai's MESA II sampler editor, designed to run alongside the existing Claude-driven effort and cross-check it explicitly.

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Baseline and Comparison Setup | Complete | Claude branch baseline captured; comparison artifacts created; first Codex target selected |
| Phase 2: Independent Codex Analysis | In Progress | Task-21 activation-state model is effectively matched; static `CSCSIPlug::SendData` helper hunting is now effectively exhausted down to `0x106e` |
| Phase 3: Cross-Check and Reconciliation | In Progress | Earlier Claude disputes `#309`-`#314` are resolved; active sync now runs through issue `#315` as Claude re-evaluates the runtime sender boundary |
| Phase 4: Downstream Integration Guidance | In Progress | Runtime-boundary guidance is now the highest-value downstream output from the parity branch |

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

After re-syncing with the live Claude branch, the main Claude-side shift is no longer
about slot `0x38` or `UALL` wording. The active Claude effort has now elevated the live
SRAW sender boundary and the product/deployment decision tracked in issue `#315`. Codex
has already matched the task-21 activation-state conclusion closely enough that the
remaining meaningful parity gap is now runtime-facing, not socket-vtable naming.

The first independent Codex target started at the same place the Claude branch had
flagged as its blocking unknown: the `CAkaiSampler` / `CAkaiMIDIDispatcher`
field-encoding path for header offsets 26-47, plus the `CMESASocket` pre/post calls
that bracket BULK transfer in `SendAudioBufferToSampler`. The current frontier has since
moved outward: the remaining unresolved mechanism is the runtime boundary around the live
SRAW sender rather than one more static helper inside `SendData`.

## Current Session Close

Recent parity work materially changed the boundary of useful Codex analysis:

- Codex now effectively matches Claude's task-21 conclusion at the behavioral level:
  `ActivateThisSocket(Uc)` is modeled as application-side activation state rather than a
  missing wire preamble
- earlier parity-cleanup issues `#309` through `#314` are all resolved and closed
- the static `CSCSIPlug::SendData` surface has been reduced to a near-exhaustive state:
  low-address targets such as `0x0148`, `0x0274`, and `0x02fc` now look nonlocal or
  low-memory/system-adjacent; `0x0ca2`, `0x0d54`, `0x1162`, `0x1620`, `0x187e`, and
  `0x1b56` all collapsed into internal entries or shared epilogues inside already
  recovered bodies
- the checked-in bytes at `0x106e` are stronger evidence for runtime installation than
  before: if executed as-is, they would skip arm-local cleanup that every `jsr 0x106e`
  caller expects before the shared `0x1160` tail path
- issue [#315](https://github.com/audiocontrol-org/audiocontrol/issues/315) is now the
  live Claude/Codex sync point because the remaining meaningful unknown is the runtime
  sender boundary, not another static helper inside the plug body

The main unresolved boundary has shifted again. The important next question is no longer
whether `UALL` is plug-side or whether one more local `SendData` helper remains to be
found. It is how the live sender is installed, intercepted, or otherwise redirected at
runtime, and how Claude's harness/runtime evidence on issue `#315` should reshape the
next Codex parity target.

## Recommended Split

Based on the current combined Claude and Codex evidence, the most effective parallel
assignment is now asymmetric:

- Claude should own runtime and hardware validation:
  initialization-time behavior, live sender installation or redirection, and the
  product-facing question of whether any recovered path can plausibly reach
  MESA-class throughput.
- Codex should own narrow static boundary proof:
  keep pressing only on whether the `+0xa20` command-proc install path stays inside
  `sampler-editor-rsrc.bin` or leaves the recovered resource-level graph.

Both efforts should avoid reopening broad static plug-body analysis unless new evidence
reopens it. The current branch evidence already pushes `CSCSIPlug::SendData` close to
exhaustion, while the remaining unknown now sits at the seam between static owner
analysis and runtime behavior.
