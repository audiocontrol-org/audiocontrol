import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { AcEnvelope, type AcEnvelopeSegment } from './AcEnvelope';

afterEach(() => {
  cleanup();
});

const SEGMENTS: AcEnvelopeSegment[] = [
  { time: 15, level: 127 },
  { time: 22, level: 96 },
  { time: 18, level: 82 },
  { time: 30, level: 70 },
  { time: 22, level: 82 },
  { time: 18, level: 68 },
  { time: 20, level: 58 },
  { time: 42, level: 0 },
];

/** Render the envelope and return the sustain-row pip elements for keyboard tests. */
function renderWithSustainPips(
  sustainHandler: ((index: number) => void) | undefined,
  endSegment = 8,
): { pips: NodeListOf<HTMLSpanElement> } {
  const { container } = render(
    <AcEnvelope
      label="A"
      segments={SEGMENTS}
      sustainSegment={5}
      endSegment={endSegment}
      activeSegment={1}
      onSustainChange={sustainHandler}
    />,
  );
  const pipGroups = container.querySelectorAll('.ac-envelope-meta__pips');
  const sustainPips = pipGroups[0];
  if (sustainPips === undefined) {
    throw new Error('AcEnvelope did not render sustain pip row');
  }
  const pips = sustainPips.querySelectorAll<HTMLSpanElement>(
    '.ac-envelope-meta__pip',
  );
  if (pips.length === 0) {
    throw new Error('AcEnvelope did not render any sustain pips');
  }
  return { pips };
}

describe('AcEnvelope', () => {
  it('renders graph, meta, and table sub-surfaces', () => {
    const html = renderToStaticMarkup(
      <AcEnvelope
        label="TVF · 8-SEGMENT"
        segments={SEGMENTS}
        sustainSegment={5}
        endSegment={8}
        activeSegment={2}
      />,
    );
    expect(html).toContain('ac-envelope');
    expect(html).toContain('ac-envelope-graph');
    expect(html).toContain('TVF · 8-SEGMENT');
    expect(html).toContain('ac-envelope-meta');
    expect(html).toContain('ac-envelope-table');
  });

  it('renders 8 segment rows when endSegment is 8', () => {
    const html = renderToStaticMarkup(
      <AcEnvelope
        label="TVA · 8-SEGMENT"
        segments={SEGMENTS}
        sustainSegment={3}
        endSegment={8}
        activeSegment={1}
      />,
    );
    const rowCount = (html.match(/ac-envelope-table__row(?!_)/g) ?? []).length;
    expect(rowCount).toBe(8);
  });

  it('clamps activeSegment within bounds', () => {
    const html = renderToStaticMarkup(
      <AcEnvelope
        label="X"
        segments={SEGMENTS}
        sustainSegment={5}
        endSegment={8}
        activeSegment={999}
      />,
    );
    const activeCount = (html.match(/data-active="true"/g) ?? []).length;
    expect(activeCount).toBeGreaterThanOrEqual(2);
  });

  it('throws when receiving a non-finite segment index', () => {
    expect(() =>
      renderToStaticMarkup(
        <AcEnvelope
          label="X"
          segments={SEGMENTS}
          sustainSegment={Number.NaN}
          endSegment={8}
          activeSegment={1}
        />,
      ),
    ).toThrow(/non-finite segment index/);
  });

  it('renders the sustain marker label on the sustain segment', () => {
    const html = renderToStaticMarkup(
      <AcEnvelope
        label="TVF"
        segments={SEGMENTS}
        sustainSegment={4}
        endSegment={8}
        activeSegment={2}
      />,
    );
    expect(html).toContain('ac-envelope-sustain-label');
    expect(html).toContain('SUS');
  });

  it('renders the expand button only when onExpand is provided', () => {
    const withExpand = renderToStaticMarkup(
      <AcEnvelope
        label="A"
        segments={SEGMENTS}
        sustainSegment={5}
        endSegment={8}
        activeSegment={1}
        onExpand={() => {}}
      />,
    );
    expect(withExpand).toContain('ac-envelope-graph__expand');

    const withoutExpand = renderToStaticMarkup(
      <AcEnvelope
        label="A"
        segments={SEGMENTS}
        sustainSegment={5}
        endSegment={8}
        activeSegment={1}
      />,
    );
    expect(withoutExpand).not.toContain('ac-envelope-graph__expand');
  });

  it('emits onPointSelect when the segment-number button is clicked', () => {
    const onPointSelect = vi.fn();
    const { container } = render(
      <AcEnvelope
        label="A"
        segments={SEGMENTS}
        sustainSegment={5}
        endSegment={8}
        activeSegment={1}
        onPointSelect={onPointSelect}
      />,
    );
    const segButton = container.querySelector<HTMLButtonElement>(
      '.ac-envelope-table__row .ac-envelope-table__seg',
    );
    if (segButton === null) {
      throw new Error('AcEnvelope did not render the segment-select button');
    }
    fireEvent.click(segButton);
    expect(onPointSelect).toHaveBeenCalledWith(1);
  });

  it('row-level clicks do NOT trigger onPointSelect (only the seg button does)', () => {
    const onPointSelect = vi.fn();
    const { container } = render(
      <AcEnvelope
        label="A"
        segments={SEGMENTS}
        sustainSegment={5}
        endSegment={8}
        activeSegment={1}
        onPointSelect={onPointSelect}
      />,
    );
    const row = container.querySelector('.ac-envelope-table__row');
    if (row === null) {
      throw new Error('AcEnvelope did not render any table rows');
    }
    const cells = row.querySelectorAll('.ac-envelope-table__cell');
    const firstCell = cells[0];
    if (firstCell === undefined) {
      throw new Error('AcEnvelope did not render expected cell layout');
    }
    fireEvent.click(firstCell);
    expect(onPointSelect).not.toHaveBeenCalled();
  });

  it('clicking a segment-number button at index N invokes onPointSelect(N)', () => {
    const onPointSelect = vi.fn();
    const { container } = render(
      <AcEnvelope
        label="A"
        segments={SEGMENTS}
        sustainSegment={5}
        endSegment={8}
        activeSegment={1}
        onPointSelect={onPointSelect}
      />,
    );
    const segButtons = container.querySelectorAll<HTMLButtonElement>(
      '.ac-envelope-table__row .ac-envelope-table__seg',
    );
    const target = segButtons[2];
    if (target === undefined) {
      throw new Error('AcEnvelope did not render expected seg buttons');
    }
    // Native <button> exposes click + Enter + Space via the browser; click()
    // is the canonical activation path and exercises the same handler.
    target.click();
    expect(onPointSelect).toHaveBeenCalledWith(3);
  });

  it('seg button reflects active state via aria-pressed', () => {
    const html = renderToStaticMarkup(
      <AcEnvelope
        label="A"
        segments={SEGMENTS}
        sustainSegment={5}
        endSegment={8}
        activeSegment={3}
      />,
    );
    expect(html).toMatch(/aria-pressed="true"/);
  });

  it('emits onSustainChange when a pip in the sustain row is clicked', () => {
    const onSustainChange = vi.fn();
    const { pips } = renderWithSustainPips(onSustainChange);
    const pipThree = pips[2];
    if (pipThree === undefined) {
      throw new Error('AcEnvelope did not render expected pip count');
    }
    fireEvent.click(pipThree);
    expect(onSustainChange).toHaveBeenCalledWith(3);
  });

  it('Space on a sustain pip activates onSustainChange', () => {
    const onSustainChange = vi.fn();
    const { pips } = renderWithSustainPips(onSustainChange);
    fireEvent.keyDown(pips[3]!, { key: ' ' });
    expect(onSustainChange).toHaveBeenCalledWith(4);
  });

  it('Enter on a sustain pip activates onSustainChange', () => {
    const onSustainChange = vi.fn();
    const { pips } = renderWithSustainPips(onSustainChange);
    fireEvent.keyDown(pips[1]!, { key: 'Enter' });
    expect(onSustainChange).toHaveBeenCalledWith(2);
  });

  it('ArrowRight on a sustain pip moves selection to the next enabled pip', () => {
    const onSustainChange = vi.fn();
    const { pips } = renderWithSustainPips(onSustainChange);
    fireEvent.keyDown(pips[4]!, { key: 'ArrowRight' });
    expect(onSustainChange).toHaveBeenCalledWith(6);
  });

  it('ArrowDown navigates like ArrowRight', () => {
    const onSustainChange = vi.fn();
    const { pips } = renderWithSustainPips(onSustainChange);
    fireEvent.keyDown(pips[2]!, { key: 'ArrowDown' });
    expect(onSustainChange).toHaveBeenCalledWith(4);
  });

  it('ArrowRight from the last pip wraps to the first enabled pip', () => {
    const onEndChange = vi.fn();
    const { container } = render(
      <AcEnvelope
        label="A"
        segments={SEGMENTS}
        sustainSegment={5}
        endSegment={8}
        activeSegment={1}
        onEndChange={onEndChange}
      />,
    );
    const pipGroups = container.querySelectorAll('.ac-envelope-meta__pips');
    const endPips = pipGroups[1];
    if (endPips === undefined) {
      throw new Error('AcEnvelope did not render end pip row');
    }
    const pipEight = endPips.querySelectorAll('.ac-envelope-meta__pip')[7];
    if (pipEight === undefined) {
      throw new Error('AcEnvelope did not render expected pip count');
    }
    fireEvent.keyDown(pipEight, { key: 'ArrowRight' });
    expect(onEndChange).toHaveBeenCalledWith(1);
  });

  it('ArrowLeft on the first sustain pip wraps to the last enabled pip', () => {
    const onSustainChange = vi.fn();
    const { pips } = renderWithSustainPips(onSustainChange, 6);
    fireEvent.keyDown(pips[0]!, { key: 'ArrowLeft' });
    // endSegment=6, so the last enabled sustain pip is 6.
    expect(onSustainChange).toHaveBeenCalledWith(6);
  });

  it('ArrowUp navigates like ArrowLeft', () => {
    const onSustainChange = vi.fn();
    const { pips } = renderWithSustainPips(onSustainChange);
    fireEvent.keyDown(pips[3]!, { key: 'ArrowUp' });
    expect(onSustainChange).toHaveBeenCalledWith(3);
  });

  it('Home jumps to the first enabled pip', () => {
    const onSustainChange = vi.fn();
    const { pips } = renderWithSustainPips(onSustainChange);
    fireEvent.keyDown(pips[4]!, { key: 'Home' });
    expect(onSustainChange).toHaveBeenCalledWith(1);
  });

  it('End jumps to the last enabled pip', () => {
    const onSustainChange = vi.fn();
    const { pips } = renderWithSustainPips(onSustainChange, 6);
    fireEvent.keyDown(pips[0]!, { key: 'End' });
    // endSegment=6, so the last enabled pip is 6.
    expect(onSustainChange).toHaveBeenCalledWith(6);
  });

  it('arrow navigation skips disabled pips', () => {
    const onSustainChange = vi.fn();
    const { pips } = renderWithSustainPips(onSustainChange, 4);
    fireEvent.keyDown(pips[3]!, { key: 'ArrowRight' });
    // From pip 4, ArrowRight should wrap to 1 (pips 5..8 disabled).
    expect(onSustainChange).toHaveBeenCalledWith(1);
  });

  it('exactly one pip per row carries tabIndex=0 (roving tabindex)', () => {
    const { container } = render(
      <AcEnvelope
        label="A"
        segments={SEGMENTS}
        sustainSegment={5}
        endSegment={8}
        activeSegment={1}
      />,
    );
    const pipGroups = container.querySelectorAll('.ac-envelope-meta__pips');
    expect(pipGroups.length).toBe(2);
    pipGroups.forEach((group) => {
      const pips = group.querySelectorAll('.ac-envelope-meta__pip');
      const focusable: Element[] = [];
      pips.forEach((p) => {
        if (p.getAttribute('tabindex') === '0') {
          focusable.push(p);
        }
      });
      expect(focusable.length).toBe(1);
    });
  });

  it('disables sustain pips beyond endSegment', () => {
    const html = renderToStaticMarkup(
      <AcEnvelope
        label="A"
        segments={SEGMENTS.slice(0, 4)}
        sustainSegment={2}
        endSegment={4}
        activeSegment={2}
      />,
    );
    const disabledCount = (html.match(/data-disabled="true"/g) ?? []).length;
    expect(disabledCount).toBe(4);
  });

  it('renders selectable graph points as native button with aria-pressed', () => {
    const { container } = render(
      <AcEnvelope
        label="A"
        segments={SEGMENTS}
        sustainSegment={5}
        endSegment={8}
        activeSegment={3}
      />,
    );
    const pointButtons = container.querySelectorAll<HTMLButtonElement>(
      '.ac-envelope-points button.ac-envelope-point',
    );
    // The 8 segments map to 8 selectable point buttons; segment 0 is the
    // anchor and renders as a non-interactive aria-hidden span.
    expect(pointButtons.length).toBe(8);
    const activeButton = container.querySelector<HTMLButtonElement>(
      '.ac-envelope-points button.ac-envelope-point--active',
    );
    expect(activeButton).not.toBeNull();
    expect(activeButton?.getAttribute('aria-pressed')).toBe('true');
  });

  it('pointer-down on a graph point button triggers onPointSelect', () => {
    const onPointSelect = vi.fn();
    const { container } = render(
      <AcEnvelope
        label="A"
        segments={SEGMENTS}
        sustainSegment={5}
        endSegment={8}
        activeSegment={1}
        onPointSelect={onPointSelect}
      />,
    );
    const pointButtons = container.querySelectorAll<HTMLButtonElement>(
      '.ac-envelope-points button.ac-envelope-point',
    );
    const target = pointButtons[3];
    if (target === undefined) {
      throw new Error('AcEnvelope did not render expected graph point buttons');
    }
    // The graph point's select callback is wired to onPointerDown (so the
    // same handler that begins a drag also selects the segment for the
    // "press without movement" case). fireEvent.click would NOT trigger
    // it because the button has no onClick prop — only onPointerDown.
    fireEvent.pointerDown(target);
    // Index 3 in the NodeList is segment 4 (segment 0 anchor is not a button).
    expect(onPointSelect).toHaveBeenCalledWith(4);
  });

  // ---------------------------------------------------------------------
  // disabled prop — important for tone editor "Enable Filter = off" path.
  // pointer-events-none blocks mouse but NOT keyboard, so the only safe
  // disable gate is on the elements themselves (tabIndex=-1 on pip spans;
  // native disabled attribute on graph + table buttons).
  // ---------------------------------------------------------------------

  it('disabled root carries data-disabled="true" so CSS can dim', () => {
    const { container } = render(
      <AcEnvelope
        label="A"
        segments={SEGMENTS}
        sustainSegment={5}
        endSegment={8}
        activeSegment={1}
        disabled
      />,
    );
    const root = container.querySelector('.ac-envelope');
    expect(root?.getAttribute('data-disabled')).toBe('true');
  });

  it('disabled meta pips all carry tabIndex=-1 (no keyboard tab stop)', () => {
    const { container } = render(
      <AcEnvelope
        label="A"
        segments={SEGMENTS}
        sustainSegment={5}
        endSegment={8}
        activeSegment={1}
        disabled
      />,
    );
    const pips = container.querySelectorAll<HTMLSpanElement>('.ac-envelope-meta__pip');
    expect(pips.length).toBe(16); // 8 sustain + 8 end
    pips.forEach((pip) => {
      expect(pip.getAttribute('tabindex')).toBe('-1');
      expect(pip.getAttribute('aria-disabled')).toBe('true');
    });
  });

  it('disabled meta radiogroup carries aria-disabled', () => {
    const { container } = render(
      <AcEnvelope
        label="A"
        segments={SEGMENTS}
        sustainSegment={5}
        endSegment={8}
        activeSegment={1}
        disabled
      />,
    );
    const groups = container.querySelectorAll('.ac-envelope-meta__pips');
    expect(groups.length).toBe(2);
    groups.forEach((group) => {
      expect(group.getAttribute('aria-disabled')).toBe('true');
    });
  });

  it('disabled meta pip click does NOT fire onSustainChange', () => {
    const onSustainChange = vi.fn();
    const { pips } = renderWithSustainPipsDisabled(onSustainChange);
    fireEvent.click(pips[2]!);
    expect(onSustainChange).not.toHaveBeenCalled();
  });

  it('disabled meta pip keyboard activation does NOT fire onSustainChange', () => {
    const onSustainChange = vi.fn();
    const { pips } = renderWithSustainPipsDisabled(onSustainChange);
    fireEvent.keyDown(pips[3]!, { key: ' ' });
    fireEvent.keyDown(pips[3]!, { key: 'Enter' });
    fireEvent.keyDown(pips[3]!, { key: 'ArrowRight' });
    fireEvent.keyDown(pips[3]!, { key: 'Home' });
    expect(onSustainChange).not.toHaveBeenCalled();
  });

  it('disabled meta pip keyboard activation does NOT fire onEndChange', () => {
    const onEndChange = vi.fn();
    const { container } = render(
      <AcEnvelope
        label="A"
        segments={SEGMENTS}
        sustainSegment={5}
        endSegment={8}
        activeSegment={1}
        onEndChange={onEndChange}
        disabled
      />,
    );
    const pipGroups = container.querySelectorAll('.ac-envelope-meta__pips');
    const endPips = pipGroups[1]?.querySelectorAll<HTMLSpanElement>(
      '.ac-envelope-meta__pip',
    );
    if (endPips === undefined) {
      throw new Error('AcEnvelope did not render end pips');
    }
    fireEvent.click(endPips[2]!);
    fireEvent.keyDown(endPips[2]!, { key: ' ' });
    fireEvent.keyDown(endPips[2]!, { key: 'ArrowRight' });
    expect(onEndChange).not.toHaveBeenCalled();
  });

  it('disabled graph point buttons carry the HTML disabled attribute', () => {
    const { container } = render(
      <AcEnvelope
        label="A"
        segments={SEGMENTS}
        sustainSegment={5}
        endSegment={8}
        activeSegment={1}
        onPointSelect={vi.fn()}
        disabled
      />,
    );
    const pointButtons = container.querySelectorAll<HTMLButtonElement>(
      '.ac-envelope-points button.ac-envelope-point',
    );
    expect(pointButtons.length).toBe(8);
    pointButtons.forEach((btn) => {
      expect(btn.disabled).toBe(true);
    });
  });

  it('disabled graph point button clicks do NOT fire onPointSelect', () => {
    const onPointSelect = vi.fn();
    const { container } = render(
      <AcEnvelope
        label="A"
        segments={SEGMENTS}
        sustainSegment={5}
        endSegment={8}
        activeSegment={1}
        onPointSelect={onPointSelect}
        disabled
      />,
    );
    const pointButton = container.querySelector<HTMLButtonElement>(
      '.ac-envelope-points button.ac-envelope-point',
    );
    if (pointButton === null) {
      throw new Error('AcEnvelope did not render point buttons');
    }
    fireEvent.click(pointButton);
    expect(onPointSelect).not.toHaveBeenCalled();
  });

  it('disabled table seg buttons carry the HTML disabled attribute', () => {
    const { container } = render(
      <AcEnvelope
        label="A"
        segments={SEGMENTS}
        sustainSegment={5}
        endSegment={8}
        activeSegment={1}
        onPointSelect={vi.fn()}
        disabled
      />,
    );
    const segButtons = container.querySelectorAll<HTMLButtonElement>(
      '.ac-envelope-table__row .ac-envelope-table__seg',
    );
    expect(segButtons.length).toBe(8);
    segButtons.forEach((btn) => {
      expect(btn.disabled).toBe(true);
    });
  });

  it('disabled table seg button clicks do NOT fire onPointSelect', () => {
    const onPointSelect = vi.fn();
    const { container } = render(
      <AcEnvelope
        label="A"
        segments={SEGMENTS}
        sustainSegment={5}
        endSegment={8}
        activeSegment={1}
        onPointSelect={onPointSelect}
        disabled
      />,
    );
    const segButton = container.querySelector<HTMLButtonElement>(
      '.ac-envelope-table__row .ac-envelope-table__seg',
    );
    if (segButton === null) {
      throw new Error('AcEnvelope did not render seg buttons');
    }
    fireEvent.click(segButton);
    expect(onPointSelect).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------
  // AUDIT-20260524-15: activeSegment = null path. Some consumers (the
  // akai filter envelope is the in-tree example) drag-edit points but
  // have NO segment-selection model. Passing a numeric index — and
  // especially the 0 sentinel the akai migration started with — coerces
  // to segment 1 and creates a permanent false-active highlight. The
  // null path is the canonical "no active segment" channel.
  //
  // Validator-paired-changes discipline: each of these tests must FAIL
  // against the pre-extension contract (where activeSegment was `number`
  // and the clamp helper coerced anything <1 to 1). Confirmed during
  // implementation by stashing the production-code diff and re-running
  // this block — all three new assertions failed with "expected 'true'
  // to be 'false'" against the pre-fix code path.
  // ---------------------------------------------------------------------

  it('activeSegment={null} renders NO segment row as active', () => {
    const { container } = render(
      <AcEnvelope
        label="A"
        segments={SEGMENTS}
        sustainSegment={5}
        endSegment={8}
        activeSegment={null}
      />,
    );
    // Every table row must report data-active="false". Pre-fix, the
    // primitive coerced null → 1 and segment 1's row reported "true".
    const rows = container.querySelectorAll('.ac-envelope-table__row');
    expect(rows.length).toBe(8);
    rows.forEach((row) => {
      expect(row.getAttribute('data-active')).toBe('false');
    });
    // Every selectable graph point button must report aria-pressed="false".
    // The button class `ac-envelope-point--active` must be absent.
    const pointButtons = container.querySelectorAll<HTMLButtonElement>(
      '.ac-envelope-points button.ac-envelope-point',
    );
    expect(pointButtons.length).toBe(8);
    pointButtons.forEach((btn) => {
      expect(btn.getAttribute('aria-pressed')).toBe('false');
      expect(btn.classList.contains('ac-envelope-point--active')).toBe(false);
    });
    // The active vertical guide line must NOT be in the SVG.
    expect(container.querySelector('.ac-envelope-active-guide')).toBeNull();
    // No axis tick should carry the --active modifier class.
    const activeTicks = container.querySelectorAll(
      '.ac-envelope-axis-tick--active',
    );
    expect(activeTicks.length).toBe(0);
    // The graph region's aria-label must drop the "segment N active"
    // suffix when no segment is active.
    const region = container.querySelector('.ac-envelope-graph');
    expect(region?.getAttribute('aria-label')).not.toMatch(/active/);
  });

  it('activeSegment={null} keeps every seg button aria-pressed="false" (no row hijacks the toggle state)', () => {
    const { container } = render(
      <AcEnvelope
        label="A"
        segments={SEGMENTS}
        sustainSegment={5}
        endSegment={8}
        activeSegment={null}
        onPointSelect={vi.fn()}
      />,
    );
    const segButtons = container.querySelectorAll<HTMLButtonElement>(
      '.ac-envelope-table__row .ac-envelope-table__seg',
    );
    expect(segButtons.length).toBe(8);
    segButtons.forEach((btn) => {
      expect(btn.getAttribute('aria-pressed')).toBe('false');
    });
  });

  it('activeSegment={1} (the legacy default behavior path) still highlights segment 1 — backwards-compat guard', () => {
    const { container } = render(
      <AcEnvelope
        label="A"
        segments={SEGMENTS}
        sustainSegment={5}
        endSegment={8}
        activeSegment={1}
      />,
    );
    // Segment 1's row + button + axis tick should all read as active;
    // segments 2..8 should not.
    const rows = container.querySelectorAll('.ac-envelope-table__row');
    expect(rows[0]?.getAttribute('data-active')).toBe('true');
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i]?.getAttribute('data-active')).toBe('false');
    }
    const activeButton = container.querySelector(
      '.ac-envelope-points button.ac-envelope-point--active',
    );
    expect(activeButton).not.toBeNull();
    // Region aria-label keeps the "segment 1 active" suffix.
    const region = container.querySelector('.ac-envelope-graph');
    expect(region?.getAttribute('aria-label')).toMatch(/segment 1 active/);
  });
});

function renderWithSustainPipsDisabled(
  sustainHandler: (index: number) => void,
): { pips: NodeListOf<HTMLSpanElement> } {
  const { container } = render(
    <AcEnvelope
      label="A"
      segments={SEGMENTS}
      sustainSegment={5}
      endSegment={8}
      activeSegment={1}
      onSustainChange={sustainHandler}
      disabled
    />,
  );
  const pipGroups = container.querySelectorAll('.ac-envelope-meta__pips');
  const sustainPips = pipGroups[0];
  if (sustainPips === undefined) {
    throw new Error('AcEnvelope did not render sustain pip row');
  }
  const pips = sustainPips.querySelectorAll<HTMLSpanElement>(
    '.ac-envelope-meta__pip',
  );
  if (pips.length === 0) {
    throw new Error('AcEnvelope did not render any sustain pips');
  }
  return { pips };
}
