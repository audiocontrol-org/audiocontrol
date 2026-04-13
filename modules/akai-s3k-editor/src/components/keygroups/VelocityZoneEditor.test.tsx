import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VelocityZoneEditor } from '@/components/keygroups/VelocityZoneEditor';
import { makeKeygroupHeader } from '@/test-helpers/keygroup-factory';

function setSurfaceRect(): void {
  const surface = screen.getByTestId('velocity-range-bar-surface');
  Object.defineProperty(surface, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      left: 100,
      top: 20,
      width: 256,
      height: 32,
      right: 356,
      bottom: 52,
      x: 100,
      y: 20,
      toJSON: () => ({}),
    }),
  });
}

describe('VelocityZoneEditor', () => {
  it('commits adjacent zone fields when a split handle is dragged', () => {
    const header = makeKeygroupHeader({
      SNAME1: 'SOFT        ',
      LOVEL1: 0,
      HIVEL1: 63,
      SNAME2: 'HARD        ',
      LOVEL2: 64,
      HIVEL2: 127,
    });
    const onParameterChange = vi.fn();

    render(
      <VelocityZoneEditor
        header={header}
        sampleNames={['SOFT', 'HARD']}
        onParameterChange={onParameterChange}
      />,
    );
    setSurfaceRect();

    fireEvent.mouseDown(screen.getByTestId('velocity-split-handle-0'), {
      clientX: 228,
      clientY: 30,
    });
    fireEvent.mouseMove(document, { clientX: 260, clientY: 30 });
    fireEvent.mouseUp(document, { clientX: 260, clientY: 30 });

    expect(onParameterChange).toHaveBeenNthCalledWith(1, 'HIVEL1', 80);
    expect(onParameterChange).toHaveBeenNthCalledWith(2, 'LOVEL2', 81);
  });

  it('clamps numeric low velocity edits against the current high velocity', () => {
    const header = makeKeygroupHeader({
      SNAME1: 'SOFT        ',
      LOVEL1: 0,
      HIVEL1: 63,
    });
    const onParameterChange = vi.fn();

    render(
      <VelocityZoneEditor
        header={header}
        sampleNames={['SOFT']}
        onParameterChange={onParameterChange}
      />,
    );

    const spinbuttons = screen.getAllByRole('spinbutton');
    fireEvent.change(spinbuttons[0], {
      target: { value: '100' },
    });

    expect(onParameterChange).toHaveBeenCalledWith('LOVEL1', 63);
  });

  it('clamps numeric high velocity edits against the current low velocity', () => {
    const header = makeKeygroupHeader({
      SNAME1: 'SOFT        ',
      LOVEL1: 32,
      HIVEL1: 63,
    });
    const onParameterChange = vi.fn();

    render(
      <VelocityZoneEditor
        header={header}
        sampleNames={['SOFT']}
        onParameterChange={onParameterChange}
      />,
    );

    const spinbuttons = screen.getAllByRole('spinbutton');
    fireEvent.change(spinbuttons[1], {
      target: { value: '5' },
    });

    expect(onParameterChange).toHaveBeenCalledWith('HIVEL1', 32);
  });
});
