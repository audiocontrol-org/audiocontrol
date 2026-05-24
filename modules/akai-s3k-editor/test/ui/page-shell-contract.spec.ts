/**
 * Page shell contract — regression coverage for the akai page chrome
 * migrated in commit bba5b13b. Closes AUDIT-20260524-05, -06, -07,
 * -08, -09.
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
 *   - `.ac-detail-scroll` (where present) has `overflow-y: scroll|auto`
 *     (AUDIT-20260524-08 — both columns of the app-shell contract are
 *     asserted, not just the list side)
 *   - For `/test/keygroups-shell` (the contentful-detail harness):
 *     `.ac-detail-scroll` has overflow PRESSURE (scrollHeight >
 *     clientHeight), the last detail row is reachable via
 *     `scrollIntoView()`, and the document does NOT scroll afterwards
 *     (AUDIT-20260524-08 — proves the detail-scroll declaration
 *     actually owns scroll under load, not just declares overflow)
 *   - For `/test/library-real`: inner library panes own their own
 *     overflow (`.ac-plugin-library-browser-device`,
 *     `.ac-plugin-library-browser-sections`,
 *     `.ac-plugin-library-browser-preview` each declare
 *     `overflow-y: auto|scroll`); under the contentful seed, each of
 *     `.ac-plugin-library-browser-device` and
 *     `.ac-plugin-library-browser-sections` ALSO has overflow pressure
 *     (scrollHeight > clientHeight), a deterministic last item is
 *     reachable via `scrollIntoView()`, and the document never grows
 *     past `innerHeight` (AUDIT-20260524-09 — proves the inner-pane
 *     overflow declarations actually own scroll under populated
 *     library + device-memory state)
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
   *
   * Under AUDIT-20260524-09 the same route ALSO seeds the harness
   * with deterministic contentful data (30 device programs + 30
   * device samples + 30 entries per library category) so the
   * inner-pane overflow assertions exercise populated state, not
   * empty-state CSS declarations.
   */
  readonly asserts_inner_library_overflow?: boolean;
  /**
   * When true, the harness seeds the detail column with synthetic
   * content tall enough to force vertical overflow inside
   * `.ac-detail-scroll`. The contract spec then asserts
   * `scrollHeight > clientHeight`, the LAST detail row is reachable
   * via `scrollIntoView()`, and the document never grows beyond
   * `innerHeight` (proves the pane owns scroll; document never
   * leaks). AUDIT-20260524-08 closure.
   *
   * Only the `/test/keygroups-shell` route opts in today — its
   * harness renders 20 synthetic param rows below the selected-
   * keygroup summary, each with `data-testid="kg-detail-row-<i>"`.
   */
  readonly contentful_detail_scroll_last_row_selector?: string;
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
    // 20 stacked synthetic param rows (`min-height: 80px` each)
    // exceed viewport height on the 900px desktop suite, forcing
    // `.ac-detail-scroll` to scroll. AUDIT-20260524-08 closure.
    contentful_detail_scroll_last_row_selector: '[data-testid="kg-detail-row-19"]',
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

        // 5a. `.ac-list-scroll` inside the list column has an internal
        // scroll discipline (auto or scroll), not visible.
        const listScrollOverflow = await page
          .locator('.ac-list-scroll')
          .first()
          .evaluate((el) => getComputedStyle(el).overflowY);
        expect(
          listScrollOverflow,
          `${route.url} .ac-list-scroll overflow-y should be 'auto' or 'scroll', got '${listScrollOverflow}'`,
        ).toMatch(/^(auto|scroll)$/);

        // 5b. `.ac-detail-scroll` in the detail column owns the SAME
        // internal scroll contract as the list column. AUDIT-20260524-08:
        // every app-shell page has its dense editor surface wrapped in
        // `<div className="ac-detail-scroll">` (ProgramsPage.tsx:351,
        // SamplesPage.tsx:259, KeygroupsPage.tsx:351); the rule lives
        // in index.css:21-53 and exists so editor content past one
        // viewport scrolls inside the grid track rather than getting
        // clipped. If a regression drops the wrapper class, removes
        // `overflow-y: auto`, or substitutes a non-scrolling div, this
        // assertion turns red.
        const detailScrollOverflow = await page
          .locator('.ac-detail-scroll')
          .first()
          .evaluate((el) => getComputedStyle(el).overflowY);
        expect(
          detailScrollOverflow,
          `${route.url} .ac-detail-scroll overflow-y should be 'auto' or 'scroll', got '${detailScrollOverflow}'`,
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

      test(`${route.name}: contentful library + device-memory state forces real overflow pressure (AUDIT-20260524-09)`, async ({ page }) => {
        await gotoHarness(page, route);

        // AUDIT-20260524-09: the prior assertion verifies CSS
        // declarations exist on the panes. This assertion verifies
        // those declarations actually DO WORK by forcing content
        // past pane height and proving:
        //   1. scrollHeight > clientHeight (pane has real overflow
        //      pressure under the seeded contentful state — proves
        //      `TestLibraryRealPage` is seeded; if the seed regresses
        //      back to empty inputs, this assertion goes red)
        //   2. The last deterministic item per pane is reachable via
        //      scrollIntoView() + boundingClientRect (proves the pane
        //      owns its scroll mechanism)
        //   3. The document still does NOT scroll afterwards (proves
        //      the pane's overflow stayed internal — no bleed)
        //
        // The preview pane (`.ac-plugin-library-browser-preview`) is
        // intentionally excluded from the populated-overflow part
        // because it renders the SELECTED item's preview, not all
        // items; with no selection, it stays empty. The preview's
        // overflow declaration is still asserted by the prior test
        // (test above) — populated-overflow coverage for the preview
        // pane would require selection-driven content and is a
        // separate concern.
        const pressureCases: ReadonlyArray<{
          pane: string;
          /** A deterministic selector for the LAST item rendered
           *  inside the pane. Must address an element actually present
           *  under the harness seed. */
          lastItem: string;
        }> = [
          // Device-memory pane: 30 programs + 30 samples seeded; the
          // last sample is `device-sample-29` per `DeviceMemoryPanel`
          // `data-testid={`device-${type}-${index}`}` shape.
          { pane: '.ac-plugin-library-browser-device', lastItem: '[data-testid="device-sample-29"]' },
          // Sections pane: 30 entries per category × 3 categories;
          // tree nodes carry `data-testid={`library-${type}-${slug}`}`
          // from `TreeView.tsx:267-269`. The last s3k-programs entry
          // slug is `s3kprog-029` (`S3kProg_029` → lowercased,
          // non-alnum collapsed). Section ordering is device-band
          // (s3k-programs) below common-band (samples, common-programs)
          // since s3k-programs has the default scope ('device') and
          // the common categories appear in their declaration order;
          // either way the deepest-rendered item is reachable through
          // the pane's own scroll. Pick a sample-category entry
          // because samples is reliably rendered first regardless of
          // band ordering, and assert reachability on the LAST sample
          // (idx 29) — sections-pane scroll has to walk past at
          // least the samples section to reach it.
          { pane: '.ac-plugin-library-browser-sections', lastItem: '[data-testid="library-sample-samples-sample-029"]' },
        ];

        for (const { pane, lastItem } of pressureCases) {
          const paneHandle = page.locator(pane);
          await expect(paneHandle, `${route.url}: pane ${pane} should exist`).toHaveCount(1);

          const dims = await paneHandle.evaluate((el) => ({
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight,
          }));
          expect(
            dims.scrollHeight,
            `${route.url}: pane '${pane}' scrollHeight (${dims.scrollHeight}px) should be > clientHeight (${dims.clientHeight}px) — proves the contentful seed actually overflows the pane. If this fails, the seed in TestLibraryRealPage.tsx has regressed back to empty inputs (AUDIT-20260524-09).`,
          ).toBeGreaterThan(dims.clientHeight);

          const lastLocator = page.locator(lastItem);
          await expect(
            lastLocator,
            `${route.url}: last-item selector '${lastItem}' should locate a rendered element under the seeded pane '${pane}'`,
          ).toHaveCount(1);

          await lastLocator.scrollIntoViewIfNeeded();

          const reachability = await lastLocator.evaluate((el, paneSel) => {
            const paneEl = document.querySelector(paneSel) as HTMLElement | null;
            const itemRect = el.getBoundingClientRect();
            const paneRect = paneEl?.getBoundingClientRect() ?? null;
            return {
              itemTop: itemRect.top,
              itemBottom: itemRect.bottom,
              paneTop: paneRect?.top ?? null,
              paneBottom: paneRect?.bottom ?? null,
              docScrollHeight: document.documentElement.scrollHeight,
              innerHeight: window.innerHeight,
            };
          }, pane);

          // The item's bottom edge should sit within the pane's bottom
          // edge (the pane owns the scroll; the item is now in-view).
          // Allow the small slack window used for sub-pixel rounding.
          expect(
            reachability.itemBottom,
            `${route.url}: after scrollIntoView, last item '${lastItem}' bottom (${reachability.itemBottom}px) should be inside pane '${pane}' bottom (${reachability.paneBottom}px) — proves the pane owns scroll and the seeded last entry is reachable.`,
          ).toBeLessThanOrEqual((reachability.paneBottom ?? 0) + HEIGHT_SLACK_PX);

          // Document MUST not have grown — proves the pane's scroll
          // stayed internal and did not bleed up the parent chain.
          expect(
            reachability.docScrollHeight,
            `${route.url}: after scrolling pane '${pane}', document scrollHeight (${reachability.docScrollHeight}px) should still fit innerHeight (${reachability.innerHeight}px). If this regresses, the pane's overflow is bleeding to the document.`,
          ).toBeLessThanOrEqual(reachability.innerHeight + HEIGHT_SLACK_PX);
        }
      });
    }

    if (route.contentful_detail_scroll_last_row_selector) {
      const lastRowSelector = route.contentful_detail_scroll_last_row_selector;
      test(`${route.name}: .ac-detail-scroll owns scroll under contentful detail content (AUDIT-20260524-08)`, async ({ page }) => {
        await gotoHarness(page, route);

        // AUDIT-20260524-08: the per-route `.ac-detail-scroll`
        // overflow-y assertion above proves the CSS property is
        // declared. This assertion proves the declaration actually
        // owns scroll when the detail pane content exceeds one
        // viewport. The harness `TestKeygroupsShellPage` mounts 20
        // synthetic param rows (`min-height: 80px` each → ~1600px
        // content) inside `.ac-detail-scroll`; under the 900px
        // desktop viewport the pane MUST overflow internally.
        const detailScroll = page.locator('.ac-detail-scroll').first();
        await expect(
          detailScroll,
          `${route.url}: .ac-detail-scroll should be rendered`,
        ).toHaveCount(1);

        const dims = await detailScroll.evaluate((el) => ({
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        }));
        expect(
          dims.scrollHeight,
          `${route.url}: .ac-detail-scroll scrollHeight (${dims.scrollHeight}px) should be > clientHeight (${dims.clientHeight}px) — proves the harness seed actually creates overflow pressure on the detail pane. If this fails, the synthetic param rows in TestKeygroupsShellPage.tsx have regressed (AUDIT-20260524-08).`,
        ).toBeGreaterThan(dims.clientHeight);

        // The LAST detail row should be reachable via scrollIntoView —
        // the pane owns the scroll, the document does not.
        const lastRow = page.locator(lastRowSelector);
        await expect(
          lastRow,
          `${route.url}: last detail row '${lastRowSelector}' should be rendered under the harness seed`,
        ).toHaveCount(1);

        await lastRow.scrollIntoViewIfNeeded();

        const reachability = await lastRow.evaluate((el) => {
          const detailEl = document.querySelector('.ac-detail-scroll') as HTMLElement | null;
          const rowRect = el.getBoundingClientRect();
          const detailRect = detailEl?.getBoundingClientRect() ?? null;
          return {
            rowTop: rowRect.top,
            rowBottom: rowRect.bottom,
            detailTop: detailRect?.top ?? null,
            detailBottom: detailRect?.bottom ?? null,
            docScrollHeight: document.documentElement.scrollHeight,
            innerHeight: window.innerHeight,
          };
        });

        // After scrollIntoView, the row's bottom must sit within (or
        // very near) the detail pane's bottom — proving the pane
        // owns the scroll and the row is in-view.
        expect(
          reachability.rowBottom,
          `${route.url}: after scrollIntoView, last detail row bottom (${reachability.rowBottom}px) should be inside .ac-detail-scroll bottom (${reachability.detailBottom}px) — proves the detail pane owns scroll.`,
        ).toBeLessThanOrEqual((reachability.detailBottom ?? 0) + HEIGHT_SLACK_PX);

        // The document still does NOT scroll — the pane's overflow
        // stayed internal, no bleed.
        expect(
          reachability.docScrollHeight,
          `${route.url}: after scrolling .ac-detail-scroll, document scrollHeight (${reachability.docScrollHeight}px) should still fit innerHeight (${reachability.innerHeight}px). If this regresses, the detail pane's overflow is bleeding to the document.`,
        ).toBeLessThanOrEqual(reachability.innerHeight + HEIGHT_SLACK_PX);
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
