import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { S3kParamRow } from '@/components/ui/S3kParamRow';

describe('S3kParamRow — linear', () => {
  it('renders label, readout, and a slider-shaped affordance', () => {
    render(
      <S3kParamRow
        label="Attack"
        value={42}
        min={0}
        max={99}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Attack')).toBeInTheDocument();
    const slider = screen.getByRole('slider', { name: 'Attack' });
    expect(slider).toHaveAttribute('type', 'range');
    expect(slider).toHaveAttribute('min', '0');
    expect(slider).toHaveAttribute('max', '99');
    expect(slider).toHaveValue('42');
  });

  it('emits the dragged value as an integer (slider input)', () => {
    const onChange = vi.fn();
    render(
      <S3kParamRow
        label="Attack"
        value={10}
        min={0}
        max={99}
        onChange={onChange}
      />,
    );

    const slider = screen.getByRole('slider', { name: 'Attack' });
    fireEvent.change(slider, { target: { value: '65' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(65);
  });

  it('rounds non-integer typed input to an integer before onChange', () => {
    const onChange = vi.fn();
    render(
      <S3kParamRow
        label="Tune"
        value={20}
        min={0}
        max={99}
        onChange={onChange}
      />,
    );

    // The readout input accepts arbitrary numeric strings; the wrapper rounds.
    const readout = screen.getByRole('spinbutton', { name: 'Tune value' });
    fireEvent.change(readout, { target: { value: '32.7' } });
    expect(onChange).toHaveBeenCalledWith(33);
  });

  it('clamps typed values above max via AcNumberInput', () => {
    const onChange = vi.fn();
    render(
      <S3kParamRow
        label="Vol"
        value={50}
        min={0}
        max={99}
        onChange={onChange}
      />,
    );

    const readout = screen.getByRole('spinbutton', { name: 'Vol value' });
    fireEvent.change(readout, { target: { value: '200' } });
    expect(onChange).toHaveBeenCalledWith(99);
  });

  it('clamps typed values below min via AcNumberInput', () => {
    const onChange = vi.fn();
    render(
      <S3kParamRow
        label="Vol"
        value={50}
        min={0}
        max={99}
        onChange={onChange}
      />,
    );

    const readout = screen.getByRole('spinbutton', { name: 'Vol value' });
    fireEvent.change(readout, { target: { value: '-5' } });
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('selects readout text on focus (dense-panel ergonomic)', () => {
    render(
      <S3kParamRow
        label="Rate"
        value={42}
        min={0}
        max={99}
        onChange={vi.fn()}
      />,
    );

    const readout = screen.getByRole('spinbutton', { name: 'Rate value' });
    // jsdom doesn't implement HTMLInputElement.select() by default; spy it.
    const selectSpy = vi.spyOn(readout as HTMLInputElement, 'select');
    fireEvent.focus(readout);
    expect(selectSpy).toHaveBeenCalledTimes(1);
  });

  it('throws when `tooltip` is supplied (reserved for follow-up dispatch)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() =>
      render(
        <S3kParamRow
          label="Q"
          value={5}
          min={0}
          max={15}
          onChange={vi.fn()}
          tooltip="Filter resonance"
        />,
      ),
    ).toThrow(/tooltip.*reserved/i);
    spy.mockRestore();
  });
});

describe('S3kParamRow — bipolar', () => {
  it('renders a bipolar bar with the correct min/max', () => {
    render(
      <S3kParamRow
        label="Pan"
        value={0}
        min={-50}
        max={50}
        onChange={vi.fn()}
        bipolar
      />,
    );

    const slider = screen.getByRole('slider', { name: 'Pan' });
    expect(slider).toHaveAttribute('min', '-50');
    expect(slider).toHaveAttribute('max', '50');
    expect(slider).toHaveValue('0');
  });

  it('forwards a negative dragged value through onChange as an integer', () => {
    const onChange = vi.fn();
    render(
      <S3kParamRow
        label="Pan"
        value={0}
        min={-50}
        max={50}
        onChange={onChange}
        bipolar
      />,
    );

    const slider = screen.getByRole('slider', { name: 'Pan' });
    fireEvent.change(slider, { target: { value: '-25' } });
    expect(onChange).toHaveBeenCalledWith(-25);
  });
});

describe('S3kParamRow — aria', () => {
  it('uses `ariaLabel` for the slider when supplied', () => {
    render(
      <S3kParamRow
        label="LO"
        ariaLabel="Low velocity"
        value={10}
        min={0}
        max={127}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('slider', { name: 'Low velocity' })).toBeInTheDocument();
    expect(
      screen.getByRole('spinbutton', { name: 'Low velocity value' }),
    ).toBeInTheDocument();
  });
});
