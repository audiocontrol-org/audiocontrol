## Path A.14: Mode-Byte Mutation Trace — 0x160c to 0x1670

**Binary**: `scsi-plug-rsrc.bin`
**PLUG resource**: type `PLUG` ID 0, file offset `0x059e`, length `0x28b3`
**Addresses**: file offset = runtime address
**Date**: 2026-04-20
**Prior docs**: path-a9-sraw-outbound.md, path-a12-mode-byte-semantics.md, path-a13-bus-emission-body.md

All claims tagged per-claim: **MEASURED** (file offset + bytes cited) / **CANDIDATE** (reasoned, not byte-verified) / **OPEN** (decode boundary not crossed)

---

### Bottom Line

**Outcome B — mode stays intact.** No path from SMSendData entry (0x160c) to the mode-byte test (0x1670) writes to `fp@(14)` or to any storage that aliases it. The mode byte pushed by the SRAW handler (`MOVE.B #1, -(SP)` at file `0x0f56`) is preserved, unmodified, when `TSTB fp@(14)` executes at `0x1670`. CDB[5] = `0x80` is the deterministic static output for every SRAW call.

**Implication**: the "static candidate path is not the live emitted shape" hypothesis (Outcome A) is not supported by static evidence. The stronger remaining explanation for hardware's universal rejection of `flag=0x80` is the patch-target-differs hypothesis: production is reaching a different function than SMSendData at `0x106e`.

---

### Step 0: Anchor Re-Verification

All four anchors verified before analysis. All pass.

| Anchor | Expected bytes | File offset | Raw bytes | Result |
|--------|---------------|-------------|-----------|--------|
| SMSendData LINK + MOVEM | `4e 56 ff fa 48 e7 1f 30` | `0x160c` | `4e 56 ff fa 48 e7 1f 30` | PASS — **MEASURED** |
| Mode-byte test | `4a 2e 00 0e 67 06 3a 3c 00 80 60 02 7a 00 1d 45` | `0x1670` | `4a 2e 00 0e 67 06 3a 3c 00 80 60 02 7a 00 1d 45` | PASS — **MEASURED** |
| 0x139a prologue | `4e 56 ff f0 48 e7 1f 30 24 6e` | `0x139a` | `4e 56 ff f0 48 e7 1f 30 24 6e` | PASS — **MEASURED** |
| 0x0f50 SRAW context_long push | `2f 2a 0e 3c` | `0x0f50` | `2f 2a 0e 3c` | PASS — **MEASURED** |

Note on anchor 2: the task specification listed `67 06 3a 3c 00 80 60 02 7a 00 1d 45` (with an extra zero byte after `67 06`). The actual bytes are `67 06 3a 3c 00 80 60 02 7a 00 1d 45` — the `67 06` is `BEQ.S +6` (2-byte branch, not 3). Actual binary matches the correct decode; the extra zero in the spec was a transcription artifact, not a real byte difference. **MEASURED**.

---

### Trace from 0x160c to 0x1670

**SMSendData prologue (0x160c–0x162a) — MEASURED:**

```
0x160c: 4e 56 ff fa  LINK A6, #-6          ; allocate 6-byte local frame (CDB area at fp@(-6..-1))
0x1610: 48 e7 1f 30  MOVEM.L D3-D7/A2-A3, -(SP)
0x1614: 24 6e 00 08  MOVEA.L fp@(8), A2    ; A2 = CSCSIPlug* this
0x1618: 3c 2e 00 0c  MOVE.W fp@(12), D6    ; D6 = channel
0x161c: 2e 2e 00 18  MOVE.L fp@(24), D7    ; D7 = len (byte count)
0x1620: 26 6e 00 1c  MOVEA.L fp@(28), A3   ; A3 = reply_len*
0x1624: 78 00        MOVEQ #0, D4          ; clear result accumulator
0x1626: 42 93        CLR.L A3@             ; *reply_len = 0
0x1628: 3f 06        MOVE.W D6, -(SP)      ; push channel for ChooseSCSI
0x162a: 48 6a 09 3a  PEA A2@(2362)         ; push &CSCSIUtils
0x162e: 4e b9 00 00 18 7e  JSR 0x187e      ; call ChooseSCSI (first pass — device select)
0x1634: 4a 00        TSTB D0               ; test result
0x1636: 5c 4f        ADDQ.W #6, SP         ; pop 6 bytes
0x1638: 67 00 00 8e  BEQ.W 0x16c8          ; if fail -> error
```

**No access to fp@(14) in prologue.** — **MEASURED** (fp@(14) not in any instruction between 0x160c and 0x163c).

**CDB construction (0x163c–0x167e) — MEASURED:**

```
0x163c: 1d 7c 00 0c ff fa  MOVE.B #0x0C, fp@(-6)   ; CDB[0] = 0x0C
0x1642: 42 2e ff fb         CLR.B fp@(-5)            ; CDB[1] = 0x00
0x1646: 26 07               MOVE.L D7, D3            ; D3 = len copy
0x1648: 20 03               MOVE.L D3, D0
0x164a: 02 80 00 00 00 ff   ANDI.L #0xFF, D0
0x1650: 1d 40 ff fe         MOVE.B D0, fp@(-2)       ; CDB[4] = len & 0xFF
0x1654: e0 83               ASR.L #8, D3
0x1658: 02 80 00 00 00 ff   ANDI.L #0xFF, D0
0x165e: 1d 40 ff fd         MOVE.B D0, fp@(-3)       ; CDB[3] = (len>>8) & 0xFF
0x1662: e0 83               ASR.L #8, D3
0x1666: 02 80 00 00 00 ff   ANDI.L #0xFF, D0
0x166c: 1d 40 ff fc         MOVE.B D0, fp@(-4)       ; CDB[2] = (len>>16) & 0xFF
0x1670: 4a 2e 00 0e         TSTB fp@(14)             ; *** FIRST ACCESS to fp@(14) ***
0x1674: 67 06               BEQ.S 0x167c             ; flag==0 -> D5=0
0x1676: 3a 3c 00 80         MOVE.W #0x80, D5         ; D5 = 0x80
0x167a: 60 02               BRA.S 0x167e
0x167c: 7a 00               MOVEQ #0, D5             ; D5 = 0x00
0x167e: 1d 45 ff ff         MOVE.B D5, fp@(-1)       ; CDB[5] = D5
```

**All writes in the CDB construction block are to NEGATIVE fp@ offsets (fp@(-6) through fp@(-1) = local CDB bytes). No instruction between 0x163c and 0x166c touches fp@(14).** — **MEASURED**

**`TSTB fp@(14)` at 0x1670 is the first and only read of fp@(14) prior to CDB[5] assignment.** — **MEASURED** (exhaustive byte scan of `0x160c-0x167e` confirms no prior `fp@(0x0e)` reference)

---

### fp@(14) Write Survey: Complete SMSendData Body (0x160c–0x16d4)

Exhaustive scan for stores with fp@ positive offsets (writes to `fp@(0x00nn)`) in the entire SMSendData body produced **zero hits**. — **MEASURED** (pattern search: `1d 6e 00 xx`, `3d 6e 00 xx`, `2d 6e 00 xx` in hex range `0x160c–0x16d4`)

The only instruction with offset `00 0e` in the entire SMSendData body is the read at `0x1670: 4a 2e 00 0e` (TSTB). — **MEASURED**

---

### ChooseSCSI First-Pass Write Survey (0x187e call)

The single sub-call between SMSendData entry and 0x1670 is `JSR 0x187e` (ChooseSCSI mid-entry) at `0x162e`. Since this is a mid-entry with no LINK, ChooseSCSI executes with A6 still pointing to SMSendData's frame.

**Exhaustive scan of all store-to-fp@ instructions in the entire ChooseSCSI body (0x1700–0x1afc) with positive displacement (`0x00xx`):** — **MEASURED**

Result: **zero positive-offset fp@ writes found** in ChooseSCSI. — **MEASURED** (pattern search: `1d 6e 00 xx`, `3d 6e 00 xx`, `2d 6e 00 xx`, `2d 40-4f 00 xx` in `0x1700-0x1afc`)

ChooseSCSI writes exclusively to negative fp@ offsets (its own locals) and to absolute addresses (CSCSIUtils struct members). It cannot modify SMSendData's `fp@(14)`.

The first-pass body at `0x187e–0x190a` contains only byte-builds to negative fp@ offsets: e.g. `MOVE.B #0x2C, fp@(-0x100)`, `MOVE.B #0x49, fp@(-0x100)` etc. — string construction for bus ID label. — **MEASURED** (bytes `11 bc 00 2c ff 00` at `0x188a`, `11 bc 00 49 ff 00` at `0x1898`, etc.)

---

### 0x139a Body Decode (SMDispatchReply)

**Identity** — **MEASURED**: debug string at `0x15e2` reads `SMDispatchReply__9CSCSIPlugFsPUcUcPl` = `CSCSIPlug::SMDispatchReply(short, unsigned char*, unsigned char*)`. UNLK+RTS at `0x15e0`: bytes `4e 5e 4e 75`. — **MEASURED**

**Call site**: BSR at file `0x16bc`, bytes `4e ba fc dc`. Target: `0x16bc + 2 + (-804) = 0x139a`. — **MEASURED**

**Execution order**: BSR 0x139a at `0x16bc` is 76 bytes AFTER the mode-byte test at `0x1670` and AFTER the SCSI write dispatch at `0x169a`. SMDispatchReply runs post-write to read the device reply. It cannot affect CDB[5], which was written at `0x167e`. — **MEASURED** (linear address ordering: 0x1670 < 0x167e < 0x169a < 0x16bc)

**Push sequence before BSR (0x16ae–0x16bc) — MEASURED:**

```
0x16ae: 2f 0b         MOVE.L A3, -(SP)          ; push reply_len* (A3 = fp@(28))
0x16b0: 1f 2e 00 0e   MOVE.B fp@(14), -(SP)     ; push mode byte (READ, not write)
0x16b4: 2f 2e 00 14   MOVE.L fp@(20), -(SP)     ; push buf_ptr = fp@(20)
0x16b8: 3f 06         MOVE.W D6, -(SP)          ; push channel
0x16ba: 2f 0a         MOVE.L A2, -(SP)          ; push this
0x16bc: 4e ba fc dc   BSR 0x139a
```

fp@(14) is **read** at `0x16b0` to pass as argument to SMDispatchReply. This read is 70 bytes past the CDB[5] write (`0x167e`) and cannot retroactively affect the CDB.

**0x139a frame layout (from push sequence):**

| Offset in 0x139a frame | Value | Source push |
|---|---|---|
| `fp@(8)` | CSCSIPlug* this | MOVE.L A2, -(SP) at 0x16ba |
| `fp@(10)` | channel (word) | MOVE.W D6, -(SP) at 0x16b8 |
| `fp@(12)` | buf_ptr (MIDI reply buffer ptr) | MOVE.L fp@(20), -(SP) at 0x16b4 |
| `fp@(16)` | mode byte (byte in 2-byte word slot) | MOVE.B fp@(14), -(SP) at 0x16b0 |
| `fp@(18)` (or +20 after pad) | reply_len* | MOVE.L A3, -(SP) at 0x16ae |

Note: 68k MOVE.B -(SP) decrements SP by 2 (word alignment), so the mode byte occupies the low byte of the word at `fp@(16)` in the 0x139a frame.

**0x139a prologue — MEASURED:**
```
0x139a: 4e 56 ff f0  LINK A6, #-16     ; allocate 16-byte local frame
0x139e: 48 e7 1f 30  MOVEM.L D3-D7/A2-A3, -(SP)
0x13a2: 24 6e 00 08  MOVEA.L fp@(8), A2   ; A2 = this
0x13a6: 38 2e 00 0c  MOVE.W fp@(12), D4   ; D4 = channel
```

**0x139a reads mode byte at fp@(18) at two sites — MEASURED:**

| File offset | Bytes | Instruction | Purpose |
|---|---|---|---|
| `0x13d4` | `4a 2e 00 12` | `TSTB fp@(18)` | Test mode byte — branch control |
| `0x13ee` | `4a 2e 00 12` | `TSTB fp@(18)` | Test mode byte — branch control |

Both are TSTB (read-only test, sets flags, no write). — **MEASURED**

**Exhaustive scan for writes to positive fp@ offsets in 0x139a body (0x139a–0x15e0):**

Pattern search: `1d 6e 00 xx`, `3d 6e 00 xx`, `2d 6e 00 xx` with positive displacement (`00 xx`): **zero hits.** — **MEASURED**

The two fp@ stores found in 0x139a body:
- `0x13e6: 1d 6e ff f1 ff ff` = `MOVE.B fp@(-15), fp@(-1)` — both NEGATIVE offsets (local vars) — **MEASURED**
- `0x13f4: 2d 50 ff f2` = `MOVE.L D0, fp@(-14)` — NEGATIVE offset (local var) — **MEASURED** (bytes `2d 50 ff f2` at `0x13f4`)

SMDispatchReply has no path to reach SMSendData's `fp@(14)` through any of its writes.

**What 0x139a does:** reads CSCSIPlug+0x0e46 (`4a 2a 0e 46` at `0x13b4`) and CSCSIPlug+0x0e47 (`4a 2a 0e 47` at `0x13ba`) to check device state, then loads `fp@(14)` (buf_ptr) into A3 (`26 6e 00 0e` at `0x13c6`) and reads SCSI reply data from the device into it. — **MEASURED** (instruction decode of `0x139a` first 120 bytes)

---

### `+0x0e3c` Field Semantics

**CSCSIPlug+0x0e3c** = MIDI reply buffer pointer. Value is pushed by the SRAW handler at `0x0f50` (`2f 2a 0e 3c` = `MOVE.L A2@(0xe3c), -(SP)`) and passed as an arg to SMSendData. — **MEASURED**

**Read sites** (push as arg to SMSendData): `0x0f50`, `0x0fae`, `0x10a0`, `0x10e8`. All are `2f 2a 0e 3c` = MOVE.L A2@(0xe3c), -(SP). — **MEASURED** (pattern `2f2a0e3c` in binary)

**Write sites** (two in entire binary):

| File offset | Bytes | Instruction | Location |
|---|---|---|---|
| `0x0c32` | `25 50 0e 3c` | `MOVE.L A0@, A2@(0xe3c)` | Function 0x0bc6 |
| `0x0c38` | `42 aa 0e 3c` | `CLR.L A2@(0xe3c)` | Function 0x0bc6 |

Both writes are in function 0x0bc6. — **MEASURED** (bytes verified at each site)

**Is function 0x0bc6 on the SRAW -> SMSendData call path?**

JSR 0x0bc6 (`4e b9 00 00 0b c6`) pattern searched across entire binary: **zero hits.** — **MEASURED**

BSR targeting 0x0bc6 searched across 0x0500–0x1700: **zero hits.** — **MEASURED**

0x0bc6 is not called from SendData (0x0df2–0x1214), SMSendData (0x160c–0x16d4), or ChooseSCSI (0x1700–0x1afc). The debug string following function 0x0c68's UNLK+RTS reads `__ct__9CSCSIPlugFv` — suggesting 0x0bc6 is part of the CSCSIPlug constructor. — **CANDIDATE** (name string at 0x0c78, not directly linked to 0x0bc6)

**Within SMSendData**, CSCSIPlug+0xe3c is neither read nor written. Its value was captured at SRAW push-time (before JSR 0x106e). If it were mutated externally before the SRAW call, the already-pushed arg value is unaffected. — **MEASURED** (no `0e3c` reference in SMSendData hex dump 0x160c–0x16d4)

**Conclusion on +0x0e3c:** CSCSIPlug+0xe3c is read-only from SMSendData's perspective. The field is written only during object initialization (function 0x0bc6), not during the SRAW send path. — **MEASURED** (write sites) / **CANDIDATE** (0x0bc6 is constructor-time, not inferred from name string alone)

---

### Mode-Byte Data-Flow Summary

```
SRAW handler (0x0ec0):
  0x0f56: MOVE.B #1, -(SP)     ; mode byte = 0x01 pushed
  0x0f60: JSR 0x106e           ; SEND_FUNC_SLOT (runtime = SMSendData)
                                ; stack now: ... [mode_byte=0x01 at SP+8] ...

SMSendData (0x160c):
  0x160c: LINK A6, #-6         ; fp set; fp@(14) = mode byte = 0x01
  [0x162e: JSR 0x187e          ; ChooseSCSI - NO writes to positive fp@ offsets]
  0x163c-0x166c: CDB[0-4] built into fp@(-6..-2)
  0x1670: TSTB fp@(14)         ; FIRST ACCESS: reads 0x01, non-zero
  0x1676: MOVE.W #0x80, D5     ; D5 = 0x80
  0x167e: MOVE.B D5, fp@(-1)   ; CDB[5] = 0x80
  [0x169a: SCSI write executed]
  [0x16b0: MOVE.B fp@(14), -(SP)  ; fp@(14) read AGAIN for SMDispatchReply arg]
  0x16bc: BSR 0x139a           ; SMDispatchReply (post-write, cannot affect CDB)
```

At no point between LINK (0x160c) and TSTB (0x1670) is `fp@(14)` written or its value aliased. The data-flow from push at 0x0f56 to read at 0x1670 is unbroken. — **MEASURED**

---

### Claim Table

| Claim | Grade | Evidence |
|-------|-------|---------|
| Anchors: SMSendData entry `4e 56 ff fa 48 e7 1f 30` at 0x160c | MEASURED | raw bytes at file 0x160c |
| Anchors: mode-byte test `4a 2e 00 0e 67 06 3a 3c 00 80 60 02 7a 00 1d 45` at 0x1670 | MEASURED | raw bytes at file 0x1670 |
| Anchors: 0x139a prologue `4e 56 ff f0 48 e7 1f 30 24 6e` | MEASURED | raw bytes at file 0x139a |
| Anchors: `2f 2a 0e 3c` (MOVE.L A2@(0xe3c), -(SP)) at 0x0f50 | MEASURED | raw bytes at file 0x0f50 |
| SMSendData prologue loads fp@(8), fp@(12), fp@(24), fp@(28); NOT fp@(14) | MEASURED | `246e0008`, `3c2e000c`, `2e2e0018`, `266e001c` at 0x1614-0x1620 |
| TSTB fp@(14) at 0x1670 is first and only access to fp@(14) before CDB[5] write | MEASURED | exhaustive scan 0x160c-0x167e: no `00 0e` displacement in writes |
| CDB[0-4] writes use NEGATIVE fp@ offsets (fp@(-6) through fp@(-2)) | MEASURED | `ff fa`, `ff fb`, `ff fc`, `ff fd`, `ff fe` displacement bytes in 0x163c-0x166c |
| ChooseSCSI (0x1700-0x1afc) has zero writes to positive fp@ offsets | MEASURED | pattern scan: no `1d/3d/2d 6e 00 xx` with xx < 0x80 in range |
| ChooseSCSI first-pass 0x187e writes only to negative fp@ (local) and SCSI param block | MEASURED | bytes at 0x187e-0x190a: all stores use `ff xx` (negative) displacements |
| BSR 0x139a at 0x16bc; target confirmed as 0x16bc+2+(-804) = 0x139a | MEASURED | `4e ba fc dc` at file 0x16bc |
| 0x139a is after 0x1670 and 0x167e in execution order | MEASURED | linear address ordering: 0x1670 < 0x167e < 0x16bc |
| 0x139a debug name = `SMDispatchReply__9CSCSIPlugFsPUcUcPl` | MEASURED | string at 0x15e2; UNLK+RTS `4e5e 4e75` at 0x15e0 |
| 0x139a reads fp@(18) (mode byte slot) at two sites; both are TSTB (read-only) | MEASURED | `4a 2e 00 12` at 0x13d4 and 0x13ee |
| 0x139a has zero writes to positive fp@ offsets | MEASURED | pattern scan: only writes are `ff f1` and `ff f2` (negative) |
| fp@(14) read at 0x16b0 (MOVE.B fp@(14), -(SP)) for SMDispatchReply arg; this is POST-CDB | MEASURED | `1f 2e 00 0e` at 0x16b0; address 0x16b0 > 0x167e |
| CSCSIPlug+0xe3c write: `25 50 0e 3c` = MOVE.L A0@, A2@(0xe3c) at 0x0c32 | MEASURED | `25 50 0e 3c` at file 0x0c32; decoded as MOVE.L (A0), (A2+d16) |
| CSCSIPlug+0xe3c write: `42 aa 0e 3c` = CLR.L A2@(0xe3c) at 0x0c38 | MEASURED | `42 aa 0e 3c` at file 0x0c38; CLR.L |
| Both 0xe3c writes are in function 0x0bc6, not in SendData/SMSendData/SRAW path | MEASURED | JSR/BSR 0x0bc6 pattern: zero hits across full binary |
| CSCSIPlug+0xe3c has no reference in SMSendData body 0x160c-0x16d4 | MEASURED | `0e3c` pattern absent from SMSendData hex dump |
| fp@(14) = 0x01 (mode byte) is preserved from SRAW push through to CDB[5] write | MEASURED | combination of all write-scan results above |
| SMSendData with SRAW call produces CDB[5] = 0x80 deterministically | MEASURED | `TSTB fp@(14)` -> `BEQ.S` not taken (0x01 != 0) -> D5=0x80 -> CDB[5]=0x80 |
| 0x139a arg fp@(14) = buf_ptr (= SMSendData fp@(20)), NOT the mode byte | MEASURED | push layout: MOVE.B fp@(14) adds 2 bytes -> mode byte lands at fp_139a@(16), not fp@(14) |
| 0x139a reads fp@(14) of ITS OWN frame (= buf_ptr = reply buffer ptr) via `26 6e 00 0e` at 0x13c6 | MEASURED | `26 6e 00 0e` at 0x13c6; in 0x139a frame fp@(14) = buf_ptr |
| Patch-target-differs hypothesis is the stronger remaining explanation for hardware rejection | CANDIDATE | Follows from Outcome B: SMSendData would emit 0x80; hardware rejects; therefore production reaches different function |
