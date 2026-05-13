# Roland S-550 Editor Support

**Status:** In Progress. Phases 1-6, 8, 10 Complete. **Phase 0 Task 10 COMPLETE** — all 7 waves landed; issues #404/#415/#416/#417/#421 closed 2026-05-12. **Phase 9 Tasks 1-7 COMPLETE 2026-05-12** — Task 4.0 atomic primitives, Task 4 amends for all 6 pages (PatchesPage / TonesPage / PlayPage / LibraryPage / WorkflowsPage / HomePage), Task 5 dialog polish across 11 library dialogs, **Task 6 visual screenshot verification** (22 captures × 2 devices in `phase-9-task-6-screenshots/`), **Task 7 DESIGN-SYSTEM.md codification** (v3 typography + layout-rhythm + component-vocabulary sections; `--ac-font-mono` consolidated into `tokens.css` with JetBrains Mono first; `--ac-font-sans` deleted to make the "Inter forbidden" rule true in code). `make test-ui-roland`: 160 specs passing (146 baseline + 14 new screenshot captures; 4 skipped per documented fixture gaps). [decisions-2026-05-11.md](./decisions-2026-05-11.md) v3 — 5 of 6 decisions settled (Decision 2 remains; working assumption = Option B). See [`.claude/rules/agent-discipline.md`](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/.claude/rules/agent-discipline.md) for the workplan-discipline rules (4th rule canonized this session — "When CI is absent, the controller is the gate").
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
| **Phase 9 Tasks 4–5 — UX/UI page + dialog polish COMPLETE 2026-05-12.** | Task 4.0 atomic primitives (commits `2c078954` + `fc3bac98`): 6 v3 primitives (`.ac-select`, `.ac-checkbox`, `.ac-slider`, `.ac-range-bar`, `.ac-number-input`, `.ac-envelope`) + CSS file split + a11y fix-up. Task 4 amends: PatchesPage (`7299ca6a` + `33e7e6b8`), TonesPage (`098b7a21` + `8eac821a` + `4952d643`), PlayPage (`2e857bc6` + `bd49dc60`), LibraryPage (`7827bbfc`), WorkflowsPage + HomePage (no changes needed). Task 5 dialog polish (`8e179806` + `418bac65`): 11 library dialogs migrated; SaveSetDialog regression fix re-emits real OperationProgress from data source. `.ac-input--warning` modifier added. Suite held at 146 passing through 13 commits. | — |
| **Phase 9 Task 6 — UI-layer screenshot verification COMPLETE 2026-05-12.** | 22 captures × 2 devices in `phase-9-task-6-screenshots/` covering Home / Patches / Tones (5 tabs) / Play / Library / SaveSetDialog / LoadSetDialog. 6 skipped captures documented: WorkflowsPage (not routed in App.tsx — consistent with v3-not-yet workplan §54-55); ExportToneDialog (fixture `hasSampleData` false); 10 other library dialogs share chrome with captured SaveSet/Load. `make test-ui-roland`: 160 passed, 4 skipped (no regressions). | — |
| **Phase 9 Task 7 — DESIGN-SYSTEM.md codification COMPLETE 2026-05-12.** | v3 conventions codified: typography (Departure Mono / IBM Plex Sans / JetBrains Mono + "Inter forbidden" rule), layout rhythm (fixed-viewport page shell, lean page header, live-status footer, tabbed detail pane), component vocabulary (virtual front panel under CRT, rec-LED red sparingly, color palette preservation, `.ac-list-*` family). Token consolidation: moved `--ac-font-mono` from `layout-primitives.css` to `tokens.css` with JetBrains Mono first; deleted `--ac-font-sans` (contained the forbidden `Inter`) and migrated 7 usages to `--ac-font-body`. Gate A + Gate B audit tables in commit body. `make test-ui-roland` 160 passed / 4 skipped (no regressions). | — |
| S-550 virtual front panel (Phase 7) | **COMPLETE 2026-05-12.** Task 1 — Design APPROVED 2026-05-12 (v2 commit `ffd003d7`). Chunky-button control surface in [`explorations/08-front-panel-s550.html`](./explorations/08-front-panel-s550.html). Task 2 — v2 mockup promoted to a real `VirtualFrontPanel` React component (commit `81ea648b`); `VideoCapture.tsx` rewired to mount the panel in place of the three ad-hoc clusters (`NavigationPad` / `ValueButtons` / `FunctionButtonRow` deleted); device-agnostic — same panel on `/roland/s330/editor` and `/roland/s550/editor`. `make test-ui-roland`: 162 passed, 4 skipped (160 baseline + 2 new artifact-generator screenshot specs). Visual verification screenshots at `explorations/09-front-panel-s330-real.png` + `explorations/09-front-panel-s550-real.png`. | Phase 0 Wave 6 fixture replay (D-XX-02/03/04) confirmed the wiring round-trip against the new layout |
| Phase 10 — Post-audit cleanup hardware verification | All Tasks Done ([#393](https://github.com/audiocontrol-org/audiocontrol/issues/393)–[#403](https://github.com/audiocontrol-org/audiocontrol/issues/403)); Tasks 7 ([#400](https://github.com/audiocontrol-org/audiocontrol/issues/400)) + 10 ([#402](https://github.com/audiocontrol-org/audiocontrol/issues/402)) pending hardware verification | Phase 0 replay closes verification debt for these tasks |

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
