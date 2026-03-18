# Standalone Hardware Device Platform

**Status:** Planning
**Feature Branch:** `feature/hardware-device-platform`
**GitHub Milestone:** TBD

## Overview

Turn the audiocontrol web editor stack into a standalone hardware device — a dedicated controller for vintage samplers and a self-contained sample chopper, running on a Raspberry Pi with a touchscreen.

The key architectural insight: the `midi-server` repo already solves the hard problem (reliable SysEx via JUCE over HTTP). This feature builds an `HttpMidiTransport` on top of it rather than introducing a second MIDI backend with known reliability issues.

## Documentation

- [PRD](./prd.md) - Product requirements, user stories, technical context
- [Workplan](./workplan.md) - Implementation phases, repo organization, transport strategy amendment

## Key Architecture Decisions

1. **`HttpMidiTransport` over `NodeMidiTransport`** — Uses existing midi-server (JUCE HTTP-to-MIDI bridge) instead of `node-midi`. Avoids known SysEx reliability issues in Node.js MIDI libraries.
2. **Hybrid repo split** — Interface implementations in audiocontrol monorepo, deployment artifacts in new `hardware-deploy` repo.
3. **Boot config over URL routing** — `HardwareBootConfig` JSON file replaces URL-based device resolution for hardware deployments.

## Repos Affected

| Repo | Changes |
|------|---------|
| `audiocontrol-org/audiocontrol` | New modules: `http-midi-transport`, `hardware-config`. Extensions to `editor-core` Tailwind preset |
| `audiocontrol-org/midi-server` | Phase 2: WebSocket upgrade for real-time SysEx (if polling latency insufficient) |
| `audiocontrol-org/hardware-deploy` | New repo: Electron shell, GPIO bridge, RPi setup, hardware build docs |

## Phases

| Phase | Location | Status |
|-------|----------|--------|
| 1. HttpMidiTransport | audiocontrol monorepo | Not Started |
| 2. HardwareBootConfig | audiocontrol monorepo | Not Started |
| 3. Kiosk Display Profiles | audiocontrol monorepo | Not Started |
| 4. Electron Shell | hardware-deploy repo | Not Started |
| 5. GPIO Input Bridge | hardware-deploy repo | Not Started |
| 6. Standalone Chopper | hardware-deploy repo | Not Started |
