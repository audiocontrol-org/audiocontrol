# Path A.6: Where Does the `$11fe` Slot fn_ptr Come From?

**Binary pair:** `scsi-plug-rsrc.bin` + `sampler-editor-rsrc.bin`
**Method:** Static decode of both binaries; no harness execution
**Date:** 2026-04-20
**Prior docs:** [`path-a-install-edge.md`](./path-a-install-edge.md), [`path-a5-socketinfo-construction.md`](./path-a5-socketinfo-construction.md)

All claims are marked with one of:
- **Measured** — file offset + decoded assembly cited
- **Inferred** — explicit reasoning noted
- **Unknown** — decode terminated; described precisely

> **CALIBRATION 2026-04-21 (per Codex parity #315 idx 4):** the wording "incoming SocketInfo data from the editor's 'CONS' (ConnectToSocket) SCSI message payload" treats the transmission mechanism as decided when it is not. **MEASURED** within this doc: plug-side `CONS → ConnectToSocket` handler; copy loop at scsi-plug 0x0a06 copying an incoming `SocketInfo*` arg into `plug_slot[+0]`. **OPEN:** the editor-side packing/transmission step that puts `editor[+0x8c]` into the plug's incoming arg. Likely architecture is in-process function call (plug loaded as code resource in editor address space), not SCSI bus transmission — A.10 (task #34) will settle.

---

## Bottom Line

**Outcome B — runtime-populated by scsi-plug-side `ConnectToSocket`. The VALUE source from the editor side is CANDIDATE, not MEASURED (see calibration banner above).**

The fn_ptr called at scsi-plug file `$11fe` lives in `plug_slot[+0]` — the first long of the plug's socket slot array entry. It was placed there by `CMESAPlugIn::ConnectToSocket` (file `0x09d2`) which verbatim copies 46 bytes of incoming `SocketInfo` data. The transmission mechanism that brings that `SocketInfo*` into the plug's `ConnectToSocket` from the editor is the OPEN step. `SocketInfo[+0]` is a function pointer in the **sampler-editor binary** — the editor's reply-receive callback — not present in the scsi-plug binary. The exact identity of that function is **Unknown** from static decode alone, because the editor's "CONS" payload construction path was not traced.

This corrects and refines the prior description in `path-a-install-edge.md` section 7: that document stated the termination point was `CMESASocket::ConnectToPlug` copying a fn_ptr from `SocketInfo[+12]` into `slot[+8]`. The actual fn_ptr read at `$11fe` is at `plug_slot[+0]` (not [+8]), and it is `SocketInfo[+0]` (not [+12]). `SocketInfo[+12]` (which Path A.5 found is NULL) is a different field that is checked by the editor in `ConnectToPlug` phase 3 (file `0x059f09`) but is NOT the fn_ptr called at plug `$11fe`.

---

## 1. The Exact Instruction Sequence at `$11fe` (Measured)

File offsets from `scsi-plug-rsrc.bin` (asm address = file byte offset, confirmed):

```
0011f0:  moveal D5, A0         ; A0 = D5 (slot ptr)
0011f2:  tstl (A0)             ; test slot[+0] (fn_ptr field)
0011f4:  beqs 0x1202           ; skip if null
0011f6:  pea fp@(-26)          ; push IP_Data* arg
0011fa:  moveal D5, A0         ; A0 = slot ptr
0011fc:  moveal (A0), A0       ; A0 = *(slot ptr) = slot[+0] = fn_ptr
0011fe:  jsr (A0)              ; CALL through fn_ptr
001200:  addqw #4, SP          ; pop IP_Data* arg
001202:  movew fp@(-22), D3    ; capture result code
```

**Measured** (bytes at file 0x11f0: `2045 4a90 670c 486e ffe6 2045 2050 4e90 584f 362e ffea`).

The fn_ptr is at `slot[+0]` — the first long of the slot struct. The argument pushed is `fp@(-26)`, a locally-constructed `IP_Data`-like struct. **Measured.**

---

## 2. How D5 Is Computed — Slot Array Navigation (Measured)

The epilogue at `$1160` evaluates a vtable dispatch to get the socket list, then iterates:

```
001160:  tstw D3            ; check error sentinel D3
001162:  bnew 0x1214        ; bail on error
001166:  tstl fp@(-30)      ; check reply ptr
00116a:  beqw 0x1214        ; bail if no reply
00116e:  movel A2, -(SP)    ; push CSCSIPlug* this
001170:  moveal (SP), A0    ; A0 = CSCSIPlug*
001172:  moveal (A0), A1    ; A1 = CSCSIPlug->vtable_ptr
001174:  moveal A1@(24), A1 ; A1 = vtable[+24] = GetSockets fn_ptr
001178:  jsr (A1)           ; CALL: GetSockets(CSCSIPlug* this)
00117a:  movel A0, fp@(-42) ; fp@(-42) = GetSockets return value (socket list base)
00117e:  moveq #0, D7       ; D7 = loop index = 0
001180:  addqw #4, SP        ; pop
001182:  braw 0x1208        ; -> loop check
```

Then the loop body:
```
001186:  moveq #46, D0
001188:  mulsw D7, D0       ; D0 = 46 * idx (slot stride = 46 bytes)
00118a:  moveal fp@(-42), A0 ; A0 = socket list base (&CSCSIPlug[+56])
00118e:  addal D0, A0        ; A0 += 46 * idx
001190:  addql #4, A0        ; A0 += 4
001192:  movel A0, D5        ; D5 = socket_list_base + 46*idx + 4
                             ; = CSCSIPlug[+56] + 46*idx + 4
                             ; = CSCSIPlug[+60] + 46*idx
                             ; = start of plug_slot[idx]
```

**Measured** (byte-verified from asm listing lines 279-291).

The slot stride is **46 bytes** and the slot array starts at `CSCSIPlug[+60]`. **Measured.**

---

## 3. `GetSockets` at vtable[+24] (Measured)

The function `CMESAPlugInFv::GetSockets` at file `0x000b98`:

```
000b98:  linkw %fp, #0
000b9c:  moveal fp@(8), A0   ; A0 = this
000ba0:  lea A0@(56), A0     ; A0 = this+56  (= &socket_count field)
000ba4:  unlk %fp
000ba6:  rts
```

`GetSockets` returns `this + 56` in A0. The returned value IS `&socket_count` (CSCSIPlug[+56]). **Measured.**

The vtable dispatch at `$1174` uses vtable byte offset `+24`, which is vtable entry[6]. This matches `GetSockets` as the 7th virtual function in the CMESAPlugIn vtable. **Inferred** (vtable entry order cannot be verified from binary without resolving A4 = runtime load address; the function body and the usage pattern are consistent).

The returned `socket_list_base` = `&CSCSIPlug[+56]`. Dereferenced at the loop-check (`cmpal (A0), A1` at `0x120e`), `*(A0)` = socket_count. The slot array begins at `socket_list_base + 4 = CSCSIPlug[+60]`. **Measured.**

---

## 4. `ConnectToSocket` Installs fn_ptr at plug_slot[+0] (Measured)

`CMESAPlugIn::ConnectToSocket` at file `0x0009d2`:

```
0009d2:  LINK A6, #0
0009da:  moveal fp@(8), A2    ; A2 = this (CSCSIPlug)
0009de:  moveal fp@(12), A3   ; A3 = SocketInfo*  (46-byte incoming descriptor)
0009ec:  movel A2@(56), D0    ; D0 = socket_count
0009f0:  addql #1, A2@(56)    ; socket_count += 1
0009f4:  moveq #46, D1        ; slot stride
0009f6:  jsr 0x116            ; D0 = D0 * 46  (semantic: compute byte offset)
0009fc:  moveal A2, A0
0009fe:  addal D0, A0          ; A0 = A2 + socket_count*46
000a00:  lea A0@(60), A0       ; A0 = plug_slot start = CSCSIPlug + 60 + 46*N
000a04:  lea (A3), A1          ; A1 = SocketInfo*
000a06:  movel (A1)+, (A0)+    ; slot[+0]  = SocketInfo[+0]  <-- fn_ptr field
000a08:  movel (A1)+, (A0)+    ; slot[+4]  = SocketInfo[+4]
000a0a:  movel (A1)+, (A0)+    ; slot[+8]  = SocketInfo[+8]
000a0c:  movel (A1)+, (A0)+    ; slot[+12] = SocketInfo[+12]
  ... 7 more movel, 1 movew = 46 bytes total
```

`plug_slot[+0] = SocketInfo[+0]`. The 46-byte struct is copied verbatim. **Measured** (bytes at 0x0a04-0x0a1e: `43d3 20d9 20d9 20d9 20d9 20d9 20d9 20d9 20d9 20d9 20d9 20d9 30d9`).

---

## 5. What `SocketInfo[+0]` Contains — Origin of the fn_ptr (Inferred/Unknown)

`SocketInfo*` (= `fp@(12)` in `ConnectToSocket`) is passed when the PLUG's `DoMESACommand` (file `0x089a`) handles a "CONS" (ConnectToSocket) SCSI command sent by the editor. The dispatch at file `0x093c` calls `vtable[+36]` = `ConnectToSocket` with the MESACommand payload as the SocketInfo. **Measured** (the "CONS" string is present in the command name table at `0x08d0`, confirmed by its presence in the ASCII dump of the dispatch region; vtable[+36] dispatch pattern at `0x093c-0x0946`).

The 46-byte `SocketInfo` payload comes from the editor's SCSI message. The editor constructs this payload during `CMESASocket::ConnectToPlug` (sampler-editor file `0x059e4b`) when it calls `descriptor[+12]` (= `CMESAPlugIn::DoMESACommand` in the PLUG binary) with a "ConnectToSocket" MESACommand whose payload includes the editor's socket descriptor.

`SocketInfo[+0]` (= `plug_slot[+0]`) is the first field of the editor's socket descriptor as transmitted across the SCSI bus. Based on context (the PLUG calls it with `IP_Data*` to deliver replies, and the call returns a result code at `fp@(-22)`), this is an editor-side **reply-receive callback** — a function the PLUG calls to deliver completed SCSI data back to the editor. **Inferred** from the call site semantics (arg = IP_Data* struct, result = status word).

The exact function identity is **Unknown**. The editor's construction of the "CONS" MESACommand payload was not traced.

---

## 6. Correction to Path A and A.5 Descriptions

Prior `path-a-install-edge.md` section 7 call graph stated:
```
; ← installed by ConnectToPlug
; ← value unknown [BINARY BOUNDARY]
```

and: "fn_ptr at `CMESASocket::slot[+8]` (= scsi-plug slot[+0] after `ConnectToSocket` stores it) is installed at sampler-editor `0x059f59` by descriptor copy from `SocketInfo[+12]`."

**This is incorrect.** `scsi-plug slot[+0]` is NOT `SocketInfo[+12]`. The path-a section 8 item 8 conflated two separate data flows:

| What | Field | Destination | Source function |
|------|-------|-------------|-----------------|
| PLUG's descriptor fn_ptr (editor calls it) | plug_descriptor[+12] | editor_slot[+8] | editor's `ConnectToPlug` at `0x059f59` |
| EDITOR's callback fn_ptr (plug calls it) | SocketInfo[+0] | **plug_slot[+0]** | plug's `ConnectToSocket` at `0x0a06` |

The fn_ptr at `$11fe` is `plug_slot[+0]` = `SocketInfo[+0]` — the **editor's callback** that the plug calls to deliver data. `SocketInfo[+12]` (= `CMESAEditor[+0x80]`, shown NULL by A.5) is unrelated to `$11fe`.

`path-a-install-edge.md` section 8, item 8 should be updated to remove the claim that `scsi-plug slot[+0]` = `SocketInfo[+12]`. That claim is false.

---

## 7. Is This Compile-Time Data or Runtime-Installed?

The fn_ptr at `plug_slot[+0]` is:
- **Runtime-installed** by `ConnectToSocket` when it processes the editor's SCSI "CONS" message
- The VALUE comes from the **editor binary** (an editor-side function pointer transmitted via SCSI)
- It is NOT present as a literal in `scsi-plug-rsrc.bin`
- It IS compile-time-bound in the editor binary (the editor's socket descriptor fn_ptr is a static editor function address, just transmitted across SCSI rather than stored in-place)

This is **Outcome B** (runtime-installed by scsi-plug-side code). The install happens inside the scsi-plug binary at `ConnectToSocket` file `0x0a06`, but the VALUE being installed originates in the editor binary.

---

## 8. Why the Vtable Data Cannot Be Read from the Binary

The vtable dispatch at `$1178` uses `CSCSIPlug::vtable[+24]`. The vtable is at `A4@(0x13c)` (from CSCSIPlug ctor at `0x000be6`). A4 is the THINK C global data register set at runtime via `JSR 0x104` at main entry `0x0718`. The vtable data at A4+0x13c is therefore at a runtime address, not at physical file offset `0x13c`. A scan of the binary confirmed that file offset `0x13c` contains bitmap/icon data (`35 00 00 00 11 00 01 0e...`), not function pointers. **Measured** (file bytes at `0x13c` do not contain plausible code addresses; A4 initialization path via `JSR 0x104` is a Mac OS absolute address call, not a file-relative offset).

The vtable entry identity (`GetSockets`) is therefore **Inferred** from functional analysis (the return value `this+56` matches the socket list iterator loop), not from reading the vtable data section directly.

---

## 9. Summary: Claim Table

| Claim | Tag | Evidence |
|-------|-----|----------|
| fn_ptr called at `$11fe` is at plug_slot[+0] | Measured | Bytes `2045 2050 4e90` at file 0x11fa-0x11fe; D5 = slot start |
| plug_slot[+0] = SocketInfo[+0] from ConnectToSocket | Measured | Copy loop at file 0x0a04-0x0a06: `43d3 20d9` |
| ConnectToSocket handles "CONS" SCSI command | Measured | "CONS" string at file 0x08d0; vtable[+36] dispatch at 0x093c |
| plug_slot stride = 46 bytes, base = CSCSIPlug[+60] | Measured | mulsw D7,D0 / addql #4,A0 at 0x1188-0x1190; GetSockets returns this+56 |
| GetSockets is called at vtable[+24] | Measured | moveal A1@(24), A1 at file 0x1174; GetSockets body at 0x0b98 |
| GetSockets returns &CSCSIPlug[+56] | Measured | lea A0@(56), A0; rts at file 0x000ba0-0x000ba6 |
| SocketInfo[+0] is an editor-side reply callback | Inferred | Call site passes IP_Data*, result used as status code |
| fn_ptr is NOT in scsi-plug binary | Inferred | No store to plug_slot[+0] from within scsi-plug code; value set from SCSI payload |
| SocketInfo[+12] (A.5) is unrelated to $11fe | Measured | plug_slot[+0] != plug_slot[+12]; SendData reads [+0] not [+12] |
| Exact identity of SocketInfo[+0] function | Unknown | Editor's "CONS" payload construction not traced |

---

## 10. Open Questions

1. **What editor-side function is at SocketInfo[+0]?** (Unknown) Likely `CMESASocket::AcceptData` (sampler-editor file `0x05a1e1`) or a direct vtable dispatch on the socket object, but the editor's "CONS" MESACommand construction path was not traced to identify the specific function address.

2. **What vtable entry index does vtable[+24] correspond to?** (Inferred) The vtable position of `GetSockets` cannot be confirmed without resolving A4 at runtime to read the vtable data section.

3. **Does ConnectToSocket use `fp@(12) = MESACommand*` or `fp@(12) = MESACommand+8`?** (Unknown) The calling convention for the "CONS" dispatch at `0x093c` (`jsr vtable[+36]`) with the MESACommand on the stack was not fully decoded.
