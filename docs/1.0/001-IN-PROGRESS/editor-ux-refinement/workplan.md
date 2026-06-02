# Workplan — editor-ux-refinement

Long-running track. Phases ship as PRs against `main`; new phases get appended as cross-editor UX refinement scope is identified. Each phase follows the per-commit discipline in `.claude/rules/agent-discipline.md` (no "just for now" deferrals, validator-paired changes, controller is the gate).

## Phase 0: Bug-fix pass — tab active-indicator must track the selected tab (`AcRadioTabs`)

*Identified 2026-06-02 during Phase 1 visual review: the operator noticed the FILTER tab's content was shown while the WAVE (first) tab appeared highlighted.*

> **✅ T0.1–T0.3 DONE** (2026-06-02). Fix: `AcRadioTabs` made **controlled** — a single `useState(activeId)` drives the radios' `checked` (was uncontrolled `defaultChecked`, the source of the stale-paint race) AND adds `aria-selected` to the `role="tab"` labels (also closes an a11y gap: `role=tab` requires `aria-selected`). One source of truth → the indicator and the panel can't disagree. No CSS change needed (the existing `#tt-*:checked ~` rules now paint reliably because React re-asserts `checked` every render). **T0.1** `D-TAB-INDICATOR-01a/b` (tones Filter + patches Mapping) landed in the same commit, failing at `6fe066a6` (no `aria-selected` exists) and passing post-fix; the visual assertion polls the label color past the `transition: color` mid-flight. **T0.2/T0.3** verified: full-page screenshots (no forced reflow) show FILTER highlighted on Tones and MAPPING on Patches — both sent to operator. Existing `D-TONE-EDITOR-TABS-01` / `D-PATCH-EDITOR-TABS-01` stay green; `make test-wiring-roland` 161 passed / same 16 pre-existing failures (no new); chevron/css-dup/clone-dup/anti-patterns/adopters gates clean.

**Goal:** The radio-driven editor tab strip (`AcRadioTabs`, shared by the Tones and Patches editors) must render its active-tab highlight (accent text + underline) on the **selected** tab, reliably, on every paint — not stale-paint the default first tab.

**Evidence (controller-verified via DOM probes + screenshots, 2026-06-02):**
- The selected tab's radio is correct: clicking Filter sets `#tt-filter` `checked=true` / `matches(':checked')=true`, `#tt-wave` `checked=false`; single `.ac-tabs` container, no duplicate IDs, one `name=tone-tab-0` group. The **panel content is always correct** (the Filter panel shows).
- But on the full-page paint the **accent color + `::after` underline render on WAVE** (`color=rgb(107,195,234)`, underline ~opaque) while FILTER renders dim (`color=rgb(148,163,184)`, underline ~transparent).
- Forcing a layout reflow on the strip (an element-only screenshot, or `getComputedStyle` on the strip element) makes FILTER highlight correctly — i.e. it's a **stale-paint / uncontrolled-input race**, not a wrong-tab-selected logic error.

**Root cause (hypothesis to confirm under TDD):** `AcRadioTabs` renders **uncontrolled** `<input type="radio" defaultChecked>` and drives BOTH panel display and the active-tab indicator purely via `#tt-<id>:checked ~ …` sibling selectors in `_shared.css`. The panel-display rule (`~ .ac-panels > [data-tab]`) repaints reliably; the active-indicator rule (`~ .ac-tab-strip [for]`) can stale-paint to the `defaultChecked` first tab after a React re-render. Because the IDs (`tt-*` / `pt-*`) are static and the state is uncontrolled, the indicator and the panel can momentarily disagree.

**Scope:** `AcRadioTabs` is shared — the fix lands once and corrects **both** the Tones (`tt-*`) and Patches (`pt-*`) editors. This is NOT a Phase-1 (filter-compaction) regression — Phase 1 touched only filter *panel content*; the tab strip is unchanged from the pre-Phase-1 HEAD.

**Modules affected:**
- `modules/roland-sxx0-editor/src/components/common/AcRadioTabs.tsx` (the primitive)
- `modules/roland-sxx0-editor/src/styles/_shared.css` (the `.ac-tab` active-state rules, if the fix moves off pure `:checked`)
- `modules/roland-sxx0-editor/test/wiring/` (new regression spec; existing `D-TONE-EDITOR-TABS-01` / `D-PATCH-EDITOR-TABS-01` are the safety net)

### Tasks

- **T0.1 — Failing regression test first.** Add a wiring spec `D-TAB-INDICATOR-01` that, after switching to a non-default tab (Filter on tones; Mapping on patches), asserts the **selected** tab label carries the active treatment AND the default first tab does NOT — read the rendered indicator, not just the radio property (e.g. assert the selected `[for="tt-filter"]` has the accent `color` / non-transparent `::after` background and `[for="tt-wave"]` does not). The test MUST FAIL against current `main` (reproduces the stale-paint). Per `validator-paired-changes`: articulate the assertion that distinguishes pre/post behavior before writing the fix. **Proven complete when:** the new spec fails at HEAD `6fe066a6` and the failure message names the wrong-tab indicator.

- **T0.2 — Make the active-tab state robust.** Recommended: drive the active tab from a controlled `useState` in `AcRadioTabs`, applying an explicit `.ac-tab--active` (or equivalent) class to the selected label and `data-tab`-shown panel, so the indicator and panel share ONE source of truth that can't stale-paint. Keep the radio inputs for keyboard/a11y, but stop relying solely on the `:checked` paint for the visual indicator. (Alternative if a CSS-only fix proves sufficient: eliminate the race without React state — but only if T0.1 stays green deterministically across repeated runs.) Whatever the mechanism, do NOT leave a `defaultChecked`-vs-render divergence. **Proven complete when:** T0.1 passes; `D-TONE-EDITOR-TABS-01` + `D-PATCH-EDITOR-TABS-01` still pass; `make test-wiring-roland` shows no NEW failures vs the documented pre-existing baseline; a full-page screenshot of the Filter tab (no forced reflow) shows FILTER highlighted, attached for operator review.

- **T0.3 — Cross-editor parity check.** Verify the same fix corrects the Patches editor tab strip (`pt-common` / `pt-mapping`) — switch to Mapping, confirm the indicator tracks. If `AcRadioTabs` is promoted to editor-core as part of the fix, register the adopter-manifest entry. **Proven complete when:** the patches-side assertion in `D-TAB-INDICATOR-01` passes and a patches Mapping-tab screenshot confirms.

### Phase 0 acceptance criteria

- The active-tab highlight tracks the selected tab on the natural paint (no forced reflow needed), on both the Tones and Patches editors.
- `D-TAB-INDICATOR-01` lands in the same commit as the fix and fails against `6fe066a6`.
- Existing tab contract tests stay green; no new `make test-wiring-roland` failures beyond the documented pre-existing baseline.
- Operator confirms the corrected highlight via screenshot.

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

> **⚠ SCOPE CORRECTION (2026-06-02, code-explorer finding).** The original scope-inventory missed that `FilterDisplay` and `AdsrDisplay` share the **same** CSS classes (`.s3k-envelope-display`, `.s3k-adsr-{bg,fill,line,dot,hit}` + `--draggable`/`--dragging` modifiers). The original T8.1/T8.2 plan (rename to `.ac-filter-curve-*`, delete `.s3k-adsr-*` from `index.css`) would **break `AdsrDisplay`**. Corrected, DRY-correct plan:
> - Promote the shared chrome to a **generic** `modules/editor-core/src/design/curve-display-primitives.css` with **`.ac-curve-*`** classes (`.ac-curve-display`, `.ac-curve-{bg,fill,line,dot,hit}`, `--draggable`/`--dragging`) — generic because an ADSR envelope is not a "filter curve".
> - `AcFilterCurveEditor` (filter-specific LPF math) emits the `.ac-curve-*` chrome classes.
> - **T8.2 widens** to also reclass the Akai `AdsrDisplay` to the same `.ac-curve-*` classes (mechanical className swap, identical values), THEN delete `.s3k-adsr-*` / `.s3k-envelope-display` from `index.css` (keeping `.s3k-adsr-label`, which only `AdsrDisplay` uses and isn't part of the shared chrome). Both Akai components get before/after screenshot verification per `css-refactor.md`.
> - Also generalize the component's `onChange` from Akai field names (`{FILFRQ, FILQ}`) to a device-agnostic **`onChange(frequency, resonance)`**, and add an optional **`disabled`** prop (Roland passes `!tvf.enabled`). Roland ranges are **0–127** for both cutoff and resonance (confirmed in `SSeriesTvfParams`), so Roland adopts with `cutoffMax={127} qMax={127}`; Akai with `cutoffMax={99} qMax={15}`.

> **✅ T8.1–T8.5 DONE** (2026-06-02), atomic promotion commit. `AcFilterCurveEditor` in editor-core (generic `.ac-curve-*` chrome in `curve-display-primitives.css`); Akai `KeygroupEditor` + `AdsrDisplay` migrated to it / the shared chrome, `FilterDisplay.tsx` deleted, `.s3k-adsr-*` chrome removed from `index.css` (kept `.s3k-adsr-label`); Roland `ToneFilterPanel` adopts + reorders (envelope → curve → sliders → toggles, `cutoffMax/qMax=127`, streaming `onChange`/commit-on-release, `disabled={!tvf.enabled}`); adopter-manifest + anti-pattern registered. All editors build; `check-adopters` / `check-anti-patterns` / `check-clone-duplication` / `check-css-duplication` clean. Surfaced 6 pre-existing scaffolding clones among AcFilterCurveEditor/AdsrDisplay/D110EnvelopeEditor → dispositioned `ignore-with-justification`; extraction is **F-8**. **Remaining: T8.6 (protecting tests), T8.7 (UI specs), and the v2 filter-tab compaction T8.9–T8.13 (AcDisclosure + TWEAK disclosures + section collapsibles, which supersede the failed bare-reorder T8.8 — see that block for the design-SSOT-driven scope).**

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

- **T8.8 — Visual verification (above-the-fold).** ⚠ **Reordered but NOT compacted per the v2 mockup — the above-the-fold goal is unmet because the v2 design wasn't followed.** Measured the as-built FILTER tab: curve renders + drags (`.ac-curve-display` present) but its bottom edge sits at **y≈1010px** — below the 720–800px fold — because the slider grid + the envelope's segment table are shown **expanded by default**.
  - **Root cause (honest):** the implementation skipped the v2 mockup's compaction. `docs/1.0/001-IN-PROGRESS/roland-bugfix/explorations/04-tones-v2.html` (the design SSOT, line 2513) specifies: detail controls (**per-segment table, filter sliders + modes**) **hidden by default under nested TWEAK `<details>` disclosures**; **section collapsibles** via native `<details>` (→ `AcDisclosure` in React, which does not exist yet). With those, the default tab is just the envelope graphic + curve graphic → both fit above-the-fold even at short viewports. This is the mockup→implementation gap this whole feature exists to prevent; T8.3 was implemented as a bare reorder without reading the v2 mockup first.
  - **Resolution (the v2 design, not a fresh decision):** restructure `ToneFilterPanel` so (1) the param-slider grid + Filter-Enable/EG-Polarity toggles live under a **"Tweak" disclosure** collapsed by default; (2) the envelope's per-segment table is similarly TWEAK-disclosed (likely inside `ToneEnvelopeEditor`); (3) sections become collapsible (build `AcDisclosure` in editor-core, replacing native `<details>`; the v2 mockup anticipated this). Port `.tones__tweak` styling from the mockup. Then re-verify above-the-fold. **This is the next Phase-1 work item** (was missed; now correctly scoped).

### v2 filter-tab compaction (T8.9–T8.13)

> **✅ T8.6, T8.7, T8.9–T8.13 DONE** (2026-06-02). Summary:
> - **T8.9** — `AcDisclosure` built in editor-core, rendering the canonical `AcChevron`. It **supersedes** the prior `CollapsibleSection` (DRY: there was already a live disclosure primitive; a second one would duplicate). `CollapsibleSection` deleted; its sole consumer (D-110 `PartialEditor`, 7 sections) migrated — pure import/tag swap since `AcDisclosure`'s theme bag is a superset (`+hint/labelGroup`). Contract test (6 cases: section/tweak presentations, controlled/uncontrolled, AcChevron marker, collapsed-unmount). Registered in `adopter-manifests.yaml` (`ac-disclosure`, 3 adopters). `make check-chevron-sizing` clean.
> - **T8.10** — Roland FILTER tab: param sliders + Filter-Enable/EG-Polarity moved under one collapsed "Tweak" (`parameters · modes`) inside the Filter Response section.
> - **T8.11** — the per-segment editor moved under the envelope's collapsed "Tweak" (`per-segment values`). Root-caused that the v2 "per-segment table" maps to `AcEnvelope`'s always-on `AcEnvelopeTable` (redundant with the inline edit grid) → added an opt-in **`AcEnvelope.showTable`** (default `true`; Roland tone envelopes pass `false`), suppressing the redundant table so the graphic stays compact. Applies to both the Filter (TVF) and Amp (TVA) envelopes via the shared `ToneEnvelopeEditor`.
> - **T8.12** — Envelope + Filter Response are two `AcDisclosure` section-collapsibles (open by default); new `.tones__section--collapsible` / `.tones__tweak*` CSS (no chevron-named classes).
> - **T8.13** — above-the-fold **verified** at **1280×900** (named viewport): `D-TONE-FILTER-FOLD-01` asserts both graphics' `boundingClientRect` bottoms ≤ 900 (measured curve bottom **≈887px**, envelope ≈566; pre-compaction the curve bottom was ≈1010 — the T8.8 finding). A tones-scoped section-gap tighten recovered the last ~16px. Screenshot captured + sent to operator.
> - **T8.6** — protecting tests: `AcFilterCurveEditor` contract test (4 cases incl. dual-axis drag — the primitive had **zero** tests before) + `D-TONE-FILTER-ORDER-01/02` (v2 structure + default-collapse). `D-TONE-ENV-06/12` re-pointed from the removed `AcEnvelopeTable` to the Tweak-reachable per-segment editor.
> - **T8.7** — interaction specs: `D-TONE-FILTER-CURVE-DRAG-01` (real-pointer curve drag streams a higher cutoff via the curve's live aria-label) + the contract test's dual-axis coverage.
>
> **Verification:** editor-core `AcDisclosure`/`AcFilterCurveEditor` tests green; `make test-wiring-roland` tone specs (`tone-filter-layout` + `tone-display` + `tone-writes`) **55 passed / 0 failed**; full `make` build green across all editors; `check-chevron-sizing`/`check-css-duplication`/`check-clone-duplication`/`check-anti-patterns`/`check-adopters` all clean.
>
> **Findings surfaced (NOT caused by this work — pre-existing on the branch, confirmed against HEAD `34b4ba48`):** `make test-wiring-roland` has **16 pre-existing failures** (Play / Library / Patch-zones / Video-drawer / Cross-cutting); editor-core `pnpm test` has **7 pre-existing failures** (`AcEnvelope` graph-point, `PluginLibraryBrowser` ×2, `MoveDialog` ×4) — all on surfaces untouched here; verified by re-running on clean HEAD.
>
> **Not visually captured:** the D-110 `PartialEditor` after the marker swap (−/+ → `AcChevron`) — build-verified across all editors; a screenshot needs the D-110 dev-server + a mounted tone. Recommend an operator glance.

**Design SSOT:** [`docs/1.0/001-IN-PROGRESS/roland-bugfix/explorations/04-tones-v2.html`](../roland-bugfix/explorations/04-tones-v2.html) (the Phase-8 filter-tab redesign; grandfathered hi-fi mockup). **Read it before implementing** — the compaction comes from HIDING detail under disclosures, not from reordering visible blocks (the gap that made the bare-reorder T8.3 miss the above-the-fold goal). Per `feedback_read_mockup_before_redesign`.

**Why this exists:** T8.1–T8.5 promoted the `AcFilterCurveEditor` primitive and reordered the Roland FILTER tab, but left every detail control expanded, so the curve falls below the fold (T8.8). The v2 mockup makes the tab vertically compact via TWEAK disclosures + section collapsibles, so the default tab is just the two graphics — both above-the-fold.

- **T8.9 — Build `AcDisclosure` primitive in editor-core.** The v2 mockup uses native `<details>/<summary>` with an explicit note that `AcDisclosure` replaces them "post-Phase 8" (the primitive does not exist yet — confirmed absent). Build it as a shared editor-core primitive with two presentations from the mockup: (a) **section-collapsible** (header + collapsible body, open-by-default option) and (b) the **"TWEAK pill"** (inline `label` + `hint` + marker, collapsed-by-default). MUST render its marker via the canonical `AcChevron` (the chevron gate forbids any chevron-named class); the wrapper class is named after its role (e.g. `.ac-disclosure-summary`), never the glyph. Controlled + uncontrolled. **Proven complete when:** `AcDisclosure` exported from editor-core; a contract test asserts expand/collapse toggles body visibility + renders `AcChevron`; `make check-chevron-sizing` clean; editor-core builds and all editors build (`make`).

- **T8.10 — TWEAK-disclose the Roland filter-tab detail controls.** In `ToneFilterPanel`, wrap the param-slider grid **and** the Filter-Enable/EG-Polarity compact-grid under a single `AcDisclosure` "Tweak" pill, collapsed by default (per the v2 mockup's "filter sliders + modes hidden by default under nested TWEAK disclosures"). Port `.tones__tweak` styling from the mockup into the Roland styles (or fold it into `AcDisclosure`). Remove extraneous eyebrow text per the v2 "extraneous eyebrow text removed throughout". **Proven complete when:** the default FILTER tab renders only the envelope graphic + filter-curve graphic (no slider grid visible); the sliders + toggles appear on expanding "Tweak"; a UI spec asserts the sliders are hidden by default and shown after expand.

- **T8.11 — TWEAK-disclose the envelope per-segment table.** The v2 mockup nests the per-segment time/level table inside the envelope section under its own "Tweak" disclosure (collapsed by default), leaving the envelope GRAPHIC + sustain/end pips visible. Apply this inside `ToneEnvelopeEditor` (or wrap it) so the envelope is compact by default. **Proven complete when:** the envelope graphic + sustain/end controls show by default; the segment table appears only on Tweak-expand; the existing TVF-envelope wiring specs still pass (`make test-ui-roland`).

- **T8.12 — Make the filter-tab sections collapsible.** Wrap the Envelope section and the Filter-curve section in `AcDisclosure` section-collapsibles (open by default), per the v2 mockup's "consistent section collapsibles". **Proven complete when:** each section header toggles its content; default state matches the mockup (open).

- **T8.13 — Re-verify above-the-fold (supersedes T8.8's failed check).** With the detail controls TWEAK-collapsed, capture the Roland FILTER tab device-free and assert via `getBoundingClientRect()` that BOTH the envelope graphic and the filter-curve graphic sit within the viewport without scrolling, at the agreed default viewport (**decide: 720 vs 800 vs 900px tall** — name it in the spec). **Proven complete when:** the assertion passes at the named viewport; the screenshot is captured + attached for operator review; the layout matches the v2 mockup.

*Cross-editor note:* `AcDisclosure` is a shared primitive — if any other editor later adopts it, register an adopter-manifest entry then. Akai's filter section is NOT in this compaction's scope (the v2 mockup is the Roland FILTER tab); Akai keeps its current keygroup-editor layout.

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

---

## Phase 2: Device-free render & capture engine

*Added 2026-06-01 per the approved design doc [`design-mockup-pipeline.md`](./design-mockup-pipeline.md) (deskwork id `22d01eb5…`, Final). Foundation for Phases 3–4 and for promotional screenshots.*

**Goal:** One engine that launches a real editor route with **no hardware attached**, feeds it **real-device-captured** data via the existing simulated-MIDI fixtures, and captures a **deterministic** PNG. Serves three consumers: promotional screenshots (website/blog/social), in-loop visual review of real built UI, and the Phase 3 living styleguide gallery. DRY: generalizes the existing `scripts/run-test-harness-e2e.sh` launch pattern; home in `modules/e2e-infra/`.

**Modules affected:**
- `modules/e2e-infra/` (engine: launcher generalization, scene-manifest loader, capture step)
- root `Makefile` (`promo-shots` target)
- `.gitignore` (`out/promo/`)
- `docs/promo/` (committed gallery dir for operator-promoted shots)
- captured fixtures under `modules/sampler-devices/test/fixtures/<device>/` (selection only; new captures are a sub-task, never fabrication)

### Tasks

- **P2.1 — Generalize the harness launcher into a reusable device-free render launcher.** ✅ **Done** — extracted into `modules/e2e-infra/scripts/dev-server-lib.sh` (`run_playwright_harness` + canonical `ac_kill_tree` teardown); both editors' `run-test-harness-e2e.sh` now source it (Akai gained the robust process-tree cleanup). Verified by independent re-run: `make test-ui-roland` (4 passed, 2 skipped) + `make test-ui-s3k` (19 passed). No `.ts`/`.css` in the diff, so clone/CSS gates are trivially clean; the extraction removes duplicated bash.
  - *Original spec:* Extract the OS-assigned-port → Vite-dev-server → ready-wait → hand-off-URL flow shared by `modules/akai-s3k-editor/scripts/run-test-harness-e2e.sh` and the Roland equivalent into a single launcher in `modules/e2e-infra/`. The existing `make test-ui-s3k` / `make test-ui-roland` must consume the extracted launcher (no parallel copy). **Proven complete when:** one launcher API brings up either editor's dev server device-free and reports the URL; `make test-ui-roland` + `make test-ui-s3k` both green via the controller's independent re-run; `make check-clone-duplication` clean.

- **P2.2 — Scene-manifest schema + initial manifest.** ✅ **Done** — `modules/e2e-infra/src/promo/scenes.ts` (typed `Scene` discriminated union: `FixtureScene` for Roland simulated-MIDI captures, `FactoryScene` for the Akai factory route; no `any`) + `validate-scenes.ts` (throws on duplicate id / non-absolute route / non-positive viewport / **absent captured fixture**) + `validate-scenes.selfcheck.ts` (adversarial: real manifest clean, missing-fixture rejected, duplicate-id rejected). Wired as `make check-promo-manifest`; passes via independent run. Initial scenes: Roland s330 tones / patches / play (real captures `tones-bank-0` / `patches-bank-0` / `play-init`), Akai keygroups (factory route).
  - *Decision logged:* fixtures exist only for **s330** (s550 dir empty → those in-context specs are the skipped ones); s550 promo + real Akai captures are P2.5 capture-from-hardware tasks. Akai keygroups uses factory data (how its harness already works) — surfaced for operator review.
  - *Original spec:* A version-controlled declarative list of shots: `{ id, editor, route, scenario (captured-fixture name), viewport }`. Initial scenes: Roland tones **FILTER tab**, Roland patches, Roland play, Akai keygroups. **Proven complete when:** the manifest parses under a typed schema (no `any`); a validator asserts every entry resolves to a real route AND an existing captured fixture, and **throws** (no fabrication) when a referenced fixture is absent — shipped validator-paired with a scenario that fails against a manifest pointing at a missing fixture.

- **P2.3 — Deterministic capture step.** ✅ **Done** (2026-06-01) — built per the operator's "reuse the e2e-infra pattern" decision (did NOT duplicate the `test/rendering/` smokes).
  - `dev-server-lib.sh` refactored: extracted `run_with_dev_server <cmd...>` (start vite on OS port → export `E2E_PORT` → run cmd → `ac_kill_tree` teardown); `run_playwright_harness` is now a thin caller. **Re-verified after refactor:** `make test-ui-roland` 4✓ / `make test-ui-s3k` 19✓.
  - `modules/e2e-infra/src/promo/capture.ts` — Playwright API; reads `E2E_PORT` + `PROMO_EDITOR`, filters `PROMO_SCENES`, per scene `goto(...)` → `networkidle` → `document.fonts.ready` → `screenshot({fullPage, animations:'disabled'})` → `out/promo/<id>.png`. Pinned 1280×800 @2x; no sleeps.
  - **Determinism verified:** initial run caught a real non-determinism on `roland-s330-tones` (live rec-LED/VFD animation captured mid-frame); fixed with Playwright `animations:'disabled'`. `make promo-shots-determinism` (`tools/check-promo-determinism.sh`) runs `promo-shots` twice and asserts all 4 PNGs byte-identical — passes.
  - Produced real device-free PNGs (2560×1600 @2x): roland tones/patches/play (production pages, marketing-clean) + akai keygroups (currently the test-harness page — see #470 for the production-page + real-fixture follow-up).

- **P2.4 — Output + invocation.** ✅ **Done** (2026-06-01) — `make promo-shots` emits one PNG per manifest scene to a gitignored `out/promo/` (added `out/` to `.gitignore`); `docs/promo/` exists as the curated, committed gallery home (with a README on the promote-from-`out/promo/` workflow). Verified: 4 PNGs produced.

- **P2.5 — Captured-fixture audit + capture-gap handling.** ✅ **Done** (2026-06-01) — every Roland scene maps to a real s330 capture (`tones-bank-0` / `patches-bank-0` / `play-init`); the validator throws on any absent fixture (no fabrication possible). The two capture gaps are tracked, not faked: s550 fixtures → [#469](https://github.com/audiocontrol-org/audiocontrol/issues/469); real Akai fixtures (Akai scene currently uses the factory route) → [#470](https://github.com/audiocontrol-org/audiocontrol/issues/470).

- **P2.6 — Phase 1 T8.8 consumes the engine.** ⏳ **Blocked on Phase 1.** The `roland-s330-tones` scene is already in the manifest and captured by `make promo-shots`, so the FILTER tab is shot today — but the *above-the-fold filter-curve* deliverable lands only once Phase 1 (T8.3) builds `AcFilterCurveEditor` into the FILTER tab. When Phase 1 ships, T8.8 = read the engine's `roland-s330-tones.png` instead of an ad-hoc Playwright call (and add a dedicated FILTER-tab scene if the default tab differs).

### Phase 2 acceptance criteria

- `make promo-shots` renders the full initial manifest device-free, deterministically, with no hardware attached.
- The launcher is shared with the test harness (no duplicated launch script); clone + CSS duplication gates clean.
- All on-screen content originates from real-device-captured fixtures; no mock/synthetic data outside the blessed test-fixture category.
- Engine home is `modules/e2e-infra/`; output contract (`out/promo/` gitignored, `docs/promo/` committed) holds.
- Operator confirms the screenshot quality on at least the four initial scenes.

---

## Phase 3: Per-editor design-language specification

*Added 2026-06-01 per the approved design doc. The "backfilled leg": cleaving visual design out of mockups leaves it needing a formal home.*

**Goal:** A durable per-editor specification of visual identity (palette, typography, signature/branded components and their rationale), plus a **living styleguide gallery rendered from real components** (so the canonical pixels cannot drift from as-built). Consolidates today's scattered identity (the old `01-design-language.html` mockup, the rec-LED / VFD-glow / CRT / virtual-front-panel conventions).

**Modules affected:**
- `docs/design-language/roland.md`, `docs/design-language/akai.md` (new specs)
- `docs/design-language/jv1080.md`, `docs/design-language/d110.md` (one-line scope-pointer stubs)
- a device-free living-gallery route per editor (depends on Phase 2 engine to shoot it)
- cross-links into `DESIGN-SYSTEM.md`

### Tasks

> **P3.1–P3.3 ✅ Done** (2026-06-01) — `docs/design-language/{roland,akai}.md` authored with every visual claim cited to a real token/primitive (grep-verified: `--ac-roland-primary #6bc3ea`, `--ac-color-rec #f6533c`, `VfdGlowDefs`, `.ac-chevron`, `--ac-fp-*`, Akai `--ac-color-accent #d4a843`, `.s3k-adsr-*`). `jv1080.md` + `d110.md` are honest one-line scope stubs. roland.md also pre-stages the P3.5 canonical-source note. **P3.4 (living gallery) remains — blocked on the Phase 2 engine.** Flagged for Phase-3 review: Akai `.s3k-param-value` uses a local `ui-monospace` stack instead of a token (a real divergence, documented in akai.md, not yet fixed).

- **P3.1 — Author `docs/design-language/roland.md`.** Palette, typography, signature components (rec-LED red as the S-550 PLAY-LED homage, VFD glow, CRT, virtual front panel) each with *rationale* and a reference to the real `DESIGN-SYSTEM.md` token / `.ac-*` primitive that implements it, plus do's/don'ts. **Proven complete when:** every visual claim cites a token or `.ac-*`/`.sk-*` primitive that actually exists (grep-verified at author time); zero fabricated tokens; no temporal/projection language per docs standards.

- **P3.2 — Author `docs/design-language/akai.md`.** Same shape for the Akai S3000XL editor's realized identity. **Proven complete when:** same gate as P3.1 for the Akai surface.

- **P3.3 — Scope-pointer stubs for JV-1080 / D-110.** `docs/design-language/jv1080.md` + `d110.md` each carry a single line: "design language TBD when this editor gets visual work" — defining their language now would be fabrication. **Proven complete when:** both files exist with only the scope-pointer; no invented design language.

- **P3.4 — Living styleguide gallery (depends on Phase 2).** A device-free route per spec'd editor (Roland, Akai) that catalogues the real signature components; added as `promo-shots` manifest scenes. The markdown specs link to the gallery shots as their canonical-pixels reference. **Proven complete when:** the gallery route renders the real components (not re-implementations); `make promo-shots` produces the gallery PNGs; P3.1/P3.2 specs link to them.

- **P3.5 — Retire the old hi-fi design-language mockup's authority.** ✅ **Done** (2026-06-01) — both `docs/design-language/{roland,akai}.md` carry a "Retiring the old design-language mockup (P3.5)" section naming `…/explorations/01-design-language.html` as grandfathered/historical and the per-editor spec + living gallery as the single canonical source.

### Phase 3 acceptance criteria

- Roland + Akai each have a formal design-language spec whose every visual claim resolves to a real token/primitive.
- The living gallery renders from real components and is shot by the Phase 2 engine; specs cite it for canonical pixels.
- JV-1080 / D-110 carry honest scope-pointers, not fabricated language.
- A single canonical design-language source per editor (no competing artifacts).
- Operator confirms the specs match the editors' realized identity.

---

## Phase 4: Lo-fi sketch mockup kit + wireframe-only gate

*Added 2026-06-01 per the approved design doc. Independent of the Phase 2 engine. Replaces hi-fi mockups; points the "teeth" at guaranteeing lo-fi-ness.*

**Goal:** Replace hi-fi mockups with deliberately **hand-drawn (Sharpie-illustrator) sketches** that carry only UX (layout/flow/hierarchy) and are structurally incapable of impersonating the product. Inverted teeth: a gate that exploration HTML imports **only** the shared sketch kit — never design-system tokens, `.ac-*` classes, or brand colors.

**Modules affected:**
- `docs/wireframe-kit/sketch-kit.css` + a bundled hand-drawn webfont (local, not CDN)
- `tools/check-mockup-lofi.*` + `Makefile` (`check-mockup-lofi` target) wired into the pre-commit chain
- the scope-discovery validator suite (a new adversarial scenario + gutted-stub self-check)
- the `brief.md` template + `.claude/rules/workflow-playbooks.md`
- a grandfather allowlist for existing hi-fi explorations

### Tasks

> **Phase 4 ✅ Done** (2026-06-01) — all of P4.1–P4.5.
> - **P4.1 + P4.5** — `docs/wireframe-kit/sketch-kit.css` (hand-drawn `--sk-*`/`.sk-*` kit; grep-clean of `--ac-*`/`.ac-*`/`@import`/CDN), `example-wireframe.html` (filter-tab sketch linking ONLY `./sketch-kit.css`), `README.md`. Local-OFL-webfont bundling noted as a follow-up.
> - **P4.2** — `tools/check-mockup-lofi.sh` + `make check-mockup-lofi`, wired into `.githooks/pre-commit` (fires on staged `docs/**/explorations/**/*.html`). Structural rule: an exploration mockup may link only `sketch-kit.css`, no `@import`, no remote resources. Validator-paired self-check `tools/check-mockup-lofi.validate.sh` (`make check-mockup-lofi-validate`): clean wireframe passes; design-system-link / `@import` / remote-CDN all rejected — proven by independent run.
> - **P4.3** — `tools/mockup-lofi-grandfather.txt` allowlists the 12 pre-convention hi-fi mockups; gate clean at HEAD.
> - **P4.4** — `docs/wireframe-kit/brief-template.md` (adds `derived_from:` + `design_language:` fields) + a "Author a lo-fi exploration mockup" playbook in `.claude/rules/workflow-playbooks.md`.

- **P4.1 — Author the sketch kit.** `docs/wireframe-kit/sketch-kit.css`: a bundled hand-drawn webfont (Architects Daughter / Caveat, served locally for determinism + offline), Sharpie-black strokes on off-white "paper," a persistent "WIREFRAME — not final visual" banner, and a small `.sk-*` box/label/button/field/note vocabulary. Pure-CSS sketch (rough.js deferred per design doc). **Proven complete when:** a sample wireframe renders in the hand-drawn aesthetic with no network fetch (font is local); kit lives outside product modules.

- **P4.2 — `check-mockup-lofi` gate (validator-paired).** Exploration HTML (`docs/**/explorations/**/*.html`, excluding the grandfather allowlist) may reference **only** `sketch-kit.css` — no design-system tokens, no `.ac-*` classes, no brand-color literals. Violation → FAIL. Wire into the pre-commit gate chain + `Makefile`. **Proven complete when:** the gate FAILS an adversarial scenario (a wireframe importing design-system CSS), PASSES a clean wireframe, and carries a gutted-stub self-check proving the rejection has teeth; `pnpm test:scope-discovery` green; the scenario fails against the pre-gate behavior (revert test per `validator-paired-changes`).

- **P4.3 — Grandfather existing hi-fi explorations.** Allowlist the existing s550 + roland-bugfix Phase 8 hi-fi mockups so the gate doesn't retroactively fail them; converting historical/shipped explorations is pure cost. **Proven complete when:** `make check-mockup-lofi` is clean at HEAD with the existing mockups present; the allowlist is explicit and dated.

- **P4.4 — Brief convention + playbook.** The `brief.md` template gains a "derived from current page/state" field and a "design-language ref" field (pointing at the Phase 3 spec, so a sketch declares its visual vocabulary by reference instead of drawing it). Document the lo-fi-mockup workflow in `.claude/rules/workflow-playbooks.md`. **Proven complete when:** the template + playbook are updated; a sample brief exercises both new fields.

- **P4.5 — Worked example.** Author one sample lo-fi wireframe using the kit (e.g. a sketch of a candidate editor-tab reorder) to prove the kit + demonstrate the pattern for future explorations. **Proven complete when:** the example renders in the hand-drawn aesthetic and passes `make check-mockup-lofi`.

### Phase 4 acceptance criteria

- New exploration mockups are hand-drawn sketches that cannot be mistaken for shippable UI.
- `check-mockup-lofi` is wired into pre-commit, ships validator-paired (adversarial scenario + gutted-stub self-check), and `pnpm test:scope-discovery` is green.
- Existing hi-fi mockups are grandfathered; the gate is clean at HEAD.
- The brief template + playbook codify the lo-fi convention and the design-language reference.
- Operator confirms the sketch aesthetic and the gate behavior.

## Deferred / follow-up backlog

Everything identified-but-not-yet-done lives here so it can't get lost (operator directive 2026-06-01: "if it's in the workplan, we will eventually get to it"). Phasing is loose — these get pulled in as capacity allows.

- **F-1 — Capture s550 promo fixtures from hardware** *(P2 follow-up; [#469](https://github.com/audiocontrol-org/audiocontrol/issues/469))*. The promo manifest shoots s330 only (the s550 fixtures dir is empty). Record s550 NDJSON via `make record-fixtures-roland-s550` for tones/patches/play, add s550 scenes to `scenes.ts`. Needs S-550 hardware; no fabricated fixtures.
- **F-2 — Capture real Akai S3000XL promo fixtures** *(P2 follow-up; [#470](https://github.com/audiocontrol-org/audiocontrol/issues/470))*. The Akai keygroup promo scene uses factory data today; back it with a real captured fixture. Needs S3000XL hardware.
- **F-3 — Fix Akai `.s3k-param-value` mono-stack divergence** *(P3 follow-up)*. `modules/akai-s3k-editor/src/index.css` uses a local `ui-monospace, 'Cascadia Code'…` stack in 4 places (`.s3k-param-value`, `.s3k-param-input`, +2) instead of `var(--ac-font-mono)` (confirmed to exist at `tokens.css:85`). **NOTE:** this is a *visible* font change (JetBrains Mono vs the local stack) across a shared CSS file, so it requires the `.claude/rules/css-refactor.md` screenshot-verify protocol (before/after on affected Akai pages) and operator review of the new look — not a silent swap. Operator de-prioritized ("don't sweat the small stuff"), so it stays here until pulled in deliberately.
- **F-4 — Bundle an OFL hand-drawn webfont into the sketch kit** *(P4 follow-up)*. `docs/wireframe-kit/sketch-kit.css` uses a macOS system marker-font stack (Bradley Hand / Chalkboard / Comic Sans). Bundle a local OFL `.woff2` (e.g. Architects Daughter) via `@font-face` so the hand-drawn aesthetic is deterministic across platforms, not just macOS. Keep it local (no CDN) — the `check-mockup-lofi` gate forbids remote resources.
- **F-5 — Framed / social-media-preset screenshot variants** *(P2 follow-up, after P2.3/P2.4)*. Add optional output presets to the promo engine: OG image (1200×630), square, and an optional browser/device frame around the captured UI, on top of the plain full-app-shell shot.
- **F-6 — rough.js wobbly-stroke upgrade for the sketch kit** *(P4 follow-up, optional)*. If the pure-CSS sketch reads too clean, bundle rough.js for genuinely hand-drawn SVG strokes. Cosmetic; only if the operator wants more wobble.
- **F-8 — Extract a shared `useSvgDragNode` hook** *(Phase 1 follow-up)*. The SVG drag-node / envelope scaffolding (`getMousePos`, the drag `useEffect`, the hit/dot node pattern) is duplicated across `AcFilterCurveEditor`, the Akai `AdsrDisplay` (both components), and `D110EnvelopeEditor` — 6 clone groups dispositioned `ignore-with-justification` during T8.1. Extract a shared hook/primitive so the scaffolding lives once. Crosses 3 modules (editor-core, akai-s3k-editor, d110-editor), so it's its own effort.
- **F-7 — JV-1080 / D-110 design-language specs** *(P3 follow-up)*. `docs/design-language/{jv1080,d110}.md` are honest one-line stubs today. Author full specs when those editors get visual work (defining their language before that would be fabrication).

## Pre-commit Discipline

- One refinement per commit; descriptive subject; no sweep refactors slipped in alongside a phase task.
- No "while I was in here" sibling changes — they get their own commit and their own triage row, or a follow-up issue.
- Validator-paired changes per `.claude/rules/agent-discipline.md`: every gate-semantic change ships with a scenario that would have failed against the prior behavior.
- The controller re-runs the load-bearing test gate independently after every implementer dispatch — the implementer's reported pass count is a claim, not evidence.

## GitHub Tracking

- **Parent issue:** [#465](https://github.com/audiocontrol-org/audiocontrol/issues/465) — cross-editor UX refinement track.
- **Phase 1 issues:** TBD (to be created once Phase 1 acceptance is locked).
- **Phase 2:** [#466](https://github.com/audiocontrol-org/audiocontrol/issues/466) — device-free render & capture engine.
- **Phase 3:** [#467](https://github.com/audiocontrol-org/audiocontrol/issues/467) — per-editor design-language specification.
- **Phase 4:** [#468](https://github.com/audiocontrol-org/audiocontrol/issues/468) — lo-fi sketch mockup kit + wireframe-only gate.
- **Follow-ups (hardware-gated):** [#469](https://github.com/audiocontrol-org/audiocontrol/issues/469) — s550 promo fixtures; [#470](https://github.com/audiocontrol-org/audiocontrol/issues/470) — Akai S3000XL promo fixtures. Other follow-ups (F-3…F-7) tracked in the Deferred / follow-up backlog section above (workplan-only).

## Out of Scope

- Library browser UX → `library-ux`.
- Device-protocol bug fixes → `roland-bugfix` / device-scoped branches.
- Akai workflow restructuring → `akai-ux-improvement` (complete).
- Foundational workflow architecture → `edit-workflow-architecture`.
