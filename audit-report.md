# Codebase Audit Report
## Scope: modules/sampler-editor/src (all .ts and .tsx files)

**Date**: 2026-03-15
**Branch**: feature/s550-support
**Files scanned**: 97

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

---

### The Bad

#### B1. Relative imports in barrel files and within modules
- **What**: 60+ files use relative imports (`from './...'` or `from '../...'`). While barrel re-exports (`index.ts` files) using relative imports are a common convention, many non-barrel files also use relative imports. Examples include `WebMidiAdapter.ts`, `configs/s550.ts`, `configs/registry.ts`, `configs/memory-layout.ts`, `PatchEditor.tsx`, `VirtualFrontPanel.tsx`, `ItemPreviewPanel.tsx`, `LibraryTreePanel.tsx`, `SampleChopperDialog.tsx`.
- **Where**: 60+ instances across 30+ files
- **Guideline**: "Never use relative imports -- use `@/` pattern" (CLAUDE.md Critical Don'ts)
- **Remediation**: Systematically replace all relative imports with `@/`-prefixed imports. Barrel `index.ts` files re-exporting siblings are lowest priority; non-barrel files importing from siblings or parents are highest priority.
- **Effort**: M

#### B2. `any` type usage in `deviceDataStore.ts`
- **What**: `Patch` and `Tone` are typed as `any` with eslint-disable comments at lines 15-18. The store erases all type safety for the most critical domain objects.
- **Where**: `stores/deviceDataStore.ts`, lines 15-18
- **Guideline**: "Avoid `any` -- use `unknown` with type guards" (CLAUDE.md TypeScript)
- **Remediation**: Replace `type Patch = any` and `type Tone = any` with the `SamplerPatch` and `SamplerTone` types from `@/core/midi/SamplerClient`. Alternatively, make the store generic.
- **Effort**: S

#### B3. Direct S330-specific type imports in non-agnostic modules
- **What**: 17 files import `S330Tone`, `S330Patch`, `S330ClientInterface`, etc. directly from `@/core/midi/S330Client` instead of using the device-agnostic aliases from `@/core/midi/SamplerClient`. This couples those modules to the S-330 device.
- **Where**: `lib/library-service.ts` (line 13), `lib/slot-allocation.ts` (line 31), `lib/wave-export.ts` (line 20), `lib/best-fit.ts` (line 11), `hooks/useImportDrumKit.ts` (line 14), `hooks/useLibraryImport.ts` (line 10), `mock/mockState.ts` (line 1), `components/tones/ToneList.tsx` (line 5), `components/tones/ToneEditor.tsx` (line 13), `components/patches/PatchList.tsx` (line 5), `components/patches/ToneZoneEditor.tsx` (line 10), `components/library/ItemPreviewPanel.tsx` (line 9), `components/library/LoadSetDialog.tsx` (line 23), `components/ui/ToneSlotMap.tsx` (line 12), `components/ui/MemoryMapPanel.tsx` (line 14), `components/ui/EnvelopeEditor.tsx` (line 13), `components/ui/EnvelopeDisplay.tsx` (line 8)
- **Guideline**: "UI is device-agnostic" and "DRY behind interfaces" (CLAUDE.md Multi-Device Architecture)
- **Remediation**: Replace all `S330Tone`/`S330Patch`/`S330Envelope` imports with `SamplerTone`/`SamplerPatch`/`SamplerEnvelope` from `@/core/midi/SamplerClient`. Add missing re-exports to `SamplerClient.ts`.
- **Effort**: M

#### B4. Excessive console.log statements in non-debug code
- **What**: Over 100 `console.log`, `console.error`, and `console.warn` calls scattered across pages, hooks, and components. Many log routine success paths.
- **Where**: `pages/TonesPage.tsx` (16 calls), `pages/LibraryPage.tsx` (25+), `pages/PlayPage.tsx` (7), `hooks/useImportDrumKit.ts` (10+), `core/midi/WebMidiAdapter.ts` (9), `core/midi/index.ts` (15+), `lib/slot-allocation.ts` (line 444), `hooks/useParameterListener.ts` (line 46)
- **Guideline**: Code quality / code smell
- **Remediation**: Introduce a structured logger utility. Remove routine success-path logging. Keep `console.error` for genuine error conditions.
- **Effort**: M

#### B5. Commented-out code in PatchEditor.tsx
- **What**: Complete function (`handleOctaveShiftChange`) commented out with a reference to "issue #10".
- **Where**: `components/patches/PatchEditor.tsx`, lines 171-181
- **Guideline**: Code smell -- commented-out code should be tracked in issue tracker, not left in source
- **Remediation**: Remove the commented-out code. Issue reference is sufficient to recover from git history.
- **Effort**: S

#### B6. Fallback patterns in library-service.ts and related components
- **What**: `library-service.ts` uses "fallback to download/upload for older browsers" (line 5). `TonesPage.tsx` line 320, `LoopEditor.tsx` line 862, `ItemPreviewPanel.tsx` line 790, `LibraryTreePanel.tsx` line 507 also contain fallback patterns.
- **Where**: `lib/library-service.ts` (lines 5, 820, 859), `pages/TonesPage.tsx` (line 320), `components/tones/LoopEditor.tsx` (line 862), `components/library/ItemPreviewPanel.tsx` (line 790), `components/library/LibraryTreePanel.tsx` (line 507)
- **Guideline**: "Never implement fallbacks or use mock data outside of test code" (CLAUDE.md Error Handling)
- **Remediation**: Evaluate each fallback. Browser API graceful degradation may be legitimate as an alternative implementation. Consider reframing as a strategy pattern with two implementations selected at initialization time.
- **Effort**: M

#### B7. Mock data in production code paths
- **What**: `mock/mockState.ts` and `mock/mockMode.ts` are imported in production code (`App.tsx`, `PlayPage.tsx`, `midiStore.ts`). Mock data is conditionally activated via URL parameter but bundled into production.
- **Where**: `App.tsx` (lines 9-15), `pages/PlayPage.tsx` (lines 16-17, 36-99), `stores/midiStore.ts` (lines 16-43), `mock/mockState.ts`, `mock/mockMode.ts`
- **Guideline**: "Never implement fallbacks or use mock data outside of test code" (CLAUDE.md Critical Don'ts)
- **Remediation**: Move mock mode behind `import.meta.env.DEV` or dynamic imports so mock code is tree-shaken from production. Mock data fixtures belong in `testing/` or a dev-only module.
- **Effort**: M

---

### The Ugly

#### U1. LibraryPage.tsx is 1,745 lines -- 3.5x the maximum
- **What**: The single largest component file, more than triple the 500-line hard maximum. Contains 30+ callback handlers, 20+ state variables, and multiple dialog management flows. Classic god component.
- **Where**: `pages/LibraryPage.tsx` (1,745 lines)
- **Guideline**: "Files must be under 300-500 lines -- refactor larger files" (CLAUDE.md Code Quality / Critical Don'ts)
- **Impact**: Extremely difficult to review, test, or modify without regression risk. Every new library feature compounds the problem. Merge conflict magnet.
- **Remediation**: Extract into 4-5 focused modules: `useLibraryOperations` hook (CRUD), `useLibraryImportExport` hook (dialog state/callbacks), `useLibraryDragDrop` hook, `LibraryDialogOrchestrator` component, and a thin `LibraryPage` shell.
- **Effort**: L

#### U2. library-service.ts is 2,583 lines -- 5x the maximum
- **What**: The largest file in the entire module. Combines filesystem infrastructure, YAML serialization, domain logic, and API concerns.
- **Where**: `lib/library-service.ts` (2,583 lines)
- **Guideline**: "Files must be under 300-500 lines" (CLAUDE.md Code Quality / Critical Don'ts)
- **Impact**: Untestable as a unit -- test file is only 183 lines for 2,583 lines of source. Adding S-550 library features will compound the problem.
- **Remediation**: Split into: `lib/library-fs.ts` (FS API wrappers), `lib/library-sets.ts`, `lib/library-tones.ts`, `lib/library-patches.ts`, `lib/library-drumkits.ts`, `lib/library-yaml.ts`, and a thin facade.
- **Effort**: L

#### U3. SampleChopperDialog.tsx is 1,539 lines -- 3x the maximum
- **What**: Single dialog containing waveform analysis algorithms, slice detection, audio preview, zoom/scroll state, and multi-tab UI. Mixes algorithmic logic with presentation.
- **Where**: `components/library/SampleChopperDialog.tsx` (1,539 lines)
- **Guideline**: "Files must be under 300-500 lines" (CLAUDE.md Code Quality)
- **Impact**: Detection algorithms cannot be unit-tested independently. UI changes risk breaking audio logic.
- **Remediation**: Extract detection/analysis logic into `lib/sample-chopper.ts`, state management into `useSampleChopper` hook, keep dialog as thin UI shell.
- **Effort**: L

#### U4. LibraryTreePanel.tsx is 1,263 lines -- 2.5x the maximum
- **What**: Large tree component with drag-and-drop, context menus, inline renaming, expandable sections, and manifest loading.
- **Where**: `components/library/LibraryTreePanel.tsx` (1,263 lines)
- **Guideline**: "Files must be under 300-500 lines" (CLAUDE.md Code Quality)
- **Impact**: Hard to reason about interactions between tree state, drag-drop, and context menus. Changes to one behavior risk breaking others.
- **Remediation**: Extract tree section components into separate files. Extract drag-drop handling into a hook.
- **Effort**: L

#### U5. Duplicated `loadPatchBank`/`loadToneBank` patterns across pages (DRY violation)
- **What**: Nearly identical `loadPatchBank` implementations in `PlayPage.tsx` (lines 102-138) and `PatchesPage.tsx` (lines 71-100). `loadToneBank` in `TonesPage.tsx` (lines 119-170) follows the same structure. Progress bar rendering is also duplicated.
- **Where**: `pages/PlayPage.tsx` (lines 102-138), `pages/PatchesPage.tsx` (lines 71-100), `pages/TonesPage.tsx` (lines 119-170)
- **Guideline**: "DRY behind interfaces" (CLAUDE.md Multi-Device Architecture)
- **Impact**: Bug fixes or behavior changes must be applied in 3 places. Will worsen as more pages are added for S-550.
- **Remediation**: Extract a `useDataLoader` hook encapsulating the common bank-loading, progress-tracking, and error-handling pattern.
- **Effort**: M

#### U6. `useImportDrumKit.ts` imports S-330-specific functions directly
- **What**: Imports `createEmptyToneLayer`, `setToneAtMidiNote`, `createDrumTone`, `createDrumKitPatch`, `resample`, `importMonolithicDrumKit` directly from `@audiocontrol/sampler-devices/s330` (lines 17-23). Hard-codes the hook to S-330 only.
- **Where**: `hooks/useImportDrumKit.ts`, lines 14-24
- **Guideline**: "UI is device-agnostic" and "Factories, not conditionals" (CLAUDE.md Multi-Device Architecture)
- **Impact**: Cannot reuse for S-550 drum kit imports without duplication or device-type conditionals. Blocks multi-device support for a core workflow.
- **Remediation**: Expose device-specific drum kit operations through `DeviceConfig` or `SamplerClientInterface` as factory methods. The hook should receive these through config context.
- **Effort**: M

---

### Metrics Summary

| Metric | Count | Details |
|--------|-------|---------|
| Files scanned | 97 | All .ts and .tsx in sampler-editor/src |
| Files over 500 lines | **11** | library-service.ts (2583), LibraryPage.tsx (1745), SampleChopperDialog.tsx (1539), LibraryTreePanel.tsx (1263), LoopEditor.tsx (899), WaveformEditor.tsx (840), ItemPreviewPanel.tsx (803), ToneEditor.tsx (753), TonesPage.tsx (728), EnvelopeEditor.tsx (663), ImportLibraryPatchDialog.tsx (634) |
| Files 300-500 lines | **10** | LibraryTreeNode.tsx (595), ToneZoneEditor.tsx (591), useImportDrumKit.ts (534), ImportDrumKitDialog.tsx (527), PatchEditor.tsx (510), libraryStore.ts (489), PlayPage.tsx (484), slot-allocation.ts (481), ImportLibraryToneDialog.tsx (463), VideoCapture.tsx (410) |
| DRY violations found | **3** | loadPatchBank duplication (PlayPage/PatchesPage), loadToneBank pattern, progress bar rendering |
| Missing interfaces | **1** | deviceDataStore.ts uses `any` instead of typed interfaces |
| `any` usages | **2** | deviceDataStore.ts lines 16, 18 (eslint-disabled) |
| Relative imports | **60+** | Across 30+ files |
| Device conditionals in UI | **0** | Clean |
| Untestable functions | **3** | library-service.ts, SampleChopperDialog, midiStore.ts |
| Mock data in production | **5 files** | App.tsx, PlayPage.tsx, midiStore.ts, mockState.ts, mockMode.ts |
| S330-specific imports in shared code | **17 files** | See B3 |
| Console statements | **100+** | Across pages, hooks, components, core |
| Commented-out code | **1** | PatchEditor.tsx lines 171-181 |

---

### Recommended Remediation Order

**Phase 1 -- Quick wins (Small effort, high signal)**
1. B2: Replace `any` types in `deviceDataStore.ts` with `SamplerTone`/`SamplerPatch`
2. B5: Remove commented-out code in `PatchEditor.tsx`
3. B3: Replace S330-specific type imports with device-agnostic aliases (17 files, mechanical)

**Phase 2 -- Structural improvements (Medium effort)**
4. U5: Extract shared `useDataLoader` hook to eliminate bank-loading duplication
5. B1: Convert relative imports to `@/` pattern
6. B7: Isolate mock mode behind `import.meta.env.DEV`
7. U6: Move S-330-specific drum kit operations behind `DeviceConfig` interface
8. B4: Introduce structured logging, remove informational `console.log`

**Phase 3 -- Major refactors (Large effort, highest impact)**
9. U2: Split `library-service.ts` (2,583 lines)
10. U1: Decompose `LibraryPage.tsx` (1,745 lines)
11. U3: Extract `SampleChopperDialog.tsx` (1,539 lines) algorithmic logic
12. U4: Break up `LibraryTreePanel.tsx` (1,263 lines)

**Phase 4 -- Remaining oversized files**
13. Reduce LoopEditor.tsx (899), WaveformEditor.tsx (840), ItemPreviewPanel.tsx (803), ToneEditor.tsx (753), TonesPage.tsx (728), EnvelopeEditor.tsx (663), ImportLibraryPatchDialog.tsx (634)

**Note on B6 (fallback patterns)**: Requires a design decision. Browser API graceful degradation (File System Access API vs download fallback) is arguably a legitimate alternative implementation, not a "fallback that hides bugs." Recommend discussing whether this should be reframed as a strategy pattern or whether the download path should be removed.
