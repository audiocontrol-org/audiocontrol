import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { AcNumberInput } from './AcNumberInput';

afterEach(() => {
  cleanup();
});

describe('AcNumberInput read-only', () => {
  it('renders a span with the formatted value and unit', () => {
    const html = renderToStaticMarkup(
      <AcNumberInput value={42} unit="smp" />,
    );
    expect(html).toContain('ac-number-input');
    expect(html).toContain('ac-number-input__value');
    expect(html).toContain('>42</span>');
    expect(html).toContain('ac-number-input__unit');
    expect(html).toContain('smp');
  });

  it('honors a custom formatter', () => {
    const html = renderToStaticMarkup(
      <AcNumberInput value={0.5} formatValue={(v) => `${(v * 100).toFixed(0)}%`} />,
    );
    expect(html).toContain('>50%</span>');
  });

  it('omits the unit span when unit is not provided', () => {
    const html = renderToStaticMarkup(<AcNumberInput value={7} />);
    expect(html).not.toContain('ac-number-input__unit');
  });

  it('does NOT render the editable class without editable={true}', () => {
    const html = renderToStaticMarkup(<AcNumberInput value={3} />);
    expect(html).not.toContain('ac-number-input--editable');
  });

  it('forwards aria-label to the wrapper span', () => {
    const html = renderToStaticMarkup(
      <AcNumberInput value={3} ariaLabel="Filter cutoff" />,
    );
    expect(html).toContain('aria-label="Filter cutoff"');
  });

  it('forwards dataTestId to the outer span', () => {
    const html = renderToStaticMarkup(
      <AcNumberInput value={9} dataTestId="readout-x" />,
    );
    // The outer span carries the testid; the inner __value span must not.
    expect(html).toContain('data-testid="readout-x"');
    expect(html).toMatch(/<span[^>]*class="ac-number-input"[^>]*data-testid="readout-x"/);
  });
});

describe('AcNumberInput editable', () => {
  it('renders an input[type="number"] with the editable class', () => {
    const html = renderToStaticMarkup(
      <AcNumberInput
        editable={true}
        value={64}
        onChange={() => {}}
        min={0}
        max={127}
      />,
    );
    expect(html).toContain('ac-number-input--editable');
    expect(html).toContain('type="number"');
    expect(html).toContain('value="64"');
    expect(html).toContain('min="0"');
    expect(html).toContain('max="127"');
  });

  it('emits onChange with the parsed numeric value when the user types', () => {
    const onChange = vi.fn();
    const { container } = render(
      <AcNumberInput editable={true} value={10} onChange={onChange} />,
    );
    const input = container.querySelector('input[type="number"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('AcNumberInput editable did not render its input');
    }
    fireEvent.change(input, { target: { value: '42' } });
    expect(onChange).toHaveBeenCalledWith(42);
  });

  it('ignores non-numeric input rather than calling onChange with NaN', () => {
    const onChange = vi.fn();
    const { container } = render(
      <AcNumberInput editable={true} value={10} onChange={onChange} />,
    );
    const input = container.querySelector('input[type="number"]');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('AcNumberInput editable did not render its input');
    }
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('honors disabled', () => {
    const html = renderToStaticMarkup(
      <AcNumberInput editable={true} value={3} onChange={() => {}} disabled={true} />,
    );
    expect(html).toContain('disabled');
  });

  it('clamps typed input above max before invoking onChange', () => {
    const onChange = vi.fn();
    const { container } = render(
      <AcNumberInput editable={true} value={50} onChange={onChange} min={0} max={127} />,
    );
    const input = container.querySelector('input');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('AcNumberInput editable did not render its input');
    }
    fireEvent.change(input, { target: { value: '200' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(127);
  });

  it('clamps typed input below min before invoking onChange', () => {
    const onChange = vi.fn();
    const { container } = render(
      <AcNumberInput editable={true} value={50} onChange={onChange} min={0} max={127} />,
    );
    const input = container.querySelector('input');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('AcNumberInput editable did not render its input');
    }
    fireEvent.change(input, { target: { value: '-5' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('passes in-range values through unchanged', () => {
    const onChange = vi.fn();
    const { container } = render(
      <AcNumberInput editable={true} value={50} onChange={onChange} min={0} max={127} />,
    );
    const input = container.querySelector('input');
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('AcNumberInput editable did not render its input');
    }
    fireEvent.change(input, { target: { value: '75' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(75);
  });

  it('forwards dataTestId to the <input> element (not the wrapper)', () => {
    const html = renderToStaticMarkup(
      <AcNumberInput
        editable={true}
        value={42}
        onChange={() => {}}
        dataTestId="part-0-level"
      />,
    );
    // The input carries the testid so Playwright's getByTestId(...).fill()
    // targets the editable affordance directly.
    expect(html).toMatch(/<input[^>]*data-testid="part-0-level"/);
    // The outer wrapping span must NOT carry the testid.
    expect(html).not.toMatch(/<span[^>]*data-testid="part-0-level"/);
  });
});
