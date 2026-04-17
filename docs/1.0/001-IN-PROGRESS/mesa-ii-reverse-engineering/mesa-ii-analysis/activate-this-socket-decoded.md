# ActivateThisSocket — Full Static Decode

**Bottom-line answer: ActivateThisSocket emits NO wire bytes. It is entirely in-memory state management.**

File offsets are from `sampler-editor-rsrc.bin` (Sampler Editor) and `scsi-plug-rsrc.bin` (SCSI Plug), confirmed by objdump output. Disassembler prints 16-bit displacements in decimal and 8-bit (brief extension word) displacements in hexadecimal without an `0x` prefix — this distinction matters for interpreting field offsets below.

---

## 1. `this+2474`: size, meaning, and where it is written

**Size: 16-bit word (signed).**

Evidence: the ctor at `0x059d45` uses `clrw %a2@(2474)` — a word clear. SelectPlug at `0x05a06f` uses `movew %d1,%a1@(2474)` — a word store. `ActivateThisSocket` uses `mulsw %a2@(2474),%d0` — word-size operand to `mulsw`.

**Meaning: active slot index (0-based count of registered plug connection).**

SelectPlug scans the slot array with a loop: for each `n` from 0 to `this[70]-1`, it checks `this[0x4e + 48*n]` (a plug-ID field) against the sought ID. On match it writes `n` to `this[2474]` and returns 0. This means `this[2474]` is always set by the last successful `SelectPlug` call before `ActivateThisSocket` runs. At startup the ctor zeroes it.

**Where it is written:** `CMESASocket::SelectPlug` (`0x05a053`), instruction at `0x05a06f`. Not written anywhere else in `sampler-editor-rsrc.bin`.

**Plausible range:** 0 to `this[70]-1` where `this[70]` (long) is the count of registered sockets from `ConnectToPlug`. In the BULK upload path through `SendAudioBufferToSampler`, `SelectPlug` is called before `ActivateThisSocket` with plug-ID values stored in `CSamplerModule` instance data. In practice MESA registers exactly one SCSI Plug socket per session, so the value is `0`.

---

## 2. CMESASocket object layout (confirmed fields)

All offsets decimal.

| Offset | Size | Meaning |
|--------|------|---------|
| 0 | long | vtable pointer (set to `A4+12400` in ctor at `0x059d27`) |
| 4 | — | (self-pointer `this[66]` points here; part of embedded struct) |
| 8 | long | cleared in ctor (`clrl a2@(8)` at `0x059d49`) |
| 28 | byte | cleared in ctor (`clrb a2@(28)` at `0x059d2d`) |
| 60 | word | last arg passed to ActivateThisSocket (written at `0x05a0db`) |
| 62 | long | cleared in ctor; loaded in SendData (`movel %a2@(62),%fp@(-4)`) |
| 66 | long | self-pointer to `this+4` (set in ctor at `0x059d3d`) |
| 70 | long | count of registered plug slots (incremented in ConnectToPlug) |
| 74 | — | start of 48-byte slot array (slot 0 written by ConnectToPlug) |
| 2474 | word | active slot index (written by SelectPlug; cleared in ctor) |

---

## 3. Function-pointer table at `this+52` (`0x34` from object base) — REVISED

The disassembler brief-extension-word displacement is hexadecimal. The instruction `tstl %a2@(52,%d0:l)` encodes decimal 52 as hex `0x34` in the 16-bit offset form, BUT `ActivateThisSocket` uses brief (8-bit) extension words where the displayed value `52` is hex `0x52` = **82 decimal**.

Corrected layout:
- **ActivateThisSocket reads the function pointer from `this[82 + 48*idx]`**, where `idx = this[2474]`.
- **ConnectToPlug writes 48 bytes to `this[74 + 48*n]`**, skipping the first 4 bytes of the source descriptor entry.
- The function pointer is at **byte offset +8 within the 48-byte slot data** = `this[74+8] = this[82]` for slot 0. This corresponds to `source_entry[+12]` (source descriptor offset 12, the third long after the 4-byte skip).

**ConnectToPlug slot construction** (`0x059e4b`):
1. Calls `handler_func(MESACommand*)` (first arg) — this is the SCSI Plug's `DoMESACommand` callback.
2. Handler fills the SocketInfo / plug-descriptor array; pointer returned via `fp@(-4)`.
3. For each descriptor entry matching `plug_id`, copies 48 bytes from `entry+4` into `this[74 + 48*n]`.
4. The source entry layout (relative to entry start):
   - `+0`: 4 bytes skipped (likely plug-type tag or size field)
   - `+4`: plug ID (long) — compared in outer ConnectToPlug loop at `0x059e71`
   - `+8`: socket qualifier (long) — compared at `0x059ef7` / `0x059f09`
   - `+12`: **function pointer** — installed at `this[82 + 48*n]`
   - `+16..51`: 9 additional longs — other state (not separately decoded)

---

## 4. The function pointer: what it resolves to

The SCSI Plug (`scsi-plug-rsrc.bin`) registers itself through `CMESAPlugIn::ConnectToSocket` (`0x0009d2`). The socket descriptor that ConnectToSocket stores in `CMESAPlugIn@(56..101)` is the `SocketInfo` struct passed as argument. The function pointer at entry `+12` comes from that `SocketInfo`.

`CMESAPlugIn::GetSockets` (`0x000b98`) returns `&this[56]` — the start of the plug's socket descriptor array, stride 46 bytes. When ConnectToPlug's handler (DoMESACommand dispatch) is called, it copies from this array into the `CMESASocket` slot. Entry `+12` within the 46-byte SocketInfo is the handler function pointer.

Based on the `CMESAPlugIn::DoMESACommand` (`0x0089a`) dispatch table structure, the function pointer is the **plug's own DoMESACommand** (or a per-socket callback derived from it). When `ActivateThisSocket` calls this pointer:

1. DoMESACommand receives a `MESACommand` struct (built at `A4+12482` in ActivateThisSocket, 10 bytes copied to `fp@(-10)` at `0x05a0bd-0x05a0c9`).
2. DoMESACommand dispatches on the command type field (`a2@[0]`).
3. The ACTIVATE path routes to `CMESAPlugIn::ActivateSocket` (`0x000a5e`).

---

## 5. `CMESAPlugIn::ActivateSocket` — wire effects

`ActivateSocket` (`0x000a5e`, SCSI Plug binary):

```
a5e:  linkw fp,#0
a62:  movel a3, sp@-          ; save A3
a64:  moveal fp@(8), a1       ; A1 = CMESAPlugIn* this
a68:  moveal fp@(12), a3      ; A3 = SocketInfo* (the MESACommand struct)
a6c:  moveq #0, d1            ; slot index = 0
a6e:  bras 0xaa4              ; → loop condition
; loop body:
a70:  moveq #46, d0; mulsw d1, d0   ; D0 = 46*idx
a74:  movel a1@(62,d0:l), d0        ; D0 = plug's socket[idx].id
a78:  cmpl a3@(38), d0              ; compare with SocketInfo socket_id
a7c:  bnes 0xaa2                    ; no match → next slot
a7e:  moveq #46, d0; mulsw d1, d0   ; D0 = 46*idx again
a82:  movew a3@(36), a1@(60,d0:l)   ; plug->slot[idx].activation_code = SocketInfo.field36
a88:  moveq #46, d0; mulsw d1, d0
a8c:  movel a3@(42), a1@(66,d0:l)   ; plug->slot[idx].buffer_ptr = SocketInfo.field42
a92:  moveq #46, d0; mulsw d1, d0
a96:  moveal a1@(66,d0:l), a0       ; A0 = buffer_ptr
a9a:  clrl a0@(16)                  ; buffer[16] = 0
a9e:  moveq #0, d0
aa0:  bras 0xab0                    ; return 0
; loop increment:
aa2:  addqw #1, d1
aa4:  moveaw d1, a0; cmpal a1@(56), a0; blts 0xa70
; not found:
aac:  movew #-11004, d0
ab0:  moveal sp@+, a3; unlk fp; rts
```

**ActivateSocket performs three in-memory writes only:**
1. Copies the activation byte/word from `SocketInfo.field36` into `plug->slot[idx].activation_code`.
2. Copies a buffer pointer from `SocketInfo.field42` into `plug->slot[idx].buffer_ptr`.
3. Clears long at `buffer_ptr[16]`.

**No A-traps. No `_SCSIDispatch` ($A089). No call to `SMSendData`. No call to `SetSCSIMIDIMode`. Zero wire bytes emitted.**

---

## 6. `CMESASocket::SendData` comparison

`CMESASocket::SendData` (`0x05a133`) uses **the exact same function pointer slot** at `this[82 + 48*idx]` — same `mulsw this[2474]` and same `moveal a2@(52,d0:l)` pattern (0x52 = 82 decimal). The difference is the MESACommand struct it builds before calling:

- `ActivateThisSocket` builds a struct at `A4+12482` (likely `ACTV` or similar 4-byte tag)
- `SendData` builds a struct at `A4+12466` (likely `SEND` tag) with the data pointer and length

When the function pointer is called from `SendData`, `DoMESACommand` dispatches on the `SEND` tag to `CSCSIPlug::SendData` (`0x000df2`), which **does** emit SCSI wire bytes via `jsr 0xca2` (a Mac OS A-trap SCSI wrapper) and the `SMSendData`/`SMDispatchReply` path.

---

## 7. Implications for the BULK test

**ActivateThisSocket is entirely application-side.** It sets `this[60]` (the activation code byte, arg = `1` in all observed call sites) and updates three fields in the `CMESAPlugIn` object: `activation_code`, `buffer_ptr`, and `buffer[16]`. None of this touches the SCSI bus.

The reason the BULK test fails is NOT that ActivateThisSocket emits a missing wire preamble. That hypothesis is eliminated. The remaining candidates for the SLNGTH / name ignoring issue are:

1. **The pre-existing sample slot is in the wrong state.** The device may require the slot to have been created via SDS and then left in a specific condition. The preamble test created a slot but SLNGTH still wasn't updated — the sample may have been created but the SDATA opcode semantics (UPDATE vs CREATE) still differ.

2. **The UALL phase is missing.** `SendAudioBufferToSampler` calls `vtable[0x0134]` (DecodeAcceptSampleResult) and `vtable[0x015c]` (UALL phase) before and after the BULK loop. The UALL command (`CAkaiSampler::vtable[0x015c]`) and LALL response have not been reproduced in the test.

3. **Sample number mismatch.** The 2-byte sample_number field in the SDATA SysEx must match the existing slot's index. If the SDS preamble created sample 0 but SDATA targets sample 1, the device silently ignores it.

---

## 8. Confidence ratings

| Claim | Confidence | Evidence |
|-------|-----------|----------|
| this+2474 is a word | High | ctor `clrw`; `mulsw` operand |
| this+2474 written only by SelectPlug | High | binary search for write pattern |
| function ptr at this[82+48*idx] | High | extension-word byte decode + ConnectToPlug copy arithmetic |
| ConnectToPlug source[+12] = fn ptr | High | explicit `tstl`/`moveal` at 0x059f09/0x59f1b |
| fn ptr resolves to CMESAPlugIn::DoMESACommand | Medium | SocketInfo layout assumed from ConnectToSocket |
| ActivateSocket writes no wire bytes | High | full instruction-level decode shows only movel/clrl |
| `jsr 0x116` = `__divsi3` | High | confirmed from SendAudioBufferToSampler annotation at 0x030753 |
| ConnectToPlug slot count uses divide, not multiply | Unknown | `__divsi3(slot_count/48)` as addressing is unusual; slot_count=0 gives D0=0 which is correct for first slot |
