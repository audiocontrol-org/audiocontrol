# Library Tree Test ID Analysis

## Summary

The e2e test file `device-library-import.spec.ts` expects specific `data-testid` attributes to locate and interact with library items. Currently, **most of these test IDs are missing** from the library tree component implementation.

## Test File Analysis

**File:** `modules/roland-sxx0-editor/e2e/device-library-import.spec.ts`

### Expected Test IDs by Test Case

#### Test 1: "can import tone from library to device" (lines 332-372)
- `library-tones-list` - Container for all tones in the library
- `library-tone-{name}` - Individual tone item (e.g., `library-tone-e2e-test-tone`)
- `import-to-device-button` - Import button
- `target-slot-select` - Target slot dropdown
- `confirm-import-button` - Confirm import button
- `import-success` - Success indicator after import
- `device-tones-nav-link` - Navigation link to device tones page

#### Test 2: "import shows progress indicator" (lines 374-391)
- `library-tones-list` - Container for all tones
- `library-tone-e2e-test-tone` - Individual tone item
- `import-to-device-button` - Import button
- `import-progress` - Progress indicator

#### Test 3: "import handles slot already in use" (lines 393-421)
- `library-tones-list` - Container for all tones
- `library-tone-e2e-test-tone` - Individual tone item
- `import-to-device-button` - Import button
- `target-slot-select` - Target slot dropdown
- `overwrite-confirm-dialog` or `slot-occupied-warning` - Warning dialog/message

#### Test 4: "can import patch from library to device" (lines 460-504)
- `library-patches-tab` - Patches tab to switch category
- `library-patches-list` - Container for all patches
- `library-patch-{name}` - Individual patch item (e.g., `library-patch-e2e-test-patch`)
- `import-to-device-button` - Import button
- `target-slot-select` - Target slot dropdown
- `confirm-import-button` - Confirm import button
- `import-success` - Success indicator
- `device-patches-nav-link` - Navigation link to device patches page

#### Test 5: "import patch with missing tone references" (lines 506-544)
- `library-patches-tab` - Patches tab
- `library-patches-list` - Container for patches
- `library-patch-e2e-test-patch` - Individual patch item
- `import-to-device-button` - Import button
- `missing-tone-warning` or `import-error` - Error/warning message

## Source Code Analysis

### File: `LibraryTreePanel.tsx`
**Location:** `modules/roland-sxx0-editor/src/components/library/LibraryTreePanel.tsx`

**Current State:** No `data-testid` attributes found

**Issues:**
1. Lines 327-361: Individual Tones Section (TreeSection or flat list)
   - Missing: `data-testid="library-tones-list"` on container
   - Missing: `data-testid="library-tone-{name}"` on individual tone items
   
2. Lines 430-465: Individual Patches Section (TreeSection or flat list)
   - Missing: `data-testid="library-patches-list"` on container
   - Missing: `data-testid="library-patch-{name}"` on individual patch items

3. TreeSection (lines 329, 432):
   - Component receives `title` prop but doesn't render it with data-testid
   - No way to identify "Tones" vs "Patches" sections

### File: `LibraryTreeNode.tsx`
**Location:** `modules/roland-sxx0-editor/src/components/library/LibraryTreeNode.tsx`

**Current State:** No `data-testid` attributes found

**Issues:**
1. TreeSection component (lines 393-469):
   - Missing data-testid on section container
   - Missing data-testid on individual nodes
   
2. LibraryTreeNodeComponent (lines 43-362):
   - Lines 244-326: Main node div
   - Missing: `data-testid` for identifying tone/patch items
   - Should use pattern: `library-{type}-{fileName}` where type is "tone" or "patch"

### File: `LibraryBrowser.tsx`
**Location:** `modules/roland-sxx0-editor/src/components/library/LibraryBrowser.tsx`

**Current State:** No `data-testid` attributes found

**Issues:**
1. Tab triggers (lines 230, 241, 252):
   - Using Radix Tabs.Trigger component
   - Missing: `data-testid="library-tones-tab"` on tones tab
   - Missing: `data-testid="library-patches-tab"` on patches tab
   - Missing: `data-testid="library-templates-tab"` (if needed)

2. ItemList component (lines 26-66):
   - Lines 48-64: Button elements for individual items
   - Missing: `data-testid` for identifying items
   - Should use pattern based on context

### File: `ImportLibraryToneDialog.tsx`
**Location:** `modules/roland-sxx0-editor/src/components/library/ImportLibraryToneDialog.tsx`

**Current State:** Partial - Some test IDs already present
- Line 247: `data-testid="import-success"` ✓
- Line 346: `data-testid="target-slot-select"` ✓
- Line 370: `data-testid="slot-occupied-warning"` ✓
- Line 429: `data-testid="import-progress"` ✓
- Line 451: `data-testid="confirm-import-button"` ✓

**Issues:**
1. Missing: `data-testid="import-to-device-button"` - not in this file (likely in parent/selector)

## Complete Test ID Requirements Matrix

| Test ID | Location | Type | Status | Required For |
|---------|----------|------|--------|--------------|
| `library-tones-tab` | LibraryBrowser.tsx | Tab trigger | MISSING | Switching to tones category |
| `library-patches-tab` | LibraryBrowser.tsx | Tab trigger | MISSING | Switching to patches category |
| `library-templates-tab` | LibraryBrowser.tsx | Tab trigger | OPTIONAL | Switching to templates (if needed) |
| `library-tones-list` | LibraryTreePanel.tsx or TreeSection | Container | MISSING | Waiting for tones list visibility |
| `library-tone-{name}` | LibraryTreeNode.tsx | Individual item | MISSING | Selecting individual tones (e.g., `library-tone-e2e-test-tone`) |
| `library-patches-list` | LibraryTreePanel.tsx or TreeSection | Container | MISSING | Waiting for patches list visibility |
| `library-patch-{name}` | LibraryTreeNode.tsx | Individual item | MISSING | Selecting individual patches (e.g., `library-patch-e2e-test-patch`) |
| `import-to-device-button` | ImportToneDialog.tsx or parent | Button | MISSING | Initiating import workflow |
| `target-slot-select` | ImportLibraryToneDialog.tsx | Dropdown | EXISTS | Selecting target slot |
| `confirm-import-button` | ImportLibraryToneDialog.tsx | Button | EXISTS | Confirming import |
| `import-progress` | ImportLibraryToneDialog.tsx | Progress bar | EXISTS | Monitoring import progress |
| `import-success` | ImportLibraryToneDialog.tsx | Success screen | EXISTS | Verifying import completion |
| `slot-occupied-warning` | ImportLibraryToneDialog.tsx | Warning | EXISTS | Detecting overwrite warning |
| `device-tones-nav-link` | Layout.tsx or nav component | Link | MISSING | Navigating to device tones |
| `device-patches-nav-link` | Layout.tsx or nav component | Link | MISSING | Navigating to device patches |
| `missing-tone-warning` or `import-error` | ImportLibraryPatchDialog.tsx | Error banner | MISSING | Detecting import errors |

## Proposed Code Changes

### 1. LibraryTreePanel.tsx - Add test IDs to tones/patches sections

**Issue:** Flat list views (lines 362-427 for tones, 466-534 for patches) have no testid

**Fix:** Add `data-testid="library-tones-list"` to the tones div container:
```tsx
<div
  className={cn(
    'p-2 border-t border-s330-accent/30 transition-colors',
    isToneDragOver && 'bg-s330-highlight/10 border-s330-highlight'
  )}
  onDragOver={handleToneDragOver}
  onDragEnter={handleToneDragEnter}
  onDragLeave={handleToneDragLeave}
  onDrop={handleToneDrop}
  data-testid="library-tones-list"    // ADD THIS
>
```

**Fix:** Add `data-testid="library-patches-list"` to the patches div container:
```tsx
<div
  className={cn(
    'p-2 border-t border-s330-accent/30 transition-colors',
    isPatchDragOver && 'bg-s330-highlight/10 border-s330-highlight'
  )}
  onDragOver={handlePatchDragOver}
  onDragEnter={handlePatchDragEnter}
  onDragLeave={handlePatchDragLeave}
  onDrop={handlePatchDrop}
  data-testid="library-patches-list"    // ADD THIS
>
```

### 2. LibraryTreeNode.tsx - Add test IDs to tree nodes

**Issue:** Individual tone/patch items in flat list (LibraryTreePanel lines 389-418 for tones, 493-525 for patches) have no testid

**Fix:** Modify tone items in LibraryTreePanel (around line 390):
```tsx
<div
  key={toneInfo.fileName}
  onClick={() => onSelectIndividualTone(toneInfo.fileName)}
  draggable
  onDragStart={(e) => handleIndividualToneDragStart(e, toneInfo)}
  className={cn(
    'group w-full text-left px-2 py-1.5 rounded text-sm transition-colors',
    'flex items-center gap-2 cursor-grab active:cursor-grabbing',
    selectedType === 'individualTone' && selectedName === toneInfo.fileName
      ? 'bg-s330-highlight/20 text-s330-highlight'
      : 'text-s330-text hover:bg-s330-accent/30'
  )}
  role="button"
  tabIndex={0}
  onKeyDown={(e) => e.key === 'Enter' && onSelectIndividualTone(toneInfo.fileName)}
  data-testid={`library-tone-${toneInfo.fileName}`}    // ADD THIS
>
```

**Fix:** Modify patch items in LibraryTreePanel (around line 494):
```tsx
<div
  key={patchInfo.directoryName}
  onClick={() => onSelectIndividualPatch(patchInfo.directoryName)}
  draggable
  onDragStart={(e) => handleIndividualPatchDragStart(e, patchInfo)}
  className={cn(
    'group w-full text-left px-2 py-1.5 rounded text-sm transition-colors',
    'flex items-center gap-2 cursor-grab active:cursor-grabbing',
    selectedType === 'individualPatch' && selectedName === patchInfo.directoryName
      ? 'bg-s330-highlight/20 text-s330-highlight'
      : 'text-s330-text hover:bg-s330-accent/30'
  )}
  role="button"
  tabIndex={0}
  onKeyDown={(e) => e.key === 'Enter' && onSelectIndividualPatch(patchInfo.directoryName)}
  data-testid={`library-patch-${patchInfo.directoryName}`}    // ADD THIS
>
```

**Fix:** Modify tree nodes in LibraryTreeNode.tsx LibraryTreeNodeComponent (around line 246):
```tsx
<div
  className={cn(
    'group w-full text-left py-1.5 rounded text-sm transition-colors',
    'flex items-center gap-2',
    isDraggable && !isEditing && 'cursor-grab active:cursor-grabbing',
    isSelected
      ? 'bg-s330-highlight/20 text-s330-highlight'
      : isDragOver
      ? 'bg-s330-highlight/30 ring-2 ring-s330-highlight ring-inset'
      : 'text-s330-text hover:bg-s330-accent/30'
  )}
  style={{ paddingLeft }}
  onClick={handleClick}
  onDoubleClick={handleDoubleClick}
  onContextMenu={handleContextMenuClick}
  onKeyDown={handleKeyDown}
  draggable={isDraggable && !isEditing}
  onDragStart={handleDragStart}
  onDragOver={handleDragOver}
  onDragEnter={handleDragEnter}
  onDragLeave={handleDragLeave}
  onDrop={handleDrop}
  role="treeitem"
  tabIndex={isEditing ? -1 : 0}
  aria-expanded={isDirectory ? isExpanded : undefined}
  data-testid={node.type !== 'directory' ? `library-${node.type}-${node.fileName || node.directoryName}` : undefined}  // ADD THIS
>
```

### 3. LibraryBrowser.tsx - Add test IDs to tabs

**Issue:** Tab triggers (lines 230, 241, 252) have no data-testid

**Fix:** Tones tab (around line 230):
```tsx
<Tabs.Trigger
  value="tones"
  data-testid="library-tones-tab"    // ADD THIS
  className={cn(
    'flex-1 px-3 py-2 text-sm transition-colors',
    selectedCategory === 'tones'
      ? 'text-s330-highlight border-b-2 border-s330-highlight'
      : 'text-s330-muted hover:text-s330-text'
  )}
>
  Tones ({tones.size})
</Tabs.Trigger>
```

**Fix:** Patches tab (around line 241):
```tsx
<Tabs.Trigger
  value="patches"
  data-testid="library-patches-tab"    // ADD THIS
  className={cn(
    'flex-1 px-3 py-2 text-sm transition-colors',
    selectedCategory === 'patches'
      ? 'text-s330-highlight border-b-2 border-s330-highlight'
      : 'text-s330-muted hover:text-s330-text'
  )}
>
  Patches ({patches.size})
</Tabs.Trigger>
```

**Fix:** Templates tab (around line 252):
```tsx
<Tabs.Trigger
  value="templates"
  data-testid="library-templates-tab"    // ADD THIS (optional)
  className={cn(
    'flex-1 px-3 py-2 text-sm transition-colors',
    selectedCategory === 'templates'
      ? 'text-s330-highlight border-b-2 border-s330-highlight'
      : 'text-s330-muted hover:text-s330-text'
  )}
>
  Templates ({templates.size})
</Tabs.Trigger>
```

### 4. LibraryTreeNode.tsx TreeSection - Add container testid

**Issue:** TreeSection component (lines 414-469) doesn't have a way to identify which section it is

**Fix:** Add `data-testid` to TreeSection wrapper based on `category` prop:
```tsx
export function TreeSection({
  title,
  nodes,
  category,
  expandedPaths,
  selectedId,
  onToggleExpand,
  onSelect,
  onDelete,
  onContextMenu,
  onDropOnDirectory,
  onRename,
  emptyMessage = 'No items',
  isDragOver,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  dropMessage,
  headerActions,
}: TreeSectionProps): JSX.Element {
  const getTestId = () => {
    if (category === 'tones') return 'library-tones-list';
    if (category === 'patches') return 'library-patches-list';
    if (category === 'drumKits') return 'library-drum-kits-list';
    if (category === 'choppedSamples') return 'library-chopped-samples-list';
    if (category === 'commonSamples') return 'library-common-samples-list';
    return undefined;
  };

  return (
    <div
      className={cn(
        'p-2 border-t border-s330-accent/30 transition-colors',
        isDragOver && 'bg-s330-highlight/10 border-s330-highlight'
      )}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      data-testid={getTestId()}    // ADD THIS
    >
```

### 5. Navigation Links - Add test IDs to device section nav links

**Note:** These IDs are expected by tests but location unknown without reading full Layout component. Likely in:
- `modules/roland-sxx0-editor/src/components/layout/Layout.tsx`
- Or in a navigation component used by the layout

**Pattern needed:**
- Add `data-testid="device-tones-nav-link"` to the link that navigates to `/tones`
- Add `data-testid="device-patches-nav-link"` to the link that navigates to `/patches`

### 6. Import Dialog Button - Add test ID

**Issue:** Tests expect `import-to-device-button` but this wasn't found in the analyzed files

**Status:** This button likely exists in a parent component (ItemPreviewPanel or ImportLibraryToneDialog/ImportLibraryPatchDialog) but needs verification.

## Summary of Missing Test IDs

### High Priority (Blocking Tests)
1. `library-tones-list` - LibraryTreePanel.tsx, line ~365
2. `library-tone-{name}` - LibraryTreePanel.tsx, line ~390
3. `library-patches-list` - LibraryTreePanel.tsx, line ~468
4. `library-patch-{name}` - LibraryTreePanel.tsx, line ~494
5. `library-tones-tab` - LibraryBrowser.tsx, line ~230
6. `library-patches-tab` - LibraryBrowser.tsx, line ~241
7. `device-tones-nav-link` - Layout.tsx (location TBD)
8. `device-patches-nav-link` - Layout.tsx (location TBD)
9. `import-to-device-button` - Location TBD

### Medium Priority (Already Exist)
- `target-slot-select` ✓
- `confirm-import-button` ✓
- `import-progress` ✓
- `import-success` ✓
- `slot-occupied-warning` ✓

### Optional / Error Cases
- `missing-tone-warning` or `import-error` - ImportLibraryPatchDialog (for error handling)
- `overwrite-confirm-dialog` - For explicit overwrite confirmation

## Test Error Context

From the test failure screenshot:
- The library tree is rendering correctly but tree items (e2e-test-tone, E2E Patch) are visible without test IDs
- Accessible tree items are showing in the accessibility tree as `treeitem "e2e-test-tone"` but without data-testid attributes
- Tests cannot locate these elements and fail

## Recommendation

1. **Add missing test IDs in this priority order:**
   - TreeSection and flat list container test IDs (`library-tones-list`, `library-patches-list`)
   - Individual item test IDs (`library-tone-{name}`, `library-patch-{name}`)
   - Tab test IDs (`library-tones-tab`, `library-patches-tab`)
   - Navigation link test IDs (`device-tones-nav-link`, `device-patches-nav-link`)

2. **Verify:**
   - Location of `import-to-device-button`
   - Location of navigation links in Layout component
   - Whether ItemPreviewPanel renders an import button

3. **Test incrementally:**
   - Add test IDs for tones first
   - Verify tone import test passes
   - Then add test IDs for patches
   - Verify patch import test passes
