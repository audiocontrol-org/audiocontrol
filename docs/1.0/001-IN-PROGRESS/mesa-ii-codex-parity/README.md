# mesa-ii-codex-parity

Parallel Codex-driven reverse engineering of Akai's MESA II sampler editor, designed to run alongside the existing Claude-driven effort and cross-check it explicitly.

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Baseline and Comparison Setup | Complete | Claude branch baseline captured; comparison artifacts created; first Codex target selected |
| Phase 2: Independent Codex Analysis | In Progress | Static analysis is now focused on emulator-relevant transport recovery: `SMSendData` CDB construction is confirmed and the raw executor below it is identified as `CSCSIUtils::SCSICommand` |
| Phase 3: Cross-Check and Reconciliation | In Progress | `#315` is the live Claude/Codex mailbox; `INIT`, `CONS`, `ASOK`, and `SEND` are now proven on the persistent object path, and the current shared blocker is the post-`SEND` BULK `IP_Data` contract |
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

- the corrected PLUG-relative load model and `A055 StripAddress` fix are now behind us
- the harness has proven the persistent-object lifecycle through:
  - `INIT`
  - `CONS`
  - `ASOK`
  - `SEND`
- `SEND`'s local `0xc950` gate is now explained by the per-socket selection-word family
  rooted at `0x0d72`, and the bounded harness seed for that word is backed by the real
  `ChooseSCSI` success tail
- the first post-`SEND` sub-dispatch is now real:
  `SocketInfo+8` is loaded as a sub-tag, and `SocketInfo+8 = 'BULK'` reaches the BULK
  sub-handler and emits the first post-`SEND` `$A089 SCSIDispatch`

That leaves one sharp open seam:

- the BULK sub-handler is now bounded enough that the next question is phase role, not
  chooser state
- the live record fields are:
  - `IP_Data+0` = byte count
  - `IP_Data+4` = payload pointer
  - `IP_Data+8` = sub-tag
  - `IP_Data+12` = target-selection key used earlier by `SEND`
- the current zero-CDB run is no longer best treated as proof that BULK itself must
  carry payload bytes, because the real editor upload caller appears to issue `BULK`
  with two zero longs before later `SRAW` payload phases
- the better current production model is:
  `BULK` opener/control phase, later `SRAW` payload phase(s), then `BOFF`

This is no longer a relocation or chooser-state project on the active path. It is now a
bounded emulator-contract problem around the post-`SEND` phase sequence:
what the `BULK` opener really has to establish, and how to reach the first later
payload-bearing `SRAW` emission on the corrected persistent-object path.

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
  corrected PLUG-relative load model; harness `A055 StripAddress` bug fixed; plug
  self-relocation now carries the real chained `ctor -> INIT -> CONS -> ASOK -> SEND`
  lifecycle without manual relocation; rebased `INIT` vtable `+0x0c` at `0x0856`
  installs the callback into `this+4`; outer rebased vtable `+0x10` now demonstrably
  defaults into embedded rebased `0x02fc`; and `CONS` is now proven end-to-end on the
  real persistent object:
  `this+0x38` increments to `1` and the 46-byte `SocketInfo` is copied into
  `this+0x3c`; `ASOK` is also proven on that same object:
  it matches `SocketInfo+0x26 == slot+0x26`, copies `SocketInfo+0x24 -> slot+0x24`,
  copies `SocketInfo+0x2a -> slot+0x2a`, and the earlier “no visible mutation” result
  was a zero-to-zero copy artifact
- `OPEN`:
  what first real `SEND` / transport blocker appears after the now-proven
  `INIT -> CONS -> ASOK` lifecycle on the persistent object; current strongest
  measured gate is the per-socket selection-word family rooted at `this+0x0d72`
- `NEXT`:
  drive `SEND` next on the same persistent object and stop at the first new blocker;
  strongest next bounded discriminator is to seed slot-0 `this+0x0d72` with a
  non-zero test word before `SEND` and see whether the local `0xc950` gate clears

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
no longer the live frontier. The active frontier is now later and more concrete:

- the direct app-side literal patch path remains negative
- the harness now reaches the real chained plug lifecycle under corrected PLUG-relative
  load semantics
- the `A055` fix removed a root-cause harness bug in that path
- `INIT` callback installation and `CONS` registration are now both proven on the real
  persistent object in emulation
- the remaining unknown is now the ordinary `ASOK` activation transition on that same
  object, and after that the first trustworthy `SEND` / transport blocker

That should be the starting point for the next session, not the older callback-install
or `CONS`-registration story.
