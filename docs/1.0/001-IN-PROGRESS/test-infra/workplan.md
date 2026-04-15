# Test Infrastructure — Workplan

**Feature:** Test Infrastructure
**PRD:** [prd.md](./prd.md)
**GitHub Issues:**

| Phase | Issue | Description |
|-------|-------|-------------|
| Parent | [#284](https://github.com/audiocontrol-org/audiocontrol/issues/284) | [test] Test Infrastructure — Directory Migration and Path Resolution |
| Phase 1 | [#281](https://github.com/audiocontrol-org/audiocontrol/issues/281) | Node e2e @/ path alias not resolved by tsx |
| Phase 2 | [#263](https://github.com/audiocontrol-org/audiocontrol/issues/263) | Migrate test infrastructure to standard test/ directory structure |

## Implementation Phases

### Phase 1: Fix Node e2e path resolution (#281)

Unblock Node-based e2e tests that currently fail with `ERR_MODULE_NOT_FOUND` due to tsx not resolving `@/` path aliases under `moduleResolution: "nodenext"`.

**Tasks:**

- [x] Investigate tsx path alias resolution with `moduleResolution: "nodenext"` — tsx does NOT resolve TypeScript `paths` at runtime; Node ESM has no knowledge of tsconfig path aliases
- [x] Choose resolution strategy: migrate `e2e-infra` imports from `@/` to Node-native `#node/` package imports using the `imports` field in `package.json`
- [x] Implement the chosen strategy in `modules/e2e-infra/` — migrated all 37 `@/node/` imports to `#node/` across 17 files; added `#node/*` path to tsconfig for IDE/type-check support
- [x] Verify `make test-scsi-write-validation` runs without import resolution errors — confirmed: tsx resolves all `#node/` imports, connect + scan tests pass against S3000XL
- [x] Verify other Node e2e Make targets (`test-e2e-s3k-scsi`, etc.) work correctly — import resolution verified; `check-scsi-bridge` prerequisite needs Rust cross-compilation (separate concern)
- [x] Document the resolution approach in a code comment at the configuration site — comment added in `scsi-write-test.ts`

**Acceptance criteria:** All Node e2e tests run without `ERR_MODULE_NOT_FOUND`. No regressions in existing SCSI or device e2e test targets.

### Phase 2: Test directory migration (#263)

Establish a standard test directory structure across editor modules and migrate existing tests to the new layout.

**Tasks:**

#### Directory structure

- [x] Create `test/unit/`, `test/ui/`, `test/e2e/` directories in `modules/akai-s3k-editor/`
- [x] Create `test/unit/`, `test/ui/`, `test/e2e/` directories in `modules/roland-sxx0-editor/`

#### Unit test migration

- [x] Move `src/**/*.test.tsx` files from `akai-s3k-editor` to `test/unit/`, preserving directory structure relative to `src/`
- [x] Move `src/**/*.test.tsx` files from `roland-sxx0-editor` to `test/unit/` — N/A, no unit tests in src/
- [x] Update imports in migrated test files — fixed relative import in DeviceMemoryPanel.test.tsx to use `@/`
- [x] Update `vitest.config.ts` in each editor to find tests in `test/unit/` instead of `src/`

#### E2E test migration

- [x] Move `e2e/*.spec.ts` files from `akai-s3k-editor` to `test/e2e/`
- [x] Move `e2e/*.spec.ts` files from `roland-sxx0-editor` to `test/e2e/` (includes helpers, fixtures, reporters, debug)
- [x] Update all Playwright configs (13 total) to reference `test/e2e/` test directory
- [x] Update helper/fixture/reporter paths within e2e configs (heartbeat-reporter paths fixed)

#### UI test infrastructure

- [x] Create `playwright.test-harness.config.ts` in `akai-s3k-editor` for UI tests — already existed
- [x] Create `playwright.test-harness.config.ts` in `roland-sxx0-editor` for UI tests
- [x] Add `test-ui-s3k` Make target — already existed (named `test-ui-s3k`)
- [x] Add `test-ui-roland` Make target
- [x] Verify UI test configs can discover and run specs in `test/ui/` — test-ui-s3k runs 19 specs (18 pass, 1 flaky pre-existing)

#### Documentation

- [x] Backfill `TESTING-UNIT.md` with unit testing methodology, directory conventions, and examples
- [x] Backfill `TESTING-E2E.md` with e2e methodology — two test modes (Playwright vs Node CLI), run-and-watch.sh, tenets, SCSI provisioning, heartbeat/watchdog
- [x] Add cross-references between `TESTING-UNIT.md`, `TESTING-E2E.md`, and CLAUDE.md — updated TESTING.md with consolidated running tests section

#### Verification

- [x] All existing unit tests pass from new locations (`pnpm test`) — 118 akai tests pass, 4 roland integration tests pass
- [x] All existing e2e tests pass from new locations — s3k-library and roland-library run from test/e2e/ (pre-existing chopper failures only)
- [x] New `make test-ui-*` targets execute without errors — test-ui-s3k verified
- [x] `make` full build succeeds with no regressions

**Acceptance criteria:** All tests pass from their new locations. Make targets work for all three test categories. `TESTING-UNIT.md` and `TESTING-E2E.md` contain methodology content. No test behavior changes.

## GitHub Tracking

| Phase | GitHub Issue | Status |
|-------|-------------|--------|
| Phase 1: Node e2e path resolution | [#281](https://github.com/audiocontrol-org/audiocontrol/issues/281) | Complete |
| Phase 2: Test directory migration | [#263](https://github.com/audiocontrol-org/audiocontrol/issues/263) | In Progress |
