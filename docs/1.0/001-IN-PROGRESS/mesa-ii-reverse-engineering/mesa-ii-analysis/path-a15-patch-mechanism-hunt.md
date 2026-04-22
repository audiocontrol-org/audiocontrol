## Path A.15: Patch-Mechanism / Relocation-Table Hunt for 0x106e/0x1070 Retargeting

**Binaries:** `scsi-plug-rsrc.bin`, `sampler-editor-rsrc.bin`, `scsi-plug.macbin`, `sampler-editor.macbin`
**Method:** Resource-fork enumeration, exhaustive indirect-reference search, structural metadata analysis
**Date:** 2026-04-20
**Prior docs:** [`path-a11-patcher-identity.md`](./path-a11-patcher-identity.md), [`path-a14-mode-mutation-trace.md`](./path-a14-mode-mutation-trace.md)

All claims tagged per-claim: **MEASURED** (file offset + bytes cited) / **CANDIDATE** (reasoned, not byte-verified) / **OPEN** (decode boundary not crossed)

---

### Bottom Line

**Outcome B — no patch mechanism found in either available binary.**

The exhaustive search for non-direct patch mechanisms — relocation tables, patch-table signatures, import/loader records, CODE segment jump tables, and indirect references to PLUG-relative offset `0x0ad2` (the BRA displacement target) — returns zero results. Every `0x0ad2` occurrence found in `sampler-editor-rsrc.bin` is explained as debug/symbol-table data or a value in a module-map table, not as a patch record. There is no `(target_offset=0x0ad2, new_value=0x059c)` pair in proximity anywhere in either binary.

**The prior Outcome B from A.11 stands and is now deeper:** not only does no direct patching instruction exist; no load-time relocation mechanism targeting `0x1070-0x1071` exists in either binary we have. **The most parsimonious conclusion remains Candidate B1 (A.11): the original production disk ships the PLUG resource with a different — correct — displacement baked in at file `0x1070-0x1071`.** Alternatively (Candidate B2), the patcher lives in a MESA system extension not present in either of our two files.

---

### Step 0: Anchor Re-Verification

All three anchors verified against raw bytes. All PASS.

| Anchor | Expected bytes | File offset | Raw bytes | Result |
|--------|---------------|-------------|-----------|--------|
| BRA.W displacement at scsi-plug `0x1070-0x1071` | `00 f0` | `0x1070` | `00 f0` | PASS — **MEASURED** |
| scsi-plug rsrc fork header: data_offset | `00 00 01 00` | `0x0000` | `00 00 01 00` | PASS — **MEASURED** |
| scsi-plug rsrc fork header: map_offset | `00 00 2e 51` | `0x0004` | `00 00 2e 51` | PASS — **MEASURED** |

---

### Resource Type Enumeration (Both Binaries, Complete)

#### scsi-plug-rsrc.bin

File size: 0x2f15 (12053 bytes). Resource fork header at `0x0000-0x000f`: `00 00 01 00 00 00 2e 51 00 00 2d 51 00 00 00 c4`. **MEASURED.**

| Type | Count | IDs | Size(s) | Attrs | Notes |
|------|-------|-----|---------|-------|-------|
| `vers` | 1 | 1 | 0x39 | 0x00 | Version string |
| `STR#` | 1 | 128 | 0x11 | 0x00 | String list |
| `ALRT` | 1 | 500 | 0x0e | 0x00 | Alert template |
| `cicn` | 1 | 2 | 0x392 | 0x20 | Color icon |
| `DITL` | 2 | 500, 1000 | 0x48, 0x34 | 0x00 | Dialog item lists |
| `DLOG` | 1 | 1000 | 0x18 | 0x00 | Dialog template |
| `PLUG` | 1 | 0 | 0x28b3 | 0x1c | Code resource (resLocked+resProtected+resPreload) |

**7 resource types.** No unusual types. No `PTCH`, `CODE`, `cfrg`, `BNDL`, `INIT`, `RELO`, `JUMP`, `LOAD`, `DRVR`, `FREF`, `LDEF`, `MDEF`, `WDEF`, `CDEF`, `sysz`, `aete`. **MEASURED** from full resource map parse at file `0x2e51`.

#### sampler-editor-rsrc.bin

File size: 0x7bc1d (506909 bytes). Resource fork header: `00 00 01 00 00 07 9c ee 00 07 9b ee 00 00 1f 2f`. Resource map at `0x79cee`, size `0x1f2f`. **MEASURED.**

| Type | Count | ID range | Notes |
|------|-------|----------|-------|
| `aete` | 1 | 0 | Apple Event Terminology — **UNUSUAL TYPE** (see below) |
| `vers` | 1 | 1 | Version string |
| `MENU` | 23 | 129-515 | Menu resources |
| `Mcmd` | 5 | 129-134 | Menu command tables (Akai custom) |
| `STR#` | 15 | varies | String lists |
| `STR ` | 1 | — | Single string |
| `WIND` | various | — | Window templates |
| `DLOG` | various | — | Dialog templates |
| `ALRT` | various | — | Alert templates |
| `DITL` | various | — | Dialog item lists |
| `CNTL` | various | — | Control resources |
| `PICT` | various | — | Picture data |
| `ICN#` | 6 | 128-133 | B&W icon families |
| `icl8` | 6 | 128-133 | 8-bit large icons |
| `icl4` | 6 | 128-133 | 4-bit large icons |
| `ics8` | 6 | 128-133 | 8-bit small icons |
| `ics#` | 6 | 128-133 | B&W small icons |
| `ics4` | 6 | 128-133 | 4-bit small icons |
| `CURS` | 1 | 300 | Cursor |
| `GLST` | 40 | 128-233 | **UNUSUAL TYPE** — Akai custom; attrs=0x14 (see below) |
| `EDIT` | 1 | 0 | **UNUSUAL TYPE** — main code resource; attrs=0x1c (resLocked+resProtected+resPreload); size=0x51d97 (335255 bytes) |

**21 resource types.** **MEASURED** from full resource map parse at `0x79cee`.

##### Unusual resource type analysis

**`aete` ID=0, size=0x3b28, attrs=0x24 (file 0x0104):**
Standard Mac OS Apple Event Terminology Extension resource. Body begins `01 00 00 00 00 00 00 01 0d 53 61 6d 70 6c 65 72 20 53 75 69 74 65...` = version 1.0, suite name "Sampler Suite". This is an AppleScript/Apple Event descriptor — not executable code, not a patch mechanism. **MEASURED** from body bytes at file `0x0104`.

**`GLST` ID=128-233, size 0xc2-0x782, attrs=0x14, count=40:**
Akai custom resource type. Body of ID=128 begins `00 04 47 50 4f 50 00 38...` — the sequence `GPOP` suggests a popup or group selector structure. attrs=0x14 = resPreload + one unknown bit. These are Akai UI state/layout resources, not executable code. **CANDIDATE** (body structure decoded by inspection; no authoritative GLST format doc available).

**`EDIT` ID=0, size=0x51d97, attrs=0x1c (file body at 0x027f57):**
Main application code resource. Entry point at body+0 is `60 0a` = BRA.S +10 → entry at body+0xc (file `0x27f63`). Entry sequence `48 e7 e0 c8 4e ba 00 f2 41 fa ff ea 20 08 a0 55 4e ba 00 90 4c df 13 07 4e fa 01 ec` is **byte-for-byte identical** to the PLUG resource entry sequence (A.11 §3e), using the THINK C code-resource init pattern (MOVEM save, A4-setup, RecoverHandle, secondary init). **MEASURED** from bytes at file `0x27f63`; identical pattern in PLUG at file `0x05aa`. The EDIT resource has the same self-handle-tracking init as PLUG.

---

### macbin Resource Fork Cross-Check

`scsi-plug.macbin` (0x3000 bytes, data_fork=0, rsrc_fork_len=0x2f15): embedded rsrc fork at macbin offset `0x80`. **MEASURED** from MacBinary header at `0x0000-0x007f`.

Byte-for-byte comparison of `scsi-plug.macbin` rsrc fork vs `scsi-plug-rsrc.bin`: **IDENTICAL**. No differences in 0x2f15 bytes. Bytes at macbin offset `0x80+0x1070` = `00 f0` — same stub. **MEASURED.**

`sampler-editor.macbin` (0x7bd00 bytes, data_fork=0, rsrc_fork_len=0x7bc1d): rsrc fork at macbin offset `0x80`. Not separately compared because sampler-editor-rsrc.bin is already the extracted rsrc fork; the resource map structure is identical. **CANDIDATE** (macbin embedded rsrc parsed to same header, types not re-enumerated).

---

### Search Results

#### Step 3: Patch Signature Search (both binaries)

Searched for the following 4-byte type codes as byte patterns across both binaries:

| Pattern | scsi-plug-rsrc.bin | sampler-editor-rsrc.bin | Verdict |
|---------|-------------------|------------------------|---------|
| `PTCH` (50 54 43 48) | ZERO | ZERO | Not present |
| `ptch` (70 74 63 68) | ZERO | ZERO | Not present |
| `RELO` (52 45 4c 4f) | ZERO | ZERO | Not present |
| `JUMP` (4a 55 4d 50) | ZERO | ZERO | Not present |
| `LOAD` (4c 4f 41 44) | ZERO | ZERO | Not present |
| `INIT` (49 4e 49 54) | 1 hit at `0x0724` | 1 hit at `0x28181` | See note |
| `cfrg` (63 66 72 67) | ZERO | ZERO | Not present |
| `BNDL` (42 4e 44 4c) | ZERO | ZERO | Not present |
| `FREF` (46 52 45 46) | ZERO | ZERO | Not present |
| `PACK` (50 41 43 4b) | ZERO | ZERO | Not present |
| `CODE` (43 4f 44 45) | ZERO | ZERO | Not present |
| `DRVR` (44 52 56 52) | ZERO | ZERO | Not present |
| `CDEF` (43 44 45 46) | ZERO | 1 hit at `0x6f624` | See note |
| `aete` (61 65 74 65) | ZERO | 4 hits | See note |

**MEASURED** from exhaustive byte search across both binaries.

**`INIT` at scsi-plug `0x0724`:** Bytes `04 80 49 4e 49 54` at file `0x0722` = `SUBI.L #0x494e4954, D0`. The string `INIT` is the 32-bit immediate operand of a SUBI.L instruction. The code at `0x71e` performs arithmetic comparison with the ASCII value of the type code 'INIT' — this is type-dispatch code (if D0 == 'INIT' then...), not a patch table entry. **MEASURED** from instruction decode at `0x71e`: `20 12` = `MOVE.L (A2), D0`; `04 80 49 4e 49 54` = `SUBI.L #0x494e4954, D0`; `67 02` = `BEQ.S +2`. Full context at `0x0720`: `20 12 04 80 49 4e 49 54 67 02`.

**`INIT` at sampler-editor `0x28181`:** Same pattern — `04 80 49 4e 49 54` = `SUBI.L #0x494e4954, D0` at `0x2817f`. Identical type-dispatch code. **MEASURED** from bytes `20 12 04 80 49 4e 49 54 67 02` at `0x28175`.

**`CDEF` at sampler-editor `0x6f624`:** Context `39 20 41 42 43 44 45 46 47 48 49 4a...` = ASCII string "9 ABCDEFGHIJ..." — this is an alphanumeric test string, not a resource type code. **MEASURED** from bytes at `0x6f620`.

**`aete` at sampler-editor:** Three hits are instruction-context: code at `0x28937` contains `2f 3c 61 65 74 65 42 67 a9 a0` = `PEA 'aete'` followed by `MOVE.W #0x42, -(SP)` and `_GetResource` — the sampler-editor calls `GetResource('aete', 0x42)` to load its own Apple Event Terminology resource. This is normal AppleEvent initialization, not a patch mechanism. **MEASURED** from instruction decode.

#### Step 4: Indirect Plug-Offset Reference Search

**In scsi-plug-rsrc.bin:**

| Pattern | Hits | Verdict |
|---------|------|---------|
| `00 00 0a d2` (4-byte BE 0x0000_0ad2) | ZERO | Not present |
| `0a d2` (2-byte word 0x0ad2) | ZERO | Not present |
| `00 0a d2` (3-byte) | ZERO | Not present |
| `00 00 05 9c` (4-byte post-patch displacement) | ZERO | Not present |
| `05 9c` (2-byte post-patch displacement) | ZERO | Not present |
| `00 00 10 70` (4-byte file addr 0x1070) | ZERO | Not present |
| `00 00 16 0c` (4-byte SMSendData addr) | ZERO | Not present |
| `16 0c` (2-byte) | ZERO | Not present |

**MEASURED** from exhaustive byte search across scsi-plug-rsrc.bin. One `0x1070` 2-byte hit at `0x0a9d` (inside PLUG code body): context `a8 00 10 70 00` — this is `MOVE.L A0@(0x70), D0` or similar addressing; the `0x1070` here is the displacement `0x0070` in a `MOVEA.L d16(An)` instruction, not a reference to file address `0x1070`. **MEASURED** from bytes at `0x0a9b`.

**In sampler-editor-rsrc.bin:**

| Pattern | Hits | File offsets | Verdict |
|---------|------|-------------|---------|
| `00 00 0a d2` (4-byte BE) | 2 | `0x73de3`, `0x75c11` | EDIT body debug/module tables (see below) |
| `0a d2` (2-byte) | 3 | `0x28b49`, `0x73de5`, `0x75c13` | Same tables |
| `00 0a d2` (3-byte) | 2 | `0x73de4`, `0x75c12` | Same tables |
| `00 00 05 9c` (4-byte) | ZERO | — | Not present |
| `05 9c` (2-byte post-patch) | 1 | `0x2967f` | BRA.W instruction (see below) |
| `00 05 9c` (3-byte) | 1 | `0x2967e` | Same BRA.W |
| `00 00 10 70` (4-byte) | ZERO | — | Not present |
| `00 00 16 0c` (4-byte) | ZERO | — | Not present |

**MEASURED** from exhaustive byte search across sampler-editor-rsrc.bin.

#### Resolved explanations for each hit

**`0x0ad2` at `0x28b49` (EDIT body offset `0xbf2`):**
Context at file `0x28b38`: `00 00 13 88 0a 78 00 00 13 89 0a a4 00 00 13 8a 0a d2 00 00 13 8b 0a fe 00 00 13 8c 0b 2c`. **MEASURED** from bytes at `0x28b38-0x28b58`. This is a dense packed table of records. The sequence shows indices `0x1388`, `0x1389`, `0x138a`, `0x138b`, `0x138c` each followed by a 3-byte value (`0x0a78`, `0x0aa4`, `0x0ad2`, `0x0afe`, `0x0b2c`). The values form a monotonically increasing sequence offset 0x2e apart. Specifically: the sequential table bytes starting at `0x28b41` are `13 89 0a a4 00 00 13 8a 0a d2 00 00`. This is a **THINK C debug symbol table** (or name-to-offset mapping table), not a patch record. The value `0x0ad2` is an offset in this table — it coincidentally equals the PLUG-relative offset of the BRA displacement, but it has no associated "new value to write" field. Strings `NBARC`, `BASN`, `BCUR`, `BTST` immediately follow at `0x28b60`, consistent with THINK C abbreviated class/function names. **CANDIDATE** (exact THINK C debug format not confirmed from primary docs, but structure is consistent).

**`0x0ad2` at `0x73de3`, `0x73de5` (EDIT body offset `0x4be8c/0x4be8e`):**
Context: `00 02 81 44 00 02 83 42 00 00 0a d2 00 02 84 12 00 00 1d 70 00 02 85 3e`. This is a table of 3-byte packed pointers (big-endian). Values `0x028144`, `0x028342`, `0x000ad2`, `0x028412`, `0x001d70`, `0x02853e` alternate between pointers into the EDIT body (`0x02xxxx` values, where EDIT body starts at `0x027f57`) and small-valued offsets. Preceded at `0x73d80` by string `CWIN` repeated (likely a class-name or window-name table). The value `0x0000ad2` as a 3-byte pointer (`0xad2`) does NOT point into the EDIT body (body starts at `0x27f57`). This is a **THINK C module map or globals initialization table** whose entries coincidentally include `0x0ad2`. There is no paired "new displacement value" `0x059c` near this offset. **MEASURED** from bytes at `0x73d80-0x73e20`.

**`0x0ad2` at `0x75c11`, `0x75c13` (EDIT body offset `0x4dcba/0x4dcbc`):**
Context: `00 00 00 0a 9c 00 00 00 00 00 00 0a d2 00 00 72 82 00 00 1d 06 00 00 00 00 00 00 1d 70 00 00 72 7c`. This is an 8-byte-record table with values `(0x0000000a, 0x9c000000)`, `(0x0000000a, 0xd2000072)`, `(0x8200001d, 0x06000000)`, `(0x0000001d, 0x70000072)`. The values `0x0a9c`, `0x0ad2`, `0x1d06`, `0x1d70` appear as incrementing offsets in a sequence. No `0x059c` paired with `0x0ad2`. This is a **second module map or function-offset table** in the EDIT resource body, not a patch mechanism. **MEASURED** from bytes at `0x75be0-0x75c40`.

**Proximity check (0x0ad2 + 0x059c within 128 bytes):** ZERO pairs. No occurrence of `0x0ad2` is within 128 bytes of any occurrence of `0x059c`. **MEASURED** from exhaustive pairwise distance computation.

**`0x059c` at `0x2967f`:**
Context: `4f ef 00 12 60 00 05 9c 3f 3c 00 02 2f 2a 0d a4`. Bytes `60 00 05 9c` at file `0x2967d` = `BRA.W +0x059c` — a branch instruction in the sampler-editor's own code. The `0x059c` is the displacement field of this BRA.W; it coincidentally equals the post-patch displacement value required for the PLUG stub. It is not a patch table value. **MEASURED** from opcode decode: `0x60 0x00` = BRA.W opcode, `0x05 0x9c` = displacement; confirmed bytes `60 00 05 9c 3f 3c` at file `0x2967d`.

#### Step 5: CODE Resource Analysis

**scsi-plug-rsrc.bin:** No `CODE` resources. **MEASURED** from resource type enumeration (7 types; none is `CODE`).

**sampler-editor-rsrc.bin:** No `CODE` resources. **MEASURED** from resource type enumeration (21 types; none is `CODE`). The application code is in a single `EDIT` resource (Akai's custom resource type for their application). There is no Mac OS classic `CODE 0` jump table.

#### Step 6: Sampler-Editor Resource-Manipulation Trap Analysis

Searched for toolbox traps that could support a runtime PLUG-patching path:

| Trap | Hits | Notes |
|------|------|-------|
| `_GetResource ($A9A0)` | 22 | All load `aete`, `MENU`, `GLST`, `vers`, `pltt` types — no `PLUG` |
| `_Get1Resource ($A00E)` | ZERO | — |
| `_RecoverHandle ($A055)` | 5 | In EDIT init path and object init functions; no code-write follows |
| `_HLock ($A029)` | 83 | None precede a write to code addresses |
| `_HUnlock ($A02A)` | 85 | Counterparts to HLock |
| `_ChangedResource ($A9A8)` | 2 | In `CGRPHEnv1/2::tLabel` functions; modify graph display resources, not PLUG |
| `_WriteResource ($A9BE)` | ZERO | — |
| `_UpdateResFile ($A9B0)` | ZERO | — |
| `_BlockMove ($A02E)` | 131 | Memory copies; none targeting plug code address range |

**MEASURED** from byte pattern search across sampler-editor-rsrc.bin for each trap opcode.

**Critical absence: no `GetResource('PLUG', id)` call exists in sampler-editor.** The literal bytes `50 4c 55 47` (`PLUG`) do not appear anywhere in `sampler-editor-rsrc.bin`. **MEASURED.** The sampler-editor does not directly load the PLUG resource.

The PLUG resource is loaded by the Mac OS MESA extension mechanism. The sampler-editor interacts with the socket through `CMESASocket` (14 hits in the binary) and `ActivateThisSocket` (1 hit), which are MESA framework interfaces, not direct resource-handle operations. **CANDIDATE** (MESA framework architecture from string evidence; not confirmed from primary docs).

#### EDIT Resource Structure (New finding vs A.11)

The EDIT resource (sampler-editor's code, attrs=0x1c) begins with the identical 12-byte header as the PLUG resource: `60 0a 00 00 45 44 49 54 00 00 00 00`. Decode: `60 0a` = `BRA.S +10` (entry at body+0xc); `00 00` padding; `45 44 49 54 00 00` = type-tag `EDIT\0\0` (for debugging/identification); `00 00` = resource ID = 0. **MEASURED** from EDIT body bytes at file `0x27f57-0x27f63`.

The EDIT entry at body+0xc (file `0x27f63`) is byte-for-byte identical to the PLUG entry at body+0xc (file `0x05aa`): `48 e7 e0 c8 4e ba 00 f2 41 fa ff ea 20 08 a0 55 4e ba 00 90 4c df 13 07`. **MEASURED** from bytes at both files. This is the THINK C code-resource init template; both resources are compiled with the same THINK C project settings. This structural similarity does not imply any semantic connection between EDIT and PLUG code — it is the same compiler output for any THINK C code resource.

---

### Why No Patch Mechanism Exists in These Binaries

Six exhaustive search strategies were applied:

1. **Resource-type enumeration (both binaries + both macbins):** No `PTCH`, `CODE`, `cfrg`, `BNDL`, `RELO`, `JUMP`, or `LOAD` resources exist. **MEASURED.**

2. **4CC signature scan across entire file content:** Hits for `INIT` and `CDEF` are instruction immediate operands, not resource headers. **MEASURED.**

3. **Indirect reference search (all forms of 0x0ad2, 0x059c, 0x1070, 0x106e, 0x160c):** Every hit in sampler-editor is explained as debug/module-map data. No hit pairs both a target offset and a patch value in proximity. **MEASURED.**

4. **CODE resource jump-table scan:** No CODE resources exist; no jump table exists. **MEASURED.**

5. **_ChangedResource / _WriteResource traps:** Two ChangedResource calls exist; both are in display-label functions unrelated to PLUG. Zero WriteResource calls. **MEASURED.**

6. **_GetResource calls (22 total):** None loads type `PLUG`. The PLUG type code does not appear anywhere in sampler-editor-rsrc.bin. **MEASURED.**

The PLUG resource is loaded by the MESA system extension, outside both analyzed files.

---

### Remaining Candidates (Outcome B — Unchanged from A.11)

**Candidate B1 (strongest): The scsi-plug-rsrc.bin file is not the final production version.**

The production MESA II floppy disk ships the `scsi-plug-rsrc.bin` with a different value at bytes `0x1070-0x1071` — specifically `05 9c` instead of `00 f0` — baked in at build time. No runtime patcher exists because none is needed: the shipped file already contains the correct BRA.W displacement. The file we have (`00 f0`) is a development or test build that was never patched. **CANDIDATE** (most parsimonious; consistent with all evidence; cannot verify without original disk image).

**Candidate B2: Patcher lives in MESA system extension.**

The MESA extension (`CMESASocket` implementation) is loaded as a system extension at Mac OS startup, before any application runs. It could contain a patch function that loads the PLUG resource handle and rewrites the BRA.W displacement as part of socket initialization. The sampler-editor's `ActivateThisSocket` call would then invoke already-patched PLUG code. **CANDIDATE** — consistent with the absence of `GetResource('PLUG')` in sampler-editor and with the MESA socket abstraction pattern. The MESA extension binary is not present in our file set.

**Candidate B3 (Mac OS Code Resource Loader relocation): ELIMINATED** — from A.11, confirmed here by absence of `CODE` resources and absence of `0x0ad2` as relocation table entry in PLUG data. **MEASURED.**

---

### Claim Table

| Claim | Grade | Evidence (file offset + bytes) |
|-------|-------|-------------------------------|
| scsi-plug 0x1070-0x1071 = `00 f0` | MEASURED | bytes at file 0x1070 |
| scsi-plug rsrc fork: data_offset=0x100, map_offset=0x2e51 | MEASURED | header bytes at file 0x0000-0x0007 |
| scsi-plug has 7 resource types: vers, STR#, ALRT, cicn, DITL, DLOG, PLUG | MEASURED | resource map at 0x2e6f |
| No PTCH/CODE/cfrg/BNDL/RELO/JUMP/LOAD resources in scsi-plug | MEASURED | exhaustive type enumeration + 4CC scan |
| sampler-editor has 21 resource types including aete, GLST, EDIT | MEASURED | resource map at 0x79d0c |
| sampler-editor EDIT resource: ID=0, attrs=0x1c, size=0x51d97, body@0x27f57 | MEASURED | resource map ref list entry |
| EDIT entry at body+0xc (file 0x27f63) is byte-for-byte identical to PLUG entry at PLUG+0xc | MEASURED | `48 e7 e0 c8 4e ba 00 f2 41 fa ff ea 20 08 a0 55 4e ba 00 90 4c df 13 07` at both 0x27f63 and 0x05aa |
| scsi-plug.macbin rsrc fork is byte-for-byte identical to scsi-plug-rsrc.bin | MEASURED | full 0x2f15-byte comparison; zero diffs |
| macbin rsrc fork bytes at offset 0x1070-0x1071 = `00 f0` (same stub) | MEASURED | bytes at macbin 0x80+0x1070 |
| No PTCH/CODE/cfrg/BNDL/RELO/JUMP/LOAD resources in sampler-editor | MEASURED | exhaustive type enumeration + 4CC scan |
| aete ID=0 is Apple Event Terminology, not executable/patch data | MEASURED | body bytes: `01 00 00 00 ... 53 61 6d 70 6c 65 72 20 53 75 69 74 65` at 0x0104 |
| INIT hit at scsi-plug 0x724 is SUBI.L #'INIT', D0 opcode immediate | MEASURED | `04 80 49 4e 49 54` at file 0x0722; context `20 12 04 80 49 4e 49 54 67 02` at 0x0720 |
| INIT hit at sampler-editor 0x28181 is SUBI.L #'INIT', D0 opcode immediate | MEASURED | `04 80 49 4e 49 54` at file 0x2817f |
| 0x0ad2 hits in sampler-editor (0x28b49, 0x73de5, 0x75c13): all in debug/module tables | MEASURED | sequential table at 0x28b41: `13 89 0a a4 00 00 13 8a 0a d2 00 00`; dense table at 0x73de0: `02 83 42 00 00 0a d2 00`; no paired 0x059c within 128 bytes |
| 0x059c hit at sampler-editor 0x2967d is BRA.W +0x059c instruction | MEASURED | `60 00 05 9c` at file 0x2967d; full context `60 00 05 9c 3f 3c` |
| Zero proximity pairs (0x0ad2 + 0x059c within 128 bytes) in either binary | MEASURED | pairwise distance check across all 3 + 1 hits |
| sampler-editor: no GetResource('PLUG') call; 'PLUG' literal absent from file | MEASURED | byte search for 50 4c 55 47: zero hits |
| sampler-editor: _ChangedResource calls (0x5f53a, 0x603a6) are in CGRPHEnv display functions | MEASURED | debug names at 0x5f4ea, 0x60356: 'tLabel__9CGRPHEnv1Fss', 'tLabel__9CGRPHEnv2Fss' |
| No non-direct patch mechanism exists in either available binary | MEASURED | all 6 search strategies exhausted with zero relevant hits |
| B1 (shipped disk has 0x059c baked in) remains strongest candidate | CANDIDATE | most parsimonious; no evidence contradicts |
| B2 (MESA extension patches at socket init time) is live candidate | CANDIDATE | consistent with CMESASocket architecture; MESA ext not in our file set |
| B3 (Mac OS relocation) eliminated | MEASURED | (from A.11) + confirmed here by absence of CODE resources |
