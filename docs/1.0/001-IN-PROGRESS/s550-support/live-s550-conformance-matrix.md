# Live S-550 Conformance Matrix

Status: in progress
Created: 2026-05-15
Related issue: [#427](https://github.com/audiocontrol-org/audiocontrol/issues/427)

## Purpose

This matrix defines the live-device Playwright conformance layer for `/roland/s550/editor`.

It complements the Phase 9 four-tier reform with two real-hardware tracks:

1. Design/mockup conformance: detect drift from approved Phase 9 mockups, `ux-audit.md`, and `DESIGN-SYSTEM.md`.
2. Capability-document conformance: detect gaps where the built UI does not satisfy `ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md` on a real connected S-550.

This suite is S-550-first. It does not widen scope into a new cross-device matrix.

## Inputs

- Mockups:
  - `explorations/03-patches.html`
  - `explorations/04-tones.html`
  - `explorations/05-play.html`
  - `explorations/07-library.html`
- Design references:
  - `ux-audit.md`
  - `DESIGN-SYSTEM.md`
- Capability references:
  - `ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md`
  - `ROLAND-S550-EDITOR-CAPABILITIES.md`
- Existing live-device helpers:
  - `modules/roland-sxx0-editor/test/e2e/helpers/connection-helper.ts`
  - `modules/roland-sxx0-editor/test/e2e/helpers/device-readback-helpers.ts`

## Runner Shape

- Test location: `modules/roland-sxx0-editor/test/e2e/` or a clearly named live-device subdirectory under it.
- Route target: `/roland/s550/editor/...`
- Current runner entry points:
  - `make test-e2e-roland-device-conformance`
  - `pnpm --filter @audiocontrol/roland-sxx0-editor test:e2e:s550-conformance`
- Prerequisites:
  - real S-550 connected
  - `midi-server` running
  - known baseline device state
  - hardware-safe fixture/setup procedure documented before broadening coverage

## Current Live Status

| Surface | Design conformance | Capability conformance | Live status | Finding / note |
|---|---|---|---|---|
| Play | `s550-play.design.spec.ts` landed and executed | not yet | fail | `LIVE-S550-PLAY-001` / sticky header intercepts Part A pointer events on live route |
| Tones | `s550-tones.design.spec.ts` landed; first live run blocked pre-app by device validation miss | `s550-D-TONE-live-envelope-and-slider.spec.ts` landed and executed | fail | `LIVE-S550-TONES-001` / loaded tone row selection is not reliably pointer-actionable on live route, blocking the bounded D-TONE battery before cutoff / sustain assertions |
| Patches | `s550-patches.design.spec.ts` landed and executed | `s550-D-PATCH-live-core.spec.ts` landed and executed | pass | fixed-shell route plus bounded D-PATCH-02 readback path passed on live hardware |
| Library | `s550-library.design.spec.ts` landed and executed | `s550-D-LIB-live-core.spec.ts` landed and executed | fail | `LIVE-S550-LIB-001` / live Save dialog emits missing dialog-description warning; `LIVE-S550-LIB-002` / live D-LIB-10 save path times out during tone-wave fetch and does not complete |

Status vocabulary:
- `pass`: live hardware run completed and matched the current conformance expectation
- `fail`: live hardware run completed and surfaced a real conformance defect
- `unrun`: spec not landed or not executed yet
- `blocked`: spec exists but could not be exercised because infra or hardware preconditions failed

## Track A: Design / Mockup Conformance

| Page | Source of truth | First live spec target | Primary assertions | Evidence |
|---|---|---|---|---|
| Patches | `explorations/03-patches.html`, `ux-audit.md` | `s550-patches.design.spec.ts` | header structure, list/detail shell, panel reachability, approved page rhythm | DOM assertions + screenshots |
| Tones | `explorations/04-tones.html`, `ux-audit.md` | `s550-tones.design.spec.ts` | 3-column shell, tabs, envelope panel presence, detail-panel layout | DOM assertions + screenshots |
| Play | `explorations/05-play.html`, `ux-audit.md` | `s550-play.design.spec.ts` | no sticky-header occlusion, Part A row reachable, drawer state does not cover controls | `elementsFromPoint` + screenshots |
| Library | `explorations/07-library.html`, `ux-audit.md` | `s550-library.design.spec.ts` | panel composition, action area, dialog launch surface, memory-map placement | DOM assertions + screenshots |

## Track B: Capability-Document Conformance

| Page | D-ID focus | First live spec target | Hardware truth source | Notes |
|---|---|---|---|---|
| Patches | patch-name + key-mode + high-risk write affordances | `D-PATCH-live-core.spec.ts` | fresh patch readback | start from existing `device-patch-controls.spec.ts` patterns |
| Tones | slider + envelope affordances on visible controls | `D-TONE-live-envelope-and-slider.spec.ts` | fresh tone readback | must include at least one envelope/slider capability |
| Play | part routing / level / output affordances | `D-PLAY-live-core.spec.ts` | fresh function-parameter readback | should explicitly cover the prior Part A failure mode |
| Library | import/export flow conformance on live route | `D-LIB-live-core.spec.ts` | fresh device reread + library state checks | keep scope bounded at first; avoid full roundtrip explosion |

## Minimum First Slice

1. `s550-play.design.spec.ts`
   - prove the PlayPage chrome no longer reproduces the `#423` occlusion shape
   - assert Part A controls are reachable by pointer
   - assert drawer open/close states do not cover operator-facing controls
   - status: landed at `modules/roland-sxx0-editor/test/e2e/s550-play.design.spec.ts`; executed on 2026-05-15 against live hardware and currently fails as `LIVE-S550-PLAY-001`

1a. `s550-patches.design.spec.ts`
   - prove the fixed Patches shell renders on the live S-550 route
   - assert title-row refresh chrome is pointer-reachable
   - assert a real loaded patch row can open the detail editor
   - status: landed as `modules/roland-sxx0-editor/test/e2e/s550-patches.design.spec.ts`; executed on 2026-05-15 against live hardware and currently passes

1b. `s550-D-PATCH-live-core.spec.ts`
   - drive one visible patch affordance on `/roland/s550/editor/patches`
   - verify by fresh device readback, then restore the original value
   - status: landed as `modules/roland-sxx0-editor/test/e2e/s550-D-PATCH-live-core.spec.ts`; executed on 2026-05-15 against live hardware and currently passes for `D-PATCH-02` (Key Mode)

2. `D-TONE-live-envelope-and-slider.spec.ts`
   - select a non-empty tone
   - drive one visible slider affordance
   - drive one visible envelope affordance
   - verify both through fresh device readback
   - status: landed as `modules/roland-sxx0-editor/test/e2e/s550-D-TONE-live-envelope-and-slider.spec.ts`; executed on 2026-05-15 against live hardware and currently blocked by `LIVE-S550-TONES-001` before the cutoff / sustain assertions can run

2a. `s550-tones.design.spec.ts`
   - verify fixed-shell Tones chrome on the live S-550 route
   - assert the title-row metric and refresh affordance remain reachable
   - assert the default list/detail composition renders before row selection
   - status: landed as `modules/roland-sxx0-editor/test/e2e/s550-tones.design.spec.ts`; first execution attempt on 2026-05-15 was blocked before app startup because device validation did not find a Roland S-series device, so no product finding was filed from that run

3. `s550-library.design.spec.ts`
   - verify real library-page structure against the approved mockup direction
   - include at least one dialog-open state
   - status: landed as `modules/roland-sxx0-editor/test/e2e/s550-library.design.spec.ts`; executed on 2026-05-15 against live hardware. Structural shell assertions passed, but the real Save-dialog path surfaced `LIVE-S550-LIB-001` (missing dialog description warning), so the Library surface remains a live `fail`

4. `s550-D-LIB-live-core.spec.ts`
   - drive `Save to Library...` on `/roland/s550/editor/library`
   - verify the named set through the real OPFS-backed library path
   - status: landed as `modules/roland-sxx0-editor/test/e2e/s550-D-LIB-live-core.spec.ts`; executed on 2026-05-15 against live hardware and currently fails as `LIVE-S550-LIB-002` after the save flow enters device scanning but times out during tone-wave fetch (`RQD response timeout - no data received`)

## Explicit Non-Goals

- This matrix does not replace 9R-C per-page operator sign-off.
- This matrix does not replace 9R-D holistic operator closure.
- This matrix does not attempt to automate every capability row immediately.
- This matrix does not define a new S-330/S-550 parity suite.

## Open Decisions

1. Whether these specs should stay directly under `test/e2e/` or move into a dedicated subfolder if the suite grows materially.
2. Which exact D-IDs form the first bounded live capability battery per page.
