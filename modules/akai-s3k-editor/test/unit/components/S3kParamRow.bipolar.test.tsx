/**
 * Bipolar fill-arithmetic lock — guards against regressions in the
 * `<AcRangeBar>` bipolar variant's `--ac-range-bar-l` / `--ac-range-bar-w`
 * math (or in the S3kParamRow mapping that selects the bipolar variant).
 *
 * If `AcRangeBar` changes how it expresses the bipolar fill (e.g., switches
 * to a transform-based animation) these snapshots will need to update —
 * but the visual contract (fill from center extending toward value) MUST
 * stay equivalent. Loosening these assertions to "the bar renders" defeats
 * the test's purpose.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { S3kParamRow } from '@/components/ui/S3kParamRow';

function renderBipolar(value: number): HTMLElement {
  const { container } = render(
    <S3kParamRow
      label="Pan"
      value={value}
      min={-50}
      max={50}
      onChange={vi.fn()}
      bipolar
    />,
  );
  const fill = container.querySelector('.ac-range-bar--bipolar .ac-range-bar__fill');
  if (!(fill instanceof HTMLElement)) {
    throw new Error('expected bipolar fill element to render');
  }
  return fill;
}

describe('S3kParamRow bipolar fill arithmetic', () => {
  it('value=-25 → left=25%, width=25% (fills left half-to-center)', () => {
    const fill = renderBipolar(-25);
    expect(fill.style.getPropertyValue('--ac-range-bar-l')).toBe('25%');
    expect(fill.style.getPropertyValue('--ac-range-bar-w')).toBe('25%');
  });

  it('value=25 → left=50%, width=25% (fills center-to-right half)', () => {
    const fill = renderBipolar(25);
    expect(fill.style.getPropertyValue('--ac-range-bar-l')).toBe('50%');
    expect(fill.style.getPropertyValue('--ac-range-bar-w')).toBe('25%');
  });

  it('value=0 → left=50%, width=0% (centered, no fill)', () => {
    const fill = renderBipolar(0);
    expect(fill.style.getPropertyValue('--ac-range-bar-l')).toBe('50%');
    expect(fill.style.getPropertyValue('--ac-range-bar-w')).toBe('0%');
  });

  it('extremes paint full half-bars (value=-50 → left=0%, width=50%)', () => {
    const fill = renderBipolar(-50);
    expect(fill.style.getPropertyValue('--ac-range-bar-l')).toBe('0%');
    expect(fill.style.getPropertyValue('--ac-range-bar-w')).toBe('50%');
  });

  it('extremes paint full half-bars (value=50 → left=50%, width=50%)', () => {
    const fill = renderBipolar(50);
    expect(fill.style.getPropertyValue('--ac-range-bar-l')).toBe('50%');
    expect(fill.style.getPropertyValue('--ac-range-bar-w')).toBe('50%');
  });
});
