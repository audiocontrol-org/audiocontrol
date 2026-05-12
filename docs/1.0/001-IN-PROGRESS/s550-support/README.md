# Roland S-550 Editor Support

**Status:** In Progress. Phases 1-6, 8, 10 Complete; Phase 9 Tasks 1-3 Complete. **Phase 0 Task 10 IN PROGRESS** — Waves 1, 2a, 2b, 2c, 3 complete (issues #411–#414 closed 2026-05-12); Wave 4 partial close-out and Wave 5 unblocked 2026-05-12 by Decision 3 confirmation; Wave 6 partial close-out blocked on S-550 front-panel fixture capture. `make test-ui-roland`: 132 specs passing (up from 31). [decisions-2026-05-11.md](./decisions-2026-05-11.md) v3 — 5 of 6 decisions settled (Decision 2 remains; working assumption = Option B). **Phase 9 Task 4 BLOCKED** until Phase 0 Task 10 fully closes. The PatchesPage + TonesPage redesign commits (`4bd11911`, `f633b95f`) shipped polished shells with vanilla browser atomic controls — those commits are at most "shell partial," not "page complete," and the pages must be amended to consume design-language atomic primitives before counting as Phase 9 Task 4 done. See [`.claude/rules/agent-discipline.md`](/Users/orion/work/audiocontrol-work/audiocontrol-s550-support/.claude/rules/agent-discipline.md) for the workplan-discipline rules.
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
| **Phase 0: Frontend/Backend Decoupling** — **Task 10 IN PROGRESS.** | Tasks 1-9 done. Task 10 Waves 1/2a/2b/2c/3 complete (issues #411–#414 closed 2026-05-12; 132 specs passing). Wave 4 partial (8 of 15 capabilities bound; close-out unblocked 2026-05-12 by Decision 3 confirmation — fixture-copy seeding accepted). Wave 5 (4 DnD specs) sequenced after Wave 4 close-out per Decision 4 = Option A. Wave 6 partial (3 specs landed; remaining 3 D-XX-02/03/04 DT1-emit tests blocked on S-550 front-panel fixture capture). [decisions-2026-05-11.md](./decisions-2026-05-11.md) v3 carries the remaining gating item (Decision 2; working assumption = Option B). | Blocks Phase 9 Task 4 (and therefore the redesign). |
| Phase 9 Tasks 4–7 — UX/UI cleanup | Per-page real-component refactor (absorbing audit findings 4 + 5), dialog polish, UI-layer test harness + screenshot verification (audit finding 3), design-system update | **Phase 0** + operator review of v3 mockups |
| S-550 virtual front panel (Phase 7) | Rack-mount panel layout variant | Phase 0 fixture replay closes the hardware-QA gap (button → device round-trip captured once) |
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
