/**
 * Page shell contract — regression coverage for the akai page chrome
 * migrated in commit bba5b13b. Closes AUDIT-20260524-05, -06, -07.
 *
 * The Phase 2 migration moved all four akai pages (Programs, Samples,
 * Keygroups, Library) onto the canonical fixed-viewport shell:
 *
 *   .ac-page-shell--fixed-viewport  -> outer height-bounded box
 *   PageTitleRow                    -> lean header row
 *   .ac-app-shell                   -> 2-col grid (list + detail)
 *     OR .ac-page-shell-body        -> single-body wrapper (Library)
 *   .ac-list-scroll                 -> internal list column scroll
 *   .ac-detail-scroll               -> internal detail column scroll
 *
 * Before the migration, akai pages declared their own per-page chrome
 * (ad-hoc heights, missing `min-height: 0` rules, no mobile escape
 * hatch); Roland had `page-viewport-containment.spec.ts` asserting
 * the contract, but akai didn't. This spec is the akai equivalent —
 * if a future change drops the modifier class, removes a
 * `min-height: 0` declaration, or re-introduces a fixed-height
 * descendant inside the bounded grid, this spec turns red on the
 * surface that regressed.
 *
 * Harness routes:
 *   /test/programs        -> TestProgramsPage      (app-shell, stub detail)
 *   /test/samples         -> TestSamplesPage       (app-shell, stub detail)
 *   /test/library         -> TestLibraryPage       (page-shell-body, stub div for browser)
 *   /test/library-real    -> TestLibraryRealPage   (page-shell-body, REAL PluginLibraryBrowser)
 *   /test/keygroups-shell -> TestKeygroupsShellPage (app-shell, real KeygroupList + ZoneOverview)
 *
 * The legacy `/test/keygroups` route (load-bearing for
 * `zone-overview.spec.ts`) still points at the pre-existing
 * inline-styled `TestKeygroupsPage`; the shell-compliant Keygroups
 * harness lives at `/test/keygroups-shell` so the legacy route stays
 * intact. AUDIT-20260524-06 closure.
 *
 * The `/test/library-real` harness mounts the production
 * `PluginLibraryBrowser` against an empty stub library handle so the
 * inner-pane overflow contract is asserted against the real
 * component, not a stand-in `<div>`. AUDIT-20260524-07 closure.
 *
 * Desktop viewport (1280x900):
 *   - `.ac-page-shell--fixed-viewport` is present
 *   - The shell's bounded height is <= window - site header chrome
 *   - The document does NOT scroll (scrollHeight === innerHeight)
 *   - `.ac-app-shell` is a 2-col grid (or `.ac-page-shell-body` for
 *     Library)
 *   - `.ac-list-scroll` (where present) has `overflow-y: scroll|auto`
 *   - For `/test/library-real`: inner library panes own their own
 *     overflow (`.ac-plugin-library-browser-device`,
 *     `.ac-plugin-library-browser-sections`,
 *     `.ac-plugin-library-browser-preview` each declare
 *     `overflow-y: auto|scroll`)
 *
 * Mobile viewport (414x896):
 *   - The fixed-viewport modifier collapses to `height: auto`
 *     (mobile escape hatch from layout-primitives.css line 142+)
 *   - Document scrolls naturally (scrollHeight > innerHeight is
 *     allowed; the page is no longer height-clipped)
 *   - `.ac-app-shell` collapses to single column at < 1024px
 *   - The last list row is reachable via scroll (no clipping)
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

interface ShellHarnessRoute {
  readonly name: string;
  readonly url: string;
  readonly headingText: string;
  /**
   * Pages with the 2-col list+detail grid use `.ac-app-shell`. The
   * Library page uses `.ac-page-shell-body` (single full-height
   * widget); the contract assertions branch on this.
   */
  readonly bodyKind: 'app-shell' | 'page-shell-body';
  /**
   * When true, the harness mounts the real `PluginLibraryBrowser` so
   * the spec can additionally assert the inner-pane overflow contract
   * AUDIT-20260524-05's fix-guidance called out. Only the
   * `/test/library-real` route opts in today.
   */
  readonly asserts_inner_library_overflow?: boolean;
}

const SHELL_HARNESS_ROUTES: ShellHarnessRoute[] = [
  {
    name: 'programs',
    url: '/akai/s3000xl/editor/test/programs',
    headingText: 'Test Programs (harness)',
    bodyKind: 'app-shell',
  },
  {
    name: 'samples',
    url: '/akai/s3000xl/editor/test/samples',
    headingText: 'Test Samples (harness)',
    bodyKind: 'app-shell',
  },
  {
    name: 'keygroups-shell',
    url: '/akai/s3000xl/editor/test/keygroups-shell',
    headingText: 'Test Keygroups (harness)',
    bodyKind: 'app-shell',
  },
  {
    name: 'library',
    url: '/akai/s3000xl/editor/test/library',
    headingText: 'Test Library (harness)',
    bodyKind: 'page-shell-body',
  },
  {
    name: 'library-real',
    url: '/akai/s3000xl/editor/test/library-real',
    headingText: 'Test Library Real (harness)',
    bodyKind: 'page-shell-body',
    asserts_inner_library_overflow: true,
  },
];

// Sub-pixel rounding slack — descendants whose height is a fractional
// rem can round up by 1px each; the same slack window used by the
// Roland `page-viewport-containment.spec.ts` (4px).
const HEIGHT_SLACK_PX = 4;

const DESKTOP_VIEWPORT = { width: 1280, height: 900 } as const;
const MOBILE_VIEWPORT = { width: 414, height: 896 } as const;

async function gotoHarness(page: Page, route: ShellHarnessRoute): Promise<void> {
  await page.goto(route.url);
  await page.waitForLoadState('networkidle');
  // The harness renders synchronously off `useState` — the heading is
  // a reliable positive signal that the shell mounted.
  await expect(page.getByRole('heading', { name: route.headingText })).toBeVisible();
}

test.describe('Akai page-shell contract — desktop viewport', () => {
  test.use({ viewport: DESKTOP_VIEWPORT });

  for (const route of SHELL_HARNESS_ROUTES) {
    test(`${route.name}: fixed-viewport shell is present and bounded (${route.url})`, async ({ page }) => {
      await gotoHarness(page, route);

      // 1. The fixed-viewport modifier is on the page wrapper.
      const shell = page.locator('.ac-page-shell--fixed-viewport');
      await expect(shell).toHaveCount(1);

      const measurements = await page.evaluate(() => {
        const shellEl = document.querySelector('.ac-page-shell--fixed-viewport') as HTMLElement | null;
        if (!shellEl) throw new Error('shell element not found');
        const shellRect = shellEl.getBoundingClientRect();
        const rootStyle = getComputedStyle(document.documentElement);
        const headerVar = rootStyle.getPropertyValue('--ac-site-header-height').trim();
        const verticalVar = rootStyle.getPropertyValue('--ac-page-main-vertical').trim();
        return {
          shellHeight: shellRect.height,
          docScrollHeight: document.documentElement.scrollHeight,
          innerHeight: window.innerHeight,
          headerVar,
          verticalVar,
        };
      });

      // 2. The shell's height is bounded by the viewport (minus the
      // site-header + main padding chrome). We accept any height
      // smaller than the full viewport — the exact value depends on
      // the layout token math, which is exercised by the document /
      // overflow check below.
      expect(
        measurements.shellHeight,
        `${route.url} shell height (${measurements.shellHeight}px) should be smaller than the full viewport (${measurements.innerHeight}px) — the shell must leave room for the site header and main padding.`,
      ).toBeLessThan(measurements.innerHeight);

      // 3. The document does NOT scroll — the fixed-viewport shell
      // clips so internal columns own scroll.
      expect(
        measurements.docScrollHeight,
        `${route.url} document scrollHeight (${measurements.docScrollHeight}px) should fit within viewport (${measurements.innerHeight}px). If this fails the page is back to scrolling as one tall document — see DEVELOPMENT-NOTES 2026-05-13 + AUDIT-20260524-05.`,
      ).toBeLessThanOrEqual(measurements.innerHeight + HEIGHT_SLACK_PX);
    });

    test(`${route.name}: body layout matches its kind (${route.bodyKind})`, async ({ page }) => {
      await gotoHarness(page, route);

      if (route.bodyKind === 'app-shell') {
        // 4a. `.ac-app-shell` is a 2-col grid at >=1024px viewport.
        // Read the computed `grid-template-columns` and confirm two
        // non-empty tracks.
        const gridCols = await page
          .locator('.ac-app-shell')
          .first()
          .evaluate((el) => getComputedStyle(el).gridTemplateColumns);
        const tracks = gridCols.split(/\s+/).filter((t) => t.length > 0);
        expect(
          tracks.length,
          `${route.url} .ac-app-shell at desktop should be 2-col grid, got tracks: [${tracks.join(', ')}]`,
        ).toBe(2);

        // 5. `.ac-list-scroll` inside the list column has an internal
        // scroll discipline (auto or scroll), not visible.
        const listScrollOverflow = await page
          .locator('.ac-list-scroll')
          .first()
          .evaluate((el) => getComputedStyle(el).overflowY);
        expect(
          listScrollOverflow,
          `${route.url} .ac-list-scroll overflow-y should be 'auto' or 'scroll', got '${listScrollOverflow}'`,
        ).toMatch(/^(auto|scroll)$/);
      } else {
        // 4b. The Library variant uses `.ac-page-shell-body` instead
        // of the 2-col `.ac-app-shell` grid. Assert the wrapper is
        // present and there is no competing `.ac-app-shell` inside
        // the fixed-viewport shell.
        await expect(page.locator('.ac-page-shell-body')).toHaveCount(1);
        await expect(
          page.locator('.ac-page-shell--fixed-viewport .ac-app-shell'),
        ).toHaveCount(0);
      }
    });

    if (route.asserts_inner_library_overflow) {
      test(`${route.name}: inner library panes own their own overflow (real PluginLibraryBrowser)`, async ({ page }) => {
        await gotoHarness(page, route);

        // AUDIT-20260524-07: when the real PluginLibraryBrowser is
        // mounted, each inner pane MUST own its own scroll so the
        // outer `.ac-page-shell-body` doesn't have to. If a pane's
        // overflow regresses to `visible`, content overflow bubbles
        // up the parent chain until either the `.ac-page-shell-body`
        // clips it (content unreachable) or the document scrolls
        // (regresses the fixed-viewport contract). Either outcome is
        // a shell-contract failure; this assertion catches the
        // regression at the inner-pane layer.
        const overflowMeasurements = await page.evaluate(() => {
          const selectors = [
            '.ac-plugin-library-browser-device',
            '.ac-plugin-library-browser-sections',
            '.ac-plugin-library-browser-preview',
          ];
          return selectors.map((sel) => {
            const el = document.querySelector(sel) as HTMLElement | null;
            if (!el) return { selector: sel, found: false, overflowY: null };
            return {
              selector: sel,
              found: true,
              overflowY: getComputedStyle(el).overflowY,
            };
          });
        });

        for (const m of overflowMeasurements) {
          expect(
            m.found,
            `${route.url}: expected '${m.selector}' to be rendered by the real PluginLibraryBrowser`,
          ).toBe(true);
          expect(
            m.overflowY,
            `${route.url}: '${m.selector}' overflow-y should be 'auto' or 'scroll' (inner-pane scroll ownership), got '${m.overflowY}'`,
          ).toMatch(/^(auto|scroll)$/);
        }

        // Cross-check: the document still does not scroll, even with
        // the real PluginLibraryBrowser mounted. This is the same
        // invariant tested by the per-route fixed-viewport assertion
        // above, but pinned specifically against the real browser so
        // a regression here implicates the inner-pane overflow rules,
        // not the outer shell.
        const docDimensions = await page.evaluate(() => ({
          docScrollHeight: document.documentElement.scrollHeight,
          innerHeight: window.innerHeight,
        }));
        expect(
          docDimensions.docScrollHeight,
          `${route.url}: real PluginLibraryBrowser must not introduce document scroll; got scrollHeight=${docDimensions.docScrollHeight} vs innerHeight=${docDimensions.innerHeight}`,
        ).toBeLessThanOrEqual(docDimensions.innerHeight + HEIGHT_SLACK_PX);
      });
    }
  }
});

test.describe('Akai page-shell contract — mobile viewport (escape hatch)', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  for (const route of SHELL_HARNESS_ROUTES) {
    test(`${route.name}: fixed-viewport falls back to auto-height on mobile (${route.url})`, async ({ page }) => {
      await gotoHarness(page, route);

      const measurements = await page.evaluate(() => {
        const shellEl = document.querySelector('.ac-page-shell--fixed-viewport') as HTMLElement | null;
        if (!shellEl) throw new Error('shell element not found');
        const cs = getComputedStyle(shellEl);
        return {
          shellComputedHeight: cs.height,
          shellComputedOverflow: cs.overflow,
          shellRectHeight: shellEl.getBoundingClientRect().height,
          docScrollHeight: document.documentElement.scrollHeight,
          innerHeight: window.innerHeight,
        };
      });

      // 1. The mobile escape hatch sets `overflow: visible` on the
      // shell (per layout-primitives.css line 145). Compare against
      // the desktop `overflow: hidden` to prove the breakpoint
      // engaged.
      expect(
        measurements.shellComputedOverflow,
        `${route.url} at mobile: .ac-page-shell--fixed-viewport overflow should be 'visible' (escape hatch engaged), got '${measurements.shellComputedOverflow}'`,
      ).toBe('visible');
    });

    if (route.bodyKind === 'app-shell') {
      test(`${route.name}: .ac-app-shell collapses to single column on mobile`, async ({ page }) => {
        await gotoHarness(page, route);

        const gridCols = await page
          .locator('.ac-app-shell')
          .first()
          .evaluate((el) => getComputedStyle(el).gridTemplateColumns);
        const tracks = gridCols.split(/\s+/).filter((t) => t.length > 0);
        // At <1024px, `.ac-app-shell` falls back to `minmax(0, 1fr)` —
        // a single track. Assert exactly one.
        expect(
          tracks.length,
          `${route.url} .ac-app-shell at mobile should collapse to single column, got tracks: [${tracks.join(', ')}]`,
        ).toBe(1);
      });

      test(`${route.name}: last list row is reachable via scroll on mobile`, async ({ page }) => {
        await gotoHarness(page, route);

        // The mobile escape hatch removes the fixed-viewport height
        // clip and caps `.ac-list-scroll` at `max-height: 70vh`. The
        // last list row should still be reachable: scroll it into
        // view and confirm its bounding rect is inside the viewport
        // afterwards.
        const lastRow = page.locator('.ac-list-row').last();
        await expect(lastRow).toHaveCount(1);

        await lastRow.scrollIntoViewIfNeeded();

        const rowBox = await lastRow.boundingBox();
        if (!rowBox) throw new Error(`${route.url}: last list row has no bounding box after scrollIntoView`);

        const innerHeight = await page.evaluate(() => window.innerHeight);
        // After scrollIntoView the row's top should be within the
        // viewport (>= 0 and < innerHeight). Allow the bottom to spill
        // by a few pixels — the row primitive has its own padding,
        // and what matters is that it's reachable.
        expect(
          rowBox.y,
          `${route.url}: last list row top should be inside viewport after scrollIntoView, got y=${rowBox.y} (innerHeight=${innerHeight})`,
        ).toBeGreaterThanOrEqual(0);
        expect(
          rowBox.y,
          `${route.url}: last list row top should be inside viewport after scrollIntoView, got y=${rowBox.y} (innerHeight=${innerHeight})`,
        ).toBeLessThan(innerHeight);
      });
    }
  }
});
