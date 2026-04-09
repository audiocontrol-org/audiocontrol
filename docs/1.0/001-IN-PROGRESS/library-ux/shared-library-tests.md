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

### Env-parameterized shared specs (no per-editor wrappers)

Shared specs live in `e2e-infra/specs/` and are run directly via a shared Playwright config. Editor-specific config is passed as environment variables from Make targets. No per-editor wrapper files — they're a maintenance trap that future agents will bloat with inline tests.

Each spec reads config from `process.env`:
```typescript
// e2e-infra/specs/library-opfs.spec.ts
const LIBRARY_URL = process.env.E2E_LIBRARY_URL!;
const EDITOR_NAME = process.env.E2E_EDITOR_NAME!;
const OPFS_INIT = process.env.E2E_OPFS_INIT!; // 's3k' or 'roland'
const initializeOPFS = OPFS_INIT === 's3k' ? initializeS3kOPFS : initializeRolandOPFS;

test.describe(`${EDITOR_NAME} OPFS Operations`, () => { ... });
```

Make targets parameterize the run:
```makefile
test-e2e-common-library-s3k:
    E2E_LIBRARY_URL=... E2E_EDITOR_NAME=S3K E2E_OPFS_INIT=s3k \
    playwright test --config=modules/e2e-infra/playwright.library.config.ts

test-e2e-common-library-roland:
    E2E_LIBRARY_URL=... E2E_EDITOR_NAME=Roland E2E_OPFS_INIT=roland \
    playwright test --config=modules/e2e-infra/playwright.library.config.ts
```

### File organization

```
modules/e2e-infra/
  playwright.library.config.ts           # Shared Playwright config
  specs/
    library-opfs.spec.ts                  # 8 tests (env-parameterized)
    library-directories.spec.ts           # 19 tests
    library-ui-operations.spec.ts         # 7 tests
    library-drumkit-editor.spec.ts        # 5 tests
    library-drumkit-error.spec.ts         # 2 tests

modules/akai-s3k-editor/e2e/
  library-chopper-save.spec.ts            # S3K-specific (already done)
  device-*.spec.ts                        # Device-specific tests

modules/roland-sxx0-editor/e2e/
  library-tones.spec.ts                   # Roland-specific
  library-patches.spec.ts                 # Roland-specific
  library-sets.spec.ts                    # Roland-specific
  library-chopper-save.spec.ts            # Roland-specific
  device-*.spec.ts                        # Device-specific tests
```

No common-area spec files in editor e2e/ directories.

## Verification

```bash
# Both editors' shared tests pass
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-s3k-library
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-roland-library

# Test counts match expectations
# S3K: 42 shared + 4 chopper = 46
# Roland: 42 shared + 64 device-specific = 106
```
