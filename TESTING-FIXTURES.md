# Fixture-Backed UI Testing

This document covers Phase 0 of the s550-support feature: how the simulated
MIDI harness lets editor UI run locally against captured device byte streams,
and how the operator detects drift between captured fixtures and real device
behavior.

For the broader test architecture, see [TESTING.md](TESTING.md). For the
test-harness category that consumes these fixtures, see
[TESTING-UI.md](TESTING-UI.md). For the Phase 0 design rationale, see
[docs/1.0/001-IN-PROGRESS/s550-support/phase-0-decoupling.md](docs/1.0/001-IN-PROGRESS/s550-support/phase-0-decoupling.md).

## Why fixtures

The Roland S-330 / S-550 editor previously needed a real device on a USB MIDI
port to do anything past the home page. That made:

- **Repeatable tests impossible** — UI tests couldn't run without hardware on the line.
- **Visual polish slow** — every layout iteration required reconnecting to a
  sampler and waiting for the editor to fetch the patch / tone catalog.
- **Front-panel verification fragile** — small protocol drifts between
  S-330 and S-550 weren't caught until a tester sat in front of the gear.

Phase 0 captures real device traffic into newline-delimited JSON fixtures.
The editor's `?midi=simulated&scenario=<name>` URL replays a fixture through a
`SimulatedAdapter` so the UI talks to a fake "device" that sends back the
exact byte sequence the real one did. Tests run locally; visual iteration runs
without hardware; protocol drift is detected by an operator script (see
[Drift detection](#drift-detection)).

## Fixture format

NDJSON (newline-delimited JSON). One scenario per file. Layout:

- **Line 1:** `FixtureScenario` header (everything except the records list).
- **Lines 2..N:** one `FixtureRecord` per line, in capture order.

Schema is in
[`modules/sampler-devices/src/recording/fixture-schema.ts`](modules/sampler-devices/src/recording/fixture-schema.ts);
current `SCHEMA_VERSION` is `1`. A mismatch on parse throws — bumping the
schema is a deliberate, incompatible change.

Each record captures one byte-level event at the `SSeriesMidiAdapter`
boundary:

- `kind: 'outbound'` — produced by `adapter.send(bytes)` from UI / client code
- `kind: 'inbound'`  — produced by the device, delivered to UI via
  `onSysEx(bytes)` callback firing
- `bytes`             — raw SysEx including F0 / F7 framing
- `sequence`          — monotonic ordinal within the scenario, starts at 0
- `timestampMs`       — wall-clock millis since scenario start
- `annotation`        — optional human hint (e.g. `"RQD patch 0"`)

Fixtures live under
`modules/sampler-devices/test/fixtures/<device>/<scenario>.ndjson`.

## Capturing fixtures

Capture is hardware-dependent: a connected S-330 or S-550 on `Volt 4` (the
typical orion-m4 setup). Use the `make` targets — they shell into devenv,
build the right modules, and invoke the CLI runner.

```bash
# All scenarios for the S-330
make record-fixtures-roland-s330 ARGS="--scenario load-everything --output modules/sampler-devices/test/fixtures/s330/load-everything.ndjson"
make record-fixtures-roland-s330 ARGS="--scenario fetch-patch-0   --output modules/sampler-devices/test/fixtures/s330/fetch-patch-0.ndjson"
make record-fixtures-roland-s330 ARGS="--scenario fetch-tone-0    --output modules/sampler-devices/test/fixtures/s330/fetch-tone-0.ndjson"
make record-fixtures-roland-s330 ARGS="--scenario connect-only    --output modules/sampler-devices/test/fixtures/s330/connect-only.ndjson"

# Same shape for the S-550
make record-fixtures-roland-s550 ARGS="--scenario load-everything --output modules/sampler-devices/test/fixtures/s550/load-everything.ndjson"

# Discovery
make record-fixtures-roland ARGS="--list-scenarios"
make record-fixtures-roland ARGS="--list-ports"
```

The CLI runner is at
[`modules/e2e-infra/src/node/lib/record-fixtures-roland.ts`](modules/e2e-infra/src/node/lib/record-fixtures-roland.ts).
The scenario registry inside that file is the single source of truth for the
named scenarios — adding a scenario means editing the registry, not the
shell wrappers.

## Replaying fixtures (the simulated harness)

The Roland editor accepts MIDI transport via URL query parameters:

```
https://localhost:<port>/roland/s330/editor?midi=simulated&scenario=load-everything
```

When `?midi=simulated` is present:

- `simulatedMidiTransport.ts` constructs a `SimulatedAdapter` instead of the
  Web MIDI / HTTP MIDI transport.
- The Vite dev server's fixture middleware (registered in `vite.config.ts`)
  serves the requested NDJSON file from the canonical fixtures directory.
- The editor mounts as if it had connected to a real device — the page
  renders patches, tones, library entries, etc., from the replayed bytes.

UI tests under `modules/roland-sxx0-editor/test/ui/` mount editor pages this
way and assert on the rendered DOM. The runner is
[`modules/roland-sxx0-editor/scripts/run-test-harness-e2e.sh`](modules/roland-sxx0-editor/scripts/run-test-harness-e2e.sh),
invoked via `make test-ui-roland`.

## Test execution

Tests run locally; there is no CI test runner. The operator decided not to
invest in CI infrastructure for this project — the cost/benefit doesn't
pay off at the current project size. Tests are still required (per
[`.claude/rules/agent-discipline.md`](.claude/rules/agent-discipline.md) —
every capability needs a passing test before redesign work can proceed),
they're just run on the developer's machine before each commit.

Local test commands:

- `make test-ui-roland` — Phase 0 simulated harness specs (UI tests against
  captured fixtures, no hardware required)
- `make test-ui-s3k`    — keygroup-zone harness specs
- `pnpm --filter @audiocontrol/roland-sxx0-editor test` — roland unit tests
- `pnpm --filter @audiocontrol/sampler-devices test` — sampler-devices unit
  tests (3 pre-existing failures in `test/unit/s3000xl/` are not part of
  the Phase 0 surface and are not addressed here)
- `pnpm --filter @audiocontrol/editor-core test` — editor-core unit tests
  (6 pre-existing failures in `PluginLibraryBrowser` / `MoveDialog` are not
  part of the Phase 0 surface and are not addressed here)

The `Makefile`'s `DEVENV_RUN` indirection (added during Phase 0 Task 9) is
retained — defaults to `devenv shell --quiet -- bash -c` for local runs,
overridable for any non-devenv invocation context.

## Drift detection

Drift detection is operator-run (hardware required). Use it before a release,
after any change to `record-fixtures-roland.ts`'s scenario registry, or any
time you suspect the device's firmware or connection topology has shifted.

```bash
# All committed scenarios for every device
make check-fixture-drift

# Single device
make check-fixture-drift ARGS="--device s330"

# Single scenario
make check-fixture-drift ARGS="--device s330 --scenario fetch-tone-0"

# Or invoke the script directly (same flags)
scripts/check-fixture-drift.sh --device s330
```

What the script does:

1. Walks `modules/sampler-devices/test/fixtures/<device>/*.ndjson`.
2. For each committed scenario, runs `make record-fixtures-roland-<device>`
   to recapture into `.tmp/fixture-drift/<device>/<scenario>.ndjson`.
3. Canonicalizes both files (drops `capturedAt` from the header and
   `timestampMs` from each record — those legitimately drift between
   captures) and `cmp`s them.
4. Reports `UNCHANGED` / `CHANGED` / `MISSING` / `FAILED` per fixture, plus
   the first 20 differing lines for any drift.

Exit code:

- `0` — every recapture matched the committed fixture
- `1` — at least one fixture drifted, was missing, or recapture failed
- `2` — usage error

If drift is **expected** (you changed the protocol or a scenario), commit
the fresh fixtures (copy from `.tmp/fixture-drift/<device>/` over the
committed file, or just rerun the underlying `make record-fixtures-...`
target writing to the canonical path). If drift is **unexpected**, do not
trust any UI-harness specs that depend on the affected fixtures until you
understand the cause — the harness is only as reliable as the byte stream
it replays.

## When to recapture

Recapture is a deliberate act, not a routine one. Trigger it when:

- **Protocol changes** — you modified the SysEx layer (request encoding,
  response framing, ASPACK handling) in `sampler-devices`.
- **Page mount sequence changes** — the editor now requests different data
  on initial render, so the captured byte stream no longer matches what the
  UI will provoke at runtime.
- **New scenario needed** — UI tests need a more targeted byte stream than
  any current scenario provides. Add the scenario to the registry in
  `record-fixtures-roland.ts`, capture it, commit fixture + scenario change
  together.
- **Device firmware update** — rare but possible for the S-550 that's been
  worked on; rerun the drift check.

Do not recapture as a general "freshness" pass. Captures take time, the
fixtures are byte-exact, and unprovoked recapture obscures real drift in
the next change.

## Scenario inventory

| Device | Scenario           | Description                                                          |
|--------|--------------------|----------------------------------------------------------------------|
| s330   | `connect-only`     | Open MIDI, request system params, disconnect — minimal fixture       |
| s330   | `fetch-patch-0`    | Connect + fetch patch slot 0                                         |
| s330   | `fetch-tone-0`     | Connect + fetch tone slot 0                                          |
| s330   | `load-everything`  | Connect + load all patches + load all tones (mirrors editor startup) |
| s550   | _(none yet)_       | S-550 fixtures pending — see issue #404                              |

The `tones` and `play` page UI specs are deferred (issues #404, #405) waiting
on more targeted fixtures. Once captured, drop them under
`modules/sampler-devices/test/fixtures/<device>/` with matching scenario
names in `record-fixtures-roland.ts` and rerun `make check-fixture-drift`.

## Related docs

- [TESTING.md](TESTING.md) — overall test architecture (unit / UI / E2E)
- [TESTING-UI.md](TESTING-UI.md) — Playwright methodology for the UI category
- [TESTING-E2E.md](TESTING-E2E.md) — hardware-attached E2E tests
- [TESTING-UNIT.md](TESTING-UNIT.md) — Vitest methodology
- [docs/1.0/001-IN-PROGRESS/s550-support/phase-0-decoupling.md](docs/1.0/001-IN-PROGRESS/s550-support/phase-0-decoupling.md) — Phase 0 design
