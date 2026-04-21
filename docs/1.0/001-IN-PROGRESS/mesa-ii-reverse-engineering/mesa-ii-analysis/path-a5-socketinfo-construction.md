## Path A.5: SocketInfo Construction — Where the Editor Installs Its fn_ptr

**Binary**: `sampler-editor-rsrc.bin`  
**Resource data start**: file `0x027f57` (EDIT-relative offset = file_offset - 0x027f57)  
**PLUG binary**: `scsi-plug-rsrc.bin` (resource data start: file `0x00059e`)  
**Date**: 2026-04-20

> **REFRAMED 2026-04-20 by [`path-a6-plug-slot-origin.md`](./path-a6-plug-slot-origin.md) and [`path-a7-cons-construction.md`](./path-a7-cons-construction.md):** This doc was hunting in the wrong direction. `SocketInfo[+12]` (plug→editor direction) is correctly identified as NULL — that finding stands. But the more relevant frontier is `SocketInfo[+0]` (editor→plug direction). What is **measured** here is the ctor store at file `0x0596e7` (`LEA $00000212, A0; MOVE.L A0, A2@(0x8c)`) into editor offset `+0x8c`. What remains **candidate-grade** is the stronger claim that this exact field is what later becomes plug-visible `SocketInfo[+0]`. Read path-a6 + path-a7 for the calibrated picture.

---

### Summary

The question was: where does `sampler-editor-rsrc.bin` build the `SocketInfo` struct with `SocketInfo[+12]` set to a function pointer, and what function is installed there?

**Finding**: `SocketInfo[+12]` is **never explicitly set** by the editor. It is always NULL (zero) when the editor calls `CMESAPlugIn::ConnectToSocket`. The plug tests for NULL before calling through this field and skips the call when it is zero. The editor's reply-handler is dispatched through vtable entry[+52] of an embedded CMESASocket subclass vtable, not through a direct fn_ptr at SocketInfo[+12].

---

### Binary Evidence

#### 1. CMESAEditor::ctor at file:0x05965f (Measured)

Full 188-byte ctor disassembled from raw bytes. Stores found:

| Offset | Instruction | Field |
|--------|-------------|-------|
| `0x0596ad` | `MOVE.L A0, A2@(4)` | this[+4] |
| `0x0596bb` | `MOVE.L A0, (A1)` | vtable ptr of embedded socket at A3=A2[+116] |
| `0x0596c5` | `MOVE.L A0, A2@(62)` | this[+0x3e] |
| `0x0596d1` | `MOVE.L A0, A2@(116)` | this[+0x74] (embedded socket pointer) |
| `0x0596df` | `MOVE.L A0, A3@(8)` | |
| `0x0596e3` | `CLR.L A2@(2592)` | this[+0xa20] |
| `0x0596ed` | `MOVE.L #0x212, A2@(140)` | this[+0x8c] |
| `0x059705` | `MOVE.W D0, A2@(2598)` | this[+0xa26] |
| `0x059709` | `CLR.W A2@(2596)` | this[+0xa24] |

**No store to A2@(0x80) = CMESAEditor[+128] = CMESASocket[+12] exists.** (Measured — exhaustive scan of all stores in 0x05965f..0x05971b)

#### 2. CMESASocket::ctor at file:0x059d1d (Measured)

Called from CMESAEditor::ctor at `0x0596a3`. Disassembly shows CMESASocket::ctor clears `this[+8]` to zero but contains no store to `this[+12]`. The embedded socket object at `CMESAEditor[+0x74]` therefore has `CMESASocket[+12] = 0` after construction.

#### 3. Sub-ctors called from CMESAEditor::ctor (Measured)

The ctor calls five sub-functions:
- `JSR 0x02d6c8` → file:`0x05561f` (before socket ctor)
- `JSR 0x02797c` → file:`0x04f8d3`
- `JSR 0x0287a8` → file:`0x0506ff`
- `JSR 0x031dc6` → file:`0x059d1d` (CMESASocket::ctor — confirmed clears [+8] only)
- `JSR 0x027e00` → file:`0x04fd57`

Scans of all stores to `A2@(0x80)` across the entire ctor body (0x05965f..0x05971b) and in the first sub-ctor (file:`0x05561f`) found **zero matches**. (Measured)

#### 4. The embedded socket object and vtable overwrite (Measured)

After calling CMESASocket::ctor, the editor ctor executes at `0x0596a9..0x0596d1`:

```
0596a9: LEA A4@(0x30e0), A0       ; A0 = base table at A4+12512
0596b5: LEA A0@(248), A0          ; A0 += 248 (= A4@(0x30e0+0xf8) = A4@(0x31d8))
0596b9: MOVEA.L (A2), A1          ; A1 = current vtable ptr of CMESAEditor
0596bb: MOVE.L A0, (A1)           ; overwrite vtable[0] of the embedded socket? No —
                                  ; A1 = *A2 = first field of CMESAEditor = its vtable ptr
                                  ; This stores into vtable[0] of the EDITOR's own vtable
0596bd: LEA A4@(0x30e0), A0       ; A0 = base table
0596c1: LEA A0@(96), A0           ; A0 = A4@(0x30e0+0x60) = A4@(0x3140)
0596c5: MOVE.L A0, A2@(62)        ; this[+0x3e] = ptr into data table
0596c9: LEA A4@(0x30e0), A0       ; A0 = base table
0596cd: LEA A0@(108), A0          ; A0 = A4@(0x30e0+0x6c) = A4@(0x314c)
0596d1: MOVE.L A0, A2@(116)       ; this[+0x74] = A4@(0x314c)
```

`this[+0x74]` receives `A4@(0x314c)` = file:`0x071a1f` — the subclass vtable. (Measured — A4_base = 0x06e8d3, so A4@(0x314c) = 0x06e8d3 + 0x314c = 0x071a1f confirmed by reading `r32(0x071a1f) = 0x00031dba`.)

#### 5. Subclass vtable at file:0x071a1f (Measured)

14 entries, each a 4-byte EDIT-relative address:

| Index | Byte offset | EDIT-rel | File offset | Identity |
|-------|-------------|----------|-------------|---------|
| 0 | +0 | `0x00031dba` | `0x059d11` | dtor |
| ... | ... | ... | ... | ... |
| 12 | +48 | `0x0000079c` | `0x0286f3` | unknown (small addr) |
| 13 | +52 | `0x0003194e` | `0x0598a5` | `CMESAEditor::DoMESACommand` |

Entry[+52] = EDIT-relative `0x0003194e` = file:`0x0598a5` = `CMESAEditor::DoMESACommand`. (Measured — function name confirmed from decorated symbol string in the binary.)

This vtable is stored at `CMESAEditor[+0x74]`, making the embedded CMESASocket object's vtable ptr point to this subclass vtable.

#### 6. SocketInfo[+12] in context of CMESASocket::ConnectToPlug (Measured)

`CMESASocket::ConnectToPlug` at file:`0x059e4b` (EDIT-relative `0x031ef4`):

```
059e89: TST.L A6@(12)       ; test arg2 (ConnectToPlug's second argument)
059e8d: BEQ.W -> 0x05a011   ; if NULL, skip everything, return 0
059e91: LEA A4@(12502), A0  ; A0 = "PLST" + null pad (10-byte command name block)
        ... copy 10 bytes to A1 (local stack frame) ...
059ea3: MOVE.L A0, A6@(-18) ; fp@(-18) = ptr to local reply buffer
059eab: MOVEA.L A6@(12), A0 ; A0 = arg2 cast as function ptr
059eaf: JSR (A0)             ; call arg2 as a function
```

`A6@(12)` = `arg2` to `ConnectToPlug` is used **as a function pointer to call directly**, not stored into SocketInfo[+12]. The SocketInfo for the embedded CMESASocket occupies `CMESAEditor[+0x74..+0x74+45]` = `CMESAEditor[+0x74..+0xa1]`. `SocketInfo[+12]` = `CMESAEditor[+0x80]`. The ctor never stores anything there, so it is heap-zero.

There is a separate null-check in the annotated disassembly of `CMESASocket::ConnectToPlug` at the activation call:
```
059f09: TST.L desc[+12]    ; test fn_ptr in descriptor
059f0d: BEQ.S -> 0x059f31  ; if NULL, skip JSR (A0) at 0x059f1f
```
(From `CMESASocket-ConnectToPlug.annotated.txt` — Measured via prior session analysis.)

This confirms the plug-side equivalent: when the editor sends ConnectToSocket to the plug, the plug copies 46 bytes into its slot array verbatim. If `SocketInfo[+12]` was NULL when the editor's socket struct was copied, the plug skips the fn_ptr call path.

#### 7. SMDispatchReply callback mechanism at file:0x001938 (Measured)

The callback the plug uses to notify the editor on SCSI data replies is in `SMDispatchReply` (plug file:`0x001938`, plug-relative `0x139a`). The callback sequence at `0x0019ec..0x0019f4`:

```
0019ea: MOVEA.L (A7)+, A0       ; pop MESACommand ptr from stack -> A0
0019ec: MOVEA.L A0@(14), A1     ; A1 = MESACommand[+14] = object ptr
0019f0: MOVEA.L A1@(16), A1     ; A1 = object[+16] = vtable entry at +16
0019f4: JSR (A1)                 ; call through vtable dispatch
```

This is a vtable call through `MESACommand[+14]` (the object) to its entry at byte offset `+16` — **not** a direct call through SocketInfo[+12]. The `MESACommand[+14]` field is the editor-side object ptr, and vtable entry[+16] is dispatched directly. This is the equivalent of a C++ virtual function call: `((CMESASocket*)mesaCmd->receiver)->vtable[+16/4]()`.

#### 8. The value at `0x03194e` — three hits, analyzed (Measured)

Searching `sampler-editor-rsrc.bin` for the 4-byte sequence `00 03 19 4e` yields three matches:

- **HIT 1** at file:`0x0289ad` — JSR operand inside `CSamplerModule::DoMESACommand` (file:`0x0287c5`). This is a **runtime dispatch call** to `CMESAEditor::DoMESACommand`, not a construction site.
- **HIT 2** at file:`0x071a53` — vtable entry[+52] of the subclass vtable at file:`0x071a1f` (A4@0x314c). This is the **construction site** in the data segment: vtable[+52] = `CMESAEditor::DoMESACommand` = EDIT-relative `0x0003194e`.
- **HIT 3** at file:`0x077491` — byte offset inside a command dispatch table. Not a SocketInfo construction site.

---

### The Call Chain: MESA Init to SocketInfo Construction

```
CMESAEditor::ctor (file:0x05965f)
  |
  |-- JSR 0x031dc6 -> CMESASocket::ctor (file:0x059d1d)
  |     Initializes embedded socket at CMESAEditor[+0x74]
  |     Clears [+8], leaves [+12] = 0 (heap zero)
  |
  |-- MOVE.L A4@(0x314c), A2@(116)   (file:0x0596d1)
        Overwrites CMESAEditor[+0x74] with ptr to subclass vtable
        Subclass vtable at file:0x071a1f (A4@0x314c)
        vtable[+52] = 0x0003194e = CMESAEditor::DoMESACommand (file:0x0598a5)
```

The "installation" of `CMESAEditor::DoMESACommand` as the reply handler is done **via vtable entry[+52]** of the subclass vtable, not via `SocketInfo[+12]`. When the plug calls back to the editor after an SCSI reply, it goes through vtable dispatch on the socket object pointer, not through a direct fn_ptr stored in SocketInfo[+12].

---

### Claim Tags

| Claim | Tag | Evidence |
|-------|-----|----------|
| No store to CMESAEditor[+0x80] in ctor or sub-ctors | Measured | Exhaustive scan of all `MOVE.L Rn, A2@(d)` instructions in 0x05965f..0x05971b and first sub-ctor |
| CMESASocket::ctor clears [+8] only | Measured | Direct disassembly of 70-byte ctor body |
| Subclass vtable at file:0x071a1f (A4@0x314c) | Measured | r32(0x071a1f) = 0x00031dba; A4_base = 0x06e8d3; 0x06e8d3 + 0x314c = 0x071a1f |
| vtable[+52] = CMESAEditor::DoMESACommand | Measured | r32(0x071a53) = 0x0003194e; 0x027f57 + 0x0003194e = file:0x0598a5; symbol string confirmed |
| MOVE.L A4@(0x314c), A2@(0x74) in editor ctor | Measured | Direct byte sequence at file:0x0596c9..0x0596d1 |
| SocketInfo[+12] = NULL when ConnectToSocket sent | Inferred | No construction site found; heap memory from Mac OS classic _NewHandle is zeroed |
| Plug skips fn_ptr call when SocketInfo[+12] is NULL | Measured | TST.L + BEQ.S pattern at file:0x059f09-0x059f0d confirmed in annotated disassembly |
| SMDispatchReply calls through vtable[+16] of MESACommand[+14] | Measured | Direct disassembly: 0x0019ec MOVEA.L A0@(14),A1; 0x0019f0 MOVEA.L A1@(16),A1; 0x0019f4 JSR (A1) |
| arg2 to ConnectToPlug is called directly as fn ptr, not stored in SocketInfo[+12] | Measured | 0x059eab MOVEA.L A6@(12),A0; 0x059eaf JSR (A0) |
| HIT 1 (0x0289ad) is a runtime dispatch call, not construction | Measured | Containing function is CSamplerModule::DoMESACommand, not a ctor |
| HIT 3 (0x077491) is a command dispatch table | Inferred | Surrounding data structure pattern; not in a ctor function |

---

### What ConnectToPlug's `arg2` Actually Is

`CMESASocket::ConnectToPlug` takes two stack arguments:
- `A6@(8)` = self (the CMESASocket object)
- `A6@(12)` = a function pointer, called at `0x059eaf` via `JSR (A0)`

This `arg2` function pointer is **not** stored into `SocketInfo[+12]`. Its role is an immediate callback used during the connect phase (likely a "ready to proceed" notifier). What goes into the plug's slot array (46-byte SocketInfo copy) is the CMESASocket object's field layout at the time of the copy loop. Since `CMESASocket[+12]` = `CMESAEditor[+0x80]` was never set, it is NULL.

The `arg2` fn ptr's identity is Unknown — it is not visible in this disassembly path. Its call result (the W word at `fp@(-20)`) controls whether ConnectToPlug proceeds.

---

### Open Questions

1. **What is `CMESASocket[+12]` for?** (Unknown) The SocketInfo struct has a fn_ptr field at [+12] that is never set in the editor code traced here. It may be set by a different code path that constructs a different kind of CMESASocket (e.g., a non-embedded socket), or it may be a field used only when the editor is acting as a plug rather than an editor.

2. **What function is vtable[+12] of the subclass vtable?** (Unknown) Entry at byte offset[+48] = EDIT-relative `0x0000079c` = file:`0x0286f3`. Not disassembled in this investigation.

3. **Who calls `CSamplerModule::DoMESACommand` (JSR at HIT 1, file:0x0289ad)?** (Unknown) The function at file:`0x0287c5` is a runtime command dispatcher, not directly relevant to SocketInfo construction, but its caller chain may illuminate the overall message routing.
