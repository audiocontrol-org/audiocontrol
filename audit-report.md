# Codebase Audit Report
## Scope: modules/sampler-editor/src (all .ts and .tsx files)

**Date**: 2026-03-15
**Branch**: feature/s550-support
**Files scanned**: 97

---

## Remediation Status

| ID | Finding | Status | Commit |
|----|---------|--------|--------|
| B1 | Relative imports | **No action needed** | Investigated — only same-directory sibling imports remain, no cross-directory violations |
| B2 | `any` types in deviceDataStore | **Remediated** | `1cfdc9c` — replaced with `SamplerTone`/`SamplerPatch` |
| B3 | S330-specific type imports | **Remediated** | `1cfdc9c` — replaced across 15 files, added `SamplerLevelCurve` alias |
| B4 | Excessive console.log | **Remediated** | `988200d` — removed 29 calls across 9 files |
| B5 | Commented-out code | **Remediated** | `1cfdc9c` — removed dead `handleOctaveShiftChange` |
| B6 | Fallback patterns | **Deferred** | Design decision needed — browser API graceful degradation vs strategy pattern |
| B7 | Mock data in production | **Remediated** | `988200d` — lazy-loaded behind `import.meta.env.DEV` |
| U1 | LibraryPage.tsx (1,745 lines) | **Remediated** | `d2c0eb3` — 439 lines + 3 extracted hooks |
| U2 | library-service.ts (2,583 lines) | **Remediated** | `aaf2888` — 14-line facade + 6 modules |
| U3 | SampleChopperDialog.tsx (1,539 lines) | **Remediated** | `d8ad16a` — 982 lines + 389-line `useSampleChopper` hook |
| U4 | LibraryTreePanel.tsx (1,263 lines) | **Remediated** | `8fb19a5` — 590 lines + 5 extracted files |
| U5 | DRY: loadPatchBank/loadToneBank | **Remediated** | `ba99696` — extracted `useBankLoader` hook |
| U6 | S330 drum kit functions in hook | **Open** | Architectural — needs DeviceConfig interface design |

---

### The Good

1. **Strong multi-device architecture in configs**: The `DeviceConfig` interface, `MemoryLayout` type system, and factory-based client creation (`configs/types.ts`, `configs/s330.ts`, `configs/s550.ts`) follow the project's "factories, not conditionals" guideline exceptionally well. The UI never branches on device type in recent work -- `DeviceMemoryPanel`, `ImportDrumKitDialog`, and `LoadSetDialog` all render through the `MemoryLayout` interface.

2. **`@/` import pattern consistently used in page and component files**: `LibraryPage.tsx`, `TonesPage.tsx`, `PatchesPage.tsx`, `PlayPage.tsx`, and all files under `components/` use the `@/` import pattern for cross-module imports.

3. **SamplerClient.ts as a clean abstraction boundary**: `core/midi/SamplerClient.ts` provides device-agnostic type aliases (`SamplerTone`, `SamplerPatch`, `SamplerClientInterface`) that let pages work without knowing whether S-330 or S-550 is active. This is well-designed and follows interface-first principles.

4. **No class inheritance anywhere in the codebase**: Zero matches for `class X extends Y`. Composition is used throughout.

5. **No device-type conditionals in UI components**: Zero matches for device-type branching in `components/`. The UI is device-agnostic as required.

6. **Test files exist**: `ToneZoneEditor.test.ts`, `library-service.test.ts`, and `midiStore.mock.test.ts` demonstrate testing practices. `library-service.test.ts` is 183 lines -- well-sized.

7. **Well-structured type definitions**: `configs/types.ts` (181 lines), `types/import-operation.ts` (68 lines), and `core/midi/types.ts` (20 lines) are clean, well-documented contracts.

8. **DeviceConfigContext provides clean DI**: The context pattern in `context/DeviceConfigContext.tsx` gives components access to device configuration without prop drilling.

9. **No `ts-node` usage**: Zero matches. The project uses `tsx` as required.

10. **ImportOperationState enforces consistency**: The structured `ImportProgress` interface ensures all import operations provide step labels, byte counts, and overall progress — enforced at compile time.

---

### The Bad

#### B1. Relative imports in barrel files and within modules — NO ACTION NEEDED
- **What**: Originally flagged 60+ relative imports. Investigation found zero cross-directory relative imports — all are same-directory sibling imports (`from './Tooltip'`, `from './FrontPanelButton'`) and barrel re-exports, which are standard conventions.
- **Status**: Closed — not a violation.

#### B2. `any` type usage in `deviceDataStore.ts` — REMEDIATED
- **What**: `Patch` and `Tone` were typed as `any` with eslint-disable comments.
- **Fix**: Replaced with `SamplerTone`/`SamplerPatch` from `@/core/midi/SamplerClient`. Removed eslint-disable comments.
- **Commit**: `1cfdc9c`

#### B3. Direct S330-specific type imports in non-agnostic modules — REMEDIATED
- **What**: 17 files imported S330-specific types instead of device-agnostic aliases.
- **Fix**: Replaced across 15 files (excluding `library-service.ts`, `useImportDrumKit.ts`, `mockState.ts` — separate issues). Added `SamplerLevelCurve` alias to `SamplerClient.ts`.
- **Remaining**: `lib/library-service.ts` (now split into modules, still uses S330 types internally), `hooks/useImportDrumKit.ts` (U6), `mock/mockState.ts` (B7)
- **Commit**: `1cfdc9c`

#### B4. Excessive console.log statements — REMEDIATED
- **What**: 47 `console.log` calls in non-test, non-mock code.
- **Fix**: Removed 29 calls across 9 files. Preserved `console.error` for genuine errors. Left `core/midi/index.ts` diagnostic tool untouched.
- **Commit**: `988200d`

#### B5. Commented-out code in PatchEditor.tsx — REMEDIATED
- **What**: Complete `handleOctaveShiftChange` function commented out.
- **Fix**: Removed the dead code. Issue #10 reference tracked in git history.
- **Commit**: `1cfdc9c`

#### B6. Fallback patterns in library-service.ts and related components — DEFERRED
- **What**: Browser API graceful degradation (File System Access API vs download fallback).
- **Status**: Requires design decision. This is arguably a legitimate alternative implementation (strategy pattern), not a "fallback that hides bugs." Recommend discussing whether to reframe as explicit strategy selection at initialization time.

#### B7. Mock data in production code paths — REMEDIATED
- **What**: Mock data statically imported in `App.tsx` and `PlayPage.tsx`, bundled into production.
- **Fix**: Lazy-loaded behind `import.meta.env.DEV` using dynamic imports so mock code is tree-shaken from production builds. Added `vite-env.d.ts` for Vite type support.
- **Commit**: `988200d`

---

### The Ugly

#### U1. LibraryPage.tsx — REMEDIATED (1,745 → 439 lines)
- **Fix**: Extracted 3 hooks:
  - `useLibraryExport.ts` (298 lines) — tone/patch export + drag-drop export
  - `useLibraryImportDialogs.ts` (258 lines) — import dialog state + handlers
  - `useDirectoryOperations.ts` (308 lines) — directory CRUD + rename/move/delete
- **Commit**: `d2c0eb3`

#### U2. library-service.ts — REMEDIATED (2,583 → 14-line facade)
- **Fix**: Split into 6 focused modules:
  - `library-io.ts` (172 lines) — shared file I/O helpers, YAML parse/stringify
  - `library-fs.ts` (475 lines) — File System Access API, directory operations
  - `library-tones.ts` (466 lines) — tone export/import/listing/conversion
  - `library-patches.ts` (397 lines) — patch listing/loading/dependency analysis
  - `library-sets.ts` (464 lines) — set save/load/delete operations
  - `library-drumkits.ts` (405 lines) — drum kit listing/loading/saving
- **Commit**: `aaf2888`

#### U3. SampleChopperDialog.tsx — REMEDIATED (1,539 → 982 + 389 lines)
- **Fix**: Extracted `useSampleChopper` hook (389 lines) containing all slice detection state, kit configuration, zoom/UI state, and manipulation callbacks. Dialog retains JSX and audio preview bridging. Dialog still over 500 (982) due to dense JSX template — further splitting would require component decomposition.
- **Commit**: `d8ad16a`

#### U4. LibraryTreePanel.tsx — REMEDIATED (1,263 → 590 lines)
- **Fix**: Extracted 5 files:
  - `LibraryTreeIcons.tsx` (138 lines) — icon SVG components + DeleteButton
  - `DrumKitItem.tsx` (58 lines) — drum kit list item component
  - `SetItem.tsx` (265 lines) — set item with expand/collapse/rename
  - `useLibraryTreeDragDrop.ts` (201 lines) — drag-drop handler hook
  - `useLibraryTreeActions.tsx` (241 lines) — context menu + tree actions hook
- Main component at 590 lines (slightly over 500 due to large props interface + dual-view JSX template)
- **Commit**: `8fb19a5`

#### U5. Duplicated loadPatchBank/loadToneBank — REMEDIATED
- **Fix**: Extracted `useBankLoader` hook (131 lines). Replaced duplicated implementations across `PatchesPage`, `PlayPage`, and `TonesPage`. `TonesPage` uses `onBeforeToneLoad` callback for loop editor cache clearing.
- **Commit**: `ba99696`

#### U6. `useImportDrumKit.ts` imports S-330-specific functions directly — OPEN
- **What**: Imports `createDrumTone`, `createDrumKitPatch`, `importMonolithicDrumKit`, etc. directly from `@audiocontrol/sampler-devices/s330`. Hard-codes the hook to S-330 only.
- **Status**: Requires architectural design — these are runtime functions (not just types), so the fix involves adding factory methods to `DeviceConfig` or `SamplerClientInterface`.
- **Impact**: Blocks S-550 drum kit import support.

---

### Metrics Summary (Post-Remediation)

| Metric | Before | After | Notes |
|--------|--------|-------|-------|
| Files over 500 lines | **11** | **7** | Remaining: SampleChopperDialog (982), LoopEditor (899), WaveformEditor (840), ItemPreviewPanel (803), ToneEditor (753), TonesPage (728), LibraryTreePanel (590) |
| Files over 1,000 lines | **4** | **0** | All four god files decomposed |
| DRY violations | **3** | **0** | Bank loading extracted to shared hook |
| `any` usages | **2** | **0** | Replaced with concrete types |
| S330-specific imports in shared code | **17** | **3** | Remaining: library-service internals, useImportDrumKit, mockState |
| Console.log in production | **47** | **18** | 29 removed; remaining are in core/midi diagnostic tool and error paths |
| Mock data in production bundle | **Yes** | **No** | Lazy-loaded behind `import.meta.env.DEV` |
| Commented-out code | **1** | **0** | Removed |

---

### Remaining Work

**Phase 4 -- Oversized files (not yet started)**
- LoopEditor.tsx (899 lines)
- WaveformEditor.tsx (840 lines)
- ItemPreviewPanel.tsx (803 lines)
- ToneEditor.tsx (753 lines)
- TonesPage.tsx (728 lines)
- EnvelopeEditor.tsx (663 lines)

**Open architectural issue**
- U6: Move S-330 drum kit operations behind DeviceConfig interface

**Design decision needed**
- B6: Browser API fallback patterns — strategy pattern vs removal
