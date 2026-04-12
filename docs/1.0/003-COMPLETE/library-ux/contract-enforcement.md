# Contract Enforcement Refactor

## Context

Context menu actions were added to shared item types in editor-core (`item-types.tsx`) during this session. Roland uses these same item types but has no handlers for the new actions. Result: Roland shows "Send to Device", "Promote to Common Area", etc. in context menus that silently do nothing when clicked. The user's directive: code must break at the compiler when contracts change; silent failures are bugs.

## Problems to Fix

1. **Phantom menu items**: `commonSampleItemType` and `commonProgramItemType` hardcode transfer actions. Every editor shows them. Only S3K handles them.
2. **All-optional strategy**: `LibraryOperationsStrategy.handleContextMenuAction?` — optional means the compiler doesn't care if it's missing.
3. **All-optional transfer callbacks**: `LibraryTransferCallbacks` — every field optional, `{}` is valid.
4. **Duplicated types**: `SendDialogState`/`ReceiveDialogState` defined in both `LibraryPage.tsx` and `useS3kTransferCallbacks.ts`. `ItemSelection` defined differently in editor-core vs Roland.
5. **Silent action drops**: `useLibraryOperations.onContextMenuAction` silently returns when no handler matches. `move` action listed in menu but never handled.

## Approach: Capability Declaration

Each editor declares which transfer actions it supports. The context menu only shows declared actions. The compiler enforces that declared actions have handlers.

### Step 1: Define TransferActionId and TransferHandlerMap in editor-core

**File**: `modules/editor-core/src/hooks/useLibraryOperations.ts`

```typescript
export type TransferActionId =
  | 'send-sample-to-device'
  | 'send-program-to-device'
  | 'import-drum-kit'
  | 'edit-drum-kit'
  | 'import-instrument'
  | 'promote-to-common-area';

export interface TransferHandlerMap {
  'send-sample-to-device': (name: string, path?: string[]) => void;
  'send-program-to-device': (dirName: string, name: string) => void;
  'import-drum-kit': (name: string, path?: string[]) => void;
  'edit-drum-kit': (name: string, path?: string[]) => void;
  'import-instrument': (dirName: string, path: string[]) => void;
  'promote-to-common-area': (dirName: string) => void;
}
```

No editors break. Additive change.

### Step 2: Convert shared item types from consts to factories

**File**: `modules/editor-core/src/plugins/common-area/item-types.tsx`

Replace `commonSampleItemType` and `commonProgramItemType` consts with factory functions that accept `supportedActions: Set<TransferActionId>`. Context menu only includes actions present in the set.

```typescript
export function createCommonSampleItemType(
  supportedActions: Set<TransferActionId>,
): ItemTypePlugin<CommonSampleMeta> { ... }
```

**Breaks both editors at compile time** — they import the consts. This is the desired forcing function.

**Files that break**:
- `modules/editor-core/src/plugins/common-area/categories.tsx`
- `modules/akai-s3k-editor/src/plugins/categories.tsx`
- `modules/akai-s3k-editor/src/plugins/item-types.tsx`
- `modules/roland-sxx0-editor/src/plugins/shared/item-types.tsx`

### Step 3: Update category factories to accept supported actions

**File**: `modules/editor-core/src/plugins/common-area/categories.tsx`

`createCommonSamplesCategory` and `createCommonProgramsCategory` gain a `supportedActions` parameter, passed through to the item type factories.

### Step 4: Fix S3K — pass supported actions

S3K declares the full set of actions it supports in its category definitions.

### Step 5: Fix Roland — pass empty set (explicit opt-out)

Roland passes `new Set()` — explicitly declaring it supports no transfer actions. Menu items disappear. Compiler is satisfied.

### Step 6: Make handleContextMenuAction required on strategy

**File**: `modules/editor-core/src/hooks/useLibraryOperations.ts`

Remove `?` from `handleContextMenuAction` on `LibraryOperationsStrategy`.

**Breaks Roland** — `useRolandLibraryStrategy` doesn't implement it.

### Step 7: Fix Roland — add handleContextMenuAction to strategy

Roland adds a handler that delegates to `createTransferActionHandler` with empty capabilities. Since no transfer actions appear in menus (Step 5), the handler only needs to cover non-transfer actions. Unhandled actions throw.

### Step 8: Add exhaustive action guard

**File**: `modules/editor-core/src/hooks/useLibraryOperations.ts`

At the end of `onContextMenuAction`, after all routes: throw an error for unhandled actions. Explicit `move` case with comment explaining it's component-level.

### Step 9: Consolidate duplicated types

- Move `SendDialogState`/`ReceiveDialogState` to single source in `useS3kTransferCallbacks.ts`, delete duplicates from `LibraryPage.tsx`
- Rename Roland's local `ItemSelection` to `RolandPageSelection` to eliminate name collision with editor-core's `ItemSelection`

### Step 10: Replace LibraryTransferCallbacks with typed declaration

Replace the all-optional `LibraryTransferCallbacks` with:
```typescript
export function createTransferActionHandler<T extends TransferActionId>(
  handlers: Required<Pick<TransferHandlerMap, T>>,
  deviceProgramCategories: string[],
): (categoryId: string, actionId: string, node: TreeNode) => boolean
```

The `Required<Pick<...>>` means: for every action you declared support for, you MUST provide a handler. Compiler-enforced.

## Implementation Order

| Step | Breaks Roland? | Breaks S3K? | Safe checkpoint? |
|------|---------------|-------------|-----------------|
| 1 | No | No | Yes |
| 2 | **YES** | **YES** | No — fix in 3-5 |
| 3 | Still broken | Still broken | No |
| 4 | Still broken | Fixed | No |
| 5 | Fixed | Fixed | **Yes — `make` passes** |
| 6 | **YES** | No | No — fix in 7 |
| 7 | Fixed | Fixed | **Yes — `make` passes** |
| 8 | No | No | **Yes** |
| 9 | No | No | **Yes** |
| 10 | No | No | **Yes** |

## Verification

After each safe checkpoint:
- `make` — all editors build (compiler enforcement is the primary gate)
- `pnpm test` — all unit tests pass

### Automated tests to write

**editor-core unit tests** (`modules/editor-core/src/plugins/common-area/item-types.test.tsx`):
- `createCommonSampleItemType` with empty supported set returns no transfer actions in context menu
- `createCommonSampleItemType` with `send-sample-to-device` declared returns that action in menu
- `createCommonSampleItemType` with `import-drum-kit` declared only shows it when `meta.hasDrumKit` is true
- `createCommonProgramItemType` with `import-instrument` declared shows it for common programs
- `createCommonProgramItemType` with empty set shows only rename/move/delete

**editor-core unit tests** (`modules/editor-core/src/hooks/useLibraryOperations.test.ts`):
- `createTransferActionHandler` throws (or returns false) for undeclared action IDs
- `createTransferActionHandler` calls the correct handler for each declared action ID
- `onContextMenuAction` throws for completely unknown action IDs (exhaustive guard)
- `onContextMenuAction` routes `move` without error (explicit component-level case)

**S3K unit tests** (`modules/akai-s3k-editor/src/plugins/categories.test.ts`):
- S3K sample category context menu includes all six transfer actions
- S3K program category context menu includes `send-program-to-device` and `promote-to-common-area`

**Roland unit tests** (`modules/roland-sxx0-editor/src/plugins/categories.test.ts`):
- Roland sample category context menu contains NO transfer actions
- Roland program category context menu contains NO transfer actions
- Roland strategy's `handleContextMenuAction` is defined (not undefined)

## Critical Files

- `modules/editor-core/src/hooks/useLibraryOperations.ts` — strategy interface, transfer types, action routing
- `modules/editor-core/src/plugins/common-area/item-types.tsx` — shared item types → factories
- `modules/editor-core/src/plugins/common-area/categories.tsx` — category factories
- `modules/akai-s3k-editor/src/plugins/categories.tsx` — S3K category construction
- `modules/akai-s3k-editor/src/hooks/useS3kLibraryStrategy.ts` — S3K strategy
- `modules/roland-sxx0-editor/src/hooks/useRolandLibraryStrategy.ts` — Roland strategy (must add handler)
- `modules/roland-sxx0-editor/src/plugins/shared/item-types.tsx` — Roland item type imports
- `modules/akai-s3k-editor/src/hooks/useS3kTransferCallbacks.ts` — deduplicate dialog types
- `modules/roland-sxx0-editor/src/pages/LibraryPage.tsx` — rename ItemSelection
