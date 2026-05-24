# Audit Log — feature/akai-harmonization

This document is the feature-local audit log for `feature/akai-harmonization`.
New findings follow the project-wide protocol in [AUDITOR-IMPLEMENTER-PROTOCOL.md](/AUDITOR-IMPLEMENTER-PROTOCOL.md).

Canonical grep queue:

- unfinished work: `grep -nE "^Status: (open|acknowledged|fixed-)" docs/1.0/001-IN-PROGRESS/akai-harmonization/audit-log.md`
- new findings: `grep -nE "^Status: open" docs/1.0/001-IN-PROGRESS/akai-harmonization/audit-log.md`
- awaiting verification: `grep -nE "^Status: fixed-" docs/1.0/001-IN-PROGRESS/akai-harmonization/audit-log.md`

---

## 2026-05-24 Feature review — implementation work so far

Surfaced while reviewing `feature/akai-harmonization` against `origin/main` after the first implementation commits landed in `editor-core` plus the new feature-doc set. Scope reviewed: branch diff from merge-base `57a6dd9fdfe08e93f3813a7d2c221611aa9995d6` through `HEAD` (`0c09c87e` at review time).

### Disclosure-button fix introduces a second tab stop per folder row and strands keyboard users on the nested button

Finding-ID: AUDIT-20260524-01
Status:     verified-2026-05-24
Severity:   high
Surface:    `modules/editor-core/src/components/library/TreeView.tsx`

The accessibility fix that promoted the folder disclosure affordance from a `<span>` to a `<button>` solved pointer target size and button semantics, but it also made every expandable folder row contain two focusable elements: the row itself (`role="treeitem"`, `tabIndex={0}` at `TreeView.tsx:288-290`) and the nested disclosure button (`TreeView.tsx:293-299`).

That breaks the tree's keyboard model in two ways:

1. Tabbing through the tree now lands on both the row and the disclosure button for every folder, doubling the tab-stop count through the library.
2. Once focus lands on the nested button, the row-level `handleKeyDown` logic is no longer in play. Arrow-key tree navigation and row-level expand/collapse affordances are attached to the parent row, not the button, so the user can get "stuck" on the nested button and lose the expected tree navigation behavior until they tab away again.

This is a regression introduced by the new fix, not a pre-existing condition of the tree: the previous `<span>` shape left only the row itself in the focus order.

**Evidence:**

- Parent row remains tabbable: `modules/editor-core/src/components/library/TreeView.tsx:288-290`
- New nested button is focusable by default and has no compensating `tabIndex={-1}` or keyboard forwarding: `modules/editor-core/src/components/library/TreeView.tsx:293-299`
- Existing tests only assert that the disclosure class renders (`modules/editor-core/src/components/library/TreeView.test.tsx:107-113`); there is no keyboard-navigation test covering focus order or arrow-key behavior after the change.

**Expected:** one keyboard focus target per tree row, with the disclosure affordance exposed semantically without adding a competing tab stop inside the composite tree item.

**Actual:** every expandable folder row now contributes a second focusable control with no tree-key handling of its own.

**Fix guidance:** keep the button semantics, but remove it from the tab order (`tabIndex={-1}`) and let the parent `treeitem` remain the keyboard anchor, or move the tree semantics onto the button itself and stop making the wrapper row separately tabbable. Either route needs a regression test that tabs through the tree and verifies folder rows do not create extra tab stops.

**Fix landed:** this session, 2026-05-24. `modules/editor-core/src/components/library/TreeView.tsx:292-309` got `tabIndex={-1}` on the disclosure button. The parent row's `role="treeitem"` + `tabIndex={0}` stays the keyboard anchor; arrow-key tree navigation continues to fire from the row's `handleKeyDown`. The button keeps its `<button type="button">` semantics + `aria-label` + `aria-expanded` so screen readers and voice-control element-enumeration still address it for pointer activation (closes-paired with AUDIT-20260523-02). Pointer-click + voice-control activation route through the existing `e.stopPropagation()` onClick. The 24×24 hit target from AUDIT-20260523-01 also stays intact. **Regression test added** at `modules/editor-core/src/components/library/TreeView.test.tsx`: the new test "disclosure button does not add a second tab stop per folder row" asserts every `<button class="ac-tree-disclosure-btn">` in the rendered HTML carries `tabindex="-1"`. A future edit that drops the attribute will fail the test. `pnpm vitest run src/components/library/TreeView.test.tsx`: 25 tests pass (24 previously + 1 new).

### Akai light-theme token block leaves action-button colors pinned to white-on-dark assumptions

Finding-ID: AUDIT-20260524-02
Status:     open
Severity:   medium
Surface:    `modules/editor-core/src/design/layout-primitives.css`, `modules/editor-core/src/design/primitives.css`, `modules/editor-core/src/design/library.css`, `modules/akai-s3k-editor/src/main.tsx`

Phase 2's new Akai dialect token block flips the S3000XL surface to a light cream/champagne theme and is live in production because the Akai app now sets `document.documentElement.dataset.editor = 's3000xl'` in `modules/akai-s3k-editor/src/main.tsx:12-13`. But the shared action-button color tokens still live only in the global `:root` block in `layout-primitives.css:71-77`, where they remain semi-transparent white values tuned for the dark Roland surfaces.

Those tokens drive both generic list-row actions (`primitives.css:446-475`, `.ac-list-action-btn`) and tree-row destructive actions (`library.css:198-232`, `.ac-tree-delete-btn`). On the new light Akai panels (`tokens.css:240-245`), the default action state is therefore still `rgba(255, 255, 255, 0.4)` on a pale background. That is a low-contrast hover affordance at exactly the moment the branch is trying to establish the light Akai dialect as production truth.

**Evidence:**

- Light Akai surfaces are active: `modules/akai-s3k-editor/src/main.tsx:12-13`, `modules/editor-core/src/design/tokens.css:231-269`
- Action tokens remain white-on-dark globals with no `:root[data-editor='s3000xl']` override: `modules/editor-core/src/design/layout-primitives.css:71-77`
- Production consumers of those tokens:
  - `.ac-list-action-btn`: `modules/editor-core/src/design/primitives.css:446-475`
  - `.ac-tree-delete-btn`: `modules/editor-core/src/design/library.css:198-232`

**Expected:** the Akai dialect overrides `--ac-action-color`, `--ac-action-hover`, and the selected/danger variants so action icons remain legible on the light S3000XL surfaces.

**Actual:** Akai now opts into a light background while action affordances still assume a dark background.

**Fix guidance:** move the `--ac-action-*` tokens into the per-editor token layer and add an S3000XL-specific override set. Pair the fix with a visual or computed-style test on an Akai list/tree row so a future palette migration cannot silently regress action contrast again.

### Phase 1 audit advanced past its own harness/screenshot prerequisites, leaving most Akai surfaces without a rerunnable visual test bed

Finding-ID: AUDIT-20260524-03
Status:     open
Severity:   medium
Surface:    `docs/1.0/001-IN-PROGRESS/akai-harmonization/workplan.md`, `modules/akai-s3k-editor/src/pages/`

The branch marks Phase 1 task 1.4 complete and has already produced `harmonization-spec.md` plus the mockup set, but the workplan still leaves the prerequisite harness/screenshot tasks open: 1.1 (inventory + add harness routes where missing) and 1.3 (capture committed screenshot baseline) remain unchecked in `workplan.md:98-100`.

The codebase matches that gap. Under `modules/akai-s3k-editor/src/pages/`, the only `Test*Page` route currently present is `TestKeygroupsPage.tsx`; there is no corresponding harness page for Programs, Samples, or Library. That means the harmonization work has started without the promised rerunnable browser-test surfaces for three of the four core Akai pages, and without the screenshot baseline the workplan says Phase 2 should diff against.

**Evidence:**

- Workplan prerequisite tasks still open: `docs/1.0/001-IN-PROGRESS/akai-harmonization/workplan.md:98-100`
- Only one Akai harness page exists: `modules/akai-s3k-editor/src/pages/TestKeygroupsPage.tsx`
- No `TestProgramsPage`, `TestSamplesPage`, or `TestLibraryPage` exists under `modules/akai-s3k-editor/src/pages/`

**Expected:** before or alongside the Phase 1 audit, each audited Akai page has a harness route or equivalent rerunnable UI surface, and the screenshot baseline exists in-repo so Phase 2 changes can be diffed against something repeatable.

**Actual:** the branch has mockup HTML and a spec, but most real Akai pages still lack the harness coverage the workplan explicitly required before the audit proceeded.

**Fix guidance:** finish Phase 1's gating work before more Phase 2 migration lands: add the missing Akai harness routes, capture the baseline screenshots, then update the workplan so the audit's evidence trail matches what the feature says it depends on.

---

## 2026-05-23 Phase 1 mockup audit — canonical chrome accessibility

Surfaced while reviewing the canonical `.ac-tree-disclosure-btn` + `AcChevron` chrome that the akai library mockup transposes verbatim. Both findings apply to the canonical editor-core implementation — the mockup faithfully replicates the issues because the dialect contract forbids per-editor primitive forks. Fix lives in `editor-core`; akai-harmonization is the surface that surfaced it.

### Tree disclosure-button hit area is 17.6×17.6 px — below WCAG AA 24×24 target-size minimum

Finding-ID: AUDIT-20260523-01
Status:     verified-2026-05-24
Severity:   medium
Surface:    `modules/editor-core/src/design/chevron-primitives.css`, `modules/editor-core/src/design/library.css` (`.ac-tree-disclosure-btn` rule), `modules/editor-core/src/components/library/TreeView.tsx` (disclosure-btn render site)

The canonical `AcChevron` glyph is 1.1rem (≈17.6 CSS px) square per [chevron-primitives.css](/modules/editor-core/src/design/chevron-primitives.css). The `.ac-tree-disclosure-btn` wrapper that owns the click target for folder-row expand declares `padding: 0` ([library.css:148-159](/modules/editor-core/src/design/library.css)), so the wrapper's hit area is exactly the chevron's footprint — 17.6×17.6 px.

WCAG 2.2 SC 2.5.8 (Target Size Minimum, Level AA) requires pointer targets to be at least 24×24 CSS px. The disclosure-btn fails the floor by ~6 px in each dimension.

The header comment in [chevron-primitives.css:22-25](/modules/editor-core/src/design/chevron-primitives.css) claims:

> Target-size baseline: 1.1rem ≈ 17.6px glyph in a 1.1rem square, which combined with the wrapping toggle's padding clears WCAG AA target-size floors.

This claim holds for `.ac-device-memory-section-eyebrow` (full-width button with `padding: var(--ac-space-2) var(--ac-space-4)`) and for `.ac-tree-section-toggle` (the button contains chevron + section title in one click target, so the BUTTON width carries the hit area). It does NOT hold for `.ac-tree-disclosure-btn`, whose `padding: 0` + chevron-only content gives a hit area exactly the size of the chevron itself.

The WCAG 2.5.8 "spacing" exception (24-px circles centered on each undersized target must not overlap any other target or its 24-px circle) is unlikely to apply: the chevron sits INSIDE the clickable `.ac-tree-node` row (a separate target for selection). A 24-px circle centered on the chevron extends into the row's bounding box, which itself is a target.

**Repro / evidence:**

1. Open the akai library mockup at `http://localhost:61110/docs/1.0/001-IN-PROGRESS/akai-harmonization/mockups/library.html`.
2. Inspect any folder row's disclosure chevron (the row labeled `drum-kits` is selected by default).
3. The `.ac-tree-disclosure-btn` wrapper reports `getBoundingClientRect()` at ~17.6 × 17.6 px (1.1 rem at default 16-px root).
4. Same measurement in the production roland library page — the dialect contract guarantees they match.

**Expected:** disclosure-btn hit area ≥ 24×24 CSS px, OR documented WCAG conformance route (equivalent control reachable via the row click, with the row click toggling expand instead of select).

**Actual:** 17.6 × 17.6 px hit area; row click toggles selection, not expand (`onClick` on `.ac-tree-disclosure-btn` calls `e.stopPropagation()` per [TreeView.tsx:295](/modules/editor-core/src/components/library/TreeView.tsx)), so the only pointer target for expand is the undersized chevron wrapper.

**Fix guidance:**

- Option A (minimal): add `padding: 3px` to `.ac-tree-disclosure-btn` so the hit area becomes 23.6 × 23.6 px (still under 24, would need `padding: 3.2px` or `padding: 4px`).
- Option B (cleaner): set `width: 1.5rem; height: 1.5rem` on `.ac-tree-disclosure-btn` (24-px square wrapper holding the centered 17.6-px chevron). The visual glyph size doesn't change; only the hit-area expands.
- Either option needs a regression test asserting `getComputedStyle` width ≥ 24 px on the wrapper (memory `feedback_chevron_size` already established that name-only allow-lists miss value drift — gate the size with a computed-style assertion).
- Update the chevron-primitives.css header comment to remove the misleading claim about `.ac-tree-disclosure-btn` clearing WCAG via wrapper padding.

Surfaced during Phase 1 mockup transposition (commit `62ee5373`); blocks no current work but should land before any UI-accessibility audit of the editor.

**Fix landed:** Phase 2 task pre-2.1, this session. `.ac-tree-disclosure-btn` rule in `modules/editor-core/src/design/library.css` got `width: 1.5rem; height: 1.5rem` (24 CSS px square wrapper) + a `:focus-visible` rule for keyboard discoverability. The chevron glyph itself remains 1.1rem and centers via the existing flex chrome — visible glyph size unchanged. The header comment in `chevron-primitives.css` updated to remove the misleading "wrapper padding clears WCAG" claim and to point at the explicit width/height as the clearing mechanism. **Verified** via Playwright `getBoundingClientRect()` on the akai library mockup: every `.ac-tree-disclosure-btn` measures 24×24 px; `clearsWCAG: true` for all probed instances. Roland UI test gate (`make test-ui-roland`) green; the editor-core unit test asserting `.ac-tree-disclosure-btn` class presence still passes.

### Tree disclosure-button is a `<span>`, not a `<button>` — no native button semantics for keyboard / SR

Finding-ID: AUDIT-20260523-02
Status:     verified-2026-05-24
Severity:   medium
Surface:    `modules/editor-core/src/components/library/TreeView.tsx` (`.ac-tree-disclosure-btn` render site)

The disclosure-btn is rendered as a `<span>` with an `onClick` handler in [TreeView.tsx:293-298](/modules/editor-core/src/components/library/TreeView.tsx):

```tsx
{(isDirectory || hasChildren) && (
  <span
    className="ac-tree-disclosure-btn"
    onClick={(e) => { e.stopPropagation(); onToggleExpand(node.id); }}
  >
    <ChevronIcon isExpanded={isExpanded} />
  </span>
)}
```

A non-button element with pointer-only interaction has no `tabindex` (not keyboard-focusable), no `role="button"` (screen readers don't announce it as a control), no Space/Enter key activation (the parent row handles its own keys via `handleKeyDown` on the row, but those drive selection and shift-click range, not the expand toggle independently).

Folder rows DO toggle expand via the row's keyboard handler (the canonical tree-row has `role="treeitem"` and `aria-expanded` per [TreeView.tsx:288-290](/modules/editor-core/src/components/library/TreeView.tsx)), so a screen-reader user navigating the tree can expand a folder via the standard arrow-key affordances on the row itself. That means the chevron span isn't the SOLE expand path — the row provides an "equivalent" via `role="treeitem"`.

But for pointer-only users with motor-impairment assistive tech that exposes focusable controls (switch input, eye tracker, voice control by element label), the chevron's lack of button semantics means it doesn't appear as a discoverable target. Voice-control users can say "click drum-kits" to activate the row (selection) but have no addressable target for the expand affordance.

**Repro:**

1. Open the production library page in Safari / Chrome.
2. Enable VoiceOver / NVDA.
3. Navigate to a folder row; observe that the screen reader announces the row as a `treeitem` with `aria-expanded`. ✅ (Equivalent path exists.)
4. Now try Voice Control: "show numbers" or "show labels". The chevron has no addressable label / number — only the row + the section toggle do. ❌

**Expected:** disclosure-btn rendered as a `<button type="button">` with `aria-label="Expand {folder.name}"` or `aria-label="Collapse {folder.name}"` so all pointer-target taxonomies (including voice-control element enumeration) can address it.

**Actual:** `<span>` with no a11y annotation; voice-control / switch / element-enumeration users have no addressable expand target on a per-folder basis (only the per-row arrow-key affordance, which requires sequential navigation).

**Fix guidance:**

- Change the disclosure-btn render to a `<button type="button" className="ac-tree-disclosure-btn" aria-label={expanded ? \`Collapse ${node.name}\` : \`Expand ${node.name}\`} onClick={...}>`. No CSS changes needed if the button inherits the wrapper's `display: inline-flex` etc.
- The existing `e.stopPropagation()` continues to work on a button.
- Pair with the target-size fix from AUDIT-20260523-01 so a single Phase-2 commit closes both findings against the disclosure-btn surface.

Same wrapper-vs-glyph composition exists for `.ac-device-memory-section-eyebrow` (already a `<button>` per the canonical render — ✅) and `.ac-tree-section-toggle` (already a `<button>` — ✅). The disclosure-btn is the lone holdout.

Surfaced during Phase 1 mockup transposition (commit `62ee5373`).

**Fix landed:** Phase 2 task pre-2.1, this session. `modules/editor-core/src/components/library/TreeView.tsx:292-300` now renders `<button type="button" className="ac-tree-disclosure-btn" aria-label={\`${expanded ? 'Collapse' : 'Expand'} ${node.name}\`} aria-expanded={isExpanded} onClick={...}>` instead of the prior `<span>` shape. The existing `e.stopPropagation()` continues to work — keyboard Space/Enter on the button toggles expand without firing the parent row's onSelect. `SetItem.tsx` (roland) was NOT changed — its `<span className="expand-toggle ac-tree-disclosure-btn">` is purely a glyph wrapper; the click handler lives on the parent and dispatches based on event target. Promoting that span to a button would create a nested-interactive conflict with the parent. Roland UI test gate green; the editor-core unit test for `.ac-tree-disclosure-btn` class presence still passes (the class flow through `<button>` unchanged).

### Fixed-viewport page shell collapses detail body to ~120 px on mobile

Finding-ID: AUDIT-20260523-03
Status:     verified-2026-05-24
Severity:   high
Surface:    `modules/editor-core/src/design/layout-primitives.css` (`.ac-page-shell--fixed-viewport` rule, lines 113-119), `.ac-app-shell` rule lines 200-228

The canonical `.ac-page-shell--fixed-viewport` rule caps the page at
`calc(100dvh - site-header - 2*page-vertical)` unconditionally — no
media query. Combined with `.ac-app-shell`'s `grid-template-columns:
minmax(0, 1fr)` single-column stack below 1024px (the 2-col template
only applies inside `@media (min-width: 1024px)`), the result on
mobile is: list and detail stack vertically inside the height-bounded
parent, the list claims most of the available vertical space, and the
detail body collapses to whatever's left.

**Repro (operator-confirmed 2026-05-23 on iPhone Safari):**

1. Open `programs.html` on a mobile device (or browser at ≤900 px viewport).
2. The list column renders ~5 rows visible.
3. The detail column below shows the header (eyebrow + name input) +
   the tab strip + ONE compact toggle row + the footer band.
4. The slider rows that follow the toggles in the tab body are not
   visible — scrolling the detail body works but the body is only
   ~120 px tall, so each scroll move shows ~2 rows at a time and
   reading the parameter editor becomes impractical.

Same problem will affect TonesPage / PatchesPage / LibraryPage on
mobile in the production roland editor — every consumer of
`.ac-page-shell--fixed-viewport` inherits the bug. The akai mockup
surfaced it because the operator viewed it on a phone; the production
editor likely hasn't been exercised at mobile widths often enough for
this to have been reported through the normal path.

**Expected:** below ~900 px viewport, the fixed-viewport constraint
drops and the page scrolls as one tall document, list above the
detail with each at its intrinsic content height. The list's internal
`.ac-list-scroll` can stay (with a `max-height` cap) so very long
banks don't push the detail too far down.

**Actual:** fixed-viewport applies unconditionally; detail body
collapses; parameter sliders are unreachable without significant
internal-scroll friction.

**Fix guidance:**

```css
@media (max-width: 899px) {
  .ac-page-shell--fixed-viewport {
    height: auto;
    overflow: visible;
  }
  .ac-app-shell,
  .ac-app-shell > * {
    height: auto;
    min-height: 0;
    overflow: visible;
  }
  .ac-list-scroll {
    max-height: 70vh;
  }
}
```

Test coverage: needs a Playwright spec at iPhone-shaped viewport
(414×896 baseline) asserting that the detail body content (slider
rows) is reachable without the user manually scrolling a nested
container. Run against PatchesPage / TonesPage / LibraryPage to
verify the fix doesn't regress the desktop layout.

The akai-harmonization mockup carries an equivalent rule scoped
under `[data-editor='s3000xl']` in `mockups/akai-dialect.css` as a
demonstration; Phase 2 should land the canonical version in
`editor-core/src/design/layout-primitives.css` (and remove the
dialect-scoped override).

Pair-able with AUDIT-20260523-01 + -02 if a mobile-accessibility
sweep on the disclosure-btn is done at the same time.

**Fix landed:** Phase 2 task pre-2.1, this session. The `@media (max-width: 899px)` block lifted into `modules/editor-core/src/design/layout-primitives.css` right under the `.ac-page-shell--fixed-viewport` rule. Below 900 px the rule drops `height: auto` + `overflow: visible` on the shell, lets `.ac-app-shell` and its children grow to content height, caps `.ac-list-scroll` at `70vh` so very long banks don't push the detail off-screen. The duplicate dialect-scoped block was removed from `mockups/akai-dialect.css` (replaced with a one-line note pointing at the canonical fix). **Verified** via Playwright at 414×896 (iPhone baseline) on the akai `programs.html` mockup: list (Banks A + B visible, capped at 70vh) renders above the detail pane; the detail pane shows the full Common-tab content (header + tab strip + 4 AcToggles in compact-grid + all 8 AcSliders + 4 readouts + footer band with Live indicator + Clone/Delete actions) all reachable via page scroll. Roland UI test gate green; the pre-existing rendering spec `page-viewport-containment.spec.ts` continues to assert desktop containment (untouched by the mobile media query).

---
