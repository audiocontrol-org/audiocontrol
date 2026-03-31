# E2E Test Infrastructure Audit Remediation Plan

**Source Audit:** [infrastructure-audit-2026-03-29.md](./infrastructure-audit-2026-03-29.md)
**Created:** 2026-03-29

---

## GitHub Tracking

| Item | Link |
|------|------|
| **Milestone** | [Week of Mar 30 - Apr 3](https://github.com/audiocontrol-org/audiocontrol/milestone/7) |
| **Parent Issue** | [#102 - [e2e] Remediate test infrastructure audit findings](https://github.com/audiocontrol-org/audiocontrol/issues/102) |
| **Labels** | `documentation`, `refactor`, `enhancement` |

### Implementation Issues

| Phase | Issue | Priority |
|-------|-------|----------|
| Phase 1 | [#103 - Triage disabled test suites](https://github.com/audiocontrol-org/audiocontrol/issues/103) | P0 |
| Phase 1 | [#104 - Address akaitools skipped tests](https://github.com/audiocontrol-org/audiocontrol/issues/104) | P0 |
| Phase 2 | [#105 - Remove placeholder test files](https://github.com/audiocontrol-org/audiocontrol/issues/105) | P1 |
| Phase 3 | [#106 - Refactor oversized e2e test files](https://github.com/audiocontrol-org/audiocontrol/issues/106) | P2 |
| Phase 4 | [#107 - Create centralized TESTING.md](https://github.com/audiocontrol-org/audiocontrol/issues/107) | P2 |
| Phase 4 | [#108 - Relocate debug test files](https://github.com/audiocontrol-org/audiocontrol/issues/108) | P2 |
| Phase 5 | [#109 - Document all skip markers](https://github.com/audiocontrol-org/audiocontrol/issues/109) | P3 |

---

## Overview

This plan addresses findings from the E2E test infrastructure audit. Issues are organized into phases by priority, with each task scoped to 1-2 days of work.

### Summary of Findings

| Category | Count | Priority |
|----------|-------|----------|
| Disabled test suites (`describe.skip`) | 5 | P0 |
| Skipped tests (akaitools) | 16 | P0 |
| Placeholder test files | 6 | P1 |
| Oversized test files (>500 lines) | 4 | P2 |
| Missing centralized documentation | 1 | P2 |
| Debug tests in main suite | 2 | P2 |
| Import pattern violations | Multiple | P2 |
| Undocumented skip markers | Multiple | P3 |

---

## Phase 1: Critical Cleanup (P0)

**Goal:** Remove or complete disabled test suites and skipped tests that consume code space without providing coverage.

**Issues:** [#103](https://github.com/audiocontrol-org/audiocontrol/issues/103), [#104](https://github.com/audiocontrol-org/audiocontrol/issues/104)

### Task 1.1: Triage disabled launch-control-xl3 test suites

**Files:**
- `modules/launch-control-xl3/test/unit/LaunchControlXL3.test.ts`
- `modules/launch-control-xl3/test/core/SysExParser.test.ts`
- `modules/launch-control-xl3/test/integration/device.integration.test.ts`
- `modules/launch-control-xl3/test/integration/slot-selection.hardware.test.ts`

**Action:** For each file, determine:
1. Is the test still relevant? If no → delete file
2. Can the test be completed? If yes → complete and enable
3. Is it blocked? If yes → document blocker and create tracking issue

**Acceptance Criteria:**
- [ ] Each file either deleted, enabled, or has tracking issue
- [ ] No `describe.skip` without documented justification

### Task 1.2: Triage disabled s3000xl test suite

**File:** `modules/sampler-devices/test/integration/s3000xl.test.ts`

**Issue:** "client file does not exist"

**Action:**
1. Determine if S3000XL client is still planned
2. If yes → create tracking issue for client implementation
3. If no → delete test file

**Acceptance Criteria:**
- [ ] File deleted or tracking issue created
- [ ] Decision documented in commit message

### Task 1.3: Address akaitools skipped tests

**File:** `modules/sampler-translate/test/akaitools.test.ts`

**Issue:** 16 skipped tests due to missing test data files

**Action:**
1. Determine if test data can be added to repository
2. If yes → add test data and enable tests
3. If no (licensing/size) → document data requirements and keep skipped with justification comment

**Acceptance Criteria:**
- [ ] Tests enabled with data, OR
- [ ] Each skip has inline comment explaining why and what's needed
- [ ] Test data requirements documented in module README

---

## Phase 2: Placeholder Cleanup (P1)

**Goal:** Replace trivial placeholder tests with real tests or remove them.

**Issue:** [#105](https://github.com/audiocontrol-org/audiocontrol/issues/105)

### Task 2.1: Remove or replace trivial basic.test.ts files

**Files:**
- `modules/sampler-devices/test/unit/basic.test.ts` (7 lines, `expect(1).toBe(1)`)
- `modules/sampler-lib/test/unit/basic.test.ts` (7 lines, `expect(1).toBe(1)`)

**Action:**
1. Check if module has other unit tests
2. If yes → delete basic.test.ts
3. If no → add real unit tests for core exports OR delete with note that unit tests needed

**Acceptance Criteria:**
- [ ] No `expect(1).toBe(1)` placeholder tests remain
- [ ] Each module either has real tests or tracking issue for tests

### Task 2.2: Address placeholder index.test.ts files

**Files:**
- `modules/ardour-midi-maps/src/index.test.ts` (8 lines)
- `modules/canonical-midi-maps/src/index.test.ts` (8 lines)

**Action:**
1. Add real tests for module exports, OR
2. Delete if module has tests elsewhere

**Acceptance Criteria:**
- [ ] Each file has meaningful assertions or is deleted

### Task 2.3: Complete or remove sampler-midi placeholder

**File:** `modules/sampler-midi/test/unit/akai-s3000xl.test.ts` (11 lines)

**Action:**
1. If S3000XL support is active → add real protocol tests
2. If S3000XL support is deferred → delete file

**Acceptance Criteria:**
- [ ] File has real tests or is deleted

### Task 2.4: Complete disk-backup.test.ts TODO

**File:** `modules/sampler-backup/test/unit/disk-backup.test.ts` (18 lines with TODO)

**TODO Items:**
- Test backupDisk with mocked SSH/SCP
- Test backupBatch with multiple disks
- Test error handling

**Action:**
1. Implement the TODO tests using dependency injection (not mocking), OR
2. Create tracking issue if blocked

**Acceptance Criteria:**
- [ ] TODO items completed or tracked in GitHub issue
- [ ] No TODO comments without tracking references

---

## Phase 3: Test File Refactoring (P2)

**Goal:** Bring oversized test files under 500 lines per project guidelines.

**Issue:** [#106](https://github.com/audiocontrol-org/audiocontrol/issues/106)

### Task 3.1: Refactor library-sets.spec.ts

**File:** `modules/roland-sxx0-editor/e2e/library-sets.spec.ts` (1548 lines)
**Target:** Split into 3-4 files of ~400 lines each

**Approach:**
1. Group tests by feature area (CRUD, import/export, edge cases)
2. Extract shared fixtures to `fixtures/sets-fixtures.ts`
3. Create focused spec files: `library-sets-crud.spec.ts`, `library-sets-import.spec.ts`, etc.

**Acceptance Criteria:**
- [ ] No single file exceeds 500 lines
- [ ] All tests still pass
- [ ] Shared fixtures extracted

### Task 3.2: Refactor library-tones.spec.ts

**File:** `modules/roland-sxx0-editor/e2e/library-tones.spec.ts` (1142 lines)
**Target:** Split into 2-3 files of ~400 lines each

**Acceptance Criteria:**
- [ ] No single file exceeds 500 lines
- [ ] All tests still pass

### Task 3.3: Refactor library-patches.spec.ts

**File:** `modules/roland-sxx0-editor/e2e/library-patches.spec.ts` (1082 lines)
**Target:** Split into 2-3 files of ~400 lines each

**Acceptance Criteria:**
- [ ] No single file exceeds 500 lines
- [ ] All tests still pass

### Task 3.4: Refactor hardware-device-sets.spec.ts

**File:** `modules/roland-sxx0-editor/e2e/hardware-device-sets.spec.ts` (846 lines)
**Target:** Split into 2 files of ~400 lines each

**Acceptance Criteria:**
- [ ] No single file exceeds 500 lines
- [ ] All tests still pass

---

## Phase 4: Documentation (P2)

**Goal:** Create centralized test documentation and improve discoverability.

**Issues:** [#107](https://github.com/audiocontrol-org/audiocontrol/issues/107), [#108](https://github.com/audiocontrol-org/audiocontrol/issues/108)

### Task 4.1: Create root TESTING.md

**Location:** `docs/TESTING.md` or root `TESTING.md`

**Content:**
1. Test framework overview (Vitest for unit, Playwright for e2e)
2. File naming conventions (`.test.ts` vs `.spec.ts`)
3. Running tests (make targets, pnpm commands)
4. E2E testing tenets (link to .claude/CLAUDE.md section)
5. Hardware test requirements
6. Test data requirements

**Acceptance Criteria:**
- [ ] Single authoritative source for test documentation
- [ ] Linked from root README.md
- [ ] Covers all test categories

### Task 4.2: Relocate debug test files

**Files:**
- `modules/roland-sxx0-editor/e2e/standalone-debug.spec.ts`
- `modules/roland-sxx0-editor/e2e/protocol-debug.spec.ts`

**Action:**
1. Move to `e2e/debug/` directory
2. Add README explaining debug test purpose
3. Exclude from standard test runs (update playwright config)

**Acceptance Criteria:**
- [ ] Debug tests in separate directory
- [ ] Not run by default `pnpm test:e2e`
- [ ] Purpose documented

### Task 4.3: Document exploratory tests

**Directory:** `modules/sampler-devices/test/integration/exploratory/`

**Action:** Add README.md explaining:
1. What exploratory tests are for
2. When to add/remove them
3. How they differ from regular tests

**Acceptance Criteria:**
- [ ] README.md exists in exploratory directory
- [ ] Purpose is clear to new contributors

---

## Phase 5: Code Quality (P2-P3)

**Goal:** Enforce project conventions in test files.

**Issue:** [#109](https://github.com/audiocontrol-org/audiocontrol/issues/109)

### Task 5.1: Fix import pattern violations

**Issue:** Some test files use relative imports instead of `@/` pattern

**Action:**
1. Grep for relative imports in test files
2. Update to `@/` pattern where applicable
3. Document exceptions (same-directory imports are allowed)

**Acceptance Criteria:**
- [ ] No cross-directory relative imports in test files
- [ ] Lint rule added if possible

### Task 5.2: Document skip marker justifications

**Action:** For all remaining `it.skip` and `describe.skip`:
1. Add inline comment explaining why
2. Include what's needed to enable
3. Reference tracking issue if applicable

**Format:**
```typescript
// SKIP: Requires SSH server setup - see #NNN
it.skip('should connect via SSH', ...)
```

**Acceptance Criteria:**
- [ ] Every skip marker has justification comment
- [ ] Comments follow consistent format

---

## Dependencies

| Task | Depends On |
|------|------------|
| Task 3.x (refactoring) | None - can run in parallel |
| Task 4.1 (TESTING.md) | None |
| Task 4.2 (debug relocation) | None |
| Task 1.x (triage) | None - can run in parallel |
| Task 2.x (placeholders) | Task 1.x decisions (may affect scope) |

---

## Success Criteria

### Phase 1 Complete When:
- [ ] Zero `describe.skip` without documented justification
- [ ] All akaitools skips have inline comments

### Phase 2 Complete When:
- [ ] Zero `expect(1).toBe(1)` placeholder tests
- [ ] All TODO comments have tracking issues

### Phase 3 Complete When:
- [ ] All test files under 500 lines
- [ ] Test coverage unchanged

### Phase 4 Complete When:
- [ ] TESTING.md exists and linked from README
- [ ] Debug tests segregated
- [ ] Exploratory tests documented

### Phase 5 Complete When:
- [ ] No import pattern violations
- [ ] All skips documented

---

## Estimated Scope

| Phase | Tasks | Effort |
|-------|-------|--------|
| Phase 1 | 3 tasks | 1-2 days |
| Phase 2 | 4 tasks | 1-2 days |
| Phase 3 | 4 tasks | 2-3 days |
| Phase 4 | 3 tasks | 1 day |
| Phase 5 | 2 tasks | 1 day |
| **Total** | **16 tasks** | **~1 milestone** |

