# Roland Bug-Fix Catchment - Workplan

**Branch:** `feature/roland-bugfix`
**Worktree:** `~/work/audiocontrol-work/audiocontrol-roland-bugfix`

## Technical Approach

### Modules Affected

- `modules/roland-sxx0-editor` (primary)
- `modules/editor-core` (only where a shared primitive needs adjustment)
- Possibly `modules/sampler-devices` / `modules/sampler-midi` (only if a protocol bug surfaces)
- Possibly `modules/e2e-infra` (only if a hardware-touching repro needs a diagnostic)

### Strategy

- One bug per commit; descriptive commit messages; no sweep refactors.
- Verify visually (screenshot or test-harness check) before claiming done — `make test-ui-roland` green is not the same as visual correctness.
- For any CSS edit touching shared rules, run the duplication gate (`make check-css-duplication`) before commit and prefer reuse over new primitives.
- For any hardware-touching bug, build the diagnostic in `e2e-infra/` before hypothesizing — don't blame the device.
- After each fix, re-run the load-bearing test gate independently (the controller is the CI gate).

## Phase 1: Rolling Bug-Fix Pass

**Deliverable:** Operator-declared completion. The branch ships (or ships in waves) once the operator says the post-redesign Roland surface is clean enough.

**Tasks:** Added to the triage table below as bugs are reported. No upfront task list — this phase is intentionally open-ended.

### Bug Triage Table

| ID | Reported | Surface | Description | Status | Commit |
|----|----------|---------|-------------|--------|--------|
| BUG-001 | 2026-05-20 | LibraryPage — ExportToneDialog / ExportPatchDialog | Drag tone/patch from device to library opens the export dialog, but clicking "Export" does nothing — no progress, no error, no console message. Root cause: the dialog's `try { await onExport(...) } catch { /* parent will handle */ }` swallows the exception, AND the parent hook (`useLibraryExport.handleExportTone` / `handleExportPatch`) throws synchronously on precondition misses (e.g. `!libraryHandle`, `!clientRef.current`) **before** calling `setExportError`, so `operationError` is never set either. Fix: surface the caught exception via `setLocalError(...)` in both dialogs so the existing `OperationErrorBanner` renders the actual failure. | Awaiting operator retest | — |
| BUG-002 | 2026-05-20 | LibraryPage — ImportToneDialog / ImportSampleDialog | Same empty-catch shape as BUG-001 — sibling occurrences flagged during the BUG-001 investigation. Surface separately to keep one bug per commit per the workplan's "no while-I-was-in-here" rule. | Open | — |
| BUG-003 | 2026-05-20 | E2E `device-library-roundtrip.spec.ts` "tone round trip" | Test hangs at `Click locator('a[href$="/tones"]')` during navigation from the import-success state back to the Tones page. Pre-existing, unrelated to BUG-001 (surfaced because we re-ran the e2e gate while verifying BUG-001). Likely the tones nav link selector drifted or the link is being intercepted by a residual dialog/overlay. Existing test never actually verifies the `export-confirm` click path because it dies upstream. | Open | — |
| BUG-004 | 2026-05-20 | E2E `device-library-autofit.spec.ts` "tone auto-fit round trip" | Test fails finding `button:has-text("Refresh Device")` — UI affordance has been removed or renamed and the spec wasn't updated. Surfaced alongside BUG-003. | Open | — |

### Per-Fix Acceptance Criteria

Each fix must satisfy all of:

- Visual verification of the reproduction (screenshot or test-harness check)
- `make test-ui-roland` green at the fix commit
- `make check-css-duplication` clean at the fix commit (only if CSS touched)
- Operator confirms the bug is resolved before the row is marked `Closed`

A fix is not "done" until the operator has confirmed the row. `Closed` in the table means operator-confirmed.

## Phase 2: Scope-Discovery Audit + Duplication Findings

**Issue:** [#442](https://github.com/audiocontrol-org/audiocontrol/issues/442)

**Why now:** Per [`docs/analysis/s550-redesign-scope-discovery.md`](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/docs/analysis/s550-redesign-scope-discovery.md), the s550 redesign tail ran for ~5 days of brute-force fixes because no upfront route inventory was produced — every fix was operator-surfaced one screenshot at a time. Phase 1's bug-triage table captures the OPERATOR-surfaced findings against the post-merge surface; Phase 2 captures the AGENT-surfaced findings via systematic discovery. Roland surface is stable post-PR-#440 so this is the right time to do the audit retroactively, before the next redesign cycle.

**Deliverable:** A complete inventory at `docs/1.0/001-IN-PROGRESS/roland-bugfix/scope-audit.md` covering cross-route UX divergences, CSS / TypeScript duplication findings, and mockup-reference drift. Operator review of the inventory is the gate for Phase 3 (remediation).

### Tasks

1. **Run automated CSS-duplication detection.** `make check-css-duplication` (current state: zero findings; baseline pruned 2026-05-19). Re-run + record output to `scope-audit.md` § "Automated CSS findings" with the HEAD commit + timestamp. Zero findings is a valid result — record it explicitly so future passes can compare.

2. **Hunt for code-shaped duplication beyond CSS.** Grep across `modules/*-editor/src/`, `modules/editor-core/src/`, and `modules/sampler-library/src/` for sibling-shaped patterns:
   - Hooks: `useExport*`, `useImport*`, `useDevice*`, `useLibrary*` — pair-check for shared shape that should be extracted.
   - Drop handlers: `handleDropDevice*` / `handleDropLibrary*` — check for repeated try/catch + dialog-state shapes (this is the acknowledged `handleExportTone` / `handleExportPatch` / `handleBatchExport` debt from PR #440).
   - Strategy implementations: `useRolandLibraryStrategy` vs `useAkaiLibraryStrategy` — verify shared contract surface holds; flag drift.
   Record each candidate pair as a row in `scope-audit.md` § "Code-duplication candidates": file:line, similarity assessment, recommendation (extract / keep separate + why).

3. **Run the route-inventory protocol per `docs/analysis/s550-redesign-scope-discovery.md` §5.1.** For each Roland route × device combination:
   - Routes: `/connect`, `/play`, `/patches`, `/tones`, `/library`
   - Devices: `s330`, `s550`
   - Scenarios: at least `load-everything` for each route that supports it
   - Per (route, device, scenario): start dev server (`make` + `pnpm dev` in roland-sxx0-editor or via the test harness runner), `browser_navigate` at 1440×900 viewport, `browser_take_screenshot` to `.tmp/scope-audit/<device>-<route>-<scenario>.png`, `browser_evaluate` a DOM-walk script that captures: (a) distinct `className=` tokens, (b) `getBoundingClientRect()` for instances of known primitive classes (`.ac-page-title-row`, `.ac-detail-head`, `.ac-list-row`, `.ac-list-bank-header`, `.ac-tree-node`, `.ac-toolbar-btn`, `.ac-card`, `.ac-vfd`, `.ac-chevron`), (c) computed font-family / font-size / border-radius / padding for each, writing to `.tmp/scope-audit/<device>-<route>-<scenario>.json`.

4. **Diff route matrices pairwise.** Add `tools/diff-scope-audit.ts` (~150 LOC max) that reads every JSON snapshot under `.tmp/scope-audit/`, groups by primitive class, and emits a divergence table for each: `class | route-A | route-B | property | value-A | value-B`. Default sort by visibility (a 4px height drift across all 5 routes outranks a 1px border-radius drift on one route). Write the table to `scope-audit.md` § "Cross-route UX divergences".

5. **Cross-check against the design-language mockups.** Read `docs/1.0/003-COMPLETE/s550-support/explorations/*.html` (the seven page-level mockups from 2026-05-08 that established the v3 design language). For each route, compare the captured screenshot against the corresponding mockup and note drift in `scope-audit.md` § "Mockup-reference divergences". Honest gaps acceptable here (e.g. "no mockup exists for `/library`'s SetItem hover state" is a valid row).

6. **Operator-review checkpoint.** Present `scope-audit.md` to the operator with a section-by-section walkthrough. For each finding, the operator marks `Accept` (goes to Phase 3) / `Defer` (rows-but-doesn't-block) / `Reject` (not actually a divergence — close out with reasoning).

7. **Hand off to Phase 3.** For every `Accept`-marked finding, draft a Phase 3 task row in the table below. Phase 3 task breakdown itself is generated via `superpowers:writing-plans` once Phase 2's inventory is operator-accepted (not done in this phase — the tasks emerge from the findings).

### Phase 2 acceptance

- `scope-audit.md` exists with all five sections populated (automated CSS, code-duplication candidates, cross-route UX divergences, mockup-reference divergences, operator-review log).
- Every Roland route × device combination has both a screenshot AND a JSON DOM-snapshot under `.tmp/scope-audit/`.
- `tools/diff-scope-audit.ts` exists, is invoked from a `make scope-audit` target, and is documented in the audit-log section header.
- Operator has marked each finding `Accept` / `Defer` / `Reject` in the inventory's status column.
- Phase 3 table (below) is populated with one row per Accept-marked finding.

### Discovery findings → remediation triage table

Populated at the close of Phase 2 (one row per Accept-marked finding). Phase 3 implementation tasks are generated from this table.

| ID | Source | Surface | Divergence | Remediation outline | Status |
|----|--------|---------|------------|---------------------|--------|
| (pending Phase 2 completion) | | | | | |

## Phase 3: Remediation Pass

**Gate:** Phase 2 inventory complete + operator-accepted. Do NOT start before then.

**Deliverable:** One commit per Accept-marked finding from Phase 2, following the same per-fix acceptance gates as Phase 1 (visual verification + `make test-ui-roland` green + duplication-check clean if CSS touched + operator confirmation).

**Task breakdown:** Generated via `superpowers:writing-plans` against the Phase 2 inventory once Phase 2 closes. Each accepted finding becomes a Phase 3 task with file paths, code, test, and commit per the writing-plans skill's contract. The plan is saved to `docs/superpowers/plans/<date>-roland-scope-audit-remediation.md`.

**Phase 3 acceptance:** Every Accept-marked finding from Phase 2 has a commit on this branch with operator confirmation in the triage table above.

## Pre-commit Discipline

- One bug per commit; descriptive subject; no sweep refactors slipped in alongside a fix
- No "while I was in here" sibling changes — they get their own commit and their own triage row
- For hardware-touching bugs, ship the diagnostic alongside the fix; don't fabricate device-failure narratives without first proving four things: (a) the request the editor sent was correct, (b) the response the device returned was parsed correctly, (c) the parsed response was rendered correctly, (d) the round-trip survives a re-readback
- The controller re-runs the load-bearing test gate independently after every implementer dispatch — the implementer's reported pass count is a claim, not evidence (see [`.claude/rules/agent-discipline.md`](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/.claude/rules/agent-discipline.md))

## GitHub Tracking

- **Parent issue:** TBD (created via `/feature-issues`)
- **Implementation issues:** per-bug, opened as found; each triage row links its issue number when one is filed

## Out of Scope

Repeated from the PRD for in-context reference:

- New features or capability additions — those get their own branch
- Refactors larger than what's needed to fix a specific bug
- Tone/patch data-model changes that would require a new PRD
- [#407](https://github.com/audiocontrol-org/audiocontrol/issues/407) (D-SYS page) and [#409](https://github.com/audiocontrol-org/audiocontrol/issues/409) (Copy/Derive) — missing-affordance enhancements, not bugs
