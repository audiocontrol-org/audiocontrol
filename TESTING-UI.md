# Targeted UI Testing

> Part of the [Testing Architecture](TESTING.md). See also: [Unit Testing](TESTING-UNIT.md) | [E2E Testing](TESTING-E2E.md)

How to develop and test UI components without hardware or a full app environment.

## Directory Structure

UI test specs live in the standard test directory:

| What | Where |
|------|-------|
| Test harness pages | `src/pages/Test<Feature>Page.tsx` |
| UI test specs | `test/ui/<feature>.spec.ts` |
| Playwright config | `playwright.test-harness.config.ts` |
| Make target | `test-ui-<editor>` (e.g., `test-ui-s3k`) |

## The Pattern

Editors in this monorepo require MIDI hardware to show real data. For developing visual components (draggable zones, coordinate alignment, layout), we use **test harness pages** -- standalone routes that render components with hardcoded data and local state. No store, no device connection, no transport layer.

The workflow:

1. Create a test harness page with hardcoded/factory data and `useState` for interactions
2. Register it as a route in the editor's router
3. Start the Vite dev server (`pnpm dev`)
4. Take screenshots with the Playwright CLI to verify rendering
5. Edit code, HMR updates the page, screenshot again

This gives a tight visual feedback loop without needing hardware connected.

## File Conventions

| What | Where |
|------|-------|
| Test harness pages | `src/pages/Test<Feature>Page.tsx` |
| Test data factories | `src/test-helpers/<thing>-factory.ts` |
| Route registration | Editor's `App.tsx` router |
| Route path pattern | `/<editor-base>/test/<feature>` |

Test harness pages import **real components** but provide data through factory helpers (e.g., `makeKeygroupHeader`). They use local `useState` so drag, click, and selection interactions work without a global store.

## Dev Server Ports

| Editor | Port |
|--------|------|
| akai-s3k-editor | 3300 |

Check each editor's `vite.config.ts` for its port. All dev servers use HTTPS via mkcert.

## Taking Screenshots

Each editor module has Playwright installed as a devDependency. Use the CLI directly:

```bash
modules/<editor>/node_modules/.bin/playwright screenshot \
  --ignore-https-errors --full-page \
  "https://localhost:<port>/<test-route>" \
  /tmp/<descriptive-name>.png
```

Screenshots go to `/tmp/` for quick inspection. The `--ignore-https-errors` flag is required because the dev server uses a self-signed mkcert certificate.

## Example: Keygroup Zone Harness

The first test harness validates alignment between ZoneOverview (full keyboard), per-keygroup KeyRangeEditor, and VelocityRangeBar components.

- **Page:** `modules/akai-s3k-editor/src/pages/TestKeygroupsPage.tsx`
- **Route:** `/akai/s3000xl/editor/test/keygroups`
- **Factory:** `modules/akai-s3k-editor/src/test-helpers/keygroup-factory.ts`
- **Data:** 4 hardcoded keygroups with overlapping ranges and 1-3 velocity zones each

```bash
# Start the dev server
cd modules/akai-s3k-editor && pnpm dev

# In another terminal, take a screenshot
modules/akai-s3k-editor/node_modules/.bin/playwright screenshot \
  --ignore-https-errors --full-page \
  "https://localhost:3300/akai/s3000xl/editor/test/keygroups" \
  /tmp/keygroups-test.png
```

## Writing a New Test Harness

1. Create `src/test-helpers/<thing>-factory.ts` with a `make<Thing>` function that returns realistic data with sensible defaults and override support
2. Create `src/pages/Test<Feature>Page.tsx` that imports real components, calls the factory, and wires interactions through `useState`/`useCallback`
3. Add a `<Route>` in `App.tsx` under the `test/` path prefix
4. Verify with a screenshot

Keep harness pages simple. Their only job is to render components with known data so you can see whether the visual output is correct.

## Writing Reusable Test Specs

Ad-hoc screenshots are for quick checks during development. **Every interaction you verify manually must become a Playwright test spec.** If you verified it by screenshotting, it should be a test case. Screenshots without corresponding specs are throwaway work that cannot be re-run.

Test specs live in the standard test directory:

| What | Where |
|------|-------|
| Test specs | `test/ui/<feature>.spec.ts` |
| Playwright config | `playwright.test-harness.config.ts` (matches `test/ui/*.spec.ts`) |
| Make target | `test-ui-<editor>` (e.g., `test-ui-s3k`) |

### What to test

- **Rendering correctness**: components appear with expected content, labels, positions
- **Drag interactions**: mousedown -> mousemove -> mouseup sequences produce expected state changes
- **Zoom controls**: buttons change the visible range, scroll-wheel zooms
- **Selection**: clicking zones updates selection state in both overview and detail editors
- **Zone creation**: drag-to-create produces a new zone

### When to write specs

Write specs **as you build**, not after. Each phase of implementation should produce both the feature code and the test spec that exercises it. The test harness enables this -- there is no excuse to defer.

### Example spec structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('ZoneOverview drag interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/akai/s3000xl/editor/test/keygroups');
    await page.waitForLoadState('networkidle');
  });

  test('zoom fit narrows range to keygroup data', async ({ page }) => {
    await page.click('button:text("Fit")');
    // Assert range label changed from 0-127
  });

  test('dragging zone edge updates note range', async ({ page }) => {
    // Find zone, drag its right edge, assert HINOTE changed
  });
});
```
