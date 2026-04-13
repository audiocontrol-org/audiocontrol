# Testing UI Features with Codex Harnesses

This document describes the browser-only UI testing methodology for Codex feature work in this repo.

The goal is a fast local loop:

1. build a feature in isolation
2. run it in a real browser
3. automate only that feature slice
4. debug
5. rerun immediately

without requiring a fully provisioned hardware environment.

## Why this exists

The main e2e infrastructure in this repo is intentionally real-system oriented:

- real browser
- real storage backends
- real MIDI transports
- real hardware when the feature requires it

That is correct for end-to-end validation, but it is too heavy for tight iteration on in-progress UI features.

For UI-heavy feature work, we also need a browser harness that:

- renders the real app code, not a toy reproduction
- avoids device loaders and hardware dependencies
- seeds realistic local fixture state
- can be driven by Playwright
- fits into the repo's existing test infrastructure

## Current pattern

The current Codex harness pattern is:

1. Add a dedicated in-app harness route for the feature.
2. Seed realistic local fixture state in that route.
3. Use the real feature components on the page.
4. Keep editing local to in-memory component/page state.
5. Drive the route through the existing browser-only Playwright path.

This gives us browser UI testing of isolated features without requiring:

- a sampler
- HTTP MIDI
- SCSI bridge
- OPFS setup unless the feature actually needs it

## Current example: Draggable Zones

The first concrete example is the draggable-zones harness in `modules/akai-s3k-editor`.

Relevant files:

- [DraggableZonesHarnessPage.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-codex-draggable-zones/modules/akai-s3k-editor/src/pages/harness/DraggableZonesHarnessPage.tsx:1)
- [draggable-zone-fixtures.ts](/Users/orion/work/audiocontrol-work/audiocontrol-codex-draggable-zones/modules/akai-s3k-editor/src/pages/harness/draggable-zone-fixtures.ts:1)
- [App.tsx](/Users/orion/work/audiocontrol-work/audiocontrol-codex-draggable-zones/modules/akai-s3k-editor/src/App.tsx:1)
- [library-draggable-zones-harness.spec.ts](/Users/orion/work/audiocontrol-work/audiocontrol-codex-draggable-zones/modules/akai-s3k-editor/e2e/library-draggable-zones-harness.spec.ts:1)

Route:

```text
/akai/s3000xl/editor/harness/draggable-zones?midi=mock&fixture=stacked-layers
```

What it does:

- uses the real Akai keygroup UI components
- seeds local keygroup fixtures
- supports fixture switching by query param and select menu
- supports local editing without device loaders
- exposes harness state on `window.__draggableZonesHarness` for debugging if needed

## What this harness is for

Use a browser harness when all of the following are true:

- the feature is primarily UI behavior
- the feature can be exercised against seeded local state
- hardware round-trip correctness is not the immediate question
- you need a fast develop -> test -> debug loop

Good candidates:

- drag interactions
- selection behavior
- layout and alignment
- visual state transitions
- fixture-driven workflows
- cross-component synchronization inside one editor surface

## What this harness is not for

Do not confuse this with full e2e or hardware verification.

A browser harness does not prove:

- MIDI communication correctness
- SysEx write/read round trips
- bridge behavior
- hardware timing behavior
- OPFS or library integration, unless explicitly included

Those still belong in the normal repo e2e infrastructure.

## How to build a new harness

### 1. Add a dedicated route

Add a route under the real app, not a separate standalone mini-app.

Example pattern:

```tsx
<Route
  path="/akai/s3000xl/editor/harness/my-feature"
  element={<MyFeatureHarnessPage />}
/>
```

Why:

- it uses the real application shell
- routing is stable
- Playwright can target it directly
- future contributors can discover it inside the app

### 2. Seed realistic fixture state

Create fixtures that look like real editor data, not reduced fake shapes.

For Akai keygroup features, use real-ish `KeygroupHeader` fixtures and sample names.

Keep fixtures:

- explicit
- small
- scenario-shaped
- named by behavior, not by implementation

Examples:

- `stacked-layers`
- `dense-splits`
- `edge-overlap`
- `single-zone`

### 3. Render the real feature components

The harness should render the production components directly.

Do not create separate "test versions" of the UI.

The harness may own local state, but the actual visual/editor surface should be the real one.

### 4. Keep editing local

For isolated UI work, local in-memory state is preferred.

That means:

- no hardware client
- no loader hooks
- no bridge dependencies
- no fake backend server unless the feature truly needs one

This is deliberate. The purpose is isolating the UI behavior under development.

### 5. Add a focused Playwright spec

Add a browser-only spec that exercises only the harness route.

The test should verify:

- the route loads
- fixture selection works
- the local feature state can be exercised

Keep it narrow. This is not the place to re-test the whole editor.

## How to run a harness test

Use the existing repo e2e wrapper, not raw Playwright commands.

For the current draggable-zones harness:

```bash
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-s3k-library 'ARGS=--grep "Draggable Zones Harness"'
```

Why this path:

- it uses the repo's existing browser test runner
- it captures logs
- it uses the watchdog/heartbeat flow
- it is already consistent with project testing rules

## What was verified for the draggable-zones harness

The current harness has already been verified with:

- repo build for `modules/akai-s3k-editor`
- isolated Playwright run through `test-e2e-s3k-library`

The current browser harness spec verifies:

- the harness route loads without hardware dependencies
- fixture switching re-seeds the local UI state
- local editing works without device loaders

## Relationship to the feature lifecycle

This harness methodology is best used in the middle of feature development.

Recommended order:

1. build the isolated harness first or early
2. implement the feature against the harness
3. automate the isolated browser behavior
4. iterate until the UI behavior is stable
5. only then move to broader integration or hardware validation

That order keeps the feedback loop tight and avoids pushing every UI experiment through the full environment stack.

## Limits and rules

- Prefer browser-only harnesses for UI behavior, not backend simulation.
- Keep the harness route discoverable and named for the feature.
- Use query params for fixture selection when that improves automation.
- Seed realistic fixture state, not minimal nonsense objects.
- Do not claim harness coverage equals end-to-end coverage.
- When a feature crosses into real transport or hardware behavior, move back to the standard e2e path.

## Next obvious extension

The current pattern should be generalized into additional feature harness routes for:

- drag-heavy editors
- visual mappers
- dialog workflows with complex local state
- layout/selection regressions

The important idea is not "one-off draggable-zones test page".

The important idea is:

`feature harness routes are now an accepted testing tool for isolated browser UI work in this repo.`
