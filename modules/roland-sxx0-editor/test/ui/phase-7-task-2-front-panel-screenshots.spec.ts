/**
 * Phase 7 Task 2 — virtual front panel screenshot capture.
 *
 * One-shot artifact-generator spec (NOT a regression spec). Captures
 * full-page screenshots of the editor's drawer-open state on BOTH
 * `/roland/s330/editor/...` and `/roland/s550/editor/...` so the
 * operator can visually compare the rewired
 * `<VirtualFrontPanel>` against the approved v2 mockup
 * (`docs/1.0/001-IN-PROGRESS/s550-support/explorations/
 * 08-front-panel-s550.html`).
 *
 * Out of scope: functional assertions. The capability specs at
 * `test/ui/capabilities/front-panel-emit.spec.ts` (D-XX-02 / D-XX-03 /
 * D-XX-04) are the wiring gate. This spec only captures pixels.
 *
 * Output (under `docs/1.0/001-IN-PROGRESS/s550-support/explorations/`):
 *   - `09-front-panel-s330-real.png`
 *   - `09-front-panel-s550-real.png`
 */
import path from 'node:path';
import url from 'node:url';
import { test, expect, type Page } from '@playwright/test';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const OUTPUT_ROOT = path.join(
  REPO_ROOT,
  'docs',
  '1.0',
  '001-IN-PROGRESS',
  's550-support',
  'explorations',
);

type DeviceId = 's330' | 's550';

const DEVICES: readonly DeviceId[] = ['s330', 's550'] as const;

function deviceUrl(device: DeviceId): string {
  return `/roland/${device}/editor/patches?midi=simulated&scenario=load-everything`;
}

function screenshotPath(device: DeviceId): string {
  return path.join(OUTPUT_ROOT, `09-front-panel-${device}-real.png`);
}

async function setupPage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
}

test.describe('Phase 7 Task 2 — virtual front panel screenshots', () => {
  test.describe.configure({ mode: 'serial' });

  for (const device of DEVICES) {
    test(`${device}: virtual front panel in drawer`, async ({ page }) => {
      await setupPage(page);
      await page.goto(deviceUrl(device));
      await page.waitForLoadState('networkidle');

      // Wait for the front-panel buttons to mount (drawer-open is the
      // default state — `isDrawerOpen` persists open across sessions per
      // uiStore.ts:36-44 default). The MODE button's accessible name is
      // `MODE` (see VirtualFrontPanel.tsx). It mounts disabled until
      // `useFrontPanel` settles `isConnected`; we wait for the *button*
      // (not its enabled state) since this spec only captures pixels.
      const modeButton = page.getByRole('button', { name: 'MODE', exact: true });
      await expect(modeButton).toBeVisible({ timeout: 10_000 });

      // Brief settle for any post-mount layout adjustments.
      await page.waitForTimeout(250);

      await page.screenshot({
        path: screenshotPath(device),
        fullPage: true,
      });
    });
  }
});
