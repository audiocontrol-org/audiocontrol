# Testing Architecture

This monorepo uses three test categories, each with distinct tooling, scope, and requirements.

## Test Categories

| Category | Tool | Environment | Hardware | Purpose |
|----------|------|-------------|----------|---------|
| **Unit** | Vitest + jsdom + React Testing Library | Node.js (jsdom) | None | Logic, transforms, component rendering |
| **UI** | Playwright | Browser against test harness pages | None | Visual correctness, drag interactions, layout |
| **E2E** | Playwright | Browser against real app | MIDI devices, SCSI bridges | Full-stack round-trip verification |

### Unit Tests

Fast, isolated tests for pure logic, data transforms, React component rendering, and hook behavior. Run in jsdom with no browser, no network, no hardware.

See [TESTING-UNIT.md](TESTING-UNIT.md) for methodology.

### UI Tests

Playwright tests against **test harness pages** -- standalone routes that render real components with factory data and local state. No store, no device connection, no transport. Tests verify visual rendering, drag interactions, zoom, selection, and layout correctness.

See [TESTING-UI.md](TESTING-UI.md) for methodology.

### E2E Tests

Playwright tests against the **real application** with **real hardware** (Roland S-330/S-550 via MIDI, Akai S3000XL via SCSI). Tests verify complete workflows including device communication, data transfer, and round-trip integrity.

See [TESTING-E2E.md](TESTING-E2E.md) for methodology.

## Standard Directory Structure

Every editor module follows this layout:

```
modules/<editor>/
  src/
    pages/
      Test<Feature>Page.tsx        # Test harness pages (UI tests)
    test-helpers/
      <thing>-factory.ts           # Shared factory helpers
  test/
    unit/                          # Vitest specs
    ui/                            # Playwright specs against test harness pages
    e2e/                           # Playwright specs against real app + hardware
  playwright.test-harness.config.ts  # Playwright config for UI tests
  playwright.hardware.config.ts      # Playwright config for E2E tests
  vitest.config.ts                   # Vitest config for unit tests
```

## When to Use Which Category

| Scenario | Category | Why |
|----------|----------|-----|
| Testing a data transform or utility function | Unit | Pure logic, no DOM needed |
| Testing a React component renders correctly | Unit | jsdom is sufficient for render assertions |
| Testing drag-and-drop visual behavior | UI | Needs a real browser and pixel-level layout |
| Testing zoom, scroll, or pointer interactions | UI | Needs real browser event handling |
| Verifying component alignment across views | UI | Visual correctness requires rendering |
| Testing MIDI SysEx round-trip with a device | E2E | Requires hardware |
| Testing sample upload/download workflow | E2E | Requires device + transport |
| Testing OPFS library operations in browser | E2E | Requires real browser storage APIs |

**Rule of thumb:** If it needs a browser, use UI or E2E. If it needs hardware, use E2E. Otherwise, use unit.

## Running Tests

```bash
# Unit tests
pnpm test                              # All unit tests across monorepo
pnpm --filter <module> test            # Unit tests for one module

# UI tests
make test-ui-s3k                       # UI tests for akai-s3k-editor

# E2E tests (see TESTING-E2E.md for hardware prerequisites)
make test-e2e-roland-device            # Roland device tests
make test-e2e-s3k-device               # S3000XL device tests
make test-e2e-s3k-scsi                 # S3000XL SCSI tests
```

## Current State and Migration

The target directory structure (`test/unit/`, `test/ui/`, `test/e2e/`) is new. Existing tests live in legacy locations:

| What | Current location | Target location |
|------|-----------------|-----------------|
| Unit tests | `src/**/*.test.tsx` (co-located with source) | `test/unit/` |
| UI test specs | `e2e/test-harness-*.spec.ts` | `test/ui/` |
| E2E test specs | `e2e/` directory | `test/e2e/` |

Migration is tracked separately. New tests should be written in the target locations. Existing tests will be moved incrementally.
