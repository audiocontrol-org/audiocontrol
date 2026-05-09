# 2026-05-08 Code Audit Findings

Scope reviewed: current redesign implementation delta on `feature/s550-support`, centered on Phase 9 Task 3 (`TonesPage` decomposition) plus adjacent shared surfaces in `modules/roland-sxx0-editor` for duplication and S-330/S-550 drift risk.

## Findings

### 1. High — Shared sample import path still hard-codes the S-330 2-bank wave model

The current shared sample-import flow still restricts `waveBank` to `0 | 1`, which blocks valid S-550 imports into banks `C` and `D`.

- `TonesPage` handler type restricts `waveBank` to `0 | 1`:
  - [modules/roland-sxx0-editor/src/pages/TonesPage.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/pages/TonesPage.tsx:35)
- `ImportSampleDialog` prop contract and local state do the same:
  - [modules/roland-sxx0-editor/src/components/library/ImportSampleDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/library/ImportSampleDialog.tsx:32)
  - [modules/roland-sxx0-editor/src/components/library/ImportSampleDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/library/ImportSampleDialog.tsx:66)
- The dialog UI only exposes Bank A and Bank B:
  - [modules/roland-sxx0-editor/src/components/library/ImportSampleDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/library/ImportSampleDialog.tsx:286)
  - [modules/roland-sxx0-editor/src/components/library/ImportSampleDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/library/ImportSampleDialog.tsx:295)

This contradicts the S-550 device config, which declares four wave banks and `maxWaveBankIndex: 3`:

- [modules/roland-sxx0-editor/src/configs/s550.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/configs/s550.ts:16)

Impact: the redesign work is still carrying forward an S-330-only business rule through a shared editor surface.

### 2. Medium — Empty-slot business logic is duplicated and already diverges from the authoritative shared helpers

The repo already has authoritative empty-slot helpers in `slot-allocation.ts`, but list/page surfaces reimplement weaker name-based checks instead of reusing them.

Authoritative shared rules:

- `isToneEmpty`:
  - [modules/roland-sxx0-editor/src/lib/slot-allocation.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/lib/slot-allocation.ts:58)
- `isPatchEmpty`:
  - [modules/roland-sxx0-editor/src/lib/slot-allocation.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/lib/slot-allocation.ts:84)

Duplicated local implementations:

- `ToneList` defines empty as blank name:
  - [modules/roland-sxx0-editor/src/components/tones/ToneList.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/tones/ToneList.tsx:31)
- `PatchList` defines empty as blank name:
  - [modules/roland-sxx0-editor/src/components/patches/PatchList.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/patches/PatchList.tsx:30)
- `PlayPage` defines a third patch-empty variant:
  - [modules/roland-sxx0-editor/src/pages/PlayPage.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/pages/PlayPage.tsx:239)

Impact:

- unnamed-but-allocated tones can be styled/count-labeled as “empty” in UI while allocation/import logic treats them as occupied
- patch availability can drift between play/list/import surfaces
- future redesign work has no single business-rule source of truth

This is exactly the class of duplication that should be refactored to shared reuse before more page polish lands.

### 3. Medium — No automated UI harness/spec coverage exists for the redesign pages

The module has a Playwright harness config pointing at `test/ui`, but the editor currently has no test harness pages and no UI specs.

- Harness config expects `./test/ui`:
  - [modules/roland-sxx0-editor/playwright.test-harness.config.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/playwright.test-harness.config.ts:20)
- `App.tsx` only registers production routes:
  - [modules/roland-sxx0-editor/src/App.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/App.tsx:22)
- No `Test*Page.tsx` harness pages exist under `src/pages`
- `modules/roland-sxx0-editor/test/ui/` currently contains only `.gitkeep`

Impact: there is currently no automated mechanism to catch layout regressions or S-330/S-550 visual drift during the redesign rollout, despite the Phase 9 acceptance criteria depending on screenshot verification and UI correctness.

### 4. Medium — Shared pages/dialogs still hard-code S-330 user-facing copy instead of deriving it from `DeviceConfig`

`HomePage` already uses the right pattern by pulling `deviceName` from config:

- [modules/roland-sxx0-editor/src/pages/HomePage.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/pages/HomePage.tsx:10)

But several shared surfaces still render S-330-specific copy directly:

- `TonesPage` not-connected state:
  - [modules/roland-sxx0-editor/src/pages/TonesPage.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/pages/TonesPage.tsx:304)
- `PatchesPage` not-connected state:
  - [modules/roland-sxx0-editor/src/pages/PatchesPage.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/pages/PatchesPage.tsx:194)
- `LibraryPage` not-connected state:
  - [modules/roland-sxx0-editor/src/pages/LibraryPage.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/pages/LibraryPage.tsx:232)
- `PlayPage` not-connected state:
  - [modules/roland-sxx0-editor/src/pages/PlayPage.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/pages/PlayPage.tsx:250)
- `ImportSampleDialog` header/docs:
  - [modules/roland-sxx0-editor/src/components/library/ImportSampleDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/library/ImportSampleDialog.tsx:4)

Impact: even if layout stays shared, the actual S-550 surface is already drifting at the content layer. This should be centralized now, before more redesign polish is applied page-by-page.

### 5. Low — Export-flow reuse is only partially centralized; `PatchesPage` still shims patch export manually

`useLibraryExport` now exposes imperative openers for shared reuse:

- [modules/roland-sxx0-editor/src/hooks/useLibraryExport.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/hooks/useLibraryExport.ts:131)
- [modules/roland-sxx0-editor/src/hooks/useLibraryExport.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/hooks/useLibraryExport.ts:140)

`TonesPage` uses the shared tone opener directly:

- [modules/roland-sxx0-editor/src/pages/TonesPage.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/pages/TonesPage.tsx:391)

But `PatchesPage` still does its own connect + patch lookup + drag-payload shim:

- [modules/roland-sxx0-editor/src/pages/PatchesPage.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/pages/PatchesPage.tsx:148)

Impact: not a current correctness bug, but it is the same “reimplement instead of reuse” pattern that has caused drift elsewhere in this feature.

## Audit Notes

- The actual implementation delta versus `origin/main` is currently narrower than the Phase 9 exploration/docs scope. Code changes reviewed were primarily:
  - [modules/roland-sxx0-editor/src/pages/TonesPage.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/pages/TonesPage.tsx:1)
  - [modules/roland-sxx0-editor/src/hooks/useLibraryExport.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/hooks/useLibraryExport.ts:1)
  - [modules/roland-sxx0-editor/src/hooks/useWaveDataCache.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/hooks/useWaveDataCache.ts:1)
  - [modules/roland-sxx0-editor/src/hooks/useLoopEditorSync.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/hooks/useLoopEditorSync.ts:1)
- Adjacent shared surfaces were reviewed specifically for duplication and cross-device drift risk.

## Recommended Next Refactor Targets

1. Generalize the import-sample contract and dialog from fixed `0 | 1` wave banks to device-config-driven bank options.
2. Replace local `isToneEmpty` / `isPatchEmpty` copies with the shared helpers from `slot-allocation.ts`.
3. Add a redesign harness route plus Playwright UI specs for shared page chrome on both `/roland/s330/editor/*` and `/roland/s550/editor/*`.
4. Lift shared not-connected copy and similar page chrome into config-driven helpers/components.
5. Finish centralizing export dialog opening so Patches and Tones use the same shared hook entry points.
