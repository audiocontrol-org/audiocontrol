/**
 * Test helpers shared by AcEnvelopeAdsr.test.tsx and
 * AcFrequencyResponse.test.tsx (akai-harmonization Phase 2 task 2.2 —
 * AcEnvelope variants + AcFrequencyResponse landing dispatch).
 *
 * jsdom doesn't perform layout, so getBoundingClientRect returns
 * zero-sized rects by default. The drag pipeline in both components
 * bails when the canvas measures zero, so tests must stub the rect to
 * a known fixed size before firing pointer events. The helper here
 * centralizes the stub so the test files don't ship duplicate copies.
 */

/**
 * Replace the element's getBoundingClientRect with a stable fixed-size
 * mock. Most drag tests pass `width=400, height=200` so percentages
 * resolve to round numbers; the defaults match.
 */
export function stubElementRect(
  element: HTMLElement,
  width = 400,
  height = 200,
): void {
  element.getBoundingClientRect = (): DOMRect =>
    ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      width,
      height,
      toJSON: () => ({}),
    } as DOMRect);
}
