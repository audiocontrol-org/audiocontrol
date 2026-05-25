import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { AcFrequencyResponse, type AcFrequencyResponseFilterType } from './AcFrequencyResponse';
import { stubElementRect } from './__test-utils__/envelopeTestHelpers';

afterEach(() => {
  cleanup();
});

function getDragNode(container: HTMLElement): HTMLButtonElement {
  const canvas = container.querySelector<HTMLDivElement>('.ac-envelope-canvas');
  if (canvas === null) throw new Error('.ac-envelope-canvas not rendered');
  stubElementRect(canvas);
  const btn = container.querySelector<HTMLButtonElement>(
    '.ac-envelope-points button',
  );
  if (btn === null) throw new Error('drag node button missing');
  return btn;
}

describe('AcFrequencyResponse', () => {
  it('renders the canonical envelope-graph chrome with fill + line + drag node', () => {
    const html = renderToStaticMarkup(
      <AcFrequencyResponse frequency={1000} resonance={5} />,
    );
    expect(html).toContain('ac-frequency-response');
    expect(html).toContain('ac-envelope-graph');
    expect(html).toContain('ac-envelope-fill');
    expect(html).toContain('ac-envelope-line');
    expect(html).toContain('ac-envelope-point');
  });

  it('defaults to lowpass filter with the canonical eyebrow', () => {
    const html = renderToStaticMarkup(
      <AcFrequencyResponse frequency={1000} resonance={5} />,
    );
    expect(html).toContain('FILTER · LPF');
    expect(html).toContain('data-filter-type="lowpass"');
  });

  it.each<[AcFrequencyResponseFilterType, string]>([
    ['lowpass', 'FILTER · LPF'],
    ['highpass', 'FILTER · HPF'],
    ['bandpass', 'FILTER · BPF'],
    ['notch', 'FILTER · NOTCH'],
  ])('renders the %s filter with the right default eyebrow', (filterType, label) => {
    const html = renderToStaticMarkup(
      <AcFrequencyResponse frequency={1000} resonance={5} filterType={filterType} />,
    );
    expect(html).toContain(label);
    expect(html).toContain(`data-filter-type="${filterType}"`);
  });

  it('honors a custom freqRange + resonanceRange + dbRange', () => {
    const { container } = render(
      <AcFrequencyResponse
        frequency={500}
        resonance={50}
        freqRange={{ min: 100, max: 10_000 }}
        resonanceRange={{ min: 0, max: 100 }}
        dbRange={{ min: -12, max: 12 }}
      />,
    );
    expect(container.querySelector('.ac-frequency-response')).not.toBeNull();
  });

  it('clamps out-of-range frequency to the range bounds', () => {
    const { container } = render(
      <AcFrequencyResponse
        frequency={50_000}
        resonance={5}
        freqRange={{ min: 20, max: 20_000 }}
      />,
    );
    const region = container.querySelector('[role="region"]');
    // 20000 Hz cap reached.
    expect(region?.getAttribute('aria-label')).toContain('Freq=20000Hz');
  });

  it('throws on non-finite frequency', () => {
    expect(() =>
      renderToStaticMarkup(
        <AcFrequencyResponse frequency={Number.POSITIVE_INFINITY} resonance={5} />,
      ),
    ).toThrow(/non-finite/);
  });

  it('does not render a button click target when disabled=true (HTML disabled)', () => {
    const { container } = render(
      <AcFrequencyResponse
        frequency={1000}
        resonance={5}
        onChange={() => undefined}
        disabled
      />,
    );
    const btn = container.querySelector<HTMLButtonElement>(
      '.ac-envelope-points button',
    );
    expect(btn?.disabled).toBe(true);
    const root = container.querySelector('.ac-frequency-response');
    expect(root?.getAttribute('data-disabled')).toBe('true');
  });

  it('drag emits onChange({ frequency, resonance }) per move and onCommit on release', () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    const { container } = render(
      <AcFrequencyResponse
        frequency={1000}
        resonance={5}
        freqRange={{ min: 20, max: 20_000 }}
        resonanceRange={{ min: 0, max: 15 }}
        onChange={onChange}
        onCommit={onCommit}
      />,
    );
    const btn = getDragNode(container);
    fireEvent.pointerDown(btn, { pointerId: 1, clientX: 0, clientY: 100 });
    fireEvent.pointerMove(btn, { pointerId: 1, clientX: 300, clientY: 30 });
    fireEvent.pointerUp(btn, { pointerId: 1, clientX: 300, clientY: 30 });
    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(typeof lastCall.frequency).toBe('number');
    expect(typeof lastCall.resonance).toBe('number');
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('drag without onChange does nothing (read-only mode)', () => {
    const { container } = render(
      <AcFrequencyResponse frequency={1000} resonance={5} />,
    );
    const btn = container.querySelector<HTMLButtonElement>(
      '.ac-envelope-points button',
    );
    if (btn === null) throw new Error('drag node missing');
    expect(() =>
      fireEvent.pointerDown(btn, { pointerId: 1, clientX: 0, clientY: 0 }),
    ).not.toThrow();
  });

  it('renders a custom label when supplied', () => {
    const html = renderToStaticMarkup(
      <AcFrequencyResponse
        frequency={1000}
        resonance={5}
        label="AMP · FILTER"
      />,
    );
    expect(html).toContain('AMP · FILTER');
  });
});
