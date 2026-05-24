import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { S3kParamSelectRow } from '@/components/ui/S3kParamSelectRow';

const PLAYBACK_OPTIONS = [
  { value: 0, label: 'Looping' },
  { value: 1, label: 'Loop+Release' },
  { value: 2, label: 'No Loop' },
  { value: 3, label: 'Play to End' },
];

describe('S3kParamSelectRow', () => {
  it('renders the label and all options inside a native <select>', () => {
    render(
      <S3kParamSelectRow
        label="Playback Mode"
        value={0}
        options={PLAYBACK_OPTIONS}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Playback Mode')).toBeInTheDocument();
    const select = screen.getByRole('combobox', { name: 'Playback Mode' });
    expect(select).toHaveClass('ac-select');
    for (const opt of PLAYBACK_OPTIONS) {
      expect(screen.getByRole('option', { name: opt.label })).toBeInTheDocument();
    }
  });

  it('reflects the current value as the selected option', () => {
    render(
      <S3kParamSelectRow
        label="Playback Mode"
        value={2}
        options={PLAYBACK_OPTIONS}
        onChange={vi.fn()}
      />,
    );
    const select = screen.getByRole('combobox', { name: 'Playback Mode' });
    expect(select).toHaveValue('2');
  });

  it('emits the selected option value as a number on change', () => {
    const onChange = vi.fn();
    render(
      <S3kParamSelectRow
        label="Playback Mode"
        value={0}
        options={PLAYBACK_OPTIONS}
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Playback Mode' }), {
      target: { value: '3' },
    });
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('respects the disabled prop', () => {
    render(
      <S3kParamSelectRow
        label="Playback Mode"
        value={0}
        options={PLAYBACK_OPTIONS}
        onChange={vi.fn()}
        disabled
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Playback Mode' })).toBeDisabled();
  });
});
