# Comparison Record

## Purpose

Track where Codex and Claude agree, disagree, or still lack enough evidence to compare
cleanly.

## Categories

- `Matched`: Codex independently reproduced the Claude-side conclusion from primary
  artifacts.
- `Disputed`: Codex found contradictory evidence or a different interpretation.
- `Unresolved`: neither side has enough evidence for a stable conclusion.
- `Deferred`: important, but not on the current critical path.

## Current Entries

### Matched

- Slot `0x38` in the `CAkaiMIDIDispatcher` vtable maps to `SwapLongWord`
  Claude baseline:
  later Claude-side analysis argued that the repeated field transform resolves to
  `SwapLongWord`.
  Codex finding:
  raw bytes in `sampler-editor-rsrc.bin` confirm the vtable entry sequence at
  file offset `0x06f74b`, including slot `0x38 = 0x00045f2a`, and the bytes at file
  offset `0x06de81` match the documented `SwapLongWord` implementation.

### Disputed

- `CMESASocket::vtable[0x38]` label
  Claude baseline:
  the current Claude branch still describes the blocking target as
  `CMESASocket::vtable[0x38]`.
  Codex finding:
  the checked-in primary disassembly artifacts show the repeated slot-`0x38` dispatch
  loading an object whose vtable pointer lives at `+2`, which matches the
  `CAkaiSampler`/`CAkaiMIDIDispatcher` convention shown elsewhere. Raw constructor bytes
  for `CAkaiSampler` also show the vtable stored at `+2`, while the `CMESASocket`
  constructor stores its vtable at `+0`.

### Unresolved

- 200-byte Akai header field encoding at offsets 26-47
  Claude baseline:
  corrected wire framing still fails on hardware, implying the content bytes remain
  wrong or incomplete.
- Exact slot-`0x38` target mapping
  Claude baseline:
  later analysis argues for `SwapLongWord`.
  Codex finding:
  raw binary bytes now support that mapping, but the class identity of the caller-side
  object in the `BuildSampleHeaderFromMAH` path is still being narrowed.
- SRAW on-wire bytes
  Claude baseline:
  prior harness text admitted inference instead of captured bytes.
- UALL handler path
  Claude baseline:
  not in `SendData` TagDispatch; expected through a different vtable entry.

### Deferred

- Full download-path parity (`GetSampleData` / `ExportSampleData`)
- Throughput comparison against the bridge implementation

## Comparison Rules

- Codex should compare against the latest Claude branch docs plus its `DEVELOPMENT-NOTES.md`,
  not only the older docs merged into other branches.
- A claim does not become `Matched` until Codex reproduces it from primary artifacts.
- If Claude already retracted or downgraded a claim, Codex should compare against the
  corrected version, not the superseded one.
