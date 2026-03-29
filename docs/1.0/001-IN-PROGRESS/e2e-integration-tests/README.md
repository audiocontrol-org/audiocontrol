# E2E Integration Tests

**Status:** In Progress

## Documentation

- [PRD](./prd.md)
- [Workplan](./workplan.md)
- [Testing Infrastructure Guide](./testing-infrastructure.md) - How to run tests, prerequisites, troubleshooting
- [Comprehensive Test Plan](./comprehensive-test-plan.md) - Full-coverage test matrix with 176 test cases
- [App Capabilities Audit](./app-capabilities-audit.md) - Application feature inventory
- [Existing Tests Audit](./existing-tests-audit.md) - Current test coverage analysis

## Overview

Comprehensive E2E integration test suite for the roland-sxx0-editor module, with emphasis on Library functionality testing. Includes automated browser permission handling for Web MIDI API and File System Access API, hardware-connected tests for device communication, and a documented catalog of features, scenarios, and corner cases.

## Current Status

### Test Coverage Summary

| Category | Tests | Covered | Gap |
|----------|-------|---------|-----|
| Total | 176 | 77 (44%) | 93 (53%) |
| P0 Critical | 42 | 29 (69%) | 10 (24%) |
| Hardware Required | 101 | 21 | 80 |
| UI Only | 75 | 62 | 13 |

### Implemented Infrastructure
- ✅ HTTP MIDI transport for automated hardware tests
- ✅ Device validation before test runs
- ✅ Heartbeat/watchdog for stuck test detection
- ✅ OPFS library tests (no permission prompts)
- ✅ Transport selection UI with persistence
- ✅ Test IDs on UI components

### Critical Gaps (P0 Not Tested)
1. Export tone/patch from device to library
2. Import tone/patch from library to device
3. Save device state as library set
4. Load library set to device
5. S-550 specific tests

## Quick Start

```bash
cd modules/roland-sxx0-editor

# UI tests (no hardware required)
pnpm test:e2e

# Library tests (OPFS)
./scripts/run-library-e2e.sh

# Hardware tests (requires midi-server + device)
./scripts/run-http-midi-e2e.sh
```

See [Testing Infrastructure Guide](./testing-infrastructure.md) for full details.

## Key Goals

1. **Automated browser permissions** — Tests run without manual intervention
2. **Library coverage** — Focus on the weakest part of the system
3. **Hardware integration** — Tests against real Roland S-330/S-550 devices
4. **Documented test catalog** — Clear visibility into what's tested and what's not

## Technical Approach

- HTTP MIDI transport bypasses Playwright Web MIDI crash
- Dynamic port assignment (`--port 0`) for all servers
- OPFS (Origin Private File System) for library storage — no permission prompts
- Device validation fails fast if no hardware connected
- Watchdog kills stuck tests after 5 seconds
