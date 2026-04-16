# E2E Testing

End-to-end testing methodology — Playwright and Node.js against real hardware.

> Part of the [Testing Architecture](TESTING.md). See also: [Unit Testing](TESTING-UNIT.md) | [UI Testing](TESTING-UI.md)

## Two E2E Test Modes

E2E tests come in two forms, each targeting a different layer:

| Mode | Tool | What it tests | When to use |
|------|------|---------------|-------------|
| **Browser** | Playwright | Full UI workflows against real app + hardware | UI interactions, OPFS storage, visual workflows |
| **Node CLI** | tsx | Device protocols directly via bridge API | Protocol encoding, SysEx round-trips, field-level read/write validation |

### Browser tests (Playwright)

Playwright tests drive the real web application in a real browser. They click buttons, fill forms, wait for UI state changes, and verify that complete workflows (connect to device, import a sample, export it back) produce correct results. These tests exercise the full stack: React components, state management, MIDI transport, and hardware.

```
Browser (Playwright) → Web App (Vite) → MIDI Transport → Hardware
```

Specs live in `test/e2e/*.spec.ts`. They use Playwright's `test` and `expect` APIs.

### Node CLI tests (tsx)

Node tests talk directly to the SCSI bridge HTTP API, bypassing the browser entirely. They send raw SysEx messages, read device headers, write individual fields, and verify byte-level round-trip correctness. These tests isolate the protocol/encoding layer from the UI.

```
Node.js (tsx) → SCSI Bridge HTTP API → S3000XL
```

The main entry point is `modules/e2e-infra/src/node/scsi-write-test.ts`. It includes test suites for connection, reads, writes, all-fields validation, SDS transfers, disk browsing, and more.

### Choosing between them

| Question | If yes → |
|----------|----------|
| Does the bug manifest in the UI? | Playwright |
| Is the bug in SysEx encoding or protocol handling? | Node CLI |
| Do you need to verify a field value round-trips correctly? | Node CLI |
| Do you need to verify a drag-drop workflow? | Playwright |
| Are you unsure which layer the bug is in? | Start with Node CLI to isolate |

**Isolate the layer first.** If a user reports "the device shows the wrong value after editing," write a Node CLI test that reads/writes the field directly. If that passes, the bug is in the UI state management, and you need a Playwright test. If it fails, the bug is in encoding, and the Node test is both the diagnostic and the regression test.

## Directory Structure

```
modules/<editor>/
  test/
    e2e/
      device-connected.spec.ts      # Playwright specs
      device-programs.spec.ts
      library-chopper-save.spec.ts
      scsi-connected.spec.ts
      helpers/
        sds-helpers.ts               # Shared test helpers
      fixtures/                      # Test data files
      reporters/
        heartbeat-reporter.ts        # Watchdog heartbeat

modules/e2e-infra/
  src/node/
    scsi-write-test.ts              # Node CLI test entry point
    lib/
      test-connection.ts            # Node test suites
      test-reads.ts
      test-writes.ts
      test-all-fields.ts
  helpers/
    connection-helper.ts            # Shared Playwright helpers
    library-ui-helpers.ts
    library-fixtures.ts
  scripts/
    run-and-watch.sh                # Test runner with log management
    run-scsi-midi-e2e.sh            # SCSI provisioning + Playwright
    run-scsi-node-e2e.sh            # SCSI provisioning + Node CLI
```

## Tenets

These principles are non-negotiable.

### 1. No mocking

E2E tests use real systems:
- **Real MIDI hardware** — tests run against actual Roland S-330/S-550 and Akai S3000XL devices
- **Real storage backends** — OPFS, local filesystem (not in-memory mocks)
- **Real browser APIs** — Web MIDI, File System Access API, OPFS
- **Real network** — HTTP MIDI transport to midi-server, SCSI bridge HTTP API

If a test cannot run without mocks, it belongs in unit tests or integration tests.

### 2. No workarounds or hacks

The goal is to **test the app for correctness**, not to make tests pass:
- **No query parameter shortcuts** — tests interact with the UI the same way users do
- **No bypassing permission flows** — if users must click a button, tests click that button
- **No special test modes** — the app under test is identical to what ships
- **No stubbing browser APIs** — use real APIs or skip the test

If a test requires a workaround, that indicates either a bug in the app, a missing feature, or a test that shouldn't be an e2e test.

### 3. Device tests must be atomic round trips

Tests that involve both the device and the library **must** follow this structure:

1. **Create** a known-good fixture in the library (e.g., OPFS)
2. **Import** the fixture TO the device — this must succeed first
3. **Export** the same object FROM the device back to the library
4. **Compare** the exported object against the original fixture
5. **Pass only** if the round trip produces the same object

Never test import or export in isolation against unknown device state. You cannot export what isn't on the device, and you cannot know what's on the device unless you put it there.

```
Library (fixture) ──import──► Device ──export──► Library (result)
       │                                              │
       └──────────── compare for equality ────────────┘
```

### 4. Adapt to device state

Never assume a blank device. Tests must:
- Query the device for current state (sample count, program count)
- Validate preconditions before running
- Adapt to the current memory layout
- Clean up after themselves when possible

### 5. Server ports are OS-assigned

Tests that start servers must **never hardcode a port**. Hardcoded ports kill running dev servers and create contention between parallel test runs.

Use Vite's `--port 0` flag — the OS assigns a free port, and the runner script parses it from the Vite log output. Pass the assigned port to test clients via environment variable (e.g., `E2E_PORT`).

**Pattern** (from `run-test-harness-e2e.sh`):
```bash
# Start Vite with OS-assigned port
pnpm vite --port 0 > "$VITE_LOG" 2>&1 &
VITE_PID=$!

# Parse assigned port from log output
PORT=$(grep -o 'https://localhost:[0-9]*' "$VITE_LOG" | head -1 | sed 's/.*://')

# Pass to test runner
E2E_PORT=$PORT npx playwright test
```

**Never:**
- Hardcode a port number in test setup
- Kill a port (`lsof -ti:PORT | xargs kill`) as test setup
- Use an environment variable workaround when the tool supports port 0 natively

### 6. Timeouts use exponential backoff

- **Initial timeout:** short (500ms–1s)
- **Backoff:** double each retry (1s → 2s → 4s → 8s)
- **Hard maximum:** absolute ceiling (30s for UI, 90s for device transfers)
- **Retry count:** bounded (max 5 retries)

Never use a single large timeout as the first attempt. A 60-second timeout that could have failed at 2 seconds wastes 58 seconds of feedback time.

## Running Tests

### Make targets

Always use Make targets. Never call tsx, npx, or scripts directly.

```bash
# Roland (Playwright)
make test-e2e-roland                  # All Roland e2e tests (UI + library, no device)
make test-e2e-roland-device           # Device tests (requires hardware + midi-server)
make test-e2e-roland-library          # Library tests (OPFS, no device)
make test-e2e-roland-ui               # UI navigation tests

# S3000XL (Playwright)
make test-e2e-s3k-device              # Device tests (requires hardware + midi-server)
make test-e2e-s3k-library             # Library tests (OPFS, no device)
make test-e2e-s3k-scsi                # SCSI tests (requires Pi + S3000XL)

# S3000XL (Node CLI)
make test-scsi-write-validation       # Protocol tests (requires Pi + S3000XL)
```

Pass arguments via `ARGS`:
```bash
make test-e2e-roland-device ARGS="--grep 'Tone Editor'"
make test-scsi-write-validation ARGS="--test writes --verbose"
E2E_DEVICE_TYPE=s550 make test-e2e-roland-device ARGS="--grep 'set round trip'"
```

### run-and-watch.sh

**Always use `run-and-watch.sh`** to run e2e Make targets. It wraps the make target with proper log management and completion detection.

```bash
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-roland-library
modules/e2e-infra/scripts/run-and-watch.sh test-scsi-write-validation 'ARGS=--test connect'
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-s3k-device-library 'ARGS=--grep "sample round trip"'
```

What it provides:
- **Timestamped log file** in `/tmp/e2e-logs/` for post-facto analysis
- **Exponential backoff polling** for process completion (1s, 2s, 4s, 8s, 16s, 30s)
- **Filtered progress output** — shows PASS/FAIL/ERROR/SUCCEED/Step lines on each poll
- **Immediate exit** when the test finishes — no wasted wait time
- **Hard timeout kill** if the test runs too long

Never:
- Use `sleep N` with a fixed duration to wait for tests
- Use `tail -f` without a completion check
- Run tests without capturing output to a log file

### Quick checks vs. test infrastructure

A single command to verify something against hardware is fine:

```bash
curl http://s3k.local:7033/status
ssh orion@s3k.local "cat /tmp/e2e-bridge.log | tail -5"
```

**The moment you need to do ANY of the following, stop — you are building infrastructure. Use the e2e test infra instead:**

- Install a tool
- Write a throwaway script or temp file
- Chain multiple SSH commands to start/stop daemons
- SCP binaries to the Pi manually
- Write more than one command to set up test conditions

If a test doesn't exist yet, **create it** — that's the deliverable, not a throwaway script.

## SCSI E2E Provisioning

SCSI-based tests use a shared provisioning pipeline managed by Make and shell scripts in `modules/e2e-infra/scripts/`. Never bypass this pipeline.

**Provisioning flow (handled automatically by Make targets):**

1. **Build ARM64 binaries** — `check-scsi-bridge` cross-compiles s2p and scsi-midi-bridge for the Pi via Docker
2. **Deploy to Pi** — runner scripts SCP binaries to `/tmp/s2p-midi` and `/tmp/e2e-scsi-midi-bridge`
3. **Start daemons** — s2p on port 6868 (sudo, NOPASSWD), bridge on port 7033
4. **Validate** — confirms S3000XL is reachable via bridge `/status` endpoint
5. **Run tests** — Playwright or tsx depending on the target
6. **Cleanup** — trap kills remote daemons on exit

**Runner scripts:**
- `run-scsi-midi-e2e.sh` — full provisioning + Playwright (used by `test-e2e-s3k-scsi`)
- `run-scsi-node-e2e.sh` — full provisioning + Node.js tsx (used by `test-scsi-write-validation`)

**When adding new SCSI e2e tests:** create a Make target that depends on `check-scsi-bridge`, sets the environment variables, and delegates to one of the shared runner scripts.

## Heartbeat/Watchdog System

Hardware tests use a heartbeat/watchdog system to detect stuck tests quickly.

```
┌─────────────────────────────────────────────────────────┐
│  Orchestrator (run-hardware-e2e.sh)                     │
│                                                         │
│  ┌─────────────────────┐    ┌────────────────────────┐ │
│  │  Test Runner        │    │  Watchdog Process      │ │
│  │  (Playwright)       │    │  (monitors heartbeat)  │ │
│  │                     │    │                        │ │
│  │  Custom Reporter ───┼──► │  Reads heartbeat file  │ │
│  │  writes heartbeat   │    │  every 500ms           │ │
│  │  on every step      │    │                        │ │
│  │                     │    │  Kills runner if       │ │
│  │                     │    │  heartbeat stale >5s   │ │
│  └─────────────────────┘    └────────────────────────┘ │
│                                                         │
│  Heartbeat file: /tmp/e2e-heartbeat-{pid}.json         │
│  { "timestamp": ..., "event": "stepBegin", ... }       │
└─────────────────────────────────────────────────────────┘
```

The heartbeat reporter (`test/e2e/reporters/heartbeat-reporter.ts`) writes a JSON file on every Playwright event. The watchdog polls it every 500ms and kills the runner if the heartbeat is stale for more than 5 seconds.

## Import Patterns

E2e specs import shared helpers from the `@audiocontrol/e2e-infra` package:

```typescript
// Good — workspace package import
import { connectToDevice } from '@audiocontrol/e2e-infra/helpers/connection-helper';

// Bad — relative path breaks when files move
import { connectToDevice } from '../../e2e-infra/helpers/connection-helper';
```

For local helpers within the same module, use relative imports within `test/e2e/`:

```typescript
import { prepareSdsFixture } from './helpers/sds-helpers';
```
