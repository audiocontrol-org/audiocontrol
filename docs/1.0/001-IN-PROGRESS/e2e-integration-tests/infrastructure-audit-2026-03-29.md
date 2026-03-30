# E2E Test Infrastructure Audit Report

**Date**: 2026-03-29
**Scope**: E2E test infrastructure, organization, documentation, and test quality
**Files scanned**: 210 test files (190 `.test.ts`, 20 `.spec.ts`)

---

## Executive Summary

The audiocontrol monorepo has a sophisticated e2e testing infrastructure with a heartbeat/watchdog system for hardware tests, clear testing tenets documented in `.claude/CLAUDE.md`, and well-organized test categories. However, the audit identified several issues requiring attention: disabled test suites, placeholder tests, inconsistent naming conventions, and documentation gaps.

**Key Findings:**
- 5 entire test suites disabled with `describe.skip()`
- 20+ individual tests skipped with `it.skip()`
- 6 placeholder/trivial test files providing no real coverage
- Inconsistent naming conventions (`.test.ts` vs `.spec.ts`)
- Test documentation scattered across multiple locations

---

## 1. Project Structure Overview

The project is a **TypeScript monorepo** for audio device control, MIDI communication, and web-based editors for vintage samplers/synthesizers.

### Directory Structure

```
audiocontrol/
├── modules/           # 28 organized modules in dependency layers
├── docs/              # Architecture and process documentation
├── scripts/           # Build and automation scripts (14 TypeScript files)
├── tools/             # Plugin interrogator + JUCE plugin host
├── templates/         # Workflow templates
├── netlify/           # Deployment configuration
└── .claude/           # Agent definitions, Claude Code configuration
```

### Module Organization (5 Layers)

| Layer | Modules |
|-------|---------|
| **0 - Foundation** | `shared-midi`, `sampler-lib`, `audiotools-config`, `canonical-midi-maps`, `ardour-midi-maps`, `launch-control-xl3`, `lib-runtime` |
| **1 - Core** | `editor-core`, `lib-device-uuid`, `sampler-devices`, `live-max-cc-router` |
| **2 - Services** | `sampler-midi`, `sampler-library`, `sampler-translate`, `sampler-backup` |
| **3 - Features** | `sampler-export`, `loop-editor`, `d110-editor`, `jv1080-editor` |
| **4 - Applications** | `sampler-editor`, `audiotools-cli`, `roland-sxx0-editor` |

---

## 2. Test Infrastructure

### Frameworks

| Framework | Usage | File Pattern |
|-----------|-------|--------------|
| **Playwright** | UI/Browser e2e tests | `.spec.ts` |
| **Vitest** | Unit/Integration tests | `.test.ts` |

### Playwright Configurations

- `playwright.http-midi.config.ts` - HTTP MIDI transport tests
- `playwright.device-library.config.ts` - Device/library roundtrip tests
- `playwright.visual.config.ts` - Visual regression tests
- `playwright.sample-editor.config.ts` - Sample editor tests
- `playwright.loop-editor.config.ts` - Loop editor tests
- `playwright.hardware.config.ts` - Hardware integration tests

### Test Directories

| Location | Purpose |
|----------|---------|
| `modules/roland-sxx0-editor/e2e/` | Main UI e2e tests (19 files, 9324 lines) |
| `modules/sampler-backup/test/` | CLI tests (unit/integration/device/e2e) |
| `e2e/helpers/` | Test utilities |
| `e2e/fixtures/` | Test data |

### Hardware E2E Testing

The project uses a sophisticated **heartbeat/watchdog architecture** for hardware tests:

1. **Heartbeat Reporter** writes JSON to `/tmp/e2e-heartbeat-{pid}.json` on every test event
2. **Watchdog Process** polls every 500ms, kills runner if heartbeat stale >5s
3. **Orchestrator** coordinates Vite, Playwright, and watchdog

This enables fast detection of stuck hardware tests (MIDI communication failures, etc.).

---

## 3. Critical Issues

### 3.1 Disabled Test Suites (`describe.skip`)

| File | Lines | Issue |
|------|-------|-------|
| `modules/sampler-devices/test/integration/s3000xl.test.ts` | 3-9 | "client file does not exist" |
| `modules/launch-control-xl3/test/unit/LaunchControlXL3.test.ts` | 19 | Entire unit test suite |
| `modules/launch-control-xl3/test/core/SysExParser.test.ts` | - | describe.skip present |
| `modules/launch-control-xl3/test/integration/device.integration.test.ts` | - | describe.skip present |
| `modules/launch-control-xl3/test/integration/slot-selection.hardware.test.ts` | - | describe.skip present |

**Impact:** 5 entire test suites disabled, consuming code space without providing coverage.

**Recommendation:** Either complete these tests or remove them with a tracking issue.

### 3.2 Skipped Individual Tests (`it.skip`)

**20+ tests skipped across multiple files:**

| File | Issue |
|------|-------|
| `lib-translate.test.ts:166` | FIXME: test hanging |
| `linux-detector.test.ts:43` | Device info detection |
| `macos-detector.test.ts:43` | Device info detection |
| `akaitools.test.ts` | **16 skipped tests** - missing test data files |
| `lib-translate-s3k.integration.test.ts:14` | Sample mapping |
| `remote-source.test.ts:194` | SSH setup required |
| `cli-backup.test.ts` | Multiple skipped |

**Root causes:**
- Missing test data files not in repository
- Hardware requirements not met
- SSH setup required
- Temporary directory issues

### 3.3 Placeholder/Trivial Test Files

| File | Lines | Content |
|------|-------|---------|
| `modules/sampler-devices/test/unit/basic.test.ts` | 7 | `expect(1).toBe(1)` |
| `modules/sampler-lib/test/unit/basic.test.ts` | 7 | `expect(1).toBe(1)` |
| `modules/ardour-midi-maps/src/index.test.ts` | 8 | Basic placeholder |
| `modules/canonical-midi-maps/src/index.test.ts` | 8 | Basic placeholder |
| `modules/sampler-midi/test/unit/akai-s3000xl.test.ts` | 11 | Placeholder |
| `modules/sampler-backup/test/unit/disk-backup.test.ts` | 18 | Placeholder with TODO |

**Recommendation:** Either add real tests or remove these files.

### 3.4 TODO/FIXME Comments in Tests

```typescript
// modules/sampler-backup/test/unit/disk-backup.test.ts
// TODO: Add more tests with mocking:
// - Test backupDisk with mocked SSH/SCP
// - Test backupBatch with multiple disks
// - Test error handling
```

---

## 4. Consistency Issues

### 4.1 File Extension Inconsistency

| Pattern | Count | Intended Use |
|---------|-------|--------------|
| `.test.ts` | 190 | Vitest (unit/integration) |
| `.spec.ts` | 20 | Playwright (e2e) |

**Finding:** Convention is established but some files don't follow it consistently.

### 4.2 Import Pattern Violations

Project requires `@/` import pattern, but some test files use relative imports.

### 4.3 Test File Size Violations

Project guideline: files should be 300-500 lines max.

| File | Lines | Over By |
|------|-------|---------|
| `library-sets.spec.ts` | 1548 | 1048 |
| `library-tones.spec.ts` | 1142 | 642 |
| `library-patches.spec.ts` | 1082 | 582 |
| `hardware-device-sets.spec.ts` | 846 | 346 |

### 4.4 Debug/Diagnostic Test Files

| File | Purpose |
|------|---------|
| `standalone-debug.spec.ts` | Protocol debugging |
| `protocol-debug.spec.ts` | "RJC investigation" |

**Recommendation:** Move to separate `debug/` directory or remove if no longer needed.

### 4.5 Exploratory Tests Mixed with Suite

```
modules/sampler-devices/test/integration/exploratory/
├── s550-dat-format.test.ts
├── s550-ping.test.ts
├── s550-probe.test.ts
└── s550-tone-dump.test.ts
```

**Finding:** Exploratory tests are in an `exploratory/` subdirectory (good), but purpose should be documented.

---

## 5. Documentation Assessment

### 5.1 Documentation Locations

| Location | Content | Quality |
|----------|---------|---------|
| `README.md` | Project overview | Good |
| `ARCHITECTURE-REVIEW.md` | Code quality audit | Excellent |
| `.claude/CLAUDE.md` | E2E testing tenets | Excellent |
| `docs/ARCHITECTURE.md` | Plugin/MIDI architecture | Good |
| `docs/PROCESS.md` | Workflow documentation | Good |
| Module READMEs | Per-module docs | Variable |

### 5.2 E2E Test Documentation

**Strengths:**
- E2E testing tenets clearly documented in `.claude/CLAUDE.md`
- Hardware e2e architecture (heartbeat/watchdog) well documented
- Make targets documented

**Gaps:**
- No centralized `TESTING.md` or `docs/E2E-TESTING.md`
- Hardware e2e documentation only in `.claude/CLAUDE.md` (not discoverable)
- Test data requirements not documented
- Skip marker justifications not documented

### 5.3 Developer Discoverability

| Aspect | Status |
|--------|--------|
| Root README entry point | Present |
| Architecture docs | Well organized in `/docs/` |
| Module READMEs | Most modules have them |
| Test documentation | Scattered - needs consolidation |

---

## 6. Test Helper Infrastructure

### Existing Helpers (Good)

| Helper | Purpose |
|--------|---------|
| `connection-helper.ts` | Port selection, MIDI/OPFS connection |
| `opfs-helpers.ts` | Browser file operations, fixtures |
| `roundtrip-helpers.ts` | Device atomic round-trip pattern |
| `heartbeat-reporter.ts` | Watchdog heartbeat for stuck test detection |

### Patterns Observed

- Short test timeouts set per-test (`test.setTimeout(15_000)`)
- YAML content embedded for sampler data fixtures
- WAV file generation for audio fixtures (sine wave at 440Hz)
- Extensive console.log in helpers for debugging

---

## 7. Recommendations

### Critical (Address First)

| Priority | Issue | Action |
|----------|-------|--------|
| P0 | 5 disabled test suites | Complete or remove with tracking issue |
| P0 | 16 skipped akaitools tests | Add test data or document why tests are skipped |
| P1 | 6 placeholder test files | Add real tests or remove |
| P1 | disk-backup.test.ts TODO | Complete tests or track in issue |

### High Priority

| Priority | Issue | Action |
|----------|-------|--------|
| P2 | Test file size violations | Refactor large test files (>500 lines) |
| P2 | Missing centralized docs | Create `docs/TESTING.md` |
| P2 | Debug tests in main suite | Move to `debug/` directory |
| P2 | Import pattern violations | Enforce `@/` pattern in tests |

### Medium Priority

| Priority | Issue | Action |
|----------|-------|--------|
| P3 | Inconsistent skip documentation | Add comments explaining why tests are skipped |
| P3 | Test data requirements | Document test data setup procedures |
| P3 | Exploratory test purpose | Add README to exploratory directory |

---

## 8. Metrics Summary

| Metric | Count | Status |
|--------|-------|--------|
| Total test files | 210 | - |
| Disabled test suites | 5 | Needs attention |
| Skipped individual tests | 20+ | Needs attention |
| Placeholder test files | 6 | Needs attention |
| Test files >500 lines | 4 | Needs refactoring |
| Debug diagnostic files | 2 | Should be segregated |

---

## 9. Positive Findings

1. **Sophisticated hardware test infrastructure** - Heartbeat/watchdog system prevents stuck tests
2. **Clear testing tenets** - E2E principles documented in `.claude/CLAUDE.md`
3. **Atomic round-trip pattern** - Device tests follow Create→Import→Export→Compare flow
4. **Make targets for e2e** - Proper orchestration via `make test-e2e*`
5. **Test helpers well-organized** - Connection, OPFS, and roundtrip helpers
6. **Module test isolation** - Each module has own test directory
7. **Multiple Playwright configs** - Different configs for different test categories
8. **Real systems, no mocking** - E2E tests use real MIDI hardware and browser APIs

---

## Appendix: Files Requiring Attention

### Disabled Test Suites (describe.skip)

```
modules/sampler-devices/test/integration/s3000xl.test.ts
modules/launch-control-xl3/test/unit/LaunchControlXL3.test.ts
modules/launch-control-xl3/test/core/SysExParser.test.ts
modules/launch-control-xl3/test/integration/device.integration.test.ts
modules/launch-control-xl3/test/integration/slot-selection.hardware.test.ts
```

### Placeholder Test Files

```
modules/sampler-devices/test/unit/basic.test.ts
modules/sampler-lib/test/unit/basic.test.ts
modules/ardour-midi-maps/src/index.test.ts
modules/canonical-midi-maps/src/index.test.ts
modules/sampler-midi/test/unit/akai-s3000xl.test.ts
modules/sampler-backup/test/unit/disk-backup.test.ts
```

### Oversized Test Files

```
modules/roland-sxx0-editor/e2e/library-sets.spec.ts (1548 lines)
modules/roland-sxx0-editor/e2e/library-tones.spec.ts (1142 lines)
modules/roland-sxx0-editor/e2e/library-patches.spec.ts (1082 lines)
modules/roland-sxx0-editor/e2e/hardware-device-sets.spec.ts (846 lines)
```

### Debug/Diagnostic Files

```
modules/roland-sxx0-editor/e2e/standalone-debug.spec.ts
modules/roland-sxx0-editor/e2e/protocol-debug.spec.ts
```
