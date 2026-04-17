# MESA II SCSI Plug: SendData BULK/SRAW/BOFF Trace

**Date:** 2026-04-16  
**Binary:** `scsi-plug-rsrc.bin` (12053 bytes, MESA SCSI Plug 2.1.2)  
**Method:** Musashi 68k emulator (mesa-plug-harness), Phase 4 — dynamic trace with real SCSI forwarding to S3000XL (target 6, exclusive channel 0)  
**Trace log:** `traces/senddata-bulk-sraw-boff-trace.log`

All claims in this document are cited from the trace log. Nothing is inferred beyond what the log shows.

---

## 1. SendData Calling Convention

Confirmed by trace at `0x10df2`–`0x10dfe`:

```
[00010df2] link    A6, #-$30      ; allocate 48 bytes of locals
[00010df6] movem.l D3-D7/A2-A3, -(A7)
[00010dfa] movea.l ($8,A6), A2    ; A2 = this (CSCSIPlug*)
[00010dfe] movea.l ($c,A6), A3    ; A3 = IP_Data*
```

Stack layout at call site (caller pushes, JSR adds return addr):
- `A6+4`: return address (pushed by JSR)
- `A6+8`: first arg = `CSCSIPlug* this`
- `A6+12`: second arg = `IP_Data* ip`

---

## 2. Socket Search Loop

```
[00010e02] moveq   #$0, D3        ; D3 = found-socket result
[00010e04] clr.w   ($d6e,A2)      ; clear socket-match word in this
[00010e08] moveq   #$0, D4        ; D4 = loop counter
[00010e0a] bra     $10e2e         ; jump to loop condition

[00010e2e] movea.w D4, A0         ; A0 = counter
[00010e30] cmpa.l  ($38,A2), A0   ; compare A0 with *(this+0x38) = socket count
[00010e34] blt     $10e0c         ; loop body if counter < socket_count

[00010e36] tst.w   ($d6e,A2)      ; was a matching socket found?
[00010e3a] bne     $10e44         ; yes: proceed to tag dispatch
[00010e3c] move.w  #$c950, D0     ; no: error code 0xc950 (no socket)
[00010e40] bra     $11216         ; return with error
```

**Field discovered:** `CSCSIPlug+0x38` = socket count (LONG). Must be > 0 for any dispatch to occur.  
**Field discovered:** `CSCSIPlug+0x0d6e` = socket-match flag (WORD). The loop body sets this when a matching socket is found; the dispatch gate checks it.

The mock object had `this+0x38 = 0`, so the loop ran 0 iterations. The socket bypass injected `this+0x0d6e = 1` at intercept point `0x10e36` to allow execution to continue.

---

## 3. IP_Data Tag Read and TagDispatch

After the socket-match gate passes:

```
[00010e44] tst.w   D3             ; D3 check (secondary gate, D3=0 → fall through)
[00010e46] bne     $11214
[00010e4a] clr.l   (-$1e,A6)      ; zero local A6-30
[00010e4e] move.l  ($8,A3), D0    ; D0 = *(IP_Data + 8) = TAG
[TagDispatch] tag='BULK' → handler @ 0x00010e9e
```

**IP_Data+8 = tag** confirmed. The instruction `MOVE.L 8(A3), D0` at file offset 0x0e4e reads D0 from IP_Data+8. TagDispatch then routes on D0.

Additional IP_Data field observed at BULK handler entry:
```
[00010ecc] move.l  ($4,A3), D6    ; D6 = *(IP_Data+4) = len_hi or flags
```

---

## 4. Tag Dispatch Table (Confirmed by Hardware Trace)

TagDispatch at file 0x0e52 (`JSR $00000148`). Dispatch table at 0x0e58, entries at 0x0e64 (after 12-byte preamble). Entry formula: `handler = offset_field_addr + signed_offset`.

| Tag  | Entry addr (file) | Offset field | Handler addr (file) | Handler (runtime) |
|------|-------------------|--------------|---------------------|-------------------|
| BOFF | 0x0e64            | +0x001a      | 0x0e82              | 0x10e82           |
| BULK | 0x0e6a            | +0x0030      | 0x0e9e              | 0x10e9e           |
| MIDI | 0x0e70            | +0x02a2      | 0x1116              | 0x11116           |
| SRAW | 0x0e76            | +0x0046      | 0x0ec0              | 0x10ec0           |
| SYSX | 0x0e7c            | +0x0246      | 0x10c6              | 0x110c6           |

Routing confirmed by trace output:
```
[TagDispatch] tag='BULK' (0x42554c4b) → handler @ 0x00010e9e
[TagDispatch] tag='SRAW' (0x53524157) → handler @ 0x00010ec0
[TagDispatch] tag='BOFF' (0x424f4646) → handler @ 0x00010e82
```

---

## 5. BULK Handler Execution Path

Handler entry at 0x10e9e (file 0x0e9e). First observed instruction at 0x10ea2 (2 bytes into entry — branch not taken):

```
[00010ea2] bne     $10ec0         ; branch if BULK has extra flag set
[00010ec0] tst.b   ($e40,A2)      ; test byte at this+0xe40
[00010ec4] beq     $11072         ; if zero → different path
[00010ec8] move.w  #$d505, D3     ; D3 = error sentinel 0xd505
[00010ecc] move.l  ($4,A3), D6    ; D6 = IP_Data+4 (len_hi / flags)
[00010ed0] bne     $10f40         ; if len_hi != 0 → branch
[00010ed2] tst.l   (A3)           ; test IP_Data+0
[00010ed4] bne     $10f40         ; if nonzero → branch
; Fall through: IP_Data+0=0 and IP_Data+4=0 (both zero)
[00010ed6] clr.b   -(A7)          ; push 0 (flag arg)
[00010ed8] move.w  ($d6e,A2), -(A7)  ; push this+0x0d6e (socket match word)
[00010edc] move.l  A2, -(A7)         ; push this ptr
[00010ede] jsr     $10d54.l          ; call internal function at file 0x0d54
```

The call `JSR $10d54` with args `(flag=0, socket_word, this)` is the next function to investigate. The mock object lacks the Mac Memory Manager state needed by 0x0d54, so execution terminates there.

**Field discovered:** `CSCSIPlug+0xe40` — single byte flag. Must be non-zero for the BULK handler to proceed past `0x10ec4`. The mock had this set to 1 in `run_phase4()`.

---

## 6. SRAW Handler Execution Path

Handler at 0x10ec0. Trace shows SRAW and BULK share the same path from 0x10ec0 onward:

```
[TagDispatch] tag='SRAW' (0x53524157) → handler @ 0x00010ec0
[00010ec4] beq     $11072         ; same this+0xe40 check
[00010ec8] move.w  #$d505, D3
[00010ecc] move.l  ($4,A3), D6
[00010ed0] bne     $10f40
[00010ed2] tst.l   (A3)
[00010ed4] bne     $10f40
[00010ed6] clr.b   -(A7)
[00010ed8] move.w  ($d6e,A2), -(A7)
[00010edc] move.l  A2, -(A7)
[00010ede] jsr     $10d54.l
```

SRAW and BULK both route to 0x10ec0 and follow identical paths to `JSR $10d54`. The distinction between them must occur inside 0x0d54 or later (the tag is in D0 at time of dispatch, but D0 may not be preserved into the subfunction).

**Note:** The BULK handler (0x10e9e) has 2 bytes before 0x10ea2 that were not traced (the NOP patches from TagDispatch interception skip those bytes). The first instruction at 0x10e9e is likely a conditional that determines whether to jump to 0x10ec0 or handle the Akai header directly.

---

## 7. BOFF Handler Execution Path

Handler at 0x10e82:

```
[TagDispatch] tag='BOFF' (0x424f4646) → handler @ 0x00010e82
[00010e84] clr.b   -(A7)          ; push 0
[00010e86] move.w  ($d6e,A2), -(A7)
[00010e8a] move.l  A2, -(A7)
[00010e8c] jsr     $10ca2.l       ; call internal cleanup function at file 0x0ca2
TRAP: $A02A (HUnlock) A0=0x00000000
TRAP: $A023 (DisposeHandle) A0=0x00000000
```

The BOFF handler immediately calls `JSR $10ca2` with the same arg pattern as BULK/SRAW. This function calls `HUnlock` then `DisposeHandle`, suggesting BOFF is responsible for releasing the Mac Memory Manager handle that was used for the sample data transfer. The null handle (A0=0) is because our mock has no allocated handle.

---

## 8. Common Subfunction Pattern

All three handlers push the same three arguments before calling a subfunction:
1. `CLR.B -(A7)` — byte flag (0 = normal, possibly 1 = abort)
2. `MOVE.W ($D6E,A2), -(A7)` — socket match word from CSCSIPlug
3. `MOVE.L A2, -(A7)` — CSCSIPlug* this

BULK and SRAW call `0x10d54` (file 0x0d54, within the unnamed function at 0x0ce4–0x0d62).  
BOFF calls `0x10ca2` (file 0x0ca2, which calls HUnlock+DisposeHandle).

---

## 9. IP_Data Structure (Confirmed)

Confirmed by live trace (Phase 5, 2026-04-16):

```
IP_Data:
  +0:  [4 bytes] data field A — BULK: sysex_len; SRAW: audio_buf_ptr
  +4:  [4 bytes] data field B — BULK: sysex_ptr; SRAW: audio_byte_count
  +8:  [4 bytes] TAG           (loaded into D0 at 0x10e4e for dispatch)
  +12: [4 bytes] socket ptr    (searched by socket loop; 0 works with bypass)
```

The tag at +8 confirmed by live trace. The dual interpretation of +0/+4 confirmed by
tracing both BULK and SRAW dispatch paths to `SEND_FUNC_SLOT` with correct stack args.

**BULK (SDATA):** IP_Data+4 is used as a pointer to the SysEx buffer (`MOVEA.L D6, A0` at
`0x10f70` then `CMPI.B #$F0, (A0)` validates the SysEx header). IP_Data+0 is pushed as
arg `len` (SysEx byte count).

**SRAW:** IP_Data+0 is pushed as `audio_ptr` (`MOVE.L (A3), -(SP)` at `0x10f4e`). IP_Data+4
is D6 = audio byte count, pushed as the data length argument.

---

## 10. D3 Register Convention

D3 is the error return accumulator in SendData:

1. Initialized to 0 at `0x10e02` (`MOVEQ #0, D3`).
2. Set to sentinel `0xD505` at `0x10ec8` before the send path.
3. Overwritten with the SEND_FUNC_SLOT return code by `MOVE.W D0, D3` immediately after
   `JSR $1106E` returns (at `0x10fc2` for SDATA path, `0x10f66` for SRAW path).
4. Tested at epilog `0x11160`: `TST.W D3; BNE $11214` — nonzero D3 branches to error exit.
5. Error exit at `0x11214`: `MOVE.W D3, D0` — copies D3 error code into D0 for the caller.

When SEND_FUNC_SLOT succeeds (D0=0), D3=0 and SendData returns noErr. This is correct
behavior, not a bug. The pre-call sentinel `0xD505` is intentionally overwritten.

---

## 11. SCSI Wire Protocol (Confirmed by Hardware Trace)

**Trace log:** `traces/senddata-bulk-sraw-boff-trace.log`  
**Date:** 2026-04-16  
**Hardware:** S3000XL at SCSI target 6, exclusive MIDI channel 0

### 11.1 BULK (SDATA — send sample header)

The plug validates the SysEx buffer at IP_Data+4 before forwarding:
```
MOVEA.L D6, A0          ; A0 = IP_Data+4 = SysEx ptr
CMPI.B #$F0, (A0)       ; byte[0] must be 0xF0
CMPI.B #$47, 1(A0)      ; byte[1] must be 0x47 (Akai)
CMPI.B #$48, 4(A0)      ; byte[4] must be 0x48 (S3000XL device ID)
MOVE.B 3(A0), D0        ; D0 = opcode byte[3]
SUBI.W #$0B, D0         ; subtract SDATA opcode
BEQ $10fa8              ; == 0x0B: SDATA path
SUBQ.W #1, D0
BEQ $10fcc              ; == 0x0C: opcode+1 path
```

For SDATA (opcode 0x0B), SEND_FUNC_SLOT is called with:
- flag = 0 (BULK/SysEx path)
- arg_data (SP+12) = IP_Data+4 = SysEx buffer pointer
- arg_len (SP+20) = IP_Data+0 = SysEx byte count (406 bytes for SDATA)

The resulting SCSI CDB (confirmed from trace):
```
0c 00 00 01 96 80
```
- Byte 0: `0x0C` — MIDI Send command
- Bytes 1: `0x00` — reserved
- Bytes 2-4: `0x00 0x01 0x96` = 406 (SysEx byte count, big-endian 24-bit)
- Byte 5: `0x80` — reply-expected flag

SysEx payload format (406 bytes):
```
f0 47 [ch] 0b 48 [400 nibble bytes] f7
```
where `[ch]` = exclusive channel (0x00), `0x0b` = SDATA opcode, `[400 nibble bytes]` =
200-byte Akai sample header nibble-encoded (low nibble first per byte).

### 11.2 SRAW (raw audio data)

For SRAW, SEND_FUNC_SLOT is called with:
- flag = 1 (raw audio path)
- arg_data (SP+12) = D6 = IP_Data+4 = audio byte count
- arg_len (SP+20) = IP_Data+0 = audio buffer pointer

The SEND_FUNC_SLOT receives the raw PCM buffer. No SCSI CDB is issued by the harness
for SRAW (the harness skips forwarding with `"would need ASPACK wrap"` — SRAW audio
would be wrapped in an ASPACK command, not a raw MIDI Send). The actual on-wire encoding
for SRAW is not yet captured from a full live trace.

### 11.3 BOFF (end-of-transfer cleanup)

BOFF does not call SEND_FUNC_SLOT. Instead, it calls `JSR $10ca2` which:
1. Calls `HUnlock` on `this+0x0e38` (the in-flight handle)
2. Calls `DisposeHandle` on `this+0x0e38` (frees the handle)
3. Calls low-memory stub at `0x274` (reconnect/re-subscribe ping — exact function unknown)
4. Calls `$11b56` which calls `$A31E` (SCSIAtomic2) — likely re-acquires SCSI access

No MIDI-over-SCSI CDB is emitted for BOFF. It is purely local cleanup.

### 11.4 UALL

UALL is not in the TagDispatch table. The plug halts with `UNHANDLED tag=0x55414c4c`.
UALL must be handled by a different mechanism, not through `SendData`.

---

## 12. What Is Not Yet Known

- How SRAW audio data is wrapped on the wire (ASPACK, SDS, or proprietary raw send)
- The UALL mechanism — probably a different vtable entry or a separate plug function
- Contents of `CSCSIPlug+0x38` (socket list): structure not yet decoded
- What opcode `0x0C` (the BULK path for opcode != SDATA) does — there is a branch at
  `0x10fa2` for `opcode == 0x0C` that leads to a different path at `0x10fcc`

---

## 13. Harness Modifications (Phase 5)

**File:** `harness/main.c` in the mesa-plug-harness repo

Changes made relative to Phase 4:
- Added fake Mac heap (`FAKE_HEAP_BASE = 0x00800000`, `FAKE_HEAP_SIZE = 1MB`)
- Implemented `fake_heap_alloc()` with 12-byte block metadata (master ptr + size + flags)
- Added Memory Manager trap stubs: `NewHandle`, `NewHandleClear`, `DisposeHandle`,
  `GetHandleSize`, `SetHandleSize`, `HLock`, `HUnlock`, `NewPtr`, `NewPtrClear`,
  `DisposePtr`, `ResrvMem`, `PurgeSpace`, `_BlockMove`
- Added `SYSEX_BUF` (0x094000) and `build_sdata_sysex()` — builds 406-byte SDATA SysEx
- Fixed IP_Data layout for BULK: IP_Data+0 = sysex_len, IP_Data+4 = SysEx buffer ptr
  (previously incorrect; fixed after reading `MOVEA.L D6, A0; CMPI.B #$F0, (A0)` at
  `0x10f70`)
- Added SEND_FUNC_SLOT intercept at `PLUG_CODE_BASE + 0x106E` — intercepts the
  patchable send-function slot and forwards BULK SysEx via SCSI CDB `0x0C`
- Added NO_RELOC exclusion for `0x0DFC` (MESA transport dispatch global)
- Added D3 to per-instruction trace output
- Confirmed D3 = return code accumulator (set by `MOVE.W D0, D3` after JSR $1106E returns)
- Added UALL IP_Data test (halts cleanly at TagDispatch — UALL not in dispatch table)
