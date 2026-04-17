# BuildSampleHeaderFromMAH — Decoded Analysis

> **PARTIALLY SUPERSEDED (per issue #310/#311 and #309):**
>
> Specific claims below are WRONG:
>
> - **slot 0x38 is NOT "nibble-encode-in-place"** — the 6 vtable[0x38] calls
>   resolve to `CAkaiMIDIDispatcher::SwapLongWord` (a 32-bit byte reversal).
>   See [`cakaidispatcher-slot38-swaplongword.md`](./cakaidispatcher-slot38-swaplongword.md).
> - **SLNGTH at `header[26..29]` is NOT nibble-encoded** — it's stored
>   `SwapLongWord(total_byte_length)`. For SLNGTH=4096 the bytes are
>   `00 10 00 00`, not `00 00 00 01`.
> - Any claim naming the slot-0x38 caller's object as "CMESASocket" is WRONG
>   (per #309) — it's `CSamplerModule@(0xDA4)` = `CAkaiSampler*`, whose vtable
>   is at `object+2`. CMESASocket's vtable is at `object+0` and is NOT this
>   path.
>
> What IS still correct: the 200-byte output-buffer layout (which offsets hold
> which fields), the sample-name construction, the `TuningFromSemiCent` call,
> the MAH field map, and the overall byte-write sequence.
>
> Kept as-is (not deleted) to preserve the session record of how the finding
> evolved.

Disassembly source: `disassembly-full/BuildSampleHeaderFromMAH.annotated.txt`
Binary: `binaries/sampler-editor-rsrc.bin`
Function file offset: 0x02e6bd - 0x02e9d3 (790 bytes, 224 instructions)
THINK C name string at 0x02e9d3: `BuildSampleHeaderFromMAH__14CSamplerModuleFPUcP16MESAAudioHeader2s`

---

## Function Signature

```
CSamplerModule::BuildSampleHeaderFromMAH(
    unsigned char* output_buf,  // fp(12) -> A2
    MESAAudioHeader2* mah,      // fp(16) -> A3
    short packet_index          // fp(20)
)
  this = fp(8), stored in D6
  LINK A6, #-50 (50 bytes of locals)
  Saves D3-D7 / A2-A3
```

**Note:** the mangled suffix `FPUcP16MESAAudioHeader2s` decodes as:
- `PUc` = `unsigned char*` = output_buf
- `P16MESAAudioHeader2` = `MESAAudioHeader2*` = mah
- `s` = `short` = packet_index

`packet_index` is `fp(20)` — the same `fp(-292)` from the outer `SendAudioBufferToSampler`
loop counter, passed as a signed short. Used here only to select 'L' or 'R' for stereo
channel labeling in the sample name.

---

## Output Buffer Layout

The output buffer (`output_buf`, A2) is **zeroed for 200 bytes** at entry
(loop at 0x02e6d3–0x02e6df: `clrb A2@(0,D4:w)`, D4 = 0..199).

### Byte-level writes (byte `moveb` instructions, offsets confirmed by disassembly)

| A2 offset | File offset | Source | Value / Description |
|-----------|-------------|--------|---------------------|
| 0 | 0x02e707 | immediate | 0x03 — constant; device model code or SDS channel byte |
| 1 | 0x02e721 | fp(-37) | 0 if mah@(12) <= 22050, else 1 (sample rate range flag) |
| 2 | 0x02e727 | mah@(103) | Raw byte from MAH offset 103 — purpose unknown, likely bits-per-sample or format flags |
| 3..14 | 0x02e79d | name loop | 12-char sample name, ASCII-cleaned, space-padded (see below) |
| 13 | 0x02e7b1 | immediate | 0x2d ('-'), stereo only: overwrites name[10] if mah@(16)==2 |
| 14 | 0x02e7cb | fp(-39) | 'L' (0x4c) or 'R' (0x52), stereo only: overwrites name[11] if mah@(16)==2 |
| 15 | 0x02e7e7 | immediate | 0x80 — SysEx end marker, OR a flags byte; follows name field |
| 16 | 0x02e819 | fp(-43) | 1 if loop enabled and sustain length > 0, else 0 (loop_mode low byte) |
| 19 | 0x02e849 | fp(-47) | 0 if loop enabled, 2 if no loop (loop_type: 0=forward loop, 2=no loop) |
| 20 | 0x02e9ad | D0 | Low byte of TuningFromSemiCent result (fine tuning, low byte) |
| 21 | 0x02e9c3 | D0 | High byte of TuningFromSemiCent result (fine tuning, high byte) |
| 48 | 0x02e919 | fp(-6) low | fp(-6) low byte: 0 if sustain_length < 256, else 0x0F (9999 & 0xFF) |
| 49 | 0x02e92f | fp(-6) high | fp(-6) >> 8: 0 if sustain_length < 256, else 0x27 (9999 >> 8) |
| 138 | 0x02e93d | mah@(14) low | Low byte of 16-bit word at mah+14 (sample name / Pascal string start) |
| 139 | 0x02e949 | mah@(14) high | High byte of same word, shifted right 8 |

### Long-word writes (4-byte `movel`, via vtable[0x38] in-place encoding)

After vtable[0x38] encodes the value pointed to in-place, the modified local is
stored as a 4-byte long into A2:

| A2 offset | File offset | Local | MAH source | Description |
|-----------|-------------|-------|------------|-------------|
| 26..29 | 0x02e865 | fp(-16) | mah@(80) | total_byte_length, nibble-encoded |
| 30..33 | 0x02e897 | fp(-28) | mah@(52) | loop_start, nibble-encoded |
| 34..37 | 0x02e8b3 | fp(-32) | mah@(56) | loop_end, nibble-encoded |
| 38..41 | 0x02e8cf | fp(-36) | mah@(64) | sustain_end, nibble-encoded |
| 44..47 | 0x02e8eb | fp(-4) | mah@(64)-mah@(60)+1 | sustain_length = sustain_end - sustain_start + 1, nibble-encoded |

Bytes 42..43 are zero-filled (not written after initialization). This gap is unexplained
in the current analysis — possibly reserved or written by vtable[0x38] internally.

---

## SLNGTH — Definitive Encoding

**SLNGTH is at A2@(26..29).**

Encoding steps (confirmed by disassembly):

1. `mah@(80)` is loaded into `fp(-16)` at file offset 0x02e6e1.
   `mah@(80)` = `total_byte_length`: the total number of audio bytes in the upload
   buffer. Units: **bytes** (not samples, not words).

2. `vtable[0x38]` is called with `&fp(-16)` at file offset 0x02e84f.
   This is the nibble-encoding function (confirmed: same `this@(3492)` socket and
   vtable dispatch pattern as other encode calls; called 5 times total on 5 distinct
   32-bit values in the same sequence).
   
   vtable[0x38] encodes the 32-bit value at the pointer argument **in place**,
   converting it from a raw 32-bit integer to a 4-byte nibble-encoded representation
   (low-nibble-first, identical to the nibble encoding used in PDATA/KDATA/SDATA
   SysEx headers per the S3000XL SysEx protocol).

3. `movel fp@(-16), A2@(26)` at file offset 0x02e865 copies the 4-byte nibble-encoded
   result into the output buffer at offset 26.

**What vtable[0x38] does to the raw value:**

This is a nibble-encode-in-place function. For a 32-bit value V:
- Nibble N0 = (V >>  0) & 0xF → byte 0 of result
- Nibble N1 = (V >>  4) & 0xF → byte 1 of result
- Nibble N2 = (V >>  8) & 0xF → byte 2 of result
- Nibble N3 = (V >> 12) & 0xF → byte 3 of result

(The full 32-bit encoding would need 8 nibbles = 8 bytes, but only 4 bytes are stored
via `movel`. This means only the low 16 bits of V are nibble-encoded into 4 bytes.
Confidence: medium — inferring from the 4-byte store pattern and known nibble encoding
from the S3000XL SysEx protocol.)

**SLNGTH units — bytes, not samples:**

`mah@(80)` is confirmed as total_byte_length (bytes) by its use in
`SendAudioBufferToSampler` at 0x0307a5 where it is divided by `mah@(16)` to compute
the number of samples for the memory capacity check. SLNGTH in this custom header is
therefore in **bytes** (not sample words), nibble-encoded low-nibble-first into 4 bytes.

This differs from the standard SDS specification, which encodes SLNGTH as sample words
in 3 bytes using 7-bit encoding (21 bits for length). MESA uses a non-standard 4-byte
nibble-encoded length in bytes.

**Confidence:** high for the value source (mah@(80) = total_byte_length); medium for
the exact nibble encoding width (4 bytes = lower 16 bits only, or full 32 bits folded
into 4 nibble-encoded bytes — this requires inspection of vtable[0x38] in the SCSI Plug
to confirm).

---

## Duplicate vtable[0x38] Call on fp(-16)

At file offset 0x02e86b, vtable[0x38] is called again with `&fp(-16)` immediately after
the first call. There is no store of fp(-16) after this second call. The next
instruction is `pea fp@(-28)` for the next value.

Possible explanations (in order of likelihood):
1. **Stateful socket cursor**: vtable[0x38] advances an internal write position inside
   the socket buffer. The second call advances the cursor by 4 bytes without using the
   result, preparing the position for fp(-28) at A2@(30). The A2 stores are a parallel
   local copy; the socket builds the authoritative encoded stream internally.
2. **Compiler artifact**: duplicate call generated by THINK C for a double-encode
   (e.g., encoding high and low 16-bit halves of fp(-16) separately).
3. **Bug/dead call**: the second call has no effect. Unlikely given the tight stack
   accounting (6 × 8 bytes = 48 bytes stack popped at 0x02e8f9).

The `lea sp@(48), sp` at 0x02e8f9 confirms exactly 6 pushes of (socket + value-ptr)
= 6 × 8 = 48 bytes. There are 6 vtable[0x38] calls, confirming this count.

---

## Sample Name Construction (A2@(3..14))

Loop at 0x02e731–0x02e7a7: D4 iterates 0..12 (13 positions, but loop condition is
`cmpiw #12, D4; bles` which runs for D4 = 0..12, writing 13 bytes to A2@(3..15)).

Each iteration:
1. Reads `mah[14 + D4 + 1]` = `mah[15]..mah[27]` as a character byte.
2. ASCII validation:
   - a-z: accepted, uppercased (AND #~0x20)
   - 0-9: accepted
   - space (0x20), '#', '+', '-', '.': accepted as-is
   - A-Z: accepted (already uppercase)
3. If char is valid AND D4 < `mah@(20)` (name length): write char to A2@(3+D4).
4. Else: write space (0x20).

After the loop, if `mah@(16) == 2` (stereo):
- A2@(13) = 0x2D ('-')
- A2@(14) = 'R' (0x52) if `fp@(20) != 0` (packet_index != 0) else 'L' (0x4C)

The `packet_index` argument (`fp@(20)`, the short from `SendAudioBufferToSampler`'s
`fp(-292)`) is used **only** for L/R stereo labeling. It is NOT used for SLNGTH, sample
period, or any other numeric field.

**mah@(14) dual use:** the same field is read as a word at 0x02e933 and stored as 2 bytes
at A2@(138/139) outside the SDS header region. The low byte of mah@(14) as a word is
written to A2@(138) and the high byte to A2@(139). Given the Pascal string layout
(mah@(20) = name length, mah@(21) = name body per `SendAudioBufferToSampler`), mah@(14)
as a word likely encodes a sample number or a separate 2-byte field. Confidence: low —
the dual read creates ambiguity.

---

## vtable[0x38] — Identification

vtable offset 0x38 (56 decimal), called via `this@(3492)` socket object:

- 6 calls in sequence (0x02e84f, 0x02e86b, 0x02e881, 0x02e89d, 0x02e8b9, 0x02e8d5)
- Each call takes `(socket_ptr, &local_32bit_value)` — two 4-byte args = 8 bytes pushed
- After each call, the local variable is stored back to A2 via `movel`
- The 5 values encoded (fp(-16), fp(-28), fp(-32), fp(-36), fp(-4)) correspond to:
  total_byte_length, loop_start, loop_end, sustain_end, sustain_length

vtable[0x38] is the nibble-encode-in-place function, adjacent to vtable[0x30]
(SetSampleHeader, SDS opcode 0x01) and vtable[0x14] (SendData) in the CMESASocket
vtable. This is consistent with it being `ConvertToMIDI`, `NibbleEncode`, or a similar
name in the SCSI Plug. Confidence: high (behavior), low (exact name — not confirmed
without SCSI Plug disassembly of offset 0x38).

---

## Comparison to Standard SDS Header

Standard MIDI SDS sample dump header (F0 7E cc 01 ss ss bb pp pp pp ll ll ll ...):
- Bytes 3-4: sample number (2 bytes, 7-bit each)
- Byte 5: bits/sample (7-bit)
- Bytes 6-8: sample period in nanoseconds (3 bytes, 7-bit)
- Bytes 9-11: sample length in words (3 bytes, 7-bit)
- Bytes 12-14: sustain loop start (3 bytes, 7-bit)
- Bytes 15-17: sustain loop end (3 bytes, 7-bit)
- Byte 18: loop type (7-bit)
- F7

MESA custom header at A2 (non-standard, 200-byte buffer):
- A2@(0) = 0x03 (constant, possibly device ID or channel)
- A2@(1) = sample rate range flag (0 or 1)
- A2@(2) = mah@(103) (unknown, possibly format byte)
- A2@(3..14) = 12-char sample name (ASCII, space-padded)
- A2@(15) = 0x80 (SysEx end marker or flags)
- A2@(16) = loop mode (0 or 1)
- A2@(17-18) = zero (not explicitly written after zero-fill)
- A2@(19) = loop type (0=forward loop, 2=no loop)
- A2@(20-21) = fine tuning (2 bytes, from TuningFromSemiCent)
- A2@(22-25) = zero (not written)
- A2@(26-29) = **SLNGTH**: total_byte_length, nibble-encoded (mah@(80))
- A2@(30-33) = loop_start, nibble-encoded (mah@(52))
- A2@(34-37) = loop_end, nibble-encoded (mah@(56))
- A2@(38-41) = sustain_end, nibble-encoded (mah@(64))
- A2@(42-43) = zero (gap — not written explicitly)
- A2@(44-47) = sustain_length, nibble-encoded (mah@(64) - mah@(60) + 1)
- A2@(48) = fp(-6) low byte (0, or 0x0F if sustain_length >= 256)
- A2@(49) = fp(-6) high byte (0, or 0x27 if sustain_length >= 256)
- A2@(50-137) = zero (not written)
- A2@(138) = low byte of mah@(14) word
- A2@(139) = high byte of mah@(14) word >> 8
- A2@(140-199) = zero (not written)

**This is not standard SDS format.** MESA's header is a proprietary Akai-specific
structure using nibble encoding for numeric fields and a 12-char ASCII name field.
The vtable[0x30] call at 0x02e7e5 passes `A2@(3)` (pointer to offset 3 = start of
name) to `SetSampleHeader` — suggesting the receiving function interprets only the
name+fields from position 3 onward.

---

## S3000 vs S1000 Branching

No device-model branch found in this function. The byte 0x03 written to A2@(0) at
0x02e707 is a constant with no conditional — it applies to all devices. There is no
check against a model ID flag in `this` or `mah`. Confidence: high.

---

## MESAAudioHeader2 Field Map (confirmed in this function)

Extending the map from `sampler-editor-decoded.md`:

| Offset | Hex | Size | Usage in BuildSampleHeaderFromMAH | Confidence |
|--------|-----|------|-----------------------------------|------------|
| +12 | 0x0C | long | sample_rate: compared to 22050 and 48000 | high |
| +14 | 0x0E | word | Pascal string start or sample number word | low (dual use) |
| +16 | 0x10 | long | num_channels: compared to 2 for stereo path | high |
| +20 | 0x14 | byte | name_length (Pascal string length byte) | high |
| +52 | 0x34 | long | loop_start (sample address) | high |
| +56 | 0x38 | long | loop_end (sample address) | high |
| +60 | 0x3C | long | sustain_start (sample address) | high |
| +64 | 0x40 | long | sustain_end (sample address) | high |
| +80 | 0x50 | long | total_byte_length (= SLNGTH source) | high |
| +96 | 0x60 | long | tuning in semitones*100+cents | medium |
| +103 | 0x67 | byte | unknown format byte -> A2@(2) | low |
| +104 | 0x68 | long | bit 0 = loop_enable flag | high |

---

## Key Finding for the SLNGTH Bug

SLNGTH (A2@(26..29)) is nibble-encoded from **`mah@(80)` = total_byte_length in bytes**.

The S3000XL device expects SLNGTH to be the **number of sample words** (not bytes).
For 16-bit stereo: sample_words = total_bytes / 4.
For 16-bit mono: sample_words = total_bytes / 2.

MESA passes the **raw byte count** through nibble encoding without any division.
This means SLNGTH in the constructed header is 2x (mono) or 4x (stereo) too large.

**However**, this is what MESA sends to the real S3000XL and it works, so either:
1. The S3000XL BULK handler interprets SLNGTH as bytes, not words (non-standard).
2. The SCSI Plug's vtable[0x38] function applies an additional conversion factor.
3. SLNGTH in this custom header is intentionally in bytes (MESA's own extension).

Option 3 is most likely given the completely non-standard header format. The SLNGTH
field here is Akai's proprietary definition, not the SDS standard definition.
Confidence: high (the value source is confirmed); the semantic interpretation by the
device requires SCSI Plug vtable[0x38] analysis to verify definitively.

---

## TuningFromSemiCent (called at 0x02e99b)

JSR to file offset `0x027f57 + 0x444d6 = 0x06c42d`:
`CAkaiSamplerUtils::TuningFromSemiCent(long* table_ptr, long semitones_x100, long cents_x100)`

- `mah@(96)` = tuning in semitones*100 (or semitones + cents combined)
- `mah@(96) * 100 / 100 - mah@(96)` gives separate integer and fractional parts (the
  mul/div dance at 0x02e95b-0x02e975 computes floor and remainder)
- If sample_rate == 48000: offset corrections applied (+1 semitone, +47 cents)
- Result (D0) = 16-bit tuning word → A2@(20) low byte, A2@(21) high byte

---

## Confidence Summary

| Claim | Confidence | Evidence |
|-------|-----------|----------|
| SLNGTH source = mah@(80) = total_byte_length | high | movel A3@(80), fp(-16) at 0x02e6e1, then stored at A2@(26) after vtable encode |
| SLNGTH encoding = nibble-encode via vtable[0x38] | high | vtable[0x38] called with &fp(-16), result stored at A2@(26) |
| SLNGTH units = bytes (not sample words) | high | same mah@(80) used as byte divisor in SendAudioBufferToSampler@(0x0307a5) |
| SLNGTH is 4 bytes (low 16 bits nibble-encoded) | medium | movel stores 4 bytes; full 32-bit encoding would need 8 bytes |
| packet_index used only for L/R stereo labeling | high | fp@(20) tested only at 0x02e7b7 for 'R'/'L' selection |
| mah@(16) == 2 means stereo | high | compared to 2 before L/R branch |
| Header is non-standard Akai proprietary format | high | structure does not match SDS spec at any byte position |
| vtable[0x38] = nibble-encode-in-place | high (behavior), low (name) | pattern consistent with nibble encoding; name requires SCSI Plug analysis |
| No S3000 vs S1000 model branch | high | no model flag check in entire function |
| 0x03 at A2@(0) = device ID or channel | low | constant with no documentation; requires SCSI Plug to interpret |
