# Code Review: sampler-library Module

**Module Path:** `/Users/orion/work/audiocontrol-work/audiocontrol/modules/sampler-library/`
**Review Date:** 2026-03-28
**Reviewer:** Senior Code Review Agent

---

## Overall Assessment

**Grade: B+**

The `sampler-library` module demonstrates solid architectural decisions with clean separation between device-agnostic storage abstractions and device-specific converters. The Zod schema design is well-crafted with proper discriminated unions and validation. The codebase follows TypeScript best practices and makes good use of composition patterns. However, there are concerns around file sizes, some security considerations in path handling, and opportunities for improved modularity.

---

## Strengths

### 1. Excellent Storage Abstraction Design
The `StorageDirectoryHandle` interface (`src/storage-handles.ts`) provides a clean abstraction over the File System Access API that:
- Enables runtime-agnostic code (browser FSAA vs Node.js)
- Supports structural typing so browser FSAA handles work without adapters
- Includes streaming support for progress tracking on high-latency backends

### 2. Well-Designed Zod Schema Architecture
- **Discriminated unions** for variant types (`ChoppedSampleSchema` with 'generic' and 'drum-kit' variants)
- **Schema composition** using shared base fields (`ChoppedSampleBaseFields`)
- **Type inference** consistently uses `z.infer<>` for runtime-synced types
- **Validation refinements** for business logic (e.g., `loopEnd >= loopStart`)

### 3. Effective Caching Layer
`cached-storage.ts` (725 lines, but well-organized) provides:
- Read-through/write-through caching with proper invalidation
- Comprehensive metrics tracking (hits, misses, timing)
- Normalized path keys for cross-platform consistency
- Proper cache coherence across the handle tree

### 4. Clean Converter Registry Pattern
The `ConverterRegistry` class uses composition and interfaces:
- Device-specific converters implement `ToneConverter<TDeviceTone>` interface
- Factory function `createSeriesToneConverter<T>()` for S-series shared logic
- No inheritance hierarchies - thin wrapper converters (e.g., `s330ToneConverter` is 12 lines)

### 5. Comprehensive Loop Detection Module
The `loop-detector/` directory implements sophisticated audio analysis:
- Zero-crossing detection with polarity matching
- NCC (Normalized Cross-Correlation) scoring
- Spectral similarity analysis via FFT
- Hardware constraint validation for Roland S-550/S-330

---

## Issues Found

### Critical Issues (None)

No critical security vulnerabilities or data corruption risks identified.

---

### High Priority Issues

#### H1. `common-area/samples.ts` Exceeds Size Guidelines (521+ lines)
**File:** `src/common-area/samples.ts`
**Lines:** 521+

The file combines CRUD operations for both regular samples and chopped samples, plus directory management utilities. Per project guidelines, files should be 300-500 lines maximum.

**Recommendation:** Split into:
- `src/common-area/sample-crud.ts` - Regular sample CRUD
- `src/common-area/chopped-sample-crud.ts` - Chopped sample CRUD
- `src/common-area/directory-ops.ts` - `deleteItem`, `createFolder`, `moveItem`

#### H2. `library-fs.ts` File Size (627 lines)
**File:** `src/library-fs.ts`
**Lines:** 627

This file combines directory navigation, move operations, tree scanning, and multiple item detectors.

**Recommendation:** Split into:
- `src/library-fs/navigation.ts` - `getNestedDirectory*`, `moveDirectory`, etc.
- `src/library-fs/scanners.ts` - Generic `scanLibraryDirectory` and wrappers
- `src/library-fs/detectors.ts` - Item detection functions

#### H3. `cached-storage.ts` File Size (725 lines)
**File:** `src/cached-storage.ts`
**Lines:** 725

While the code is well-organized, it exceeds the 500-line guideline.

**Recommendation:** Extract `StorageCache` class and metrics types to separate files:
- `src/caching/storage-cache.ts` - Cache state management
- `src/caching/cached-handles.ts` - Cached wrapper classes
- `src/caching/types.ts` - Metrics interfaces

---

### Medium Priority Issues

#### M1. Inconsistent Filename Sanitization Functions
**Files:**
- `src/common-area/import.ts:130-132` - `sanitizeForFilename()`
- `src/storage/library-paths.ts:117-124` - `sanitizeFilename()`

Two different sanitization implementations exist:

```typescript
// import.ts - simpler version
export function sanitizeForFilename(input: string): string {
  return input.replace(UNSAFE_FILENAME_CHARS, '_');
}

// library-paths.ts - more comprehensive
export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 64);
}
```

**Risk:** Inconsistent handling could lead to different paths being generated for the same input.

**Recommendation:** Consolidate into a single utility in a shared location and use it consistently across the module.

#### M2. Missing Path Traversal Protection in Some Functions
**File:** `src/storage/library-paths.ts:72-74`

```typescript
export function getTonePath(device: DeviceType, toneName: string): string {
  return join(getTonesDirectory(device), `${toneName}.yaml`);
}
```

While `DeviceType` is validated by Zod, `toneName` is only sanitized at the caller's discretion. If a caller passes an unsanitized name containing `../`, path traversal could occur.

**Recommendation:** Always apply sanitization within path-building functions, or add explicit checks that reject paths containing `..` or absolute path indicators.

#### M3. Duplicate Type Definitions
**Files:**
- `src/types/common.ts:14` - `DeviceType = 's330' | 's550' | 'jv1080' | 'd110'`
- `src/schemas/common-schema.ts:12` - `DeviceTypeSchema = z.enum(['s330', 's550', 'jv1080', 'd110'])`

The device type is defined in two places, creating a synchronization burden.

**Recommendation:** Define `DeviceType` solely from the Zod schema using `z.infer<>`:
```typescript
export const DeviceTypeSchema = z.enum(['s330', 's550', 'jv1080', 'd110']);
export type DeviceType = z.infer<typeof DeviceTypeSchema>;
```

#### M4. Global Mutable Registry Instance
**File:** `src/converters/converter-registry.ts:134`

```typescript
export const converterRegistry = new ConverterRegistry();
```

A global mutable singleton can cause issues in testing and makes dependency injection harder.

**Recommendation:** Use dependency injection patterns - pass the registry instance to functions that need it, or use a factory function that can be configured for testing.

#### M5. Error Handling in Delete Operations Silently Swallows Errors
**File:** `src/storage/file-storage.ts:219-223`

```typescript
await Promise.all([
  unlink(yamlPath).catch(() => {}),
  unlink(wavPath).catch(() => {}),
]);
```

Silently catching all errors (including permission errors, I/O errors) makes debugging difficult.

**Recommendation:** At minimum, log the errors. Distinguish between "file not found" (acceptable) and other errors (should be reported):
```typescript
await unlink(yamlPath).catch((err) => {
  if (err.code !== 'ENOENT') console.error(`Failed to delete ${yamlPath}:`, err);
});
```

---

### Low Priority Issues

#### L1. Hardcoded Path Constants
**File:** `src/storage/library-paths.ts:21-23`

```typescript
export function getLibraryRoot(): string {
  return join(homedir(), 'Documents', 'AudioTools', 'library');
}
```

The library path is hardcoded with no configuration option.

**Recommendation:** Accept an optional root path parameter or environment variable for flexibility.

#### L2. Missing JSDoc on Some Public Functions
**File:** `src/library-fs.ts:200-206`

```typescript
function sortNodes(nodes: LibraryTreeNode[]): LibraryTreeNode[] {
  // ...
}
```

While `sortNodes` is internal, several public-facing functions in `library-fs.ts` like `isValidMoveTarget` lack comprehensive JSDoc.

#### L3. Magic Numbers in Loop Detector
**File:** `src/loop-detector/loop-point-searcher.ts:249-250`

```typescript
const maxCandidatesToScore = 500;
// ...
const deduplicationDistance = Math.min(100, msToSamples(5, sampleRate));
```

These magic numbers would benefit from being defined as named constants with explanatory comments in `types.ts`.

#### L4. Test File in Source Directory
**File:** `src/cached-storage.test.ts`

A test file exists in the `src/` directory rather than the `test/` directory. This is inconsistent with the project structure.

**Recommendation:** Move to `test/unit/cached-storage.test.ts`.

#### L5. Inconsistent Use of Optional Chaining
**File:** `src/common-area/samples.ts:146`

```typescript
const { onProgress } = options ?? {};
```

This pattern is used, but elsewhere similar destructuring doesn't use it consistently.

---

## Performance Analysis

### Strengths
- **Streaming reads** in `streaming.ts` enable progress tracking without loading entire files into memory
- **Caching layer** significantly reduces redundant I/O on high-latency backends
- **Candidate sampling** in loop detection (`sampleCandidates()`) prevents O(n^2) blowup

### Concerns
1. **Full directory iteration for item detection** (`library-fs.ts`): Each scan reads all files in a directory to detect item types. For large libraries, consider caching directory structure.

2. **No pagination in list operations**: Functions like `listSets()` load all items into memory. For large collections, consider pagination or streaming iterators.

---

## Security Analysis

### Input Validation
- **Zod schemas** provide strong validation at deserialization boundaries
- **WAV header parsing** (`extractWavSampleRate`) validates RIFF structure before use

### Path Handling
- **Concern:** Path sanitization is inconsistent (see M1, M2)
- **Mitigation:** Device types are enum-validated, reducing attack surface

### Sensitive Data
- No credentials or API keys in code
- YAML files contain only audio metadata

---

## Refactoring Priorities

### Priority 1: File Size Reduction
1. Split `library-fs.ts` (627 lines) into navigation, scanners, and detectors
2. Split `common-area/samples.ts` (521+ lines) into separate CRUD modules
3. Split `cached-storage.ts` (725 lines) into cache core and handle wrappers

### Priority 2: Consolidate Utilities
1. Unify `sanitizeForFilename()` and `sanitizeFilename()`
2. Single-source `DeviceType` from Zod schema

### Priority 3: Improve Testability
1. Make `converterRegistry` injectable rather than global
2. Move test file from `src/` to `test/`

### Priority 4: Documentation
1. Add JSDoc to public functions in `library-fs.ts`
2. Document magic numbers in loop detector as named constants

---

## Specific File References

| File | Lines | Issue |
|------|-------|-------|
| `src/common-area/samples.ts` | 521+ | H1 - Exceeds size limit |
| `src/library-fs.ts` | 627 | H2 - Exceeds size limit |
| `src/cached-storage.ts` | 725 | H3 - Exceeds size limit |
| `src/common-area/import.ts:130-132` | - | M1 - Inconsistent sanitization |
| `src/storage/library-paths.ts:117-124` | - | M1 - Inconsistent sanitization |
| `src/storage/library-paths.ts:72-74` | - | M2 - Path traversal risk |
| `src/types/common.ts:14` | - | M3 - Duplicate type definition |
| `src/converters/converter-registry.ts:134` | - | M4 - Global mutable state |
| `src/storage/file-storage.ts:219-223` | - | M5 - Silent error swallowing |
| `src/loop-detector/loop-point-searcher.ts:249-250` | - | L3 - Magic numbers |
| `src/cached-storage.test.ts` | - | L4 - Test in src directory |

---

## Positive Patterns Worth Preserving

1. **Interface-first design** in storage abstractions
2. **Discriminated unions** for variant types in Zod schemas
3. **Factory functions** for device-specific converters
4. **Composition over inheritance** throughout
5. **Comprehensive type exports** from index files
6. **Progress callbacks** for long-running operations
7. **Hardware constraint constants** in loop detector

---

## Summary

The `sampler-library` module is well-architected with clean abstractions and strong TypeScript practices. The main areas for improvement are:

1. **File sizes** - Three files exceed the 500-line guideline and should be split
2. **Utility consolidation** - Duplicate sanitization functions need unification
3. **Path safety** - Consistent path traversal protection should be added
4. **Testability** - Replace global registry with dependency injection

These are maintainability improvements rather than critical defects. The core architecture is sound and follows the project's composition-over-inheritance philosophy effectively.
