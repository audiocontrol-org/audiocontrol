# HttpMidiTransport

**Status:** Planning
**Phase:** H1 (Hardware Platform Track)
**Branch:** `feature/http-midi-transport`

---

## Overview

`HttpMidiTransport` is a `MidiTransport` implementation that communicates with [midi-server](https://github.com/audiocontrol-org/midi-server) over HTTP, enabling reliable SysEx communication in non-browser environments (Electron on RPi, Node.js scripts, integration tests).

## Documentation

- [PRD](./prd.md) --- problem statement, user stories, success criteria, scope
- [Workplan](./workplan.md) --- implementation phases, task breakdown, GitHub tracking
- [Implementation Summary](./implementation-summary.md) --- post-completion report (draft)

## GitHub Tracking

- **Milestone:** TBD
- **Parent Issue:** TBD

## Module Location

`modules/http-midi-transport/` in the audiocontrol monorepo.

Package: `@audiocontrol/http-midi-transport`

## Dependencies

- [midi-server](https://github.com/audiocontrol-org/midi-server) --- C++/JUCE HTTP-to-MIDI bridge (external, already exists)
- `@audiocontrol/editor-core` --- `MidiTransport` interface definition
- `@audiocontrol/shared-midi` --- `MidiIO`, `MidiPortInfo`, `SysExCallback` types

## Unblocks

- [`hardware-boot-config`](../ROADMAP.md) --- JSON boot config for non-browser device startup
- Any non-browser environment needing reliable SysEx via midi-server
