# mesa-ii-codex-parity

Parallel Codex-driven reverse engineering of Akai's MESA II sampler editor, designed to run alongside the existing Claude-driven effort and cross-check it explicitly.

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Baseline and Comparison Setup | Complete | Claude branch baseline captured; comparison artifacts created; first Codex target selected |
| Phase 2: Independent Codex Analysis | In Progress | Static analysis is now focused on emulator-relevant transport recovery: `SMSendData` CDB construction is confirmed and the raw executor below it is identified as `CSCSIUtils::SCSICommand` |
| Phase 3: Cross-Check and Reconciliation | In Progress | `#315` is the live Claude/Codex mailbox; Claude’s harness now empirically confirms BULK `CDB[5]=0x00` and SRAW `CDB[5]=0x80`, and the shared open seam is the wrapper chain around `0x1620` |
| Phase 4: Emulator Contract Guidance | In Progress | The current output is emulator-facing: identify what host/service/SCSI contract MESA still expects so Musashi can drive the real fast transfer path |

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

Recent parity work changed the frontier materially:

- Claude’s Musashi harness now empirically reaches the local `SMSendData` CDB builder
  under the `$1106E -> $1160c` path
- BULK is now measured end-to-end through the local builder as:
  `CDB[0]=0x0C`, three length bytes from the payload length, `CDB[5]=0x00`
- SRAW is now also measured through the same builder:
  `CDB[5]=0x80` when the byte-flag argument is nonzero
- the app-side literal patch hunt is exhausted across all visible `mesa-ii-app` CODE
  resources: there are no simple literal references to `0x106e`, `0x1070`, or `0x160c`
- the first concrete raw executor below `SMSendData` is now identified as
  `SCSICommand__10CSCSIUtilsFsP3CdbPUcUlls`, which packages the CDB into a PB-like
  structure and calls `_SCSIDispatch`

That leaves one sharp open seam:

- what `0x1620` actually is
- what `0x1187e` actually is beyond the currently bypassed log/error-helper role
- and how the wrapper chain between the local `SMSendData` CDB builder and
  `CSCSIUtils::SCSICommand` is meant to execute in real Mac OS rather than recurse in
  the harness

This is no longer a broad “find the patcher” project. It is a bounded emulator-contract
problem around the handoff from `SMSendData` into the raw SCSI utility layer.

## Recommended Split

Based on the current combined Claude and Codex evidence, the effective split is now:

- Claude:
  keep driving the `mesa-plug-harness` forward until the wrapper chain below
  `SMSendData` reaches the real raw executor cleanly
- Codex:
  own bounded static recovery of the remaining wrapper/helper identities, especially
  the semantics of `0x1620`, `0x1187e`, `0x187e`, and the handoff into
  `CSCSIUtils::SCSICommand`

Both efforts should stay disciplined:

- do not drift back into “ship the current bridge” or bridge-acceptance framing
- do not reopen broad plug-body helper hunting unrelated to emulator progress
- do not treat historical MESA I comparison work as the primary frontier unless it
  directly helps the emulator contract

The active state is now:

- `MEASURED`:
  app-side literal patch search exhausted; `SMSendData` local CDB builder reached in
  harness; BULK `CDB[5]=0x00`; SRAW `CDB[5]=0x80`; raw executor identified as
  `CSCSIUtils::SCSICommand`
- `OPEN`:
  the identity and calling semantics of `0x1620` and `0x1187e`, and the exact wrapper
  chain from `SMSendData` into the raw executor
- `NEXT`:
  recover enough of that wrapper chain for Musashi to continue past the current
  recursion/error-helper loop

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
no longer the live frontier. The active frontier is now lower in the plug transport
chain:

- the direct app-side literal patch path remains negative
- the harness reaches the local CDB builder under `$1106E`
- the remaining unknown is the wrapper-family handoff below that builder, especially
  the role of `0x1620`

That should be the starting point for the next session, not the older callback-install
story.
