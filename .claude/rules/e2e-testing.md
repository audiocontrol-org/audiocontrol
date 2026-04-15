---
paths:
  - "test/e2e/**"
  - "e2e/**"
  - "modules/e2e-infra/**"
  - "modules/roland-sxx0-editor/e2e/**"
  - "modules/roland-sxx0-editor/scripts/watchdog.ts"
  - "modules/roland-sxx0-editor/scripts/run-hardware-e2e.sh"
  - "modules/roland-sxx0-editor/playwright.hardware.config.ts"
  - "modules/akai-s3k-editor/e2e/**"
  - "Makefile"
---

# E2E Testing Tenets

E2E tests verify the application works correctly in real-world conditions. These principles are non-negotiable:

## 1. Use Make Targets with devenv

All e2e tests are invoked via `make test-e2e-*` targets. The Make targets handle everything:
- Bootstrapping devenv (auto-installed if missing)
- Building dependencies in correct order
- Cloning and building midi-server (auto-provisioned to `.deps/`)
- Installing Playwright browsers
- Setting environment variables
- Running tests inside the devenv environment

```bash
make test-e2e-roland-device           # Just run it — make handles the rest
```

### E2E Test Make Targets

Always use make targets to run e2e tests (not raw pnpm commands):

```bash
make test-e2e-roland                  # All Roland e2e tests (UI + library, no device)
make test-e2e-roland-device           # Roland device tests (requires hardware + midi-server)
make test-e2e-roland-library          # Roland library tests (OPFS, no device)
make test-e2e-roland-ui               # Roland UI navigation tests
make test-e2e-s3k-device              # S3000XL device tests (requires hardware + midi-server)
make test-e2e-s3k-scsi                # S3000XL SCSI tests (Playwright, requires Pi + S3000XL)
make test-scsi-write-validation       # SCSI write validation (Node.js CLI, requires Pi + S3000XL)
```

Pass arguments to test runners via ARGS:
```bash
make test-e2e-roland-device ARGS="--grep 'Tone Editor'"
E2E_DEVICE_TYPE=s550 make test-e2e-roland-device ARGS="--grep 'set round trip'"
make test-scsi-write-validation ARGS="--test writes --verbose"
```

### SCSI E2E Test Provisioning

SCSI-based e2e tests (both Playwright and Node.js CLI) use a shared provisioning pipeline managed by Make and shell scripts in `modules/e2e-infra/scripts/`. **Never bypass this pipeline by calling scripts directly.**

**Provisioning flow (handled automatically by Make targets):**

1. **Build ARM64 binaries** — `check-scsi-bridge` cross-compiles s2p (scsi2pi fork) and scsi-midi-bridge (Rust) for the Pi via Docker
2. **Deploy to Pi** — Runner scripts SCP binaries to `/tmp/s2p-midi` and `/tmp/e2e-scsi-midi-bridge` on the Pi
3. **Start daemons** — s2p on port 6868 (sudo, NOPASSWD), bridge on port 7033
4. **Validate** — Confirms S3000XL is reachable via bridge `/status` endpoint
5. **Run tests** — Playwright (browser) or tsx (Node.js CLI) depending on target
6. **Cleanup** — Trap kills remote daemons on exit

**Runner scripts in `modules/e2e-infra/scripts/`:**
- `run-scsi-midi-e2e.sh` — Full provisioning + Playwright (steps 1-6, used by `test-e2e-s3k-scsi`)
- `run-scsi-node-e2e.sh` — Full provisioning + Node.js tsx (steps 1-6, used by `test-scsi-write-validation`)

**Key variables (set by Make, consumed by runner scripts):**
- `S2P_BIN` — Path to cross-compiled s2p binary
- `SCSI_BRIDGE_BIN` — Path to cross-compiled scsi-midi-bridge binary
- `SCSI_PI_HOST` — Pi hostname (default: `s3k.local`)
- `SCSI_PI_USER` — Pi SSH user (default: `orion`)

**When adding new SCSI e2e tests:** Create a Make target that depends on `check-scsi-bridge`, sets the environment variables above, and delegates to one of the shared runner scripts. Do not build, deploy, or start daemons manually.

### Quick Check vs. Test Infrastructure

A single, simple command to verify something against hardware is fine — no ceremony needed:

```bash
# These are quick checks — OK to run ad-hoc
curl http://s3k.local:7033/status
ssh orion@s3k.local "cat /tmp/e2e-bridge.log | tail -5"
```

**The moment you need to do ANY of the following, stop. You are no longer doing a quick check — you are building infrastructure. Use the e2e test infra instead:**

- Install a tool (brew install, npm install, pip install)
- Write a throwaway script or temp file
- Chain multiple SSH commands to start/stop daemons
- SCP binaries to the Pi manually
- Wrestle with shell quoting or background process management
- Write more than one command to set up the test conditions

**Decision matrix:**

| What you're doing | Approach |
|---|---|
| Check if a service is up | `curl` one-liner — fine |
| Read a log file | `ssh ... cat/tail` — fine |
| Verify a code change against hardware | Create a test in `modules/e2e-infra/`, wire via Make target |
| Test a new protocol feature | Create a test in `modules/e2e-infra/`, wire via Make target |
| Deploy and restart daemons | `make deploy-scsi-bridge` |
| Run any multi-step hardware interaction | `make test-*` target delegating to a runner script |

The test infrastructure exists precisely so you don't reinvent it per-session. If a test doesn't exist yet, **create it** — that's the deliverable, not a throwaway script.

## 2. No Mocking

E2E tests must use real systems:
- **Real MIDI hardware** — Tests run against actual Roland S-330/S-550 devices
- **Real storage backends** — OPFS, local filesystem, or cloud storage (not in-memory mocks)
- **Real browser APIs** — Web MIDI, File System Access API, OPFS
- **Real network** — HTTP MIDI transport to midi-server

If a test cannot run without mocks, it belongs in unit tests or integration tests, not e2e tests.

## 3. No Workarounds or Hacks

The goal is to **test the app for correctness**, not to make tests pass:
- **No query parameter shortcuts** — Tests interact with the UI the same way users do
- **No bypassing permission flows** — If users must click a button, tests must click that button
- **No special test modes** — The app under test should be identical to production
- **No stubbing browser APIs** — Use real APIs or skip the test

If a test requires a workaround, that indicates either:
1. A bug in the app that should be fixed
2. A missing feature that should be built
3. A test that shouldn't be an e2e test

## 4. Device Tests Must Be Atomic Round Trips

Tests that involve both the device and the library **must** follow this structure:

1. **Create** a known-good fixture in the library (e.g., OPFS)
2. **Import** the fixture TO the device — this must succeed first
3. **Export** the same object FROM the device back to the library
4. **Compare** the exported object against the original fixture
5. **Pass only** if the round trip produces the same object

Never test import or export in isolation against unknown device state. You cannot export what isn't on the device, and you cannot know what's on the device unless you put it there. Only round-trip comparison is deterministic.

```
Library (fixture) ──import──► Device ──export──► Library (result)
       │                                              │
       └──────────── compare for equality ────────────┘
```

## 5. E2E Test Output and Observability

**Always use `run-and-watch.sh`** to run e2e tests. Never run make targets directly with ad-hoc sleep/tail patterns.

```bash
# Run any e2e make target with proper log management and completion detection
modules/e2e-infra/scripts/run-and-watch.sh test-scsi-sds-transfer 'ARGS=--test sds --verbose'
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-s3k-device-library 'ARGS=--grep "sample round trip"'
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-roland-library
```

`run-and-watch.sh` provides:
- Timestamped log file in `/tmp/e2e-logs/` for post-facto analysis
- Exponential backoff polling for process completion (1s, 2s, 4s, 8s, 16s, 30s)
- Filtered progress output (PASS/FAIL/ERROR/SUCCEED/Step lines) on each poll
- Immediate exit when the test finishes — no wasted wait time
- Hard timeout kill if the test runs too long

**Never:**
- Use `sleep N` with a fixed duration to wait for tests
- Use `tail -f` without a completion check
- Run tests without capturing output to a log file

## 6. Timeouts and Retries

Timeouts should **start small with exponential backoff** and a hard maximum:

- **Initial timeout:** Short (e.g., 500ms–1s)
- **Backoff:** Double each retry (1s → 2s → 4s → 8s)
- **Hard maximum:** Absolute ceiling (e.g., 30s for UI, 90s for device transfers)
- **Retry count:** Bounded (e.g., max 5 retries)

Never use a single large timeout as the first attempt. A 60-second timeout that could have failed at 2 seconds wastes 58 seconds of feedback time. Start fast, back off if needed.

## Hardware E2E Testing (roland-sxx0-editor)

The `roland-sxx0-editor` module includes hardware e2e tests that run against real Roland S-series samplers. These tests use a heartbeat/watchdog system to detect stuck tests quickly.

### Heartbeat/Watchdog Architecture

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
│  { "timestamp": 1234567890, "event": "stepBegin", ... } │
└─────────────────────────────────────────────────────────┘
```

### How It Works

1. **Heartbeat Reporter** (`e2e/reporters/heartbeat-reporter.ts`): Custom Playwright reporter that writes a JSON heartbeat file on every test event (`onTestBegin`, `onTestEnd`, `onStepBegin`, `onStepEnd`). The heartbeat includes the current timestamp, event type, and description.

2. **Watchdog Process** (`scripts/watchdog.ts`): Background process that polls the heartbeat file every 500ms. If the heartbeat timestamp is older than 5 seconds, the watchdog kills the Playwright runner process with SIGKILL and exits with code 1.

3. **Orchestrator** (`scripts/run-hardware-e2e.sh`): Shell script that starts Vite, Playwright, and the watchdog. It captures exit codes and reports when a stuck test is detected.

### 5-Second Threshold

The watchdog uses a 5-second stale threshold. If a test step takes longer than 5 seconds without producing a new heartbeat event, the test is considered stuck and terminated. This threshold is intentionally short to fail fast during hardware tests where hanging usually indicates a real problem (e.g., MIDI communication failure).

### Running Hardware E2E Tests

```bash
devenv shell
make test-e2e-hardware
```

Prerequisites:
- Running inside devenv shell
- Roland S-330 or S-550 connected via MIDI
- MIDI interface available

### File Locations

- **Reporter**: `modules/roland-sxx0-editor/e2e/reporters/heartbeat-reporter.ts`
- **Watchdog**: `modules/roland-sxx0-editor/scripts/watchdog.ts`
- **Runner**: `modules/roland-sxx0-editor/scripts/run-hardware-e2e.sh`
- **Config**: `modules/roland-sxx0-editor/playwright.hardware.config.ts`
