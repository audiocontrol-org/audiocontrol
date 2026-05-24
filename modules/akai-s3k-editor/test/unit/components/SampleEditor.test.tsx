import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SampleEditor } from '@/components/samples/SampleEditor';
import { makeSampleHeader } from '@/test-helpers/sample-factory';

function renderEditor(
  overrides: Partial<Parameters<typeof SampleEditor>[0]> = {},
) {
  const defaults = {
    header: makeSampleHeader(),
    sampleIndex: 0,
    onParameterChange: vi.fn(),
  };
  const props = { ...defaults, ...overrides };
  return {
    ...render(<SampleEditor {...props} />),
    onParameterChange: props.onParameterChange,
  };
}

describe('SampleEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders sample name in input', () => {
    renderEditor({ header: makeSampleHeader({ SHNAME: 'MY SAMPLE' }) });

    const input = screen.getByDisplayValue('MY SAMPLE');
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
  });

  it('renders Basic section with Original Key, Bandwidth, Sample Rate, Playback Mode', () => {
    renderEditor({
      header: makeSampleHeader({ SPITCH: 60, SBANDW: 1, SSRATE: 44100, SPTYPE: 0 }),
    });

    expect(screen.getByText('Basic')).toBeInTheDocument();
    expect(screen.getByText('Original Key')).toBeInTheDocument();
    expect(screen.getByText('Bandwidth')).toBeInTheDocument();
    expect(screen.getByText('Sample Rate')).toBeInTheDocument();
    // Sample Rate (read-only) renders via AcNumberInput as
    // `<span class="ac-number-input__value">44100</span>
    //  <span class="ac-number-input__unit">Hz</span>` — two sibling spans
    // inside a span[aria-label="Sample rate (read-only)"].
    const sampleRateReadout = screen.getByLabelText('Sample rate (read-only)');
    expect(sampleRateReadout).toHaveTextContent('44100');
    expect(sampleRateReadout).toHaveTextContent('Hz');
    expect(screen.getByText('Playback Mode')).toBeInTheDocument();
  });

  it('renders Tuning section with Tune Offset and Hold Loop Tune', () => {
    renderEditor({
      header: makeSampleHeader({ STUNO: 100, SHLTO: -10 }),
    });

    expect(screen.getByText('Tuning')).toBeInTheDocument();
    expect(screen.getByText('Tune Offset')).toBeInTheDocument();
    expect(screen.getByText('Hold Loop Tune')).toBeInTheDocument();
  });

  it('renders Playback Range with Start, End, Length', () => {
    renderEditor({
      header: makeSampleHeader({
        SSTART: 100,
        SMPEND: 22050,
        SLNGTH: 48000,
        SLOOPS: 0, // no loops so SLNGTH value only appears once (in Length display)
      }),
    });

    expect(screen.getByText('Playback Range')).toBeInTheDocument();
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByText('End')).toBeInTheDocument();
    expect(screen.getByText('Length')).toBeInTheDocument();
    // Length is rendered as a static span, verify via its title-less s3k-param-value span
    expect(screen.getByText('48000')).toBeInTheDocument();
  });

  it('shows Loop 1 section when SLOOPS >= 1', () => {
    renderEditor({
      header: makeSampleHeader({ SLOOPS: 1 }),
    });

    expect(screen.getByText('Loop 1')).toBeInTheDocument();
    expect(screen.getByText('Loop Start')).toBeInTheDocument();
    expect(screen.getByText('Loop Length')).toBeInTheDocument();
    expect(screen.getByText('Dwell')).toBeInTheDocument();
  });

  it('hides Loop sections when SLOOPS = 0', () => {
    renderEditor({
      header: makeSampleHeader({ SLOOPS: 0 }),
    });

    expect(screen.queryByText('Loop 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Loop 2')).not.toBeInTheDocument();
    expect(screen.queryByText('Loop 3')).not.toBeInTheDocument();
    expect(screen.queryByText('Loop 4')).not.toBeInTheDocument();
  });

  it('shows multiple loop sections when SLOOPS > 1', () => {
    renderEditor({
      header: makeSampleHeader({ SLOOPS: 3 }),
    });

    expect(screen.getByText('Loop 1')).toBeInTheDocument();
    expect(screen.getByText('Loop 2')).toBeInTheDocument();
    expect(screen.getByText('Loop 3')).toBeInTheDocument();
    expect(screen.queryByText('Loop 4')).not.toBeInTheDocument();
  });

  it('calls onParameterChange when sample name input changes', () => {
    const { onParameterChange } = renderEditor({
      header: makeSampleHeader({ SHNAME: 'TEST SAMPLE' }),
    });

    const input = screen.getByDisplayValue('TEST SAMPLE');
    fireEvent.change(input, { target: { value: 'NEW NAME' } });

    expect(onParameterChange).toHaveBeenCalledWith('SHNAME', 'NEW NAME');
  });

  it('calls onParameterChange when the Original Key readout is edited', () => {
    const { onParameterChange } = renderEditor({
      header: makeSampleHeader({ SPITCH: 60 }),
    });

    // S3kParamRow composes AcSlider + AcNumberInput editable; the
    // readout is reachable by its accessible name `${label} value`.
    const readout = screen.getByRole('spinbutton', { name: 'Original Key value' });
    fireEvent.change(readout, { target: { value: '72' } });

    expect(onParameterChange).toHaveBeenCalledWith('SPITCH', 72);
  });
});
