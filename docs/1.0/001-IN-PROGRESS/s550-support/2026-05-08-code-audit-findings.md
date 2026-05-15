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

---

## 2026-05-09 Follow-Up Audit

Scope reviewed: latest implementation after the post-audit fixes on `feature/s550-support`, specifically the diff from `origin/feature/s550-support` to `HEAD`.

### Status of Prior Finding 1

The direct WAV import path was substantially improved:

- `ImportSampleDialog` now sources bank options from `memoryLayout.getWaveBanksForTone(toneIndex)` and validates at runtime against both `config.maxWaveBankIndex` and the tone's allowed bank set:
  - [modules/roland-sxx0-editor/src/components/library/ImportSampleDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/library/ImportSampleDialog.tsx:62)
- The editor-side type chain was widened from `0 | 1` to `number` through the affected import hooks and shared S-series editor contract:
  - [modules/roland-sxx0-editor/src/pages/TonesPage.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/pages/TonesPage.tsx:35)
  - [modules/roland-sxx0-editor/src/hooks/useLibraryImport.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/hooks/useLibraryImport.ts:41)
  - [modules/sampler-devices/src/devices/s330/s330-types.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/sampler-devices/src/devices/s330/s330-types.ts:134)
- Unit coverage was added for the wave-bank boundary behavior:
  - [modules/roland-sxx0-editor/test/unit/memory-layout.test.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/unit/memory-layout.test.ts:1)

Targeted verification run:

- `pnpm --filter ./modules/roland-sxx0-editor test -- memory-layout`
- Result: 7 tests passed

### New Findings

#### 1. Medium — Wave-bank fix is still incomplete across shared import surfaces

`ImportSampleDialog` was fixed, but `ImportLibraryPatchDialog` still hard-codes only `Bank A` / `Bank B`, so the S-550 block-2 patch import path can still drift from the corrected direct-import path.

- `ImportSampleDialog` now uses memory-layout-driven bank options:
  - [modules/roland-sxx0-editor/src/components/library/ImportSampleDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/library/ImportSampleDialog.tsx:69)
- `ImportLibraryToneDialog` already uses `targetGroup.waveBankLabels`:
  - [modules/roland-sxx0-editor/src/components/library/ImportLibraryToneDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/library/ImportLibraryToneDialog.tsx:322)
- `ImportLibraryPatchDialog` still has inline A/B-only options:
  - [modules/roland-sxx0-editor/src/components/library/ImportLibraryPatchDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/library/ImportLibraryPatchDialog.tsx:567)
  - [modules/roland-sxx0-editor/src/components/library/ImportLibraryPatchDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/library/ImportLibraryPatchDialog.tsx:579)

Impact: the business rule is still duplicated across sibling dialogs, and the S-550 import experience remains inconsistent depending on which import entry point the user takes.

#### 2. Medium — `ImportSampleDialog` still formats the target tone label incorrectly instead of using `MemoryLayout`

The dialog title still renders `Import Sample to T{toneIndex + 11}`, which is not the configured slot formatter and becomes wrong for many slots, especially S-550 block 2.

- Arithmetic-based label:
  - [modules/roland-sxx0-editor/src/components/library/ImportSampleDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/library/ImportSampleDialog.tsx:192)
- Correct device-driven formatter contract:
  - [modules/roland-sxx0-editor/src/configs/memory-layout.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/configs/memory-layout.ts:65)
  - [modules/roland-sxx0-editor/src/configs/memory-layout.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/configs/memory-layout.ts:147)

Concrete example:

- S-550 tone index `32` should be `T51` per `MemoryLayout.formatToneSlot`
- Current dialog title would render it as `T43`

Impact: the dialog now offers the right bank choices but can still present the wrong destination identity, which is a UI correctness issue in the shared redesign surface.

#### 3. Low — New tests cover only the pure layout helper, not the dialogs that consume it

The new unit test file correctly pins `getWaveBanksForTone()`, but it does not exercise the dialog behavior that reads those values, which is why the patch-import hardcoding and incorrect title formatting still survive.

- Pure layout coverage:
  - [modules/roland-sxx0-editor/test/unit/memory-layout.test.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/unit/memory-layout.test.ts:1)

Impact: the project now has better boundary coverage for the underlying layout logic, but still lacks component-level protection for these shared import surfaces.

### Updated Refactor Priorities

1. Apply the same memory-layout-driven bank-option source to `ImportLibraryPatchDialog` so all import dialogs share one bank-selection rule. **Status:** filed as [#396](https://github.com/audiocontrol-org/audiocontrol/issues/396).
2. Replace arithmetic tone-slot labels in `ImportSampleDialog` with `memoryLayout.formatToneSlot(toneIndex)`. **Status:** fixed inline as part of Phase 10 Task 1 follow-up (commit accompanying this audit-doc update). Sibling arithmetic-label bugs in `ToneZoneEditor.tsx:196` and `PlayPage.tsx:383` filed as [#397](https://github.com/audiocontrol-org/audiocontrol/issues/397) — same defect class, different surfaces, latent for S-330 banks 2-4 too.
3. Add component or UI-harness coverage around the import dialogs, not just the layout helper. **Status:** absorbed into Phase 9 Task 6 (UI-test-harness prerequisite — see workplan).

---

## 2026-05-09 Second Follow-Up Audit

Scope reviewed: latest implementation on `feature/s550-support` after the follow-up fixes through commit `f02d37a2`, focusing on the diff from `origin/feature/s550-support` to `HEAD`.

### Status of Prior Follow-Up Findings

- `ImportLibraryPatchDialog` now sources wave-bank options from `memoryLayout.getWaveBanksForTone(mapping.targetSlot)` and clamps the selected bank when the target slot crosses the S-550 block boundary:
  - [modules/roland-sxx0-editor/src/components/library/ImportLibraryPatchDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/library/ImportLibraryPatchDialog.tsx:531)
- `ImportSampleDialog` now uses `memoryLayout.formatToneSlot(toneIndex)` for the dialog title:
  - [modules/roland-sxx0-editor/src/components/library/ImportSampleDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/library/ImportSampleDialog.tsx:202)
- `ImportLibraryToneDialog` and `ImportSamplesDialog` have both been widened to `waveBank: number` on their editor-side contracts:
  - [modules/roland-sxx0-editor/src/components/library/ImportLibraryToneDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/library/ImportLibraryToneDialog.tsx:49)
  - [modules/roland-sxx0-editor/src/components/library/ImportSamplesDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/library/ImportSamplesDialog.tsx:36)
- Slot-label arithmetic cleanup was propagated into additional surfaces, including `PlayPage` patch labels and `useLibraryExport` progress/error copy:
  - [modules/roland-sxx0-editor/src/pages/PlayPage.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/pages/PlayPage.tsx:377)
  - [modules/roland-sxx0-editor/src/hooks/useLibraryExport.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/hooks/useLibraryExport.ts:333)

### New Findings

#### 1. Medium — `ImportSamplesDialog` still bypasses the authoritative empty-slot helpers and mislabels loaded-empty ranges as overwrites

The dialog’s overwrite affordances still treat “slot object exists” as “occupied” instead of reusing `isToneSlotEmpty` / `isPatchSlotEmpty` from `slot-allocation.ts`.

Tone-range labeling still uses raw `undefined` checks:

- [modules/roland-sxx0-editor/src/components/library/ImportSamplesDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/library/ImportSamplesDialog.tsx:311)

Patch-slot/range labeling still uses raw `undefined` checks:

- [modules/roland-sxx0-editor/src/components/library/ImportSamplesDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/library/ImportSamplesDialog.tsx:442)
- [modules/roland-sxx0-editor/src/components/library/ImportSamplesDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/library/ImportSamplesDialog.tsx:453)

But the authoritative rules already exist here:

- `isToneSlotEmpty`:
  - [modules/roland-sxx0-editor/src/lib/slot-allocation.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/lib/slot-allocation.ts:101)
- `isPatchSlotEmpty`:
  - [modules/roland-sxx0-editor/src/lib/slot-allocation.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/lib/slot-allocation.ts:112)

Impact: once device data is loaded, empty-but-allocated slots can still be shown as “will overwrite” in the sample-bundle import flow even though the shared allocation logic would consider them available. This is the same duplication/drift class already fixed in other surfaces.

#### 2. Low — Patch export still reimplements dialog opening in `PatchesPage` instead of using the shared imperative opener

`useLibraryExport` already exposes `openExportPatchDialog`, but `PatchesPage` still does its own connect + lookup + drag-payload shim through `handleDropDevicePatch`.

Shared opener:

- [modules/roland-sxx0-editor/src/hooks/useLibraryExport.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/hooks/useLibraryExport.ts:153)

Page-level shim still in place:

- [modules/roland-sxx0-editor/src/pages/PatchesPage.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/pages/PatchesPage.tsx:149)

Impact: this is now mostly a reuse/maintenance issue rather than a correctness bug, but it remains one of the few surviving examples of page-level orchestration duplicating hook behavior instead of consuming the shared API directly.

#### 3. Low — UI-harness coverage for the redesign still has not materialized

The test-harness Playwright config still points at `./test/ui`, but the directory still contains only `.gitkeep`.

- Harness config:
  - [modules/roland-sxx0-editor/playwright.test-harness.config.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/playwright.test-harness.config.ts:21)
- Current test-ui directory contents:
  - `modules/roland-sxx0-editor/test/ui/.gitkeep`

Impact: the recent functional fixes improved code-path correctness, but there is still no automated UI-level protection against redesign drift across the shared S-330/S-550 surfaces.

---

## 2026-05-14 Follow-Up Audit

Scope reviewed: latest implementation on `feature/s550-support` after the Phase 9 reopen, using [DEVELOPMENT-NOTES.md](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/DEVELOPMENT-NOTES.md:2707), [README.md](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/docs/1.0/001-IN-PROGRESS/s550-support/README.md:48), and [workplan.md](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/docs/1.0/001-IN-PROGRESS/s550-support/workplan.md:502) as the pathology guide for this pass.

### Status of Prior Findings

- The prior "no UI harness exists" finding is now obsolete. The editor has dev-only harness routes in [modules/roland-sxx0-editor/src/App.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/App.tsx:30), concrete harness pages at [modules/roland-sxx0-editor/src/pages/_harness/AcEnvelopeTableHarness.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/pages/_harness/AcEnvelopeTableHarness.tsx:1) and [modules/roland-sxx0-editor/src/pages/_harness/AcRangeBarHarness.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/pages/_harness/AcRangeBarHarness.tsx:1), plus a real contract spec at [modules/roland-sxx0-editor/test/ui/AcEnvelopeTable.contract.spec.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/ui/AcEnvelopeTable.contract.spec.ts:1).
- The prior patch-export duplication finding is also obsolete. `PatchesPage` now connects the library on demand and delegates to `openExportPatchDialog(...)` in [modules/roland-sxx0-editor/src/pages/PatchesPage.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/pages/PatchesPage.tsx:180), matching the shared hook contract in [modules/roland-sxx0-editor/src/hooks/useLibraryExport.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/hooks/useLibraryExport.ts:153).

### New Findings

#### 1. High — The Phase 9 false-closure test pathology still exists in the current tree because seam-driven specs remain under `test/ui/`

The branch's own reopened Phase 9 criteria explicitly say a test is not a UI test if it uses `.fill(...)`, `input.value =`, or synthetic events against internal controls, and those patterns must be moved out of `test/ui/` into `test/wiring/`.

- Reopen criteria and migration requirements:
  - [docs/1.0/001-IN-PROGRESS/s550-support/README.md](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/docs/1.0/001-IN-PROGRESS/s550-support/README.md:48)
  - [docs/1.0/001-IN-PROGRESS/s550-support/workplan.md](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/docs/1.0/001-IN-PROGRESS/s550-support/workplan.md:516)
  - [docs/1.0/001-IN-PROGRESS/s550-support/workplan.md](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/docs/1.0/001-IN-PROGRESS/s550-support/workplan.md:667)
  - [docs/1.0/001-IN-PROGRESS/s550-support/workplan.md](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/docs/1.0/001-IN-PROGRESS/s550-support/workplan.md:683)
  - [docs/1.0/001-IN-PROGRESS/s550-support/workplan.md](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/docs/1.0/001-IN-PROGRESS/s550-support/workplan.md:688)
- The new tier docs forbid those patterns inside `test/ui/`:
  - [modules/roland-sxx0-editor/test/ui/contract/README.md](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/ui/contract/README.md:29)
  - [modules/roland-sxx0-editor/test/ui/in-context/README.md](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/ui/in-context/README.md:37)
- But the legacy `test/ui/capabilities/` tree still exists and still contains seam-driven specs:
  - `.fill(...)` in [modules/roland-sxx0-editor/test/ui/capabilities/patch-writes.spec.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/ui/capabilities/patch-writes.spec.ts:149)
  - `.fill(...)` in [modules/roland-sxx0-editor/test/ui/capabilities/tone-writes.spec.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/ui/capabilities/tone-writes.spec.ts:113)
  - `.fill(...)` in [modules/roland-sxx0-editor/test/ui/capabilities/play-writes.spec.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/ui/capabilities/play-writes.spec.ts:134)
  - synthetic DnD events in [modules/roland-sxx0-editor/test/ui/capabilities/library-flows-dnd-helpers.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/ui/capabilities/library-flows-dnd-helpers.ts:168)

Impact: the repo now has the correct theory of testing, but the tree still advertises many Tier 1 wiring checks as `test/ui` evidence. That is the exact failure mode called out in the 2026-05-13 Phase 9 reopen and it still weakens any claim that the redesign is protected against S-330/S-550 UI drift.

#### 2. Medium — `ImportSamplesDialog` still duplicates occupancy rules instead of using the shared slot-allocation helpers

The sample-bundle import flow still decides "will overwrite" by checking whether array entries are `undefined`, not whether the slots are logically empty under the shared allocation rules.

- Tone-range overwrite labeling still uses raw `undefined` checks:
  - [modules/roland-sxx0-editor/src/components/library/ImportSamplesDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/library/ImportSamplesDialog.tsx:304)
- Patch-slot and patch-range overwrite labeling still use raw `undefined` checks:
  - [modules/roland-sxx0-editor/src/components/library/ImportSamplesDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/library/ImportSamplesDialog.tsx:413)
  - [modules/roland-sxx0-editor/src/components/library/ImportSamplesDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/library/ImportSamplesDialog.tsx:424)
- The authoritative helpers already exist:
  - [modules/roland-sxx0-editor/src/lib/slot-allocation.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/lib/slot-allocation.ts:101)
  - [modules/roland-sxx0-editor/src/lib/slot-allocation.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/lib/slot-allocation.ts:112)

Impact: empty-but-loaded tones or patches can still be marked as overwrite targets in one import surface while other surfaces correctly treat them as available. This remains a live business-logic drift bug, not just a style issue.

#### 3. Medium — The reopened PlayPage occlusion bug is still visible in production code

The feature docs and notes explicitly call out the legacy sticky page header as the reason the PlayPage surface still fails the redesign closure gate, and that structure is still present.

- Reopen rationale:
  - [docs/1.0/001-IN-PROGRESS/s550-support/README.md](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/docs/1.0/001-IN-PROGRESS/s550-support/README.md:48)
  - [DEVELOPMENT-NOTES.md](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/DEVELOPMENT-NOTES.md:2744)
- Current code still renders the fixed-viewport shell with `.ac-page-sticky-header`:
  - [modules/roland-sxx0-editor/src/pages/PlayPage.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/pages/PlayPage.tsx:261)

Impact: even after the primitive interaction fixes, the Play surface still carries the known page-level layering pathology that can make the operator-facing controls unreachable. That is a direct visual and functional drift risk inside the shared redesign rollout.

### Updated Refactor Priorities

1. Complete Phase 9R-A.2 exactly as written: move seam-driven specs out of `modules/roland-sxx0-editor/test/ui/capabilities/` into `test/wiring/`, then enforce the zero-`.fill()` / zero-`dispatchEvent()` grep gate inside `test/ui/`.
2. Refactor `ImportSamplesDialog` to reuse `isToneSlotEmpty` and `isPatchSlotEmpty` so overwrite affordances share the same business-rule source as the rest of the editor.
3. Resolve the PlayPage sticky-header layering bug before treating the redesigned page chrome as visually stable across S-330 and S-550.

---

## 2026-05-14 Second Follow-Up Audit

Scope reviewed: latest remediation work after the prior 2026-05-14 audit, with emphasis on whether the branch has actually displaced the false-closure test patterns, eliminated duplicated shared business rules, and resolved the known PlayPage layering bug.

### Status of Prior Findings

- The shared empty-slot drift in list surfaces is fixed. `ToneList` and `PatchList` now reuse the canonical helpers from `slot-allocation.ts` instead of reimplementing empty-state logic:
  - [modules/roland-sxx0-editor/src/components/tones/ToneList.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/tones/ToneList.tsx:26)
  - [modules/roland-sxx0-editor/src/components/patches/PatchList.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/patches/PatchList.tsx:26)
- The patch-export reuse gap is fixed. `PatchesPage` now delegates to `openExportPatchDialog(...)` instead of shimming the export path itself:
  - [modules/roland-sxx0-editor/src/pages/PatchesPage.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/pages/PatchesPage.tsx:180)
  - [modules/roland-sxx0-editor/src/hooks/useLibraryExport.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/hooks/useLibraryExport.ts:153)
- The harness/contract infrastructure is now real. The editor exposes dev-only harness routes and at least one concrete contract spec:
  - [modules/roland-sxx0-editor/src/App.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/App.tsx:30)
  - [modules/roland-sxx0-editor/src/pages/_harness/AcRangeBarHarness.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/pages/_harness/AcRangeBarHarness.tsx:13)
  - [modules/roland-sxx0-editor/test/ui/contract/AcEnvelopeTable.contract.spec.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/ui/contract/AcEnvelopeTable.contract.spec.ts:1)

### New Findings

#### 1. High — The tree is still in the exact mixed test state the Phase 9 reopen was meant to eliminate

The remediation plan says Tier 1 wiring specs must move to `test/wiring/`, and `test/ui/` must be free of seam-driven patterns such as `.fill(...)`, `dispatchEvent(...)`, and `getByTestId(...)`.

- Required end state:
  - [docs/1.0/001-IN-PROGRESS/s550-support/workplan.md](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/docs/1.0/001-IN-PROGRESS/s550-support/workplan.md:516)
  - [docs/1.0/001-IN-PROGRESS/s550-support/workplan.md](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/docs/1.0/001-IN-PROGRESS/s550-support/workplan.md:667)
  - [docs/1.0/001-IN-PROGRESS/s550-support/workplan.md](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/docs/1.0/001-IN-PROGRESS/s550-support/workplan.md:683)
  - [docs/1.0/001-IN-PROGRESS/s550-support/workplan.md](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/docs/1.0/001-IN-PROGRESS/s550-support/workplan.md:688)
- `test/wiring/` still contains only the migration README:
  - [modules/roland-sxx0-editor/test/wiring/README.md](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/wiring/README.md:43)
- But seam-driven specs are still under `test/ui/capabilities/`:
  - `.fill(...)` in [modules/roland-sxx0-editor/test/ui/capabilities/patch-writes.spec.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/ui/capabilities/patch-writes.spec.ts:149)
  - `.fill(...)` in [modules/roland-sxx0-editor/test/ui/capabilities/tone-writes.spec.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/ui/capabilities/tone-writes.spec.ts:113)
  - `.fill(...)` in [modules/roland-sxx0-editor/test/ui/capabilities/play-writes.spec.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/ui/capabilities/play-writes.spec.ts:134)
  - synthetic drag/drop events in [modules/roland-sxx0-editor/test/ui/capabilities/library-flows-dnd-helpers.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/ui/capabilities/library-flows-dnd-helpers.ts:168)
- Even the remaining root `test/ui` smoke specs still use forbidden `data-testid` selectors and direct click flows:
  - [modules/roland-sxx0-editor/test/ui/play.spec.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/ui/play.spec.ts:59)
  - [modules/roland-sxx0-editor/test/ui/patches.spec.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/ui/patches.spec.ts:71)
  - [modules/roland-sxx0-editor/test/ui/patches.spec.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/ui/patches.spec.ts:132)
  - [modules/roland-sxx0-editor/test/ui/tones.spec.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/ui/tones.spec.ts:56)
  - [modules/roland-sxx0-editor/test/ui/tones.spec.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/ui/tones.spec.ts:80)

Impact: the repo now contains the new testing doctrine and some real contract infrastructure, but the old invalid evidence still lives under the UI tree. That preserves the same ambiguity that caused the original false closure.

#### 2. Medium — `ImportSamplesDialog` still duplicates overwrite detection instead of using the shared slot-allocation rules

This import surface still determines occupancy by checking whether entries are `undefined`, not whether they are logically empty per the shared helpers.

- Tone-range overwrite detection:
  - [modules/roland-sxx0-editor/src/components/library/ImportSamplesDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/library/ImportSamplesDialog.tsx:304)
- Patch-slot and patch-range overwrite detection:
  - [modules/roland-sxx0-editor/src/components/library/ImportSamplesDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/library/ImportSamplesDialog.tsx:413)
  - [modules/roland-sxx0-editor/src/components/library/ImportSamplesDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/library/ImportSamplesDialog.tsx:424)
- Shared helpers already in use elsewhere:
  - [modules/roland-sxx0-editor/src/lib/slot-allocation.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/lib/slot-allocation.ts:101)
  - [modules/roland-sxx0-editor/src/lib/slot-allocation.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/lib/slot-allocation.ts:112)
  - [modules/roland-sxx0-editor/src/components/library/ImportLibraryPatchDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/library/ImportLibraryPatchDialog.tsx:356)
  - [modules/roland-sxx0-editor/src/components/library/ImportLibraryToneDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/library/ImportLibraryToneDialog.tsx:226)

Impact: one shared import surface can still tell the user a slot "will overwrite" while sibling surfaces using the canonical helpers would treat the same slot as empty. This remains a concrete business-rule drift bug.

#### 3. Medium — The known PlayPage sticky-header layering defect is still present in the production page structure

The reopen docs still identify the legacy sticky page header as a blocking defect for PlayPage closure, and the current page still renders that structure.

- Reopen rationale:
  - [docs/1.0/001-IN-PROGRESS/s550-support/README.md](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/docs/1.0/001-IN-PROGRESS/s550-support/README.md:48)
  - [DEVELOPMENT-NOTES.md](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/DEVELOPMENT-NOTES.md:2744)
- Current production structure:
  - [modules/roland-sxx0-editor/src/pages/PlayPage.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/pages/PlayPage.tsx:261)

Impact: even with primitive interaction work landing underneath, the page-level chrome still carries the known context bug that can make the visible controls unreachable.

### Updated Refactor Priorities

1. Finish the Phase 9R-A.2 migration instead of leaving it half-landed: move the legacy capability specs into `test/wiring/`, then make the `test/ui/` grep gate actually pass.
2. Refactor `ImportSamplesDialog` to consume `isToneSlotEmpty` / `isPatchSlotEmpty` so all import affordances share one occupancy rule.
3. Remove or rework the PlayPage sticky-header layering before treating the redesigned page shell as closed across S-330 and S-550.

---

## 2026-05-14 Third Follow-Up Audit

Scope reviewed: latest remediation tranche after the prior 2026-05-14 audit, focused on whether the test-tree split actually landed, whether the rendering smoke spec was demoted out of `test/ui`, and whether the two remaining code-level issues changed.

### Status of Prior Findings

- The large Phase 9R-A.2 migration has materially landed. The former `test/ui/capabilities/` suite is now under `test/wiring/`:
  - [modules/roland-sxx0-editor/test/wiring/patch-writes.spec.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/wiring/patch-writes.spec.ts:1)
  - [modules/roland-sxx0-editor/test/wiring/tone-writes.spec.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/wiring/tone-writes.spec.ts:1)
  - [modules/roland-sxx0-editor/test/wiring/play-writes.spec.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/wiring/play-writes.spec.ts:1)
  - [modules/roland-sxx0-editor/test/wiring/library-flows-dnd.spec.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/wiring/library-flows-dnd.spec.ts:1)
- The screenshot smoke spec has also been demoted out of `test/ui` into a rendering tier:
  - [modules/roland-sxx0-editor/test/rendering/phase-9-task-6-screenshots.spec.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/rendering/phase-9-task-6-screenshots.spec.ts:1)
  - [modules/roland-sxx0-editor/test/rendering/README.md](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/rendering/README.md:1)

These changes close the earlier finding that the repo was still carrying the old capability suite inside `test/ui/`.

### New Findings

#### 1. Medium — `test/ui/` still contains root-level specs that violate the in-context test contract

The migration moved the old capability suite, but the remaining root `test/ui` specs still use `getByTestId(...)` and direct `.click()` flows even though the in-context tier doc forbids those patterns.

- In-context tier forbid-list:
  - [modules/roland-sxx0-editor/test/ui/in-context/README.md](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/ui/in-context/README.md:37)
- Current root `test/ui` examples still using forbidden selectors/flows:
  - [modules/roland-sxx0-editor/test/ui/play.spec.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/ui/play.spec.ts:59)
  - [modules/roland-sxx0-editor/test/ui/home.spec.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/ui/home.spec.ts:66)
  - [modules/roland-sxx0-editor/test/ui/library.spec.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/ui/library.spec.ts:55)
  - [modules/roland-sxx0-editor/test/ui/patches.spec.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/ui/patches.spec.ts:71)
  - [modules/roland-sxx0-editor/test/ui/patches.spec.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/ui/patches.spec.ts:132)
  - [modules/roland-sxx0-editor/test/ui/tones.spec.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/ui/tones.spec.ts:56)
  - [modules/roland-sxx0-editor/test/ui/tones.spec.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/ui/tones.spec.ts:80)
  - [modules/roland-sxx0-editor/test/ui/page-viewport-containment.spec.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/test/ui/page-viewport-containment.spec.ts:91)

Impact: the misleading bulk of the old UI evidence is gone, but `test/ui` is still not cleanly aligned with its own contract. The residual risk is narrower now: it is concentrated in the root smoke/in-context specs rather than the entire former capability suite.

#### 2. Medium — `ImportSamplesDialog` still duplicates overwrite detection instead of using the shared slot-allocation rules

This remained unchanged in the latest tranche. Tone and patch overwrite affordances still derive occupancy from raw `undefined` checks rather than the shared helpers.

- Tone-range overwrite detection:
  - [modules/roland-sxx0-editor/src/components/library/ImportSamplesDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/library/ImportSamplesDialog.tsx:304)
- Patch-slot and patch-range overwrite detection:
  - [modules/roland-sxx0-editor/src/components/library/ImportSamplesDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/library/ImportSamplesDialog.tsx:413)
  - [modules/roland-sxx0-editor/src/components/library/ImportSamplesDialog.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/components/library/ImportSamplesDialog.tsx:424)
- Canonical helpers:
  - [modules/roland-sxx0-editor/src/lib/slot-allocation.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/lib/slot-allocation.ts:101)
  - [modules/roland-sxx0-editor/src/lib/slot-allocation.ts](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/lib/slot-allocation.ts:112)

Impact: this is still a genuine shared-business-logic drift risk in one of the library import surfaces.

#### 3. Medium — The known PlayPage sticky-header layering defect is still present in the production structure

This also remained unchanged in the latest tranche. The page still renders the legacy sticky-header structure inside the fixed-viewport shell.

- Reopen rationale:
  - [docs/1.0/001-IN-PROGRESS/s550-support/README.md](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/docs/1.0/001-IN-PROGRESS/s550-support/README.md:48)
  - [DEVELOPMENT-NOTES.md](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/DEVELOPMENT-NOTES.md:2744)
- Current structure:
  - [modules/roland-sxx0-editor/src/pages/PlayPage.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/modules/roland-sxx0-editor/src/pages/PlayPage.tsx:261)

Impact: the page-level chrome still carries the context bug explicitly called out in the Phase 9 reopen, so this surface should not yet be treated as redesign-closed.

### Updated Refactor Priorities

1. Finish cleaning the remaining root `test/ui` specs so the in-context tier actually obeys its documented selector and interaction rules.
2. Refactor `ImportSamplesDialog` to use `isToneSlotEmpty` / `isPatchSlotEmpty`.
3. Remove or redesign the PlayPage sticky-header layering that still blocks final closure of the shared page shell.

### Controller ACK — 2026-05-14 (evening)

All three 2026-05-14 audit appendices read end-to-end and each finding independently verified against current HEAD. Disposition:

- **Test-tree pathology (First + Second Audit, Finding 1):** CLOSED by this session's 9R-A.2 (commits `b5a6085b` + `acd07d2f` + `ed87cccf`). The Third Audit's "materially landed" status is correct; the migration's full set (21 source files + rendering smoke + new make targets + pipeline integration) shipped during this session and the controller independently re-verified 136 wiring + 26 ui + 14 rendering = 176 passed / 4 skipped (matches pre-migration baseline).
- **Third Audit Finding 1 (`getByTestId` / `.click()` in 5 root `test/ui/*.spec.ts` files):** ACCEPTED. Verified independently — `home.spec.ts:66/75`, `library.spec.ts:55/56`, `patches.spec.ts:71/132`, `play.spec.ts:59/72-73`, `tones.spec.ts:56/80` all match the auditor's citations. Root cause confirmed: 9R-A.2's grep audit only checked `.fill(` / `.value =` / `dispatchEvent(`, not `getByTestId` / `.click()`; the ESLint plugin's lint scope only covers `test/ui/contract/**` + `test/ui/in-context/**`, leaving the root smoke specs ungated. **Filed as [#426](https://github.com/audiocontrol-org/audiocontrol/issues/426) and scoped into workplan Phase 11 §Task 3** with three operator-choice disposition options (Option A migrate to in-context / Option B demote to rendering / Option C delete + replace).
- **Third Audit Finding 2 (`ImportSamplesDialog` raw `undefined` occupancy checks):** ACKNOWLEDGED. Verified at lines 304 + 413 + 424 (matches auditor's citations). Already tracked as **[#425](https://github.com/audiocontrol-org/audiocontrol/issues/425) / workplan Phase 11 §Task 1**. Carried over from First + Second audits unchanged.
- **Third Audit Finding 3 (PlayPage `.ac-page-sticky-header`):** ACKNOWLEDGED. Verified at `PlayPage.tsx:262` (auditor cited line 261; off by one due to a minor diff drift). Already tracked as **[#423](https://github.com/audiocontrol-org/audiocontrol/issues/423)** and explicitly named in workplan §9R-C's per-page acceptance criteria as a blocking defect for PlayPage closure.

Doc-hygiene fix in this commit: the original Third Audit had two consecutive `### Updated Refactor Priorities` blocks. The second block was leftover content from an earlier draft — its `PatchesPage` → `openExportPatchDialog` priority was already marked as FIXED in the Second Audit's "Status of Prior Findings." Removed the stale second block; the first block (lines 476-480) reflects the actual Third Audit findings and is preserved verbatim.

Open items at session end: #425, #426, #423, plus a known stale workplan/README header-block bloat (separate doc-quality MINOR carried from 9R-A.3.B's code review).
