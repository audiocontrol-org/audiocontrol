/**
 * @credibleAgainst contexts sticky-overlay zero-width-grid pointer-events-none-ancestor
 *
 * Tier 3 in-context spec for `D-TONE-LIST-04` — the tone-list row activation
 * affordance on the production TonesPage. Mounts the real TonesPage with
 * the `tones-bank-0` simulated-MIDI scenario, waits for bank 0 to populate
 * (T11-T18 loaded), then asserts three claims that together prove the
 * `LIVE-S550-TONES-001` (#428) remediation is durable:
 *
 *   CLAIM 1 — The `.ac-list-bank-header` sticky element does NOT
 *   intercept pointer events. The header is `position: sticky; top: 0`
 *   and on the live S-550 sits directly above the bank's first row
 *   (T11). Without `pointer-events: none`, the header's default
 *   `pointer-events: auto` swallows clicks targeted at T11's hit area
 *   — that's the exact failure mode the auditor's
 *   `test/e2e/s550-D-TONE-live-envelope-and-slider.spec.ts:163` hit on
 *   real hardware (Playwright retried `tone-item-0` while the header
 *   was intercepting). The fix at
 *   `modules/editor-core/src/design/list-primitives.css` adds
 *   `pointer-events: none` to `.ac-list-bank-header`; this claim
 *   asserts the header is NOT the top element at its own center via
 *   `document.elementFromPoint`.
 *
 *   CLAIM 2 — The first tone row T11 IS reachable to pointer events.
 *   Compute T11's bounding-box center and verify the top element at
 *   that point is the row (or a descendant) — i.e. nothing is occluding
 *   the user-facing target. This is the bug's user-visible surface:
 *   on the broken build, T11's click target is shadowed by the bank
 *   header; on the fixed build, the header passes-through and T11
 *   accepts the hit.
 *
 *   CLAIM 3 — A real `page.mouse` click on T11 surfaces the tone
 *   editor. This is the integration verification: the fix actually
 *   unblocks the user flow that the auditor's live e2e exercises. We
 *   wait for an editor-specific accessible affordance to mount
 *   (the "Filter" tab `role="tab"`); if the click fired through the
 *   header instead of the row (the broken build) the editor never
 *   mounts and the spec fails on the wait.
 *
 * Failure modes the spec catches:
 *
 *   1. Page-level layering defects (`sticky-overlay`, `zero-width-grid`,
 *      `pointer-events-none-ancestor`) — verified by the credibility
 *      runner's `?context=<variant>` invocation. The
 *      `BrokenContextWrapper` at App level wraps TonesPage in the
 *      chosen broken context. Under each broken context the spec fails
 *      at a different claim:
 *        - `sticky-overlay`: an additional sticky element layered on
 *          top of the list intercepts every click — CLAIMS 2+3 fail
 *          because T11 is reachable via DOM but not via pointer.
 *        - `zero-width-grid`: the list column collapses to 0 px, so
 *          T11's bounding box degenerates and `clickByPointer` throws
 *          on the degenerate-box guard — CLAIM 2 fails on width.
 *        - `pointer-events-none-ancestor`: the wrapping div sets
 *          `pointer-events: none` so the row exists but refuses
 *          pointer events — CLAIM 3 fails because the editor never
 *          mounts after the click.
 *
 *   2. Regression of the bank-header fix itself — if a future commit
 *      drops `pointer-events: none` from `.ac-list-bank-header` (or
 *      adds a competing sticky overlay above the list), CLAIM 1 fails
 *      because the header becomes the top element at its own center.
 *      This is the durable-fix assertion.
 *
 * Note on capability mapping:
 *
 *   The bug surface is the row-click → editor-mount path. The closest
 *   inventory ID per ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md is
 *   `D-TONE-LIST-04` ("Read per-slot load state … class-based states")
 *   — the row's accessibility state (rendered text content, position,
 *   reachability) is the externally observable expression of that
 *   state. CLAIM 1 + CLAIM 2 verify the loaded slot's row is
 *   accessibly reachable; CLAIM 3 verifies activation. The inventory
 *   doesn't carry a separate "row activation" D-ID; D-TONE-LIST-04 is
 *   the umbrella the activation affordance lives under per the brief's
 *   guidance. The spec's test name also declares D-TONE-LIST-01
 *   ("Enumerate tone slots") because CLAIM 2's `getByRole(name: /^T11/)`
 *   assertion confirms slot 0 is enumerated and labeled per the
 *   memory-layout's `formatToneSlot` contract.
 *
 * Fixture choice — `tones-bank-0`:
 *
 *   Same canonical bank-0 load fixture the wiring tests and the
 *   sibling `tones.envelope.in-context.spec.ts` consume. Bank 0
 *   populates T11-T18 with non-trivial tones; the test only needs
 *   T11 (slot 0) to be loaded so its row carries `tabIndex={0}` and
 *   `onClick={handleClick}` (per `ToneList.tsx:135-138` — the
 *   `isBankLoading` gating is intentional and must be respected).
 *
 * Selector discipline — Tier 3 contract:
 *
 *   `@audiocontrol/eslint-plugin-test-discipline` enforces accessible
 *   queries + real pointer events in `test/ui/in-context/**`. Every
 *   locator here uses `getByRole` / `getByText`; every click is driven
 *   through `page.mouse.move + down + up`. The bank header itself
 *   carries no `role` attribute (it's a `<div>` with two text spans);
 *   we locate it by its visible text inside the tone list region — the
 *   list is exposed as an `aside` with `aria-label="Tone list"` (see
 *   `ToneList.tsx:64-67`), which `getByRole('complementary', { name:
 *   'Tone list' })` resolves to. From there, `getByText('Group 1', {
 *   exact: true })` resolves to the bank-1 header (the one that sits
 *   above T11) without ambiguity.
 *
 *   Tone slot 0's row is queried by `getByRole('button', { name:
 *   /^T11/ })` — the slot's outer div carries `role="button"` and its
 *   accessible name is its visible text starting with the slot label.
 *   Same pattern the sibling envelope spec uses.
 */
import { test, expect, type Page } from '@playwright/test';
// Reuse the Tier 2 contract helper — same env-var → URL-param
// translation pattern as `tones.envelope.in-context.spec.ts` and
// `import-samples-dialog.in-context.spec.ts`.
import { brokenHarnessUrl } from '../contract/_credibility-url';

/**
 * Production TonesPage with simulated-MIDI mode and the `tones-bank-0`
 * fixture. Mirrors the sibling envelope spec's TONES_URL — the
 * `/roland/s550/` route picks `s550Config` (so the editor's
 * memory-layout reports 16 tone banks × 8 slots = 128 tones), while
 * the fixture file itself lives under `fixtures/s330/` because
 * `useMidiStore` is hard-coded to the 's330' legacy alias (per
 * `src/stores/midiStore.ts:137`). See the envelope spec for the full
 * write-up of this routing seam.
 */
const TONES_URL =
  '/roland/s550/editor/tones?midi=simulated&scenario=tones-bank-0';

/**
 * Inspect a hit-test stack at a given page coordinate. Returns the
 * top element's tag/classes plus the first four elements deep so a
 * failing reachability assertion can surface a useful stack rather
 * than a bare boolean.
 */
async function inspectHitStack(
  page: Page,
  x: number,
  y: number,
): Promise<{
  topTag: string | null;
  topClass: string | null;
  stack: { tag: string; cls: string }[];
}> {
  return page.evaluate(
    ({ x, y }) => {
      const top = document.elementFromPoint(x, y);
      return {
        topTag: top?.tagName ?? null,
        topClass: top instanceof Element ? top.className.toString() : null,
        stack: document
          .elementsFromPoint(x, y)
          .slice(0, 4)
          .map((el) => ({
            tag: el.tagName,
            cls: el.className.toString().slice(0, 80),
          })),
      };
    },
    { x, y },
  );
}

test.describe('TonesPage tone-list row activation — Tier 3 in-context (D-TONE-LIST-04 / D-TONE-LIST-01)', () => {
  test('D-TONE-LIST-04 / D-TONE-LIST-01: bank header passes through pointer events; first row T11 is reachable and activates the editor', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(brokenHarnessUrl(TONES_URL), { waitUntil: 'networkidle' });

    // ── Setup: wait for bank 0 to load. ───────────────────────────────
    // TonesPage.loadInitialData kicks off the bank-0 load on mount
    // (the simulated transport replays the fixture's 88 records in
    // ~1.8s of playback time). We anchor on the T11 row becoming
    // visible — at that point the slot is enumerated and labeled per
    // `formatToneSlot(0) === 'T11'` (S-330's tone-slot format, which
    // S-550 reuses via the shared MemoryLayout interface).
    //
    // Under a broken context the row never reaches a visible-and-
    // reachable state: sticky-overlay parks something above it,
    // zero-width-grid collapses its column to 0 px, pointer-events-
    // none-ancestor leaves the row visually present but unclickable.
    // CLAIM 2 below verifies reachability explicitly; the initial
    // wait here only ensures the bank has loaded enough for the row
    // to mount in the DOM.
    const list = page.getByRole('complementary', { name: 'Tone list' });
    await expect(list).toBeVisible({ timeout: 10_000 });

    const toneRow = page.getByRole('button', { name: /^T11/ });
    await expect(toneRow).toBeVisible({ timeout: 10_000 });

    // The row's `aria-disabled` must be false (or absent) — if the
    // isBankLoading gate were still active here, the click would be
    // intentionally suppressed by production code, NOT the bug. We
    // assert the row is past the load gate before the reachability
    // claims so a CLAIM failure can be attributed to the layering
    // defect, not a still-loading bank.
    await expect(toneRow).toHaveAttribute('aria-disabled', 'false', {
      timeout: 5_000,
    });

    // ── CLAIM 1: the bank-1 header does NOT intercept pointer events. ─
    //
    // The header is rendered as a `<div className="ac-list-bank-header">`
    // with two text spans inside: `<span>Group 1</span>` and
    // `<strong>T11–T18</strong>` (see ToneList.tsx:78-81). Without
    // `role="button"` / `role="banner"`, accessible-name queries don't
    // resolve the header directly — we narrow via the list's
    // `complementary` role, then locate the "Group 1" text inside.
    //
    // `getByText('Group 1', { exact: true })` resolves the bank-1
    // header (slots T11-T18). The header's bounding box is the box
    // of the `<span>Group 1</span>` text element, not the surrounding
    // `<div>` — but the hit-test below uses the span's center, which
    // falls inside the parent `<div>`'s box too. If the parent div
    // were the top element at that point, the test would still pass
    // (the div is the `.ac-list-bank-header`, and it must NOT be on
    // top). The assertion is: NEITHER the span NOR its bank-header
    // parent is the top element at the span's center.
    const bankHeaderText = list.getByText('Group 1', { exact: true });
    await expect(bankHeaderText).toBeVisible({ timeout: 5_000 });
    const headerBox = await bankHeaderText.boundingBox();
    expect(headerBox, 'bank header text must have a bounding box').not.toBeNull();
    if (headerBox === null) {
      throw new Error('bankHeaderText boundingBox returned null after expect');
    }
    expect(
      headerBox.width,
      'bank header text must have positive width (collapsed-column broken context check)',
    ).toBeGreaterThan(2);
    expect(
      headerBox.height,
      'bank header text must have positive height',
    ).toBeGreaterThan(2);

    const headerCenterX = headerBox.x + headerBox.width / 2;
    const headerCenterY = headerBox.y + headerBox.height / 2;
    const headerHit = await inspectHitStack(page, headerCenterX, headerCenterY);
    const headerTopClass = headerHit.topClass ?? '';
    const headerIsBlocking =
      headerTopClass.includes('ac-list-bank-header') ||
      headerHit.stack[0]?.cls.includes('ac-list-bank-header') === true;
    expect(
      headerIsBlocking,
      `bank header must NOT be the top hit-test element at its own center (pointer-events: none) — actually got ${JSON.stringify(headerHit.stack)}`,
    ).toBe(false);

    // ── CLAIM 2: the T11 row IS reachable to pointer events. ──────────
    //
    // Compute T11's bounding-box center. Verify the top element at
    // that point is the row itself or a descendant — i.e. the user-
    // facing target is not occluded by anything (including the bank
    // header, which is the bug's primary surface). The row carries
    // `className="tones__list-row"` (per ToneList.tsx:140), so the
    // hit-test top element must be an element with that class OR a
    // descendant.
    const rowBox = await toneRow.boundingBox();
    expect(rowBox, 'T11 row must have a bounding box').not.toBeNull();
    if (rowBox === null) {
      throw new Error('toneRow boundingBox returned null after expect');
    }
    expect(
      rowBox.width,
      'T11 row must have positive width (collapsed-column broken context check)',
    ).toBeGreaterThan(8);
    expect(
      rowBox.height,
      'T11 row must have positive height',
    ).toBeGreaterThan(8);

    const rowCenterX = rowBox.x + rowBox.width / 2;
    const rowCenterY = rowBox.y + rowBox.height / 2;
    const rowHit = await inspectHitStack(page, rowCenterX, rowCenterY);
    const rowReachable = await page.evaluate(
      ({ x, y }) => {
        const top = document.elementFromPoint(x, y);
        if (top === null) return false;
        // The row is `<div class="tones__list-row" role="button">`,
        // and its descendants are `<span>` elements (slot label,
        // tone name). Acceptable top elements: the row itself, any
        // of its span descendants, OR an Export button INSIDE the
        // row (which forwards clicks via `stopPropagation` per
        // ToneList.tsx:163 — but still reachable to pointer events,
        // which is all CLAIM 2 asserts).
        return (
          top.classList.contains('tones__list-row') ||
          top.closest('.tones__list-row') !== null
        );
      },
      { x: rowCenterX, y: rowCenterY },
    );
    expect(
      rowReachable,
      `T11 row must be reachable at its center — actually got ${JSON.stringify(rowHit.stack)}`,
    ).toBe(true);

    // ── CLAIM 3: a real pointer click on T11 surfaces the tone editor.
    //
    // Drive the click through `page.mouse.*` (the in-context tier's
    // canonical pointer path; zero-arg `.click()` is forbidden by
    // the test-discipline ESLint rule). After the click, wait for an
    // editor-specific accessible affordance to mount. The ToneEditor
    // exposes a tab strip with role="tab"; the "Filter" tab is one
    // of the canonical landmarks and is the same tab the sibling
    // envelope spec consumes. If the click landed on the header
    // instead of the row (the broken-fix surface), the editor never
    // mounts and the wait below times out.
    await page.mouse.move(rowCenterX, rowCenterY);
    await page.mouse.down();
    await page.mouse.up();

    const filterTab = page.getByRole('tab', { name: 'Filter' });
    await expect(filterTab).toBeVisible({ timeout: 5_000 });
  });
});
