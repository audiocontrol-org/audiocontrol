# Workplan — editor-ux-refinement

Long-running track. Phases ship as PRs against `main`; new phases get appended as cross-editor UX refinement scope is identified. Each phase follows the per-commit discipline in `.claude/rules/agent-discipline.md` (no "just for now" deferrals, validator-paired changes, controller is the gate).

## Phase 1: Filter editor enhancement — TVF curve + above-the-fold reorder

*Migrated 2026-06-01 from `docs/1.0/001-IN-PROGRESS/roland-bugfix/workplan.md` §Phase 8. Original task IDs preserved (T8.1 … T8.8) to keep existing references stable.*

**Goal:** Promote the Akai `FilterDisplay` to an editor-core primitive `AcFilterCurveEditor`; both Akai and Roland adopt it at the same commit; the Roland tones FILTER tab reorders so the envelope graphic + filter-curve graphic sit above the slider grid (above-the-fold; screenshot-friendly).

**Branch identity rationale:** Cross-editor visual-primitive promotion + editor-tab layout refinement is exactly what this branch exists to absorb. The Akai-side change is the migration leg; the Roland-side change is the new adoption + reorder. The cross-editor scope is the point — neither device-scoped branch is the right home.

**Why promote to editor-core (not copy into Roland):** DRY per project CLAUDE.md, and the same shape `slide-drawer-library-dialogs` already used. The Akai version uses a generic LPF biquad approximation parameterized only by `FREQ_MAX = 99` and `Q_MAX = 15`; making those props is one rename. Once promoted, both editors share the rendering + drag math + CSS, and the adopter-manifest + anti-pattern gates prevent future re-inlining.

**Modules affected:**
- `modules/editor-core/src/components/AcFilterCurveEditor.tsx` (new — promoted file)
- `modules/editor-core/src/design/filter-curve-primitives.css` (new — promoted classes, renamed `s3k-adsr-*` → `ac-filter-curve-*`)
- `modules/editor-core/src/index.ts` (export)
- `modules/akai-s3k-editor/src/components/keygroups/FilterDisplay.tsx` (delete)
- `modules/akai-s3k-editor/src/components/keygroups/KeygroupEditor.tsx` (migrate import)
- `modules/akai-s3k-editor/src/index.css` (delete `.s3k-adsr-*` rules now living in editor-core)
- `modules/roland-sxx0-editor/src/components/tones/panels/ToneFilterPanel.tsx` (reorder + adopt)
- `docs/scope-discovery/adopter-manifests.yaml` (new entry)
- `docs/scope-discovery/anti-patterns.yaml` (new entry)

### Tasks

- **T8.1 — Promote `FilterDisplay` to `AcFilterCurveEditor` in editor-core.** Move `modules/akai-s3k-editor/src/components/keygroups/FilterDisplay.tsx` to `modules/editor-core/src/components/AcFilterCurveEditor.tsx`. Replace the constants `FREQ_MAX = 99` / `Q_MAX = 15` with required props `cutoffMax` / `qMax`. Promote the supporting CSS rules from `modules/akai-s3k-editor/src/index.css:320-356` to a new `modules/editor-core/src/design/filter-curve-primitives.css` with renamed classes (`.s3k-envelope-display` → `.ac-filter-curve`, `.s3k-adsr-bg` → `.ac-filter-curve-bg`, `.s3k-adsr-fill` → `.ac-filter-curve-fill`, `.s3k-adsr-line` → `.ac-filter-curve-line`, `.s3k-adsr-hit` → `.ac-filter-curve-hit`, `.s3k-adsr-dot` → `.ac-filter-curve-dot`). Update the component to emit the renamed classes. Export from `modules/editor-core/src/index.ts`. Keep the LPF-approximation curve as the visual; document the approximation in the JSDoc. Width remains responsive via SVG `viewBox` (no hardcoded pixel widths; 400×120 viewBox stays the intrinsic ratio).

- **T8.2 — Migrate Akai to the shared primitive.** `modules/akai-s3k-editor/src/components/keygroups/KeygroupEditor.tsx` swaps the import + render to `<AcFilterCurveEditor cutoffMax={99} qMax={15} ... />`. Delete `modules/akai-s3k-editor/src/components/keygroups/FilterDisplay.tsx`. Delete the `.s3k-adsr-*` rules from `modules/akai-s3k-editor/src/index.css` (now provided by editor-core). Per `.claude/rules/css-refactor.md`: screenshot the Akai keygroup-editor filter panel BEFORE the change to `.tmp/baseline-akai-filter.png`, swap, screenshot AFTER to `.tmp/after-akai-filter.png`, verify pixel-equivalent rendering.

- **T8.3 — Adopt in Roland tones FILTER tab and reorder.** Edit `modules/roland-sxx0-editor/src/components/tones/panels/ToneFilterPanel.tsx` so the panel renders in this order:
  1. `<ToneEnvelopeEditor ... />` — moved from bottom to top.
  2. `<AcFilterCurveEditor cutoffMax={...} qMax={...} frequency={tvf.cutoff} resonance={tvf.resonance} onChange={...} onCommit={...} disabled={!tvf.enabled} />` — new adoption. Streaming `onChange` updates `tvf.cutoff` + `tvf.resonance` simultaneously via the existing `updateTvf` helper; `onCommit` calls `onCommit?.(...)` per `feedback_live_editing_no_save`.
  3. `<div className="tones__param-rows">` — Cutoff / Resonance / Key Follow / LFO Depth / EG Depth / Key Rate / Vel Rate / Level Curve sliders, unchanged content, moved below the two graphic editors.
  4. `<div className="ac-compact-grid">` — Filter Enable + EG Polarity AcToggle row, unchanged position relative to sliders.

  **Verify Roland's TVF cutoff + resonance ranges before wiring** by reading the SamplerTvf type definition; do not assume 0-127. If the ranges differ (Roland S-330/S-550 protocol docs may show a narrower range), pass the actual max values to `cutoffMax` / `qMax` — never fabricate a range to make the visual look like the Akai. When the user drags the curve dot, both `tvf.cutoff` and `tvf.resonance` stream to the device as a single combined update.

- **T8.4 — Register adopter manifest entry.** Append to `docs/scope-discovery/adopter-manifests.yaml`:
  ```yaml
  - primitive: AcFilterCurveEditor
    from: '@audiocontrol/editor-core'
    introduced_in: <T8.1 commit SHA, backfilled per refactor-protocol step 6>
    expected_adopters_glob:
      - 'modules/akai-s3k-editor/src/components/keygroups/KeygroupEditor.tsx'
      - 'modules/roland-sxx0-editor/src/components/tones/panels/ToneFilterPanel.tsx'
    exceptions: []
    tracked_holdouts: []
  ```
  Verify `make check-adopters` reports clean (both editors bound at the same commit).

- **T8.5 — Register anti-pattern entry.** Append to `docs/scope-discovery/anti-patterns.yaml` an `ac-filter-curve-editor-inline` entry whose `ast-grep` rule flags inline LPF-biquad SVG renders (e.g., `freqToX` / `dbToY` helpers, `generateFilterPath`, or `2nd-order resonant LPF` JSDoc fragments) not via `AcFilterCurveEditor`. `excludes_paths:` lists the canonical `modules/editor-core/src/components/AcFilterCurveEditor.tsx`. Verify `make check-anti-patterns` returns 0 findings.

- **T8.6 — Test-first protecting assertions.** Per the refactor protocol (T8.1+T8.2 IS a cross-module extraction):
  - `D-AKAI-FILTER-MIGRATION-01` (wiring): assert `KeygroupEditor` renders `<AcFilterCurveEditor>` with `cutoffMax=99` / `qMax=15` and the canonical `.ac-filter-curve` class lands on the SVG. FAILS against pre-T8.2 Akai code.
  - `D-TONE-FILTER-CURVE-01` (wiring): assert `ToneFilterPanel` renders `<AcFilterCurveEditor>` with the correct ranges and the curve-dot drag updates BOTH `tvf.cutoff` and `tvf.resonance` in the same `onUpdate` call. FAILS against pre-T8.3 Roland code.
  - `D-TONE-FILTER-ORDER-01` (wiring): assert DOM order of the TVF panel children: ToneEnvelopeEditor → AcFilterCurveEditor → param-rows → compact-grid. Test must FAIL against the pre-T8.3 panel order, per `validator-paired-changes` discipline.
  - Tests committed BEFORE the refactor lands; cited in the disposition-row reason field for any clone groups they protect.

- **T8.7 — UI specs for the interactions.** Per `.claude/rules/workflow-playbooks.md` "Add a UI feature" step 7: every manually verified interaction becomes a Playwright spec.
  - `test/ui/tone-filter-tab.spec.ts` covers: curve dot horizontal drag streams cutoff; vertical drag streams resonance; mouseup commits; clicking-without-dragging doesn't stream; the curve respects `disabled` when `tvf.enabled=false`.
  - `test/ui/akai-keygroup-filter.spec.ts` covers the same set of interactions on the Akai keygroup editor adopter (regression net for the migration).

- **T8.8 — Visual verification (above-the-fold).** Per `.claude/rules/css-refactor.md`: screenshot the Roland tones FILTER tab at the test harness's default viewport. Assert via Playwright `getBoundingClientRect()` that the AcFilterCurveEditor's bottom edge falls within the viewport without scrolling. Capture the screenshot as the deliverable; attach via `SendUserFile` for operator review per `feedback_screenshot_each_page`.

### Phase 1 acceptance criteria

- `AcFilterCurveEditor` exported from `editor-core`; both adopters bind at the introducing commit.
- `modules/akai-s3k-editor/src/components/keygroups/FilterDisplay.tsx` deleted; `.s3k-adsr-*` rules deleted from `modules/akai-s3k-editor/src/index.css`.
- Roland TVF FILTER tab opens with envelope + filter-curve both visible above-the-fold at default viewport.
- `make check-adopters` clean; `make check-anti-patterns` clean; `make check-clone-duplication` clean; `make check-css-duplication` clean.
- `make test-ui-roland` green; akai equivalent green; new specs pass.
- Akai filter section + Roland TVF tab visually verified via before/after screenshots; the Akai diff is pixel-equivalent (modulo class-name attribute changes the screenshot won't see); the Roland diff shows the new ordering + the new curve graphic.
- Operator confirms the new FILTER tab feel and the cross-editor migration.

### Duplication audit (mandatory per workflow-playbooks.md)

Performed as part of the T8.1 promotion itself: the audit's outcome IS the extraction. Additional grep sweep for adjacent inline filter-response-curve renders in:
- `modules/d110-editor/src/` (likely 0; verify)
- `modules/jv1080-editor/src/` (has filters; check for inline LPF curves)
- `modules/roland-sxx0-editor/src/components/patches/` (check Patch-level filter affordances)

Anything surfaced becomes either an additional T8.x sub-task (migrate now) or a `EDITOR-UX-FILTER-EXT-NNN` follow-up issue (if scope is genuinely separate) with explicit operator acceptance per `agent-discipline.md`.

### Open scope decisions for operator review

- **Patch-level filter affordances:** Does `PatchEditor` expose a Patch-level filter cutoff/resonance? Quick grep didn't surface one; assumption is no until confirmed. If yes, it adopts the primitive too.
- **JV-1080 / D-110:** Sibling filter visualizations in other editors — adopt in this branch, or separate scope? Default: out of scope; surface what's there in the duplication audit and file as follow-ups if any.
- **Curve visual style:** The Akai curve uses `s3k-adsr-line` (single accent color); the promoted version inherits that. Roland adoption keeps the same visual unless operator wants a brand-specific tweak (e.g., rec-LED red is per-editor branding).
- **Drag gesture:** Akai's vertical drag spans only the area above the 0 dB passband line. Same mapping should feel right for Roland's TVF resonance, but worth a visual check after T8.3.

## Pre-commit Discipline

- One refinement per commit; descriptive subject; no sweep refactors slipped in alongside a phase task.
- No "while I was in here" sibling changes — they get their own commit and their own triage row, or a follow-up issue.
- Validator-paired changes per `.claude/rules/agent-discipline.md`: every gate-semantic change ships with a scenario that would have failed against the prior behavior.
- The controller re-runs the load-bearing test gate independently after every implementer dispatch — the implementer's reported pass count is a claim, not evidence.

## GitHub Tracking

- **Parent issue:** TBD (created via `/feature-issues` once Phase 1 acceptance is locked).
- **Phase 1 issues:** TBD.

## Out of Scope

- Library browser UX → `library-ux`.
- Device-protocol bug fixes → `roland-bugfix` / device-scoped branches.
- Akai workflow restructuring → `akai-ux-improvement` (complete).
- Foundational workflow architecture → `edit-workflow-architecture`.
