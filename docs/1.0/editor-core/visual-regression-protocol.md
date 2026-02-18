# Editor-Core Visual Regression Protocol

**Status:** Active  
**Last Updated:** 2026-02-17

## Purpose

Provide a repeatable manual screenshot workflow to close Phase 7 visual consistency validation across S-330, D-110, and JV-1080.

## Capture Setup

- Browser: Chrome (or Chromium-based)
- Zoom: 100%
- Viewport: `1366x768`
- Capture type: full window screenshot
- Runtime mode: use deterministic mock transport
  - append `?midi=mock` to each editor URL
  - S-330 additionally seeds deterministic page data for `Play/Patches/Tones` in mock mode
- Editor state:
  - `Disconnected` state captures for connection pages
  - `Connected` state captures for editor pages where applicable
- Naming convention:
  - `before-<editor>-<page>.png`
  - `after-<editor>-<page>.png`

## Shared Harness

- Shared helpers live in `modules/editor-core/src/testing/`.
- Route/query helper: `modules/editor-core/src/testing/visualRegression.ts`
- Playwright capture helper: `modules/editor-core/src/testing/playwrightHarness.ts`
- Per-editor fixtures:
  - `modules/s330-editor/src/testing/visualFixtures.ts`
  - `modules/d110-editor/src/testing/visualFixtures.ts`
  - `modules/jv1080-editor/src/testing/visualFixtures.ts`

All fixture routes are generated with `buildVisualRoute(...)` so `?midi=mock` is consistently applied.

## Execution Commands

- Capture all editors:
  - `pnpm visual:capture`
- Compare against baseline (all editors):
  - `pnpm visual:compare`
- Capture then compare:
  - `pnpm visual:check`
- Promote current captures to baseline:
  - `pnpm visual:baseline:update`

Per-editor commands are also available:

- `pnpm --filter @audiocontrol/s330-editor visual:capture`
- `pnpm --filter @audiocontrol/d110-editor visual:capture`
- `pnpm --filter @audiocontrol/jv1080-editor visual:capture`

## Route Matrix

1. S-330
- Connect: `/roland/s330/editor/?midi=mock`
- Play: `/roland/s330/editor/play?midi=mock`
- Patches: `/roland/s330/editor/patches?midi=mock`
- Tones: `/roland/s330/editor/tones?midi=mock`

2. D-110
- Connect: `/roland/d110/editor/?midi=mock`
- Tones: `/roland/d110/editor/tones?midi=mock`
- Patches: `/roland/d110/editor/patches?midi=mock`

3. JV-1080
- Connect: `/roland/jv1080/editor/?midi=mock`
- Editor: `/roland/jv1080/editor/editor?midi=mock`

## Per-Screenshot Checks

- Top spacing and header rhythm:
  - page starts with consistent top offset under header/navigation
- Container behavior:
  - constrained/expanded layouts match page intent and do not drift between similar pages
- Card/surface consistency:
  - panel backgrounds, border contrast, and rounding follow shared primitives
- Control consistency:
  - button sizes, spacing, and selected/disabled states align with shared classes
- Status/error semantics:
  - connected/warn/danger visual treatments map to semantic token intent
- Scroll contracts:
  - list-detail pages (`Patches`, `Tones`) keep sticky header/list behavior without overlap/clipping

## Validation Table

| Editor | Page | Before | After | Pass | Notes |
|-------|------|--------|-------|------|------|
| S-330 | Connect | ☐ | ☐ | ☐ | |
| S-330 | Play | ☐ | ☐ | ☐ | |
| S-330 | Patches | ☐ | ☐ | ☐ | |
| S-330 | Tones | ☐ | ☐ | ☐ | |
| D-110 | Connect | ☐ | ☐ | ☐ | |
| D-110 | Tones | ☐ | ☐ | ☐ | |
| D-110 | Patches | ☐ | ☐ | ☐ | |
| JV-1080 | Connect | ☐ | ☐ | ☐ | |
| JV-1080 | Editor | ☐ | ☐ | ☐ | |

## Exit Criteria

- All matrix rows captured and reviewed.
- All rows marked `Pass` or tracked with follow-up issue.
- `docs/1.0/editor-core/implementation-summary.md` visual checklist updated to reflect outcome.

## Baseline Compare Contract

- Baseline directory: `modules/<editor>/artifacts/visual/baseline`
- Current capture directory: `modules/<editor>/test-results/visual/current` (git-ignored)
- Compare script: exact PNG hash + file set parity.
  - Missing current image for an existing baseline: fail
  - Extra current image without a baseline peer: fail
  - Same filename but different image hash: fail
