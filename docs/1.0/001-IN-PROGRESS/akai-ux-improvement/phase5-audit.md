# Phase 5 Audit: Visual Polish and Cross-Editor Consistency

Audited: `modules/akai-s3k-editor/src/` (all .tsx/.ts files)
Compared against: `modules/roland-sxx0-editor/src/` and `modules/editor-core/src/`

---

## Pixel-Based Width Issues

### Layout-level fixed widths (should be flex/proportional)

| File | Line | Class | Recommendation |
|------|------|-------|----------------|
| `pages/LibraryPage.tsx` | 701 | `w-80` (320px fixed toast) | Use a max-width constraint with flex instead, e.g. `max-w-sm w-full` or position with a responsive container |
| `pages/LibraryPage.tsx` | 499 | `style={{ height: 'calc(100vh - 8rem)' }}` | Replace magic `8rem` with CSS custom properties from editor-core: `var(--ac-site-header-height)` + `var(--ac-page-header-height)` |

### Input-level fixed widths (acceptable but inconsistent)

These are fine for form inputs but should be standardized:

| File | Line | Class | Notes |
|------|------|-------|-------|
| `components/programs/ProgramEditor.tsx` | 46 | `w-20` | NumberInput -- OK |
| `components/programs/ProgramEditor.tsx` | 86 | `w-10` | Toggle -- OK |
| `components/programs/ProgramEditor.tsx` | 154 | `w-40` | Name input -- OK |
| `components/keygroups/KeyRangeEditor.tsx` | 157, 168 | `w-16` | Note inputs -- OK |
| `components/keygroups/VelocityZoneEditor.tsx` | 93 | `max-w-[200px]` | Sample name select -- replace with `max-w-xs` (Tailwind token) |
| `components/programs/KeygroupSummary.tsx` | 37 | `w-28` | Note range label -- OK for tabular alignment |

**Summary:** Only 2 layout-level issues. Input widths are reasonable but the `max-w-[200px]` arbitrary value should use a Tailwind scale token.

---

## Spacing Inconsistencies

### Page structure patterns

S3K pages are mostly consistent using `ac-page` / `ac-page-sticky-header` / `ac-page-header` / `ac-list-detail-grid`. However:

1. **Missing `ac-page-shell`**: Roland editor wraps every page in `ac-page ac-page-shell`. S3K only uses `ac-page-shell` on `HomePage.tsx` (line 46). The shell class provides consistent gap/spacing between sections. All other S3K pages (`ProgramsPage`, `KeygroupsPage`, `SamplesPage`, `LibraryPage`, `MultiProgramPage`) omit it.

2. **Inconsistent `ac-page-content` usage**: Some S3K "not connected" states use `ac-page-content` (ProgramsPage:151, KeygroupsPage:124) while the connected state uses direct content. Roland uses `ac-page-shell` uniformly which eliminates this inconsistency.

3. **`SamplesPage.tsx` line 35**: Uses `ac-page-content p-4` -- the `p-4` override adds extra padding that other pages don't have. The padding should come from the design system, not ad-hoc additions.

### Section spacing

- `ProgramEditor.tsx` line 142: Uses `space-y-1` for section gaps
- `KeygroupEditor.tsx` line 292: Uses `space-y-1` for section gaps (consistent)
- Section components use `mb-3` for bottom margin (consistent within S3K)
- Roland `ToneEditor.tsx` line 94: Uses `space-y-6` -- significantly more generous spacing

The S3K `space-y-1` (4px) between sections is quite tight compared to Roland's `space-y-6` (24px). This makes the S3K editor feel cramped.

### Error banner pattern

Both `ProgramsPage.tsx` (line 202) and `KeygroupsPage.tsx` (line 183) use identical error banner markup:
```
className="mx-4 mb-3 p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm"
```
This should be an `ac-alert-error` class or a shared component.

---

## Typography Issues

### Page titles -- CONSISTENT
All S3K pages use `text-xl font-bold` for page titles. This matches expectations.

### Editor item titles -- INCONSISTENT
- `ProgramEditor.tsx` line 143: `text-lg font-semibold text-gray-200`
- `KeygroupEditor.tsx` line 293: `text-lg font-semibold text-gray-200`
- `S3kItemPreviewPanel.tsx` lines 102, 221, 286, 329, 365, 404, 502: `text-lg font-semibold text-gray-100`
- `Dialog.tsx` line 86: `text-lg font-bold text-gray-100` (bold vs semibold)
- `SampleTransferPanel.tsx` line 363: `text-lg font-semibold text-gray-100`

Issue: `text-gray-200` vs `text-gray-100` and `font-bold` vs `font-semibold` are used interchangeably for the same semantic element (detail panel title).

### Section headers -- CONSISTENT WITHIN S3K
Section titles use `text-sm font-medium` on a `bg-gray-800` background bar. This is consistent across all S3K editor sections.

### Parameter labels -- CONSISTENT
All use `text-sm text-gray-400` for labels.

### Color token gap vs Roland
Roland uses semantic color tokens (`text-s330-muted`, `text-s330-text`, `bg-s330-panel`, `border-s330-accent`). S3K uses raw Tailwind grays (`text-gray-400`, `bg-gray-800`, `border-gray-600`). This makes cross-editor theming impossible and creates a maintenance burden if the dark theme changes.

---

## Cross-Editor Differences

| Aspect | S3K Editor | Roland Editor | Gap |
|--------|-----------|---------------|-----|
| **Page wrapper** | `ac-page` only | `ac-page ac-page-shell` | S3K missing `ac-page-shell` on 5/6 pages |
| **Color system** | Raw Tailwind (`text-gray-400`, `bg-gray-800`) | Semantic tokens (`text-s330-muted`, `bg-s330-panel`) | S3K has no semantic color layer |
| **Section component** | Inline `Section` function (duplicated 2x) | `card` CSS class from editor-core | S3K doesn't use `card` for sections; uses hand-rolled borders |
| **Parameter controls** | Inline `NumberInput`, `Toggle`, `SelectInput` (duplicated 3x, 2x, 2x) | `ParameterSlider` component with drag, tooltips | S3K has basic inputs; Roland has rich interactive sliders |
| **Section spacing** | `space-y-1` (4px) | `space-y-6` (24px) | S3K sections are cramped |
| **Section style** | `border border-gray-700 rounded-lg` with `bg-gray-800` header bar | `card` class (translucent panel with subtle border) | Different visual language |
| **Button classes** | `ac-btn ac-btn-sm ac-btn-*` (consistent) | Same `ac-btn` system (consistent) | Buttons are consistent -- good |
| **Error states** | Inline red div with raw Tailwind | Not visible in comparable pages | S3K should extract to shared component |
| **Loading states** | Inline text span | Inline text + progress bar | Roland has richer progress UI |
| **Layout component** | Clean `EditorLayout` delegation | `EditorLayout` + video capture drawer | Both use `EditorLayout` from editor-core -- good |
| **List-detail layout** | `ac-list-detail-grid` | `ac-list-detail-grid` | Consistent -- good |
| **Detail panel padding** | `p-4` on detail column div | Via `card` class padding | S3K uses ad-hoc padding |
| **Not-connected state** | Bare text in `ac-page-content` | `card text-center py-12` with styled message + link | Roland has polished empty states |

---

## DRY Violations (Nucleation Sites)

### CRITICAL: Triplicated UI primitives

The following components are copy-pasted identically across 2-3 files:

| Component | Copies | Files |
|-----------|--------|-------|
| `ParameterRow` | 3 | `ProgramEditor.tsx:10`, `KeygroupEditor.tsx:22`, `VelocityZoneEditor.tsx:23` |
| `NumberInput` | 3 | `ProgramEditor.tsx:28`, `KeygroupEditor.tsx:49`, `VelocityZoneEditor.tsx:32` |
| `Section` | 2 | `ProgramEditor.tsx:19`, `KeygroupEditor.tsx:31` |
| `Toggle` | 2 | `ProgramEditor.tsx:75`, `KeygroupEditor.tsx:72` |
| `SelectInput` | 2 | `ProgramEditor.tsx:51`, `VelocityZoneEditor.tsx:55` |

All copies are byte-for-byte identical (same CSS classes, same props, same markup). This is the textbook nucleation site described in CLAUDE.md -- future agents will find one copy and modify it without knowing about the others.

### Duplicated `midiNoteToName` + `NOTE_NAMES`

| Copy | File |
|------|------|
| 1 | `lib/midi-note-parser.ts:68` (inside a function) |
| 2 | `components/keygroups/KeygroupList.tsx:11-17` |
| 3 | `components/keygroups/KeygroupEditor.tsx:14-19` |

Three copies of the same utility. `midi-note-parser.ts` already has this logic -- the components should import from there.

### Duplicated error banner markup

Identical error banner in `ProgramsPage.tsx:202` and `KeygroupsPage.tsx:183`.

---

## Shared Component Extraction Candidates

### Extract immediately (within S3K editor first, then to editor-core)

1. **`ParameterRow`** -- Extract to `@/components/ui/ParameterRow.tsx`. This is purely presentational, identical across all 3 copies. Could eventually move to editor-core if Roland needs similar layout.

2. **`NumberInput`** -- Extract to `@/components/ui/NumberInput.tsx`. Identical copies. Note: Roland uses `ParameterSlider` instead, which is more sophisticated. For cross-editor extraction, consider whether S3K should adopt `ParameterSlider` or if both patterns coexist.

3. **`Section`** -- Extract to `@/components/ui/Section.tsx`. Two identical copies. The S3K section styling (`border border-gray-700 rounded-lg` with header bar) is distinct from Roland's `card` class. Keep as S3K-specific for now.

4. **`Toggle`** -- Extract to `@/components/ui/Toggle.tsx`. Two identical copies. This is a generic toggle switch that could go to editor-core.

5. **`SelectInput`** -- Extract to `@/components/ui/SelectInput.tsx`. Two identical copies.

6. **`midiNoteToName`** -- Already exists in `lib/midi-note-parser.ts`. Delete the copies in `KeygroupList.tsx` and `KeygroupEditor.tsx` and import from the canonical location.

### Defer (different enough to need design work)

7. **Error banner** -- Small duplication (2 copies). Could become an `ac-alert` CSS class in editor-core or a shared `ErrorBanner` component. Low priority since there are only 2 instances.

8. **ProgramList / KeygroupList** -- These are structurally similar (scrollable list of selectable items) but the items have different content. The `ac-scroll-list` pattern from editor-core already covers the container. The item rendering is device-specific enough that a shared "selectable list item" component would add abstraction without clear benefit.

9. **Parameter editor pattern** -- Roland uses `ParameterSlider` (drag-based, with tooltips, commit-on-release). S3K uses `NumberInput` (type-in number fields). These are fundamentally different interaction patterns. Convergence would require design decisions about which UX to standardize on. Defer until a UX design review.

---

## Additional Findings

### `as Type` assertions

Multiple `as Type` casts in non-test code, violating the "never bypass typing" guideline:

| File | Line | Cast | Risk |
|------|------|------|------|
| `lib/drumkit-import.ts` | 141 | `manifest as DrumKitChoppedSample` | Unchecked cast of parsed data |
| `lib/drumkit-import.ts` | 311 | `{...} as KeygroupHeader` | Constructing partial object as full type |
| `lib/program-import.ts` | 211 | `{...} as KeygroupHeader` | Same pattern |
| `lib/program-serialization.ts` | 113, 115, 129, 158, 160, 263, 286, 288 | Multiple `as Record<string, unknown>` and `as` casts | YAML deserialization without type guards |
| `lib/program-writers.ts` | 22 | `fn as WriterFn` | Type widening |
| `stores/midiStore.ts` | 25 | `window as unknown as Record<string, unknown>` | Global store exposure |
| `stores/programStore.ts` | 56 | `window as unknown as Record<string, unknown>` | Same |
| `plugins/s3k-library-plugin.tsx` | 66 | `customState as S3kMemoryPanelState` | Unchecked cast |
| `components/keygroups/VelocityZoneEditor.tsx` | 114, 118 | `header as unknown as Record<string, unknown>` | Dynamic field access |

The serialization and dynamic field access patterns are the highest risk -- they silently succeed even if the data shape is wrong.

### Files over 500 lines

| File | Lines | Recommendation |
|------|-------|----------------|
| `pages/LibraryPage.tsx` | 735 | Extract drop-transfer toast to component; extract dialog rendering to separate component |
| `components/library/DiskBrowserPanel.tsx` | 628 | Extract `DiskFileRow`, `VolumeSection`, and `ContextMenu` logic into sub-components |
| `components/library/S3kItemPreviewPanel.tsx` | 506 | Borderline -- each preview type is a distinct function. Could extract per-type preview components. |

### Files 300-500 lines

| File | Lines |
|------|-------|
| `components/samples/SampleTransferPanel.tsx` | 463 |
| `lib/program-serialization.ts` | 313 |
| `components/keygroups/KeygroupEditor.tsx` | 312 |
| `components/programs/ProgramEditor.tsx` | 301 |

---

## Summary: Prioritized Action Items

### P0 -- DRY violations (nucleation sites)

1. **Extract duplicated UI primitives** to `@/components/ui/`: `ParameterRow`, `NumberInput`, `SelectInput`, `Toggle`, `Section`. Five components, triplicated across 3 files. This is the single highest-impact change. **Effort: S**

2. **Delete duplicated `midiNoteToName` / `NOTE_NAMES`** from `KeygroupList.tsx` and `KeygroupEditor.tsx`. Import from `@/lib/midi-note-parser.ts` instead. **Effort: S**

### P1 -- Cross-editor structural consistency

3. **Add `ac-page-shell`** to all S3K pages (`ProgramsPage`, `KeygroupsPage`, `SamplesPage`, `LibraryPage`, `MultiProgramPage`). This gives them the same spacing scaffold as Roland. **Effort: S**

4. **Increase section spacing** from `space-y-1` to `space-y-4` or similar in `ProgramEditor` and `KeygroupEditor`. The current 4px gaps make the editor feel cramped. **Effort: S**

5. **Normalize detail-title typography**: Pick one of `text-gray-100`/`text-gray-200` and `font-bold`/`font-semibold` for all detail panel titles. **Effort: S**

### P2 -- Visual polish

6. **Replace `style={{ height: 'calc(100vh - 8rem)' }}`** in `LibraryPage.tsx:499` with CSS custom properties from editor-core. **Effort: S**

7. **Extract error banner** to a shared component or CSS class. **Effort: S**

8. **Polish "not connected" states** to match Roland pattern (centered card with styled message and link to Connect page). **Effort: S**

9. **Replace `max-w-[200px]`** in `VelocityZoneEditor.tsx:93` with `max-w-xs`. **Effort: S**

### P3 -- File size / architecture

10. **Split `LibraryPage.tsx`** (735 lines) -- extract drop-transfer toast and dialog section to sub-components. **Effort: M**

11. **Split `DiskBrowserPanel.tsx`** (628 lines) -- extract file row, volume section, and context menu handling. **Effort: M**

### P4 -- Type safety (deferred, requires design decisions)

12. **Address `as Type` casts** in serialization code -- add runtime type guards for YAML deserialization. **Effort: L**

13. **Introduce semantic color tokens** for S3K editor (like Roland's `text-s330-*` system) to enable cross-editor theming. **Effort: L**
