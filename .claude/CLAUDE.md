# audiocontrol

TypeScript monorepo for audio device control, MIDI communication, and web-based editors for vintage samplers and synthesizers. Uses pnpm workspaces with Vitest for testing.

## Project Structure

```text
audiocontrol/
├── modules/
│   ├── s330-editor/          # Web editor for Roland S-330 sampler (React)
│   ├── sampler-devices/      # Device communication layer
│   ├── sampler-midi/         # MIDI SysEx protocol implementations
│   ├── sampler-lib/          # Shared sampler data structures
│   ├── sampler-backup/       # Sampler backup/restore utilities
│   ├── sampler-export/       # Audio export from sampler data
│   ├── sampler-translate/    # Cross-format translation
│   ├── ardour-midi-maps/     # Ardour DAW MIDI map generation
│   ├── canonical-midi-maps/  # DAW-agnostic MIDI mapping format
│   ├── launch-control-xl3/   # Novation Launch Control XL3 support
│   ├── audiotools-cli/       # CLI tooling
│   ├── audiotools-config/    # Shared configuration
│   ├── controller-workflow/  # Controller workflow management
│   ├── lib-device-uuid/      # Device UUID generation
│   ├── lib-runtime/          # Runtime utilities
│   ├── live-max-cc-router/   # Ableton Live Max CC routing
│   └── sampler-attic/        # Archived/deprecated sampler code
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

## Core Requirements

### Import Pattern

Always use the `@/` import pattern for internal modules:

```typescript
import { SomeType } from '@/types/some-type';
import { someUtil } from '@/utils/some-util';
```

### Error Handling

Never implement fallbacks or use mock data outside of test code. Throw errors with descriptive messages instead. Errors let us know something isn't implemented. Fallbacks and mock data are bug factories.

```typescript
// Good
if (!midiPort) {
  throw new Error('MIDI port is required but not available');
}

// Bad — never do this
const port = midiPort || createMockPort();
```

### TypeScript

- Strict mode required
- Interface-first design — define contracts across boundaries
- Composition over inheritance — no class inheritance hierarchies
- Dependency injection — constructor injection with interface types
- Avoid `any` — use `unknown` with type guards
- Never stub modules — use dependency injection for testability

### Multi-Device Architecture

Never use conditionals in UI components to switch behavior based on device configuration (e.g., `if (deviceType === 's550')`, `if (waveBankCount > 2)`). Instead, use context-specific factory methods that return implementations of interfaces with device-dependent behavior composed in at creation time. The UI calls interface methods without knowing which device is active.

- **Factories, not conditionals** — device-specific logic belongs in factory-created implementations, not scattered across UI components
- **DRY behind interfaces** — common logic is shared via composition; device-specific logic is injected at object creation
- **No inheritance** — use composition to build device-specific implementations from shared parts
- **UI is device-agnostic** — components render what interfaces provide; they never branch on device type

### Code Quality

- Files must be under 300-500 lines — refactor larger files
- Unit tests for all public functions (Vitest)
- High test coverage — aim for 80%+
- All code must be unit testable via dependency injection
- **Guideline deviations must be documented in situ** — if a technical constraint forces you to break a project convention (e.g., a relative import where `@/` is the rule), add a comment at the deviation site explaining *what* rule is being broken, *why* it's necessary, and that it should not be copied elsewhere. Unexplained deviations are nucleation sites for bad practices.

### Repository Hygiene

- Build artifacts only in `dist/`
- Never bypass pre-commit or pre-push hooks — fix issues instead
- Never commit temporary files, logs, or generated artifacts
- Use `pnpm` for all package operations
- Use `tsx` for running TypeScript (not `ts-node`)

## Sub-Agent Delegation

Delegate to sub-agents proactively — don't wait for the user to ask. The main agent should orchestrate; sub-agents should do the work.

### When to delegate

- **Research and investigation** — understanding component structure, tracing data flow, reading multiple files to answer a question
- **Debugging** — diagnosing test failures, checking conditions across files, reading error screenshots and context
- **Implementation** — making code changes across multiple files for a well-defined task
- **Running tests** — executing test suites and reporting results

### How to delegate

- **Sub-agents research, main agent executes.** For code changes, have the sub-agent investigate and propose, then the main agent reviews and applies the changes. This keeps the user in the loop.
- **Give complete context.** Sub-agents don't see prior conversation. Include the problem statement, relevant file paths, what's already been tried, and what output you need.
- **Instruct agents to write to disk.** Agents often fail to persist their work. Always tell them to use the Write or Edit tool when they need to produce files.
- **Run multiple agents in parallel** when tasks are independent.
- **Don't duplicate work.** If you delegate research, don't also do the same searches yourself.

### What NOT to delegate

- Simple single-file reads or grep searches — use the tools directly
- Git operations (commit, push, branch) — do these directly
- Decisions that need user input — ask the user directly

## Monorepo Conventions

- Each module is self-contained with clear boundaries
- Shared types go in dedicated packages
- Use `workspace:*` protocol for internal dependencies

## MIDI/Audio Guidelines

- Follow MIDI specification standards
- Support both 7-bit and 14-bit CC values
- Handle NRPN/RPN parameters correctly
- Real-time audio code must be allocation-free
- Respect MIDI clock and timing constraints
- Preserve proprietary sampler format specifications exactly
- Use the `midisnoop` binary (installed in PATH) to observe MIDI conversations

## S3000XL SysEx Exclusive Channel

The `cc` byte in Akai SysEx messages (`F0 47 cc ...`) is the **exclusive channel**, NOT the MIDI channel. It's an Akai-specific control address that selects which device responds to SysEx commands. This allows independent control of multiple Akai devices on the same SCSI bus (e.g., S3000XL at SCSI ID 6 on exclusive channel 0, S5000 at SCSI ID 5 on exclusive channel 1).

- Stored in MiscellaneousData as `EXCHAN` (0-based in protocol, 1-based on front panel UI)
- Default: 0 (displayed as "1" on the device)
- **Do not write EXCHAN via SysEx without immediate restore** — changing it mid-session causes the device to stop responding on the original channel
- The `--channel` CLI argument sets this exclusive channel, not the MIDI playback channel

## S3000XL SDS Storage Behavior

The S3000XL uses the SDS sample number in the Dump Header to determine overwrite vs create: if the number matches an existing sample's RSLIST index, the device overwrites that sample in place. If the number doesn't match, a new sample is created at the end of the RSLIST. To replace a sample, send with its RSLIST index. To add a new sample, send with an unused number (e.g., current sample count). Confirmed via hardware testing.

## URL Convention for Editors

Editors are served under audiocontrol.org:

```
https://audiocontrol.org/<manufacturer>/<device>/editor
```

Example: `https://audiocontrol.org/roland/s330/editor`

## Build System

The repo uses a `Makefile` at the root to build modules in topological order. Each module gets a stamp file (`.build-stamp`) whose prerequisites encode the dependency graph. `pnpm install` runs automatically when `pnpm-lock.yaml` is newer than the install stamp.

```bash
make                                 # Install deps + build all modules in dependency order
make clean                           # Remove all dist/ dirs and stamp files
make clean && make                   # Full rebuild from scratch
make modules/sampler-devices/.build-stamp  # Build one module (and its deps)
```

`pnpm -r build` still works but does **not** enforce build order — use `make` instead.

## Deployment

Web editors are deployed on Netlify. Each editor has its own Netlify site with per-site configuration.

### Netlify Sites

| Site | URL | Deploy Branch | Publish Directory |
|------|-----|---------------|-------------------|
| `roland-sxx0-editor` | https://roland-sxx0-editor.netlify.app | `deploy/roland-sxx0-editor` | `modules/roland-sxx0-editor/dist` |

### Deploying an Editor

To deploy the latest main to an editor:

```bash
git fetch origin main
git push origin origin/main:refs/heads/deploy/roland-sxx0-editor --force
```

### Netlify Configuration

Each site's config lives in `netlify/<site-name>/`:

```
netlify/
└── roland-sxx0-editor/
    ├── _redirects    # SPA routing
    └── _headers      # Security/cache headers
```

These files are copied to the publish directory during build. All sites use:
- **Build command:** `make`
- **Base directory:** repo root

### Other Commands

```bash
pnpm install                         # Install dependencies (make does this automatically)
pnpm test                            # Run all tests
pnpm --filter <module> test          # Test specific module
```

## Documentation Standards

- Don't call what you have built "production-ready"
- Never specify project management goals in temporal terms — use milestone, sprint, phase
- Never offer baseless projection statistics
- Use GitHub links (not file paths) in issue descriptions
- See [PROJECT-MANAGEMENT.md](./PROJECT-MANAGEMENT.md) for project management standards

## Critical Don'ts

- Never implement fallbacks or mock data outside test code
- Never stub modules — use dependency injection
- Never bypass pre-commit/pre-push hooks
- Never use relative imports — use `@/` pattern
- Never create files larger than 500 lines
- Never commit temporary files or build artifacts
- Never add Claude attribution to git commits or pull requests
- Never use `ts-node` — use `tsx`
- Never call builds "production-ready"
- Never build ad-hoc infrastructure to test against hardware — use the e2e test infra (see "Quick Check vs. Test Infrastructure" below)

## E2E Testing Tenets

E2E tests verify the application works correctly in real-world conditions. These principles are non-negotiable:

### 1. Use Make Targets with devenv

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

### 2. No Mocking

E2E tests must use real systems:
- **Real MIDI hardware** — Tests run against actual Roland S-330/S-550 devices
- **Real storage backends** — OPFS, local filesystem, or cloud storage (not in-memory mocks)
- **Real browser APIs** — Web MIDI, File System Access API, OPFS
- **Real network** — HTTP MIDI transport to midi-server

If a test cannot run without mocks, it belongs in unit tests or integration tests, not e2e tests.

### 3. No Workarounds or Hacks

The goal is to **test the app for correctness**, not to make tests pass:
- **No query parameter shortcuts** — Tests interact with the UI the same way users do
- **No bypassing permission flows** — If users must click a button, tests must click that button
- **No special test modes** — The app under test should be identical to production
- **No stubbing browser APIs** — Use real APIs or skip the test

If a test requires a workaround, that indicates either:
1. A bug in the app that should be fixed
2. A missing feature that should be built
3. A test that shouldn't be an e2e test

### 4. Device Tests Must Be Atomic Round Trips

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
