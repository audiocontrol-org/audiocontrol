# Streaming Storage Workplan

## GitHub Tracking

- **Milestone:** TBD
- **Parent Issue:** TBD
- **Branch:** `feature/s550-support` (current work)

## Implementation Phases

### Phase 1: Extend StorageFile Interface

**Goal:** Add streaming capability to the storage abstraction.

**Tasks:**
1. Add `stream(): ReadableStream<Uint8Array>` to `StorageFile` interface
2. Add `size: number` property to `StorageFile` interface
3. Verify browser `File` objects satisfy the extended interface (structural typing)

**Files:**
- `modules/sampler-library/src/storage-handles.ts`

**Success Criteria:**
- Interface compiles with new methods
- Existing FSAA code continues to work (File already has stream() and size)

### Phase 2: Implement Google Drive Streaming

**Goal:** Google Drive backend supports streaming reads with progress.

**Tasks:**
1. Add `getFileStream()` method to `GoogleDriveClient` using `fetch().body`
2. Extract `Content-Length` header for size reporting
3. Update `GoogleDriveFile` class to implement `stream()` and `size`
4. Ensure `arrayBuffer()` and `text()` continue to work

**Files:**
- `modules/sampler-library/src/google-drive-storage.ts`

**Success Criteria:**
- `GoogleDriveFile.stream()` returns a readable stream
- `GoogleDriveFile.size` returns file size from API metadata
- Existing tests pass

### Phase 3: Progress-Aware Read Helper

**Goal:** Utility function that reads a StorageFile with progress reporting.

**Tasks:**
1. Create `readFileWithProgress()` helper function
2. Accept `OperationProgress` callback parameter
3. Read stream in chunks and report byte progress
4. Return `ArrayBuffer` for compatibility with existing code

**Files:**
- `modules/sampler-library/src/common-area/streaming.ts` (new)
- `modules/sampler-library/src/browser.ts` (export)

**Success Criteria:**
- Helper compiles and exports correctly
- Progress callback receives incremental updates during read
- Final ArrayBuffer matches direct arrayBuffer() call

### Phase 4: Update Library Operations

**Goal:** `loadSample` and `saveSample` report progress via callbacks.

**Tasks:**
1. Add optional `onProgress` parameter to `loadSample`
2. Add optional `onProgress` parameter to `loadSampleMeta`
3. Add optional `onProgress` parameter to `saveSample`
4. Use `readFileWithProgress()` internally for reads
5. Calculate total bytes across steps for accurate overall progress

**Files:**
- `modules/sampler-library/src/common-area/samples.ts`

**Success Criteria:**
- Operations report step-by-step progress
- Byte counts are accurate
- Backward compatible (no callback = no change in behavior)

### Phase 5: Update Cache Layer

**Goal:** Cached storage works with streaming interface.

**Tasks:**
1. Update `CachedStorageFile` to implement `stream()` and `size`
2. For cached content, return stream from cached ArrayBuffer
3. For cache miss, delegate to inner file's stream

**Files:**
- `modules/sampler-library/src/cached-storage.ts`

**Success Criteria:**
- Cached reads return valid streams
- Size is available from cache metadata
- Cache hit/miss metrics still accurate

### Phase 6: Wire Progress UI

**Goal:** Loop editor dev harness shows progress during load/save.

**Tasks:**
1. Add load progress state to dev harness
2. Pass progress callback to `loadSample`
3. Display `OperationProgressBar` during load
4. Add save progress state and wire similarly

**Files:**
- `modules/loop-editor/dev/main.tsx`

**Success Criteria:**
- Progress bar appears during sample load
- Bar shows incremental byte progress
- Bar disappears on completion
- Same behavior for save operations

## Dependencies

- Phase 2 depends on Phase 1
- Phase 3 depends on Phase 1
- Phase 4 depends on Phase 3
- Phase 5 depends on Phase 1
- Phase 6 depends on Phase 4

## Testing Strategy

1. Unit tests for `readFileWithProgress()` helper
2. Integration test for Google Drive streaming
3. Manual testing in dev harness with large samples
4. Verify cache metrics still work correctly
