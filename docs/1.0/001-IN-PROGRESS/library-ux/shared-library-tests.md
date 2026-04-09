# Shared Library E2E Tests

## Problem

42 of Roland's 104 Tier 1 library tests exercise common-area operations that should work identically in every editor. The S3K editor has only 10 of these. Instead of duplicating tests per editor, write shared tests in `e2e-infra` that run against any editor.

## Tests to generalize

| Source file | Tests | What it tests |
|-------------|-------|---------------|
| `library-opfs.spec.ts` | 8 | OPFS init, read/write, cleanup, isolation |
| `library-directories.spec.ts` | 19 | Create/rename/delete/move directories, edge cases |
| `library-ui-operations.spec.ts` | 8 | Select sample, create folder, delete, connect/disconnect, context menu |
| `library-drumkit-editor.spec.ts` | 5 | Drum kit pad preview, MIDI note assignment |
| `library-drumkit-error.spec.ts` | 2 | Missing WAV, no WAV files error handling |
| **Total** | **42** | |

Not generalized (Roland device-specific):
- `library-tones.spec.ts` (20) — tone CRUD
- `library-patches.spec.ts` (21) — patch CRUD
- `library-sets.spec.ts` (23) — set operations
- `library-chopper-save.spec.ts` (3 of 7) — Roland-specific tone/drum-kit fixtures

Already in S3K (keep as-is):
- `library-chopper-save.spec.ts` (4 tests) — S3K-specific chopper tests
- `library-ui-operations.spec.ts` (6 tests) — S3K-specific UI tests

## Approach

### Parameterized test factory

Create shared test factories in `e2e-infra/specs/` that accept an editor config:

```typescript
interface LibraryTestConfig {
  /** Base URL for the editor's library page */
  libraryUrl: string;
  /** OPFS init function (creates device-specific + common directories) */
  initializeOPFS: (page: Page) => Promise<void>;
  /** Editor name for test descriptions */
  editorName: string;
}
```

Each test factory exports a function that registers tests:

```typescript
// e2e-infra/specs/library-opfs.spec-factory.ts
export function registerOPFSTests(config: LibraryTestConfig) {
  test.describe(`${config.editorName} OPFS Operations`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(config.libraryUrl);
      await cleanupOPFS(page);
      await config.initializeOPFS(page);
    });
    // ... 8 tests
  });
}
```

Each editor creates a thin spec file that calls the factory:

```typescript
// akai-s3k-editor/e2e/library-opfs.spec.ts
import { registerOPFSTests } from '../../e2e-infra/specs/library-opfs.spec-factory';
registerOPFSTests({
  libraryUrl: `https://localhost:${port}/akai/s3000xl/editor/library`,
  initializeOPFS: initializeS3kOPFS,
  editorName: 'S3K',
});
```

### File organization

```
modules/e2e-infra/specs/
  library-opfs.spec-factory.ts          # 8 tests
  library-directories.spec-factory.ts   # 19 tests
  library-ui-operations.spec-factory.ts # 8 tests
  library-drumkit-editor.spec-factory.ts # 5 tests
  library-drumkit-error.spec-factory.ts  # 2 tests

modules/akai-s3k-editor/e2e/
  library-opfs.spec.ts                  # imports + calls factory
  library-directories.spec.ts           # imports + calls factory
  library-ui-operations.spec.ts         # imports + calls factory (replace current 6-test file)
  library-drumkit-editor.spec.ts        # imports + calls factory
  library-drumkit-error.spec.ts         # imports + calls factory
  library-chopper-save.spec.ts          # stays S3K-specific (already done)

modules/roland-sxx0-editor/e2e/
  library-opfs.spec.ts                  # replace current with factory call
  library-directories.spec.ts           # replace current with factory call
  library-ui-operations.spec.ts         # replace current with factory call
  library-drumkit-editor.spec.ts        # replace current with factory call
  library-drumkit-error.spec.ts         # replace current with factory call
  library-tones.spec.ts                 # stays Roland-specific
  library-patches.spec.ts               # stays Roland-specific
  library-sets.spec.ts                  # stays Roland-specific
  library-chopper-save.spec.ts          # stays Roland-specific
```

### Implementation order

1. Create the `LibraryTestConfig` interface and shared helpers in `e2e-infra`
2. Extract `library-opfs.spec-factory.ts` from Roland's `library-opfs.spec.ts` — simplest, no fixture dependencies
3. Create S3K's `library-opfs.spec.ts` calling the factory — verify it passes
4. Repeat for `library-directories`, `library-ui-operations`, `library-drumkit-editor`, `library-drumkit-error`
5. After each factory extraction, verify both editors pass
6. Delete the duplicated inline test code from both editors

## Verification

```bash
# Both editors' shared tests pass
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-s3k-library
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-roland-library

# Test counts match expectations
# S3K: 42 shared + 4 chopper = 46
# Roland: 42 shared + 64 device-specific = 106
```
