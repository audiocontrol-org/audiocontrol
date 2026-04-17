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

From the Claude branch README and current branch head `1a196d2e`
(`docs: ActivateThisSocket decoded — pure in-memory state, no wire bytes (task #21)`):

- Phase 1: Mostly Complete
- Phase 2: In Progress
- Phase 3: Not Started

The Claude branch no longer describes its current blocker as
`CMESASocket::vtable[0x38]`. Its current Phase 2 blocker is now the larger task-21
question created by the latest `ActivateThisSocket` work:

- `CMESASocket::vtable[0x30]` is treated as `ActivateThisSocket(Uc)`
- `ActivateThisSocket(Uc)` is now claimed to be pure in-memory socket state setup that
  emits no wire bytes
- the branch now questions whether the BULK upload path is reproducible from a
  stateless Node test at all
- the next decision is framed as: continue decoding, drive the harness end-to-end, or
  pivot to another fast-upload approach

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
- Which strategic path should replace or extend the current test approach if it is not

### New Claude-Side Claim Pending Codex Reproduction

- `ActivateThisSocket(Uc)` emits no wire bytes and is purely in-memory socket state
  setup.
  Source:
  Claude branch commit `1a196d2e`, current README/workplan, and the 2026-04-17
  `DEVELOPMENT-NOTES.md` entry.
  Current Codex status:
  not yet independently reproduced from primary artifacts. This should be treated as a
  live Claude-side claim pending parity verification, not as a matched finding.

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
- The latest Claude-side task-21 conclusion is newer than the current Codex parity
  baseline and needs explicit reproduction or dispute.
- Any parity effort that ignores `DEVELOPMENT-NOTES.md` will likely compare against stale
  or already-corrected conclusions.

## Selected First Codex Target

Codex started with the old slot-`0x38` blocker because that was the then-current Claude
state. After re-sync, the highest-value Claude-side delta to compare next is:

- the new task-21 claim that `ActivateThisSocket(Uc)` emits no wire bytes
- whether that claim is reproducible from primary artifacts
- whether it materially changes the viability of the stateless Node BULK test approach
