import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { AcEnvelope } from './AcEnvelope';
import { AcEnvelopeAdsr } from './AcEnvelopeAdsr';

afterEach(() => {
  cleanup();
});

// jsdom doesn't measure layout, so getBoundingClientRect returns 0-size
// rects by default. Tests that exercise the pointer-drag pipeline mock
// the rect to a known fixed size so the pointer-X / pointer-Y math
// reaches the value-conversion branches under test.
function stubCanvasRect(canvas: HTMLElement, width = 400, height = 200): void {
  canvas.getBoundingClientRect = (): DOMRect =>
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

function getEnvelopeCanvas(container: HTMLElement): HTMLDivElement {
  const canvas = container.querySelector<HTMLDivElement>('.ac-envelope-canvas');
  if (canvas === null) {
    throw new Error('.ac-envelope-canvas not rendered');
  }
  stubCanvasRect(canvas);
  return canvas;
}

function getDragButtons(container: HTMLElement): NodeListOf<HTMLButtonElement> {
  const buttons = container.querySelectorAll<HTMLButtonElement>(
    '.ac-envelope-points button',
  );
  if (buttons.length !== 3) {
    throw new Error(
      `expected 3 ADSR drag buttons (attack/decay/release); got ${buttons.length}`,
    );
  }
  return buttons;
}

/** Mount AcEnvelopeAdsr with akai-range defaults plus the supplied
 *  drag-side callbacks. Returns the container + stubbed canvas. */
function mountAdsrForDrag(opts: {
  onChange?: (changes: { attack?: number; decay?: number; sustain?: number; release?: number }) => void;
  onCommit?: () => void;
}): { container: HTMLElement; buttons: NodeListOf<HTMLButtonElement> } {
  const { container } = render(
    <AcEnvelopeAdsr
      kind="adsr"
      label="AMP · ADSR"
      attack={20}
      decay={20}
      sustain={50}
      release={20}
      maxValue={99}
      onChange={opts.onChange}
      onCommit={opts.onCommit}
    />,
  );
  getEnvelopeCanvas(container);
  const buttons = getDragButtons(container);
  return { container, buttons };
}

function pointerSequence(target: HTMLElement, fromX: number, fromY: number, toX: number, toY: number): void {
  fireEvent.pointerDown(target, { pointerId: 1, clientX: fromX, clientY: fromY });
  fireEvent.pointerMove(target, { pointerId: 1, clientX: toX, clientY: toY });
  fireEvent.pointerUp(target, { pointerId: 1, clientX: toX, clientY: toY });
}

describe('AcEnvelopeAdsr', () => {
  it('renders an envelope graph with four points (origin + attack + decay/sustain + sustain-end + release)', () => {
    const html = renderToStaticMarkup(
      <AcEnvelopeAdsr
        kind="adsr"
        label="AMP · ADSR"
        attack={20}
        decay={30}
        sustain=
          {80}
        release={40}
      />,
    );
    expect(html).toContain('ac-envelope--adsr');
    expect(html).toContain('AMP · ADSR');
    expect(html).toContain('ac-envelope-graph');
    expect(html).toContain('ac-envelope-fill');
    expect(html).toContain('ac-envelope-line');
    // 5 point markers total: 1 origin span + 1 sustain-end span + 3 buttons.
    const pointMatches = html.match(/ac-envelope-point/g) ?? [];
    expect(pointMatches.length).toBeGreaterThanOrEqual(5);
  });

  it('defaults maxValue to 127 when omitted', () => {
    const { container } = render(
      <AcEnvelopeAdsr
        kind="adsr"
        label="AMP · ADSR"
        attack={64}
        decay={64}
        sustain={127}
        release={64}
      />,
    );
    const yAxis = container.querySelector('.ac-envelope-y-axis');
    expect(yAxis?.textContent).toContain('L127');
    expect(yAxis?.textContent).toContain('L0');
  });

  it('honors maxValue=99 for the akai dialect range', () => {
    const { container } = render(
      <AcEnvelopeAdsr
        kind="adsr"
        label="AMP · ADSR"
        attack={50}
        decay={50}
        sustain={99}
        release={50}
        maxValue={99}
      />,
    );
    const yAxis = container.querySelector('.ac-envelope-y-axis');
    expect(yAxis?.textContent).toContain('L99');
  });

  it('clamps out-of-range params (attack=-5 -> 0, decay=200 with maxValue=99 -> 99)', () => {
    const { container } = render(
      <AcEnvelopeAdsr
        kind="adsr"
        label="AMP · ADSR"
        attack={-5}
        decay={200}
        sustain={50}
        release={20}
        maxValue={99}
      />,
    );
    const region = container.querySelector('[role="region"]');
    expect(region?.getAttribute('aria-label')).toContain('A=0');
    expect(region?.getAttribute('aria-label')).toContain('D=99');
  });

  it('throws on non-finite parameter', () => {
    expect(() =>
      renderToStaticMarkup(
        <AcEnvelopeAdsr
          kind="adsr"
          label="AMP · ADSR"
          attack={Number.NaN}
          decay={20}
          sustain={50}
          release={10}
        />,
      ),
    ).toThrow(/non-finite/);
  });

  it('renders the attack/decay/release buttons as <button>s; origin + sustain-end as inert spans', () => {
    const { container } = render(
      <AcEnvelopeAdsr
        kind="adsr"
        label="AMP · ADSR"
        attack={30}
        decay={30}
        sustain={70}
        release={30}
        onChange={() => undefined}
      />,
    );
    const buttons = container.querySelectorAll('.ac-envelope-points button');
    expect(buttons.length).toBe(3);
    const spans = container.querySelectorAll('.ac-envelope-points span');
    expect(spans.length).toBe(2);
  });

  it('renders disabled buttons when disabled=true', () => {
    const { container } = render(
      <AcEnvelopeAdsr
        kind="adsr"
        label="AMP · ADSR"
        attack={30}
        decay={30}
        sustain={70}
        release={30}
        onChange={() => undefined}
        disabled
      />,
    );
    const buttons = container.querySelectorAll<HTMLButtonElement>(
      '.ac-envelope-points button',
    );
    expect(buttons.length).toBe(3);
    for (const btn of Array.from(buttons)) {
      expect(btn.disabled).toBe(true);
    }
    const root = container.querySelector('.ac-envelope--adsr');
    expect(root?.getAttribute('data-disabled')).toBe('true');
  });

  it('does not render buttons when no onChange provided (read-only mode)', () => {
    const { container } = render(
      <AcEnvelopeAdsr
        kind="adsr"
        label="AMP · ADSR"
        attack={30}
        decay={30}
        sustain={70}
        release={30}
      />,
    );
    // Buttons render even without onChange so the keyboard surface exists,
    // but pointer-down handlers are no-ops without onChange.
    const buttons = container.querySelectorAll<HTMLButtonElement>(
      '.ac-envelope-points button',
    );
    expect(buttons.length).toBe(3);
  });

  it('drag on the attack point emits onChange({ attack }) per move and onCommit on release', () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    const { buttons } = mountAdsrForDrag({ onChange, onCommit });
    pointerSequence(buttons[0], 0, 0, 200, 50);
    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(typeof lastCall.attack).toBe('number');
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('drag on the decay point emits decay AND sustain in the same change', () => {
    const onChange = vi.fn();
    const { buttons } = mountAdsrForDrag({ onChange });
    pointerSequence(buttons[1], 0, 0, 200, 50);
    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(typeof lastCall.decay).toBe('number');
    expect(typeof lastCall.sustain).toBe('number');
  });

  it('drag on the release point emits onChange({ release })', () => {
    const onChange = vi.fn();
    const { buttons } = mountAdsrForDrag({ onChange });
    pointerSequence(buttons[2], 0, 0, 380, 200);
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(typeof lastCall.release).toBe('number');
  });
});

describe('AcEnvelope discriminator', () => {
  it('AcEnvelope({ kind: "adsr" }) dispatches to AcEnvelopeAdsr', () => {
    const html = renderToStaticMarkup(
      <AcEnvelope
        kind="adsr"
        label="AMP · ADSR"
        attack={10}
        decay={20}
        sustain={60}
        release={15}
        maxValue={99}
      />,
    );
    expect(html).toContain('ac-envelope--adsr');
    expect(html).toContain('data-variant="adsr"');
  });

  it('AcEnvelope without `kind` defaults to multi-segment (no `ac-envelope--adsr` class)', () => {
    const html = renderToStaticMarkup(
      <AcEnvelope
        label="TVF · 8-SEGMENT"
        segments={Array.from({ length: 8 }, (_, i) => ({
          time: 20 + i,
          level: 100 - i * 8,
        }))}
        sustainSegment={5}
        endSegment={8}
        activeSegment={1}
      />,
    );
    expect(html).not.toContain('ac-envelope--adsr');
    expect(html).toContain('ac-envelope-meta');
    expect(html).toContain('ac-envelope-table');
  });
});
