---
deskwork:
  id: f5d44e33-5cb5-4e3e-b8f3-e796673b8f32
---
# Operator Review Runbook — Current HEAD

Start with [operator-signoff-summary.md](./operator-signoff-summary.md) if you want the shortest explanation of the current decision state. Return here when you are ready to perform the remaining manual review steps.

This runbook contains only actions the operator is uniquely able to perform: live UI review, hardware judgment, sign-off decisions, and final recording. Auditor-owned reruns and machine checks have already been executed and are summarized here as input evidence.

## Outcome

At the end of this pass, record one of two outcomes:

- `Operator sign-off granted for the requested scope`
- `Operator sign-off not yet granted; blocking findings: ...`

## Auditor-prepared evidence

You do not need to rerun the auditor-owned checks below unless you want to spot-check them yourself:

- `AUDIT-20260514-FU3-01` is already verified on 2026-05-16.
  - wiring: `137/137` passed
  - ui: `6/6` passed
  - rendering: `24/24` passed, `4` intentional skips
- `LIVE-S550-LIB-001` is already verified.
- `LIVE-S550-PATCH-001` is already verified on live hardware.
- `LIVE-S550-TONES-001` is already verified fixed at the tone-row-selection layer.
- `AUDIT-20260514-FU3-02` has passing Tier 3 evidence:
  - `make test-ui-roland ARGS="--grep import-samples"` passed on 2026-05-16

What remains for the operator is the human judgment layer:

1. `D-TONE-ENV-02` Tier 4 sign-off
2. live manual spot-check for `AUDIT-20260514-FU3-02`
3. disposition on the still-open live findings:
   - `LIVE-S550-TONES-002`
   - `LIVE-S550-LIB-002`

## Step 1 — Decide `D-TONE-ENV-02` Tier 4 sign-off

Open the real S-550 editor and review the `D-TONE-ENV-02` affordance on hardware:

- route: `/roland/s550/editor/tones`
- area: `Filter` tab
- affordance: TVF envelope per-segment rate editing

What to look for:

- the visible control is understandable and behaves like the intended capability
- the edited segment/rate feels like the correct hardware-facing affordance
- nothing about the interaction suggests the Tier 2 / Tier 3 evidence is validating the wrong thing

Sign off if:

- you judge that the live affordance matches the intended `D-TONE-ENV-02` behavior

If blocked:

- do not sign it off
- record the blocking finding ID or a short plain-language reason

If signed off:

- update the `Sign-off` cell for `D-TONE-ENV-02` in [ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md:337)
- use canonical format: `<YYYY-MM-DD> <signer> <sha>`

## Step 2 — Manual live spot-check for `AUDIT-20260514-FU3-02` / `#425`

Review the real ImportSamplesDialog on the live S-550 route:

- route: `/roland/s550/editor/library`
- dialog: `ImportSamplesDialog`
- supporting auditor evidence: Tier 3 spec already passed on 2026-05-16

What to look for:

- slot labels derive from the real memory layout
- overwrite indicators appear only on genuinely occupied slots
- both single-slot and range cases make sense visually and behaviorally

Sign off if:

- the live dialog behavior matches the now-passing Tier 3 evidence

If blocked:

- leave `AUDIT-20260514-FU3-02` unverified
- note whether the problem is the live UI itself or a mismatch between the live UI and the Tier 3 evidence

## Step 3 — Review current open live findings

These two findings are still open after the latest auditor pass. You are not being asked to debug them here; you are being asked to decide whether they block operator sign-off for the requested scope.

### `LIVE-S550-TONES-002`

Current auditor evidence:

- the old row-selection blocker is gone
- the live battery now reaches the real editor controls
- `D-TONE-TVF-02` cutoff readback mismatched by `38`
- `D-TONE-ENV-10` stalled during the visible TVA sustain interaction and hit the watchdog

Your decision:

- if this blocks sign-off for the requested scope, keep it in the blocking list
- if it is out of scope for the sign-off you are granting, say that explicitly

### `LIVE-S550-LIB-002`

Current auditor evidence:

- the live save path still fails
- updated failure shape: tone `0` save fails with `Wave data request rejected`
- OPFS set directory is never created

Your decision:

- if this blocks sign-off for the requested scope, keep it in the blocking list
- if it is out of scope for the sign-off you are granting, say that explicitly

## Final recording

If every required step above signs off:

- update the relevant `Sign-off` cells
- flip any findings you are explicitly verifying in [audit-log.md](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/docs/1.0/001-IN-PROGRESS/s550-support/audit-log.md)
- record the closure outcome in `DEVELOPMENT-NOTES.md`
- state clearly: `Operator sign-off granted for the requested scope`

If anything remains blocked:

- do not grant sign-off
- list the blocking finding IDs explicitly
- state clearly: `Operator sign-off not yet granted; blocking findings: ...`
