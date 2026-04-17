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

From the Claude branch README:

- Phase 1: Mostly Complete
- Phase 2: In Progress
- Phase 3: Not Started

The Claude branch describes its current blocker as the unresolved behavior of
`CMESASocket::vtable[0x38]`, which is believed to control the encoding of the
32-bit Akai header fields used during sample upload.

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
- `mesa-ii-analysis/cmesasocket-vtable38-decoded.md`
- `mesa-ii-analysis/sampler-editor-decoded.md`
- `mesa-ii-analysis/tooling-survey.md`

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
- The earlier 406-byte BULK interpretation is no longer treated as the final answer.
- Earlier conclusions around SRAW wire bytes were explicitly downgraded because the
  harness contained inference instead of captured output.

### Claims Explicitly Flagged By Claude As Unresolved

- Exact behavior of `CMESASocket::vtable[0x38]`
- Exact encoding of the 200-byte header fields at offsets 26-47
- Real SRAW on-wire bytes
- UALL handler path
- Why the corrected 392-byte BULK test still produces no device response

## Important Corrections Already Made On The Claude Branch

The Codex effort should not inherit superseded Claude-side conclusions as if they are
still current.

- The harness "definitive BULK trace" was later identified as a synthetic caller path,
  not MESA's real call sequence.
- `BuildCommand` changed the expected wire format from 406 bytes to 392 bytes.
- A prior claim that vtable[0x38] meant "nibble-encode-in-place" was partly refuted:
  that decode was wrong for `CAkaiSampler`; the remaining socket-side claim is still
  unresolved.
- SRAW "would need ASPACK wrap" was called out by Claude's own notes as inference, not
  evidence.

## Baseline Risk Assessment

- The Claude branch is active and self-correcting; older notes and older docs should not
  be treated as equivalent to the latest state.
- The branch contains both evidence-backed conclusions and explicitly retracted claims.
- Any parity effort that ignores `DEVELOPMENT-NOTES.md` will likely compare against stale
  or already-corrected conclusions.

## Selected First Codex Target

Codex will start with the same surface the Claude branch now identifies as its blocker:

- `CMESASocket::vtable[0x38]`
- the exact transformation of the Akai header fields at offsets 26, 30, 34, 38, and 44
- whether that transformation supports or contradicts the Claude branch's current theory
