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
- Can Codex prove which of the two `SocketInfo`-style plug-dispatch arms
  (`vtable+0x30` at `0x090c` vs `vtable+0x34` at `0x0924`) is the `ASOK` activation
  arm, and which is the `CONS` connect/query arm, from the selector helper alone rather
  than from the current stronger combined inference?
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
