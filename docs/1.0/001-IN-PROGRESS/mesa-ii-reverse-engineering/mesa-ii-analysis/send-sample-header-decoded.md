# AcceptSampleHeader (vtable[0x017c]) — Decoded Analysis

> **PARTIALLY SUPERSEDED (per issue #310/#311):**
>
> Specific claims below have been superseded by later decoding:
>
> - The "**SysEx payload is 406 bytes**, CDB length `0x000196`" claim is WRONG.
>   Correct wire format is **392 bytes** (CDB length `0x000188`). See
>   [`sysex-builder-decoded.md`](./sysex-builder-decoded.md) §4 for the
>   definitive byte layout: 5-byte header + 2-byte `sample_number` field (via
>   `Set7BitWord`) + 384 nibble bytes (Nibbleize of header[0..191] only, not
>   all 200 bytes) + `0xF7`.
> - Any claim here that `header[26..29]` SLNGTH is "nibble-encoded" is WRONG.
>   The actual encoding is `SwapLongWord` (32-bit byte reversal). See
>   [`cakaidispatcher-slot38-swaplongword.md`](./cakaidispatcher-slot38-swaplongword.md).
>
> What IS still correct: the function's 3-step flow (build SysEx via
> `vtable[0x14]` → send via `CMESASocket::vtable[0x14]` → wait for SDS reply
> via `vtable[0xCC]`), the call-site trace to `vtable[0x017c]`, the object
> hierarchy discussion, and the reply-parsing logic.
>
> Kept as-is (not deleted) to preserve the session record of how the finding
> evolved.

**Binary:** `binaries/sampler-editor-rsrc.bin`  
**Function file offset:** 0x06ae09 - 0x06aeb7 (174 bytes executable, 220 bytes to name string)  
**THINK C name string at 0x06aeb9:** `AcceptSampleHeader__12CAkaiSamplerFPUcs`  
**Disassembly source:** `disassembly-full/AcceptSampleHeader.annotated.txt`  
**Caller:** `SendAudioBufferToSampler__14CSamplerModuleFP16MESAAudioHeader2` at file 0x030895  
**Date:** 2026-04-16 (superseded-in-part 2026-04-17 per #310/#311)

---

## 1. How vtable[0x017c] Was Located

The call at file offset **0x030895** in `SendAudioBufferToSampler` dispatches:

```
030883:  2f28 0da4  movel %a0@(3492),%sp@-   ; push this[0xDA4] = CAkaiSampler*
03088b:  2057       moveal %sp@,%a0           ; A0 = CAkaiSampler*
03088d:  2268 0002  moveal %a0@(2),%a1        ; A1 = vtable ptr (at object+2)
030891:  2269 017c  moveal %a1@(380),%a1      ; A1 = vtable[0x017c]
030895:  4e91       jsr %a1@                  ; indirect call
```

`this+0xDA4` (decimal 3492) is confirmed as a `CAkaiSampler*` by the `CSamplerModule`
constructor at file 0x02820d (calls `__ct__12CAkaiSamplerFv` on the allocated block).
The vtable pointer is at `object+2` (not `object+0`) on `CAkaiSampler` — confirmed by
`AcceptSampleHeader` itself at 0x06ae37-0x06ae3d where `this` is loaded at A0 and
`moveal %a0@(2),%a1; moveal %a1@(20),%a1` retrieves `vtable[0x14]` from `A0+2`.

THINK C vtable tables are runtime-patched into A4-relative data; they cannot be read
directly from the resource file. The function was identified by enumerating THINK C name
strings for `CAkaiSampler` methods and matching the signature
`(this: CAkaiSampler*, fp+12: unsigned char*, fp+16: short)` from the call at 0x030883.

The name `AcceptSampleHeader` reflects MESA's view: "accept the sample header [from the
Mac audio layer] and deliver it to the Akai sampler."

---

## 2. Function Signature

```
CAkaiSampler::AcceptSampleHeader(
    this         // fp+8: CAkaiSampler*  (pushed at 0x030883: this[0xDA4])
    header_buf   // fp+12: unsigned char*  (pea %fp@(-498) at 0x03086d)
    sample_number // fp+16: short          (movew %fp@(-298) at 0x030876)
) -> short  (error code in D0)
```

All three arguments confirmed by the push sequence at 0x030876-0x030888:

```
030876:  3f2e fed6  movew %fp@(-298),%sp@-  ; push sample_number (short)
03087a:  486e fe0e  pea %fp@(-498)          ; push header_buf ptr
03087e:  206e 0008  moveal %fp@(8),%a0      ; A0 = CSamplerModule* this
030883:  2f28 0da4  movel %a0@(3492),%sp@-  ; push CAkaiSampler* (this->sampler)
```

`header_buf` is the 200-byte Akai header built by `BuildSampleHeaderFromMAH` (file
0x02e6bd). It is stored at `fp@(-498)` in the `SendAudioBufferToSampler` frame.

`sample_number` is stored at `fp@(-298)` in the outer frame, set at 0x030861:
```
030861:  3d40 fed6  movew %d0,%fp@(-298)
```
where D0 = the resolved AE-descriptor sample number (from `UExtractFromAEDesc::TheInt32`
at 0x03084b). This is a 1-based Akai sample slot number.

---

## 3. Function Behavior

### Step 1 — Build the SDATA SysEx (0x06ae0d-0x06ae43)

Local frame: `LINK A6, #-516`. A2 = `this` (CAkaiSampler*). Output buffer at `fp@(-512)`.

Build call arguments (pushed at 0x06ae15-0x06ae35, then dispatch):

```
06ae15:  2f3c 4255 4c4b  movel #0x42554c4b,%sp@-  ; TAG='BULK'
06ae1b:  4878 00c0       pea 0xc0                  ; 0xC0 = 192 (internal buffer size)
06ae1f:  4227            clrb %sp@-                ; flag = 0
06ae21:  3f2e 0010       movew %fp@(16),%sp@-      ; sample_number
06ae25:  1f3c 000b       moveb #11,%sp@-            ; opcode = 0x0B (SDATA)
06ae29:  1f2a 000e       moveb %a2@(14),%sp@-       ; exclusive_channel = this+14
06ae2d:  2f2e 000c       movel %fp@(12),%sp@-       ; header_buf (200-byte Akai header)
06ae31:  486e fe00       pea %fp@(-512)             ; output_buf (SysEx output)
06ae35:  2f0a            movel %a2,%sp@-            ; this (CAkaiSampler*)
06ae37:  2057            moveal %sp@,%a0
06ae39:  2268 0002       moveal %a0@(2),%a1         ; A1 = vtable (at this+2)
06ae3d:  2269 0014       moveal %a1@(20),%a1        ; A1 = vtable[0x14]
06ae41:  4e91            jsr %a1@                   ; call CAkaiSampler::vtable[0x14]
06ae43:  4fef 0018       lea %sp@(24),%sp           ; pop 24 bytes (6 args)
```

`CAkaiSampler::vtable[0x14]` is an internal SysEx-builder function on the `CAkaiSampler`
object. It receives the 200-byte Akai header as input, the output buffer pointer, the
channel byte, the opcode, the sample number, a flag, and a size. It produces a complete
SysEx packet at the output buffer (`fp@(-512)`). This function is NOT `CSCSIPlug::SendData`
— it formats the Akai SysEx framing. The return code is saved in D0 and then pushed in
Step 2.

### Step 2 — Transmit via CMESASocket (0x06ae47-0x06ae5d)

```
06ae47:  2f00            movel %d0,%sp@-           ; push D0 (return from vtable[0x14])
06ae49:  486e fe00       pea %fp@(-512)            ; push output_buf (the SysEx bytes)
06ae4d:  2f2a 00a2       movel %a2@(162),%sp@-     ; push this+0xA2 = CMESASocket*
06ae51:  2057            moveal %sp@,%a0            ; A0 = CMESASocket*
06ae53:  2250            moveal %a0@,%a1            ; A1 = CMESASocket vtable (at socket+0)
06ae55:  2269 0014       moveal %a1@(20),%a1        ; A1 = CMESASocket::vtable[0x14]
06ae59:  4e91            jsr %a1@                   ; call CMESASocket::vtable[0x14] = SendData
06ae5b:  3600            movew %d0,%d3              ; D3 = result
06ae5d:  4fef 0010       lea %sp@(16),%sp           ; pop 16 bytes (4 args)
```

`this+0xA2` (decimal 162) is the `CMESASocket*` embedded in `CAkaiSampler`. The vtable
pointer on `CMESASocket` is at `object+0` (confirmed: `CMESASocket` constructor stores
vtable at `this+0`, unlike `CAkaiSampler` which uses `this+2`).

`CMESASocket::vtable[0x14]` routes through the SCSI plug, which validates the SysEx header
(confirmed by `plug-bulk-trace.md` section 11.1: checks byte[0]=0xF0, byte[1]=0x47,
byte[4]=0x48) and issues SCSI CDB `0x0C` to the device.

**D3 = 0 on success.** Branch at 0x06ae61: `bnes 0x6ae83` — if D3 != 0, skip the SDS
wait step and go to error handling.

### Step 3 — Wait for SDS Reply (0x06ae63-0x06ae7f, conditional on D3==0)

```
06ae63:  486e fdfc  pea %fp@(-516)          ; push reply buffer (4 bytes before output_buf)
06ae67:  1f3c 0001  moveb #1,%sp@-           ; opcode = 0x01 (SDS dump header)
06ae6b:  4878 03e8  pea 0x3e8               ; timeout = 1000 (ms or ticks)
06ae6f:  2f0a       movel %a2,%sp@-         ; push this
06ae71:  2057       moveal %sp@,%a0
06ae73:  2268 0002  moveal %a0@(2),%a1      ; vtable from this+2
06ae77:  2269 00cc  moveal %a1@(204),%a1    ; vtable[0xCC]
06ae7b:  4e91       jsr %a1@               ; call CAkaiSampler::vtable[0xCC]
06ae7d:  3600       movew %d0,%d3          ; D3 = result
```

`CAkaiSampler::vtable[0xCC]` waits for a device response to SDS opcode 0x01 (SDS dump
header). The timeout is 1000 units (likely milliseconds). The reply is stored at `fp@(-516)`.

### Step 4 — Parse Reply (0x06ae83-0x06aeaf)

Error code -13001 (0xcd37) is the sentinel for "no reply / timeout":

```
06ae83:  0c43 cd37  cmpiw #-13001,%d3    ; was D3 set to timeout sentinel?
06ae87:  6626       bnes 0x6aeaf         ; if not timeout: skip to error_check
06ae89:  2f2a 00a2  movel %a2@(162),%sp@-  ; push CMESASocket*
06ae8d:  2057       moveal %sp@,%a0
06ae8f:  2250       moveal %a0@,%a1
06ae91:  2269 0024  moveal %a1@(36),%a1    ; vtable[0x24] on CMESASocket
06ae95:  4e91       jsr %a1@              ; call CMESASocket::vtable[0x24]
06ae97:  2648       moveal %a0,%a3        ; A3 = reply ptr from vtable[0x24]
06ae99:  0c13 00f0  cmpib #-16,%a3@      ; check reply[0] == 0xF0
06ae9f:  660e       bnes 0x6aeaf
06aea1:  0c2b 007e 0001  cmpib #126,%a3@(1)  ; check reply[1] == 0x7E
06aea7:  6606       bnes 0x6aeaf
06aea9:  7600       moveq #0,%d3           ; clear D3
06aeab:  162b 0003  moveb %a3@(3),%d3     ; D3 = reply[3] (device result byte)
```

When D3 == -13001 (timeout), `CMESASocket::vtable[0x24]` is called to retrieve the
pending unread reply. If the reply starts with 0xF0, 0x7E (MIDI real-time universal SysEx
prefix), `reply[3]` is extracted as the device's result byte. D3 = 0 means success.

**Return value (D0):** `movew %d3,%d0` at 0x06aeb0 — returns D3 as a short.

---

## 4. Does AcceptSampleHeader Call SendData Internally?

Yes, but indirectly. The call chain is:

```
AcceptSampleHeader (CAkaiSampler::vtable[0x017c])
  -> CAkaiSampler::vtable[0x14]       ; build the SysEx packet (format, not send)
  -> CMESASocket::vtable[0x14]        ; = CMESASocket::SendData
       -> CSCSIPlug::SendData          ; validates SysEx + issues SCSI CDB 0x0C
```

`AcceptSampleHeader` does NOT call `CSCSIPlug::SendData` directly. It calls
`CMESASocket::vtable[0x14]`, which in turn routes through the SCSI plug. The harness
Phase 5 synthetic call tested `CSCSIPlug::SendData` with a pre-built BULK IP_Data struct;
that path is equivalent but bypasses the two intermediate steps.

---

## 5. Exact SysEx Framing Produced

From `build-sample-header-decoded.md` and `plug-bulk-trace.md` section 11.1:

**SysEx payload (406 bytes total):**
```
F0 47 [ch] 0B 48 [400 nibble bytes] F7
```
where:
- `0xF0` = SysEx start
- `0x47` = Akai manufacturer ID
- `[ch]` = exclusive channel (`this+14` in `CAkaiSampler`, value 0x00 in Phase 5 trace)
- `0x0B` = SDATA opcode (pushed at 0x06ae25)
- `0x48` = S3000XL device identifier (validated by SCSI Plug at `plug-bulk-trace.md` §11.1)
- `[400 nibble bytes]` = 200-byte Akai sample header nibble-encoded, low-nibble first
- `0xF7` = SysEx end

The 200-byte input buffer layout (from `build-sample-header-decoded.md`):
- byte 0: `0x03` (constant)
- byte 1: sample-rate range flag (0 or 1)
- byte 2: `mah+103` (format byte, purpose unconfirmed)
- bytes 3-14: 12-char ASCII sample name, space-padded
- byte 15: `0x80`
- byte 16: loop mode (0 or 1)
- byte 19: loop type (0=forward, 2=no loop)
- bytes 20-21: fine tuning (from `TuningFromSemiCent`)
- bytes 26-29: **SLNGTH** — `mah+80` (total_byte_length in bytes), nibble-encoded
- bytes 30-33: loop_start nibble-encoded (`mah+52`)
- bytes 34-37: loop_end nibble-encoded (`mah+56`)
- bytes 38-41: sustain_end nibble-encoded (`mah+64`)
- bytes 44-47: sustain_length nibble-encoded (`mah+64 - mah+60 + 1`)
- bytes 138-139: low/high byte of `mah+14` word
- all others: zero

**SCSI CDB (confirmed from Phase 5 hardware trace, `plug-bulk-trace.md` §11.1):**
```
0C 00 00 01 96 80
```
- `0x0C` = MIDI Send
- `0x000196` = 406 (SysEx byte count, big-endian 24-bit)
- `0x80` = reply-expected flag

---

## 6. Full Data Flow from MESAAudioHeader2 to Wire

```
SendAudioBufferToSampler (file 0x030713)
  1. BuildSampleHeaderFromMAH (file 0x02e6bd) -> 200-byte Akai header at fp@(-498)
  2. AcceptSampleHeader (file 0x06ae09, via vtable[0x017c])
       a. CAkaiSampler::vtable[0x14] -> SysEx at fp@(-512):
              F0 47 ch 0B 48 [nibble(header[0..199])] F7
       b. CMESASocket::vtable[0x14] -> CSCSIPlug::SendData
              CDB: 0C 00 00 01 96 80 + 406-byte SysEx payload
       c. Wait for SDS opcode-0x01 reply (timeout 1000)
       d. Return 0 (success) or error code
  3. Check return: 0x7c -> re-enter BULK loop; 0x7f -> continue; else error
```

The data path from `mah@(80)` (total_byte_length) to SLNGTH in the on-wire SysEx:
```
mah+80  ->  BuildSampleHeaderFromMAH  ->  header[26..29] (nibble-encoded)
        ->  AcceptSampleHeader / vtable[0x14]  ->  nibble(header[0..199]) bytes 52..59
        ->  SCSI CDB 0x0C  ->  S3000XL device
```

SLNGTH occupies bytes 52-59 of the 400-nibble payload (bytes 26-29 of the 200-byte
header, nibble-encoded to 8 nibble bytes in the SysEx stream).

---

## 7. Predicted On-Wire Byte Sequence (Example)

For a 44100 Hz mono sample with 88200 bytes of audio data, sample slot 1, channel 0,
name "MYSAMPLE    " (12 chars, space-padded), no loop:

Header bytes 26-29 (SLNGTH from mah+80=0x00015888 = 88200):
```
SLNGTH nibble-encode(0x00015888):
  nibble 0: 0x8 -> 0x08
  nibble 1: 0x8 -> 0x08
  nibble 2: 0x8 -> 0x08 (wait — 0x15888 in nibbles: low to high: 8,8,8,5,1,0,0,0)
  bytes 26-29: 0x08 0x08 0x08 0x05  (low 4 nibbles = low 16 bits of 0x15888)
```

Note: Only the low 16 bits (0x5888 = 22664... that means low nibbles of 0x15888 = 8,8,8,5)
are encoded in 4 bytes per the 4-byte store in `BuildSampleHeaderFromMAH`. For 88200 bytes,
0x88 = low byte, 0x58 = next byte:
- 0x15888 in hex: nibbles low-to-high: 8, 8, 8, 5, 1, 0, 0, 0
- 4-byte nibble store: 0x08, 0x08, 0x08, 0x05

In the SysEx stream (nibble-encoding the 200-byte header):
- header[26] = 0x08 -> SysEx bytes 57, 58 = 0x08, 0x00
- header[27] = 0x08 -> SysEx bytes 59, 60 = 0x08, 0x00
- header[28] = 0x08 -> SysEx bytes 61, 62 = 0x08, 0x00
- header[29] = 0x05 -> SysEx bytes 63, 64 = 0x05, 0x00

The full SysEx header prefix:
```
F0 47 00 0B 48 [nibble(header[0]) lo] [nibble(header[0]) hi] [nibble(header[1]) lo] ...
```
Example first 6 bytes:
```
F0 47 00 0B 48 03 00  (F0=start, 47=Akai, 00=ch, 0B=SDATA, 48=S3000XL, header[0]=0x03 -> nibbles 0x03,0x00)
```

---

## 8. Why the Direct BULK Send in the Harness Failed

The Phase 5 harness called `CSCSIPlug::SendData` directly with a BULK IP_Data struct
containing a pre-built SDATA SysEx buffer. That path correctly issued SCSI CDB `0x0C`
with the 406-byte payload. However, the actual MESA code path is:

1. `AcceptSampleHeader` builds the SysEx from scratch via `CAkaiSampler::vtable[0x14]`
   using the 200-byte header as input.
2. It then sends via `CMESASocket::vtable[0x14]` → `CSCSIPlug::SendData`.

If the harness Phase 5 test failed, the root cause is not in `AcceptSampleHeader`'s
dispatch path (which terminates at `CSCSIPlug::SendData` exactly as the harness called).
The failure must be in the content of the SysEx buffer — specifically the SLNGTH field
(header[26..29]) whose value and encoding must be verified against what the device accepts.

---

## 9. Confidence Summary

| Claim | Confidence | Evidence |
|-------|-----------|----------|
| vtable[0x017c] = AcceptSampleHeader | high | Name string at 0x06aeb9; signature matches call args at 0x030876-030888 |
| Object type = CAkaiSampler | high | CSamplerModule ctor calls `__ct__12CAkaiSamplerFv` on `this+0xDA4` |
| vtable at object+2 for CAkaiSampler | high | AcceptSampleHeader itself uses `a0@(2)` for vtable at 0x06ae39 |
| Step 1 = SysEx builder (vtable[0x14]) | high | Disassembly at 0x06ae37-0x06ae43; args include opcode, channel, header_buf |
| Step 2 = CMESASocket::SendData (vtable[0x14]) | high | `a2@(0xa2)` = socket ptr; vtable at socket+0; `a1@(0x14)` = SendData |
| CMESASocket vtable at socket+0 | high | CMESASocket constructor stores vtable at `this+0`; confirmed by ctor annotated.txt |
| SysEx = F0 47 ch 0B 48 [400 nibbles] F7 | high | plug-bulk-trace.md §11.1 from live hardware trace |
| SCSI CDB = 0C 00 00 01 96 80 | high | plug-bulk-trace.md §11.1 from live hardware trace |
| SLNGTH = total_byte_length nibble-encoded | high | build-sample-header-decoded.md; mah+80 confirmed at 0x02e6e1 |
| Step 3 waits for SDS opcode 0x01 reply | high | Disassembly at 0x06ae63-0x06ae7f: moveb #1 pushed; vtable[0xCC] call |
| Timeout = 1000 (units unconfirmed) | medium | pea 0x3e8 at 0x06ae6b; units not verified |
| reply[3] = device result byte | medium | cmpib+moveb sequence at 0x06aea1-0x06aeab; semantic per SDS spec |
| SysEx nibble-encode via CAkaiSampler vtable[0x14] | medium | Behavior inferred from arg pattern; vtable[0x14] name not confirmed |
