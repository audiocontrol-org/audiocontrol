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

- The old direct-`SendData('BULK')` harness path is not equivalent to the real
  `SendAudioBufferToSampler` call sequence
  Claude baseline:
  later Claude-side notes already backed away from treating the synthetic BULK harness
  as definitive and started suspecting missing setup around the transfer path.
  Codex finding:
  the checked-in disassembly now makes that limitation concrete. `SendAudioBufferToSampler`
  performs repeated socket-level calls on `CSamplerModule+0x74`: SDS-opcode `0x01`
  dispatches through socket slot `0x30` before BULK open and again after the later
  `UALL` phase, while `BULK`, `SRAW`, and `BOFF` travel separately through socket
  slot `0x14`.
  A harness that calls `CSCSIPlug::SendData` directly with only a `BULK` struct omits
  those surrounding socket transitions.

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

- Stale 406-byte / nibble-encoded-header docs remain checked in
  Claude baseline:
  some checked-in files still present the earlier 406-byte and nibble-encode model as
  if it were current.
  Codex finding:
  later Claude-side artifacts and raw-binary-backed Codex review support the 392-byte
  framing plus `SwapLongWord`, so the branch currently contains contradictory analysis
  documents. Filed as issue `#311`.

- `CMESASocket` slot `0x30` meaning
  Claude baseline:
  `sampler-editor-decoded.md` still describes slot `0x30` as the SDS-header send path
  in SCSI mode.
  Codex finding:
  the same branch already contains a checked-in annotated artifact naming slot `0x30`
  as `ActivateThisSocket__11CMESASocketFUc`, and the actual call pattern in
  `SendAudioBufferToSampler` matches a one-byte socket-state method with save/restore
  semantics better than a direct send primitive. The decoded body also writes the byte
  argument into `CMESASocket+0x3c` and dispatches through a per-plug callback table,
  which is further evidence for state activation rather than immediate transport send.
  Raw disassembly of `OpenModule` and `ActivateModule` also shows separate
  `ActivateThisSocket(1)` calls outside sample upload. Filed as issue `#313`.

- Direct BULK harness scope
  Claude baseline:
  the branch now correctly retracts the old equivalence claim, but the exact missing
  lifecycle remains a live technical question.
  Codex finding:
  `OpenModule` provides a clearer missing-lifecycle model: it appears to call
  `ConnectToPlug` twice (`'MIDI'` and `'SCSI'`), then `SelectPlug`, then
  `ActivateThisSocket(1)` before later sampler operations. This makes the direct harness
  gap larger and more structural than "missing a preamble packet."

- Slot `0x30` argument semantics
  Claude baseline:
  the branch now identifies slot `0x30` as `ActivateThisSocket(Uc)`, but the byte
  argument meaning is still not modeled concretely.
  Codex finding:
  `ActivateModule` and `OpenModule` call slot `0x30` with `1`, while `DeactivateModule`
  calls it with `0`. That pushes the argument away from any packet/opcode reading and
  toward plain activation-state semantics.

- `OpenModule` nearby module-state bytes
  Claude baseline:
  active docs do not yet model the module-side fields adjacent to the stored plug IDs.
  Codex finding:
  `OpenModule` writes `this+0xdaa = 1` only on successful `'MIDI'` `ConnectToPlug(...)`
  return, then uses `this+0xda0` to choose between the plug IDs stored at `this+0xd98`
  and `this+0xd9c`. That suggests separate fields for connection availability and active
  transport selection.

- `CSamplerModule+0xda0` meaning
  Claude baseline:
  active docs do not yet assign a concrete meaning to the byte used for plug choice.
  Codex finding:
  nonzero `this+0xda0` selects the `'MIDI'` plug in `OpenModule`, and the same nonzero
  path triggers `SCSIOnlyWarning`. The cleanest current read is "MIDI-selected / not
  SCSI" transport mode.

- `CSamplerModule+0xb1` scope
  Claude baseline:
  active docs discuss the save/restore byte in `SendAudioBufferToSampler` only.
  Codex finding:
  `SendAudioFileToSampler` also saves `this+0xb1`, conditionally forces
  `ActivateThisSocket(1)`, and restores the saved byte through slot `0x30` afterward.
  That makes `+0xb1` a cross-upload cached activation-state field, not a one-off local
  quirk.

### Unresolved

- 200-byte Akai header field encoding at offsets 26-47
  Claude baseline:
  corrected wire framing still fails on hardware, implying the content bytes remain
  wrong or incomplete.
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
