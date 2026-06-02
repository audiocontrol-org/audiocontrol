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

- **P2.2 — Scene-manifest schema + initial manifest.** A version-controlled declarative list of shots: `{ id, editor, route, scenario (captured-fixture name), viewport }`. Initial scenes: Roland tones **FILTER tab**, Roland patches, Roland play, Akai keygroups. **Proven complete when:** the manifest parses under a typed schema (no `any`); a validator asserts every entry resolves to a real route AND an existing captured fixture, and **throws** (no fabrication) when a referenced fixture is absent — shipped validator-paired with a scenario that fails against a manifest pointing at a missing fixture.

- **P2.3 — Deterministic capture step.** Playwright navigates `route?midi=simulated&scenario=<capture>`, awaits an explicit page **ready hook + `document.fonts.ready`** (no `sleep`/defensive delays, per `feedback_no_delays`), and shoots at the pinned **1280×800 logical @2x (2560×1600)**, full app-shell, no browser chrome. **Proven complete when:** two consecutive captures of the same scene are perceptually identical (a determinism test asserts this); no arbitrary timeouts appear in the capture path.

- **P2.4 — Output + invocation.** `make promo-shots` renders the manifest to a gitignored `out/promo/`; operator promotes chosen shots into a committed `docs/promo/` gallery. **Proven complete when:** `make promo-shots` emits one PNG per manifest scene; `out/promo/` is gitignored; `docs/promo/` exists as the curated gallery home.

- **P2.5 — Captured-fixture audit + capture-gap handling.** Verify each initial scene maps to a real, visually-adequate captured fixture. Any scene without one becomes an explicit `capture-from-hardware` sub-task (tracked, with operator acceptance per `agent-discipline.md`) — never a fabricated fixture. **Proven complete when:** every initial scene maps to a real captured fixture OR has a tracked capture task; zero fabricated data introduced (grep-clean of new fixtures).

- **P2.6 — Phase 1 T8.8 consumes the engine.** The Roland FILTER-tab above-the-fold verification screenshot (Phase 1 §T8.8) is produced as a `promo-shots` scene rather than an ad-hoc Playwright call. **Proven complete when:** T8.8's deliverable PNG is produced by `make promo-shots` from the manifest.

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

- **P3.1 — Author `docs/design-language/roland.md`.** Palette, typography, signature components (rec-LED red as the S-550 PLAY-LED homage, VFD glow, CRT, virtual front panel) each with *rationale* and a reference to the real `DESIGN-SYSTEM.md` token / `.ac-*` primitive that implements it, plus do's/don'ts. **Proven complete when:** every visual claim cites a token or `.ac-*`/`.sk-*` primitive that actually exists (grep-verified at author time); zero fabricated tokens; no temporal/projection language per docs standards.

- **P3.2 — Author `docs/design-language/akai.md`.** Same shape for the Akai S3000XL editor's realized identity. **Proven complete when:** same gate as P3.1 for the Akai surface.

- **P3.3 — Scope-pointer stubs for JV-1080 / D-110.** `docs/design-language/jv1080.md` + `d110.md` each carry a single line: "design language TBD when this editor gets visual work" — defining their language now would be fabrication. **Proven complete when:** both files exist with only the scope-pointer; no invented design language.

- **P3.4 — Living styleguide gallery (depends on Phase 2).** A device-free route per spec'd editor (Roland, Akai) that catalogues the real signature components; added as `promo-shots` manifest scenes. The markdown specs link to the gallery shots as their canonical-pixels reference. **Proven complete when:** the gallery route renders the real components (not re-implementations); `make promo-shots` produces the gallery PNGs; P3.1/P3.2 specs link to them.

- **P3.5 — Retire the old hi-fi design-language mockup's authority.** Note in the consolidated specs that `…/explorations/01-design-language.html` is grandfathered/historical and the per-editor spec + living gallery are now canonical. **Proven complete when:** the specs state the canonical source explicitly; no two artifacts claim to be the design-language source of truth.

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

## Out of Scope

- Library browser UX → `library-ux`.
- Device-protocol bug fixes → `roland-bugfix` / device-scoped branches.
- Akai workflow restructuring → `akai-ux-improvement` (complete).
- Foundational workflow architecture → `edit-workflow-architecture`.
