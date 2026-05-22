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
