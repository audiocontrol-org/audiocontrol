## Path A.12: Mode-Byte Semantics Across All JSR 0x106e Call Sites in CSCSIPlug::SendData

**Binary:** `scsi-plug-rsrc.bin` (12053 bytes, MESA SCSI Plug 2.1.2)
**SendData span:** file 0x0df2-0x121c (MEASURED)
**Date:** 2026-04-20
**Prior docs:** `sraw-decoded.md`, `path-a9-sraw-outbound.md`, `path-a11-patcher-identity.md`

All claims tagged per-claim: **MEASURED** (file offset + bytes cited) / **CANDIDATE** (reasoned, not byte-verified) / **OPEN** (decode boundary not crossed)

---

### Step 0: Anchor Verification

All anchors verified from raw binary before analysis began.

| Anchor | Expected bytes | File offset | Result |
|--------|---------------|-------------|--------|
| SendData LINK | `4e 56 ff d0` | `0x0df2` | PASS — **MEASURED** |
| SendData UNLK+RTS | `4e 5e 4e 75` | `0x121a` | PASS — **MEASURED** |
| JSR 0x106e at SRAW site | `4e b9 00 00 10 6e` | `0x0f60` | PASS — **MEASURED** |
| 0x106e stub body (BRA.W +0xf0) | `60 00 00 f0` | `0x106e` | PASS — **MEASURED** |
| Tag dispatch JSR 0x148 | `4e b9 00 00 01 48` | `0x0e52` | PASS — **MEASURED** |

All five anchors pass. **MEASURED.** Analysis proceeds.

---

### Bottom Line

**6 JSR 0x106e call sites.** **2 distinct mode-byte values: 0x01 and 0x00.** The mode byte maps to `flag` in SMSendData CDB[5]: `0x01 = 0x80 in CDB` (reply expected); `0x00 = 0x00 in CDB` (fire-and-forget).

**Mode-byte to tag mapping:**

| Mode byte | Sites | Handler tag | Semantic |
|-----------|-------|-------------|----------|
| `0x01` (flag=1) | 0x0f60, 0x10b2 | SRAW | Reply expected — SCSI device must respond |
| `0x00` (flag=0) | 0x0fbc, 0x102c, 0x10f8, 0x1144 | SRAW/SysEx, SRAW/SYSX, SYSX, MIDI | Fire-and-forget — no SCSI reply expected |

**Source-pointer family:**
- `D6` (length register): sites 0x0f60, 0x0fbc, 0x102c
- `fp@(-46)` (local var = A3@(4) = IP_Data payload ptr): site 0x10b2
- `A3@(4)` (IP_Data payload pointer directly): sites 0x10f8, 0x1144

**Context-long (5th arg = "MIDI reply buffer ptr"):**
- `A2@(0xe3c)` (CSCSIPlug+0xe3c = MIDI reply buffer ptr): sites 0x0f60, 0x0fbc, 0x10b2, 0x10f8
- `0` (CLR.L push): sites 0x102c, 0x1144

---

### Tag Dispatch Table (MEASURED)

Tag dispatch at `JSR 0x148` (file 0x0e52). Table entries at file 0x0e5e, format: 4-byte tag + 2-byte unsigned offset where `target = offset_word_addr + offset_value`.

| Entry offset | Tag | Offset addr | Offset value | Handler target |
|-------------|-----|-------------|--------------|----------------|
| `0x0e5e` | `SYSX` | `0x0e62` | `0x0004` | `0x0e66`* |
| `0x0e64` | `BOFF` | `0x0e68` | `0x001a` | `0x0e82` — **MEASURED** (`42 27 42 27` = `CLR.B -(SP); CLR.B -(SP)`) |
| `0x0e6a` | `BULK` | `0x0e6e` | `0x0030` | `0x0e9e` — **MEASURED** (`4a 2a 0e 40` = `TST.B A2@(3648)`) |
| `0x0e70` | `MIDI` | `0x0e74` | `0x02a2` | `0x1116` — **MEASURED** (`42 27 1f 3c 00 01` = `CLR.B -(SP); MOVE.B #1, -(SP)`) |
| `0x0e76` | `SRAW` | `0x0e7a` | `0x0046` | `0x0ec0` — **MEASURED** (`4a 2a 0e 40` = `TST.B A2@(3648)`) |
| `0x0e7c` | `SYSX` | `0x0e80` | `0x0246` | `0x10c6` — **MEASURED** (`42 27 1f 3c 00 01` = `CLR.B -(SP); MOVE.B #1, -(SP)`) |

*SYSX at 0x0e5e with target 0x0e66 falls into the table itself; this appears to be a duplicate or alias entry — the effective SYSX handler is at 0x10c6. **OPEN** — the role of the 0x0e5e SYSX entry is not fully decoded.

BOFF handler at 0x0e82 contains `JSR 0x0ca2` but **NO JSR 0x106e**. BOFF does not use the SEND_FUNC_SLOT. **MEASURED** from bytes at 0x0e82-0x0e9d.

BULK handler at 0x0e9e: `TST.B A2@(3648)` then `BNE.S 0x0ec0`. When SCSI mode is active, BULK jumps into the SRAW handler at 0x0ec0. When mode is inactive, falls through to a separate path. **MEASURED** — bytes `4a 2a 0e 40 66 1c` at 0x0e9e-0x0ea3.

---

### Per-Call-Site Catalog

#### Site 1: file 0x0f60 — SRAW, flag=1

**JSR bytes:** `4e b9 00 00 10 6e` **MEASURED** at 0x0f60.

**Handler tag:** `SRAW` (dispatch entry at 0x0e76 → handler at 0x0ec0).

**Entry condition:** SRAW handler body — SCSI_mode_active nonzero (`TST.B A2@(3648)` at 0x0ec0 passes), D6 = IP_Data[+4] != 0, **and** `CMPI.L #'SRAW', A3@(8)` at 0x0f40 passes (tag equals 'SRAW'). **MEASURED** — bytes `0c ab 53 52 41 57 00 08 66 26` at 0x0f40-0x0f49.

**Push sequence (MEASURED from bytes 0x0f4a-0x0f5e):**

| Stack position | Instruction | File offset | Bytes | Value |
|---------------|-------------|-------------|-------|-------|
| &reply_ptr_var | `PEA fp@(-30)` | 0x0f4a | `48 6e ff e2` | local reply ptr var |
| source | `MOVE.L (A3), -(SP)` | 0x0f4e | `2f 13` | A3@ = IP_Data[+0] = audio_buf_ptr |
| context-long | `MOVE.L A2@(0xe3c), -(SP)` | 0x0f50 | `2f 2a 0e 3c` | CSCSIPlug+0xe3c (MIDI reply buf ptr) |
| D6 | `MOVE.L D6, -(SP)` | 0x0f54 | `2f 06` | D6 = IP_Data[+4] = byte_count |
| **mode byte** | `MOVE.B #0x01, -(SP)` | **0x0f56** | **`1f 3c 00 01`** | **flag = 1** |
| channel | `MOVE.W A2@(0xd6e), -(SP)` | 0x0f5a | `3f 2a 0d 6e` | channel |
| this | `MOVE.L A2, -(SP)` | 0x0f5e | `2f 0a` | CSCSIPlug* this |

**Source-pointer family:** D6 **MEASURED.**
**Context-long:** A2@(0xe3c) = CSCSIPlug+0xe3c **MEASURED.**
**Mode byte:** `0x01` — push instruction bytes `1f 3c 00 01` at file 0x0f56 **MEASURED.**

---

#### Site 2: file 0x0fbc — SRAW/SysEx sub-path, flag=0

**JSR bytes:** `4e b9 00 00 10 6e` **MEASURED** at 0x0fbc.

**Handler tag:** `SRAW` handler body, SysEx sub-path. Reached when IP_Data tag != 'SRAW' (BNE.S 0x0f70 at 0x0f48 is taken), SysEx start byte is 0xF0, byte[3] == 0x0b (SUBI.W #0x0b, D0 → BEQ.S 0x0fa8 at 0x0f9e). **MEASURED** — bytes `66 26` at 0x0f48, `0c 10 00 f0` at 0x0f72, `04 40 00 0b` at 0x0f9a, `67 08` at 0x0f9e.

**Push sequence (MEASURED from bytes 0x0fa8-0x0fbb):**

| Stack position | Instruction | File offset | Bytes | Value |
|---------------|-------------|-------------|-------|-------|
| &reply_ptr_var | `PEA fp@(-30)` | 0x0fa8 | `48 6e ff e2` | local reply ptr var |
| source | `MOVE.L (A3), -(SP)` | 0x0fac | `2f 13` | A3@ = IP_Data[+0] |
| context-long | `MOVE.L A2@(0xe3c), -(SP)` | 0x0fae | `2f 2a 0e 3c` | CSCSIPlug+0xe3c |
| D6 | `MOVE.L D6, -(SP)` | 0x0fb2 | `2f 06` | D6 = byte_count/ptr |
| **mode byte** | `CLR.B -(SP)` | **0x0fb4** | **`42 27`** | **flag = 0** |
| channel | `MOVE.W A2@(0xd6e), -(SP)` | 0x0fb6 | `3f 2a 0d 6e` | channel |
| this | `MOVE.L A2, -(SP)` | 0x0fba | `2f 0a` | CSCSIPlug* this |

**Source-pointer family:** D6 **MEASURED.**
**Context-long:** A2@(0xe3c) = CSCSIPlug+0xe3c **MEASURED.**
**Mode byte:** `0x00` — push instruction bytes `42 27` at file 0x0fb4 **MEASURED.**

---

#### Site 3: file 0x102c — SRAW/SysEx sub-path (longer form), flag=0

**JSR bytes:** `4e b9 00 00 10 6e` **MEASURED** at 0x102c.

**Handler tag:** `SRAW` handler body, SysEx sub-path. Reached when IP_Data tag != 'SRAW', SysEx start byte is 0xF0, byte[3] != 0x0b (falls through from 0x0fa0 `SUBQ.W #1, D0`), then byte[3] == 0x0c (BEQ.S 0x0fcc at 0x0fa2 taken). The 0x0fcc region performs multi-byte offset arithmetic building a local value at fp@(-38). **MEASURED** — bytes `53 40` at 0x0fa0, `67 28` at 0x0fa2.

**Push sequence (MEASURED from bytes 0x101a-0x102b):**

| Stack position | Instruction | File offset | Bytes | Value |
|---------------|-------------|-------------|-------|-------|
| &reply_ptr_var | `PEA fp@(-30)` | 0x101a | `48 6e ff e2` | local reply ptr var |
| source | `MOVE.L (A3), -(SP)` | 0x101e | `2f 13` | A3@ = IP_Data[+0] |
| context-long | `CLR.L -(SP)` | 0x1020 | `42 a7` | **0 (null context)** |
| D6 | `MOVE.L D6, -(SP)` | 0x1022 | `2f 06` | D6 = byte_count/ptr |
| **mode byte** | `CLR.B -(SP)` | **0x1024** | **`42 27`** | **flag = 0** |
| channel | `MOVE.W A2@(0xd6e), -(SP)` | 0x1026 | `3f 2a 0d 6e` | channel |
| this | `MOVE.L A2, -(SP)` | 0x102a | `2f 0a` | CSCSIPlug* this |

**Source-pointer family:** D6 **MEASURED.**
**Context-long:** `0` (CLR.L push) **MEASURED.**
**Mode byte:** `0x00` — push instruction bytes `42 27` at file 0x1024 **MEASURED.**

---

#### Site 4: file 0x10b2 — SRAW/mode_off sub-path, flag=1

**JSR bytes:** `4e b9 00 00 10 6e` **MEASURED** at 0x10b2.

**Handler tag:** `SRAW` handler, SCSI_mode_active==0 branch. Reached via `BEQ.W 0x1072` at 0x0ec4 when `TST.B A2@(3648)` finds mode flag is zero. At 0x1072, A3@(4) = IP_Data payload pointer is saved to fp@(-46). BTST #7 at 0x1082 checks bit 7 of `*fp@(-46)`. Path proceeds to push sequence at 0x109a regardless of that bit. **MEASURED** — bytes `67 00 01 ac` at 0x0ec4, bytes `2d 6b 00 04 ff d2` at 0x1072, bytes `08 10 00 07` at 0x1082.

**Push sequence (MEASURED from bytes 0x109a-0x10b1):**

| Stack position | Instruction | File offset | Bytes | Value |
|---------------|-------------|-------------|-------|-------|
| &reply_ptr_var | `PEA fp@(-30)` | 0x109a | `48 6e ff e2` | local reply ptr var |
| source | `MOVE.L (A3), -(SP)` | 0x109e | `2f 13` | A3@ = IP_Data[+0] |
| context-long | `MOVE.L A2@(0xe3c), -(SP)` | 0x10a0 | `2f 2a 0e 3c` | CSCSIPlug+0xe3c |
| local var | `MOVE.L fp@(-46), -(SP)` | 0x10a4 | `2f 2e ff d2` | fp@(-46) = saved A3@(4) |
| **mode byte** | `MOVE.B #0x01, -(SP)` | **0x10a8** | **`1f 3c 00 01`** | **flag = 1** |
| channel | `MOVE.W A2@(0xd6e), -(SP)` | 0x10ac | `3f 2a 0d 6e` | channel |
| this | `MOVE.L A2, -(SP)` | 0x10b0 | `2f 0a` | CSCSIPlug* this |

**Source-pointer family:** `fp@(-46)` = saved copy of A3@(4) — **MEASURED.**
**Context-long:** A2@(0xe3c) = CSCSIPlug+0xe3c **MEASURED.**
**Mode byte:** `0x01` — push instruction bytes `1f 3c 00 01` at file 0x10a8 **MEASURED.**

---

#### Site 5: file 0x10f8 — SYSX handler, flag=0

**JSR bytes:** `4e b9 00 00 10 6e` **MEASURED** at 0x10f8.

**Handler tag:** `SYSX` (dispatch entry at 0x0e7c → handler at 0x10c6). Handler first calls `JSR 0x0ca2` as a preparatory check with CLR.B + MOVE.B #1 + channel + this as args. If that call returns nonzero (D0 != 0, `TST.B D0` at 0x10d8 then `BEQ.W 0x1160`), the JSR 0x106e push sequence follows. The `BEQ.W 0x1160` means: if D0 == 0, SKIP the send. **MEASURED** — bytes `4e b9 00 00 0c a2` at 0x10d2, `67 00 00 80` at 0x10de (BEQ.W 0x1160).

**Push sequence (MEASURED from bytes 0x10e2-0x10f7):**

| Stack position | Instruction | File offset | Bytes | Value |
|---------------|-------------|-------------|-------|-------|
| &reply_ptr_var | `PEA fp@(-30)` | 0x10e2 | `48 6e ff e2` | local reply ptr var |
| source | `MOVE.L (A3), -(SP)` | 0x10e6 | `2f 13` | A3@ = IP_Data[+0] |
| context-long | `MOVE.L A2@(0xe3c), -(SP)` | 0x10e8 | `2f 2a 0e 3c` | CSCSIPlug+0xe3c |
| A3 field | `MOVE.L A3@(4), -(SP)` | 0x10ec | `2f 2b 00 04` | A3@(4) = IP_Data[+4] = payload ptr |
| **mode byte** | `CLR.B -(SP)` | **0x10f0** | **`42 27`** | **flag = 0** |
| channel | `MOVE.W A2@(0xd6e), -(SP)` | 0x10f2 | `3f 2a 0d 6e` | channel |
| this | `MOVE.L A2, -(SP)` | 0x10f6 | `2f 0a` | CSCSIPlug* this |

**Source-pointer family:** A3@(4) = IP_Data[+4] **MEASURED.**
**Context-long:** A2@(0xe3c) = CSCSIPlug+0xe3c **MEASURED.**
**Mode byte:** `0x00` — push instruction bytes `42 27` at file 0x10f0 **MEASURED.**

---

#### Site 6: file 0x1144 — MIDI handler, flag=0

**JSR bytes:** `4e b9 00 00 10 6e` **MEASURED** at 0x1144.

**Handler tag:** `MIDI` (dispatch entry at 0x0e70 → handler at 0x1116). Same preparatory JSR 0x0ca2 pattern as SYSX: CLR.B + MOVE.B #1 + channel + this, then `BEQ.S 0x1160` if returns zero. **MEASURED** — bytes `4e b9 00 00 0c a2` at 0x1122, `67 30` at 0x112e (BEQ.S 0x1160).

**Push sequence (MEASURED from bytes 0x1130-0x1143):**

| Stack position | Instruction | File offset | Bytes | Value |
|---------------|-------------|-------------|-------|-------|
| &reply_ptr_var | `PEA fp@(-30)` | 0x1130 | `48 6e ff e2` | local reply ptr var |
| source | `MOVE.L (A3), -(SP)` | 0x1134 | `2f 13` | A3@ = IP_Data[+0] |
| context-long | `CLR.L -(SP)` | 0x1136 | `42 a7` | **0 (null context)** |
| A3 field | `MOVE.L A3@(4), -(SP)` | 0x1138 | `2f 2b 00 04` | A3@(4) = IP_Data[+4] = payload ptr |
| **mode byte** | `CLR.B -(SP)` | **0x113c** | **`42 27`** | **flag = 0** |
| channel | `MOVE.W A2@(0xd6e), -(SP)` | 0x113e | `3f 2a 0d 6e` | channel |
| this | `MOVE.L A2, -(SP)` | 0x1142 | `2f 0a` | CSCSIPlug* this |

**Source-pointer family:** A3@(4) = IP_Data[+4] **MEASURED.**
**Context-long:** `0` (CLR.L push) **MEASURED.**
**Mode byte:** `0x00` — push instruction bytes `42 27` at file 0x113c **MEASURED.**

---

### Mode-Byte to Semantic Mapping

#### `0x01` (flag=1) — Reply Expected

Sites: 0x0f60 (SRAW/SRAW-tag path) and 0x10b2 (SRAW/mode_off path).

In `SMSendData` (CANDIDATE runtime install target for 0x106e), flag=1 causes CDB[5] = 0x80 via:
```
0x1670: tstb  fp@(14)     ; test flag arg
0x1674: beqs  0x167c      ; flag==0 -> D5=0
0x1676: movew #0x80, D5   ; D5 = 0x80
0x167a: bras  0x167e
0x167e: moveb D5, fp@(-1) ; CDB[5] = D5
```
**MEASURED** bytes at 0x1670-0x167e.

CDB[5] = 0x80 = "reply expected" — the SCSI device should send back a response. This matches the documented MESA CDB 0x0C flag byte semantics (bridge code: `$80=reply expected`).

**Semantic: send audio data and expect device acknowledgment.** Both flag=1 sites involve actual audio (PCM) buffer data from the SRAW IP_Data path.

#### `0x00` (flag=0) — Fire-and-Forget

Sites: 0x0fbc (SRAW/SysEx-0x0b), 0x102c (SRAW/SysEx-0x0c), 0x10f8 (SYSX), 0x1144 (MIDI).

flag=0 → CDB[5] = 0x00 = "no reply expected." Device receives the data and does not send back a SCSI reply.

**Semantic: send SysEx or MIDI command data without expecting device acknowledgment.** All four flag=0 sites involve non-audio payloads (SysEx commands or raw MIDI data).

#### Pattern Summary

The mode byte is a simple binary flag: **1 = audio upload with reply gate; 0 = command/SysEx send without reply gate.** There are no intermediate values, no bit field semantics, and no mode codes for other operations. The only distinction is whether the remote device should reply.

| Mode byte | CDB[5] | Payload type | Sites |
|-----------|--------|--------------|-------|
| `0x01` | `0x80` | Audio PCM (SRAW) | 0x0f60, 0x10b2 |
| `0x00` | `0x00` | SysEx/MIDI command | 0x0fbc, 0x102c, 0x10f8, 0x1144 |

**CANDIDATE** — the CDB[5] encoding formula is MEASURED in SMSendData; its interpretation as `reply_expected` is confirmed from MESA bridge documentation. The claim that flag=0 means "no reply" follows from the formula; no device-behavior verification was done in this decode round.

---

### Source-Pointer and Context-Long Variation

The three differentiating dimensions (per Codex parity #315) are:

**1. Mode byte:** 0x01 vs 0x00 — fully decoded above. **MEASURED.**

**2. Source-pointer family:**

| Family | Sites | What it is |
|--------|-------|------------|
| `D6` | 0x0f60, 0x0fbc, 0x102c | D6 = IP_Data[+4] (per A.9 calibration: payload pointer; the length/ptr field) |
| `fp@(-46)` | 0x10b2 | fp@(-46) is a local copy of A3@(4) = IP_Data[+4], set at 0x1072 via `MOVE.L A3@(4), fp@(-46)` |
| `A3@(4)` | 0x10f8, 0x1144 | IP_Data[+4] directly pushed from A3 |

Note: D6 and A3@(4) are the same semantic value (IP_Data[+4] = payload pointer) accessed through different registers. The SRAW handler loaded D6 from A3@(4) at 0x0ecc; the SYSX/MIDI handlers push A3@(4) directly without loading into D6 first. fp@(-46) is a copy of A3@(4) made at 0x1072. **MEASURED.**

**3. Context-long (5th push = MIDI reply buffer ptr):**

| Value | Sites | Condition |
|-------|-------|-----------|
| `A2@(0xe3c)` (CSCSIPlug+0xe3c) | 0x0f60, 0x0fbc, 0x10b2, 0x10f8 | Audio path (SRAW) and SYSX |
| `0` (CLR.L) | 0x102c, 0x1144 | SysEx-0x0c sub-path and MIDI |

**Interpretation (CANDIDATE):** The MIDI reply buffer at CSCSIPlug+0xe3c is the buffer where SMSendData reads back a device response after a `reply_expected` send. Passing 0 here for fire-and-forget sends that don't expect a reply is consistent — SMSendData would not read any reply when CDB[5]=0, so the reply buffer pointer is unused and passing 0 is safe. For SYSX (site 0x10f8), A2@(0xe3c) is passed even though flag=0; this may be a conservative pass-through (buffer exists but won't be written) or a copy of the SRAW pattern without optimization. **OPEN** — whether SMSendData actually reads the context-long when flag=0 is not decoded in this round.

---

### Handler Context Quick Reference

| JSR site | Handler entry | Tag | Entry condition | Mode byte |
|----------|--------------|-----|-----------------|-----------|
| 0x0f60 | 0x0ec0 | `SRAW` | mode_active!=0, byte_count!=0, A3@(8)=='SRAW' | **0x01** |
| 0x0fbc | 0x0ec0 | `SRAW` (SysEx sub) | mode_active!=0, tag!='SRAW', byte[0]==0xF0, byte[3]==0x0b | 0x00 |
| 0x102c | 0x0ec0 | `SRAW` (SysEx sub) | mode_active!=0, tag!='SRAW', byte[0]==0xF0, byte[3]==0x0c | 0x00 |
| 0x10b2 | 0x1072 | `SRAW` (mode_off) | mode_active==0 (BEQ from 0x0ec4) | **0x01** |
| 0x10f8 | 0x10c6 | `SYSX` | SYSX tag dispatch, JSR 0x0ca2 returned nonzero | 0x00 |
| 0x1144 | 0x1116 | `MIDI` | MIDI tag dispatch, JSR 0x0ca2 returned nonzero | 0x00 |

---

### Observations on BOFF and BULK

**BOFF handler (0x0e82):** Contains no JSR 0x106e. Instead calls `JSR 0x0ca2` directly, then performs cleanup. **MEASURED** — bytes `4e b9 00 00 0c a2` at 0x0e8c; no `4e b9 00 00 10 6e` pattern in 0x0e82-0x0e9d.

**BULK handler (0x0e9e):** `TST.B A2@(3648)` then `BNE.S 0x0ec0`. When SCSI mode is active, BULK falls into the SRAW handler at 0x0ec0 and uses its JSR 0x106e sites (0x0f60, 0x0fbc, 0x102c). BULK does not have its own JSR 0x106e call site — it borrows SRAW's. **MEASURED** — bytes `4a 2a 0e 40 66 1c` at 0x0e9e-0x0ea3; BNE.S +0x1c = 0x0ec0.

**Implication:** When the S3000XL editor sends a BULK data structure (parameter block, etc.), the SCSI path is the same as SRAW when SCSI mode is active. The distinction between BULK and SRAW at the SCSI level is entirely determined by SCSI_mode_active flag and the IP_Data tag — there is no separate BULK JSR 0x106e call site.

---

### Claim Table

| Claim | Grade | Evidence (file offset + bytes) |
|-------|-------|-------------------------------|
| 6 JSR 0x106e sites in SendData range 0x0df2-0x121c | MEASURED | Pattern search `4e b9 00 00 10 6e`: hits at 0x0f60, 0x0fbc, 0x102c, 0x10b2, 0x10f8, 0x1144 |
| Table entries start at 0x0e5e, format tag(4)+offset_from_offset_word(2) | MEASURED | SRAW entry: `53 52 41 57 00 46` at 0x0e76-0x0e7b; target = 0x0e7a + 0x0046 = 0x0ec0 verified |
| BOFF handler at 0x0e82 | MEASURED | `42 27 42 27` at 0x0e82; disp from 0x0e68 = 0x001a; target = 0x0e82 |
| BULK handler at 0x0e9e | MEASURED | `4a 2a 0e 40` at 0x0e9e; disp from 0x0e6e = 0x0030; target = 0x0e9e |
| MIDI handler at 0x1116 | MEASURED | `42 27 1f 3c 00 01` at 0x1116; disp from 0x0e74 = 0x02a2; target = 0x1116 |
| SRAW handler at 0x0ec0 | MEASURED | `4a 2a 0e 40` at 0x0ec0; disp from 0x0e7a = 0x0046; target = 0x0ec0 |
| SYSX handler at 0x10c6 | MEASURED | `42 27 1f 3c 00 01` at 0x10c6; disp from 0x0e80 = 0x0246; target = 0x10c6 |
| BOFF has NO JSR 0x106e | MEASURED | Full scan 0x0e82-0x0e9d: no `4e b9 00 00 10 6e` |
| BULK BNE to 0x0ec0 when mode_active | MEASURED | `66 1c` at 0x0ea2; target = 0x0ea4 + 0x1c = 0x0ec0 |
| Site 0x0f60: mode byte = 0x01 | MEASURED | `1f 3c 00 01` (MOVE.B #1, -(SP)) at 0x0f56 |
| Site 0x0fbc: mode byte = 0x00 | MEASURED | `42 27` (CLR.B -(SP)) at 0x0fb4 |
| Site 0x102c: mode byte = 0x00 | MEASURED | `42 27` (CLR.B -(SP)) at 0x1024 |
| Site 0x10b2: mode byte = 0x01 | MEASURED | `1f 3c 00 01` (MOVE.B #1, -(SP)) at 0x10a8 |
| Site 0x10f8: mode byte = 0x00 | MEASURED | `42 27` (CLR.B -(SP)) at 0x10f0 |
| Site 0x1144: mode byte = 0x00 | MEASURED | `42 27` (CLR.B -(SP)) at 0x113c |
| Sites 0x102c and 0x1144 push context-long = 0 | MEASURED | `42 a7` (CLR.L -(SP)) at 0x1020 and 0x1136 |
| Sites 0x0f60, 0x0fbc, 0x10b2, 0x10f8 push context-long = A2@(0xe3c) | MEASURED | `2f 2a 0e 3c` at respective push sites |
| Site 0x10b2 uses fp@(-46) as source (= saved A3@(4)) | MEASURED | `2f 2e ff d2` at 0x10a4; fp@(-46) assigned from A3@(4) at `2d 6b 00 04 ff d2` at 0x1072 |
| Sites 0x10f8 and 0x1144 push A3@(4) as source | MEASURED | `2f 2b 00 04` at 0x10ec and 0x1138 |
| Sites 0x0f60/0x0fbc/0x102c push D6 as source | MEASURED | `2f 06` at 0x0f54, 0x0fb2, 0x1022 |
| flag=1 -> CDB[5]=0x80; flag=0 -> CDB[5]=0x00 | MEASURED | bytes `1d 45 ff ff` + conditional at 0x1670-0x167e in SMSendData |
| SRAW/mode_off branch reached via BEQ 0x1072 from 0x0ec4 | MEASURED | `67 00 01 ac` at 0x0ec4; target 0x0ec4+2+0x01ac = 0x1072 |
| SYSX/MIDI handlers call JSR 0x0ca2 before the JSR 0x106e push | MEASURED | `4e b9 00 00 0c a2` at 0x10d2 and 0x1122 |
| SYSX: BEQ.W 0x1160 (skip JSR 0x106e) if JSR 0x0ca2 returns 0 | MEASURED | `67 00 00 80` at 0x10de; target = 0x10e0 + 0x0080 = 0x1160 |
| MIDI: BEQ.S 0x1160 (skip JSR 0x106e) if JSR 0x0ca2 returns 0 | MEASURED | `67 30` at 0x112e; target = 0x1130 + 0x30 = 0x1160 |
| 0x0e5e SYSX entry target (0x0e66) falls inside dispatch table | CANDIDATE | 0x0e66 = `46 46 00 1a` = part of 'BOFF' entry data; ambiguous role |
| Mode byte semantics: 0x01=reply_expected, 0x00=fire_and_forget | CANDIDATE | Follows from SMSendData CDB formula (MEASURED) + MESA bridge documentation |
| Context-long = 0 is safe for flag=0 sends | CANDIDATE | Consistent with no-reply semantics; whether SMSendData reads it when flag=0 not verified |
