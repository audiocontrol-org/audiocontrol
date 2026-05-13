/**
 * Page viewport containment — regression coverage for the bug found in
 * Phase 9 Task 4 polish (DEVELOPMENT-NOTES 2026-05-13).
 *
 * Symptom: `.ac-page-shell` and per-page `.<page>__app-shell` grids
 * had no height-containment, so each list-detail page grew to its
 * content's natural height (~2x the viewport) and the document
 * scrolled as one tall page. The list pane never scrolled internally
 * — selecting a tone at the bottom of the list scrolled the page
 * header out of view.
 *
 * Fix: `.ac-page-shell--fixed-viewport` modifier in
 * `editor-core/src/design/layout-primitives.css` clips the shell to
 * `100dvh - site-header - main-padding`; per-page `__app-shell`
 * declares `flex: 1; min-height: 0; overflow: hidden`; list / detail
 * columns inside declare `min-height: 0; height: 100%; overflow:
 * hidden` so the inner `.ac-list-scroll` and `.<page>__detail-body`
 * scroll independently. See DESIGN-SYSTEM.md § "Page Shell Pattern".
 *
 * What this spec asserts: at viewport 1280x800, the document is no
 * taller than the viewport (plus a 4px slack for sub-pixel rounding).
 * If a future change re-introduces the regression — by removing the
 * modifier class, by dropping a `min-height: 0` rule, or by adding a
 * fixed-height descendant inside the bounded grid — this spec turns
 * red.
 *
 * The s550 routes use the same React tree as s330; spec coverage on
 * s330 is sufficient.
 */
import { test, expect } from '@playwright/test';

interface Scenario {
  readonly name: string;
  readonly url: string;
  /**
   * Selector / role assertion that confirms the page's body has
   * rendered (and therefore would be a candidate for overflowing if
   * the regression were live). We wait on a stable positive signal
   * before measuring height.
   */
  readonly readyAssertion: (page: import('@playwright/test').Page) => Promise<void>;
  /**
   * Known-divergence regex to suppress when listening for page
   * errors. PatchesPage and LibraryPage are run against
   * `load-everything` which mismatches their actual startup
   * SysEx — same suppression patches.spec.ts applies.
   */
  readonly suppressError?: (text: string) => boolean;
}

const VIEWPORT = { width: 1280, height: 800 } as const;

// Sub-pixel rounding slack — descendants whose height is a fractional
// rem can round up by 1px each, and a CSS layout that's exactly the
// viewport height can read back as +1 or +2px depending on devicePixelRatio.
// Four pixels is a generous bound that still catches the ~2x-viewport
// regression while tolerating rounding.
const HEIGHT_SLACK_PX = 4;

const KNOWN_PATCHES_TONE_LOAD_DIVERGENCE =
  /SimulatedAdapterUnexpectedSendError[\s\S]*at sequence \d+[\s\S]*first diff at byte 6: expected 0x00, got 0x03/;
const KNOWN_S330_TONE_LOAD_ERROR = /\[S330Client\] Error loading tone \d+/;

function isKnownPatchesPreloadDiagnostic(text: string): boolean {
  return (
    KNOWN_PATCHES_TONE_LOAD_DIVERGENCE.test(text) ||
    KNOWN_S330_TONE_LOAD_ERROR.test(text)
  );
}

const SCENARIOS: ReadonlyArray<Scenario> = [
  {
    name: 'patches',
    url: '/roland/s330/editor/patches?midi=simulated&scenario=load-everything',
    readyAssertion: async (page) => {
      await expect(page.getByRole('heading', { name: 'Patches' })).toBeVisible();
      await expect(page.getByTestId('patch-item-0')).toBeVisible({ timeout: 5_000 });
    },
    suppressError: isKnownPatchesPreloadDiagnostic,
  },
  {
    name: 'tones',
    url: '/roland/s330/editor/tones?midi=simulated&scenario=tones-bank-0',
    readyAssertion: async (page) => {
      await expect(page.getByRole('heading', { name: 'Tones' })).toBeVisible();
      await expect(page.getByTestId('tone-item-0')).toBeVisible({ timeout: 5_000 });
    },
  },
  {
    name: 'library',
    url: '/roland/s330/editor/library?midi=simulated&scenario=load-everything',
    readyAssertion: async (page) => {
      await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
      // Save / Load buttons confirm the header rendered through; the
      // tree browser fills the remainder.
      await expect(page.getByTestId('save-set-button')).toBeVisible({ timeout: 5_000 });
    },
  },
  {
    name: 'play',
    url: '/roland/s330/editor/play?midi=simulated&scenario=play-init',
    readyAssertion: async (page) => {
      await expect(page.getByRole('heading', { name: 'Play' })).toBeVisible();
      // Part-0 controls settle after the fixture replays the bank load
      // + functionParameters request; their presence is the positive
      // signal that the page is fully rendered.
      await expect(page.getByTestId('part-0-channel')).toBeVisible({ timeout: 5_000 });
    },
  },
];

test.describe('Page viewport containment — list-detail pages must not overflow the viewport', () => {
  for (const scenario of SCENARIOS) {
    test(`${scenario.name} fits within the viewport at 1280x800`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => {
        if (scenario.suppressError?.(err.message)) return;
        pageErrors.push(err.message);
      });
      page.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        const text = msg.text();
        if (scenario.suppressError?.(text)) return;
        pageErrors.push(text);
      });

      await page.addInitScript(() => {
        window.localStorage.clear();
      });
      await page.setViewportSize(VIEWPORT);
      await page.goto(scenario.url);
      await page.waitForLoadState('networkidle');
      await scenario.readyAssertion(page);

      const overflow = await page.evaluate(() => ({
        docHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
      }));

      expect(
        overflow.docHeight,
        `${scenario.url} document scrollHeight (${overflow.docHeight}px) should fit within viewport (${overflow.viewportHeight}px). ` +
        `If this fails the page is back to scrolling as one tall document — see DEVELOPMENT-NOTES 2026-05-13.`,
      ).toBeLessThanOrEqual(overflow.viewportHeight + HEIGHT_SLACK_PX);

      // No harness or layout-side console errors leaked from this
      // scenario (suppressing only the known PatchesPage divergence).
      expect(
        pageErrors,
        `${scenario.url} should not produce unexpected page errors`,
      ).toEqual([]);
    });
  }
});
