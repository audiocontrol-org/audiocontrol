## Path A.11: Patcher Identity — Who Writes scsi-plug 0x1070-0x1071?

**Binaries:** `scsi-plug-rsrc.bin` + `sampler-editor-rsrc.bin`
**Method:** Static decode of both binaries; exhaustive byte-pattern search
**Date:** 2026-04-20
**Prior docs:** [`path-a9-sraw-outbound.md`](./path-a9-sraw-outbound.md), [`sraw-decoded.md`](./sraw-decoded.md), [`path-a-install-edge.md`](./path-a-install-edge.md)

All claims tagged per-claim: **MEASURED** (file offset + bytes cited) / **CANDIDATE** (reasoned, not byte-verified) / **OPEN** (decode boundary not crossed)

---

### Bottom Line

**Outcome B — patcher not found in either binary.**

The 2-byte displacement at scsi-plug file `0x1070-0x1071` (`00 f0`, encoding `BRA.W` target 0x1160) is **not written by any instruction** in `scsi-plug-rsrc.bin` or `sampler-editor-rsrc.bin`. Exhaustive searches for absolute stores, register-relative stores, and the expected post-patch displacement value `0x059c` all return zero results. The PLUG code resource has no self-modifying init path. The sampler-editor has only two absolute stores in the entire binary, neither targeting a plausible code address.

**Stack-balance proof that patching IS required:** with the current `BRA.W +0xf0` stub at 0x106e, all six `JSR 0x106e` call sites in SendData cause a no-op: D3 stays `0xd505`, gate 1 at 0x1160 fires immediately, and SendData exits without SCSI emission. No SCSI data transfer occurs in the unpatched binary. **MEASURED** from gate logic at 0x1160 + D3 initialization at 0x0ec8. This eliminates any interpretation where the stub is intentional behavior.

**Remaining candidates for the patch source (B3 eliminated after targeted scan):**

1. **Mac OS Code Resource Manager relocation** — the resource fork file has been confirmed as a complete Mac OS resource fork (header at 0x0000-0x000f, map at 0x2e51). If Akai shipped the plug with the displacement already correct in the resource file stored on disk, then the value we have (`00 f0`) is what was written at build time and the patcher is a compile-time artifact (i.e., the PLUG shipped with `BRA.W` already pointing to `SMSendData`). The current `00 f0` value (target 0x1160) would then be a compile-time bug or a pre-SCSI-mode version of the code, and the released product has a different value in its resource fork. **Candidate B3 (Mac OS relocation in the PLUG resource) was searched exhaustively and eliminated: no relocation table entry for 0x0ad2 exists, and no ADDA.L loop exists in the PLUG code.**

2. **A separate binary or init resource not included** in the two files we have (e.g., the Akai software disk may include a `CMESASocket`-level installer that runs before `ConnectToSocket`). **OPEN.**

3. **The scsi-plug-rsrc.bin file we have is not the final shipped version.** An earlier development build that was never patched. The real production disk contains a PLUG resource with `05 9c` already baked in. **CANDIDATE — strongest remaining explanation.**

**For the harness:** regardless of origin, the harness must write `05 9c` (or the correct displacement to `SMSendData`) to the 2 bytes at heap_base + 0x0ad2 before the first SRAW call, where heap_base is the runtime address of the PLUG resource data.

---

### 1. Step 0: Anchor Re-Verification (all PASS)

| Anchor | Expected bytes | File offset | Raw bytes | Result |
|--------|---------------|-------------|-----------|--------|
| `0x106e`: BRA.W +0xf0 | `60 00 00 f0` | `0x106e` | `60 00 00 f0` | PASS — **MEASURED** |
| `0x1160`: TST.W D3 + BNE | `4a 43 66 00 00 b0` | `0x1160` | `4a 43 66 00 00 b0` | PASS — **MEASURED** |
| `0x160c`: SMSendData prologue | `4e 56 ff fa 48 e7 1f 30` | `0x160c` | `4e 56 ff fa 48 e7 1f 30` | PASS — **MEASURED** |
| `0x0f60`: JSR 0x106e site | `4e b9 00 00 10 6e` | `0x0f60` | `4e b9 00 00 10 6e` | PASS — **MEASURED** |

All four anchors verified. Analysis proceeds.

---

### 2. Stack-Balance Proof That the Stub Must Be Patched

**MEASURED** from instruction bytes:

At `0x0ec8`: `36 3c d5 05` = `MOVE.W #0xd505, D3` — D3 set to error sentinel before JSR 0x106e. **MEASURED.**

Gate 1 at `0x1160`: `4a 43` = `TST.W D3`; `66 00 00 b0` = `BNE.W #0xb0 -> 0x1214` — if D3 != 0, SendData exits immediately with no SCSI emission. **MEASURED.**

`JSR 0x106e` at `0x0f60` pushes return address 0x0f66. The `BRA.W +0xf0` at 0x106e jumps to 0x1160 without executing any instructions. Control reaches 0x1160 with D3 = 0xd505. Gate 1 fires. D3 is never cleared in this path. SendData exits. **MEASURED** (no instruction between JSR push and gate test modifies D3).

The code at 0x0f66 (`36 00` = `MOVE.W D0, D3`; `4f ef 00 18` = `LEA SP@(24), SP`) is only reached if the function at 0x106e has its own LINK/RTS and returns normally. In the stub path this code is dead: the UNLK A6 at 0x121a discards all locals (including the JSR-pushed return address). **MEASURED** from LINK semantics at 0x0df2 and UNLK at 0x121a.

**Conclusion (MEASURED from gate bytes):** the current stub causes SendData to be a no-op. The `BRA.W` displacement must be changed to target a function with LINK/RTS that accepts the 7-arg stack frame and performs SCSI emission.

Post-patch target: `SMSendData` at file 0x160c. Required displacement: `0x160c - 0x1070 = 0x059c`. Expected bytes at 0x1070-0x1071 after patch: `05 9c`. **MEASURED** arithmetic; target identity CANDIDATE (calling-convention match).

---

### 3. Search Results

#### 3a. scsi-plug-rsrc.bin file structure

**MEASURED:** The file is a complete Mac OS resource fork, not a raw CODE resource:

| Field | Value | Bytes |
|-------|-------|-------|
| data_offset | 0x100 | `00 00 01 00` at file 0x0000 |
| map_offset | 0x2e51 | `00 00 2e 51` at file 0x0004 |
| data_size | 0x2d51 | `00 00 2d 51` at file 0x0008 |
| map_size | 0xc4 | `00 00 00 c4` at file 0x000c |

7 resource types: `vers`, `STR#`, `ALRT`, `cicn`, `DITL` (x2), `DLOG`, `PLUG`. The `PLUG` resource (ID=0) is at file offset 0x059a (4-byte length field) + 0x059e (data start), length 0x28b3. Resource attributes = 0x1c (`resLocked | resProtected | resPreload`). **MEASURED** from resource map at 0x2e51 and resource map parsing.

The `PLUG` resource data spans file bytes 0x059e–0x2e50. The BRA.W stub at file 0x106e is at PLUG-resource-relative offset 0x0ad0 (= 0x106e − 0x059e). The BRA displacement at 0x1070-0x1071 is at PLUG-relative offset 0x0ad2. **MEASURED** arithmetic.

#### 3b. Strategy 1: Absolute store instructions

Exhaustive scan of scsi-plug for `MOVE.W #imm, $addr.L` (`33 fc XX XX 00 00 10 70`), `MOVE.L #imm, $addr.L`, and register-to-absolute-long stores: **zero hits.** **MEASURED.**

Exhaustive scan of sampler-editor for identical patterns: **2 hits total**, neither targeting 0x1070 or any plausible plug-code address:
- file 0x01520e: `MOVE.L #0x31092330, $0x23312331` — clearly data-section noise
- file 0x04f2a7: `MOVE.L D6, $0x00050146` — unrelated address

**MEASURED.** Neither is a plug-code patcher.

#### 3c. Strategy 2: Register-relative stores with d16 = 0x0ad2

Exhaustive scan of both binaries for `MOVE.W #imm, 0x0ad2(An)` and `MOVE.W Dn, 0x0ad2(An)`: **zero hits.** **MEASURED.**

Broadened to d16 in range 0x0ac0–0x0ae0: **zero hits.** **MEASURED.**

#### 3d. Strategy 3: Literal constants 0x1070, 0x106e, 0x059c in either binary

- `0x00001070` as 4-byte sequence in scsi-plug: **zero hits.** **MEASURED.**
- `0x00001070` in sampler-editor: **zero hits.** **MEASURED.**
- `0x0000106e` in scsi-plug: 6 hits — all are `4e b9 00 00 10 6e` = JSR 0x106e (the 6 call sites within SendData). No stores. **MEASURED.**
- `0x0000106e` in sampler-editor: **zero hits.** **MEASURED.**
- `0x059c` as 2-byte immediate in scsi-plug: **zero hits.** **MEASURED.**
- `0x059a`, `0x059e`, `0x05a0` as 2-byte immediates in scsi-plug: **zero hits.** **MEASURED.**

#### 3e. Strategy 4: scsi-plug PLUG resource entry point

The PLUG resource data begins with `60 0a` = `BRA.S +10` → entry at file 0x05aa. **MEASURED** (bytes at 0x059e).

The entry at 0x05aa:
- `48 e7 e0 c8` = `MOVEM.L D1-D3/D7/A0-A3, -(SP)` (save registers) — **MEASURED**
- `4e ba 00 f2` = `JSR PC+242 -> 0x06a2` (A4 world-setup / RecoverHandle) — **MEASURED**
- `41 fa ff ea` = `LEA PC-22, A0 -> 0x059e` (A0 = plug resource base) — **MEASURED**
- `20 08` = `MOVE.L A0, D0` — **MEASURED**
- `a0 55` = Trap $A055 (_RecoverHandle: D0 = ptr in block → A0 = handle) — **MEASURED**
- `4e ba 00 90` = `JSR PC+144 -> 0x064c` (secondary init with A0 = handle) — **MEASURED**
- `4c df 13 07` = `MOVEM.L (SP)+, ...` — **MEASURED**
- `4e fa 01 48` = `JMP PC+328 -> 0x070c` (to main entry) — **MEASURED**

No store to any code address in this sequence. **MEASURED.**

#### 3f. Strategy 4b: Secondary init at 0x064c

Receives A0/D0 = handle to PLUG code resource (result of _RecoverHandle). Decoded:
- Loads A4@(0x266) into A0 (previous handle, if any)
- Compares current handle with stored handle — first-call guard
- On first call: initializes flag at A4@(0x26a), issues unidentified traps $A746 and $A346 (OPEN — trap identities not confirmed)
- Stores current handle at `A4@(0x266)` via `29 4a 02 66` = `MOVE.L A2, A4@(0x266)` at file 0x068e — **MEASURED** bytes
- Conditionally calls Trap $A198 (HLock or HNoPurge) on the handle

The only store is `MOVE.L A2, A4@(0x266)` which stores the PLUG handle (a Master Pointer address, heap-level metadata) into an A4 global. This is a handle-tracking operation, NOT a code write. **MEASURED.** No write to PLUG code bytes occurs.

#### 3g. Strategy 4c: A4 init function at 0x06a2

- `41 fa fe fa` = `LEA PC-262, A0 -> 0x059e` (plug base) — **MEASURED**
- `d1 fc 00 00 25 b4` = `ADDAL #0x25b4, A0` → A0 = 0x059e + 0x25b4 = file 0x2b52 — **MEASURED**
- `20 08` = `MOVE.L A0, D0` — **MEASURED**
- `a0 55` = Trap $A055 — **MEASURED**
- `c1 8c` = `AND.L A4, D0` (THINK C globals-restore idiom) — **MEASURED**
- `4e 75` = RTS — **MEASURED**

No store. This is a pure A4 initialization. **MEASURED.**

#### 3h. Strategy 5: scsi-plug init functions Open, Close, DoAboutToQuit, SetMESAProc

- `CSCSIPlug::Open` at 0x0d8e: `4e 56 00 00 4e 5e 4e 75` = LINK #0; UNLK; RTS — no-op. **MEASURED**
- `CSCSIPlug::Close` at 0x0dac: same pattern. **MEASURED** (from path-a-install-edge.md sec 2, confirmed by bytes)
- `SetMESAProc` at 0x0856: `4e56 0000 206e 0008 216e 000c 0004 4e5e 4e75` = LINK; MOVEA.L fp@(8), A0; MOVE.L fp@(12), 4(A0); UNLK; RTS — stores arg2 into `this[4]`, not a code address. **MEASURED** bytes `20 6e 00 08 21 6e 00 0c 00 04` at 0x085a-0x0864.

None patches 0x1070-0x1071. **MEASURED.**

#### 3i. Strategy 5b: SMSendData call sites in scsi-plug

Direct JSR/BSR/JMP to file 0x160c (SMSendData): **zero hits** outside SMSendData itself. **MEASURED.** The 5 hits for 0x1620 (internal shared-entry calls within SMSendData) are all from within SMSendData's own body. **MEASURED.**

SMSendData has no external callers reachable from the binary. **MEASURED.** This eliminates the hypothesis that SendData calls SMSendData via a path other than the 0x106e trampoline.

#### 3j. sampler-editor: No toolbox traps near ConnectToPlug

Only one trap in sampler-editor bytes 0x059800–0x059f00: `$A01F` = `_SetHandleSize` at 0x059dd9. **MEASURED.** No _GetResource, _HLock, _RecoverHandle, or any resource-manipulating trap near the code that installs the socket connection. The editor does not dereference the PLUG resource handle and write to its code.

---

### 4. Why No Patcher Exists in These Binaries

The sampler editor cannot encode a patcher statically because it does not know the PLUG resource's runtime heap address at compile time. A register-relative store would require computing `plug_heap_base + 0x0ad2`, which can only be determined at runtime after _RecoverHandle or **(Handle) dereference. Any such operation would appear as a toolbox trap near the install code — none exists near ConnectToPlug. **CANDIDATE** (absence of traps is the evidence; the negative is not logically airtight but is highly constraining).

The PLUG resource's own init path (0x05aa, 0x064c, 0x06a2) performs no self-modification. The `resProtected` attribute (bit 3 of 0x1c) on the PLUG resource prevents the Mac OS Resource Manager from marking it changed, but does not prevent direct memory writes. The init code is simply not written to patch itself. **MEASURED** from exhaustive decode of all init-path functions.

---

### 5. Remaining Candidates (Outcome B)

**Candidate B1 (strongest): The file-on-disk has different bytes than `00 f0` at 0x1070-0x1071.**

The scsi-plug-rsrc.bin file may be an unfinished development build or a test binary. The production floppy disk shipped with the PLUG resource already containing displacement `05 9c` (or the correct value) baked in at resource file bytes 0x1070-0x1071. In that case: there is no runtime patcher at all — the resource fork file on disk already encodes the correct BRA.W target for SMSendData. The binary we have is pre-production or test.

This is the most parsimonious explanation consistent with all evidence: no patcher code exists because the final product ships the correct displacement baked into the resource fork. The harness's job is simply to patch 0x1070-0x1071 itself to replicate what the shipped resource fork would contain. **CANDIDATE** (cannot verify without the original Akai disk image).

**Candidate B2: A separate installer resource or init code not present in either file.**

The sampler-editor or a supporting CODE/INIT resource (not extracted) might contain the patcher. The two binary files we have may not represent the complete set of code loaded at runtime. **OPEN** — cannot verify without the disk image or a full Macintosh emulator session.

**Candidate B3: Mac OS Code Resource Loader relocation. — ELIMINATED**

Mac OS classic 68k code resources support relocation: the resource file can contain a relocation table, and the Resource Manager applies it when loading the resource. Exhaustive search of the entire PLUG resource data (file 0x059e–0x2e50, 10419 bytes) found:

- The value `0x0ad2` (PLUG-relative offset of the BRA displacement) does not appear as a 16-bit word or 32-bit long anywhere in the PLUG data. **MEASURED.** Zero hits in a full linear scan.
- The value `0x0000059c` (required post-patch displacement for SMSendData) does not appear as a 32-bit long anywhere in the PLUG data. **MEASURED.** Zero hits.
- The value `0x00001070` (file address of the BRA displacement) does not appear as a 32-bit long anywhere in the PLUG data. **MEASURED.** Zero hits.
- The PLUG resource contains a THINK C globals table at plug+0x25b4 (A4 base) with pre-initialized PLUG-relative code offsets (values 0x1c60, 0x1ce2, 0x1f86, etc.). None of these equals 0x0ad2 or 0x0ad0. **MEASURED.**
- Exhaustive search for `ADDA.L d16(A4), An` instructions (the pattern that would add a heap base to a globals slot) returns zero hits across the entire PLUG code. **MEASURED.** No relocation loop exists.

The PLUG resource has no relocation table and no self-relocation loop. **Candidate B3 eliminated.**

---

### 6. Harness Implications

Regardless of which candidate is correct, the harness action is the same: write `05 9c` to `heap_base + 0x0ad2` before the first SRAW invocation, where `heap_base` = runtime address of the PLUG resource data (not the handle — the dereferenced pointer).

Specifically:
- After the PLUG resource is loaded and locked: `HLock(plug_handle)`
- Dereference: `heap_base = *plug_handle`
- Write: `((uint8_t*)heap_base)[0x0ad2] = 0x05`; `((uint8_t*)heap_base)[0x0ad3] = 0x9c`

The bytes `05 9c` encode displacement = +0x059c, making `BRA.W` target = 0x160c = `SMSendData`. **MEASURED** arithmetic: Bcc.W branch target = (addr_of_instruction + 2) + displacement_signed = (0x106e + 2) + 0x059c = 0x1070 + 0x059c = 0x160c. Cross-check: current displacement 0x00f0 → target = 0x1070 + 0x00f0 = 0x1160 (TST.W D3 gate), consistent with bytes at file 0x1160 = `4a 43` (TST.W D3). SMSendData identity at 0x160c **MEASURED** from prologue bytes `4e 56 ff fa 48 e7 1f 30`.

If the calling-convention match between the SRAW `JSR 0x106e` arg push and SMSendData's prologue reads (CANDIDATE per path-a9) is correct, this single 2-byte write is sufficient to enable SRAW SCSI emission.

---

### 7. Claim Table

| Claim | Grade | Evidence (file offset + bytes) |
|-------|-------|-------------------------------|
| Bytes at file 0x106e = `60 00 00 f0` (BRA.W +0xf0) | MEASURED | xxd at file 0x106e |
| Bytes at file 0x1160 = `4a 43 66 00 00 b0` | MEASURED | xxd at file 0x1160 |
| Bytes at file 0x160c = `4e 56 ff fa 48 e7 1f 30` | MEASURED | xxd at file 0x160c |
| Bytes at file 0x0f60 = `4e b9 00 00 10 6e` | MEASURED | xxd at file 0x0f60 |
| scsi-plug-rsrc.bin is a Mac OS resource fork | MEASURED | header bytes `00 00 01 00 00 00 2e 51 00 00 2d 51 00 00 00 c4` at file 0x0000 |
| PLUG resource data at file 0x059e, length 0x28b3 | MEASURED | resource map parse: data_offset=0x100, entry at 0x059a with length 0x28b3 |
| PLUG resource attrs = 0x1c (resLocked+resProtected+resPreload) | MEASURED | resource map ref list entry |
| BRA displacement bytes at PLUG-relative 0x0ad2 (= file 0x1070) | MEASURED | 0x106e - 0x059e = 0x0ad0; displacement at +2 = 0x0ad2 |
| Post-patch displacement for SMSendData = 0x059c | MEASURED | 0x160c - 0x1070 = 0x059c |
| Zero absolute stores in scsi-plug binary | MEASURED | Exhaustive scan: patterns `33 fc`, `23 fc`, `33 cX`, `23 cX`: zero hits |
| Zero absolute stores targeting 0x1070 in sampler-editor | MEASURED | Exhaustive scan of sampler-editor: 2 total hits, neither targeting 0x1070 |
| Zero register-relative stores with d16 = 0x0ad2 in either binary | MEASURED | Exhaustive scan for `31 fc XX XX 0a d2` and `31 4X 0a d2`: zero hits |
| 0x1070 and 0x106e as literals absent from sampler-editor | MEASURED | 4-byte pattern search: zero hits |
| PLUG entry at 0x05aa does no code patching | MEASURED | `4e ba 00 f2 41 fa ff ea 20 08 a0 55 4e ba 00 90 4c df 13 07 4e fa 01 48` at 0x05ae-0x05c2 — no store opcodes |
| Secondary init 0x064c stores handle at A4@(0x266), not code | MEASURED | `29 4a 02 66` = `MOVE.L A2, A4@(0x266)` at file 0x068e |
| SMSendData has zero external call sites in scsi-plug | MEASURED | Search for `4e b9 00 00 16 0c` and BSR/BRA to 0x160c: zero hits outside SMSendData |
| Only one toolbox trap near sampler-editor ConnectToPlug | MEASURED | $A01F at 0x059dd9 in range 0x059800-0x059f00 |
| With stub, SendData is a no-op (gate1 fires, D3=0xd505) | MEASURED | D3 = 0xd505 at 0x0ec8; BRA.W +0xf0 reaches 0x1160; TST.W D3 + BNE at 0x1160-0x1162 |
| Patcher not found in either available binary | MEASURED | All search strategies exhausted with zero relevant hits |
| Post-patch bytes are `05 9c` at 0x1070-0x1071 | MEASURED | Arithmetic: 0x160c - 0x1070 = 0x059c |
| Most likely remaining candidate: shipped resource fork already contains `05 9c` | CANDIDATE | Consistent with all evidence; cannot verify without original disk image |
| PLUG globals at plug+0x25b4 contain code-relative offsets; none equal 0x0ad2 | MEASURED | Decoded globals table A4[+0..+156]: values are 0x1c60, 0x1ce2, etc.; 0x0ad2 absent |
| No ADDA.L relocation loop in PLUG code | MEASURED | Exhaustive search for `ADDA.L d16(A4), An` pattern: zero hits |
| 0x0ad2, 0x0000059c, 0x00001070 absent from all PLUG resource data | MEASURED | Full linear scan of plug+0x0000 to plug+0x28b2: zero hits as word or long |
| Candidate B3 (Mac OS relocation) eliminated | MEASURED | All three relocation evidence checks return zero |
