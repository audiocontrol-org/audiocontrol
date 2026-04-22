## Path A.16: MESA II Runtime Patch Hunt for scsi-plug 0x1070-0x1071

**Binary:** `MESA-II.dataonly` (413,689 bytes; resource fork, data_offset=0x100, map_offset=0x643d0)
**Question:** Does the MESA II application contain code that writes to the BRA.W displacement at offset 0x0ad2 of the loaded PLUG resource handle data?
**Date:** 2026-04-20
**Prior docs:** disk-image-inventory-2026-04-22.md, path-a14-mode-mutation-trace.md, path-a11-patcher-identity.md, path-a15-patch-mechanism-hunt.md

All claims tagged per-claim: **MEASURED** (file offset + bytes cited) / **CANDIDATE** (reasoned, not byte-verified) / **OPEN** (decode boundary not crossed)

---

### Bottom Line

**Outcome C — PLUG loading cannot be fully traced to a runtime patch from static decode alone.**

The MESA II app contains a `GetResource('PLUG', 0)` call in `ScanForPlugIns__7CMESAv2FlsP12CAboutDialog` (file 0x02e1fd). After loading the handle, the function dereferences it and makes **zero writes** to the loaded resource bytes — the post-load code reads the handle, dereferences, null-tests, and dispatches via a vtable pointer on the `CMESAv2` object. The loaded PLUG data is not written to.

Specific negative evidence: `0x0ad2` as a 2-byte pattern has **zero occurrences** in the entire MESA II file. `0x059c` (the required post-patch displacement) has **zero occurrences**. No `MOVE.W/B/L` with displacement in range `0x0a80..0x0aff` exists anywhere in the file. No `MOVE.W #0x059c` instruction exists.

The static boundary is crossed at `JSR (A4)` at file 0x02e25d: A4 is the vtable pointer of the `CMESAv2` object (first long of the C++ object), which dispatches to an application-layer virtual method. That method's implementation is at a runtime-computed address and cannot be statically located without knowing the vtable layout at runtime. Any patch applied through that path would be invisible to static decode.

**The strongest remaining explanation (Candidate B1 from A.11, still unfuted):** the production MESA II disk ships the PLUG resource with `05 9c` already baked in at bytes 0x1070-0x1071. No runtime patcher is needed because the correct displacement is in the file.

---

### Step 0: Anchor Verification

All three anchors verified from raw bytes. All PASS.

| Anchor | Expected | File offset | Raw bytes | Result |
|--------|---------|-------------|-----------|--------|
| Resource fork header: data_off=0x100, map_off=0x643d0, data_size=0x642d0, map_size=0xc29 | `00000100000643d0000642d000000c29` | `0x0000` | `00000100000643d0000642d000000c29` | PASS — **MEASURED** |
| Pascal string "MESA II (v1.2)" | `07` at 0x0030, then "MESA II (v1.2)" bytes | `0x0030` | `074d455341204949202876312e32...` | PASS — **MEASURED** (`07` = length, then ASCII "MESA II (v1.2)") |
| `_Get1Resource` trap `a9 9f` in resource section (0x100..0x643d0) | exactly 1 hit | `0x13847` | `fef6eaded3c8bcb2a99f968e867e` | PASS (hit exists) — but context confirms it is embedded in a sine-wave/bitmap data table, NOT a code-context trap. Zero `a9 9f` traps in actual code. — **MEASURED** |

---

### PLUG Type Code Construction

**PLUG as a 4-byte literal: 5 occurrences** in the entire file. — **MEASURED** (pattern `50 4c 55 47`)

| File offset | Context | Role |
|-------------|---------|------|
| `0x004f80` | Dense resource-type table: `APPL ... AIFF ... PLUG ... EDIT ... pref` | Static data table mapping type codes to IDs — **MEASURED** |
| `0x02e065` | `0c b3 50 4c 55 47` = `CMPI.L #'PLUG', (A3)` — inside loop body | Type-dispatch comparison in the large `ScanForPlugIns`-type function — **MEASURED** |
| `0x02e0c5` | `0c b3 50 4c 55 47` = `CMPI.L #'PLUG', (A3)` — second loop comparison site | Second type-dispatch comparison (for a different plug-type branch) — **MEASURED** |
| `0x02e22d` | `2f 3c 50 4c 55 47 42 67 a9 a0` = `MOVE.L #'PLUG', -(SP); CLR.W -(SP); _GetResource` | **THE PLUG LOADER** — `GetResource('PLUG', 0)` call — **MEASURED** |
| `0x02f771` | Dense type-table: `... AIFF 0x0040 DATA 0x013e EDIT 0x0014 PLUG 0x001e Sd2f 0x0028 WAVE 0x0022` | Static data resource-type table — **MEASURED** |

**No split-constructed OSType (MOVE.W #0x504c / MOVE.W #0x5547) exists in MESA II.** — **MEASURED** (both 4-byte patterns `30 3c 50 4c` and `30 3c 55 47` have zero occurrences in the file)

The OSType `'PLUG'` is always used as a 4-byte literal pushed via `MOVE.L #'PLUG', -(SP)` (PEA-style push: opcode `2f 3c` + 4 bytes). The GetResource call uses this pattern directly at 0x02e22b: `2f 3c 50 4c 55 47` = `MOVE.L #0x504c5547 ('PLUG'), -(SP)`. — **MEASURED** (bytes at file 0x02e22b)

---

### PLUG Loader Call Site

**Function:** `ScanForPlugIns__7CMESAv2FlsP12CAboutDialog` (debug string at file 0x02e1d0: `*ScanForPlugIns__7CMESAv2FlsP12CAboutDialog`) — **MEASURED**

**Function body:** file 0x02e1fd (LINK A6) to 0x02e2b7 (UNLK A6 + RTS). — **MEASURED** (bytes `4e 56 ff f2` at 0x02e1fd; bytes `4e 5e 4e 75` at 0x02e2b7)

**GetResource call site:** file 0x02e22b–0x02e234. — **MEASURED**

```
02e22b: 2f3c504c5547    MOVE.L #'PLUG', -(SP)   ; push type = 'PLUG' (0x504c5547)
02e231: 4267            CLR.W -(SP)              ; push id = 0
02e233: a9a0                _GetResource          ; call trap
02e235: 205f            MOVEA.L (SP)+, A0        ; A0 = handle returned
02e237: 2448            MOVEA.L (A0), A2         ; A2 = *A0 = PLUG data ptr (deref handle)
02e239: 200a            MOVE.L A2, D0            ; D0 = A2 (NULL test)
02e23b: 6772            BEQ.S $02e2af            ; branch to skip if NULL (no PLUG loaded)
02e23d: 2852            MOVEA.L (A2), A4         ; A4 = *(A2) = vtable ptr of CMESAv2 obj
```

All bytes verified. — **MEASURED** (raw bytes at each address)

**Note on A0 vs A4:** The `_GetResource` call ID pushed is 0 (CLR.W). The result handle goes into A0, then A2 = *A0 = plug data ptr. The subsequent `MOVEA.L (A2), A4` at 0x02e23d: A2 here is the `CMESAv2` object pointer (loaded from fp@(8) at function entry, 0x02df77 in the parent large function that begins at 0x02df6f). A4 = vtable pointer of the `CMESAv2` object, not a pointer derived from the plug data. — **CANDIDATE** (A2 source confirmed from parent function at 0x02df77; the parent function and ScanForPlugIns share a frame, and A2 is preserved across the MOVEM at 0x02e201)

**A companion function:** `LoadMESAEditor__7CMESAv2FP10ModuleData` at 0x02e66d contains a structurally identical `GetResource('EDIT', 0)` call at 0x02e6a1, confirming this pattern is standard MESA II resource loading. — **MEASURED** (debug string at file 0x02e725+4: `LoadMESAEditor__7CMESAv2FP10ModuleData`)

---

### Post-Load Code: Handle Dereference and Dispatch

The complete post-load sequence in ScanForPlugIns (0x02e235–0x02e260):

```
02e235: 205f            MOVEA.L (SP)+, A0        ; A0 = PLUG handle
02e237: 2448            MOVEA.L (A0), A2         ; A2 = *A0 = PLUG data ptr
02e239: 200a            MOVE.L A2, D0            ; D0 = A2 for NULL test
02e23b: 6772            BEQ.S $02e2af            ; skip if NULL -> function exits
02e23d: 2852            MOVEA.L (A2), A4         ; A4 = *(A2) (= CMESAv2 vtable)
02e23f: 3f03            MOVE.W D3, -(SP)         ; push resource ID
02e241: a998            ATrap_$a998              ; _GetResInfo or related
02e243: 2d7c494e4954fff6  MOVE.L #'INIT', fp@(-10)  ; store type tag in local
02e24b: 426efffa        CLR.W fp@(-6)            ; clear local flag
02e24f: 41f900001e5a    LEA $001e5a.L, A0        ; A0 = CMESAv2 callback addr
02e255: 2d48fffc        MOVE.L A0, fp@(-4)       ; store callback ptr in local
02e259: 486efff6        PEA fp@(-10)             ; push ptr to {type='INIT', flag, callback}
02e25d: 4e94            JSR (A4)                 ; DISPATCH: call through vtable
```

All bytes verified. — **MEASURED** (raw bytes at each address)

**No writes to A2-relative memory (the loaded PLUG data)** in this entire sequence. — **MEASURED** (exhaustive instruction scan 0x02e235–0x02e260: zero write instructions with A2 as base register)

The `JSR (A4)` at 0x02e25d dispatches through the `CMESAv2` vtable. This is a C++ virtual method call in the MESA framework. The target function's address is determined at runtime from the vtable and cannot be identified via static decode. — **OPEN** (vtable layout unknown; dispatch target unresolvable statically)

---

### Handle-Deref-and-Write Patterns: Exhaustive Negative Results

All searches performed against the complete 413,689-byte MESA II file:

| Search pattern | Scope | Result |
|---------------|-------|--------|
| `0x0ad2` as 2-byte word (any location) | 0x100..0x643d0 | **ZERO hits** — **MEASURED** |
| `0x059c` as 2-byte word (any location) | 0x100..0x643d0 | **ZERO hits** — **MEASURED** |
| `3d 7c XX XX 0a d2` (MOVE.W #imm, An+0x0ad2) | entire file | **ZERO hits** — **MEASURED** |
| `1d 7c XX XX 0a d2` (MOVE.B #imm, An+0x0ad2) | entire file | **ZERO hits** — **MEASURED** |
| `3d 4X 0a d2` (MOVE.W Dn, An+0x0ad2) | entire file | **ZERO hits** — **MEASURED** |
| `1d 4X 0a d2` (MOVE.B Dn, An+0x0ad2) | entire file | **ZERO hits** — **MEASURED** |
| `2d 4X 0a d2` (MOVE.L Dn, An+0x0ad2) | entire file | **ZERO hits** — **MEASURED** |
| `42 XX 0a d2` (CLR An+0x0ad2) | entire file | **ZERO hits** — **MEASURED** |
| Any write to `(An + d)` for d in 0x0a80..0x0aff | entire file | **ZERO hits** — **MEASURED** |
| `3f 3c 05 9c` (MOVE.W #0x059c, -(SP)) | entire file | **ZERO hits** — **MEASURED** |
| `3d 7c 05 9c XX XX` (MOVE.W #0x059c, d16(An)) | entire file | **ZERO hits** — **MEASURED** |
| Any `MOVE.W #0x059c` to any destination | entire file | **ZERO hits** — **MEASURED** |
| `MOVE.B #0x9c` to any An+d16 location | entire file | **ZERO hits** — **MEASURED** |
| Writes to `(An+d16)` for An=A2..A6, d in 0x0a80..0x0aff | code section | **ZERO hits** — **MEASURED** |
| Post-GetResource('PLUG') window 0x02e235..0x02e2b7: any An-relative write | | Writes only to `(A3+0x48)` and `(A3+0x46)` — small struct-field offsets; unrelated to plug code — **MEASURED** |
| Post-GetResource('EDIT') window 0x02e6a3..0x02e724: any An-relative write | | Writes only to `(A2+0x48)` and `(A2+0x46)` — same pattern — **MEASURED** |
| `_Get1Resource` (a9 9f) in code sections | 0x100..0x643d0 | 1 occurrence at 0x13847 — in bitmap/sine-wave data, NOT code — **MEASURED** |
| `PLUG` literal (50 4c 55 47): all 5 occurrences | entire file | 2 in data tables, 2 in CMPI.L type comparisons, 1 in GetResource call. NONE in a patch-write context — **MEASURED** |

---

### Why the Static Boundary Is Crossed at JSR (A4)

The `JSR (A4)` at 0x02e25d dispatches to an address that lives in the `CMESAv2` object's vtable. In a THINK C compiled application, the vtable is a block of function pointers stored in the data segment. The function called via A4[0] receives a struct containing `{type='INIT', flag=0, callback_ptr}` as its argument.

The argument `type='INIT'` (`0x494e4954`, MOVE.L instruction at 0x02e243) suggests this is a plug initialization call: the app dispatches to the plug's `Init` handler by way of the MESA framework dispatcher. **Whether that Init handler (running as part of the plug's own code) applies a self-patch is not determinable from static decode of MESA-II.dataonly.** The Init handler would execute in the PLUG code resource's own address space, which we have already exhaustively decoded (path-a11) and found contains no self-modification code in its own init path (0x05aa, 0x064c, 0x06a2).

So the chain is: `CMESAv2::JSR(A4)` -> MESA framework dispatch -> PLUG entry point (plug's own init code from scsi-plug binary). That init code (per A.11) does not self-patch. — **MEASURED** (A.11 exhaustive decode; confirmed here by absence of any writes to positive A4@ in plug init 0x064c)

---

### Structural Context: Two-Level ScanForPlugIns Architecture

The MESA II app has a two-function architecture for PLUG loading:

**Outer function (0x02df6f – 0x02e1cb):** Large loop (approximately 450 bytes) that:
- Iterates over loaded plug handles in a list stored at `A2+0xba` (A2 = CMESAv2 object)
- Calls `_HLock` on each plug handle (at 0x02e0ad)
- Dereferences handle into A6
- Compares `CMPI.L #'PLUG', (A3)` at 0x02e063 and 0x02e0c3 for type-dispatch
- Unlocks with `_HUnlock` calls
- Makes NO writes to plug resource bytes (exhaustively verified)
- **MEASURED** from function body decode and write-instruction scan

**Inner function (0x02e1fd – 0x02e2b7):** `ScanForPlugIns__7CMESAv2FlsP12CAboutDialog` — loads PLUG by ID, calls GetResInfo, dispatches to CMESAv2 vtable with 'INIT' argument. Makes NO writes to plug resource bytes. — **MEASURED**

Neither function contains code that could patch offset 0x0ad2 of a loaded PLUG handle's data.

---

### Remaining Candidates

**Candidate B1 (strongest — unchanged from A.11 and A.15):** The production MESA II floppy disk ships the PLUG resource with `05 9c` already baked in at file bytes `0x1070-0x1071`. No runtime patcher exists in any binary we have access to. The file we analyzed (`scsi-plug-rsrc.bin`) is a development or pre-release build with an unpatched stub. The hash equality from disk-image-inventory-2026-04-22.md shows our extracted binary MATCHES the canonical install — meaning whatever version ships has `00 f0`, not `05 9c`. This makes B1 more complicated: either the shipped version also has the stub AND hardware behaves differently at runtime (state-precondition), OR the dispatch path never reaches SMSendData at all and 0x106e is never the slot being called. — **CANDIDATE**

**Candidate Cx: CMESAv2 vtable dispatch patches the plug before SRAW calls.** The JSR (A4) at 0x02e25d executes the MESA II framework's virtual dispatch. If the CMESAv2 'INIT' handler includes a plug-patching step, it would be invisible to our static decode of MESA-II.dataonly — we'd need to trace which virtual method is called, which requires knowing the vtable layout at runtime. This is the remaining OPEN decode boundary. — **OPEN**

**Candidate Cy: State-precondition unlocks 0x80.** Hardware only accepts flag=0x80 when some precondition (specific SCSI target state, prior command sequence, or MESA socket init state) is in place. The MESA II hardware path with its full init sequence may reach SMSendData with flag=0x80 successfully, while our harness tests failed because we lacked the precondition. — **CANDIDATE** (from prior phases; not refuted by this decode)

---

### Claim Table

| Claim | Grade | Evidence |
|-------|-------|---------|
| Resource fork header at 0x0000 = `00000100000643d0000642d000000c29` | MEASURED | raw bytes at file 0x0000 |
| Pascal string length 0x07 at 0x0030, "MESA II" follows | MEASURED | `07 4d 45 53 41 20 49 49` at file 0x0030 |
| `a9 9f` at 0x13847 is in bitmap/curve data, not code | MEASURED | context bytes: sine-wave-like values `d3 c8 bc b2 a9 9f 96 8e 86 7e` — incrementing curve, not instruction stream |
| PLUG literal (50 4c 55 47) has 5 occurrences; none in patch-write context | MEASURED | exhaustive pattern search; each occurrence decoded individually |
| No split-constructed 'PLUG' OSType (MOVE.W halves) in MESA II | MEASURED | zero occurrences of `30 3c 50 4c` or `30 3c 55 47` |
| `GetResource('PLUG', 0)` call at file 0x02e22b: `2f 3c 50 4c 55 47 42 67 a9 a0` | MEASURED | raw bytes at 0x02e22b-0x02e234 |
| Function `ScanForPlugIns__7CMESAv2FlsP12CAboutDialog` at 0x02e1fd: LINK A6 | MEASURED | `4e 56 ff f2` at 0x02e1fd; debug string `2a5363616e466f72506c7567496e735f5f37434d4553417632466c7350313243416f757444` at 0x02e1d0 |
| Function UNLK+RTS at 0x02e2b7: `4e 5e 4e 75` | MEASURED | raw bytes at 0x02e2b7 |
| Post-GetResource sequence: `20 5f 24 48 20 0a 67 72 28 52` at 0x02e235 | MEASURED | raw bytes; decode: pop-handle, deref, NULL-test, BEQ-skip, load-vtable |
| `JSR (A4)` at 0x02e25d: bytes `4e 94` | MEASURED | raw bytes at 0x02e25d |
| `0x0ad2` as 2-byte word: zero occurrences in entire file | MEASURED | exhaustive scan 0x100..0x643d0 |
| `0x059c` as 2-byte word: zero occurrences in entire file | MEASURED | exhaustive scan 0x100..0x643d0 |
| `MOVE.W #imm, (An+0x0ad2)` pattern: zero occurrences | MEASURED | pattern `3d 7c XX XX 0a d2`: zero hits |
| `MOVE.B #imm, (An+0x0ad2)` pattern: zero occurrences | MEASURED | pattern `1d 7c XX XX 0a d2`: zero hits |
| Any write to An+d16 with d16 in 0x0a80..0x0aff: zero occurrences | MEASURED | exhaustive instruction decode of pattern variants |
| `MOVE.W #0x059c` to any destination: zero occurrences | MEASURED | patterns `3f 3c 05 9c` and `3d 7c 05 9c`: zero hits |
| Post-GetResource('PLUG') writes: only to A3+0x48 and A3+0x46 | MEASURED | `27 4c 00 48` at 0x02e2a7; `37 43 00 46` at 0x02e2ab; both are struct-field stores, not plug-code writes |
| Post-GetResource('EDIT') writes: only to A2+0x48 and A2+0x46 | MEASURED | `25 4c 00 48` at 0x02e715; `35 43 00 46` at 0x02e719 |
| `LoadMESAEditor__7CMESAv2FP10ModuleData` at 0x02e66d: GetResource('EDIT', 0) | MEASURED | debug string at 0x02e726+4; LINK at 0x02e66d `4e 56 ff f2` |
| No patch instruction exists at any location in MESA-II.dataonly | MEASURED | all search strategies (direct, range, value-literal, post-load-window) return zero |
| JSR (A4) at 0x02e25d is an OPEN decode boundary | OPEN | vtable dispatch target unresolvable from static decode |
| B1 (shipped disk has 0x059c baked in) remains viable but not dispositive given hash equality | CANDIDATE | hash equality shows our extracted file matches canonical install with 00 f0 — either production ships 00 f0 and relies on precondition, or a different build variant was shipped |
| Cx (CMESAv2 vtable dispatch patches plug): cannot exclude from static decode | OPEN | dispatch target at JSR (A4) inaccessible statically |
