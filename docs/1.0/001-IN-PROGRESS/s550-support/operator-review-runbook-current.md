---
deskwork:
  id: f5d44e33-5cb5-4e3e-b8f3-e796673b8f32
---
# Operator Review Runbook — Current HEAD

This is the human-facing runbook for the current `feature/s550-support` branch state. It is the reviewer-facing counterpart to `operator-review-runbook.manifest.json`.

Use this document for the actual UI review and sign-off pass. You should not need to read the manifest, integration test code, or raw machine output to know what to do next.

For the live S-550 reruns below, use the runbook dispatcher instead of remembering individual spec names:

```bash
pnpm --filter @audiocontrol/roland-sxx0-editor test:runbook:live -- --list
```

## Outcome

At the end of this pass, record one of two outcomes:

- `Operator sign-off granted for the requested scope`
- `Operator sign-off not yet granted; blocking findings: ...`

## Current review queue

Already satisfied at current HEAD:

- `LIVE-S550-LIB-001` is already verified. Do not re-review it unless a later change reopens the dialog-accessibility path.
- `AUDIT-20260514-FU3-01` structural rerun completed cleanly on 2026-05-16.
- `LIVE-S550-PATCH-001` is now verified on live hardware.
- `LIVE-S550-TONES-001` is now verified fixed at the row-selection layer; the remaining Tones blocker has moved deeper into the editor and is tracked separately as `LIVE-S550-TONES-002`.

Still active at current HEAD:

1. `D-TONE-ENV-02` Tier 4 sign-off is still missing.
2. `AUDIT-20260514-FU3-02` still needs its live ImportSamplesDialog spot-check on the real S-550 route. The targeted Tier 3 rerun already passed on 2026-05-16.
3. `LIVE-S550-TONES-002` still needs remediation and a fresh live Tones rerun.
4. `LIVE-S550-LIB-002` still needs live diagnostic evidence or a clean verified pass.

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

## Step 2 — Live ImportSamplesDialog spot-check for `AUDIT-20260514-FU3-02` / `#425`

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

## Step 3 — Live Tones re-run for `LIVE-S550-TONES-002`

What to run:

```bash
pnpm --filter @audiocontrol/roland-sxx0-editor test:runbook:live -- 2.3
```

What to look for:

- the live run still reaches the actual cutoff / sustain assertions
- `D-TONE-TVF-02` reads back the requested cutoff value within tolerance
- `D-TONE-ENV-10` completes without the watchdog killing the sustain interaction

Sign off if:

- the spec reaches the editor and passes the bounded capability assertions

If blocked:

- leave `LIVE-S550-TONES-002` unverified
- record whether the failure is the cutoff readback mismatch, the sustain interaction stall, or both

## Step 4 — Live diagnostic pass for `LIVE-S550-LIB-002` / `#430`

What to run:

```bash
pnpm --filter @audiocontrol/roland-sxx0-editor test:runbook:live -- 2.4-library
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
