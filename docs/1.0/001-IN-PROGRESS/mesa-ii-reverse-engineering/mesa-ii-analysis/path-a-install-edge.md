# Path A: SRAW Send-Function Install Edge

**Binary pair:** `sampler-editor-rsrc.bin` + `scsi-plug-rsrc.bin`  
**Method:** Static decode of both binaries; no harness execution  
**Date:** 2026-04-20  
**Prior doc corrected:** `sraw-decoded.md` sections 2 and 9  
**Follow-ups:** see in order — [`path-a5-socketinfo-construction.md`](./path-a5-socketinfo-construction.md), [`path-a6-plug-slot-origin.md`](./path-a6-plug-slot-origin.md), [`path-a7-cons-construction.md`](./path-a7-cons-construction.md), [`path-a8-sraw-handler.md`](./path-a8-sraw-handler.md).

> **CALIBRATION 2026-04-21 (per Codex parity #315 idx 4):** This doc's $106e finding (THINK C shared-entry) is **MEASURED** and stands. The frame about the slot fn_ptr at $11fe being installed via "the editor's CONS payload" is **CANDIDATE** until A.10 settles the editor-side packing/transmission step. Trust the byte-level decodes; treat install-edge identity claims that propagate from this doc as candidate-grade.

All claims are marked with one of:
- **Measured** — file offset + decoded assembly cited
- **Inferred** — explicit reasoning noted
- **Unknown** — decode terminated; described precisely

---

## Bottom Line

**Outcome B — chain terminates at binary boundary, with a correction to sraw-decoded.md.**

**Correction to sraw-decoded.md section 2:** The prior analysis described file 0x106e in `scsi-plug-rsrc.bin` as "a slot, not a function" where "the Sampler Editor installs a real callback here at runtime." This is incorrect. File 0x106e falls within `CSCSIPlug::SendData` (range 0x0df2–0x121c). The bytes `60 00 00 f0` at 0x106e are a native `BRA.W +0xf0` — a THINK C shared-entry optimization, not a patchable callback slot. No external installer exists or is needed.

**Termination point 1 revised:** The first termination point is dissolved. `JSR 0x106e` is a call to a mid-function shared-epilogue entry within `CSCSIPlug::SendData` itself. This is static native code. No installer is called; no function pointer is written anywhere in the binary or by the sampler editor.

**Termination point 2 confirmed:** The second termination point from `sraw-decoded.md` stands. The indirect call at scsi-plug file `0x11fe` (`jsr A0@`, A0 = slot[+0] fn_ptr) goes through a runtime-installed function pointer that originates in the sampler editor. The install path for that pointer is `CMESASocket::ConnectToPlug` at sampler-editor file `0x059f59`. That descriptor fn_ptr is the actual binary boundary for Path A. Its value is not resolvable from either static binary.

---

## 1. THINK C Shared-Entry Pattern at scsi-plug 0x106e (Measured)

`CSCSIPlug::SendData` spans file offsets `0x0df2–0x121c` (1066 bytes). **Measured:** `4e56 ffbc` at 0x0df2 (LINK with frame size), `4e5e 4e75` at 0x121a–0x121c (UNLK + RTS).

File offset `0x106e` falls within this range. **Measured:** `0x0df2 <= 0x106e <= 0x121c`.

Bytes at 0x106e: `60 00 00 f0` = `BRA.W +0x00f0` → jumps to 0x1160 (the reply-processing epilogue, also within `SendData`). **Measured.**

Bytes at 0x106a: `36 3c d5 05` = `movew #-11003, D3` (error sentinel, D3 = 0xd505). **Measured.**

Four call sites within `SendData` use `JSR 0x106e`:

| Call site (file) | Path context |
|-----------------|--------------|
| 0x0f60 | SRAW audio send path |
| 0x0fbc | SDATA/SysEx send path |
| 0x102c | third send path |
| 0x10b2 | fourth send path |

All four are `4e b9 00 00 10 6e`. **Measured.**

**Pattern:** JSR 0x106e pushes a return address, then the BRA at 0x106e falls through to the epilogue at 0x1160. The RTS at 0x121c pops the JSR-pushed return address. This is a THINK C shared-entry optimization: multiple callers jump into the same epilogue body; the JSR return address is the mechanism for per-caller resume. **Inferred** from instruction sequence; the pattern is standard THINK C.

**Implication:** There is no patchable slot at 0x106e. The code at 0x106e is native and immutable. `sraw-decoded.md` section 2's claim that "MESA installs a real callback here" is incorrect.

---

## 2. No Installer Found in Either Binary (Measured)

A store targeting scsi-plug code address 0x106e would be a 32-bit absolute store (`movel`, `movew`, or `moveb`) with the destination address encoding `0x106e` relative to the plug's loaded segment base.

Search of all instruction encodings in `scsi-plug-rsrc.bin` for writes to that offset: none found. **Measured** (exhaustive grep of JSR/JMP targets and store destinations in scsi-plug-full.asm; no target matches 0x106e except the four intra-function call sites).

Search of `sampler-editor-rsrc.bin` for any store into a region that could encode scsi-plug code address 0x106e: none found at the candidate sites:

- `CMESASocket::ConnectToPlug` (sampler-editor file 0x059e4b) — copies SocketInfo descriptor bytes into slot array, does not write to external memory. **Measured** (see section 3).
- `CMESASocket::SelectPlug` (sampler-editor file 0x05a053) — writes only a slot index word into `this[2474]`, does not write to external memory. **Measured** (see section 4).
- `CMESASocket::SendData` (sampler-editor file 0x05a133) — reads slot fn_ptr and calls it via `jsr A0@`, no external writes. **Measured** (see section 5).
- `CSCSIPlug::SetMESAProc` (scsi-plug file 0x0856) — stores editor callback into `this[4]` of CMESAPlugIn, not a code address. **Measured:** decoded inline as `moveal fp@(8), A0; movel fp@(12), A0@(4); unlk; rts`.
- `CSCSIPlug::Open` (file 0x0d8e), `Close` (file 0x0dac), `DoAboutToQuit` (file 0x0dca) — all decode to `LINK A6, #0; UNLK; RTS`. Pure no-ops. **Measured.**

---

## 3. CMESASocket::ConnectToPlug — Descriptor Copy (Measured)

**Sampler-editor file:** 0x059e4b–0x05a019.

`ConnectToPlug` copies a `SocketInfo` descriptor (46 bytes) from the editor's socket info struct into the plug's internal slot array. The copy loop starting at sampler-editor file `0x059f59`:

```
059f59: movel %a1@+, %a0@+    ; copies SocketInfo bytes including fn_ptr at descriptor[+12]
... (11x movel, 1x movew — 46 bytes total)
```

The fn_ptr at descriptor[+12] is stored into slot[+8] of the plug's slot array. **Measured.**

This fn_ptr originates from the sampler editor's own code. Its value is passed into `ConnectToPlug` via `SocketInfo*` — constructed by the editor before calling. The editor-side value is not resolvable from either binary without tracing the `SocketInfo` constructor or the editor's initialization code. **Unknown.**

**Class identity:** A0 = plug object; its vtable is read at A0@(0) during `ConnectToPlug` at 0x059eda (`moveal A0@, A1`) and dispatch proceeds through `vtable[+12]` = `ConnectToSocket`. CSCSIPlug vtable is at object+0 (ctor at scsi-plug 0x0bc6 confirmed: `movel A0, A2@`). **Measured.**

During `ConnectToPlug`, the fn_ptr at descriptor[+12] is also called directly (sampler-editor 0x059f1f: `jsr A0@`) as a connection-verify step before storing. **Measured.**

---

## 4. CMESASocket::SelectPlug — Does Not Install (Measured)

**Sampler-editor file:** 0x05a053–0x05a085.

SelectPlug scans the slot array comparing `this[0x4e + 48*idx]` (slot[+4]) with the plug_id argument. On match:

```
05a06f: movew %d1, %a1@(2474)   ; writes matched slot index to this[2474] (0x09aa)
```

That is the only store. SelectPlug writes one word into `this->selected_slot_index`. It does not write to the plug's memory, does not write a function pointer anywhere, and does not patch scsi-plug code. **Measured.**

---

## 5. CMESASocket::SendData — Does Not Install (Measured)

**Sampler-editor file:** 0x05a133–0x05a1bd.

```
05a195: mulsw  %a2@(2474), %d0   ; D0 = selected_slot_index * 48
05a199: tstl   %a2@(52,%d0:l)    ; test slot fn_ptr at this[82 + 48*idx]
05a1ab: moveal %a2@(52,%d0:l), %a0  ; load slot fn_ptr
05a1af: jsr    %a0@              ; call slot fn_ptr
```

SendData reads the fn_ptr installed by `ConnectToPlug` and calls it. No external stores. **Measured.**

The slot fn_ptr at `this[82 + 48*idx]` (`this[0x52 + 0x30*idx]`) is the editor-side socket callback — the function that receives replies dispatched from the scsi-plug via the `0x11fe` indirect call. **Inferred** (consistent with the reply-dispatch role described in `sraw-decoded.md` section 5).

---

## 6. scsi-plug: No SMSendData at 0x106e Arg-Alignment Check (Measured)

`sraw-decoded.md` section 9 proposed `CSCSIPlug::SMSendData` (scsi-plug file 0x160c) as the candidate installed at 0x106e. The arg layout check refutes this.

Args pushed before `JSR 0x106e` (SRAW path, file 0x0f4a–0x0f5e):

| sp offset | value |
|-----------|-------|
| sp+4 | CSCSIPlug* this |
| sp+6 | channel word (movew) |
| sp+8 | flag byte 0x01 (moveb) |
| sp+12 | D6 = audio byte count |
| sp+16 | A2@(3644) = MIDI reply buf ptr |
| sp+20 | A3@(0) = audio buf ptr |
| sp+24 | &fp@(-30) = reply ptr var |

`SMSendData` signature (mangled: `CSCSIPlugFsUcPUcPUclPl`):

```
fp@(8)  = this
fp@(12) = short chan
fp@(16) = unsigned char flag (moveb alignment; actual stack position after any padding)
fp@(24) = D7 (read at 0x160c init)
fp@(28) = A3 (read at 0x160c init)
```

**Measured** (from SMSendData prologue at scsi-plug 0x160c: reads fp@(24) into D7 and fp@(28) into A3).

The audio buf ptr is at sp+20 from JSR 0x106e (= fp@(28) relative to the shared-entry frame). The SMSendData `A3` arg (fp@(28)) would match that position. However the reply ptr `&fp@(-30)` at sp+24 (= fp@(32)) has no correspondent in SMSendData's declared signature. SMSendData also does not take a MIDI reply buf ptr as a separate argument. The arg layouts are incompatible without a wrapper. **Measured** (from both SMSendData prologue reads and the JSR push sequence).

Conclusion: `SMSendData` is NOT called directly via the shared-entry at 0x106e. The shared-entry pattern does not represent an externally installed function at all. **Measured.**

---

## 7. Call Graph Summary

```
sampler-editor-rsrc.bin                     scsi-plug-rsrc.bin
─────────────────────────────               ────────────────────────────────────
CMESASocket::ConnectToPlug                  CSCSIPlug::ConnectToSocket
  file 0x059e4b                               file 0x0009d2
  SocketInfo[+12] fn_ptr copied         →    stored into plug slot array [+12]
  into CMESASocket slot[+8]
  via loop at 0x059f59
                                         ↓
                                         CSCSIPlug::SendData
                                           file 0x0df2
                                           SRAW path: JSR 0x106e (file 0x0f60)
                                           → 0x106e = BRA.W to 0x1160 [THINK C shared-entry]
                                           → epilogue at 0x1160
                                           → vtable[0x18] call at 0x1178 (CSCSIPlug)
                                           → socket list loop: JSR A0@ at 0x11fe
                                             A0 = slot[+0] fn_ptr
                                             ← installed by ConnectToPlug
                                             ← value unknown [BINARY BOUNDARY]
```

**Termination:** scsi-plug file 0x11fe, `jsr A0@`. A0 = slot[+0] function pointer installed at runtime via `CMESASocket::ConnectToPlug` (sampler-editor 0x059f59). The pointer value is not present in either binary. **Unknown.**

---

## 8. What Is Known vs. Unknown

### Known (Measured)

1. scsi-plug file 0x106e is a mid-function `BRA.W +0xf0` native instruction within `CSCSIPlug::SendData`. It is not a patchable callback slot.
2. No store targeting scsi-plug code address 0x106e exists in either binary.
3. `CMESASocket::SelectPlug` (sampler-editor 0x05a053) writes only the selected slot index, not a function pointer.
4. `CMESASocket::SendData` (sampler-editor 0x05a133) reads a fn_ptr from slot[+8] and calls it — no external writes.
5. `CSCSIPlug::Open`, `Close`, `DoAboutToQuit` are no-ops; none installs anything.
6. `SetMESAProc` stores an editor callback into `CMESAPlugIn::this[4]`, not a code-area address.
7. `CSCSIPlug::SendData` arg layout at `JSR 0x106e` is incompatible with `SMSendData`'s declared signature.
8. The fn_ptr at `CMESASocket::slot[+8]` (= scsi-plug slot[+0] after `ConnectToSocket` stores it) is installed at sampler-editor 0x059f59 by descriptor copy from `SocketInfo[+12]`.

### Corrections to sraw-decoded.md

| Location | Prior claim | Correct finding |
|----------|-------------|-----------------|
| Section 2, heading | "SEND_FUNC_SLOT ($1106e) — Termination Point 1" | Not a termination point; 0x106e is native code within SendData |
| Section 2, para 2 | "This is a slot, not a function. At runtime, MESA installs a real callback here." | False. This is a THINK C shared-entry BRA, not a slot. No installer exists. |
| Section 2, para 3 | "The real send function installed at $106e by the Sampler Editor binary is the unresolved wire-bytes path." | No such installer exists in either binary. The wire-bytes path remains unresolved but for a different reason. |
| Section 9, Path A | "Search sampler-editor-rsrc.bin for code that... writes a function pointer there. Likely candidates: CMESASocket::SelectPlug" | SelectPlug does not write function pointers. ConnectToPlug copies them into the plug's slot array, not into code memory. |

### Unknowns (Decode Terminated)

1. **The value of `SocketInfo[+12]` fn_ptr.** This is the function the editor registers with the plug as a socket callback. Its address is determined at the editor's startup/init path when `SocketInfo` is constructed, which is not decoded.
2. **What `vtable[0x18]` at code offset 0x5fa actually returns.** Decoded as a shared loop-body entry; semantics not yet traced.
3. **The actual wire-bytes path from SRAW audio to CDB emission.** Both termination points (`sraw-decoded.md` section 8 items 1 and 3) remain unresolved; item 1's description (0x106e as an installed callback) was wrong but the underlying wire-bytes path is still not traced.
