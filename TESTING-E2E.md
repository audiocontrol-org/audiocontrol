# E2E Testing

End-to-end testing methodology -- Playwright against real hardware.

> Part of the [Testing Architecture](TESTING.md). See also: [Unit Testing](TESTING-UNIT.md) | [UI Testing](TESTING-UI.md)

**Status: To be documented.**

Detailed E2E testing tenets currently live in the project's `CLAUDE.md` under "E2E Testing Tenets" and related sections. Those should be consolidated here when this document is backfilled.

## Topics to Cover

- Hardware prerequisites (MIDI devices, SCSI bridges, Pi setup)
- Make targets and how to run tests (`make test-e2e-*`)
- Runner scripts in `modules/e2e-infra/scripts/`
- Heartbeat/watchdog system for stuck test detection
- Atomic round-trip testing pattern (import, export, compare)
- SCSI provisioning pipeline (build, deploy, start, validate, test, cleanup)
- `run-and-watch.sh` usage for test execution and observability
- Timeout and retry strategy (exponential backoff)
- No mocking, no workarounds, no special test modes
- Device state adaptation (query device, validate preconditions)

## Migration Note

Existing E2E tests live in `modules/<editor>/e2e/`. These need migration to `test/e2e/` under each module. New E2E tests should be written in the target location.

## Existing Documentation

The following sections in `CLAUDE.md` contain E2E testing rules that will be consolidated here:

- E2E Testing Tenets (sections 1-6)
- Hardware E2E Testing (heartbeat/watchdog architecture)
- E2E Test Make Targets
- SCSI E2E Test Provisioning
- Quick Check vs. Test Infrastructure
