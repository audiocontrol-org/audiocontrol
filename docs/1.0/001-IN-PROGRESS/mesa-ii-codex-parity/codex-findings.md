# Codex Findings Log

## Purpose

Record Codex conclusions from primary artifacts without assuming the Claude branch is
correct. Every finding should distinguish direct evidence from inference.

## Analysis Target 1

### Surface

- `CAkaiSampler` / `CAkaiMIDIDispatcher` field encoding for Akai header offsets 26-47
- `CMESASocket` call sequencing around BULK transfer in `SendAudioBufferToSampler`

### Why This Target First

- It is the Claude branch's current stated blocker.
- It sits directly on the path between corrected wire framing and the still-failing
  hardware test.
- If Claude is right, Codex should be able to reproduce that path from the same
  artifacts.
- If Claude is wrong, this is likely where the disagreement will surface earliest.

## Findings

- Finding 1: the current target is mislabeled in the Claude-side docs.
  Evidence:
  `BuildSampleHeaderFromMAH.annotated.txt` shows the repeated field-encoding dispatches
  loading the object from `CSamplerModule+0xDA4`, then reading its vtable pointer from
  offset `+2` before calling slot `0x38`.
  `CMESASocket-ctor.annotated.txt` shows `CMESASocket` stores its vtable at object
  offset `+0`, not `+2`.
  `AcceptSampleHeader.annotated.txt` and `CAkaiSampler-vtable14.annotated.txt` use the
  same `object -> +2 -> vtable` convention seen in `BuildSampleHeaderFromMAH`.
  Raw bytes from `sampler-editor-rsrc.bin` at `0x068981` show the `CAkaiSampler`
  constructor storing one pointer at offset `+8` and the vtable pointer at offset `+2`,
  matching the caller-side access pattern:
  `... 41ec0d90 2548 0008 41ec0e80 2548 0002 ...`
  `send-sample-header-decoded.md` cites the `CSamplerModule` constructor at `0x02820d`
  as the assignment site for `this+0xDA4 = CAkaiSampler*`, and the raw bytes around
  `0x02820d` are consistent with a constructor sequence that calls into
  `__ct__12CAkaiSamplerFv` and then stores A4-relative pointers into the object.
  Interpretation:
  based on the primary artifacts currently checked in the Claude branch, the repeated
  slot-`0x38` call in `BuildSampleHeaderFromMAH` is consistent with the
  `CAkaiSampler`/`CAkaiMIDIDispatcher` object chain and inconsistent with the
  `CMESASocket` object layout.

- Finding 2: the Claude-side artifact set is internally inconsistent about this target.
  Evidence:
  `disassembly-full/CMESASocket-vtable38.annotated.txt` actually contains the function
  header for `CAkaiMIDIDispatcher::Nibbleize`.
  `disassembly-full/CMESASocket-vtable38-encoder.annotated.txt` instead argues that the
  relevant slot resolves to `CAkaiMIDIDispatcher::SwapLongWord`.
  Interpretation:
  the artifact naming and the conclusion history drifted during the Claude-side session.
  This does not by itself disprove the `SwapLongWord` conclusion, but it means the
  checked-in analysis outputs cannot be treated as a clean, contradiction-free source.

- Finding 3: the currently checked-in annotated disassembly is compatible with the
  `SwapLongWord` theory for slot `0x38`.
  Evidence:
  `BuildSampleHeaderFromMAH.annotated.txt` shows slot `0x38` mutating local 32-bit
  values in place before each `movel` store into header offsets 26, 30, 34, 38, and 44.
  `CMESASocket-vtable38-encoder.annotated.txt` contains a fully decoded
  `SwapLongWord__19CAkaiMIDIDispatcherFPUl` implementation and ties it to vtable slot
  `0x38` of the `CAkaiMIDIDispatcher` table.
  Interpretation:
  the strongest current Codex read is that the repeated field transform is byte-swap,
  not nibble-encode-in-place.

- Finding 4: the raw binary supports the slot-`0x38` to `SwapLongWord` mapping.
  Evidence:
  in `binaries/sampler-editor-rsrc.bin`, the bytes at file offset `0x06f74b` contain the
  vtable entries:
  `... 00045df0 00045ed0 00045f2a 00045f96 ...`
  so slot `0x38` contains runtime address `0x00045f2a`.
  The bytes at file offset `0x06de81` begin:
  `4e56 0000 206e 000c 2010 e188 ...`
  which exactly match the checked-in decoded `SwapLongWord` function body.
  Interpretation:
  Codex independently verified from raw binary bytes that the vtable table includes
  slot `0x38 = 0x00045f2a` and that file offset `0x06de81` is a real function whose
  body matches the documented byte-swap implementation. This makes the byte-swap
  conclusion materially stronger than the earlier nibble-encode hypothesis.

- Finding 5: the Claude-side analysis set still contains stale, internally contradictory
  documents after the later `BuildCommand` and `SwapLongWord` corrections.
  Evidence:
  `send-sample-header-decoded.md` still presents a 406-byte payload and CDB length
  `0x000196`, and still describes the SLNGTH path under the older nibble-encoded model.
  `build-sample-header-decoded.md` still describes slot `0x38` as
  nibble-encode-in-place.
  Later files and notes, especially `sysex-builder-decoded.md` and later
  `SCSI-NOTES.md` entries, instead describe a 392-byte framing and `SwapLongWord`.
  Interpretation:
  the Claude-side branch does not just contain historical evolution; it currently
  contains flat contradictions across checked-in analysis docs. This was escalated in
  issue `#311` so Claude can reconcile or explicitly scope the stale files.

- Finding 6: the direct harness call to `CSCSIPlug::SendData` with a synthetic `BULK`
  `IP_Data` struct did not reproduce the full MESA upload sequence.
  Evidence:
  `SendAudioBufferToSampler.annotated.txt` shows repeated `CMESASocket` calls on
  `CSamplerModule+0x74` around the BULK loop, not just `SendData`.
  At `0x030743`, `0x030811`, `0x030c63`, and `0x030c95`, the function pushes SDS
  opcode `0x01` and then dispatches `vtable[0x30]` on the socket object at `this+116`.
  The same function also brackets raw sample transfer with `SendData` tags
  `BULK`, `SRAW`, and `BOFF` through socket `vtable[0x14]`, then calls a separate
  `CSamplerModule` vtable entry with `UALL` at `0x030c93`.
  The checked-in Claude-side `sampler-editor-decoded.md` already summarizes the same
  phase structure: SCSI mode performs an SDS-header call before BULK open and again
  after `UALL`, while the audio chunks travel through `BULK`/`SRAW`/`BOFF`.
  Interpretation:
  the old synthetic harness result can no longer be treated as equivalent to MESA's real
  caller path. Even without fully naming socket slot `0x30`, the primary disassembly
  shows that a standalone `SendData('BULK')` call omits concrete socket-level
  phase transitions that MESA performs before and after bulk transfer. This was
  escalated in issue `#312` so the stale equivalence claim can be corrected or refuted.

- Finding 7: the checked-in Claude artifacts strongly suggest `CMESASocket` slot
  `0x30` is `ActivateThisSocket(Uc)`, while some higher-level Claude docs still
  describe that slot as directly sending the SDS header.
  Evidence:
  the Claude branch already contains
  `disassembly-full/CMESASocket-vtable30-ActivateThisSocket.annotated.txt`, which
  identifies file offset `0x05a0a7` as `ActivateThisSocket__11CMESASocketFUc`.
  The recovered signature is `CMESASocket::ActivateThisSocket(Uc)`, which matches the
  `SendAudioBufferToSampler` call pattern: socket pointer plus one byte argument.
  The decoded body writes the byte argument to `CMESASocket+0x3c`, checks
  `CMESASocket+0x46` as a connection/dispatch guard, and then dispatches through a
  per-plug function pointer table using `CMESASocket+0x9aa` as the selected-plug index.
  `SendAudioBufferToSampler.annotated.txt` shows slot `0x30` being called with byte
  `1` at `0x030743`, `0x030811`, and `0x030c63`, then later with the saved byte from
  `this+0xb1` at `0x030ca3`/`0x030cb7`.
  That save-and-restore pattern is consistent with socket activation or selection state.
  In contrast, `sampler-editor-decoded.md` still labels `vtable[0x0030]` as
  "Send SDS sample header (opcode=0x01, socket_ptr)".
  Interpretation:
  the artifact set now points toward slot `0x30` being a socket-state method, not a
  direct transport send primitive. This strengthens the conclusion that the old direct
  BULK harness omitted real socket setup. Filed as issue `#313`.

- Finding 8: `ActivateThisSocket(1)` is part of broader `CSamplerModule` activation
  flow, not something unique to sample upload.
  Evidence:
  raw disassembly of `CSamplerModule::ActivateModule` at file `0x02a857` shows a
  second call to socket slot `0x30` with byte argument `1` at `0x02a8df-0x02a8ef`.
  The same function also emits several module/UI messages through `this+0xa20` before
  the socket activation call, then performs a later `vtable[0x28]` dispatch with
  constant `0x03ea`.
  Raw disassembly of `CSamplerModule::OpenModule` at file `0x02a639` also calls socket
  slot `0x30` with byte `1` at `0x02a6bb-0x02a6cb` after earlier socket-vtable calls
  on slots `0x0c` and `0x10`.
  Interpretation:
  `ActivateThisSocket(1)` is part of normal module/socket bring-up, not an ad hoc
  helper specific to the sample-transfer code. That makes the missing-sequence problem
  in the direct BULK harness more structural: the harness skipped module/socket
  activation steps that appear elsewhere in the sampler lifecycle too.

- Finding 9: `CSamplerModule::OpenModule` now looks like the full socket/plug bring-up
  sequence that the direct BULK harness skipped.
  Evidence:
  raw disassembly of `CSamplerModule::OpenModule` at file `0x02a639` shows two calls on
  socket slot `0x0c` with arguments that match the recovered
  `CMESASocket::ConnectToPlug(...)` signature:
  `this+0xa20` as callback/function pointer, plug IDs `'MIDI'` and `'SCSI'`, and
  output locations at `this+0xd98` and `this+0xd9c`.
  The same function then chooses one of those plug IDs and calls socket slot `0x10`
  with that value, matching the recovered `CMESASocket::SelectPlug(long)` signature.
  Only after connect/select does `OpenModule` call socket slot `0x30` with byte `1`,
  i.e. `ActivateThisSocket(1)`.
  Interpretation:
  sample upload occurs inside a pre-existing socket lifecycle:
  `ConnectToPlug` -> `SelectPlug` -> `ActivateThisSocket`.
  A direct `CSCSIPlug::SendData('BULK')` harness bypasses all three layers of setup, not
  just the later upload-specific call sequence inside `SendAudioBufferToSampler`.

- Finding 10: `OpenModule` and `DeactivateModule` add two more concrete state clues:
  `this+0xdaa` appears to track successful MIDI-plug connection, and slot `0x30`
  clearly uses `0`/`1` as activation-state values.
  Evidence:
  in `OpenModule` at `0x02a645-0x02a66d`, the `'MIDI'` `ConnectToPlug(...)` call is
  followed by `moveb #1,%a2@(3498)` at `0x02a669` only when the return code is zero.
  The same function then performs the `'SCSI'` `ConnectToPlug(...)` call, checks
  `this+0x0ba` at `0x02a68b`, and selects between the stored plug IDs at `this+0xd98`
  and `this+0xd9c` based on `this+0xda0` before calling `SelectPlug(...)`.
  Separately, `DeactivateModule` at `0x02a93f-0x02a9d7` performs the same message
  prologue as `ActivateModule`, but then calls socket slot `0x30` with byte `0`
  instead of `1`.
  Interpretation:
  `OpenModule` is keeping at least two distinct module-side pieces of socket state:
  one byte near the plug IDs that records successful MIDI availability, and another byte
  at `this+0xda0` that chooses the active plug. The slot-`0x30` parameter is now best
  read as an activation-state value, because both `ActivateModule` and `OpenModule` use
  `1` while `DeactivateModule` uses `0`.

- Finding 11: the `this+0xb1` save/restore pattern is not specific to
  `SendAudioBufferToSampler`; `SendAudioFileToSampler` repeats it almost exactly.
  Evidence:
  `CSamplerModule::SendAudioFileToSampler` at `0x02ec83` begins with
  `moveb %a0@(177),%fp@(-511)` at `0x02ec93`, conditionally forces slot `0x30` with
  byte `1` at `0x02ecb3-0x02ecc9` when `this+0xb0` is zero, performs the same Akai
  header build plus `BULK` transfer structure seen in `SendAudioBufferToSampler`, and
  then restores the saved byte through slot `0x30` at `0x02f24f-0x02f263`.
  Interpretation:
  `CSamplerModule+0xb1` is better modeled as reusable cached socket-activation state
  across multiple upload paths, not as a temporary local detail of one function.

- Finding 12: `CSamplerModule+0xda0` is very likely the module's transport selector,
  where nonzero means MIDI-selected / not-SCSI.
  Evidence:
  `OpenModule` tests `this+0xda0` at `0x02a695` and, when nonzero, chooses the stored
  `'MIDI'` plug ID from `this+0xd98`; otherwise it chooses the `'SCSI'` plug ID from
  `this+0xd9c`.
  `SCSIOnlyWarning` at `0x030d0b` tests the same byte at `0x030d13` and, when nonzero,
  displays warning `143` then returns `0`; when zero it returns `1` without warning.
  Interpretation:
  `this+0xda0` is not just "which plug object to use"; it likely encodes whether the
  module is in MIDI mode versus SCSI mode. That aligns with the warning behavior and the
  earlier `OpenModule` selection logic.

- Finding 13: within the checked-in disassembly slice from `OpenModule` onward,
  `this+0xdaa` has one observed write, `this+0xda0` has only observed reads, and the
  shared helper at `0x031ce6` does not explain either field.
  Evidence:
  direct search over the aligned slice `/tmp/mesa_sampler_from_openmodule.asm` finds
  only one `0xdaa` write:
  `moveb #1,%a2@(3498)` at `0x02a669` in `OpenModule`.
  The same slice shows `this+0xda0` only at `0x02a695` (`OpenModule`) and `0x030d13`
  (`SCSIOnlyWarning`), both as `tstb` reads.
  The frequently-called helper at `0x031ce6` resolves cleanly in the aligned slice to a
  message/progress helper that builds a block using `this+0xa20` and returns a status
  word through an out-parameter; it does not touch `+0xda0`, `+0xdaa`, `+0xb0`, or
  `+0xb1`.
  Interpretation:
  the current checked-in artifact window is enough to model downstream use of the
  transport and connection-state bytes, but not enough to prove where `+0xda0` is
  initialized. Any claim about its write-site still needs wider disassembly or another
  artifact set.

- Finding 14: a pre-`OpenModule` command path does write `CSamplerModule+0xda0`, and it
  uses that byte as mutable active transport state rather than immutable startup config.
  Evidence:
  in the constructor-to-`OpenModule` slice, a routine around `0x029105` saves
  `this+0xda0` to a stack byte, flips it to the opposite value (`0` -> `1`, `1` -> `0`),
  writes the new value back to `this+0xda0`, calls socket slot `0x30` with `0`,
  selects the corresponding plug ID from `this+0xd98` or `this+0xd9c`, and on select
  failure restores the saved byte to `this+0xda0`. It then calls slot `0x30` with `1`.
  Separately, another nearby command-status path at `0x02a20d-0x02a235` maps
  `this+0xda0` to a `1`/`2` command parameter and reads back `this+0xdaa`.
  Interpretation:
  `+0xda0` is an active transport-selection byte that can be toggled at runtime while
  reconfiguring the socket, not merely a fixed mode chosen once during initialization.
  That strengthens the earlier "MIDI vs SCSI selector" reading and narrows the missing
  upload-sequence model toward transport-state choreography rather than static setup.

- Finding 15: the checked-in aligned slices still show no direct stores to
  `CSamplerModule+0xb0` or `+0xb1`; only reads are visible.
  Evidence:
  direct grep over both aligned slices
  (`/tmp/mesa_sampler_ctor_to_open.asm` and `/tmp/mesa_sampler_from_openmodule.asm`)
  finds `moveb %a0@(177),...` reads at `0x02ec93`, `0x030723`, and `0x03109d`, plus
  `tstw %a0@(176)` reads at the upload/import call sites, but no `move* ..., %a0@(176)`
  or `move* ..., %a0@(177)` writes.
  Interpretation:
  with the current checked-in artifact coverage, `+0xb0/+0xb1` are downstream state
  consumers only. Their initialization site likely lives either earlier in the binary
  than the current aligned slices or inside callees not yet expanded into primary
  artifact notes.

- Finding 16: a whole-binary disassembly pass still does not reveal obvious plain stores
  to `CSamplerModule+0xb0` or `+0xb1`.
  Evidence:
  a full `m68k-elf-objdump` dump of `sampler-editor-rsrc.bin` to
  `/tmp/mesa_sampler_full_objdump.asm` produced the same result as the aligned-slice
  searches: concrete reads of `+0xb1` at `0x02ec93`, `0x030723`, and `0x03109d`, plus
  `tstw` reads of `+0xb0` in the upload/import paths, but no obvious plain `move*` or
  `clr*` stores targeting offsets `176` or `177`.
  Interpretation:
  within the currently available primary artifacts, `+0xb0/+0xb1` remain "read-only
  observed state." If they are initialized in this binary, it is either through less
  obvious addressing forms than the current grep strategy caught or inside code regions
  that still need hand-decoding rather than offset-grep alone.

- Finding 17: the runtime transport-toggle path around `0x029105` belongs to a larger
  command-dispatch routine, and the neighboring cases reinforce the active-transport
  model for `CSamplerModule+0xda0`.
  Evidence:
  in the aligned constructor-to-`OpenModule` slice, the block at `0x0289f1` begins a
  large command-oriented routine that repeatedly resolves four-character selectors via
  `jsr 0x28980` and then branches into adjacent handlers.
  Within that routine, the `0x029105` block flips `this+0xda0`, calls socket slot
  `0x30` with `0`, selects the corresponding plug ID from `this+0xd98` or `this+0xd9c`,
  restores the old `+0xda0` value on select failure, and then calls slot `0x30` with
  `1`.
  The neighboring handler at `0x0291b9` chooses literal tag `'MIDI'` or `'SCSI'`
  based on the same `+0xda0` byte before scanning a 48-byte-per-entry table, and the
  later handler at `0x02a20d` maps `+0xda0` to status value `2` or `1` before also
  reading back `this+0xdaa`.
  Interpretation:
  the current artifact set no longer supports treating the `0x029105` block as an
  isolated helper. It is part of a higher-level command/dispatch surface that exposes
  transport switching, current transport identity, and related availability state.
  That makes the `+0xda0` model stronger: it is an active, user-visible transport
  selector, not just a private startup implementation detail.

- Finding 18: the early `+0xa20` callback path is a lazy command-helper cache, not the
  missing initializer for `+0xb0/+0xb1` or `+0xda0`.
  Evidence:
  `InitModule__14CSamplerModuleFPFP11MESACommand_v` at `0x0286f3` performs a single
  direct store of its callback argument to `this+0xa20`.
  A later helper beginning at `0x028739` checks the cached pointer at absolute offset
  `+0xce24`, and if it is null but `this+0xa20` is present, it builds a small local
  descriptor on the stack, calls through `this+0xa20`, and then caches the returned
  pointer back into `+0xce24` before returning it.
  Other later command-dispatch cases at `0x0297b9` and `0x029b0b` call through the same
  `this+0xa20` callback with short stack descriptors and adjacent status words, which
  matches command/message helper usage rather than module-state initialization.
  Interpretation:
  the `+0xa20` callback machinery is important context for the command-dispatch layer,
  but it does not explain the provenance of `+0xb0`, `+0xb1`, or the default `+0xda0`
  value. That path should be treated as a command-proc/helper cache, not the state-byte
  initializer we are still looking for.

## Open Questions

- Does Claude's checked-in `ActivateThisSocket` artifact survive branch review as the
  authoritative identity for slot `0x30`, or is there a primary-artifact refutation?
- If slot `0x30` is `ActivateThisSocket(Uc)`, what does byte value `1` mean in the
  upload path, and why is `this+0xb1` restored afterward?
- How does `CSamplerModule+0xb1` relate to `CMESASocket+0x3c`? The current trace shows
  save/restore behavior across those fields, but not whether they are the same concept
  mirrored at two layers or merely correlated state.
- Is `CSamplerModule+0xdaa` specifically a "MIDI plug connected" flag, and if so where
  is it consumed outside `OpenModule`?
- What exactly is stored at `CSamplerModule+0xd98` and `+0xd9c` after `OpenModule`
  connects the `'MIDI'` and `'SCSI'` plugs?
- Are there any write sites for `CSamplerModule+0xda0` in the checked-in artifacts, or
  beyond the transport-toggle path described above, where is the default value
  established?
- Where are `CSamplerModule+0xb0` and `+0xb1` initialized before the upload/import
  paths that save/restore them?
- Is the remaining hardware failure explained entirely by the missing socket-level
  pre/post sequence, or is there still a content-byte mismatch in the 200-byte header?
- What exactly does the `CSamplerModule`-side `UALL` dispatch at `0x030c93` signal to
  the sampler or UI layer?
