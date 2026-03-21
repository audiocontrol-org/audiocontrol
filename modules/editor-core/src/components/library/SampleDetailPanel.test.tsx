import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SampleDetailPanel, type SampleMetadata } from './SampleDetailPanel';

const baseSample: SampleMetadata = {
  name: 'Warm Pad',
  sampleRate: 44100,
};

describe('SampleDetailPanel', () => {
  it('renders empty state when sample is null', () => {
    const html = renderToStaticMarkup(<SampleDetailPanel sample={null} />);
    expect(html).toContain('Select a sample to view details');
    expect(html).toContain('ac-sample-detail-empty');
  });

  it('renders sample name and sample rate', () => {
    const html = renderToStaticMarkup(<SampleDetailPanel sample={baseSample} />);
    expect(html).toContain('Warm Pad');
    expect(html).toContain('44,100 Hz');
  });

  it('renders loop mode when provided', () => {
    const html = renderToStaticMarkup(
      <SampleDetailPanel sample={{ ...baseSample, loopMode: 'forward' }} />,
    );
    expect(html).toContain('Loop Mode');
    expect(html).toContain('Forward');
  });

  it('renders loop points when provided', () => {
    const html = renderToStaticMarkup(
      <SampleDetailPanel sample={{ ...baseSample, loopStart: 1000, loopEnd: 5000 }} />,
    );
    expect(html).toContain('Loop Start');
    expect(html).toContain('1,000');
    expect(html).toContain('Loop End');
    expect(html).toContain('5,000');
  });

  it('renders root key when provided', () => {
    const html = renderToStaticMarkup(
      <SampleDetailPanel sample={{ ...baseSample, rootKey: 'C4' }} />,
    );
    expect(html).toContain('Root Key');
    expect(html).toContain('C4');
  });

  it('renders description when provided', () => {
    const html = renderToStaticMarkup(
      <SampleDetailPanel sample={{ ...baseSample, description: 'A warm analog pad' }} />,
    );
    expect(html).toContain('A warm analog pad');
  });

  it('renders source device when provided', () => {
    const html = renderToStaticMarkup(
      <SampleDetailPanel sample={{ ...baseSample, sourceDevice: 's330' }} />,
    );
    expect(html).toContain('Source');
    expect(html).toContain('s330');
  });

  it('renders tags when provided', () => {
    const html = renderToStaticMarkup(
      <SampleDetailPanel sample={{ ...baseSample, tags: ['pad', 'warm'] }} />,
    );
    expect(html).toContain('ac-sample-detail-tag');
    expect(html).toContain('pad');
    expect(html).toContain('warm');
  });

  it('renders actions slot', () => {
    const html = renderToStaticMarkup(
      <SampleDetailPanel
        sample={baseSample}
        actions={<button className="load-btn">Load</button>}
      />,
    );
    expect(html).toContain('load-btn');
    expect(html).toContain('Load');
    expect(html).toContain('ac-sample-detail-actions');
  });

  it('omits optional fields when not provided', () => {
    const html = renderToStaticMarkup(<SampleDetailPanel sample={baseSample} />);
    expect(html).not.toContain('Loop Mode');
    expect(html).not.toContain('Loop Start');
    expect(html).not.toContain('Root Key');
    expect(html).not.toContain('Source');
    expect(html).not.toContain('ac-sample-detail-tag');
    expect(html).not.toContain('ac-sample-detail-actions');
  });
});
