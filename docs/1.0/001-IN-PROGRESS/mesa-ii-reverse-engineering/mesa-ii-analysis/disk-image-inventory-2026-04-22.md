# Mac OS 9 disk image inventory — MESA II environment

**Date:** 2026-04-22
**Source:** `binaries-large/macos9-mesa-disk.hfs` (1.0 GB SheepShaver bootable HFS image; volume "Macintosh HD"; OS install dated Apr 1 2026)
**Tool used:** `hfsutils` (userspace HFS parser; OS kernel mount fails because macOS 11+ removed HFS Standard support, but userspace tools work)
**Mounted via:** `hmount /path/to/macos9-mesa-disk.hfs` then `hls -R /` for enumeration

This is the inventory phase per Codex 2026-04-22 direction. Conclusions deferred; this is artifact catalog + triage only.

## Critical finding: B1 hypothesis REFUTED

**SHA256 of canonical SCSI Plug 2.1.2 (data fork) == SHA256 of our extracted `scsi-plug-rsrc.bin`:**
- `b895e3142b3b4747771cd982f949957fd4474384f39f4c41de157128eda1368f`

**SHA256 of canonical Sampler Editor 2.3 (data fork) == SHA256 of our extracted `sampler-editor-rsrc.bin`:**
- `edd69d0ced31c658822f480185158fa9dd76b897bcf71e1b4e710903f5782ed9`

Both pre-existing extracted binaries are **byte-for-byte identical** to the canonical files in this working MESA II install. The `0x1070-0x1071` BRA displacement in the production-installed PLUG resource is `00 f0` — same as our extracted file. **B1 (extraction artifact / variant differences) is REFUTED.**

This means the patcher (if it exists) is a **runtime patch** applied after the PLUG resource is loaded into memory, not different bytes baked into the file on disk.

## MESA II environment layout

```
:Applications:MESA II v1.2 ™:
  MESA II                    APPL/AK11   413689 data    0 rsrc      ← THE LOADER (main app)
  Error Codes                ttro/ttxt    6904 / 2089
  READ ME                    ttro/ttxt     952 /  427
  MESA Pouch:
    Editors:
      Audio Editor           EDIT/AK11   169444 / 0
      Sampler Editor 2.3     EDIT/AK11   506909 / 0    ← MATCHES our sampler-editor-rsrc.bin
    PlugIns:
      SCSI Plug 2.1.2        PLUG/AK11    12053 / 0    ← MATCHES our scsi-plug-rsrc.bin
      Audio Filing:
        AIFF Plug            PLUG/AK11    19037 / 0
        SDII Plug            PLUG/AK11    11823 / 0
        Wave Plug 2.3        PLUG/AK11    24648 / 0
      DSP:
        +3dB                 PLUG/AK11     9184 / 0
        -3dB                 PLUG/AK11     9150 / 0
        Analyse              PLUG/AK11    34136 / 0
        EQ Filter            PLUG/AK11    18838 / 0
        Fade                 PLUG/AK11    30353 / 0
        Invert               PLUG/AK11     9155 / 0
        Noise                PLUG/AK11     4196 / 0
        Normalise            PLUG/AK11     9550 / 0
        Quick Filter         PLUG/AK11    56627 / 0
        Reverse              PLUG/AK11     8695 / 0
        Time Stretch         PLUG/AK11    17029 / 0
    Example Scripts:         (23 AppleScript .scpt files; not relevant)
  OMS MIDI Stuff:
    Keyboard                 EDIT/AK11    62503 / 0
    OMS Plug                 PLUG/AK11     6143 / 0
    OMS MIDI STUFF READ ME   ttro/ttxt    6944 / 274

:Applications:MESA II v1.2 ™ copy:    (identical copy of above; ignore)

:System Folder:Preferences:MESAv2 Prefs ™:
  Audio Editor Prefs         pref/AK11    0 / 44
  MESA Prefs                 pref/AK11    0 / 6
  Sampler Prefs              pref/AK11    0 / 552

:System Folder:Apple Menu Items:Recent Applications:
  MESA, MESA II, MESAII.INS  (aliases / shortcuts; not real binaries)
```

**No MESA-named system extensions found in `:System Folder:Extensions:`**. None in `:System Folder:Control Panels:`. The plug loading is done by the MESA II application itself.

## Files extracted to working set

Located at `binaries-large/extracted/`:

| File (.macbin) | macbin size | Data fork | SHA256 (data fork only) | Role hypothesis |
|---|---|---|---|---|
| MESA-II.macbin | 413824 | 413689 | `3ac741e8...336ec3d` | **LOADER** — main app that loads PLUG/EDIT resources from MESA Pouch |
| Sampler-Editor-2.3.macbin | 507136 | 506909 | `edd69d0c...782ed9` | EDITOR — matches our existing extract |
| Audio-Editor.macbin | 169600 | 169444 | `1a7a041d...5f53e6` | EDITOR — different scope (audio editing) |
| Keyboard.macbin | 62720 | 62503 | `49fac1dc...3399b7` | EDITOR — keyboard layout/mapping editor |
| SCSI-Plug-2.1.2.macbin | 12288 | 12053 | `b895e314...d1368f` | PLUG — matches our existing extract |
| OMS-Plug.macbin | 6272 | 6143 | `1b2cebde...79458f4` | PLUG — OMS variant (no SCSI; for OMS-MIDI users) |

DSP/Audio Filing plugs not yet extracted (lower priority — they're audio-processing plugs, not transport plugs).

Each `*.macbin` has a corresponding `*.dataonly` (MacBinary header stripped; ready for static decode tools).

## Triage: what to decode next

**Highest-value target:** `MESA II.dataonly` (413,689 bytes; resource fork header at offset 0). This is the loader. If a runtime patch mechanism for `0x106e/0x1070` exists, it's most likely here (since this is the code that loads PLUG resources and dispatches to them).

Resource fork header observed:
- `data_offset = 0x100`
- `map_offset = 0x643D0`
- `data_size = 0x642D0`
- `map_size = 0xC29`

Same structural format as `sampler-editor-rsrc.bin`'s data fork (which we already know how to decode).

**Second priority:** `OMS-Plug.macbin` (6143 bytes — comparable to SCSI Plug at 12053 bytes). If OMS Plug shows the same `0x106e`-style stub pattern, it's evidence the plug-loading mechanism is generic across plug types (and likely runtime-patched by the loader).

**Third priority:** `Audio-Editor.macbin` (169444 bytes). Confirms editor-vs-plug distinction; could reveal how editors vs plugs differ in their loading.

## What I'm NOT inferring yet (per Codex direction)

- Not assigning the patcher role to MESA II app yet (only highest-probability candidate)
- Not predicting what the runtime patch looks like
- Not running more hardware probes
- Not re-decoding the already-exhausted scsi-plug + sampler-editor

## What this changes in the project state

| Hypothesis (per Codex 2026-04-22 ranking after A.14) | Status after disk image inventory |
|---|---|
| (1) Production reaches different target via runtime patch | **Strongest, sharpened** — patcher is most likely MESA II app (now extracted) |
| (2) State-precondition unlocks `0x80` | Still viable but weakened |
| (3) Our interpretation of candidate body is wrong | Refuted by A.14 |
| **B1: extraction artifact / different variant** | **REFUTED** by hash equality |
| **B2: external installer/loader** | **PARTIALLY ANSWERED** — the loader is the MESA II app, now extracted |

The "binary-source hunt" track is now **substantially advanced**. The MESA II app (the loader) was the missing artifact; we now have it.

## Ready for Codex review

Ready to proceed with whatever direction Codex prefers:
- (a) Run a focused decode of MESA II app for plug-loading + runtime patch logic (Path A.16?)
- (b) Compare MESA II app structure to sampler-editor structure for tactical groundwork
- (c) Other direction

---

## ADDENDUM 2026-04-22: MESA 1.3 disk image inventory (Mac OS 7.6)

A second SheepShaver disk image is now available:
- **Local copy:** `binaries-large/macos7-mesa-i-disk.hfv` (1.0 GB; gitignored)
- **Original:** `/Users/orion/Downloads/macos-7-disk.hfv`
- **SHA256:** `5ac3f9d95727e9245306ca2b31752059f6f058dd2518c57454f2b90180990f6b` (different from macos9 disk: `589bfdbf...4b5978f7ee461c`)
- **OS:** Mac OS 7.6 (Jan 1997 era)
- **MESA version:** 1.3 (predecessor to MESA II v1.2)

### MESA 1.3 inventory

`:Applications:M.E.S.A ™:` contents:
- **MESA** — APPL/**AK09** — **242,598 bytes** (the loader app)
- **MESA1.3 MANUAL** — APPL/eSRD — 359,494 bytes
- **MESA Pouch/** (modules):
  - AIFF — MODU/AK09 — 16,122
  - Buttons & Faders — UDEF/AK09 — 110,573
  - File Manager — MODU/AK09 — 104,319
  - OnLine Help — MODU/AK09 — 49,028
  - **S2000** — MODU/AK09 — 91,739 (sampler-specific)
  - **S3 HD Provider** — MODU/AK09 — **62,063** (closest analog to MESA II's SCSI Plug — SCSI/HD comms)
  - **S3000 FX** — MODU/AK09 — 73,899
  - **Sampler Editor** — MODU/AK09 — 218,819 (predecessor of Sampler Editor 2.3)
  - SD2 — MODU/AK09 — 9,600
  - Shared — SHAR/AK09 — 50,179
  - Wave Editor — MODU/AK09 — 93,467
- **New OS for Samplers/** (sampler firmware blobs for S2000, S3000 XL, S3200 XL)
- STOP PRESS.READ ME

### Key architectural differences MESA 1.3 vs MESA II

| Aspect | MESA 1.3 (Mac OS 7.6, 1997) | MESA II v1.2 (Mac OS 9, 1999) |
|---|---|---|
| Creator code | `AK09` | `AK11` |
| Module type code | `MODU` | `PLUG` (transport) + `EDIT` (editor) |
| SCSI module | `S3 HD Provider` (62 KB) | `SCSI Plug 2.1.2` (12 KB) |
| Editor module | `Sampler Editor` (218 KB, single) | `Sampler Editor 2.3` (506 KB) + Audio Editor (169 KB) + Keyboard (62 KB) |
| Folder name | `MESA Pouch/` (flat) | `MESA Pouch/{Editors,PlugIns,Example Scripts}` (organized) |
| Plug subfolders | none | Audio Filing, DSP |

**The MESA 1.3 architecture appears materially different.** Different resource type code (MODU vs PLUG) suggests a different loading mechanism between versions.

### Status of MESA 1.3 artifacts

- Disk image copy: stable at `binaries-large/macos7-mesa-i-disk.hfv` (gitignored)
- Files NOT yet extracted — would do so when needed (or if comparative MESA-1.3-vs-MESA-II decode becomes useful for the patch question)

### Why MESA 1.3 might or might not help the current patch question

Path A.16 currently in flight is hunting for the MESA II runtime patcher. The MESA 1.3 architecture is sufficiently different (MODU vs PLUG resource types) that:
- **If A.16 finds the patcher in MESA II:** MESA 1.3 is comparative-only; not on critical path.
- **If A.16 doesn't find it:** MESA 1.3's `S3 HD Provider` (the SCSI-equivalent module) might show whether the patch idiom predates MESA II OR is unique to the PLUG-typed loading mechanism.

Defer extraction/decode of MESA 1.3 artifacts unless A.16 returns Outcome B or C and we need a comparative reference.
