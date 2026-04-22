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

- The constructor-side registry/tag/resource branch is now a strong exclusion boundary,
  not a live sender lead
  Claude baseline:
  Claude's current Option 2 framing treats Path A as a boundary-identification exercise
  ahead of runtime harness work, not as a claim that every constructor-adjacent mixed
  region is likely to contain the sender install.
  Codex finding:
  the `0x287ee` branch now resolves into a tag-indexed registry/front-end dispatcher,
  low-address payload families, and broader file/resource-format handling tied to
  markers like `AK11`, `DATA`, `EBFX`, `EBRV`, `SMDB`, `SS30`, `PROG`, `AIFF`, `GDFS`,
  `SDIS`, and `MAHF`. Those paths line up with editor/document flows, while actual
  upload paths stay separate with `BULK`, `SRAW`, and `UALL`.
  That makes this branch a strong static exclusion rather than a primary sender lead.

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
  a standalone helper boundary. The remaining chooser-side support targets
  `0x210c/0x21dc/0x229c/0x218a` are now clearly `CDialog` plumbing rather than anything
  on the SRAW send path.
  More importantly, the checked-in bytes at `0x106e` now look even less like a usable
  sender body: every `jsr 0x106e` return site expects arm-local result handling and
  stack cleanup before the later shared `bra 0x1160`, but the static bytes at
  `0x106e` are only `bra 0x1160` and would skip that work entirely if executed as-is.
  One more nearby target has now collapsed too: `0x0d54`, called from one `SendData`
  arm, lands inside the tail/epilogue of `DoMESACommand` immediately before the
  embedded `DoMESACommand__9CSCSIPlugFP11MESACommand` symbol string, not at a
  standalone helper boundary.
  More broadly, the direct absolute `jsr` targets inside `SendData` are now basically
  classified: `0x0148` is low-memory/nonlocal territory, `0x0ca2` and `0x0d54` are
  internal entries, `0x0dfc` is the selector/send dispatcher, and only `0x106e`
  remains as an unresolved ordinary local target.
  The Sampler Editor socket layer has now been tightened too: `ConnectToPlug` installs
  the per-plug callback into the socket slot record, `SelectPlug` only updates the
  selected slot index, and both `ActivateThisSocket` and `CMESASocket::SendData` read
  that same installed callback from slot-base `+8`. So the current host-side evidence
  does not support per-send callback rewriting inside the recovered socket layer.
  One step higher, `OpenModule` appears to pass the generic module/editor command-proc
  stored at `this+0xa20` into `ConnectToPlug`, not a dedicated plug-owned callback
  field. That suggests the best remaining host-side place to look for special descriptor
  preparation is the command-proc path behind `+0xa20`, not `SelectPlug` or
  `CMESASocket::SendData`.
  The current artifact set also strengthens that boundary: `this+0xa20` has one clear
  direct install in the `InitModule` / `SetCommandProc` path and is then broadly reused
  as a callback field from many later call sites, rather than being visibly rewritten in
  `OpenModule`.
  The constructor-region function around `0x05965f` also clears `this+0xa20`, which
  makes the lifecycle sharper: constructor clears it, `InitModule` installs it,
  `OpenModule` later consumes it. That pushes the next owner-boundary question to the
  caller of `InitModule` / `SetCommandProc`.
  The same field now also looks editor-framework-owned rather than sampler-specific:
  the constructor/destructor/`DoMESACommand` region labeled for `CMESAEditor` is where
  `+0xa20` is cleared and later tested, while `CSamplerModule::OpenModule` merely reuses
  it when handing a callback into `ConnectToPlug`.
  The next owner edge is still not visible as a simple local call either: a direct
  control-transfer sweep found no straightforward local branch or absolute-`jsr` hits
  targeting `InitModule` / `SetCommandProc` at `0x0286f3` inside the recovered resource.
  A new bounded search narrows one tempting alternative too: the exact
  `this -> this+4 -> slot+0xac` indirect-call shape appears only twice in the current
  `sampler-editor-rsrc.bin`, once inside the named
  `BroadcastUpdateMessages__14CSamplerModuleFUc` path bracketed by `SSOL`/`UEND`
  message tags and once in a nearby command path bracketed by `EDKGH` and later `UALL`.
  The surrounding tag wrapper is now named too: file `0x028980` resolves to
  `DoMESACommand__14CSamplerModuleFP11MESACommand`, so those nearby four-character tags
  are explicit `CSamplerModule` command traffic rather than an unknown install helper.
  The second site is now anchored more tightly as well: it sits inside the function whose
  trailing symbol string is `ObeyCommand__14CSamplerModuleFlPv`, so both currently
  observed `+0xac` edges belong to named `CSamplerModule` command/update paths.
  In other words, the observed `+0xac` sites are currently better modeled as shared
  framework message-routing calls than as the owner-side install edge for `+0xa20`.
  A further bounded negative check now supports that same boundary from another angle:
  the checked-in `sampler-editor-rsrc.bin` contains no big-endian literal references to
  the recovered `InitModule` / `SetCommandProc` / `CMESAEditor` entrypoints, and no
  alternate straightforward direct-store encodings to `this+0xa20` beyond the already
  known install/use sites. So the missing owner edge is not just "not a simple call";
  it also does not currently show up as an ordinary in-resource pointer trail.
  The field also now looks even more generic than before: `BusyCursor__11CMESAEditorFUc`
  and `BarCursor__11CMESAEditorFUc` both test and dispatch through `+0xa20`, so the
  current artifact set treats it as a broader editor-framework callback sink rather than
  a sampler-upload-specific hook. The full observed compare surface now points the same
  way: the seven current `cmp this+0xa20` sites sit in `GetPlugList`, the
  `CSamplerModule::DoMESACommand` / `UALL` region, `CreateQuickAccessWindow`, `Redraw`,
  `SelectWindow`, `BusyCursor`, and `BarCursor`, with no observed compare site landing in
  a dedicated sender-install helper. A broader `move.l ..., this+0xa20` sweep now points
  the same way from the write side: beyond the known `SetCommandProc` installer at
  `0x0286f3`, the current artifact set does not expose a second ordinary `move.l` store
  into `+0xa20`, including the same stack-to-field encoding family used by that setter.
  The installer body itself also looks generic rather than sampler-private: the adjacent
  symbol strings identify it as `CMESAEditor::SetCommandProc` as well as
  `CSamplerModule::InitModule`, with no second specialized implementation visible between
  those anchors. The constructor side also now looks less like a clean code-only graph
  than before: `__ct__11CMESAEditorFv` makes one direct absolute call into the
  tag-heavy `0x287ee` band near the `OTFL` / `DATA` / `SS30` records, rather than only
  into ordinary named function bodies. That `0x287ee` target now looks mixed rather than
  dead: the front of the region is now decoded as a fixed 6-byte tag/offset table
  (`OTFL`, `aeCT`, `aeDL`, `aeGE`, `aeGP`, `aeMN`, `aeSP`, `aete`), and later bytes in
  the same band execute a tag-comparison/dispatch path. Those offsets resolve to local
  case-arm entries inside the same region rather than to far-away handlers, so the
  current best read is a self-contained tag-indexed front-end dispatcher. The next fan-out
  layer is still opaque, though: the local case arms call low-address payload targets
  like `0x00a382`, `0x00a4f6`, `0x00a62c`, `0x00b382`, `0x00c150`, and `0x00c304`, and
  those targets still look like dense low-address table/data bands rather than ordinary
  recovered helper bodies. Bounded checks over those payload targets also found none of
  the known `+0xa20` callback signatures and none of the usual `link` / `rts` / absolute
  `jsr` markers of ordinary recovered m68k functions. The table is also more compact than
  a naive one-tag/one-handler map: several tags land in the middle of a shared local
  ladder and reuse the same downstream payload-handler tails. The two most distinctive
  entries, `OTFL` and `aete`, now look like setup-style entries: `OTFL` packages literal
  `AK11` / `DATA` tags before calling `0x006ac2`, while `aete` pushes literal `aete`
  before calling `0x00a9a0`, and both then converge on the shared ladder. Those setup
  helpers also still live in the same opaque low-address format and still do not show the
  known `+0xa20` callback signatures or ordinary m68k function markers. The opaque
  payload layer is not uniform, though: `0x006ac2` has a distinct byte profile from the
  later `0x00a382` / `0x00a4f6` / `0x00a62c` / `0x00a9a0` / `0x00b382` / `0x00c150` /
  `0x00c304` group, which shares a more self-similar grammar-like token pattern. That
  grammar-like subfamily also overlaps low-address parameter/help text regions such as the
  `LFO 1 rate` / `LFO 1 depth` area near `0x009f57`, which suggests declarative resource
  metadata rather than hidden executable helper code. The distinct `0x006ac2` subfamily
  also recurs across the same broad low-address resource neighborhood, with repeats near
  parameter/help strings and UI class strings like `CGraphicControlList` and `CPopup`,
  while still lacking ordinary m68k function markers. The tag vocabulary itself also
  recurs in later mixed regions such as `0x02ea2d` (`AK11` / `DATA` plus
  `EBFL` / `EBFX` / `EBRV` / `PSYS` / `SMDB`) and `0x031e15`
  (`SMDB` / `SS30` / `PROG`), which makes the `0x287ee` registry look like one front-end
  view onto a broader tag-based resource/type system. Some of those tags are now anchored
  to concrete sampler-module editor/file flows too: `EBRV` / `EBFX` / `SS30` appear in
  the neighborhoods of `CreateFXFilerWindow` and `SaveEB16Reverb`, pushing their meaning
  toward resource/document handling rather than callback installation. The real upload
  paths stay separate: `SendAudioFileToSampler` and `SendAudioBufferToSampler` keep using
  `BULK` / `SRAW` / `UALL`, while the resource-tag neighborhoods carry
  `EBRV` / `EBFX` / `SS30` / `SMDB` / `PSYS` / `AK11` / `DATA` instead.
  Those tags also now behave like explicit file/type markers inside named save/load
  flows: `OpenDraggedFile` writes `MAHF`, the nearby mixed region checks `AK11` and
  `DATA`, and the EB16 save paths write `EBFX` and `SS30` before calling later helpers.
  Later mixed blocks go further and dispatch on those tags explicitly: the region around
  `0x031e00` checks `SMDB`, `SS30`, and `PROG`, then routes into `GDFS` / `SDIS` helper
  calls as part of save/load-style logic. Those helper tags also stay in the file/resource
  world: the same neighborhood contains `LoadVersion1ProgramFile`,
  `LoadVersion2ProgramFile`, `LoadAllAIFFInFolder`, `LoadDiskDBaseFile`, and literal
  `AIFF`, and `LoadAllAIFFInFolder` also calls the distinct `0x006ac2` helper family.
  That makes the remaining live-sender gap look less like a missed in-binary helper and
  more like external runtime patching or harness-side interception. Claude's newer
  workplan now targets that same remaining gap directly. The far-out table/index layer
  also tightened in this pass: the dense `0x07b212` rows do not point back to the local
  `0x0000ce24` root, but to longword payloads like `0x0001ce24`, `0x0001ce52`, and
  `0x0001ce80`. Those payloads resolve to repeated structured descriptor blocks with
  nearby loop-parameter/help strings such as `3rd loop length.` and `loop dwell 3`,
  which makes that region a stronger UI/resource catalog exclusion rather than a hidden
  owner-side callback-install path. The lone far-out `0x0000ce28` table site now points
  the same way: its surrounding record re-encodes the already-known
  `0x000273fa` / `0x000317dc` / `0x0002d6f6` / `0x0000ce28` helper family seen directly
  in the `CSamplerModule` constructor/main/destructor neighborhood, so it also looks
  like lifecycle metadata for the existing scaffold surface rather than a new sender
  boundary. Claude's newer Path A/A.5 pass materially revises one part of that broader
  Codex framing, though: Codex spot-checks now confirm a fifth direct constructor call
  (`jsr 0x00027e00` at file `0x0596fb`) and show that `0x02797c` and `0x0287a8`
  resolve to real framework code under the corrected EDIT base rather than to data/string
  bands. More importantly, the static table at `0x071a1f` contains an entry
  `0x0003194e` at `0x071a53`, which maps to real code at `0x0598a5` immediately before
  the `CMESAEditor::DoMESACommand` symbol band. So for the editor-side reply path, the
  current best shared model is now compile-time vtable binding inside the recovered
  graph, not a runtime install edge outside it. The older Codex "outside the recovered
  graph" conclusion should now be read as applying only to the narrower direct `+0xa20`
  install hunt, not to the full reply-handler path. Claude's newer Path A.6 result also
  survives Codex spot-checking on the plug side: the `$11fe` callback path does a
  `moveal (A0),A0; jsr (A0)` through `plug_slot[+0]`, and `CMESAPlugIn::ConnectToSocket`
  verbatim-copies the incoming 46-byte `SocketInfo` into the plug slot. So the live
  plug-side callback is now best modeled as `SocketInfo[+0] -> plug_slot[+0]`, not
  `SocketInfo[+12]`. That shifts the remaining static target one step cleaner again:
  the unresolved identity is the editor-side function address transmitted as
  `SocketInfo[+0]` in the `CONS` payload.
  Codex has now also reconciled the apparent remaining conflict with the editor-side
  `ConnectToPlug` disassembly. The measured split is:
  - `PLST` phase: `ConnectToPlug` calls the immediate handler callback, gets a 48-byte
    descriptor array back, and installs `descriptor[+12]` into editor-local socket slots
    (`editor_slot[+8]`)
  - `CONS` phase: `ConnectToPlug` builds a second command block, points it at `this+24`,
    and the plug later verbatim-copies that 46-byte `SocketInfo` so
    `SocketInfo[+0] -> plug_slot[+0]`
  So the current Claude/Codex model is aligned: `descriptor[+12]` and `SocketInfo[+0]`
  belong to different halves of the same exchange rather than competing explanations for
  the same field.
  Codex also tightened the residual `SocketInfo[+12]` question from primary artifacts:
  `CMESASocket::AcceptData` is now the first concrete post-ctor writer to
  `CMESASocket[+12]`, and it writes either `IP_Data[+8]` on success or literal `OVER`
  on failure. That makes the field look like reply/result bookkeeping rather than the
  live callback used at plug `$11fe`.
  Codex also now has a bounded pressure point on the remaining `CONS -> this+24`
  interpretation: within the currently recovered `CMESASocket` method surface, there is
  still no direct overwrite of socket `this+24`, and the only concrete value in hand for
  embedded-socket `+24` remains the ctor seed `0x212`. That does not refute Claude's
  current `SocketInfo[+0]` frontier, but it does make the next question sharper:
  whether the payload view is transformed through another layer before the plug sees it,
  or whether the overwrite happens outside the currently recovered socket-method set.
  Codex has now also validated the concrete candidate behind that ctor seed: the stored
  EDIT-relative value `0x212` resolves to file `0x028169`, whose raw bytes form a real
  callback-shaped function entry (`link`, saved registers, one stack arg, immediate
  THINK C world-setup call, then an `INIT` tag check on the incoming struct). That does
  not close the `SocketInfo[+0]` question yet, but it raises the status of Claude's
  current candidate from loose speculation to the strongest concrete function candidate
  currently visible in the recovered graph.
  Codex has now pushed one layer deeper into the main-app callback body too. The
  callback at `0x1e5a` in `mesa-ii-app` `CODE 1` is no longer just a named target; it
  is now bounded as a host/editor command dispatcher. The visible fan-out from
  `SendCommandToEditor` goes through an inline tag table and reaches app-side service
  handlers whose nearby symbol strings identify `BusyCursor`, `BarCursor`,
  `HandCursor`, `ActivateCurrentEditor`, `MESADeleteMenu`, `MESAInstallMenu`, and
  `DispatchCommandFromModule`. A bounded string scan over the same `CODE 1` body still
  shows loader-side `PLUG` / `EDIT` / `INIT` vocabulary but no visible `SCSI`, `MIDI`,
  `CONS`, `ASOK`, `SRAW`, `UALL`, or `BULK` terms. So the direct callback body now
  looks host/editor-service-facing rather than like an obvious plug-transport patcher
  path. That still leaves room for indirect downstream effects through service/module
  handlers, but it narrows the simple patch hypothesis further.
  Codex has now also tightened the one callback-side helper that still looked capable of
  hiding something more consequential. The shared helper at `0x1630`, reached from
  several `SendCommandToEditor` branch stubs, is also referenced from the broader
  plug-scan/load surface and bounded bytes there show explicit compares against `PLUG`
  and `AK11`. So the strongest current read is that this helper belongs to typed module
  discovery/registry work reused by both loaders and callback paths, not to a
  transport-specific patch path. That still leaves downstream module/service effects
  open, but it narrows the direct callback body another step toward host-side service
  dispatch and away from an obvious patcher.
  Codex has now also closed the plug-side selector gap from raw bytes alone. In the
  inline selector table embedded directly after `CMESAPlugIn::DoMESACommand`'s
  `jsr 0x0148`, the offset word for `CONS` sits at file `0x08de` with value `0x002e`,
  which lands exactly on the `0x090c` `(this, MESACommand[+6]) -> vtable+0x30` arm.
  The offset word for `ASOK` sits at file `0x08d2` with value `0x0052`, which lands
  exactly on the `0x0924` `(this, MESACommand[+6]) -> vtable+0x34` arm. The adjacent
  symbol-string anchors remain consistent with the earlier body identities:
  `ConnectToSocket__11CMESAPlugInFP10SocketInfo` at `0x09d2` and
  `ActivateSocket__11CMESAPlugInFP10SocketInfo` at `0x0a5e`. So the current
  Claude/Codex model is stronger than before: the selector table itself now proves
  `CONS -> ConnectToSocket` and `ASOK -> ActivateSocket`, leaving the remaining question
  entirely on the editor side of the `CONS` payload rather than in the plug's own arm
  mapping.
  Codex also now has a tighter read on the outbound SRAW preamble inside
  `CSCSIPlug::SendData`. Raw `objdump` of file `0x0ec0-0x1072` shows the measured
  `SRAW` branch at `0x0f40` comparing `IP_Data[+8]` against literal `'SRAW'`, then
  pushing a seven-argument frame and calling the shared sender entry at `0x106e`
  without any visible inline CDB-byte writes or nibble-expansion logic. The adjacent
  non-`SRAW` branch is the one that performs direct byte inspection (`0xf0`, `0x47`,
  `0x48`) and reconstructs a doubled length from bytes `11..14` before calling
  `0x106e`. So the current Codex read is sharper than "SRAW unresolved": the measured
  pre-`0x106e` SRAW path looks like a higher-level raw send shape handed to the shared
  sender, while the more explicit byte-level header work lives in the neighboring
  non-`SRAW` path.
  Codex now also has a cleaner read on `0x1072`: it is not a second final emitter, but
  a wrapper around the same unresolved shared sender contract. Raw `objdump` of
  `0x1072-0x10c2` shows it copying `%a3@(4)` into a local source pointer, setting
  transient bytes at `CSCSIPlug+0x0e46/+0x0e47` based on bit 7 of the first source
  byte, and then calling `0x106e` at `0x10b2` with the same broad seven-argument send
  shape used by the measured SRAW branch. That further narrows the static frontier:
  the unresolved question is the shared sender contract itself and what those transient
  state bytes mean for wire emission, not whether `0x1072` is a separate hidden answer.
  Codex now also has a stronger structural read on that shared sender contract. Raw
  `objdump` over file `0x0ec0-0x1160` shows six direct `jsr 0x106e` call sites at
  `0x0f60`, `0x0fbc`, `0x102c`, `0x10b2`, `0x10f8`, and `0x1144`, collapsing into four
  measured caller families rather than one SRAW-specialized helper:
  the measured `SRAW` arm at `0x0f60`,
  a sibling mode-`#0` arm at `0x0fbc`,
  a derived-length path at `0x102c`,
  and the wrapper-driven variants at `0x10b2` / `0x10f8` / `0x1144`.
  All four converge on the same post-send/report block at `0x1160`. So the remaining
  open question is now better framed as the parameter contract of a central send engine,
  not “what hidden SRAW helper lives before `0x106e`?”
  Codex has now tightened that parameter-contract framing further. Direct `objdump` of
  file `0x0f40-0x1144` shows all six `jsr 0x106e` sites pushing one stable seven-slot
  call frame:
  `self`,
  selected-target word from `CSCSIPlug+0x0d6e`,
  one-byte mode flag,
  source pointer,
  nullable context long,
  `%a3@` long,
  and `&fp@(-30)` output-length pointer.
  The branch-local differences are concentrated in the mode/source/context positions,
  not in different outer call shapes. So the remaining open static question is now the
  wire meaning of those varying fields, especially the mode byte, the nullable context
  long, and the `%a3@` long that stays live across all caller families.
  Codex now also has a cleaner front-end routing read on `IP_Data` itself. Before any
  branch-specific send logic runs, `SendData` clears `CSCSIPlug+0x0d6e`, loops over
  connected entries, compares a per-entry long loaded from `self@(62 + 46*i)` against
  `IP_Data[+12]`, and on match copies a per-entry word from the `0x0d72`-rooted table
  into `CSCSIPlug+0x0d6e`. If no match is found, `SendData` returns `-14000`
  immediately. So `IP_Data[+12]` is now measured as the front-end routing key that
  selects the downstream target word used by every later `0x106e` caller family.
  Codex has now also resolved the persistent `%a3@` long in the shared sender frame.
  Direct `objdump` of `CMESASocket::AcceptData` at `0x05a1e1` shows `%a3@` being used
  as copy length, compared against socket capacity, and then stored into `this@(4)`,
  while `%a3@(4)` is the payload pointer and `%a3@(8)` is the reply/result tag.
  Combined with the measured `SendData` frame layout, that means the stable `0x106e`
  caller frame is no longer carrying an opaque extra long there: it is carrying byte
  count. This narrows the remaining sender-side semantic unknowns to the mode byte and
  the nullable context long.
  Codex has now also tightened that nullable context long. In its nonzero form, every
  measured `0x106e` caller family passes the same constructor-seeded `CSCSIPlug+0x0e3c`
  value, which the shared post-send/report block later stores into its local report
  block and dereferences to choose `SYSX` versus `SRAW` by first byte. So the remaining
  sender-side semantic unknowns are now basically the mode byte and the exact wire-path
  distinction between `arg4 = 0` and `arg4 = CSCSIPlug+0x0e3c`.
  Codex has also added one more measured restriction on that split: mode byte `#1` is
  only observed together with nonzero `arg4 = CSCSIPlug+0x0e3c`, while zero-context
  sends are only observed in a subset of mode-`#0` branches (`0x102c`, `0x1144`) that
  also perform extra branch-local work around `0x106e`. That does not yet identify the
  exact semantics of mode `#1` vs `#0`, but it does show that `arg4 = 0` is not a
  general alternative caller shape. It is a narrower subcase within mode-`#0`.
  Codex now also has a cleaner pre-send gate above that matrix. `SendData` tests
  `CSCSIPlug+0x0e40` at `0x0e9e`; if it is unset, it calls `0x0ca2(self, target, 1, 1)`,
  stores the returned byte into `+0x0e40`, and if the byte is still zero it branches
  directly to the wrapper path at `0x1072`. Only when `+0x0e40` is nonzero does
  execution continue into the later direct `%d6`/`SRAW` family. So `+0x0e40` is now
  measured as an earlier routing flag that decides which sender-family surface is even
  reachable before the shared `0x106e` contract comes into play.
  Codex has tightened that field one step further: `+0x0e40` has only five in-binary
  touches at all: constructor clear, two send-path tests, one `0x0ca2`-fed store, and
  one cold-arm clear. That makes the current best static read narrower than “mode
  byte” or “general plug setting.” It looks more like a sticky cached pre-send
  capability/state byte that `SendData` refreshes through `0x0ca2` before choosing
  wrapper versus direct sender family.
  Codex has now also tightened the `0x0ca2` side of that story. Correcting the helper
  alignment yields a real parent body at `0x0c8a`, but the direct `SendData` call sites
  enter at the internal label `0x0ca2`. From that internal entry onward, the recovered
  local code only touches `self@(0x0e38)`, the nested `jsr 0x0274`, `%fp@(12)`, and the
  optional `jsr 0x1b56`; it does not explicitly inspect the `0/0` vs `1/1` caller flags
  that `SendData` pushes before `jsr 0x0ca2`. So the remaining semantics of that gate
  are now pushed one layer deeper again: into the trap/helper layer below the recovered
  local instructions, not into any still-missed branch logic around `0x0ca2` itself.
  Codex has tightened that deeper layer one step further too. The two obvious named
  callees under `0x0ca2` do not reopen an ordinary local-code explanation:
  `0x0274` lands in the same low-address non-code band already seen elsewhere, while
  `0x1b56` is just a constructor-side internal entry inside a larger helper body. So the
  remaining pre-send-gate semantics are now below both the visible `0x0ca2` local code
  and the obvious next two callees.
  One more alternate-source escape hatch is now closed too. Direct byte comparison of
  the checked-in `scsi-plug.macbin` against the extracted `scsi-plug-rsrc.bin` shows a
  zero-length data fork, a `12053`-byte resource fork, full resource-fork equality, and
  identical bytes at the sender-stub offsets
  (`0x106e = 600000f0`, `0x1070 = 00f02d6b`). So for the binary sources currently in
  the repo, "look at the MacBinary copy instead" does not reopen a different sender
  body. The remaining explanations are runtime patching, a different binary source not
  yet in hand, or another nonlocal mechanism beyond these identical artifacts.
  Codex has also now pushed one level harder on the `SMSendData` candidate without
  overpromoting it. Bounded `objdump` of file `0x160c-0x16d6` shows the candidate body
  reading exactly the same outer argument layout that Codex already measured at the
  direct `jsr 0x106e` sites:
  `self`,
  target/channel word,
  one-byte flag,
  source pointer,
  nullable long,
  byte count,
  and output pointer.
  The candidate body then uses those fields in a way that fits the current parity model:
  the byte count is split into three outbound header bytes, the one-byte flag is turned
  into `0x80` versus `0x00`, and the nullable long is not needed for the primary
  emission call but is only tested and forwarded on an optional follow-on branch.
  That still leaves the `0x106e -> 0x160c` identity at `CANDIDATE`, but it is now a
  stronger structural fit across the whole measured caller family, not just the SRAW
  arm alone.
  Codex has now also pushed one step into that optional branch. The nested helper at
  `0x139a-0x15dc` reads the forwarded extra argument as a pointer, dereferences it
  immediately, uses it as a mutable byte-count/control slot across repeated send loops,
  and writes the accumulated count back through it. That means the nonzero-vs-zero
  `arg4` split in the measured `0x106e` caller family is now less vague than before:
  under the `0x160c` candidate model, nonzero `arg4` would enable a tracked follow-on
  send/readback path, while zero `arg4` would skip that path entirely.
  This still does not prove that the measured `arg4 = CSCSIPlug+0x0e3c` is exactly that
  control structure, but it is another structural match that strengthens the candidate
  without promoting it past `CANDIDATE`.
  Codex has now also tightened the source of that nonzero argument itself. The only
  visible store to `CSCSIPlug+0x0e3c` comes from the first longword of the allocated
  `+0x0e38` block, and the later observed uses are all pointer-like:
  the post-send/report block loads it as an address and tests its first byte, and the
  strengthened `0x160c -> 0x139a` candidate path forwards it into a helper that
  dereferences and writes back through the same argument slot. So `+0x0e3c` is now a
  better fit for a pointer-bearing control root than for a generic scalar mode/context
  word. This still stops short of proving exact identity, but it narrows the candidate
  model in the same direction rather than against it.
  Codex has now also identified the sharpest remaining pressure point against the exact
  current mapping. The measured nonzero-`arg4` caller family includes the
  `0x0f70-0x0fbc` path, which is only reached after the source buffer matches a literal
  Akai SysEx header shape starting with `0xf0`. But after the strengthened
  `0x160c -> 0x139a` candidate path, `0x139a` appears to write count/control state back
  through the forwarded pointer, while the later common `0x1160` report block still
  loads `self@(0x0e3c)` as an address and classifies the payload as `SYSX` only when
  the first byte at that pointee is `0xf0`. So if measured `arg4 = +0x0e3c` is exactly
  the mutable `count_ptr` consumed by `0x139a`, the later `SYSX` / `SRAW` tag check
  would appear to be reading a location already overwritten with count/control data.
  That is not yet a disproof, but it is now the strongest unresolved tension in the
  exact `0x106e -> 0x160c` candidate mapping.
  Claude's new offline harness result now sharpens the same seam from the other side.
  The harness can drive `SendData` far enough to report a BULK CDB shape
  `0c 00 00 01 96 80` at the `$1106E` slot boundary, but the checked-in plug still does
  not expose a real body at file `0x106e` itself. A fresh bounded static pass confirms
  the strengthened `0x160c-0x16d6` `SMSendData` candidate still does concrete CDB
  construction below that slot: it writes local opcode byte `0x0c`, stores the three
  low bytes of `%d7` as the transfer length, derives local flag byte `0x80` versus
  `0x00` from `%fp@(14)`, and only then drops into the deeper helper at absolute target
  `0x1620`. So the current best parity read is now narrower and more useful to the
  emulator effort:
  the offline harness result is structurally consistent with the candidate send body,
  but an intercept at `$1106E` still bypasses the in-plug CDB-construction layer rather
  than proving what lies below the first real transport boundary.
  Codex has now also closed the remaining obvious editor-side literal patch search on
  the installed `mesa-ii-app`. A direct parse of the app's resource map shows eleven
  CODE resources, and a bounded byte search over all of them finds no literal
  references to `0x106e`, `0x1070`, or `0x160c`, and no direct `JMP` sequence to either
  address. The only loose `600000f0` match in `CODE 2` (`Libraries`) is just an
  ordinary local branch in context. So the surviving app/editor install theories are
  now narrower: non-literal setup, object/service wiring, or some runtime path that
  reaches the send body without a simple visible slot patch sequence.
  Codex has now also identified the first concrete raw transport primitive inside the
  plug. The unnamed utility body at file `0x1bbe-0x1d1e` is explicitly labeled by the
  following symbol string as `SCSICommand__10CSCSIUtilsFsP3CdbPUcUlls`, and bounded
  `objdump` shows it building a PB-like structure, copying six CDB bytes into offsets
  `68..73`, storing the data pointer and payload length, selecting one of three control
  values, and then calling `_SCSIDispatch` at file `0x1cd8`. So the remaining harness
  loop after `SMSendData` CDB construction is now best modeled as still sitting above
  `CSCSIUtils::SCSICommand`, in the wrapper chain that should hand the local CDB and
  payload down to the utility layer.
  Codex has now also re-checked the two helper addresses Claude asked about from that
  seam. In the current static artifact set, `0x1620` still does not look like a missing
  install slot; it is the shared internal entry inside the `0x160c-0x16d6`
  `SMSendData`/wrapper family, reused by five absolute call sites. Likewise, `0x187e`
  does not look like a standalone late-bound target; bounded `objdump` over the larger
  `0x1700-0x1afe` family shows `0x187e` landing mid-body with no prologue, and its
  three callers all use the same selector-word + `self+0x093a` gate shape before
  testing `%d0`. So the sharper current read is:
  Musashi's remaining problem is more likely helper semantics or surrounding state than
  a simple unresolved install of `0x1620` or `0x187e`.
  The new symbol-string pass tightens that further. The string immediately before
  `0x1700` names the whole `0x1700-0x1afe` body as
  `SMSendData__9CSCSIPlugFsUcPUcPUclPl`, while the next symbol string only begins at
  `0x1afe` with `ChooseSCSI__9CSCSIPlugFUl`. So Claude's runtime `0x1187e` observations
  map back to file `0x187e` inside the large `SMSendData` body, not to a separate named
  helper region. That means the old function-index view is stale in the exact region
  the harness is now exercising, and the right model is: internal `SMSendData` entry
  points with shared caller-state assumptions, not a late-bound helper waiting to be
  installed.
  One more consequence now looks stable enough to say out loud: the `0x187e` /
  runtime-`0x1187e` path is visibly UI/dialog-heavy. The same large `SMSendData` body
  allocates a dialog-like object, dispatches through dialog methods, formats strings
  like `Bus X, ID=Y:`, and calls helpers that land in the `CSCSIDialog` method region.
  So Claude's observed `ModalDialog` trap is statically consistent with the code, which
  shifts the harness question again: why the send flow is reaching the dialog/error
  branch, not whether Musashi has simply jumped into an invalid helper target.
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
