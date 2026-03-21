# Portable Library Module with Device Plugin Architecture - Workplan

**GitHub Milestone:** TBD
**GitHub Issues:**

- Parent: TBD
- Implementation issues: TBD (will be added after issue creation)

## Technical Approach

Extend editor-core's existing library components with inline renaming and a new TreeSection component, then add plugin interfaces that allow device-specific behavior without conditionals. The plugin architecture follows the existing DeviceConfig pattern from sampler-editor but applies it to the library UI layer.

**Reference implementations:**
- TreeView: `modules/editor-core/src/components/library/TreeView.tsx`
- Inline rename pattern: `modules/sampler-editor/src/components/library/LibraryTreeNode.tsx` (lines 82-124)
- TreeSection: `modules/sampler-editor/src/components/library/LibraryTreePanel.tsx` (section rendering pattern)
- DeviceConfig: `modules/sampler-editor/src/configs/types.ts`
- Common formats: `modules/sampler-library/src/types/`

## Implementation Phases

### Phase 1: Inline Renaming in TreeView

Add inline renaming support to the existing TreeView component.

**File:** `modules/editor-core/src/components/library/TreeView.tsx`

**Tasks:**
- Add `onRename?: (node: TreeNode, newName: string) => Promise<void>` prop
- Add `enableInlineRename?: boolean` prop
- Add local state for edit mode: `isEditing`, `editValue`, `isRenaming`
- Implement double-click handler to enter edit mode
- Implement keyboard handlers: Enter submits, Escape cancels
- Implement blur handler (submit unless already renaming)
- Disable input during async rename operation
- Keep edit mode open on error for retry
- Add unit tests for inline rename behavior

**Success criteria:**
- Double-click on node name enters edit mode
- Enter key submits rename, Escape cancels
- Input disabled during async rename
- Error case keeps edit mode open for retry
- Tests cover all edit mode transitions

### Phase 2: TreeSection Component

Create a section wrapper component that adds headers, drop zones, and empty states to TreeView.

**New file:** `modules/editor-core/src/components/library/TreeSection.tsx`

**Props:**
```typescript
interface TreeSectionProps {
  title: string;
  nodes: TreeNode[];
  category: string;
  expandedIds: Set<string>;
  selectedId?: string;
  onToggleExpand: (nodeId: string) => void;
  onSelect: (node: TreeNode) => void;
  onDelete?: (node: TreeNode) => void;
  onContextMenu?: (e: React.MouseEvent, node: TreeNode) => void;
  onDropOnDirectory?: (targetPath: string[], dragData: unknown) => void;
  onRename?: (node: TreeNode, newName: string) => Promise<void>;
  emptyMessage?: string;
  isDragOver?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnter?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  dropMessage?: string;
  headerActions?: React.ReactNode;
  renderIcon?: (node: TreeNode, isExpanded: boolean) => React.ReactNode;
  renderTrailing?: (node: TreeNode) => React.ReactNode;
  enableInlineRename?: boolean;
}
```

**Tasks:**
- Implement TreeSection component with section header
- Add collapsible behavior (optional)
- Render empty state when no nodes
- Render drop zone indicator during drag
- Wire through all TreeView callbacks
- Add CSS classes following `ac-` prefix convention
- Add unit tests for section rendering and empty state

**Success criteria:**
- Section header renders with title and optional actions
- Empty state displays when nodes array is empty
- Drop zone indicator shows during drag operations
- All TreeView callbacks work through section wrapper

### Phase 3: Plugin Interfaces

Define plugin interfaces for device-specific library behavior.

**New file:** `modules/editor-core/src/components/library/plugins/types.ts`

**Interfaces:**

```typescript
// Item type plugin (e.g., tone, patch, program, keygroup)
interface ItemTypePlugin<TMeta = unknown> {
  typeId: string;
  displayName: string;
  renderIcon(meta: TMeta, isSelected: boolean): React.ReactNode;
  renderTrailing?(meta: TMeta): React.ReactNode;
  isDraggable(meta: TMeta): boolean;
  supportsRename: boolean;
  getContextMenuActions?(meta: TMeta, node: TreeNode): ContextMenuAction[];
}

// Category plugin (e.g., samples, programs, tones)
interface CategoryPlugin {
  categoryId: string;
  title: string;
  itemTypes: Record<string, ItemTypePlugin>;
  emptyMessage: string;
  dropMessage?: string;
  acceptsExternalDrop?: boolean;
  acceptedDropMimeTypes?: string[];
  canAcceptDrop?(dragData: unknown, targetNode?: TreeNode): boolean;
  handleDrop?(dragData: unknown, targetPath: string[]): Promise<void>;
  renderHeaderActions?(callbacks: CategoryCallbacks): React.ReactNode;
  isReadOnly?: boolean;
}

// Translator for device <-> common format conversion
interface ItemTranslator<TDeviceItem, TCommonItem> {
  deviceType: string;
  commonFormat: 'sample' | 'program';
  toCommon(deviceItem: TDeviceItem): Promise<TCommonItem>;
  fromCommon(commonItem: TCommonItem): Promise<TDeviceItem>;
  canImport?(commonItem: TCommonItem): string | null;
}

// Top-level device library plugin
interface DeviceLibraryPlugin {
  deviceId: string;
  deviceName: string;
  categories: CategoryPlugin[];
  translators: ItemTranslator<unknown, SampleYaml | ProgramYaml>[];
  deviceMemory?: DeviceMemoryConfig;
  previewPanel: PreviewPanelConfig;
}
```

**Tasks:**
- Define all plugin interfaces with JSDoc documentation
- Define supporting types (CategoryCallbacks, DeviceMemoryConfig, PreviewPanelConfig)
- Create `index.ts` barrel export
- No tests needed for types (compile-time checked)

**Success criteria:**
- All interfaces have clear JSDoc documentation
- Types compile without errors
- Exported from `@audiocontrol/editor-core`

### Phase 4: PluginLibraryBrowser Component

Create the main plugin-driven library browser component.

**New file:** `modules/editor-core/src/components/library/PluginLibraryBrowser.tsx`

**Props:**
```typescript
interface PluginLibraryBrowserProps {
  plugin: DeviceLibraryPlugin;
  libraryHandle: FileSystemDirectoryHandle | null;
  categoryData: Record<string, TreeNode[]>;
  expandedPaths: Record<string, Set<string>>;
  selection: ItemSelection | null;
  onSelectionChange: (selection: ItemSelection | null) => void;
  onRefresh: () => void;
  onCreateFolder: (categoryId: string, parentPath: string[]) => Promise<void>;
  onDelete: (categoryId: string, node: TreeNode) => Promise<void>;
  onMove: (categoryId: string, node: TreeNode, targetPath: string[]) => Promise<void>;
  onRename: (categoryId: string, node: TreeNode, newName: string) => Promise<void>;
  deviceMemoryState?: unknown;
  onDeviceMemoryAction?: (action: DeviceMemoryAction) => void;
  loading?: boolean;
  error?: string;
  operationProgress?: OperationProgress;
  connectionSlot?: React.ReactNode;
}
```

**Tasks:**
- Implement PluginLibraryBrowser component
- Render three-column layout when deviceMemory present (device | library | preview)
- Render two-column layout otherwise (library | preview)
- Map category data through TreeSection components
- Wire plugin callbacks to section handlers
- Render device memory via plugin's `renderMemoryPanel`
- Render preview via plugin's `renderPreview`
- Add CSS for layout variations
- Add unit tests for layout rendering and callback wiring

**Success criteria:**
- Layout adapts based on deviceMemory presence
- All categories render as TreeSection instances
- Plugin's renderMemoryPanel receives correct props
- Plugin's renderPreview receives current selection
- Operations propagate through category callbacks

### Phase 5: S-330/S-550 Plugin Implementations

Create device-specific plugin implementations for Roland samplers.

**New files:**
- `modules/sampler-editor/src/plugins/s330-library-plugin.ts`
- `modules/sampler-editor/src/plugins/s550-library-plugin.ts`
- `modules/sampler-editor/src/plugins/shared/item-types.ts`
- `modules/sampler-editor/src/plugins/shared/categories.ts`
- `modules/sampler-editor/src/plugins/shared/translators.ts`
- `modules/sampler-editor/src/plugins/index.ts`

**Tasks:**
- Implement ToneItemType with WaveIcon and tone-specific rendering
- Implement PatchItemType with PatchIcon and patch-specific rendering
- Implement DrumKitItemType with DrumKitIcon and drum-kit-specific rendering
- Implement SampleItemType for common-area samples
- Create category factories: createSetsCategory, createTonesCategory, createPatchesCategory, createDrumKitsCategory, createSamplesCategory
- Implement ItemTranslator for Tone <-> Sample
- Implement ItemTranslator for Patch <-> Program
- Create S330MemoryPanel component (move from existing code)
- Create S330PreviewPanel component (move from existing code)
- Assemble s330LibraryPlugin with all categories, translators, memory config
- Create s550LibraryPlugin extending S-330 with S-550-specific differences
- Add unit tests for translator implementations

**Success criteria:**
- S-330 plugin defines all categories with appropriate item types
- S-550 plugin extends S-330 with S-550-specific memory layout
- Translators correctly convert Tone <-> Sample and Patch <-> Program
- Icons render correctly for each item type
- Memory panel and preview panel render correctly

### Phase 6: sampler-editor Migration

Migrate LibraryPage to use PluginLibraryBrowser.

**Modified file:** `modules/sampler-editor/src/pages/LibraryPage.tsx`

**Tasks:**
- Import PluginLibraryBrowser and device plugins
- Select plugin based on device configuration
- Map existing state to PluginLibraryBrowser props
- Remove direct LibraryTreePanel usage
- Update category data mapping
- Verify all existing functionality works
- Remove dead code after migration

**Success criteria:**
- LibraryPage uses PluginLibraryBrowser with selected plugin
- All existing library operations work (create folder, delete, move, rename)
- Device memory panel works (tone/patch selection, drag-drop)
- Preview panel updates on selection change
- No functional regression

## Files to Create

### editor-core (new files)

| File | Description |
|------|-------------|
| `src/components/library/TreeSection.tsx` | Section wrapper with header/drop zone |
| `src/components/library/TreeSection.test.tsx` | Tests |
| `src/components/library/plugins/types.ts` | Plugin interfaces + ItemTranslator |
| `src/components/library/plugins/index.ts` | Re-exports |
| `src/components/library/PluginLibraryBrowser.tsx` | Main plugin-driven component |
| `src/components/library/PluginLibraryBrowser.test.tsx` | Tests |

### editor-core (modified files)

| File | Changes |
|------|---------|
| `src/components/library/TreeView.tsx` | Add inline renaming support |
| `src/components/library/TreeView.test.tsx` | Add inline rename tests |
| `src/components/library/index.ts` | Export new components and types |

### sampler-editor (new files)

| File | Description |
|------|-------------|
| `src/plugins/s330-library-plugin.ts` | S-330 plugin implementation |
| `src/plugins/s550-library-plugin.ts` | S-550 plugin implementation |
| `src/plugins/shared/item-types.ts` | Shared item type factories |
| `src/plugins/shared/categories.ts` | Shared category factories |
| `src/plugins/shared/translators.ts` | Tone/Patch translators |
| `src/plugins/index.ts` | Re-exports |

### sampler-editor (modified files)

| File | Changes |
|------|---------|
| `src/pages/LibraryPage.tsx` | Use PluginLibraryBrowser |

## Issue Decomposition

Child issues to create under parent feature issue:

1. Add inline rename support to TreeView
2. Add TreeSection component
3. Define plugin interfaces (ItemTypePlugin, CategoryPlugin, ItemTranslator, DeviceLibraryPlugin)
4. Add PluginLibraryBrowser component
5. Implement S-330 library plugin
6. Implement S-550 library plugin
7. Migrate sampler-editor LibraryPage to PluginLibraryBrowser

## Verification Checklist

- [ ] `pnpm --filter @audiocontrol/editor-core build`
- [ ] `pnpm --filter @audiocontrol/editor-core test`
- [ ] `pnpm --filter @audiocontrol/sampler-editor build`
- [ ] `pnpm --filter @audiocontrol/sampler-editor test`
- [ ] `make clean && make` (full rebuild)
- [ ] loop-editor dev harness still works with basic LibraryBrowser
- [ ] sample-chopper dev harness still works with basic LibraryBrowser
- [ ] sampler-editor library shows all sections (sets, tones, patches, drum kits, samples)
- [ ] Inline rename works (double-click, Enter, Escape)
- [ ] Drag-drop between device and library works
- [ ] Context menus work
- [ ] Preview panel updates on selection
