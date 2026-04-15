# Test Infrastructure

**Status:** In Progress

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Fix Node e2e path resolution (#281) | Planning |
| Phase 2 | Test directory migration (#263) | Planning |

## Documentation

- [PRD](./prd.md)
- [Workplan](./workplan.md)
- [Implementation Summary](./implementation-summary.md)

## Overview

Standardizes the test directory structure across editor modules and fixes broken Node.js e2e tests. Each editor module gets a `test/unit/`, `test/ui/`, `test/e2e/` directory layout. Existing tests are migrated to the new structure with updated configs and Make targets. Node e2e tests in `e2e-infra` are fixed to resolve `@/` path aliases under tsx with `moduleResolution: "nodenext"`.

## Links

- **Branch:** [`feature/test-infra`](https://github.com/audiocontrol-org/audiocontrol/tree/feature/test-infra)
- **Worktree:** `~/work/audiocontrol-work/audiocontrol-test-infra/`
- **Issues:** [#263](https://github.com/audiocontrol-org/audiocontrol/issues/263), [#281](https://github.com/audiocontrol-org/audiocontrol/issues/281)

## Modules Affected

- `modules/akai-s3k-editor/` — test migration
- `modules/roland-sxx0-editor/` — test migration
- `modules/e2e-infra/` — @/ path alias fix
- Root — `TESTING-UNIT.md`, `TESTING-E2E.md` documentation
