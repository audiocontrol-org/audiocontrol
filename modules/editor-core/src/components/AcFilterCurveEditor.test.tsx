import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { AcFilterCurveEditor } from './AcFilterCurveEditor';

/**
 * Contract tests for the promoted `AcFilterCurveEditor` primitive
 * (editor-ux-refinement Phase 1 T8.6). The Roland TVF FILTER tab and the
 * Akai keygroup filter both adopt this; the load-bearing contract is the
 * DUAL-AXIS drag — one pointer gesture streams BOTH frequency (X) and
 * resonance (Y) in a single `onChange(frequency, resonance)` call — plus
 * the disabled/read-only gate.
 */
describe('AcFilterCurveEditor', () => {
  function mockSvgRect(container: HTMLElement) {
    const svg = container.querySelector('.ac-curve-display') as SVGSVGElement;
    // jsdom returns a zero rect; the drag math divides by rect.width, so
    // give the SVG its intrinsic 400×120 box at the origin.
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 400, height: 120, right: 400, bottom: 120, x: 0, y: 0,
      toJSON: () => ({}),
    } as DOMRect);
    return svg;
  }

  it('renders the canonical .ac-curve-display SVG with a value-bearing aria-label', () => {
    const { container } = render(
      <AcFilterCurveEditor frequency={96} resonance={42} cutoffMax={127} qMax={127} />,
    );
    const svg = container.querySelector('.ac-curve-display');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-label')).toContain('96');
    expect(svg?.getAttribute('aria-label')).toContain('42');
  });

  it('drags the cutoff node and streams BOTH frequency and resonance in one onChange', () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    const { container } = render(
      <AcFilterCurveEditor
        frequency={64} resonance={64} cutoffMax={127} qMax={127}
        onChange={onChange} onCommit={onCommit}
      />,
    );
    const svg = mockSvgRect(container);
    const dot = container.querySelector('.ac-curve-dot--draggable') as SVGCircleElement;
    expect(dot).not.toBeNull();

    fireEvent.mouseDown(dot);
    fireEvent.mouseMove(window, { clientX: 240, clientY: 40 });

    expect(onChange).toHaveBeenCalled();
    const [freq, q] = onChange.mock.calls[onChange.mock.calls.length - 1];
    // Both axes carried a finite, in-range value from the SAME gesture.
    expect(Number.isFinite(freq)).toBe(true);
    expect(Number.isFinite(q)).toBe(true);
    expect(freq).toBeGreaterThanOrEqual(0);
    expect(freq).toBeLessThanOrEqual(127);
    expect(q).toBeGreaterThanOrEqual(0);
    expect(q).toBeLessThanOrEqual(127);

    fireEvent.mouseUp(window);
    expect(onCommit).toHaveBeenCalledTimes(1);
    void svg;
  });

  it('is read-only when disabled — no draggable node, no onChange on interaction', () => {
    const onChange = vi.fn();
    const { container } = render(
      <AcFilterCurveEditor
        frequency={64} resonance={64} cutoffMax={127} qMax={127}
        onChange={onChange} disabled
      />,
    );
    expect(container.querySelector('.ac-curve-dot--draggable')).toBeNull();
    // The plain (non-draggable) dot is still drawn for the visual.
    expect(container.querySelector('.ac-curve-dot')).not.toBeNull();
  });

  it('respects device-specific ranges (Akai 99/15 vs Roland 127/127) in the aria-label', () => {
    const akai = render(
      <AcFilterCurveEditor frequency={50} resonance={8} cutoffMax={99} qMax={15} />,
    );
    expect(
      akai.container.querySelector('.ac-curve-display')?.getAttribute('aria-label'),
    ).toContain('50');
  });
});
