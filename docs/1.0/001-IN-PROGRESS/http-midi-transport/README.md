# HTTP MIDI Transport

**Status:** In Progress

## Documentation

- [PRD](./prd.md)
- [Workplan](./workplan.md)

## Overview

HTTP-based MIDI transport that bypasses Playwright's Web MIDI SysEx permission crash ([#29686](https://github.com/microsoft/playwright/issues/29686)). Uses an external midi-server process to handle MIDI communication, with SSE for real-time event streaming to the browser.

## Key Goals

1. **Enable hardware e2e tests** — Run against real Roland S-series hardware without Chrome crashes
2. **Event-driven architecture** — SSE for incoming messages (no polling)
3. **Dynamic port assignment** — OS-assigned ports for conflict-free test runs
4. **Interface compatibility** — Implements same `MidiTransport` interface as Web MIDI

## Technical Approach

- midi-server handles MIDI hardware communication
- Browser connects via HTTP/SSE instead of Web MIDI API
- URL parameter `?midi=http&midiServerPort=N` selects transport
- Runner script orchestrates midi-server + Playwright

## Repositories

| Repository | Changes |
|------------|---------|
| [midi-server](https://github.com/audiocontrol-org/midi-server) | Add SSE endpoint, dynamic port |
| audiocontrol (this repo) | HttpMidiTransport, E2E infrastructure |
