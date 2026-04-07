# Library UX Improvements - Workplan

**Source PRD:** [prd.md](./prd.md)
**Created:** 2026-03-30

---

## GitHub Tracking

| Item | Link |
|------|------|
| **Milestone** | TBD |
| **Parent Issue** | TBD - `[roland-sxx0-editor] Library page UX improvements` |
| **Labels** | `s330-editor`, `enhancement`, `refactor` |

---

## Overview

This workplan addresses UX rough edges in the roland-sxx0-editor Library page through visual polish, interaction improvements, and code refactoring.

### Current State
- LibraryPage.tsx: 908 lines (exceeds 500-line guideline)
- 11 dialogs managed in single component
- Three-column layout with complex state interactions
- Plugin architecture for S-330/S-550 device differences

### Target State
- LibraryPage.tsx: <500 lines via component extraction
- Clear visual hierarchy and focus management
- Discoverable interactions with affordances
- Consistent feedback for all operations

---

## Phase 1: Visual Polish

**Goal:** Improve visual hierarchy and feedback without changing functionality.

### Task 1.1: Panel focus indicators

Add visual indicators showing which panel is currently focused/active.

**Files:**
- `src/pages/LibraryPage.tsx`
- `src/components/library/DeviceMemoryPanel.tsx`
- `src/components/library/PluginLibraryTreePanel.tsx`
- `src/components/library/ItemPreviewPanel.tsx`

**Acceptance Criteria:**
- [ ] Active panel has distinct border/highlight
- [ ] Focus moves correctly with Tab key
- [ ] Click on panel focuses it

### Task 1.2: Empty state designs

Add meaningful empty states for panels and lists.

**Acceptance Criteria:**
- [ ] Device memory shows helpful message when no banks loaded
- [ ] Library browser shows guidance when library not connected
- [ ] Preview panel shows prompt when nothing selected
- [ ] Empty folders show "No items" with action suggestion

### Task 1.3: Loading states and skeletons

Add skeleton loading states for async operations.

**Acceptance Criteria:**
- [ ] Library tree shows skeleton while loading
- [ ] Preview panel shows skeleton while loading item details
- [ ] Device slots show loading indicator during fetch

### Task 1.4: Operation progress indicators

Improve progress feedback for import/export operations.

**Acceptance Criteria:**
- [ ] All operations show progress bar with percentage
- [ ] Long operations show estimated time or step count
- [ ] Cancel button available where operation is cancellable
- [ ] Success/failure shown clearly on completion

---

## Phase 2: Interaction Improvements

**Goal:** Make interactions more discoverable and efficient.

### Task 2.1: Drag-and-drop affordances

Add visual cues for drag-and-drop support.

**Acceptance Criteria:**
- [ ] Draggable items show grab cursor on hover
- [ ] Drop zones highlight when dragging over
- [ ] Invalid drop targets show "not allowed" indicator
- [ ] Drag preview shows item being moved

### Task 2.2: Context menu organization

Review and improve context menu structure.

**Acceptance Criteria:**
- [ ] Related actions grouped logically
- [ ] Keyboard shortcuts shown next to actions
- [ ] Destructive actions visually distinct
- [ ] Most common actions at top

### Task 2.3: Keyboard navigation

Add comprehensive keyboard support.

**Acceptance Criteria:**
- [ ] Arrow keys navigate within panels
- [ ] Enter activates/opens selected item
- [ ] Escape closes dialogs and deselects
- [ ] Common actions have keyboard shortcuts
- [ ] Shortcuts documented in help/tooltip

### Task 2.4: Breadcrumb navigation

Add breadcrumbs for deep library hierarchies.

**Acceptance Criteria:**
- [ ] Current path shown as clickable breadcrumbs
- [ ] Click breadcrumb segment to navigate up
- [ ] Truncation for very deep paths
- [ ] Home/root always accessible

---

## Phase 3: Code Refactoring

**Goal:** Simplify LibraryPage and improve maintainability.

### Task 3.1: Extract dialog management

Move dialog state and handlers to dedicated hook.

**Files:**
- Create `src/hooks/useLibraryDialogs.ts`
- Modify `src/pages/LibraryPage.tsx`

**Acceptance Criteria:**
- [ ] All dialog state in single hook
- [ ] Dialog open/close handlers centralized
- [ ] LibraryPage reduced by ~150 lines

### Task 3.2: Extract panel coordination

Move panel selection and focus state to dedicated hook.

**Files:**
- Create `src/hooks/useLibraryPanels.ts`
- Modify `src/pages/LibraryPage.tsx`

**Acceptance Criteria:**
- [ ] Panel focus state managed in hook
- [ ] Selection synchronization logic extracted
- [ ] LibraryPage reduced by ~100 lines

### Task 3.3: Consolidate preview panels

Unify preview panel rendering logic.

**Files:**
- `src/components/library/ItemPreviewPanel.tsx`
- `src/components/library/SampleBundlePreviewPanel.tsx`
- `src/components/library/CommonSamplePreviewPanel.tsx`

**Acceptance Criteria:**
- [ ] Single entry point for preview rendering
- [ ] Type-based dispatch to specialized content
- [ ] Shared action button patterns

### Task 3.4: Extract operation handlers

Move complex operation logic out of LibraryPage.

**Files:**
- Enhance `src/hooks/useLibraryExport.ts`
- Enhance `src/hooks/useLibraryImportDialogs.ts`
- Modify `src/pages/LibraryPage.tsx`

**Acceptance Criteria:**
- [ ] Sample editor save logic extracted
- [ ] Loop editor save logic extracted
- [ ] Chopper save logic extracted
- [ ] LibraryPage reduced by ~150 lines

---

## Phase 4: Testing and Documentation

**Goal:** Ensure quality and document changes.

### Task 4.1: Update E2E tests

Verify and update E2E tests for changed interactions.

**Acceptance Criteria:**
- [ ] All existing library E2E tests pass
- [ ] New keyboard navigation tested
- [ ] Focus management tested
- [ ] No regression in test coverage

### Task 4.2: Add component tests

Add unit tests for extracted hooks and components.

**Acceptance Criteria:**
- [ ] useLibraryDialogs hook tested
- [ ] useLibraryPanels hook tested
- [ ] Focus management logic tested

### Task 4.3: Update documentation

Document new keyboard shortcuts and interactions.

**Acceptance Criteria:**
- [ ] Keyboard shortcuts listed in app help
- [ ] README updated with UX changes
- [ ] CHANGELOG entry added

---

## Dependencies

| Task | Depends On |
|------|------------|
| Phase 2 | Phase 1 (visual indicators needed for interaction feedback) |
| Phase 3 | Phase 1-2 (refactoring after behavior is finalized) |
| Phase 4 | Phase 1-3 |

---

## Success Criteria

### Phase 1 Complete When:
- [ ] All panels have clear focus indicators
- [ ] Empty states guide user actions
- [ ] Loading states prevent confusion
- [ ] Operation progress is always visible

### Phase 2 Complete When:
- [ ] Drag-and-drop is visually discoverable
- [ ] Keyboard users can complete all workflows
- [ ] Deep navigation is efficient

### Phase 3 Complete When:
- [ ] LibraryPage.tsx is <500 lines
- [ ] No functional regression
- [ ] Code is more maintainable

### Phase 4 Complete When:
- [ ] All E2E tests pass
- [ ] New functionality tested
- [ ] Changes documented

---

## Estimated Scope

| Phase | Tasks | Effort |
|-------|-------|--------|
| Phase 1 | 4 tasks | 2-3 days |
| Phase 2 | 4 tasks | 3-4 days |
| Phase 3 | 4 tasks | 2-3 days |
| Phase 4 | 3 tasks | 1-2 days |
| **Total** | **15 tasks** | **~2 milestones** |
