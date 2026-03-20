# Google Drive Library Performance - Product Requirements Document

**Created:** 2026-03-20
**Status:** Planning
**Owner:** Orion Letizi

## Problem Statement

The library browser uses abstract `StorageDirectoryHandle` for all filesystem operations. On local FSAA, each operation completes in microseconds. On Google Drive, each operation maps to one or more HTTP requests (~100-500ms each), making the library sluggish and unresponsive. The same problem will affect any high-latency storage backend (SMB shares, other cloud drives).

### Quantitative Impact

| Operation | Local FS | Google Drive | Factor |
|-----------|----------|-------------|--------|
| Tree scan (`listCommonSamplesTree`) | <100ms | 5-15s (10-50+ HTTP requests) | 50-150x |
| Load sample metadata (tree select) | <10ms | 1-3s (5-7 HTTP requests) | 100-300x |
| Load sample into editor | <50ms | 2-5s (7-9 HTTP requests) | 40-100x |
| Re-select previously viewed sample | <10ms | 1-3s (same requests repeated) | 100-300x |

### Root Causes

1. **No caching at any layer.** Every `getDirectoryHandle`, `getFileHandle`, and `values()` call on any `StorageDirectoryHandle` goes directly to the backing store. Path traversal (`library` > `common` > `samples` > `{path}`) repeats 3-5 identical lookups every time any sample is accessed.

2. **No loading feedback.** `SampleDetailPanel` accepts `sample: SampleMetadata | null` with no loading state. While metadata fetches asynchronously, the panel shows "Select a sample to view details" — indistinguishable from having nothing selected.

3. **No progress indication during tree scanning.** The tree scan can take 5-15 seconds on Google Drive. The UI provides no feedback that work is in progress.

## User Stories

- As a user browsing my Google Drive library, I want to see a loading indicator when I click a sample so I know metadata is being fetched.
- As a user, I want previously browsed samples to load instantly without re-fetching from the backing store.
- As a user, I want the library tree to show a loading state while scanning so I know the app is responsive.
- As a user, I want save/delete/import operations to be reflected in the tree without a full re-scan of unchanged folders.

## Solution

### 1. CachedStorageDirectoryHandle (Backend-Agnostic Cache Decorator)

A `CachedStorageDirectoryHandle` that wraps any `StorageDirectoryHandle` with read-through/write-through caching. This is not Google Drive specific — it works for any `StorageDirectoryHandle` implementation including future SMB or cloud storage backends.

**Architecture:**
- A shared `StorageCache` object holds `Map`-based caches for directory listings, directory handles, file handles, and file content
- Cache keys use logical paths (not backend-specific IDs) so the cache is portable
- All child handles created via `getDirectoryHandle()` share the same `StorageCache` instance
- Read operations check cache first, delegate to inner handle on miss
- Write operations (`removeEntry`, `createWritable().close()`) invalidate affected cache entries
- `clearCache()` empties all caches for forced refresh

**Factory function:**
```typescript
const root = withCache(conn.getRoot());  // Wrap any StorageDirectoryHandle
```

No changes needed to any storage backend implementation. Consumers opt in by wrapping their root handle.

### 2. SampleDetailPanel Skeleton Placeholders

Add a `loading?: boolean` prop to `SampleDetailPanel`. Three visual states:

1. **Empty** (`loading=false, sample=null`) — "Select a sample to view details" (unchanged)
2. **Loading** (`loading=true`) — skeleton shimmer mimicking the metadata grid
3. **Loaded** (`sample={...}`) — real metadata (unchanged)

### 3. Loading State Feedback in Consumers

Track `isLoadingMeta` and `isLoadingTree` states in the loop-editor dev harness. Wire to existing `SampleDetailPanel` loading prop and `LibraryBrowser` loading prop.

## Success Criteria

- [ ] Re-selecting a previously viewed sample loads instantly (cached handles + content)
- [ ] Second tree scan is faster (unchanged folders hit entries cache)
- [ ] Clicking a sample shows skeleton shimmer until metadata arrives
- [ ] Tree scan shows loading indicator
- [ ] Save/delete/import correctly invalidate cache (modified folders re-fetched, others cached)
- [ ] Manual "Refresh" clears all caches and re-scans from backing store
- [ ] Cache decorator works with any `StorageDirectoryHandle` (not Google Drive specific)
- [ ] No regression in local FS library behavior
- [ ] All existing tests pass

## Scope

### In Scope

- `CachedStorageDirectoryHandle` decorator in `sampler-library` (backend-agnostic)
- `StorageCache` with path-based keys and write-through invalidation
- `withCache()` factory function
- `clearCache()` method on `LibraryConnection` (optional)
- Skeleton placeholder CSS and `SampleDetailPanel` loading state
- Loading state wiring in loop-editor dev harness
- Extracting `DriveClient` into its own file (file size housekeeping)
- Unit tests for cache hit/miss/invalidation

### Out of Scope

- LRU eviction or size-limited caching (session-scoped lifetime is sufficient for now)
- Persistent caching across sessions (IndexedDB, localStorage)
- Optimistic UI updates (tree updates before server confirms)
- Background prefetching or cache warming
- Webhook-based invalidation
- Sampler-editor migration (it doesn't use Google Drive yet)

## Dependencies

- `@audiocontrol/sampler-library` — `StorageDirectoryHandle` interfaces, Google Drive implementation
- `@audiocontrol/editor-core` — `SampleDetailPanel`, `LibraryBrowser`, `library.css`
- `@audiocontrol/loop-editor` — dev harness (primary consumer for verification)

## Constraints

- Cache decorator must implement `StorageDirectoryHandle` exactly — callers cannot distinguish cached from uncached handles
- Write-through invalidation must be correct — stale data after mutations is worse than no cache
- Cache keys must be backend-agnostic (logical paths, not Google Drive file IDs)
- Skeleton CSS must use existing editor-core design tokens
- All files must stay under 500 lines

## Open Questions

- ~~Should `contentCache` have a size limit for large WAV files?~~ Not for initial implementation. Session-scoped lifetime is sufficient; users typically work with 10-50 samples per session.
- ~~Should the cache be Google Drive specific or generic?~~ Generic. `CachedStorageDirectoryHandle` wraps any `StorageDirectoryHandle`.
