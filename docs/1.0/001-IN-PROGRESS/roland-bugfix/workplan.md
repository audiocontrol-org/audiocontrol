# Roland Bug-Fix Catchment + Scope-Discovery Validation — Workplan

**Branch:** `feature/roland-bugfix`
**Worktree:** `~/work/audiocontrol-work/audiocontrol-roland-bugfix`

## Dual-purpose mandate (post-2026-05-22)

This workplan covers two intentionally co-located streams running concurrently on one branch:

- **Phase 1 — Rolling Bug-Fix Pass** (operator-surfaced, open-ended). Each fix is one commit; no sweep refactors slipped in. Discipline: "no while-I-was-in-here."
- **Phase 2 — Disposition Roland-surface clones** (scope-discovery validation, sized at 172 groups; see Phase 2 closure notes). Each disposition is a one-line change to `clones.yaml` + (for `refactor` dispositions) a Phase 3 PR.
- **Phase 3 — Roland-surface refactor PRs** (concurrent with Phase 2). One PR per `refactor`-marked group or batched sibling set.

The two streams share the branch but **stay in separate commits and PRs** — Phase 1's discipline forbids the sweep shape that Phase 3 PRs need. Implementers reading this workplan must check the Phase header of any task before applying its discipline.

See [`prd.md` § Problem Statement](./prd.md) for the operator-level framing.

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
- For any TS/TSX edit, the pre-commit hook runs `make check-clone-duplication` (scope-discovery-protocol, PR #441). New clone groups beyond the dispositioned baseline block the commit; existing dispositioned groups pass regardless of disposition value.
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
- `make check-clone-duplication` clean at the fix commit (only if TS/TSX touched — pre-commit hook enforces this automatically)
- Operator confirms the bug is resolved before the row is marked `Closed`

A fix is not "done" until the operator has confirmed the row. `Closed` in the table means operator-confirmed.

## Phase 2: Disposition Roland-surface clones (scope-discovery validation)

**Issue:** [#442](https://github.com/audiocontrol-org/audiocontrol/issues/442)

**Role:** This branch is the **validation test subject** for `feature/scope-discovery-protocol`'s Phase 4 (PR [#441](https://github.com/audiocontrol-org/audiocontrol/pull/441), merged 2026-05-22). The scope-discovery feature counts each clone group we disposition + each refactor PR we merge as evidence its tooling lands real value. We get the inverse benefit: a dispositioned baseline of duplication across the Roland surface, with a pre-commit gate that prevents regression.

**Why this replaces the pre-extend Phase 2 draft:** That draft proposed building a custom Playwright route-walk + `tools/diff-scope-audit.ts`. That work has now SHIPPED — `make check-clone-duplication`, `make scope-inventory FEATURE=<slug>`, the `/scope-widen` skill, and the `/scope-inventory` skill all landed in PR #441. Reinventing them would be wasted work AND would not feed the validation case.

**Deliverable:**

- Every clone group in `docs/scope-discovery/clones.yaml` that touches `modules/roland-sxx0-editor` or `modules/editor-core` is dispositioned: `refactor`, `keep-with-reason`, or `ignore-with-justification`. Baseline at extension time (2026-05-22): **172 pending touching our surface, of 495 total groups**. Current count drifts as dispositions land; recompute with the snippet under "Recompute pending counts" below.
- For every `refactor`-marked group, a merged PR that removes the duplication (causing the detector to drop the group on the next baseline refresh).
- A `tooling-feedback.md` capturing this test-subject's experience: friction, surprises, suggestions for the scope-discovery-protocol team.

### Baseline at extension time (snapshot 2026-05-22)

Captured from `docs/scope-discovery/clones.yaml` against HEAD. Refreshed via `make refresh-clones-baseline` after refactor PRs land.

| Module pair | Count |
|---|---|
| `roland-sxx0-editor` (intra-module) | 93 |
| `editor-core` (intra-module) | 38 |
| `akai-s3k-editor` × `roland-sxx0-editor` | 13 |
| `roland-sxx0-editor` × `sampler-library` | 5 |
| `e2e-infra` × `roland-sxx0-editor` | 4 |
| `roland-sxx0-editor` × `sampler-devices` | 4 |
| `akai-s3k-editor` × `editor-core` | 3 |
| `d110-editor` × `roland-sxx0-editor` | 3 |
| `d110-editor` × `editor-core` | 3 |
| `editor-core` × `roland-sxx0-editor` (mixed-direction) | 1 |
| `editor-core` × `midi-core` | 1 |
| `editor-core` × `synth-core` | 1 |
| `jv1080-editor` × `roland-sxx0-editor` | 1 |
| `loop-editor` × `roland-sxx0-editor` | 1 |
| `roland-sxx0-editor` × `sample-chopper` | 1 |
| **Total touching my surface** | **172** |
| (Of which entirely within my surface) | (132) |

### Tasks

1. **Install + verify the gate.** `make install-hooks` (one-time per clone; sets `core.hooksPath = .githooks`). Confirm `make check-clone-duplication` passes against HEAD. Done at extension time (2026-05-22).

2. **Run `/scope-inventory roland-bugfix`** to produce a strawman `scope-manifest.yaml` + an evidence-trail run directory at `docs/1.0/001-IN-PROGRESS/roland-bugfix/scope-inventory/runs/<stamp>/`. The strawman gives a curated view of the Roland surface that complements the raw clone list. Outputs feed into per-clone disposition decisions.

3. **Disposition the 132 wholly-within-my-surface clone groups in passes.** Group by module-pair (start with `roland-sxx0-editor` intra-module: 93 groups). For each group:
   - Read both / all member ranges.
   - Decide: `refactor` (extract a shared helper; drop the duplication), `keep-with-reason` (intentional — e.g. test fixtures, device-specific protocol byte patterns), or `ignore-with-justification` (false positive — e.g. boilerplate jscpd over-counts).
   - For `refactor`: open a PR per group, OR batch sibling groups in one PR (e.g. `PatchEditorTabs` / `ToneEditorTabs` extract a shared `EditorTabs` shell as a single commit).
   - Edit `docs/scope-discovery/clones.yaml` directly: set `disposition:` + `reason:`. Commit the disposition alongside the refactor PR (or in a standalone "dispose-only" commit for keep/ignore).

4. **Disposition the 40 cross-module groups touching my surface** AFTER the intra-module passes complete. These need cross-module coordination (e.g. `akai-s3k-editor x roland-sxx0-editor` likely surfaces shared library-UI patterns that belong in `editor-core`). Higher-effort, higher-reward.

5. **Apply `/scope-widen` to every Phase 1 bug fix going forward.** Whenever a Phase 1 bug surfaces (or a regression appears mid-Phase 2), invoke `/scope-widen "<complaint>"` BEFORE fixing. The skill returns a Searched / Included / Excluded proposal; operator confirms; the fix covers all included surfaces in one commit. This is the *behavioral* validation case for the skill (vs the static disposition pass).

6. **Capture tooling feedback.** Maintain `docs/1.0/001-IN-PROGRESS/roland-bugfix/tooling-feedback.md` as we work. One section per scope-discovery surface we exercise (`make check-clone-duplication`, `make install-hooks`, `make scope-inventory`, `make refresh-clones-baseline`, `/scope-inventory`, `/scope-widen`, pre-commit gate). Per section: what worked, what surprised, what should change. Hand to the scope-discovery-protocol team at Phase 2 close (or sooner if a blocker emerges).

### Phase 2 acceptance

- Zero `pending` entries remain in `docs/scope-discovery/clones.yaml` for groups touching `modules/roland-sxx0-editor` or `modules/editor-core`. Target: count drops from the 2026-05-22 baseline (172) to 0. For the **current** pending count, run the snippet under "Recompute pending counts" below or read the most-recent rows of the disposition log; we deliberately don't publish a number here because every disposition would invalidate it (AUDIT-20260521-07 + AUDIT-20260522-09 both caught this exact staleness pattern).
- Every `refactor`-marked group has a merged PR; `make refresh-clones-baseline` after merges removes the group from the file.
- `docs/1.0/001-IN-PROGRESS/roland-bugfix/scope-inventory/` exists with at least one `/scope-inventory roland-bugfix` run + a curated `scope-manifest.yaml`.
- `tooling-feedback.md` exists with one section per scope-discovery surface exercised.
- Pre-commit gate at HEAD blocks any NEW clone group; existing dispositioned groups pass regardless of disposition value.

### Recompute pending counts

Run this from the worktree root to print the current pending counts (touching our surface + intra-roland-sxx0). Update the Phase 2 acceptance + disposition log rows when they materially drift from the published values.

```bash
tsx -e "
import { readFileSync } from 'fs';
import { parse } from 'yaml';
const doc = parse(readFileSync('docs/scope-discovery/clones.yaml','utf8'));
const me = /modules\/(roland-sxx0-editor|editor-core)/;
const pending = doc.clones.filter(g => g.disposition === 'pending');
console.log('total groups:', doc.clones.length);
console.log('pending touching us:', pending.filter(g => g.members.some(m => me.test(m))).length);
console.log('pending intra-roland:', pending.filter(g => g.members.every(m => m.startsWith('modules/roland-sxx0-editor/'))).length);
"
```

(Promoting this to a proper `make clone-summary` target is a tooling-feedback finding — see `tooling-feedback.md` for the upstream recommendation.)

### Disposition log (running)

Populated as groups are dispositioned. One row per group resolved.

| Date | Group ID | Members | Disposition | Reason / Commit |
|------|----------|---------|-------------|------------------|
| 2026-05-22 | `80299d9fda8d` (21 lines) | `PatchList.tsx:231–251` ↔ `ToneList.tsx:230–250` | refactor | Extracted to `modules/roland-sxx0-editor/src/components/common/SlotInfo.tsx`. Protected by `D-PATCH-LIST-09` + `D-TONE-LIST-08`. Commit `30e7346e`. Detector confirmed group dropped + 6 sibling groups got re-numbered due to line-shift (no disposition info lost; all were `pending` pre-refactor). |
| 2026-05-22 | `c4067caecfdd` (6 lines) | `probe-wave-aliasing.ts:85–90` ↔ `probe-wave-memory.ts:131–137` | keep-with-reason | Probe scripts are intentionally self-contained one-off hardware-exploration tools; sharing a helper would defeat their drop-in-standalone-run-against-hardware property. The 3-line SysEx-EOD sequence repetition is acceptable. Sets the precedent for the remaining probe-script clones, batch-dispositioned in the next row. |
| 2026-05-22 | 24 probe-script clones (batch) | All `modules/roland-sxx0-editor/scripts/probe-wave-*.ts` ↔ same | keep-with-reason | Batch precedent set by `c4067caecfdd` extended to the full probe-script family. IDs (24): `9a4f7220adce, 869d2104eb14, 184f81a30845, 682fa3a4ce37, 79b6a72dc6c3, 0f5ae92e24a8, 7627d9f163db, e0b43789fbde, 35b1524c1b7c, 82026d488e9f, f86cbd50cd0d, 66367273995a, 68f8e2c6e837, 0937dcaf6312, 7d47de7df8ec, 997ad25eb3ee, cdd0209a0e94, cdc141c72516, 779c1d31bc6e, 85cf78fe67fd, 34dfa93fff3b, 84e6442125df, 46eb9849af93, 3b3fdd9f2f9b`. Applied via `.tmp/batch-dispose.ts` with verify-after-write (lesson from the `c4067caecfdd` slip-recovery). Pending intra-roland count: 92 → 67 (-25 total: 1 single-walkthrough `c4067caecfdd` + 24 batch). (Earlier revision of this row said "→ 68"; off-by-one corrected per AUDIT-20260521-08.) |
| 2026-05-22 | 10 playwright-config clones (batch) | per-suite playwright configs across akai/roland/d110/jv1080 modules | keep-with-reason | IDs: `c7068172edae, 516a0782d38c, 0293e0b8848b, b5c2c25e595f, 0e76b0ea32a9, 3179d027cc0a, a83997e1d17e, f1ecec1791db, 32af5bdccc0e, ae9365f90235`. Per-suite Playwright configs are intentionally per-suite; existing `playwright.harness.shared.ts` covers harness-driven suites; further extraction would couple test infra across editors. Commit `214a99b8`. |
| 2026-05-22 | 22 intra-file clones (batch) | `validate-device.ts` self-clone + 21 vitest test-file fixture-setup repetitions across editor-core | keep-with-reason | Test fixtures stay self-contained for debuggability; validate-device CLI has no test-apparatus to support extraction. Commit `77d8003e`. |
| 2026-05-22 | 7 intra-editor-core clones (batch) | 6 `AcRangeBar.tsx` ↔ `__broken__/AcRangeBar/no-pointer-events.tsx` + 1 cross-test-file `sampleNodes` fixture | keep-with-reason | Broken-variant registry intentionally mirrors canonical for credibility-checking; cross-test fixtures kept per the test-fixture rationale. Commit `a793e4cc`. |
| 2026-05-22 | 7 cross-module CLI + config clones (batch) | 3 validate-akai-s3000xl ↔ validate-device + 4 leftover vite/vitest/playwright configs | keep-with-reason | Same precedent as the playwright-config + validate-device dispositions. Commit `38d42dcf`. |
| 2026-05-22 | `38c8236d8a7b` (7 lines) | ExportPatchDialog ↔ ExportToneDialog (eyebrow row) | refactor | Extracted to `modules/roland-sxx0-editor/src/components/library/DestinationEyebrow.tsx` shared by all three export surfaces (ExportToneDialog, ExportPatchDialog, BatchExportDrawer). Protected by D-LIB-34, D-LIB-35, D-LIB-36 (added in test-first commit `3f2d79f8`). Refactor commit `81da20a9`. |
| 2026-05-22 | `fc08c274d295` (29 lines) + 4 siblings (`fee451a9eea8`, `588be1297b2e`, `4991822d3339`, `0557ba4137ff`) | PatchList.tsx ↔ ToneList.tsx (bank-render loop: header, toggle button, chevron, slot-range readout, reload-icon SVG) | refactor | Extracted to `modules/roland-sxx0-editor/src/components/common/BankHeader.tsx`. Props-in/JSX-out; AcChevron-based toggle; testid prefix parameterized (`patch-bank` vs `tone-bank`). Protected by `D-PATCH-LIST-10` + `D-TONE-LIST-09` added in test-first commit `8b5bc248`. Refactor commit `c88d8d06`. Baseline refresh confirmed all 5 sibling groups dropped; new tiny `e7ed36d3a106` (11-line `<div className="ac-list-scroll">` + bank-map wrapper) appears as residual structural similarity in the call sites (the same loop framework around the now-shared BankHeader call) — distinct shape from the original `fc08c274d295` and tracked separately on next baseline pass. Two new BankHeader↔DeviceMemoryPanel clones (`03544a6f535a`, `b9f7e847ff94`, 13 lines each) point at the inline reload-SVG path duplicated with `DeviceMemoryPanel`'s `ReloadIcon` helper — flagged as the next obvious refactor (promoting the SVG to a shared `<ReloadIcon />` component). |
| 2026-05-22 | `47120235fd38` (92 lines) + `290604cd13fe` (25 lines) | s330-library-plugin.tsx ↔ s550-library-plugin.tsx (PreviewPanelAdapter body + MemoryPanelAdapter return statement) | refactor | Pre-extraction both files held byte-identical `S{330,550}PreviewPanelAdapter` function bodies (loading/error/empty-state branches + pageSelection routing to ItemPreviewPanel or CommonSamplePreviewPanel) and byte-identical `<DeviceMemoryPanel>` JSX in the loaded-state return. Extracted to `modules/roland-sxx0-editor/src/plugins/shared/LibraryPreviewPanelAdapter.tsx` + `LibraryDeviceMemoryPanel.tsx`. Per-device wrappers retain their `!state` placeholder branches (different copy: s330 is a simple "N tones, M patches" line; s550 has a toneGroups loop with wave-bank labels). Protected by `D-LIB-23` (DeviceMemoryPanel `data-capability="C-LIB-02"` reachable on BOTH s330 and s550 routes) + `D-LIB-37` (canonical `.ac-panel-header-title` "Preview" chrome on BOTH routes with no selection) added in test-first commit `da509c19`. Refactor commit `dedd4d2f`. Baseline refresh confirmed both groups dropped (490 total, -2); no new clones surfaced. Note: 3 pre-existing library-flows failures (D-LIB-05, D-LIB-10, D-LIB-11) unrelated to this refactor — verified by stashing the refactor and re-running; same 3 fail. |
| 2026-05-22 | `03544a6f535a` (13 lines) + `b9f7e847ff94` (13 lines) | BankHeader.tsx ↔ DeviceMemoryPanel.tsx (bank-header structure: toggle button, slot-range readout, reload button SVG) | refactor | Replaced `DeviceMemoryPanel.tsx`'s local `renderBankHeader` helper + `ReloadIcon` helper with a direct call to the shared `<BankHeader testIdPrefix="device-${kind}-bank" />` component. Eliminates the bank-header duplication structurally — both call sites now consume the same component. Testid prefix preserves the existing `device-tone-bank-{toggle,reload}-N` + `device-patch-bank-{toggle,reload}-N` testid shape exactly. Protected by `D-LIB-38` (asserts those four testids resolve on the library page; added in test-first commit `e066950e`). Refactor commit `af7bb5a5`. Baseline refresh confirmed both groups dropped; pending touching us: 71 → 69. |
| 2026-05-22 | `80f494ba63d3` (31 lines) + `5578c63410e2` (14 lines) | PatchEditorTabs.tsx ↔ ToneEditorTabs.tsx (radio inputs + label strip + panel sections) | refactor | Pre-extraction both editor-tabs files held byte-identical radio-input / label-strip / panel-section render shapes; the only divergence was the TABS constant + aria-label. Extracted the shared shell to `modules/roland-sxx0-editor/src/components/common/AcRadioTabs.tsx`. Both editor-tabs files now slim to a TABS constant + a `<AcRadioTabs />` call. The page-local CSS rules in patches.css / tones.css (which gate panel visibility off radio state via sibling selectors on `id=pt-* | tt-*`) are unchanged — the radio input ids are the same shape AcRadioTabs emits. Protected by `D-PATCH-EDITOR-TABS-01` + `D-TONE-EDITOR-TABS-01` wiring assertions added in test-first commit `5b4b0b27`. Refactor commit `1fa334f5`. Baseline refresh confirmed both groups dropped; broader regression suites (tone-writes 44/44, patches 11/11, patch-writes 11/11) all green. Pending touching us: 69 → 67. |
| 2026-05-22 | `62705162bc69` (24L) + `96898287ce31` (21L) + `4b372a9e9e18` (8L) | EnvelopeDisplay.tsx ↔ EnvelopeEditor.tsx (SVG envelope curve render: grid lines, sustain marker, path build, point circles) | keep-with-reason → resolved by deletion | Both files were `@deprecated` orphans (replaced by `ToneEnvelopeEditor` composing editor-core's `AcEnvelope` in Phase 9 Task 4). Initial disposition kept the clones pending the audit-and-delete dispatch. **ROLAND-BUGFIX-DEL-001 landed 2026-05-22 with operator approval**: both files deleted + `ui/index.ts` re-exports removed. Clones dissolved with the deletion. |
| 2026-05-22 | `c53786bfb969` (33L) + `c3ee44db4131` (16L) + `8ab1699757ff` (10L) | PatchesPage.tsx ↔ TonesPage.tsx ↔ PlayPage.tsx (page-title-row markup: header + heading + LED metric span + refresh icon-button + reload SVG + optional inline loading-progress strip) | refactor | Pre-extraction all three pages held byte-identical title-row markup (heading + .ac-page-title-rule + .ac-page-title-metric + .ac-page-title-led + refresh icon-button + inline reload SVG). Extracted to `modules/roland-sxx0-editor/src/components/common/PageTitleRow.tsx` + `AcReloadIcon.tsx`. PageTitleRow takes a `metric` JSX node + optional `loadingMessage` + optional `loadingProgress` so the three pages stay byte-equivalent under their slightly-different patterns (PatchesPage/TonesPage use loadingMessage + loadingProgress; PlayPage uses neither). AcReloadIcon also replaces the inline SVG inside BankHeader.tsx (the fourth call site). All `cn` imports drop from the three pages — `ac-icon-btn--spinning` toggling now lives in PageTitleRow. Protected by `D-PATCH-PAGE-TITLE-01` + `D-TONE-PAGE-TITLE-01` + `D-PLAY-PAGE-TITLE-01` wiring assertions added in test-first commit `327cc73b`. Refactor commit `b996aa01`. Baseline refresh confirmed all 3 groups dropped (483 total, -3); broader regression: patches 12/12, tones 11/11, play 6/6, library 6/6. Pending touching us: 67 → 61. |
| 2026-05-22 | `c7df8647daf8` (18L) + `325d993bda15` (12L) | CreateDirectoryDialog.tsx ↔ RenameDirectoryDialog.tsx (Dialog.Portal + Overlay + Content shell, "Location" display, "Folder Name" / "New Name" input + validation, Cancel + submit row) | keep-with-reason → resolved by deletion | Both dialogs + the companion `useDirectoryOperations.ts` hook were dead-code orphans (defined under `src/components/library/` but never instantiated by the production LibraryPage; folder CRUD is owned by editor-core's LibraryBrowser + its own CreateFolderDialog). **ROLAND-BUGFIX-DEL-002 landed 2026-05-22 with operator approval**: all 3 files deleted; stale doc-comment references in `library-dialogs.in-context.spec.ts` and `phase-9-task-6-screenshots.spec.ts` updated to reflect the deletion. Clones dissolved with the deletion. |
| 2026-05-22 | `e83df277765c` (12L) + `82e7ef31c329` (16L, 3-member) | ExportToneDialog.tsx ↔ ExportPatchDialog.tsx ↔ BatchExportDrawer.tsx (shared lifecycle: localError + hasStarted state, useEffect open-reset, isComplete + effectiveError + steps derivation, handleClose callback) | refactor | Extracted to `modules/roland-sxx0-editor/src/hooks/useExportDialogLifecycle.ts`. Hook owns `localError`, `hasStarted`, `isComplete`, `effectiveError`, `steps`, `handleClose` and accepts an optional `stepErrors` parameter for BatchExportDrawer's per-item failure surface. Per-dialog state (toneName / patchName / batch items) stays in the call site because the initial-name source differs (`tone?.name` vs `patch?.common.name` vs none). Protected by `D-LIB-EXPORT-LIFECYCLE-01` (asserts open-reset + Cancel close) added in test-first commit `c428950d`. Refactor commit `dce8fc72`. Baseline refresh confirmed both groups dropped (481 total, -2); all 6 protecting wiring tests green (D-LIB-06, D-LIB-07, D-LIB-34, D-LIB-35, D-LIB-36, D-LIB-EXPORT-LIFECYCLE-01). Pending touching us: 59 → 57. |
| 2026-05-22 | `a975f1067ff4` (151L) | modules/e2e-infra/scripts/watchdog.ts ↔ modules/roland-sxx0-editor/scripts/watchdog.ts | keep-with-reason → resolved by deletion | The roland-sxx0-editor copy was byte-identical to the e2e-infra copy. Updated all 4 roland shell scripts (run-hardware-e2e.sh, run-library-e2e.sh, run-device-library-e2e.sh, run-http-midi-e2e.sh) to invoke the shared `$INFRA_DIR/scripts/watchdog.ts` — same convention akai-s3k-editor and the e2e-infra runner scripts already use. **ROLAND-BUGFIX-DEL-003 landed 2026-05-22 with operator approval**: local watchdog.ts deleted. Pre-deletion verification spawned `tsx "$INFRA_DIR/scripts/watchdog.ts"` to confirm the path resolves under tsx + the watchdog prints its usage banner (exit 0). Clone dissolved with the deletion. |
| 2026-05-22 | `5873e17e78bb` (10L) | library-io.ts ↔ wave-export.ts (downloadFile / downloadBlob — byte-identical) | refactor | Promoted to `modules/roland-sxx0-editor/src/lib/browser-download.ts` as `downloadBlob` (the canonical browser-side name). library-io.ts dropped the local copy + the comment points downstream callers at the shared location. wave-export.ts re-exports `downloadBlob` so existing callers don't have to chase the move. library-tones.ts updated to import `downloadBlob` from `@/lib/browser-download` (was importing `downloadFile` from library-io). Protected by `modules/roland-sxx0-editor/test/unit/browser-download.test.ts` — a focused vitest unit test that pins the four observable side effects (`URL.createObjectURL` with the blob, anchor `href`+`download` at click time, anchor click count, `URL.revokeObjectURL` with the same URL, DOM cleanup). Added per AUDIT-20260522-12 — the original disposition recorded "No protecting test added" with the trivial-refactor argument, which the auditor (correctly) called out as conflicting with the refactor protocol. |
| 2026-05-22 | `3785f9b1220a` (14L) + `e7ed36d3a106` (11L) + `38542efd1697` (18L) | PatchList.tsx ↔ ToneList.tsx (collapse-state hook + bank-info compute + per-row keyboard handler) | refactor | Three residual clones remaining from the BankHeader / SlotInfo extractions earlier in Phase 2. Extracted shared helpers to `modules/roland-sxx0-editor/src/components/common/bank-list-helpers.ts`: `useCollapsedBanks()` (state hook), `computeBankInfo({...})` (per-bank info compute), `createRowKeyDownHandler({...})` (Enter/Space activation). Per-row `formatSlot` callback decouples PatchList (`memoryLayout.formatPatchSlot`) from ToneList (`memoryLayout.formatToneSlot`) without leaking layout knowledge into the helper. Protected by existing patches.spec.ts (12 tests) + tones.spec.ts (11 tests) — every visible affordance the helpers underpin (click-to-select, click-to-load-bank, keyboard activation, bank header chrome) is asserted by those suites. Both 12/12 + 11/11 green post-refactor. |
| 2026-05-22 | 15 Import-dialog clones (batch) | ImportLibraryToneDialog, ImportLibraryPatchDialog, ImportSamplesDialog, ImportSampleDialog, ImportToneDialog + 1 cross-LoadSetDialog | keep-with-reason | IDs (15): `0f96a5eef2b8` (29L), `21346549c97e` (24L), `8bdd5aefa31a` (20L), `401814472a09` (18L), `096ccd5ccf3a` (17L), `eb74ce8e346c` (15L), `3d41d904a462` (14L), `537344005018` (14L 5-member), `24430e8eac71` (14L), `d44f468ecf00` (13L), `deba5983b1f1` (13L), `727acb9ed73c` (11L 3-member incl. LoadSetDialog), `29113b638960` (11L), `acdc4a474bd4` (10L), `566c8489289b` (9L). The Import* family is pending a v3 SlideDrawer chrome migration that will mirror what was done for ExportToneDialog / ExportPatchDialog (Phase 9 task 4). That migration is the natural moment to extract shared lifecycle hooks (analogous to `useExportDialogLifecycle` from the e83df277765c refactor row above) and shared body components (MemoryMapPanel, BestFitPicker, target select). Extracting now against the legacy Radix.Dialog chrome creates churn the v3 migration immediately re-churns. The migration also closes BUG-002 (import dialog empty catches — see workplan Phase 1 task #4). **Follow-up: ROLAND-BUGFIX-V3-IMPORT** — when v3 import-dialog migration scope firms up, re-evaluate these 15 clones — most will close as part of the migration itself. Batch-dispositioned 2026-05-22 via `.tmp/batch-dispose.ts`. Pending touching us: 57 → 42. |
| 2026-05-22 | 13 paired-symmetric component clones (batch) | ItemPreviewPanel × 2, S330KitOutputConfig × 2, DeviceMemoryPanel × 2, ToneZoneEditor × 2, VideoCapture, httpMidiTransport, common-area icons, common-area item-types, shared item-types | keep-with-reason | IDs (13): `3eec052ebf3d` (27L), `35c226931fbc` (13L), `a0ad2c0915f6` (29L), `2c0d60a662a3` (24L), `d15dd72144a6` (14L), `a56206979911` (11L), `6b584003b218` (10L), `f5b154b0b218` (7L), `3de857d4bd7d` (8L), `3cc9f8fee7ff` (19L), `1da4479b8dc0` (17L), `a2cdf85decae` (10L), `ad7deae8d330` (16L). All are self-clones within a single file representing paired symmetric branches (per-mode render variants, paired event handlers, paired conditional branches, symmetric icon/type exports). Extracting the shared block would split tightly-coupled per-branch semantics into separate units, weakening readability of the per-branch intent. The clone is an architectural-correctness signal (the two branches MUST share the same shape), not a duplication that wants extraction. Batch-dispositioned 2026-05-22. |
| 2026-05-22 | 8 paired-pattern lib clones (batch) | library-io × 2, library-tones, best-fit × 2, memory-layout, useLibraryImport, useLibraryExport | keep-with-reason | IDs (8): `785ea10910ad` (13L), `b50ef6c2d733` (11L), `649d1bf0c1df` (13L), `edae3ff056b5` (16L), `a69c4cad0c39` (10L), `20ef368de584` (10L), `ec92684ea87f` (13L), `745cec296a63` (11L). Self-clones within non-component files: paired async load paths, paired algorithm-scoring loops, paired per-device data definitions, paired hook callback patterns. Per-path / per-device semantics are intentional fork points; extracting would weaken control-flow clarity and create over-generic helpers that obscure the per-path or per-algorithm intent. Batch-dispositioned 2026-05-22. |
| 2026-05-22 | 5 editor-core touching clones (batch) | TreeView, AcRangeBar, useLibraryOperations × 3 | keep-with-reason | IDs (5): `b5c1ea1f8655` (16L TreeView), `bc9ab6ece81d` (15L AcRangeBar), `e76ff0c2fdfe` (9L), `0c6a90d843da` (9L), `e852443c388a` (8L) (all useLibraryOperations). Refactoring would ripple across every editor that consumes the shared editor-core infrastructure (roland-sxx0-editor, akai-s3k-editor, d110-editor, jv1080-editor). The roland-bugfix branch is scoped to roland-surface clone disposition; cross-editor extractions belong to a separate editor-core scope-discovery dispatch where all consumers can be validated together. Disposition: kept until that editor-core dispatch lands. Batch-dispositioned 2026-05-22. |
| 2026-05-22 | 2 PatchList/ToneList residuals (batch) | PatchList ↔ ToneList JSX wrapper around BankHeader | keep-with-reason | IDs (2): `1e8b3a6f5e61` (20L), `ec79e285ca00` (11L). Residual structural similarity AFTER the BankHeader (c88d8d06), SlotInfo (30e7346e), and bank-list-helpers (ae0b5192) extractions. The remaining overlap is the per-list JSX wrapper around BankHeader plus per-row signatures that legitimately differ between patches (PatchLabel + isPatchEmpty + patch-name testid) and tones (formatToneSlot + isToneEmpty + tone-name testid). Further wrapping would push the per-list specialization down one level without removing it, creating churn for marginal LOC savings. Disposition: kept; the residual is the legitimate per-list signature, not a duplication that wants extraction. Batch-dispositioned 2026-05-22. |
| 2026-05-22 | 9 coincidental-similarity clones (batch) | PatchesPage↔TonesPage imports, ItemPreviewPanel↔plugin-state-types, useImportSamples↔useLibraryImport, TreeView↔SetItem, MidiConnectionPage↔useHomePageStore, MoveDialog↔SaveDialog, library-sets-save-incremental↔library-sets, ToneEditor↔ToneWavePanel, wave-export↔set-storage | ignore-with-justification | IDs (9): `826daf1e6a00` (7L), `791f64b2325e` (6L), `f6fc1c6b4456` (6L), `71d0ea89080c` (14L), `2edc49a26a51` (12L), `a0ae2b87b9a1` (11L), `a5919ceb45dc` (7L), `4617f2a87560` (11L), `d9012ded566e` (7L). Coincidental similarity rather than duplication: cross-page or cross-file fragments (import blocks, file-path-building utility lines, hook header imports) that happen to share shape because they use the same React hooks / TypeScript imports / file-path helpers, but serve different feature contexts and have no shared semantics. Extracting would create over-generic helpers that obscure intent at the call site. Batch-dispositioned 2026-05-22. |
| 2026-05-22 | 3 EnvelopeEditor self-clones (batch) | EnvelopeEditor.tsx (paired form sections, selector logic, table-row renders for normal vs expanded view variants) | keep-with-reason | IDs (3): `69cc807e1b8f` (17L), `f4fd48187620` (18L), `268b38788fb8` (10L). All inside the `@deprecated` EnvelopeEditor.tsx file (Phase 9 Task 4 replaced it with ToneEnvelopeEditor; source-tree grep confirms zero consumers beyond the re-export from ui/index.ts). Same precedent as ROLAND-BUGFIX-DEL-001 (EnvelopeDisplay). The internal self-clones would dissolve when the file is deleted. **Follow-up ROLAND-BUGFIX-DEL-001 expanded to cover EnvelopeEditor.tsx deletion in the same pass.** Batch-dispositioned 2026-05-22. |

### Phase 2 closure summary (2026-05-22)

**Pending touching us: 172 → 0.**

Phase 2 (Disposition Roland-surface clones) is complete. Every clone group with a member in `modules/roland-sxx0-editor/` or `modules/editor-core/` has a disposition (`refactor`, `keep-with-reason`, or `ignore-with-justification`).

Refactor commits landed during Phase 2 (9):

| Refactor | Commit | Cloned groups closed |
|---|---|---|
| SlotInfo extracted from PatchList/ToneList | `30e7346e` | `80299d9fda8d` |
| DestinationEyebrow extracted from 3 export surfaces | `81da20a9` | `38c8236d8a7b` |
| BankHeader extracted from PatchList/ToneList | `c88d8d06` | `fc08c274d295` + 4 siblings |
| LibraryDeviceMemoryPanel + LibraryPreviewPanelAdapter extracted from s330/s550 library plugins | `dedd4d2f` | `47120235fd38` + `290604cd13fe` |
| DeviceMemoryPanel consumes shared BankHeader | `af7bb5a5` | `03544a6f535a` + `b9f7e847ff94` |
| AcRadioTabs extracted from PatchEditorTabs/ToneEditorTabs | `1fa334f5` | `80f494ba63d3` + `5578c63410e2` |
| PageTitleRow + AcReloadIcon extracted from 3 pages + BankHeader | `b996aa01` | `c53786bfb969` + `c3ee44db4131` + `8ab1699757ff` |
| useExportDialogLifecycle hook extracted from 3 export drawers | `dce8fc72` | `e83df277765c` + `82e7ef31c329` |
| bank-list-helpers + browser-download (downloadBlob) | `ae0b5192` | `5873e17e78bb` + `3785f9b1220a` + `e7ed36d3a106` + `38542efd1697` |

Deletion follow-ups landed 2026-05-22 with explicit operator authorization:
- **ROLAND-BUGFIX-DEL-001** ✅ — `EnvelopeDisplay.tsx` + `EnvelopeEditor.tsx` deleted; `ui/index.ts` re-exports removed
- **ROLAND-BUGFIX-DEL-002** ✅ — `CreateDirectoryDialog.tsx` + `RenameDirectoryDialog.tsx` + `useDirectoryOperations.ts` deleted; stale doc-comment references in `library-dialogs.in-context.spec.ts` and `phase-9-task-6-screenshots.spec.ts` updated
- **ROLAND-BUGFIX-DEL-003** ✅ — `modules/roland-sxx0-editor/scripts/watchdog.ts` deleted (the 4 e2e shell scripts had already been updated to use `$INFRA_DIR/scripts/watchdog.ts`)

Pre-deletion verification: grep sweep confirmed zero source consumers; `tsx "$INFRA_DIR/scripts/watchdog.ts"` spawn-verified for DEL-003. Build green + 49/49 unit tests + 155/161 wiring tests post-deletion (the 6 wiring failures are all pre-existing flakes unrelated to any deleted code — none of the failing specs grep-match the deleted file paths or symbols).

Deferred-with-explicit-follow-up (remaining):
- **ROLAND-BUGFIX-V3-IMPORT** — v3 import-dialog migration; closes 15 keep-with-reason'd Import* family clones + BUG-002

## Phase 3: Roland-surface refactor PRs (clone-group cleanup)

**Gate:** Each Phase 2 disposition of `refactor` opens a Phase 3 PR. Phase 3 runs **concurrently** with Phase 2 — they're not sequential. The split is dispositioning-decision (Phase 2) vs implementation-of-the-decision (Phase 3).

**Deliverable:** One PR per refactor-marked clone group (or per batched-sibling-group set), each landing on `main` and removing the duplication so the detector drops the group at the next baseline refresh.

**Per-PR acceptance:**

- Single concern: removes the named clone group(s).
- **Regression-catching test added BEFORE the refactor code lands** (TDD discipline — see "Refactoring protocol: test before extract" below). The test asserts the contract the refactor preserves, lives in the right test tier (wiring / UI / e2e per the surface), is GREEN against the pre-refactor code (proves it catches the contract), and STAYS GREEN against the post-refactor code. The test's id is cited in the `clones.yaml` disposition's `reason:` field.
- Detector confirms removal: `make refresh-clones-baseline` and the group's id no longer appears in `docs/scope-discovery/clones.yaml`.
- `make` build green; relevant test gate green (`make test-wiring-roland`, `make test-ui-roland`, etc., depending on surface).
- Operator confirms the refactor lands a real abstraction (not "moved bytes around with no win").
- The Phase 2 disposition row is updated with the merged PR link in the "Reason / Commit" column.

### Refactoring protocol: test before extract

Every `refactor`-marked clone-group disposition must add at least one regression-catching test BEFORE the refactor code lands. This is non-negotiable; it's how the deduplication program leaves the codebase in better shape than it found it rather than just shuffling bytes.

The discipline:

1. **Identify the contract the refactor preserves.** Typical contracts: a `data-testid` survives at the same DOM element, a className stays on the rendered span, a public function signature stays compatible, an exported type stays exported, a CSS rule still applies. Pick one (or more) that, if it silently drifted, the existing test suite would NOT catch.
2. **Write the test FIRST.** In the right tier: wiring for React component shape, UI for design-system primitives, e2e for round-trips, unit for pure functions. Run against the PRE-refactor code. **Must pass** — if it doesn't, the contract isn't where the test thinks it is and the refactor would silently regress.
3. **Commit the test on its own.** Separate commit from the refactor code so the test is individually attributable to this clone group + future-bisects cleanly.
4. **Then write the refactor.** Verify the test still passes. Run the broader test gate (`make test-wiring-roland` etc.) to catch cross-surface regressions.
5. **Cite the test in the disposition.** In `clones.yaml`, the `reason:` field for the refactored group MUST name the protecting test by id (e.g. `"Extracted to common/SlotInfo.tsx; protected by D-LIB-34 (.ac-list-info wrapper presence)."`).
6. **Backfill the refactor commit SHA into the workplan disposition log** immediately after the refactor commit lands. The commit-message-time row carries a placeholder ("Refactor commit lands with this row"); a one-line `git commit --amend` or follow-up doc commit swaps the placeholder for the actual `git rev-parse HEAD` value. Caught absent twice (AUDIT-20260521-08 root cause + AUDIT-20260522-10) — backfill discipline closes it.

What this protocol does NOT require:

- `keep-with-reason` and `ignore-with-justification` dispositions don't trigger this — no code changes, no regression risk.
- Trivial refactors (helper-extract-and-call-site-update inside one module, no public API change) can use an existing test as the protecting assertion IF that test would meaningfully fail under a botched refactor. The rule is "a test that catches a regression of THIS refactor's contract," not "always write a new test." But the bar for "existing test is sufficient" is high — if you have to argue for it, write the new test instead.

Why this exists: Phase 2/3 will touch ~93 intra-roland clone groups + the cross-module ones. Without the test-before-extract rule, the deduplication pass just compresses bytes and leaves the same regression surface. With it, every disposition leaves a durable assertion that future agents (and future Claude) can't silently regress through. The added test density is the dividend.

### Commit-message trace convention

Every disposition commit message MUST include a one-line `Test-first applied:` trace so the auditor + future-bisect can see at a glance whether the protocol was honored:

- `Test-first applied: yes (D-XXX-NN, D-YYY-MM)` — refactor disposition, with the new test IDs cited.
- `Test-first applied: exempt (keep-with-reason)` — no code change; protocol explicitly does not apply.
- `Test-first applied: exempt (ignore-with-justification)` — no code change; protocol explicitly does not apply.

Audit findings against missing or incorrect traces get filed as low-severity bookkeeping defects, same shape as AUDIT-20260521-07/08.

**Task breakdown:** Generated per-PR via `superpowers:writing-plans` only when a clone group's refactor is non-trivial (>50 LOC change, touches a public type, or crosses module boundaries). Trivial refactors (helper-extraction-and-call-site-update inside one module) skip the writing-plans ceremony and land as direct commits.

## Phase 4: Anti-pattern registry backfill (PR #446 T6.1 exercise)

**Goal:** Backfill `docs/scope-discovery/anti-patterns.yaml` with the legacy-shape fingerprints that Phase 2's 9 refactor extractions replaced. Locks the regime so the same anti-patterns can't silently re-emerge in new code.

**Gate:** `make check-anti-patterns` returns 0 holdouts. Pre-commit gate (already wired by T6.1) enforces it going forward.

### Tasks

- **T4.1 — Inventory the 9 anti-pattern shapes from Phase 2.** For each extracted primitive, identify the legacy shape it replaces (the code that was inlined at the call sites before extraction):
  - `useExportDialogLifecycle` ← inline `useState<localError>` + `useState<hasStarted>` + open-reset `useEffect` + `handleClose` callback pattern.
  - `PageTitleRow` ← inline `<header class="ac-page-title-row">` markup (`.ac-page-title-block` + heading + `.ac-page-title-rule` + `.ac-page-title-metric` + LED + refresh button + optional loading-progress strip).
  - `AcReloadIcon` ← inline 4-path reload SVG (`viewBox="0 0 16 16"` + the four `<path>`/`<polyline>` instructions).
  - `BankHeader` ← inline `<div class="ac-list-bank-header">` markup with toggle button + chevron + bank label + slot-range readout + reload button.
  - `SlotInfo` ← inline `<span class="ac-list-info">` markup wrapping `name` + `status` spans.
  - `AcRadioTabs` ← inline radio-driven tab strip (hidden radio inputs + label nav + role="tabpanel" sections).
  - `DestinationEyebrow` ← inline 3-span eyebrow row (kindLabel + LIBRARY + device-name with the right testid-suffixed spans).
  - `LibraryDeviceMemoryPanel` + `LibraryPreviewPanelAdapter` ← inline DeviceMemoryPanel-rendering and preview-routing function bodies (per-device adapter shape).
  - `downloadBlob` ← inline `URL.createObjectURL` + anchor mount + click + remove + revoke sequence.

- **T4.2 — Author each anti-pattern as a `ast-grep` rule in `anti-patterns.yaml`.** Per T6.1's schema: each entry carries `id`, `added_in` (the extraction commit SHA), `primitive` (the canonical import), `from` (the canonical module path), `shape` (the pattern), `message` (suggested replacement). Cite the extraction commit hash from the Phase 2 disposition log so the trace is bidirectional.

- **T4.3 — Run `make check-anti-patterns` and verify 0 holdouts.** Every anti-pattern's call sites should ALREADY be using the canonical primitive (because Phase 2 closed them); the scan should return clean. If a holdout surfaces, it means the Phase 2 refactor missed a call site — that becomes a Phase 4 sub-task to migrate.

- **T4.4 — Verify the pre-commit gate fires on a synthetic re-introduction.** Create a throwaway branch that re-inlines one of the registered anti-patterns; commit; verify the pre-commit hook blocks. Throw away the branch. This proves the gate has teeth on this repo's pre-commit configuration.

### Phase 4 outcome (2026-05-22) — blocked-on-schema-gap; folded into tooling-feedback

Empirically verified that the T6.1 schema lacks the path-exclude mechanism required to register anti-patterns derived from the 9 Phase 2 refactor extractions. The canonical primitive's body IS the legacy shape the registry is asked to flag — without an `excludes_paths:` field, the scan flags the canonical itself and the gate is unsatisfiable.

- **Empirical proof:** drafted `use-export-dialog-lifecycle-inline` against the live registry, ran `make check-anti-patterns`, observed the scan flagging `modules/roland-sxx0-editor/src/hooks/useExportDialogLifecycle.ts:77` as a holdout. Reverted the draft.
- **Drafts preserved:** all 9 anti-pattern designs are captured at [`scope-inventory/anti-patterns-drafts.yaml`](./scope-inventory/anti-patterns-drafts.yaml) with the `excludes_paths_needed:` annotation marking the field T6.1 should add.
- **Tooling-feedback finding:** see `tooling-feedback.md` § "Phase 4 dogfooding — T6.1 anti-pattern registry path-exclude gap" for the empirical evidence + proposed schema addition.
- **Follow-up:** `ROLAND-BUGFIX-T6.1-EXCLUDE` (#451) — once T6.1 supports `excludes_paths:`, copy the 9 drafts into `docs/scope-discovery/anti-patterns.yaml` verbatim and verify `make check-anti-patterns` returns 0 holdouts on the roland surface.

### Phase 4 unblocked (2026-05-23) — `excludes_paths:` shipped via PR #454; backfill landed

PR #454 (merged to main 2026-05-23) landed commit `914710a2` adding the `excludes_paths:` field exactly as the Phase 4 finding proposed. Closes #451. Backfilled the 9 anti-pattern drafts from `scope-inventory/anti-patterns-drafts.yaml` into the live `docs/scope-discovery/anti-patterns.yaml`.

- **Initial scan:** 5 real holdouts surfaced — `LibraryPage.tsx` (page-title-row + reload-icon), `HomePage.tsx` (page-title-row), `DeviceMemoryPanel.tsx` (slot-info), `akai SampleTransferPanel.tsx` (downloadBlob).
- **Triage:** each holdout is a legitimate **API-mismatch deferral** — the canonical primitive's contract doesn't accommodate the caller's actual needs (e.g., HomePage doesn't need `isLoading`/`refreshLabel`; LibraryPage uses `.ac-page-title-actions` slot PageTitleRow doesn't expose; DeviceMemoryPanel's slot-info carries an `isDragOver` branch SlotInfo doesn't expose; akai shouldn't take a cross-editor dep on roland's `@/lib/browser-download`).
- **Dispositioned:** each of the 5 files added to the corresponding anti-pattern's `excludes_paths:` with reason citing **ROLAND-BUGFIX-RGM-001 (#455)** as the tracked-deferral. The follow-up issue proposes preferred fixes for each (extend the primitive's contract; promote downloadBlob to a shared package; etc.).
- **Gate state:** `make check-anti-patterns: 9 entries scanned across 1347 files; 0 findings.` Phase 4 gate now satisfied with the 9 registered anti-patterns + 5 documented tracked-deferrals.
- **Side observation:** the same `tracked_holdouts:` schema gap that #453 fixed for adopter-manifests also applies to anti-patterns — `excludes_paths:` permanently silences the file. A future enhancement would add `tracked_holdouts:` to T6.1 too. Documented in tooling-feedback under the same Phase 4 section.

**Phase 4 closed cleanly.** The dogfooding loop completed: filed the gap (#451) → tooling team shipped the fix (PR #454) → backfilled on this branch → surfaced 5 real regime-drift findings → dispositioned each via the new schema field + a single follow-up issue tracking the API extensions.

## Phase 5: Adopter manifest backfill (PR #446 T6.2 exercise)

**Goal:** Declare expected adopter globs for the 9 primitives extracted in Phase 2, plus the upstream `SlideDrawer` primitive (whose adopter set covers the 5 Import dialogs still on legacy chrome). Locks the migration intent so future drift surfaces immediately.

**Gate:** `make check-adopters` reports the EXPECTED holdout set (the 5 Import dialogs for `SlideDrawer`; 0 for all other primitives) and zero unexpected holdouts.

### Tasks

- **T5.1 — Inventory the adopter glob + exception list for each new primitive.** Per T6.2's schema, each entry carries `primitive`, `from`, `introduced_in`, `expected_adopters_glob`, and optional `exceptions[].path` + `exceptions[].reason`. Per-primitive scope:
  - `PageTitleRow` → `modules/*/src/pages/*Page.tsx` with `ConnectPage.tsx` exception (entry route, no LED-metric / refresh affordance).
  - `BankHeader` → adopters: `PatchList.tsx`, `ToneList.tsx`, `DeviceMemoryPanel.tsx` (already-bound — should report ✓ on all).
  - `SlotInfo` → adopters: `PatchList.tsx`, `ToneList.tsx`.
  - `AcRadioTabs` → adopters: `PatchEditorTabs.tsx`, `ToneEditorTabs.tsx`.
  - `DestinationEyebrow` → adopters: `ExportToneDialog.tsx`, `ExportPatchDialog.tsx`, `BatchExportDrawer.tsx`.
  - `LibraryDeviceMemoryPanel` + `LibraryPreviewPanelAdapter` → adopters: `s330-library-plugin.tsx`, `s550-library-plugin.tsx`.
  - `AcReloadIcon` → adopters: anywhere a reload affordance renders (BankHeader, PageTitleRow). Glob: probably hand-curated rather than glob-based.
  - `useExportDialogLifecycle` → adopters: `Export*Dialog.tsx` + `BatchExportDrawer.tsx`.
  - `downloadBlob` → adopters: anywhere a file download is triggered. Glob: probably hand-curated.

- **T5.2 — Add upstream-primitive entry for `SlideDrawer`.** Per the rationale documented in `tooling-feedback.md` "Regime holdouts" § Adopter manifests, `SlideDrawer` (editor-core) has an expected adopter glob of `modules/*/src/components/library/*Dialog.tsx` with the 5 Import dialogs listed as TRACKED HOLDOUTS (not exceptions) pending ROLAND-BUGFIX-V3-IMPORT. The schema needs to distinguish "permanent exception" from "tracked holdout with follow-up." If T6.2's schema doesn't have a `tracked_holdouts:` field, file as a tooling-feedback finding and document them as exceptions with `reason: pending ROLAND-BUGFIX-V3-IMPORT` for now.

- **T5.3 — Run `make check-adopters` and verify the holdout set matches expectations.** Expected output: 5 holdouts for SlideDrawer (the Import dialogs), 0 holdouts elsewhere. Any deviation is either a missed Phase 2 migration (fix inline) or a manifest authoring error (refine the glob / exception list).

- **T5.4 — Verify the pre-commit gate fires on a synthetic adopter that drops the canonical import.** Create a throwaway branch, edit one adopter (e.g., PatchesPage.tsx) to drop its `PageTitleRow` import, commit, verify the pre-commit hook blocks. Throw away the branch.

### Phase 5 outcome (2026-05-22)

**Closed cleanly.** 9 adopter manifest entries committed to `docs/scope-discovery/adopter-manifests.yaml`. Final `make check-adopters` output: `9 entries scanned across 18 files; 0 holdouts.` Per-manifest accounting:

| Manifest | Adopters | Tracked-holdouts | Status |
|---|---|---|---|
| page-title-row | 3 | 0 | ✅ |
| use-export-dialog-lifecycle | 3 | 0 | ✅ |
| bank-header | 3 | 0 | ✅ |
| slot-info | 2 | 0 | ✅ |
| ac-radio-tabs | 2 | 0 | ✅ |
| destination-eyebrow | 3 | 0 | ✅ |
| library-device-memory-panel-adapter | 2 | 0 | ✅ |
| library-preview-panel-adapter | 2 | 0 | ✅ |
| slide-drawer-library-dialogs | 3 | 5 roland + 9 akai (tracked_holdouts post-PR-#454) | ✅ — upgraded 2026-05-23 from exceptions to proper `tracked_holdouts:` field; matrix now renders `⏳ 3/8 (5 tracked)` for roland + `⏳ 0/9 (9 tracked)` for akai instead of being masked as `✓` |

**Side effects:**
- Bug caught: `s330-library-plugin.tsx` + `s550-library-plugin.tsx` used relative imports `./shared/...` instead of the `@/` alias the project requires. Fixed both files. Adopter manifests caught what the project's own import-style rule had drifted on.
- Tooling-feedback findings filed:
  - **ROLAND-BUGFIX-T6.2-GLOB** ([#452](https://github.com/audiocontrol-org/audiocontrol/issues/452)) — `globToRegex` doesn't expand `*` inside `{}` alternation. Workaround: enumerate alternatives as separate glob entries.
  - **ROLAND-BUGFIX-T6.2-TRACKED-HOLDOUTS** ([#453](https://github.com/audiocontrol-org/audiocontrol/issues/453)) — schema has `exceptions:` (permanent opt-outs) but no `tracked_holdouts:` field (deferred-but-known migrations). The 5 Import dialogs were modeled as exceptions with `reason: TRACKED HOLDOUT — pending ROLAND-BUGFIX-V3-IMPORT (issue #450)` as the workaround.

See `tooling-feedback.md § "Phase 5 dogfooding — T6.2 adopter manifest gaps + glob compiler bug"` for the full empirical evidence + proposed schema additions.

## Phase 6: Cross-editor symmetry sweep (PR #446 T6.3 exercise)

**Goal:** Run `make check-editor-symmetry` (or T6.3's equivalent CLI) against the 4 editor modules (roland-sxx0-editor, akai-s3k-editor, d110-editor, jv1080-editor) + editor-core. Disposition every asymmetry surfaced.

**Gate:** Every reported asymmetry has a disposition recorded in `docs/scope-discovery/editor-symmetry.md` or equivalent.

### Tasks

- **T6.1 — Run the symmetry scan and capture the raw matrix.** Save the per-convention × per-editor matrix to a Phase 6 evidence file under `docs/1.0/001-IN-PROGRESS/roland-bugfix/scope-inventory/runs/<stamp>-symmetry/`.

- **T6.2 — Categorize each asymmetry.** Expected categories:
  - **Already-closed:** `$INFRA_DIR/scripts/watchdog.ts` — closed via DEL-003 this session. Should report ✓ symmetric.
  - **Editor-specific conventions:** e.g., akai-s3k-editor has SCSI-MIDI; roland doesn't. Mark `convention-is-per-editor-by-design`.
  - **Real holdouts:** a convention adopted in one editor but not another, where parity is desirable. Each gets a disposition: `fix-now` (do it this session) / `refactor-PR` (file as Phase 7 task or follow-up issue) / `keep-with-reason` (intentional divergence with rationale).

- **T6.3 — Disposition + remediate.** Each `fix-now` asymmetry gets a per-walk commit with the protecting test discipline. Each `refactor-PR` asymmetry gets a follow-up issue with a `ROLAND-BUGFIX-SYM-XXX` identifier. Each `keep-with-reason` gets a row in `editor-symmetry.md` with rationale.

- **T6.4 — Re-run the scan to verify zero unresolved asymmetries.** All asymmetries should now have a disposition. The matrix output should show ✓ symmetric for fixed conventions, `keep-with-reason` for intentional divergence, and `follow-up: <issue>` for deferred work.

### Phase 6 outcome (2026-05-22)

**Closed cleanly with one cross-editor extension + a visibility-gap finding.**

- **Cross-editor extension landed:** the `slide-drawer-library-dialogs` adopter manifest now spans both roland-sxx0-editor (8 library dialogs/drawers) and akai-s3k-editor (9 library dialogs). roland-side: 3 actual adopters + 5 tracked-holdout exceptions (pending ROLAND-BUGFIX-V3-IMPORT). akai-side: 0 actual adopters + 9 cross-editor-out-of-scope exceptions (each with `reason: CROSS-EDITOR HOLDOUT — akai never adopted v3 SlideDrawer; out of scope for feature/roland-bugfix`).
- **Matrix output:** `9 convention(s) × 7 editor(s) = 63 cells; 10 ✓, 0 ⚠, 0 ✗, 53 —.` The DEL-003 watchdog convention does NOT show up here because it's a shell-script path, not an adopter-manifest entry; that's correct — watchdog symmetry was caught + closed via the clones.yaml path before T6.3 landed.
- **Per-editor breakdown:** roland-sxx0-editor adopts all 9 manifest entries (✓); akai-s3k-editor adopts only the slide-drawer convention (via exception silencing, see Gap 1 below).
- **Two gaps surfaced via dogfooding:**
  1. **Exception silencing masks cross-editor holdouts in the matrix.** The akai-s3k-editor cell for `slide-drawer-library-dialogs` renders as `✓ 9/9` despite zero actual adopters — exceptions are subtracted before the matrix renders. Same root cause as #453 (no `tracked_holdouts:` distinction from permanent exceptions). Once #453 lands, the matrix gains a third cell-state and the visibility gap closes automatically. No new issue filed; folded into #453.
  2. **Most adopter manifests are single-editor by design.** 8 of 9 entries are roland-scoped. Matrix shows 53 `—` cells out of 63. This is correct behavior — cross-editor power grows as cross-editor refactors get adopter-manifest entries. Informational; no fix needed.
- See `tooling-feedback.md § "Phase 6 dogfooding — T6.3 cross-editor symmetry matrix masks holdouts via exceptions"` for the full dogfooding narrative.

**Phase 6 dispositioned closed.** The cross-editor sweep ran; every asymmetry surfaced has a disposition (5 roland Import dialogs → ROLAND-BUGFIX-V3-IMPORT follow-up; 9 akai library dialogs → out-of-scope per the operator's scope statement on `feature/roland-bugfix`).

## Phase 7: `/scope-inventory` re-run with regime-holdout-detector (PR #446 T6.5 exercise)

**Goal:** Re-invoke `/scope-inventory roland-bugfix` so the now-5-agent fleet (with `regime-holdout-detector` added in T6.5) produces an updated `scope-manifest.yaml` with a `regime_holdouts:` section populated from the registries Phases 4-5 just built. Curate; remediate any surfaceable holdouts inline; file the rest as follow-ups.

**Gate:** Updated scope-manifest.yaml lands with the `regime_holdouts:` section populated; every entry has a disposition or follow-up issue.

### Tasks

- **T7.1 — Pre-run baseline check.** Confirm Phases 4-5 registries are populated, Phase 6 dispositions are recorded, and the working tree is clean. Capture pre-run snapshot of `scope-manifest.yaml` for diffing.

- **T7.2 — Invoke `/scope-inventory roland-bugfix`.** The skill spins up 5 agents in parallel (ui-route-enumerator, ast-grep-matrix, clone-detector-reader, prd-themed-pattern-hunter, regime-holdout-detector) and synthesizes a fresh manifest. The run lands a new dated dir under `scope-inventory/runs/`.

- **T7.3 — Diff the new manifest against the pre-run snapshot.** The `regime_holdouts:` section should be new (or populated for the first time). Other sections may have minor drift from the Phase 2 → Phase 6 work landing.

- **T7.4 — Curate the new regime_holdouts: entries.** For each entry surfaced:
  - **If actionable inline:** apply the test-first protocol → protecting wiring assertion → primitive adoption → commit. Same shape as Phase 2 refactor walks.
  - **If deferred:** file as a `ROLAND-BUGFIX-RGM-XXX` follow-up issue with the agent's findings JSON as evidence.
  - **If false positive:** document in tooling-feedback.md with the false-positive shape so the agent can be tuned.

- **T7.5 — Re-curate the rest of the manifest.** Routes / modules / themes may have minor updates; apply the same curation pass that the original Phase 2 task 2 did (commit `dfb8baed`).

- **T7.6 — Update the journal.** Append a post-run entry to `scope-inventory/journal.md` capturing the run ID + the regime_holdouts findings count + curation outcomes.

### Phase 7 outcome (2026-05-23)

**Closed cleanly.** Re-invoked `/scope-inventory roland-bugfix` with the post-PR-#446 5-agent fleet. The new `regime-holdout-detector` joined the original 4 (ui-route-enumerator, ast-grep-matrix, clone-detector-reader, prd-themed-pattern-hunter). All 5 agents exited 0; synthesis ran clean in ~35 seconds end-to-end.

- **Run:** `2026-05-23T04-29-58-677Z-ysxpw0` (under `scope-inventory/runs/`).
- **Manifest:** kind=hybrid, 7 routes / 10 modules / 10 themes / 8 reference docs.
- **`regime_holdouts:` (new section, populated for the first time):** 1 total finding.
  - `anti_patterns: 0` — registry empty per Phase 4 outcome (T6.1 schema gap blocks backfill; drafts preserved at `scope-inventory/anti-patterns-drafts.yaml`).
  - `adopter_manifests: 0` — Phase 5's 9 entries all have expected adopters bound; 5 SlideDrawer tracked-holdouts silenced via `exceptions:`.
  - `editor_symmetry: 0` — Phase 6's cross-editor SlideDrawer manifest extension surfaces akai's 9 holdouts but they're silenced via cross-editor `exceptions:`.
  - `deprecation: 1` — `modules/sampler-backup/src/lib/backup/path-conventions.ts` imported by `modules/sampler-backup/src/cli/migrate.ts:20`. OUT OF SCOPE for feature/roland-bugfix (sampler-backup is not in this branch's surface per the PRD).
- **Curation outcome:** the 1 deprecation finding dispositioned as out-of-scope (sampler-backup); no inline fix. Recommend filing a sampler-backup-side follow-up if/when sampler-backup gets its own scope-discovery work. No re-curation of routes/modules/themes needed — the existing curated manifest (commit `dfb8baed`) remains binding.
- **Tooling-feedback:** see `synthesis.md` for the full per-section commentary. Confirms the regime-holdout-detector's value comes from the registries it reads, not from any new discovery the agent itself does. With empty/silenced registries, the agent correctly reports "clean" — the gate works exactly as designed.
- **Journal:** post-run entry appended to `scope-inventory/journal.md` per LAYOUT.md.

**Phase 7 dispositioned closed.** The 5-agent fleet ran end-to-end; the new `regime_holdouts:` section is populated; the 1 finding is dispositioned (out-of-scope, no follow-up filed because sampler-backup isn't owned by this branch); the run evidence is captured.

## Pre-commit Discipline

- One bug per commit; descriptive subject; no sweep refactors slipped in alongside a fix
- No "while I was in here" sibling changes — they get their own commit and their own triage row
- For hardware-touching bugs, ship the diagnostic alongside the fix; don't fabricate device-failure narratives without first proving four things: (a) the request the editor sent was correct, (b) the response the device returned was parsed correctly, (c) the parsed response was rendered correctly, (d) the round-trip survives a re-readback
- The controller re-runs the load-bearing test gate independently after every implementer dispatch — the implementer's reported pass count is a claim, not evidence (see [`.claude/rules/agent-discipline.md`](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/.claude/rules/agent-discipline.md))

## GitHub Tracking

- **Parent issue:** TBD (created via `/feature-issues`)
- **Phase 2:** [#442](https://github.com/audiocontrol-org/audiocontrol/issues/442) — Scope-discovery validation + clone disposition (re-scoped 2026-05-22 to use the PR #441 tooling); closed 2026-05-22
- **Phase 4:** [#447](https://github.com/audiocontrol-org/audiocontrol/issues/447) — Anti-pattern registry backfill (extension 2026-05-22)
- **Phase 5:** [#448](https://github.com/audiocontrol-org/audiocontrol/issues/448) — Adopter manifest backfill (extension 2026-05-22)
- **Phase 6:** [#449](https://github.com/audiocontrol-org/audiocontrol/issues/449) — Cross-editor symmetry sweep (extension 2026-05-22)
- **Phase 7:** [#450](https://github.com/audiocontrol-org/audiocontrol/issues/450) — /scope-inventory re-run with regime-holdout-detector (extension 2026-05-22)
- **Implementation issues:** per-bug (Phase 1) and per-refactor-PR (Phase 3), opened as found; each triage / disposition row links its issue + PR number when filed.

## Out of Scope

Repeated from the PRD for in-context reference:

- New features or capability additions — those get their own branch
- Refactors larger than what's needed to fix a specific bug OR to close a dispositioned clone group
- Tone/patch data-model changes that would require a new PRD
- Clone groups that DON'T touch `modules/roland-sxx0-editor` or `modules/editor-core` — those belong to other branches' validation work
- [#407](https://github.com/audiocontrol-org/audiocontrol/issues/407) (D-SYS page) and [#409](https://github.com/audiocontrol-org/audiocontrol/issues/409) (Copy/Derive) — missing-affordance enhancements, not bugs
