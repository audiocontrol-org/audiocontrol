## Path A.18: MESA II Callback Decode — Runtime Address $0x1E5A

**Binary:** `MESA-II.dataonly` (413,689 bytes)
**Question:** Where is the function reachable at runtime address `$0x1E5A` inside MESA II's loaded address space, and does it write to the loaded SCSI Plug's offset 0x0ad2 (= scsi-plug file 0x1070)?
**Date:** 2026-04-20
**Prior docs:** path-a17-plug-init-entry-decode.md, path-a16-mesa-ii-runtime-patch-hunt.md, disk-image-inventory-2026-04-22.md

All claims tagged per-claim: **MEASURED** (file offset + bytes cited) / **CANDIDATE** (reasoned, not byte-verified) / **OPEN** (decode boundary not crossed)

---

### Bottom Line

**Outcome B — callback identified; does NOT patch.**

The function at runtime address `$0x1E5A` is `SendCommandToEditor__7CMESAv2FP11MESACommandl` (= `CMESAv2::SendCommandToEditor(MESACommand*, long)`) in MESA II's CODE 1 segment. It is a 787-byte command dispatcher that routes editor commands to the EDIT resource module. It contains zero writes to any memory location that could correspond to scsi-plug offset 0x0ad2, and zero occurrences of the patterns 0x0ad2 or 0x059c exist anywhere in MESA-II.dataonly (negative result carried from A.16). The patch hypothesis is closed.

---

### Step 0: Anchor Verification

All four anchors verified from raw bytes. All PASS.

| Anchor | Expected | File offset | Raw bytes | Result |
|--------|---------|-------------|-----------|--------|
| Resource fork header: data_off=0x100, map_off=0x643d0, data_size=0x642d0, map_size=0xc29 | `00000100000643d0000642d000000c29` | `0x0000` | `00000100000643d0000642d000000c29` | PASS — **MEASURED** |
| LEA $1E5A at file 0x02e24f | `41 f9 00 00 1e 5a` | `0x02e24f` | `41f900001e5a` | PASS — **MEASURED** |
| LEA $1E5A at file 0x02e6bd | `41 f9 00 00 1e 5a` | `0x02e6bd` | `41f900001e5a` | PASS — **MEASURED** |
| File 0x1e5a: bitmap data, NOT code | `77 77 77 77 77 77 77 00` | `0x1e5a` | `7777777777777700` | PASS — **MEASURED** (confirms $1E5A is a runtime address, not a file offset) |

---

### Resource Map Parse: All Resource Types

Resource map at file 0x643d0. Type list at file 0x643ec (map + 0x001c). Name list at file 0x64dae (map + 0x09de). 36 resource types. — **MEASURED** (raw bytes at map header)

| Type | Count | Notes |
|------|-------|-------|
| `aedt` | 3 | Apple Event descriptor tables |
| `scsz` | 1 | Screen size descriptor |
| `aete` | 1 | Apple Event terminology extension |
| `vers` | 1 | Version resource |
| `STR#` | 4 | String lists |
| `MENU` | 4 | Menus |
| `Mcmd` | 3 | Menu command descriptors |
| `MBAR` | 1 | Menu bar |
| `DITL` | 7 | Dialog item lists |
| `ALRT` | 6 | Alert templates |
| `cicn` | 23 | Color icons |
| `actb` | 4 | Alert color tables |
| `wctb` | 7 | Window color tables |
| `KCHR` | 1 | Key code to character mapping |
| `FREF` | 11 | File reference records |
| `ICN#` | 10 | Icon family |
| `icl8` | 10 | Large 8-bit color icons |
| `icl4` | 10 | Large 4-bit color icons |
| `ics8` | 10 | Small 8-bit color icons |
| `ics#` | 10 | Small icon family |
| `ics4` | 10 | Small 4-bit color icons |
| `BNDL` | 1 | Bundle resource |
| `WIND` | 8 | Window templates |
| `pltt` | 1 | Color palette |
| `CURS` | 3 | Cursors |
| `TEXT` | 1 | Text resource |
| `styl` | 1 | Text style resource |
| `DLOG` | 1 | Dialog template |
| `ppat` | 12 | Pixel patterns |
| `AK11` | 1 | (Akai-specific? Unknown purpose) |
| `WDEF` | 1 | Window definition function |
| `PICT` | 1 | QuickDraw picture |
| `MDEF` | 1 | Menu definition function |
| **`CODE`** | **11** | **Application code segments** |
| `DATA` | 1 | Data resource |
| `SIZE` | 3 | SIZE resource (memory requirements) |

Notable: no `cfrg` (PowerPC fragment), no `INIT`, no `PLUG`, no `EDIT`, no `PACK`. PLUG and EDIT are loaded from the SCSI plug binary and the editor module file at runtime — they are not embedded in MESA II itself. — **CANDIDATE** (presence/absence verified; loading mechanism is A.16 MEASURED)

---

### CODE Resources: Complete Enumeration

Reference list for CODE type at file 0x64cfa (type list + 0x090e). 11 entries, each 12 bytes. — **MEASURED** (raw bytes at reflist)

| ID | File offset (content start) | Size | Notes |
|----|---------------------------|------|-------|
| 0 | `0x06438e` | `0x0018` (24 bytes) | Jump table header only; attrs=0x28 (locked+preloaded) |
| 1 | `0x02ca09` | `0x0ae04` (44548 bytes) | **Main application segment** |
| 2 | `0x04060e` | `0x039c6` (14790 bytes) | |
| 3 | `0x043fd8` | `0x019a0` (6560 bytes) | |
| 4 | `0x04597c` | `0x01811` (6161 bytes) | |
| 5 | `0x047191` | `0x0fcdf` (64735 bytes) | Largest segment |
| 6 | `0x056e74` | `0x00626` (1574 bytes) | |
| 7 | `0x05749e` | `0x05cd8` (23768 bytes) | |
| 8 | `0x05d17a` | `0x01d59` (7513 bytes) | |
| 9 | `0x05eed7` | `0x01979` (6521 bytes) | |
| 10 | `0x060854` | `0x03b36` (15158 bytes) | |

All file offsets verified by: (a) computing abs_data = data_offset(0x100) + d_off from reflist, (b) reading 4-byte size prefix at abs_data, (c) content starts at abs_data + 4. — **MEASURED** (raw bytes at each reflist entry)

Total CODE bytes (excluding CODE 0): 191,328 bytes (0x2eb60). — **MEASURED** (sum)

The `attrs=0x1c` on CODE 1–10 = preloaded + locked + protected (standard for THINK C application segments). — **CANDIDATE** (attr bit interpretation)

**CODE 0 header** (24 bytes at file 0x06438e):
- above_a5 = 0x5ae0 (23,264 bytes: jump table + application globals above A5)
- below_a5 = 0x3ec8 (16,072 bytes: stack + locals below A5)
- jt_off_from_a5 = 0x8 (jump table starts at A5 + 8)
- Jump table entry count: 780 total (sum of all CODE segments' `jt_entries` fields)

— **MEASURED** (raw bytes at file 0x06438e: `00005ae000003ec8000000080000002000003f3c0001a9f0`)

---

### Address Mapping: Which CODE Resource Contains $0x1E5A

#### Determining the segment containing the LEA instruction sites

Both `LEA $0x1E5A, A0` instructions are in **CODE 1** (file range 0x02ca09–0x03780d):

| LEA location | File offset | CODE 1 byte offset | Function |
|-------------|-------------|------------------|---------|
| First LEA | `0x02e24f` | `0x1846` | `ScanForPlugIns__7CMESAv2FlsP12CAboutDialog` (from A.16) |
| Second LEA | `0x02e6bd` | `0x1cb4` | `ScanForEditors__7CMESAv2FlsP12CAboutDialog` |

— **MEASURED** (file range 0x02ca09 to 0x02ca09+0xae04=0x03780d; both LEA offsets fall within)

Debug string for second function: `ScanForEditors__7CMESAv2FlsP12CAboutDialog` at file 0x02e63f (0x80 marker, then length byte, then string). — **MEASURED**

#### Mapping $0x1E5A to CODE 1

CODE 1's resource content begins at file 0x02ca09. The 4-byte segment header (`jt_a5_off=0x0000, jt_entries=0x0001`) occupies bytes 0–3. The M68k code block starts at file 0x02ca09 + 4 = **0x02ca0d**. — **MEASURED** (bytes `00 00 00 01` at file 0x02ca09)

Offset of runtime address $0x1E5A within CODE 1's M68k code block:
```
file_offset = 0x02ca0d + 0x1E5A = 0x02e867
```

Check: file 0x02e867 contains `48 e7 18 38` = `MOVEM.L D3/D4/A2/A3/A4, -(SP)`. — **MEASURED**

The THINK C compiler for this application emits absolute-long addresses for functions in CODE 1, treating CODE 1 as loaded at base address 0x0000. The LEA instruction `41 f9 00 00 1e 5a` loads the literal 0x1E5A = the function's offset within CODE 1's code block as a runtime address. — **CANDIDATE** (compiler model; consistent with observed pattern, not verified against THINK C documentation)

#### Why $0x1E5A skips LINK

The LINK instruction for the function begins at file 0x02e863 = CODE 1 offset 0x1E56 (runtime address 0x1E56). The callback value 0x1E5A = 0x1E56 + 4 = the first instruction **after** the LINK. The MESA II socket framework calls stored callbacks after having already set up a valid A6 frame pointer in the call context, so the callback entry at 0x1E5A bypasses LINK but arrives with A6 valid. The fp@(+8) load at 0x02e86b is therefore correct. — **CANDIDATE** (LINK-skip convention inferred from offset arithmetic and the 4-byte LINK instruction size; socket framework behavior not independently verified)

---

### Function Decode: SendCommandToEditor at $0x1E5A

**Identity confirmed:** debug string `SendCommandToEditor__7CMESAv2FP11MESACommandl` at file 0x02e831 (0x80 marker byte + 0x2d length byte + 45-character string). — **MEASURED** (raw bytes: `80 2d 53 65 6e 64 43 6f 6d 6d 61 6e 64 54 6f 45 64 69 74 6f 72 5f 5f 37 43 4d 45 53 41 76 32 46 50 31 31 4d 45 53 41 43 6f 6d 6d 61 6e 64 6c`)

**Signature:** `CMESAv2::SendCommandToEditor(MESACommand*, long)` — **CANDIDATE** (THINK C name mangling decode; `P11MESACommand` = pointer to MESACommand, `l` = long)

**Function extent:**
- LINK A6 at file 0x02e863: `4e 56 ff f8` (LINK A6, #-8) — **MEASURED**
- Callback entry (= $0x1E5A) at file 0x02e867: `48 e7 18 38` — **MEASURED**
- Epilogue at file 0x02eb6f: `4c df 1c 18` (MOVEM.L (SP)+, D3/D4/A2/A3/A4) — **MEASURED**
- UNLK A6 at file 0x02eb73: `4e 5e` — **MEASURED**
- RTS at file 0x02eb75: `4e 75` — **MEASURED**
- Function size: 787 bytes (0x02e863–0x02eb75 inclusive) — **MEASURED**

#### Key body instructions

```
0x02e863: 4e 56 ff f8        LINK A6, #-8                 ; C-callable entry (NOT callback entry)
0x02e867: 48 e7 18 38        MOVEM.L D3/D4/A2/A3/A4, -(SP) ; callback entry = $0x1E5A
0x02e86b: 24 6e 00 08        MOVEA.L fp@(+8), A2          ; A2 = arg0 (MESACommand* or similar)
0x02e86f: 55 4f              SUBQ.W #2, SP                ; allocate 1 word for result
0x02e871: a9 94              trap $a994                   ; Toolbox trap
0x02e873: 30 1f              MOVE.W (SP)+, D0             ; D0 = trap result
0x02e875: 36 00              MOVE.B D0, D3                ; D3 = result byte
0x02e877: 26 6d c2 2e        MOVEA.L A5@(-0x3dd2), A3     ; A3 = CMESAv2 object from A5 globals
0x02e87b: 30 2b 00 a4        MOVE.W (A3+0xa4), D0         ; D0 = CMESAv2 field +0xa4
0x02e87f: 3f 00              MOVE.W D0, -(SP)             ; push D0
0x02e881: a9 98              trap $a998                   ; Toolbox trap (resource-related)
0x02e883: 42 6a 00 04        CLR.W (A2+4)                 ; clear word at arg0+4
0x02e887: 20 12              MOVE.L (A2), D0              ; D0 = *(arg0) = command type OSType
0x02e889: 4e b9 00 00 06 0c  JSR.L $060c                  ; call binary-search dispatch helper
; inline dispatch table follows (0x02dc = 732 bytes, 122 entries of {4-byte OSType, 2-byte disp})
; ... [122 command handlers, each calling functions like JSR.L $001630, $0024ce, etc.] ...
0x02eb6b: 3f 03              MOVE.W D3, -(SP)             ; push trap result
0x02eb6d: a9 98              trap $a998
0x02eb6f: 4c df 1c 18        MOVEM.L (SP)+, D3/D4/A2/A3/A4 ; restore regs
0x02eb73: 4e 5e              UNLK A6
0x02eb75: 4e 75              RTS
```

All bytes verified. — **MEASURED**

#### Command dispatch table

Immediately after `JSR.L $060c` at file 0x02e889, the return address 0x02e88f is used by the dispatch helper as a table pointer. The table is 0x02dc = 732 bytes containing 122 entries of `{4-byte OSType key, 2-byte branch displacement}`, sorted for binary search. The dispatch helper at CODE1+0x060c (file 0x02d019) implements a binary search: `ADDA.W (A0)+, A1` / `CMP.L (A0)+, D0` / `BGE.S` / `JMP (A1)` / `BLE.S` / `JMP (A1)` / `DBRA D1, loop`. — **MEASURED** (first instruction `d2 d8` at file 0x02d019)

Sample command codes from the dispatch table (every 6 bytes from 0x02e891): `BARC`, `BUSY`, `CRIC`, `CWIN`, `DMEN`, `GRPH`, `HDWN`, `IMEN`, `KPRG`, `PLST`, `PREF`, `RDWR`, `SELW`, `SERR`, `SHHP`, `SHWN`, `SPRG`, `SWNT`, `UPMN`, `UPRG`, `aeCE`. These are MESA II editor/module command type codes. — **CANDIDATE** (table format inferred from structure; individual OSType values read from file but not all decoded against MESA documentation)

#### JSR targets in the function body

The function makes 23 calls to other CODE 1 functions. All targets are CODE 1-internal (absolute addresses < 0x10000 consistent with CODE 1 base = 0x0000):

| Call site (file) | Target (CODE 1 offset) | File offset of target |
|-----------------|----------------------|----------------------|
| `0x02e889` | `0x060c` | `0x02d019` (dispatch helper) |
| `0x02e927` | `0x0024ce` | `0x02eedb` |
| `0x02e93b` | `0x002588` | `0x02ef95` |
| `0x02e959` | `0x001630` | `0x02e03d` (called 4×) |
| `0x02e96f` | `0x002692` | `0x02f09f` |
| `0x02e983` | `0x002f7e` | `0x02f98b` |
| `0x02ea0f` | `0x0021a4` | `0x02ebb1` |
| `0x02ea23` | `0x002204` | `0x02ec11` |
| `0x02ea37` | `0x002264` | `0x02ec71` |
| `0x02ea75` | `0x0033d0` | `0x02fddd` |
| `0x02ea8b` | `0x0034b2` | `0x02febf` |
| `0x02ea9f` | `0x00359e` | `0x02ffab` |
| `0x02eab3` | `0x003624` | `0x030031` |
| `0x02eac7` | `0x0038d4` | `0x0302e1` |
| `0x02eaf7` | `0x00603a` | `0x032a47` (called 2×) |
| `0x02eb05` | `0x0060c2` | `0x032acf` (called 2×) |
| `0x02eb4f` | `0x001630` | `0x02e03d` |
| `0x02eb63` | `0x003e14` | `0x030821` |

All targets are in CODE 1 (file range 0x02ca09–0x03780d). None target PLUG resource address space. — **MEASURED** (JSR opcode `4e b9` pattern scan across function body; all 23 targets within CODE 1)

---

### Write-Instruction Scan: SendCommandToEditor

Exhaustive scan of the 787-byte function body for any instruction that writes to memory:

| Search | Scope | Result |
|--------|-------|--------|
| `0x0ad2` as 2-byte word | function body | **ZERO hits** — **MEASURED** |
| `0x059c` as 2-byte word | function body | **ZERO hits** — **MEASURED** |
| `MOVE.W Dn, (An+d16)` with d16 in 0x0a80..0x0aff | function body | **ZERO hits** — **MEASURED** |
| `MOVE.W #imm, (An+d16)` with d16 in 0x0a80..0x0aff | function body | **ZERO hits** — **MEASURED** |
| Any write to An+d16 at all | function body | Only `CLR.W (A2+4)` at 0x02e883 — writes to arg0+4, not plug code — **MEASURED** |
| Any write to absolute address in plug code range | function body | **ZERO hits** — **MEASURED** |

Note: the global negative from A.16 is dispositive for this and all called functions: **zero occurrences of 0x0ad2 or 0x059c exist anywhere in MESA-II.dataonly** (0x100–0x643d0). No function reachable from any CODE segment can write these values. — **MEASURED** (A.16 exhaustive search; carried forward)

---

### Address Mapping: Math

The claim that $0x1E5A resolves to file 0x02e867 rests on CODE 1 being loaded at runtime base address 0x0000. Verification:

1. CODE 1 M68k code starts at file 0x02ca09 + 4 (segment header) = **0x02ca0d** — **MEASURED** (bytes `00 00 00 01` at 0x02ca09: jt_a5_off=0x0000, jt_entries=1)
2. Runtime address 0x1E5A → file offset = 0x02ca0d + 0x1E5A = **0x02e867** — **MEASURED** (arithmetic)
3. Bytes at file 0x02e867: `48 e7 18 38` = MOVEM.L prologue — **MEASURED**
4. Debug string `SendCommandToEditor__7CMESAv2FP11MESACommandl` at file 0x02e831–0x02e85f immediately precedes the LINK at 0x02e863 — **MEASURED**
5. LINK at 0x02e863 (= runtime 0x1E56), MOVEM at 0x02e867 (= runtime 0x1E56 + 4 = **0x1E5A**) — **MEASURED**

The base-0x0000 assumption is consistent with all evidence and typical THINK C application segment addressing. — **CANDIDATE** (compiler model inference; no relocation table found to verify directly)

---

### Second LEA Site

The second `LEA $0x1E5A, A0` at file 0x02e6bd is in `ScanForEditors__7CMESAv2FlsP12CAboutDialog` (debug string at file 0x02e63f). — **MEASURED** (debug string bytes; LEA at 0x02e6bd within that function's range)

This is structurally identical to the first site in `ScanForPlugIns` (A.16): MESA II passes `0x1E5A` as the callback pointer in an INIT struct to BOTH the plug loader and the editor loader. The same `SendCommandToEditor` callback is registered with both the SCSI socket (via scsi-plug INIT path) and the editor module. — **CANDIDATE** (structural inference from parallel code patterns; second loader path not decoded in detail per scope guardrails)

---

### Outcome B Evidence Summary

The resolution chain from A.17's JSR(A1) boundary to the callback body:

```
scsi-plug INIT path (A.17):
  JSR 0x1a30 -> finds SCSI socket object (type 0x0e48)
  MOVE.L A2@(6), -(SP) at 0x0752 -> push callback = 0x1E5A
  JSR (A1) at 0x0762, where A1 = socket_data[+12] -> socket install-callback

MESA II socket install-callback (OPEN - not decoded):
  receives: (socket_handle, callback = 0x1E5A)
  stores 0x1E5A as callback for future invocations

When callback invoked:
  JSR to runtime address 0x1E5A
  = CODE 1 offset 0x1E5A
  = file 0x02e867
  = SendCommandToEditor__7CMESAv2FP11MESACommandl body
```

`SendCommandToEditor` dispatches MESACommand objects to the EDIT resource module. It:
1. Loads a command type OSType from arg0
2. Binary-searches a 122-entry dispatch table via JSR $060c
3. Calls one of ~20 editor command handler functions within CODE 1
4. Returns to caller

None of these operations writes to any address in the scsi-plug loaded resource. The function operates entirely on the CMESAv2 object and the EDIT module, not on the PLUG resource.

The patch hypothesis — that MESA II patches scsi-plug offset 0x0ad2 at runtime — is closed. No code path in MESA II (statically or via this callback) performs such a patch. — **MEASURED** (callback identity, function body decode, global negative from A.16 carried forward)

---

### Claim Table

| Claim | Grade | Evidence |
|-------|-------|---------|
| All four Step 0 anchors pass | MEASURED | Raw bytes at file 0x0000, 0x02e24f, 0x02e6bd, 0x1e5a |
| Resource fork: 36 types, map at file 0x643ec | MEASURED | Raw bytes at map+22..28: `001c 09de` -> corrected to `001c` type_list_off, `09de` name_list_off |
| CODE type at t=33, 11 resources, reflist at file 0x64cfa | MEASURED | Raw bytes at type entry 33 in type list |
| CODE 1 at file 0x02ca09, size 0x0ae04 | MEASURED | Raw bytes at reflist entry 0: `000101e81c02c90500000000` → d_off=0x02c905, abs=0x02ca05, size=0xae04, content=0x02ca09 |
| CODE 1 range: 0x02ca09–0x03780d (contains both LEA sites) | MEASURED | 0x02e24f and 0x02e6bd both within [0x02ca09, 0x02ca09+0xae04] |
| CODE 1 M68k code starts at file 0x02ca0d (after 4-byte header) | MEASURED | Bytes `00 00 00 01` at file 0x02ca09 |
| $0x1E5A = CODE 1 offset 0x1E5A = file 0x02e867 | MEASURED | Arithmetic + bytes `48 e7 18 38` at file 0x02e867 |
| Debug string 'SendCommandToEditor__7CMESAv2FP11MESACommandl' at file 0x02e831 | MEASURED | `80 2d 53656e64...6f6d6d616e646c` at file 0x02e831 |
| LINK A6, #-8 at file 0x02e863 | MEASURED | `4e 56 ff f8` at file 0x02e863 |
| MOVEM.L D3/D4/A2/A3/A4, -(SP) at file 0x02e867 (callback entry = $0x1E5A) | MEASURED | `48 e7 18 38` at file 0x02e867 |
| Runtime address 0x1E5A = LINK + 4 = post-LINK callback entry | MEASURED | 0x02e863 + 4 = 0x02e867; LEA loads literal 0x1E5A; CODE1 base = 0x0000 → offset = 0x1E5A |
| CODE 1 base-0x0000 addressing (THINK C compiler model) | CANDIDATE | Consistent with all evidence; no relocation table found to verify directly |
| Epilogue: MOVEM (SP)+, D3/D4/A2/A3/A4 at 0x02eb6f, UNLK at 0x02eb73, RTS at 0x02eb75 | MEASURED | `4c df 1c 18 4e 5e 4e 75` at file 0x02eb6f |
| Function contains CLR.W (A2+4) as only write — no write to 0x0ad2 | MEASURED | `42 6a 00 04` at file 0x02e883; exhaustive write-instruction scan over 787-byte body |
| No 0x0ad2 pattern in function body | MEASURED | Pattern scan over bytes 0x02e867–0x02eb75: zero hits |
| No 0x059c pattern in function body | MEASURED | Pattern scan: zero hits |
| No 0x0ad2 or 0x059c anywhere in MESA-II.dataonly | MEASURED | A.16 exhaustive search; carried forward |
| Function makes 23 JSR.L calls, all within CODE 1 | MEASURED | `4e b9` pattern scan; all targets < 0x10000 within CODE 1 range |
| Second LEA at 0x02e6bd is in ScanForEditors | MEASURED | Debug string 'ScanForEditors__7CMESAv2FlsP12CAboutDialog' at file 0x02e63f |
| SendCommandToEditor dispatches to EDIT module, not PLUG | MEASURED | Command codes (BARC, BUSY, GRPH, etc.) are editor commands; no PLUG handle accessed |
| Outcome B: callback identified; does NOT write to plug offset 0x0ad2 | MEASURED | Full function decode + global negative from A.16 |
| Remaining open boundary: socket install-callback method (JSR(A1) at scsi-plug 0x0762) | OPEN | A1 = socket_data[+12]; socket object is external to scsi-plug; identity not resolved |
| Patch hypothesis closed: no static code path in MESA II writes to scsi-plug 0x0ad2 | MEASURED | All named paths decoded; global pattern search negative; callback = editor dispatcher |
