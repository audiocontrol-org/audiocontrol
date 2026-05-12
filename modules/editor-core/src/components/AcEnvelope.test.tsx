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
    // 8 rows; header uses ac-envelope-table__header (not __row), so 8 not 9
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
    // Active row count: exactly 1 row marked active
    const activeCount = (html.match(/data-active="true"/g) ?? []).length;
    // Includes axis tick + table row + pip; minimum 2 (table row + axis), at least 1 from table
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

  it('emits onPointSelect when a segment number is clicked', () => {
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
    const rows = container.querySelectorAll('.ac-envelope-table__row');
    // First row is segment 1; click it
    const row = rows[0];
    if (row === undefined) {
      throw new Error('AcEnvelope did not render any table rows');
    }
    fireEvent.click(row);
    expect(onPointSelect).toHaveBeenCalledWith(1);
  });

  it('emits onSustainChange when a pip in the sustain row is clicked', () => {
    const onSustainChange = vi.fn();
    const { container } = render(
      <AcEnvelope
        label="A"
        segments={SEGMENTS}
        sustainSegment={5}
        endSegment={8}
        activeSegment={1}
        onSustainChange={onSustainChange}
      />,
    );
    const pipGroups = container.querySelectorAll('.ac-envelope-meta__pips');
    const sustainPips = pipGroups[0];
    if (sustainPips === undefined) {
      throw new Error('AcEnvelope did not render sustain pip row');
    }
    const pipThree = sustainPips.querySelectorAll('.ac-envelope-meta__pip')[2];
    if (pipThree === undefined) {
      throw new Error('AcEnvelope did not render expected pip count');
    }
    fireEvent.click(pipThree);
    expect(onSustainChange).toHaveBeenCalledWith(3);
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
    // Disabled count: pips 5..8 in the sustain row = 4. End row: pips 5..8 also
    // disabled because totalSegments=8 and endSegment=4? No: end row maxEnabled
    // is totalSegments, so end row pips are ALL enabled. So 4 disabled total.
    const disabledCount = (html.match(/data-disabled="true"/g) ?? []).length;
    expect(disabledCount).toBe(4);
  });
});
