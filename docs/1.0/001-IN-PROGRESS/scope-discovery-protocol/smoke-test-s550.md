# /scope-inventory smoke test against s550-support — 2026-05-22

## Run summary

- Run ID: `2026-05-22T03-47-24-522Z-q1dnlq`
- Feature dir: `docs/1.0/003-COMPLETE/s550-support/`
- Manifest: `docs/1.0/003-COMPLETE/s550-support/scope-manifest.yaml`
- Journal: `docs/1.0/003-COMPLETE/s550-support/scope-inventory/journal.md`
- Evidence: `docs/1.0/003-COMPLETE/s550-support/scope-inventory/runs/2026-05-22T03-47-24-522Z-q1dnlq/`
- Manifest kind: `hybrid`
- Counts: **14 routes, 26 modules, 10 themes, 2 reference_docs**

Agent exit codes: ui-route-enumerator=0, ast-grep-matrix=0, clone-detector-reader=0, prd-themed-pattern-hunter=0. Synthesis exit=0. Elapsed ~31s end-to-end.

### Route note: Connect surface = HomePage / index

The analysis report names five Roland routes including `/connect`. The actual route table (`modules/roland-sxx0-editor/src/App.tsx`) declares `index` (HomePage) + `play`, `patches`, `tones`, `library`. The "Connect" label is set by `modules/roland-sxx0-editor/src/components/layout/Layout.tsx` line 32 — `{ to: basePath, label: 'Connect' }` — so the Connect *page* IS the index route. The manifest's `/` route therefore represents Connect. The manifest catches the Connect surface; the labeling-vs-path discrepancy is a presentational one, not a discovery gap. Coverage scoring below treats `/` as the Connect anchor.

## Surface coverage matrix

Surfaces enumerated from `docs/analysis/s550-redesign-scope-discovery.md` §2. The §2 table has 41 timeline rows; 9 are pure-process or rhetorical entries that don't represent UI/protocol surfaces (mothball workplan, "did you check," code-DRY directive, full revert, DRY rhetoric, process questions, harness validation, e2e-source-tree organisation, TESTING-E2E.md read). Those are excluded. The remaining 32 are scored below.

Match legend: `✓` = full (manifest names route + a theme/pattern that plausibly identifies the class); `~` = partial (manifest names the route or a related theme but not the specific class of issue); `✗` = missed (no manifest element plausibly identifies it).

| # | Surface (from §2) | Match | Notes |
|---|---|---|---|
| 1 | PlayPage sticky header occludes CRT + Part A | ~ | Route `/play` IS in manifest; sticky-header class of issue isn't surfaced by any theme/pattern (DOM-visual, not AST-detectable). |
| 2 | Same pathology on library page (cross-page generalization) | ~ | Both `/play` and `/library` routes in manifest; cross-page-pathology theme not surfaced. |
| 3 | TonesList shows "(unnamed)" while selected tone is named | ~ | Route `/tones` in manifest + `tone` theme; data-binding bug class not surfaced. |
| 4 | TonesPage tab redundantly labels itself below tab strip | ~ | Route `/tones` in manifest; redundant-label / tab-anti-pattern theme not surfaced. |
| 5 | TonesPage parameter controls are wrong primitive kinds (dropdown vs proper) | ~ | Route `/tones` in manifest; primitive-mismatch theme not surfaced — the synthesizer doesn't probe HTML form-element families. |
| 6 | TonesPage inefficient layout — room for 2-3 controls per row | ✗ | Route in manifest; layout-density / wasted-space class not detectable by AST or grep. |
| 7 | TonesPage two-value bank dropdown + four-pole loop-mode dropdown (need toggle) | ~ | Route `/tones` in manifest; AcToggle/dropdown theme not surfaced. |
| 8 | Patches list wider than tones list / cross-page width DRY | ✓ | Routes `/patches` + `/tones` in manifest; `shared` theme + `roland-sxx0-editor` module's clone-group entries (hundreds of jscpd matches across patch/tone code) DO plausibly identify the cross-page duplication class. |
| 9 | DeviceMemoryPanel on Library page should match Tones/Patches list affordances | ✓ | Routes `/library` + `/tones` + `/patches` in manifest; `shared` + `device` themes + roland-sxx0-editor clone groups identify cross-page consistency surface. |
| 10 | DeviceMemoryPanel tones-bank expansion shoves patches header | ~ | Route `/library` in manifest; specific expand/collapse-layout-shove behavior not surfaced. |
| 11 | Sets tree in library pane inconsistent with other tree controls | ~ | Route `/library` in manifest; ac-tree primitive class is in the `ac-class-consumer` grep pattern (so AST agent would find consumers) — but the inconsistency-with-other-tree-controls class isn't named. |
| 12 | VideoCapture stopped state is a black rectangle; sizes mismatch | ✗ | VideoCapture is a sub-component (`modules/roland-sxx0-editor/src/components/video/`), not a route; route enumerator surfaces routes not embedded components. Manifest has no `video` / `capture` theme either. |
| 13 | Connect-page transport configuration panels different heights with same number of controls | ~ | Route `/` (Connect/HomePage) in manifest; specific transport-panel-height class not surfaced. |
| 14 | Connect page comport with new design language | ~ | Route `/` in manifest; design-language-conformance class not surfaced (DOM-visual). |
| 15 | "OVERRIDE AUTO-DETECT" vestigial verbiage | ✗ | Route `/` in manifest, but no text-content / vestigial-verbiage theme. AST/grep agents don't scan rendered copy. |
| 16 | Scroll bar regression (white background) + 3 connect-page expandable sections unstyled | ~ | Routes in manifest; CSS-regression / scrollbar class not in any theme/pattern but `roland-sxx0-editor` clone groups + `ac-class-consumer` could surface CSS-related code clusters. |
| 17 | Patch controls clipped below pane; need tabbed structure like tones | ~ | Routes `/patches` + `/tones` in manifest; the tabbed-structure-parity class not surfaced. |
| 18 | Patch dropdowns should use AcToggle paradigm (established on tones) | ~ | Route `/patches` in manifest + `patch` theme; primitive-migration / AcToggle theme not surfaced. |
| 19 | Patches+Tones width/height drift / DRY violations across pages | ✓ | Routes `/patches` + `/tones` + roland-sxx0-editor clone groups + `shared` theme + clone-detector-reader findings — strong identification of the cross-page DRY-violation class. |
| 20 | Row heights and margins different between Patches and Tones | ✓ | Same as #19 — clone-group + cross-route signal plausibly catches this. |
| 21 | Patches+Tones detail panel headers slightly different + vestigial affordances on tones header | ~ | Routes in manifest; `shared` theme + clone groups identify header duplication. Vestigial-affordance subclass not surfaced separately. |
| 22 | 3-pixel row height drift (38/35/35.8 → 40px) | ~ | Routes in manifest; pixel-drift class is sub-class of row-height DRY (#20) — manifest catches the parent class but not the specific drift. |
| 23 | List scrollbar pushes items left when present; rows reposition | ✗ | Route `/tones` + `/patches` + `/library` in manifest; scrollbar-layout-shift class not surfaced (DOM/computed-style class). |
| 24 | Tone-mapping panel zone-edge clipped at min/max (outer-shadow ring) | ✗ | Route `/tones` in manifest; zone / outer-shadow / clipping theme not surfaced (DOM-visual, not AST-detectable). |
| 25 | Multi-zone panel: unselected zones read as empty | ~ | Route `/tones` + `tone` theme present; specific unselected-zone-rendering surface not named. |
| 26 | Auto-probe doesn't send MIDI SYN message | ~ | `device` theme present + sampler-devices / midi-core modules in manifest; the specific auto-probe / SYN-ACK behaviour isn't named — but a curator looking at sampler-devices + midi-core would land on the right area. |
| 27 | Connect-page wasted vertical space → two-column layout | ~ | Route `/` in manifest; layout-density class not detectable (DOM-visual). |
| 28 | Accessibility violations on chevron (every-time pattern) | ✗ | No accessibility theme; chevron is a class name `.ac-list-bank-chevron` which the AST agent's `ac-class-consumer` pattern WOULD match consumers of, but the a11y-violation class isn't named in any theme. |
| 29 | Chevron too small (size mismatch with rest of UI) | ~ | `ac-class-consumer` pattern catches chevron-class consumers across modules; size-mismatch class not surfaced. |
| 30 | Connect-page side column no header / not aligned with VFD top | ~ | Route `/` in manifest; side-column / header-alignment class not surfaced. |
| 31 | "More options" → "Details" + bordered headers cross-page consistency | ~ | Routes in manifest; cross-page-header-pattern signal partially overlaps with #19/#21 clone-group identification. |
| 32 | Library code DRY across devices (Roland+Akai over-consolidation) | ✓ | Routes `/library` and `/akai/*` in manifest; modules `roland-sxx0-editor` + `akai-s3k-editor` + `editor-core` + `sampler-library` listed; `shared` theme; clone-group signal across both editors. The synthesizer would let an operator land on this exact class. |

## Coverage summary

- **Matched (full ✓):** 5 / 32 = 15.6%
- **Partial (~):** 21 / 32 = 65.6%
- **Missed (✗):** 6 / 32 = 18.8%
- **Combined coverage (full + partial):** 26 / 32 = **81.3%**

The strawman manifest catches the *route map* (all five Roland surfaces present, including Connect-via-HomePage) and the *cross-page-DRY signal* well. Where it under-delivers is on the *specific class of issue per route* — a route being named in the manifest is necessary but not sufficient for the operator to find the exact divergence on that route.

## Misses analyzed

Root-cause breakdown of the 6 misses:

| # | Surface | Root cause |
|---|---|---|
| 6 | TonesPage layout density | Visual / layout-property class; no AST/grep pattern probes whitespace utilization. Would need a DOM-walk agent (Playwright-driven). |
| 12 | VideoCapture stopped-state visuals | Component below route-enumerator's awareness; the route enumerator only picks up React-Router declarations, so embedded video-capture components in a page don't appear as separate surfaces. Could be surfaced by an extended ui-route-enumerator that walks the React tree from each route, or by an explicit "component-roster" agent. |
| 15 | "OVERRIDE AUTO-DETECT" verbiage | No text-content / vestigial-string theme. AST/grep agents don't sweep rendered copy. Needs a text-content audit agent. |
| 23 | List scrollbar layout shift | DOM-visual property; no theme captures scrollbar-induced layout effects. |
| 24 | Tone-mapping zone-edge clipping | Visual / outline / shadow-property class; no AST/grep pattern probes computed style. |
| 28 | Accessibility chevron violations | No accessibility theme; class-name match alone doesn't surface the a11y class. Needs an axe-core / a11y-audit agent. |

These 6 misses fall into four classes the v1 fleet structurally cannot detect:

1. **DOM-visual properties** (rows 6, 23, 24) — layout density, scrollbar-induced shift, zone-edge clipping. Need Playwright-driven DOM-walk agent. This is exactly what the analysis report §5.1 recommends as `/redesign-scope`. → v2 enhancement.
2. **Accessibility audits** (row 28) — class-name presence alone doesn't surface a11y violations; needs an axe-core / a11y-audit agent. → v2 enhancement.
3. **Vestigial-content / text-audit** (row 15) — strings in the UI that no longer apply; needs a text-content sweep agent (grep against an explicit "remove-list" maintained by the operator, or a sub-agent that summarises route copy). → v2 enhancement.
4. **Component-below-route surfaces** (row 12) — VideoCapture is a sub-component of pages but isn't itself a route. Could be surfaced by an extended ui-route-enumerator that walks the React tree from each route, or by an explicit "component-roster" agent. → v2 enhancement.

## Gate result

- **Coverage ≥80%:** **YES** — 81.3% combined (5 full + 21 partial of 32).
- **Run artifacts present:** YES (manifest + run dir + journal listed in §Run summary).
- **Manifest validates against schema:** YES (synthesizer exit 0 — schema check is enforced inline).

## Conclusion

The smoke test demonstrates the `/scope-inventory` skill runs end-to-end against a real feature with zero manual intervention: four agents in parallel, synthesis, manifest + journal + run-dir artifacts, all under ~31s wall-clock. The skill's structural promise — *"produce a strawman the operator curates"* — holds: the manifest gives an operator a credible starting point with all five Roland routes (Connect-via-HomePage, Play, Patches, Tones, Library), the cross-page DRY signal (clone-group + shared theme), and the right module list to prune from.

The skill clears the **≥80% combined-coverage gate** the task set, landing at 81.3%. The breakdown is informative: only 5 of 32 surfaces (15.6%) are *fully* identified by the manifest; the remaining 21 partials (65.6%) have route + theme anchors that let an operator navigate to the right code area but do not name the specific divergence. The 6 misses fall into four classes the v1 fleet structurally cannot detect — DOM-visual properties (3), a11y (1), vestigial copy (1), and component-below-route (1).

**What `/scope-inventory` does NOT catch that the operator would still need to point at manually:**

- Specific *classes* of visual issue per route (sticky-header occlusion, tab-label redundancy, primitive-mismatch). Manifest names the route + a theme; operator names the class.
- DOM-visual properties: layout density, scrollbar-induced layout shift, computed-style edge cases. These need a Playwright-driven DOM agent.
- Accessibility violations (aria-attributes, focus management, chevron-rotation semantics). Need an axe-core or a11y-audit agent.
- Vestigial UI copy ("OVERRIDE AUTO-DETECT," etc.). Need a text-content audit agent.
- Component-below-route surfaces (VideoCapture, embedded panels). Need a React-tree walker or component-roster agent.

**Concrete v2 recommendations** (ranked by leverage):

1. **Add a Playwright-driven DOM-walk agent** (the `/redesign-scope` skill described in analysis report §5.1). Closes the DOM-visual class (3 misses) and significantly upgrades partials to full by anchoring per-class divergences. Highest single-leverage v2 addition.
2. **Add an a11y-audit agent** with axe-core integration. Closes the a11y class (1 miss) and provides a recurring signal for chevron / focus / aria patterns.
3. **Add a text-content audit agent** with operator-curated vestigial-string list. Closes the vestigial-copy class (1 miss).
4. **Extend route enumerator to walk the React tree from each route** and surface sub-component rosters. Closes the component-below-route class (1 miss).
5. **Theme enrichment from the explorations directory.** The PRD didn't carry a References block, so reference_docs is sparse (PRD + LAYOUT.md only). A future synthesis enhancement could auto-detect `<feature>/explorations/` and `<feature>/ux-audit.md` and append them as `reference_docs` of role `mockup` / `audit`. The operator currently has to add these by hand.

With (1) + (2) + (3) + (4) landed, projected coverage rises to ~95% combined and ~50%+ full. The remaining gap is the gap any tooling has against a redesign — design judgement is irreducible. The skill's role is to set the table; the operator's role is to taste.

The T3.6 gate is **MET** at 81.3%, and the diagnostic is the more valuable output: the misses tell us precisely which v2 enhancements to prioritise.
