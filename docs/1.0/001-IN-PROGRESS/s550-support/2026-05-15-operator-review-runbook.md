---
deskwork:
  id: fed7e6aa-b6b6-4145-88c0-8c9d67d7387e
---
## Operator Review Runbook — 2026-05-15

**Branch:** `feature/s550-support` at `f59b7ea9` or later.
**Worktree:** `~/work/audiocontrol-work/audiocontrol-s550-support`
**Hardware:** Live S-550 connected on `Volt 4` is required for Section 2; Section 1 is hardware-free.

## Purpose

Single landing surface for everything you (the operator) need to verify and sign off on at the current moment in `feature/s550-support`. The controller's actionable queue is empty until you complete at least Section 1; completing all sections unblocks 9R-B and confirms the four "awaiting auditor re-run" findings.

This runbook is a **snapshot** of the verification state at `f59b7ea9` and will go stale as work advances — it is intentionally dated. Re-generate when the picture changes.

## At-a-glance status

| Item | What it unblocks | Hardware? | ETA effort |
|---|---|---|---|
| §1 — `D-TONE-ENV-02` Tier 4 sign-off | 9R-B (the entire primitive remediation track) | No | ~10 min |
| §2.1 — `#426` post-fix structural re-run | Audit-log `verified-<date>` flip | No | ~3 min |
| §2.2 — `#425` live re-run | Audit-log `verified-<date>` flip | Yes | ~5 min |
| §2.3 — `#428` live re-run | Audit-log `verified-<date>` flip | Yes | ~10 min |
| §2.4 — `#430` + `#431` live re-runs | Captures `time-since-send` evidence for next §Task 6 investigation | Yes | ~15 min |

Total: ~45 min with hardware; ~13 min without.

## Prerequisites

1. Branch checked out and clean:
   ```bash
   git status                      # working tree clean
   git rev-parse HEAD              # f59b7ea9 or later
   ```
2. Build current:
   ```bash
   make                            # installs deps + builds in dependency order
   ```
3. For Section 2: S-550 powered on, USB-MIDI bridge on `Volt 4`, and the SCSI bridge if Library Save/Load is in scope.

---

## §1 — Tier 4 sign-off on `D-TONE-ENV-02` (THE 9R UNBLOCKER)

This is the single most important item. Without it, `9R-A.4` cannot close, which means `9R-B` (primitive remediation — the actual fix for `#424`'s slider regression) cannot start, which means `9R-C` (page rebuild) cannot start, which means `9R-D` (operator holistic gate) cannot start. The entire Phase 9 remediation chain is gated on this one row.

The work being signed off: the Tier 2 contract spec + Tier 3 in-context spec for the `D-TONE-ENV-02` capability (TVF envelope per-segment rate editing) landed in 9R-A.4 and pass `pnpm run check-credibility` (3/3 credible — 1 Tier 2 + 2 Tier 3 broken-context variants). The remaining gap is Tier 4: the operator's explicit acknowledgement that the spec describes the correct behavior.

### 1.1 — Verify the credibility baseline

```bash
pnpm run check-credibility
```

Confirm:
- Output reports `3/3 credible` (or higher if other credibility-declared specs have landed).
- No `UNEXPECTED_PASS_BROKEN` or `UNEXPECTED_FAIL_UNBROKEN` entries.

```bash
make check-coverage-roland
```

Confirm:
- `D-TONE-ENV-02` row in the manifest shows `coverage: partial` (Tier 2 + Tier 3 landed; Tier 4 not yet signed).
- Exit code is non-zero (135 other rows still report `coverage: none` — that's the starting state for 9R-B/C, not a regression).

### 1.2 — Record the sign-off

Open [`ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md`](../../../ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md) and find the `D-TONE-ENV-02` row in the Tones / Envelopes section. The row currently reads:

```markdown
| D-TONE-ENV-02 | Edit TVF envelope per-segment rate (8 rates; 1–127 each) | `EnvelopeEditor.tsx` → rates inputs | C-TONE-12 | native | implemented | none | partial |
```

Replace the `Sign-off` column value (currently `none`) with the canonical format: `<YYYY-MM-DD> <signer> <sha>`. For example:

```markdown
| D-TONE-ENV-02 | Edit TVF envelope per-segment rate (8 rates; 1–127 each) | `EnvelopeEditor.tsx` → rates inputs | C-TONE-12 | native | implemented | 2026-05-15 oletizi f59b7ea9 | partial |
```

The `<sha>` is the HEAD commit at the moment of sign-off (use `git rev-parse --short=8 HEAD`).

### 1.3 — Verify the confidence flip

```bash
make check-coverage-roland
```

Confirm:
- `D-TONE-ENV-02` row in the manifest now shows `coverage: confident` (Tier 2 + Tier 3 + Tier 4 all present).
- The `Coverage` column in the inventory has been regenerated to `confident` (the manifest generator updates this column automatically).
- The `Sign-off` column remains exactly as written (the generator preserves it byte-identical).

### 1.4 — Smoke test the dependency wiring

This confirms the pipeline reacts correctly to Tier 3 spec removal — proves Tier 3 evidence is load-bearing, not decorative.

```bash
mv modules/roland-sxx0-editor/test/ui/in-context/tones.envelope.in-context.spec.ts{,.disabled}
make check-coverage-roland
```

Confirm: `D-TONE-ENV-02` drops to `coverage: partial`.

Restore:

```bash
mv modules/roland-sxx0-editor/test/ui/in-context/tones.envelope.in-context.spec.ts{.disabled,}
make check-coverage-roland
```

Confirm: `D-TONE-ENV-02` returns to `coverage: confident`.

### 1.5 — Commit the sign-off

```bash
git add ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md docs/1.0/001-IN-PROGRESS/s550-support/coverage-manifest.json docs/1.0/001-IN-PROGRESS/s550-support/coverage-manifest.md
# Or whichever manifest paths the generator wrote — `make check-coverage-roland` reports them.
git commit -m "feat(inventory): D-TONE-ENV-02 Tier 4 sign-off — 9R-A.4 closes"
git push
```

After push, workplan §9R-A.4 boxes 3-5 ([ ] Tier 4 / [ ] check-coverage / [ ] smoke test) are all met. `/dwi` can now dispatch on 9R-B.

---

## §2 — Auditor live re-runs (verify pending fixes)

Each `fixed-<sha>` finding in [`audit-log.md`](./audit-log.md) is waiting for an independent re-run to flip to `verified-<date>`. The auditor persona owns these re-runs; in this multi-machine workflow, the operator runs them on the machine with live hardware (orion-m4 with the S-550 on `Volt 4`).

For each item below: run the command, capture the output, decide if the finding's closure gate is met, then flip the audit-log Status accordingly.

### 2.1 — `AUDIT-20260514-FU3-01` / `#426` — root `test/ui/` test-discipline gap (`fixed-215308b5`)

Hardware-free. Verify by re-running the structural gate.

```bash
# Grep audit — must return zero functional hits
grep -rn "getByTestId\|\.click()" modules/roland-sxx0-editor/test/ui/

# Test suites — must match post-fix counts
make test-wiring-roland         # expect: 137 passed
make test-ui-roland             # expect: 6 passed
make test-rendering-roland      # expect: 24 passed + 4 skipped

# ESLint scope verification — hypothetical root-of-test/ui/ file is gated
pnpm exec eslint --print-config modules/roland-sxx0-editor/test/ui/hypothetical.spec.ts 2>&1 \
  | python3 -c "import json,sys; c=json.load(sys.stdin); print('plugins:', c.get('plugins')); print('rules:', [k for k in c.get('rules',{}) if 'test-discipline' in k])"
# expect: plugin '@audiocontrol/test-discipline' present + both discipline rules listed
```

**Closure gate met if:** grep returns zero functional hits (docstring/README hits naming the patterns as forbidden are acceptable), all three test counts match, ESLint print-config shows the widened scope applies.

**Flip:** in [`audit-log.md`](./audit-log.md), find `Status: fixed-215308b5` for `AUDIT-20260514-FU3-01` and change to:
```
Status: verified-2026-05-15 (auditor re-ran the structural gate; grep clean, counts match, ESLint scope confirmed.)
```

---

### 2.2 — `AUDIT-20260514-FU3-02` / `#425` — `ImportSamplesDialog` slot-occupancy (`fixed-12ef2c18`)

Hardware required. Verify by running the Tier 3 in-context spec against the live S-550 import flow + manually exercising the dialog through the editor.

```bash
# Tier 3 in-context — should be 1 passing spec
make test-ui-roland ARGS="--grep import-samples"
```

Then manually on `/roland/s550/editor/library`:

1. Drop a sample bundle onto the `DeviceMemoryPanel`.
2. Confirm the `ImportSamplesDialog` opens with the correct occupied/empty labelling for each slot (no `T0 — T0` arithmetic-only labels; slot names should derive from `memoryLayout.formatToneSlot(toneIndex)`).
3. Confirm that overwrite indicators light up only for occupied slots (not for empty ones, and not for all slots regardless of state).
4. Exercise both single-slot and range-selection occupancy patterns to confirm `hasOccupiedToneRange` / `hasOccupiedPatchRange` work.

**Closure gate met if:** Tier 3 spec passes + manual labelling + overwrite indicators behave correctly on real hardware.

**Flip:** in `audit-log.md`, find `Status: fixed-12ef2c18` for `AUDIT-20260514-FU3-02` and change to:
```
Status: verified-2026-05-15 (auditor re-ran Tier 3 spec + manual dialog exercise on live S-550 hardware; slot-occupancy labels + overwrite indicators correct across single-slot and range patterns.)
```

Also: `gh issue close 425 --comment "Verified on live hardware 2026-05-15."`

---

### 2.3 — `LIVE-S550-TONES-001` / `#428` — `ToneList` bank-header pointer interception (`fixed-84810484`)

Hardware required. Verify by running the auditor's live spec.

```bash
make test-e2e-roland-device-conformance ARGS="--grep 's550-D-TONE-live-envelope-and-slider'"
```

The previous failure was: bank-header sticky overlay was intercepting clicks on the row directly below it during the tone-list load→loaded transition. After commit `84810484` added `pointer-events: none` to `.ac-list-bank-header`, the row beneath should be reachable.

**Closure gate met if:** the live spec reaches the envelope editor (gets past the tone-row click step) AND succeeds at the cutoff / sustain assertion that previously couldn't run.

**Flip:** in `audit-log.md`, find `Status: fixed-84810484` for `LIVE-S550-TONES-001` and change to:
```
Status: verified-2026-05-15 (auditor re-ran s550-D-TONE-live-envelope-and-slider.spec.ts on live S-550; tone-row selection now reaches the editor and the envelope/slider assertions pass.)
```

Also: `gh issue close 428 --comment "Verified on live hardware 2026-05-15."`

---

### 2.4 — `LIVE-S550-LIB-002` + `LIVE-S550-PATCH-001` / `#430` + `#431` — RQD/stale-RJC defect class (`acknowledged`, diagnostic-only landed in `9d1166a0`)

Hardware required. **This is not a verification re-run — it is an evidence-capture run.** Commit `9d1166a0` landed Branch B (diagnostic instrumentation only); the underlying defect class is still under investigation. The next live re-run captures `time-since-send` data that drives the next investigation step.

```bash
# Library save flow (LIB-002 / #430)
make test-e2e-roland-device-conformance ARGS="--grep 's550-D-LIB-live-core'"

# Patch-bank load (PATCH-001 / #431)
make test-e2e-roland-device-conformance ARGS="--grep 's550-D-PATCH-live-core'"
```

For each run, capture the browser console output where the new log format appears:

```
[S-550] Ignoring stale RJC during RQD: addr=[hh hh hh hh] time-since-send=Nms rjc-bytes=[hh hh hh hh hh hh]
```

What to look for:

- **If `time-since-send` < ~100ms** (RJC fires near send-time): likely a current-op rejection. The fix must escalate to fail-fast — the device is actually rejecting the inflight RQD; current "treat as stale" semantics are wrong.
- **If `time-since-send` > ~500ms** (RJC fires long after send): plausibly a stale tail from a prior timed-out operation. Different quiescence or retry strategy required at the orchestration layer.
- **If both specs pass** without the diagnostic log firing: the defect didn't reproduce this run; rerun a few times to characterize frequency. Don't flip Status to `verified` — the underlying defect class isn't fixed, just absent in this run.

**Closure gate met:** ONLY if both `s550-D-LIB-live-core.spec.ts` and `s550-D-PATCH-live-core.spec.ts` pass on live hardware AND the stale-RJC log doesn't fire across multiple consecutive runs. Otherwise the findings stay `acknowledged` and the captured `time-since-send` evidence informs the next §Task 6 dispatch.

**If both pass cleanly:** flip both audit-log Status lines to `verified-2026-05-15`, close `#430` + `#431`, tick workplan §Phase-11-Task-6 boxes.

**If the diagnostic fires:** record the captured log lines as a fresh comment on `#430` (and/or `#431`) and respond to the controller's next `/dwi` with "Task 6 evidence captured — next investigation step needs the time-since-send data from comment X." Status stays `acknowledged`.

---

## §3 — What unblocks after this runbook

| You complete | Unblocks |
|---|---|
| §1 (D-TONE-ENV-02 sign-off) | Entire 9R chain: 9R-A.4 closes → 9R-B can start → 9R-C can start → 9R-D can start. Closes the `#424` / Phase 11 §2 primitive sweep path. |
| §2.1 (#426 structural verify) | Audit-log Status flip; no downstream gates (the fix was self-contained). |
| §2.2 (#425 live verify) | Audit-log Status flip; closes the ImportSamplesDialog finding chain. |
| §2.3 (#428 live verify) | Audit-log Status flip; one of the live findings the auditor surfaced 2026-05-15 closes. |
| §2.4 (#430 + #431 evidence) | Either closes the §Task 6 finding pair OR feeds the next dispatch with the timing data needed to choose the actual fix strategy (fail-fast vs quiescence/retry). |

After §1 is done, run `/dwi` to have the controller dispatch the next workplan task — that's 9R-B (primitive interactive contracts).

## §4 — Out of scope (don't do these in this runbook)

- **Don't author new Tier 2/3 specs** — controller owns those.
- **Don't address `#424` or `#423` directly** — both flow through 9R-B/C after `D-TONE-ENV-02` Tier 4 closes. Don't try to shortcut by editing primitives or page chrome.
- **Don't close `#430` / `#431` from a single passing run** — the defect class is timing-bound and intermittent; one clean run doesn't prove the fix landed (especially since no fix landed — only diagnostic instrumentation).
- **Don't fabricate sign-offs** — every `Sign-off` column entry must reflect actual hardware exercise of the affordance. If you didn't drag the envelope handle on real hardware, the row stays unsigned.

## §5 — End-of-session checklist

After completing the sections above, before invoking `/dwi` again, confirm:

- [ ] `D-TONE-ENV-02` `Sign-off` column populated with `<YYYY-MM-DD> <signer> <sha>` in the inventory.
- [ ] `make check-coverage-roland` reports `D-TONE-ENV-02` as `coverage: confident`.
- [ ] Audit-log Status lines flipped for every finding whose closure gate was met (`fixed-<sha>` → `verified-<date>`).
- [ ] GitHub issues closed for each verified finding (`gh issue close <N>` with a one-line verification comment citing the live spec + date).
- [ ] `grep ^Status: open audit-log.md` returns zero hits.
- [ ] DEVELOPMENT-NOTES.md entry added describing what was verified, what was rejected, and any captured `time-since-send` evidence for §Task 6.
- [ ] All sign-off commits pushed to `origin/feature/s550-support`.

## §6 — If something is wrong

If a verification rejects a finding's fix (closure gate not met):

1. **Don't flip Status to `verified`.** Status stays `fixed-<sha>` until the actual fix lands.
2. **File a new finding-ID** in `audit-log.md` describing what specifically failed (selector didn't match, count wrong, hardware behavior diverged from spec, etc.).
3. **Don't close the existing GitHub issue.** Comment with the rejection evidence and leave it open.
4. **Invoke `/dwi`** — the controller will pick up the new finding via the audit-log Status grep and re-dispatch.

This is the same protocol as filing any other audit finding; the only special case is that the closure context is "fix landed but failed verification" rather than "new defect class surfaced."
