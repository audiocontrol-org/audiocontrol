# Test Infrastructure — Product Requirements Document

**Created:** 2026-04-14
**Status:** Approved
**Owner:** Orion Letizi

## Problem Statement

The test infrastructure has two distinct problems:

**1. Disorganized test directory structure.** Unit tests are co-located with source as `src/**/*.test.tsx`, e2e tests live in `e2e/`, and the new UI test category (test harness tests that exercise components in a real browser but without hardware) has no designated home. There is no standard directory convention across editor modules. Contributors have no clear guidance on where to put new tests or how the categories differ.

**2. Broken Node.js e2e tests.** Node.js e2e tests in `modules/e2e-infra/src/node/` fail at runtime because tsx does not resolve the `@/` path alias when `moduleResolution` is set to `"nodenext"`. The TypeScript compiler accepts the imports, but tsx crashes with `ERR_MODULE_NOT_FOUND` when executing. This blocks SCSI write validation and other Node-based e2e test targets.

## User Stories

- As a developer, I want a predictable directory structure (`test/unit/`, `test/ui/`, `test/e2e/`) so I know where to find and add tests without guessing.
- As a developer running `make test-scsi-write-validation`, I want Node e2e tests to resolve their imports and execute without `ERR_MODULE_NOT_FOUND` errors.
- As a CI pipeline, I want distinct make targets for unit, UI, and e2e tests so I can run them in separate stages with appropriate resource allocation.
- As a contributor reading the repo for the first time, I want `TESTING-UNIT.md` and `TESTING-E2E.md` to explain the testing methodology and directory conventions so I can write tests that follow the project's standards.

## Success Criteria

- [ ] Each editor module (`akai-s3k-editor`, `roland-sxx0-editor`) has `test/unit/`, `test/ui/`, `test/e2e/` directories
- [ ] Existing `src/**/*.test.tsx` files migrated to `test/unit/` with updated imports
- [ ] Existing `e2e/*.spec.ts` files migrated to `test/e2e/` with updated Playwright configs
- [ ] UI test specs live in `test/ui/` with a dedicated `playwright.test-harness.config.ts`
- [ ] Vitest configs updated to find tests in `test/unit/`
- [ ] Playwright configs updated to find tests in `test/e2e/`
- [ ] `test-ui-<editor>` Make targets added and functional
- [ ] Node e2e tests in `modules/e2e-infra/` resolve `@/` imports correctly at runtime
- [ ] `make test-scsi-write-validation` runs without import resolution errors
- [ ] `TESTING-UNIT.md` backfilled with unit testing methodology
- [ ] `TESTING-E2E.md` backfilled with e2e methodology, consolidating E2E Testing Tenets from CLAUDE.md

## Scope

### In Scope

- Directory structure migration for `akai-s3k-editor` and `roland-sxx0-editor`
- Vitest and Playwright config updates to match new paths
- New Make targets for UI test category
- Fix `@/` path alias resolution in `modules/e2e-infra/` Node e2e tests
- Backfill `TESTING-UNIT.md` and `TESTING-E2E.md` with methodology content
- Consolidate E2E Testing Tenets from CLAUDE.md into `TESTING-E2E.md`

### Out of Scope

- Writing new tests (this is infrastructure and migration only)
- Changing test behavior or assertions
- Hardware e2e test fixes (#143, #176, #177)
- Test coverage improvements
- CI pipeline configuration changes beyond new Make targets

## Dependencies

None.

## Open Questions

1. **Unit test co-location vs. separation.** Should unit tests remain co-located with source (`src/**/*.test.tsx`), which is a common React convention, or move to `test/unit/`? The workplan assumes migration to `test/unit/` for consistency across all three test categories, but the team should confirm this decision before Phase 2 begins.

2. **e2e-infra path alias strategy.** Should `@/` imports in Node e2e tests be fixed by configuring tsx to resolve paths (e.g., via `tsconfig-paths` or tsx loader options), or should they be migrated to Node-native `#node/` package imports via the `imports` field in `package.json`? The Node-native approach avoids the alias problem entirely but requires more import rewrites.
