# mesa-ii-codex-parity

Parallel Codex-driven reverse engineering of Akai's MESA II sampler editor, designed to run alongside the existing Claude-driven effort and cross-check it explicitly.

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Baseline and Comparison Setup | Complete | Claude branch baseline captured; comparison artifacts created; first Codex target selected |
| Phase 2: Independent Codex Analysis | Complete | Static `CSCSIPlug::SendData` helper hunting, callback-path decoding, CODE 1 callback checks, and bounded MESA I lineage work have all reached a practical stopping point |
| Phase 3: Cross-Check and Reconciliation | In Progress | Earlier Claude disputes `#309`-`#314` are resolved; issue `#315` now carries the converged Outcome B read and the recommendation to stop treating state-precondition hunting as the critical path |
| Phase 4: Downstream Integration Guidance | In Progress | The current highest-value output is a clean stopping-point recommendation: ship the working bridge path, keep state-precondition as residual, and only reopen on new evidence |

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
| Mac OS 9 Disk Image Copy | [macintosh-hd-2026-04-16.img](./artifacts/macintosh-hd-2026-04-16.img) |
| Mac OS 7 Disk Image Copy | [macos-7-disk.hfv](./artifacts/macos-7-disk.hfv) |
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
  live Claude/Codex sync point because Claude has committed to Option 2
  (`mesa-plug-harness` end-to-end via terrain-as-necessary) and the remaining meaningful
  unknown is the runtime sender boundary, not another static helper inside the plug body

The main unresolved boundary then shifted into the main-app callback path and has now
largely converged too. Codex independently confirmed that:

- the `INIT` callback literal passed by both `LoadMESAPlugIn` and `LoadMESAEditor`
  resolves to `SendCommandToEditor` in `mesa-ii-app` `CODE 1`
- the direct callback body is an inline host/editor tag-dispatcher rather than a
  transport patcher
- its visible fan-out lands in editor/service handlers like cursor, menu, editor/window,
  and module-dispatch helpers
- the first shared helper reached from that callback also looks like typed module
  discovery/registry logic (`PLUG` / `AK11` compares), not transport setup

That means the direct patch hypothesis is now functionally closed on the current static
artifact set. The only remaining theoretical residual is a deeper downstream
`DispatchCommandFromModule` service/module chain, not any visible direct patch or
transport-shaping path in the callback body itself.

Recent Codex work also closes off a broad static false lead: the constructor-side
registry/tag/resource branch rooted at `0x287ee` now looks like resource/document
plumbing, not the missing live-sender install path. The recovered front-end table,
shared local ladder, low-address payload families, and later mixed tag-dispatch blocks
all align with file/resource handling (`AK11`, `DATA`, `EBFX`, `EBRV`, `SMDB`, `SS30`,
`PROG`, `AIFF`, `GDFS`, `SDIS`, `MAHF`) rather than transport verbs like `BULK`,
`SRAW`, or `UALL`.

## Recommended Split

Based on the current combined Claude and Codex evidence, the most effective assignment
is now closure-oriented rather than exploratory:

- Claude should own the final project-state writeup and product-facing closeout on
  issue `#315`.
- Codex should own parity review, calibration control, and doc hygiene so the final
  settled state does not drift back into stale “one more patcher” language.

Both efforts should avoid three traps:

- reopening broad static plug-body helper hunting in `CSCSIPlug::SendData`, which is
  already close to exhaustion
- mistaking the constructor/tag/resource branch for a transport-install path now that
  it looks like resource/document plumbing
- promoting residual state-precondition to an active blocker after the direct patch
  hypothesis has been functionally closed on the current artifact set

The recommended stopping point is now explicit:

- `MEASURED`: no visible direct patch path in the current static artifact set, service
  callback confirmed, and working bridge behavior for the known operations
- `RESIDUAL`: a deeper state/module-precondition may still exist through
  `DispatchCommandFromModule`, but it is no longer worth blocking on
- `REOPEN ONLY IF`: new binary/runtime evidence appears, a regression surfaces, or a
  missing operation shows the current bridge path is insufficient

## Artifact Reminder

Do not forget the installed Mac OS 9 disk image. It is now a live feature artifact for
the MESA system-extension / companion-binary hunt.

- Original local path:
  `/Users/orion/Downloads/Macintosh HD`
- Workspace copy:
  [artifacts/macintosh-hd-2026-04-16.img](./artifacts/macintosh-hd-2026-04-16.img)

If future work needs installed MESA files beyond `sampler-editor` and `scsi-plug`, this
disk image is the first place to check.

There is now also a second historical artifact for lineage comparison:

- Original local path:
  `/Users/orion/Downloads/macos-7-disk.hfv`
- Workspace copy:
  [artifacts/macos-7-disk.hfv](./artifacts/macos-7-disk.hfv)
- Extracted installed MESA I corpus:
  [artifacts/macos-7-installed](./artifacts/macos-7-installed)

Current extracted MESA I binaries:

- `mesa1-app`
- `mesa1-sampler-editor.modu`
- `mesa1-shared.shar`
- `mesa1-s3-hd-provider.modu`
- `mesa1-s2000.modu`
- `mesa1-s3000-fx.modu`
- `mesa1-file-manager.modu`

The latest Codex/Claude cross-check revises that boundary again. The broad exclusion
still holds for the narrow `+0xa20` direct-install hunt and for the ruled-out
constructor/tag/resource and far-out table branches. But it no longer applies wholesale
to the editor-side reply path. Claude's newer Path A/A.5 work, plus Codex spot-checks,
show that:

- `CMESAEditor` ctor has five direct absolute calls, not four
- several targets Codex had treated as data/string territory (`0x02797c`, `0x0287a8`)
  are real framework code under the corrected EDIT base
- a static vtable entry at `0x071a53` points to real code at `0x0598a5` immediately
  before the `CMESAEditor::DoMESACommand` symbol band

So the current best read is:

- the direct `+0xa20` install hunt is effectively exhausted
- the editor-side reply path is better modeled as compile-time vtable binding inside the
  recovered graph
- the remaining static frontier is the socket/vtable path and the plug-side slot family
  it reaches, not a missing runtime install moment

The plug-side half of that frontier is also sharper now. Codex has independently
confirmed Claude's Path A.6 claim that the callback at `scsi-plug` `$11fe` is read from
`plug_slot[+0]`, and that `CMESAPlugIn::ConnectToSocket` installs that field by copying
the incoming 46-byte `SocketInfo` verbatim. So the next concrete static question is:
what editor-side function address becomes `SocketInfo[+0]` in the `CONS` payload?

That is still a narrow static frontier, not a return to broad helper hunting. Codex
should use it for boundary-proof and contradiction-handling work in parallel with
Claude's runtime Option 2 path.
