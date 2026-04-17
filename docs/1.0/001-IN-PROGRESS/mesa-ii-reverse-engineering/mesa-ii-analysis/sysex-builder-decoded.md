# SysEx Builder Decoded: CAkaiSampler::vtable[0x14]

**Binary:** `binaries/sampler-editor-rsrc.bin`  
**Date:** 2026-04-16  
**Disassembly source:** `disassembly-full/CAkaiSampler-vtable14.annotated.txt`

---

## 1. Identification of CAkaiSampler::vtable[0x14]

**Function:** `CAkaiMIDIDispatcher::BuildCommand`  
**Mangled name:** `BuildCommand__19CAkaiMIDIDispatcherFPUcPUcUcUcsUcss`  
**File offset:** `0x06ca97`  
**Evidence:** vtable at file `0x06f74b`, entry at vtable+0x14 = `0x044b40` (code addr) = file `0x06ca97`. Confirmed by searching for `AcceptSampleHeader`'s code address (`0x042eb2`) to locate vtable[0x017c], then reading vtable[0x14] from the same table.

**Why `CAkaiSampler::vtable[0x14]` resolves to `BuildCommand`:**  
`CAkaiSampler` inherits from `CAkaiMIDIDispatcher`. The constructor at file `0x068981` calls `__ct__19CAkaiMIDIDispatcherFv` at file `0x06c821` and sets `this+2` = vtable ptr (A4-relative, patched at runtime). The vtable table at file `0x06f74b` contains `BuildCommand` at slot [0x14/4] = slot 5.

**Confidence:** high (vtable dump matched against two independent `AcceptSampleHeader` references at vtable[0x017c]).

---

## 2. BuildCommand Signature

```
CAkaiMIDIDispatcher::BuildCommand(
    this         // fp@(8):  CAkaiMIDIDispatcher* / CAkaiSampler*
    output_buf   // fp@(12): unsigned char* — SysEx output buffer
    header_buf   // fp@(16): unsigned char* — 200-byte Akai header input
    channel      // fp@(20): unsigned char — MIDI exclusive channel (0x00..0x0F)
    opcode       // fp@(22): unsigned char — Akai SysEx opcode
    sample_num   // fp@(24): short — 1-based sample slot number
    flag         // fp@(26): unsigned char — 0 = normal
    size         // fp@(28): short — Nibbleize byte count (0xC0 = 192 for SDATA)
    TAG          // fp@(32): long — BULK/SYSX/etc (not consumed by this function)
) -> long  (D0 = byte count of SysEx written to output_buf)
```

**Args as pushed by AcceptSampleHeader (`0x06ae15`–`0x06ae35`):**

| Offset | Value | Source |
|--------|-------|--------|
| fp@(8) | CAkaiSampler* | `movel a2, sp@-` |
| fp@(12) | output_buf ptr | `pea fp@(-512)` |
| fp@(16) | header_buf ptr | `movel fp@(12)` |
| fp@(20) | channel (high byte of word) | `moveb a2@(14), sp@-` |
| fp@(22) | 0x0B (high byte of word) | `moveb #11, sp@-` |
| fp@(24) | sample_number | `movew fp@(16), sp@-` |
| fp@(26) | 0 (high byte of word) | `clrb sp@-` |
| fp@(28..31) | 0x000000C0 | `pea 0xc0` |
| fp@(32..35) | 0x42554C4B | `movel #BULK, sp@-` |

**Note on byte-push convention:** On 68k, `moveb reg, -(sp)` decrements sp by 2 and stores the byte at the HIGH byte of the resulting word (big-endian). So `moveb fp@(22)` in BuildCommand reads the high byte of the opcode word = the opcode value (0x0B). This is confirmed by `BuildHeader`'s cross-check.

**Confidence:** high (instruction-level trace; frame layout confirmed by checking `BuildHeader`'s reads of fp@(16) and fp@(18) against known SysEx output format `F0 47 ch opcode 48`).

---

## 3. How BuildCommand Transforms the 200-byte Header into a SysEx Buffer

### Step 1 — Write SysEx header bytes (via vtable[0x0c] = BuildHeader, file 0x06c8ab)

Called at `0x06cacb`. Writes 5 bytes to output_buf and returns cursor position 5 in D0.

```
output_buf[0] = 0xF0  (SysEx start)
output_buf[1] = 0x47  (Akai manufacturer ID)
output_buf[2] = channel
output_buf[3] = opcode (0x0B = SDATA)
output_buf[4] = 0x48  (S3000XL device ID)
cursor = 5
```

Evidence: `BuildHeader` disassembly at `0x06c8ab`–`0x06c8e9`, confirmed by writeback of `moveb #-16` (0xF0), `moveb #71` (0x47), `moveb fp@(16)`, `moveb fp@(18)`, `moveb #72` (0x48).

### Step 2 — Opcode switch (0x06cad7–0x06cc43)

`moveb fp@(22), d7` loads opcode. D7 = 0x0B = 11 for SDATA.

Switch via `subiw` subtraction chain:
- `0x0B - 0x0B = 0` → branch to SDATA path at `0x6cbeb`

### Step 3 — SDATA path (at 0x06cbeb): write sample_number (via vtable[0x18] = Set7BitWord, file 0x06cc91)

Called at `0x06cbfd`. Writes 2 bytes to output_buf at cursor 5:

```
output_buf[5] = sample_number & 0x7F         (low 7 bits)
output_buf[6] = (sample_number >> 7) & 0x7F  (high 7 bits)
cursor = 7
```

Evidence: `Set7BitWord` disassembly at `0x06cc91`–`0x06ccc7`. Reads `movew fp@(20)` = sample_number, applies `andiw #127` and `asrw #7` to produce 2 bytes. Returns new cursor in D0.

### Step 4 — SDATA path: nibble-encode header (via vtable[0x1c] = Nibbleize, file 0x06ccf5)

Called at `0x06cc17`. Processes `size` bytes from header_buf into output_buf at cursor 7:

```
for i in range(size):      # size = 192 (D5 = fp@(30) = 0x00C0)
    output_buf[cursor + 2*i]   = header_buf[i] & 0x0F        (low nibble)
    output_buf[cursor + 2*i+1] = (header_buf[i] >> 4) & 0x0F (high nibble)
cursor += size * 2  # = 7 + 384 = 391
```

Evidence: `Nibbleize` disassembly at `0x06ccf5`–`0x06cd43`. Loop: `moveb a3@(0,d4:l), d5` → `andiw #15, d0` → store low nibble; `asrw #4, d0` → `andiw #15, d0` → store high nibble at offset+1; `addql #2, d2` (advance output cursor by 2); `addql #1, d4` (advance input by 1); loop while `d4 < d6` (= size). Returns new cursor in D0.

**Nibbleize encoding is low-nibble first.** Confirmed by `andiw #15, d0` before first store, `asrw #4` + `andiw #15` before second store at cursor+1.

**Size = 192 bytes from header_buf**, NOT 200. `pea 0xc0` = 0xC0 = 192. Only `header_buf[0..191]` is nibble-encoded. `header_buf[192..199]` is NOT included in the SysEx payload.

### Step 5 — Append SysEx end (0x06cc45–0x06cc4f)

```
output_buf[391] = 0xF7  (SysEx end)
D0 = 392               (total bytes written)
```

Evidence: `moveb #-9, a2@(0,d0:l)` at `0x06cc49` where -9 in signed byte = 0xF7.

---

## 4. Complete SysEx Output for SDATA (opcode 0x0B)

```
Byte 0:       0xF0          SysEx start
Byte 1:       0x47          Akai manufacturer ID
Byte 2:       channel       MIDI exclusive channel
Byte 3:       0x0B          SDATA opcode
Byte 4:       0x48          S3000XL device ID
Byte 5:       sample_num & 0x7F          sample number low 7 bits
Byte 6:       (sample_num >> 7) & 0x7F   sample number high 7 bits
Bytes 7..390: Nibbleize(header_buf[0..191])   384 nibble bytes
Byte 391:     0xF7          SysEx end

Total: 392 bytes
```

**This is what MESA actually sends.** The payload is 392 bytes, NOT 406.

---

## 5. Nibbleize Function Confirmed (vtable[0x1c])

`Nibbleize__19CAkaiMIDIDispatcherFPUcPUcsl` at file `0x06ccf5`.

```
Nibbleize(
    this,
    output_buf,   // unsigned char*: where to write nibble bytes
    input_buf,    // unsigned char*: source bytes
    cursor,       // short: starting write position in output_buf
    count         // long: number of input bytes to process
)
```

For each input byte B at index i (0..count-1):
```
output_buf[cursor + 2*i]   = B & 0x0F       (low nibble first)
output_buf[cursor + 2*i+1] = (B >> 4) & 0x0F (high nibble second)
```

Returns: new cursor value (cursor + count*2).

**Correction (per issue #309):** `build-sample-header-decoded.md` described vtable[0x38] as "CMESASocket vtable[0x38] = nibble-encode-in-place" — that class identity was wrong. The calls in `BuildSampleHeaderFromMAH` dispatch through `CSamplerModule@(0xDA4)` = `CAkaiSampler*` (which inherits CAkaiMIDIDispatcher), not CMESASocket. Slot 0x38 in the CAkaiMIDIDispatcher vtable maps to `SwapLongWord`, not Nibbleize, and not nibble-encode-in-place. Confirmed from vtable dump: slot 0x38 at file `0x06f783` = runtime 0x00045f2a = file `0x06de81` = `SwapLongWord__19CAkaiMIDIDispatcherFPUl`. Full decode in `cakaidispatcher-slot38-swaplongword.md`.

This invalidates `build-sample-header-decoded.md`'s description of vtable[0x38] as "nibble-encode-in-place." That was medium-confidence and is now refuted. **vtable[0x38] is `SwapLongWord`, not `Nibbleize`.**

The nibble encoding in `BuildSampleHeaderFromMAH` (via vtable[0x38] on `this@(3492)`) is on a DIFFERENT object than `CAkaiMIDIDispatcher`. `this@(3492)` in `SendAudioBufferToSampler` is a `CAkaiSampler*`, and vtable[0x38] on the CAkaiSampler vtable at file `0x06f74b` is:
- vtable[0x38] = file `0x06de81` = `SwapLongWord`

So `BuildSampleHeaderFromMAH` calls `SwapLongWord` (not nibble-encode) 6 times. The "nibble encoding" described in `build-sample-header-decoded.md` for the 32-bit values (SLNGTH etc.) may actually be byte-swapping, not nibble encoding. This needs re-examination.

**Confidence of vtable[0x38] = SwapLongWord:** high (vtable dump at file 0x06f74b, slot 0x38/4 = slot 14 = file 0x06de81 = name string `SwapLongWord__19CAkaiMIDIDispatcherFPUl`).

---

## 6. Slot 0x38 Class Identity (issue #309 correction)

Earlier docs called the slot-0x38 target "CMESASocket::vtable[0x38]". That was a class-identity mistake: the caller-side pointer `CSamplerModule@(0xDA4)` is a `CAkaiSampler*` (which inherits CAkaiMIDIDispatcher and stores its vtable at `object+2`). The CMESASocket class exists in both binaries but stores its vtable at `object+0` — so the `moveal a0@(2), a1` pattern at all 6 call sites in `BuildSampleHeaderFromMAH` cannot be CMESASocket.

The 6 `vtable[0x38]` calls in `BuildSampleHeaderFromMAH` call through `this@(3492)` which is the socket object within `CSamplerModule` (not `CAkaiSampler`). This socket's vtable[0x38] is in the SCSI Plug binary, not the Sampler Editor binary. The finding from `build-sample-header-decoded.md` that "vtable[0x38] = nibble-encode-in-place" was based on behavioral inference, not instruction-level decoding. That inference may still be correct for the SCSI Plug's vtable[0x38]; it is independent of the `CAkaiSampler` vtable[0x38] identified here as `SwapLongWord`.

**Updated assessment:** The SCSI Plug's vtable[0x38] (called by `BuildSampleHeaderFromMAH` via the socket object) remains "nibble-encode-in-place with high behavioral confidence." The CAkaiSampler vtable[0x38] = `SwapLongWord` (confirmed). These are different vtable tables.

---

## 7. Predicted On-Wire Bytes for SLNGTH=4096 (TEST_SLNGTH_BYTES in test-bulk-akai-header.ts)

Test parameters: sample_num=1, channel=0, SLNGTH=4096 bytes, name="BULKHDRTEST ".

200-byte Akai header `header_buf` as built by `buildAkaiHeader`:
- header_buf[0] = 0x03
- header_buf[1] = 0x00
- header_buf[2] = 0x00
- header_buf[3..14] = "BULKHDRTEST " (12 chars)
- header_buf[15] = 0x80
- header_buf[16] = 0x00 (no loop)
- header_buf[19] = 0x02 (loop_type=no loop)
- header_buf[26..29] = vtable[0x38]-encoded SLNGTH (SwapLongWord? or SCSI-Plug nibble?)

The nibble payload in the actual SysEx covers only header_buf[0..191].

Set7BitWord for sample_num=1:
- byte 5 = 1 & 0x7F = 0x01
- byte 6 = (1 >> 7) & 0x7F = 0x00

Nibbleize of header_buf[0..191] (first 32 bytes shown):
- header_buf[0]=0x03 → nibbles: 0x03 (lo), 0x00 (hi)
- header_buf[1]=0x00 → nibbles: 0x00, 0x00
- header_buf[2]=0x00 → nibbles: 0x00, 0x00
- header_buf[3]='B'=0x42 → nibbles: 0x02, 0x04
- header_buf[4]='U'=0x55 → nibbles: 0x05, 0x05
- header_buf[5]='L'=0x4C → nibbles: 0x0C, 0x04
- header_buf[6]='K'=0x4B → nibbles: 0x0B, 0x04
- header_buf[7]='H'=0x48 → nibbles: 0x08, 0x04
- header_buf[8]='D'=0x44 → nibbles: 0x04, 0x04
- header_buf[9]='R'=0x52 → nibbles: 0x02, 0x05
- header_buf[10]='T'=0x54 → nibbles: 0x04, 0x05
- header_buf[11]='E'=0x45 → nibbles: 0x05, 0x04
- header_buf[12]='S'=0x53 → nibbles: 0x03, 0x05
- header_buf[13]='T'=0x54 → nibbles: 0x04, 0x05
- header_buf[14]=' '=0x20 → nibbles: 0x00, 0x02
- header_buf[15]=0x80 → nibbles: 0x00, 0x08

Complete predicted SysEx prefix (first 10 bytes):
```
F0 47 00 0B 48 01 00 03 00 00 ...
```
- 0xF0 = SysEx start
- 0x47 = Akai
- 0x00 = channel
- 0x0B = SDATA opcode
- 0x48 = S3000XL device ID
- 0x01 = sample_number low 7 bits (= 1)
- 0x00 = sample_number high 7 bits (= 0)
- 0x03 = lo nibble of header_buf[0]=0x03
- 0x00 = hi nibble of header_buf[0]=0x03
- 0x00 = lo nibble of header_buf[1]=0x00
...

SysEx suffix (last 2 bytes): `... 0xF7`  (F7 at byte 391)

**Total: 392 bytes.**

---

## 8. Diff Against test-bulk-akai-header.ts (What Is Wrong)

The test currently sends:
```
sysex = [0xF0, 0x47, 0x00, 0x0B, 0x48, ...nibbleEncodeBuffer(headerBuf 200 bytes)..., 0xF7]
total = 1+1+1+1+1 + 400 + 1 = 406 bytes
```

The actual MESA software sends:
```
sysex = [0xF0, 0x47, ch, 0x0B, 0x48,
         sample_num & 0x7F, (sample_num >> 7) & 0x7F,
         ...nibbleEncodeBuffer(headerBuf[0..191])...,
         0xF7]
total = 5 + 2 + 384 + 1 = 392 bytes
```

**Two differences:**

1. **Missing sample_number field:** MESA inserts 2 bytes after the 5-byte header: `sample_num & 0x7F` and `(sample_num >> 7) & 0x7F`. The test omits these entirely. These must be inserted at SysEx bytes 5 and 6.

2. **Wrong Nibbleize length:** MESA nibble-encodes only 192 bytes (header_buf[0..191]), NOT 200 bytes. The test nibble-encodes all 200 bytes, producing 400 nibble bytes. MESA produces 384 nibble bytes from bytes 0-191. Bytes 192-199 of the header are NOT in the SysEx.

3. **Wrong total length:** Test sends 406 bytes; MESA sends 392 bytes. The SCSI CDB should use `0x000188` = 392 (not `0x000196` = 406).

**Corrected test should send:**
```typescript
const sysex = [
  0xF0, 0x47, CHANNEL, 0x0B, 0x48,
  sampleNum & 0x7F,
  (sampleNum >> 7) & 0x7F,
  ...nibbleEncodeBuffer(headerBuf.slice(0, 192)),
  0xF7
];
// Total: 392 bytes
// CDB: 0C 00 00 01 88 80  (0x000188 = 392)
```

---

## 9. Confidence Summary

| Claim | Confidence | Evidence |
|-------|-----------|----------|
| vtable[0x14] = BuildCommand at file 0x06ca97 | high | vtable dump at file 0x06f74b; confirmed by AcceptSampleHeader vtable[0x017c] anchor |
| vtable dispatch at 0x06ae37-0x06ae41 calls BuildCommand | high | Disassembly; vtable slot matches |
| SDATA path (opcode 0x0B) taken for AcceptSampleHeader | high | Switch at 0x06cad7: 0x0B-11=0, branch to 0x6cbeb confirmed |
| Size = 192 bytes (not 200) | high | `pea 0xc0` at 0x06ae1b; `movew fp@(30), d5` = 0x00C0 in BuildCommand |
| Sample_number inserted as 7-bit 2-byte via Set7BitWord | high | SDATA path at 0x06cbeb-0x06cbff; Set7BitWord at file 0x06cc91 |
| Nibbleize = low-nibble-first | high | Disassembly at 0x06ccf5: `andiw #15` before `asrw #4` |
| Total SysEx = 392 bytes (not 406) | high | BuildCommand return: cursor=391+1=392 |
| Phase 5 406-byte trace was test-constructed, not captured from real MESA code path | high | plug-bulk-trace.md §11.1: "IP_Data+0 = 406 bytes for SDATA" came from Phase 5 synthetic send, not from tracing AcceptSampleHeader |
| vtable[0x38] on CAkaiSampler = SwapLongWord (not nibble-encode) | high | vtable dump, slot 0x38/4=14, file 0x06de81 = SwapLongWord name string |
| vtable[0x38] on SCSI Plug (different object) = nibble-encode-in-place | medium | Behavioral from build-sample-header-decoded.md; not instruction-level |
| F7 byte = 0xF7 confirmed | high | `moveb #-9` = signed byte -9 = 0xF7 at 0x06cc49 |
| SLNGTH at header_buf[26..29] is within the Nibbleize range (byte 26 < 192) | high | 26 < 192 ✓ |
