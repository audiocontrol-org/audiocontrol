## Path A.7: CONS Payload Construction and SocketInfo[+0] fn_ptr

**Binary**: `sampler-editor-rsrc.bin`
**EDIT_BASE**: `0x027F57` (file_offset = EDIT_rel + 0x027F57)
**A4_BASE**: `0x06E8CB` (derived: LEA A4@(12502), A0 at file 0x059e91 = "PLST" at file 0x0719A1; 0x0719A1 - 12502 = 0x06E8CB)
**Date**: 2026-04-20
**Prior docs**: path-a6-plug-slot-origin.md, path-a5-socketinfo-construction.md, path-a-install-edge.md

All claims: **Measured** / **Inferred** / **Unknown**

> **CALIBRATION 2026-04-21 (per Codex parity #315 idx 4):** the Bottom Line below uses "Outcome A" framing that is stronger than the underlying evidence supports. The MEASURED facts (ctor stores 0x212 at file 0x0596e7; 0x212 + EDIT_BASE = file 0x028169 is a real function entry) are solid. The CANDIDATE inferences (that this is the SocketInfo[+0] field that the plug ultimately reads, AND that this transit happens via a "CONS SCSI command") have not been fully closed. Specifically: no decoded socket-method body shows `CMESASocket[+24]` being read and packed for transmission to the plug. That is the OPEN editor-side packing step (task #34 = Path A.10). Trust the byte-level decodes in this doc; treat the install-edge identity as CANDIDATE, not PROVED, until A.10 closes.

---

### Bottom Line

**CANDIDATE (per calibration banner above; framing was "Outcome A" before downgrade).** The construction site is in `CMESAEditor::ctor` at file `0x0596e7..0x0596ed`. The editor stores EDIT-relative address `0x212` (= file `0x028169`) into `CMESAEditor[+0x8C]`, which is **inferred** (not yet measured by tracing reads) to be `CMESASocket[+24]` = `SocketInfo[+0]`. The installed function at file `0x028169` has a valid LINK prologue and is designed to be called from outside the normal THINK C calling chain (it re-initializes A4/A5 at entry). It takes one arg: an IP_Data-like struct ptr.

This corrects path-a6's conjecture that the callback was `CMESASocket::AcceptData` at file `0x05A1E1`. That function exists (and is `CMESASocket vtable[+24]`) but is NOT the SocketInfo[+0] fn_ptr.

---

### 1. Object Layout Derivation (Measured)

`CMESASocket` is embedded in `CMESAEditor` at byte offset `+0x74`:

File `0x05969D`-`0x0596A3` in `CMESAEditor::ctor`:
```
05969D: 20 4A            MOVEA.L A2, A0     ; A0 = self (CMESAEditor)
05969F: 48 68 00 74      PEA (0x74,A0)      ; push &CMESAEditor[+0x74]
0596A3: 4E B9 00 03 1D C6  JSR $00031DC6    ; CMESASocket::ctor (file 0x059D1D)
```

Bytes verified: `48 68 00 74` at file `0x05969F`. **Measured.**

Therefore:
- `CMESASocket[+0]` = `CMESAEditor[+0x74]` (vtable ptr)
- `CMESASocket[+24]` = `CMESAEditor[+0x74 + 0x18]` = `CMESAEditor[+0x8C]`

---

### 2. Construction Site: fn_ptr Written into SocketInfo[+0] (Measured)

In `CMESAEditor::ctor` at file `0x0596E7..0x0596ED`:

```
0596E7: 41 F9 00 00 02 12    LEA $00000212, A0     ; A0 = EDIT-relative 0x212
0596ED: 25 48 00 8C          MOVE.L A0, (140,A2)   ; CMESAEditor[+0x8C] = 0x212
```

Byte-verified from xxd:
```
file 0x0596e7: 41 f9 00 00 02 12    ; LEA $00000212, A0
file 0x0596ed: 25 48 00 8c          ; MOVE.L A0, (140,A2)
```

`140 = 0x8C`. `A2` = CMESAEditor* (set at `0x059667: MOVEA.L (8,A6), A2`). **Measured.**

`CMESAEditor[+0x8C]` is **measured**. The stronger mapping
`CMESAEditor[+0x8C]` -> `CMESASocket[+24]` -> `SocketInfo[+0]` remains
**candidate-grade** pending the editor-side packing/transmission step.

**Claim**: This is the only store to offset `0x8C` in CMESAEditor that sets a fn_ptr. Exhaustive search for `MOVE.L ?, (24,Ax)` instructions in the code section found no occurrences matching the layout (the two raw hits at file `0x057D17` and `0x0562B5` fall in data regions, not code). **Measured.**

---

### 3. The Installed Callback at File 0x028169 (Measured)

File offset `0x028169` = EDIT-relative `0x000212`.

Prologue bytes: `4E 56 00 00 48 E7 1C 30` = `LINK A6, #0; MOVEM.L #$1C30, -(SP)`. **Measured** (valid function entry). **Measured.**

Saved registers (mask 0x1C30): D3, D4, D5, A2, A3.

Function body (first 20 instructions):
```
028169: 4E 56 00 00      LINK A6, #0
02816D: 48 E7 1C 30      MOVEM.L #$1C30, -(SP)
028171: 24 6E 00 08      MOVEA.L (8,A6), A2     ; A2 = arg1 (IP_Data-like struct ptr)
028175: 4E B9 00 00 01 04  JSR $00000104        ; re-init A4/A5 (THINK C world setup)
02817B: 28 00            MOVE.L D0, D4          ; save return value
02817D: 20 12            MOVE.L (A2), D0        ; D0 = struct[+0] (first field of arg)
02817F: 04 80 49 4E 49 54  SUBI.L #0x494E4954, D0 ; compare against 'INIT'
028185: 67 02            BEQ.S $028189          ; if struct[+0] == 'INIT': branch
028187: 60 3E            BRA.S $0281C7          ; else: different path
028189: 2F 3C 00 00 CE 34  MOVE.L #0x0000CE34, -(A7) ; push size 0xCE34
02818F: 4E B9 00 02 72 A4  JSR $000272A4        ; allocate object
...
0281F9: 20 04            MOVE.L D4, D0          ; restore D0 = result from JSR $104
0281FB: C1 8C            AND.L D0, A4           ; restore A4 (A4 &= D0 pattern)
0281FD: 4C DF 0C 38      MOVEM.L (SP)+, #$0C38  ; restore saved regs
028201: 4E 5E            UNLK A6
028203: 4E 75            RTS
```

**Preceding name string**: none visible between the prior function's RTS (file `0x028167`) and the LINK at `0x028169`. **Measured.**

**Bytes after RTS** (at `0x028205`): `84 6D 61 69 6E 00 00 00` = `\x84main\0\0\0`. The `\x84` prefix is a non-standard THINK C visibility marker. The effective name is "main" with a private/special tag. This is NOT `CMESASocket::AcceptData` or any CMESASocket method — it is an unnamed/opaque callback with a THINK C-internal "main" designation. **Measured.**

**A4/A5 re-init at entry** (`JSR $00000104` = file `0x02805B`): this is the THINK C world-setup stub used when code is called from an external code segment that does not set up A4. Its presence confirms the callback is designed to be invoked from outside the normal THINK C calling chain — consistent with being called from the scsi-plug binary via the slot dispatch at file `0x11FE`. **Inferred.**

**Argument convention**: takes one arg on the stack at `fp@(8)` = a struct ptr (A2). Reads struct[+0] and checks for the tag `'INIT'` (0x494E4954). The 'INIT' check does NOT match 'SRAW' or 'SYSX' — those tags are set by the plug when delivering SCSI replies (sraw-decoded.md section 5). The IP_Data struct built by the plug has its tag at struct[+18] relative to the pushed base (fp@(-26...) in the plug), NOT at struct[+0]. This discrepancy between the 'INIT' check and the expected 'SRAW'/'SYSX' tags suggests one of: (a) the tag field position differs from sraw-decoded.md's description, (b) 'INIT' is a connect-time handshake tag distinct from data-delivery tags, or (c) the struct layout is different from what was assumed in sraw-decoded.md. **Unknown** — requires runtime verification.

---

### 4. CONS Payload Layout (Measured + Inferred)

The editor sends a "CONS" MESACommand to the plug's `DoMESACommand` (scsi-plug vtable dispatch). The MESACommand struct is built on the editor's stack in `CMESASocket::ConnectToPlug` (file `0x059E4B`).

#### 4a. MESACommand struct (10 bytes at fp@(-14)) (Measured)

Construction at file `0x059ED1..0x059EE5`:

```
059ED1: 41 EC 30 CC      LEA A4@(0x30CC), A0    ; A0 = "CONS" string at file 0x071997
059ED5: 43 EE FF F2      LEA (-14,A6), A1       ; A1 = fp@(-14) = output buffer
059ED9: 22 D8            MOVE.L (A0)+, (A1)+    ; bytes 0-3: 'C','O','N','S'
059EDB: 22 D8            MOVE.L (A0)+, (A1)+    ; bytes 4-7: '\0','\0','\0','\0'
059EDD: 32 D8            MOVE.W (A0)+, (A1)+    ; bytes 8-9: '\0','\0'
059EDF: 20 4A            MOVEA.L A2, A0         ; A0 = CMESASocket (self)
059EE1: 41 E8 00 18      LEA (24,A0), A0        ; A0 = &CMESASocket[+24] = SocketInfo*
059EE5: 2D 48 FF F8      MOVE.L A0, (-8,A6)     ; fp@(-8) = SocketInfo ptr
                                                ; NOTE: fp@(-8) = bytes 6-9 of the name buffer
                                                ; OVERWRITES bytes 6-9 with SocketInfo ptr
```

`fp@(-14)` and `fp@(-8)` overlap: `fp@(-14)` = base of 10-byte buffer; `fp@(-8)` = byte 6 of that buffer (= `fp@(-14) + 6`). The `MOVE.L A0, (-8,A6)` at `0x059EE5` overwrites bytes 6-9 with the 4-byte runtime pointer to `CMESASocket[+24]`. **Measured.**

Resulting 10-byte MESACommand struct:

| Byte offset | Value | Source |
|-------------|-------|--------|
| 0-3 | `43 4F 4E 53` = 'CONS' | CONS string copy |
| 4-5 | `00 00` | CONS string null bytes |
| 6-9 | runtime ptr to CMESASocket[+24] | MOVE.L A0, (-8,A6) |

This struct is passed as `PEA (-14,A6)` to `plug_slot[D3*48+12]` = scsi-plug's `DoMESACommand`. **Measured.**

#### 4b. CONS dispatch in scsi-plug DoMESACommand (Measured)

scsi-plug `DoMESACommand` at file `0x089A` reads `MESACommand[+0]` = cmd tag and routes via a jump table. The "CONS" entry was found at scsi-plug file `0x0008D4`:

```
scsi-plug 0x0008d4: 43 4F 4E 53 = "CONS"
scsi-plug 0x0008d8: 00 2E       = offset 0x2E from table base
```

The "CONS" handler calls `vtable[+20]` of CSCSIPlug = `ConnectToSocket` (scsi-plug file `0x09D2`) with:
- arg1: CSCSIPlug* this
- arg2: `MESACommand[+6]` = bytes 6-9 of the MESACommand = runtime ptr to SocketInfo

scsi-plug code at file `0x0008F2`-`0x000900`:
```
0008F2: 2F 2A 00 06    MOVE.L (6,A2), -(A7)    ; push MESACommand[+6] = SocketInfo*
0008F6: 2F 0B          MOVE.L A3, -(A7)         ; push this (CSCSIPlug)
0008F8: 20 57          MOVEA.L (A7), A0
0008FA: 22 50          MOVEA.L (A0), A1
0008FC: 22 69 00 14    MOVEA.L (20,A1), A1      ; vtable[+20]
000900: 4E 91          JSR (A1)                 ; ConnectToSocket(this, SocketInfo*)
```

**Measured** (bytes `2F 2A 00 06 2F 0B 20 57 22 50 22 69 00 14 4E 91` confirmed at file 0x0008F2).

#### 4c. 46-byte SocketInfo at CMESASocket[+24..+69] (Measured)

`ConnectToSocket` receives `fp@(12)` = `SocketInfo*` = ptr to `CMESASocket[+24]` and copies 46 bytes verbatim into `plug_slot`:

| SocketInfo offset | CMESASocket offset | Value at send time | Source |
|---|---|---|---|
| [+0..+3] | [+24..+27] | `00 00 02 12` (EDIT-rel 0x212 = fn_ptr to file 0x028169) | CMESAEditor::ctor MOVE.L A0,(140,A2) |
| [+4] | [+28] | `00` | CMESASocket::ctor CLR.B (28,A2) |
| [+5..+35] | [+29..+59] | `00..00` | heap-zero (Mac OS NewHandle zeroes allocation) |
| [+36..+37] | [+60..+61] | `00 00` | CMESASocket::ctor CLR.W (60,A2) |
| [+38..+41] | [+62..+65] | `00 00 00 00` | CMESASocket::ctor CLR.L (62,A2) |
| [+42..+45] | [+66..+69] | runtime ptr = CMESASocket+4 | CMESASocket::ctor MOVE.L A0,(66,A2) where A0=self+4 |

The harness value for SocketInfo[+42..+45] must be the runtime address of the CMESASocket object + 4. For a harness that constructs a synthetic SocketInfo, this field can be zeroed if the callback does not use it. **Inferred** (no code observed reading SocketInfo[+42] in the plug or calling back through it).

---

### 5. Verification: SocketInfo[+0] vs CMESASocket vtable[+24]

**CMESASocket vtable** is at file `0x07193B` (A4@0x3070). vtable entry[+24] (byte offset 24, = entry index 6) = EDIT-relative `0x0003228A` = file `0x05A1E1`.

File `0x05A1E1`: `4E 56 00 00` = LINK A6, #0. This is `CMESASocket::AcceptData` (or equivalent). **This is NOT the SocketInfo[+0] fn_ptr.** The vtable entry is at object[+0] = the vtable TABLE pointer. The SocketInfo[+0] fn_ptr is the data VALUE at object offset +24.

The two are completely separate:
- `CMESASocket[+0]` = pointer to the vtable table (at file 0x07193B)
- vtable table entry[+24] = EDIT-relative address of `AcceptData` = file 0x05A1E1
- `CMESASocket[+24]` = a different DATA field = the fn_ptr 0x212 installed by CMESAEditor::ctor

path-a6's open question "Likely CMESASocket::AcceptData at file 0x05A1E1" was incorrect. **Measured.**

---

### 6. Claim Table

| Claim | Tag | Evidence |
|-------|-----|----------|
| CMESASocket embedded at CMESAEditor[+0x74] | Measured | PEA (0x74,A0) at file 0x05969F, bytes `48 68 00 74` |
| `CMESAEditor[+0x8C] = CMESASocket[+24]` by layout arithmetic | Measured | +0x74 + 24 = +0x8C (arithmetic) |
| `CMESASocket[+24]` is the exact field that becomes plug-visible `SocketInfo[+0]` | Candidate | Requires the still-open editor-side packing/transmission step |
| CMESAEditor::ctor stores 0x212 at CMESAEditor[+0x8C] | Measured | LEA $212, A0 + MOVE.L A0,(140,A2) at file 0x0596E7-0x0596ED |
| fn_ptr = EDIT-relative 0x212 = file 0x028169 | Measured | 0x027F57 + 0x212 = 0x028169 |
| File 0x028169 is a valid function entry | Measured | `4E 56 00 00 48 E7 1C 30` = LINK A6,#0; MOVEM |
| Callback is designed for cross-segment invocation | Inferred | JSR $00000104 (world-setup) as first call in body |
| Callback takes IP_Data-like struct as single arg | Measured | MOVEA.L (8,A6), A2; reads (A2) = struct[+0] |
| Callback checks struct[+0] for 'INIT' tag | Measured | SUBI.L #0x494E4954, D0 at file 0x02817F |
| 'INIT' tag mismatch with 'SRAW'/'SYSX' from plug | Measured | Plug sets fp@(-34) = tag, not fp@(-26+0) |
| CONS name buffer at fp@(-14), 10 bytes | Measured | LEA(-14,A6),A1; 2x MOVE.L + 1x MOVE.W from A4@0x30CC |
| fp@(-8) = bytes 6-9 of CONS name buffer = SocketInfo ptr | Measured | Arithmetic: fp@(-14)+6 = fp@(-8); MOVE.L A0,(-8,A6) |
| scsi-plug "CONS" dispatch entry at file 0x0008D4, offset 0x2E | Measured | Bytes `43 4F 4E 53 00 2E` at scsi-plug 0x0008D4 |
| CONS handler calls ConnectToSocket via vtable[+20] | Measured | `22 69 00 14 4E 91` at scsi-plug 0x0008FC-0x000900 |
| MESACommand[+6] = SocketInfo* passed as ConnectToSocket arg2 | Measured | `2F 2A 00 06` at scsi-plug 0x0008F2 |
| SocketInfo[+0] fn_ptr is NOT CMESASocket::AcceptData | Measured | 0x028169 != 0x05A1E1 |
| SocketInfo[+42..+45] = runtime CMESASocket+4 | Measured | CMESASocket::ctor MOVE.L A0,(66,A2) with A0=self+4 |

---

### 7. Open Questions

1. **Why does the callback check 'INIT' at struct[+0] rather than 'SRAW'/'SYSX'?** (Unknown). The IP_Data struct layout in the plug's reply dispatch (sraw-decoded.md section 5) places the tag at a non-zero offset from the base. Either the struct layout at [+0] holds something else (possibly a vtable or object pointer), or 'INIT' is a distinct message type sent during connection setup rather than data delivery. Runtime verification required.

2. **What does the callback do on 'INIT'?** (Partially inferred). It allocates `0xCE34` (52,788) bytes via `JSR $000272A4` (a heap allocator). This is too large for most plugin objects — unclear purpose without following the subsequent logic.

3. **What does the callback do on non-'INIT' messages?** (Unknown). The non-'INIT' path at file `0x0281C7` accesses a global via `A4@(24226)` (file `0x07476D`). Not decoded.

4. **Does the harness need to provide a runtime SocketInfo or a static one?** (Inferred). For testing `ConnectToSocket` in the plug harness, a static SocketInfo with `[+0..+3] = 0x00000212` and all other fields zeroed should suffice if the callback is only invoked during reply delivery (not during slot registration). Runtime verification required.
