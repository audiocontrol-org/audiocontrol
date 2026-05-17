# Operator Review Runbook — Current HEAD

This is the human-facing runbook for the current `feature/s550-support` branch state. It is the reviewer-facing counterpart to `operator-review-runbook.manifest.json`.

Use this document for the actual UI review and sign-off pass. You should not need to read the manifest, integration test code, or raw machine output to know what to do next.

## Outcome

At the end of this pass, record one of two outcomes:

- `Operator sign-off granted for the requested scope`
- `Operator sign-off not yet granted; blocking findings: ...`

## Current review queue

Already satisfied at current HEAD:

- `LIVE-S550-LIB-001` is already verified. Do not re-review it unless a later change reopens the dialog-accessibility path.

Still active at current HEAD:

1. `D-TONE-ENV-02` Tier 4 sign-off is still missing.
2. `AUDIT-20260514-FU3-01` still needs its auditor structural re-run.
3. `AUDIT-20260514-FU3-02` still needs its live ImportSamplesDialog re-run.
4. `LIVE-S550-TONES-001` still needs its live Tones re-run.
5. `LIVE-S550-LIB-002` still needs live diagnostic evidence or a clean verified pass.
6. `LIVE-S550-PATCH-001` still needs live diagnostic evidence or a clean verified pass.

## Step 1 — D-TONE-ENV-02 sign-off readiness

What to run:

```bash
pnpm run check-credibility
make check-coverage-roland
```

What to look for:

- `D-TONE-ENV-02` is still unsigned in `ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md`.
- `D-TONE-ENV-02` still shows `Coverage = partial`.
- credibility checks are clean enough that you are reviewing the right affordance, not a broken test path.

What counts as sign-off:

- You review the real `D-TONE-ENV-02` affordance on hardware and conclude the implemented behavior matches the intended capability.
- You then record the sign-off in the inventory row using canonical format.

If blocked:

- Do not fabricate the sign-off.
- Record the blocking finding ID or missing evidence path.

## Step 2 — Structural re-run for `AUDIT-20260514-FU3-01` / `#426`

What to run:

```bash
grep -rn "getByTestId\\|\\.click()" modules/roland-sxx0-editor/test/ui/
make test-wiring-roland
make test-ui-roland
make test-rendering-roland
pnpm exec eslint --print-config modules/roland-sxx0-editor/test/ui/hypothetical.spec.ts
```

What to look for:

- no functional `getByTestId` / `.click()` drift remains under `test/ui/`
- wiring, ui, and rendering suites are still structurally healthy
- ESLint discipline rules still apply to `test/ui/**`

Sign off if:

- the grep is clean apart from docs naming forbidden patterns
- the structural suites pass
- ESLint scope still protects root `test/ui/**`

If blocked:

- leave `AUDIT-20260514-FU3-01` unverified
- record exactly which invariant failed

## Step 3 — Live ImportSamplesDialog re-run for `AUDIT-20260514-FU3-02` / `#425`

What to run:

```bash
make test-ui-roland ARGS="--grep import-samples"
```

Then review on live `/roland/s550/editor/library`.

What to look for:

- slot labels derive from the real memory layout
- overwrite indicators appear only on occupied slots
- both single-slot and range cases behave correctly

Sign off if:

- the Tier 3 spec passes
- the live dialog behavior is correct on real hardware

If blocked:

- leave `AUDIT-20260514-FU3-02` unverified
- note whether the failure is test-only, UI-only, or both

## Step 4 — Live Tones re-run for `LIVE-S550-TONES-001` / `#428`

What to run:

```bash
make test-e2e-roland-device-conformance ARGS="--grep 's550-D-TONE-live-envelope-and-slider'"
```

What to look for:

- the live run can select a loaded tone row reliably
- the run reaches the actual cutoff / sustain assertions
- the failure, if any, is now in the tone controls themselves rather than row selection

Sign off if:

- the spec reaches the editor and passes the bounded capability assertions

If blocked:

- leave `LIVE-S550-TONES-001` unverified
- record whether the block is still list selection or has moved deeper into the tone controls

## Step 5 — Live diagnostic pass for `LIVE-S550-LIB-002` / `#430`

What to run:

```bash
make test-e2e-roland-device-conformance ARGS="--grep 's550-D-LIB-live-core'"
```

What to look for:

- whether the save flow completes cleanly
- whether stale-`RJC` timing evidence appears in the browser logs
- whether `D-LIB-10` reaches a true completed save state

Sign off if:

- the live save path completes cleanly and the closure gate for `LIVE-S550-LIB-002` is satisfied

If blocked:

- record the exact `time-since-send` evidence or timeout shape
- keep `LIVE-S550-LIB-002` blocked

## Step 6 — Live diagnostic pass for `LIVE-S550-PATCH-001` / `#431`

What to run:

```bash
make test-e2e-roland-device-conformance ARGS="--grep 's550-D-PATCH-live-core'"
```

What to look for:

- whether patch-bank load reaches the editor
- whether stale-`RJC` timing evidence appears in the browser logs
- whether the route-load precondition failure is gone

Sign off if:

- the patch-bank load reaches the editor and the live closure gate is satisfied

If blocked:

- record the exact stale-`RJC` / timeout evidence
- keep `LIVE-S550-PATCH-001` blocked

## Final recording

If every required step above signs off:

- update the relevant `Sign-off` cells
- flip verified findings in `audit-log.md`
- record the closure pass in `DEVELOPMENT-NOTES.md`
- state clearly: `Operator sign-off granted for the requested scope`

If any step remains blocked:

- do not grant sign-off
- list the blocking finding IDs explicitly
- state clearly: `Operator sign-off not yet granted; blocking findings: ...`
