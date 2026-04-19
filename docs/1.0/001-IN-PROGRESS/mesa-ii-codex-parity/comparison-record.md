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

- The early `CAkaiSampler` family in `SendAudioBufferToSampler` is no longer an opaque
  set of unnamed slots
  Claude baseline:
  the active Claude-side `sampler-editor-decoded.md` table now treats the pre-loop
  `CAkaiSampler` calls as:
  `vtable[0x0170]` unverified,
  `vtable[0x0134]` likely `GetFreeMemory`,
  `vtable[0x015c]` likely `DeleteNamedSample`,
  `vtable[0x00dc]` unverified,
  `vtable[0x017c] = AcceptSampleHeader`.
  Codex finding:
  the checked-in `CAkaiSampler` vtable anchor plus the same symbol-list artifacts used
  elsewhere in the branch give a consistent slot map for that family:
  `0x0170 = GetSamplerStatus`,
  `0x0134 = GetFreeMemory`,
  `0x015c = DeleteNamedSample(PUc)`,
  `0x00dc = GetSampleList`,
  `0x017c = AcceptSampleHeader`.
  The evidence is now high for `0x00dc`, `0x0134`, `0x015c`, and `0x017c`: in
  particular, `0x00dc` is backed by a direct tiny getter body at file offset `0x02d54b`
  returning `this+0x1c`, which fits its immediate `UExtractFromAEDesc::TheInt32` use in
  `SendAudioBufferToSampler`. `0x0170` remains the weakest of the set: it has a real
  function body and compatible call-site behavior, but not yet a full behavior decode.
  That is still enough to move the family out of the "opaque unknown slots" bucket and
  into practical parity with Claude's current direction.

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
- Direct behavioral decode of `CAkaiSampler` slot `0x0170`
  Claude baseline:
  active Claude docs still leave `vtable[0x0170]` unverified.
  Codex status:
  `0x00dc = GetSampleList` is now strengthened by a direct getter body plus a fitting
  `UExtractFromAEDesc::TheInt32` call-site use. `0x0170 = GetSamplerStatus` still rests
  on a strong address/name anchor and compatible status-word behavior. Bounded decoding
  now also shows `0x0170` testing local fields, dispatching through `this+0xc4`, and
  then using callback slots rooted at `this+0x2c` with a fallback helper when those
  fields are absent, which pushes it further toward a status/helper path and further
  away from any transport primitive. What remains unresolved is the concrete meaning of
  that status, not the general kind of routine it is.
  The neighboring raw-binary structure also now helps: `BuildSampleList` sits directly
  before `GetSamplerStatus`, and both appear to share the same state cluster, while
  `GetSampleList` is just a tiny getter returning the cached list object. That makes the
  whole pre-loop trio read as list/status preparation rather than hidden transport work.
  The program-side sibling strengthens that further: `BuildProgramList` and
  `BuildSampleList` are near-template matches whose main stable difference is whether
  they operate on the cached object at `this+0x20` or `this+0x1c`. That makes the
  sample-side path look like one specialization of a broader cached-list subsystem in
  `CAkaiSampler`, not a one-off upload routine.
  The field-use clustering points the same way: the `+0xba`, `+0xbe`, and `+0xc4`
  accesses that show up in this region are concentrated in the program-list builder,
  sample-list builder, and status helper, which makes them look like cached-list/status
  fields rather than hidden upload-transport state.
  The `+0x2c` object pushes the same direction too: its callback-slot call shape also
  appears in non-sampler graphics/view code, so it no longer looks like a
  transport-specific collaborator. The remaining ambiguity around `GetSamplerStatus`
  is increasingly about UI/list-state meaning, not transport mechanics.
  More specifically, slot `0x10` on that helper object is reused broadly outside the
  sampler path, while slots `0x50` and `0x64` still appear sampler-status-specific.
  That makes the status-only slots the more plausible place to look if this area is
  analyzed further.
  The stronger discriminator is now the full control-flow shape, not the slot numbers
  alone: the bounded `GetSamplerStatus` cluster that gates between the missing-field
  helper path and the `+0x2c -> slot 0x50` / optional `slot 0x64` path appears only in
  that region in the current primary artifacts.
  The fallback helper itself also now points away from transport: its only other direct
  call site is in a graphics-side `DrawOffscreen__10CGRPHFaderFv`-adjacent region with a
  similar `slot 0x50` / `slot 0x64` / helper control shape.
- `ActivateThisSocket(Uc)` wire behavior
  Claude baseline:
  current Claude branch now claims the function is pure in-memory state and emits no
  wire bytes.
  Codex status:
  effectively matched, with one explicit inference step remaining. Codex independently
  supports the no-wire plug-side routine `CMESAPlugIn::ActivateSocket` at `0x0a5e`, the
  existence of distinct sampler-editor `ASOK` and `CONS` templates, and the fact that
  the installed per-plug callback is already exercised with `.ASOK.....` during
  `ConnectToPlug`. Inside `CMESAPlugIn::DoMESACommand`, only two arms use the
  `SocketInfo`-style `(this, MESACommand+6)` calling convention, and they dispatch
  through vtable `+0x30` and `+0x34`. The strongest combined Codex read is now
  `CONS -> +0x30 -> ConnectToSocket` and `ASOK -> +0x34 -> ActivateSocket`, which
  reproduces Claude's "no wire bytes" conclusion for `ActivateThisSocket` in practical
  terms. The only remaining gap is a byte-perfect decode of the selector helper at
  `0x148`, not the higher-level transport behavior.
- SRAW on-wire bytes
  Claude baseline:
  prior harness text admitted inference instead of captured bytes.
  Codex status:
  independently tightened. Real `m68k-elf-objdump` now confirms that the plug-side
  `SRAW` arm at file `0x0f40-0x0f6c` packages its arguments and calls a patchable send
  slot at file `0x106e`. In the checked-in unpatched binary, `0x106e` itself is only
  `braw 0x1160`, not a concrete sender. The common block at `0x1160-0x1216` is also now
  clearer: after the send slot returns, it fans out through a callback list from
  `CSCSIPlug+24` and labels the payload as `SYSX` or `SRAW` based on the leading byte of
  `CSCSIPlug+0x0e3c`. That means static evidence still does not yield the final on-wire
  `SRAW` bytes, but it does support a sharper framing than the old harness inference:
  the unresolved question is the runtime patch installed into `0x106e` and what it
  emits, not some already-proven ASPACK wrapper inside the checked-in binary. The latest
  Codex pass also rules out one nearby candidate for that installation: the real
  `SetSCSIMIDIMode` body at file `0x12f2` computes and returns a mode word, but it does
  not write to `0x106e` or the neighboring stub region. The next static setup-path
  candidate is now ruled out too: `ChooseSCSI__9CSCSIPlugFUl` at file `0x1700-0x1afe`
  is a bus-enumeration and selection path that probes devices through
  `CSCSIUtils::Inquiry`, formats `Bus X, ID=Y` strings for dialog state, and caches the
  chosen address back into `CSCSIPlug+0x0d6e` and a per-bus slot family rooted at
  `+0x0d70`, but it still does not write to `0x106e` or the neighboring stub region.
  The static negative case is now tighter still: byte-search plus `objdump` show that
  the checked-in binary contains exactly six direct `jsr 0x106e` call sites, all inside
  the `SendData` dispatch arms, with no other literal references to `0x106e` and no
  direct literal references at all to `0x1072` or `0x1160` outside their own bodies.
  The constructor pass tightens that ownership model further: `__ct__9CSCSIPlugFv`
  clearly initializes the persistent plug-side state later used by `SendData`
  (`+0x0e38/+0x0e3c`, the per-bus cache rooted at `+0x0d70`, and flags
  `+0x0e40/+0x0e42/+0x0e46/+0x0e47`), but still does not reference the stub region.
  The same field cluster is also getting clearer semantically: `+0x0e42` is now backed
  as a timeout/configuration longword, because `SMDataByteEnquiry__9CSCSIPlugFsUc`
  compares elapsed time against it and returns `-14010` on expiry, while constructor and
  command paths treat it as mutable data. The command-side picture is now tighter too:
  `DoMESACommand__9CSCSIPlugFP11MESACommand` uses this same field cluster for plain
  control-plane updates like selected ID (`+0x0d6e`) and timeout budget (`+0x0e42`),
  plus command-result bookkeeping at `MESACommand+4`, without touching the sender-stub
  region. The nearby `SMDispatchReply`-side helper family at `0x160c-0x16d6` also now
  looks ordinary: it validates transport, builds a small control block, dispatches a
  reply command, and can fall into `SMDataByteEnquiry` for readback, but it still does
  not reference the sender-stub region. The common `jsr 0x1620` target is no longer a
  mystery helper either: it is just the shared internal entry inside that same reply
  family, reused by `SetSCSIMIDIMode`, `SMDataByteEnquiry`, and the nearby wrappers. A
  broader absolute-call sweep now tightens that again: several scary-looking local call
  targets are internal entries inside already recovered bodies rather than additional
  standalone helpers, leaving the real unresolved static surface very small. The odd
  `SHOW`-path `jsr 0x1162` is now explained the same way: it jumps directly into the
  shared post-call/report block at `0x1162`, just past the initial `tstw %d3`, to reuse
  the callback/report fan-out rather than invoke a separate helper. The other residue is
  now stranger too: `0x148` no longer looks like a normal helper body at all, because it
  overlaps the embedded `MESA SCSI Plug` string/header region. So the only clearly
  ordinary unresolved local mechanism left is the `0x106e` sender stub itself. The
  nearby `0xca2` target now collapses the same way as `0x1620`: it is a register-
  dependent internal entry inside the `0x0c88-0x0ccc` body, reused only from the same
  dispatcher family where `a2` is already live. The very low absolute targets are now
  weaker than before too: direct byte inspection shows `0x148` and `0x274` land inside
  string/table-heavy header data, not credible local code bodies, so they should not be
  treated as ordinary in-resource helpers without stronger evidence. The same is now true
  for `0x02fc`: it sits in the same dense non-code table band, not in a plausible helper
  body. External platform context now lines up with that too: classic Mac memory layout
  places low-memory globals and trap/vector tables in exactly this address range, well
  below the system heap, so these low absolute `jsr` targets are increasingly consistent
  with low-memory/system entry points rather than in-resource helper code.
  The mid/high address surface also keeps collapsing inward: `0x187e`, previously easy to
  mistake for a utility check helper, is just another internal entry inside the larger
  `0x1700-0x1afe` body, much like `0x1620` and `0xca2`. The same is now true for
  `0x1b56`, which lands inside the recovered `CSCSIUtils` constructor path rather than at
  a standalone helper boundary.
  That makes the remaining live-sender gap look less like a missed in-binary helper and
  more like external runtime patching or harness-side interception. Claude's newer
  workplan now targets that same remaining gap directly.
- UALL handler path
  Claude baseline:
  not in `SendData` TagDispatch; expected through a different vtable entry.
  Codex status:
  independently strengthened. `SendAudioBufferToSampler` dispatches `UALL` through a
  `CSamplerModule`-side `vtable[0x28]` call on `this`, not through the socket object at
  `this+116`, and raw binary search shows `UALL` appears in `sampler-editor-rsrc.bin`
  but not in `scsi-plug-rsrc.bin`. This matches the existing plug-side harness failure
  where synthetic UALL is unhandled by `SendData`. Direct disassembly of
  `SendCommandToSampler__14CSamplerModuleFlsssPcsss` at `0x0321a7` now narrows that
  path further: the upload-phase `UALL` call shares the same `this+4 -> vtable[0x28]`
  command-dispatch slot used by the broader `CSamplerModule` command channel, so the
  remaining ambiguity is the concrete module-side handler behind that generic slot, not
  whether `UALL` is a hidden plug-side transport tag. The new `CFXFilerView` parallel
  also matters here: `SendCommandToSampler__12CFXFilerViewFlsssPcsss` ultimately
  packages a local block and dispatches through the same `object+4 -> vtable[0x28]`
  slot shape. Constructor slices now tighten that further: both `CSamplerModule` and
  `CFXFilerView` install an A4-relative secondary function table at offset `+4`, then
  use slot `0x28` of that table for command routing. The new constructor-side parity
  pass strengthens that genericity again: `CProgramsSamplesView` also installs an
  A4-relative table at `this+4` with the same broad constructor pattern, even though it
  does not share `CSamplerModule`'s sampler-private state layout. The base
  `CMESAGrafPortView` constructor also installs a `+4` table, and its own
  `ListenToMessage` path dispatches through that table using other slots. That makes
  the unresolved handler look more like a shared editor/view command processor than a
  sampler-private post-transfer routine. The call-family split in
  `SendAudioBufferToSampler` is now sharper too: the earlier
  `0x0170/0x0134/0x015c/0x00dc/0x017c` calls go through the `CAkaiSampler` object at
  `CSamplerModule+0xda4` using the `object+2 -> vtable` path, while the later post-loop
  `UALL` call at `0x030c93` goes through the separate shared command table at object
  offset `+4`. So active Claude-side wording that equates UALL with
  `CAkaiSampler::vtable[0x015c]` is conflating two different call families.

### Deferred

- Full download-path parity (`GetSampleData` / `ExportSampleData`)
- Throughput comparison against the bridge implementation

## Comparison Rules

- Codex should compare against the latest Claude branch docs plus its `DEVELOPMENT-NOTES.md`,
  not only the older docs merged into other branches.
- A claim does not become `Matched` until Codex reproduces it from primary artifacts.
- If Claude already retracted or downgraded a claim, Codex should compare against the
  corrected version, not the superseded one.
