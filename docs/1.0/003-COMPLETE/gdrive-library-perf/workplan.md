# Google Drive Library Performance - Workplan

**GitHub Milestone:** TBD
**GitHub Issues:** TBD (to be created after plan approval)

## Technical Approach

Add caching via a backend-agnostic `CachedStorageDirectoryHandle` decorator that wraps any `StorageDirectoryHandle` with read-through/write-through caching. This works for Google Drive, SMB, or any high-latency storage — not tied to a specific backend implementation.

The decorator is transparent: consumers wrap their root handle with `withCache()` and all operations through that handle tree benefit from caching. No changes needed to any storage backend.

Separately, add loading feedback to the UI: skeleton placeholders in `SampleDetailPanel` and loading state tracking in the loop-editor dev harness.

### Existing Code Reused

| Pattern | Source | Reuse |
|---------|--------|-------|
| `StorageDirectoryHandle` / `StorageFileHandle` interfaces | `storage-handles.ts` | Decorator implements these exactly |
| `Map<string, T>` caches with explicit invalidation | `libraryStore.ts` (`loadedTones`, `cacheTone`/`getCachedTone`) | Same pattern for `StorageCache` maps |
| Loading-in-flight tracking via `Set<string>` | `LibraryTreePanel.tsx` (`loadingManifests`) | Same pattern for `isLoadingMeta` state |
| `OperationLoadingSpinner` component | `editor-core/OperationStatus.tsx` | Reused for tree loading feedback |
| `.ac-spinner` CSS animation | `editor-core/primitives.css` | Skeleton shimmer follows same keyframe pattern |
| `LibraryBrowser` `loading` prop | `editor-core/LibraryBrowser.tsx` | Already exists, just needs wiring |

## Implementation Phases

### Phase 1: CachedStorageDirectoryHandle Decorator

Create a backend-agnostic caching layer over `StorageDirectoryHandle`.

**Tasks:**
- Create `StorageCache` — shared cache state with `Map`-based stores for entries, directories, files, content
- Create `CachedStorageDirectoryHandle` implementing `StorageDirectoryHandle`
  - `values()` — read-through on `entries` cache
  - `getDirectoryHandle(name)` — read-through on `directories` cache, returns wrapped `CachedStorageDirectoryHandle`
  - `getFileHandle(name)` — read-through on `files` cache, returns wrapped `CachedStorageFileHandle`
  - `removeEntry(name)` — delegates to inner, invalidates this dir's entries + child caches
  - `{create: true}` options always delegate to inner and invalidate entries cache
- Create `CachedStorageFileHandle` implementing `StorageFileHandle`
  - `getFile()` — read-through on `content` cache
  - `createWritable()` — returns `CachedStorageWritable` that invalidates content + parent entries on `close()`
- Create `withCache(handle)` factory that returns `StorageDirectoryHandle & { clearCache(): void }`
- Cache keys use logical paths (e.g., `library/common/samples/Piano`) not backend IDs
- Path keys must be normalized: lowercase, no trailing slashes, forward slashes only
- `invalidate(path)` removes a directory's cached entries and all children under that path
- `clear()` empties all caches

**Files:**
- New: `modules/sampler-library/src/cached-storage.ts`

**Success criteria:**
- Second `values()` call on same directory returns cached result (inner not called)
- Second `getDirectoryHandle(name)` returns cached handle
- Second `getFileHandle(name).getFile()` returns cached content
- `removeEntry()` invalidates this dir's entries cache
- `createWritable().close()` invalidates file content + parent entries
- `{create: true}` options bypass cache and invalidate entries
- `clearCache()` empties all caches
- Decorator satisfies `StorageDirectoryHandle` interface exactly

### Phase 2: Cache Unit Tests

**Tasks:**
- Test cache hit (second read returns cached, inner not called)
- Test cache miss (first read delegates to inner, stores result)
- Test write-through invalidation (removeEntry, createWritable close)
- Test create-mode bypass (getDirectoryHandle with create: true)
- Test clearCache() empties everything
- Test child handles share parent's cache
- Use mock `StorageDirectoryHandle` via dependency injection (no network calls)

**Files:**
- New: `modules/sampler-library/src/cached-storage.test.ts`

**Success criteria:**
- All cache behaviors verified without network or filesystem
- Tests are fast (no I/O)

### Phase 3: Extract DriveClient

Pure refactor — extract `DriveClient` from `google-drive-storage.ts` into `drive-client.ts`. No behavior change. Keeps file sizes under 500 lines.

**Tasks:**
- Move `DriveClient` class + `DRIVE_API`, `UPLOAD_API`, `FOLDER_MIME` constants
- Export `DriveClient` and `FOLDER_MIME`
- Import in `google-drive-storage.ts`

**Files:**
- New: `modules/sampler-library/src/drive-client.ts`
- Modify: `modules/sampler-library/src/google-drive-storage.ts`

**Success criteria:**
- `google-drive-storage.ts` drops below 500 lines
- All builds and tests pass
- No behavior change

### Phase 4: Wire Cache in LibraryConnection

Connect the cache to the Google Drive connection and expose cache clearing.

**Tasks:**
- Add optional `clearCache?(): void` to `LibraryConnection` interface
- In `GoogleDriveLibraryConnection`, wrap `getRoot()` result with `withCache()`
- Implement `clearCache()` on `GoogleDriveLibraryConnection`
- `BrowserLibraryConnection` does not implement it (optional method, local FS doesn't need caching)
- Export `withCache` from `sampler-library` browser entry for consumers that want manual control

**Files:**
- Modify: `modules/sampler-library/src/library-connection.ts`
- Modify: `modules/sampler-library/src/google-drive-storage.ts`

**Success criteria:**
- Google Drive library operations are cached automatically
- `clearCache()` forces next operations to re-fetch from Drive
- `BrowserLibraryConnection` still satisfies `LibraryConnection` (no breaking change)
- Local FS library behavior unchanged

### Phase 5: Skeleton CSS + SampleDetailPanel Loading State

Add skeleton placeholders to the detail pane.

**Tasks:**
- Add `.ac-skeleton`, `.ac-skeleton-text`, `.ac-skeleton-title` CSS classes to `library.css`
- Add `@keyframes ac-skeleton-shimmer` animation
- Add `loading?: boolean` prop to `SampleDetailPanelProps`
- Render skeleton layout when `loading=true` (title placeholder + 4 metadata row placeholders in existing grid)
- Export updated types from editor-core

**Files:**
- Modify: `modules/editor-core/src/design/library.css`
- Modify: `modules/editor-core/src/components/library/SampleDetailPanel.tsx`

**Success criteria:**
- `<SampleDetailPanel loading={true} sample={null} />` renders shimmer skeleton
- `<SampleDetailPanel loading={false} sample={null} />` renders "Select a sample" (unchanged)
- `<SampleDetailPanel sample={data} />` renders metadata (unchanged)
- Skeleton layout matches dimensions of real metadata grid

### Phase 6: Loading State in Loop-Editor Dev Harness

Wire loading states to the UI.

**Tasks:**
- Add `isLoadingMeta` state, set true/false around `loadSample` in `handleTreeSelect`
- Add `isLoadingTree` state, set true/false around `listCommonSamplesTree` in `refreshLibrary` and initial tree loads
- Pass `loading={isLoadingMeta}` to `SampleDetailPanel`
- Pass `loading={isLoadingTree}` to `LibraryBrowser`
- Call `conn.clearCache?.()` before `listCommonSamplesTree()` in `refreshLibrary` (Refresh button bypasses cache)

**Files:**
- Modify: `modules/loop-editor/dev/main.tsx`

**Success criteria:**
- Clicking a sample shows skeleton shimmer until metadata arrives
- Tree scan shows loading indicator (LibraryBrowser loading state)
- Refresh button clears cache and re-scans from backing store
- Local FS library is unaffected (clearCache is a no-op)

## Verification Checklist

- [ ] `pnpm --filter @audiocontrol/sampler-library build`
- [ ] `pnpm --filter @audiocontrol/sampler-library test` (including new cache tests)
- [ ] `pnpm --filter @audiocontrol/editor-core build`
- [ ] `pnpm --filter @audiocontrol/loop-editor build`
- [ ] `make` (full dependency-ordered build)
- [ ] `pnpm test` (all module tests)
- [ ] Manual: Google Drive — tree loads, sample select shows skeleton then data
- [ ] Manual: Google Drive — re-select sample loads instantly (cached)
- [ ] Manual: Google Drive — Refresh re-scans from network
- [ ] Manual: Google Drive — import/delete/save reflect in tree
- [ ] Manual: Local FS — no regression
