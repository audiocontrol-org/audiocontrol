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

- Provenance limits for `+0xda0` / `+0xdaa`
  Claude baseline:
  active docs do not yet separate downstream use from upstream initialization.
  Codex finding:
  the wider pre-`OpenModule` slice adds one important correction: `+0xda0` is written in
  a transport-toggle routine around `0x029105`, where the code flips the selector,
  deactivates slot `0x30` with `0`, re-selects the other plug, and reactivates with `1`.
  That toggle path now also has stronger ownership context: it sits inside a larger
  command-dispatch routine whose neighboring handlers derive the current transport label
  (`'MIDI'` vs `'SCSI'`) and related status values from the same `+0xda0` byte.
  `+0xdaa` is still only observed being written in `OpenModule` in the checked-in slice,
  and the helper at `0x031ce6` is just a message/progress wrapper. The artifact set now
  supports runtime transport-switch modeling, but still does not reveal the default
  initialization site for `+0xda0` or `+0xb1`.

- Provenance limits for `+0xb0` / `+0xb1`
  Claude baseline:
  active docs discuss their use in upload code, but not the scope of evidence around
  initialization.
  Codex finding:
  across the aligned constructor-to-`OpenModule` and post-`OpenModule` slices, only reads
  of `+0xb0`/`+0xb1` are visible. A whole-binary `objdump` pass still did not expose
  obvious plain stores to those fields, so the current artifact gap is real rather than
  just a narrow-slice oversight.
  The nearby `InitModule` / `this+0xa20` callback path does not close that gap: it now
  looks like a lazy command-helper cache rooted at `+0xce24`, not a state-byte
  initialization path.
  The nearby `SPRF` path also looks unrelated: `ReadPrefsFile` writes `+0xb7c` and
  copies `+0xb32` into `+0xb7e`, which points to a preferences/settings block rather
  than the missing transport-state bytes.
  The sibling collaborator field `+0xda4` shows the same boundary pattern: in the
  current artifact set it is repeatedly read, null-checked, and dispatched through, but
  still has no observed local write site inside the traced `CSamplerModule` windows.

- Constructor-era ownership boundary for `+0xda4`
  Claude baseline:
  `send-sample-header-decoded.md` already attributes `CSamplerModule+0xda4` to a
  `CAkaiSampler*` installed during constructor-time setup, but the exact write site is
  not spelled out from raw code bytes.
  Codex finding:
  independent bounded disassembly sharpens that boundary. File `0x028597` is a direct
  `CAkaiSampler::SetSocket`-shaped setter that writes a `CMESASocket*` to offset `+0xa2`,
  matching the later `AcceptSampleHeader` call chain. The following constructor-era
  routine at `0x0285d3` installs several subobject tables and then delegates deeper
  ownership setup to helper `0x317dc(this)`. So while Codex still does not have a
  direct `+0xda4` store from primary bytes, the missing installation path is now
  narrowed from "somewhere outside the traced module windows" to a specific
  constructor-helper handoff.

### Unresolved

- 200-byte Akai header field encoding at offsets 26-47
  Claude baseline:
  corrected wire framing still fails on hardware, implying the content bytes remain
  wrong or incomplete.
- `ActivateThisSocket(Uc)` wire behavior
  Claude baseline:
  current Claude branch now claims the function is pure in-memory state and emits no
  wire bytes.
  Codex status:
  partially reproduced. Codex now independently supports the plug-side half of the
  claim: `CMESAPlugIn::ActivateSocket` at `0x0a5e` contains only slot lookup plus local
  state writes and does not itself show wire-I/O call sites. The remaining unresolved
  piece is the final dispatch hop from `CMESASocket::ActivateThisSocket` through the
  installed callback slot into `CMESAPlugIn::DoMESACommand` and then specifically into
  `ActivateSocket`; that chain is still supported but not yet fully re-decoded from
  primary bytes end-to-end. New Codex narrowing: inside `CMESAPlugIn::DoMESACommand`,
  only two branch arms use the `SocketInfo`-style `(this, MESACommand+6)` calling
  convention, and those call vtable offsets `+0x30` and `+0x34`. So the remaining
  ambiguity is now the exact tag-to-arm mapping, not whether the callback can range
  across arbitrary plug behavior. New sampler-editor-side support: the A4 template block
  contains distinct 10-byte records for `ASOK` and `CONS`, and `ConnectToPlug`'s two
  nearby template copies line up with those activation-style and connect-style records.
  Stronger Codex constraint: the descriptor callback tested during `ConnectToPlug`
  already uses the `.ASOK.....` template, so the installed per-plug function pointer is
  specifically on the activation-style path before `ActivateThisSocket` ever reuses it.
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
