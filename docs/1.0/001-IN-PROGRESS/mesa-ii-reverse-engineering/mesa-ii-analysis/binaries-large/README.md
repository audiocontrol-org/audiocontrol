# Large binary artifacts (gitignored)

This directory holds binary artifacts too large to commit to git but useful for reference / extraction. The directory itself is in `.gitignore`.

## Contents

### `macos9-mesa-disk.hfs` (1.0 GB)

Bootable Macintosh HFS disk image — the SheepShaver virtual disk with MESA II installed.

- **Type:** Macintosh HFS data (bootable), block size 16384, volume name "Macintosh HD"
- **Source:** Original at `/Users/orion/Downloads/Macintosh HD` (this is a stable copy)
- **Contents:** complete Mac OS 9 install + MESA II application + system extension(s)
- **Why it's here:** Path A.15 (2026-04-22) confirmed that the editor binary doesn't reference `'PLUG'` literal — strong pointer that the **MESA system extension** loads PLUG and contains the patcher for scsi-plug `0x1070-0x1071`. The system extension is in this disk image.

## How to use

You'll need HFS-aware tooling to extract files from this image without booting SheepShaver.

### Option 1: hfsutils (recommended for Linux/macOS CLI)

```bash
brew install hfsutils
hmount path/to/macos9-mesa-disk.hfs
hls -l :
hcopy -m :path:to:file.bin /tmp/extracted-file.bin
humount path/to/macos9-mesa-disk.hfs
```

### Option 2: hfsexplorer (GUI, cross-platform Java)

Mounts HFS images read-only; lets you browse and extract files.

### Option 3: SheepShaver (boot the disk and copy out)

If you already have SheepShaver configured with this image, boot Mac OS 9, navigate to the MESA II install directory, and copy files out via shared folder or network.

## What to look for

For the patch-mechanism question (A.15 follow-up):

1. **MESA II System Extension** — typically lives in `:System Folder:Extensions:` on the boot volume. Look for files named `MESA II Extension`, `MESA Init`, or similar Akai-specific extensions.
2. **MESA II Control Panel(s)** — `:System Folder:Control Panels:` may have configuration cdevs.
3. **MESA II application bundle** — the editor app and any associated resources we may not have extracted yet.
4. **Companion plug-in resources** — any other PLUG / SOCKET / similar resources beyond the SCSI Plug we already have.

When you find candidate files, extract their resource forks via MacBinary or AppleSingle encoding so they survive the HFS→non-HFS boundary.

## Related docs

- `path-a11-patcher-identity.md` — A.11 outcome B (patcher not in scsi-plug or sampler-editor)
- `path-a15-patch-mechanism-hunt.md` — A.15 confirms patch mechanism not in either extracted file; sharpens hunt to MESA system extension
- `sraw-decoded.md` (item 8 + corrections) — current strongest hypothesis: production patches `0x106e` to a target emitting `CDB[5]=0x00`
