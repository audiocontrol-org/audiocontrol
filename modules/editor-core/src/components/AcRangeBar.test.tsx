import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AcRangeBar } from './AcRangeBar';

describe('AcRangeBar linear', () => {
  it('renders a fill width matching the value as a percentage of the range', () => {
    const html = renderToStaticMarkup(
      <AcRangeBar variant="linear" value={32} min={0} max={128} />,
    );
    expect(html).toContain('ac-range-bar');
    expect(html).toContain('ac-range-bar__fill');
    expect(html).toContain('--ac-range-fill:25%');
  });

  it('renders start, mid, and end tick labels when provided', () => {
    const html = renderToStaticMarkup(
      <AcRangeBar
        variant="linear"
        value={50}
        min={0}
        max={100}
        startTick="0"
        midTick="50"
        endTick="100"
      />,
    );
    expect(html).toContain('ac-range-bar__tick--start');
    expect(html).toContain('ac-range-bar__tick--mid');
    expect(html).toContain('ac-range-bar__tick--end');
    expect(html).toContain('>0<');
    expect(html).toContain('>50<');
    expect(html).toContain('>100<');
  });

  it('clamps values above max to 100% fill', () => {
    const html = renderToStaticMarkup(
      <AcRangeBar variant="linear" value={1000} min={0} max={100} />,
    );
    expect(html).toContain('--ac-range-fill:100%');
  });

  it('throws on inverted ranges', () => {
    expect(() =>
      renderToStaticMarkup(
        <AcRangeBar variant="linear" value={5} min={100} max={0} />,
      ),
    ).toThrow(/AcRangeBar linear requires max > min/);
  });
});

describe('AcRangeBar bipolar', () => {
  it('grows right of center for positive values', () => {
    const html = renderToStaticMarkup(
      <AcRangeBar variant="bipolar" value={50} min={-100} max={100} />,
    );
    expect(html).toContain('ac-range-bar--bipolar');
    expect(html).toContain('--ac-range-bar-l:50%');
    expect(html).toContain('--ac-range-bar-w:25%');
  });

  it('grows left of center for negative values', () => {
    const html = renderToStaticMarkup(
      <AcRangeBar variant="bipolar" value={-50} min={-100} max={100} />,
    );
    expect(html).toContain('--ac-range-bar-l:25%');
    expect(html).toContain('--ac-range-bar-w:25%');
  });

  it('throws when max <= min', () => {
    expect(() =>
      renderToStaticMarkup(
        <AcRangeBar variant="bipolar" value={0} min={0} max={0} />,
      ),
    ).toThrow(/bipolar requires max > min/);
  });
});

describe('AcRangeBar enum', () => {
  it('renders count pip cells with the active one marked', () => {
    const html = renderToStaticMarkup(
      <AcRangeBar variant="enum" count={4} activeIndex={2} />,
    );
    expect(html).toContain('ac-range-bar--enum');
    expect(html).toContain('ac-range-bar__enum-track');
    // 4 pip spans
    const pipCount = (html.match(/ac-range-bar__enum-pip/g) ?? []).length;
    expect(pipCount).toBe(4);
    // exactly one active
    const activeCount = (html.match(/data-active="true"/g) ?? []).length;
    expect(activeCount).toBe(1);
  });

  it('forwards itemTitles to pip title attributes', () => {
    const html = renderToStaticMarkup(
      <AcRangeBar
        variant="enum"
        count={3}
        activeIndex={0}
        itemTitles={['Forward', 'Alternate', 'One-shot']}
      />,
    );
    expect(html).toContain('title="Forward"');
    expect(html).toContain('title="Alternate"');
    expect(html).toContain('title="One-shot"');
  });

  it('throws on count < 1', () => {
    expect(() =>
      renderToStaticMarkup(
        <AcRangeBar variant="enum" count={0} activeIndex={0} />,
      ),
    ).toThrow(/enum requires count >= 1/);
  });
});

describe('AcRangeBar aria', () => {
  it('exposes an img role and aria-label', () => {
    const html = renderToStaticMarkup(
      <AcRangeBar variant="linear" value={1} min={0} max={2} ariaLabel="Cutoff" />,
    );
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Cutoff"');
  });
});
