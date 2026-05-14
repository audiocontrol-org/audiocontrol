/**
 * Contract test for the AcEnvelopeTable per-segment Time slider — the exact
 * primitive used on the Tones page envelope editor.
 *
 * This spec proves the slider works as a slider that an actual operator
 * would use with a trackpad or mouse. It does NOT test keyboard. It does
 * NOT reach into the underlying React state via .fill() / value = X /
 * dispatchEvent('change'). Every assertion originates from a real pointer
 * event at a real pixel coordinate, hit-tested through the same
 * elementsFromPoint stack the browser shows the user.
 *
 * Failure of any of the four claims fails the spec:
 *   1. The slider exists at its published accessible role / name.
 *   2. The slider is reachable — elementFromPoint at its center returns
 *      the slider itself, not an overlay.
 *   3. A real pointer drag (mouse.move → mouse.down → multi-step
 *      mouse.move → mouse.up) changes the slider's value.
 *   4. The consumer's onChange spy was invoked with the new value.
 *
 * The harness at /_harness/envelope-table mounts the production
 * AcEnvelopeTable with stub data + a window-exposed spy.
 */
import { test, expect } from '@playwright/test';

test.describe('AcEnvelopeTable segment-1 Time slider — operator pointer-drag contract', () => {
  test('drags the bar with a real pointer and the consumer onChange fires with a new value', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/roland/s330/editor/_harness/envelope-table', {
      waitUntil: 'networkidle',
    });
    await page.waitForSelector('.ac-envelope-table');

    // ── CLAIM 1: the slider exists at its published accessible name. ─────
    // A "slider" affordance MUST advertise role="slider" with the documented
    // accessible name. If this query fails, the primitive shipped without
    // the accessible contract — failure mode that the role="img" paint had.
    const slider = page.getByRole('slider', { name: 'Segment 1 time' });
    await expect(slider).toBeVisible();

    // ── CLAIM 2: the slider is reachable — not occluded. ─────────────────
    // Capture the slider's box, compute its center, and ask the browser
    // what element is at that point. If the top element is anything other
    // than our slider (or an inner child of it), pointer events will be
    // intercepted before reaching it — the same failure mode the sticky
    // page header introduces on PlayPage.
    const box = await slider.boundingBox();
    expect(box, 'slider must have a bounding box').not.toBeNull();
    expect(box!.width, 'slider must have positive width').toBeGreaterThan(8);
    expect(box!.height, 'slider must have positive height').toBeGreaterThan(8);
    const centerX = box!.x + box!.width / 2;
    const centerY = box!.y + box!.height / 2;

    const reachable = await page.evaluate(
      ({ x, y }) => {
        const top = document.elementFromPoint(x, y);
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
    expect(reachable.isSlider, `slider must be the top element at its center — actually got ${JSON.stringify(reachable.stack)}`).toBe(true);

    // ── CLAIM 3 + 4: a real pointer drag changes the value and fires onChange.
    // Drive page.mouse — the same engine browsers route real user events
    // through. No synthetic events, no .fill, no value assignment.
    // The bar's current value (106) sits ~83% across the bar. Move the
    // pointer to that position first, press, drag left to ~10%, release.
    const startX = box!.x + box!.width * 0.83;
    const targetX = box!.x + box!.width * 0.10;
    await page.mouse.move(startX, centerY);
    await page.mouse.down();
    await page.mouse.move(targetX, centerY, { steps: 12 });
    await page.mouse.up();

    // CLAIM 3: the slider's reported value moved. We read the native
    // value via the slider's aria-valuenow OR the underlying input.value
    // — both are user-observable attributes, not internal React state.
    const afterAriaValueNow = await slider.getAttribute('aria-valuenow');
    const afterInputValue = await slider.evaluate((el) => (el as HTMLInputElement).value);
    expect(
      Number(afterAriaValueNow ?? afterInputValue),
      'slider value must change after a real pointer drag',
    ).toBeLessThan(106);

    // CLAIM 4: the consumer's onChange spy was invoked with the new value.
    // The harness mirrors the spy state onto window.__acHarness.envelopeTable
    // (the shared harness namespace; see harness-globals.d.ts) so the spec
    // can observe what reached the consumer — not what the input says, but
    // what the page's onChange handler actually received.
    const spy = await page.evaluate(() => window.__acHarness?.envelopeTable);
    expect(spy?.timeCalls.length ?? 0, 'consumer onChange must fire at least once').toBeGreaterThan(0);
    const lastCall = spy?.timeCalls[spy.timeCalls.length - 1];
    expect(lastCall?.index, 'onChange must report segment 1').toBe(1);
    expect(lastCall?.value, 'onChange must report a value below the initial 106').toBeLessThan(106);
  });
});
