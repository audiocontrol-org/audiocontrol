import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AcSlider } from './AcSlider';

describe('AcSlider', () => {
  it('renders the three-column composition: label, bar, readout', () => {
    const html = renderToStaticMarkup(
      <AcSlider
        label="Cutoff"
        bar={{ variant: 'linear', value: 64, min: 0, max: 127 }}
        readout={64}
      />,
    );
    expect(html).toContain('ac-slider');
    expect(html).toContain('ac-slider__label');
    expect(html).toContain('Cutoff');
    expect(html).toContain('ac-range-bar');
    expect(html).toContain('ac-slider__readout');
    expect(html).toContain('>64</strong>');
  });

  it('renders an optional unit on the readout', () => {
    const html = renderToStaticMarkup(
      <AcSlider
        label="Sample Rate"
        bar={{ variant: 'linear', value: 30, min: 15, max: 30 }}
        readout={30}
        unit="kHz"
      />,
    );
    expect(html).toContain('ac-slider__readout-unit');
    expect(html).toContain('kHz');
  });

  it('appends a custom className to the slider root', () => {
    const html = renderToStaticMarkup(
      <AcSlider
        label="Cutoff"
        bar={{ variant: 'linear', value: 1, min: 0, max: 2 }}
        readout={1}
        className="page__param"
      />,
    );
    expect(html).toContain('class="ac-slider page__param"');
  });

  it('passes bipolar bar props through unchanged', () => {
    const html = renderToStaticMarkup(
      <AcSlider
        label="Tune"
        bar={{ variant: 'bipolar', value: -25, min: -50, max: 50 }}
        readout={-25}
      />,
    );
    expect(html).toContain('ac-range-bar--bipolar');
  });

  it('passes enum bar props through unchanged', () => {
    const html = renderToStaticMarkup(
      <AcSlider
        label="Loop Mode"
        bar={{ variant: 'enum', count: 3, activeIndex: 1 }}
        readout="Alternate"
      />,
    );
    expect(html).toContain('ac-range-bar--enum');
    expect(html).toContain('Alternate');
  });
});
