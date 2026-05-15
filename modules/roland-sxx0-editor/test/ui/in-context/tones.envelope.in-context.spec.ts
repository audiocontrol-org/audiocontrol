/**
 * @credibleAgainst contexts sticky-overlay zero-width-grid pointer-events-none-ancestor
 *
 * Tier 3 in-context spec for `D-TONE-ENV-02` — the TVF envelope per-segment
 * Time slider (segment 1) on the production TonesPage. Mounts the real
 * TonesPage with the `tones-bank-0` simulated-MIDI scenario, opens tone
 * slot 0, switches to the Filter tab, and asserts the segment-1 Time
 * affordance is both reachable (hit-test via `elementsFromPoint`) and
 * responsive to a real pointer drag (`page.mouse.*` from one end of the
 * slider to the other).
 *
 * Failure modes the spec catches:
 *
 *   1. Page-level layering defects (sticky overlay, collapsed column,
 *      pointer-events-none ancestor) — verified by the credibility runner's
 *      `?context=<variant>` invocation. The `BrokenContextWrapper` at App
 *      level wraps the TonesPage in the chosen broken context. Under the
 *      broken context, the spec's earliest production interaction (clicking
 *      the tone-list slot button via `page.mouse`) fails because the
 *      pointer never reaches it — the overlay swallows the click, the
 *      column collapses to 0 px so the tone-slot's box has no hit area, or
 *      the ancestor's `pointer-events: none` disables every descendant.
 *      Subsequent CLAIM 2 (slider reachability) and CLAIM 3 (drag changes
 *      value) compound the catch — the slider either never mounts (no tone
 *      editor opened), is occluded, or refuses pointer events.
 *
 *   2. Slider-primitive wiring defects on the production page — the
 *      AcEnvelopeTable's segment-1 Time slider must expose `role="slider"`
 *      with `aria-label="Segment 1 time"`, must accept a real pointer
 *      drag, and the drag must propagate through `ToneEnvelopeEditor.
 *      updateRate(0, ...)` to the underlying SamplerEnvelope's `rates[0]`
 *      and back into the rendered slider value. The Tier 2 contract
 *      (`AcEnvelopeTable.contract.spec.ts`) verifies the same drag against
 *      the bare AcEnvelopeTable harness; this Tier 3 spec re-verifies the
 *      same drag with all of TonesPage's surrounding state (tone-list
 *      selection, tab switching, AcEnvelope composition) in scope.
 *
 * Why `D-TONE-ENV-02` specifically targets the Filter tab:
 *
 *   The capability inventory at ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md
 *   maps D-TONE-ENV-02 to the **TVF (Filter)** envelope per-segment rate.
 *   The TVF envelope lives in the Filter tab (alongside the TVF cutoff /
 *   resonance / key-follow controls — per the project's "tabbed detail
 *   pane" memory: strongly-interacting controls share a tab). The wiring
 *   spec at `tone-writes.spec.ts:424` uses `tab: 'Filter'` for this
 *   capability. The workplan §9R-A.4 acceptance text says "Amp tab" but
 *   that's a typo; the implementer brief flags it and the corrected target
 *   is the Filter tab.
 *
 * Fixture choice — `tones-bank-0`:
 *
 *   `tones-bank-0` is the canonical load fixture: TonesPage.loadInitialData
 *   → loadToneBank(0) → loadToneRange(0, 8). The fixture's inbound bytes
 *   populate tone slot 0 with a non-trivial S-550 tone (the same bank-0
 *   tone the wiring tests use to mount their editor). The TVF envelope's
 *   segment-1 rate value loaded from the fixture is whatever the bank-0
 *   tone happens to carry; the spec reads it at runtime and drags to the
 *   opposite end of the [0, maxTime] range so the assertion has the
 *   largest possible delta regardless of starting value. This keeps the
 *   spec robust against a future re-record of the fixture that changes
 *   the starting rate.
 *
 *   The fixture also dual-purposes as the load-only baseline for several
 *   read-side wiring tests (D-TONE-LOAD-*), so reusing it here means no
 *   new fixture acquisition is needed for Tier 3 coverage.
 *
 * Selector discipline — Tier 3 contract (no `getByTestId`, no `.click()`):
 *
 *   The ESLint plugin `@audiocontrol/eslint-plugin-test-discipline`
 *   enforces accessible queries + real pointer events in
 *   `test/ui/in-context/**`. Every locator here uses `getByRole` /
 *   `getByLabel`, every click is driven through `page.mouse.move + down +
 *   up` (zero-arg `.click()` is forbidden — only `getByRole(...).click()`
 *   with options would survive the rule, and the existing in-context
 *   precedent at `import-samples-dialog.in-context.spec.ts` routes through
 *   `page.mouse.*` for clicks).
 *
 *   Tone slot 0 is queried by `getByRole('button', { name: /^T11/ })` —
 *   the slot's outer div carries `role="button"` and its accessible name
 *   is its visible text, which starts with the formatted slot label (T11
 *   for slot 0 on S-330's `formatToneSlot`; the S-550 reuses the same
 *   layout per the legacy `useMidiStore = getMidiStore('s330')` alias the
 *   wiring tests rely on). Per ToneList.tsx:13-16 the `data-testid` is
 *   present for the wiring tier but the accessible-button shape is the
 *   contract this Tier 3 spec consumes.
 */
import { test, expect, type Page } from '@playwright/test';
// Reuse the Tier 2 contract helper rather than duplicate it under
// `test/ui/in-context/_credibility-url.ts`. Both tiers consume the
// identical env-var → URL-param translation; a single helper is the right
// factoring. Same pattern as `import-samples-dialog.in-context.spec.ts`.
import { brokenHarnessUrl } from '../contract/_credibility-url';

/**
 * Route URL for the production TonesPage with simulated-MIDI mode. The
 * `tones-bank-0` scenario is the canonical bank-0 load fixture (matches
 * the wiring tests' mount sequence). The path uses `/roland/s550/editor/`
 * because the wiring fixtures were captured with `createS550Client`; the
 * editor's URL-driven config picks `s550Config` and produces the byte
 * encoding the simulated adapter expects. The fixture file itself lives
 * under `fixtures/s330/` because `useMidiStore` is hard-coded to the
 * 's330' legacy alias (per src/stores/midiStore.ts:137) — the simulated
 * transport's `deviceType` flows from that store, not from the URL
 * segment. See `test/wiring/tone-writes.spec.ts:21-27` for the canonical
 * write-up of this routing seam.
 */
const TONES_URL =
  '/roland/s550/editor/tones?midi=simulated&scenario=tones-bank-0';

/**
 * Click an element at its bounding-box center using `page.mouse.*`. The
 * Tier 3 ESLint rule forbids zero-arg `.click()` calls; the helper here
 * is the in-context spec's canonical click path (mirrors the
 * `connectLibrary` helper in `import-samples-dialog.in-context.spec.ts`).
 *
 * Throws if the locator has no bounding box (i.e. zero-width / collapsed
 * under a broken context) — that's a deliberate part of the credibility
 * surface: a `zero-width-grid` ancestor collapses every descendant's box
 * to 0 px, so this helper fails LOUDLY rather than silently clicking the
 * origin (0, 0) and false-passing.
 */
async function clickByPointer(page: Page, label: string, locator: ReturnType<Page['getByRole']>): Promise<void> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error(
      `clickByPointer: ${label} has no bounding box — the element is unrendered or collapsed (likely a broken context).`,
    );
  }
  if (box.width < 1 || box.height < 1) {
    throw new Error(
      `clickByPointer: ${label} has a degenerate bounding box (${String(box.width)}x${String(box.height)}) — likely a collapsed-column broken context.`,
    );
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
}

test.describe('TonesPage TVF envelope segment-1 Time — Tier 3 in-context (D-TONE-ENV-02)', () => {
  test('D-TONE-ENV-02: real pointer drag on segment-1 Time changes the slider value', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(brokenHarnessUrl(TONES_URL), { waitUntil: 'networkidle' });

    // ── Setup: open tone slot 0's editor. ──────────────────────────────
    // The page auto-loads bank 0 on mount via TonesPage.loadInitialData;
    // we then click slot 0 (T11 on S-330's formatToneSlot) to mount the
    // ToneEditor. Under a broken context this click fails (overlay /
    // collapsed column / pointer-events-none ancestor), which is the
    // sticky/zero-width/pointer-events context-sensitivity claim.
    //
    // The slot label is the visible prefix of the button's accessible
    // name; `/^T11/` matches that prefix regardless of the trailing
    // tone-name suffix (which depends on the loaded fixture). Using a
    // regex anchored to the start avoids accidental matches against
    // header buttons (e.g. a "T11-T48" bank-range header).
    const toneSlot = page.getByRole('button', { name: /^T11/ });
    await expect(toneSlot).toBeVisible({ timeout: 10_000 });
    await clickByPointer(page, 'tone slot T11', toneSlot);

    // ── Switch to the Filter tab. ──────────────────────────────────────
    // Tabs carry role="tab" with the visible name as accessible name.
    // The Wave tab is the default; we click Filter to swap panels.
    const filterTab = page.getByRole('tab', { name: 'Filter' });
    await expect(filterTab).toBeVisible({ timeout: 5_000 });
    await clickByPointer(page, 'Filter tab', filterTab);

    // ── CLAIM 1: the slider exists at its published accessible name. ───
    // AcEnvelopeTable renders each segment row's time bar as an
    // `<input type="range">` with `aria-label="Segment N time"`. We
    // narrow to segment 1 (the bug-targeted segment per D-TONE-ENV-02).
    // The Filter panel hosts the TVF envelope; the Amp panel hosts TVA
    // — using `aria-label="Segment 1 time"` alone would match BOTH if
    // the Amp panel's slider were also visible. The Filter tab switch
    // above plus CSS-only tab visibility (only the active panel is
    // `display: block`) keeps the match unambiguous; we add an extra
    // expect(visible) check as a guardrail so a CSS regression that
    // showed both panels simultaneously fails the spec rather than
    // matching the wrong slider silently.
    // Both the Filter (TVF) and Amp (TVA) panels host an envelope with a
    // "Segment 1 time" slider; the inactive panel is `display: none` (see
    // src/styles/tones.css: `.tones__panel { display: none }` with the
    // `:checked ~` cascade re-enabling only the active panel). Elements
    // under `display: none` are excluded from the accessibility tree, so
    // `getByRole` already returns the Filter-panel slider unambiguously
    // after the tab click. The visibility guardrail below is a belt-and-
    // braces check: if the active-panel mechanism ever changes (e.g. to
    // `visibility: hidden`, which DOES keep the element in the AX tree),
    // the assertion fails loudly here rather than the spec quietly
    // matching the wrong slider.
    const slider = page.getByRole('slider', { name: 'Segment 1 time' });
    await expect(slider).toHaveCount(1, { timeout: 5_000 });
    await expect(slider).toBeVisible({ timeout: 5_000 });

    // The TonesPage uses a fixed-viewport 3-col app shell with internal
    // column scrolls; the envelope sits in the detail column below the
    // tab strip. At 1280x720, the segment-1 row falls below the column's
    // initial scroll position. Scroll the slider into view BEFORE the
    // reachability hit-test so the box's center lands inside the
    // viewport. `scrollIntoViewIfNeeded` is a Playwright locator method
    // that scrolls the element's nearest scrollable ancestor — exactly
    // the per-column scroll the design uses. This is not a workaround
    // for the broken contexts: under sticky-overlay the overlay still
    // sits above the slider after scroll; under zero-width-grid the
    // column still has 0 width after scroll; under pointer-events-none
    // the slider is still in the DOM but won't accept events. So the
    // context-sensitivity surface is preserved.
    await slider.scrollIntoViewIfNeeded({ timeout: 5_000 });

    // ── CLAIM 2: the slider is reachable — not occluded, not collapsed.
    // Capture the slider's box, compute its center, and ask the browser
    // what element is at that point. If the top element is anything
    // other than our slider (or an inner child of it), pointer events
    // will be intercepted before reaching it — the same failure mode
    // the sticky-overlay broken context exhibits. A zero-width-grid
    // ancestor collapses the box to 0 px so the elementFromPoint hit
    // misses entirely. A pointer-events-none ancestor still has a box
    // but the input refuses pointer events at the engine level (caught
    // by CLAIM 3 even if reachability nominally passes).
    const box = await slider.boundingBox();
    expect(box, 'slider must have a bounding box').not.toBeNull();
    if (box === null) {
      // The expect() above already failed the spec; this narrows for
      // the type checker without resorting to a non-null assertion.
      throw new Error('slider boundingBox returned null after expect().not.toBeNull()');
    }
    expect(box.width, 'slider must have positive width').toBeGreaterThan(8);
    expect(box.height, 'slider must have positive height').toBeGreaterThan(8);
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    const reachable = await page.evaluate(
      ({ x, y }) => {
        const top = document.elementFromPoint(x, y);
        // The slider is a transparent `<input type="range">` overlay
        // styled with the `ac-envelope-mini__input` class (see
        // AcEnvelopeTable.tsx:118-130). The hit-test top element must
        // be the input itself OR a descendant of an element carrying
        // that class — anything else means an overlay is intercepting.
        const isSlider =
          top !== null &&
          (top.classList.contains('ac-envelope-mini__input') ||
            top.closest('.ac-envelope-mini__input') !== null);
        return {
          isSlider,
          topTag: top?.tagName ?? null,
          topClass: top instanceof Element ? top.className.toString() : null,
          stack: document
            .elementsFromPoint(x, y)
            .slice(0, 4)
            .map((el) => ({ tag: el.tagName, cls: el.className.toString().slice(0, 60) })),
        };
      },
      { x: centerX, y: centerY },
    );
    expect(
      reachable.isSlider,
      `slider must be the top element at its center — actually got ${JSON.stringify(reachable.stack)}`,
    ).toBe(true);

    // ── CLAIM 3: a real pointer drag changes the slider's value. ──────
    // Read the slider's current value as a user-observable attribute,
    // pick the larger-delta drag direction (so the assertion has the
    // biggest possible signal regardless of the loaded fixture's
    // starting value), drive the drag via `page.mouse.*`, and assert
    // the value changed.
    //
    // For HTML `<input type="range">`, the implicit ARIA role is
    // "slider" and `.value` reflects the current numeric value (as a
    // string). `aria-valuenow` may or may not be set by the browser —
    // we read `.value` directly because it's the canonical source for
    // a native range input. Both `.value` and `aria-valuenow` (when
    // present) are user-observable, not internal React state.
    const initialValueRaw = await slider.evaluate((el) => (el as HTMLInputElement).value);
    const initialValue = Number(initialValueRaw);
    expect(
      Number.isFinite(initialValue),
      `slider .value must parse as a finite number — got '${initialValueRaw}'`,
    ).toBe(true);

    // Read the slider's max so the spec doesn't hardcode a value that
    // would drift if the AcEnvelopeTable's maxTime prop changed.
    const maxValueRaw = await slider.evaluate((el) => (el as HTMLInputElement).max);
    const maxValue = Number(maxValueRaw);
    expect(
      Number.isFinite(maxValue) && maxValue > 0,
      `slider .max must parse as a positive finite number — got '${maxValueRaw}'`,
    ).toBe(true);

    // Choose drag direction + endpoints. We start at the slider position
    // that corresponds to the CURRENT value (so the initial mousedown
    // doesn't accidentally snap the value — `<input type="range">`
    // updates its value on mousedown to the x-mapped position). We then
    // drag toward the opposite end of the range, picking the direction
    // with the larger delta. To avoid an off-by-one at the box boundary
    // (mousedown at box.x + box.width lands just outside the hit area
    // of the input on some browsers, missing the event entirely), both
    // the start and target positions are clamped to {2px inside left
    // edge, 2px inside right edge}.
    const fracStart = Math.min(Math.max(initialValue / maxValue, 0), 1);
    const dragRight = fracStart < 0.5;
    const startX = box.x + Math.max(2, Math.min(box.width - 2, box.width * fracStart));
    const targetX = dragRight ? box.x + box.width - 2 : box.x + 2;

    await page.mouse.move(startX, centerY);
    await page.mouse.down();
    await page.mouse.move(targetX, centerY, { steps: 12 });
    await page.mouse.up();

    // Read the slider's value after the drag. The slider commits each
    // mousemove via React's onChange handler (AcEnvelopeTable.tsx:127),
    // which routes through ToneEnvelopeEditor.updateRate(0, newValue)
    // and back into the SamplerEnvelope's rates[0]. The rendered slider
    // reflects the updated value because it's a controlled input on the
    // store's tone.tvf.envelope.rates[0].
    const finalValueRaw = await slider.evaluate((el) => (el as HTMLInputElement).value);
    const finalValue = Number(finalValueRaw);
    expect(
      Number.isFinite(finalValue),
      `slider .value after drag must parse as a finite number — got '${finalValueRaw}'`,
    ).toBe(true);
    expect(
      finalValue,
      `slider value must change after a real pointer drag (initial=${String(initialValue)}, final=${String(finalValue)}, direction=${dragRight ? 'right' : 'left'})`,
    ).not.toBe(initialValue);

    // Sanity: the drag direction should be reflected in the value
    // movement. Drag-right increases the value; drag-left decreases.
    // This catches a subtle failure mode where the drag fires onChange
    // but with an unrelated value (e.g. a Radix bug where the slider
    // resets to step-min on `mousedown` regardless of cursor position).
    if (dragRight) {
      expect(
        finalValue,
        `drag-right must increase the value (initial=${String(initialValue)}, final=${String(finalValue)})`,
      ).toBeGreaterThan(initialValue);
    } else {
      expect(
        finalValue,
        `drag-left must decrease the value (initial=${String(initialValue)}, final=${String(finalValue)})`,
      ).toBeLessThan(initialValue);
    }
  });
});
