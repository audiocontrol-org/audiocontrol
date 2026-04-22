# mesa-ii-codex-parity

Parallel Codex-driven reverse engineering of Akai's MESA II sampler editor, designed to run alongside the existing Claude-driven effort and cross-check it explicitly.

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Baseline and Comparison Setup | Complete | Claude branch baseline captured; comparison artifacts created; first Codex target selected |
| Phase 2: Independent Codex Analysis | In Progress | Static analysis is now focused on emulator-relevant transport recovery: `SMSendData` CDB construction is confirmed and the raw executor below it is identified as `CSCSIUtils::SCSICommand` |
| Phase 3: Cross-Check and Reconciliation | In Progress | `#315` is the live Claude/Codex mailbox; the latest root-cause fix is the harness `StripAddress` bug, and the current shared blocker is the relocation overlap question on a clean rerun |
| Phase 4: Emulator Contract Guidance | In Progress | The current output is emulator-facing: identify the minimum Mac runtime and SCSI contract MESA still expects so Musashi can drive the real fast transfer path |

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
| Parent Issue | [#315](https://github.com/audiocontrol-org/audiocontrol/issues/315) |

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

## Current Frontier

The feature is still active. The fixed goal is:

- make MESA run in emulation
- satisfy the SCSI contract it expects
- capture the real fast sample-transfer path

Recent parity work changed the frontier materially again:

- `scsi-plug-rsrc.bin` is now confirmed to be a full resource fork whose executable code
  is the `PLUG` resource body starting at file `0x59e`
- the earlier low-address mystery was a base-address error: internal targets like
  `0x020e`, `0x157e`, and `0x0274` are ordinary PLUG-relative code bodies once rebased
  from the `PLUG` resource start
- under that corrected model, Claude’s harness now runs the real chained
  `ctor -> INIT -> CONS` lifecycle far enough to exercise the plug’s own
  packed-displacement self-relocation path instead of the older wrong-base artifacts
- the harness `A055 StripAddress` handler was then found to be the root-cause bug
  behind multiple earlier OOB / NULL-pointer cascades: it had been zeroing `D0`
  instead of returning the stripped address
- after fixing `A055`, the previously suspect relocation values now line up with the
  static model:
  - `A4 = 0x125b4` at the relocation caller
  - helper `0x0028` returns `0x1281f`
  - the relocation loop sees the sane table count `0x6e`
- the live blocker is therefore no longer “why is the relocation path garbage?” but
  whether the harness’s old manual relocation pass is now redundantly relocating the
  same targets the plug is correctly relocating for itself

That leaves one sharp open seam:

- can the plug’s own self-relocation carry the full path on a clean rerun with manual
  relocation disabled
- if not, what exact target class remains uncovered and truly requires harness-side help
- and, once relocation ownership is corrected, what the first genuinely new
  post-relocation blocker is on the real chained path

This is no longer a broad “find the patcher” or wrapper-only project. It is now a
bounded emulator-contract problem around PLUG-body load semantics, self-relocation
ownership, and the first real post-relocation runtime contract.

## Recommended Split

Based on the current combined Claude and Codex evidence, the effective split is now:

- Claude:
  rerun the real chained lifecycle from the top with manual relocation disabled, now
  that the `A055` bug is fixed and the plug’s own self-relocation path is producing sane
  values
- Codex:
  own bounded static recovery of the relocation/setup contract so the first failure on
  that clean rerun can be interpreted immediately, especially the relationship between
  the A4-rooted data block, the relocation-table pointer, and any truly uncovered target
  class if the plug does not relocate everything by itself

Both efforts should stay disciplined:

- do not drift back into “ship the current bridge” or bridge-acceptance framing
- do not reopen broad plug-body helper hunting unrelated to emulator progress
- do not treat historical MESA I comparison work as the primary frontier unless it
  directly helps the emulator contract

The active state is now:

- `MEASURED`:
  corrected PLUG-relative load model; real chained `ctor -> INIT -> CONS` path reached;
  harness `A055 StripAddress` bug fixed; plug self-relocation now sees sane A4/table
  values and runs production-shaped relocation logic
- `OPEN`:
  whether Musashi can now rely on the plug’s own self-relocation alone, what exact
  target class remains if it cannot, and what first post-relocation blocker appears on a
  clean rerun
- `NEXT`:
  rerun from the top with manual relocation disabled and stop at the first new blocker
  after the plug self-relocates its own body

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

The earlier `+0xa20` / callback-path work remains useful historical context, but it is
no longer the live frontier. The active frontier is now earlier and more structural:

- the direct app-side literal patch path remains negative
- the harness now reaches the real chained plug lifecycle under corrected PLUG-relative
  load semantics
- the `A055` fix removed a root-cause harness bug in that path
- the remaining unknown is now the clean ownership boundary between harness relocation
  and plug self-relocation, plus the first true post-relocation contract beyond that

That should be the starting point for the next session, not the older callback-install
or wrapper-only story.
