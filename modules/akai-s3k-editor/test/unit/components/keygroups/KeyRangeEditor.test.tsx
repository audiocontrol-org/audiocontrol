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

  it('renders slider handles with correct aria attributes', () => {
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
