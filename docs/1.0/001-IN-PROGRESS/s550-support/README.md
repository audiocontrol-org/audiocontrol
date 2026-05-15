# Roland S-550 Editor Support

**Status:** In Progress. **Phase 9 REOPENED 2026-05-13 — false closure.** Phases 1-8, 10 Complete; Phase 7 Complete (2026-05-12); Phase 0 Task 10 Complete (all 7 waves). **Sub-task 9R-A.1 (Infrastructure) COMPLETE 2026-05-14.** **Sub-task 9R-A.2 (Migrate capability specs to Tier 1) COMPLETE 2026-05-14** — 20 source files `git mv`'d from `test/ui/capabilities/` to `test/wiring/`; legacy directory deleted; rendering smoke (`phase-9-task-6-screenshots.spec.ts`) relocated to `test/rendering/` with a new "NOT a closure gate" README; `make test-wiring-roland` + `make test-rendering-roland` make targets added; `tools/check-coverage.ts` pipeline gained a `test-wiring-roland` step between lint and `test-ui-roland`. Post-migration counts: wiring=136 / ui=26 / rendering=14 (4 skipped) = pre-migration baseline. Test-discipline gate (`make check-coverage-roland`) operational; first end-to-end demo on D-TONE-ENV-02 = `partial`. Sub-task 9R-A.3 (inventory rewrite) COMPLETE 2026-05-14: detailed inventory rewritten via 9R-A.3.A (Affordance cells verb-led/value-named; `Test` column removed; generator updated for the 8-column shape); parent inventory `ROLAND-S550-EDITOR-CAPABILITIES.md` rewritten via 9R-A.3.B (51 stale Test paragraphs removed; preamble realigned to the tier-discipline model). Remaining sub-phases: 9R-A.4 (D-TONE-ENV-02 → `confident`), 9R-B (primitive sweep), 9R-C (page rebuild), 9R-D (operator holistic gate).

**2026-05-13 Phase 9 reopen:** live-hardware testing revealed Phase 9's "v3 redesign" never delivered functional UI controls. Every parameter slider on PatchesPage / TonesPage / PlayPage / LibraryPage is a `role="img"` visualization with no pointer handlers ([#424](https://github.com/audiocontrol-org/audiocontrol/issues/424)). PlayPage retains legacy `.ac-page-sticky-header` chrome that occludes the VideoCapture drawer + Part A row ([#423](https://github.com/audiocontrol-org/audiocontrol/issues/423)). The 175-passing capability suite drives value writes by programmatically filling the underlying `<input type="number">` (`.fill(...)` / `evaluate(() => input.value = X)`) — it verifies the device-write seam but never exercises operator-facing pointer/keyboard interaction. Task 6's "screenshot verification" captured paint, not interaction. Closure was based on the wrong invariant. Phase 9 Tasks 1-7 INVALIDATED; remediation plan (9R-A test-strategy reset → 9R-B primitive remediation → 9R-C page rebuild → 9R-D operator hardware gate) supersedes the previous tasks. See [workplan.md](./workplan.md) Phase 9 section for the full plan.

**2026-05-13 earlier work (still standing):** [#408](https://github.com/audiocontrol-org/audiocontrol/issues/408) Tone Editor polish closed via 4 commits (`447a7dfd` + `2e64b6d0` + `e8a404db` + `3fa19358`): 5 new tone-editor controls + 1 data-model dedup. New `synthesize-tone-fixture.ts` tool ships codec-driven fixture regeneration. Follow-up [#422](https://github.com/audiocontrol-org/audiocontrol/issues/422) tracks the unexplored `TVA_LFO_DEPTH_2` codec parameter. **Caveat:** the 5 new controls land inside the same non-interactive `ParamSliderRow` primitive — they are subject to 9R-B remediation. Open-issue closeout pass earlier 2026-05-13 closed 13 follow-ups (#392/#393/#396/#397/#399/#400/#401/#402/#403 bookkeeping + #420 orphan deletion + #419 TreeSection testid + #418 LibraryTreeNode meta + #405 PatchesPage tone-load decoupling). [decisions-2026-05-11.md](./decisions-2026-05-11.md) v3 — 5 of 6 decisions settled (Decision 2 remains; working assumption = Option B). See [`.claude/rules/agent-discipline.md`](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/.claude/rules/agent-discipline.md) for the workplan-discipline rules.
**Feature Branch:** `feature/s550-support`
**GitHub Milestone:** [Week of Feb 24-28](https://github.com/audiocontrol-org/audiocontrol/milestone/4)

## Overview

Add web-based editor support for the Roland S-550 sampler by extracting shared S-series protocol code and building a unified sampler editor that serves both S-330 and S-550 devices.

The S-550 shares model ID `0x1E` and SysEx protocol with the S-330 but has an inverted memory block layout: fewer patches (32 vs 64), more tones (64 vs 32), and double the wave banks (4 vs 2).

## Documentation

- [PRD](./prd.md) - Product requirements, memory block comparison, architecture decisions
- [Workplan](./workplan.md) - Implementation phases, status, and remaining work
- **[Phase 0: Frontend/Backend Decoupling](./phase-0-decoupling.md)** - Recording proxy + simulated client + UI test harness; foundational QA infrastructure that blocks Phase 9
- [2026-05-08 Code Audit Findings](./2026-05-08-code-audit-findings.md) - Review of redesign implementation with duplication/refactor and cross-device drift focus
- [Implementation Summary](./implementation-summary.md) - Post-completion report

## GitHub Tracking

- **Milestone:** [Week of Feb 24-28](https://github.com/audiocontrol-org/audiocontrol/milestone/4)
- **Parent Issue:** [#53 - Roland S-550 Editor Support](https://github.com/audiocontrol-org/audiocontrol/issues/53)
- **Implementation Issues:** See [workplan.md](./workplan.md) for full list

## What's Done

| Component | Module | Status |
|-----------|--------|--------|
| Shared S-series base | `sampler-devices/src/devices/roland-s-series/` | Complete |
| S-550 device module | `sampler-devices/src/devices/s550/` | Complete |
| S-550 client + tone factory | `sampler-devices/src/devices/s550/` | Complete |
| S-550 library converters | `sampler-library/src/converters/s550/` | Complete |
| S-550 schemas | `sampler-library/src/schemas/` | Complete |
| Unified sampler editor | `sampler-editor/` (was `s330-editor/`) | Complete |
| Device config registry | `sampler-editor/src/configs/` | Complete |

## What's Remaining

| Component | Description | Blocked By |
|-----------|-------------|------------|
| **Phase 0: Frontend/Backend Decoupling** — **COMPLETE.** All 7 Task 10 waves landed; issues #404/#415/#416/#417/#421 closed 2026-05-12. | Tasks 1-9 done. Task 10 closed via Wave 6 (commits `95e97e46` + `6acbaace`: D-XX-02/03/04 front-panel DT1 emit specs + 3 S-550 fixtures) and #421 fix (commits `e0981c37` + `b19ae698`: `library-page-load` fixture replacing window.__deviceDataStore injection). **146 specs passing.** [decisions-2026-05-11.md](./decisions-2026-05-11.md) v3 carries the remaining gating item (Decision 2; working assumption = Option B). | — |
| **Phase 9 — UX/UI Cleanup REOPENED 2026-05-13.** Sub-task **9R-A.1 (Infrastructure) COMPLETE 2026-05-14** across commits `d8148929`…`42d6afaf` (8 commits + 6 reviewer-driven fixups). **Sub-task 9R-A.2 (Migrate capability specs to Tier 1) COMPLETE 2026-05-14**: 20 source files moved from `test/ui/capabilities/` to `test/wiring/` via `git mv`; legacy directory deleted; rendering smoke spec relocated to `test/rendering/` with explicit "NOT a closure gate" README; new `make test-wiring-roland` and `make test-rendering-roland` targets; `tools/check-coverage.ts` extended with a `test-wiring-roland` step. Post-migration counts (176 passed / 4 skipped) match the pre-migration baseline. The four-tier test gate is operational; `make check-coverage-roland` exits non-zero today against the 135 implemented rows still `coverage: none` — the expected starting state. First end-to-end demo: D-TONE-ENV-02 → `coverage: partial` (Tier 2 spec credible against both broken variants; Tier 3 + Tier 4 still open per workplan §9R-A.4). | Tasks 1-7 previously claimed complete 2026-05-12 are INVALIDATED. Live-hardware testing 2026-05-13 confirmed every parameter slider is non-functional ([#424](https://github.com/audiocontrol-org/audiocontrol/issues/424) — partially closed via [`406dc1e7`](https://github.com/audiocontrol-org/audiocontrol/commit/406dc1e7); remaining primitives tracked in workplan §9R-B + Phase 11 §Task 2) and PlayPage retains the legacy sticky page header ([#423](https://github.com/audiocontrol-org/audiocontrol/issues/423)). The 175-passing capability suite drives writes via `.fill()` on internal number-inputs, not via pointer/keyboard events on the visible affordances — it verifies the wiring seam, not the UI. Remediation plan supersedes the previous Tasks 4-7: **9R-A** test-strategy reset (9R-A.1 done; 9R-A.2 done; 9R-A.3 done — detailed inventory rewritten + `Test` column removed via 9R-A.3.A; parent inventory rewritten via 9R-A.3.B; 9R-A.4 next) → **9R-B** primitive remediation (`AcRangeBar` ✓ + `AcEnvelopeTable` ✓ in `406dc1e7`; `AcSlider` / `AcCheckbox` / `AcSelect` / `AcNumberInput` / `AcEnvelopeGraph` / `AcEnvelopeMeta` open) → **9R-C** page rebuild (every page operator-driven on real hardware with pointer/keyboard-event Playwright specs) → **9R-D** operator holistic hardware closure gate. Phase 9 is not closed until the operator can verbatim record *"Phase 9 closed; the redesign delivers what was asked for"* in DEVELOPMENT-NOTES.md. See [workplan.md](./workplan.md) Phase 9 section for full plan. | — |
| S-550 virtual front panel (Phase 7) | **COMPLETE 2026-05-12.** Task 1 — Design APPROVED 2026-05-12 (v2 commit `ffd003d7`). Chunky-button control surface in [`explorations/08-front-panel-s550.html`](./explorations/08-front-panel-s550.html). Task 2 — v2 mockup promoted to a real `VirtualFrontPanel` React component (commit `81ea648b`); `VideoCapture.tsx` rewired to mount the panel in place of the three ad-hoc clusters (`NavigationPad` / `ValueButtons` / `FunctionButtonRow` deleted); device-agnostic — same panel on `/roland/s330/editor` and `/roland/s550/editor`. `make test-ui-roland`: 162 passed, 4 skipped (160 baseline + 2 new artifact-generator screenshot specs). Visual verification screenshots at `explorations/09-front-panel-s330-real.png` + `explorations/09-front-panel-s550-real.png`. | Phase 0 Wave 6 fixture replay (D-XX-02/03/04) confirmed the wiring round-trip against the new layout |
| Phase 10 — Post-audit cleanup hardware verification | All Tasks Done ([#393](https://github.com/audiocontrol-org/audiocontrol/issues/393)–[#403](https://github.com/audiocontrol-org/audiocontrol/issues/403)); Tasks 7 ([#400](https://github.com/audiocontrol-org/audiocontrol/issues/400)) + 10 ([#402](https://github.com/audiocontrol-org/audiocontrol/issues/402)) pending hardware verification | Phase 0 replay closes verification debt for these tasks |
| Phase 11 — Cross-Cutting Quality Audit Items | **Task 1:** [#425](https://github.com/audiocontrol-org/audiocontrol/issues/425) ImportSamplesDialog slot-occupancy mislabel — surfaced 2026-05-14 by independent audit; canonical helpers exist but unused at three sites in the dialog. **Task 2:** [#424](https://github.com/audiocontrol-org/audiocontrol/issues/424) primitive remediation sweep — partially closed via [`406dc1e7`](https://github.com/audiocontrol-org/audiocontrol/commit/406dc1e7) (AcRangeBar + AcEnvelopeTable); remaining primitives (AcSelect / AcCheckbox / AcNumberInput / AcSlider / AcEnvelopeGraph / AcEnvelopeMeta) are 9R-B scope, surfaced here for session-resumption visibility. **Task 3:** [#426](https://github.com/audiocontrol-org/audiocontrol/issues/426) root `test/ui/*.spec.ts` test-discipline gap — surfaced 2026-05-14 (Third Follow-Up audit); 5 root smoke specs (`home` / `library` / `patches` / `play` / `tones`) use `getByTestId` + `element.click()` patterns forbidden by Tier 2/3 contracts but not gated by the test-discipline ESLint plugin's current scope (`contract/` + `in-context/` only). The 9R-A.2 grep audit only checked for `.fill(` / `.value =` / `dispatchEvent(`. Operator-choice disposition (migrate to in-context with rewrites / demote to rendering / delete + replace); see #426 for the option set. See [workplan.md](./workplan.md) §Phase 11 for full plan. | Task 1: independent (parallel with 9R-A.2). Task 2: 9R-A.1 infrastructure (DONE) — feeds into 9R-B. Task 3: independent; cleanest landing alongside 9R-A.4. |

### Phase 9 Task 2 deliverables (committed under `docs/1.0/001-IN-PROGRESS/s550-support/explorations/`)

- `01-design-language.html` — token system, typography, layout primitives, component vocabulary, CRT monitor (added in v2)
- `02-homepage.html` — landing layout with device identity hero
- `03-patches.html`, `04-tones.html`, `07-library.html` — full v3 list-detail editor pages with collapsible mockup banner, fixed-viewport flex shell, lean page header (red `--ac-color-rec` rule), 3-col grid with internal scrolls, virtual front panel under CRT, slim live-status footer
- `05-play.html`, `06-workflows.html` — landing-pattern pages (not yet at v3)
- Tones page additionally features: 5-tab detail (Wave / Pitch / Filter / Amp / LFO), 8-segment VFD-glow envelope editor with sustain/end controls, validated range-bar parameter primitive

Open questions deferred to Task 2 v4 review or Task 3 prep:

- Audiocontrol.org-aligned typography stack (Departure Mono / IBM Plex Sans / JetBrains Mono) — fonts not yet shipped; mockups show fallbacks
- BEM-promotion of drifting primitives (`.patches__icon-btn` / `.tones__refresh-btn` / `.library__icon-btn` → `.ac-icon-btn`, etc.) — bigger refactor, deferred

## Key Architecture Decisions

1. **Shared base over duplication** — `roland-s-series/` module contains all shared protocol code; device modules provide only configuration constants
2. **Unified editor over separate apps** — `sampler-editor` replaced `s330-editor`; `DeviceConfig` registry selects device-specific behavior at runtime based on URL path
3. **Configuration-driven device differences** — `SSeriesDeviceConfig` parameterizes patch count, tone count, wave bank count, and value ranges

## Memory Block Comparison

| | S-330 | S-550 |
|--|-------|-------|
| Patches | 64 (8 banks × 8) | 32 (4 banks × 8) |
| Tones | 32 (4 banks × 8) | 64 (8 banks × 8) |
| Wave banks | 2 (A, B) | 4 (A, B, C, D) |
| Tone layer range | 0-31 | 0-63 |
| Wave bank index | 0-1 | 0-3 |
| Block sizes | 512B patch / 256B tone | 512B patch / 256B tone |
| SysEx model ID | 0x1E | 0x1E |

## Quick Links

- Repository: https://github.com/audiocontrol-org/audiocontrol
- S-330 Editor: https://audiocontrol.org/roland/s330/editor
- S-550 Editor: https://audiocontrol.org/roland/s550/editor
