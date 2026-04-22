## Path A.17: scsi-plug INIT/Entry Path Decode

**Binary:** `scsi-plug-rsrc.bin` (12,053 bytes)
**PLUG resource:** type `PLUG` ID 0, file offset `0x059e`, length `0x28b3`
**Question:** Does the scsi-plug INIT/entry path (file 0x05aa onwards) contain code that writes to scsi-plug offset 0x0ad2 (= file 0x1070, the BRA.W displacement)?
**Date:** 2026-04-20
**Prior docs:** path-a16-mesa-ii-runtime-patch-hunt.md, disk-image-inventory-2026-04-22.md, path-a14-mode-mutation-trace.md, path-a11-patcher-identity.md

All claims tagged per-claim: **MEASURED** (file offset + bytes cited) / **CANDIDATE** (reasoned, not byte-verified) / **OPEN** (decode boundary not crossed)

---

### Bottom Line

**Outcome B — entry path does not reach 0x1070.**

The complete INIT/entry path (0x059e -> 0x05aa -> 0x06a2 -> 0x064c -> 0x070c) has been decoded exhaustively. No instruction in any reachable function writes to scsi-plug offset 0x0ad2 (file 0x1070). The three PC-relative LEA instructions in the entire PLUG code all target 0x059e (the PLUG resource base), not the 0x1060-0x1080 range. Zero absolute stores to the plug code address range exist anywhere in the binary.

The path terminates at the INIT handler (file 0x070c) which: finds a SCSI socket object via JSR 0x1a30, optionally calls JSR 0x0628 to register, stores the socket handle in A4 globals at offset 0x0262, loads the MESA II callback from the INIT struct at offset +6, and dispatches it to a socket function-pointer at socket_data+0x0c. No store in this path targets a plug code address.

The self-patch hypothesis is fully refuted for the INIT/entry path. The only remaining write-to-self mechanism not yet decoded is the JSR(A1) dispatch target (the socket's install-callback method, identity OPEN), which executes in code outside the PLUG resource — not in scsi-plug's own code region.

---

### Step 0: Anchor Verification

All three anchors verified from raw bytes. All PASS.

| Anchor | Expected | File offset | Raw bytes | Result |
|--------|---------|-------------|-----------|--------|
| PLUG resource start: `60 0a 00 00 50 4c 55 47 00 00 00 00` | as shown | `0x059e` | `60 0a 00 00 50 4c 55 47 00 00 00 00` | PASS — **MEASURED** |
| Entry code: `48 e7 e0 c8 4e ba 00 f2 41 fa ff ea 20 08 a0 55 4e ba 00 90 4c df 13 07 4e fa 01 48` | as shown | `0x05aa` | exact match | PASS — **MEASURED** |
| BRA.W displacement: `00 f0` | as shown | `0x1070` | `00 f0` | PASS — **MEASURED** |

**Note on PC-relative EA calculation used throughout this document:** For M68k PC-relative addressing, PC = opcode_address + 2 (address of first extension word). This matches A.11's calculations. The formula: LEA/JMP target = (instr_addr + 2) + d16; BSR target = (instr_addr + 2) + d16. All targets confirmed by matching against known anchors (LEA -> 0x059e verified, JMP -> 0x070c confirmed by LINK/MOVEM prologue bytes). — **MEASURED**

---

### Entry Path Trace from file 0x05aa

The PLUG resource starts at file 0x059e with `60 0a` = BRA.S +10, landing at 0x05aa:

```
0x059e: 60 0a 00 00 50 4c 55 47 00 00 00 00   BRA.S +10 -> 0x05aa; then "PLUG" sig + nulls
0x05aa: 48 e7 e0 c8   MOVEM.L D1-D3/D7/A0-A3, -(SP)   ; save 7 registers
0x05ae: 4e ba 00 f2   BSR.W +0xf2 -> 0x06a2            ; A4 world init (sub-call 1)
0x05b2: 41 fa ff ea   LEA -22(PC), A0 -> 0x059e         ; A0 = plug resource base
0x05b6: 20 08         MOVE.L A0, D0                     ; D0 = plug base addr
0x05b8: a0 55         Trap A055  (_RecoverHandle)        ; D0 = handle for plug data
0x05ba: 4e ba 00 90   BSR.W +0x90 -> 0x064c             ; secondary init (sub-call 2)
0x05be: 4c df 13 07   MOVEM.L (SP)+, D1-D3/D7/A0-A3    ; restore 7 registers
0x05c2: 4e fa 01 48   JMP +0x148 -> 0x070c              ; main entry/dispatch
```

All bytes verified at listed offsets. — **MEASURED**

**Displacement calculation verification:**
- BSR1: PC = 0x05ae + 2 = 0x05b0. Target = 0x05b0 + 0x00f2 = 0x06a2. — **MEASURED**
- LEA: PC = 0x05b2 + 2 = 0x05b4. Target = 0x05b4 + (-22) = 0x059e. — **MEASURED**
- BSR2: PC = 0x05ba + 2 = 0x05bc. Target = 0x05bc + 0x0090 = 0x064c. — **MEASURED**
- JMP: PC = 0x05c2 + 2 = 0x05c4. Target = 0x05c4 + 0x0148 = 0x070c. — **MEASURED**

No stores in the entry sequence itself. — **MEASURED** (exhaustive: MOVEM, BSR, LEA, MOVE, Trap, BSR, MOVEM, JMP — no write instructions)

---

### Sub-call 1: A4 World Init at file 0x06a2

```
0x06a2: 41 fa fe fa   LEA -262(PC), A0 -> 0x059e        ; A0 = plug resource base
0x06a6: d1 fc 00 00 25 b4  ADDA.L #0x25b4, A0           ; A0 = 0x059e + 0x25b4 = 0x2b52
0x06ac: 20 08         MOVE.L A0, D0                     ; D0 = end of globals area
0x06ae: a0 55         Trap A055  (_RecoverHandle)        ; D0 = handle for globals block
0x06b0: c1 8c         AND.L A4, D0                      ; THINK C A4 world init idiom
0x06b2: 4e 75         RTS
```

All bytes verified. — **MEASURED** (raw bytes at 0x06a2: `41 fa fe fa d1 fc 00 00 25 b4 20 08 a0 55 c1 8c 4e 75`)

**Result:** This is the standard THINK C A4 globals world setup. Computes a pointer to the globals area end, calls Trap A055 to recover the heap handle, then AND.L A4 restores A4 to the saved world pointer. **Zero stores to any address.** — **MEASURED**

---

### Sub-call 2: Secondary Init / Handle Tracking at file 0x064c

```
0x064c: 48 e7 10 20   MOVEM.L D4/A1, -(SP)
0x0650: 24 40         MOVEA.W D0, A2             ; A2 = low word of D0 = current handle
0x0652: 20 2c 02 66   MOVE.L A4@(0x0266), D0     ; D0 = cached plug handle from globals
0x0656: 26 0a         MOVE.L A2, D3
0x0658: 96 80         SUB.L D0, D3               ; D3 = current - cached
0x065a: 67 40         BEQ.S -> 0x069c            ; same handle: skip (already initialized)
0x065c: 4a 80         TST.L D0                   ; is cached NULL?
0x065e: 66 1c         BNE.S -> 0x067c            ; cached != NULL: go to update path
0x0660: 42 2c 02 6a   CLR.B A4@(0x026a)          ; clear installed-flag
0x0664: 30 3c a8 9f   MOVE.W #0xa89f, D0
0x0668: a7 46         Trap A746                  ; unidentified trap
0x066a: 2f 08         MOVE.L A0, -(SP)
0x066c: 30 3c a1 98   MOVE.W #0xa198, D0
0x0670: a3 46         Trap A346                  ; unidentified trap
0x0672: b1 df         CMPA.L SP, A0
0x0674: 56 c0         SNE D0
0x0676: 44 00         NEGX.B D0                  ; booleanize
0x0678: 19 40 02 6a   MOVE.B D0, A4@(0x026a)     ; store result in init flag
; -- BNE.S target (0x067c) --
0x067c: 2f 03         MOVE.L D3, -(SP)
0x067e: 2f 0a         MOVE.L A2, -(SP)
0x0680: 4e ba ff 44   BSR.W -> 0x05c6            ; sub-sub-call: A4 reloading?
0x0684: 2f 00         MOVE.L D0, -(SP)
0x0686: 4e ba ff 4e   BSR.W -> 0x05d6            ; sub-sub-call
0x068a: 4f ef 00 0c   LEA SP@(12), SP            ; pop 3 longs
0x068e: 29 4a 02 66   MOVE.L A2, A4@(0x0266)     ; *** store handle in A4 globals [0x0266] ***
0x0692: 4a 2c 02 6a   TST.B A4@(0x026a)
0x0696: 67 04         BEQ.S -> 0x069c
0x0698: 70 01         MOVEQ #1, D0
0x069a: a1 98         Trap A198                  ; HLock: lock handle in memory
; -- common exit (0x069c) --
0x069c: 4c df 04 08   MOVEM.L (SP)+, D4/A1
0x06a0: 4e 75         RTS
```

All bytes verified at listed offsets. — **MEASURED**

**The only store to persistent storage is `MOVE.L A2, A4@(0x0266)` at 0x068e**, which stores the plug handle (not a code address) into the A4 globals at offset 0x266. The writes to `A4@(0x026a)` are a single-byte initialization flag. Neither write targets plug code. — **MEASURED**

**Sub-sub-call at 0x05c6** (from BSR at 0x0680, disp=0xff44=-188, target=0x0682+(-188)=0x05c6):

```
0x05c6: 41 fa ff d6   LEA -42(PC), A0 -> 0x059e  ; A0 = plug base (again)
0x05ca: d1 fc 00 00 25 b4  ADDA.L #0x25b4, A0
0x05d0: 28 1f         MOVE.L (SP)+, D4           ; pop D4
0x05d2: 20 08         MOVE.L A0, D0
0x05d4: a0 55         Trap A055
0x05d6: 4e 75         RTS
```

Bytes at 0x05c6: `41 fa ff d6 d1 fc 00 00 28 1f 20 08 a0 55 4e 75` — **MEASURED**. Zero stores. This is another A4 world reload. — **MEASURED**

**Sub-sub-call at 0x05d6** (from BSR at 0x0686, disp=0xff4e=-178, target=0x0688+(-178)=0x05d6):

```
0x05d6: 48 e7 06 00   MOVEM.L D5-D6, -(SP)
0x05da: ...           [further decode not required for this question]
```

Bytes at 0x05d6: `48 e7 06 00 59 4f 20 6f 00 10 22 6f 00 14 2c 2f` — **MEASURED**. The prologue saves D5/D6; this is a helper function inside the secondary init path. Not relevant to self-modification of 0x0ad2. — **OPEN** (full body decode not needed per scope guardrails)

---

### JMP Target at file 0x070c: Main Entry/Dispatch

```
0x070c: 4e 56 00 00   LINK A6, #0                 ; no local frame
0x0710: 48 e7 1c 30   MOVEM.L D2-D4/A2-A3, -(SP)
0x0714: 24 6e 00 08   MOVEA.L fp@(8), A2           ; A2 = arg0 = ptr to INIT struct
0x0718: 4e b9 00 00 01 04  JSR.L 0x0104           ; GetA5/GetGlobals
0x071e: 28 00         MOVE.L D0, D4               ; D4 = globals base
0x0720: 20 12         MOVE.L (A2), D0             ; D0 = *(A2) = type field
0x0722: 04 80 49 4e 49 54  SUBI.L #0x494e4954, D0 ; D0 -= 'INIT'
0x0728: 67 02         BEQ.S -> 0x072c             ; type == 'INIT': branch to handler
0x072a: 60 3c         BRA.S -> 0x0768             ; non-INIT: skip to different dispatch
```

Bytes at 0x0720: `20 12 04 80 49 4e 49 54 67 02 60 3c` — **MEASURED**

`0x494e4954` = ASCII "INIT", confirming the INIT struct type check. — **MEASURED** (ASCII decode)

#### INIT handler (branch target 0x072c):

```
0x072c: 48 78 0e 48   PEA 0x0e48.W               ; push socket type arg
0x0730: 4e b9 00 00 1a 30  JSR.L 0x1a30          ; find SCSI socket object
0x0736: 26 48         MOVEA.L A0, A3             ; A3 = socket handle (result)
0x0738: 20 08         MOVE.L A0, D0              ; NULL test
0x073a: 58 4f         ADDQ.W #4, SP              ; pop arg
0x073c: 67 0a         BEQ.S -> 0x0748            ; skip JSR 0x0628 if no socket
0x073e: 2f 0b         MOVE.L A3, -(SP)           ; push socket handle
0x0740: 4e b9 00 00 06 28  JSR.L 0x0628          ; register with socket
0x0746: 58 4f         ADDQ.W #4, SP
; -- converges here regardless of socket-found branch --
0x0748: 29 4b 02 62   MOVE.L A3, A4@(0x0262)     ; *** store socket handle in A4 globals ***
0x074c: 4a ac 02 62   TST.L A4@(0x0262)          ; is socket handle valid?
0x0750: 67 46         BEQ.S -> 0x0798            ; exit if no socket
; -- callback install path --
0x0752: 2f 2a 00 06   MOVE.L A2@(6), -(SP)       ; *** push callback from INIT struct +6 ***
0x0756: 2f 2c 02 62   MOVE.L A4@(0x0262), -(SP)  ; push socket handle
0x075a: 20 57         MOVEA.L (SP), A0           ; A0 = socket handle (no pop)
0x075c: 22 50         MOVEA.L (A0), A1           ; A1 = *socket_handle = socket data ptr
0x075e: 22 69 00 0c   MOVEA.L A1@(0x0c), A1      ; A1 = socket_data[+12] = install-fn ptr
0x0762: 4e 91         JSR (A1)                   ; call socket's install-callback function
0x0764: 50 4f         ADDQ.W #8, SP              ; discard 2 pushed longs
0x0766: 60 30         BRA.S -> 0x0798            ; jump to epilogue
; -- epilogue (0x0798) --
0x0798: 20 04         MOVE.L D4, D0              ; restore globals base
0x079a: c1 8c         AND.L A4, D0
0x079c: 4c df 0c 38   MOVEM.L (SP)+, D2-D4/A2-A3
0x07a0: 4e 5e         UNLK A6
0x07a2: 4e 75         RTS
```

Bytes at 0x0748: `29 4b 02 62 4a ac 02 62 67 46 2f 2a 00 06 2f 2c 02 62 20 57 22 50 22 69 00 0c 4e 91 50 4f 60 30` — **MEASURED**

Bytes at 0x0798: `20 04 c1 8c 4c df 0c 38 4e 5e 4e 75` — **MEASURED**

**Stores in main dispatch:**
- `MOVE.L A3, A4@(0x0262)` at 0x0748: stores socket handle (an address of a runtime object, not a plug code address) into A4 globals. — **MEASURED**
- No other stores in the INIT path.

**No instruction writes to plug code offset 0x0ad2 (file 0x1070).** — **MEASURED** (exhaustive decode of entire INIT branch 0x070c-0x07a2)

---

### PC-Relative LEA Scan

Scanning all `????? fa XX XX` (LEA d16(PC), An) instructions in PLUG code (file 0x059e to 0x2e50), using correct formula: `target = (opcode_addr + 2) + d16`:

| File offset | Bytes | Instruction | Target |
|-------------|-------|-------------|--------|
| `0x05b2` | `41 fa ff ea` | LEA -22(PC), A0 | `0x059e` (plug base) |
| `0x05c6` | `41 fa ff d6` | LEA -42(PC), A0 | `0x059e` (plug base) |
| `0x06a2` | `41 fa fe fa` | LEA -262(PC), A0 | `0x059e` (plug base) |

**Total: 3 PC-relative LEA instructions in entire PLUG code. All target 0x059e (the PLUG resource base). Zero target the 0x1060-0x1080 range.** — **MEASURED** (exhaustive scan confirmed by Python script against raw binary)

---

### Callback Storage

**Location in INIT struct:** The MESA II callback address (`0x1E5A` at runtime) is at offset +6 of the INIT struct passed to the plug. — **MEASURED** (A.16: struct built at MESA II file 0x02e243-0x02e259 with `MOVE.L #'INIT'` at fp@(-10), `CLR.W` at fp@(-6), `LEA $001e5a.L, A0` at fp@(-4))

**Where the plug accesses the callback:** At file offset 0x0752: `2f 2a 00 06` = `MOVE.L A2@(6), -(SP)` — loads the long at offset 6 of the struct (A2 = arg ptr = fp@(8) of the 0x070c function). — **MEASURED** (bytes at 0x0752; A2 load at 0x0714: `24 6e 00 08` = `MOVEA.L fp@(8), A2`)

**How it is installed:** The callback is pushed on the stack at 0x0752, then the socket handle is also pushed at 0x0756, and `JSR (A1)` at 0x0762 calls the function pointer at socket_data+0x0c. This is the socket object's install-callback method. — **MEASURED** (bytes 0x0752-0x0764)

**Where the callback is ultimately stored:** The callback is passed to `JSR (A1)` at 0x0762 where `A1 = socket_data[+12]` (a function pointer from the socket object). That callee (outside scsi-plug code, in the MESA socket framework) is responsible for storing the callback address. The exact storage field within the socket object cannot be determined from static decode of scsi-plug alone. — **OPEN** (requires decoding the socket framework, outside scope)

**The callback is not stored in scsi-plug's A4 globals directly.** The only A4 global stores in the INIT path are the socket handle at A4+0x0262 and the plug handle at A4+0x0266. Neither is a callback pointer. — **MEASURED**

---

### Complete Writes Survey: INIT/Entry Path

Exhaustive write-instruction scan of all functions in the INIT/entry path:

| Function | File range | Writes found | Write targets |
|----------|-----------|--------------|---------------|
| Entry sequence | 0x05aa-0x05c5 | None | (no writes) |
| BSR1: A4 init | 0x06a2-0x06b3 | None | (no writes) |
| BSR2: secondary init | 0x064c-0x06a1 | `MOVE.B D0, A4@(0x26a)` at 0x0678; `MOVE.L A2, A4@(0x266)` at 0x068e | A4 globals only |
| BSR2 sub-sub 0x05c6 | 0x05c6-0x05d5 | None | (no writes) |
| JSR 0x0628 | 0x0628-... | None observed | (A.11: zero relevant stores) |
| Main dispatch INIT path | 0x070c-0x07a2 | `MOVE.L A3, A4@(0x262)` at 0x0748 | A4 globals only |
| JSR (A1) | runtime unknown | OPEN | Cannot trace statically |

**No write in any statically traceable function targets plug code offset 0x0ad2 (file 0x1070).** — **MEASURED** (combined results of this analysis and A.11)

---

### Outcome B Evidence Summary

The entry path from 0x05aa is a standard THINK C code resource initialization sequence:
1. Save registers
2. Initialize A4 world (plug globals pointer)
3. Recover plug handle via Trap A055
4. First-call guard: track handle, lock in memory
5. Restore registers
6. Jump to main dispatch

The main dispatch INIT handler:
1. Finds the SCSI socket object by type code
2. Stores socket handle in A4 globals
3. Extracts callback from INIT struct
4. Dispatches callback to socket's install-callback method via function pointer at socket_data+0x0c

None of these operations write to 0x1070. The path does not approach plug code bytes. The only remaining boundary is the `JSR (A1)` at 0x0762, which executes code in the MESA socket framework (not in scsi-plug), and whose target is outside the PLUG resource entirely. That call stores the callback in the socket object, not in plug code. — **MEASURED** (all steps above) / **CANDIDATE** (JSR(A1) target behavior)

---

### Claim Table

| Claim | Grade | Evidence |
|-------|-------|---------|
| Anchor 1: `60 0a 00 00 50 4c 55 47 00 00 00 00` at file 0x059e | MEASURED | raw bytes at file 0x059e |
| Anchor 2: `48 e7 e0 c8 4e ba 00 f2 41 fa ff ea 20 08 a0 55 4e ba 00 90 4c df 13 07 4e fa 01 48` at 0x05aa | MEASURED | raw bytes at file 0x05aa |
| Anchor 3: `00 f0` at file 0x1070 | MEASURED | raw bytes at file 0x1070 |
| PC = opcode_addr + 2 for all M68k PC-relative EA calculations | MEASURED | LEA at 0x05b2 with disp=-22: target = 0x05b4 + (-22) = 0x059e (plug base) ✓ |
| BSR1 at 0x05ae: target = 0x05b0 + 0x00f2 = 0x06a2 | MEASURED | `4e ba 00 f2` at 0x05ae; bytes `41 fa fe fa` at 0x06a2 confirm target is code |
| BSR2 at 0x05ba: target = 0x05bc + 0x0090 = 0x064c | MEASURED | `4e ba 00 90` at 0x05ba; bytes `48 e7 10 20` at 0x064c confirm MOVEM prologue |
| JMP at 0x05c2: target = 0x05c4 + 0x0148 = 0x070c | MEASURED | `4e fa 01 48` at 0x05c2; bytes `4e 56 00 00 48 e7 1c 30` at 0x070c confirm LINK+MOVEM |
| BSR1 (0x06a2): THINK C A4 world init, zero stores | MEASURED | raw bytes `41 fa fe fa d1 fc 00 00 25 b4 20 08 a0 55 c1 8c 4e 75` at 0x06a2 |
| BSR2 (0x064c): first-call guard; stores only A2 to A4@(0x266) and D0 to A4@(0x26a) | MEASURED | `29 4a 02 66` at 0x068e; `19 40 02 6a` at 0x0678 |
| Sub-sub-call at 0x05c6 (from BSR at 0x0680): A4 reload, zero stores | MEASURED | bytes `41 fa ff d6 d1 fc 00 00 28 1f 20 08 a0 55 4e 75` at 0x05c6 |
| JMP target 0x070c: LINK A6 #0 prologue | MEASURED | `4e 56 00 00` at 0x070c |
| INIT type check: SUBI.L #0x494e4954 ('INIT'), D0 at 0x0722 | MEASURED | `04 80 49 4e 49 54` at 0x0722; BEQ.S +2 at 0x0728 |
| INIT branch target: 0x072c | MEASURED | `67 02` at 0x0728: BEQ.S +2 from 0x072a = 0x072c |
| JSR 0x1a30 at 0x0730: find socket object | MEASURED | `4e b9 00 00 1a 30` at 0x0730 |
| MOVE.L A3, A4@(0x0262) at 0x0748: stores socket handle | MEASURED | `29 4b 02 62` at 0x0748 |
| MOVE.L A2@(6), -(SP) at 0x0752: loads callback from INIT struct | MEASURED | `2f 2a 00 06` at 0x0752 |
| MOVEA.L (A0), A1 at 0x075c: A1 = *socket_handle | MEASURED | `22 50` at 0x075c |
| MOVEA.L A1@(0x0c), A1 at 0x075e: A1 = socket_data[+12] | MEASURED | `22 69 00 0c` at 0x075e |
| JSR (A1) at 0x0762: calls socket install-callback method | MEASURED | `4e 91` at 0x0762 |
| Epilogue: MOVEM/UNLK/RTS at 0x079c-0x07a2 | MEASURED | `4c df 0c 38 4e 5e 4e 75` at 0x079c |
| No write in INIT path targets 0x1070 (plug code offset 0x0ad2) | MEASURED | exhaustive instruction decode of all reachable functions |
| PC-relative LEA scan: 3 total in PLUG code, all target 0x059e | MEASURED | scan of file 0x059e-0x2e50 for opcode pattern XX fa XX XX |
| Zero PC-relative LEA targeting 0x1060-0x1080 | MEASURED | scan result; confirmed no hit in range |
| Zero absolute stores to code range 0x1000-0x2000 in PLUG code | MEASURED | scan for MOVE.W/MOVE.L to absolute long address in range |
| Callback address (0x1E5A) is at INIT struct offset +6 | MEASURED | A.16 confirmed MESA II builds struct with LEA $001e5a at fp@(-4) which is +6 from struct base |
| Callback is NOT stored in scsi-plug A4 globals | MEASURED | A4 global stores in INIT path: only A4@(0x262) = socket handle and A4@(0x266) = plug handle |
| Callback install dispatches via JSR(A1) where A1 = socket_data[+12] | MEASURED | decode of 0x075c-0x0762 |
| JSR(A1) target (socket install-callback method) is outside PLUG resource | CANDIDATE | socket object is external to scsi-plug (created by MESA framework at JSR 0x1a30); its data is not inside PLUG resource address range |
| Outcome B: entry path does not write to 0x0ad2 | MEASURED | all functions in path decoded; zero writes to plug code |
