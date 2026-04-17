# CMESASocket vtable[0x38] — Decoded

**Date:** 2026-04-16  
**Binary:** `sampler-editor-rsrc.bin`  
**Method:** Static disassembly (instruction-level decode + vtable table dump + cross-validation)

---

## 1. Summary

vtable[0x38] called from `BuildSampleHeaderFromMAH` (the SLNGTH encoder and loop/sustain field encoder) is **`SwapLongWord__19CAkaiMIDIDispatcherFPUl`** — a 32-bit byte reversal (big-endian to little-endian conversion) applied in place.

**Confidence: high.** Confirmed by:
1. Vtable table dump at file `0x06f74b` (CAkaiMIDIDispatcher): slot 14 = runtime `0x00045f2a`
2. Delta `0x027f57` verified by two independent anchors (BuildCommand, AcceptSampleHeader)
3. `0x00045f2a + 0x027f57 = 0x06de81` = file offset of `SwapLongWord`
4. Full instruction-level decode of `SwapLongWord` at `0x06de81` confirms byte-reversal algorithm

---

## 2. Locating the vtable — Object Chain

The 6 vtable[0x38] calls in `BuildSampleHeaderFromMAH` dispatch through `CSamplerModule@(0xDA4)`:

```
movel a0@(0xda4), sp@-   ; push CSamplerModule@(3492) = ptr to CAkaiSampler object
moveal sp@, a0            ; a0 = sampler_ptr
moveal a0@(2), a1         ; a1 = sampler_ptr[2] = vtable_ptr (CAkaiSampler stores vtable at +2)
moveal a1@(0x38), a1      ; a1 = vtable[0x38] = function pointer
jsr (a1)                  ; call vtable[0x38](sampler_ptr, &local_value)
```

Evidence at file offsets 0x02e84f–0x02e85a (first of 6 calls), confirmed by identical byte pattern at all 6 sites.

`CSamplerModule@(0xDA4)` is a POINTER to a **CAkaiSampler** object (which inherits CAkaiMIDIDispatcher). The CAkaiSampler constructor (file `0x068981`) stores the vtable pointer at `this+2`.

**The SCSI Plug is not involved.** The SCSI Plug binary (`scsi-plug-rsrc.bin`, 12KB) contains only `CMESAPlugIn` and `CSCSIPlug` classes — no `CMESASocket`. The vtable[0x38] encoding happens entirely within the sampler editor binary before any SCSI Plug call.

The earlier inference "vtable[0x38] is in the SCSI Plug binary" was incorrect. The correct object is CAkaiSampler, and its vtable is the CAkaiMIDIDispatcher vtable in `sampler-editor-rsrc.bin`.

---

## 3. vtable[0x38] Function: SwapLongWord

**File offset:** `0x06de81`  
**Runtime address:** `0x00045f2a`  
**Vtable entry:** `vtable[0x38]` = slot 14 at file `0x06f783`  
**Size:** 66 bytes  
**Name string at `0x06dec1`:** `SwapLongWord__19CAkaiMIDIDispatcherFPUl`

### Signature
```c
void SwapLongWord(CAkaiMIDIDispatcher* this, unsigned long* ptr);
// fp@(8) = this (unused in function body)
// fp@(12) = ptr (pointer to 32-bit value to byte-reverse in place)
```

### Algorithm — 32-bit byte reversal

The function reverses all 4 bytes of `*ptr` in place (big-endian ↔ little-endian):

```
*ptr → [B3 B2 B1 B0] becomes [B0 B1 B2 B3]
```

Step-by-step for input `0x12345678` (B3=0x12, B2=0x34, B1=0x56, B0=0x78):

| Step | Operation | Result |
|------|-----------|--------|
| Load | D0 = *ptr | `0x12345678` |
| Phase 1a | D0 = ROL.L(D0, 8) AND 0xFF00FF00 | `0x34005600` |
| Load | D1 = *ptr | `0x12345678` |
| Phase 1b | D1 = ROR.L(D1, 8) AND 0x00FF00FF | `0x00120056` |
| Phase 1c | D1 = D0 OR D1; *ptr = D1 | `0x34127856` (bytes swapped within each 16-bit word) |
| Load | D0 = *ptr | `0x34127856` |
| Phase 2a | D0 = SWAP(D0), CLR.W(D0), AND 0xFFFF0000 | `0x78560000` |
| Load | D1 = *ptr | `0x34127856` |
| Phase 2b | D1 = SWAP(CLR.W(D1)) AND 0x0000FFFF | `0x00003412` |
| Phase 2c | D1 = D0 OR D1; *ptr = D1 | `0x78563412` ← final byte-reversed result |

Verified: `SwapLongWord(0x12345678) = 0x78563412` ✓

### Key property: self-inverse
`SwapLongWord(SwapLongWord(v)) = v` for any 32-bit value. This explains the duplicate call on `fp(-16)` at file `0x02e86b`.

---

## 4. Complete Encoding: SLNGTH=4096 (0x00001000)

**Input:** `mah@(80)` = `total_byte_length` = 4096 = `0x00001000`

| Step | Value |
|------|-------|
| Load from mah | `fp(-16)` = `0x00001000` |
| `SwapLongWord(&fp(-16))` | `fp(-16)` = `0x00100000` |
| `MOVEL fp(-16), A2@(26)` | `header_buf[26..29]` = `00 10 00 00` |
| `BuildCommand::Nibbleize(header_buf[26..29])` | `00 00 00 01 00 00 00 00` |

The nibble pairs at SysEx bytes [59..66] are `00 00 00 01 00 00 00 00`.

### Other fields (all zero for no-loop test case)

| Field | Value | SwapLongWord | header_buf bytes | Nibbles |
|-------|-------|-------------|-----------------|---------|
| loop_start `mah@(52)` | 0 | 0 | `00 00 00 00` | `00 00 00 00 00 00 00 00` |
| loop_end `mah@(56)` | 0 | 0 | `00 00 00 00` | `00 00 00 00 00 00 00 00` |
| sustain_end `mah@(64)` | 0 | 0 | `00 00 00 00` | `00 00 00 00 00 00 00 00` |
| sustain_length | 0 | 0 | `00 00 00 00` | `00 00 00 00 00 00 00 00` |

For zero values, SwapLongWord is a no-op. The current test was sending zeros for all loop/sustain fields — those are correct regardless.

---

## 5. Headers[26..47] Layout (full picture)

| header_buf offset | Field | Source | vtable[0x38] file ref | Store instr |
|-------------------|-------|--------|-----------------------|-------------|
| 26..29 | SLNGTH | `mah@(80)` | `0x02e84f` | `25 6e ff f0 00 1a` at `0x02e85b` |
| 30..33 | loop_start | `mah@(52)` | `0x02e881` | `25 6e ff e4 00 1e` at `0x02e897` |
| 34..37 | loop_end | `mah@(56)` | `0x02e89d` | `25 6e ff e0 00 22` at `0x02e8b3` |
| 38..41 | sustain_end | `mah@(64)` | `0x02e8b9` | `25 6e ff dc 00 26` at `0x02e8cf` |
| 42..43 | (gap) | — | — | not written |
| 44..47 | sustain_length | `mah@(64)-mah@(60)+1` | `0x02e8d5` | `25 6e ff fc 00 2c` at `0x02e8eb` |

All confirmed from the raw bytes of the 6-call sequence (file `0x02e84f`–`0x02e8f1`):
```
48 6e ff f0  20 46  2f 28 0d a4  20 57  22 68 00 02  22 69 00 38  4e 91
25 6e ff f0 00 1a  <- MOVEL fp(-16), A2@(26)  [SLNGTH]
48 6e ff f0  20 46  2f 28 0d a4  20 57  22 68 00 02  22 69 00 38  4e 91
  [no store - cursor advance only]
48 6e ff e4  ...  4e 91
25 6e ff e4 00 1e  <- MOVEL fp(-28), A2@(30)  [loop_start]
48 6e ff e0  ...  4e 91
25 6e ff e0 00 22  <- MOVEL fp(-32), A2@(34)  [loop_end]
48 6e ff dc  ...  4e 91
25 6e ff dc 00 26  <- MOVEL fp(-36), A2@(38)  [sustain_end]
48 6e ff fc  ...  4e 91
25 6e ff fc 00 2c  <- MOVEL fp(-4),  A2@(44)  [sustain_length]
```

---

## 6. Diff Against test-bulk-akai-header.ts

### Current (wrong) `vtable38Encode`
```typescript
function vtable38Encode(value: number): number[] {
  return [
    (value >> 0) & 0xF,   // nibble-encode of low 16 bits
    (value >> 4) & 0xF,
    (value >> 8) & 0xF,
    (value >> 12) & 0xF,
  ];
}
```

For SLNGTH=4096: returns `[0x0, 0x0, 0x0, 0x1]` → header[26..29] = `00 00 00 01`

### Correct implementation (SwapLongWord)
```typescript
function swapLongWord(value: number): number[] {
  return [
    value & 0xFF,           // byte 0: LE byte 0 = original BE byte 3
    (value >> 8) & 0xFF,    // byte 1: LE byte 1 = original BE byte 2
    (value >> 16) & 0xFF,   // byte 2: LE byte 2 = original BE byte 1
    (value >> 24) & 0xFF,   // byte 3: LE byte 3 = original BE byte 0
  ];
}
```

For SLNGTH=4096: returns `[0x00, 0x10, 0x00, 0x00]` → header[26..29] = `00 10 00 00`

### What changes in buildAkaiHeader
Replace:
```typescript
const slngthEncoded = vtable38Encode(opts.slngthBytes);
```
With:
```typescript
const slngthEncoded = swapLongWord(opts.slngthBytes);
```

Rename `vtable38Encode` to `swapLongWord` throughout. The loop/sustain fields are all 0 in the test, so no change there for the current test case — but `swapLongWord` is the correct function to use for them too when they are non-zero.

---

## 7. Confidence Summary

| Claim | Confidence | Evidence |
|-------|-----------|----------|
| vtable[0x38] = SwapLongWord at file 0x06de81 | **high** | vtable dump at 0x06f74b slot 14 = runtime 0x00045f2a; 0x00045f2a + 0x027f57 = 0x06de81 exactly; delta verified by BuildCommand (2nd anchor) and AcceptSampleHeader (3rd anchor) |
| SwapLongWord = 32-bit byte reversal | **high** | Instruction-level decode of 66 bytes at 0x06de81; confirmed trace: 0x12345678 → 0x78563412 |
| Object dispatched is CAkaiSampler, not CMESASocket | **high** | SCSI Plug binary (12KB) has no CMESASocket; dispatch reads socket@(2) = vtable_ptr = CAkaiSampler's vtable-at-+2 layout |
| SLNGTH=4096 → header[26..29] = 00 10 00 00 | **high** | Traced through SwapLongWord(0x00001000) = 0x00100000 → stored as big-endian 4 bytes |
| Duplicate call at 0x02e86b is cursor advance | medium | Consistent with self-inverse property; no store follows; confirmed 6x8=48 stack bytes total |
| No dynamic verification (harness trace) | — | Static decode is unambiguous; dynamic verification not needed |
