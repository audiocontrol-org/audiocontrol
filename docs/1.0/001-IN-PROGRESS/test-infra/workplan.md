# Test Infrastructure — Workplan

**Feature:** Test Infrastructure
**PRD:** [prd.md](./prd.md)
**GitHub Issues:**

- [#263 — Test directory migration](https://github.com/audiocontrol-org/audiocontrol/issues/263)
- [#281 — Node e2e @/ path alias resolution](https://github.com/audiocontrol-org/audiocontrol/issues/281)

## Implementation Phases

### Phase 1: Fix Node e2e path resolution (#281)

Unblock Node-based e2e tests that currently fail with `ERR_MODULE_NOT_FOUND` due to tsx not resolving `@/` path aliases under `moduleResolution: "nodenext"`.

**Tasks:**

- [ ] Investigate tsx path alias resolution with `moduleResolution: "nodenext"` — determine whether tsx supports `paths` from tsconfig, whether a loader/plugin is needed, or whether the alias approach is fundamentally incompatible with Node ESM resolution
- [ ] Choose resolution strategy: either configure tsx to resolve `@/` paths (via `tsconfig-paths`, custom loader, or tsx-native support) or migrate `e2e-infra` imports from `@/` to Node-native `#node/` package imports using the `imports` field in `package.json`
- [ ] Implement the chosen strategy in `modules/e2e-infra/`
- [ ] Verify `make test-scsi-write-validation` runs without import resolution errors
- [ ] Verify other Node e2e Make targets (`test-e2e-s3k-scsi`, etc.) work correctly
- [ ] Document the resolution approach in a code comment at the configuration site

**Acceptance criteria:** All Node e2e tests run without `ERR_MODULE_NOT_FOUND`. No regressions in existing SCSI or device e2e test targets.

### Phase 2: Test directory migration (#263)

Establish a standard test directory structure across editor modules and migrate existing tests to the new layout.

**Tasks:**

#### Directory structure

- [ ] Create `test/unit/`, `test/ui/`, `test/e2e/` directories in `modules/akai-s3k-editor/`
- [ ] Create `test/unit/`, `test/ui/`, `test/e2e/` directories in `modules/roland-sxx0-editor/`

#### Unit test migration

- [ ] Move `src/**/*.test.tsx` files from `akai-s3k-editor` to `test/unit/`, preserving directory structure relative to `src/`
- [ ] Move `src/**/*.test.tsx` files from `roland-sxx0-editor` to `test/unit/`, preserving directory structure relative to `src/`
- [ ] Update imports in migrated test files (adjust relative paths or add path aliases for test directories)
- [ ] Update `vitest.config.ts` in each editor to find tests in `test/unit/` instead of `src/`

#### E2E test migration

- [ ] Move `e2e/*.spec.ts` files from `akai-s3k-editor` to `test/e2e/`
- [ ] Move `e2e/*.spec.ts` files from `roland-sxx0-editor` to `test/e2e/`
- [ ] Update all Playwright configs (`playwright.config.ts`, `playwright.hardware.config.ts`, etc.) to reference `test/e2e/` test directory
- [ ] Update any helper/fixture imports within e2e test files

#### UI test infrastructure

- [ ] Create `playwright.test-harness.config.ts` in `akai-s3k-editor` for UI tests
- [ ] Create `playwright.test-harness.config.ts` in `roland-sxx0-editor` for UI tests
- [ ] Add `test-ui-akai-s3k-editor` Make target
- [ ] Add `test-ui-roland-sxx0-editor` Make target
- [ ] Verify UI test configs can discover and run specs in `test/ui/`

#### Documentation

- [ ] Backfill `TESTING-UNIT.md` with unit testing methodology, directory conventions, and examples
- [ ] Backfill `TESTING-E2E.md` with e2e methodology, consolidating the E2E Testing Tenets currently in CLAUDE.md
- [ ] Add cross-references between `TESTING-UNIT.md`, `TESTING-E2E.md`, and CLAUDE.md

#### Verification

- [ ] All existing unit tests pass from new locations (`pnpm test`)
- [ ] All existing e2e tests pass from new locations (relevant `make test-e2e-*` targets)
- [ ] New `make test-ui-*` targets execute without errors
- [ ] `make` full build succeeds with no regressions

**Acceptance criteria:** All tests pass from their new locations. Make targets work for all three test categories. `TESTING-UNIT.md` and `TESTING-E2E.md` contain methodology content. No test behavior changes.

## GitHub Tracking

| Phase | GitHub Issue | Status |
|-------|-------------|--------|
| Phase 1: Node e2e path resolution | [#281](https://github.com/audiocontrol-org/audiocontrol/issues/281) | TBD |
| Phase 2: Test directory migration | [#263](https://github.com/audiocontrol-org/audiocontrol/issues/263) | TBD |
