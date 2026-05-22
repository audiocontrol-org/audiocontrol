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
| 2026-05-22 | `80f494ba63d3` (31 lines) + `5578c63410e2` (14 lines) | PatchEditorTabs.tsx ↔ ToneEditorTabs.tsx (radio inputs + label strip + panel sections) | refactor | Pre-extraction both editor-tabs files held byte-identical radio-input / label-strip / panel-section render shapes; the only divergence was the TABS constant + aria-label. Extracted the shared shell to `modules/roland-sxx0-editor/src/components/common/AcRadioTabs.tsx`. Both editor-tabs files now slim to a TABS constant + a `<AcRadioTabs />` call. The page-local CSS rules in patches.css / tones.css (which gate panel visibility off radio state via sibling selectors on `id=pt-* | tt-*`) are unchanged — the radio input ids are the same shape AcRadioTabs emits. Protected by `D-PATCH-EDITOR-TABS-01` + `D-TONE-EDITOR-TABS-01` wiring assertions added in test-first commit `5b4b0b27`. Refactor commit lands with this row (back-fill SHA after commit). Baseline refresh confirmed both groups dropped; broader regression suites (tone-writes 44/44, patches 11/11, patch-writes 11/11) all green. Pending touching us: 69 → 67. |

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

## Pre-commit Discipline

- One bug per commit; descriptive subject; no sweep refactors slipped in alongside a fix
- No "while I was in here" sibling changes — they get their own commit and their own triage row
- For hardware-touching bugs, ship the diagnostic alongside the fix; don't fabricate device-failure narratives without first proving four things: (a) the request the editor sent was correct, (b) the response the device returned was parsed correctly, (c) the parsed response was rendered correctly, (d) the round-trip survives a re-readback
- The controller re-runs the load-bearing test gate independently after every implementer dispatch — the implementer's reported pass count is a claim, not evidence (see [`.claude/rules/agent-discipline.md`](/Users/orion/work/audiocontrol-work/audiocontrol-roland-bugfix/.claude/rules/agent-discipline.md))

## GitHub Tracking

- **Parent issue:** TBD (created via `/feature-issues`)
- **Phase 2:** [#442](https://github.com/audiocontrol-org/audiocontrol/issues/442) — Scope-discovery validation + clone disposition (re-scoped 2026-05-22 to use the PR #441 tooling)
- **Implementation issues:** per-bug (Phase 1) and per-refactor-PR (Phase 3), opened as found; each triage / disposition row links its issue + PR number when filed.

## Out of Scope

Repeated from the PRD for in-context reference:

- New features or capability additions — those get their own branch
- Refactors larger than what's needed to fix a specific bug OR to close a dispositioned clone group
- Tone/patch data-model changes that would require a new PRD
- Clone groups that DON'T touch `modules/roland-sxx0-editor` or `modules/editor-core` — those belong to other branches' validation work
- [#407](https://github.com/audiocontrol-org/audiocontrol/issues/407) (D-SYS page) and [#409](https://github.com/audiocontrol-org/audiocontrol/issues/409) (Copy/Derive) — missing-affordance enhancements, not bugs
