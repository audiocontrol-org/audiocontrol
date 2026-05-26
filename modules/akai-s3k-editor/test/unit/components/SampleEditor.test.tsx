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
    sampleCount: 1,
    onParameterChange: vi.fn(),
  };
  const props = { ...defaults, ...overrides };
  return {
    ...render(<SampleEditor {...props} />),
    onParameterChange: props.onParameterChange,
  };
}

/**
 * Click the SampleEditor tab whose visible label matches `label`. The
 * AcRadioTabs primitive renders the visible label as a `<label>`
 * element with `htmlFor={id}`; clicking it fires the radio input's
 * change handler which drives AcRadioTabs' controlled-mode active id.
 */
function selectTab(label: string): void {
  const tabLabel = screen
    .getAllByText(label)
    .find((el) => el.classList.contains('ac-radio-tab'));
  if (!tabLabel) throw new Error(`SampleEditor tab "${label}" not found`);
  fireEvent.click(tabLabel);
}

describe('SampleEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AUDIT-20260525-26 — every akai editor body must wrap in the
  // canonical .ac-detail-pane > .ac-detail-head + .ac-detail-body
  // chrome (promoted from roland-sxx0-editor; CSS lives in
  // editor-core/src/design/detail-pane-primitives.css). The eyebrow
  // + h3 title (slot + name input) must render INSIDE the panel
  // border — never floating above it.
  it('wraps content in .ac-detail-pane / .ac-detail-head / .ac-detail-body chrome (AUDIT-20260525-26)', () => {
    const { container } = renderEditor({
      header: makeSampleHeader({ SHNAME: 'TEST SMP' }),
      sampleIndex: 2,
      sampleCount: 62,
    });

    const pane = container.querySelector('article.ac-detail-pane');
    expect(pane).not.toBeNull();
    expect(pane?.getAttribute('aria-label')).toBe('Sample editor');
    expect(pane?.getAttribute('data-testid')).toBe('sample-detail');

    // Head + body live INSIDE the pane (so the title renders inside
    // the bordered surface, not floating above it).
    const head = pane?.querySelector(':scope > header.ac-detail-head');
    const body = pane?.querySelector(':scope > .ac-detail-body');
    expect(head).not.toBeNull();
    expect(body).not.toBeNull();

    // Head carries the eyebrow row + h3 title with slot + editable name.
    expect(head?.querySelector('.ac-detail-eyebrow-row')).not.toBeNull();
    const slot = head?.querySelector('.ac-detail-slot');
    expect(slot?.textContent).toBe('003');
    const nameInput = head?.querySelector('input.ac-detail-name-input');
    expect(nameInput).not.toBeNull();
    expect((nameInput as HTMLInputElement).value).toBe('TEST SMP');
  });

  it('renders sample name in input', () => {
    renderEditor({ header: makeSampleHeader({ SHNAME: 'MY SAMPLE' }) });

    const input = screen.getByDisplayValue('MY SAMPLE');
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
  });

  // AUDIT-20260525-25 — sample params live inside an AcRadioTabs
  // partition (Wave / Loop / Trim / Misc per mockups/samples.html).
  // The Wave tab carries Original Key + Bandwidth + Sample Rate.
  it('renders Wave tab with Original Key, Bandwidth, Sample Rate readouts (AUDIT-20260525-25)', () => {
    renderEditor({
      header: makeSampleHeader({ SPITCH: 60, SBANDW: 1, SSRATE: 44100, SPTYPE: 0 }),
    });

    // Wave is the default-active tab.
    expect(screen.getByText('Original Key')).toBeInTheDocument();
    expect(screen.getByText('Bandwidth')).toBeInTheDocument();
    expect(screen.getByText('Sample Rate')).toBeInTheDocument();
    const sampleRateReadout = screen.getByLabelText('Sample rate (read-only)');
    expect(sampleRateReadout).toHaveTextContent('44100');
    expect(sampleRateReadout).toHaveTextContent('Hz');
  });

  // AUDIT-20260525-25 — Playback Mode moved to the Misc tab (per
  // mockup partition); switching to Misc reveals it.
  it('exposes Playback Mode inside the Misc tab (AUDIT-20260525-25)', () => {
    renderEditor({
      header: makeSampleHeader({ SPTYPE: 0 }),
    });

    selectTab('Misc');

    expect(screen.getByText('Playback Mode')).toBeInTheDocument();
    expect(screen.getByText('Tune Offset')).toBeInTheDocument();
    expect(screen.getByText('Hold Loop Tune')).toBeInTheDocument();
  });

  // AUDIT-20260525-25 — Start / End / Length live on the Trim tab.
  it('exposes Start / End / Length on the Trim tab (AUDIT-20260525-25)', () => {
    renderEditor({
      header: makeSampleHeader({
        SSTART: 100,
        SMPEND: 22050,
        SLNGTH: 48000,
        SLOOPS: 0, // no loops so SLNGTH value only appears once
      }),
    });

    selectTab('Trim');

    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByText('End')).toBeInTheDocument();
    expect(screen.getByText('Length')).toBeInTheDocument();
    // Length is rendered as an AcNumberInput readout.
    expect(screen.getByLabelText('Trim length (read-only)')).toHaveTextContent('48000');
  });

  // AUDIT-20260525-25 — Loops live on the Loop tab; loop count is
  // gated by SLOOPS per the device contract.
  it('reveals Loop 1 start/length/dwell on the Loop tab when SLOOPS >= 1 (AUDIT-20260525-25)', () => {
    renderEditor({
      header: makeSampleHeader({ SLOOPS: 1 }),
    });

    selectTab('Loop');

    expect(screen.getByText('Loop 1 start')).toBeInTheDocument();
    expect(screen.getByText('Loop 1 length')).toBeInTheDocument();
    expect(screen.getByText('Loop 1 dwell')).toBeInTheDocument();
  });

  it('renders the empty-loops state on the Loop tab when SLOOPS = 0 (AUDIT-20260525-25)', () => {
    renderEditor({
      header: makeSampleHeader({ SLOOPS: 0 }),
    });

    selectTab('Loop');

    expect(screen.getByText('No loops on this sample')).toBeInTheDocument();
    expect(screen.queryByText('Loop 1 start')).not.toBeInTheDocument();
  });

  it('reveals multiple loop rows on the Loop tab when SLOOPS > 1 (AUDIT-20260525-25)', () => {
    renderEditor({
      header: makeSampleHeader({ SLOOPS: 3 }),
    });

    selectTab('Loop');

    expect(screen.getByText('Loop 1 start')).toBeInTheDocument();
    expect(screen.getByText('Loop 2 start')).toBeInTheDocument();
    expect(screen.getByText('Loop 3 start')).toBeInTheDocument();
    expect(screen.queryByText('Loop 4 start')).not.toBeInTheDocument();
  });

  it('calls onParameterChange when sample name input changes', () => {
    const { onParameterChange } = renderEditor({
      header: makeSampleHeader({ SHNAME: 'TEST SAMPLE' }),
    });

    const input = screen.getByDisplayValue('TEST SAMPLE');
    fireEvent.change(input, { target: { value: 'NEW NAME' } });

    expect(onParameterChange).toHaveBeenCalledWith('SHNAME', 'NEW NAME');
  });

  it('calls onParameterChange when the Original Key readout is edited (Wave tab)', () => {
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
