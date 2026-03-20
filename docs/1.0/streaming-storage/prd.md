# Streaming Storage Abstraction

## Problem Statement

Library operations (`loadSample`, `saveSample`, etc.) provide no progress feedback during execution. Users see no indication of progress when loading large samples from high-latency backends like Google Drive, leading to a perception that the UI is frozen.

The root cause is architectural: the `StorageFile` interface only provides `text()` and `arrayBuffer()` methods that return entire file contents at once. This makes it impossible to:

1. Report byte-level progress during file transfers
2. Implement block-level caching (cache chunks rather than entire files)
3. Stream large files without loading them entirely into memory

Each client application currently implements ad-hoc progress tracking, creating code duplication and inconsistent UX across editors.

## User Stories

1. **As a user loading a sample from Google Drive**, I want to see a progress bar showing download progress so I know the operation is working and can estimate completion time.

2. **As a user saving a sample to Google Drive**, I want to see upload progress so I know my work is being saved successfully.

3. **As a developer integrating library operations**, I want progress reporting built into the library layer so I don't have to implement it myself.

4. **As a developer optimizing cache performance**, I want block-level caching so that reading metadata doesn't require downloading entire WAV files.

## Success Criteria

1. `loadSample` and `saveSample` accept an optional progress callback
2. Progress is reported with structured `OperationProgress` data (steps, bytes, labels)
3. Progress UI components (`OperationProgressBar`) display incremental byte progress during transfers
4. Google Drive backend reports real-time progress during file downloads
5. No code duplication required in client applications for progress tracking

## Scope

### In Scope

- Add `stream()` and `size` to `StorageFile` interface
- Implement streaming reads in Google Drive backend
- Add progress-aware read helper for library operations
- Update `loadSample`, `loadSampleMeta`, `saveSample` with progress callbacks
- Wire progress UI into loop-editor dev harness

### Out of Scope

- Block-level caching implementation (future enhancement enabled by this work)
- Streaming writes (upload progress) - addressed in separate work
- Node.js/CLI adapter updates (browser-first)
- Progress for directory operations (list, delete, move)

## Dependencies

- `OperationProgress` type from `@audiocontrol/editor-core`
- `OperationProgressBar` component from `@audiocontrol/editor-core`
- Browser `ReadableStream` API support (standard in modern browsers)
- Google Drive API `alt=media` endpoint returns `Content-Length` header

## Open Questions

1. Should progress callbacks be required or optional? (Recommendation: optional for backward compatibility)
2. Should we add streaming to `StorageWritable` for upload progress? (Recommendation: separate feature)
3. How should progress be reported for operations that don't know total size upfront? (Recommendation: indeterminate mode)
