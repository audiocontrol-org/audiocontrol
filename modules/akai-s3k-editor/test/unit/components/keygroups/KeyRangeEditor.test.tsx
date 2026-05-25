/**
 * KeyRangeEditor — unit tests post-AcZoneStrip migration.
 *
 * After akai-harmonization Phase 2 task 2.2 Commit 3, KeyRangeEditor
 * is a thin wrapper around <AcZoneStrip> (per-edge handle mode) that
 * (a) maps the single low/high note range to an AcZoneStripZone,
 * (b) owns the pointer-driven low/high drag tracking, (c) keeps the
 * range-display text + octave markers + numeric inputs as axis /
 * paired editors around the strip.
 *
 * The pre-migration tests asserted `role="slider"` + `aria-valuenow`
 * on the per-edge handle divs. AcZoneStrip's handles use
 * `role="separator"` (which the WCAG drag-affordance pattern calls
 * for) — those handle-shape assertions are retired in favor of
 * structural assertions on the AcZoneStrip primitive (it owns its
 * own a11y tests in editor-core). What this test asserts is the
 * KeyRangeEditor wrapper's contract:
 *   - the range display + numeric inputs reflect the LONOTE/HINOTE
 *     props,
 *   - numeric input edits fire onChange with the right field name,
 *   - clamp behavior survives the migration,
 *   - the bar carries a single AcZoneStripZone with two per-edge
 *     handles.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KeyRangeEditor } from '@/components/keygroups/KeyRangeEditor';
import type { NoteRange } from '@/components/keygroups/note-coordinate-utils';

/** Full MIDI range for tests that don't need a specific range. */
const FULL_RANGE: NoteRange = { min: 0, max: 127 };

describe('KeyRangeEditor', () => {
  it('renders with correct note range display', () => {
    const onChange = vi.fn();

    render(
      <KeyRangeEditor lowNote={36} highNote={72} onChange={onChange} noteRange={FULL_RANGE} />,
    );

    // The range display text contains both note names
    // MIDI 36 = C2, MIDI 72 = C5
    expect(screen.getByText(/C2 -- C5/)).toBeInTheDocument();
  });

  it('numeric inputs show current LONOTE and HINOTE values', () => {
    const onChange = vi.fn();

    render(
      <KeyRangeEditor lowNote={36} highNote={72} onChange={onChange} noteRange={FULL_RANGE} />,
    );

    const lowInput = screen.getByRole('spinbutton', { name: /low/i });
    const highInput = screen.getByRole('spinbutton', { name: /high/i });

    expect(lowInput).toHaveValue(36);
    expect(highInput).toHaveValue(72);
  });

  it('changing low note input calls onChange with LONOTE and the new value', () => {
    const onChange = vi.fn();

    render(
      <KeyRangeEditor lowNote={36} highNote={72} onChange={onChange} noteRange={FULL_RANGE} />,
    );

    const lowInput = screen.getByRole('spinbutton', { name: /low/i });
    fireEvent.change(lowInput, { target: { value: '48' } });

    expect(onChange).toHaveBeenCalledWith('LONOTE', 48);
  });

  it('changing high note input calls onChange with HINOTE and the new value', () => {
    const onChange = vi.fn();

    render(
      <KeyRangeEditor lowNote={36} highNote={72} onChange={onChange} noteRange={FULL_RANGE} />,
    );

    const highInput = screen.getByRole('spinbutton', { name: /high/i });
    fireEvent.change(highInput, { target: { value: '96' } });

    expect(onChange).toHaveBeenCalledWith('HINOTE', 96);
  });

  it('handles edge case LONOTE = 0 (C-1)', () => {
    const onChange = vi.fn();

    render(
      <KeyRangeEditor lowNote={0} highNote={127} onChange={onChange} noteRange={FULL_RANGE} />,
    );

    // MIDI 0 = C-1, MIDI 127 = G9. The range display shows both.
    expect(screen.getByText(/C-1 -- G9/)).toBeInTheDocument();

    const lowInput = screen.getByRole('spinbutton', { name: /low/i });
    expect(lowInput).toHaveValue(0);
  });

  it('handles edge case HINOTE = 127 (G9)', () => {
    const onChange = vi.fn();

    render(
      <KeyRangeEditor lowNote={0} highNote={127} onChange={onChange} noteRange={FULL_RANGE} />,
    );

    // MIDI 127 = G9
    expect(screen.getByText(/C-1 -- G9/)).toBeInTheDocument();

    const highInput = screen.getByRole('spinbutton', { name: /high/i });
    expect(highInput).toHaveValue(127);
  });

  it('clamps values outside 0-127 range', () => {
    const onChange = vi.fn();

    render(
      <KeyRangeEditor lowNote={60} highNote={72} onChange={onChange} noteRange={FULL_RANGE} />,
    );

    const lowInput = screen.getByRole('spinbutton', { name: /low/i });
    fireEvent.change(lowInput, { target: { value: '-5' } });

    // clampNote should clamp to 0
    expect(onChange).toHaveBeenCalledWith('LONOTE', 0);
  });

  it('clamps values above 127', () => {
    const onChange = vi.fn();

    render(
      <KeyRangeEditor lowNote={60} highNote={72} onChange={onChange} noteRange={FULL_RANGE} />,
    );

    const highInput = screen.getByRole('spinbutton', { name: /high/i });
    fireEvent.change(highInput, { target: { value: '200' } });

    // clampNote should clamp to 127
    expect(onChange).toHaveBeenCalledWith('HINOTE', 127);
  });

  it('renders a single AcZoneStrip zone with two per-edge handles', () => {
    const onChange = vi.fn();

    render(
      <KeyRangeEditor lowNote={36} highNote={72} onChange={onChange} noteRange={FULL_RANGE} />,
    );

    // Single zone (segment-body-0); per-edge mode → start + end
    // handles on that zone; no split handle.
    expect(screen.getByTestId('ac-zone-segment-body-0')).toBeInTheDocument();
    expect(screen.getByTestId('ac-zone-handle-start-0')).toBeInTheDocument();
    expect(screen.getByTestId('ac-zone-handle-end-0')).toBeInTheDocument();
    expect(screen.queryByTestId('ac-zone-handle-split-0')).not.toBeInTheDocument();
  });

  it('the strip zone reflects the lowNote / highNote props', () => {
    const onChange = vi.fn();

    const { container } = render(
      <KeyRangeEditor lowNote={36} highNote={72} onChange={onChange} noteRange={FULL_RANGE} />,
    );

    const segment = container.querySelector('.ac-zone-segment') as HTMLElement;
    expect(segment).toBeInTheDocument();
    // Title carries the formatted MIDI note range.
    expect(segment.getAttribute('title')).toBe('C2 – C5');
  });

  it('per-edge handles carry role="slider" + Low note / High note aria-labels + aria-valuenow', () => {
    // The handle a11y override is what preserves the wrapper's
    // contract for UI specs that target "Low note" / "High note"
    // sliders (the zone-overview.spec.ts UI specs that exercise the
    // KeyRangeEditor handle drag).
    const onChange = vi.fn();

    render(
      <KeyRangeEditor lowNote={36} highNote={72} onChange={onChange} noteRange={FULL_RANGE} />,
    );

    const lowSlider = screen.getByRole('slider', { name: 'Low note' });
    const highSlider = screen.getByRole('slider', { name: 'High note' });

    expect(lowSlider).toHaveAttribute('aria-valuenow', '36');
    expect(lowSlider).toHaveAttribute('aria-valuemin', '0');
    expect(lowSlider).toHaveAttribute('aria-valuemax', '127');

    expect(highSlider).toHaveAttribute('aria-valuenow', '72');
    expect(highSlider).toHaveAttribute('aria-valuemin', '0');
    expect(highSlider).toHaveAttribute('aria-valuemax', '127');
  });
});
