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

- Finding 19: the `SPRF` path near `OpenModule` is prefs-file plumbing, not an observed
  initializer for the transport-state bytes.
  Evidence:
  `OpenModule__14CSamplerModuleFv` at `0x02a7fb` pushes `this+0xb7c` with the four-byte
  tag `SPRF` through `0x28980`, then conditionally calls `0x4204` only when
  `this+0xb3c` is nonzero.
  Later routines in the same aligned slice are explicitly labeled
  `ReadPrefsFile__14CSamplerModuleFv` and `WritePrefsFile__14CSamplerModuleFv`.
  `ReadPrefsFile` writes `this+0xb7c = 12` and copies the longword at `this+0xb32` into
  `this+0xb7e` before calling lower-level file helpers.
  Another nearby routine at `0x02b1a5` updates `this+0xb32` under a mask from an input
  structure and again pushes `this+0xb7c` with tag `SPRF`.
  Interpretation:
  the `SPRF`/`+0xb7c` region is now best read as a sampler preferences file/settings
  path rooted in the older `+0xb32` bitfield, not as the missing write site for
  `+0xb0`, `+0xb1`, or `+0xda0`. It narrows the search by eliminating another nearby
  settings-related false lead.

- Finding 20: `CSamplerModule+0xda4` is only observed as a read-side installed
  dependency in the current primary artifacts, not as a locally initialized field.
  Evidence:
  direct search across the aligned constructor-to-`OpenModule` and post-`OpenModule`
  slices finds many reads of `this+0xda4` (`movel %a2@(3492),...`, `moveal %a2@(3492),...`,
  `tstl %a2@(3492)`), but no concrete destination-side store to `+0xda4`.
  The same pattern holds in the broader checked-in disassembly coverage: the reliable
  matches are null checks and call-site reads, not writes.
  Representative read-side use includes `GetValue__15CGraphicControlFUc` at `0x02d10b`,
  which first checks `tstl %a2@(3492)` and then dispatches through the object loaded
  from `+0xda4`.
  Another representative use at `0x02abf3` loads `this+0xda4` into `%a0`, then passes
  `a0+8` into a later virtual-style dispatch, which is consistent with the earlier
  `CAkaiSampler`/dispatcher object-chain model.
  Interpretation:
  in the current primary-artifact set, `+0xda4` behaves like an already-installed
  collaborator owned by code outside the traced sampler-module slices. That strengthens
  the broader ownership conclusion: the true creation/installation path likely sits
  outside the currently aligned `CSamplerModule` windows, just like the missing first
  writes for `+0xb0`, `+0xb1`, and default `+0xda0`.

- Finding 21: the constructor-era ownership boundary is now sharper: the current
  primary artifacts expose `CAkaiSampler::SetSocket` and a likely
  `CSamplerModule` constructor that delegates deeper installation to helper `0x317dc`.
  Evidence:
  bounded raw disassembly of `sampler-editor-rsrc.bin` at file `0x028597` shows a tiny
  setter-shaped routine:
  `moveal %fp@(8),%a0; movel %fp@(12),%a0@(162); rts`, which matches the later
  `AcceptSampleHeader` evidence that `CAkaiSampler+0xa2` stores a `CMESASocket*`.
  The adjacent ASCII symbol bytes identify that routine as
  `SetSocket__12CAkaiSamplerFP11CMESASocket`.
  The next real function begins at file `0x0285d3` and shows a constructor/destructor
  shape for the owning sampler-module object: it installs several A4-relative tables at
  offsets `+4`, `+0x3e`, `+0x74`, and `+0xb2e`, computes an owner-relative backpointer
  through the object stored at `this@`, then calls helper `0x317dc(this)`.
  That same routine also conditionally tears down the subobject at `this+0xce28` via
  `0x2d6f6` when the destructor flag is nonzero, which matches the later pattern that
  object-lifetime work is being delegated rather than inlined.
  Interpretation:
  the current artifact set still does not show a direct `movel ...,%a2@(3492)` write to
  `CSamplerModule+0xda4`, but it no longer leaves ownership completely unbounded.
  The missing collaborator installation is now narrowed to constructor-era helper work,
  with `0x317dc` as the strongest current candidate for where `CAkaiSampler` and related
  external state are attached to the module object.

- Finding 22: Codex can now independently support the plug-side half of Claude's
  task-21 conclusion: `CMESAPlugIn::ActivateSocket` itself is an in-memory state
  routine, but the final callback-resolution hop from
  `CMESASocket::ActivateThisSocket` into that plug routine is still only partially
  reproduced.
  Evidence:
  `CMESASocket::ActivateThisSocket` at `0x05a0a7` stores its byte argument into
  `CMESASocket+0x3c`, computes `48 * this[2474]`, and indirect-calls the per-plug
  callback stored at `this[82 + 48*idx]`.
  `CMESASocket::ConnectToPlug` at `0x059e4b` copies 48 bytes from each matching plug
  descriptor entry into `this[74 + 48*n]`, which places descriptor offset `+12` at the
  same callback slot `this[82 + 48*n]` later used by both `ActivateThisSocket` and
  `SendData`.
  In the SCSI Plug binary, the full disassembly shows these neighboring entry points:
  `CMESAPlugIn::ConnectToSocket` at `0x09d2`, `CMESAPlugIn::ActivateSocket` at
  `0x0a5e`, `CMESAPlugIn::GetSockets` at `0x0b98`, and `CSCSIPlug::SendData` at
  `0x0df2`.
  The decoded `CMESAPlugIn::ActivateSocket` body at `0x0a5e` performs a slot scan and
  then only three local writes: it copies a word from `SocketInfo+36` into the plug's
  slot record, copies a long from `SocketInfo+42` into that slot record, and clears
  `buffer_ptr[16]`. The body contains no visible A-traps, no
  `_SCSIDispatch`-style call sites, and no jump into the later `CSCSIPlug::SendData`
  region.
  Interpretation:
  Codex now independently matches the no-wire behavior of the plug-side
  `ActivateSocket` implementation itself. The remaining gap is narrower than before:
  Codex still has not fully re-decoded the `CMESAPlugIn::DoMESACommand` tag dispatch
  strongly enough to promote "ActivateThisSocket always resolves to that no-wire
  routine" from inference to direct reproduction. So Claude's task-21 claim is now
  substantially supported, but not yet fully matched end-to-end from primary bytes.

- Finding 23: `CMESAPlugIn::DoMESACommand` now appears narrowed to two
  `SocketInfo`-style branch arms, which materially tightens the remaining task-21 gap.
  Evidence:
  bounded disassembly of the SCSI Plug binary at `0x089a-0x09a0` shows
  `CMESAPlugIn::DoMESACommand` loading the four-byte command tag from `MESACommand[0]`,
  running it through a selector helper at `0x148`, and then falling through a set of
  branch arms after the inline tag table containing `SEND`, `ASOK`, `CLSM`, `CONS`,
  `IDEN`, and `OPNM`.
  Among those arms, only two have the `SocketInfo`-style calling convention:
  `0x090c` pushes `MESACommand+6` plus `this` and calls vtable offset `+0x30`, while
  `0x0924` pushes the same `MESACommand+6` plus `this` and calls vtable offset `+0x34`.
  By contrast, the `0x08f0` arm uses a different vtable slot (`+0x14`) and does not
  pass the same `SocketInfo` payload shape, while `0x093c`, `0x096e`, and `0x097e`
  use still different vtable slots and argument counts.
  The nearby concrete method bodies already identified in the same binary are
  `CMESAPlugIn::ConnectToSocket(SocketInfo*)` at `0x09d2`,
  `CMESAPlugIn::ActivateSocket(SocketInfo*)` at `0x0a5e`, and
  `CSCSIPlug::SendData(IP_Data*)` at `0x0df2`.
  Interpretation:
  even without a full decode of the selector helper at `0x148`, the dispatcher shape is
  now much tighter. The `ActivateThisSocket` callback can no longer be thought of as
  "some unknown plug-side behavior"; within the current primary artifacts it narrows to
  the two `SocketInfo`-taking `CMESAPlugIn` arms, one of which is the independently
  decoded no-wire `ActivateSocket` routine. The unresolved step is now specifically
  which inline tag maps to which of those two arms, not the broader class of behavior.

- Finding 24: the sampler-editor A4 template block contains adjacent 10-byte command
  records for `SEND`, `ASOK`, `CONS`, and `PLST`, and the `ConnectToPlug` call sites
  line up with the `ASOK`/`CONS` records.
  Evidence:
  raw bytes in `sampler-editor-rsrc.bin` at file `0x71972` onward show a compact
  template region:
  `0x71972: 40 53 45 4e 44 00 00 00 00 00` (`@SEND.....`)
  `0x7198c: 00 41 53 4f 4b 00 00 00 00 00` (`.ASOK.....`)
  `0x71996: 00 43 4f 4e 53 00 00 00 00 00` (`.CONS.....`)
  `0x719a0: 00 50 4c 53 54 00 00 00 00 00` (`.PLST.....`)
  Those records are separated by the same 10-byte copy size used by the socket methods.
  Using the same A4 data-base interpretation that makes `A4+12466` land on the
  `SEND` record, `CMESASocket::ConnectToPlug`'s first handler query at `0x059e91`
  (`lea %a4@(12502),%a0`) lands on the `CONS` record, while the later descriptor
  callback test at `0x059ed1` (`lea %a4@(12492),%a0`) lands on the `ASOK` record.
  Interpretation:
  even before the `0x148` selector helper is fully decoded, the sampler-editor side now
  shows distinct command templates for connect-style and activate-style plug messages.
  That materially supports the view that the installed per-plug callback is expected to
  understand an `ASOK`-like activation message as a separate flow from the earlier
  `CONS`-like registration/query path.

- Finding 25: the descriptor callback exercised during `ConnectToPlug` is already an
  `ASOK`-style path, which sharply constrains what the installed per-plug function
  pointer can be.
  Evidence:
  in `CMESASocket::ConnectToPlug`, the first handler callback at `0x059eab` is the
  plug's top-level `DoMESACommand` callback and is used to fetch the descriptor array.
  Later, at `0x059f0f`, the code invokes the descriptor entry's installed function
  pointer at `descriptor[+12]` with a separate 10-byte local template copied from
  `A4+12492`.
  The sampler-editor command-template block now shows that `A4+12492` aligns with the
  `.ASOK.....` record under the same A4-base interpretation that makes `A4+12502`
  align with `.CONS.....`.
  In the SCSI Plug dispatcher, only two arms use the `SocketInfo`-style
  `(this, MESACommand+6)` calling convention: the vtable `+0x30` arm at `0x090c` and
  the vtable `+0x34` arm at `0x0924`.
  Interpretation:
  this materially tightens the callback model. The installed descriptor function pointer
  is not just some opaque plug callback that later happens to be reused by
  `ActivateThisSocket`; it is already being tested via an `ASOK`-style message during
  registration. That makes the remaining task-21 ambiguity essentially a two-way choice:
  which of the two `SocketInfo`-style `CMESAPlugIn::DoMESACommand` arms corresponds to
  `ASOK`, and which corresponds to `CONS`.

- Finding 26: the strongest current end-to-end Codex model is now
  `CONS -> vtable+0x30 -> ConnectToSocket` and
  `ASOK -> vtable+0x34 -> ActivateSocket`, with one remaining inference step in the
  selector-helper mapping.
  Evidence:
  `CMESAPlugIn::DoMESACommand` contains exactly two `SocketInfo`-style arms:
  `0x090c` calls vtable `+0x30` with `(this, MESACommand+6)`, and `0x0924` calls
  vtable `+0x34` with the same argument shape.
  The nearby identified `CMESAPlugIn` methods in the same binary appear in this order:
  `ConnectToSocket` at `0x09d2`, `ActivateSocket` at `0x0a5e`,
  `BusyCursor` at `0x0ae6`, `KeyIsPressed` at `0x0b40`, and `GetSockets` at `0x0b98`.
  That order is consistent with a vtable layout where the two SocketInfo-taking slots
  are the earlier pair and `+0x30` precedes `+0x34`.
  On the sampler-editor side, the `.CONS.....` and `.ASOK.....` template records are
  distinct and adjacent, and the descriptor callback installed into the socket slot is
  already exercised with `.ASOK.....` during `ConnectToPlug`.
  The plug-side method body independently decoded at `0x0a5e` is the no-wire
  `ActivateSocket` routine.
  Interpretation:
  Codex still does not have a byte-perfect decode of the selector helper at `0x148`,
  so the tag-to-arm mapping is not mathematically closed. But the combined evidence now
  makes one mapping clearly strongest: the earlier SocketInfo slot `+0x30` is the
  connect/query arm, and the later SocketInfo slot `+0x34` is the activation arm.
  Under that model, Claude's task-21 conclusion is effectively reproduced, with the
  remaining uncertainty isolated to the selector helper implementation rather than to
  transport behavior.

- Finding 27: `UALL` is now independently strengthened as a sampler-editor-side/module
  dispatch, not a SCSI Plug `SendData` tag.
  Evidence:
  `SendAudioBufferToSampler` at `0x030c7b-0x030c93` pushes `5`, then `'UALL'`, then
  `this`, and dispatches through `%a0@(4)->vtable[0x28]` on the `CSamplerModule`-side
  object, not through the socket object at `this+116`.
  The same function immediately surrounds that call with separate socket slot `0x30`
  activation calls at `0x030c63` and `0x030ca3`, which makes the ownership split
  concrete in one contiguous trace.
  Raw binary search also shows `UALL` appears many times in `sampler-editor-rsrc.bin`
  and does not appear at all in `scsi-plug-rsrc.bin`.
  That matches the earlier harness result in `plug-bulk-trace.md`: a synthetic UALL tag
  sent through the plug-side `SendData` dispatcher halts as unhandled.
  Interpretation:
  Codex now has direct sampler-editor-side and plug-side negative evidence for the same
  conclusion: `UALL` belongs to a different module/class dispatch path after bulk
  transfer, not to the SCSI Plug `SendData` tag family. That increases the likelihood
  that missing `UALL` or its surrounding module-side state transition is still a real
  cause of the failed standalone upload harness.

- Finding 28: the `UALL` upload-phase call shares a broader `CSamplerModule`
  command-dispatch slot with `SendCommandToSampler`, not a unique upload-only helper.
  Evidence:
  direct disassembly of `SendCommandToSampler__14CSamplerModuleFlsssPcsss` at
  `0x0321a7` shows the same core call shape as the upload-path `UALL` site: a local
  block pointer is pushed, then the caller argument and `this`, then the code loads
  `this+4`, reads `vtable[0x28]`, and dispatches through that slot.
  Raw bytes near `0x032147` in `sampler-editor-rsrc.bin` also show another `UALL`
  sequence in the same function family:
  `4878 0007 2f3c 55414c4c ... 2269 0028 4e91`, i.e. push small integer `7`, push
  `'UALL'`, push `this`, then call the same `this+4 -> vtable[0x28]` slot.
  The earlier upload-path site at `0x030c7b-0x030c93` already showed the same
  `this+4 -> vtable[0x28]` dispatch pattern with integer `5`.
  Interpretation:
  the strongest current Codex read is that `UALL` belongs to a generic
  `CSamplerModule` command channel surfaced through `vtable[0x28]`, not to a special
  upload-only postamble routine. That still leaves the concrete handler identity open,
  but it narrows the remaining failure model toward missing module-command/state
  sequencing rather than a hidden plug-side transport tag.

- Finding 29: the `vtable[0x28]` command-dispatch shape is shared beyond
  `CSamplerModule`, which makes it look like a broader editor/view command bus rather
  than a sampler-private virtual.
  Evidence:
  `SendCommandToSampler__14CSamplerModuleFlsssPcsss` at `0x0321a7` packages a small
  local block, then pushes caller argument plus `this`, loads `this+4`, reads
  `vtable[0x28]`, and dispatches through that slot.
  `SendCommandToSampler__12CFXFilerViewFlsssPcsss` at `0x067f9f-0x0680ef` does the
  same higher-level thing after its view-specific validation and repacking: it builds a
  local block at `fp-26`, then pushes the caller argument and `%a3@(138)`, loads the
  second pushed object plus offset `+4`, reads `vtable[0x28]`, and dispatches through
  the same slot shape before returning the status word stored in the local block.
  Interpretation:
  the strongest current Codex read is that `this+4 -> vtable[0x28]` is part of a
  shared command-routing interface used by multiple editor/view classes, not a
  `CSamplerModule`-exclusive sampler primitive. That pushes the unresolved `UALL`
  handler identity toward a common command processor that may bridge sampler and UI
  concerns, rather than a hidden transport-specific routine.

- Finding 30: the shared command-dispatch slot is rooted in a secondary function table
  stored directly at object offset `+4`, and both `CSamplerModule` and `CFXFilerView`
  constructors install that table from A4-relative data.
  Evidence:
  `SendCommandToSampler__14CSamplerModuleFlsssPcsss` loads `%a0 = this`, then
  `moveal %a0@(4), %a1`, then `moveal %a1@(40), %a1`, then `jsr %a1@`. There is no
  extra vtable dereference through an owned subobject; the field at `this+4` is itself
  the base of a function-pointer table used for command routing.
  The constructor-era `CSamplerModule` setup at `0x0285e9-0x0285fd` writes
  `this+4 = A4+0x54f0`, then writes `*(this+0) = (A4+0x54f0)+0x114`, showing the
  object's primary vtable pointer and secondary command table being installed from the
  same A4-relative table family.
  `CFXFilerView`'s constructor at `0x06655d-0x0666f` shows the same pattern: it writes
  `this+4 = A4+0x120a`, then writes `*(this+0) = (A4+0x120a)+0x2b4`.
  Interpretation:
  the current best structural model is that these editor/view classes carry a primary
  class vtable at offset `0` and a second A4-relative command-routing table at offset
  `4`. The unresolved `UALL` handler therefore lives behind a shared command interface
  installed during construction, not behind a hidden sampler/socket transport object.

- Finding 31: `SendAudioBufferToSampler` contains two distinct non-socket call families
  that should not be conflated: early `CAkaiSampler` vtable calls via `+0xda4`, and the
  later post-loop `UALL` command-bus dispatch via object offset `+4`.
  Evidence:
  the early calls at `0x030773`, `0x030793`, `0x0307f7`, `0x030841`, and `0x030891`
  all load `CSamplerModule+0xda4`, then dereference the pushed object's vtable pointer
  from offset `+2` before calling slots `0x0170`, `0x0134`, `0x015c`, `0x00dc`, and
  `0x017c`.
  In contrast, the later post-loop path at `0x030c7b-0x030c93` pushes integer `5`,
  `'UALL'`, and `this`, then loads `this+4`, reads offset `0x28` from that secondary
  table, and dispatches through it.
  Interpretation:
  the `0x0307fb` call through `CAkaiSampler` slot `0x015c` is a real pre-loop sampler
  call, but it is not the same thing as the post-loop `UALL` command at `0x030c93`.
  The strongest current Codex read is that some Claude-side docs have been conflating
  those two distinct paths when they describe `UALL` as `CAkaiSampler::vtable[0x015c]`.

- Finding 32: the early `CAkaiSampler` call family in `SendAudioBufferToSampler` now
  has a mostly recoverable slot map from the checked-in vtable and symbol anchors.
  Evidence:
  `SendAudioBufferToSampler.annotated.txt` already shows the pre-loop calls at
  `0x030773`, `0x030793`, `0x0307f7`, `0x030841`, and `0x030891` dispatching through
  `CSamplerModule+0xda4` with slot offsets `0x0170`, `0x0134`, `0x015c`, `0x00dc`, and
  `0x017c`.
  The checked-in `CAkaiSampler` vtable anchor at file offset `0x06f74b`, together with
  the independently reproduced `vtable[0x017c] = AcceptSampleHeader` mapping, yields the
  same slot-to-code progression used elsewhere in the Claude artifacts. The accompanying
  checked-in symbol lists then identify the corresponding code addresses as:
  `0x00dc -> GetSampleList`,
  `0x0134 -> GetFreeMemory`,
  `0x015c -> DeleteNamedSample(PUc)`,
  `0x0170 -> GetSamplerStatus`,
  `0x017c -> AcceptSampleHeader`.
  The call-site argument shapes fit that map unevenly but materially:
  `0x030793` takes no extra pushed arguments and its result is immediately compared
  against sample-size-derived arithmetic, which strongly matches a free-memory query.
  `0x0307f7` pushes `mah+21` before the call, which strongly matches a name-taking
  sampler method and is compatible with `DeleteNamedSample(PUc)`.
  Raw bytes at file offset `0x02d54b` decode cleanly as a tiny getter
  (`linkw #0; moveal this; moveal this+0x1c; unlk; rts`) followed immediately by the
  `GetSampleList__12CAkaiSamplerFv` name string, which materially strengthens the
  `0x00dc -> GetSampleList` mapping. That also fits the `0x030841` call site, where the
  returned object in `A0` is passed straight into `UExtractFromAEDesc::TheInt32`.
  Raw bytes at file offset `0x069115` also decode as a real function body followed by
  the `GetSamplerStatus__12CAkaiSamplerFv` name string, and the `0x030773` call site
  stores its `D0` result as a status word whose nonzero value bypasses the later
  free-memory check. That is compatible with a sampler-status query, though still not as
  behaviorally direct as the `GetSampleList` getter or the `GetFreeMemory` arithmetic.
  `0x030891` is already independently anchored as `AcceptSampleHeader(PUc,s)`.
  Interpretation:
  the strongest current Codex map for the pre-loop sampler-side family is:
  `0x0170 = GetSamplerStatus`,
  `0x0134 = GetFreeMemory`,
  `0x015c = DeleteNamedSample(PUc)`,
  `0x00dc = GetSampleList`,
  `0x017c = AcceptSampleHeader`.
  The confidence is now high for `0x00dc`, `0x0134`, `0x015c`, and `0x017c`.
  `0x0170` is still the weakest of the set: its name and call-site role fit
  `GetSamplerStatus`, but the body has not yet been decoded far enough to treat that
  mapping as equally direct.

- Finding 33: `CAkaiSampler` slot `0x0170` is now more specifically constrained as a
  status/helper path with callback and fallback behavior, not a transport or memory
  primitive.
  Evidence:
  raw bytes at file offset `0x069115` decode as a real function body followed by the
  `GetSamplerStatus__12CAkaiSamplerFv` name string.
  The function tests `this+0xba` and `this+0xbe`, zeroes local temporaries, then
  dispatches through `this+0xc4`. Later it pushes `this+0x2c` and calls either
  callback slots at offsets `0x50` and `0x64` on that object, or a fallback helper at
  `0x0341d6` when the earlier fields are absent.
  At the `SendAudioBufferToSampler` call site (`0x030773`), the returned `D0` word is
  stored as status and a nonzero result skips the later free-memory check.
  Interpretation:
  this is materially more compatible with a sampler-status/query routine than with any
  direct transport send, buffer clear, or memory-size primitive. Codex still does not
  know what concrete status is being queried, but the remaining ambiguity is now about
  the meaning of the status path, not about whether `0x0170` belongs to the transport
  layer.

- Finding 34: `GetSamplerStatus`, `BuildSampleList`, and `GetSampleList` now fit a
  coherent three-layer model.
  Evidence:
  raw bytes around file offset `0x0690db` show a function epilogue immediately followed
  by the `BuildSampleList__12CAkaiSamplerFv` name string, and then the next real
  function prologue at `0x0690f5`, which is the `GetSamplerStatus` entry discussed
  above.
  The adjacent `BuildSampleList` body and the later `GetSamplerStatus` body both touch
  the same field cluster rooted around `this+0x2c` and `this+0xba`.
  Separately, file offset `0x02d54b` shows `GetSampleList` as a tiny getter returning
  `this+0x1c`.
  Interpretation:
  the strongest current model is:
  `BuildSampleList` populates or refreshes sampler-side/list-side state,
  `GetSamplerStatus` queries readiness or status over that same state cluster, and
  `GetSampleList` simply returns the cached list/descriptor object at `this+0x1c`.
  That makes the pre-loop family in `SendAudioBufferToSampler` look even less like a
  transport sequence and more like a sampler/list-state preparation path before header
  acceptance and bulk transfer.

- Finding 35: `BuildProgramList` and `BuildSampleList` are near-template siblings that
  differ mainly by cached-list field selection.
  Evidence:
  raw bytes at `0x068fa9` (`BuildProgramList`) and `0x06905f` (`BuildSampleList`) share
  the same overall instruction shape:
  same prologue,
  same initial `tstl this+0xba`,
  same callback/refresh sequence through `this+0xa2`,
  same later use of the object at `this+0x2c`,
  same fallback pattern ending in `moveal this, %a0; rts`.
  The key stable difference in the matched bytes is the cached-list field:
  `BuildProgramList` uses `this+0x20`, while `BuildSampleList` uses `this+0x1c`.
  The immediate small selector argument also differs (`#2` in the program-list variant,
  `#4` in the sample-list variant).
  Interpretation:
  `BuildSampleList` is best understood as the sample-list specialization of the same
  list-refresh scaffold used by `BuildProgramList`, not as an upload-specific helper.
  That makes the later `GetSampleList` getter and `GetSamplerStatus` query look like
  consumers of a broader cached-list subsystem inside `CAkaiSampler`.

- Finding 36: the `this+0xba` / `this+0xbe` / `this+0xc4` field cluster is tightly
  concentrated in the same list/status subsystem, not spread through upload transport
  code.
  Evidence:
  raw-binary pattern searches for `push this+0xba`, `push this+0xbe`, and
  `load this+0xc4 then dispatch` land on the same local region that contains
  `BuildProgramList`, `BuildSampleList`, and `GetSamplerStatus`.
  The matched bytes at `0x068fa9`, `0x06905f`, and `0x069115` show the same recurring
  structure:
  test/push cached fields around `+0xba` / `+0xbe`,
  dispatch through `this+0xc4`,
  then interact with the object at `this+0x2c`.
  Interpretation:
  the strongest current read is that `+0xba`, `+0xbe`, and `+0xc4` belong to the
  cached-list/status machinery inside `CAkaiSampler`. They are not currently behaving
  like sample-upload transport fields, which further reduces the chance that the
  remaining BULK failure is hiding in this pre-loop status/list code.

- Finding 37: the `this+0x2c` callback object used by the sampler list/status helpers
  is not unique to upload or sampler transport code; the same call shape appears in
  graphics/view code.
  Evidence:
  pattern searches for the `pea this+0x2c; load callee slot; jsr` shape find not only
  the sampler-side sites in `BuildProgramList`, `BuildSampleList`, and
  `GetSamplerStatus`, but also unrelated view/graphics-side regions such as
  `0x05e1c1`, `0x05c669`, and neighboring functions whose trailing strings decode to
  names like `CountPanels__5LView...`, `Draw__8CGRPHPotFv`, and
  `DrawOffscreen__8CGRPHPotFv`.
  In the sampler cluster itself, the callback object at `this+0x2c` is used with slot
  `0x10` in the list builders and slots `0x50` / `0x64` in `GetSamplerStatus`, plus a
  direct fallback helper when needed.
  Interpretation:
  `CAkaiSampler+0x2c` now looks more like a UI/list-controller or generic helper object
  than a sampler-transport collaborator. That shifts the remaining `GetSamplerStatus`
  ambiguity further toward UI/list-state semantics and further away from wire-protocol
  behavior.

- Finding 38: slot `0x10` on the `this+0x2c` helper object is broadly reused outside
  the sampler path, which makes it look like a generic helper/display callback.
  Evidence:
  exact `pea this+0x2c; load slot 0x10; jsr` matches occur not only at the sampler-side
  `BuildProgramList` / `BuildSampleList` sites, but also at unrelated offsets such as
  `0x05e1c1`, `0x05e2fd`, `0x05e403`, `0x061397`, `0x061463`, and `0x0614c5`.
  The surrounding bytes in those non-sampler sites live near strings that decode to
  view/graphics function names like `Draw__8CGRPHPotFv` and
  `DrawOffscreen__8CGRPHPotFv`.
  In contrast, slots `0x50` and `0x64` on the same helper object are currently only
  observed in the `GetSamplerStatus` region.
  Interpretation:
  the shared `slot 0x10` use strongly suggests a general helper/display method on the
  `+0x2c` object rather than any upload-specific behavior. That leaves the status-only
  slots `0x50` and `0x64` as the more promising place if Codex keeps pushing on the
  exact meaning of `GetSamplerStatus`.

- Finding 39: the full `GetSamplerStatus` control-flow cluster around
  `this+0x2c`, slots `0x50` / `0x64`, and helper `0x0341d6` is unique in the current
  primary artifacts.
  Evidence:
  a raw-binary search for the exact bounded sequence around file offset `0x0611bf`
  returns one match, in the `GetSamplerStatus` block already tied to
  `CAkaiSampler::vtable[0x0170]`.
  The local control flow is:
  if the earlier cached fields around `this+0xba` / `this+0xbe` are missing, branch
  directly to helper `0x0341d6`;
  otherwise call `this+0x2c -> slot 0x50`;
  if that returns nonzero, then call `this+0x2c -> slot 0x64`;
  in both cases return without falling through into the helper.
  By contrast, broad searches for slot loads `0x50` and `0x64` alone do return many
  unrelated hits, so the uniqueness is in the full triad shape, not the slot numbers by
  themselves.
  Interpretation:
  while Codex still cannot name helper slots `0x50` and `0x64`, the evidence now
  supports treating this whole gated control-flow cluster as the distinctive status path
  inside `GetSamplerStatus`. That makes the cluster a better discriminator for future
  tracing than the individual slot offsets alone.

- Finding 40: helper `0x0341d6` is not sampler-specific; its other direct call site is
  in a graphics-side `DrawOffscreen`-adjacent control-flow pattern.
  Evidence:
  raw-binary search for absolute `jsr 0x0341d6` yields exactly two call sites:
  `0x0611e9` in the bounded `GetSamplerStatus` region, and `0x060d75` in a region whose
  trailing string decodes to `DrawOffscreen__10CGRPHFaderFv`.
  The second site also follows the same broad control shape seen in `GetSamplerStatus`:
  call helper-object slot `0x50`, test the result, optionally call slot `0x64`, else
  branch to helper `0x0341d6`.
  Interpretation:
  helper `0x0341d6` is now better understood as a generic UI/helper fallback routine,
  not a sampler-transport-specific function. That further weakens the case that the
  remaining upload failure is hiding inside the `GetSamplerStatus` helper path.

- Finding 41: the `this+4 -> vtable[0x28]` command bus is installed as a constructor-era
  secondary table across multiple editor/view classes, not just `CSamplerModule`.
  Evidence:
  `SendCommandToSampler__14CSamplerModuleFlsssPcsss` at `0x03222e` loads the secondary
  object/table at `this+4`, then dispatches through slot `0x28`.
  `SendCommandToSampler__12CFXFilerViewFlsssPcsss` at `0x068132` was already known to
  use the same `object+4 -> vtable[0x28]` shape. Raw constructor bytes now tighten that
  genericity further:
  `__ct__14CSamplerModuleFv` at `0x028597` stores an A4-relative pointer at `this+4`
  via `41 ec 54 f0` / `25 48 00 04`;
  `__ct__12CFXFilerViewFv` at `0x066618` does the same with `41 ec 12 0a` /
  `25 48 00 04`;
  `__ct__20CProgramsSamplesViewFv` at `0x03775c` does the same with
  `41 ec 49 1a` / `25 48 00 04`.
  In all three constructors, that secondary-table installation is separate from the
  primary class vtable at offset `0`, and the surrounding code follows the same broad
  "install table, then call shared helper/init routine" pattern.
  Interpretation:
  the post-loop `UALL` dispatch is better modeled as a call into a shared editor/view
  command-routing interface than as a sampler-private transport hook. This does not yet
  name the concrete class behind `+4`, but it narrows the ownership boundary: if the
  remaining upload behavior depends on `UALL`, the missing logic is more likely in a
  common command-processor layer than in `CAkaiSampler` or SCSI Plug transport code.

- Finding 42: the `+4` secondary table is generic framework machinery, not a
  `SendCommandToSampler`-only special case.
  Evidence:
  the base view constructor `__ct__17CMESAGrafPortViewFv` at `0x058ae0` also installs an
  A4-relative pointer at `this+4` (`41 ec 32 08` / `25 48 00 04`), which means the
  pattern is present even below `CFXFilerView` and `CProgramsSamplesView`.
  The base `ListenToMessage__17CMESAGrafPortViewFlPv` body at `0x058d38` then dispatches
  twice through that same secondary table via slots `0x00b4` and `0x0110`.
  Derived classes reuse the same mechanism: `ListenToMessage__12CFXFilerViewFlPv` at
  `0x066c4c` dispatches through `this+4 -> slot 0x00e0`, while
  `SendCommandToSampler__14CSamplerModuleFlsssPcsss` continues to use `this+4 ->
  slot 0x0028`.
  Interpretation:
  the `+4` structure is best modeled as a broader MESA editor/view interface table or
  message-routing bus, not a sampler-upload helper invented for `UALL`. That pushes the
  remaining ambiguity one layer higher: the question is no longer whether `UALL` rides a
  shared framework bus, but which framework-side handler or adapter sits behind slot
  `0x28` for `CSamplerModule`.

- Finding 43: the plug-side SRAW path does call through a patchable send slot at
  `0x106e`, but the checked-in unpatched binary does not contain a concrete sender there.
  Evidence:
  real `m68k-elf-objdump` disassembly of `CSCSIPlug::SendData` at file `0x0f40-0x0f6c`
  shows the `SRAW` arm packaging seven arguments and calling `jsr 0x106e`:
  `a2` (`CSCSIPlug*`), `a2+0x0d6e` (port/mode word), literal byte `1`,
  `d6 = a3+4` (loaded earlier from `IP_Data+4`), `a2+0x0e3c`,
  `a3@` (the leading `IP_Data` word), and `&fp-0x1e` as an out-pointer.
  The same `objdump` pass shows file `0x106e` itself is just `braw 0x1160` in the
  checked-in binary, not a concrete transport routine. That matches the Claude-side
  harness note that this is a patchable send-function slot, but Codex can now confirm it
  directly from primary bytes and can correct the offset spelling to file `0x106e`
  rather than sampler-style `0x1106e`.
  Interpretation:
  static evidence still does not tell us the final on-wire SRAW bytes, because the live
  sender is installed dynamically into the `0x106e` slot. But the binary does support a
  sharper negative claim: "would need ASPACK wrapping" is not present as static behavior
  here. The actual unresolved question is what runtime patch replaces the `0x106e` stub
  and what that patch emits.

- Finding 44: the shared post-call block at `0x1160` is a callback fan-out that labels
  payloads as `SYSX` or `SRAW`; it is not itself the missing wire emitter.
  Evidence:
  `objdump` of file `0x1160-0x1216` shows that after the `0x106e` call returns, the code
  tests the result word in `d3`, then, if an out-pointer at `fp-0x1e` is non-null, calls
  through a callback list obtained from `a2@(24)`. For each callback entry, it copies
  two small A4-relative templates into stack locals, stores the out-pointer and
  `a2+0x0e3c`, then chooses a four-byte local tag:
  if the first byte at `a2+0x0e3c` is `0xf0`, it writes `SYSX`; otherwise it writes
  `SRAW`.
  Only then does it call the callback entry point.
  Interpretation:
  this block explains why the unpatched `0x106e` slot can still fall through into
  framework-visible behavior without proving any wire output. The static binary therefore
  contains a clean separation:
  `SRAW` command setup at `0x0f40`,
  patchable sender slot at `0x106e`,
  callback/report fan-out at `0x1160`.
  That narrows the remaining SRAW gap to the runtime patch or harness trace, not to the
  already-visible callback machinery.

- Finding 45: `SetSCSIMIDIMode` is not the runtime patcher for `0x106e`; it computes and
  returns the mode word later used by higher-level helpers.
  Evidence:
  the real `SetSCSIMIDIMode__9CSCSIPlugFsUcUc` body starts at file `0x12f2`. Its code
  saves the cached A4-relative mode value from `a4@(372)` / `a4@(376)`, conditionally
  sets a local byte to `0x80`, then calls helper `0x1620` with the requested mode word,
  the plug-local control block at `a2@(2362)`, and local output buffers. If
  `a2@(3430)` is non-null after that call, the function returns the longword cached
  there; otherwise it rebuilds the return value from three local bytes at `fp-4 .. fp-2`
  and returns that 24-bit value in `d0`.
  There are no writes to file `0x106e`, `0x1072`, or the neighboring SRAW/SYSX stub
  region anywhere in this function. The two higher-level callers now traced
  (`0x1452..0x14be` and `0x150a..0x15c8`) use the returned mode value as data, feeding
  it into helper `0x1620`; they also do not patch the `0x106e` slot directly.
  Interpretation:
  this removes one of the more plausible static candidates for the SRAW sender install.
  The runtime patching of `0x106e` is not happening inside `SetSCSIMIDIMode` or its two
  immediately traced callers, so the remaining search should move outward toward other
  initialization/setup paths such as `ChooseSCSI`, open-time utility helpers, or the
  harness-side intercept layer rather than re-reading mode-selection code.

- Finding 46: `ChooseSCSI` is a bus-enumeration and selection path that caches chosen
  SCSI address fields back into `CSCSIPlug`; it does not patch the `0x106e` SRAW sender
  slot.
  Evidence:
  real `m68k-elf-objdump` of file `0x1700-0x1afe` recovers the body of
  `ChooseSCSI__9CSCSIPlugFUl`. That code builds a dialog-backed working set in
  `fp-0x740`, iterates bus/device candidates, and formats strings like `Bus X, ID=Y`
  from the inquiry buffer at `fp-0x124`. The inner probe path calls local helper
  `0x17ac`, which in turn reaches `CSCSIUtils::Inquiry__10CSCSIUtilsFccPUcUl` through
  the utility constructor at `0x1b1e`. Successful selection updates plug-local cached
  address fields:
  the chosen inquiry result is converted into a packed word at `fp-0x744`, written to
  `a2@(0x0d6e)`, and also stored into a per-bus slot family rooted at `a2@(0x0d70)`.
  Across the full recovered body there are no writes to file `0x106e`, `0x1072`, or the
  neighboring SRAW/SYSX stub region.
  Interpretation:
  this rules out another plausible setup-path candidate for the runtime SRAW sender
  install. `ChooseSCSI` clearly decides and caches which bus/device address the plug
  should use, but static evidence still does not show it installing the live sender into
  `0x106e`. The remaining static search should move outward again, toward other open-time
  setup/helpers or the harness-side interception layer, rather than treating bus choice
  as the missing patch site.

- Finding 47: the checked-in `CSCSIPlug` binary contains only call-site references to the
  SRAW send stub region; it does not contain a visible static patch/install path for
  `0x106e`, `0x1072`, or `0x1160`.
  Evidence:
  direct byte-search and `objdump` cross-checking on `scsi-plug-rsrc.bin` show exactly
  six absolute `jsr 0x106e` call sites, all inside the recovered `SendData` dispatch
  region at file `0x0f40-0x115c`:
  `0x0f60`, `0x0fbc`, `0x102c`, `0x10b2`, `0x10f8`, and `0x1144`.
  No other literal references to `0x106e` appear in the binary, and there are no direct
  literal references at all to `0x1072` or `0x1160` outside their own code bodies.
  The same recovered dispatch slice shows those six sites as payload-send arms followed
  by fallthrough/branch into the shared post-call block, not as stores or patch writes.
  Interpretation:
  this sharpens the current negative case. Static `CSCSIPlug` code clearly knows how to
  call the sender stub, but the checked-in binary does not visibly install or retarget
  that stub from within the plug code itself. If a live sender replaces the `0x106e`
  branch at runtime, that installation is more likely happening through external runtime
  patching, resource initialization outside the recovered plug body, or harness-layer
  interception than through a normal in-binary helper that simply has not been named yet.

- Finding 48: the `CSCSIPlug` constructor owns the persistent plug-side state used by
  later `SendData` paths, but it still does not reveal a static `0x106e` install site.
  Evidence:
  real `m68k-elf-objdump` of file `0x0bc6-0x0c6e` recovers `__ct__9CSCSIPlugFv`. After
  calling the inherited plug constructor and an initializer on `this+0x093a`, it writes
  the class vtable pointer from `a4@(316)`, seeds the four-byte tags `SCSI` and `PASC`
  into `this+8` and `this+12`, clears cached address state at `+0x0d66/+0x0d6a/+0x0d6c`
  and `+0x0d6e`, allocates `0x8000` bytes into `this+0x0e38`, copies the first longword
  of that allocation into `this+0x0e3c`, clears the per-bus slot family rooted at
  `this+0x0d70`, clears flag bytes `this+0x0e40`, `this+0x0e46`, and `this+0x0e47`, and
  stores the longword constant `1800` into `this+0x0e42`.
  None of that constructor body contains any literal reference to `0x106e`, `0x1072`, or
  `0x1160`.
  Interpretation:
  this is the cleanest in-binary ownership boundary so far for the plug-side state that
  `SendData` later reads and mutates. It explains where the cached payload pointer,
  readiness flags, and per-bus bookkeeping originate, but it also strengthens the
  negative SRAW result again: even constructor-time setup does not visibly install the
  live sender behind `0x106e`.

- Finding 49: `CSCSIPlug+0x0e42` is behaving like a timeout budget, not like code or a
  sender-install pointer.
  Evidence:
  the named body at file `0x139a-0x15dc`, `SMDataByteEnquiry__9CSCSIPlugFsUc`, measures
  elapsed time with repeated trap `0xa975` calls and compares the delta against
  `a2@(0x0e42)` at `0x1410-0x1416` and again at `0x1552-0x1558`. When the elapsed time
  exceeds that stored longword, the function returns error `-14010` (`0xc946`) rather
  than continuing the data-enquiry loop. This matches the constructor seed at
  `0x0c62-0x0c68`, which writes the longword constant `1800` into `this+0x0e42`, and it
  also matches the `DoMESACommand__9CSCSIPlugFP11MESACommand` control path at
  `0x0d3c-0x0d40`, which overwrites `this+0x0e42` from command data.
  Interpretation:
  this narrows another ambiguous field in the SRAW/BULK neighborhood. `+0x0e42` is a
  configurable timing/control value used by higher-level enquiry logic, not evidence of
  runtime patching around the `0x106e` sender stub.

- Finding 50: `DoMESACommand__9CSCSIPlugFP11MESACommand` uses the same plug-side field
  cluster for ordinary control-plane updates, not for sender-stub installation.
  Evidence:
  the recovered control handler at file `0x0cf0-0x0d58` switches on four command tags.
  One arm writes the incoming word at `MESACommand+8` directly to `CSCSIPlug+0x0d6e`;
  another writes the incoming longword at `MESACommand+6` to `CSCSIPlug+0x0e42`; a third
  clears `MESACommand+4`; and the `SHOW` arm calls helper `0x1162` and stores its word
  result back to `MESACommand+4`. The default arm delegates to helper `0x02fc`, but none
  of these cases reference `0x106e`, `0x1072`, or `0x1160`.
  Interpretation:
  this strengthens the current ownership model around the SRAW/BULK-adjacent fields.
  The same `+0x0d6e` / `+0x0e42` neighborhood participates in normal plug command/state
  handling, so it should be treated as mutable runtime configuration and status, not as a
  hidden patch-control surface for the sender stub.

- Finding 51: the recovered `0x160c-0x16d6` routine tagged
  `SMDispatchReply__9CSCSIPlugFsPUcUcPl` is a reply/validation wrapper that can fall
  into `SMDataByteEnquiry`; it is not a sender-stub installer.
  Evidence:
  real `m68k-elf-objdump` of file `0x160c-0x16d6` shows the routine zeroing the output
  longword at `a3@`, validating the transport with the utility check at `0x187e`, then
  packing the three payload bytes from the incoming longword into a local 4-byte control
  block with optional `0x80` in the high flag byte. It then dispatches through the same
  internal reply path at `0x1620`/`0x169a` with mode `2` and a 1000-unit timeout. If
  that succeeds and an output pointer is present, it immediately calls
  `SMDataByteEnquiry__9CSCSIPlugFsUc` at file `0x139a` to wait for/read back the reply
  data. None of this code references `0x106e`, `0x1072`, or `0x1160`.
  Interpretation:
  this removes another nearby candidate for hidden SRAW installation logic. The
  `SMDispatchReply`-side helper family is concerned with command dispatch plus reply
  validation/readback, not with retargeting the live sender stub.

- Finding 52: `0x1620` is not a separate hidden helper; it is a shared internal entry
  inside the recovered `SMDispatchReply` family that multiple higher-level wrappers call.
  Evidence:
  the recovered body at `0x160c-0x16d6` begins with standard prologue/setup at `0x160c`,
  but all absolute call sites target `0x1620`, not `0x160c`. Those call sites are the
  known wrappers at `0x12a6`, `0x133a`, `0x14ac`, and `0x15b8`. The `0x1620` entry point
  starts after the common register/setup prologue, with `moveal %fp@(28),%a3`, zeroes
  the output longword, validates transport through `0x187e`, builds the local 4-byte
  control block, and performs the actual reply dispatch/readback flow. There are no
  independent call sites to `0x169a`; that is just the self-recursive/shared re-entry
  call within the same body.
  Interpretation:
  this removes another source of ambiguity from the static SRAW search. The oft-seen
  `jsr 0x1620` target is not evidence of an unnamed external install helper; it is the
  common internal dispatch entry reused by the surrounding `CSCSIPlug` reply/send-mode
  wrappers.

- Finding 53: most of the remaining absolute call targets inside the `CSCSIPlug` send
  region are internal entries within already recovered bodies, not additional standalone
  helpers.
  Evidence:
  a full absolute-`jsr` sweep across the `CSCSIPlug` method window (`0x0c00-0x1b20`)
  now reduces the interesting local targets to a small set:
  `0xca2`, `0xdfc`, `0x106e`, `0x1162`, `0x1620`, and `0x187e`.
  The latest decoding already collapses several of these:
  `0x1620` is the shared internal entry inside the recovered `0x160c-0x16d6`
  `SMDispatchReply` family;
  `0xdfc` is the main entry of the selector/send dispatcher recovered at
  `0x0df2-0x106a`;
  `0xca2` sits inside the recovered `__dt__9CSCSIPlugFv`-adjacent body at
  `0x0c88-0x0ccc`, not at a separate named symbol boundary.
  `0x187e` is already the known utility/transport check used by several wrappers.
  Interpretation:
  this means the apparent helper surface in the static plug binary is smaller than it
  looked earlier. After collapsing shared/internal entries, the genuinely unresolved
  local targets are basically the `0x106e` sender stub itself and the odd `SHOW`-path
  jump into `0x1162` inside the shared post-call block, plus the selector helper at
  `0x148`.

- Finding 54: the `SHOW` arm’s `jsr 0x1162` is an intentional jump into the shared
  post-call/report block, not a separate helper.
  Evidence:
  `objdump` of file `0x115c-0x1216` shows that `0x1162` lands two bytes into the shared
  post-call block that normally begins at `0x1160` with `tstw %d3`. Entering at
  `0x1162` skips that initial status test and starts at `bnew 0x1214`, followed by the
  callback-list walk:
  fetch callback container from `CSCSIPlug+24`, iterate 46-byte entries, build the local
  report block, label the payload `SYSX` vs `SRAW`, and invoke each callback entry.
  The only absolute call site to `0x1162` is the `SHOW` arm in
  `DoMESACommand__9CSCSIPlugFP11MESACommand` at `0x0d2e`.
  Interpretation:
  this collapses one of the last apparently mysterious local targets. The `SHOW` path is
  reusing the shared report/callback machinery directly, not calling a hidden standalone
  helper. That leaves the real unresolved static residue even smaller: the `0x106e`
  sender stub itself, plus the unresolved `jsr 0x148` target in the dispatcher.

- Finding 55: `0x148` does not decode cleanly as a normal standalone helper; it overlaps
  the plug's embedded string/header region.
  Evidence:
  direct `objdump` and `xxd` of file `0x0120-0x01b0` show that the bytes around `0x148`
  are not a clean function body but the resource-identification region containing
  `AKAI & Living Memory 1995`, `MESA SCSI Plug`, and adjacent header-like values. The
  exact bytes at `0x148` are:
  `20 53 43 53 49 20 50 6c 75 67 ...`, which render as printable product text in the
  same region rather than a trustworthy helper prologue. The only absolute call site to
  `0x148` is the selector/send dispatcher at `0x0e52`.
  Interpretation:
  this means the long-standing `jsr 0x148` target should not be treated as an ordinary
  recovered helper without further evidence. The remaining static residue is therefore
  narrower but also stranger than before: the live sender stub at `0x106e` is still the
  main unresolved mechanism, while the `0x148` target may be a data-driven entry,
  resource-header trick, or some other nonstandard control transfer rather than a normal
  local function.

- Finding 56: `0xca2` is another internal entry point inside the recovered
  `0x0c88-0x0ccc` body, not a normal standalone helper.
  Evidence:
  direct `objdump` of file `0x0c88-0x0ccc` shows that `0xca2` lands in the middle of the
  body, after the outer setup at `0x0c88-0x0c9e`. The instructions starting at `0xca2`
  immediately dereference `a2@(0x0e38)` and issue the two trap-style calls at `0xa02a`
  and `0xa023`, then tail into the `jsr 0x274` / optional `jsr 0x1b56` path. That code
  does not establish `a2` locally at the `0xca2` entry; it relies on `a2` already
  holding the active `CSCSIPlug` object. The only absolute call sites to `0xca2`
  (`0x0e8c`, `0x0eb2`, `0x10d2`, `0x110a`, `0x1122`, `0x1156`) all occur inside the same
  send/dispatcher family where `a2` is already live.
  Interpretation:
  this collapses another apparently independent helper. `0xca2` is register-dependent
  shared internal logic reused within the `CSCSIPlug` dispatcher, not a separate helper
  that broadens the static search surface. That leaves the `0x106e` sender stub as the
  only clearly ordinary unresolved local mechanism in the plug code.

- Finding 57: the very low absolute targets like `0x148` and `0x274` fall inside
  header/data territory, not credible local code bodies.
  Evidence:
  direct `xxd` and `objdump` of file `0x0120-0x0320` show that this region is dominated
  by embedded strings and table-like data, not executable function structure. Around
  `0x148`, the bytes decode as the printable product string `MESA SCSI Plug`. Around
  `0x274`, the bytes are dense table patterns such as
  `c300 00c3 c300 0183 c180 ...`, and the surrounding `0x0240-0x0320` region continues
  with obviously non-code table content and repeated numeric patterns rather than any
  coherent prologue/call/return structure.
  Interpretation:
  this means low absolute `jsr` targets in this binary should not be assumed to be local
  in-resource helper bodies just because `objdump` can assign instructions to the bytes.
  In practice, the remaining odd targets (`0x148`, and likely the similarly low `0x274`
  and `0x02fc`) should be treated as nonstandard control transfers or external/runtime
  entry points unless stronger evidence proves otherwise. That further shrinks the set of
  plausible in-binary explanations for the live SRAW sender.

- Finding 58: `0x02fc` also lands inside the same dense table/data band, not a credible
  local helper body.
  Evidence:
  direct `xxd` and `objdump` of file `0x02e0-0x0360` show that the `0x02fc` target sits
  in a region dominated by repeated numeric/table patterns such as
  `3333 3333 3333 0005 bbbb bbbb bbbb`, `000f f000`, `004f f400`, `05ff ff50`, and
  `04f3 3f40`, with long zero runs between them. This region does not show any coherent
  function prologue/call/return structure; it continues the same non-code table band
  already observed around `0x0274`.
  Interpretation:
  this upgrades the earlier caution into a stronger pattern: all of the low absolute
  targets currently used by `CSCSIPlug` (`0x148`, `0x0274`, `0x02fc`) now look like
  data/header territory rather than ordinary in-resource helper code. That pushes the
  remaining live-sender explanation even further toward nonlocal/runtime behavior.

- Finding 59: classic Mac memory layout makes the low-address `jsr` targets look more
  like low-memory/system entry points than in-resource code.
  Evidence:
  platform documentation aligns with the binary-level anomaly. Classic Mac memory maps
  place low-memory globals beginning at `$0100`, the OS trap table around `$0400`, the
  Toolbox trap table around `$0E00`, and the system heap only later (for example,
  around `$1600` on the Mac Plus / classic-era map). That means the absolute targets used
  here at `0x148`, `0x274`, and `0x02fc` all fall squarely inside the low-memory/system
  area rather than where application/resource code would normally live.
  Interpretation:
  this is still an inference layered on top of the primary-artifact findings above, but
  it fits them cleanly. The weird low-address `jsr` sites are better modeled as external
  low-memory/system vectors or data-driven control transfers than as ordinary helper code
  residing inside the plug resource itself.

- Finding 60: `0x187e` is another internal entry point, not a separate standalone helper.
  Evidence:
  the absolute callers at `0x1286`, `0x14f6`, and `0x162e` all jump to `0x187e`, but
  direct disassembly of the larger `0x1700-0x1afe` region shows that `0x187e` lands in
  the middle of the already recovered `ChooseSCSI`-side body rather than at any clean
  prologue. In the surrounding bytes, `0x187e` sits inside the text-building sequence
  that formats `Bus X, ID=Y: ...` strings into the large stack-backed dialog block. So,
  like `0x1620` and `0xca2`, this is a shared internal entry reused by other wrappers,
  not a separate local helper that broadens the search surface.
  Interpretation:
  this collapses yet another apparently independent target. The remaining static plug
  surface is now even smaller than before; most surprising absolute `jsr` targets in the
  mid/high address range are internal entries inside already recovered bodies.

- Finding 61: `0x1b56` is another internal entry point, inside the recovered
  `CSCSIUtils` constructor path rather than a standalone helper.
  Evidence:
  direct disassembly of file `0x1b1c-0x1ba4` shows the real `__ct__10CSCSIUtilsFv`
  constructor starting at `0x1b1c`. The absolute target `0x1b56` lands in the middle of
  that body, after the initial zeroing/allocation setup and just before the constructor's
  large-buffer install and `scsi` capability test. The absolute call sites to `0x1b56`
  (`0x082e`, `0x0cbe`, `0x21da`, `0x2752`) therefore target a register-dependent
  constructor-side entry, not a separate helper symbol.
  Interpretation:
  this keeps pushing the same direction: even the remaining higher-address setup-looking
  targets are collapsing into internal entries inside already recovered bodies. The
  ordinary unexplained static mechanism is still just the `0x106e` sender stub.

- Finding 62: the remaining `0x210c/0x21dc/0x229c/0x218a` family is dialog/UI plumbing,
  not part of the SRAW send mechanism.
  Evidence:
  direct disassembly of file `0x2100-0x22ce` plus nearby symbol strings shows these
  targets living under the `CDialog` method cluster:
  `__ct__7CDialogFsPv`, `__dt__7CDialogFv`, `Show__7CDialogFv`,
  `Draw__7CDialogFv`, and `Do__7CDialogFv`. The call shapes match that too:
  `0x21dc` and `0x229c` are used repeatedly from the `ChooseSCSI` dialog-building loop,
  while `0x218a` is the dialog-show/display path used once the candidate list has been
  built.
  Interpretation:
  this closes off the last obvious “maybe that target matters” branch in the chooser
  region. The surviving unresolved mechanism on the static plug side is still the
  `0x106e` sender stub, not any of the dialog-related helpers.

- Finding 63: the static `0x106e` bytes are not a usable in-binary sender body; if
  executed as-is, they jump straight into the shared report block and skip the
  per-arm post-call cleanup that the real sender path expects.
  Evidence:
  in `scsi-plug-SendData.asm`, every `jsr 0x106e` call site is immediately followed by
  arm-local epilogue work before a later `bra 0x1160`. For example:
  `0x0f60: jsr 0x106e`, then `0x0f66: move.w d0,...`, `0x0f68: addq/stack cleanup`,
  `0x0f6c: bra 0x1160`; similarly at `0x102c`, `0x10b2`, `0x10f8`, and `0x1144`.
  But the bytes at file `0x106e` in the checked-in binary are only `bra 0x1160`, which
  would bypass those return-site instructions entirely and enter the shared
  post-call/report block without running the arm-local cleanup or result handling.
  Interpretation:
  this is stronger than “`0x106e` is a placeholder.” The checked-in static bytes at
  `0x106e` are not a plausible final sender implementation inside the recovered plug
  body. The live sender must be installed, intercepted, or otherwise redirected at
  runtime before normal execution.

- Finding 64: `0x0d54` is not a standalone helper; it lands inside the tail of
  `DoMESACommand`.
  Evidence:
  raw bytes from file `0x0d20-0x0d64` show `0x0d54` sitting inside a normal epilogue
  sequence:
  `... 4e b9 00 00 02 fc` at `0x0d4e` (`jsr 0x02fc`), then `0x0d54: 16 00`,
  `0x0d56: 50 4f`, `0x0d58: 10 03`, `0x0d5a: 4c df 0c 08`, `0x0d5e: 4e 5e`,
  `0x0d60: 4e 75`. Immediately after that, file `0x0d64` begins the embedded
  `DoMESACommand__9CSCSIPlugFP11MESACommand` symbol string.
  Interpretation:
  this is another mid-body/internal return entry, not a separate send-path helper. That
  further shrinks the ordinary static call surface around `SendData`: the only clearly
  ordinary unresolved local mechanism is still `0x106e`.

- Finding 65: the direct absolute `jsr` targets inside `SendData` are now effectively
  classified; the only unresolved ordinary local target left is `0x106e`.
  Evidence:
  the recovered `SendData` body uses absolute `jsr` targets `0x0148`, `0x0ca2`,
  `0x0d54`, `0x0dfc`, and `0x106e`.
  Current classification from primary-artifact work is:
  `0x0148` overlaps low-memory/header/string territory rather than a normal in-resource
  helper;
  `0x0ca2` is an internal entry inside the recovered `0x0c88-0x0ccc` body;
  `0x0d54` is an internal tail entry inside `DoMESACommand`;
  `0x0dfc` is the main entry of the selector/send dispatcher;
  `0x106e` is still the unresolved sender stub.
  Interpretation:
  this is the cleanest static-exhaustion point so far for the plug-side send path.
  Further progress on the static side is unlikely to come from finding one more normal
  helper hidden in `SendData`; it is more likely to come from runtime behavior,
  interception, or nonlocal installation of the live sender.

- Finding 66: the Sampler Editor socket layer does not appear to rewrite the installed
  per-plug callback after `ConnectToPlug`; it installs once, selects by index, and then
  reuses the same slot callback for both activation and send.
  Evidence:
  `CMESASocket::ConnectToPlug` at `0x059e4b` copies 48 bytes of plug-provided descriptor
  data into the internal slot array starting at `this[74 + 48*n]`; the future callback
  lands at slot-base `+8`, which is object offset `this[82 + 48*n]`.
  `CMESASocket::SelectPlug` at `0x05a053` does not touch slot contents; it only scans the
  registered slots for a matching plug ID and stores the chosen slot index into
  `this+0x09aa`.
  `ActivateThisSocket` at `0x05a0a7` computes `48 * this[0x09aa]`, reads the callback
  from `this[82 + 48*idx]`, and calls it.
  `CMESASocket::SendData` at `0x05a133` follows the same pattern: it builds a local
  command block, computes `48 * this[0x09aa]`, reads the callback from
  `this[82 + 48*idx]`, and calls it.
  Interpretation:
  within the recovered Sampler Editor socket layer, there is no evidence that the live
  sender callback is being rewritten per transfer or per send call. The only host-side
  mutation visible here is initial descriptor installation in `ConnectToPlug` plus active
  slot selection in `SelectPlug`. If the eventual SRAW sender behind the plug path is
  replaced or redirected at runtime, that behavior is more likely to happen before
  `ConnectToPlug` copies the descriptor, or inside the plug-side callback chain after the
  socket dispatch has already handed off control.

- Finding 67: the callback handed into `ConnectToPlug` from `OpenModule` is the generic
  module command-proc stored at `this+0xa20`, not a direct plug-owned callback field.
  Evidence:
  in `CSamplerModule::OpenModule` at `0x02a639`, the `'MIDI'` and `'SCSI'`
  `ConnectToPlug(...)` calls push `this+0xa20` as the callback argument before the plug
  IDs and output locations at `this+0xd98` and `this+0xd9c`.
  Separately, the early setup path at `0x0286f3` performs the direct store of its
  callback argument into `this+0xa20`; the surrounding string table identifies that
  routine as the `SetCommandProc` / `InitModule` callback-install path rather than a
  plug-specific socket helper.
  Interpretation:
  the immediate host-side provider for `ConnectToPlug` is the module/editor command-proc
  layer, not a dedicated socket-local plug object. That pushes the likely installation
  boundary one step outward again: if the live plug descriptor or sender callback is
  being prepared specially before `ConnectToPlug` copies it into the socket slot, the
  best remaining host-side candidate is the command-proc path behind `this+0xa20`, not
  `SelectPlug` or `CMESASocket::SendData` themselves.

- Finding 68: in the current primary artifacts, `CSamplerModule+0xa20` has one clear
  direct store in the `InitModule` path and then behaves as a broadly reused callback
  field, not something reinstalled inside `OpenModule`.
  Evidence:
  the direct `InitModule` / `SetCommandProc` store at `0x0286f3` writes its callback
  argument straight into `this+0xa20`.
  A raw binary sweep then finds many `movea this+0xa20,Ax` call-through patterns
  (`20 6a 0a 20 ... 4e 90`) across the sampler module, including the earlier helper
  cache at `0x028739`, the `OpenModule` / activation-adjacent regions, and the
  `SendAudioBufferToSampler` message path at `0x03096d`.
  In contrast, the current artifact set has not exposed a second clear direct store to
  `this+0xa20` after that `InitModule` install.
  Interpretation:
  the command-proc identity appears to be established before the module's normal socket
  bring-up and then reused by later paths like `ConnectToPlug`. That makes `InitModule`
  or its caller/owner chain a stronger host-side boundary than `OpenModule` itself if we
  are trying to find where the eventual live plug descriptor or callback originates.

- Finding 69: the module/editor constructor path clears `+0xa20`, so the command-proc
  callback is not constructor-seeded inside the recovered object body.
  Evidence:
  in the constructor-region function at `0x05965f`, after the object installs its A4
  tables and subobject pointers, it executes `clrl %a2@(2592)` at `0x0596e3`, i.e.
  clears `this+0xa20`.
  The same constructor sequence also installs the socket-related subobject pointers at
  `this+62` and `this+116`, which makes it the right ownership region for default field
  state. That means the later `InitModule` / `SetCommandProc` store is not reinforcing an
  already-present constructor default; it is the point where the callback first becomes
  non-null in the recovered lifecycle.
  Interpretation:
  the host-side install boundary is sharper now:
  constructor clears `+0xa20`,
  `InitModule` installs `+0xa20`,
  `OpenModule` later consumes `+0xa20` via `ConnectToPlug`.
  So if Path A keeps moving outward, the next relevant caller/owner question is who calls
  `InitModule` / `SetCommandProc` with the live command-proc, not whether the socket or
  constructor paths mutate it later.

- Finding 70: `+0xa20` behaves like a `CMESAEditor`-level command-proc field, not a
  sampler-specific socket field.
  Evidence:
  the function-boundary strings around the recovered object-lifecycle region identify
  `0x05965f` as the `CMESAEditor` constructor area, `0x059733` as the matching
  destructor region, and `0x0598a5` as `CMESAEditor::DoMESACommand`.
  Inside that same `CMESAEditor`-labeled region, the constructor clears `this+0xa20`,
  and `CMESAEditor::DoMESACommand` begins by testing `this+0xa20` before routing command
  tags.
  `OpenModule` later passes that same `this+0xa20` field into `ConnectToPlug`.
  Interpretation:
  the remaining host-side owner question has moved above sampler-specific code. The live
  command-proc feeding `ConnectToPlug` looks like an editor-framework callback owned by
  the `CMESAEditor` base region and inherited by `CSamplerModule`, not something local
  to `CMESASocket` or `CAkaiSampler`.

- Finding 71: `InitModule` / `SetCommandProc` is not directly reached by any simple local
  branch or absolute `jsr` inside the recovered sampler-editor resource.
  Evidence:
  a raw binary sweep for common direct control-transfer forms targeting file `0x0286f3`
  (`bsr.s`, `bsr.w`, `jsr` pc-relative, `jsr` absolute) returns no hits in the checked-in
  `sampler-editor-rsrc.bin`.
  The same negative result holds for nearby `CMESAEditor` region entries such as the
  constructor area at `0x05965f`, destructor area at `0x059733`, and
  `CMESAEditor::DoMESACommand` at `0x0598a5`: no simple local direct-call encodings were
  found for those targets either.
  Interpretation:
  within the current primary artifacts, the install path for `+0xa20` does not present as
  a straightforward local call edge into `InitModule`. If the command-proc is installed
  by code we already have, that handoff is likely table-driven, virtual, or otherwise
  indirect; otherwise the owner boundary may sit outside the recovered resource-level call
  graph entirely.

- Finding 72: the exact secondary-table `+0xac` indirect-call shape now looks like shared
  framework message routing, not the missing `+0xa20` install edge.
  Evidence:
  a raw binary search for the exact byte pattern
  `2f0a205722680004226900ac4e91`
  (`push this`, `load this+4`, `jsr slot+0xac`) finds exactly two hits in the checked-in
  `sampler-editor-rsrc.bin`: file offsets `0x02976f` and `0x02d41b`.
  The second hit lands inside the named
  `BroadcastUpdateMessages__14CSamplerModuleFUc` region, where the same indirect call is
  bracketed by four-character message tags `SSOL` and `UEND`, followed by a call to the
  already-identified helper `0x031ce6`, then `clrb this+0xda8` before return.
  The first hit at `0x02976f` is similarly surrounded by four-character command tags,
  including `EDKGH` before the `+0xac` dispatch and `UALL` shortly afterward through the
  already-known `this+4 -> vtable[0x28]` command bus.
  Interpretation:
  the currently recovered `+0xac` edges are best modeled as part of the same shared
  editor/view secondary-table message-routing framework already seen elsewhere, not as the
  owner-side install point for `+0xa20` or the live plug callback. This narrows the
  remaining Path A boundary again: the command-proc install path is still indirect, but
  the observed `+0xac` sites do not currently look like it.

- Finding 73: the four-character-tag wrapper at `0x028980` is the named
  `CSamplerModule::DoMESACommand`, which makes the nearby `EDKGH` / `SSOL` / `UEND`
  traffic look like ordinary module-command routing rather than callback installation.
  Evidence:
  direct bytes at file `0x028980-0x0289be` end in a function epilogue followed
  immediately by the embedded symbol string
  `DoMESACommand__14CSamplerModuleFP11MESACommand`.
  The earlier high-frequency call pattern `4eb900028980` therefore resolves to the named
  module command handler, not an unknown wrapper.
  Around the two `+0xac` sites, the surrounding code first pushes four-character tags and
  calls `0x028980`, then performs the secondary-table `+0xac` dispatch. In the named
  `BroadcastUpdateMessages__14CSamplerModuleFUc` case, the tags are `SSOL` and `UEND`; in
  the other observed case, the tag before the `+0xac` dispatch is `EDKGH`.
  Interpretation:
  the currently visible `+0xac` path is sitting next to explicit `CSamplerModule`
  command-tag traffic, not next to a unique callback-install sequence. That strengthens
  the current negative read: these observed `+0xac` edges look like ordinary framework
  command/update routing on top of the module command bus, not the owner-side install
  point for the live plug sender.

- Finding 74: the previously unnamed `+0xac` site at `0x02976f` sits inside
  `ObeyCommand__14CSamplerModuleFlPv`, so both currently observed `+0xac` edges are
  anchored to ordinary `CSamplerModule` command/update paths.
  Evidence:
  the function ending at file `0x029c30-0x029c36` is followed immediately by the embedded
  symbol string `ObeyCommand__14CSamplerModuleFlPv` at `0x029c38`, which matches the same
  "epilogue then trailing symbol string" layout seen elsewhere in the binary.
  The earlier `0x02976f` indirect-call site lies well inside that same bounded region.
  Its surrounding raw bytes show explicit four-character command tags including `CURK`,
  `KDAT`, `EDKGH`, later `UALL`, and repeated calls to the now-identified
  `CSamplerModule::DoMESACommand` wrapper at `0x028980` before and after the `+0xac`
  secondary-table dispatch.
  Interpretation:
  the second `+0xac` edge is no longer just "a nearby command path"; it is inside the
  named `CSamplerModule::ObeyCommand` flow. Together with the named
  `BroadcastUpdateMessages__14CSamplerModuleFUc` site, that makes the visible `+0xac`
  usage look like normal module command/update handling rather than the owner-side install
  path for `+0xa20` or the live sender callback.

- Finding 75: the current sampler-editor resource does not expose any ordinary in-resource
  pointer or alternate direct-store path back into `InitModule` / `SetCommandProc`.
  Evidence:
  a raw big-endian literal search for the recovered entrypoint words
  `0x000286f2`, `0x0002873a`, `0x0005965f`, and `0x000598a5` returns zero hits in the
  checked-in `sampler-editor-rsrc.bin`.
  A second bounded search for straightforward alternate direct-store encodings to
  `this+0xa20` also returns zero hits for the tested patterns
  `214a0a20`, `21480a20`, and `21400a20`, while the positive controls still show the
  already-known compare/load/use shapes:
  `4aaa0a20` at seven sites,
  `206a0a20` at thirty-seven sites,
  and `2f2a0a20` at the two `OpenModule` `ConnectToPlug` calls.
  Interpretation:
  the remaining owner boundary is now narrower than "no obvious local call." In the
  current primary artifact set there is also no plain literal table/pointer trail back to
  `InitModule` / `SetCommandProc`, and no second direct-install encoding for `+0xa20`.
  If the live command-proc source still exists inside this resource, it is likely hidden
  behind a more indirect or computed handoff than the usual static cues.

- Finding 76: `+0xa20` is used by generic `CMESAEditor` UI-side methods as well, which
  strengthens the read that it is an editor-framework callback sink rather than a
  sampler-specific sender hook.
  Evidence:
  the `CMESAEditor`-labeled region around `0x059c20` contains the functions whose
  trailing symbol strings decode to `BusyCursor__11CMESAEditorFUc` and
  `BarCursor__11CMESAEditorFUc`.
  In both bodies, the same pattern appears:
  test `this+0xa20`, build a small local block, then `movea this+0xa20,Ax` and `jsr`
  through that callback if present.
  Those are separate from the already-traced `CMESAEditor::DoMESACommand` and
  `CSamplerModule::OpenModule` paths that also use `+0xa20`.
  Interpretation:
  `+0xa20` now looks less like a callback installed specifically for sampler upload or
  plug setup and more like a general editor-framework command/notification callback field
  that multiple unrelated UI/module methods reuse. That lowers the chance that simply
  finding more `+0xa20` consumers inside the resource will expose the live sender install
  edge directly.

- Finding 77: the full observed `cmp this+0xa20` surface is now classified as ordinary
  editor/module behavior, not a narrow upload-sender path.
  Evidence:
  the seven currently observed `4aaa0a20` compare sites land at file offsets
  `0x028751`, `0x0297b9`, `0x02c035`, `0x02d697`, `0x02d733`, `0x059c47`, and `0x059ca1`.
  Bounded reads around those sites now tie them to named or already-anchored routines:
  `GetPlugList__11CMESAEditor...` at `0x028751`,
  the `CSamplerModule::DoMESACommand` / `UALL` command region at `0x0297b9`,
  `CreateQuickAccessWindow__14CSamplerModuleFv` at `0x02c035`,
  `Redraw__14CSamplerModuleFv` at `0x02d697`,
  `SelectWindow__14CSamplerModuleFl` at `0x02d733`,
  `BusyCursor__11CMESAEditorFUc` at `0x059c47`,
  and `BarCursor__11CMESAEditorFUc` at `0x059ca1`.
  No currently observed compare site lands in a dedicated sender-install helper, socket
  callback installer, or other upload-exclusive path.
  Interpretation:
  the primary-artifact surface around `+0xa20` now looks comprehensively generic:
  editor command handling, view/window management, and cursor/UI notifications all test
  the same field. That makes it less likely that continuing to enumerate more in-resource
  `+0xa20` consumers will reveal the missing live-sender install edge, and more likely
  that the remaining owner boundary is either computed/indirect above this layer or
  outside the recovered resource graph entirely.

- Finding 78: a broader `move.l ..., this+0xa20` store-family sweep still only finds the
  known `SetCommandProc` installer.
  Evidence:
  the exact setter at file `0x0286f3` encodes as `21 6e 00 0c 0a 20`, i.e. a stack-slot
  argument copied into `this+0xa20`.
  A broader raw-hex sweep for `move.l`-family writes terminating at displacement
  `0x0a20`, including the known `216e....0a20` stack-source form and looser
  `21.. .... 0a20` variants, returns only that one hit at `0x0286f3` in the checked-in
  `sampler-editor-rsrc.bin`.
  Interpretation:
  the negative owner-boundary result is now stronger than the earlier register-store
  sweep alone: the current primary artifact set does not expose a second ordinary
  `move.l` installer for `+0xa20`, even when the search includes the same stack-to-field
  encoding family used by the known setter. If another install edge exists inside the
  resource, it is likely using a more indirect mechanism than a straightforward field
  store.

- Finding 79: the visible installer body is the generic `CMESAEditor::SetCommandProc`
  setter itself, not a separate sampler-private implementation.
  Evidence:
  the string table in `sampler-editor-rsrc.bin` contains
  `InitModule__14CSamplerModuleFPFP11MESACommand_v` at file `0x0286c0` and
  `SetCommandProc__11CMESAEditorFPFP11MESACommand_v` at file `0x028706`, with the tiny
  setter body beginning immediately afterward at `0x0286f3`.
  That body is just:
  load `this`,
  copy the callback argument into `this+0xa20`,
  return.
  No second body or sampler-specific variant is visible between those symbol anchors.
  Interpretation:
  the recovered install point is best modeled as a base/editor-level setter that the
  sampler module inherits or aliases, not as a dedicated upload/sender initialization
  routine. That supports the current boundary read: the remaining unknown is the owner or
  computed dispatch that calls this generic setter with the live callback, not a missed
  second implementation inside sampler-private code.

- Finding 80: the `CMESAEditor` constructor already mixes ordinary calls with a direct
  jump into the tag-heavy `0x287ee` band, so the upper-layer setup path is not a clean
  code-only call graph.
  Evidence:
  bounded reads of `__ct__11CMESAEditorFv` at `0x05971c` show direct absolute calls to
  `0x031e24`, `0x0287ee`, `0x027a64`, `0x02d6f6`, and `0x0273fa`.
  Of those, `0x0287ee` lands in the same nearby band that contains the `OTFL`, `DATA`,
  `SS30`, `EBFL`, `EBFX`, and related four-character tag records rather than an ordinary
  named function body. A raw search finds only one direct `jsr 0x0287ee` site in the
  current binary, and it is this constructor call.
  Interpretation:
  the owner boundary above `CMESAEditor::SetCommandProc` is now even less likely to be a
  simple missed caller in a conventional code-only graph. The constructor path already
  crosses into tag/data-heavy territory, which makes a data-driven or otherwise
  nonstandard setup edge more plausible than another ordinary in-resource helper.

- Finding 81: the `0x287ee` target is best modeled as a mixed descriptor/dispatcher
  region, not as inert data and not as a normal standalone function body.
  Evidence:
  direct bytes from `0x287ee` begin with four-character records such as `OTFL`, `DATA`,
  `SS30`, `EBFL`, `EBFX`, `EBRV`, `PSYS`, and `SMDB`, each followed by short values or
  offsets. The same bounded region then transitions into executable logic around
  `0x28874`, where the code compares incoming tags like `DATA` and `SS30`, performs
  further calls, and continues into the later command-tag traffic that eventually leads
  toward the `DoMESACommand__14CSamplerModuleFP11MESACommand` string anchor at `0x289c2`.
  The only direct `jsr 0x287ee` hit in the current binary is the `CMESAEditor`
  constructor call already noted above.
  Interpretation:
  the constructor is not simply jumping into garbage or a pure static string table. It is
  entering a mixed table/dispatcher band whose front matter is tag-driven metadata and
  whose later bytes are executable logic. That makes the remaining owner boundary look
  more like a data-driven framework registry or command-template install path than a
  conventional named helper that static symbol recovery failed to isolate cleanly.

- Finding 82: the front of the `0x287ee` band is a regular 6-byte tag/offset table.
  Evidence:
  aligned reads starting at file `0x287eb` decode cleanly into repeated
  four-character tag plus 16-bit offset entries:
  `OTFL -> 0x002c`,
  `aeCT -> 0x0154`,
  `aeDL -> 0x019e`,
  `aeGE -> 0x0158`,
  `aeGP -> 0x0162`,
  `aeMN -> 0x017c`,
  `aeSP -> 0x0166`,
  `aete -> 0x0112`.
  Immediately after those fixed-width records, the same region transitions into the later
  executable tag-comparison/dispatch logic already noted above.
  Interpretation:
  this is no longer just "mixed tag-heavy bytes." The constructor-side target now looks
  like a concrete registry-table-plus-dispatcher structure: a fixed tag/offset table at
  the front, then logic that consumes related tags deeper in the same band. That makes a
  data-driven framework install path inside `sampler-editor-rsrc.bin` more plausible than
  a hidden conventional helper, while still keeping the ultimate live-callback owner edge
  unresolved.

- Finding 83: the tag-table offsets resolve to local case arms inside the same band,
  not to far-away handlers.
  Evidence:
  using the decoded table base at `0x287eb`, the current offsets land at:
  `OTFL -> 0x28817`,
  `aete -> 0x288fd`,
  `aeCT -> 0x2893f`,
  `aeGE -> 0x28943`,
  `aeGP -> 0x2894d`,
  `aeSP -> 0x28951`,
  `aeMN -> 0x28967`,
  `aeDL -> 0x28989`.
  Those addresses all sit inside the same `0x287ee` region. Bounded reads show the later
  entries at `0x2893f` onward are local case-arm starts that share the same
  `push tag state / push this / jsr absolute / return to local dispatcher` shape, with
  external calls such as `jsr 0x00a382`, `jsr 0x00a4f6`, `jsr 0x00a62c`,
  `jsr 0x00b382`, `jsr 0x00c150`, and `jsr 0x00c304`.
  Interpretation:
  `0x287ee` is now best modeled as a self-contained tag-indexed front-end dispatcher:
  the table maps tags to local case entries, and those local entries then fan out to
  other helpers. That is a stronger and more specific framework-registry model than
  “constructor jumps into a strange mixed region.”

- Finding 84: the local case arms fan out to opaque low-address payload regions rather
  than to ordinary-looking recovered code bodies.
  Evidence:
  the currently observed external calls from the local case arms include
  `jsr 0x00a382`, `jsr 0x00a4f6`, `jsr 0x00a62c`, `jsr 0x00b382`,
  `jsr 0x00c150`, and `jsr 0x00c304`.
  Direct byte reads around representative targets such as `0x00a620`, `0x00b360`, and
  `0x00c2f0` do not show coherent m68k prologues or normal function structure; instead
  they continue the same dense low-address, table/data-like byte patterns seen elsewhere
  in the opaque lower bands of `sampler-editor-rsrc.bin`.
  Interpretation:
  the constructor-side registry/dispatcher is now recovered more clearly than its payload
  handlers. The front-end table and local case arms are in view, but the code they fan
  out to still lives in opaque low-address regions that do not currently recover as
  ordinary helper bodies. That pushes the remaining static boundary outward again: the
  unresolved behavior is no longer in the front-end dispatcher itself, but in the
  low-address payload targets it reaches.

- Finding 85: the currently traced low-address payload targets do not show the known
  `+0xa20` callback-store/use patterns or ordinary m68k function markers.
  Evidence:
  bounded checks over representative payload targets
  `0x00a382`, `0x00a4f6`, `0x00a62c`, `0x00b382`, `0x00c150`, and `0x00c304` found none
  of the known `+0xa20` signatures:
  `216e000c0a20` (the `SetCommandProc` stack-to-field store),
  `4aaa0a20` (compare),
  `206a0a20` (load/call-through),
  or `2f2a0a20` (push/use in `OpenModule`).
  The same bounded slices also lack common ordinary function markers such as `4e56`
  (`link`), `4e75` (`rts`), or even direct absolute `4eb9` call opcodes.
  Interpretation:
  the currently visible payload layer still does not intersect the known generic callback
  machinery. That makes it less likely that the missing live-callback owner edge is
  hiding inside these already-traced low-address payload targets, and more likely that
  the callback install path stays above them or crosses into a different opaque layer.

- Finding 86: the decoded tag table does not map one-to-one onto isolated case bodies;
  several tags enter the middle of a shared local ladder and reuse the same downstream
  payload handlers.
  Evidence:
  the current table offsets resolve to local entries at `0x28817`, `0x288fd`,
  `0x2893f`, `0x28943`, `0x2894d`, `0x28951`, `0x28967`, and `0x28989`.
  Bounded reads show the later entries from `0x2893f` onward are tightly packed inside a
  single local ladder:
  `0x2894d` starts the arm that calls `0x00a382`,
  then falls through to the next arm at `0x28959` for `0x00a4f6`,
  then `0x28967` for `0x00a62c`,
  then `0x28977` for `0x00b382`,
  then `0x28989` for `0x00c150`,
  then `0x28999` for `0x00c304`.
  Table entries like `aeGE`, `aeGP`, and `aeSP` therefore land at different points
  inside that shared ladder rather than owning distinct standalone bodies.
  Interpretation:
  the registry layer is more compact and normalized than a naive tag-to-handler map. It
  uses shared local case code and shared payload tails, which further supports the read
  that this is framework dispatcher machinery rather than domain-specific sampler upload
  logic exposed as clean named functions.

- Finding 87: the two distinctive table entries, `OTFL` and `aete`, act as setup paths
  that prepare state before entering the shared local ladder.
  Evidence:
  the `OTFL` entry at `0x28817` runs a longer prelude than the later case arms. Within
  that prelude it pushes the literal tags `AK11` and `DATA`, calls `jsr 0x006ac2`, stores
  the returned word into a local slot, and only then falls through toward the later local
  dispatch flow.
  The `aete` entry at `0x288fd` likewise has its own prelude before the shared ladder:
  it pushes the literal tag `aete`, calls `jsr 0x00a9a0`, and only then enters the later
  tightly packed case-arm ladder beginning around `0x2893f`.
  Interpretation:
  `OTFL` and `aete` are not just more entries that directly map to the same payload
  handlers. They are special setup-style entries for this registry layer. That sharpens
  the current model of `0x287ee`: a small tag/offset registry whose front entries can do
  additional tag-specific setup before converging on the shared ladder and opaque payload
  layer.

- Finding 88: the two setup helpers reached by `OTFL` and `aete` are themselves still in
  the same opaque low-address format, not a clearer recovered code layer.
  Evidence:
  `OTFL` calls `0x006ac2`, and `aete` calls `0x00a9a0`.
  Direct byte reads around both targets show the same dense low-address, table/data-like
  format seen in the other opaque payload regions rather than ordinary m68k function
  structure. Bounded checks over both targets found no common function markers
  (`4e56`, `4e75`, `4eb9`) and none of the known `+0xa20` callback signatures
  (`216e000c0a20`, `4aaa0a20`, `206a0a20`, `2f2a0a20`).
  Interpretation:
  the setup-entry analysis now converges with the payload-layer analysis instead of
  escaping it. `OTFL` and `aete` do special setup before the shared ladder, but the
  helpers they invoke still terminate in the same opaque low-address world rather than in
  a cleaner owner/callback-install layer.

- Finding 89: the opaque low-address payload layer is not uniform; `0x006ac2` forms a
  distinct subfamily from the other currently traced payload targets.
  Evidence:
  representative word-frequency and byte-profile checks over
  `0x006ac2`, `0x00a382`, `0x00a4f6`, `0x00a62c`, `0x00a9a0`, `0x00b382`, `0x00c150`,
  and `0x00c304` show that `0x006ac2` is dominated by patterns like `fd56`, `fc00`,
  `fe00`, and `0008`, while the other targets share repeated grammar-like words such as
  `0633`, `3306`, `331d`, `1d33`, `2f06`, `0200`, `0202`, and related small-token
  sequences.
  The later group still lacks ordinary function markers and callback signatures, but it
  is visibly self-similar across multiple targets in a way that `0x006ac2` is not.
  Interpretation:
  the payload layer is now better modeled as at least two opaque subfamilies rather than
  one undifferentiated blob. `OTFL`'s helper at `0x006ac2` likely belongs to a different
  internal format or service family than the `aete`/shared-ladder payload targets. That
  is useful boundary information even before the semantics of either family are decoded.

- Finding 90: the grammar-like low-address subfamily overlaps parameter/help resource
  text, which suggests declarative resource data rather than hidden executable helpers.
  Evidence:
  one reused member of the grammar-like family appears at file `0x009f57`. Bounded reads
  there show the same recurring token pattern seen in payload targets like `0x00a382`,
  but the surrounding string table in the same low-address neighborhood is packed with
  parameter/help text such as `LFO 1 rate`, `LFO 1 depth`, `LFO 2 waveform`, and related
  synth-parameter descriptions.
  Other reused matches for the same family occur at `0x00dfef`, `0x00ef0f`, `0x00f569`,
  and `0x00fd63`, all still inside the same low-address, non-code-looking region.
  Interpretation:
  the currently traced grammar-like payload family is likely declarative resource or
  metadata content, not hidden executable m68k helper code. That further weakens the idea
  that the missing live-callback owner edge is buried in these payload targets. The
  dispatcher may be selecting resource descriptors or templates rather than jumping into
  conventional code bodies.

- Finding 91: the distinct `0x006ac2`-style subfamily also recurs inside low-address
  resource neighborhoods rather than surfacing as ordinary code.
  Evidence:
  motifs from the `0x006ac2` family such as `fd560008` recur at multiple low offsets
  including `0x005def`, `0x005dff`, `0x005f95`, `0x006082`, `0x006169`, `0x006270`,
  `0x00636d`, `0x006469`, `0x00654b`, `0x006627`, `0x006718`, `0x0068f2`, and `0x006906`.
  Bounded reads over representative sites like `0x005de0`, `0x005f80`, `0x006080`,
  `0x006900`, `0x006b00`, and `0x006d00` show the same opaque tokenized byte style and
  still lack ordinary m68k function markers.
  The surrounding string table for this broader low-address band includes parameter/help
  text such as `output level`, `velocity sensitivity`, and nearby UI class strings like
  `CGraphicControlList` and `CPopup`, again indicating a resource-heavy neighborhood.
  Interpretation:
  the `0x006ac2` family no longer looks like a one-off hidden code escape hatch. It also
  behaves like a recurring low-address resource/service format inside the same general
  resource-heavy part of the binary. That further reduces the odds that the missing live
  callback install path is hiding inside this subfamily as conventional executable code.

- Finding 92: the registry tags from `0x287ee` recur in later mixed regions, which
  strengthens the read that they are part of a broader resource-type system rather than a
  one-off constructor-only mechanism.
  Evidence:
  the same tag vocabulary reappears in later bounded regions of `sampler-editor-rsrc.bin`:
  at `0x02ea2d` the bytes explicitly compare `AK11` and `DATA`, then later introduce
  `EBFL`, `EBFX`, `EBRV`, `PSYS`, and `SMDB` in another mixed tag/logic block; at
  `0x031e15` the code compares `SMDB` and `SS30`, and then also checks `PROG`.
  The raw string table confirms repeated occurrences of these same tags across multiple
  low-address neighborhoods: `AK11`, `DATA`, `SS30`, `EBFL`, `EBFX`, `EBRV`, `PSYS`,
  `SMDB`, and `aete`.
  Interpretation:
  the `0x287ee` registry is not an isolated curiosity. It appears to be one front-end
  view onto a broader tag-based resource/type system used elsewhere in the binary. That
  further supports the resource/metadata interpretation of the opaque low-address layers
  and further weakens the hypothesis that this path hides a conventional callback-install
  helper.

- Finding 93: several recurring tags are now anchored to concrete sampler-module
  editor/file flows rather than to transport or callback-install behavior.
  Evidence:
  the later mixed regions around `0x030050` and `0x03019c` sit next to named functions
  like `CreateFXFilerWindow__14CSamplerModuleFv` and
  `SaveEB16Reverb__14CSamplerModuleFP15DraggedFileData`.
  In those neighborhoods, the recurring tag vocabulary reappears directly in context:
  `EBRV` and `SS30` near the FX-filer/reverb save path,
  `EBFX` and `SS30` near the adjacent save path,
  and earlier mixed blocks around `0x02ea2d` also introduce `EBFL`, `EBFX`, `EBRV`,
  `PSYS`, and `SMDB` after `AK11` / `DATA`.
  Interpretation:
  at least part of the broader tag system is now tied to concrete editor/file/resource
  workflows such as EB16 reverb/effects handling, not to hidden callback installation.
  That does not fully decode the low-address formats, but it further shifts the likely
  meaning of these tags toward resource/document types and editor save/load plumbing
  rather than transport or live sender setup.

- Finding 94: the resource-tag system stays separate from the actual upload transport
  paths in the currently traced sampler-module code.
  Evidence:
  bounded reads around the real transfer routines show the expected transport/control tags
  in their own neighborhoods:
  `SendAudioFileToSampler__14CSamplerModule...` near `0x02ee5f` uses `BULK`, `SRAW`, and
  `UALL`;
  `SendAudioBufferToSampler__14CSamplerModule...` near `0x030cca` likewise shows
  `BULK`, `SRAW`, and `UALL`.
  By contrast, the nearby EB16/resource-handling neighborhoods around
  `CreateFXFilerWindow__14CSamplerModuleFv`, `SaveEB16Reverb__14CSamplerModule...`, and
  adjacent mixed blocks carry `EBRV`, `EBFX`, `SS30`, `SMDB`, `PSYS`, `AK11`, and
  `DATA`, but do not introduce `BULK` or `SRAW`.
  Interpretation:
  the currently recovered tag-based resource system is not simply another view of the
  transport/upload command path. The tag families tied to editor save/load/resource flows
  are staying structurally separate from the real transfer verbs, which further weakens
  the idea that this registry layer hides the missing live sender behavior.

- Finding 95: the recurring resource tags behave like explicit file/type markers inside
  concrete save/load flows.
  Evidence:
  in `OpenDraggedFile__14CSamplerModule...` around `0x02ebe5`, the code writes literal
  `MAHF` into a local slot and then continues through file-oriented handling that also
  checks `AK11` and `DATA` in the nearby mixed region at `0x02ea2d`.
  In the save/load neighborhood around `SaveEB16Reverb__14CSamplerModule...` and
  `SaveEB16Effect__14CSamplerModule...`, the code writes literal `EBFX` and `SS30`
  markers into local slots before calling later helpers. The surrounding string anchors
  name nearby functions like `CreateFXFilerWindow`, `SaveEB16Reverb`,
  `SaveEB16Effect`, `LoadEB16FXFileSingle`, and `LoadEB16FXFileAll`.
  Interpretation:
  the tag system is not only adjacent to editor/file paths; it is actively used there as
  explicit type/format markers. That further supports the read that these tags belong to
  resource/document packaging and validation logic rather than to live sampler transport
  or callback installation.

- Finding 96: later mixed blocks are performing explicit file-format dispatch on these
  tags rather than treating them as passive metadata.
  Evidence:
  the block around `0x031e00` checks local markers against `SMDB`, then `SS30`, then
  `PROG`. After those checks it routes into helper calls tagged `GDFS` and repeated
  `SDIS` requests, while maintaining local state bytes and status flags.
  Similarly, the earlier mixed block around `0x02ea20` compares `AK11` and `DATA`, then
  introduces additional type markers like `EBFL`, `EBFX`, `EBRV`, `PSYS`, and `SMDB`
  before branching into multiple helper calls.
  Interpretation:
  this tag system is active dispatch logic for resource/document formats, not just static
  descriptors. The code is validating and routing on format tags in save/load-style
  workflows. That is another strong reason to keep it separate from the live transport
  path: it is clearly file/resource dispatch machinery.

- Finding 97: the named helper tags used by that dispatch layer also line up with file
  and resource operations rather than transport.
  Evidence:
  in the format-dispatch block around `0x031e00`, successful type checks on `SMDB`,
  `SS30`, and `PROG` route into helper calls labeled `GDFS` and repeated `SDIS`.
  The same general neighborhood contains named load/save functions such as
  `LoadVersion1ProgramFile__14CSamplerModuleFP6FSSpecUc`,
  `LoadVersion2ProgramFile__14CSamplerModuleFP6FSSpecUc`,
  `LoadAllAIFFInFolder__14CSamplerModuleFslPUcs`, and
  `LoadDiskDBaseFile__14CSamplerModuleFP6FSSpecUc`, plus literal file-type markers like
  `AIFF`.
  In `LoadAllAIFFInFolder`, the code explicitly checks `AIFF` and later calls
  `0x006ac2`, reinforcing that the same helper family is being used inside file/resource
  loading logic.
  Interpretation:
  the tag-dispatch helpers are not drifting back toward transport semantics. They keep
  lining up with file/resource operations and file-type validation, which makes the
  remaining live-sender/callback-install hypothesis on this branch even weaker.

- Finding 98: the constructor-side registry/tag/resource branch is now effectively
  ruled out as the primary live-sender path.
  Evidence:
  the `0x287ee` band has been reduced to a front-end tag table, a shared local ladder,
  and low-address payload/service families that repeatedly align with file/resource
  markers like `AK11`, `DATA`, `EBFL`, `EBFX`, `EBRV`, `PSYS`, `SMDB`, `SS30`, `PROG`,
  `AIFF`, `GDFS`, `SDIS`, and `MAHF`.
  Named sampler-module flows tie those markers to file/document handling:
  `CreateFXFilerWindow`, `SaveEB16Reverb`, `SaveEB16Effect`,
  `LoadEB16FXFileSingle`, `LoadEB16FXFileAll`, `OpenDraggedFile`,
  `LoadVersion1ProgramFile`, `LoadVersion2ProgramFile`,
  `LoadDiskDBaseFile`, and `LoadAllAIFFInFolder`.
  The actual transfer neighborhoods remain separate and continue to use transport verbs
  `BULK`, `SRAW`, and `UALL`.
  The low-address payload families also still lack overlap with the known `+0xa20`
  callback signatures and continue to look more like resource/service formats than
  conventional executable helpers.
  Interpretation:
  this branch now reads as file/resource/document plumbing. It may still matter for
  understanding the editor broadly, but it is no longer a credible primary candidate
  for the missing sender-install or callback-install edge.

- Finding 99: the other immediate `CMESAEditor` constructor call targets also fail to
  expose a normal code-only bridge into `SetCommandProc`.
  Evidence:
  the constructor-era direct targets previously tracked alongside `0x287ee`
  (`0x031e24`, `0x027a64`, `0x0273fa`, `0x02d6f6`) were rechecked directly in the
  bounded full disassembly.
  `0x031e24` still lands in the later mixed tag/dispatch region that compares markers
  like `SMDB`, `SS30`, and `PROG`.
  `0x027a64` and `0x0273fa` still land in dense table/data-style bands with repeated
  structured constants rather than ordinary m68k function shape.
  `0x02d6f6` also does not resolve to a clean standalone helper body; the bounded region
  at that target immediately transitions into the same symbol/header-style band carrying
  `Redraw__14CSamplerModuleFv`, rather than a straightforward code path that reaches the
  generic `SetCommandProc` setter.
  Interpretation:
  the immediate constructor call surface above `CMESAEditor` is still not giving up a
  normal helper path into the live callback install. The remaining owner edge continues
  to look mixed, indirect, or otherwise nonstandard rather than one missed ordinary
  function call.

- Finding 100: the generic callback setter at `0x0286f3` currently has no literal
  in-resource pointer trail at all.
  Evidence:
  direct byte-count checks over `sampler-editor-rsrc.bin` found zero occurrences of the
  big-endian longword `0x000286f3`.
  The same scan also found zero occurrences of the direct absolute-call encoding
  `4eb9 000286f3`.
  A looser 3-byte tail scan for `0x0286f3` also found zero occurrences.
  By contrast, the obviously data-heavy constructor-adjacent targets such as `0x031e24`,
  `0x027a64`, `0x02d6f6`, and `0x0273fa` do recur as raw address bytes in the binary.
  Interpretation:
  the visible `CMESAEditor::SetCommandProc` / `InitModule` setter is not currently being
  reached through any ordinary literal pointer or direct absolute-call path preserved in
  the checked-in resource. That materially strengthens the case that the live install
  edge is computed, table-driven in a nonliteral way, or outside the recovered resource
  graph entirely.

- Finding 101: the same "no literal trail" result now applies to the visible owner-side
  chain above the setter too.
  Evidence:
  direct byte-count checks over `sampler-editor-rsrc.bin` found zero occurrences of the
  big-endian longwords `0x0005971c` (`__ct__11CMESAEditorFv`) and `0x0005965f`
  (the constructor-region routine that clears `+0xa20`), and zero occurrences of the
  matching direct absolute-call encodings `4eb9 0005971c` and `4eb9 0005965f`.
  Combined with Finding 100, the visible owner-side sequence is now:
  constructor clear of `+0xa20`, generic setter at `0x0286f3`, and later consumers like
  `DoMESACommand`, `BusyCursor`, `BarCursor`, and `OpenModule` — but none of those key
  owner-side anchor addresses currently have a literal in-resource call/pointer trail
  leading into them.
  Interpretation:
  the boundary problem is no longer just "the setter has no obvious caller." The entire
  visible owner-side callback chain now looks nonliteral from the checked-in resource's
  point of view, which makes a computed, table-driven, or external handoff more likely
  than one more missed ordinary code path.

- Finding 102: the callback sink at `+0xa20` is only passed by address at the two
  already-known `OpenModule` plug-connection sites.
  Evidence:
  a whole-binary signature scan for `pea this+0xa20` (`2f2a0a20`) found exactly two
  matches in `sampler-editor-rsrc.bin`, at file offsets `0x02a64f` and `0x02a679`.
  Those are the same two `OpenModule` call sites already decoded as the `'MIDI'` and
  `'SCSI'` `ConnectToPlug(...)` invocations.
  Interpretation:
  there is no broader ordinary pattern of code passing the `+0xa20` callback field by
  address around the recovered resource. The visible by-address use of that field is
  still confined to `OpenModule`'s socket bring-up path, which further narrows the
  missing install edge upstream rather than sideways.

- Finding 103: the exact `CMESAEditor` constructor `jsr` targets are even stranger than
  the earlier approximate disassembly view suggested: two of them land in non-code
  descriptor/string territory.
  Evidence:
  raw bytes around file `0x05965f` show the constructor issuing these exact direct
  absolute calls in order:
  `4eb9 0002d6c8`, `4eb9 0002797c`, `4eb9 000287a8`, `4eb9 00031dc6`.
  Rechecking those exact targets against the raw binary shows:
  - `0x02d6c8` lands inside real code near the `Redraw__14CSamplerModuleFv` region,
    but not at a clean symbol boundary
  - `0x02797c` lands in dense structured table data, not executable-looking code
  - `0x0287a8` lands in the mangled-name/string band immediately before
    `GetPlugList__14CSamplerModuleFv`, not on the following code body at `0x0287c0`
  - `0x031dc6` lands in real code inside the later file/resource dispatch region
  Direct byte-count checks also show that `0x02797c` and `0x0287a8` are not merely
  incidental address bytes; both do appear in direct absolute `jsr` encodings elsewhere
  in the binary.
  Interpretation:
  even the constructor's explicit absolute-call surface is not a normal "all targets are
  helper functions" graph. In this binary, direct `jsr` targets can legitimately point
  into table/descriptor/string bands. That is a strong warning against assuming that the
  remaining install-edge question can be solved by ordinary function-call reconstruction
  alone.

- Finding 104: the non-code constructor target `0x02797c` is reused in another generic
  framework constructor pattern, which makes it look like shared registration/scaffolding
  rather than anything sampler-upload-specific.
  Evidence:
  direct absolute `jsr 0x02797c` appears at two sites in `sampler-editor-rsrc.bin`:
  one inside the `CMESAEditor` constructor sequence at `0x05968b`, and one inside
  `__ct__13LGrafPortViewFv` at `0x050b39`.
  The second site shows the same broad setup shape: nearby call to `0x02d6c8`, then the
  `0x02797c` call, followed by object-field stores and later framework-style calls.
  Raw bytes at `0x02797c` remain structured record data rather than executable-looking
  code, with recurring entries containing values like `PHP1` and nearby `GPOP` records.
  Interpretation:
  `0x02797c` is increasingly best read as generic framework descriptor/registration
  content reused across constructors, not a hidden sender-install helper. That further
  weakens the idea that the remaining install edge will yield to ordinary direct-call
  tracing alone.

- Finding 105: once the exact `CMESAEditor` constructor callees are corrected, none of
  them currently look like a dedicated live-sender install helper.
  Evidence:
  the exact constructor call set from raw bytes is:
  `0x02d6c8`, `0x02797c`, `0x0287a8`, `0x031dc6`.
  Current direct evidence for those targets is:
  - `0x02797c`: shared descriptor/registration data reused from `LGrafPortView`
  - `0x0287a8`: mangled-name/string band immediately before `GetPlugList`
  - `0x02d6c8`: real code, but heavily reused and adjacent to the `Redraw` region rather
    than a narrow install/setup symbol boundary
  - `0x031dc6`: real code inside the later file/resource dispatch neighborhood that
    checks markers like `SMDB` and `SS30`
  Interpretation:
  after correcting the exact target addresses from raw bytes, the constructor surface
  actually looks less like a sender-install path than before. It resolves into generic
  scaffolding, descriptor/string bands, reused UI/framework code, and file/resource
  dispatch. The remaining install edge is therefore still more likely to be nonliteral,
  table-driven in another layer, or outside the recovered resource graph.

- Finding 106: the two remaining "real code" constructor callees separate cleanly into
  generic framework scaffolding (`0x02d6c8`) and file/resource dispatch (`0x031dc6`).
  Evidence:
  direct absolute `jsr 0x02d6c8` appears at least 22 times across the binary, including
  the `CMESAEditor` constructor, `LGrafPortView` constructor, and many other
  constructor/setup-shaped regions with the same broad pattern: copy object-relative
  blocks, call `0x02d6c8`, then store multiple object fields and continue with generic
  framework calls. The target sits in real code near the `Redraw__14CSamplerModuleFv`
  region, but its heavy reuse and surrounding call shapes make it look like shared
  framework/UI scaffolding rather than a narrow sender-install routine.
  By contrast, direct absolute `jsr 0x031dc6` appears only once in the current binary:
  the `CMESAEditor` constructor sequence. The target itself sits in the already-traced
  later file/resource dispatch region that checks markers like `SMDB`, `SS30`, and
  `PROG`, then routes into helper calls in that same document/resource-handling layer.
  Interpretation:
  the two "real code" members of the exact constructor call set do not rescue the
  install-edge hypothesis. One is broad, generic scaffolding reused across framework
  setup; the other is a unique entry into the file/resource dispatch layer. That leaves
  the whole explicit constructor call surface looking accounted for without exposing a
  dedicated sender-install helper.

- Finding 107: `0x02d6c8` is not just reused often; it sits in a highly regular
  constructor scaffold pattern across many classes.
  Evidence:
  direct absolute `jsr 0x02d6c8` appears in repeated setup sequences with a stable
  shape. Typical callsites look like:
  `moveal this, a0; moveal this+disp, a0/slot; store object-relative block(s);
  push or pass the selected subobject pointer; jsr 0x02d6c8; then store multiple
  object fields such as +0x04, +0x82, +0x86, +0xd0`.
  This same pattern appears in the `CMESAEditor` constructor, `LGrafPortView`
  constructor, and many other setup-looking regions at offsets such as
  `0x034571`, `0x035317`, `0x037681`, `0x03b487`, `0x03ea8d`, `0x03f82d`,
  `0x0449bf`, `0x046e09`, `0x04f8f3`, `0x050b1f`, and `0x0514bf`.
  The 16-byte pre-call windows are often near-identical except for the object-relative
  displacement being wired into the scaffold.
  Interpretation:
  `0x02d6c8` now looks like a shared constructor/registration initializer operating on
  per-object descriptor blocks or subobjects, not a narrow sender-install helper. That
  makes it a framework mechanism that many classes reuse during setup, which is exactly
  the opposite of the specialized install edge we are looking for.

- Finding 108: the shared scaffold helper `0x02d6c8` is callback-aware: inside its own
  body it loads `object+0xa20` and indirect-calls it.
  Evidence:
  raw bytes in the target body at `0x02d6dc-0x02d6e2` are:
  `20 6a 0a 20 4e 90`, i.e. `moveal object@(0xa20),%a0; jsr %a0@`.
  The same `+0xa20` field is already independently matched elsewhere in the binary as
  the generic `CMESAEditor` callback sink used by `DoMESACommand`, `BusyCursor`,
  `BarCursor`, and the two `OpenModule -> ConnectToPlug` by-address passes.
  The helper still remains broadly reused across many constructor/setup-shaped regions,
  including `CMESAEditor` and `LGrafPortView`.
  Interpretation:
  `0x02d6c8` is not the installer for the callback sink, but it does participate in the
  callback-aware framework layer that consumes it. That means the owner boundary is
  close to this generic scaffold machinery, yet still not explained by it: the helper
  assumes `+0xa20` is already available rather than installing it itself.

- Finding 109: the repeated scaffold callsites do not themselves manipulate `+0xa20`;
  the callback sink only appears inside the shared helper body.
  Evidence:
  across all observed `jsr 0x02d6c8` scaffold callsites, bounded scans of the caller
  windows out to at least `+/- 0x100` bytes found zero matches for the known direct
  `+0xa20` signatures:
  `216e000c0a20` (setter write),
  `206a0a20` (load/call),
  `4aaa0a20` (tst),
  `2f2a0a20` (pea by-address pass).
  By contrast, the target body at `0x02d6dc-0x02d6e2` contains the direct `+0xa20`
  load-and-call sequence `20 6a 0a 20 4e 90`.
  Interpretation:
  the scaffold caller sites prepare object-relative blocks and descriptor/state fields,
  but the callback sink is encapsulated inside the shared framework helper rather than
  being manipulated directly in the surrounding callers. That pushes the remaining
  install edge further upstream of the whole repeated scaffold pattern.

- Finding 110: the remaining post-scaffold helper surface still does not bridge into
  `+0xa20` or the generic setter; it resolves into ordinary import/window/command flows.
  Evidence:
  the three immediate post-scaffold targets singled out by the constructor patterns were
  rechecked directly:
  - `0x031708` is the unique `CMESAEditor` post-scaffold target and lands at the end of
    a small helper just before the string/symbol `ImportProgram__14CSamplerModuleFv`,
    followed by code in the same import/file-handling neighborhood
  - `0x028cf0` sits in a command-heavy region carrying tags like `OPEN`, `SVST`,
    `SAVE`, `RNST`, `UALL`, `IPST`, and `EXST`
  - `0x02b228` lands in the string/symbol band for window-management routines such as
    `DoDeleteWindow__14CSamplerModuleFP20MESADeleteWindowData` and
    `DoResizeWindow__14CSamplerModuleFP20MESAResizeWindowData`
  bounded signature scans around all three targets found no matches for the known
  `+0xa20` direct-use signatures and no direct absolute-call encoding for
  `SetCommandProc` (`4eb9 000286f3`).
  Interpretation:
  once control leaves the generic scaffold helper, the visible next-layer helpers still
  resolve into ordinary program import, window management, or command/file-flow
  territory. They do not expose a local bridge into the callback install edge either.

- Finding 111: the descriptor roots feeding the scaffold layer are themselves tightly
  clustered in generic setup/cache plumbing rather than spread across upload logic.
  Evidence:
  the `0xce28` root used by the `CMESAEditor` constructor sequence appears only at a
  small cluster of sites in the current binary:
  `0x28221`, `0x2822b`, `0x2828b`, `0x28625`, `0x28645`, plus one far-out unrelated
  occurrence.
  The nearby `0xce24` root likewise appears in the constructor/cached-helper surface at
  `0x28553`, `0x28745`, `0x28787`, and `0x28791`, then a few unrelated later sites.
  In context, those roots sit in constructor/destructor/setup and cached-helper code:
  the `0xce28` sites are in the `main`/constructor and destructor-adjacent region around
  `CSamplerModule`, while the `0xce24` sites are in the earlier constructor and
  `GetPlugList`/helper-cache path.
  Interpretation:
  the visible record roots feeding the scaffold and cache layers still look like generic
  framework state anchors, not sender-specific install data. That is another reason to
  treat the remaining install edge as upstream/nonliteral rather than buried in the
  local descriptor constants themselves.

- Finding 112: the far-out `0xce24` / `0xce28` occurrences also stay in generic
  framework/UI territory rather than opening a new sender path.
  Evidence:
  rechecking the nonlocal occurrences of these roots shows:
  - `0x041052`, `0x0410d4`, `0x041156`: `0xce24` embedded immediately before symbol
    strings like `SelectAllPrograms__16CSamplerDiskViewFUc`,
    `SelectAllSamples__16CSamplerDiskViewFUc`, and
    `SelectAllMisc__16CSamplerDiskViewFUc`
  - `0x04e398`: `0xce24` immediately before the `DoDraw__12CAboutDialogFv` symbol band
  - `0x07b212`: `0xce24` appears in what looks like a dense index/table region, not
    code
  - `0x075b8b`: the lone far-out `0xce28` occurrence also sits in a structured table
    region with mixed constants and address-like entries, not executable-looking code
  direct absolute-call counts to these far-out addresses are zero or incidental, and the
  surrounding bytes do not reveal a bridge into `+0xa20` or `SetCommandProc`.
  Interpretation:
  even the nonlocal descriptor-root occurrences keep reinforcing the same model:
  `0xce24` / `0xce28` are generic framework state or indexing anchors that recur in UI,
  disk-view, and table/index contexts. They do not open a new visible install path for
  the live sender.

- Finding 113: the dense far-out table at `0x07b212` resolves into explicit non-code
  UI/resource descriptor blocks, not a hidden callback-install or sender path.
  Evidence:
  direct byte reads show the `0x07b212` region is a repeated fixed-structure table whose
  rows contain longword payload targets like `0x0001ce24`, `0x0001ce52`, `0x0001ce80`,
  and `0x0001ceae`, not the local constructor-era root `0x0000ce24`.
  The referenced payloads around `0x01ce24` through `0x01d040` are dense structured
  records with repeated word patterns such as `000c 000a 0001 ... 0009 ... 002a 0002`
  and no ordinary m68k function markers. Nearby strings in the same target range include
  sampler UI/help text like `3rd loop length.`, `loop dwell 3`, and
  `Dwell time of 3rd loop, 0=no loop,9999=hold`.
  The surrounding `0x07ba41+` string table is likewise menu/editor facing
  (`Sampler Suite`, `Edit`, `Import`, `Windows`, `Sampler`, `Filter 1`, `LFO 1`,
  `FX Labels`, `Sampler Editor`), which matches a resource catalog or UI descriptor map
  rather than executable setup logic.
  Interpretation:
  the last far-out table/index layer still visible from the recovered resource graph is
  now better understood as a record table into UI/resource descriptor payloads. That
  makes it a stronger exclusion boundary: this layer is not a plausible owner-side
  callback installer for `+0xa20` and does not weaken the current conclusion that the
  remaining install edge is higher/nonliteral or outside the recovered graph entirely.

- Finding 114: the lone far-out `0x0000ce28` table occurrence also resolves back into
  generic object-lifecycle metadata rather than a new callback-install path.
  Evidence:
  the structured record around `0x075b8b` carries the same helper/address family already
  observed directly in the `CSamplerModule` constructor/main/destructor neighborhood:
  `0x000273fa`, `0x000317dc`, `0x0002d6f6`, and `0x0000ce28`.
  Those same values appear in the live code path around `0x028221-0x028245` and
  `0x028625-0x02864f`, where `main` / constructor / destructor-adjacent code uses
  `0x0000ce28` with the shared scaffold/helper sequence rather than any sender-specific
  callback installer. The far-out table therefore does not introduce a new target set;
  it re-encodes the same generic lifecycle/helper family already classified from direct
  code.
  Interpretation:
  the last visible far-out `0xce28` site is better read as framework lifecycle metadata
  for the existing scaffold/helper surface, not as a separate owner-side boundary for the
  live sender install edge.

- Finding 115: the ordinary recovered `sampler-editor-rsrc.bin` graph is now effectively
  exhausted as a source for a direct owner-side callback-install path into `+0xa20`.
  Evidence:
  the visible static layers have now been reduced from multiple directions without
  exposing a bridge into `SetCommandProc` / `InitModule` beyond the generic setter body:
  - literal scans do not reveal direct call, pointer, or ordinary store trails into
    `0x0286f3`
  - the exact `CMESAEditor` constructor call surface is fully accounted for as shared
    scaffolding, descriptor/string bands, or file/resource dispatch
  - the shared scaffold helper `0x02d6c8` consumes `+0xa20` but does not install it
  - repeated scaffold callers do not manipulate `+0xa20`
  - immediate post-scaffold helpers stay in import/window/command territory
  - the constructor/tag/resource branch rooted at `0x287ee` resolves to document/resource
    plumbing rather than transport or callback setup
  - the far-out `0x07b212` and `0x075b8b` table exceptions now reduce to UI/resource
    descriptor catalog data and lifecycle metadata, not fresh owner-side surfaces
  Interpretation:
  on the current primary artifacts, there is no remaining ordinary in-resource path that
  plausibly yields the live sender install edge. The residual possibilities are now
  narrower and more explicit: either the handoff is nonliteral/table-driven in a deeper
  framework layer than the recovered graph exposes, or the decisive install behavior lies
  outside the recovered resource entirely.

- Finding 116: the `CMESAEditor` constructor-call surface needs a base-corrected
  reinterpretation: it contains five real direct-call targets, not four, and several of
  the previously dismissed targets are ordinary PowerPlant code rather than
  descriptor/string bands.
  Evidence:
  direct bytes at file `0x0596fb` show a fifth absolute call
  `4e b9 00 02 7e 00`, i.e. `jsr 0x00027e00`, immediately before the A-trap at
  `0x059701`. Using the EDIT-relative base implied by the static vtable entry check
  below (`0x027f57`), the constructor-era call targets resolve to:
  - `0x02797c -> file 0x04f8d3`, whose bytes begin `4e56 0000 48e7 0030`
  - `0x027e00 -> file 0x04fd57`, whose bytes begin `4e56 0000 2f0a 246e`
  - `0x0287a8 -> file 0x0506ff`, whose bytes begin `4e56 0000 2f0a 246e`
  - `0x02d6c8 -> file 0x05561f`, whose bytes begin `226f 0004 41ec 00f8`
  - `0x031dc6 -> file 0x059d1d`, whose bytes begin `4e56 0000 2f0a 246e`
  Interpretation:
  this directly refutes Codex's earlier claim that `0x02797c` and `0x0287a8` landed in
  data/string territory. The constructor surface is still framework-heavy, but it is
  more ordinary code than the prior parity pass allowed.

- Finding 117: the editor-side reply path is now better modeled as compile-time
  vtable-bound inside the recovered graph, which materially weakens the earlier Codex
  "outside the recovered resource graph" framing for this specific boundary.
  Evidence:
  the static table at file `0x071a1f` contains an entry at file `0x071a53` with value
  `0x0003194e`. Using the same EDIT base `0x027f57`, that target resolves to
  file `0x0598a5`, whose bytes begin `4e56 fff2 48e7 1c30`, i.e. clear function code,
  immediately before the `DoMESACommand__11CMESAEditorFP11MESACommand` symbol band.
  Combined with Finding 116's corrected constructor-target decoding, this supports
  Claude's newer Path A/A.5 model that the embedded socket reply handler is statically
  bound through a vtable path rather than discovered through a runtime install event.
  Interpretation:
  the "ordinary recovered graph is exhausted" conclusion was too broad. It still holds
  for the narrow `+0xa20` direct-install hunt, but not for the full editor-side reply
  path. The remaining static frontier is now the compile-time socket/vtable path and the
  plug-side slot family it reaches, not a missing runtime install moment.

- Finding 118: the plug-side reply callback at `scsi-plug` `$11fe` is read from
  `plug_slot[+0]`, and that field is installed by `CMESAPlugIn::ConnectToSocket` as a
  verbatim copy of `SocketInfo[+0]`.
  Evidence:
  direct bytes at `scsi-plug` file `0x11f6-0x11fe` show the exact call-through sequence
  Claude highlighted earlier:
  `486e ffe6 2045 2050 4e90`, i.e. push local arg, load `D5` as slot pointer, load
  `(A0)` into `A0`, then `jsr (A0)`. That is a call through `plug_slot[+0]`, not
  `plug_slot[+12]`.
  The install side matches too: `CMESAPlugIn::ConnectToSocket` at file `0x09fc-0x0a1e`
  computes `this + 0x3c + 46*n` and then performs a straight copy loop beginning
  `43d3 20d9 20d9 ... 30d9`, i.e. copy the incoming 46-byte `SocketInfo` into the slot
  verbatim. `GetSockets` at file `0x0b98-0x0ba6` returns `this+0x38`, which matches the
  slot-iterator path at file `0x1170+` that reads vtable[+24], receives `this+56`, then
  iterates 46-byte records from `+60`.
  Interpretation:
  this corrects the older Codex/Claude conflation around `SocketInfo[+12]`. The plug-side
  callback slot used by `$11fe` is `SocketInfo[+0] -> plug_slot[+0]`. So the next static
  question is no longer "where is `SocketInfo[+12]` installed?" but "what editor-side
  function address is transmitted as `SocketInfo[+0]` in the `CONS` payload?"

- Finding 119: the apparent `ConnectToPlug` / `$11fe` conflict dissolves cleanly once the
  editor-side path is split into its measured `PLST` and `CONS` phases: the editor first
  iterates 48-byte plug descriptors, then separately ships its own 46-byte `SocketInfo`
  payload.
  Evidence:
  `CMESASocket::ConnectToPlug` at file `0x059e91` copies a 10-byte command block from the
  high A4 string table, and the adjacent raw bytes in `sampler-editor-rsrc.bin` contain
  exactly the paired records `CONS` and `PLST` in that order:
  `... 43 4f 4e 53 ... 50 4c 53 54 ...`.
  The first copied block is the later `PLST` record, then the function calls the immediate
  handler callback at `0x059eab`, receives a descriptor-array pointer in `fp@(-4)`, and
  iterates entries using a 48-byte stride (`moveq #48`, `mulsw %d3,%d0`).
  In that descriptor phase, `descriptor[+12]` is tested and, if non-null, called at
  `0x059f1f`; when a matching entry is accepted, the editor copies 12 longs beginning at
  `entry+4` into its own local slot storage at `this+74`, so the editor-local function
  field becomes `editor_slot[+8] = descriptor[+12]`.
  Later, at file `0x059ed1`, the function copies the earlier 10-byte `CONS` record into a
  second local command block, stores `this+24` into `fp@(-8)` at `0x059ee5`, and then
  invokes `descriptor[+12]` with that `CONS` command. On the plug side,
  `CMESAPlugIn::ConnectToSocket` at file `0x09fc-0x0a1e` verbatim-copies a 46-byte
  `SocketInfo` into `plug_slot`, making `plug_slot[+0] = SocketInfo[+0]`.
  Interpretation:
  the two binaries are handling two different structures on opposite sides of the same
  exchange. The editor's `PLST` phase consumes 48-byte plug descriptors and installs
  `descriptor[+12]` into editor-local socket slots; the later `CONS` phase sends the
  editor's own 46-byte `SocketInfo`, whose first long becomes `plug_slot[+0]` and is the
  callback used at `$11fe`. So `descriptor[+12] -> editor_slot[+8]` and
  `SocketInfo[+0] -> plug_slot[+0]` are complementary measured flows, not contradictory
  claims.

- Finding 120: the first concrete post-ctor writer to `CMESASocket[+12]` is
  `CMESASocket::AcceptData`, and it writes reply/result state there rather than anything
  callback-like.
  Evidence:
  `CMESASocket::AcceptData` at file `0x05a1e1` loads `this` into `A2` and `IP_Data*`
  into `A3`. In the successful branch, after checking `this[+8]` and validating the
  incoming length against `this[+16]`, it copies the payload from `IP_Data[+4]` into the
  buffer at `this[+8]`, then stores `IP_Data[+8]` into `this[+12]` at file `0x05a20b`,
  and stores the transferred length into `this[+4]` at file `0x05a211`. In the failure
  branch, it stores the literal `OVER` into `this[+12]` at file `0x05a217-0x05a21d` and
  returns error `-11005`.
  The constructor had previously only cleared `this[+8]` and did not seed `this[+12]`
  with any function pointer.
  Interpretation:
  this makes `CMESASocket[+12]` look like reply/result state associated with the
  receive-buffer path, not like the live callback field used by the plug-side `$11fe`
  indirect call. That independently strengthens the newer Path A model: the callback
  question remains focused on `SocketInfo[+0]`, while `SocketInfo[+12]` now looks more
  like data/reply bookkeeping on the editor side.

- Finding 121: within the currently recovered `CMESASocket` method surface, there is
  still no direct overwrite of `this+24`; the only concrete value Codex has for that
  field remains the constructor seed at embedded-socket `+24`.
  Evidence:
  `CMESAEditor` constructor writes `0x212` into editor `this+0x8c` at file `0x0596e7`
  through `0x0596ed`, and embedded `CMESASocket` starts at editor `this+0x74`, so that
  store is the first concrete value for socket `this+24`.
  A bounded objdump scan over the recovered socket-method range
  `0x059d1d-0x05a22d` (`CMESASocket::ctor`, `SetBuffer`, `ConnectToPlug`, `SelectPlug`,
  `ActivateThisSocket`, `SendData`, `AcceptData`) shows only address calculations using
  `+24`, e.g. `lea %a0@(24),%a0` in `ConnectToPlug`; it does not expose a direct
  `move* -> this@(24)` overwrite in that method set.
  A direct byte-pattern search for the exact ctor-side store sequence
  `41f9000002122548008c` finds only the constructor site at file `0x0596e7`, and the
  exact longword-store opcode family `2548008c` likewise appears only at file `0x0596ed`
  in the current primary artifact search.
  Interpretation:
  this is now a real pressure point on any overly literal reading of
  `CONS -> this+24 -> SocketInfo[+0]`. Codex has not disproved that path, but the
  currently recovered socket methods do not yet show where a callback-like function
  pointer would replace the ctor-seeded value. So the next useful question is whether
  the `CONS` payload is transformed through another layer before the plug sees it, or
  whether the overwrite happens outside the currently recovered socket-method surface.

- Finding 122: the constructor-seeded value at embedded-socket `+24` resolves to a real
  callback-shaped function at file `0x028169`, making it the strongest current static
  candidate for `SocketInfo[+0]` if the `CONS` payload exposes raw `this+24`.
  Evidence:
  `CMESAEditor` constructor writes EDIT-relative `0x212` into editor `this+0x8c` at
  file `0x0596e7-0x0596ed`, and embedded `CMESASocket` starts at editor `this+0x74`, so
  that is socket `this+24`.
  With the current EDIT base `0x027f57`, `0x212` resolves to file `0x028169`.
  Raw bytes at file `0x028169` begin:
  `4e 56 00 00 48 e7 1c 30 24 6e 00 08 4e b9 00 00 01 04 ...`, i.e. a valid
  `link`-prologue function entry that takes one stack argument (`fp@(8)`) and
  immediately performs the THINK C world-setup call at `0x0104`.
  The same body then reads the incoming struct's first long and compares it against the
  literal `INIT` at file `0x02817d-0x028185`.
  A direct byte-pattern search still finds the ctor store as the only exact longword
  write currently known for embedded-socket `+24`.
  Interpretation:
  Codex cannot yet promote `0x028169` to a proved `SocketInfo[+0]` identity, because the
  exact editor-side `CONS` packing/routing layer is still not fully matched and the
  plug-side `CONS` arm mapping remains one step short of body-decoded proof. But this is
  now the strongest concrete callback candidate in the recovered graph: a real function,
  stored exactly where the current `CONS -> this+24` model points, with a callback-style
  single-argument entry shape.

- Finding 123: the inline selector table inside `CMESAPlugIn::DoMESACommand` directly
  resolves `CONS` to the `0x090c` `SocketInfo` arm and `ASOK` to the `0x0924`
  `SocketInfo` arm.
  Evidence:
  raw bytes at file `0x089a-0x099e` show `CMESAPlugIn::DoMESACommand` calling helper
  `0x0148`, then embedding a selector table that begins with default offset `0x00d6`
  followed by tag/offset records:
  `AQUT 0x0006`, `ASOK 0x0052`, `CLSM 0x0096`, `CONS 0x002e`, `IDEN 0x0068`,
  `OPNM 0x0052`, `SEND 0x0002`.
  Those offsets are relative to the offset-word location itself, so the table lands on:
  `ASOK @ 0x08d2 + 0x0052 = 0x0924` and
  `CONS @ 0x08de + 0x002e = 0x090c`.
  The arm at `0x090c` pushes `MESACommand[+6]` and `this`, then dispatches through
  vtable offset `+0x30`; the arm at `0x0924` pushes the same `(this, MESACommand[+6])`
  pair and dispatches through vtable offset `+0x34`.
  The callee bodies remain anchored by their adjacent symbol strings:
  `ConnectToSocket__11CMESAPlugInFP10SocketInfo` begins at file `0x09d2`, and
  `ActivateSocket__11CMESAPlugInFP10SocketInfo` begins at file `0x0a5e`.
  Interpretation:
  Codex no longer needs to infer the `CONS` versus `ASOK` arm mapping from the broader
  combined model. The selector table itself now proves the routing:
  `CONS -> 0x090c -> vtable+0x30 -> ConnectToSocket(SocketInfo*)`, and
  `ASOK -> 0x0924 -> vtable+0x34 -> ActivateSocket(SocketInfo*)`.
  That materially strengthens the current `SocketInfo[+0]` frontier: if the editor-side
  `CONS` payload exposes raw embedded-socket `this+24`, then the plug-side path that
  copies it into `plug_slot[+0]` is now directly matched.

- Finding 124: the SRAW-specific body in `CSCSIPlug::SendData` does not visibly
  construct outbound CDB bytes inline before the shared `0x106e` sender call; instead it
  packages higher-level arguments and hands them to the shared sender entry.
  Evidence:
  `m68k-elf-objdump` of file `0x0ec0-0x1072` shows the SRAW branch beginning at
  `0x0f40` with `cmpil #'SRAW', %a3@(8)`. On the matching path, the code pushes seven
  values and then calls `jsr 0x106e` at `0x0f60`:
  `pea %fp@(-30)`, `movel %a3@,-(sp)`, `movel %a2@(0x0e3c),-(sp)`, `movel %d6,-(sp)`,
  `moveb #1,-(sp)`, `movew %a2@(0x0d6e),-(sp)`, `movel %a2,-(sp)`.
  No inline `move.b #0x0c,...`, no direct stores into a local CDB buffer, and no
  nibble-expansion loop appear in that measured SRAW path before the shared sender call.
  By contrast, the immediately adjacent non-`SRAW` path at `0x0f70-0x103e` inspects
  bytes in the buffer pointed to by `%d6` (`cmpib #-16,%a0@`, `cmpib #71,%a0@(1)`,
  `cmpib #72,%a0@(4)`), extracts four 7-bit fields from offsets `11..14`, rebuilds a
  length value in `%fp@(-38)`, doubles it into `%fp@(-30)`, and only then calls
  `jsr 0x106e`.
  Interpretation:
  Codex still does not have the final outbound wire bytes for SRAW, because the live
  sender behind `0x106e` remains unresolved. But the pre-`0x106e` body now supports a
  sharper negative claim: the measured SRAW-specific branch is not doing visible
  inline CDB-byte assembly or header nibble-repacking itself. The more structured
  byte-level inspection and derived-length logic live in the neighboring non-`SRAW`
  path, which makes the SRAW branch look more like a rawer higher-level send shape
  handed off to the shared sender rather than a local mirror of the BULK builder.

- Finding 125: `0x1072` is a wrapper over the shared sender path, not a distinct final
  emitter; it derives transient send-state flags from the source buffer and then calls
  back into `0x106e` with the same seven-argument shape.
  Evidence:
  `m68k-elf-objdump` of file `0x1072-0x10c2` shows `0x1072` starting by copying
  `%a3@(4)` into `%fp@(-46)`, setting `%a2@(0x0e46) = 1`, testing bit 7 of the first
  byte at that source pointer (`btst #7,%a0@`), and then mirroring the result into
  `%a2@(0x0e47)`.
  After that state setup, the wrapper pushes the same six core arguments seen in the
  measured SRAW branch plus a source pointer from `%fp@(-46)` and calls `jsr 0x106e`
  at `0x10b2`:
  `pea %fp@(-30)`, `movel %a3@,-(sp)`, `movel %a2@(0x0e3c),-(sp)`,
  `movel %fp@(-46),-(sp)`, `moveb #1,-(sp)`, `movew %a2@(0x0d6e),-(sp)`,
  `movel %a2,-(sp)`.
  On return, it stores `%d0` in `%d3`, clears `%a2@(0x0e46)`, unwinds the 24-byte
  call frame, and branches into the shared post-send path at `0x1160`.
  Interpretation:
  this wrapper is not a separate static answer to the outbound-SRAW question. It is a
  flag-setting prelude around the same unresolved shared sender contract. The useful
  narrowing is that the shared path already supports at least two closely related call
  shapes: one taking `%d6` as the payload/source pointer, and one taking `%a3@(4)` via
  the `0x1072` wrapper, with two transient state bytes at `+0x0e46/+0x0e47` carrying
  per-send metadata derived from the first source byte.

- Finding 126: the shared `0x106e` sender contract is already fed by at least four
  distinct caller families inside `SendData`, not just the measured `SRAW` path.
  Evidence:
  `m68k-elf-objdump` of file `0x0ec0-0x1160` shows six direct `jsr 0x106e` call sites at
  `0x0f60`, `0x0fbc`, `0x102c`, `0x10b2`, `0x10f8`, and `0x1144`.
  These collapse into four measured argument families:
  `0x0f60`: SRAW-tagged path using `%d6` plus mode byte `#1`;
  `0x0fbc`: sibling path using `%d6` plus mode byte `#0`;
  `0x102c`: derived-length path using `%d6`, a zero long in the third payload slot, and
  post-call length doubling into `%fp@(-30)`;
  `0x10b2` / `0x10f8` / `0x1144`: wrapper-driven variants using `%a3@(4)` as the source
  pointer, with `0x1072` adding transient state bytes at `+0x0e46/+0x0e47`.
  All four families converge on the same post-send/report block at `0x1160`, which then
  walks the callback list and labels the reply/report block as `SYSX` or `SRAW`.
  Interpretation:
  the unresolved static question at `0x106e` is broader than “what does the SRAW call
  emit?” The shared sender already acts like a central emission contract for multiple
  send shapes. That makes the remaining unknown more likely to be a small parameterized
  send engine than a one-off SRAW helper.

- Finding 127: those four caller families still share one measured seven-slot argument
  layout into `0x106e`; the branch-local differences are concentrated in mode/source/
  context fields rather than in wholly different call contracts.
  Evidence:
  direct `objdump` of file `0x0f40-0x1144` shows every `jsr 0x106e` site pushing the
  same outer frame shape:
  callee `arg0` = `self` (`movel %a2,%sp@-`);
  `arg1` = selected-target word from `CSCSIPlug+0x0d6e`;
  `arg2` = one-byte mode flag (`#1` or `#0`);
  `arg3` = source pointer (`%d6` or `%a3@(4)`);
  `arg4` = context long (`CSCSIPlug+0x0e3c` or zero);
  `arg5` = `%a3@` long;
  `arg6` = `pea %fp@(-30)` output-length pointer.
  The measured branch differences are:
  `0x0f60`: mode `#1`, source `%d6`, context `CSCSIPlug+0x0e3c`;
  `0x0fbc`: mode `#0`, source `%d6`, context `CSCSIPlug+0x0e3c`;
  `0x102c`: mode `#0`, source `%d6`, context `0`;
  `0x10b2`: mode `#1`, source `%a3@(4)`, context `CSCSIPlug+0x0e3c`;
  `0x10f8`: mode `#0`, source `%a3@(4)`, context `CSCSIPlug+0x0e3c`;
  `0x1144`: mode `#0`, source `%a3@(4)`, context `0`.
  Interpretation:
  `0x106e` now looks less like an opaque one-off jump target and more like a stable
  central send routine with a fixed caller contract. The highest-value static question
  is no longer “which branch reaches `0x106e`?” but “what concrete wire semantics are
  encoded by mode byte, source-pointer family, and the nullable context long?”

- Finding 128: `IP_Data[+12]` is the front-end target-selection key used by
  `CSCSIPlug::SendData` to choose `CSCSIPlug+0x0d6e` before any branch-specific send
  logic runs.
  Evidence:
  `SendData__9CSCSIPlugFP7IP_Data` starts by clearing `CSCSIPlug+0x0d6e`, then looping
  over connected entries with `i` in `%d4`. For each entry it loads a per-entry long
  from `self@(62 + 46*i)` at file `0x0e10`, compares it against `%a3@(12)` at
  `0x0e14-0x0e18`, and on match writes a per-entry word from the `0x0d72`-rooted table
  into `self@(0x0d6e)` at `0x0e24-0x0e28`. If no match is found, `SendData` returns
  `-14000` immediately from `0x0e3c-0x0e40`.
  Interpretation:
  whatever `IP_Data[+12]` semantically names, it is not part of the later `0x106e`
  caller-family split. It is the earlier dispatch key that selects the active target
  word used by every downstream send shape. That makes `IP_Data[+12]` a measured
  routing field, while the remaining `0x106e` unknowns stay concentrated in mode/source/
  context and the persistent `%a3@` long.

- Finding 129: `IP_Data[+0]` is the payload-length field, which means the persistent
  `%a3@` slot in every `0x106e` caller family is carrying byte count, not an opaque
  descriptor pointer.
  Evidence:
  `CMESASocket::AcceptData` at file `0x05a1e1` loads `IP_Data*` into `%a3`, then:
  compares `%a3@` against `this@(16)` at `0x05a1f7-0x05a1fd`,
  uses `%a3@(4)` as source pointer and `%a3@` as copy length for trap `0xa02e` at
  `0x05a1ff-0x05a209`,
  stores `%a3@(8)` into `this@(12)` at `0x05a20b`,
  and stores `%a3@` into `this@(4)` at `0x05a211`.
  Combined with the measured `SendData` frame layout, where every direct `jsr 0x106e`
  site pushes `%a3@` in the same argument slot, this now identifies that live-in field
  as payload length / byte count.
  Interpretation:
  the stable `0x106e` frame is now materially decoded:
  target word, mode byte, source pointer, nullable context long, and byte count are all
  visible from primary artifacts. The remaining semantic unknowns are narrower than
  before: chiefly the exact meaning of the mode byte, the nullable context long, and how
  those drive wire emission inside or beyond the shared sender.

- Finding 130: the nonzero context long in the shared `0x106e` frame is always the same
  constructor-seeded `CSCSIPlug+0x0e3c` value, which the post-send/report block later
  reuses as its transport/root discriminator.
  Evidence:
  `CSCSIPlug::__ct__` at file `0x0bc6-0x0c6e` allocates `0x8000` bytes into
  `CSCSIPlug+0x0e38`, then copies the first longword of that allocation into
  `CSCSIPlug+0x0e3c`.
  The measured `0x106e` caller families only ever pass `arg4 = CSCSIPlug+0x0e3c` or
  `arg4 = 0`.
  Separately, the shared post-send/report block at `0x1160-0x11d4` stores
  `CSCSIPlug+0x0e3c` into a local report block and then tests the first byte at that
  address to choose the reply tag `SYSX` versus `SRAW`.
  Interpretation:
  the nullable `arg4` field is no longer just “some context long.” In its nonzero form
  it is a plug-local transport/root value seeded at construction time and reused by the
  report path as the data source for protocol-flavor discrimination. The remaining
  sender-side semantic unknowns are therefore tighter still: chiefly the exact role of
  the mode byte, and what semantic difference `arg4 = 0` versus `arg4 = CSCSIPlug+0x0e3c`
  causes inside or beyond the shared sender.

- Finding 131: mode byte `#1` is only observed together with the nonzero
  `CSCSIPlug+0x0e3c` context, while zero-context sends are only observed inside a subset
  of mode-`#0` branches that do extra branch-local work around `0x106e`.
  Evidence:
  the measured direct `0x106e` sites are:
  `0x0f60`: mode `#1`, context `CSCSIPlug+0x0e3c`;
  `0x0fbc`: mode `#0`, context `CSCSIPlug+0x0e3c`;
  `0x102c`: mode `#0`, context `0`;
  `0x10b2`: mode `#1`, context `CSCSIPlug+0x0e3c`;
  `0x10f8`: mode `#0`, context `CSCSIPlug+0x0e3c`;
  `0x1144`: mode `#0`, context `0`.
  The zero-context sites are not arbitrary copies of the other branches:
  `0x102c` is the derived-length path that reconstructs length from source bytes
  `11..14` and doubles the returned out-length afterward;
  `0x1144` is the wrapper-driven variant that is surrounded by `0x0ca2` gating before
  and after the send.
  Interpretation:
  this does not yet decode the exact meaning of the mode byte, but it does constrain the
  contract: mode `#1` currently implies the nonzero `+0x0e3c` transport/root context,
  while `arg4 = 0` is a narrower subcase inside mode `#0`, associated with branches that
  perform additional branch-local processing around the shared send engine.

- Finding 132: `CSCSIPlug+0x0e40` is the front-door gate that decides whether
  `SendData` takes the wrapper/source-pointer family at `0x1072` or continues into the
  direct `%d6`/`SRAW` branch family.
  Evidence:
  at `0x0e9e-0x0ec4`, `SendData` tests `CSCSIPlug+0x0e40`; if it is zero, it invokes
  `0x0ca2(self, target, 1, 1)`, stores the returned byte into `+0x0e40`, and then tests
  `+0x0e40` again. If the byte is still zero, control branches directly to `0x1072`.
  Only when `+0x0e40` is nonzero does execution continue into the later `%d6`/`SRAW` path
  at `0x0ec8` onward. Separately, the earlier cold arm at `0x0e82-0x0e96` calls
  `0x0ca2(self, target, 0, 0)` and then clears `+0x0e40`, which matches the same field
  participating in ordinary control-plane setup rather than in the `0x106e` frame
  itself.
  Interpretation:
  the remaining sender-side split is not only “mode byte versus context.” There is one
  earlier branch gate too: `+0x0e40` selects whether `SendData` will use the wrapper/
  source-pointer family rooted at `0x1072` or the later direct `%d6` family. That makes
  `+0x0e40` a measured pre-send routing flag, while the still-open mode semantics stay
  downstream of that choice.

- Finding 133: `CSCSIPlug+0x0e40` has an extremely tight write surface: constructor
  reset, one cold-arm clear, and one `0x0ca2`-fed update in `SendData`. That makes it
  look like a sticky cached pre-send capability/state byte, not a general-purpose mode.
  Evidence:
  direct raw-byte search finds only five in-binary touches of `+0x0e40`:
  constructor clear at `0x0c56`,
  send-path tests at `0x0e9e` and `0x0ec0`,
  `0x0ca2`-fed store at `0x0eb8`,
  and cold-arm clear at `0x0e92`.
  The constructor clear sits beside the constructor's other persistent send-state resets
  for `+0x0e46/+0x0e47` and timeout seed `+0x0e42`, while the non-constructor writes all
  occur in the `SendData` front half.
  Interpretation:
  `+0x0e40` is unlikely to be a broad user-mode selector or generic plug setting. The
  current best static read is narrower: it is a sticky cached send-path capability/state
  byte that `SendData` consults and refreshes through `0x0ca2` before choosing wrapper
  versus direct sender family.

- Finding 134: the visible local instructions at the `0x0ca2` internal entry do not
  themselves consume the explicit `0/0` vs `1/1` caller arguments that `SendData` pushes
  before `jsr 0x0ca2`; any semantics for those flags must live deeper in the trap/helper
  layer, not in the recovered local code between `0x0ca2` and `0x0ccc`.
  Evidence:
  correcting the parent function alignment yields a real helper body at `0x0c8a`:
  `linkw #0; save %a2; load self from %fp@(8); null-check self; install vtable; load
  self@(0x0e38); trap 0xa02a; load self@(0x0e38); trap 0xa023; push 0 and self; jsr 0x274;
  tstw %fp@(12); optional jsr 0x1b56; return self in %a0`.
  The direct `SendData` call sites target the internal entry `0x0ca2`, not the aligned
  top of the function at `0x0c8a`. From that internal entry onward, the recovered local
  instructions reference only:
  `self@(0x0e38)`,
  the nested `jsr 0x274`,
  `%fp@(12)` in the caller's frame,
  and optional `jsr 0x1b56`.
  There is no explicit local read of the mode-like values that `SendData` pushes before
  calling `0x0ca2` (`0/0` in the cold arm, `1/1` in the active arm).
  Interpretation:
  this is a useful terminal narrowing for the `0x0ca2` path. The recovered local helper
  does not itself explain the `0/0` vs `1/1` distinction. So the remaining semantics of
  that pre-send gate most likely live in the deeper trap/helper layer (`0xa02a`,
  `0xa023`, `0x0274`, or `0x1b56`) rather than in any still-missed branch logic around
  the `0x0ca2` entry.

- Finding 135: the two named deeper callees under `0x0ca2` do not reopen an ordinary
  local-code explanation either: `0x0274` lands in the same low-address non-code band,
  while `0x1b56` is just a constructor-side internal entry.
  Evidence:
  direct `objdump` of file `0x0260-0x02b0` shows `0x0274` sitting in the dense
  low-address data-like region, with no credible function prologue/epilogue and the same
  non-code byte grammar seen elsewhere in low-memory/resource-style territory.
  Separately, `objdump` of file `0x1b40-0x1b80` shows `0x1b56` entering the already-known
  constructor-side helper family in the middle of a body, not at a standalone function
  boundary.
  Interpretation:
  the remaining `0x0ca2` semantics have now dropped below both the visible local helper
  surface and the obvious next two callees. That reinforces the current stopping-rule:
  if more meaning remains here, it is in the trap/nonlocal boundary, not in another
  missed ordinary helper body inside the recovered plug binary.

- Finding 136: the checked-in `scsi-plug.macbin` does not preserve an alternate sender
  stub image; its resource fork is byte-identical to the extracted `scsi-plug-rsrc.bin`,
  including the unresolved `0x106e` / `0x1070` region.
  Evidence:
  direct byte reads of
  `docs/1.0/001-IN-PROGRESS/akai-ux-improvement/mesa-ii-analysis/binaries/scsi-plug.macbin`
  show a MacBinary header with `data_fork_len = 0` and `rsrc_fork_len = 12053`.
  Slicing the resource fork from offset `128` yields a byte string that matches
  `binaries/scsi-plug-rsrc.bin` exactly across the full resource length.
  At the key sender-stub offsets, both copies contain the same bytes:
  `0x106e = 600000f0`
  `0x1070 = 00f02d6b`
  which is the same unresolved branch-plus-following-bytes already documented in the
  extracted resource.
  Interpretation:
  for the checked-in artifacts currently in the repo, the "bad extraction lost the real
  patched bytes" sub-hypothesis is eliminated. The remaining static possibilities are
  not "look at the MacBinary instead"; they are runtime patching, a different binary
  source, or some other nonlocal mechanism outside these two identical copies.

- Finding 137: the candidate sender body at `0x160c` is structurally consistent with the
  full measured `0x106e` caller frame, not just the SRAW arm, and its optional argument
  use fits the current `arg4 = 0` / `arg4 = +0x0e3c` split.
  Evidence:
  direct bounded `objdump` of file `0x160c-0x16d6` shows the candidate body reading:
  `self = %fp@(8)`,
  `channel = %fp@(12)`,
  `flag = %fp@(14)`,
  `source_ptr = %fp@(16)`,
  `optional_long = %fp@(20)`,
  `byte_count = %fp@(24)`,
  `out_ptr = %fp@(28)`.
  That matches the already measured seven-slot caller frame at all direct `jsr 0x106e`
  sites:
  `self`,
  `CSCSIPlug+0x0d6e`,
  mode/flag byte,
  source pointer,
  nullable context long,
  `IP_Data[+0]` byte count,
  `&fp@(-30)` output pointer.
  Inside the candidate body, `byte_count` is copied into `%d7` and split into three
  bytes for the outbound header at `0x1646-0x166c`; `flag` is tested at `0x1670` and
  converted into `0x80` versus `0x00`; and `optional_long` is not used in the primary
  bus-emission call at `0x1682-0x169a` but is tested afterward at `0x16a8` and only then
  passed into the follow-on helper call at `0x16ae-0x16bc`.
  Interpretation:
  this does not prove that `0x106e` is patched to `0x160c`, but it materially
  strengthens the candidate. The candidate body consumes exactly the argument structure
  that Codex has already measured at the `0x106e` call sites. It also gives the
  previously opaque nullable long a cleaner candidate meaning: not arbitrary sender
  context, but an optional post-send buffer/descriptor argument that is only live on one
  branch of the candidate body.

- Finding 138: the nested helper at `0x139a` strengthens that read further: the optional
  argument passed through the `0x160c` candidate behaves like a mutable length/control
  pointer, not a generic opaque sender context.
  Evidence:
  bounded `objdump` of file `0x139a-0x15dc` shows the helper reading:
  `self = %fp@(8)`,
  `channel = %fp@(12)`,
  `buffer_ptr = %fp@(14)`,
  `flag = %fp@(18)`,
  `count_ptr = %fp@(20)`.
  On the `flag != 0` branch at `0x13f4-0x14ec`, it dereferences `count_ptr` immediately,
  copies `*count_ptr` into local `-14`, tracks accumulated transfer bytes in local `-10`,
  repeatedly calls `SetSCSIMIDIMode(1)` plus the internal `0x1620` send entry, and then
  writes the accumulated byte count back through `count_ptr` at `0x14e2-0x14e8`.
  On the `flag == 0` branch at `0x1504-0x15da`, it zeroes `*count_ptr` first, repeatedly
  increments it by each returned chunk length, and again uses `0x1620` as the emission
  primitive.
  The same helper also gates on the already-known send-state cluster
  `+0x0e46/+0x0e47/+0x0e42`, including the timeout long at `+0x0e42`.
  Interpretation:
  if `0x160c` really is the runtime target behind `0x106e`, then its nullable long is
  best modeled as a pointer to mutable send-count/control state, not arbitrary sender
  context. That does not prove that the measured caller-family `arg4 = +0x0e3c` is
  exactly such a structure, but it does make the nonzero-vs-zero split more specific:
  nonzero `arg4` would enable a tracked follow-on send/readback path, while zero `arg4`
  would skip it entirely.

- Finding 139: `CSCSIPlug+0x0e3c` itself is now best modeled as a pointer-like control
  root, not merely an uninterpreted context long.
  Evidence:
  bounded `objdump` of the constructor body at `0x0c22-0x0c32` shows the only visible
  store to `+0x0e3c`:
  `moveal self@(0x0e38), %a0; ... ; movel %a0@, self@(0x0e3c)`.
  So `+0x0e3c` is populated from the first longword stored at the allocated
  `+0x0e38` block, not from an immediate scalar constant.
  The later observed uses are all pointer-like:
  at `0x11b8`, the post-send/report block does `moveal self@(0x0e3c), %a0` and then
  immediately tests the first byte at `%a0@` to choose `SYSX` versus `SRAW`;
  the measured nonzero `0x106e` caller families push `self@(0x0e3c)` in the same slot
  that the `0x160c` candidate body forwards into the `0x139a` helper's mutable
  `count_ptr` parameter;
  and `0x139a` itself dereferences that forwarded parameter immediately and writes back
  through it across the tracked-send path.
  Interpretation:
  this still does not prove that `+0x0e3c` is exactly the same structure consumed as
  `count_ptr` under the `0x160c` candidate model. But it does materially narrow the
  possibilities: `+0x0e3c` no longer looks like a generic scalar mode/context word.
  In the currently recovered graph it behaves consistently like a pointer-bearing control
  root, which is a better fit for the strengthened `0x106e -> 0x160c` candidate than
  the earlier vague "context long" label.

- Finding 140: that strengthened candidate model now has a concrete internal tension:
  if the measured `arg4 = CSCSIPlug+0x0e3c` is exactly the mutable `count_ptr` consumed
  by `0x139a`, then the later `0x1160` report classifier would appear to be reading back
  a mutated count value where it expects a stable `SYSX` / `SRAW` discriminator.
  Evidence:
  the measured nonzero-`arg4` caller family includes both:
  `0x0f60` / `0x10b2` (mode `#1`, nonzero `arg4 = +0x0e3c`)
  and
  `0x0fbc` / `0x10f8` (mode `#0`, nonzero `arg4 = +0x0e3c`).
  In particular, the `0x0f70-0x0fbc` path is entered only after the source buffer in
  `%d6` matches a literal Akai SysEx header shape:
  byte `0 = 0xf0`,
  byte `1 = 0x47`,
  byte `4 = 0x48`,
  byte `3 = 0x0b`.
  Under the strengthened `0x160c` candidate model, any successful nonzero-`arg4` send
  would then enter `0x139a`, which dereferences the forwarded pointer immediately and
  writes accumulated byte-count state back through it.
  But after `0x106e` returns, the common `0x1160` block still loads `self@(0x0e3c)` as
  an address and classifies the payload as `SYSX` only when the first byte at that
  pointee is `0xf0`; otherwise it labels the payload `SRAW`.
  Interpretation:
  this is not yet a disproof of the `0x106e -> 0x160c` candidate, but it is now the
  sharpest remaining structural pressure point against the exact current mapping.
  If `arg4 = +0x0e3c` is literally the same mutable count pointer consumed by `0x139a`,
  then the later `SYSX` / `SRAW` tag check at `0x1160` would be reading a location that
  has already been overwritten with count/control state on the tracked-send path.
  So at least one extra detail remains unresolved:
  either `+0x0e3c` is a more structured pointer than the current simple model implies,
  or the live target behind `0x106e` is not exactly the currently recovered `0x160c`
  body, or some path-specific condition prevents the apparent conflict from arising.

- MESA I architecture baseline from the Mac OS 7 corpus
  The extracted MESA I binaries expose a much clearer packaging model than the current
  MESA II working set. Raw strings in `mesa1-app` explicitly describe an application
  that scans `MESA Pouch` for modules and expects a separate shared resource file:
  `Scanning for modules`, `Could not find any modules!`, and
  `Could not find shared resource file!` all appear alongside type names `MODU` and
  `SHAR`. The module binaries expose the contract directly. For example,
  `mesa1-s3-hd-provider.modu` contains `S3Disk.InitModule`,
  `S3Disk.GetResourcesForModule`, `S3Disk.DoCommand`, `ProvideToDBHandler`,
  `ProvideSamples`, and `ProvidePrograms`, while `mesa1-sampler-editor.modu` contains
  `S3000Module.InitModule`, `S3000Module.DoCommand`, `S3000Module.OpenModule`, and an
  explicit dependency string:
  `Could not save because M.E.S.A. could not find the S3000 Disk Provider module.`
  The stable architectural read is that MESA I is an explicit `APPL + SHAR + MODU`
  system where the host app scans a pouch, loads modules, resolves shared resources,
  and relies on provider modules for device/storage services. This does not solve the
  live MESA II `0x106e` question directly, but it strengthens the historical
  expectation that Akai's glue logic can live in a shared/provider layer rather than in
  the editor module alone.

- MESA I vs MESA II packaging comparison
  The installed MESA II files now make the lineage contrast more explicit. In MESA I,
  the host side talks about scanning `MESA Pouch` for `MODU` modules and needing a
  separate `SHAR` resource file, while the editor and provider modules expose paired
  contracts like `InitModule`, `GetResourcesForModule`, and `DoCommand`. In the
  extracted MESA II install set, the visible packaging vocabulary changes:
  `mesa-ii-app` contains `Could not find Editors or PlugIns folder!`,
  `To install an Editor you must put it into the Editors folder in the MESA Pouch
  folder and reboot MESA.`, and
  `To install a PlugIn you must put it into the PlugIns folder in the MESA Pouch folder
  and reboot MESA.`, plus the typed loader tokens `EDIT`, `PLUG`, and
  `LoadMESAPlugIn__7CMESAv2FP10ModuleData`. Meanwhile `sampler-editor-2.3` exposes
  `InitModule__14CSamplerModuleFPFP11MESACommand_v`, `GetPlugList__14CSamplerModuleFv`,
  and `OpenModule__14CSamplerModuleFv`, and emits the runtime error
  `Sampler Editor cannot find a MIDI or a SCSI plugin to handle data transfer!`
  The stable comparison read is:
  MESA II appears to replace the older visible `SHAR + MODU provider` packaging with an
  `APPL + EDIT + PLUG` layout where the app owns the pouch/folder scan and loads typed
  editor/plug resources directly. That does not prove there is no hidden shared layer
  inside the app, but it does support the historical model Claude is now converging on:
  if MESA II has the equivalent of MESA I shared/provider glue, the best visible place
  for it is the main app / resource system, not another obvious `SHAR`-typed companion
  file in the installed tree.

- MESA I shared-resource API is explicit at the module boundary
  The `mesa1-shared.shar` binary itself is mostly opaque from a quick string pass, but
  the surrounding module contracts make its role clear enough for architectural use.
  Multiple MESA I `MODU` files explicitly expose:
  `GetResourcesForModule`, `GetSharedResource`, and `SetSharedResource`, while the
  provider-side module also exposes `ModulePane.GetSharedResources`. For example:
  `mesa1-file-manager.modu`, `mesa1-s2000.modu`, and `mesa1-s3000-fx.modu` all contain
  `SetSharedResource__11CModuleViewFs` and `GetSharedResource__11CModuleViewCFv`
  alongside their module `InitModule` / `DoCommand` / `GetResourcesForModule` methods.
  `mesa1-s3-hd-provider.modu` likewise contains `ModulePane.GetSharedResources` next to
  its provider contract. The stable read is that MESA I's shared layer is not just an
  incidental file in the pouch; it is a first-class part of the module API. That makes
  the absence of an equally visible `SHAR`-style file in MESA II more meaningful:
  if the same architectural responsibility survived, it was likely folded into the app
  / resource system rather than remaining a separately named install artifact.

- MESA I app exposes host-side module registry and service surface
  The host app in MESA I is not just a dumb loader. Its strings show an explicit
  application-side registry/service layer above the modules themselves. In addition to
  pouch scanning and shared-file lookup, `mesa1-app` exposes:
  `MESA Events`, `module id`, `modulescMOD`, `all modules`, and a pouch-service verb
  `path to pouch` whose description is `returns an alias of the M.E.S.A Pouch`.
  The same binary also contains multiple AppleEvent-ish tags (`IAEH`, `DAECH`, `DOAEH`,
  `AECBH`, `AECRH`, `AEDLH`) and service descriptions for module metadata like name,
  version, and owner module id. The stable read is that MESA I's app side is already a
  real service/registry layer for modules, not merely a bootstrapper that hands control
  off once and disappears. That matters for MESA II because it makes a service-style
  callback outcome historically plausible: if Claude's current CODE-resource callback
  turns out to be resource/service-facing rather than a direct patcher, that would fit
  a known Akai pattern rather than being an ad hoc fallback explanation.

- MESA II callback `0x1e5a` resolves in `CODE 1` as `SendCommandToEditor`
  Independent parsing of the installed `mesa-ii-app` resource fork now gives a direct
  identifier for the callback Claude is chasing. The app contains 11 `CODE` resources,
  including `CODE 1` named `Application`. The app-side loader bodies live there:
  `strings -t x` over the extracted `CODE 1` body shows
  `LoadMESAPlugIn__7CMESAv2FP10ModuleData` at `0x18b3`,
  `LoadMESAEditor__7CMESAv2FP10ModuleData` at `0x1d21`,
  `SendCommandToPlugIn__7CMESAv2FP11MESACommandl` at `0x19a5`, and
  `SendCommandToEditor__7CMESAv2FP11MESACommandl` at `0x1e29`.
  Direct disassembly of that same segment shows both loader paths embedding the callback
  literal:
  `0x1846: lea 0x1e5a,%a0`
  `0x1cb4: lea 0x1e5a,%a0`
  and `0x1e5a` itself begins a real function:
  `4e56 fff8 48e7 1838 ...`
  So the callback passed in the `INIT` struct is no longer an opaque runtime token. It
  is best modeled as an app-side function named `SendCommandToEditor`. This does not by
  itself prove the patch hypothesis is dead, because the callback body could still
  influence later transport state indirectly or dispatch further. But it materially
  strengthens the service-callback branch over the direct-patcher branch.

- MESA II callback `0x1e5a` dispatches app/editor service commands, not visible plug transport verbs
  A tighter bounded decode of `mesa-ii-app` `CODE 1` now sharpens that callback model.
  The body at `0x1e5a` immediately enters an inline tag-dispatch structure, then fans
  out through internal stubs at `0x1f10-0x2168` to a stable set of app-side handlers:
  direct `jsr` targets include `0x21a4`, `0x2204`, and `0x2264`, whose nearby symbol
  strings identify them as `BusyCursor__7CMESAv2FUc`,
  `BarCursor__7CMESAv2FUc`, and `HandCursor__7CMESAv2FUc`. The same callback body also
  reaches later handlers whose nearby symbol strings identify editor/service methods
  such as `ActivateCurrentEditor__7CMESAv2Fv`,
  `MESADeleteMenu__7CMESAv2FP19MESAInstallMenuData`,
  `MESAInstallMenu__7CMESAv2FP19MESAInstallMenuData`,
  and `DispatchCommandFromModule__7CMESAv2FP11MESACommand`.
  A bounded string scan over the same `CODE 1` body shows loader-side tokens like
  `PLUG`, `EDIT`, and `INIT`, but no occurrences of transport-facing terms such as
  `SCSI`, `MIDI`, `CONS`, `ASOK`, `SRAW`, `UALL`, or `BULK`.
  The stable read is:
  the callback currently looks like host/editor service dispatch rather than a direct
  plug-transport patcher path. This still leaves room for indirect downstream effects
  through module/service handlers, so it narrows the direct-patch hypothesis without
  fully killing it.

- MESA II callback's shared helper `0x1630` looks like typed module-registry logic, not transport control
  The remaining callback-side pressure point is the shared helper reached from several
  `0x1e5a` branch stubs. Bounded bytes at `0x1630` show explicit four-char compares
  against `PLUG` and `AK11`, plus the same helper is referenced not only from callback
  stubs at `0x1f50`, `0x1fb0`, `0x1fd0`, `0x1ff0`, and `0x2146`, but also from the
  broader plug-scan/load surface at `0x1820`, `0x183a`, `0x1892`, `0x1cea`, and
  `0x1d00`. That makes the best current read:
  this shared helper belongs to typed module discovery/registry work reused by both the
  loaders and the callback, rather than to a transport-specific patch path.
  This still stops short of proving that no later module/service branch can affect
  transport, but it pushes the direct callback body one step farther away from an
  obvious patcher interpretation.

- MESA II `SMSendData` candidate still looks like the in-plug CDB builder below `$1106E`
  The live frontier has now shifted back to the shared sender slot at plug file
  `0x106e`, because Claude's offline harness is capturing real plug-emitted BULK CDBs
  at that boundary. A fresh bounded `objdump` pass over file `0x160c-0x16d6` shows the
  old `SMSendData` candidate still does concrete work *below* that slot:
  it writes `0x0c` into local byte `%fp@(-6)`, stores the three low bytes of `%d7` into
  `%fp@(-4..-2)`, and sets `%fp@(-1)` to `0x80` when `%fp@(14)` is nonzero, else `0`.
  It then pushes `word #2`, `long #0x3e8`, `%d7`, `%fp@(16)`, `&%fp@(-6)`, `%d6`, and
  `self+0x093a`, and calls the deeper helper at absolute target `0x1620`; on success it
  can also fall into the nested helper at `0x139a` for optional follow-on reply/count
  handling. The stable read is now narrower than before:
  if the harness intercepts at `$1106E`, it is still bypassing this in-plug CDB-
  construction layer, even though Claude's newly observed BULK shape
  `0c 00 00 01 96 80` is structurally consistent with it.

- MESA II app-side literal patch search is now exhausted across all visible CODE resources
  A direct resource-map parse of the installed `mesa-ii-app` shows eleven CODE
  resources: `Application`, `Libraries`, `Commanders`, `Features`, `Panes`,
  `File & Stream`, `Apple Events`, `Lists`, `Support`, `Utilities`, and `CODE 0`.
  A bounded byte search over every one of those CODE bodies found no literal references
  to `0x106e`, `0x1070`, or `0x160c`, and no direct `JMP` pattern to either address.
  The only residue was one `600000f0` sequence in `CODE 2` (`Libraries`), but in
  context it is just an ordinary local branch, not a send-slot template.
  So the current best read is tighter than before:
  if the app/editor side really installs or redirects the send path, it is not doing so
  through a simple literal slot-write or jump sequence in the visible app CODE
  resources.

- MESA II's first concrete raw transport primitive is `CSCSIUtils::SCSICommand`, not a hidden `_SCSIDispatch` inside `SMSendData`
  The unnamed utility body at file `0x1bbe-0x1d1e` is now explicitly identified by the
  following symbol string as `SCSICommand__10CSCSIUtilsFsP3CdbPUcUlls`.
  Bounded `objdump` of that body shows it building a PB-like structure and then calling
  `_SCSIDispatch` at file `0x1cd8`:
  it copies six CDB bytes from the incoming `Cdb*` into offsets `68..73`, stores the
  data pointer at offset `84`, stores the payload length at offset `44`, selects one of
  three control values (`0x40040000`, `0x80040000`, `0xC0040000`) at offset `20` based
  on the final `short` argument, and only then executes `_SCSIDispatch`.
  So the post-`SMSendData` frontier is sharper now:
  the raw executor exists and is named, which means the remaining harness loop/blocker
  is likely still above `CSCSIUtils::SCSICommand`, in the wrapper chain between the
  local CDB builder and this utility path.

- MESA II `0x1620` is a shared internal entry into the `SMSendData` wrapper family, not a fresh runtime-installed slot
  A direct `objdump` pass over file `0x160c-0x16d6` now reconfirms the exact body shape:
  the only real prologue is at `0x160c`, while `0x1620` begins after register/setup
  work at the shared sequence `moveal %fp@(28),%a3; clrl %a3@; ...`.
  All five absolute `jsr 0x1620` call sites in the plug (`0x12a6`, `0x133a`, `0x14ac`,
  `0x15b8`, `0x169a`) reuse that same entry, and there is no independent prologue or
  symbol boundary at `0x1620`.
  So the practical emulator implication is narrower than “install the missing 0x1620
  target”:
  in the current static artifact set, `0x1620` is already the common internal dispatch
  entry that the surrounding wrappers expect to call.

- MESA II `0x187e` is likewise a shared internal helper entry inside the larger `0x1700-0x1afe` family, not a standalone slot target
  Bounded `objdump` over file `0x1760-0x1afe` shows that `0x187e` lands in the middle of
  a larger helper body with no local prologue and with internal backward branches to
  `0x17aa` and `0x17b0`.
  The three absolute `jsr 0x187e` call sites (`0x1286`, `0x14f6`, `0x162e`) all use the
  same two-argument shape: push a selector/status word plus `self+0x093a`, call
  `0x187e`, then test `%d0` as a boolean gate before continuing.
  That makes the best current read:
  `0x187e` is another shared helper entry with caller-state expectations, not an
  unresolved runtime-installed target. Whatever Musashi is still missing here is more
  likely helper semantics or surrounding state than a simple late-bound function
  address.

- MESA II runtime `0x1187e` corresponds to file `0x187e`, and that region is inside the large `SMSendData` body, not a separate named helper
  The nearby symbol string at file `0x16d8` identifies the `0x1700-0x1afe` body as
  `SMSendData__9CSCSIPlugFsUcPUcPUclPl`, while the next symbol string at `0x1afe`
  starts `ChooseSCSI__9CSCSIPlugFUl`.
  So the whole `0x1700-0x1afe` span belongs to `SMSendData`, and the `0x187e` entry
  sits inside that body. In the harness, Claude's runtime `0x1187e` notation is the
  load-address form of the same file offset, which explains why the observed loop lives
  inside the `SMSendData` region rather than at a truly separate helper target.
  Practical implication:
  the old `scsi-plug-functions.txt` label that treated `0x1700-0x1b00` as
  `ChooseSCSI__9CSCSIPlugFUl` is stale in exactly the region that matters here, and the
  harness should treat `0x1187e` as an internal `SMSendData` entry point, not as a
  separate helper body waiting to be installed.

- MESA II internal entry `0x187e` / runtime `0x1187e` is part of a real UI/dialog path, not random recursion into garbage
  The large `SMSendData` body around file `0x1700-0x1afe` is visibly dialog-heavy.
  It allocates a dialog-like object at `0x1762-0x1770`, dispatches through object
  methods at `0x1784` and again at `0x19f4`, builds user-facing strings like
  `Bus X, ID=Y:` in the `0x1812-0x1934` range, and uses helper calls at absolute
  addresses `0x21dc`, `0x229c`, and `0x218a` that map into the `CSCSIDialog` method
  region.
  So Claude's observed `ModalDialog` trap on the runtime `0x1187e` path is consistent
  with the static body: this entry is inside a legitimate bus/ID selection or error UI
  path, not an accidental jump into unrelated bytes.
  Practical implication:
  if Musashi falls into the `0x1187e` path, the right question is why the send flow is
  reaching the dialog/error-selection branch at all, not whether that branch is a bogus
  unresolved install target.

- MESA II `CSCSIDialog` item handling is simple enough that a `ModalDialog -> affirmative item` probe is a clean next harness experiment
  Bounded `objdump` of the dialog-method region shows `DoItemHit__11CSCSIDialogFs`
  at file `0x27f4-0x281c` is tiny: it returns true only when the incoming item number is
  `1` or `2`, else false. `DoNull__11CSCSIDialogFv` at `0x294c-0x2968` is likewise
  small, checking a dialog field at offset `0x616` and reflecting a boolean result back
  into the object.
  This strengthens the current harness guidance:
  stubbing `ModalDialog` to an affirmative item-result is a bounded, semantically
  plausible probe. It tests whether Musashi is simply waiting for a normal user choice
  inside the dialog/error branch, without needing to invent a hidden suppress-dialog
  field in `CSCSIPlug` first.

- MESA II internal entry `0x187e` is a target-enumeration-and-selection routine, not just a naked dialog branch
  Clean `objdump` of the live plug bytes shows `SMSendData` calls `0x187e` at `0x162e`
  and branches to the local error exit only when its low byte is zero (`0x1634-0x1638`).
  Inside the large `0x1700-0x1afe` `SMSendData` body, the same `0x187e` region first
  scans bus/ID candidates:
  `0x17b0-0x17d4` calls the internal `0x17ac` entry with `(self+0x093a, d4, d5,
  buffer, 0x24)`, stores the result at `self+0x0d66`, and skips line construction when
  that result is nonzero.
  When the probe result is zero, `0x17dc-0x180e` checks the returned descriptor bytes
  for the `AK` prefix and `S`/`C` discriminator, `0x1812-0x195c` builds the visible
  `Bus X, ID=Y:` line, and `0x1936-0x1962` appends it to the dialog object. The nested
  loops at `0x1974-0x198a` walk `d4 = 0..7` and `d5 < self+0x0942`, so `d6` becomes the
  count of valid candidate lines.
  The dialog phase only happens after that enumeration pass:
  `0x198e-0x19e6` sets up the prompt, primes a default selected line (`fp@(-298)=1`)
  only when at least one candidate was found, and `0x19e6-0x19fa` calls the dialog
  method that eventually reaches `ModalDialog`.
  This tightens the harness interpretation:
  the affirmative `ModalDialog` probe is still the right bounded next test, but it now
  specifically answers whether Musashi is blocked only on UI interaction or still lacks
  valid target-enumeration state. If affirmative dialog flow still returns the local
  `-10003` error path (`0x1aa6` / `0x1ac2`), the next missing precondition is upstream
  target discovery, not a hidden dialog flag.

- MESA II target enumeration under `0x187e` walks the embedded `CMESAPlugIn` socket table, so the harness must satisfy earlier `ConnectToSocket`/`ActivateSocket` state before dialog success is even possible
  The surrounding symbol and code surface now reconcile cleanly:
  `GetSockets__11CMESAPlugInFv` at file `0x0b96-0x0ba6` returns `this+56`, and
  `__ct__9CSCSIPlugFv` at `0x0bc6-0x0c72` explicitly initializes the embedded
  `CMESAPlugIn` subobject at `CSCSIPlug+0x093a`, including zeroing its count field at
  subobject offset `+56`.
  `ConnectToSocket__11CMESAPlugInFP10SocketInfo` at `0x09d2-0x0a2c` increments that
  count and copies a full 46-byte `SocketInfo` record into the per-entry table at
  subobject offset `+60 + 46*n`.
  `ActivateSocket__11CMESAPlugInFP10SocketInfo` at `0x0a5c-0x0ab4` then searches those
  entries by the longword at `SocketInfo+38`, writes the selected word/long fields back
  into the entry (`+60` / `+66`), and clears a downstream pointed longword.
  That makes the later `0x187e` scan much more concrete:
  the `d5 < this+56` / `entry = this+60+46*d5` walk is not abstract transport magic; it
  is traversing the embedded `CMESAPlugIn` socket table that should already have been
  built by the `CONS`/`ASOK` phase.
  This sharpens the emulator implication again:
  if the affirmative `ModalDialog` probe still returns `-10003`, the next thing to check
  is not a hidden UI flag but whether the embedded `CMESAPlugIn` table at
  `CSCSIPlug+0x093a` has been populated and activated the same way real `CONS` and
  `ASOK` would have done.

- MESA II `0x187e` success flow returns the pre-existing field at `CSCSIPlug+0x0d68`, and that field currently has no visible in-binary writer
  The tail of the large `SMSendData` body now narrows the return contract:
  `0x1aa6` and `0x1ac2` both return the local `-10003` error word after dialog-service
  cleanup, while the only apparent success leg at `0x1ade` loads `self+0x0d68` into a
  local word and returns that value. `SMSendData` then immediately does `tst.b d0` on
  that return at `0x1634`, so a zero low byte there still forces the local error exit.
  A full-object disassembly search currently finds only reads of `self+0x0d68`
  (`0x1568`, `0x1ade`) and no local write in the visible plug binary. Nearby state
  fields do have visible writers:
  `self+0x0d6e` is written at `0x0d20`, `0x0e24`, and `0x1a9e`, and `self+0x0d70` is
  written at `0x0c4a` and `0x1a8c`.
  This gives the harness a sharper next check:
  if `0x187e` reaches the nominal success leg but `CSCSIPlug+0x0d68` is still zero
  under Musashi, the missing precondition is likely an earlier selection/state field,
  not the dialog loop itself.

- MESA II dialog selection writes a new active value through `0x0d70/0x0d72 -> 0x0d6e`, but the `0x187e` return path still uses the distinct older field at `0x0d68`
  The surrounding state fields are now better separated:
  `0x1a8c` stores the chosen 16-bit bus/ID word into the per-index scratch area at
  `self+0x0d70 + 4*n` (via a sign-extended long), and `0x1a9e` writes the same chosen
  word into the active field at `self+0x0d6e`.
  Earlier, the pre-send selector path at `0x0e04-0x0e24` scans the embedded
  `CMESAPlugIn` table and copies the low word of one of those scratch slots
  (`self+0x0d72 + 4*n`) back into `self+0x0d6e`.
  So the plug clearly has a visible “current selected socket word” path through
  `0x0d70/0x0d72/0x0d6e`.
  But the apparent success return from `0x187e` still bypasses that newer active field
  and returns `self+0x0d68` instead.
  That makes the current static read stronger:
  `0x0d68` is not just another spelling of the dialog’s current selection state. It
  looks like an older latched selection/status field that must already be established by
  some earlier path outside the locally visible selection writes.

- MESA II ctor-visible sibling fields `0x0d68/0x0d6a/0x0d6c` look like an older latched-state cluster, while the active selection machinery has moved to `0x0d6e/0x0d70`
  `__ct__9CSCSIPlugFv` at `0x0bfc-0x0c0a` explicitly clears `self+0x0d6c`,
  `self+0x0d6a`, and `self+0x0d6e` together at construction time.
  Later local code continues to use the newer pair:
  `0x0d70` scratch entries are zeroed at ctor time, written at `0x1a8c`, and read back
  through `0x0d72` into `0x0d6e` at `0x0e1a-0x0e24`.
  But the only visible uses of the older neighbor `0x0d68` are still the two reads on
  the return path (`0x1568`, `0x1ade`), and there are no visible local writes to
  `0x0d68`, `0x0d6a`, or `0x0d6c` after construction in the current plug artifact.
  That makes the latch interpretation stronger:
  the older `0x0d68/0x0d6a/0x0d6c` cluster looks like pre-existing plug/session state
  that local `SMSendData` logic consumes, while the visible selection path only produces
  the newer `0x0d6e/0x0d70` state.

- MESA II visible `CMESAPlugIn` command handling still does not establish the older `0x0d68/0x0d6a/0x0d6c` latch cluster
  A bounded reread of the embedded `CMESAPlugIn` surface around
  `DoMESACommand__11CMESAPlugInFP11MESACommand`, `ConnectToSocket`, and
  `ActivateSocket` now supports a stronger exclusion:
  the command selector body around `0x0898-0x099a` handles tags like `CONS`, `ASOK`,
  `AQUT`, `IDEN`, `OPNM`, and `RSEND`, but its visible writes stay on:
  - the local return/status word at `this+4`
  - the copied 46-byte `SocketInfo` records
  - the active/scratch selection machinery through `0x0d6e/0x0d70`
  `ConnectToSocket__11CMESAPlugInFP10SocketInfo` grows the entry table and
  `ActivateSocket__11CMESAPlugInFP10SocketInfo` updates selected entry fields, but
  neither visible method writes `0x0d68`, `0x0d6a`, or `0x0d6c`.
  So the current exclusion boundary is tighter:
  the older latch cluster is not just “not written by `SMSendData`”; it is also not
  established by the obvious visible `CMESAPlugIn` command/activation surface in the
  plug artifact.

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
- What exactly does helper `0x317dc(this)` install during the constructor-era setup,
  and is that where `CAkaiSampler` ultimately reaches `CSamplerModule+0xda4`?
- Can Codex independently decode enough of `CMESAPlugIn::DoMESACommand` to prove the
  `ActivateThisSocket` callback reaches `CMESAPlugIn::ActivateSocket` directly, rather
  than treating that final hop as a still-supported inference?
- Why does `ActivateThisSocket`'s checked-in `lea %a4@(12482),%a0` land on a zeroed
  10-byte template under the current best sampler-editor A4-base interpretation, while
  the adjacent `ConnectToPlug` call sites line up cleanly with `ASOK` and `CONS`?
- Does the editor-side `CONS` payload expose raw embedded-socket `this+24` as
  `SocketInfo[+0]`, or is there still a transform layer between the current strongest
  candidate at file `0x028169` and the plug-visible `ConnectToSocket` copy path?
- Does the shared sender behind `0x106e` construct the actual outbound SRAW CDB/wire
  bytes from the seven-argument call frame prepared by the `0x0f40` branch, or does a
  later runtime-installed layer still intervene before bus emission?
- What exact meaning do the transient send-state bytes at `CSCSIPlug+0x0e46` and
  `+0x0e47` carry, and do they determine whether the shared `0x106e` path emits one
  wire shape versus another?
- How do the measured caller families into `0x106e` map onto concrete wire modes:
  raw-SRAW, SDS-header-like control sends, and the derived-length path that post-processes
  `%fp@(-30)` after return?
- What exact per-entry long at `self@(62 + 46*i)` is being matched against `IP_Data[+12]`,
  and how does that routing key relate to the plug/socket identity established by the
  earlier `CONS` handshake?
- What exact semantic does the nullable context long in the shared `0x106e` frame carry:
  prebuilt transport buffer, framing template, or some other plug-local state root?
- What concrete wire-path distinction does `arg4 = 0` versus
  `arg4 = CSCSIPlug+0x0e3c` encode across the measured caller families?
- What exact semantic difference does mode byte `#1` vs `#0` encode once the now-measured
  context/length fields are factored out?
- What exact state or capability does `CSCSIPlug+0x0e40` represent when it selects the
  wrapper path at `0x1072` instead of the later direct `%d6` branch family?
- Does `0x0ca2(self, target, 1, 1)` compute a "direct-send available" result into
  `+0x0e40`, or is the cached byte tracking some other transport readiness distinction?
- Are the pushed `0/0` vs `1/1` values consumed by `0x0274`, by the `0xa02a`/`0xa023`
  trap layer, or by some other stack-sensitive system path below the recovered helper?
- Is the right next move on the static side still `0x0ca2`, or has this now reached the
  point where only runtime instrumentation or a different binary source is likely to
  resolve the remaining pre-send gate semantics?
- What concrete `CSamplerModule`-side method lives at the `vtable[0x28]` `UALL` call
  site, and does it in turn route into a sampler object, a UI update path, or both?
- Can Codex decode the function body behind `CAkaiSampler` slot `0x0170` directly
  enough to upgrade `GetSamplerStatus` from a strong address-plus-call-site match to a
  fully behavior-backed identification?
- What concrete status or UI state does `CAkaiSampler::GetSamplerStatus` actually report
  through the callback/fallback path rooted at `this+0x2c`, `this+0xc4`, `this+0xba`,
  and `this+0xbe`?
- What is the concrete class or interface behind `CAkaiSampler+0x2c`, given that the
  same callback-slot pattern also appears in graphics/view code?
- Is the remaining hardware failure explained entirely by the missing socket-level
  pre/post sequence, or is there still a content-byte mismatch in the 200-byte header?
- What exactly does the `CSamplerModule`-side `UALL` dispatch at `0x030c93` signal to
  the sampler or UI layer?
- What is really happening at the `jsr 0x148` site in the `CSCSIPlug` selector/send
  dispatcher, given that `0x148` overlaps the embedded string/header region instead of a
  clean helper body?
- Are the other very low absolute `jsr` targets used by `CSCSIPlug` (`0x274`, `0x02fc`)
  also external/runtime entry points or data-driven transfers rather than local helper
  bodies?
- The simple immediate-offset writer escape hatch for the older latch cluster is now
  largely closed. A new bounded scan across the installed `scsi-plug-2.1.2.rsrc.bin`
  and `mesa-ii-app` artifacts did not find any meaningful `ADDA/LEA/PEA 0x0d68`-style
  setup path that would explain `CSCSIPlug+0x0d68` as a straightforward indirect
  writer target. In the editor binary, the one non-noise `pea 0x0d68` hit at file
  `0x6091a` sits inside the same tag-registration table that also registers offsets
  like `0x0c48`, `0x0c88`, `0x0d30`, `0x0aa8`, and `0x0e70` against literal names like
  `butn`, `capt`, `dlog`, `edit`, `lbox`, and `pane`; it is not an object-field write.
  Other raw `0x0d6a` / `0x0d6c` hits in the editor binary fall in dense data regions,
  not executable setup code. So the remaining plausible writer for the older
  `0x0d68/0x0d6a/0x0d6c` latch cluster looks even less like a missed immediate offset
  store and more like a higher-level host/open/init state path.

- The visible app-side plug scan/load path still passes only a tiny `INIT` struct, not a fat loader-state block
  A bounded reread of `mesa-ii-app` `CODE 1` tightens the host/open boundary again, with
  one naming correction: the `PLUG`/`INIT` body at file `0x17f4-0x18b0` sits in the
  `ScanForPlugIns__7CMESAv2FlsP12CAboutDialog` region, while the later body at
  `0x18dc-0x19a2` aligns with `LoadMESAPlugIn__7CMESAv2FP10ModuleData`. Inside the
  earlier scan/load body, after looking up the `PLUG` resource and locking it, the app
  builds an on-stack 10-byte record:
  `fp@(-10..-7) = 'INIT'`, `fp@(-6..-5) = 0`, `fp@(-4..-1) = 0x1e5a
  (SendCommandToEditor)`, then passes only `&fp@(-10)` to the plug entry via `jsr a4@`.
  On success that same body caches the plug entry pointer at object offset `+72` and the
  resource ID at `+70`; on failure it runs the alert path and clears those slots. So the
  visible app-side plug scan/load path is still not passing any obvious
  selection/latch-bearing state into the plug `INIT` entry beyond the callback and a
  writable result word. That makes the older `0x0d68/0x0d6a/0x0d6c` latch cluster look
  even less like something seeded by a simple loader-side struct and more like a later
  host/open/init service effect.

- The `0x187e` loop bound is a bus-count/state slot, not the visible socket-entry count
  A new primary-evidence reread of the plug bytes tightens the live Musashi seam
  sharply. The large body at file `0x1700-0x1afc` is not `SMSendData`; it is
  `ChooseSCSI__9CSCSIPlugFUl`, with the next symbol string starting at `0x1b01`.
  Inside that body, the outer loop at `0x197e-0x198a` increments `%d5`, sign-extends it,
  and compares it against `CSCSIPlug+0x0942`. That field is **not** the visible
  `CMESAPlugIn+56` socket-entry count. The embedded `CMESAPlugIn` constructor at
  `0x07ac` seeds `subobject+8` with literal `'NULL'`, which maps to the same outer
  offset `0x0942`, while the visible entry count is at `subobject+56` / outer `0x0972`.
  More importantly, the later helper `IdentifyBusses__10CSCSIUtilsFv` at
  `0x1f0e-0x1faa` explicitly writes `%a2@(8)` with `%d3` at `0x1fa0` on its success path.
  So the live outer loop is best modeled as a bus-enumeration bound derived from
  `IdentifyBusses`, not as a loop over the socket table count. That means the current
  harness seam is no longer “populate the socket table correctly” in the narrow sense;
  it is “make the `ChooseSCSI` / `IdentifyBusses` path establish a sane bus-count/state
  value in `CMESAPlugIn+8` before the selection loop runs.”

- The `0x187e` internal entry uses inherited caller state across multiple wrappers
  Another bounded reread tightens the `0x187e` contract. The entry at file `0x187e` is a
  mid-body internal target inside `ChooseSCSI`, and it is called from three places:
  `SendData__9CSCSIPlugFP7IP_Data` at `0x1286`, `SMDataByteEnquiry__9CSCSIPlugFsUc` at
  `0x14f6`, and `SMSendData__9CSCSIPlugFsUcPUcPUclPl` at `0x162e`. The `SendData`
  caller explicitly derives both `d4` and `d5` from its own flag bytes before jumping
  there, but the other two callers do not fully initialize the same register set first:
  `SMDataByteEnquiry` sets `d4` from `fp@(12)` and reaches the `0x14f6` call without a
  fresh local `d5` write, while `SMSendData` sets `d4 = 0` and likewise does not
  initialize `d5` before `0x162e`. So the visible code already treats `0x187e` as a
  shared internal target that can consume inherited register/state context. That means
  “`SMSendData` fails because it forgot to initialize `d5`” is too weak as the next
  blocker theory by itself. The better next probe remains the surrounding `ChooseSCSI`
  / bus-state setup, not just one register at the `SMSendData` call site.

- The post-loop `0xd8ed` result is a local `ChooseSCSI` failure code, not a deeper transport error
  After Claude's bounded `FORCE_D4_AT_187E` probe broke the structural loop, the next
  visible result was `D0 = 0xd8ed`. A direct search through the original plug artifacts
  closes that seam further: `0xd8ed` appears twice inside `ChooseSCSI__9CSCSIPlugFUl`,
  at file `0x1aa8` and `0x1ac4`. In both cases the body does a local `MOVE.W #$d8ed`
  into stack temporaries (`fp@(-1902)` / `fp@(-1904)` in the older decode), pushes
  `#$ffff` plus the chooser scratch buffer at `fp@(-1856)`, and calls the shared local
  helper at `0x218a` before returning. The same tail later has a third return leg that
  copies `this+0x0d68` into another local slot at `0x1ade`. So the current harness
  behavior after forcing `d4 >= 7` is still chooser-local: it escapes the structural
  loop and lands in one of `ChooseSCSI`'s built-in local failure exits. That means the
  next live seam is still the missing bus-enumeration / chooser state above this block,
  not a newly exposed raw transport failure below `SMSendData`.

- The shared helper at `0x218a` is inside `CDialog` construction, not a deeper transport utility
  A bounded reread of the raw plug bytes closes the obvious next escape hatch under the
  `0xd8ed` failure path. The existing function map already places
  `__ct__7CDialogFsPv` at file `0x2150-0x2196`, and a direct hex slice around
  `0x2150` confirms that `0x218a` lands inside that body, not at the start of a
  separate helper. The bytes at `0x218a` (`2f 0a a9 18 20 4a 24 5f 4e 5e 4e 75`) are
  just the constructor's late internal entry / tail, ending in the common `UNLK/RTS`.
  So the `ChooseSCSI` failure legs at `0x1aa8` / `0x1ac4` are still routing through
  chooser/dialog infrastructure, not exposing a new transport-significant function below
  the chooser itself.

- `IdentifyBusses` writes the chooser bound slot only on a late success gate
  A tighter decode of `IdentifyBusses__10CSCSIUtilsFv` adds one useful constraint to the
  current harness seam. The earlier primary-evidence result still stands: the function
  visibly writes `this+8` at file `0x1fa0`. But that write is not unconditional. In the
  tail, the function first tests `tst.w (a2)` at `0x1f88`, bounds the probe loop against
  `d3 < 6` at `0x1f8c-0x1f90`, then does a late `cmpi.w #$e143,(a2)` at
  `0x1f92-0x1f96`; only on the equal path does it clear `(a2)` and store the sign-
  extended bus index into `this+8` at `0x1fa0`. So the current seam is not just “field
  `+8` needs a nonzero value.” It is “`IdentifyBusses` has a visible internal success
  gate for deciding when to publish that value at all.” That makes direct field seeding
  an even less faithful harness substitute than before.

- The live chooser-bound slot may belong to the helper subobject at `CSCSIPlug+0x093a`, not a visible `CMESAPlugIn` field
  One bounded constructor reread weakens an older identification that had become too
  concrete in the working notes. In `__ct__9CSCSIPlugFv` at file `0x0bc6-0x0c74`, the
  ctor does **not** visibly call `__ct__11CMESAPlugInFv` on `self+0x093a`. Instead it
  first calls a separate base/helper ctor at `0x020e`, then explicitly passes
  `self+0x093a` into another internal setup helper at `0x157e`. That same `self+0x093a`
  base later reappears in `ChooseSCSI` at `0x17bc` when the code pushes it into the
  internal chooser path. Combined with the fact that `IdentifyBusses__10CSCSIUtilsFv`
  is the visible routine that writes `this+8`, the current best static read is now:
  outer `CSCSIPlug+0x0942` is more likely `subobject(+0x093a)+8` in the same helper
  family that `IdentifyBusses` operates on, not a proved `CMESAPlugIn+8` identity. That
  does **not** change the live tactical focus — the seam is still “what makes
  `IdentifyBusses` publish the chooser bound?” — but it does mean the older
  `CMESAPlugIn+8` wording should be treated as candidate-grade rather than settled.

- The ctor's call to `0x157e` is an internal entry inside `SMDispatchReply`, not a clean standalone subobject constructor
  A follow-up caller scan tightens the object-model uncertainty further. The only direct
  absolute call to `0x157e` in the entire plug binary is the `CSCSIPlug` ctor site at
  file `0x0be0`. But `0x157e` itself is not the start of a named helper body; it lands
  in the middle of the later `SMDispatchReply__9CSCSIPlugFsPUcUcPl` function
  (`0x139a-0x15e0`). So the earlier shorthand “the ctor passes `self+0x093a` into a
  setup helper at `0x157e`” is still literally true, but it should **not** be read as
  evidence that `0x157e` identifies the helper subobject's class cleanly. Right now the
  safe read is narrower: `self+0x093a` is a shared chooser-related subobject that the
  ctor seeds through a mid-body internal entry reused inside `SMDispatchReply`; its
  precise class identity is still open.

- The chooser-side vtable call at `0x19f0` is most plausibly the dialog `Do()` method, not a hidden transport helper
  Claude's latest harness probe isolated the second `0xd8ed` leg to the vtable call at
  file `0x19f0-0x19fa`: load `a1 = object->vtable[+0x10]`, `jsr (a1)`, then branch to
  the failure leg when `d0 == 0`. The surrounding static surface makes that call fairly
  legible. Earlier in `ChooseSCSI`, the same chooser object at `fp@(-1856)` is called
  through vtable offset `+0x0c` at `0x1776-0x1784`, which matches the natural “show the
  dialog” stage after construction. Later, after the candidate lines and prompts are
  populated, the call at `0x19e6-0x19fa` uses offset `+0x10` and immediately tests the
  boolean return. That lines up cleanly with the known `Do__7CDialogFv` body at
  `0x2280-0x22d0`, which runs the modal loop and returns `1` only when the chosen item
  equals `1`, else `0`. So the current best read is: the `A1` method Claude sees at
  `0x19f0` is the chooser dialog's `Do()`/modal-interaction method. That makes an
  `A1`-address probe optional rather than essential and reinforces the current
  explanation that the harness is still missing chooser/dialog-manager state, not a
  deeper transport-specific callback.

- The hot-path string map around `0x139a` / `0x160c` now resolves cleanly again: `0x139a` is `SMDispatchReply`, `0x160c` is `SMSendData`
  A fresh raw-symbol reread around the `0x139a` / `0x160c` region corrected my own last
  overcorrection. In this binary, the string table entries are naming the **preceding**
  function bodies, not the following ones: `SendData__9CSCSIPlugFP7IP_Data` appears
  right after the `0x0df2-0x121a` body, `SetSCSIMIDIMode__9CSCSIPlugFsUcUc` appears
  right after the `0x1240-0x12c8` body, and the same pattern continues here. So:
  `SMDataByteEnquiry__9CSCSIPlugFsUc` labels the `0x12f2-0x1370` body,
  `SMDispatchReply__9CSCSIPlugFsPUcUcPl` labels the `0x139a-0x15e0` body, and
  `SMSendData__9CSCSIPlugFsUcPUcPUclPl` labels the `0x160c-0x16d8` body. That restores
  the earlier hot-path naming: the measured CDB-construction block at `0x163c-0x167e`
  really does sit inside the `SMSendData`-named path, while the earlier
  `0x139a-0x15e0` body is the separate `SMDispatchReply` handler.
