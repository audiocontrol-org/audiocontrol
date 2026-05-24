import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { S3kParamToggleRow } from '@/components/ui/S3kParamToggleRow';

describe('S3kParamToggleRow', () => {
  it('renders the label and an ON/OFF radiogroup', () => {
    render(
      <S3kParamToggleRow
        label="Vel XFade"
        checked={false}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Vel XFade')).toBeInTheDocument();
    const group = screen.getByRole('radiogroup', { name: 'Vel XFade' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'ON' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'OFF' })).toBeInTheDocument();
  });

  it('checks the ON radio when `checked` is true', () => {
    render(
      <S3kParamToggleRow
        label="Vel XFade"
        checked={true}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('radio', { name: 'ON' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'OFF' })).not.toBeChecked();
  });

  it('checks the OFF radio when `checked` is false', () => {
    render(
      <S3kParamToggleRow
        label="Vel XFade"
        checked={false}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('radio', { name: 'OFF' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'ON' })).not.toBeChecked();
  });

  it('emits onChange(true) when clicking ON from off state', () => {
    const onChange = vi.fn();
    render(
      <S3kParamToggleRow
        label="Vel XFade"
        checked={false}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'ON' }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('emits onChange(false) when clicking OFF from on state', () => {
    const onChange = vi.fn();
    render(
      <S3kParamToggleRow
        label="Vel XFade"
        checked={true}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'OFF' }));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('disables both radios when disabled is true', () => {
    render(
      <S3kParamToggleRow
        label="Vel XFade"
        checked={false}
        onChange={vi.fn()}
        disabled
      />,
    );
    expect(screen.getByRole('radio', { name: 'ON' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'OFF' })).toBeDisabled();
  });
});
