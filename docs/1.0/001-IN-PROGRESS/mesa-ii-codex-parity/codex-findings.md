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

## Open Questions

- What exact `CMESASocket` method is slot `0x30`, and what state does it change when
  called with SDS opcode `0x01`?
- Is the remaining hardware failure explained entirely by the missing socket-level
  pre/post sequence, or is there still a content-byte mismatch in the 200-byte header?
- What exactly does the `CSamplerModule`-side `UALL` dispatch at `0x030c93` signal to
  the sampler or UI layer?
