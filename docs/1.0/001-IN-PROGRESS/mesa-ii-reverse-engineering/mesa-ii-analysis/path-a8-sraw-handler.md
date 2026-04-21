## Path A.8: vtable[+0xA8] SRAW Handler Decode

**Binary**: `sampler-editor-rsrc.bin`
**EDIT_BASE**: `0x027F57` (file_offset = EDIT_rel + 0x027F57)
**A4_BASE**: `0x06E8CB`
**Date**: 2026-04-20
**Prior docs**: sraw-decoded.md, path-a7-cons-construction.md, path-a6-plug-slot-origin.md

All claims: **Measured** / **Inferred** / **Unknown**

> **CALIBRATION 2026-04-21 (per Codex parity #315 idx 4):**
> 1. **Direction qualifier:** this doc traces the REPLY direction (sampler→editor incoming dispatch). The original Phase 3 question (what bytes does MESA emit for SRAW *upload*) is the OPPOSITE direction and is OPEN — see task #33 / Path A.9.
> 2. **Install-edge identity downgrade:** any claim in this doc that frames the editor-side `main` callback (file 0x028169) as "installed via CONS/ConnectToSocket" should be read as CANDIDATE, not PROVED. The byte-level decode of the dispatch chain that ENDS at this callback is MEASURED; the framing of how the callback got registered is inherited from path-a7 and now downgraded to CANDIDATE pending A.10.

---

### Bottom Line

**MEASURED for the REPLY-direction dispatch chain; CANDIDATE for the install-edge framing.**

The path from INIT-time allocation through vtable[+0xA8] to the SRAW REPLY-direction handler is fully traceable in `sampler-editor-rsrc.bin`. The terminal function is `CMESASocket::AcceptData` at file `0x05A1E1`, which copies the SCSI reply payload from the plug's IP_Data struct into the `CMESASocket` internal receive buffer. No further runtime dispatch occurs within this REPLY path.

The 'SRAW'/'SYSX' tag distinction (built by the plug at scsi-plug `$11cc/$11c2`) is only consulted after `AcceptData` returns — it is stored in `CMESASocket[+12]` by `AcceptData` itself as a status tag for the caller to read, not dispatched on.

**Not addressed by this doc:** the OUTBOUND audio direction (editor→sampler SRAW upload). That CDB construction lives in `CSCSIPlug::SendData` SRAW handler body at scsi-plug file 0x0ec0, before the shared-entry JSR at $106e. Task #33 (Path A.9) targets it.

---

### 1. EDIT-Base Verification (Measured)

EDIT-relative address `0x272A4` + `0x027F57` = file `0x04F1FB`.

Bytes at file `0x04F1FB`: `4E 56 00 00 48 E7 1F 30` = `LINK A6, #0; MOVEM.L #$1F30, -(SP)`.

Valid function prologue. EDIT-base confirmed. **Measured.**

---

### 2. The Constructed Object (Measured)

The callback at file `0x028169` ("main") handles the `'INIT'` tag by:

1. Calling `JSR $272A4` (file `0x04F1FB`) — a `_NewHandle` wrapper that allocates `0xCE34` (52,788) bytes and returns a locked handle.
2. Calling `JSR $2B6` (file `0x02820D`) — the true constructor for the allocated object. This constructor installs a vtable pointer at `object[+4]` = `A4+0x54F0` = file `0x073DBB`.

The vtable at file `0x073DBB` is NOT `CMESASocket`'s vtable (file `0x07193B`). It belongs to a large Akai S3000 editor object. **Measured** from constructor body decode.

#### Object vtable

| vtable offset | file offset of value | EDIT-relative value | File offset of function |
|---|---|---|---|
| +0 | 0x073DBB | (first entry) | — |
| ... | ... | ... | — |
| +0xA8 | 0x073E63 | `0x0000086E` | file `0x0287C5` |

Bytes at `0x073E63`: `00 00 08 6E`. EDIT-rel `0x086E` + `0x027F57` = file `0x0287C5`. **Measured.**

---

### 3. vtable[+0xA8] at File 0x0287C5 (Measured)

Prologue: `4E56 0000 48E7 1C30` = `LINK A6, #0; MOVEM.L D3/D4/D5/A2/A3, -(SP)`.

Arguments: `A3 = fp@(8)` = handle (the INIT-allocated object); `A2 = fp@(12)` = struct_ptr (IP_Data).

The function reads `D0 = struct[+0]` and dispatches via `JSR $0x1ec` (file `0x028143`, the THINK C computed-goto dispatcher) with a table at file `0x0287DF`.

#### First dispatch table (file 0x0287DF)

- Range: `'OTFL'` (0x4F54464C) to `'aete'` (0x61657465)
- Entries: 74 (Apple event handlers + Akai protocol tags: EBFL, EBFX, EBRV, PSYS, SDBS, SMDB, OTFL, SMDB, and others)
- `'ADAT'` = 0x41444154 is **below** the lo-bound `'OTFL'` → **misses this table**
- Miss path falls through to file `0x0289A9`

**Measured:** table count word, lo/hi bounds verified from binary bytes at `0x0287DF`. **Measured.**

#### Fallthrough at file 0x0289A9

```
0x289A9: MOVE.L A2, -(SP)     ; push struct_ptr
0x289AB: MOVE.L A3, -(SP)     ; push handle (object ptr)
0x289AD: JSR $0x3194E         ; file 0x598A5 (SUBI.L chain dispatcher)
0x289B3: MOVE.B D0, D4
0x289B5: ADDQ.W #8, SP
```

**Measured** from bytes at `0x289A9`. **Measured.**

---

### 4. SUBI.L Chain at File 0x598A5 (Measured)

The function at file `0x598A5` dispatches by matching `D0` (= `struct[+0]` = `'ADAT'` = `0x41444154`) against a sequence of known tags via chained `SUBI.L + BEQ` pattern. D0 starts with the tag value; each SUBI subtracts a delta and the BEQ fires when D0 reaches 0.

Two SUBI steps to reach `'ADAT'`:

```
0x598C9: SUBI.L #0x41435456, D0    ; subtract 'ACTV': D0 = 0x41444154 - 0x41435456 = 0x0000ECFE
0x598CF: BEQ.W 0x59A07             ; D0 != 0: skip (not 'ACTV')
0x598D3: SUBI.L #0x0000ECFE, D0   ; subtract residual: D0 = 0x0000ECFE - 0x0000ECFE = 0
0x598D9: BEQ.W 0x599A7             ; D0 == 0: MATCH → branch to ADAT handler
```

**Measured:** bytes `04 80 00 00 EC FE 67 00 00 CC` at file `0x598D3–0x598DC`. BEQ.W target = `0x598D9 + 2 + 0x00CC = 0x599A7`. **Measured.**

---

### 5. The ADAT Handler at File 0x599A7 (Measured)

```
0x599A7: MOVEA.L D3, A0         ; A0 = struct_ptr (IP_Data)
0x599A9: MOVE.L (6,A0), -(SP)   ; push struct[+6] = embedded data ptr (arg2)
0x599AD: PEA (116,A3)           ; push &object[+0x74] = &CMESASocket (arg1)
0x599B1: MOVEA.L (SP), A0       ; A0 = &CMESASocket (peek, not pop)
0x599B3: MOVEA.L (A0), A1       ; A1 = CMESASocket vtable ptr
0x599B5: MOVEA.L (24,A1), A1    ; A1 = vtable[+24] = AcceptData
0x599B9: JSR (A1)               ; AcceptData(&CMESASocket, struct[+6])
0x599BB: MOVEA.L D3, A0         ; restore struct_ptr
0x599BD: MOVE.W D0, (4,A0)      ; struct[+4] = return code from AcceptData
0x599C1: ADDQ.W #8, SP          ; pop 2 args
0x599C3: BRA.W ...              ; continue
```

**Measured** from bytes at file `0x599A7`: `20 43 2F 28 00 06 48 6B 00 74 20 57 22 50 22 69 00 18 4E 91`. **Measured.**

**Dispatch target:** `CMESASocket` is the sub-object embedded at `object[+0x74]` (= `CMESAEditor[+0x74]`, from path-a7). Its vtable is at file `0x07193B`. vtable[+24] = EDIT-rel `0x3228A` = file `0x05A1E1`. **Measured** (bytes at file `0x07193B + 24 = 0x71953`: `00 03 22 8A`). **Measured.**

---

### 6. IP_Data Struct[+6] — Self-Referential Pointer (Measured)

From scsi-plug `0x11E8–0x11EC`:

```
11E8: LEA (-16, A6), A0          ; A0 = fp@(-16) = &struct[+10]
11EC: MOVE.L A0, (-20, A6)       ; fp@(-20) = struct[+6] = &struct[+10]
```

`struct[+6]` is a self-referential pointer: it holds the address of `struct[+10]` within the same IP_Data stack frame. **Measured** from scsi-plug bytes at `0x11E8`. **Measured.**

Therefore `AcceptData`'s second argument (`A3 = struct[+6]`) is a pointer into the middle of the same IP_Data struct. The sub-fields accessible via A3 are:

| A3 offset | Absolute struct offset | Value |
|---|---|---|
| A3[+0] | struct[+10] = fp@(-16) | device reply byte count (written by SEND_FUNC_SLOT into *rptr) |
| A3[+4] | struct[+14] = fp@(-12) | MIDI reply buffer ptr (CSCSIPlug[+0xe3c]) |
| A3[+8] | struct[+18] = fp@(-8) | `'SRAW'` or `'SYSX'` semantic tag |

Note on A3[+0]: sraw-decoded.md originally described `fp@(-30)` (later copied to struct[+10]) as the "device reply buffer address." The AcceptData function uses A3[+0] as a `_BlockMove` byte count (`MOVE.L (A3), D0` then `_BlockMove`). These two interpretations are inconsistent. The most coherent reading is that `SEND_FUNC_SLOT` writes the **byte count of the received reply** into `*rptr`, not a buffer address. **Inferred** — inconsistency noted, runtime verification required.

---

### 7. CMESASocket::AcceptData at File 0x05A1E1 (Measured)

**Signature (Inferred):** `short AcceptData(CMESASocket* self, DataDesc* desc)`

```
0x5A1E1: LINK A6, #0
0x5A1E5: MOVE.L A3, -(SP)        ; save A3
0x5A1E7: MOVE.L A2, -(SP)        ; save A2
0x5A1E9: MOVEA.L (8,A6), A2      ; A2 = arg1 = &CMESASocket (self)
0x5A1ED: MOVEA.L (12,A6), A3     ; A3 = arg2 = struct[+6] ptr (sub-desc)
0x5A1F1: TST.L (8,A2)            ; test CMESASocket[+8] (receive buffer ptr)
0x5A1F5: BEQ.S 0x5A217           ; if CMESASocket[+8] == 0 → error path

--- nonzero (buffer allocated) path ---
0x5A1F7: MOVEA.L (16,A2), A0     ; A0 = CMESASocket[+16] (a capacity/limit value)
0x5A1FB: CMP.L (A3), D0          ; D0=0, compare 0 against *(A3) = reply byte count
0x5A1FD: BGE.S 0x5A217           ; if byte count <= 0 → error path

--- valid data path ---
0x5A1FF: MOVEA.L (4,A3), A0      ; A0 = A3[+4] = MIDI reply buf ptr (source)
0x5A203: MOVEA.L (8,A2), A1      ; A1 = CMESASocket[+8] (destination buffer)
0x5A207: MOVE.L (A3), D0         ; D0 = A3[+0] = reply byte count
0x5A209: _BlockMove               ; copy D0 bytes from A0(MIDI buf) to A1(CMESASocket buf)
0x5A20B: MOVE.L (8,A3), (12,A2)  ; CMESASocket[+12] = A3[+8] = semantic tag ('SRAW'/'SYSX')
0x5A211: MOVE.L (A3), (4,A2)     ; CMESASocket[+4] = A3[+0] = reply byte count
0x5A215: BRA.S 0x5A225           ; to success epilogue

--- error path ---
0x5A217: MOVE.L #0x4F564552, (12,A2)  ; CMESASocket[+12] = 'OVER' (overflow/error)
0x5A21F: MOVE.W #0xD503, D0           ; D0 = 0xD503 (error sentinel)
0x5A223: BRA.S 0x5A227               ; to epilogue

--- success path ---
0x5A225: MOVEQ #0, D0             ; D0 = 0 (success)

--- epilogue ---
0x5A227: MOVEA.L (SP)+, A2
0x5A229: MOVEA.L (SP)+, A3
0x5A22B: UNLK A6
0x5A22D: RTS
```

**Measured** from bytes at file `0x5A1E1–0x5A22D`. **Measured.**

#### What AcceptData does

On success:
1. Validates that `CMESASocket[+8]` (receive buffer) is allocated (non-null).
2. Validates that `A3[+0]` (reply byte count) is positive.
3. Calls `_BlockMove(src=MIDI_reply_buf_ptr, dst=CMESASocket[+8], count=reply_byte_count)`.
4. Stores the semantic tag (`'SRAW'` or `'SYSX'`) at `CMESASocket[+12]`.
5. Stores the byte count at `CMESASocket[+4]`.
6. Returns D0 = 0.

On error (buffer null or count <= 0):
1. Stores `'OVER'` at `CMESASocket[+12]`.
2. Returns D0 = `0xD503`.

The return code (D0) is written back into `IP_Data[+4]` by the ADAT handler at `0x599BD`: `MOVE.W D0, (4,A0)`.

---

### 8. CMESASocket Field Map (Measured + Inferred)

| CMESASocket offset | Purpose | Source |
|---|---|---|
| [+0] | vtable ptr → file `0x07193B` | CMESASocket::ctor |
| [+4] | last reply byte count (post-AcceptData) | AcceptData MOVE.L (A3),(4,A2) |
| [+8] | receive buffer ptr (must be non-null for AcceptData to proceed) | CMESASocket::ctor (Inferred — not decoded) |
| [+12] | status tag: `'SRAW'`, `'SYSX'`, or `'OVER'` | AcceptData |
| [+16] | capacity or limit value (compared in AcceptData) | Unknown |
| [+24] | candidate callback field seeded to EDIT-rel `0x212` = file `0x028169` | CMESAEditor::ctor (path-a7); exact plug-visible `SocketInfo[+0]` link still open |

---

### 9. Full Chain: SRAW Reply to AcceptData (Summary)

Starting point: scsi-plug fires `JSR (slot_fn_ptr)` at file `0x11FE`, passing `pea fp@(-26)` = ptr to IP_Data struct.

```
scsi-plug $11FE
  → file 0x028169 "main" callback (EDIT-rel 0x212; plug-visible install path still candidate-grade per A.10)
    reads struct[+0] = 'ADAT'
    struct[+18] = 'SRAW' or 'SYSX' (set by plug at $11cc or $11c2)
    struct[+6] = &struct[+10] (self-referential ptr)

    NOT 'INIT' → non-INIT path at file 0x0281C7
      accesses global handle at A4@(0x5EA2) = the INIT-allocated 0xCE34-byte object
      calls vtable[+0xA8] on that object [file 0x0287C5]
        arg1 = handle (the 0xCE34 object)
        arg2 = struct_ptr (IP_Data)

      vtable[+0xA8] at file 0x0287C5:
        D0 = struct[+0] = 'ADAT'
        first dispatch table (file 0x0287DF, range 'OTFL'..'aete'): 'ADAT' misses
        fallthrough → file 0x0289A9
          JSR file 0x598A5 (SUBI.L chain)
            SUBI chain matches 'ADAT' → BEQ.W to file 0x599A7

            file 0x599A7 (ADAT handler):
              push struct[+6] (= &struct[+10] = reply desc ptr)
              push &CMESASocket (object[+0x74])
              MOVEA.L (CMESASocket[+0]), A1  ; vtable
              MOVEA.L (24, A1), A1           ; vtable[+24] = AcceptData
              JSR (A1)  → file 0x5A1E1

              file 0x5A1E1 CMESASocket::AcceptData:
                if CMESASocket[+8] == 0: return 0xD503
                if reply_byte_count <= 0: return 0xD503
                _BlockMove(MIDI_reply_buf → CMESASocket[+8], count=reply_byte_count)
                CMESASocket[+12] = 'SRAW' or 'SYSX'
                CMESASocket[+4] = reply_byte_count
                return 0
```

**The chain terminates at `AcceptData` (file `0x5A1E1`). No further vtable dispatch.**

---

### 10. What Is NOT Decoded

1. **The non-INIT path at file `0x0281C7`**: reads a global handle from `A4@(0x5EA2)` and calls `vtable[+0xA8]`. The code path and the global handle access were not decoded in this investigation. The call to `vtable[+0xA8]` is the step that leads to the full chain above — but the specific instructions between `0x0281C7` and the vtable dispatch were not read. **Unknown** — assumed structurally from the call chain, but not byte-verified.

2. **CMESASocket[+8] allocation**: `AcceptData` requires `CMESASocket[+8]` (receive buffer) to be non-null. The instruction(s) that allocate and store this buffer were not traced. **Unknown.**

3. **CMESASocket[+16] role**: loaded into A0 before the byte-count comparison but never used after if the BGE branch is not taken. May be a capacity limit check that was optimized away, or a remnant. **Unknown.**

4. **What happens after AcceptData returns to the `"main"` callback**: After vtable[+0xA8] returns, the `"main"` function at `0x028169` continues — presumably notifying upper layers about the received data. This path was not decoded. **Unknown.**

5. **CDB bytes for SRAW audio transmission**: The outbound SRAW send path goes through `SEND_FUNC_SLOT` at scsi-plug `$1106e`, which is a runtime-installed callback from the Sampler Editor side. The CDB format for the ASPACK/SRAW send was not decoded in this path. This remains the open question from sraw-decoded.md. **Unknown.**

---

### 11. Claim Table

| Claim | Tag | Evidence |
|-------|-----|----------|
| EDIT-base 0x027F57 verified | Measured | `4E56 0000 48E7 1F30` at file 0x04F1FB |
| vtable[+0xA8] at file 0x0287C5 | Measured | Value at 0x073E63 = 0x0000086E; 0x86E+EDIT_BASE = 0x0287C5 |
| vtable[+0xA8] dispatches on struct[+0] | Measured | MOVE.L (A2), D0 at function entry; JSR $0x1ec dispatch |
| First table misses 'ADAT' (0x41444154 < lo_bound 'OTFL') | Measured | Table at 0x0287DF, lo=0x4F54464C |
| 'ADAT' routes to SUBI chain at file 0x598A5 | Measured | Fallthrough JSR $0x3194E at 0x289AD |
| SUBI chain branch 1 matches 'ADAT' → file 0x599A7 | Measured | SUBI.L #0xECFE at 0x598D3, BEQ.W at 0x598D9 to 0x599A7 |
| ADAT handler calls CMESASocket::AcceptData | Measured | PEA(116,A3) + vtable read + (24,A1) + JSR(A1) at 0x599A7-0x599B9 |
| 116 = 0x74 = CMESASocket embedded at object[+0x74] | Measured | PEA (116,A3) bytes `48 6B 00 74` at 0x599AD |
| CMESASocket vtable at file 0x07193B, vtable[+24] = file 0x5A1E1 | Measured | Bytes `00 03 22 8A` at 0x07193B+24 |
| AcceptData copies MIDI reply buf to CMESASocket[+8] via _BlockMove | Measured | _BlockMove at 0x5A209, A0=A3[+4], A1=CMESASocket[+8], D0=A3[+0] |
| AcceptData stores 'SRAW'/'SYSX' tag at CMESASocket[+12] | Measured | MOVE.L (8,A3),(12,A2) at 0x5A20B |
| AcceptData stores byte count at CMESASocket[+4] | Measured | MOVE.L (A3),(4,A2) at 0x5A211 |
| Error path stores 'OVER' + returns 0xD503 | Measured | MOVE.L #0x4F564552,(12,A2) + MOVE.W #0xD503,D0 at 0x5A217-0x5A221 |
| struct[+6] = self-referential ptr to struct[+10] | Measured | LEA(-16,A6),A0; MOVE.L A0,(-20,A6) at scsi-plug 0x11E8-0x11EC |
| struct[+10] = reply byte count (not a buffer ptr) | Inferred | Used as BlockMove count in AcceptData; inconsistent with sraw-decoded "buffer address" label |
| Non-INIT path reads global handle from A4@(0x5EA2) | Inferred | Structural — not byte-verified in this investigation |
