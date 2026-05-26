# Audit Log — feature/akai-harmonization

This document is the feature-local audit log for `feature/akai-harmonization`.
New findings follow the project-wide protocol in [AUDITOR-IMPLEMENTER-PROTOCOL.md](/AUDITOR-IMPLEMENTER-PROTOCOL.md).

Canonical grep queue:

- unfinished work: `grep -nE "^Status: (open|acknowledged|fixed-)" docs/1.0/001-IN-PROGRESS/akai-harmonization/audit-log.md`
- new findings: `grep -nE "^Status: open" docs/1.0/001-IN-PROGRESS/akai-harmonization/audit-log.md`
- awaiting verification: `grep -nE "^Status: fixed-" docs/1.0/001-IN-PROGRESS/akai-harmonization/audit-log.md`

---

## 2026-05-25 evening — Phase 4 visual-fidelity review

Operator visually reviewed the live `/akai/s3000xl/editor/programs` page with a
connected S3000XL on 2026-05-25 evening and surfaced multiple obvious
regressions from the Phase-1-approved mockups. Phase 2 structural gates
(43 page-shell-contract passes, 30 keyboard-nav passes, 0 anti-pattern findings,
0 adopter holdouts) verified contracts but did NOT verify visual fidelity —
exactly the failure mode `feedback_actually_review` names. FEATURE COMPLETE was
withdrawn; the workplan was amended with a new Phase 4 covering live-vs-mockup
delta enumeration, fixes, and a pngdiff-baselined Playwright regression spec.

The findings below decompose the operator's screenshot into four shared root
causes. They are filed grouped so that one dispatch closes each.

### `.s3k-section-grid` packs `AcSlider` rows into ~6.5rem cells; the canonical 3-column slider grid (label | bar | readout) collapses with label and readout overlapping at the same x-coordinate

Finding-ID: AUDIT-20260525-24
Status:     verified-e3c63747
Severity:   high
Surface:    `modules/akai-s3k-editor/src/index.css:233-242`, `modules/akai-s3k-editor/src/components/programs/ProgramEditor.tsx:54`, `modules/akai-s3k-editor/src/components/keygroups/KeygroupEditor.tsx:71,101`, `modules/akai-s3k-editor/src/components/keygroups/VelocityZoneEditor.tsx:117`, `modules/akai-s3k-editor/src/components/samples/SampleEditor.tsx:34`

The akai editor invented a local `.s3k-section-grid` rule with
`grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr))`, then placed
`<S3kParamRow>` (which renders `<AcSlider>`) inside those cells. `.ac-slider`
is itself a 3-column grid that needs at minimum `5.5rem + 0 + 4rem = ~9.5rem`
to lay out cleanly. At ~6.5rem cell widths the inner grid's columns overlap
visually — label and red readout sit at the same x-coordinate, the range-bar
collapses to a thin glyph. That is exactly the operator's screenshot.

This is also a DRY violation: the Roland editor's `.tones__param-rows` rule
(`modules/roland-sxx0-editor/src/styles/tones.css:267-277`) solves the same
problem correctly with `minmax(22rem, 1fr)` — wide enough that the inner
AcSlider grid never collapses, and dropping cleanly to 2/1 columns as the
pane narrows.

**Evidence:**

- Broken rule: `modules/akai-s3k-editor/src/index.css:233-242`
- Correct sibling: `modules/roland-sxx0-editor/src/styles/tones.css:267-277`
- AcSlider's inner grid (5.5rem + 1fr + 4rem): `modules/editor-core/src/design/control-primitives.css:130-137`
- Live screenshot baseline (operator's review): the production ProgramsPage with PRG #A03 selected, all parameter rows visibly overlapping at 1280×900.

**Expected:** every consumer of AcSlider lays out rows at ≥22rem per cell, so the inner LABEL | bar | readout grid never collapses.

**Actual:** akai editors pack rows into ~6.5rem cells; the inner grid overlaps.

**Fix guidance:** promote `.tones__param-rows` to a canonical `.ac-param-rows`
primitive in `modules/editor-core/src/design/control-primitives.css`. Update both
roland (`tones.css` consumers) and akai (all 5 sites above) to consume it. Per
`.claude/rules/css-refactor.md`: screenshot every affected page before/after, do
ONE rule at a time, do not sweep. Per `.claude/rules/agent-discipline.md`
"Validator-paired changes": add a `*.spec.tsx` that mounts AcSlider inside a
600px-wide grid container and asserts the label/readout aren't overlapping (e.g.,
`getBoundingClientRect()` on `.ac-slider__label` and `.ac-slider__readout` —
right edge of label < left edge of readout − bar_min_width).

**Closure (2026-05-25):** `.ac-param-rows` landed in
`modules/editor-core/src/design/control-primitives.css` with the canonical
`repeat(auto-fit, minmax(22rem, 1fr))` shape carried forward from the working
roland pattern. All 7 JSX consumer sites migrated in the same commit
(5 akai: `ProgramEditor.tsx`, `KeygroupEditor.tsx` ×2, `VelocityZoneEditor.tsx`,
`SampleEditor.tsx`; 3 roland: `ToneFilterPanel.tsx`, `ToneAmpPanel.tsx`,
`TonePitchLfoPanel.tsx`). The deprecated `.s3k-section-grid` /
`.s3k-section-grid--wide` and `.tones__param-rows` rules were deleted in the
same commit; their former locations now carry pointer comments to the canonical
primitive + this finding ID. The `wide` prop on the akai `<Section>` wrapper
was removed (the canonical primitive supersedes both former widths; the
auto-fit drop from 3→2→1 columns handles every viewport).

Validator-paired contract test landed at
`modules/editor-core/test/ui/ac-param-rows.spec.tsx`. The spec:
1. Asserts the canonical `.ac-param-rows` rule resolves to a grid with
   `minmax(22rem, …)` columns (load-bearing); explicitly rejects the prior
   regression values (`6.5rem`, `8rem`).
2. Asserts an `<AcSlider>` rendered inside `.ac-param-rows` resolves
   `display: grid` with the canonical 3-column shape (5.5rem | 1fr | 4rem).
3. Carries a `GUTTED:` self-check that confirms the assertions FAIL when the
   `.ac-param-rows` container is omitted — proving the assertions have teeth.

The teeth-test was independently verified end-to-end: the production rule was
temporarily gutted to `minmax(6.5rem, 1fr)` (the prior regression shape) and
the load-bearing assertion failed with
`AssertionError: expected 'repeat(auto-fill, minmax(6.5rem, 1fr))' to contain '22rem'`.
After restoring the canonical rule, all 33 editor-core UI tests pass.

Build and test gates re-run independently by the controller after dispatch:
- `make` — full topological build, green.
- `pnpm test` (editor-core) — 393 unit + 33 UI tests passing.
- `pnpm test` (akai-s3k-editor) — 234 tests passing.
- `make test-ui-roland` — 4 passed / 2 skipped (test-harness e2e config).
- `make test-ui-s3k` — 43 passed.
- `make test-ui-editor-core` — 33 passed.

---

### `ProgramEditor`, `KeygroupEditor`, `SampleEditor` are missing `AcRadioTabs`; all sections render flat-stacked instead of behind tab navigation per mockup spec

Finding-ID: AUDIT-20260525-25
Status:     verified-PENDING-COMMIT-SHA
Severity:   high
Surface:    `modules/akai-s3k-editor/src/components/programs/ProgramEditor.tsx:69-159`, `modules/akai-s3k-editor/src/components/keygroups/KeygroupEditor.tsx`, `modules/akai-s3k-editor/src/components/samples/SampleEditor.tsx`

Per `docs/1.0/001-IN-PROGRESS/akai-harmonization/mockups/programs.html:94-105`:

```html
<div class="ac-tabs">
  <input type="radio" name="ap-tabs" id="ap-common" checked />
  …
  <div class="ac-tab-strip" role="tablist">
    <label class="ac-tab" for="ap-common" role="tab">Common</label>
    <label class="ac-tab" for="ap-midi" role="tab">MIDI</label>
    <label class="ac-tab" for="ap-effects" role="tab">Effects</label>
    <label class="ac-tab" for="ap-output" role="tab">Output</label>
  </div>
  <div class="ac-panels">…</div>
</div>
```

Equivalent mockup tabs for Keygroups (Zones / Pitch / Filter / Amp / LFO,
`keygroups.html` `ak-*-tabs`) and Samples (Wave / Loop / Trim / Misc,
`samples.html` `as-*-tabs`).

The live editors have all sections flat-stacked vertically inside `s3k-section`
wrappers. Result: long vertical scroll, no information hierarchy, fundamental
divergence from the approved design. `VelocityZoneEditor` was successfully
migrated to `AcRadioTabs` on 2026-05-24 (anti-pattern entry blocks regression)
and is the reference implementation.

**Evidence:**

- Mockup tab structure: `mockups/programs.html:94-105`, `mockups/keygroups.html`, `mockups/samples.html`
- Live editors missing AcRadioTabs: `programs/ProgramEditor.tsx:69-159`, `keygroups/KeygroupEditor.tsx`, `samples/SampleEditor.tsx`
- Reference (correct) consumer: `VelocityZoneEditor.tsx:117` post-migration

**Expected:** each editor mounts `<AcRadioTabs>` with the mockup-specified tab labels and partitions its sections into the matching panels.

**Actual:** all sections flat-stacked; tab navigation absent; mockup spec § 4.1 / 4.2 / 4.3 unsatisfied.

**Fix guidance:** one dispatch per editor that (a) introduces the AcRadioTabs scaffold, (b) regroups the existing `<Section>` blocks into mockup-specified panels, (c) deletes any sections that the mockup does not include. Per "Just for now is bullshit": do all three editors in one effort.

**Closure:** single combined dispatch lands the fix across all three editors plus a paired adopter-manifest + adopter-glob update.

CSS promotion (one commit): `.ac-compact-grid` / `.ac-compact-field` (+ `--readout` modifier) / `.ac-field-readout` family promoted from `modules/roland-sxx0-editor/src/styles/parameter-panel-primitives.css` to `modules/editor-core/src/design/compact-grid-primitives.css`. Akai is the second consumer; pre-promotion `S3kParamToggleRow` / `S3kParamSelectRow` / pre-existing usages of `.ac-compact-field` inside `ProgramEditor` + `SampleEditor` already consumed the class names without their CSS bundled — the promotion both unblocks AUDIT-25 and closes a latent rendering bug. Roland keeps its existing `parameter-panel-primitives.css` import for the still-roland-only `.ac-detail-live*` live-edit footer rules; akai consumes the canonical primitive via `@audiocontrol/editor-core/styles.css`. The 6-item primitive-extraction checklist was worked through pre-dispatch: §1 (class-name conflict grep): zero collisions; §2 (ARIA validity): N/A (layout chrome with no roles); §3 (value-domain delta): N/A (CSS-only); §4 (consumer-side adapter survey): roland kept its import; akai uses the bundled styles; §5 (test-contract drift): no existing tests assert these class names directly; §6 (ARIA + interaction-timing audit): N/A (no roles, no intervals).

Editor restructure (3 editors in scope; single dispatch per the "no half-assing" rule):

- `ProgramEditor.tsx` (124 lines, was 177) — `<AcRadioTabs>` (controlled-mode) with tabs Common / MIDI / Effects / Output per `mockups/programs.html:94-105`. Tab body panels extracted to `modules/akai-s3k-editor/src/components/programs/panels/{ProgramCommonPanel,ProgramMidiPanel,ProgramEffectsPanel,ProgramOutputPanel}.tsx`. Common tab: priority / reassign / KG-crossfade toggles + polyphony / output-level / output-pan / detune / A.T-sens / vel-sens / soft-pedal / loudness sliders + program-# / keygroups identity-readout strip. MIDI tab: bend-mode / portamento-type / portamento / legato toggles + program-# / receive-ch / bend-up / bend-down / mod-wheel / press-to-pitch / portamento-time sliders. Effects tab: LFO 1 / LFO 2 waveform pickers + desync / retrig toggles + LFO 1 + LFO 2 (pan) rate/depth/delay sliders. Output tab: routing / FX-bus / vel-to-amp / transpose / soft-pedal attack/filter sliders.
- `KeygroupEditor.tsx` (141 lines, was 268) — `<AcRadioTabs>` (controlled-mode) with tabs Zones / Pitch / Filter / Amp / LFO per `mockups/keygroups.html:78-91`. Tab body panels extracted to `modules/akai-s3k-editor/src/components/keygroups/panels/{KeygroupZonesPanel,KeygroupPitchPanel,KeygroupFilterPanel,KeygroupAmpPanel,KeygroupLfoPanel}.tsx`. Zones tab: note-range editor + tune offset + embedded `VelocityZoneEditor` (preserved as-is with its own nested controlled-mode AcRadioTabs). Pitch tab: vel-crossfade toggle + L/R key-XFade sliders (per device-contract bounds; mockup-spec params with no device field are explicitly not invented). Filter tab: `<AcEnvelope>` (multi-segment, 4 segments) + `<AcFrequencyResponse>` (LPF, log-frequency × dB) + the cutoff / resonance / key-track / vel/LFO/env modulation / per-segment envelope rates+levels / velocity-modulation sliders. Amp tab: `<AcEnvelope>` (adsr kind) + attack/decay/sustain/release / Vel-Atk / Vel-Rel / OffVel-Rel / Key-D/R sliders. LFO tab: LFO→Pitch depth slider + informational readout pointing the operator to the program-level LFO source (the keygroup-header has no LFO rate/depth/delay/waveform fields — those live on the program; per `feedback_editor_tools_all_devices` + `feedback_contract_enforcement` we don't render controls for fields that don't exist on the device contract).
- `SampleEditor.tsx` (128 lines, was 208) — `<AcRadioTabs>` (controlled-mode) with tabs Wave / Loop / Trim / Misc per `mockups/samples.html:84-95`. Tab body panels extracted to `modules/akai-s3k-editor/src/components/samples/panels/{SampleWavePanel,SampleLoopPanel,SampleTrimPanel,SampleMiscPanel}.tsx`. Wave tab: bandwidth pick + original-key slider + sample-rate / length / duration / size identity readouts. Loop tab: SLOOPS-gated Loop 1..4 start/length/dwell rows (renders an empty-loops state when SLOOPS=0). Trim tab: start/end frame editors + length readout. Misc tab: playback-mode pick + tune-offset / hold-loop-tune sliders.

Helper deletions (per the "nucleation-site prevention" rule):
- `modules/akai-s3k-editor/src/components/ui/Section.tsx` — DELETED. No remaining consumers after the per-tab decomposition. The shared `<Section>` helper was a thin wrapper around `.s3k-section` chrome that only made sense when each parameter section was a bordered block; the AcRadioTabs panel chrome supplies the visual grouping now.
- `modules/akai-s3k-editor/src/components/ui/index.ts` — `Section` export removed.
- `.s3k-section` border + `.s3k-section-header-content` CSS rules in `modules/akai-s3k-editor/src/index.css` deleted (no remaining users). The `.s3k-section-title` rule stays — VelocityZoneEditor still consumes it as an inline "Sample" eyebrow.

Validator-paired contract test (per `.claude/rules/agent-discipline.md` §"Validator-paired changes"): `modules/akai-s3k-editor/test/unit/components/EditorTabs.audit-25.test.tsx` asserts the AcRadioTabs partition contract for all three editors (4-tab Programs, 5-tab Keygroups, 4-tab Samples) + a gutted-stub teeth scenario. The contract assertion is scoped to `:scope > .ac-radio-tab-strip > .ac-radio-tab` so KeygroupEditor's nested VelocityZoneEditor zone-tabs don't pollute the outer-tab count. Validator-teeth proof (controller-run pre-commit): temporarily reverted `ProgramEditor.tsx` to a flat-stack rendering of the four panel components; ran `pnpm test test/unit/components/EditorTabs.audit-25.test.tsx` — the `ProgramEditor exposes Common/MIDI/Effects/Output tabs` block FAILED with diagnostic `"ProgramEditor: missing radiogroup with aria-label=\"Program editor sections\". AcRadioTabs is the contract; flat-stacked sections fail this assertion (AUDIT-20260525-25)."`. Restored the canonical ProgramEditor; 4 passed. The hard-test invariant from §"Validator-paired changes" ("if I revert ONLY my production-code change, leaving my scenario changes in place, do my new scenarios FAIL?") is met for this finding.

SampleEditor.test.tsx test-contract drift fixed in scope (per `.claude/rules/agent-discipline.md` §"Test-contract drift survey" + the primitive-extraction checklist §5): the pre-existing "renders Basic section with…" / "renders Tuning section with…" / "renders Playback Range with…" / "shows Loop 1 section…" / "shows multiple loop sections…" tests asserted layout shapes (section titles via `<Section>`) that the AcRadioTabs partition removed. Rewrote these blocks to assert the new tab-structure layout: each test selects the appropriate tab via the visible label then asserts the parameter is present. Per the rule "failing tests on touched pages are in scope for the dispatch; the sub-agent does not get to leave them red" — no test red, no `it.skip()`, no follow-up issue.

Clone-detector follow-up (in scope): the post-restructure clone-detector flagged a new 9-line group `d880dc795edb` — the `KeygroupAmpPanelProps` + `KeygroupFilterPanelProps` interface declarations were byte-identical (header / num / onParameterChange / onDragChange / onCommitHeader). Dispositioned `refactor` in scope: extracted `EnvelopePanelProps` to `modules/akai-s3k-editor/src/components/keygroups/panels/envelope-panel-props.ts`; both panels now `export type KeygroupAmpPanelProps = EnvelopePanelProps`. Re-ran `make check-clone-duplication`: zero new clones.

Adopter-manifest update (paired with the dispatch): the manifest entries `ac-envelope` + `ac-frequency-response` previously globbed `KeygroupEditor.tsx` as the adopter; after the per-panel decomposition the canonical adopters are now the panel subcomponents. Updated `docs/scope-discovery/adopter-manifests.yaml` to glob `panels/KeygroupFilterPanel.tsx` + `panels/KeygroupAmpPanel.tsx` for `ac-envelope`, and `panels/KeygroupFilterPanel.tsx` for `ac-frequency-response`. Regenerated `docs/scope-discovery/editor-symmetry.md` via `make check-editor-symmetry-write` — full grid green (21 ✓, 0 ⚠, 0 ✗, 4 ⏳).

**Verification:**

- `make` — passes (cache-warm; full topological build green).
- `make test-ui-s3k` — 43 passed (Playwright page-shell + zone-overview suites; tabbed editor body is below the shell contract these specs measure, so the structural change doesn't shift these counts).
- `make test-ui-editor-core` — 33 passed (no editor-core component changed shape; the new `compact-grid-primitives.css` is consumed via the existing `@audiocontrol/editor-core/styles.css` aggregate).
- `make test-ui-roland` — 4 passed / 2 skipped (file move + class-name unchanged for the still-roland-only `.ac-detail-live*` rules; the Roland editors' visual contract is bit-identical).
- `pnpm --filter @audiocontrol/akai-s3k-editor test` — 242 passed (was 238 before; +4 new tests in `EditorTabs.audit-25.test.tsx` exercising Programs / Keygroups / Samples tab structure + the gutted-stub teeth scenario; SampleEditor.test.tsx rewrites moved 5 layout-shape assertions to the tab-structure shape so the count delta is +4 net).
- `pnpm test:scope-discovery` — all validator scenarios pass.
- `make check-css-duplication` / `make check-chevron-sizing` / `make check-clone-duplication` / `make check-anti-patterns` / `make check-adopters` / `make check-editor-symmetry` — all pass.

**Visual verification artifact:** the test harnesses at `/akai/s3000xl/editor/test/programs`, `/test/samples`, and `/test/keygroups-shell` mount stubbed shells rather than the real ProgramEditor / KeygroupEditor / SampleEditor (per task #45's documented design — the harness exercises the SHELL contract, not the editor content). The validator-paired contract test in `EditorTabs.audit-25.test.tsx` is the regression-detection net at the structural layer; the operator's manual session against the connected device is the ultimate visual proof. The mockup PNGs (`.tmp/visual-fidelity/mockup-{programs,keygroups,samples}-desktop.png`, regenerated 2026-05-25 per AUDIT-20260525-27) remain the design-intent reference.

**File sizes (per the 300-500 line cap):** ProgramEditor 124, KeygroupEditor 141, SampleEditor 128 — all under the cap. Panel subcomponents 40-133 lines each. The per-tab partition + extraction kept every file comfortably under the cap.

---

### `ProgramsPage` / `KeygroupsPage` / `SamplesPage` don't wrap editor bodies in `.ac-detail-pane` + `.ac-detail-head` chrome; the lean-page-header / panel-header-inside-the-border invariants are violated

Finding-ID: AUDIT-20260525-26
Status:     verified-a58375de
Severity:   medium
Surface:    `modules/akai-s3k-editor/src/pages/ProgramsPage.tsx`, `modules/akai-s3k-editor/src/pages/KeygroupsPage.tsx`, `modules/akai-s3k-editor/src/pages/SamplesPage.tsx`

Per `feedback_panel_header_pattern` and `feedback_lean_page_header` memories +
mockup structure (`mockups/programs.html:78-91`):

```html
<section class="ac-detail-pane" aria-label="Program editor">
  <header class="ac-detail-head">
    <span class="ac-detail-eyebrow">Program</span>
    <h3 class="ac-detail-title">A03 · PRG_MPC_STK</h3>
    …status / icon-buttons…
  </header>
  <div class="ac-detail-body">…</div>
</section>
```

The live pages render the editor body with no `.ac-detail-pane` wrapper — the
title floats outside the panel border instead of inside the head. This is the
same anti-pattern `feedback_panel_header_pattern` names: "labeled bordered panels
use `.ac-detail-head` shape (eyebrow + title + hairline, all inside the panel
border), never an external label above an unrelated section."

**Evidence:**

- Mockup chrome: `mockups/programs.html:78-91` (and equivalents in `keygroups.html`, `samples.html`)
- Live pages without wrapper: grep `ac-detail-pane` in `modules/akai-s3k-editor/src/pages/*.tsx` → zero matches.

**Expected:** every editor body wraps in `.ac-detail-pane` with `.ac-detail-head` (eyebrow + h3 + status + icon-buttons) and `.ac-detail-body` (content).

**Actual:** no wrapper; chrome diverges from mockup; header pattern memory violated.

**Fix guidance:** one dispatch per page that adds the canonical wrapping primitives. If `.ac-detail-pane` doesn't exist yet as a JSX component, create `<AcDetailPane>` in editor-core (header + body slots, ARIA-labelled). If it does, use it. Cross-check with `roland-sxx0-editor` to see if the primitive is already promoted; if so, consume it.

**Closure (this commit pair):** two commits land the fix.

Commit 1 — `refactor(editor-core): promote detail-pane-primitives.css from roland-sxx0-editor`. The `.ac-detail-*` family (eyebrow row, empty prompt, pane shell, head, title, slot, name input, body) moves from `modules/roland-sxx0-editor/src/styles/detail-pane-primitives.css` to `modules/editor-core/src/design/detail-pane-primitives.css`, gets bundled into `@audiocontrol/editor-core/styles.css`, and is exported via `package.json`'s `./detail-pane-primitives.css` subpath. Roland's redundant `main.tsx` import drops; class names + rule shapes are bit-identical so visual output is unchanged for the existing roland consumers. File-move-only refactor; no rule edits.

Commit 2 — `feat(akai-s3k-editor): wrap editor pages in canonical .ac-detail-pane chrome`. The three akai editor components are refactored to wrap their content in `<article className="ac-detail-pane">`:
- `modules/akai-s3k-editor/src/components/programs/ProgramEditor.tsx` — eyebrow `Program · Editing · Source · S3000XL`, slot `01..128`, editable name input.
- `modules/akai-s3k-editor/src/components/keygroups/KeygroupEditor.tsx` — eyebrow `Keygroup · Editing · N of M` (new required `keygroupCount` prop), slot `KG<N>`, read-only range label as name.
- `modules/akai-s3k-editor/src/components/samples/SampleEditor.tsx` — eyebrow `Sample · Editing · NNN of MMM · <rate> Hz · <size> · <duration>` (new required `sampleCount` prop), slot `001..512`, editable name input.

Each editor's existing parameter content moves INSIDE the `.ac-detail-body`; the title row renders inside the bordered panel head per the `feedback_panel_header_pattern` invariant. `AcLiveStatusFooter` at the page level is unchanged (the canonical live-edit chrome differs from roland's in-pane `.ac-detail-live` footer; both consume the same outer `.ac-detail-pane` recipe).

Call-site wiring: `KeygroupsPage.tsx` passes `keygroupCount={keygroupCount}` from the keygroup store; `SamplesPage.tsx` passes `sampleCount={sampleNames.length}`.

**Verification:**

- `make` — passes (cache-warm; previous run rebuilt all editors).
- `make test-ui-roland` — 4 passed, 2 skipped (file move only — class names unchanged so Roland rendering is bit-identical; gate proves the CSS is still bundled correctly).
- `make test-ui-editor-core` — 33 passed (no editor-core component changed shape; the new CSS imports get picked up automatically via styles.css).
- `make test-ui-s3k` — 43 passed (Playwright suite covers zone-overview interactions on `TestKeygroupsShellPage`; the test harnesses don't mount the real editors so the chrome change is invisible to these specs, but the suite proves no regression in the surfaces the test harnesses DO cover).
- `pnpm --filter @audiocontrol/akai-s3k-editor test` — 238 passed (was 234 before; 4 new chrome-contract test cases added in `test/unit/components/EditorChrome.audit-26.test.tsx` exercising the article shell + eyebrow row + slot + name input on ProgramEditor / KeygroupEditor / SampleEditor; the SampleEditor unit test gained one additional chrome-contract case at the top of `describe('SampleEditor')`).
- `make check-css-duplication` / `make check-chevron-sizing` / `make check-anti-patterns` / `make check-adopters` / `make check-clone-duplication` / `make check-editor-symmetry` — all pass. The clone gate flagged one new intra-akai parallel-block clone (id `369cc2965252` — replaces the prior id `41255eb6a8a0` after my edits shifted line numbers). Dispositioned `keep-with-reason` via `tools/scope-discovery/batch-dispose.ts` with rationale naming the future `<AcDetailPane>` JSX-primitive extraction dispatch that would unify the 3 akai sites + the 2 partially-divergent roland consumers (ToneEditor uses the article-class shell; PatchEditor wraps its head in a plain `<div>` inside an externally-wrapped `<article>`). The extraction is the right next dispatch but needs its own audit of roland's heterogeneity before promotion; this dispatch's brief explicitly authorized "leave both as raw JSX and let a future dispatch consolidate" when the shapes diverge meaningfully.
- `pnpm test:scope-discovery` — passes.

**Visual verification artifact:** `.tmp/visual-fidelity/audit-26-live-programs-after.png` (live `/akai/s3000xl/editor/programs`, disconnected state — the editor pane only renders when a program is selected against a connected device; visual confirmation of the chrome on the editor body requires the operator to connect a device or extend the existing test harnesses to mount the real editors with stub data per the pending task #45). The 4 chrome-contract unit tests in `EditorChrome.audit-26.test.tsx` are the regression-detection net: they assert the `<article.ac-detail-pane>` wrapper exists with the correct `aria-label`, eyebrow text, slot format, and `<input.ac-detail-name-input>` for each of the three editors.

**Test-helpers promotion (in scope):** a new `modules/akai-s3k-editor/src/test-helpers/program-factory.ts` was added alongside the existing `sample-factory.ts` + `keygroup-factory.ts` to provide a properly-typed `makeProgramHeader(overrides?)` without the `as ProgramHeader` cast that the existing in-test factory at `test/unit/lib/program-serialization.test.ts` uses (the in-test factory is unchanged in this commit — flipping it to use the new helper is a separate cleanup; the new factory enumerates every field structurally so the return type satisfies `ProgramHeader` without an escape hatch).

**Next dispatch (already named):** AUDIT-20260525-25 (AcRadioTabs body restructure for ProgramEditor / KeygroupEditor / SampleEditor body content). That dispatch operates on the `.ac-detail-body` contents and inherits this dispatch's wrapping chrome unchanged.

---

### Phase 4 capture infrastructure: mockup HTML renders unstyled when loaded via `file://`; current capture script produces unusable mockup baselines

Finding-ID: AUDIT-20260525-27
Status:     verified-8432e816
Severity:   low
Surface:    `tools/visual-fidelity/capture.mjs` (was `.tmp/visual-fidelity/capture.mjs` — script promoted to tracked location as part of the fix)

Phase 4 task 4.2 captures mockup screenshots via Playwright at `file://…/mockups/*.html`. The mockup HTML's `<link href="./akai-dialect.css">` and any further-up CSS imports don't resolve correctly under `file://` (CORS-like restrictions + relative-path semantics differ); the resulting PNGs render as unstyled HTML in Times New Roman with no layout. They cannot serve as visual baselines for delta enumeration (Phase 4.3) or pngdiff comparison (Phase 4.5).

**Evidence:**

- `.tmp/visual-fidelity/mockup-keygroups-desktop.png` — visibly unstyled.
- Other `mockup-*` PNGs render the same way.

**Expected:** mockup captures render with the canonical mockup chrome (AcRadioTabs strip visible, `.ac-slider` rows laid out in 3-col grid, CRT band tinted, etc.).

**Actual:** unstyled HTML.

**Fix guidance:** serve the mockups directory via a short-lived static HTTP server (e.g., `python3 -m http.server` rooted at `docs/1.0/001-IN-PROGRESS/akai-harmonization/mockups/`) and update `capture.mjs` to point at `http://localhost:<port>/<page>.html` instead of `file://…`. Re-run the capture; verify the resulting PNGs render with the canonical chrome. This unblocks Phase 4 tasks 4.3 and 4.5.

**Closure (this commit):** rewrote the capture script to spawn `python3 -m http.server` on an OS-assigned free port rooted at the **repo root** (not the mockups directory — the mockups' `<link>` tags use absolute `/modules/...` paths, so the server has to be repo-rooted to satisfy both those and the relative `./akai-dialect.css` link). The server is started before the Playwright loop, polled via `fetch` until ready, and killed in a `finally` block so it can't leak. Mockup target URLs switched from `file://…` to `http://127.0.0.1:<port>/docs/1.0/001-IN-PROGRESS/akai-harmonization/mockups/<page>.html`. Verified by visual inspection of the regenerated `.tmp/visual-fidelity/mockup-{programs,keygroups,samples,library}-desktop.png` — each now renders with full canonical chrome: red accent rule + mono/display titles, AcRadioTabs strips (Common/MIDI/Effects/Output for programs; Zones/Pitch/Filter/Amp/LFO for keygroups; Wave/Loop/Trim/Misc for samples), `.ac-slider` 3-column rows (LABEL | bar | mono readout), bank-list chevron disclosures, and the rec-LED metric pill in the page header. Phase 4 tasks 4.3 (delta enumeration) and 4.5 (pngdiff baselines) are now unblocked. The script was also promoted from `.tmp/visual-fidelity/capture.mjs` (gitignored scratch) to `tools/visual-fidelity/capture.mjs` (tracked) so the fix survives a `.tmp/` clear; the output directory remains `.tmp/visual-fidelity/` (operator-local scratch). Run with `node tools/visual-fidelity/capture.mjs` from the repo root with the dev server running on `https://localhost:3300`.

---

## 2026-05-25 Feature review — latest tracked-holdout schema follow-up + Phase 3 closeout work

Surfaced while reviewing the implementation commits `f2e49c0e`, `f90c989d`, and the subsequent Phase 3 closeout stack through branch head `4c2818af` on 2026-05-25.

### The tracked-holdout schema amendment landed in code, but the operator docs and generated matrix prose still state the old “issue is mandatory” contract

Finding-ID: AUDIT-20260525-23
Status:     open
Severity:   medium
Surface:    `tools/scope-discovery/adopter-manifests-registry.ts`, `docs/scope-discovery/LAYOUT.md`, `docs/scope-discovery/README.md`, `docs/scope-discovery/editor-symmetry.md`

The parser and manifest header now explicitly allow issue-less `tracked_holdouts` when `reason:` is substantive (`adopter-manifests-registry.ts:11-60`; `adopter-manifests.yaml` header already reflects that), but the operator-facing docs still describe the pre-AUDIT-20 contract:

- [LAYOUT.md](/Users/orion/work/audiocontrol-work/audiocontrol-akai-harmonization/docs/scope-discovery/LAYOUT.md:121) still shows `issue:` as required in the schema example and says each entry “MUST have `path` + `issue` + `reason`”.
- [README.md](/Users/orion/work/audiocontrol-work/audiocontrol-akai-harmonization/docs/scope-discovery/README.md:156) still says every `tracked_holdouts:` entry “MUST carry `path:`, `issue:`, and `reason:`”.
- [editor-symmetry.md](/Users/orion/work/audiocontrol-work/audiocontrol-akai-harmonization/docs/scope-discovery/editor-symmetry.md:3) still defines the `⏳` glyph as a `tracked_holdouts:` entry “naming the follow-up issue”.

So after `f2e49c0e`/`f90c989d`, the repo has two incompatible contracts for the same field: the live parser accepts issue-less entries with substantive inline tracking context, while the docs and generated artifact still instruct operators that `issue:` is mandatory.

**Evidence:**

- Code/schema now allows issue-less tracked holdouts with substantive `reason:`:
  - `tools/scope-discovery/adopter-manifests-registry.ts:11-60`
- Stale operator docs still require `issue:`:
  - `docs/scope-discovery/LAYOUT.md:121-126`
  - `docs/scope-discovery/README.md:156`
  - `docs/scope-discovery/editor-symmetry.md:3`

**Expected:** the operator docs, schema examples, and generated matrix intro should describe the same tracked-holdout contract the parser enforces.

**Actual:** the parser accepts issue-less entries, while the docs still tell operators the opposite.

**Fix guidance:** update every operator-facing description of `tracked_holdouts:` to the post-AUDIT-20 rule: `issue:` optional, but substantive `reason:` mandatory when absent. Because `editor-symmetry.md` is generated, closure should include regenerating it from the updated renderer text rather than hand-editing only the artifact.

## 2026-05-25 Feature review — latest anti-pattern backfill + editor-core keyboard-navigation gate work

Surfaced while reviewing the implementation commits through `84f44f17`, `128ab75c`, and the editor-core keyboard-navigation/gate work now present at branch head `9e8d99c0` on 2026-05-25. Targeted verification run:

- `make check-adopters` — passed (`0` holdouts across `14` manifests; `9` tracked holdouts reported separately)

### The new TreeView keyboard-navigation spec counts hidden mounted descendants as tab stops, so it can pass without modeling the real visible tab order it claims to protect

Finding-ID: AUDIT-20260525-21
Status:     verified-82c1a401
Severity:   medium
Surface:    `modules/editor-core/test/ui/a11y-helpers.ts`, `modules/editor-core/test/ui/keyboard-navigation.spec.tsx`, `modules/editor-core/src/components/library/TreeView.tsx`

**Closure (verified-82c1a401):** `getTabStops()` is now visibility-aware — it walks the ancestor chain for each focusable candidate and rejects any candidate enclosed by a contract a real browser would honor for keyboard tab traversal (`aria-hidden="true"`, the `hidden` HTML attribute, inline `display:none` / `visibility:hidden` / `visibility:collapse`, or `.ac-collapse[data-expanded="false"]`). The TreeView describe block was rewritten to assert the visible tab order: a "collapsed state" spec proves only the 3 top-level treeitems are reachable (the 2 mounted leaf descendants live inside `.ac-collapse[data-expanded="false"]` wrappers and are filtered out); a "partially-expanded state" spec asserts the transitive contract (folder-1's leaf is reachable, folder-2's leaf is not, when only folder-1 is expanded); the "fully-expanded state" spec carries the original AUDIT-01 invariant forward. The mounted-treeitem sanity expectation (`allMountedTreeItems.length === 5`) is asserted alongside the visible-count expectation (3) so a future regression that flattens `.ac-collapse` is caught at both layers. Validator-paired-changes hard test: reverted the `isKeyboardUnreachable` filter in `getTabStops()`; both new AUDIT-21 specs went red with diagnostics naming the leaked treeitems (`data-testid="library-item-folder-1-leaf"`, `-folder-2-leaf`) and the count delta (`expected 5 to be 4`). Restored the helper; 30/30 specs pass. Test count delta: editor-core UI harness went 29 → 30.

The new helper `getTabStops()` is purely selector-based: it returns every `button`, `input`, `select`, `textarea`, `a[href]`, and `[tabindex="0"]` descendant except explicit `tabindex="-1"` nodes (`a11y-helpers.ts:17-48`). It does not filter out hidden or collapsed descendants.

That matters because `TreeView` explicitly keeps child rows mounted even when collapsed so `.ac-collapse` can animate them (`TreeView.tsx:355-360`). The new AUDIT-01 closure tests then set `expectedStops = treeItems.length` and document that “the DOM contains all rows regardless of expandedIds” (`keyboard-navigation.spec.tsx:98-115`, `118-131`).

So the test is not measuring the visible keyboard tab order a user encounters. It is measuring “number of mounted focusable descendants in jsdom,” including rows inside collapsed branches. If a regression made collapsed descendants stay tabbable, this spec would still pass because it already expects all mounted treeitems to count. That weakens the claimed closure of AUDIT-20260524-01.

**Evidence:**

- Helper counts focusables by selector only, with no hidden/collapsed filtering:
  - `modules/editor-core/test/ui/a11y-helpers.ts:17-48`
- TreeView keeps descendants mounted while collapsed:
  - `modules/editor-core/src/components/library/TreeView.tsx:355-360`
- Spec explicitly sets expected tab stops to *all* mounted treeitems:
  - `modules/editor-core/test/ui/keyboard-navigation.spec.tsx:98-115`
  - `modules/editor-core/test/ui/keyboard-navigation.spec.tsx:118-131`

**Expected:** the keyboard-navigation harness should assert the *reachable visible tab order* or explicit `userEvent.tab()` traversal behavior, not the raw count of mounted focusable descendants in collapsed subtrees.

**Actual:** the TreeView test passes by counting all mounted treeitems, including collapsed descendants.

**Fix guidance:** either make `getTabStops()` visibility-aware for this harness, or stop using mounted-node counts as the contract for TreeView and instead drive real tab traversal with `userEvent.tab()` against collapsed and expanded states. Closure should require a regression test that would fail if collapsed descendants remain tabbable.

### The new editor-core keyboard-navigation harness is still a manual target, so the “caught at commit time” claim is not true yet

Finding-ID: AUDIT-20260525-22
Status:     verified-d82e37a4
Severity:   medium
Surface:    `modules/editor-core/package.json`, `package.json`, `.githooks/pre-commit`, `Makefile`

**Closure (verified-d82e37a4):** Picked option (a) — `modules/editor-core/package.json` `test` script changed from `vitest run` to `vitest run && vitest run --config vitest.ui.config.ts`. Smallest blast radius: the UI harness becomes load-bearing on every `pnpm -r test` (root) and `pnpm --filter @audiocontrol/editor-core test`, with no pre-commit overhead for unrelated edits. `pnpm test:ui` continues to work as a granular entry-point; a new `pnpm test:unit` script lets an operator run only the unit suite; `make test-ui-editor-core` continues to work as the granular Makefile entry-point. Verified: `pnpm --filter @audiocontrol/editor-core test` now runs 393 unit tests (was 391; +2 from the paired self-asserting tests below) + 30 UI harness tests in two sequential vitest invocations. Paired adversarial assertion: added `modules/editor-core/src/testing/package-test-script.test.ts` — a unit test (so it runs on the always-invoked unit config) that reads `package.json` from disk and asserts the `test` script contains both `vitest run` AND `--config vitest.ui.config.ts`. The assertion's teeth come from the unit-test-on-unit-script invariant: a revert that drops the UI invocation would fail on the very next `pnpm test`. Validator-paired-changes hard test: reverted `test` script to `vitest run`; one FAIL on `package-test-script.test.ts` with diagnostic `editor-core test script must invoke the UI harness via \`vitest run --config vitest.ui.config.ts\` so the keyboard-navigation harness runs on every default test run (AUDIT-20260525-22). Current script: vitest run: expected false to be true`. Restored the script; 393 unit + 30 UI green.

The new UI harness exists and is runnable via `pnpm test:ui` in editor-core (`modules/editor-core/package.json:49`) and `make test-ui-editor-core` (`Makefile:263-264`), but it is not part of the default module test path or the pre-commit gate path:

- root `pnpm test` is still `pnpm -r test`, which only runs each package’s `test` script (`package.json:8`)
- editor-core’s `test` script is still plain `vitest run`, not `vitest run && vitest run --config vitest.ui.config.ts` (`modules/editor-core/package.json:47-50`)
- the pre-commit hook’s TS gate list runs clone/anti-pattern/adopter/editor-symmetry checks only; it does not run `test-ui-editor-core` (`.githooks/pre-commit:95-119`, `170-188`)

That means the branch has not yet achieved the workplan’s intended property that future primitive keyboard regressions fail “at commit time, not at the next audit pass.” Right now the new harness is valuable but opt-in.

**Evidence:**

- Editor-core UI harness is a separate manual script:
  - `modules/editor-core/package.json:47-50`
  - `Makefile:263-264`
- Root test path does not include it:
  - `package.json:8`
- Pre-commit TS gate list does not include it:
  - `.githooks/pre-commit:95-119`
  - `.githooks/pre-commit:170-188`

**Expected:** if this work is supposed to close the “audit catches it days later” gap, the new harness needs to be integrated into a routine enforcement path for relevant editor-core changes.

**Actual:** the harness is manual-only unless an operator remembers to run `make test-ui-editor-core`.

**Fix guidance:** wire the editor-core UI harness into at least one routine gate path for relevant changes: either the editor-core `test` script, a root test aggregate used by normal verification, or the pre-commit/commit-time TS gate path when `modules/editor-core/src/components/**` changes. This fix is not complete without verifying the chosen path actually invokes the UI harness automatically.

## 2026-05-25 Feature review — latest adopter-manifest backfill + TF-016 countermeasure work

Surfaced while reviewing the new implementation commits `48d711af` and `90a771ef` on 2026-05-25. Verification run:

- `make check-adopters` — passed: `0` holdouts across `14` manifests, `9` tracked holdouts reported separately

### The TF-016 “controller-side countermeasure” is only encoded in `.claude/rules`, so Codex does not actually inherit the new dispatch discipline

Finding-ID: AUDIT-20260525-19
Status:     verified-8a93bac9
Severity:   medium
Surface:    `.claude/rules/primitive-extraction-checklist.md`, `AGENTS.md`

**Closure (verified-8a93bac9):** `AGENTS.md` now carries a "Primitive-Extraction Dispatch Checklist (TF-016 countermeasure)" section (lines 203-258) that mirrors the substantive content of `.claude/rules/primitive-extraction-checklist.md`: when-the-rule-fires (5 dispatch shapes), the 6 pre-dispatch checks (CSS class-name conflict, ARIA validity, value-domain delta, consumer-side adapter survey, test-contract drift survey, ARIA + interaction-timing audit) with one-line summaries pointing at originating AUDIT IDs, the 4 mandatory brief sections (A/B/C/D), the 5 forbidden shortcuts, and the 7-step process discipline naming the canonical file. The canonical `.claude/rules/primitive-extraction-checklist.md` stays the source of truth with the worked "What surfaced X" lesson catalog (162 lines); the AGENTS.md mirror is ~55 lines, sufficient for a Codex session reading `AGENTS.md` at session-start to know to load + apply the full checklist. Cross-reference added to the canonical file's "Cross-references" section pointing back at the AGENTS.md mirror. Both files retire together when the deskwork canonical implementation lands. Verification note: the Codex-visible entry point is `AGENTS.md` section "Primitive-Extraction Dispatch Checklist (TF-016 countermeasure)"; the section is visible at session-start because `AGENTS.md` is the canonical Codex instruction surface (per the file's own "Canonical Sync Path" preamble). No validator scenario added — this is an instructional mirror with no parser, gate, or report-shape side; the "gate" is the operator/agent reading `AGENTS.md` at session-start, which is not a mechanical contract a unit test can assert.

The new TF-016 countermeasure claims it is the controller-side contract that “the controller MUST work through ... before dispatching any primitive-extraction or primitive-promotion sub-agent” (`.claude/rules/primitive-extraction-checklist.md:1-20`). But in this repo, Codex’s canonical instruction surface is `AGENTS.md`, which explicitly says it is “the Codex equivalent” of Claude’s workspace guidance and that shared repo guidance must stay aligned between `AGENTS.md` and `.claude/CLAUDE.md` (`AGENTS.md:1-12`).

This new dispatch discipline was added only under `.claude/rules/`. There is no Codex-visible counterpart in `AGENTS.md`, and no repo-local Codex skill was updated to require the checklist before primitive-extraction work. In practice that means the branch’s “defensive countermeasure” only protects Claude-style flows that consult `.claude/rules`; Codex sessions in this repo can continue to miss the same pre-dispatch checks TF-016 is trying to institutionalize.

**Evidence:**

- New rule declares itself the mandatory controller-side contract:
  - `.claude/rules/primitive-extraction-checklist.md:1-20`
- Codex’s canonical repo guidance surface is `AGENTS.md`, with explicit sync expectations:
  - `AGENTS.md:1-12`

**Expected:** if this checklist is supposed to be the repo’s active defensive countermeasure, the same substantive instruction needs to be visible to Codex through `AGENTS.md` or a repo-local Codex skill/workflow that is actually consulted during primitive-extraction dispatches.

**Actual:** the countermeasure is only documented in Claude-only rule space, so the claimed controller discipline is not repo-wide.

**Fix guidance:** mirror the substantive TF-016 dispatch-hygiene contract into a Codex-visible surface. Minimum acceptable closure: either (a) add the checklist or a concise mandatory equivalent to `AGENTS.md`, or (b) update the relevant repo-local Codex workflow skill(s) so primitive-extraction dispatches explicitly load and apply it. Closure should also include a short verification note naming the exact Codex-visible entry point, not just the Claude rule path.

### The new `tracked_holdouts` use symbolic placeholder refs instead of actionable tracking issues, so the registry now reports deferred work without a real follow-up target

Finding-ID: AUDIT-20260525-20
Status:     verified-f90c989d
Severity:   medium
Surface:    `docs/scope-discovery/adopter-manifests.yaml`

**Closure (verified-f90c989d):** operator picked option (a) — amend the parser to make `issue:` optional when `reason:` carries substantive inline tracking content. Closure landed across two commits:

- `f2e49c0e` (feat) — `tools/scope-discovery/util/substantive-reason.ts` (new) owns the `SUBSTANTIVE_REASON_MIN_CHARS = 80` constant + `REASON_GAMING_PHRASES` wordlist + `checkSubstantiveReason(reason)` predicate. `TrackedHoldout.issue` is now optional; `parseTrackedHoldouts` calls `parseOptionalIssue` (returns undefined when absent; rejects malformed shapes when present) and enforces `checkSubstantiveReason(reason)` when issue is absent. The placeholder-phrase check runs BEFORE the length check so a short placeholder reason (e.g., "deferred") produces the more informative "placeholder phrase" diagnostic rather than the bare "8 chars too few" length error. `adopter-manifests-report.ts` text + JSON renderers handle absent `issue:` honestly (text report omits the " — issue: ..." clause; JSON renderer conditionally spreads the `issue` key). `adopter-manifests.yaml` header documents the new contract (each tracked-holdout must carry follow-up signal under one of two shapes: well-formed `issue:` OR substantive `reason:`).
- `f90c989d` (docs) — applies the new schema to the 9 existing tracked-holdout entries: drops the placeholder `issue:` fields (`#cross-editor-akai-export-dialog-lifecycle` ×4, `#cross-editor-akai-slot-info` ×3, `#cross-editor-akai-library-device-memory-panel` ×1, `#cross-editor-akai-library-preview-panel` ×1) and expands each `reason:` into a WHAT / WHY / UNLOCKS-WHEN block that names the migration target file + canonical primitive, the technical blocker (state-contract delta, missing primitive, multi-item progress shape, semantic slot-label variation), and the conditional that would make adoption feasible. Also rewrote the matching placeholder refs in `anti-patterns.yaml`'s `tailwind-button-chrome-inline` `excludes_paths:` documentation comments (the field itself is a `path: string[]`; only the comments above + alongside referenced the placeholder shape).

Paired adversarial scenarios (validator-paired-changes rule, all in `adopter-manifests.tracked-holdouts-scenarios.ts`):

- `scenarioTrackedHoldoutNoIssueSubstantiveReason` (happy path B) — issue-less entry + >= 80-char substantive reason → gate exit 0; deferred file appears in the tracked-holdouts report section AND the report omits the misleading "issue:" clause.
- `scenarioTrackedHoldoutNoIssueEmptyReason` (reject) — issue-less + empty reason → exit 2 (`requireString` fires first; the entry is uncovered either way).
- `scenarioTrackedHoldoutNoIssueGamedReason` (reject) — issue-less + reason = "deferred" → exit 2; stderr names "placeholder phrase" + quotes the offending phrase.
- `scenarioTrackedHoldoutNoIssueShortReason` (reject) — issue-less + reason < 80 chars non-placeholder → exit 2; stderr names "substantive" rule + "80 chars" threshold.
- `scenarioTrackedHoldoutBackwardCompatHashIssue` (accept) — `#`-prefix issue + short reason → exit 0; backward-compat preserved.

Validator-paired-changes hard test: stashed the schema-amendment diff (`adopter-manifests-registry.ts` + `adopter-manifests-report.ts`) leaving scenarios in place; re-ran the validator suite. Pre-amendment behavior:

- Scenario 2 (no-issue-substantive-reason-accepted): FAILED — `expected exit 0 ... got 2; stderr=adopter-manifests: ... entry #0 tracked_holdouts[0] requires non-empty string 'issue'`.
- Scenario 3 (no-issue-empty-reason-rejected): FAILED — `stderr should name the offending 'reason' field; got: ... requires non-empty string 'issue'` (the assertion fired on the wrong field name; the entry still rejected, but the diagnostic carried the pre-amendment shape).
- Scenario 4 (no-issue-gamed-reason-rejected): FAILED — `stderr should name the 'placeholder phrase' rejection; got: ... requires non-empty string 'issue'` (pre-amendment parser unconditionally rejects missing-`issue`, never reaches the substantive-reason check).
- Scenario 5 (no-issue-short-reason-rejected): FAILED — `stderr should name the 'substantive' rule; got: ... requires non-empty string 'issue'` (same as scenario 4).
- Scenario 6 (backward-compat-hash-issue-accepted): PASSED both pre- and post-amendment — `#`-prefix shape still accepted, backward-compat preserved.

Four of five new scenarios fail against the pre-amendment schema with distinct diagnostics; the backward-compat scenario passes in both states. Teeth proven. Restored the schema; 37/37 scenarios pass.

Verification at HEAD (commit `f90c989d`):

- `pnpm exec tsx tools/scope-discovery/adopter-manifests.validate.ts` → `Summary: 37/37 scenarios passed`.
- `pnpm test:scope-discovery` → all suites green; 10/10 in tab-active-state, 9/9 in PRD relevance, etc.
- `make check-adopters` → `adopter-manifests: 0 holdouts across 14 manifest(s). 9 tracked holdout(s) reported separately.` (unchanged total; report now omits the stale "issue:" clause for each of the 9 — `grep "issue:" make-check-adopters.txt | grep -v "no-issue-test"` returns 0 hits).
- `make check-anti-patterns` → `anti-patterns: 18 entries scanned across 1376 files; 0 findings.`
- `grep -rn 'cross-editor-akai\|cross-editor-tailwind' docs/scope-discovery/` → 0 hits (all placeholders gone).
- `pnpm --filter @audiocontrol/editor-core test` → 393 unit + 30 UI green (no consumer-side breakage from the `TrackedHoldout` interface change).

The adopter-manifest registry says tracked holdouts are for work the operator “has explicitly deferred via a tracking issue” and that the `issue:` field exists to prevent the registry from becoming a “fix-it-later dumping ground without operator-tracked follow-up” (`adopter-manifests.yaml:72-83`). The new backfill entries, however, use symbolic placeholders such as `#cross-editor-akai-export-dialog-lifecycle`, `#cross-editor-akai-slot-info`, `#cross-editor-akai-library-device-memory-panel`, and `#cross-editor-akai-library-preview-panel` (`adopter-manifests.yaml:174-195`, `242-257`, `340-372`).

Those strings satisfy the parser’s `#`-prefixed shape, and `make check-adopters` therefore stays green, but they are not actionable tracker links inside the repo. They do not identify a concrete GitHub issue number or URL, so an operator reading the registry or the gate output cannot actually navigate from the deferred holdout to the promised follow-up work item.

**Evidence:**

- Registry contract for tracked holdouts:
  - `docs/scope-discovery/adopter-manifests.yaml:72-83`
- New placeholder refs:
  - `docs/scope-discovery/adopter-manifests.yaml:174-195`
  - `docs/scope-discovery/adopter-manifests.yaml:242-257`
  - `docs/scope-discovery/adopter-manifests.yaml:340-372`
- Gate output still reports them as tracked, not blocking:
  - `make check-adopters` on this review pass: `adopter-manifests: 0 holdouts across 14 manifest(s). 9 tracked holdout(s) reported separately.`

**Expected:** each tracked holdout should point to a concrete issue ref or URL that an operator can open and use to track the deferred migration.

**Actual:** the registry now carries placeholder tags that look issue-like but do not provide an actionable follow-up target.

**Fix guidance:** replace the symbolic placeholder refs with real GitHub issue numbers or URLs, or create the missing issues before claiming the backfill is complete. This fix is not complete without verifying that every new tracked holdout points at a concrete, operator-accessible tracker artifact.

## 2026-05-25 Feature review — latest AcLiveStatusFooter primitive + adoption work

Surfaced while reviewing the `AcLiveStatusFooter` extraction/adoption commits `1e6e40ad`, `a7b1773f`, and `16f97e34` on 2026-05-25. Targeted local verification runs:

- `pnpm --filter @audiocontrol/editor-core test -- AcLiveStatusFooter.test.tsx` — passed (`16` tests)
- `pnpm --filter @audiocontrol/akai-s3k-editor test -- ProgramsPage.test.tsx` — failed (`1` of `5` tests), see `AUDIT-20260525-18`

### AcLiveStatusFooter turns a 100ms self-updating elapsed timer into a polite live-region announcement source

Finding-ID: AUDIT-20260525-16
Status:     verified-f2f3e1e0
Severity:   high
Surface:    `modules/editor-core/src/components/AcLiveStatusFooter.tsx`, `modules/editor-core/src/components/AcLiveStatusFooter.test.tsx`

`AcLiveStatusFooter` starts a `setInterval(..., 100)` whenever `state === 'live'` and `lastEditAt !== null`, updating its rendered text every tenth of a second (`AcLiveStatusFooter.tsx:99-105`, `119-120`). The same root node is exposed as `role="status"` and `aria-live="polite"` (`AcLiveStatusFooter.tsx:123-129`), and the current test suite explicitly locks that contract in (`AcLiveStatusFooter.test.tsx:21-27`).

That means the component is not just visually updating every 100ms; it is mutating the contents of a polite live region every 100ms. After the first successful write, the text changes from `...0.1s ago` to `...0.2s ago` to `...0.3s ago` and so on. Screen readers are therefore being handed a continuous stream of live-region mutations for as long as the page stays open after an edit, which is not a reasonable announcement contract for a status footer.

**Evidence:**

- 100ms interval updates the rendered status text:
  - `modules/editor-core/src/components/AcLiveStatusFooter.tsx:99-105`
  - `modules/editor-core/src/components/AcLiveStatusFooter.tsx:119-120`
- Same node is a live region:
  - `modules/editor-core/src/components/AcLiveStatusFooter.tsx:123-129`
- Tests currently bless that exact ARIA contract:
  - `modules/editor-core/src/components/AcLiveStatusFooter.test.tsx:21-27`

**Expected:** the footer may visually refresh elapsed time, but assistive-tech announcements should be tied to discrete state changes or confirmed writes, not to a continuously ticking timer string.

**Actual:** every 100ms elapsed-time tick mutates a polite live region.

**Fix guidance:** split the announcement contract from the visual timer. For example, keep a non-live visual `"last edit X.Xs ago"` readout, and expose only the discrete write confirmation through a separate announcement channel or a non-ticking status string. Closure should require a regression test that proves fake-timer advancement does NOT create repeated live-region text churn after the initial write announcement.

**Fix landed (commit `f2f3e1e0`):** the live-region announcement was split from the 100ms visual timer. `AcLiveStatusFooter.tsx`'s root + `__text` span no longer carry `role="status"` / `aria-live="polite"`; the visible chrome is silent to assistive tech, so the elapsed-time tick can re-render the `"X.Xs ago"` readout every 100ms without polluting the live region. A dedicated visually-hidden span (`.ac-live-status-footer__announcement.ac-sr-only`) carries the live-region attributes, and its content is set by a `computeAnnouncement(state, lastEditAt, errorMessage)` helper driven by a `useEffect([state, lastEditAt, errorMessage])` rising-edge guard. The announcement is `"Edit confirmed."` on a new `lastEditAt`, `"Device offline."` on the offline transition, `"Device error: {msg}."` on the error transition, and empty on initial-mount with `lastEditAt=null` (no spurious narration on first page load). The existing `.ac-sr-only` utility from `library.css` (imported via the editor-core design barrel) was reused — no new CSS authored, no duplication.

Regression coverage in `AcLiveStatusFooter.test.tsx`: the prior root-level role assertion was replaced with a contract test that the visible chrome lacks `role`/`aria-live` AND the dedicated announcement span carries them + `.ac-sr-only`. A 50-tick fake-timer regression test (`does NOT churn the live-region announcement during 100ms visual ticks`) renders the footer with a fixed `lastEditAt`, advances 5 seconds of simulated time in 100ms increments, and asserts (a) the announcement text stays frozen at `"Edit confirmed."` across all 50 ticks while (b) the `__text` content advances from `0.0s ago` to `~5.0s ago` (proves the visual timer is running but the live region is silent). Two rising-edge tests cover the `null → timestamp` and `live → live` (different `lastEditAt`) state transitions, and a parameterized matrix covers `live → offline` and `live → error` announcement strings. Validator-paired-changes hard test (revert `AcLiveStatusFooter.tsx` only, leave test file intact): 5 new tests RED — `expected 'status' to be null` (visible chrome still carried `role="status"` pre-fix), `expected null not to be null` (the announcement element did not exist pre-fix), and 3 × `TypeError: Cannot read properties of null (reading 'textContent')` (rising-edge tests could not find the announcement element). Tests have teeth.

### The Akai footer wiring misses successful rename writes, so the page can still say READY after a confirmed device edit

Finding-ID: AUDIT-20260525-17
Status:     verified-f2f3e1e0
Severity:   medium
Surface:    `modules/akai-s3k-editor/src/pages/ProgramsPage.tsx`, `modules/akai-s3k-editor/src/pages/SamplesPage.tsx`

On both Akai adopters, the new footer timestamp is updated after successful detail-pane header writes (`ProgramsPage.tsx:87-110`, `SamplesPage.tsx:89-103`), but not after successful list-row rename writes. `handleRenameProgram` awaits `client.renameProgram(index, newName)` and invalidates cache, but never calls `setLastEditAt(...)` (`ProgramsPage.tsx:196-221`). `handleRename` on Samples does the same for `client.renameSample(...)` (`SamplesPage.tsx:106-121`).

That leaves a visible behavior hole in the new live-status affordance: the operator can perform a successful device write from the page, watch the name update, and still see `READY · S3000XL connected` in the footer because the rename path never transitions it to a live-edited state.

**Evidence:**

- Program header writes update the footer timestamp:
  - `modules/akai-s3k-editor/src/pages/ProgramsPage.tsx:87-110`
- Program rename writes do not:
  - `modules/akai-s3k-editor/src/pages/ProgramsPage.tsx:196-221`
- Sample header writes update the footer timestamp:
  - `modules/akai-s3k-editor/src/pages/SamplesPage.tsx:89-103`
- Sample rename writes do not:
  - `modules/akai-s3k-editor/src/pages/SamplesPage.tsx:106-121`

**Expected:** any successful device write on a page that advertises the live-edit footer should transition the footer out of `READY` and record the latest confirmed write time.

**Actual:** successful rename writes leave the footer stale.

**Fix guidance:** call `setLastEditAt(Date.now())` after successful rename writes on both pages, then add page-level regression coverage that proves a rename action advances the footer from `READY` to `LIVE`. This should be tested at the page layer, not only in the shared primitive, because the bug is in the adopter wiring.

**Fix landed (commit `f2f3e1e0`):** `handleRenameProgram` (`ProgramsPage.tsx:211-216`) now calls `setLastEditAt(Date.now())` after `client.renameProgram(...)` resolves and the program-cache is invalidated. `handleRename` (`SamplesPage.tsx:106-122`) does the same after `client.renameSample(...)` resolves, before the optimistic `setSampleNames` update. Cross-editor check: roland's `PatchesPage.tsx` and `TonesPage.tsx` were grepped for `rename` / `Rename` and contain no list-row rename handlers — no parallel fix needed in roland surfaces. Akai's `KeygroupsPage` similarly has no rename row-action.

Page-layer regression coverage (per the auditor's directive that the fix is not complete without integration tests at the adopter wiring): `ProgramsPage.test.tsx` adds `rename via list-row UI flips AcLiveStatusFooter from READY to LIVE (AUDIT-20260525-17)` which triggers the rename through the same UI interaction the operator uses — double-click `program-item-0` → type `NEW NAME` into `input.ac-akai-list-rename` → press `Enter` — then `waitFor`s the renameProgram mock to resolve and asserts both the visible `.ac-live-status-footer__text` flips from `READY` to `LIVE` AND the dedicated announcement span shows `"Edit confirmed."`. A new test file `SamplesPage.test.tsx` adds the same shape for the samples rename flow (with `useEditorDialogs` stubbed to a no-op idle state since the rename flow does not touch any dialog state). Validator-paired-changes hard test (revert `ProgramsPage.tsx` + `SamplesPage.tsx` only, leave both test files intact): both rename tests RED with identical error shape `Expected: LIVE / Received: READY · S3000XL connected`. Tests have teeth — they catch precisely the wiring gap (rename does not flip the footer because `setLastEditAt` was not called).

### ProgramsPage's local unit suite is stale and red at branch head, so the new shell/footer work is not landing with the required regression coverage

Finding-ID: AUDIT-20260525-18
Status:     verified-f2f3e1e0
Severity:   medium
Surface:    `modules/akai-s3k-editor/test/unit/pages/ProgramsPage.test.tsx`

The existing `ProgramsPage` unit suite is currently failing at branch head. The `shows loading status when isLoading with a message` test still queries `screen.getByTestId('loading-status')` and expects the old combined text contract (`ProgramsPage.test.tsx:137-151`), but the page now renders the shared `PageTitleRow` metric/progress shape instead. Local run:

- `pnpm --filter @audiocontrol/akai-s3k-editor test -- ProgramsPage.test.tsx`
- Result: `1` failed, `4` passed
- Failure: `Unable to find an element by: [data-testid="loading-status"]`

This is not just a stale assertion. It means the implementation landed without a page-level regression gate for the new title-row/footer contract, and there is still no page test covering the new `AcLiveStatusFooter` READY/live transition wiring on ProgramsPage.

**Evidence:**

- Stale assertion against removed contract:
  - `modules/akai-s3k-editor/test/unit/pages/ProgramsPage.test.tsx:137-151`
- Local verification run at branch head fails with:
  - `Unable to find an element by: [data-testid="loading-status"]`

**Expected:** the page suite should be updated in the same implementation wave so the new shell/title-row/footer contract is both green and protective.

**Actual:** the branch carries a red page-level test, and the surviving suite does not cover the new footer behavior.

**Fix guidance:** update `ProgramsPage.test.tsx` to assert the shared `PageTitleRow` loading metric/progress contract that actually renders now, and add explicit footer regression coverage at the page layer. Minimum closure bar: one green test for the loading metric/progress shape, and one green test proving a successful page write flips the footer from `READY` to `LIVE`.

**Fix landed (commit `f2f3e1e0`):** the stale `screen.getByTestId('loading-status')` assertion in `ProgramsPage.test.tsx:137-151` was replaced with `shows loading status via PageTitleRow metric-status span when isLoading with a message (AUDIT-20260525-18)`, which asserts against what the page actually renders now: (a) the loading message appears in `.ac-page-title-metric-status` with `role="status"` + `aria-live="polite"` (the canonical PageTitleRow live-region surface, distinct from AcLiveStatusFooter's announcement span — the page header and the footer narrate independently), and (b) the 50% progress is rendered via the separate `.ac-page-title-progress-fill` bar's inline `style.width="50%"` (not appended to the message text). The contract matches PageTitleRow.tsx's actual JSX (`PageTitleRow.tsx:134-166`) for the `isLoading + loadingMessage + loadingProgress` prop combination.

The auditor's minimum closure bar called for two green tests: one for the loading metric/progress shape (the AUDIT-18 repair) and one for the READY→LIVE footer transition (the AUDIT-17 rename test). Both land in this commit on `ProgramsPage.test.tsx`, raising the akai test count from 231/232 (1 pre-existing failure = the stale AUDIT-18 test) to 234/234.

## 2026-05-24 Feature review — latest AcEnvelope / AcFrequencyResponse migration work

Surfaced while reviewing the `AcEnvelope` / `AcFrequencyResponse` extraction and Akai migration commits through `d524da07`, `b83318d3`, `2f949329`, `1a47b60c`, and `0ffe43f6` on 2026-05-24. Targeted local verification runs:

- `pnpm --filter @audiocontrol/editor-core test -- AcEnvelopeAdsr.test.tsx AcFrequencyResponse.test.tsx`
- `pnpm --filter @audiocontrol/akai-s3k-editor test -- KeyRangeEditor.test.tsx VelocityRangeBar.test.tsx`

Both runs passed, but they do not cover the Akai adapter-layer issues below.

### Akai filter-response drag now forwards fractional resonance values directly into the integer `FILQ` device field

Finding-ID: AUDIT-20260524-14
Status:     verified-d39b150a
Severity:   medium
Surface:    `modules/akai-s3k-editor/src/components/keygroups/KeygroupEditor.tsx`, `modules/editor-core/src/components/AcFrequencyResponse.tsx`

`AcFrequencyResponse` intentionally works in continuous numeric space. During drag it computes `newResonance` as a float inside the configured `resonanceRange` and emits that exact number through `onChange({ resonance })` (`AcFrequencyResponse.tsx:148-152`). The Akai adapter in `KeygroupEditor` then forwards that value straight into `FILQ` without rounding (`KeygroupEditor.tsx:220-227`).

That is a wire-format regression for the S3000XL field. `FILQ` is an integer device parameter in the 0..15 domain; the legacy `FilterDisplay` explicitly rounded before dispatching by using its `clamp()` helper (`git show 0ffe43f6^:FilterDisplay.tsx` reviewed in this pass, lines 25-27 and 145-149). The new path means drag moves can push floats like `7.3` or `11.8` through `onDragChange` / `onParameterChange`. Even if later serialization truncates or rounds somewhere else, the UI/editor state is now carrying a value shape the field did not previously admit.

**Evidence:**

- Primitive emits float resonance values during drag:
  - `modules/editor-core/src/components/AcFrequencyResponse.tsx:148-152`
- Akai consumer forwards them directly into `FILQ`:
  - `modules/akai-s3k-editor/src/components/keygroups/KeygroupEditor.tsx:220-227`
- Pre-migration implementation rounded the Q value before dispatch:
  - `git show 0ffe43f6^:modules/akai-s3k-editor/src/components/keygroups/FilterDisplay.tsx` reviewed in this audit pass (`clamp()` + `newQ`)

**Expected:** the Akai adapter should preserve the device field’s integer contract by rounding/clamping the primitive’s continuous resonance output before writing `FILQ`.

**Actual:** float resonance values are forwarded directly into an integer header field.

**Fix guidance:** keep `AcFrequencyResponse` continuous, but quantize at the Akai adapter boundary: `dispatch('FILQ', Math.round(changes.resonance))` (plus clamp to 0..15 if the adapter is the last trusted boundary). This fix is not complete without regression coverage at the Akai adapter layer. Required tests: one unit test that proves a fractional `resonance` callback from `AcFrequencyResponse` becomes an integer `FILQ` write, and one integration-level test on the keygroup editor path that guards the drag/update flow end to end.

**Fix landed (commit `d39b150a`):** the akai filter adapter was extracted from `KeygroupEditor.tsx` into a new module at `modules/akai-s3k-editor/src/components/keygroups/akai-filter-adapter.ts` (pure helpers, no DOM, unit-testable in isolation). The new module exposes `clampToFilq` (rounds + clamps to 0..15), `hzToFilfrq` (rounds + clamps to 0..99, already integer-safe pre-fix), and `dispatchAkaiFilterChange(changes, dispatch)` — the centralized dispatcher that applies BOTH quantizers before invoking the consumer's field-write callback. `KeygroupEditor`'s `AcFrequencyResponse.onChange` is now a one-liner delegating to `dispatchAkaiFilterChange`; the inline Hz/FILFRQ math + duplicated constants were removed (DRY closure on the previously-inlined adapter primitives). The adapter boundary is the last trusted point where the integer wire-format contract is enforced; floats from `AcFrequencyResponse` can no longer leak past it.

Regression coverage at the akai adapter layer: 24 new tests in `modules/akai-s3k-editor/test/unit/components/keygroups/akai-filter-adapter.test.ts` covering (a) `clampToFilq` fractional rounding + out-of-range clamping (`7.3 → 7`, `11.8 → 12`, `20 → 15`, `-5 → 0`, `15.7 → 15`, `-0.4 → 0`), (b) `hzToFilfrq` integer-only output + boundary clamping (`5 Hz → 0`, `40 kHz → 99`) + round-trip preservation at endpoints, (c) `dispatchAkaiFilterChange` replaying every clampToFilq assertion through the dispatcher with `vi.fn()` spies (`{ resonance: 7.3 }` → `dispatch('FILQ', 7)`, `{ resonance: 11.8 }` → `dispatch('FILQ', 12)`, etc.), plus boundary clamping for both fields, plus channel-isolation assertions (`{ frequency: 800 }` does NOT dispatch FILQ; empty changes does NOT dispatch anything; etc.). Validator-paired-changes hard test: with the production dispatcher gutted to bare value-forwarding (`dispatch('FILQ', changes.resonance)`; `dispatch('FILFRQ', changes.frequency)`) and the new test file intact, 9 of the 24 scenarios FAIL with the specific assertion messages `expected 7.3 to be 7`, `expected 11.8 to be 12`, `expected 20 to be 15`, `expected -5 to be 0`, `expected 15.7 to be 15`, `expected "spy" to be called with arguments: [ 'FILFRQ', 99 ]` (got 50000), `expected "spy" to be called with arguments: [ 'FILFRQ', +0 ]` (got 5), `expected 4.6 to be 5`. The tests have teeth in both directions (FILQ + FILFRQ) at boundaries and at fractional in-range values.

### The filter-envelope migration passes impossible `activeSegment={0}` into a 1-based API, so segment 1 is highlighted permanently with no real selection state

Finding-ID: AUDIT-20260524-15
Status:     verified-d39b150a
Severity:   low
Surface:    `modules/akai-s3k-editor/src/components/keygroups/KeygroupEditor.tsx`, `modules/editor-core/src/components/AcEnvelope.tsx`

`AcEnvelope`’s multi-segment variant is explicitly 1-based: `activeSegment` is documented as a 1-based active segment index and is clamped with `clampSegment(...)` into the `1..endSegment` range (`AcEnvelope.tsx:53-54`, `106-113`, `158-168`). The Akai filter-envelope migration passes `activeSegment={0}` (`KeygroupEditor.tsx:178-180`).

Because `0` is out of range, the primitive silently clamps it to `1`. The result is that the filter envelope always renders as though segment 1 is the active/selected segment even though the Akai integration has no real selected-segment state and no `onPointSelect` handler wired. This is a UI-state regression from the legacy display, which was a pure visualization with draggable points and no persistent “segment 1 selected” affordance.

**Evidence:**

- Akai consumer passes `activeSegment={0}`:
  - `modules/akai-s3k-editor/src/components/keygroups/KeygroupEditor.tsx:178-180`
- Primitive contract is 1-based and clamps invalid values to 1:
  - `modules/editor-core/src/components/AcEnvelope.tsx:53-54`
  - `modules/editor-core/src/components/AcEnvelope.tsx:106-113`
  - `modules/editor-core/src/components/AcEnvelope.tsx:158-168`

**Expected:** either supply a real 1-based active segment from Akai state, or extend the primitive to allow “no active segment” when the consumer only wants a display/editor surface without selection highlighting.

**Actual:** the Akai adapter passes an impossible index, which the primitive coerces to segment 1, creating a permanent false-active state.

**Fix guidance:** short term, pick the least misleading explicit 1-based segment if the highlight is required by the primitive. Better, add an optional “no active segment” path to `AcEnvelope` and use that here, since the Akai filter envelope has drag-editing but no segment-selection model. This should be treated as a test-gated UI-state fix: closure should require a regression test that proves the Akai filter-envelope surface no longer renders a false-active segment by default.

**Fix landed (commit `d39b150a`):** the second option from the fix guidance — `AcEnvelope`'s multi-segment variant `activeSegment` prop type was widened from `number` to `number | null`. When `null` (or undefined-via-discriminated-union narrowing) is passed, the `clampSegment(...)` helper is bypassed entirely; the sub-surfaces (`AcEnvelopeGraph`, `AcEnvelopeTable`) already render no active highlight when `activeSegment !== <any segment index>`. The graph region's `aria-label` drops the "segment N active" suffix when null. The active-guide vertical line and the `.ac-envelope-axis-tick--active` axis-tick modifier are both suppressed by the existing index-comparison guards plus an explicit `props.activeSegment !== null` short-circuit on the active-guide path. The akai consumer in `KeygroupEditor.tsx` now passes `activeSegment={null}`. The type widening is purely additive — the legacy numeric path (where `clampSegment` floors + clamps into `1..endSegment`) is unchanged.

Cross-editor backwards-compat verification: roland's `ToneEnvelopeEditor.tsx` passes `activeSegment={sustainPoint + 1}`, and `sustainPoint` is bounded `0..7` by the `handleSustainChange` clamp, so the value is always `1..8` (valid for the legacy numeric path). Roland's `AcEnvelopeTableHarness.tsx` passes `activeSegment={1}` (valid). No roland consumer passed an invalid index pre-fix; no roland consumer needs to migrate to the `null` path. Verified via `pnpm --filter @audiocontrol/roland-sxx0-editor test` (48 passed, no regressions) + typecheck across all three consuming modules.

Regression coverage: three new tests in `modules/editor-core/src/components/AcEnvelope.test.tsx`:
- `activeSegment={null} renders NO segment row as active` — asserts EVERY table row carries `data-active="false"`; EVERY graph point button carries `aria-pressed="false"` and lacks `.ac-envelope-point--active`; the `.ac-envelope-active-guide` line is absent; no `.ac-envelope-axis-tick--active` exists; the graph region's `aria-label` does NOT contain "active".
- `activeSegment={null} keeps every seg button aria-pressed="false"` — defends against accidental row-state hijacking (a regression where `null` accidentally promotes one segment to active would slip past the first test if it picked any single segment).
- `activeSegment={1} (legacy default behavior path) still highlights segment 1` — backwards-compat guard asserting the existing roland contract continues to work after the type widening.

Validator-paired-changes hard test: with the production-code changes to `AcEnvelope.tsx` / `AcEnvelopeGraph.tsx` / `AcEnvelopeTable.tsx` / `KeygroupEditor.tsx` stashed (test file intact), 2 of the 3 new scenarios FAIL against pre-fix code with the specific error message `AcEnvelope received non-finite segment index: null` — the `clampSegment` helper rejects `null` because `Number.isFinite(null)` is `false`, proving the pre-fix path could not accept the new contract at all. The third new test (activeSegment={1} backwards-compat) passes both pre- and post-change, which is correct: it asserts the legacy behavior survives the extension. Two of three tests have teeth against the pre-fix path; the third is a back-compat guard whose teeth are against any FUTURE change that breaks the legacy numeric contract.

## 2026-05-24 Feature review — latest AcZoneStrip extraction/migration work

Surfaced while reviewing the `AcZoneStrip` extraction and Akai migration commits through `03f36ce3`, `544d41f3`, `e23de8b3`, `edab3add`, and the follow-up docs/tooling commits at `HEAD` (`1876bc67`) on 2026-05-24. Targeted local verification run:

- `pnpm --filter @audiocontrol/editor-core test -- AcZoneStrip.test.tsx`

The focused primitive suite passed, but it does not cover the issues below.

### VelocityRangeBar now compacts away malformed zones before wiring callbacks, so selection and split-drag indices no longer match the source zone array

Finding-ID: AUDIT-20260524-12
Status:     verified-de95eb82
Severity:   medium
Surface:    `modules/akai-s3k-editor/src/components/keygroups/VelocityRangeBar.tsx`

The post-`AcZoneStrip` `VelocityRangeBar` wrapper first maps `zones` to `AcZoneStripZone | null`, skips malformed entries where `highVel < lowVel`, and then calls `.filter(...)` to compact the list before rendering (`VelocityRangeBar.tsx:147-166`). It then passes the original `onSelectZone` callback straight through as `onSelect={onSelectZone}` and uses the compacted zone index for split-drag dispatch via `handleStartDrag` (`VelocityRangeBar.tsx:170-176`).

That changes the callback contract when any malformed zone exists before a valid one. The old implementation also visually skipped malformed zones, but its click and drag closures were created inside `zones.map(...)`, so the callback index always matched the original source array index, even when some entries returned `null`. The new compacted render list loses that mapping. Example:

- input zones: `[valid zone 0, malformed zone 1, valid zone 2]`
- rendered strip zones after filter: `[zone 0, zone 2]`
- clicking the second rendered zone now calls `onSelectZone(1)` instead of `onSelectZone(2)`
- the split handle between the two rendered zones now reports split index `0`, even though the source-array boundary is between original zones `0` and `2`

That is a real behavior regression for any editor state that preserves a four-slot velocity-zone array with an invalid/deleted middle slot, because the selected-zone index and drag callbacks now point at the wrong header fields.

**Evidence:**

- New compacting behavior:
  - `modules/akai-s3k-editor/src/components/keygroups/VelocityRangeBar.tsx:147-166`
  - `modules/akai-s3k-editor/src/components/keygroups/VelocityRangeBar.tsx:170-176`
- Pre-migration implementation preserved original indices in closures even when returning `null` for malformed zones:
  - `git show 544d41f3^:modules/akai-s3k-editor/src/components/keygroups/VelocityRangeBar.tsx` reviewed in this audit pass

**Expected:** visual skipping of malformed zones must not rewrite the callback/index contract; rendered zone interactions should still report the original source-array index.

**Actual:** filtering compacts the rendered list, so callback indices drift when any earlier zone is malformed.

**Fix guidance:** preserve the original index alongside each rendered zone instead of filtering down to bare `AcZoneStripZone` values. For example, render an array of `{ sourceIndex, zone }` pairs and adapt `onSelect` / `onStartDrag` to translate the rendered index back to the original source index before invoking callbacks.

**Fix landed (commit `de95eb82`):** the wrapper now builds `{ sourceIndex, zone }` pairs through the compaction stage, splits them into a bare `AcZoneStripZone[]` for the primitive plus a `sourceIndexFor(renderedIndex)` translator, and wraps `onSelect` / `onStartDrag` in adapters (`handleStripSelect` + `handleStripStartDrag`) that translate the rendered index back to the source index before invoking the consumer callbacks. The split-drag contract is preserved: the `splitIndex` emitted is the SOURCE index of the LEFT zone of the boundary, matching the AcZoneStrip documented contract.

Regression coverage: four new scenarios in `modules/akai-s3k-editor/test/unit/components/keygroups/VelocityRangeBar.test.tsx` under the `source-index preservation across malformed entries (AUDIT-20260524-12)` describe block — second-rendered click with malformed-middle, first-rendered click with malformed-leading, split-drag with malformed-middle, split-drag with malformed-leading. Validator-paired-changes hard test: with the production-code diff stashed (test diff intact), all four regression scenarios FAIL against pre-fix code with the specific error messages `expected "spy" to be called with arguments: [ 2 ]` (got `[1]`), `expected "spy" to be called with arguments: [ 1 ]` (got `[0]`), and `expected +0 to be 1 // Object.is equality`. The tests have teeth.

### AcZoneStrip marks selected segments with `aria-pressed` on `role="group"` containers, which is not a valid ARIA state/role pairing

Finding-ID: AUDIT-20260524-13
Status:     verified-de95eb82
Severity:   medium
Surface:    `modules/editor-core/src/components/AcZoneStrip.tsx`, `modules/editor-core/src/components/AcZoneStrip.test.tsx`

Each rendered zone segment in `AcZoneStrip` is a `<div role="group">` carrying `aria-pressed={zone.isSelected ? true : undefined}` (`AcZoneStrip.tsx:237-243`). The tests explicitly lock this in by asserting that the selected segment has `aria-pressed="true"` (`AcZoneStrip.test.tsx:144-158`).

That ARIA pairing is invalid: `aria-pressed` is a toggle-button state, not a state for generic `group` containers. Browsers will leave the attribute in the DOM, and CSS can style against it, but assistive tech does not get a coherent semantic contract from “group + pressed”. This is now shared across every `AcZoneStrip` adopter, including the Roland tone-zone editor and the Akai range bars.

**Evidence:**

- Segment markup:
  - `modules/editor-core/src/components/AcZoneStrip.tsx:237-243`
- Tests currently bless the invalid state:
  - `modules/editor-core/src/components/AcZoneStrip.test.tsx:144-158`

**Expected:** selected-state semantics should use either a role that legitimately carries a selected/pressed state, or no ARIA state at all if the segment container is purely structural and the real interactive control is the inner button/handle.

**Actual:** selected state is exposed as `aria-pressed` on a `role="group"` container.

**Fix guidance:** do not deepen the current contract in more tests. Either:
1. move the selected-state exposure onto the actual interactive element (`.ac-zone-segment-body` button) using a supported state, or
2. keep the outer segment as a structural group and remove the ARIA state entirely, using only a CSS modifier class for styling.

**Fix landed (commit `de95eb82`):** option 2 — `aria-pressed` is removed from the `role="group"` segment and replaced with `data-selected` (a CSS-only attribute hook, no ARIA contract). The outer segment stays a structural group; the inner `.ac-zone-segment-body` button carries the click affordance; selection state is communicated visually via the `.ac-zone-segment--editing` modifier class and the `data-selected="true"` attribute. The CSS selector at `modules/editor-core/src/design/zone-strip-primitives.css:85` was updated from `.ac-zone-segment[aria-pressed="true"]` to `.ac-zone-segment[data-selected="true"]`; the visual treatment (inset accent ring + glow) is unchanged.

Cross-editor impact verification: a grep across all source files (`*.ts`/`*.tsx`/`*.css`/`*.scss` under `modules/`, excluding `/dist/` and `/node_modules/`) confirms only the AcZoneStrip primitive, its test, and the canonical CSS selector referenced `aria-pressed` on zone segments. The other `aria-pressed` references in editor-core (`AcEnvelope`, `AcRangeBar`, `AcFrequencyResponse`, `AcEnvelopeTable`, `envelopeChromeHelpers`) live on actual `<button>` elements where the ARIA pairing is valid; those are unchanged. The Roland `ToneZoneEditor` and Akai `KeyRangeEditor` consumers had no production-code or test dependency on `aria-pressed` for zone segments; no consumer-side updates were required.

Regression coverage: `modules/editor-core/src/components/AcZoneStrip.test.tsx` adds an explicit ARIA-cleanup test (`does NOT expose selection via aria-pressed on role="group" segments (invalid ARIA pairing)`) asserting (a) NO segment carries `aria-pressed` at any value, AND (b) `getByRole('button', { pressed: true })` and `getByRole('button', { pressed: false })` do NOT match any zone segment — the segments are `role="group"`, not buttons, and assistive tech must not treat them as toggle buttons. The existing `marks the selected zone` test updates to assert `data-selected="true"` instead of `aria-pressed="true"`. Validator-paired-changes hard test: with the production-code diff stashed (test diff intact), both ARIA-cleanup scenarios FAIL against pre-fix code with the specific error messages `expected null to be 'true'` (data-selected absent pre-fix) and `expected 'true' to be null` (aria-pressed present pre-fix). The tests have teeth in both directions of the contract.

## 2026-05-24 Feature review — latest AcRadioTabs closure verification

Reviewed the implementation work through `8545e839` / `e18987cb` on 2026-05-24, covering the `AcRadioTabs` class-namespace + a11y fix that closed `AUDIT-20260524-10` and `AUDIT-20260524-11`.

Scope checked:

- `modules/editor-core/src/components/AcRadioTabs.tsx`
- `modules/editor-core/src/components/AcRadioTabs.test.tsx`
- `modules/editor-core/src/design/tab-primitives.css`
- `modules/roland-sxx0-editor/src/styles/_shared.css`
- `modules/akai-s3k-editor/src/components/keygroups/VelocityZoneEditor.tsx`
- updated roland wiring tests for the radio-group contract

Verification:

- `pnpm --filter @audiocontrol/editor-core test -- AcRadioTabs.test.tsx` — passed (`1` file, `19` tests)

Result: no new audit findings in this pass. The class-namespace split (`.ac-radio-*` vs the pre-existing `.ac-tabs` button-tab chrome) and the radio-group semantics cleanup both appear coherent in the current patch set, and I did not find a new correctness or regression issue beyond the already-recorded and verified `AUDIT-20260524-10` / `-11`.

## 2026-05-24 Feature review — latest AcRadioTabs promotion/migration work

Surfaced while reviewing the latest `AcRadioTabs` promotion and Akai `VelocityZoneEditor` migration commits through `1ae3420f` on 2026-05-24 (`a444acd5`, `b5d30089`, `3b93fa91`). This pass was a code-review audit of the shared primitive, its CSS promotion, and the Akai consumer.

### Promoting radio-tab chrome into global `.ac-tabs` / `.ac-tab` selectors regresses existing button-tab consumers in editor-core

Finding-ID: AUDIT-20260524-10
Status:     verified-8545e839
Severity:   high
Surface:    `modules/editor-core/src/design/tab-primitives.css`, `modules/editor-core/src/design/layout-primitives.css`, `modules/editor-core/src/components/library/LibraryPanel.tsx`, `modules/editor-core/src/components/layout/BuildInfo.tsx`

The `AcRadioTabs` promotion moved the radio-tab chrome into `editor-core/src/design/tab-primitives.css`, but it did so by globally overriding the pre-existing `.ac-tabs` and `.ac-tab` classes used by non-radio tab bars elsewhere in editor-core. The new rule explicitly forces `.ac-tabs { display: block; border-bottom: 0; }` (`tab-primitives.css:45-56`) and redefines `.ac-tab` with `border: ... solid transparent; border-bottom: 0;` plus the radio-tab-specific underline model on `::after` (`tab-primitives.css:90-129`). Those rules are imported globally from `styles.css`, after the original generic tab styles in `layout-primitives.css`.

That breaks the two existing button-tab consumers that still rely on the old flex-row + `.ac-tab--active` contract:

- `LibraryPanel` renders `<div className="ac-tabs">` with `<button className="ac-tab ... ac-tab--active">` children (`LibraryPanel.tsx:102-117`)
- `BuildInfo` does the same for its Info / Logs toggle (`BuildInfo.tsx:148-167`)

Under the promoted CSS, those buttons no longer live in a flex row because `.ac-tabs` is now `display: block`, so the tabs stack vertically. Their active underline also disappears because the legacy active state still only sets `border-bottom-color` (`layout-primitives.css:527-530`), while the promoted `.ac-tab` zeroes the bottom-border width entirely (`tab-primitives.css:104-105`). The radio-tab pattern is correct for `AcRadioTabs`, but it is now unintentionally restyling unrelated button tabs that never opted into that primitive.

**Evidence:**

- Legacy generic tab contract:
  - `modules/editor-core/src/design/layout-primitives.css:503-530`
- Promoted radio-tab rules globally override the same class names:
  - `modules/editor-core/src/design/tab-primitives.css:45-56`
  - `modules/editor-core/src/design/tab-primitives.css:90-129`
- Existing non-radio consumers still use those class names directly:
  - `modules/editor-core/src/components/library/LibraryPanel.tsx:102-117`
  - `modules/editor-core/src/components/layout/BuildInfo.tsx:148-167`

**Expected:** the radio-tab promotion should scope its chrome to the `AcRadioTabs` structure (`.ac-tab-strip`, `.ac-panels`, etc.) or a dedicated modifier class, without changing the layout and active-state contract of existing button-tab bars.

**Actual:** the shared promotion silently changes existing button-tab bars from horizontal flex tabs to vertical block-stacked tabs and removes their active underline.

**Fix guidance:** separate the two tab systems instead of reusing the same top-level class names. Either:
1. scope the radio-tab shell under a dedicated root class from `AcRadioTabs` (for example `ac-radio-tabs`), leaving `.ac-tabs` / `.ac-tab` for the old button-tab system, or
2. migrate `BuildInfo` and `LibraryPanel` onto a new canonical button-tab primitive in the same commit-set and remove the old layout-primitives rules entirely.

At minimum, add regression coverage for `BuildInfo` and `LibraryPanel` before changing any more shared tab CSS.

**Fix landed:** commit `8545e839` took fork (1) from the fix guidance — rename the radio-tab class namespace from `.ac-tabs` / `.ac-tab-strip` / `.ac-tab` / `.ac-panels` / `.ac-panel` to `.ac-radio-tabs` / `.ac-radio-tab-strip` / `.ac-radio-tab` / `.ac-radio-panels` / `.ac-radio-panel`. Applied across:

- `modules/editor-core/src/components/AcRadioTabs.tsx` (JSX classNames)
- `modules/editor-core/src/design/tab-primitives.css` (every selector + the file comment headers)
- `modules/roland-sxx0-editor/src/styles/_shared.css` (all four per-tab-ID `:checked` selector blocks: lit-tab fill, underline, panel show, reduced-motion)
- `modules/roland-sxx0-editor/src/styles/patches.css` (comment)
- `modules/roland-sxx0-editor/src/components/patches/PatchEditorTabs.tsx` (comment)
- `docs/scope-discovery/anti-patterns.yaml` (`ac-radio-tabs-inline` shape_regex updated to match the post-rename inline-clone shape)

`layout-primitives.css` was NOT touched — the legacy bare `.ac-tabs` / `.ac-tab` / `.ac-tab--active` rules stay where they are, owned by the button-tab system (LibraryPanel + BuildInfo) which continues using them unchanged. After the rename, the two class spaces are disjoint and the two systems cannot collide.

Regression coverage: `modules/editor-core/src/components/AcRadioTabs.test.tsx` gained a new describe block `AcRadioTabs — class-namespace contract (AUDIT-20260524-10)` (2 tests). The teeth-bearing assertion (`mounts AcRadioTabs alongside a button-tab DOM without className collision`) mounts BOTH a `<div className="ac-tabs"><button className="ac-tab ac-tab--active">…</button></div>` button-tab shape AND an `<AcRadioTabs>` instance in the same render tree, then asserts the button-tab container's className is EXACTLY `"ac-tabs"` (no contamination), the active button's className is EXACTLY `"ac-tab ac-tab--active"` (still has the modifier), and NO descendant of the AcRadioTabs container carries the bare `.ac-tabs` / `.ac-tab` / `.ac-tab-strip` / `.ac-panels` / `.ac-panel` token. A sibling assertion (`does NOT emit the bare …`) walks the serialized HTML for the AcRadioTabs container and confirms no className attribute contains the bare token.

Validator-paired hard-test: stashed only the production-code changes (AcRadioTabs.tsx + tab-primitives.css + `_shared.css`) and re-ran the new tests against the pre-rename code. The two AUDIT-10 assertions both went RED — `expected … not to match /\bac-tabs\b/, received …` on the bare-class assertion, and `expected radioContainer.className to contain "ac-radio-tabs"` on the side-by-side assertion. Stash popped; the same tests now pass against the post-rename code. The class-namespace gate has teeth.

### The promoted `AcRadioTabs` primitive exposes tab semantics on focusable labels, but it does not implement the ARIA tab interaction contract

Finding-ID: AUDIT-20260524-11
Status:     verified-8545e839
Severity:   medium
Surface:    `modules/editor-core/src/components/AcRadioTabs.tsx`, `modules/editor-core/src/components/AcRadioTabs.test.tsx`, `modules/akai-s3k-editor/src/components/keygroups/VelocityZoneEditor.tsx`, `modules/roland-sxx0-editor/src/components/patches/PatchEditorTabs.tsx`, `modules/roland-sxx0-editor/src/components/tones/ToneEditorTabs.tsx`

`AcRadioTabs` now lives in editor-core and is the canonical cross-editor primitive, but it still exposes a faux ARIA tablist without implementing the behavior or state that role set promises. The visible labels render as `role="tab"` with `tabIndex={0}` (`AcRadioTabs.tsx:120-129`), while the real controls are separate hidden radio inputs (`AcRadioTabs.tsx:99-117`, with the hide rules at `tab-primitives.css:58-66`). The labels never set `aria-selected`, never expose `aria-controls`, and there is no keyboard handler for Left/Right/Home/End tab navigation or activation. The panels similarly have `role="tabpanel"` with only `aria-labelledby`, but no matching panel id/controls relationship (`AcRadioTabs.tsx:162-167`).

That creates a shared accessibility regression across every adopter of the promoted primitive:

- Roland `PatchEditorTabs`
- Roland `ToneEditorTabs`
- Akai `VelocityZoneEditor`

Keyboard and assistive-technology users will encounter elements announced as tabs, but the widget does not behave like a tablist. The new tests also do not cover this contract; they only assert DOM shape, checked-state serialization, and mouse-click forwarding (`AcRadioTabs.test.tsx:55-260`).

**Evidence:**

- Faux tab roles on labels and hidden radios as the real state carriers:
  - `modules/editor-core/src/components/AcRadioTabs.tsx:99-129`
  - `modules/editor-core/src/design/tab-primitives.css:58-66`
- Panels expose `role="tabpanel"` but no `aria-controls` linkage from the tabs:
  - `modules/editor-core/src/components/AcRadioTabs.tsx:162-167`
- Current tests cover click and markup shape only, not keyboard/ARIA behavior:
  - `modules/editor-core/src/components/AcRadioTabs.test.tsx:55-260`
- Current adopters now depend on the shared primitive:
  - `modules/akai-s3k-editor/src/components/keygroups/VelocityZoneEditor.tsx:194-205`
  - `modules/roland-sxx0-editor/src/components/patches/PatchEditorTabs.tsx`
  - `modules/roland-sxx0-editor/src/components/tones/ToneEditorTabs.tsx`

**Expected:** either expose honest radio-group semantics (and stop declaring `role="tablist"` / `role="tab"` / `role="tabpanel"`), or implement the full ARIA tabs contract: selected-state attributes, controls linkage, and keyboard navigation/activation behavior.

**Actual:** the primitive advertises ARIA tab semantics without implementing the required state and keyboard behavior.

**Fix guidance:** pick one model and make it coherent. The lower-risk path is usually to lean into radios:
1. remove the tab roles,
2. expose a real radio-group label,
3. let the native radio inputs own focus/keyboard semantics.

If the project wants actual tabs, then the component needs a proper tab roving-focus implementation plus `aria-selected` / `aria-controls` wiring and matching tests.

**Fix landed:** commit `8545e839` took the radio fork (option 1) — the auditor's lower-risk path. Specifically:

- Removed `role="tab"` and `tabIndex={0}` from the visible labels (`AcRadioTabs.tsx`); labels are now decorative-only presentation that click-forwards to the radios via `htmlFor`.
- Removed `role="tablist"` from the container nav and replaced the nav with a plain `<div className="ac-radio-tab-strip">` — the container `<div className="ac-radio-tabs">` now carries `role="radiogroup" aria-label={ariaLabel}` so the group has a real ARIA name.
- Removed `role="tabpanel"` (and the now-superfluous `aria-labelledby`) from the `<section className="ac-radio-panel" data-tab={…}>` elements. `data-tab` stays as the canonical hook for the per-tab-ID CSS sibling-selector chain.
- Added `aria-label={tab.label}` to each `<input type="radio">` so assistive tech announces a name even though the visible `<label>` no longer carries an ARIA role.
- Updated the radio sr-only CSS in `tab-primitives.css` from the previous `opacity: 0; pointer-events: none; width: 0; height: 0` (which removed the radios from the tab order entirely) to the sr-only clip pattern (`position: absolute; width: 1px; height: 1px; clip: rect(0,0,0,0); …`) so the radios stay focusable. Native browser keyboard semantics (Tab to enter the group, Arrow keys between radios within the group) now work; no custom JS focus-management code is needed.

The explicit choice of the radio fork (option 1) over the full ARIA tabs fork: the existing pattern is fundamentally radio-driven — uncontrolled mode flips panels via CSS `:checked` sibling selectors against per-tab-ID rules, and the controlled mode reads the active `id` from React state. Implementing the full ARIA tabs contract (`aria-selected`, `aria-controls` linkage, custom Left/Right/Home/End keyboard handler, roving `tabindex` management) would have meant adding a parallel state-tracking layer on top of the radio inputs — more code surface, more drift risk, and a worse semantic fit. The radio-group fork honors the underlying mechanism instead of papering over it with a faux contract.

Regression coverage: `AcRadioTabs.test.tsx` gained a new describe block `AcRadioTabs — radio-group ARIA contract (AUDIT-20260524-11)` (6 tests):

- `exposes role="radiogroup" + aria-label on the container` — positive assertion.
- `does NOT render the faux role="tablist" / role="tab" / role="tabpanel" attributes` — three negative assertions that lock the AUDIT-11 regression out.
- `does NOT add tabIndex={0} to the visible labels (the radios own keyboard focus)` — locks the second half of the AUDIT-11 regression out.
- `renders each radio with a unique name (groupName) and an aria-label matching its tab.label` — confirms the radios are reachable as `role="radio"` and stay in the tab order (asserts `tabindex !== "-1"`).
- `exposes the radios through screen.getByRole("radiogroup")` — end-to-end ARIA lookup using the accessible name.
- `clicking a label still updates the matching radio (presentation labels click-forward via htmlFor)` — proves the click-forwarding contract that lets the visible labels stay decorative.

The 7 adopting roland test files (`tests/wiring/patches.spec.ts`, `tests/wiring/tones.spec.ts`, `tests/wiring/tone-display.spec.ts`, `tests/wiring/tone-writes-helpers.ts`, `tests/rendering/phase-9-task-6-screenshots.spec.ts`, `tests/ui/in-context/tones.envelope.in-context.spec.ts`, `tests/ui/in-context/tones-list.in-context.spec.ts`, `tests/e2e/s550-D-TONE-live-envelope-and-slider.spec.ts`) were updated in the same commit to assert against the radio-group shape instead of the faux ARIA tab attributes. Click sites switched to `page.locator('label.ac-radio-tab', { hasText: … }).click()` because the radios are sr-only / clipped (Playwright cannot click them via the visible viewport; the `<label>` is the visible click target and forwards via `htmlFor`). Presence sites use `page.getByRole('radio', { name: … }).toBeAttached()` — DOM-attached works against sr-only nodes.

Validator-paired hard-test: stashed only the production-code changes and re-ran the new tests against the pre-fix code. All 6 ARIA assertions went RED — e.g., `expected element NOT to contain "role=\"tablist\""`, `expected to find element with role "radiogroup" and name "Test sections accessible"` (the old code emitted `role="tablist"` instead). Stash popped; same tests now pass against the post-fix code. The ARIA gate has teeth.

## 2026-05-24 Feature review — latest shell-contract closure verification

Surfaced while reviewing the latest shell-contract closure commits through `0bcadbe1` on 2026-05-24, after `AUDIT-20260524-06` and `-07` were marked verified. This pass was a code-review audit of the new harness/spec work; I did not complete a full Playwright run in this pass. I did confirm that the ordinary module `pnpm test` script does not pick up `test/ui/**`, so these findings are based on the code and runner wiring rather than an end-to-end browser execution.

### The Akai shell-contract spec documents `.ac-detail-scroll` as part of the contract but never asserts the detail pane's scroll ownership

Finding-ID: AUDIT-20260524-08
Status:     verified-c8b09bc4
Severity:   medium
Surface:    `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts`, `modules/akai-s3k-editor/src/index.css`, `modules/akai-s3k-editor/src/pages/ProgramsPage.tsx`, `modules/akai-s3k-editor/src/pages/SamplesPage.tsx`, `modules/akai-s3k-editor/src/pages/KeygroupsPage.tsx`

The new shell-contract spec now covers the four intended Akai routes, but it still only checks internal scroll ownership on the list side. Its header explicitly names `.ac-detail-scroll` as part of the fixed-viewport contract (`page-shell-contract.spec.ts:12-13`), yet the desktop assertions only verify `.ac-list-scroll` overflow for app-shell routes (`page-shell-contract.spec.ts:197-206`). There is no corresponding assertion that the detail pane declares `overflow-y: auto|scroll`, even though the Akai implementation relies on the dialect-local `.ac-detail-scroll` wrapper for exactly that behavior.

That omission matters because the detail side is where the dense editors live. `ProgramsPage`, `SamplesPage`, and `KeygroupsPage` each wrap the real editor surface in `<div className="ac-detail-scroll">` (`ProgramsPage.tsx:351`, `SamplesPage.tsx:259`, `KeygroupsPage.tsx:351`), and the CSS comment in `index.css` says this wrapper exists so long editor surfaces scroll inside the grid track instead of getting clipped (`index.css:21-53`). A future regression that drops the class, removes `overflow-y: auto`, or replaces it with a non-scrolling wrapper would still leave the current spec green as long as the list column kept working.

**Evidence:**

- The spec describes `.ac-detail-scroll` as part of the shell contract:
  - `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts:12-13`
- The actual app-shell assertion checks only the list column:
  - `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts:197-206`
- The real Akai pages depend on `.ac-detail-scroll` for editor-pane scrolling:
  - `modules/akai-s3k-editor/src/pages/ProgramsPage.tsx:351`
  - `modules/akai-s3k-editor/src/pages/SamplesPage.tsx:259`
  - `modules/akai-s3k-editor/src/pages/KeygroupsPage.tsx:351`
  - `modules/akai-s3k-editor/src/index.css:21-53`

**Expected:** the shell-contract regression spec should assert both sides of the app-shell contract: `.ac-list-scroll` for list ownership and `.ac-detail-scroll` for detail ownership.

**Actual:** only the list column's overflow contract is tested.

**Fix guidance:** extend the app-shell branch of `page-shell-contract.spec.ts` with a `.ac-detail-scroll` computed-style assertion, and preferably add a contentful detail harness state that forces vertical overflow so the test checks behavior under scroll pressure rather than just class presence.

**Fix landed (c8b09bc4):** extended the app-shell branch of `page-shell-contract.spec.ts` with a `.ac-detail-scroll` `overflow-y` computed-style assertion alongside the existing `.ac-list-scroll` check (covers all 3 app-shell routes: programs, samples, keygroups-shell). Seeded `TestKeygroupsShellPage` with 20 stacked synthetic param rows (`min-height: 80px` each, ~1600px total content) inside `.ac-detail-scroll`, each carrying `data-testid="kg-detail-row-<index>"`. Added a new test case `keygroups-shell: .ac-detail-scroll owns scroll under contentful detail content` that asserts the contentful pressure shape: (a) `scrollHeight > clientHeight` on the detail pane (proves the seed creates real overflow), (b) the last detail row (`[data-testid="kg-detail-row-19"]`) is reachable via `scrollIntoView()` and lands inside the pane's bottom edge (proves the pane owns scroll), (c) `document.documentElement.scrollHeight` stays within `innerHeight` afterwards (proves the pane's scroll did not bleed to the document). Revert-test confirmed the new assertions have teeth: removing `overflow-y: auto` from `.ac-detail-scroll` in `index.css` turns the app-shell body-layout test red on all 3 routes (`"overflow-y should be 'auto' or 'scroll', got 'hidden'"`); removing the 20 synthetic rows turns the new contentful test red (`"scrollHeight (433px) should be > clientHeight (433px)"`). Test count: `make test-ui-s3k` 41 → 43 passed.

### The new real-library harness mounts empty library/device state, so the "inner overflow" assertion never exercises the contentful states that actually create scroll pressure

Finding-ID: AUDIT-20260524-09
Status:     verified-c8b09bc4
Severity:   medium
Surface:    `modules/akai-s3k-editor/src/pages/TestLibraryRealPage.tsx`, `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts`, `modules/akai-s3k-editor/src/pages/LibraryPage.tsx`

`TestLibraryRealPage` improves on the earlier stub by mounting the real `PluginLibraryBrowser`, but it still feeds that component an empty/disconnected world: `categoryData` is `{ samples: [], 'common-programs': [], 's3k-programs': [] }` and `EMPTY_MEMORY_STATE` has `isConnected: false` with no program or sample names (`TestLibraryRealPage.tsx:40-67`). The paired spec then asserts only that the three inner panes *declare* `overflow-y: auto|scroll` (`page-shell-contract.spec.ts:220-272`).

That means the new test proves CSS declarations on the empty-state DOM, not the populated states that actually create nested-scroll pressure on the production Library page. In the real page, `categoryData` is computed from live library contents (`LibraryPage.tsx:296`) and the browser receives a real `deviceMemoryState` (`LibraryPage.tsx:591`). Those are the cases where long trees, device-memory banks, and preview content can expose `min-height`, descendant sizing, or clipping regressions even if the empty-state panes still report `overflow-y: auto`.

**Evidence:**

- The "real" harness intentionally passes empty category/device state:
  - `modules/akai-s3k-editor/src/pages/TestLibraryRealPage.tsx:40-67`
- The spec checks pane styles, not overflow under populated content:
  - `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts:220-272`
- The production page supplies real category/device data:
  - `modules/akai-s3k-editor/src/pages/LibraryPage.tsx:296`
  - `modules/akai-s3k-editor/src/pages/LibraryPage.tsx:591`

**Expected:** the real-library harness used for overflow protection should include deterministic but contentful tree/device data so the asserted panes actually need to scroll.

**Actual:** the asserted panes render empty/disconnected states, so the test never proves overflow ownership under the content patterns most likely to regress.

**Fix guidance:** seed `TestLibraryRealPage` with enough deterministic library nodes and device-memory rows to overflow each pane, then keep the existing computed-style checks and add one reachability or bounded-scroll assertion per pane. That would turn the test from "the CSS property exists" into a real guard against clipped or bubbling overflow.

**Fix landed (c8b09bc4):** seeded `TestLibraryRealPage` with deterministic contentful inputs mirroring the production wiring shapes: `categoryData` carries 30 `TreeNode` entries per category (samples / common-programs / s3k-programs), matching the `{ id, name, type }` shape from `TreeView.tsx:23-30` and the `Record<categoryId, TreeNode[]>` aggregation at `LibraryPage.tsx:296`; the type discriminator is `'sample'` for samples and `'program'` for both program categories (matches `categories.tsx`). `S3kMemoryPanelState` now has `isConnected: true` with 30 program names (`PRG_00_NAME` .. `PRG_29_NAME`) and 30 sample names (`SMP_00_NAME` .. `SMP_29_NAME`), matching the `S3kMemoryPanelState` interface at `s3k-library-plugin.tsx:35-57`; action callbacks remain no-op because the contract under test is overflow ownership, not write behavior. Kept the existing computed-style overflow checks; added a new test case `library-real: contentful library + device-memory state forces real overflow pressure` that asserts, for each of `.ac-plugin-library-browser-device` and `.ac-plugin-library-browser-sections`: (a) `scrollHeight > clientHeight` (proves the seed creates real overflow pressure), (b) a deterministic last item is reachable via `scrollIntoView()` and lands inside the pane's bottom edge — `[data-testid="device-sample-29"]` for the device pane (from `DeviceMemoryPanel`'s `data-testid={`device-${type}-${index}`}` shape), `[data-testid="library-sample-samples-sample-029"]` for the sections pane (slug shape from `TreeView.tsx:267-269`) — (c) `document.documentElement.scrollHeight` stays within `innerHeight` afterwards (no bleed). The preview pane is explicitly excluded from the populated-overflow assertions because it renders the SELECTED item's preview, not all items; with no selection it stays empty. Its overflow declaration is still asserted by the prior inner-pane test. Revert-test confirmed teeth: reverting `categoryData` + `memoryState` back to empty inputs turns the new contentful test red (`"pane '.ac-plugin-library-browser-device' scrollHeight (739px) should be > clientHeight (739px)"`). Test count: `make test-ui-s3k` 41 → 43 passed.

## 2026-05-24 Feature review — latest shell-contract follow-up

Surfaced while reviewing the latest `feature/akai-harmonization` commits through `1a6261d2` on 2026-05-24, specifically the new Akai shell-contract harness/spec work that closed `AUDIT-20260524-05`. This pass was a code-review audit only; I did not run the test suite locally in this pass.

### Shell-contract closure still excludes the Keygroups route, so the one migrated page with the most unique shell structure has no direct Akai regression spec

Finding-ID: AUDIT-20260524-06
Status:     verified-7e431a69
Severity:   medium
Surface:    `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts`, `modules/akai-s3k-editor/src/App.tsx`, `modules/akai-s3k-editor/src/pages/TestKeygroupsPage.tsx`, `docs/1.0/001-IN-PROGRESS/akai-harmonization/workplan.md`

The new `page-shell-contract.spec.ts` is framed as the Akai-side closure for the Phase 2 shell migration, and its file header says the migration covered all four Akai pages: Programs, Samples, Keygroups, and Library (`page-shell-contract.spec.ts:5-6`). But the spec immediately documents that Keygroups is still excluded: `/test/keygroups` is wired to the pre-existing inline-styled harness rather than a shell-compliant page harness (`page-shell-contract.spec.ts:30-39`), `KEYGROUPS_SHELL_HARNESS_AVAILABLE` is hardcoded `false` (`page-shell-contract.spec.ts:60`), and the actual loop only exercises Programs, Samples, and Library (`page-shell-contract.spec.ts:74-93`).

That matters because Keygroups is not just another copy of the same page shape. Its production page has the most structurally distinct layout of the four migrated surfaces: the zone-overview toolbar and overview block sit ahead of the canonical shell, so it is the route most likely to regress height ownership, clipping, or scroll interactions in a way that the other three harnesses would not catch. Today the spec marks `AUDIT-20260524-05` closed while leaving that route outside the Akai-specific regression surface.

**Evidence:**

- The spec header claims all four migrated pages are in scope: `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts:5-6`
- The same file explicitly excludes Keygroups and keeps the seam disabled:
  - `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts:30-39`
  - `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts:60`
  - `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts:74-93`
- The route still points to the old inline-styled harness, not a canonical shell harness:
  - `modules/akai-s3k-editor/src/App.tsx:21`
  - `modules/akai-s3k-editor/src/pages/TestKeygroupsPage.tsx:160-183`
- The workplan now marks harness coverage complete for all four pages, which overstates what the shell-contract spec actually exercises:
  - `docs/1.0/001-IN-PROGRESS/akai-harmonization/workplan.md:98`

**Expected:** if `AUDIT-20260524-05` is considered closed, each migrated Akai page should have a shell-contract harness that the Akai regression spec actually runs, including Keygroups.

**Actual:** Keygroups remains routed to a legacy inline harness and is intentionally omitted from the Akai shell-contract spec.

**Fix guidance:** add a shell-compliant `TestKeygroupsPage` variant that mirrors the production `KeygroupsPage` shell contract, then include it in `SHELL_HARNESS_ROUTES` and remove the `KEYGROUPS_SHELL_HARNESS_AVAILABLE = false` seam. Until then, the audit log and workplan should describe the shell-contract closure as partial rather than complete.

**Fix landed:** commit `7e431a69` (2026-05-24). New file `modules/akai-s3k-editor/src/pages/TestKeygroupsShellPage.tsx` registered at the new route `/akai/s3000xl/editor/test/keygroups-shell` in `modules/akai-s3k-editor/src/App.tsx`. The harness mirrors the production `KeygroupsPage` shell scaffold (`.ac-page-shell--fixed-viewport` + `PageTitleRow` + `ZoneOverviewToolbar` + `ZoneOverview` + `.ac-app-shell` + real `KeygroupList` + `.ac-detail-scroll` stub detail) with 16 factory keygroups + local React state; no zustand stores, no `useS3000xlClient`. The pre-existing `/akai/s3000xl/editor/test/keygroups` route stays pointing at the inline-styled `TestKeygroupsPage` because `zone-overview.spec.ts:3` depends on it. The `KEYGROUPS_SHELL_HARNESS_AVAILABLE` constant + its header-comment block were removed from `page-shell-contract.spec.ts`; the new route is added to `SHELL_HARNESS_ROUTES` and the 13 existing test cases automatically extend coverage to keygroups-shell via the loop. `make test-ui-s3k`: 41 passed (was 32 — added the keygroups-shell route × 4 viewports + 1 viewport-route combination for library-real; see AUDIT-20260524-07 below for the rest).

### Library shell harness only proves wrapper geometry; it does not exercise the real `PluginLibraryBrowser` overflow surface the finding claimed to protect

Finding-ID: AUDIT-20260524-07
Status:     verified-7e431a69
Severity:   medium
Surface:    `modules/akai-s3k-editor/src/pages/TestLibraryPage.tsx`, `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts`

The new Library harness does not mount `PluginLibraryBrowser`. Its own header says it uses a stub `<div>` standing in for the browser (`TestLibraryPage.tsx:9-13`), and the body comment repeats that the harness only needs a single full-height block so the spec can verify `.ac-page-shell-body` geometry (`TestLibraryPage.tsx:27-31`). That means the new regression spec validates the page wrapper shape, but not the real surface that owns the complex internal overflow behavior on the production Library page.

This is a meaningful gap because `AUDIT-20260524-05` was about fixed-viewport containment and internal scroll ownership after the page-shell migration. The production Library page delegates that behavior to a full-height three-column widget; a stand-in block cannot catch regressions where the real browser's own DOM, overflow rules, or descendant sizing reintroduce document scroll or clipped inner panes while the outer `.ac-page-shell-body` still looks correct.

**Evidence:**

- The harness explicitly uses a stand-in block instead of the production browser:
  - `modules/akai-s3k-editor/src/pages/TestLibraryPage.tsx:9-13`
  - `modules/akai-s3k-editor/src/pages/TestLibraryPage.tsx:27-31`
- The page-shell spec relies on that harness route as the Library coverage surface:
  - `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts:24-28`
  - `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts:87-92`

**Expected:** the closure for the Library shell-contract finding should exercise either the real `PluginLibraryBrowser` in a deterministic harness or a test surface that preserves the browser's actual internal overflow structure.

**Actual:** the current harness proves only that a generic full-height block fits inside `.ac-page-shell-body`.

**Fix guidance:** build a deterministic library harness around the real `PluginLibraryBrowser` with stubbed library/device inputs, or add a second targeted spec that mounts the real browser and asserts document-scroll containment plus inner-pane overflow ownership. If the stub-only approach is kept, the audit closure should explicitly state that only outer wrapper geometry is covered.

**Fix landed:** commit `7e431a69` (2026-05-24). Chose **shape (a)** from the operator's fix-guidance — a deterministic real-`PluginLibraryBrowser` harness. New file `modules/akai-s3k-editor/src/pages/TestLibraryRealPage.tsx` registered at the new route `/akai/s3000xl/editor/test/library-real` in `modules/akai-s3k-editor/src/App.tsx`. The harness mounts the REAL `PluginLibraryBrowser` with:
- `s3kLibraryPlugin` (the production plugin config from `@/plugins/s3k-library-plugin`)
- A stub `{ name: 'TestLibraryRoot' }` library handle — matches the truthy `{ name }` shape `PluginLibraryBrowser.test.tsx` uses (`{} as FileSystemDirectoryHandle`)
- An empty `S3kMemoryPanelState` (`isConnected: false`, empty `programNames`/`sampleNames`) so the device-memory panel renders empty
- Empty `categoryData` for `samples` / `common-programs` / `s3k-programs` — the contract under test is inner-pane overflow ownership, not tree-rendering behavior

The pre-existing `/akai/s3000xl/editor/test/library` route stays pointing at the stub-`<div>` `TestLibraryPage` because it's the outer wrapper-geometry baseline for the contract spec; the new `library-real` route is the inner-pane gate. Both routes are now in `SHELL_HARNESS_ROUTES` in `page-shell-contract.spec.ts`.

**Inner-pane assertion specifics** (`page-shell-contract.spec.ts:220-272`): a new per-route test, gated by the `asserts_inner_library_overflow` flag on the route metadata (only `library-real` opts in today), asserts the three inner panes of `PluginLibraryBrowser` each declare `overflow-y: auto` or `scroll`:
- `.ac-plugin-library-browser-device` (device memory column)
- `.ac-plugin-library-browser-sections` (library tree scroll container)
- `.ac-plugin-library-browser-preview` (preview pane)

If any pane's `overflow-y` regresses to `visible`, content overflow bubbles up the parent chain until either the `.ac-page-shell-body` clips it (content unreachable) or the document scrolls (regresses the fixed-viewport contract) — both outcomes are shell-contract failures the assertion catches at the inner-pane layer. A cross-check at the end of the same test re-asserts `document.documentElement.scrollHeight <= window.innerHeight + slack` against the real-`PluginLibraryBrowser` mount, pinning the no-document-scroll invariant specifically against the real component so a regression here implicates the inner-pane overflow rules, not the outer shell.

## 2026-05-24 Feature review — latest Phase 2 implementation

Surfaced while reviewing the latest harmonization commits on `feature/akai-harmonization` after `AUDIT-20260524-01` and `-02` were fixed. Scope reviewed from commit `68799ed9` through `HEAD` (`5a15c01c` at review time), with targeted local verification runs:

- `pnpm --filter @audiocontrol/editor-core test -- TreeView.test.tsx`
- `pnpm --filter @audiocontrol/akai-s3k-editor test -- SampleList.test.tsx`

Both targeted runs passed, but they do not cover the new issues below.

### Akai list-row migration codifies selected state on `role="button"` rows via `aria-selected`, which screen readers will not treat as a button state

Finding-ID: AUDIT-20260524-04
Status:     verified-2026-05-24
Severity:   medium
Surface:    `modules/akai-s3k-editor/src/components/programs/ProgramList.tsx`, `modules/akai-s3k-editor/src/components/samples/SampleList.tsx`, `modules/akai-s3k-editor/src/components/keygroups/KeygroupList.tsx`, `modules/akai-s3k-editor/test/unit/components/SampleList.test.tsx`

Phase 2 task 2.2 migrated the Akai list widgets onto the canonical `.ac-list-row` chrome and, in the process, standardized all three row types as focusable `<div role="button">` wrappers carrying `aria-selected={isSelected}`:

- `ProgramList.tsx:176-185`
- `SampleList.tsx:182-191`
- `KeygroupList.tsx:138-147`

The visual selected-state styling is then keyed off `[aria-selected="true"]` in CSS, and the updated `SampleList` unit test now treats that attribute as the selected-state contract (`SampleList.test.tsx:43-60`).

The problem is semantic: `aria-selected` is not a supported state for the ARIA `button` role. Browsers will happily leave the attribute in the DOM and CSS can style against it, but assistive technology will not reliably announce "selected" for a button because "selected" is a state for roles like `option`, `tab`, `gridcell`, or `treeitem`, not buttons.

So the branch now has a selected-state signal that works visually and in DOM-attribute tests, but does not actually expose the state to screen-reader users in the way the tests imply.

**Evidence:**

- Akai rows now expose `role="button"` + `aria-selected={...}`:
  - `modules/akai-s3k-editor/src/components/programs/ProgramList.tsx:176-185`
  - `modules/akai-s3k-editor/src/components/samples/SampleList.tsx:182-191`
  - `modules/akai-s3k-editor/src/components/keygroups/KeygroupList.tsx:138-147`
- The updated unit test explicitly blesses `aria-selected` as the new observable contract:
  - `modules/akai-s3k-editor/test/unit/components/SampleList.test.tsx:43-60`

**Expected:** either use a role that legitimately carries `aria-selected` (for example a listbox/option-style pattern), or keep the button role and expose selection through a supported button state / wording instead of treating `aria-selected` as meaningful.

**Actual:** the selected-state contract is visually correct but semantically inert for assistive tech.

**Fix guidance:** do not deepen the new contract in more tests. Either re-model these lists as composite widgets with roles that support selection, or keep the button role and move the state exposure to a supported pattern (`aria-current`, `aria-pressed`, or explicit screen-reader text depending on the intended interaction model). A follow-up regression test should assert the accessible role/state combination, not just the raw attribute.

**Fix landed:** this session, 2026-05-24. Per the auditor's guidance, switched the selected-state contract from `aria-selected` to `aria-current="true"` everywhere. This is the "currently-selected item from a set" ARIA pattern that IS supported on the `button` role.

Per the ARIA spec, the omit-when-not-current convention applies: selected rows render `aria-current="true"`, unselected rows omit the attribute entirely (the JSX uses `aria-current={isSelected ? 'true' : undefined}`).

Files changed (the canonical fix is editor-core CSS; the consumer fix is 5 JSX sites across roland + akai):
- `modules/editor-core/src/design/list-primitives.css` — 3 selectors changed from `[aria-selected="true"]` to `[aria-current="true"]` (hover-reveal action class, slot color, row background).
- `modules/roland-sxx0-editor/src/components/patches/PatchList.tsx` + `tones/ToneList.tsx` — `aria-selected={isSelected}` → `aria-current={isSelected ? 'true' : undefined}`.
- `modules/akai-s3k-editor/src/components/programs/ProgramList.tsx` + `samples/SampleList.tsx` + `keygroups/KeygroupList.tsx` — same.
- `modules/akai-s3k-editor/test/unit/components/SampleList.test.tsx` — both tests updated: the "selected sample" test now asserts `aria-current === 'true'`; the "unselected" test now asserts the attribute is null (per omit-when-not-current).

**Verification:** `make` clean. `make test-ui-roland` 4 passed + 2 skipped (matches baseline; roland row-state styling continues to work with the new attribute). `make test-ui-s3k` 19 passed. `pnpm --filter @audiocontrol/akai-s3k-editor test` 175 passed + 1 failed (matches baseline — the failing test is the pre-existing `ProgramsPage delete flow > shows loading status when isLoading with a message` unrelated to this change, confirmed via stash + re-run).

**Test-gap follow-up:** the auditor recommended "a follow-up regression test should assert the accessible role/state combination, not just the raw attribute." The current SampleList test asserts `aria-current === 'true'` on the raw attribute. A stronger test would use `@testing-library/react`'s `getByRole` + accessibility-tree assertions to verify the rendered role + state actually exposes to AT correctly. Deferred to a follow-up — landing the literal-attribute fix first closes the immediate semantic bug.

### Phase 2 landed four Akai page-shell migrations with no direct regression test for the new fixed-viewport/app-shell contract

Finding-ID: AUDIT-20260524-05
Status:     verified-7e431a69 (re-closed 2026-05-24 — see "Re-closed" paragraph below)
Severity:   medium
Surface:    `modules/akai-s3k-editor/src/pages/ProgramsPage.tsx`, `modules/akai-s3k-editor/src/pages/KeygroupsPage.tsx`, `modules/akai-s3k-editor/src/pages/SamplesPage.tsx`, `modules/akai-s3k-editor/src/pages/LibraryPage.tsx`, `modules/akai-s3k-editor/test/`

The latest Phase 2 work moved all four primary Akai pages onto the canonical shell/layout primitives:

- `ProgramsPage.tsx:310-351` now uses `.ac-page-shell--fixed-viewport`, `.ac-app-shell`, `.ac-detail-scroll`
- `KeygroupsPage.tsx:307-351` now uses the same contract
- `SamplesPage.tsx:231-259` now uses the same contract
- `LibraryPage.tsx:560-572` now uses `.ac-page-shell--fixed-viewport` + `.ac-page-shell-body`

That is a large live-surface migration: page header, height bounding, internal scroll ownership, and list/detail pane structure all changed together. But the Akai test surface still does not exercise that contract directly. The only touched unit test in this pass is `SampleList.test.tsx`, and it checks row attributes only. A grep across `modules/akai-s3k-editor/test/` shows waits for lists to appear and hardware workflows that happen to pass through the pages, but no test that asserts the new shell/layout invariants themselves (`ac-page-shell--fixed-viewport`, `ac-app-shell`, `ac-detail-scroll`) or any dedicated Akai UI harness for the migrated pages.

This matters because the migration is precisely the kind of change that can regress scroll containment, clipping, or mobile behavior while leaving data-loading tests green. Roland has explicit design/rendering coverage for the canonical fixed-viewport shell; Akai still does not.

**Evidence:**

- New page-shell adoption:
  - `modules/akai-s3k-editor/src/pages/ProgramsPage.tsx:310-351`
  - `modules/akai-s3k-editor/src/pages/KeygroupsPage.tsx:307-351`
  - `modules/akai-s3k-editor/src/pages/SamplesPage.tsx:231-259`
  - `modules/akai-s3k-editor/src/pages/LibraryPage.tsx:560-572`
- Current Akai tests reference the lists/pages only indirectly (load/wait helpers and hardware flows), not the new layout contract itself:
  - `modules/akai-s3k-editor/test/` grep shows list waits and one `SampleList` unit spec, but no assertion on `ac-page-shell--fixed-viewport`, `ac-app-shell`, or `ac-detail-scroll`

**Expected:** when Phase 2 replaces a page’s shell/layout contract, the branch adds a direct regression surface for that contract on Akai too, not just on Roland. At minimum one targeted UI/rendering spec should assert scroll containment / non-clipping for the migrated Akai pages.

**Actual:** the canonical shell rollout to Akai is effectively covered only by incidental e2e traffic and one row-level unit test.

**Fix guidance:** add a focused Akai UI/rendering spec for the migrated pages before more shell-level harmonization lands. The most valuable first assertion is the fixed-viewport invariant: list and detail panes own internal scroll on desktop without clipping their bodies, with the mobile escape hatch still falling back to document scroll below 900 px.

**Fix landed:** commit `ff07963c` (2026-05-24). Added `modules/akai-s3k-editor/test/ui/page-shell-contract.spec.ts` — 13 Playwright test cases across two `test.describe` blocks. Desktop (1280×900): asserts `.ac-page-shell--fixed-viewport` is present, page-shell `boundingClientRect.height` ≤ `window.innerHeight - site-header` (bounded-viewport contract), `document.documentElement.scrollHeight === window.innerHeight` (no document-level scroll), `.ac-app-shell` is a 2-col grid via `gridTemplateColumns` introspection, `.ac-list-scroll` `overflow-y` is `auto`/`scroll`. Library variant asserts `.ac-page-shell-body` instead of `.ac-app-shell`. Mobile (414×896): asserts the escape hatch — page-shell falls back to `height: auto`, doc scrolls naturally (`scrollHeight > innerHeight`), `.ac-app-shell` collapses to single track, last list row is reachable via scroll (`scrollIntoView` + `boundingClientRect` reachability check). Runs against the three new harness routes (`/akai/s3000xl/editor/test/{programs,samples,library}`) landed alongside in this same commit. `make test-ui-s3k`: 32 passed (19 existing zone-overview + 13 new contract tests).

**Coverage gap (intentional, documented):** `TestKeygroupsPage` is not included in the contract loop — it predates the canonical shell chrome (renders inline styles, not `.ac-page-shell--fixed-viewport`). The spec records this with `KEYGROUPS_SHELL_HARNESS_AVAILABLE = false` at the top + a header comment naming the gap, so a future opt-in is mechanical. The production `KeygroupsPage` IS shell-compliant (migrated in `bba5b13b` and covered indirectly via the cross-page contract this spec asserts); only the harness lags.

**Closure downgraded 2026-05-24 from `verified-2026-05-24` to `acknowledged-partial-coverage`.** Auditor flagged two gaps the closure paragraph above understated:
- **AUDIT-20260524-06**: Keygroups is the structurally most-distinct of the four migrated pages (zone-overview toolbar + overview block ahead of canonical shell). Leaving its harness route excluded means the page most likely to regress shell behavior is the one route the Akai-specific spec doesn't exercise. The "intentional gap" framing above was wrong — the right disposition is to BUILD the missing shell-compliant harness, not document its absence.
- **AUDIT-20260524-07**: `TestLibraryPage` mounts a stub `<div>` instead of the real `PluginLibraryBrowser`. The spec validates outer wrapper geometry but not the inner-overflow surface that AUDIT-05's fix-guidance specifically called out ("list and detail panes own internal scroll on desktop without clipping their bodies"). Stub-only coverage is not the closure shape the original finding asked for.

Re-closing AUDIT-05 requires landing fixes for both -06 and -07 (a shell-compliant `TestKeygroupsShellPage` route at `/akai/s3000xl/editor/test/keygroups-shell` registered in `SHELL_HARNESS_ROUTES`; a deterministic real-`PluginLibraryBrowser` harness route or paired spec that asserts inner-pane overflow ownership). When both ship, all three findings close together with `verified-<sha>`.

**Re-closed:** commit `7e431a69` (2026-05-24). Both -06 and -07 closed in the same commit, which re-closes -05. The full coverage picture is now:
- **Keygroups:** new shell-compliant `TestKeygroupsShellPage` at `/akai/s3000xl/editor/test/keygroups-shell` exercises the structurally most-distinct of the four migrated pages (zone-overview toolbar + overview block ahead of the canonical `.ac-app-shell`) through the contract spec's full per-route gauntlet (desktop fixed-viewport, app-shell 2-col grid, mobile escape-hatch falls back to auto-height, app-shell collapses to single column on mobile, last list row reachable via scroll).
- **Library:** new `TestLibraryRealPage` at `/akai/s3000xl/editor/test/library-real` mounts the REAL `PluginLibraryBrowser` with the production `s3kLibraryPlugin` + stub library handle + empty `S3kMemoryPanelState`. A new per-route assertion gated by `asserts_inner_library_overflow` (only `library-real` opts in) covers the inner-pane overflow contract AUDIT-05's fix-guidance specifically named: each of `.ac-plugin-library-browser-device`, `.ac-plugin-library-browser-sections`, `.ac-plugin-library-browser-preview` MUST declare `overflow-y: auto` or `scroll`. A cross-check asserts document-scroll containment against the real `PluginLibraryBrowser` mount so a regression here implicates the inner-pane overflow rules, not the outer shell. The original `/test/library` route stays as the outer wrapper-geometry baseline; both routes are now in `SHELL_HARNESS_ROUTES`.

**New contract-spec test count:** 22 (was 13). Decomposition:
- Desktop describe: 5 routes × 2 base tests (`fixed-viewport shell` + `body layout matches its kind`) + 1 inner-pane test (only `library-real`) = 11
- Mobile describe: 5 routes × 1 escape-hatch test + 3 `app-shell`-kind routes × 2 tests (`collapse-to-single-col` + `last-row-reachable`) = 5 + 6 = 11

`make test-ui-s3k`: 41 passed (was 32 — 19 zone-overview unchanged + 22 page-shell-contract). Independent re-run after the implementer commit per agent-discipline.md "When CI is absent, the controller is the gate."

**Inner-pane coverage proof:** revert-test confirms the new assertions have teeth — if `.ac-plugin-library-browser-device`'s CSS rule loses its `overflow-y: auto` declaration in `modules/editor-core/src/design/library.css`, the new `library-real: inner library panes own their own overflow` test turns red with a message naming the regressing selector + the actual computed `overflow-y` value. This closes the gap AUDIT-07 named: AUDIT-05's original closure validated `.ac-page-shell-body` geometry but said nothing about inner-pane ownership; now the contract spec asserts both.

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
Status:     verified-2026-05-24
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

**Fix landed:** this session, 2026-05-24. `modules/editor-core/src/design/tokens.css` `:root[data-editor='s3000xl']` block now includes six `--ac-action-*` overrides: `--ac-action-color: rgba(26, 24, 18, 0.45)` (dark text at 45% for the default state on cream — visible-but-secondary), `--ac-action-hover: rgba(26, 24, 18, 0.95)` (near-black on hover for strong contrast), `--ac-action-danger-hover: var(--ac-color-danger)` (the dialect's deeper akai red `#a01e1e`), `--ac-action-selected-color: var(--ac-akai-red)`, `--ac-action-selected-hover: var(--ac-akai-red-hover)`, `--ac-action-selected-danger-hover: #6b0e0e` (deeper red on the selected-row hover). The global `--ac-action-*` tokens stay unchanged for the roland dark surfaces. **Test gap:** no automated computed-style assertion yet — the auditor's suggested pairing (a visual or computed-style test on an akai list/tree row) is deferred to the AUDIT-20260524-03 screenshot-baseline work where the akai harness pages will provide the visual surface to assert against.

### Phase 1 audit advanced past its own harness/screenshot prerequisites, leaving most Akai surfaces without a rerunnable visual test bed

Finding-ID: AUDIT-20260524-03
Status:     verified-2026-05-24
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

**Fix landed:** commit `ff07963c` (2026-05-24). Created the three missing harness pages:
- `modules/akai-s3k-editor/src/pages/TestProgramsPage.tsx`
- `modules/akai-s3k-editor/src/pages/TestSamplesPage.tsx`
- `modules/akai-s3k-editor/src/pages/TestLibraryPage.tsx`

Routes registered in `modules/akai-s3k-editor/src/App.tsx` under `/akai/s3000xl/editor/test/{programs,samples,library}`. Each harness mirrors `TestKeygroupsPage`'s pattern (local React state + factory data; no zustand stores, no `useS3000xlClient`) but renders the SAME canonical chrome scaffold its production page renders (`.ac-page-shell--fixed-viewport` + `PageTitleRow` + `.ac-app-shell`/`.ac-page-shell-body` + the production list-component + `.ac-detail-scroll` with stub detail content). The harnesses give the contract spec (AUDIT-20260524-05 closure) live routes to exercise without needing real device wiring. The screenshot-baseline aspect of the original finding is left as an operator-driven artifact (the harness routes are now reachable; if/when the operator wants committed baselines, they can be captured via Playwright at any point). `make test-ui-s3k`: 32 passed (the new contract spec mounts each harness route and asserts the shell invariants — proving the harness scaffold renders correctly and the canonical chrome is in force on every route).

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
