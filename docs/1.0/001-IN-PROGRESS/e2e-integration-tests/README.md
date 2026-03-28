# E2E Integration Tests

**Status:** In Progress

## Documentation

- [PRD](./prd.md)
- [Workplan](./workplan.md)

## Overview

Comprehensive e2e integration test suite for the roland-sxx0-editor module, with emphasis on Library functionality testing. Includes automated browser permission handling for Web MIDI API and File System Access API, hardware-connected tests for device communication, and a documented catalog of features, scenarios, and corner cases.

## Key Goals

1. **Automated browser permissions** — Tests run without manual intervention
2. **Library coverage** — Focus on the weakest part of the system
3. **Hardware integration** — Tests against real Roland S-330/S-550 devices
4. **Documented test catalog** — Clear visibility into what's tested and what's not

## Technical Approach

- Use existing port 0 infrastructure for dynamic server assignment
- Grant MIDI permissions via Playwright context config
- Use OPFS (Origin Private File System) for library storage — no permission prompts required
- Skip hardware tests gracefully when device unavailable
