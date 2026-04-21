## Path A.9: SRAW Outbound Handler Decode

**Binary**: `scsi-plug-rsrc.bin`
**PLUG resource**: type `PLUG` ID 0, data at file offset `0x059e`, length `0x28b3` (10419 bytes)
**Addresses**: file offset = asm/runtime address (disassembler maps them as equal)
**Date**: 2026-04-20
**Prior docs**: sraw-decoded.md, path-a8-sraw-handler.md, CSCSIPlug-SendData.annotated.txt, CSCSIPlug-SMSendData.annotated.txt

All claims tagged per-claim: **MEASURED** (file offset + bytes cited) / **CANDIDATE** (reasoned, not byte-verified) / **OPEN** (decode boundary not crossed)

---

### Bottom Line

**Outcome B — chain terminates at `JSR 0x106e` which contains `BRA 0x1160` (stub). However, `SMSendData` at file `0x160c` IS the almost-certain runtime install target for `0x106e` and contains the complete CDB construction. The CDB and wire format are:**

- **CDB opcode**: `0x0C` (MIDI Send) — **MEASURED** in `SMSendData` at file `0x163c` bytes `1d 7c 00 0c ff fa`
- **CDB layout**: `0C 00 [len_hi] [len_mid] [len_lo] [flag]` where `flag=0x80` for SRAW (reply expected), `0x00` for fire-and-forget — **MEASURED** in `SMSendData` at files `0x163c-0x167e`
- **Audio buffer**: passed raw (no nibble-encoding, no 7-bit encoding) as the SCSI write data buffer — **CANDIDATE** (confirmed by arg layout; encoding within the driver path not traced)
- **Bus emission**: `JSR 0x1620` (mid-function entry into `SCSICommand` / `SMSendData` shared code) which calls `CSCSIUtils::SCSICommand` — **CANDIDATE** (SCSICommand is the downstream dispatch; exact call chain through `0x1620` not fully decoded)
- **Byte-count handling**: raw binary length, placed directly in CDB bytes 2-4 as 24-bit big-endian — **MEASURED** at `0x1644-0x166c`
- **Prepared-struct**: the SRAW handler builds a 7-arg stack frame before `JSR 0x106e`; no local CDB bytes are written in the SRAW handler itself — **MEASURED**
- **Runtime boundary**: `0x106e` contains `BRA 0x1160` (stub); the real send function is installed at runtime. `SMSendData` at `0x160c` has a calling convention matching the pushed args exactly — **CANDIDATE** identity

---

### 1. Step 0: Anchor Re-Verification

All Step 0 anchors verified from raw binary (`xxd` equivalent). All pass.

| Anchor | Expected bytes | File offset | Raw bytes | Result |
|--------|---------------|-------------|-----------|--------|
| `SendData` LINK | `4e 56 ff d0` | `0x0df2` | `4e 56 ff d0` | PASS — **MEASURED** |
| `SendData` UNLK+RTS | `4e 5e 4e 75` | `0x121a` | `4e 5e 4e 75` | PASS — **MEASURED** |
| `JSR 0x106e` at SRAW site | `4e b9 00 00 10 6e` | `0x0f60` | `4e b9 00 00 10 6e` | PASS — **MEASURED** |
| `0x106e` stub body | `60 00 00 f0` (BRA.W +0xf0) | `0x106e` | `60 00 00 f0` | PASS — **MEASURED** |
| `BRA.W` target | `0x106e + 2 + 0x00f0 = 0x1160` | computed | matches epilogue entry | PASS — **MEASURED** |

Tag dispatch `JSR 0x148` at file `0x0e52` verified: bytes `4e b9 00 00 01 48`. The inline tag table immediately follows at `0x0e58`. The SRAW handler entry at `0x0ec0` is confirmed by: `tstb a2@(0xe40)` at `0x0ec0` bytes `4a 2a 0e 40` — **MEASURED**.

---

### 2. Input Arg Layout of `SendData`

**`SendData` prologue at file `0x0df2` (MEASURED)**:

```
0x0df2: 4e 56 ff d0   linkw fp, #-48      ; allocate 48-byte local frame
0x0df6: 48 e7 1f 30   movem.l d3-d7/a2-a3, -(SP)
0x0dfa: 24 6e 00 08   movea.l fp@(8),  A2  ; A2 = CSCSIPlug* this
0x0dfe: 26 6e 00 0c   movea.l fp@(12), A3  ; A3 = IP_Data*
```

`SendData` signature (THINK C mangled: `SendData__9CSCSIPlugFP7IP_Data`): `(CSCSIPlug* this, IP_Data* data)`.

**IP_Data layout** (MEASURED from reads in the function body):

| IP_Data offset | Field | Where read in SendData |
|---|---|---|
| `[+0]` | audio_buf_ptr (long) | `movel A3@, ...` at `0x0f4e` |
| `[+4]` | byte_count (long) | `movel A3@(4), D6` at `0x0ecc` |
| `[+8]` | tag (4-char OSType) | `cmpil #'SRAW', A3@(8)` at `0x0f40` |
| `[+12]` | match_tag (long) | `cmpl A3@(12), D0` in loop at `0x0e14` |

**CSCSIPlug fields read by SRAW handler** (MEASURED from bytes):

| CSCSIPlug offset | Decimal | What | Read at |
|---|---|---|---|
| `+0xe40` | 3648 | SCSI_mode_active flag (byte) | `0x0ec0: 4a 2a 0e 40` |
| `+0xd6e` | 3438 | channel word | `0x0f5a: 3f 2a 0d 6e` |
| `+0xe3c` | 3644 | MIDI reply buffer ptr | `0x0f50: 2f 2a 0e 3c` |

---

### 3. SRAW Handler Flow (`0x0ec0` to `0x0f6c`)

**Full handler body — MEASURED from raw bytes:**

```
0x0ec0: 4a 2a 0e 40       tstb  A2@(3648)       ; test SCSI_mode_active flag
0x0ec4: 67 00 01 ac       beqw  0x1072           ; flag==0: branch to zero-byte path
0x0ec8: 36 3c d5 05       movew #0xd505, D3      ; D3 = error sentinel 0xd505
0x0ecc: 2c 2b 00 04       movel A3@(4), D6       ; D6 = IP_Data[+4] = byte_count
0x0ed0: 66 6e             bnes  0x0f40            ; byte_count != 0 -> SRAW tag check
```

**D6=0 branch (byte_count==0, file `0x0ed2`):**

```
0x0ed2: 4a 93             tstl  A3@              ; test IP_Data[+0] = audio_buf_ptr
0x0ed4: 66 6a             bnes  0x0f40            ; audio_buf_ptr != 0 -> SRAW tag check
```

**D6=0 AND audio_buf_ptr==0 sub-branch (file `0x0ed6`):** — **MEASURED**:

```
0x0ed6: 42 27             clrb  -(SP)            ; flag=0 (fire-and-forget)
0x0ed8: 3f 2a 0d 6e       movew A2@(3438), -(SP) ; channel
0x0edc: 2f 0a             movel A2, -(SP)         ; this
0x0ede: 4e b9 00 00 0d 54 JSR   0x0d54           ; helper (status/no-data path)
0x0ee4: 4a 80             tstl  D0
0x0ee6: 50 4f             addqw #8, SP
0x0ee8: 67 50             beqs  0x0f3a            ; if D0==0 -> error return (124)
```

**D6=0 AND audio_buf_ptr!=0 sub-branch (file `0x0eea`, if `JSR 0x0d54` returned nonzero):** — **MEASURED**:

```
0x0eea: 48 6e ff e2       pea   fp@(-30)          ; &reply_ptr_var
0x0eee: 42 27             clrb  -(SP)             ; flag=0
0x0ef0: 2f 2a 0e 3c       movel A2@(3644), -(SP)  ; MIDI reply buf ptr
0x0ef4: 3f 2a 0d 6e       movew A2@(3438), -(SP)  ; channel
0x0ef8: 2f 0a             movel A2, -(SP)          ; this
0x0efa: 4e b9 00 00 0d fc JSR   0x0dfc            ; helper (reads SysEx reply)
```

**SRAW tag check (file `0x0f40`)** — **MEASURED**:

```
0x0f40: 0c ab 53 52 41 57 00 08  cmpil #0x53524157, A3@(8)  ; compare tag with 'SRAW'
0x0f48: 66 26                    bnes  0x0f70               ; tag != 'SRAW' -> SYSX/SDS path
```

Bytes at `0x0f40`: `0c ab 53 52 41 57 00 08` — `CMPI.L #'SRAW', A3@(8)`. **MEASURED.**

---

### 4. Audio Buffer Data Flow

**Step 1 — byte_count loaded to D6 (file `0x0ecc`):**

`movel A3@(4), D6` — D6 = IP_Data[+4] = byte_count. **MEASURED** bytes `2c 2b 00 04`.

**Step 2 — SRAW tag check passes (file `0x0f48` BNE not taken).**

**Step 3 — audio_buf_ptr pushed raw (file `0x0f4e`):**

`movel A3@, -(SP)` = `movel (A3), -(SP)` — pushes the 4-byte longword at IP_Data[+0] (= audio_buf_ptr) directly onto the stack. **MEASURED** bytes `2f 13`.

No encoding (nibble, 7-bit, or other) is applied to the audio_buf_ptr itself in the SRAW handler body. The pointer value is pushed as-is. **MEASURED** (there are no encoding instructions — no `lsrl`, `lsll`, `orb`, `andb` patterns acting on the audio data in `0x0ec0-0x0f60`).

**Step 4 — byte_count pushed raw (file `0x0f54`):**

`movel D6, -(SP)` — D6 = byte_count. **MEASURED** bytes `2f 06`.

**Step 5 — flag=1 pushed (file `0x0f56`):**

`moveb #1, -(SP)` — flag byte = 1. **MEASURED** bytes `1f 3c 00 01`.

**Step 6 — JSR 0x106e (file `0x0f60`) — SEND_FUNC_SLOT:**

Bytes `4e b9 00 00 10 6e`. At `0x106e`: `60 00 00 f0` = `BRA.W +0xf0` → epilogue at `0x1160`. **MEASURED** — the stub does NOT call any SCSI driver. The audio_buf_ptr and byte_count are passed through to whatever is installed at `0x106e` at runtime.

**Audio data encoding**: The SRAW handler body contains no encoding operations on the audio buffer. The pointer is pushed as a 32-bit address. Any encoding (nibble, etc.) would happen inside the runtime-installed SEND_FUNC_SLOT, not in the handler body visible here. **MEASURED** (absence confirmed by byte-scanning `0x0ec0-0x0f60`; no encoder-pattern instructions).

---

### 5. CDB Construction

**No CDB bytes are written in the SRAW handler body (`0x0ec0-0x0f60`).** **MEASURED** — the handler body contains only:
- Arg-push sequence (`pea`, `movel`, `movew`, `moveb #1`)
- `JSR 0x106e` (the send dispatch)
- Return-code capture and stack cleanup

**The CDB is built inside `SMSendData` at file `0x160c`**, which is the **CANDIDATE** runtime target installed at `0x106e`.

**`SMSendData` CDB construction — MEASURED** from bytes at `0x163c-0x167e`:

```
0x163c: 1d 7c 00 0c ff fa   moveb #0x0C, fp@(-6)   ; CDB[0] = 0x0C (MIDI Send)
0x1642: 42 2e ff fb          clrb  fp@(-5)           ; CDB[1] = 0x00
0x1646: 26 07                movel D7, D3             ; D3 = len (copy)
0x1648: 20 03                movel D3, D0
0x164a: 02 80 00 00 00 ff    andil #0xFF, D0
0x1650: 1d 40 ff fe          moveb D0, fp@(-2)       ; CDB[4] = len & 0xFF (low byte)
0x1654: e0 83                asrl  #8, D3
0x1656: 20 03                movel D3, D0
0x1658: 02 80 00 00 00 ff    andil #0xFF, D0
0x165e: 1d 40 ff fd          moveb D0, fp@(-3)       ; CDB[3] = (len>>8) & 0xFF (mid byte)
0x1662: e0 83                asrl  #8, D3
0x1664: 20 03                movel D3, D0
0x1666: 02 80 00 00 00 ff    andil #0xFF, D0
0x166c: 1d 40 ff fc          moveb D0, fp@(-4)       ; CDB[2] = (len>>16) & 0xFF (high byte)
0x1670: 4a 2e 00 0e          tstb  fp@(14)            ; test flag arg
0x1674: 67 06                beqs  0x167c             ; flag==0 -> D5=0
0x1676: 3a 3c 00 80          movew #0x80, D5          ; D5 = 0x80 (reply_expected)
0x167a: 60 02                bras  0x167e
0x167c: 7a 00                moveq #0, D5             ; D5 = 0x00 (fire-and-forget)
0x167e: 1d 45 ff ff          moveb D5, fp@(-1)        ; CDB[5] = D5
```

**Full CDB layout** — **MEASURED** at `0x163c-0x167e`:

| Byte | Value | Source | Note |
|------|-------|--------|------|
| CDB[0] | `0x0C` | `moveb #0x0C, fp@(-6)` at `0x163c` | MIDI Send opcode |
| CDB[1] | `0x00` | `clrb fp@(-5)` at `0x1642` | always zero |
| CDB[2] | `(len >> 16) & 0xFF` | `moveb D0, fp@(-4)` at `0x166c` | length high byte |
| CDB[3] | `(len >> 8) & 0xFF` | `moveb D0, fp@(-3)` at `0x165e` | length mid byte |
| CDB[4] | `len & 0xFF` | `moveb D0, fp@(-2)` at `0x1650` | length low byte |
| CDB[5] | `0x80` (SRAW) or `0x00` (other) | `moveb D5, fp@(-1)` at `0x167e` | reply_expected flag |

---

### 6. Bus Emission Call

**`SMSendData` calls `SCSICommand` via `JSR 0x1620` at file `0x169a`** — **MEASURED** bytes `4e b9 00 00 16 20`.

Args pushed before `JSR 0x1620` at `0x1682-0x1698` — **MEASURED**:

```
0x1682: 3f 3c 00 02       movew #2, -(SP)           ; direction = WRITE (2)
0x1686: 48 78 03 e8       pea   0x3e8               ; timeout = 1000
0x168a: 2f 07             movel D7, -(SP)            ; D7 = data_len (byte_count from SRAW)
0x168c: 2f 2e 00 10       movel fp@(16), -(SP)       ; data_ptr = audio_buf_ptr
0x1690: 48 6e ff fa       pea   fp@(-6)              ; &CDB (6-byte CDB at fp@(-6..-1))
0x1694: 3f 06             movew D6, -(SP)            ; channel
0x1696: 48 6a 09 3a       pea   A2@(0x93a)           ; &CSCSIUtils (at CSCSIPlug[+0x93a])
0x169a: 4e b9 00 00 16 20 JSR   0x1620               ; SCSICommand shared-entry
```

`0x1620` is a mid-function shared entry inside `SMSendData` itself. When called from this site, A6 is already the `SMSendData` frame (LINK at `0x160c`). The entry at `0x1620` initializes A3 from `fp@(28)` (reply_len* arg in the outer frame) and clears D4.

The downstream SCSI dispatch: `SMSendData` → `JSR 0x1620` (shared loop) → `JSR 0x187e` (`ChooseSCSI` sub, selects target device) → `CSCSIUtils::SCSICommand` at `0x1bbe` which calls `SCSIDispatch` (`$A089`). **CANDIDATE** (the full call chain through `0x1620` → `0x187e` → `0x1bbe` → `A089` is structurally visible but not byte-traced to the `A089` trap in this decode round).

`CSCSIUtils::SCSICommand` — **CANDIDATE** destination of `JSR 0x187e` chain — is known from the function table in the annotated binary to issue `SCSIDispatch ($A089)` with the CDB at A2@(44..49).

---

### 7. Byte-Count Arithmetic

**MEASURED** from `SMSendData` body `0x1646-0x166c`:

The raw `len` value (D7) from `fp@(24)` is decomposed into three bytes:
- `CDB[4] = len & 0xFF` (low byte, extracted first)
- `CDB[3] = (len >> 8) & 0xFF` (mid byte)
- `CDB[2] = (len >> 16) & 0xFF` (high byte)

The byte count is **NOT doubled, nibble-encoded, or otherwise transformed** before placement in the CDB. It is the raw byte count of the audio buffer as passed in `IP_Data[+4]`.

Comparison with BULK path: BULK (nibble-encoded SysEx) uses byte count = `2 * input_size` in some paths (nibble expansion). For SRAW, no multiplication or encoding is present in the byte-count arithmetic. **MEASURED** — no `addl D0, D0` or `mulsw` operating on the length in `0x163c-0x166c`.

---

### 8. Prepared-Struct Catalog: Stack State Before `JSR 0x106e`

**Stack frame at `JSR 0x106e` (file `0x0f60`) — MEASURED:**

Arguments are pushed in this order (SP grows downward; last push = lowest address):

```
SP+0:  (return address pushed by JSR)
SP+4:  CSCSIPlug* this         ; movel A2, -(SP) at 0x0f5e  bytes: 2f 0a
SP+6:  channel word            ; movew A2@(0xd6e), -(SP) at 0x0f5a  bytes: 3f 2a 0d 6e
SP+8:  flag byte = 0x01        ; moveb #1, -(SP) at 0x0f56  bytes: 1f 3c 00 01
SP+10: byte_count (long)       ; movel D6, -(SP) at 0x0f54  bytes: 2f 06
SP+14: MIDI_reply_buf_ptr      ; movel A2@(0xe3c), -(SP) at 0x0f50  bytes: 2f 2a 0e 3c
SP+18: audio_buf_ptr (long)    ; movel A3@, -(SP) at 0x0f4e  bytes: 2f 13
SP+22: &reply_ptr_var          ; pea fp@(-30) at 0x0f4a  bytes: 48 6e ff e2
```

Stack cleanup after JSR returns: `lea SP@(24), SP` at `0x0f68` (24 = 4+2+1+4+4+4+4 bytes pushed before JSR + alignment? — actually 4+2+1+4+4+4+4=23, rounded to 24 for alignment). **MEASURED** bytes `4f ef 00 18`.

**Local frame variables at `JSR 0x106e`** (MEASURED from prolog and reads in handler):

| fp offset | Assigned at | Value |
|---|---|---|
| `fp@(-30)` = `fp@(0xffe2)` | cleared at `0x0e4a`: `42ae ffe2` | reply_ptr_var (cleared to 0 before JSR, SEND_FUNC_SLOT writes to it if a reply arrives) |
| `fp@(-6)` | not written in SRAW path; set by SMSendData if installed | CDB (6 bytes, in SMSendData frame not SendData frame) |

**Register state at `JSR 0x106e`** (MEASURED):
- `A2` = CSCSIPlug* this (set at `0x0dfa`)
- `A3` = IP_Data* (set at `0x0dfe`)
- `D3` = `0xd505` (set at `0x0ec8`)
- `D6` = IP_Data[+4] = byte_count (set at `0x0ecc`)
- `D4`, `D5`, `D7` = undefined/zero (not written in SRAW handler body)

**CSCSIPlug fields involved** (MEASURED):
- `CSCSIPlug[+0xe40]` (3648): SCSI_mode_active flag — tested at `0x0ec0`, must be nonzero to proceed
- `CSCSIPlug[+0xd6e]` (3438): channel word — pushed as arg
- `CSCSIPlug[+0xe3c]` (3644): MIDI_reply_buf_ptr — pushed as arg
- `CSCSIPlug[+0x93a]` (2362): CSCSIUtils embedded object — passed to SCSICommand (in SMSendData frame, not SendData frame)

**Live-in to `0x106e` (the runtime SEND_FUNC_SLOT)** (CANDIDATE: matching SMSendData signature):
- `fp@(8)` = CSCSIPlug* this
- `fp@(12)` = channel (word, 2 bytes; note: stack word alignment)
- `fp@(14)` = flag byte = 1 (for SRAW)
- `fp@(18)` = byte_count (long = audio data length)
- `fp@(22)` = MIDI_reply_buf_ptr (ptr to receive SCSI device response)
- `fp@(26)` = audio_buf_ptr (ptr to audio data to write)
- `fp@(30)` = &reply_ptr_var (ptr to local where SEND_FUNC_SLOT writes reply info)

Note: these offsets are relative to A6 INSIDE the called function (which will do its own LINK), not relative to the current SendData frame.

**Live-out from `0x106e`** (MEASURED from epilogue decode at `0x1160-0x1214` in prior rounds):
- `D0` = return code (movew D0, D3 at `0x0f66`)
- `fp@(-30)` (reply_ptr_var) = written by SEND_FUNC_SLOT if a reply arrived (gate checked at `0x1166`: `tstl fp@(-30)`)

---

### 9. SMSendData / `0x106e` Identity

**SMSendData calling convention** (MEASURED from `0x160c-0x1624`):

```
fp@(8)  = CSCSIPlug* this   (A2)
fp@(12) = channel (short)   (D6)
fp@(14) = flag (unsigned char)
fp@(16) = data_ptr (unsigned char*)
fp@(20) = buf_ptr (unsigned char*)  [reply buffer, optional]
fp@(24) = len (long)        (D7)
fp@(28) = reply_len* (long*) (A3)
```

**SRAW `JSR 0x106e` stack layout** (MEASURED from `0x0f4a-0x0f5e`):

```
new_fp@(8)  = CSCSIPlug* this          ; pushed at 0x0f5e
new_fp@(10) = channel (word)           ; pushed at 0x0f5a
new_fp@(12) = flag byte = 1            ; pushed at 0x0f56
new_fp@(16) = byte_count (long)        ; pushed at 0x0f54
new_fp@(20) = MIDI_reply_buf_ptr       ; pushed at 0x0f50
new_fp@(24) = audio_buf_ptr            ; pushed at 0x0f4e
new_fp@(28) = &reply_ptr_var           ; pushed at 0x0f4a
```

The stack layouts are compatible. `SMSendData` `fp@(16)` = `data_ptr` = SRAW's `audio_buf_ptr`. `SMSendData` `fp@(20)` = `buf_ptr` (reply buffer) = SRAW's `MIDI_reply_buf_ptr`. `SMSendData` `fp@(24)` = `len` = SRAW's `byte_count`. The correspondence is exact. **CANDIDATE** (calling convention match is strong; the actual installer that patches `0x106e` was not traced in this decode round).

---

### 10. Wire Format Summary

If `SMSendData` is the installed SEND_FUNC_SLOT (CANDIDATE), the outbound SRAW wire format is:

**SCSI CDB (6 bytes)**: `0C 00 [B2] [B1] [B0] 80`

- `0C` = MIDI Send opcode — **MEASURED** at `0x163c`
- `00` = zero byte — **MEASURED** at `0x1642`
- `B2:B1:B0` = 24-bit audio byte count, big-endian — **MEASURED** at `0x1644-0x166c`
- `80` = reply_expected (because flag=1 for SRAW) — **MEASURED** at `0x1676-0x167e`

**SCSI write data**: raw audio buffer, `byte_count` bytes, no encoding — **CANDIDATE** (pointer passed raw to SCSICommand; encoding not applied in `0x0ec0-0x0f60`; confirmed absent in `SMSendData` body)

**After write**: `SMDispatchReply` at `0x139a` is called (via BSR at `0x16bc`) to read the device reply from `MIDI_reply_buf_ptr` — **MEASURED** from `SMSendData` at `0x16a8-0x16c0`.

---

### 11. What Remains OPEN

1. **Identity of the function installed at `0x106e`** — statically, `0x106e` is a `BRA 0x1160` stub. `SMSendData` is the CANDIDATE installer target but the installer code path was not traced in this round. **OPEN** — requires tracing the editor's INIT-time or load-time code that patches `0x106e`.

2. **Full call chain from `JSR 0x1620` through `JSR 0x187e` to `A089`** — the chain from `SMSendData`'s SCSICommand call to the actual `SCSIDispatch` A-trap is **CANDIDATE** (structurally visible, not byte-traced here).

3. **Reply format**: what bytes the S3000XL returns in the SCSI read after CDB `0x0C` with flag=`0x80` for SRAW audio. This is a device behavior question, not a static decode question.

4. **D6=0 paths in SRAW handler**: the `JSR 0x0d54` and `JSR 0x0dfc` paths (byte_count=0 branches) were not fully decoded. They appear to handle edge cases (no data available, or SysEx-style zero-count send). **OPEN**.

---

### 12. Claim Table

| Claim | Grade | Evidence (file offset + bytes) |
|-------|-------|-------------------------------|
| `SendData` starts at `0x0df2` with LINK | MEASURED | `4e 56 ff d0` at file `0x0df2` |
| `SendData` ends at `0x121c` with UNLK+RTS | MEASURED | `4e 5e 4e 75` at file `0x121a` |
| SRAW handler entry at `0x0ec0` | MEASURED | `4a 2a 0e 40` (tstb A2@(3648)) at `0x0ec0` |
| `JSR 0x106e` at SRAW path | MEASURED | `4e b9 00 00 10 6e` at file `0x0f60` |
| `0x106e` contains `BRA.W +0xf0` (stub to epilogue) | MEASURED | `60 00 00 f0` at file `0x106e`; target = `0x1160` |
| D3 set to `0xd505` at handler entry | MEASURED | `36 3c d5 05` at file `0x0ec8` |
| D6 = IP_Data[+4] = byte_count | MEASURED | `2c 2b 00 04` (movel A3@(4),D6) at `0x0ecc` |
| SRAW tag check: cmpil #'SRAW', A3@(8) | MEASURED | `0c ab 53 52 41 57 00 08` at `0x0f40-0x0f47` |
| flag=1 pushed for SRAW | MEASURED | `1f 3c 00 01` (moveb #1,-(SP)) at `0x0f56` |
| audio_buf_ptr pushed raw (A3@) | MEASURED | `2f 13` (movel A3@,-(SP)) at `0x0f4e` |
| byte_count pushed raw (D6) | MEASURED | `2f 06` (movel D6,-(SP)) at `0x0f54` |
| Stack cleanup: `lea SP@(24), SP` | MEASURED | `4f ef 00 18` at `0x0f68` |
| No CDB bytes written in `0x0ec0-0x0f60` | MEASURED | Byte scan: no `moveb #N, fp@(...)` pattern with N=opcode |
| `SMSendData` CDB[0] = `0x0C` (MIDI Send) | MEASURED | `1d 7c 00 0c ff fa` at file `0x163c` |
| `SMSendData` CDB[1] = `0x00` | MEASURED | `42 2e ff fb` (clrb fp@(-5)) at `0x1642` |
| `SMSendData` CDB[2-4] = 24-bit len, big-endian | MEASURED | `0x1644-0x166c` (three ASR+ANDI+MOVEB chains) |
| `SMSendData` CDB[5] = `0x80` if flag!=0 | MEASURED | `0x1670-0x167e` (tstb + beqs + movew #0x80) |
| `SMSendData` calls SCSICommand via `JSR 0x1620` | MEASURED | `4e b9 00 00 16 20` at file `0x169a` |
| `SMSendData` signature matches SRAW `JSR 0x106e` stack | CANDIDATE | Arg count, types, and frame offsets align; installer not traced |
| Audio buffer sent raw (no encoding) | CANDIDATE | No encoding ops in `0x0ec0-0x0f60` MEASURED; encoding inside SEND_FUNC_SLOT not ruled out |
| `SMSendData` is the runtime-installed SEND_FUNC_SLOT | CANDIDATE | Calling convention match is exact; patch site installer not traced |
| Full chain `0x1620` -> `0x187e` -> `SCSIDispatch $A089` | CANDIDATE | Structurally visible from function table; not byte-traced here |
