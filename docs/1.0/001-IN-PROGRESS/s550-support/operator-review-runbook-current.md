---
deskwork:
  id: f5d44e33-5cb5-4e3e-b8f3-e796673b8f32
---
# Operator Review Runbook — Current HEAD

Start with [operator-signoff-summary.md](./operator-signoff-summary.md) if you want the shortest explanation of the current decision state. Return here when you are ready to perform the remaining manual review steps.

This runbook contains only actions the operator is uniquely able to perform: live UI review, hardware judgment, sign-off decisions, and final recording. Auditor-owned reruns and machine checks have already been executed and are summarized here as input evidence.

## Result To Record

- `Operator sign-off granted for the requested scope`
- `Operator sign-off not yet granted; blocking findings: ...`

## Before You Start

- use [operator-signoff-summary.md](./operator-signoff-summary.md) for the short current-state view
- use [audit-log.md](./audit-log.md) only if you want deeper evidence or history
- otherwise, continue directly into the cards below

## Review Cards

### Card 1 — `D-TONE-ENV-02`

**Behavior to judge**

- TVF envelope per-segment rate editing on real hardware

**Where to look**

- route: `/roland/s550/editor/tones`
- area: `Filter` tab

**Known evidence**

- auditor-owned Tier 2 and Tier 3 evidence already exists
- the remaining question is the Tier 4 operator judgment

**Sign off if**

- the visible control is understandable
- the edited segment/rate feels like the correct hardware-facing affordance
- nothing about the interaction suggests the existing evidence is validating the wrong thing

**If blocked**

- do not sign it off
- record the blocking finding ID or a short plain-language reason

**If signed off**

- update the `Sign-off` cell for `D-TONE-ENV-02` in [ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md:337)
- use canonical format: `<YYYY-MM-DD> <signer> <sha>`

### Card 2 — `AUDIT-20260514-FU3-02` / `#425`

**Behavior to judge**

- live `ImportSamplesDialog` correctness

**Where to look**

- route: `/roland/s550/editor/library`
- dialog: `ImportSamplesDialog`

**Known evidence**

- Tier 3 auditor evidence already passed on 2026-05-16

**Sign off if**

- slot labels derive from the real memory layout
- overwrite indicators appear only on genuinely occupied slots
- both single-slot and range cases make sense visually and behaviorally
- the live dialog behavior matches the now-passing Tier 3 evidence

**If blocked**

- leave `AUDIT-20260514-FU3-02` unverified
- note whether the problem is the live UI itself or a mismatch between the live UI and the Tier 3 evidence

### Card 3 — `LIVE-S550-TONES-002`

**Decision to make**

- does this finding block the sign-off scope you are being asked to grant?

**Known evidence**

- the old row-selection blocker is gone
- the live battery now reaches the real editor controls
- `D-TONE-TVF-02` cutoff readback mismatched by `38`
- `D-TONE-ENV-10` stalled during the visible TVA sustain interaction and hit the watchdog

**Record one of**

- `blocks sign-off`
- `out of scope for this sign-off`

### Card 4 — `LIVE-S550-LIB-002`

**Decision to make**

- does this finding block the sign-off scope you are being asked to grant?

**Known evidence**

- the live save path still fails
- updated failure shape: tone `0` save fails with `Wave data request rejected`
- OPFS set directory is never created

**Record one of**

- `blocks sign-off`
- `out of scope for this sign-off`

## Final recording

If every required card above signs off:

- update the relevant `Sign-off` cells
- flip any findings you are explicitly verifying in [audit-log.md](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/docs/1.0/001-IN-PROGRESS/s550-support/audit-log.md)
- record the closure outcome in `DEVELOPMENT-NOTES.md`
- state clearly: `Operator sign-off granted for the requested scope`

If anything remains blocked:

- do not grant sign-off
- list the blocking finding IDs explicitly
- state clearly: `Operator sign-off not yet granted; blocking findings: ...`
