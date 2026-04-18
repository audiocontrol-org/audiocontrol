# SendAudioBufferToSampler — Decoded Analysis

> **PARTIALLY SUPERSEDED (per issues #309, #313):**
>
> - Vtable slot interpretations in the table below are NOT all on the same vtable.
>   `vtable[0x14]` = `CAkaiSampler::vtable[0x14]` = `BuildCommand` (CAkaiMIDIDispatcher,
>   builds SysEx). But `vtable[0x30]` per the call sites (see §"MIDI/SCSI Mode Branch")
>   is on a different object — `CSamplerModule+0x74` = `CMESASocket*` per #313.
>   See [`disassembly-full/CMESASocket-vtable30-ActivateThisSocket.annotated.txt`](./disassembly-full/CMESASocket-vtable30-ActivateThisSocket.annotated.txt).
> - `vtable[0x30]` does NOT "Send SDS sample header" — it is
>   `CMESASocket::ActivateThisSocket(Uc)` at file `0x05a0a7`. A socket-state /
>   channel-activation function, NOT a transport primitive. This invalidates the
>   earlier "send SDS sample header before BULK loop" interpretation. The actual
>   SDS-header-equivalent is `AcceptSampleHeader` (vtable[0x017c]) which builds and
>   sends the 200-byte Akai header SysEx via `BuildCommand` + `CMESASocket::SendData`.
> - `vtable[0x017c]` row in the table below remains correct (AcceptSampleHeader).
>
> Kept in place to preserve the session record. The corrected upload-flow narrative
> lives in `send-sample-header-decoded.md` (with its own superseded-banner) and the
> active vtable30 artifact above.

Disassembly source: `disassembly-full/SendAudioBufferToSampler.annotated.txt`
Binary: `binaries/sampler-editor-rsrc.bin`
Disassembler: `m68k-elf-objdump -D -b binary -m m68k:68020 --adjust-vma=<offset>`
All 443 instructions fully decoded (zero `.word` placeholders except intentional A-line Mac OS traps).

---

## Function Signature

```
CSamplerModule::SendAudioBufferToSampler(MESAAudioHeader2* mah)
  file offset: 0x030713 - 0x030cc5 (1458 bytes)
  THINK C name string at 0x030cc9: SendAudioBufferToSampler__14CSamplerModuleFP16MESAAudioHeader2
  LINK A6, #-504 (frame: 504 bytes of locals + saved D3-D7/A2-A3)
  Arguments: fp(8) = this (CSamplerModule*), fp(12) = mah (MESAAudioHeader2*)
```

---

## Call Graph

All JSR/BSR targets with resolved names (EDIT code base = 0x027f57):

| Call site | JSR target | File offset | Resolved name |
|-----------|-----------|-------------|---------------|
| 0x0307ad | 0x000116 | 0x02806d | `__divsi3` (THINK C runtime: D0 = D0 / D1, signed 32-bit) |
| 0x03084b | 0x0464aa | 0x06e401 | `UExtractFromAEDesc::TheInt32` (mid-function entry) |
| 0x030855 | 0x0001a6 | 0x0280fd | `__mulsi3` (THINK C runtime: D0 = D0 * D1, 32-bit) |
| 0x030875 | 0x006766 | 0x02e6bd | `CSamplerModule::BuildSampleHeaderFromMAH` |
| 0x030913 | 0x0001a6 | 0x0280fd | `__mulsi3` |
| 0x030933 | 0x046664 | 0x06e5bb | `UExtractFromAEDesc::TheInt32` (LINK entry) |
| 0x030949 | 0x04690c | 0x06e863 | `ConcatPStr` |
| 0x030b6b | 0x0001a6 | 0x0280fd | `__mulsi3` |
| 0x030bc1 | 0x0001a6 | 0x0280fd | `__mulsi3` |
| 0x030c9d | 0x0051b4 | 0x02d10b | `CSamplerModule::BroadcastUpdateMessages` |

Vtable dispatches (all via `jsr %a1@` or `jsr %a0@`):

| Offset from vtable | Usage |
|-------------------|-------|
| vtable[0x0014] | SendData(tag, len_hi, len_lo, socket) — called for BULK, SRAW, BOFF |
| vtable[0x0028] | Unknown — called at 0x030773 via socket vtable+0x170 |
| vtable[0x0030] | Send SDS sample header (opcode=0x01, socket_ptr) |
| vtable[0x015c] | Called at 0x0307fb — likely ClearBuffer or ResetSample |
| vtable[0x017c] | SendSampleHeader(sample_number, header_buf_ptr) — sends SDS header to device |
| vtable[0x0a20] | SendProgressUpdate(ip_data_ptr) — called with UPRG/KPRG tag struct |

---

## Control Flow Overview

### Entry (0x030713–0x030737)
- `LINK A6, #-504` (file 0x030713): function prologue.
- Save `fp(8)+0xb1` byte to `fp(-499)`: saves a byte from `this+0xb1` (purpose unclear, restored at function exit via epilogue vtable call at 0x030cb7).
- `TST.L mah@(80)` (0x03072d): if `mah->total_byte_length == 0`, return 0 immediately. Confidence: high.

### MIDI/SCSI Mode Branch (0x030739–0x03075f)
- `TST.W this@(176)` (0x03073d): tests `this+0xb0`. Zero = SCSI mode. Non-zero = skip SDS header calls.
- **When 0 (SCSI mode)**: push `moveb #1, -(SP)` (opcode 0x01 = SDS dump header) then call `vtable[0x0030]` on the socket. This sends the SDS sample header before the upload begins.
- **When non-zero**: skip SDS header — no SDS header sent at all at this stage.
- Confidence: high (directly visible; the branch is unambiguous).

### Memory / Capacity Check (0x030765–0x0307e1)
- `vtable[0x0170]` (at 0x030773): reads something from the socket object, likely `GetFreeMemory`.
- `vtable[0x0134]` (at 0x030797): another call on the socket object.
- `mah@(80) / mah@(16)` via `__divsi3` (0x0307ad): computes `total_bytes / bytes_per_sample` = num_samples. Compare result to free memory. If insufficient, calls Mac A-line traps `0xa98b` / `0xa985` (SysBeep and ParamText or similar alert), returns 0.
- Confidence: medium (arithmetic visible; exact meaning of `mah@(16)` inferred as bytes_per_sample from context).

### Sample Name Setup (0x0307e1–0x030803)
- `pea mah@(21)`: pushes `mah+0x15` = sample name string (at offset 21 in MESAAudioHeader2).
- `vtable[0x015c]` on socket: sets sample name or clears state.
- Initialize packet counter `fp(-292) = 0`.

### BULK Initiation (0x030807–0x030901)
- SDS header conditional: same `this+0xb0` check as above, repeat `moveb #1` SDS header call.
- `vtable[0x00dc]` (0x030845): call on socket, result pushed as A0 argument.
- `UExtractFromAEDesc::TheInt32` (0x03084b): reads an AE descriptor value (sample number).
- `__mulsi3` with `D1=12` (0x030855): `D0 = sample_number * 12` (unknown units — possibly byte offset into a lookup table).
- `fp(-292)` added to yield `fp(-298)` = cumulative byte offset.
- `BuildSampleHeaderFromMAH` called (0x030875): constructs 18-byte SDS sample header at `fp(-498)`.
  - Args: `this`, `mah`, `movew fp(-292)` = packet index, `pea fp(-498)` = output buffer.
- `vtable[0x017c]` called (0x030895): sends the constructed SDS header to device.
  - Confidence for this being the SDS header send: high (immediately follows BuildSampleHeaderFromMAH).
- Result D0 compared to `0x7c` (124) (0x0308a3): response code dispatch.
  - **Result == 0x7c (BULK response)**: branch to `MOVE.L #'BULK', -(SP)` at 0x030813. Confidence: high.
  - **Result == 0x7f**: clear error flag, continue (0x308f5). Confidence: medium.
  - **Other**: set error code 0xcb45, continue.

### BULK Tag Send (0x0308af)
- `MOVE.L #'BULK', -(SP)` (*** ANCHOR, 0x0308af): confirmed anchor byte `2f 3c 42 55 4c 4b`.
- Push: `#BULK`, `CLR.L`, `CLR.L`, `socket_ptr`. Call `vtable[0x0014]` = SendData.
- Response checked against `0x7c` again (0x0308cf): loops back to BULK push on `0x7c`. On `0x7f` (0x0308e7): clear error and continue to main loop.
- This establishes BULK mode on the transport before sending sample data.
- Confidence: high (clear from anchor and response code handling).

### Main Sample Data Loop (0x030909–0x030c55)

Loop structure:
1. `mah@(80) * 100` via `__mulsi3` → total progress denominator.
2. Build sample name string using `UExtractFromAEDesc::TheInt32` and `ConcatPStr`.
3. Copy struct from `A4@(21614)` to stack frame: this is a fixed IP_Data template (UPRG progress struct template in A4-relative data).
4. `moveal this@(2592), A0` → `jsr %a0@` (0x030969–0x030971): call `vtable[0xa20]` = `SendProgressUpdate`. Passes pointer to IP_Data struct at `fp(-30)` containing UPRG tag.
5. Load `mah@(80)` to `fp(-6)` (remaining samples counter).
6. Compute `D7` from `mah@(132)`:
   - `D7 = mah@(132) >> (8+8+8+7)` — i.e., right-shift by 31 is arithmetic, but the sequence is: `LSR.L #8, LSR.L #8, LSR.L #8, LSR.L #7` then `ADD mah@(132)` then `ASR.L #1`.
   - **This is the integer divide by `mah@(132)` with rounding**: `D7 = (mah@(132) + mah@(132)>>31) / 2` which equals `(mah@(132) >> 1)` for positive values. Or alternatively: a chunk size formula dividing the total into halves/quarters. Confidence: medium — the exact semantic requires runtime data.

Inner loop per chunk (0x03099b–0x030bb9):
- Branch at 0x0309a1: if `mah@(16) == 1`: stereo path (interleaved), else: mono path.
- **Mono path** (0x0309a9–0x030a81): D7 samples per chunk. Byte-swap each 16-bit sample if `btst #7, mah@(107) == 0` (big-endian source needs swap). Use `_BlockMove (0xa02e)` to copy chunk to output buffer at `A1 = this@(124)`.
- **Stereo path** (0x030a85–0x030bb9): similar byte-swap loop with different stride calculation (`D0 = remaining * 4` if less than half).

After each chunk:
- If `fp(-12) == 0` (no error): `MOVE.L #'SRAW', -(SP)` (*** ANCHOR, 0x030a51 or 0x030b7b).
  - Push: `#SRAW`, `fp(-10)` (byte_count), `this@(124)` (buffer_ptr), `socket`. Call `vtable[0x0014]` = SendData.
  - This sends the raw sample audio data via SCSI Plug SendData.
  - Confidence: high (anchor confirmed; args are visible).
- Update `fp(-20)` (bytes_sent_so_far), loop back.

After loop (0x030bb9–0x030c23):
- `fp(-20) * fp(-296) (total*100)` via `__mulsi3` → progress percentage.
- `MOVE.L #'UPRG', fp(-30)` (0x030bcb): stores UPRG tag in on-stack IP_Data struct.
- `jsr %a0@` via `vtable[0xa20]` (0x030bdf): send progress update.
- `MOVE.L #'UPRG', fp(-30)` again (0x030bf7) + `vtable[0xa20]` (0x030c0b): second progress update.
- `MOVE.L #'KPRG', fp(-30)` (0x030c0d) + `vtable[0xa20]` (0x030c21): KPRG progress update.
- Confidence for UPRG/KPRG: high (tags visible, vtable call pattern clear).

### Teardown (0x030c25–0x030c55)
- `MOVE.L #'BOFF', -(SP)` (*** ANCHOR, 0x030c25): confirmed anchor byte `2f 3c 42 4f 46 46`.
  - Push: `#BOFF`, `CLR.L`, `CLR.L`, `socket`. Call `vtable[0x0014]` = SendData.
  - Terminates BULK mode.
- Increment packet counter `fp(-292)`, compare to total packets `mah@(16)`.
- If more packets remain: loop back to 0x030807.

### Final SDS Header and UALL (0x030c59–0x030c93)
- `TST.W this@(176)` (0x030c5d): MIDI mode check again.
- If SCSI mode: `moveb #1, -(SP)` (*** fourth SDS opcode 0x01 push, 0x030c63) + `vtable[0x0030]`.
- `PEA 0x5` (0x030c7b): push 5.
- `MOVE.L #'UALL', -(SP)` (0x030c7f): push UALL tag.
- `movel fp(8), -(SP)`: push this.
- `vtable[0x0028]` (0x030c93): dispatched through `*(this+4) -> vtable[0x28]` (NOT through `this+116` socket).

  **CORRECTION (resolves Codex #314).** Earlier wording called this "likely `SendData` variant for end-of-transfer" — that was wrong.

  Primary evidence (instructions at file 0x030c89-0x030c93 in `SendAudioBufferToSampler.annotated.txt`):
  ```
  030c89:  2057           moveal %sp@,%a0       ; A0 = TOS = this (CSamplerModule*)
  030c8b:  2268 0004      moveal %a0@(4),%a1    ; A1 = *(this+4) — NOT the socket at this+116
  030c8f:  2269 0028      moveal %a1@(40),%a1   ; A1 = vtable[0x28]
  030c93:  4e91           jsr %a1@
  ```

  UALL is also NOT in the SCSI Plug binary. Verified by `strings` on both binaries: `sampler-editor-rsrc.bin` contains the literal string 26 times; `scsi-plug-rsrc.bin` contains it 0 times. So `'UALL'` is an application-side command-bus token, not a wire-protocol tag.

  The `SendCommandToSampler__*` name family appears 5 times in `sampler-editor-rsrc.bin` (across `CSamplerModule`, `CProgramsSamplesView`, `CSamplerDiskView`, `CQuickAccessView`, `CFXFilerView`) — strong evidence for a shared command-bus pattern, though I have NOT decoded the inside of any `SendCommandToSampler` to confirm the same `(this+4 -> vtable[0x28])` shape is used there.

  Concrete handler behind `vtable[0x28]` is unresolved.

- Confidence: high (instructions verified; UALL string presence verified). The "SendData variant" interpretation is REFUTED.

### Epilogue (0x030c95–0x030cc1)
- `moveb #1, -(SP)` (0x030c95): push 1.
- `movel fp(8), -(SP)`: push this.
- `BroadcastUpdateMessages` (0x030c9d): notify UI of completion.
- Restore `fp(-499)` byte via vtable[0x0030] call (0x030cb7): sends the originally-saved byte back (channel/sample number restore).
- Return `fp(-12)` (error flag).

---

## MESAAudioHeader2 Field Map

Inferred from usage in `SendAudioBufferToSampler`. Confidence per field:

| Offset | Hex | Usage | Confidence |
|--------|-----|-------|------------|
| +16 | 0x10 | Loop type or num_channels (used as divisor in total_bytes/this) | medium |
| +21 | 0x15 | Sample name string (Pascal string, used in SetSampleName call) | high |
| +80 | 0x50 | Total audio byte length | high |
| +107 | 0x6b | Bit 7 = endian flag (0 = big-endian source, needs byte-swap) | high |
| +116 | 0x74 | Socket object pointer (CMESASocket*) | high |
| +124 | 0x7c | Audio buffer pointer (raw PCM data) | high |
| +132 | 0x84 | Audio chunk size (samples or bytes, used to compute D7 chunk count) | medium |

---

## IP_Data Struct Layout (on-stack, UPRG/KPRG usage)

MESA constructs IP_Data structs on the stack frame before calling `SendData`:

For **BULK / SRAW / BOFF** (pushed on system stack before vtable[0x14] call):
```
SP+0: tag      (4 bytes, e.g. 'BULK', 'SRAW', 'BOFF')
SP+4: len_hi   (4 bytes, CLR.L for BULK/BOFF; byte_count for SRAW)
SP+8: len_lo   (4 bytes, buffer_ptr for SRAW; CLR.L for BULK/BOFF)
SP+12: socket  (4 bytes, CMESASocket* = this@(116) or this@(3492)
```

For **UPRG / KPRG** (struct at `fp(-30)`, pointer passed to vtable[0xa20]):
```
fp(-30): tag   (4 bytes, 'UPRG' or 'KPRG')
fp(-26): ...   (copied from A4-relative template at compile time; fields unknown)
```

---

## BULK/SRAW/BOFF SendData Call Sequence

Sequence for one sample upload (per outer loop iteration, 0x030807–0x030c55):

1. **SDS header** (SCSI mode only): `vtable[0x0030](opcode=0x01, socket)` — sends SDS sample header.
2. **BULK open**: `vtable[0x0014](socket, BULK, 0, 0)` — opens BULK mode, waits for 0x7c response.
3. For each audio chunk:
   a. Byte-swap samples if needed (big-endian → little-endian).
   b. Copy chunk to this@(124) buffer via `_BlockMove`.
   c. **SRAW send**: `vtable[0x0014](socket, SRAW, byte_count, buffer_ptr)` — sends raw audio data.
4. **BOFF close**: `vtable[0x0014](socket, BOFF, 0, 0)` — closes BULK mode.
5. Repeat for next packet.

After all packets:
6. **UALL**: `vtable[0x0028](5, UALL, this)` — end-of-transfer signal.
7. Final SDS header (SCSI mode only).

---

## S3000 Mode / MIDI Mode

There is no explicit "S3000 mode" branch in this function. The only transport-level branching is the `this+0xb0` flag (offset 176):

- `this+0xb0 == 0`: SCSI mode — SDS sample headers are sent via `vtable[0x0030]`.
- `this+0xb0 != 0`: serial MIDI mode (or other non-SCSI) — SDS headers are skipped; only the BULK/SRAW/BOFF/UALL sequence via `vtable[0x0014]` is used.

The BULK/SRAW sequence is taken in both modes. There is no code path that uses ASPACK (opcode 0x0D) — MESA uses SDS + BULK for all sample uploads in this function. Confidence: high.

No "S3000 protocol mode" flag was found here. That feature, if it exists, must reside in a different function or in the SCSI Plug `SendData` implementation. This function does not branch on device model.

---

## Key Findings for SLNGTH Bug

The SDS sample header is built by `BuildSampleHeaderFromMAH` (file offset 0x02e6bd, called at 0x030875). That function has not yet been decoded (it is the next analysis target). The SLNGTH field in the SDS header is populated there — not in `SendAudioBufferToSampler` directly.

However, `SendAudioBufferToSampler` passes these inputs to `BuildSampleHeaderFromMAH`:
- `mah@(80)` = total byte length of the audio buffer.
- `mah@(16)` = divisor (likely bytes per sample, 2 for 16-bit mono or 4 for stereo).
- The packet index (`fp(-292)`) and the output buffer pointer (`fp(-498)`).

The pre-check at 0x0307ad computes `mah@(80) / mah@(16)` and compares to device free memory. This is the same numerator that would populate SLNGTH (total samples). Any mismatch between `mah@(80)` and the device's sample slot allocation would produce a wrong SLNGTH.

**Status**: `BuildSampleHeaderFromMAH` must be decoded next to determine exactly how SLNGTH is encoded. The inputs are now known. Confidence: high (inputs confirmed; encoding inside BuildSampleHeaderFromMAH is unknown — needs further analysis).

---

## Confidence Summary

| Claim | Confidence | Evidence |
|-------|-----------|----------|
| BULK/SRAW/BOFF/UALL call sequence | high | Anchor bytes directly visible in disassembly at cited offsets |
| MIDI mode flag at this+0xb0 | high | TST.W this@(176) + BNE skip pattern at three sites |
| Four SDS opcode 0x01 pushes | high | `moveb #1, -(SP)` at 0x030743, 0x030811, 0x030c63, 0x030c95 |
| mah@(80) = total byte length | high | Used in null-check, divide, and progress calculation |
| mah@(124) = audio buffer ptr | high | Passed directly to SRAW SendData call |
| BuildSampleHeaderFromMAH fills SLNGTH | high | Called immediately before SDS header send vtable |
| D7 chunk-size computation formula | medium | Arithmetic is visible but exact semantic needs runtime data |
| mah@(16) = bytes_per_sample | medium | Used as divisor; consistent with 2 for 16-bit mono |
| vtable[0xa20] = SendProgressUpdate | medium | Called with UPRG/KPRG struct; name inferred from tag |
| No ASPACK in SendAudioBufferToSampler | high | No opcode 0x0D anywhere in 443 decoded instructions |
| S3000 model-specific path in this function | low/absent | No model check found; absent from this function |
