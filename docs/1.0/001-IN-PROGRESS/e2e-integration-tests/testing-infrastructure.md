# E2E Testing Infrastructure Guide

**Updated:** 2026-03-29

## Overview

The roland-sxx0-editor module has comprehensive E2E testing infrastructure supporting multiple test types:

| Test Type | Transport | Hardware | Script |
|-----------|-----------|----------|--------|
| UI/Navigation | None | No | `pnpm test:e2e` |
| Library (OPFS) | Browser Storage | No | `./scripts/run-library-e2e.sh` |
| Sample Editor | Mock Library | No | `./scripts/run-sample-editor-e2e.sh` |
| Loop Editor | Mock Library | No | `./scripts/run-loop-editor-e2e.sh` |
| Sample Chopper | Mock Library | No | `./scripts/run-sample-chopper-e2e.sh` |
| Hardware (HTTP) | HTTP MIDI | Yes | `./scripts/run-http-midi-e2e.sh` |
| Hardware (Web) | Web MIDI | Yes | `./scripts/run-hardware-e2e.sh` |

## Prerequisites

### For All Tests
```bash
# Install dependencies
pnpm install

# Install Playwright browsers
npx playwright install
```

### For Hardware Tests
1. **midi-server binary** - Build from https://github.com/audiocontrol-org/midi-server
2. **Roland S-330 or S-550** - Connected via MIDI interface
3. **MIDI cables** - Both IN and OUT connected
4. **Device powered on**

### devenv Setup (Recommended)

devenv provides a declarative development environment with Nix:

```bash
# Install Nix (if not installed)
curl -L https://nixos.org/nix/install | sh

# Install devenv
nix-env -if https://github.com/cachix/devenv/tarball/latest

# Enter devenv shell
cd /path/to/audiocontrol-test-e2e
devenv shell
```

The devenv shell provides:
- Node.js 22
- pnpm
- Playwright browsers location configured
- Environment ready for testing

## Running Tests

### Quick Start

```bash
cd modules/roland-sxx0-editor

# UI tests (no hardware)
pnpm test:e2e

# Library tests (OPFS)
./scripts/run-library-e2e.sh

# Hardware tests (requires device)
./scripts/run-http-midi-e2e.sh
```

### HTTP MIDI Hardware Tests

The recommended way to run hardware tests:

```bash
./scripts/run-http-midi-e2e.sh [playwright args...]
```

What this script does:
1. **Validates device** - Runs `validate-device.ts` to find Roland device
2. **Starts midi-server** - On dynamic port, captures port number
3. **Starts Vite** - Dev server on dynamic port
4. **Runs Playwright** - With watchdog for stuck test detection

Environment variables set:
- `E2E_VITE_PORT` - Vite server port
- `E2E_MIDI_SERVER_PORT` - midi-server HTTP port
- `E2E_MIDI_INPUT_PORT` - Discovered MIDI input port name
- `E2E_MIDI_OUTPUT_PORT` - Discovered MIDI output port name
- `E2E_DEVICE_ID` - Roland device ID (0-16)

### Web MIDI Hardware Tests

For interactive debugging with browser MIDI permissions:

```bash
./scripts/run-hardware-e2e.sh
```

**Note:** Requires manual permission grant on first run.

## Test Architecture

### Heartbeat/Watchdog System

Hardware tests use a heartbeat system to detect stuck tests:

```
┌─────────────────────────────────────────────────────┐
│  Orchestrator (run-http-midi-e2e.sh)                │
│                                                     │
│  ┌─────────────────┐    ┌──────────────────────┐   │
│  │  Playwright     │    │  Watchdog (watchdog.ts) │
│  │  Test Runner    │    │                      │   │
│  │                 │    │  Polls heartbeat     │   │
│  │  Heartbeat      │───►│  every 500ms         │   │
│  │  Reporter       │    │                      │   │
│  │  writes JSON    │    │  Kills if stale >5s  │   │
│  └─────────────────┘    └──────────────────────┘   │
│                                                     │
│  Heartbeat file: /tmp/e2e-heartbeat-{pid}.json     │
└─────────────────────────────────────────────────────┘
```

### Transport Selection

The app supports multiple MIDI transports:

| Transport | URL Params | Use Case |
|-----------|------------|----------|
| Web MIDI | (none) | Production, manual testing |
| HTTP MIDI | `?midi=http&midiServerPort=N` | Automated E2E tests |
| Mock MIDI | `?midi=mock` | Screenshots, UI tests |

Transport can also be selected in the UI via "Advanced Settings" on the connection page. Selection persists to localStorage.

## Playwright Configurations

| Config | Purpose |
|--------|---------|
| `playwright.config.ts` | Default browser tests |
| `playwright.http-midi.config.ts` | HTTP MIDI hardware tests |
| `playwright.hardware.config.ts` | Web MIDI hardware tests |
| `playwright.library.config.ts` | OPFS library tests |
| `playwright.sample-editor.config.ts` | Sample editor tests |
| `playwright.loop-editor.config.ts` | Loop editor tests |
| `playwright.sample-chopper.config.ts` | Sample chopper tests |
| `playwright.visual.config.ts` | Visual regression tests |

## Test Files

```
e2e/
├── app.spec.ts                    # Basic navigation tests
├── hardware-device.spec.ts        # HTTP MIDI transport tests
├── hardware-connected.spec.ts     # App UI with device
├── library-opfs.spec.ts           # OPFS operations
├── library-directories.spec.ts    # Directory CRUD
├── library-tones.spec.ts          # Tone CRUD
├── library-patches.spec.ts        # Patch CRUD
├── library-sets.spec.ts           # Set CRUD
├── loop-editor-production.spec.ts # Loop editor UI
├── sample-editor-production.spec.ts # Sample editor UI
├── sample-chopper-production.spec.ts # Sample chopper UI
├── fixtures/                      # Test data
│   ├── tones/
│   ├── patches/
│   └── sets/
├── helpers/
│   └── opfs-helpers.ts            # OPFS utilities
└── reporters/
    └── heartbeat-reporter.ts      # Watchdog heartbeat
```

## Troubleshooting

### "No Roland S-series device found"

1. Check device is powered on
2. Verify MIDI cables are connected (both IN and OUT)
3. Check MIDI interface is recognized: `midi-server --list` or system MIDI settings

### "midi-server not found"

Set the path explicitly:
```bash
export MIDI_SERVER_BIN=/path/to/MidiHttpServer
./scripts/run-http-midi-e2e.sh
```

Or add to PATH:
```bash
export PATH="/path/to/midi-server/build:$PATH"
```

### "Failed to detect midi-server port"

Check midi-server output manually:
```bash
midi-server --port 0
# Should output: {"port": N, "status": "ready"}
```

### Tests Hang / Watchdog Kills

The watchdog kills tests after 5 seconds of no heartbeat. Common causes:
- Device not responding to SysEx
- Wrong MIDI port selected
- Device in wrong mode

Check the heartbeat file for last event:
```bash
cat /tmp/e2e-heartbeat-*.json
```

### MIDI Permission Denied (Web MIDI)

For Web MIDI tests, grant SysEx permission:
1. Run test once - permission dialog appears
2. Click "Allow"
3. Permission is cached in `.playwright-chrome-data`

## CI/CD Integration

### Running in CI

Hardware tests should be skipped in CI without hardware:

```bash
# Check if hardware available
if ./scripts/validate-device.ts; then
  ./scripts/run-http-midi-e2e.sh
else
  echo "Skipping hardware tests - no device"
fi
```

### Non-Hardware Tests in CI

```bash
# These work without hardware
pnpm test:e2e
./scripts/run-library-e2e.sh
./scripts/run-sample-editor-e2e.sh
./scripts/run-loop-editor-e2e.sh
./scripts/run-sample-chopper-e2e.sh
```

## Adding New Tests

### Non-Hardware Test

1. Create `e2e/my-feature.spec.ts`
2. Add to appropriate Playwright config
3. Run with `npx playwright test my-feature`

### Hardware Test

1. Add tests to `e2e/hardware-connected.spec.ts`
2. Use `buildUrl()` helper for transport-agnostic URLs
3. Use `connectToDevice()` helper for connection
4. Run with `./scripts/run-http-midi-e2e.sh`

### Adding Test IDs

When UI components need test IDs:
```tsx
<button data-testid="my-button">Click</button>
```

Naming convention:
- `{component}-{index}` for lists: `tone-item-0`
- `{feature}-{action}` for buttons: `connect-button`
- `param-{label}` for parameters: `param-volume`
