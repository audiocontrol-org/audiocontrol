# SRAW Wire-Bytes Decode

**Binary:** `scsi-plug-rsrc.bin` (12053 bytes, MESA SCSI Plug 2.1.2)  
**Method:** Static decode of scsi-plug-full.asm + vtable data read from binary  
**Date:** 2026-04-16

> **CORRECTION 2026-04-20 — supersedes Sections 2, 8, 9. Per CALIBRATION 2026-04-21 (Codex parity #315 idx 4): the install-edge picture is CANDIDATE-grade, not PROVED. See in order:**
> [`path-a-install-edge.md`](./path-a-install-edge.md) → [`path-a5-socketinfo-construction.md`](./path-a5-socketinfo-construction.md) → [`path-a6-plug-slot-origin.md`](./path-a6-plug-slot-origin.md) → [`path-a7-cons-construction.md`](./path-a7-cons-construction.md)
>
> **Resolved findings:**
>
> 1. **$106e bytes are `60 00 00 f0` = `BRA.W +0xf0` in the binary-as-shipped** (MEASURED). Path A framed this as a "THINK C shared-entry to 0x1160 — no installer needed." That interpretation was **WRONG** and is revised by Path A.9 (2026-04-21): the 0x1160 code is the reply-processing epilogue (tests D3 status and reply_var, dispatches via vtable[+24]) — it does NOT construct or send CDB bytes. If 0x106e were truly just a BRA to 0x1160, SendData would never emit anything on the wire. The actual CDB-building code lives in `CSCSIPlug::SMSendData` at file 0x160c, whose calling convention matches the 7-arg stack frame the SRAW handler assembles at 0x0f4a-0x0f5e (MEASURED, exact match). **Revised reading (CANDIDATE, strong):** 0x106e is a runtime-patchable slot. The 2-byte displacement at 0x1070-0x1071 gets rewritten at load time from `00 f0` (→ 0x1160) to `05 9c`-ish (→ 0x160c = SMSendData). The pre-patch BRA is a defensive placeholder that terminates gracefully if the patch never fires. Patcher identity is **OPEN** (task #35 / Path A.11).
>
> 2. **The editor does NOT install via `SocketInfo[+12]`** (verified across `CMESAEditor::ctor` + 5 PowerPlant sub-ctors). That field stays NULL.
>
> 3. **MEASURED:** the plug `$11fe` indirect call dispatches through `plug_slot[+0]`, populated by the plug's `CMESAPlugIn::ConnectToSocket` handler (scsi-plug file 0x09d2) when invoked with the CONS command (copy loop at scsi-plug 0x0a06 with `20 d9` opcodes copies an incoming `SocketInfo*` arg into the slot).
>
> 4. **MEASURED:** the editor's ctor at file 0x0596e7-0x0596f0 (`LEA $00000212, A0; MOVE.L A0, A2@(0x8c)`) writes EDIT-relative `0x212` (= file 0x028169) into `editor[+0x8c]`.
>
> 5. **CANDIDATE:** that `editor[+0x8c]` field corresponds to `SocketInfo[+0]` (i.e., `editor[+0x74] = embedded CMESASocket; CMESASocket[+24] = SocketInfo[+0]; editor[+0x8c] = editor[+0x74] + 24`). The byte arithmetic is correct; what's not yet measured is a code path that READS `editor[+0x8c]` and PASSES it to the plug. Codex pressure point #315 idx 0/2 flagged this; A.10 (task #34) targets it.
>
> 6. **MEASURED:** the function at file 0x028169 has a clean LINK A6 prologue, embeds the THINK C symbol `\x84main\0` at file 0x028206 after RTS, contains exactly one immediate magic check (`'INIT'` at 0x02817f), and on the non-INIT path dispatches via `vtable[+0xA8]` of a global handle constructed at INIT time via `JSR $0x272A4`. **CANDIDATE** (depends on item 5): that this function is what the plug's `$11fe` call ultimately reaches.
>
> 7. **MEASURED (REPLY direction only):** Path A.8 traced the dispatch chain from `main`'s non-INIT branch through `vtable[+0xA8]` → dispatcher at file 0x0287C5 → 'ADAT' handler at 0x599a7 → `CMESASocket::AcceptData` at file 0x5A1E1 (`_BlockMove` reply bytes into `CMESASocket[+8]`; store 'SRAW'/'SYSX' tag at `[+12]`).
>
> 8. **MEASURED (Path A.9 + A.12 + A.13 + A.14, 2026-04-21/22):** if the live production path reaches `SMSendData`, the OUTBOUND wire format would be:
>    - **CDB:** `0C 00 [len_hi] [len_mid] [len_lo] 80` (MIDI Send; 24-bit BE byte count; byte 5 = 0x80 for mode=0x01, 0x00 for mode=0x00).
>    - **Data:** raw audio bytes, `byte_count` bytes long. No nibble-encoding, no 7-bit encoding, no transformation (A.13 exhaustive negative scan).
>    - **Driver:** old Mac SCSI Manager `_SCSIWrite` trap `$A981` at scsi-plug file 0x224e.
>    - **Mode-byte semantics (A.12):** 6 JSR 0x106e sites; mode=0x01 → CDB[5]=0x80 (SRAW + BULK-via-SCSI fallthrough); mode=0x00 → CDB[5]=0x00 (SYSX/MIDI). BULK handler at 0x0e9e falls into SRAW at 0x0ec0 when `CSCSIPlug+0xe40` SCSI-mode flag is set.
>    - **SMSendData CDB[5] formula MEASURED-deterministic** (A.14): no path from 0x160c entry to 0x1670 CDB-construction nullifies the mode byte. SMDispatchReply (0x139a) is BSR'd at 0x16bc, AFTER the SCSI write at 0x169a — cannot retroactively affect CDB.
>
>    **HOWEVER — combined with hardware (Phase A-D, 2026-04-22):** S3000XL rejects `flag=0x80` for both opcode families tested with sense `03 00 00 00`. flag=0x00 universally accepted. Since SMSendData would emit `flag=0x80` deterministically and MESA II works on hardware, **the strongest current explanation (Codex calibration 2026-04-22) is that the live production path does not reach `SMSendData`**. The wire format above describes the candidate target body's behavior, NOT a proven production wire format.
>
>    **Still OPEN per Codex:** whether some unreproduced state/path condition changes the meaning/acceptability of the same emitted `0x80` form. The state-precondition hypothesis is logically alive — production might reach the same body but in a state where the sampler accepts `0x80`.
>
>    **Hypothesis ranking after A.14 (per Codex framework):** (1) STRONGEST CANDIDATE: production reaches a different target or non-wire-equivalent live path; (2) STILL OPEN: state condition makes the same emitted `0x80` acceptable; (3) our interpretation of the candidate body — refuted by A.14.
>
>    **Next critical-path move:** binary-source hunt (task #35/A.11/B1), now sharpened by A.15 to **acquisition of the MESA system extension binary** specifically (not just any MESA II distribution variant). A.15 found the editor doesn't reference `'PLUG'` literal — strong pointer (per Codex calibration: not proof, but combined with absent CODE/cfrg/PTCH resource types and macbin/rsrc.bin equality, strongest current explanation is external loader). Sources to try: original MESA installer disks, classic Mac System Folder captures, vintage Akai user community.
>
> Sections 8/9 of this doc below are obsolete. Trust the path-a*.md docs (each carries its own calibration banner).

All claims are marked with one of:
- **Measured** — file offset + decoded assembly cited  
- **Inferred** — explicit reasoning noted, needs verification tag applied  
- **Unknown** — decode terminated; described precisely below

---

## Bottom Line

**Outcome B.** Static decode of the SCSI Plug binary is exhausted.

For SRAW, the wire-bytes path terminates at two distinct magic/external sites before any CDB emission is reachable from the binary alone:

1. **SEND_FUNC_SLOT at $1106e** — the `JSR $1106e` in the SRAW handler dispatches to an externally-installed callback. The binary stores only `BRA $1160` at $106e (a do-nothing stub). The real send function is installed by the Sampler Editor at runtime; no installer exists in the SCSI Plug binary.

2. **Indirect call at $11fe** — the $1160 epilogue helper (reached after SEND_FUNC_SLOT returns with a non-null reply pointer) calls through a function pointer read from an in-memory socket slot descriptor. The value of that pointer is installed at runtime by `CMESASocket::ConnectToPlug` from the Sampler Editor side; it is not resolvable from this binary.

---

## 1. SRAW Call Path in SendData (Measured)

**SendData entry:** file 0x0df2. A2 = CSCSIPlug*, A3 = IP_Data*.

Tag dispatch (file 0x0e52, `JSR $148`) routes SRAW to handler at file 0x0ec0.  
**Measured:** `traces/senddata-bulk-sraw-boff-trace.log` line 236: `[TagDispatch] tag='SRAW' (0x53524157) → handler @ 0x00010ec0`

**SRAW handler path (file 0x0ec0 onward):**

```
0ec0: tst.b  A2@(3648)     ; test CSCSIPlug+0xe40 flag — must be non-zero
0ec4: beq    0x11072       ; if zero → branch (different path not decoded here)
0ec8: move.w #$d505, D3    ; D3 = sentinel 0xd505
0ecc: move.l (A3+4), D6    ; D6 = IP_Data[+4] = audio_byte_count
0ed0: bne    0x0f40        ; if D6 != 0 → SRAW path (byte_count nonzero)
```

**Measured (trace line 239-240):** D6 = IP_Data[+4] = 0x100 (256 bytes, nonzero) → branch taken to 0xf40.

At 0x0f40:
```
0f40: cmpi.l  #0x53524157, A3@(8)   ; compare IP_Data[+8] tag with 'SRAW'
0f48: bne     0x0f70                ; if not 'SRAW' → fall through to SysEx validation
```

**Measured (trace line 241-243):** Tag == 'SRAW', branch NOT taken, falls through to `pea %fp@(-30)` at 0xf4a.

**SRAW SEND_FUNC_SLOT args pushed (file 0xf4a-0xf5e):**

| Stack offset from JSR | Value | Source | Meaning |
|-----------------------|-------|--------|---------|
| SP+0 | (return addr) | JSR push | — |
| SP+4 | CSCSIPlug* | `movel A2, -(SP)` @ 0x0f5e | this pointer |
| SP+6 | channel word | `movew A2@(3438), -(SP)` @ 0x0f5a | socket match word (CSCSIPlug+0xd6e) |
| SP+8 | 0x01 | `moveb #1, -(SP)` @ 0x0f56 | flag byte = 1 (SRAW) |
| SP+12 | D6 | `movel D6, -(SP)` @ 0x0f54 | audio byte count |
| SP+16 | A2@(3644) | `movel A2@(3644), -(SP)` @ 0x0f50 | CSCSIPlug+0xe3c (MIDI reply buffer ptr) |
| SP+20 | A3@(0) | `movel (A3), -(SP)` @ 0x0f4e | IP_Data[+0] = audio buffer pointer |
| SP+24 | &fp@(-30) | `pea %fp@(-30)` @ 0x0f4a | pointer to local reply-buffer-ptr var |

**Measured (trace lines 244-251):**
```
[00010f56] move.b #$1, -(A7)     ; flag=1 pushed
[00010f60] jsr $1106e.l
[SEND_FUNC_SLOT @ 0x1106E] this=0x00091000 sock=1 flag=1
  data=0x00000100 misc=0x00093000 len=598016 rptr=0x000fffce
  SRAW audio: 256 bytes at 0x00092000
  (SRAW: skipping actual SCSI send — would need ASPACK wrap)
```

**Measured:** SEND_FUNC_SLOT at $1106e = `braw 0x1160` (binary bytes at file 0x106e: `60 00 00 f0`). This is a do-nothing stub — branches to the epilogue at $1160 immediately.

---

## 2. SEND_FUNC_SLOT ($1106e) — Termination Point 1 (Measured)

**File offset 0x106e:** `60 00 00 f0` = `braw 0x1160` (BRA.W with displacement +0x00f0).  
**Measured:** disassembly line 1365 in scsi-plug-full.asm.

This is a slot, not a function. At runtime, MESA installs a real callback here. The stub `BRA $1160` is the default — executed if nothing is installed, it jumps to SendData's error-check epilogue with D3 still = 0xd505, causing immediate return.

**No installer exists in the SCSI Plug binary.** Grep of all JSR/JMP targets in scsi-plug-full.asm: only 6 references to 0x106e, all are `JSR 0x106e` call sites from within SendData. CSCSIPlug ctor (0xbc6), ChooseSCSI (0x1700), DoMESACommand (0xce4), SMDispatchReply (0x139a) all checked — none writes to offset $106e in the code area.

**The real send function installed at $106e by the Sampler Editor binary is the unresolved wire-bytes path.** Candidate: `CSCSIPlug::SMSendData` (file 0x160c in scsi-plug binary) with matching calling convention — but this is **Inferred** (needs verification). SMSendData signature per mangled name: `SMSendData(short chan, unsigned char flag, unsigned char* data, unsigned char* buf, long len, long* reply_len)` + `this` prepended matches the stack layout above.

---

## 3. $1160 Helper — the Flag Arg and the Two Gate Conditions (Measured)

After SEND_FUNC_SLOT returns, execution reaches $1160 via `bra 0x1160` at file 0x0f6c.

**Measured (trace lines 257-261):**
```
[0001116a] beq $11214   ← TAKEN because fp@(-30) == 0 in harness
```

The two gate conditions at $1160:

```
1160: tst.w  D3          ; Gate 1: was SEND_FUNC_SLOT successful?
1162: bne    0x1214      ; D3 != 0 → exit (error or stub path)
1166: tst.l  %fp@(-30)   ; Gate 2: did SEND_FUNC_SLOT write a reply ptr?
116a: beq    0x1214      ; fp@(-30) == 0 → exit (no reply data)
```

**Gate 1 (D3 sentinel):** D3 was set to 0xd505 before the JSR. If SEND_FUNC_SLOT succeeds, it overwrites D3 (via the `movew D0, D3` at file 0x0f66 after JSR returns, per trace line 203: `D3=00000000`). If the stub `BRA $1160` runs instead, D3 stays 0xd505, gate 1 fires, immediate exit.  
**Measured:** trace line 258 shows D3=0x00000000 after the harness SEND_FUNC_SLOT returns → gate 1 passes.

**Gate 2 (reply pointer):** `fp@(-30)` is the local variable whose address was passed as `rptr` arg to SEND_FUNC_SLOT (`pea %fp@(-30)` at 0xf4a). A real SEND_FUNC_SLOT writes the device's reply buffer address into `*rptr = fp@(-30)`. The harness stub does not write to it → fp@(-30) stays 0 → gate 2 fires, immediate exit.  
**Measured:** trace line 261: `beq $11214 ← TAKEN` (fp@(-30) == 0 in harness).

**The flag byte (0x01 for SRAW, 0x00 for BULK):** pushed at file 0x0f56. This flag is consumed by SEND_FUNC_SLOT — it is NOT read anywhere in the $1160 helper body (verified: no stack read of the flag-byte position in $1160–$1214). The flag's only effect is inside the installed SEND_FUNC_SLOT itself, which is external to this binary.

---

## 4. Class Identity at $1172 — vtable[0x18] Dispatch (Measured)

When both gates pass (fp@(-30) != 0), execution reaches $116e–$1178:

```
116e: movel  A2, -(SP)        ; A2 = CSCSIPlug* this (set at SendData prologue 0x0dfa)
1170: moveal (SP), A0          ; A0 = CSCSIPlug*
1172: moveal A0@, A1           ; A1 = *(CSCSIPlug*) = vtable ptr — read from offset +0
1174: moveal A1@(24), A1       ; A1 = vtable[0x18] = vtable entry at byte offset 24
1178: jsr    A1@
```

**Class identity:** `moveal A0@, A1` at $1172 reads vtable from offset +0. A2 = CSCSIPlug*, established at 0x0dfa (`moveal fp@(8), A2`). CSCSIPlug ctor (file 0xbc6) stores vtable at `A2+0` (`movel A0, A2@` at 0xbea). Convention is +0. The object is **CSCSIPlug**, not CMESASocket. **Measured.**

**vtable[0x18] = code offset 0x5fa (Measured).** Binary data at A4+316+24 = file offset 0x2ca6:
```
file 0x2ca6: 00 00 05 fa
```
Both CSCSIPlug vtable (A4+316) and CMESAPlugIn vtable (A4+410) have vtable[0x18] = 0x5fa — **Measured** from binary read. This means vtable[0x18] is not overridden in CSCSIPlug; it is inherited from CMESAPlugIn.

**vtable[0x18] target at code offset 0x5fa:**
```
5fa: bras 0x640    ; jump to loop-test-first (do-while pattern)
```
This is an entry point within the function body that begins at 0x5d6 (`moveml %d5-%d6, %sp@-`). The 0x5fa entry shares an epilogue with the 0x5d6 entry — they have the same `moveml %sp@+, %d5-%d6; rts` at 0x644–0x64a. The 0x5fa entry is a shared-loop-body entry, a legitimate THINK C optimization pattern. **Measured** from binary decode; the semantics of this function are not yet decoded.

---

## 5. $1160 Helper Loop Body — Termination Point 2 (Measured)

After vtable[0x18] returns (A0 = return value = socket list ptr, D7 = 0), execution branches to the loop at $1186–$1210:

```
117a: movel  A0, fp@(-42)     ; save vtable[0x18] return value (socket list)
117e: moveq  #0, D7           ; D7 = loop counter
1180: addqw  #4, SP           ; pop CSCSIPlug* pushed at 116e
1182: bra    0x1208           ; → loop condition
```

**Loop (file 0x1186–0x1214):**
```
1208: moveal fp@(-42), A0     ; A0 = socket list ptr
120c: moveaw D7, A1           ; A1 = counter
120e: cmpal  A0@, A1          ; compare *(socket_list) = count with counter
1210: blt    0x1186           ; loop while D7 < list_count
```

**Loop body (per iteration):**
```
1186: moveq  #46, D0
1188: mulsw  D7, D0           ; D0 = 46 * D7 (slot stride)
118a: moveal fp@(-42), A0
118e: addal  D0, A0           ; A0 += stride
1190: addql  #4, A0           ; skip first 4 bytes of slot entry
1192: movel  A0, D5           ; D5 = slot entry base (for later use)
1196: tstw   A0@(36)          ; test slot[+36] (word, "active" flag)
119a: beq    0x1206           ; if 0: skip to next entry
; build reply IP_Data struct in stack locals ...
11b8: moveal A2@(3644), A0    ; A0 = MIDI reply buffer ptr (CSCSIPlug+0xe3c)
11bc: cmpib  #0xf0, A0@       ; is reply[0] == 0xF0 (SysEx)?
11c0: bne    0x11cc           ; no → SRAW tag
11c2: movel  #'SYSX', fp@(-34) ; SysEx reply path
11ca: bra    0x11d4
11cc: movel  #'SRAW', fp@(-34) ; Non-SysEx reply path
; build IP_Data struct with tag at fp@(-8) ...
11f0: moveal D5, A0            ; A0 = slot entry
11f2: tstl   A0@               ; test slot[+0] = function pointer
11f4: beq    0x1202            ; if null: skip call
11f6: pea    fp@(-26)          ; push ptr to local IP_Data struct
11fa: moveal D5, A0
11fc: moveal A0@, A0           ; A0 = *(slot_entry) = function pointer at slot[+0]
11fe: jsr    A0@               ← TERMINATION POINT 2
```

**Measured: file 0x11fe** = `4e90` = `jsr A0@`. A0 = *(D5) = function pointer from slot[+0] of the socket list entry returned by vtable[0x18]. This function pointer is installed at runtime during `CMESASocket::ConnectToPlug` (Sampler Editor, file 0x059e4b). Its value is not resolvable from the SCSI Plug binary.

**What the call passes:** `pea %fp@(-26)` pushes a pointer to a local IP_Data-shaped struct at fp@(-26). The struct contains:
- fp@(-16): reply buffer pointer (= fp@(-30), the device reply data from SEND_FUNC_SLOT)
- fp@(-12): MIDI reply buffer ptr (CSCSIPlug+0xe3c)
- fp@(-8): tag = 'SYSX' if reply[0]==0xF0, else 'SRAW'  
- Template bytes copied from A4@(384) and A4@(394)

**Measured:** tag selection at $11bc–$11cc. For a SRAW response (audio acknowledgment from device), the reply buffer would NOT start with 0xF0, so tag = 'SRAW'. For a SysEx acknowledgment, tag = 'SYSX'. **This is the plug receiving and dispatching the device's reply**, not emitting a new send.

After the call at $11fe:
```
1200: addqw  #4, SP
1202: movew  fp@(-22), D3      ; D3 = return code from slot fn
1206: addqw  #1, D7            ; D7++
```

This pattern is identical to the SEND_FUNC_SLOT: a slot function receives an IP_Data-tagged message and routes it to the socket's listener. The chain continues into the Sampler Editor via the slot function pointer.

---

## 6. BULK vs. SRAW in the $1160 Helper (Measured)

The flag byte (0x00 for BULK, 0x01 for SRAW) is consumed entirely within SEND_FUNC_SLOT and is not read anywhere in $1160–$1214. **Measured:** no instruction in $1160–$1214 reads from the stack position corresponding to the flag byte argument. The $1160 helper is not flag-sensitive.

The only BULK/SRAW difference in the $1160 helper is at $11bc: tag selection based on whether the device reply starts with 0xF0. BULK (SDATA) replies with SysEx → tag = 'SYSX'. SRAW device acknowledgments (if any) would be non-SysEx → tag = 'SRAW'. **Inferred** — needs verification against actual device reply bytes.

---

## 7. Wire Emission Points in the Binary

The SCSI Plug binary contains two known paths that call `SCSIDispatch` ($A089):

| File offset | Path | Description |
|-------------|------|-------------|
| 0x1cd8 | CSCSIUtils::SCSICommand | Primary SCSI bus dispatch |
| 0x1eec | Inquiry? | Via separate a089 call site |
| 0x1f4a | WaitUntilReady? | Via separate a089 call site |

`CSCSIUtils::SCSICommand` (file 0x1bbe) builds a SCSI parameter block with CDB bytes at A2@(44..49), sets direction flag (READ/WRITE/CONTROL via D6), sets data pointer and length, then issues `SCSIDispatch` with D0=1 (selector 1 = SCSI atomic). **Measured** from disassembly at 0x1c44–0x1cd8.

`SMSendData` (file 0x160c) calls `SMDataByteEnquiry` (file 0x12f2) and is called from `SMDispatchReply` (file 0x139a). These are the MIDI-over-SCSI send/receive primitives. `SMSendData` calls `JSR 0x1620` (mid-function entry into SMSendData itself) and `JSR 0x187e` (mid-function entry into ChooseSCSI). **Inferred**: the mid-entry pattern means these functions share code paths; `JSR 0x1620` is a shared loop body, not a separate function. Needs verification.

**The path from SRAW → SCSICommand is not traceable in this binary** because it crosses the SEND_FUNC_SLOT boundary ($1106e) which is externally populated.

---

## 8. What Is Known vs. Unknown

### Known (Measured)

1. SRAW pushes 7 args to SEND_FUNC_SLOT: `(this, channel, flag=1, byte_count, midi_reply_ptr, audio_buf_ptr, &reply_ptr)`
2. BULK pushes same shape with `flag=0` and `(byte_count=sysex_len, midi_reply_ptr, sysex_buf_ptr, &reply_ptr)`
3. The SEND_FUNC_SLOT at $1106e contains `BRA $1160` — a do-nothing stub in the binary
4. No installer for $1106e exists anywhere in the SCSI Plug binary
5. After SEND_FUNC_SLOT, flag=1 has no effect on $1160 behavior — flag is not read there
6. The $1160 epilogue processes device reply data via vtable[0x18] on CSCSIPlug (not CMESASocket)
7. vtable[0x18] = code offset 0x5fa in the SCSI Plug binary (shared between CSCSIPlug and CMESAPlugIn)
8. After vtable[0x18], a second indirect call at $11fe goes through a runtime-installed socket slot function pointer

### Unknown (Decode Terminated)

1. **What function the Sampler Editor installs at $1106e at runtime.** This is the send-function; it almost certainly calls `SMSendData` or an ASPACK wrapper, but this is Inferred, not Measured.
2. **What vtable[0x18] at 0x5fa actually does.** The function entry at 0x5fa is a shared loop body within what appears to be a relocation/list-walk function. Its semantics are not decoded.
3. **What function pointer is at slot[+0] in the socket list entry.** Installed at runtime by CMESASocket::ConnectToPlug from the Sampler Editor side.
4. **The actual CDB format for SRAW audio data.** Cannot determine without tracing the SEND_FUNC_SLOT installer.

---

## 9. Next Move After This Decode

Static decode of the SCSI Plug binary is exhausted for the SRAW wire-bytes question. Both termination points ($1106e and $11fe) are runtime-installed function pointers from the Sampler Editor.

Two paths remain:

**Path A — Find the $1106e installer in the Sampler Editor binary.** Search `sampler-editor-rsrc.bin` for code that computes the address of $1106e in the loaded SCSI Plug resource and writes a function pointer there. Likely candidates: `CMESASocket::SelectPlug` (file 0x05a053) or SCSI initialization code. If found, the installed function decodes to CDB opcodes and the question is answered.

**Path B — Extend the harness to install a real send function at $1106e.** Implement `SMSendData` in `main.c` at the intercept point, forwarding SRAW audio via ASPACK CDB (opcode 0x0D) or raw MIDI Send CDB (opcode 0x0C) to the real S3000XL and observing the device response. This is the hardware-verification path from decision record 2026-04-18.
