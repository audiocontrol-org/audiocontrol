# Claude Branch Baseline

## Scope

This document captures the current state of the parallel Claude-driven MESA II effort as
it exists on branch `feature/mesa-ii-reverse-engineering`. It is a baseline for Codex
comparison work, not an endorsement of every Claude-side conclusion.

## Source Branch And Paths

- Branch: `feature/mesa-ii-reverse-engineering`
- Worktree: `~/work/audiocontrol-work/audiocontrol-mesa-ii-reverse-engineering`
- Feature README:
  `docs/1.0/001-IN-PROGRESS/mesa-ii-reverse-engineering/README.md`
- Feature workplan:
  `docs/1.0/001-IN-PROGRESS/mesa-ii-reverse-engineering/workplan.md`
- Feature analysis dir:
  `docs/1.0/001-IN-PROGRESS/mesa-ii-reverse-engineering/mesa-ii-analysis/`
- Feature session history:
  `DEVELOPMENT-NOTES.md`
- Hardware and protocol log:
  `SCSI-NOTES.md`

## Current Claude-Side Phase State

From the Claude branch README, workplan, and current branch head `2576636f`:

- Phase 1: Mostly Complete
- Phase 2: Closed (decision redirected through `#315`)
- Phase 3: Active as **Option 2 committed**

The Claude branch no longer treats the main question as a choice between several equal
strategy options. Its current active state is:

- `CMESASocket::vtable[0x30]` is treated as `ActivateThisSocket(Uc)`
- `ActivateThisSocket(Uc)` is treated as pure in-memory socket state setup with no wire
  output
- the static decode of the SCSI Plug is treated as exhausted at runtime boundaries
- `decision-record-2026-04-19.md` commits the branch to Option 2:
  extend `mesa-plug-harness` to run `sampler-editor-rsrc.bin` via a terrain-as-necessary
  approach
- Claude's workplan now explicitly uses Codex's priority test ordering (P1→P4) and
  carries Path A / task `#31` as step 0 before deeper harness bootstrap
- Claude's latest reply comment on issue `#315` makes that sequencing explicit:
  Path A is a prequel to Option 2, not a competing branch of work, and the asymmetric
  split stays active while the branches remain parallel

## Artifact Inventory

### Feature Docs

- `README.md`
- `workplan.md`
- `implementation-summary.md`

### Analysis Notes

- `mesa-ii-analysis/README.md`
- `mesa-ii-analysis/plug-bulk-trace.md`
- `mesa-ii-analysis/sysex-builder-decoded.md`
- `mesa-ii-analysis/send-sample-header-decoded.md`
- `mesa-ii-analysis/build-sample-header-decoded.md`
- `mesa-ii-analysis/cakaidispatcher-slot38-swaplongword.md`
- `mesa-ii-analysis/sampler-editor-decoded.md`
- `mesa-ii-analysis/tooling-survey.md`
- `mesa-ii-analysis/disassembly-full/CMESASocket-vtable30-ActivateThisSocket.annotated.txt`

### Analysis Tooling

- `mesa-ii-analysis/annotate_function.py`
- `mesa-ii-analysis/disassemble.py`
- `mesa-ii-analysis/find_function_end.py`
- `mesa-ii-analysis/decode_bsfmah.py`

## Current Claude-Side Claims To Compare

These are the main live claims worth auditing, taken from the Claude branch README,
workplan, analysis notes, and development notes.

### Claims With Strongest Current Support

- `SendAudioBufferToSampler` has been statically decoded deeply enough to establish a
  multi-step upload path rather than a single opaque send.
- `CAkaiSampler::vtable[0x14]` resolves to `CAkaiMIDIDispatcher::BuildCommand`.
- `BuildCommand` constructs a 392-byte SysEx message for SDATA:
  5-byte Akai prefix, 2-byte sample number, 384 nibble bytes from 192 source bytes,
  then `0xF7`.
- `CMESASocket::vtable[0x30]` resolves to `ActivateThisSocket(Uc)`.
- The earlier 406-byte BULK interpretation is no longer treated as the final answer.
- Earlier conclusions around SRAW wire bytes were explicitly downgraded because the
  harness contained inference instead of captured output.

### Claims Explicitly Flagged By Claude As Unresolved

- Exact encoding of the 200-byte header fields at offsets 26-47
- Real SRAW on-wire bytes
- UALL handler path
- Whether the full BULK upload path is reproducible from a stateless Node test at all
- Exact runtime install/redirection path for the live sender
- Whether the install edge stays inside the binaries we have or leaves them
- What the harness will observe at the P1/P2 boundaries once Option 2 bootstrap begins

### New Claude-Side Direction Pending Continued Parity Tracking

- Option 2 is now committed, not merely proposed.
  Source:
  Claude branch `README.md`, `workplan.md`, and
  `decision-record-2026-04-19.md`, plus the latest `#315` reply comment.
  Current Codex status:
  aligned at the strategy level. Codex has updated its own docs to treat Claude as
  owning runtime/hardware validation while Codex keeps only narrow static
  owner-boundary proof.

## Important Corrections Already Made On The Claude Branch

The Codex effort should not inherit superseded Claude-side conclusions as if they are
still current.

- The harness "definitive BULK trace" was later identified as a synthetic caller path,
  not MESA's real call sequence.
- `BuildCommand` changed the expected wire format from 406 bytes to 392 bytes.
- A prior claim that vtable[0x38] meant "nibble-encode-in-place" was partly refuted:
  that decode was wrong for `CAkaiSampler`; the remaining socket-side claim is still
  unresolved.
- A prior claim that slot `0x30` directly sent the SDS header was replaced with
  `ActivateThisSocket(Uc)` and then strengthened again into the newer task-21 claim
  that this path is pure in-memory state rather than a transport emission.
- SRAW "would need ASPACK wrap" was called out by Claude's own notes as inference, not
  evidence.

## Baseline Risk Assessment

- The Claude branch is active and self-correcting; older notes and older docs should not
  be treated as equivalent to the latest state.
- The branch contains both evidence-backed conclusions and explicitly retracted claims.
- The branch has moved beyond the earlier task-21-only framing. The important baseline
  for parity is now the Option 2 commitment plus the explicit runtime/static work split,
  not just the older `ActivateThisSocket` interpretation.
- Any parity effort that ignores `DEVELOPMENT-NOTES.md` will likely compare against stale
  or already-corrected conclusions.

## Selected First Codex Target

Codex started with the old slot-`0x38` blocker because that was the then-current Claude
state. After re-sync, the highest-value Claude-side delta is no longer another static
claim inside the plug body. It is the branch-level strategic shift:

- Claude has committed to Option 2 harness work
- Claude has adopted the runtime/hardware versus static-boundary split
- Codex should now compare against Claude's runtime findings and bootstrap evidence,
  not against an older assumption that Claude is still deciding whether to go dynamic
