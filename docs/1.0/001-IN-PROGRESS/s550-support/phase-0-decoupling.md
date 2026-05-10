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

> **Architecture decision from Task 1 audit (see [phase-0-contract-audit.md](./phase-0-contract-audit.md)):** the proxy lives at the **`SSeriesMidiAdapter` layer**, not at `SamplerClientInterface`. The audit found two BLOCKERs that bypass the client interface:
> 1. `useFrontPanel.ts` creates `FrontPanelController` from the raw adapter — DT1 messages bypass the interface.
> 2. `useParameterListener.ts` subscribes to inbound device broadcasts via `adapter.onSysEx` — a path that doesn't exist on the interface at all.
>
> Both bypasses converge at `SSeriesMidiAdapter`. A single proxy wrapping the adapter (where `useMidiStore` instantiates it) covers the full surface — outbound `send()`, inbound `onSysEx` callbacks, and the front-panel DT1 path.

```
                    UI Layer
┌──────────────────────────────────────────────────────┐
│  Pages / Hooks / FrontPanelController /              │
│  useParameterListener / SamplerClientInterface       │
└────────────┬─────────────────────────▲───────────────┘
             │ adapter.send(...)       │ adapter.onSysEx(...)
             ▼                         │
┌──────────────────────────────────────────────────────┐
│           SSeriesMidiAdapter (the contract)          │  ◀── proxy lives here
└────────────┬─────────────────────────▲───────────────┘
             │                         │
       ┌─────┴────────┐         ┌──────┴───────┐
       │              │         │              │
       ▼              ▼         ▼              ▼
┌───────────┐  ┌────────────┐  ┌──────────────────┐
│  Real     │  │ Recording  │  │  Simulated       │
│  adapter  │  │ Proxy      │  │  Adapter         │
│ (Web MIDI │  │ (wraps     │  │  (replays        │
│  / Node)  │  │  real)     │  │   fixture)       │
└─────┬─────┘  └─────┬──────┘  └──────────▲───────┘
      │              │ writes              │ reads
      │              ▼                     │
      │        ┌──────────────────────────┴──┐
      ▼        │  Fixtures (NDJSON)          │
   real        │  - outbound bytes + ts      │
   S-550       │  - inbound bytes + ts       │
   hardware    └─────────────────────────────┘
```

## Module Layout

| Piece | Location | Status |
|---|---|---|
| `SSeriesMidiAdapter` (the proxy contract) | `modules/sampler-devices/src/devices/roland-s-series/s-series-types.ts` | **Exists** |
| `SamplerClientInterface` | `modules/sampler-devices/src/devices/roland-s-series/s-series-client.ts:172` | **Exists** — audit complete in [phase-0-contract-audit.md](./phase-0-contract-audit.md) |
| Fixture schema (`FixtureRecord`) | `modules/sampler-devices/src/recording/fixture-schema.ts` | New |
| `RecordingProxyAdapter` | `modules/sampler-devices/src/recording/recording-proxy.ts` | New |
| `SimulatedAdapter` | `modules/sampler-devices/src/simulation/simulated-adapter.ts` | New |
| Captured fixtures | `modules/sampler-devices/test/fixtures/s550/<scenario>.ndjson` | New (data) |
| CLI scenario runner | `modules/e2e-infra/src/node/lib/record-fixtures-roland.ts` | New |
| Make targets | `Makefile` | Augment |
| Editor test harness page | `modules/roland-sxx0-editor/src/pages/TestHarnessPage.tsx` | New |
| Adapter injection in MidiStore | `modules/roland-sxx0-editor/src/stores/useMidiStore.ts` | Augment (wrap real adapter with proxy when in record mode; replace with `SimulatedAdapter` when in test-harness mode) |
| Playwright UI specs | `modules/roland-sxx0-editor/test/ui/<page>.spec.ts` | New |

**Reuses existing infrastructure** (do not reinvent):
- `modules/e2e-infra/` — shared test infra, already has `easymidi` + `@playwright/test` + `sampler-devices` wired up
- `midi-server` HTTP MIDI bridge — used by `make test-e2e-roland-device` today; the CLI runner connects through it
- `playwright.test-harness.config.ts` — already points at `modules/roland-sxx0-editor/test/ui/`
- `make test-ui-roland` — already wired target; UI specs land into it

## Tasks

### Task 1 — Audit `SamplerClientInterface` for contract completeness ✅ COMPLETE

Verify every operation the UI hooks call goes through the interface; identify direct device access bypasses; recommend the proxy placement layer.

**Deliverable:** [phase-0-contract-audit.md](./phase-0-contract-audit.md)

**Key findings:**
- 35 methods on the interface; 27 with active UI consumers; 8 without (legitimate — `panic`, `setPatchOctaveShift`, etc.)
- **2 BLOCKERs** for an interface-level proxy: `useFrontPanel.ts` and `useParameterListener.ts` both bypass the interface and operate on the raw `SSeriesMidiAdapter`
- **Architecture decision: place the proxy at the adapter layer** — both BLOCKERs converge on `SSeriesMidiAdapter`, so wrapping it in `useMidiStore` covers the full device communication surface (outbound + inbound + front-panel DT1) with no interface modifications
- 7 INFO findings (dev diagnostics, dead type casts, data-structure imports) — none block Phase 0

**Acceptance criteria — met:**
- [x] All editor-side device communication paths catalogued
- [x] BLOCKERs identified with file:line references and root-cause analysis
- [x] Audit document committed at [phase-0-contract-audit.md](./phase-0-contract-audit.md)
- [x] Proxy-placement decision made and justified (adapter level; see audit §4 + §6)
- [x] **Duplication audit gate (PASSED):** front-panel controller (`s330-front-panel.ts`) confirmed as the only sibling device-communication path; correctly kept separate (audit §4 Option B); adapter-level proxy covers it without interface contamination

### Task 2 — Define fixture format (adapter-level)

Design the `FixtureRecord` schema for recorded scenarios. Each record captures one byte-level event at the adapter boundary — either an outbound `send()` call or an inbound `onSysEx` callback firing.

**Schema** (preliminary):

```typescript
type FixtureEventKind = 'outbound' | 'inbound';

interface FixtureRecord {
    sequence: number;          // ordinal within scenario, monotonic
    kind: FixtureEventKind;    // 'outbound' = adapter.send(); 'inbound' = onSysEx fired
    bytes: number[];           // raw SysEx bytes (0xF0 ... 0xF7)
    timestampMs: number;       // ms since scenario start (recorded wall time)
    annotation?: string;       // optional human-readable hint, e.g., "RQD patch 0" — for fixture readability
}

interface FixtureScenario {
    schemaVersion: 1;
    name: string;              // e.g., "s550-load-empty"
    device: 's330' | 's550';
    deviceId: number;          // SysEx device ID 0-15
    capturedAt: string;        // ISO timestamp
    bridgeVersion?: string;    // midi-server version if applicable
    description?: string;      // free-text purpose
    records: FixtureRecord[];  // ordered byte-level event log
}
```

**Why byte-level, not method-level:** the audit (Task 1) established the proxy lives at `SSeriesMidiAdapter`. Method-level recording would miss `FrontPanelController` DT1 sends and `useParameterListener` inbound broadcasts. Byte-level captures everything by definition.

**Replay model:** `SimulatedAdapter` consumes the records in order. On `send(bytes)` it asserts the next outbound record matches; for inbound records it fires registered `onSysEx` callbacks at the recorded timing (or as fast as possible, depending on `latencyMode`). This preserves both the request/response shape AND the device's spontaneous broadcasts.

**Acceptance criteria:**
- [ ] `modules/sampler-devices/src/recording/fixture-schema.ts` exports types + JSON serialization helpers (`writeFixture(scenario, path)` and `readFixture(path)`)
- [ ] NDJSON streaming format for `records` (one record per line) so long scenarios don't OOM during write or read
- [ ] Schema versioned (`schemaVersion: 1`) so future evolution doesn't break replay
- [ ] Unit tests for round-trip: build scenario in memory → serialize → deserialize → assert structural equality
- [ ] **Duplication audit gate:** confirm no existing fixture format in `e2e-infra` or elsewhere; check `modules/e2e-infra/helpers/library-fixtures.ts` for naming collisions

### Task 3 — Build `RecordingProxyAdapter`

Wraps a real `SSeriesMidiAdapter` and records every byte-level event (outbound + inbound) to a fixture writer.

**Implementation strategy:**
- Implements the same `SSeriesMidiAdapter` interface (drop-in substitute)
- Constructor takes the real adapter + a fixture writer
- `send(bytes)`: appends `{ kind: 'outbound', bytes, timestampMs, ... }` then delegates to real adapter
- `onSysEx(callback)`: registers the callback; when the real adapter fires its own `onSysEx` listeners, the proxy intercepts, appends `{ kind: 'inbound', bytes, timestampMs, ... }`, and forwards to all registered callbacks
- All other adapter methods (e.g., `removeSysExListener`) delegate transparently

**Acceptance criteria:**
- [ ] `RecordingProxyAdapter` implements every method on `SSeriesMidiAdapter` (TypeScript enforces — no `any` shortcuts)
- [ ] Records include both outbound and inbound byte streams in interleaved order
- [ ] Optional annotation API: `proxy.annotate("RQD patch 0")` injects a human hint into the next record (helps fixture readability)
- [ ] `proxy.flush()` and `proxy.close()` for graceful fixture persistence
- [ ] Unit tests: instantiate proxy with a mock adapter that emits canned outbound/inbound events; verify the fixture writer received the expected sequence
- [ ] **Duplication audit gate:** `grep -rn "MidiAdapter\|midi-adapter" modules/` to confirm no parallel adapter wrapper exists; check `modules/midi-core/` for existing transport instrumentation

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

### Task 6 — Build `SimulatedAdapter`

Implements `SSeriesMidiAdapter`; constructor takes a fixture (path or pre-loaded scenario). Replays the recorded byte stream:

1. On `send(bytes)`: pull the next outbound record from the fixture; assert `bytes` matches; if mismatch, throw `SimulatedAdapterUnexpectedSendError` with diff context
2. After the matching outbound, scan ahead for any consecutive inbound records (the device's response) and dispatch them to all registered `onSysEx` listeners — either immediately, at recorded relative timing, or at a fixed latency (configurable)
3. **Throw on unrecorded sends** (no silent fallback; surfaces scenario gaps loudly)

**Implementation strategy:**
- Linear scan with read-cursor over the records array
- Outbound matching: byte-for-byte equality against the next outbound record
- Inbound dispatch: after each outbound match, drain consecutive inbound records into the listener callbacks
- Configurable latency: `config.latencyMode: 'none' | 'recorded' | { fixedMs: number }` — `'none'` for fast tests, `'recorded'` for timing-sensitive tests

**Acceptance criteria:**
- [ ] Implements every method on `SSeriesMidiAdapter` (TypeScript enforces)
- [ ] Throws clearly on unexpected sends: `SimulatedAdapterUnexpectedSendError: send([F0 41 ...]) at sequence 42 does not match recorded outbound [F0 41 ...] (first diff at byte 5)`
- [ ] Throws clearly on records exhausted: `SimulatedAdapterRecordsExhausted: send([...]) but fixture has no more outbound records`
- [ ] Latency simulation modes work: `'none'` fires inbound synchronously; `'recorded'` schedules at recorded delta; `{fixedMs}` schedules at fixed delay
- [ ] Unit tests: load synthetic fixture, drive adapter through expected send sequence, assert listener callbacks fire with correct bytes
- [ ] **Replay fidelity test:** load a real captured fixture, drive `S330Client` / `S550Client` against the simulated adapter through the same operations the recording captured, assert listener callbacks deliver the right responses (round-trip property test)

### Task 7 — Build editor `TestHarnessPage`

Mounts the editor with `SimulatedAdapter` swapped in at the MidiStore boundary instead of the real adapter. Configurable via URL query: `/test/harness?scenario=s550-load-populated&device=s550&page=patches`.

**Implementation strategy:**
- New page in `modules/roland-sxx0-editor/src/pages/TestHarnessPage.tsx`
- Loads fixture file (fetched as static asset, served from `public/test-fixtures/`)
- Constructs `SimulatedAdapter` from the fixture
- Augments `useMidiStore` to accept an injected adapter for test mode (so the rest of the app — `FrontPanelController`, `useParameterListener`, `SamplerClientInterface` consumers — all transparently use the simulated adapter)
- Renders the requested editor page (HomePage, PatchesPage, TonesPage, PlayPage, WorkflowsPage, LibraryPage) inside the harness shell
- Routes `/test/harness/*` map to the harness page

**Acceptance criteria:**
- [ ] Harness page can mount each editor page with the simulated adapter
- [ ] Loading the harness with a scenario shows the editor populated with the recorded data — patches/tones display, dialogs open, parameters render — all without browser MIDI permissions
- [ ] No production code path imports anything from the harness (test-only code stays in test-only files / behind `import.meta.env.MODE !== 'production'` guards if needed)
- [ ] `useMidiStore` adapter injection is type-safe and only available in non-production builds (or behind a feature flag for safety)
- [ ] **Duplication audit gate:** confirm the harness reuses production page components — does NOT fork them; check that no editor-page logic is duplicated in the harness

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
