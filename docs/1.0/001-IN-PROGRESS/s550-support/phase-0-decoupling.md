---
title: "Phase 0: Frontend/Backend Decoupling — Automated QA Foundation"
parent: "Roland S-550 Editor Support"
---

# Phase 0: Frontend/Backend Decoupling — Automated QA Foundation

**Status:** Not Started

**Should have come first.** This phase is numbered Phase 0 retroactively — it is the foundation that would have been built before any redesign work if we had recognized the need earlier. Phase 9 visual polish is **blocked on this foundation**.

## Why

The editor's UI talks to the SysEx backend through `SamplerClientInterface` (already defined at `modules/sampler-devices/src/devices/roland-s-series/s-series-client.ts:172`), but every UI iteration today requires:

- Real S-550 hardware connected via MIDI
- A browser session with Web MIDI permissions
- The operator clicking through scenarios manually to verify behavior

This makes redesign untenable. The operator has flagged this directly: *"It's hard for me to do QA while the UI is a mess."*

The fix is to record how the device actually behaves once per scenario, then replay those recordings into the UI for hardware-free, deterministic, CI-runnable UI tests.

## Architecture

```
┌──────────────────┐                    ┌──────────────────┐
│   UI / Pages     │                    │   UI / Pages     │
│   Hooks          │                    │   Hooks          │
└────────┬─────────┘                    └────────┬─────────┘
         │ SamplerClientInterface                │ SamplerClientInterface
         │ (the contract — already exists)       │ (same contract)
         ▼                                       ▼
┌──────────────────┐                    ┌──────────────────┐
│ RealSamplerClient│                    │ SimulatedSampler │
│  (Web MIDI →     │                    │ Client           │
│   device)        │                    │ (replay fixtures)│
└────────┬─────────┘                    └────────▲─────────┘
         │                                       │ reads
         ▼ wraps with (CLI only)                 │
┌──────────────────┐                    ┌──────────────────┐
│ RecordingProxy   │ records every      │ Fixtures         │
│ Client           ├───────────────────▶│ (NDJSON per      │
│ (transparent)    │ request/response   │  scenario)       │
└────────┬─────────┘                    └──────────────────┘
         │
         ▼
   real S-550 hardware
   (one capture session per scenario)
```

## Module Layout

| Piece | Location | Status |
|---|---|---|
| `SamplerClientInterface` | `modules/sampler-devices/src/devices/roland-s-series/s-series-client.ts:172` | **Exists** — audit for completeness in Task 1 |
| Fixture schema (`FixtureRecord`) | `modules/sampler-devices/src/recording/fixture-schema.ts` | New |
| `RecordingProxyClient` | `modules/sampler-devices/src/recording/recording-proxy.ts` | New |
| `SimulatedSamplerClient` | `modules/sampler-devices/src/simulation/simulated-client.ts` | New |
| Captured fixtures | `modules/sampler-devices/test/fixtures/s550/<scenario>.ndjson` | New (data) |
| CLI scenario runner | `modules/e2e-infra/src/node/lib/record-fixtures-roland.ts` | New |
| Make targets | `Makefile` | Augment |
| Editor test harness page | `modules/roland-sxx0-editor/src/pages/TestHarnessPage.tsx` | New |
| Playwright UI specs | `modules/roland-sxx0-editor/test/ui/<page>.spec.ts` | New |

**Reuses existing infrastructure** (do not reinvent):
- `modules/e2e-infra/` — shared test infra, already has `easymidi` + `@playwright/test` + `sampler-devices` wired up
- `midi-server` HTTP MIDI bridge — used by `make test-e2e-roland-device` today; the CLI runner connects through it
- `playwright.test-harness.config.ts` — already points at `modules/roland-sxx0-editor/test/ui/`
- `make test-ui-roland` — already wired target; UI specs land into it

## Tasks

### Task 1 — Audit `SamplerClientInterface` for contract completeness

Verify every operation the UI hooks call goes through the interface. Find any direct device access that bypasses the contract (no module should construct its own SysEx and write to a MIDI adapter — everything goes through the client interface).

**Files to audit:**
- All hooks in `modules/roland-sxx0-editor/src/hooks/`
- All pages in `modules/roland-sxx0-editor/src/pages/`
- Any direct `midiAdapter.send(...)` in editor code

**Acceptance criteria:**
- [ ] All editor-side device communication goes through `SamplerClientInterface` (or its `S330ClientInterface` extension)
- [ ] Any direct `midiAdapter.send` outside the client factory is documented (front panel controller is a known case — confirm it's the only one)
- [ ] Audit document committed at `docs/1.0/001-IN-PROGRESS/s550-support/phase-0-contract-audit.md` listing every method consumed and which hook/component consumes it
- [ ] **Duplication audit gate:** confirm no parallel client implementations exist; the front panel controller (`s330-front-panel.ts`) is the one known sibling — assess whether it should be folded into the main interface

### Task 2 — Define fixture format

Design the `FixtureRecord` schema for recorded scenarios. Each record captures one method call.

**Schema** (preliminary):

```typescript
interface FixtureRecord {
    sequence: number;          // ordinal within scenario
    method: string;            // e.g., "requestPatchData"
    args: unknown[];           // serialized args (JSON-safe)
    sysexSent: number[][];     // raw bytes per outgoing message
    sysexReceived: number[][]; // raw bytes per incoming message
    result: unknown;           // serialized return value
    timing: {
        startMs: number;       // ms since scenario start
        durationMs: number;    // wall time of the call
    };
    error?: { name: string; message: string }; // if call threw
}

interface FixtureScenario {
    name: string;
    device: 's330' | 's550';
    deviceId: number;
    capturedAt: string;        // ISO timestamp
    bridgeVersion?: string;    // midi-server version if applicable
    records: FixtureRecord[];
}
```

**Acceptance criteria:**
- [ ] `fixture-schema.ts` exports the types + JSON serialization helpers (`writeFixture(scenario)` and `readFixture(path)`)
- [ ] Format chosen to support streaming (NDJSON per record) so long scenarios don't OOM
- [ ] Schema versioned (`schemaVersion: 1` field) so future evolution doesn't break replay
- [ ] Unit tests for the round-trip: record → serialize → deserialize → assert structural equality

### Task 3 — Build `RecordingProxyClient`

Generic wrapper that implements `SSeriesClientInterface<TPatch, TTone, TPatchCommon>` by delegating to a real client and recording every call. Persists records to a fixture file.

**Implementation strategy:**
- Take a real `SSeriesClientInterface` instance + a fixture writer in the constructor
- Use a Proxy or explicit per-method delegation (explicit preferred — TypeScript catches signature drift)
- Each method: capture timestamp, call real, capture result/error, append `FixtureRecord`
- Bytes-on-the-wire capture: wrap the underlying `midiAdapter` with a sniffer, OR have the real client emit byte events the proxy listens to

**Acceptance criteria:**
- [ ] `RecordingProxyClient` implements every method on the interface (TypeScript enforces — no `any` shortcuts)
- [ ] Records include both call-level data (method, args, result) and byte-level data (raw sysex sent/received)
- [ ] Unit tests using a mock real client that returns canned responses; verify recording matches input exactly
- [ ] **Duplication audit gate:** confirm no existing recording/proxy infrastructure in `e2e-infra` or elsewhere

### Task 4 — Build CLI scenario runner

Node script in `modules/e2e-infra/src/node/lib/record-fixtures-roland.ts` that:
1. Connects to real hardware via `midi-server` HTTP MIDI bridge (existing pattern)
2. Constructs a real `S330Client` or `S550Client`
3. Wraps it with `RecordingProxyClient`
4. Drives a scripted scenario through it
5. Writes the fixture file

**Initial scenarios** (mirror what the UI does):
- `s550-load-empty.ndjson` — connect, query device id, read all 32 patches + 64 tones from a known-empty device
- `s550-load-populated.ndjson` — connect, read all from a populated device (for realistic UI iteration)
- `s550-import-sample-bank-c.ndjson` — full WSD upload to bank C (covers the #393 fix path)
- `s550-export-patch-with-subtones.ndjson` — read patch + read all referenced tones (covers `useLibraryExport` flow)
- `s550-individual-param-write.ndjson` — `setPatchName`, `setPatchKeyMode`, etc. — verify per-param SysEx
- Equivalent `s330-*` scenarios for cross-device replay

**Acceptance criteria:**
- [ ] CLI runner runs as `make record-fixtures-roland-s550` (and `-s330`)
- [ ] Each scenario is a separate function with a clear purpose comment
- [ ] Failure mode: if hardware not reachable, error clearly with remediation
- [ ] **Duplication audit gate:** confirm we're using existing `e2e-infra/src/node/lib/` patterns; not introducing new test infrastructure

### Task 5 — Capture initial fixture set against real S-550

Run `make record-fixtures-roland-s550` against the connected device. Verify fixtures look reasonable (no truncation, byte counts match known protocol structures). Commit fixtures to `modules/sampler-devices/test/fixtures/s550/`.

**Acceptance criteria:**
- [ ] At least 5 scenarios captured (the ones listed in Task 4)
- [ ] Each fixture file is committed (these are test data)
- [ ] Fixture sizes are reasonable (load-all scenarios should be a few MB at most given 32 patches × 512 bytes + 64 tones × 256 bytes + minimal wave data)
- [ ] Spot-check: pick one fixture, manually verify the first few records have plausible SysEx structure (model ID, address bytes, checksum)

### Task 6 — Build `SimulatedSamplerClient`

Implements `SSeriesClientInterface<TPatch, TTone, TPatchCommon>`; constructor takes a fixture (path or pre-loaded scenario). For each method call:
1. Look up the next matching record (by method name + args match)
2. Optionally simulate latency (configurable, defaults to recorded timing or zero)
3. Return the recorded result, or throw the recorded error
4. **Throw on unrecorded calls** (no silent fallback, per project rule "no fallbacks/mock data outside test code" — this IS test code, but the throw is intentional to surface scenario gaps)

**Implementation strategy:**
- Linear scan with sequence index — scenarios are ordered call sequences
- Lenient args matching: structural equality with optional whitelist of fields to ignore (timestamps, etc.)
- Configurable strict mode: in strict mode, calls must match the exact recorded sequence; in lenient mode, look ahead for matching method+args

**Acceptance criteria:**
- [ ] Implements every method on the interface (TypeScript enforces)
- [ ] Throws clearly on unrecorded calls: `SimulatedClientUnrecordedCallError: requestPatchData(99) not in fixture s550-load-empty (records exhausted)`
- [ ] Optional latency simulation (`config.latencyMode: 'none' | 'recorded' | { fixedMs: number }`)
- [ ] Unit tests: load fixture, call methods in order, assert returns match recorded results
- [ ] Replay fidelity test: load a real fixture, replay every recorded call, assert byte-equality with the recording

### Task 7 — Build editor `TestHarnessPage`

Mounts the editor with `SimulatedSamplerClient` instead of the real one. Configurable via URL query param: `/test/harness?scenario=s550-load-populated&device=s550`.

**Implementation strategy:**
- New page in `modules/roland-sxx0-editor/src/pages/TestHarnessPage.tsx`
- Loads fixture file (fetched as static asset, served from public/test-fixtures/)
- Constructs `SimulatedSamplerClient` from the fixture
- Renders the rest of the editor with the simulated client injected via `DeviceConfigContext` (or a new test-only context provider)
- Routes `/test/harness/*` map to the harness page

**Acceptance criteria:**
- [ ] Harness page mounts each editor page (HomePage, PatchesPage, TonesPage, PlayPage, WorkflowsPage, LibraryPage) with the simulated client
- [ ] Loading the harness with a scenario shows the editor populated with the recorded data — patches/tones display, dialogs open, parameters render
- [ ] No production code path imports anything from the harness (test-only code stays in test-only files)
- [ ] **Duplication audit gate:** confirm the harness reuses production page components — does NOT fork them

### Task 8 — First Playwright UI specs

Write `test/ui/<page>.spec.ts` for each page that:
1. Loads the harness with a chosen scenario
2. Asserts the page renders with expected data from the fixture
3. Drives a few interactions (open dialog, change parameter, etc.)
4. Asserts UI state matches expected post-interaction state

**Initial specs:**
- `home.spec.ts` — landing page renders, device identity correct
- `patches.spec.ts` — list shows 32 patches (S-550) / 64 patches (S-330), detail pane updates on selection
- `tones.spec.ts` — list shows 64/32 tones, tabs work, envelope renders, range bars render
- `library.spec.ts` — tree view, dialog launchers, memory map panel
- `play.spec.ts` — multi-mode part assignments

**Acceptance criteria:**
- [ ] Each page has at least one spec asserting non-trivial behavior
- [ ] Specs run via existing `make test-ui-roland` target without hardware
- [ ] Specs catch the kinds of bugs visual polish would introduce (cross-page width inconsistency, hardcoded pixel widths, etc.)

### Task 9 — CI integration + drift detection

- [ ] `make test-ui-roland` runs in GitHub Actions on every push (or matrix with `make` + `make test`)
- [ ] CI fails if specs fail
- [ ] **Drift-detection job:** weekly (or on-demand) `make record-fixtures-roland-s550` re-captures fixtures, diff against committed; alert if device protocol drift
- [ ] Document the workflow in `TESTING.md` (or a new `TESTING-FIXTURES.md`)

## Acceptance Criteria (phase)

- [ ] All 9 tasks done with their per-task gates passed
- [ ] Phase 9 visual polish (Tasks 4–7) can be driven without hardware QA: every interaction the redesign needs to verify is covered by a Playwright UI spec against the harness
- [ ] Phase 7 (front panel) becomes routine: capture one fixture for front-panel button presses, replay in UI tests, verify hardware behavior matches recorded behavior
- [ ] Hardware verification debt from Phase 10 (#393, #394, #395, #396, #398, #400, #402) closes by replaying captured fixtures through the simulated client — no live hardware QA per issue
- [ ] **Phase-completion duplication audit passes** — each task's audit gate filled in
- [ ] DEVELOPMENT-NOTES entry summarizing what was built, what scenarios are captured, what's deferred

## Risks

| Risk | Mitigation |
|------|------------|
| Web MIDI vs Node MIDI behave differently | The contract (`SamplerClientInterface`) abstracts this; both real clients implement the same interface. The simulated client doesn't care which transport produced the fixture. |
| Fixture format evolution breaks replay | `schemaVersion` field; migration scripts when format evolves; old fixtures stay valid until explicitly migrated |
| Recorded device state goes stale | Drift-detection job (Task 9); fixtures are test data and can be re-captured cheaply once the runner exists |
| UI relies on hidden timing assumptions | Latency simulation (recorded mode) — replay timing matches device. If a UI bug only surfaces with real timing, it surfaces in replay too. |
| Capturing fixtures takes longer than expected | Time-box: if Task 5 stalls (hardware unreachable, protocol gaps), file follow-ups and proceed with synthetic fixtures for replay-mode validation; capture real fixtures incrementally. |

## Reading order

1. This document — design overview, task list
2. `phase-0-contract-audit.md` (will exist after Task 1) — what the UI consumes
3. `fixture-schema.ts` (will exist after Task 2) — the recorded data shape
4. Per-task implementation diffs (one commit per task, ideally)
