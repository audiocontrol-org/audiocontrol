# Audit Log — feature/roland-bugfix

This document is the feature-local audit log for `feature/roland-bugfix`.
New findings follow the project-wide protocol in [AUDITOR-IMPLEMENTER-PROTOCOL.md](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/AUDITOR-IMPLEMENTER-PROTOCOL.md).

Canonical grep queue:

- unfinished work: `grep -nE "^Status: (open|acknowledged|fixed-)" docs/1.0/001-IN-PROGRESS/roland-bugfix/audit-log.md`
- new findings: `grep -nE "^Status: open" docs/1.0/001-IN-PROGRESS/roland-bugfix/audit-log.md`
- awaiting verification: `grep -nE "^Status: fixed-" docs/1.0/001-IN-PROGRESS/roland-bugfix/audit-log.md`

---

## 2026-05-21 PR #440 Review

### Ctrl/Cmd-click mutates the device-memory anchor, so the next Shift-click range starts from the wrong slot

Finding-ID: AUDIT-20260521-01
Status:     fixed-awaiting-verification
Severity:   high
Surface:    `modules/roland-sxx0-editor/src/components/library/DeviceMemoryPanel.tsx`

Fix: removed the `lastToneAnchorRef.current = index` / `lastPatchAnchorRef.current = index` assignment from the ctrl/meta branch in both `handleToneClick` and `handlePatchClick`. The anchor now only moves on plain click (or after a shift-click implicitly via the operator's next plain click). Inline comments updated to make the contract explicit. Regression test: `D-LIB-32` covers the plain → ctrl → shift sequence and asserts the resulting multi-set is `{T11..T15}` (range from the original anchor `T11`), not `{T13..T15}` (range from the most recent ctrl-click).

The new device-memory multi-select logic contradicts its own documented anchor behavior and breaks the `Ctrl/Cmd-click` then `Shift-click` workflow. The comment says modifier toggles should keep the page-level anchor where it was, but both handlers overwrite the anchor inside the modifier branch:

- tone path: [DeviceMemoryPanel.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/modules/roland-sxx0-editor/src/components/library/DeviceMemoryPanel.tsx:156) and [DeviceMemoryPanel.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/modules/roland-sxx0-editor/src/components/library/DeviceMemoryPanel.tsx:170)
- patch path: [DeviceMemoryPanel.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/modules/roland-sxx0-editor/src/components/library/DeviceMemoryPanel.tsx:188) and [DeviceMemoryPanel.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/modules/roland-sxx0-editor/src/components/library/DeviceMemoryPanel.tsx:201)

Repro:

1. Plain-click `T11` to establish the anchor.
2. `Cmd/Ctrl-click` `T13` to extend the set.
3. `Shift-click` `T15`.

Expected: the range extends from the original anchor (`T11`) through `T15`.

Actual: the range starts from the last modifier-clicked slot (`T13`) because the anchor was mutated during step 2.

Evidence the current test coverage misses this exact path: the PR's wiring suite passed (`make test-wiring-roland ARGS='library-flows-dnd.spec.ts'`), but the new specs cover plain-click plus modifier toggles and non-contiguous modifier selection, not the `ctrl/meta -> shift` sequence.

This is a load-bearing correctness bug in the headline multi-select workflow introduced by PR #440.

### Export drawers hard-code `S330` in user-facing copy, so S-550 mode is mislabeled

Finding-ID: AUDIT-20260521-02
Status:     fixed-awaiting-verification
Severity:   medium
Surface:    `modules/roland-sxx0-editor/src/components/library/ExportToneDialog.tsx`, `ExportPatchDialog.tsx`, `BatchExportDrawer.tsx`

Fix: replaced the hardcoded `S330` literal in all three drawers with `deviceName` extracted from `useDeviceConfig()` and uppercased at render. `ExportToneDialog` and `ExportPatchDialog` already called `useDeviceConfig()` for `memoryLayout`; both now destructure `deviceName` alongside it and route it through the form-body components. `BatchExportDrawer` didn't call the hook — added the import + call + threaded `deviceName` through `BatchFormBody`. Each rendered span gets a `data-testid={kind}-device-name` for direct test assertion. Regression test: `D-LIB-33` mounts the export drawer on the S-550 surface and asserts the eyebrow span resolves to `S-550`.


The new export UI hard-codes `S330` in three user-facing eyebrow rows instead of deriving the active device name from configuration:

- [ExportToneDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/modules/roland-sxx0-editor/src/components/library/ExportToneDialog.tsx:183)
- [ExportPatchDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/modules/roland-sxx0-editor/src/components/library/ExportPatchDialog.tsx:195)
- [BatchExportDrawer.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/modules/roland-sxx0-editor/src/components/library/BatchExportDrawer.tsx:184)

Expected: the eyebrow copy reflects the active Roland surface, the same way slot labels already do via `memoryLayout`.

Actual: all three drawers render `... · LIBRARY · S330`, even when the editor is running in S-550 mode.

This is cross-device UI drift in a shared Roland surface. It likely escaped because the exercised review/test path was S-330-only.
