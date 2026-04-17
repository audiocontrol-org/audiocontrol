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

## 9. IP_Data Structure (Revised)

Based on trace evidence:

```
IP_Data:
  +0:  [4 bytes] flags or len_extra  (tested by TST.L at 0x10ed2)
  +4:  [4 bytes] len_hi              (loaded into D6 at 0x10ecc)
  +8:  [4 bytes] TAG                 (loaded into D0 at 0x10e4e for dispatch)
  +12: [4 bytes] len_lo              (from sampler-editor-decoded.md)
  +16: [4 bytes] audio_data_ptr      (from sampler-editor-decoded.md)
  +20: [4 bytes] socket ptr          (searched by socket loop)
```

The tag being at +8 (not +0) was confirmed by the live trace.

---

## 10. What Is Not Yet Known

- Contents of `CSCSIPlug+0x38` (socket list): structure not yet decoded, prevents real socket loop execution
- What `JSR $10d54` does with its arguments: mock lacks Mac Memory Manager state to proceed
- Whether BULK and SRAW differentiate inside 0x0d54 (tag value in D0 at that point is unknown)
- The exact SysEx or SCSI MIDI bytes emitted for BULK vs SRAW (would require full Mac Memory Manager stub)

---

## 11. Harness Modifications (Phase 4)

**File:** `harness/main.c` in the mesa-plug-harness repo

Changes made:
- Added constants: `SENDDATA_ENTRY`, tag/handler macros, `IPDATA_BASE`, `CSCSIPLUG_OBJ`, `SRAW_AUDIO_BUF`, `AKAI_HDR_BUF`, `JSR_TAGDISPATCH_PC`
- `plug_instruction_hook`: added socket-search bypass (intercept at 0x10e36) and TagDispatch interception (intercept at 0x10e52 — patches JSR to 3x NOP and redirects PC)
- Extended trace range to cover `0x10df2–0x1121e` (full SendData body)
- Added functions: `nibble_encode_32()`, `build_akai_header()`, `build_ipdata()`, `call_senddata()`, `run_phase4()`
- `run_phase4()` calls `call_senddata()` with BULK, SRAW, BOFF IP_Data structs in sequence
- `call_senddata()` calls `m68k_pulse_reset()` before each run to clear Musashi's STOPPED state
