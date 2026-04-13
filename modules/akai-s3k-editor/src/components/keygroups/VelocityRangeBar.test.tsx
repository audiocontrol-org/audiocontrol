import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VelocityRangeBar } from '@/components/keygroups/VelocityRangeBar';

function makeZone(
  lowVel: number,
  highVel: number,
  sampleName: string,
): { lowVel: number; highVel: number; sampleName: string } {
  return { lowVel, highVel, sampleName };
}

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

describe('VelocityRangeBar', () => {
  it('renders zone segments for each zone', () => {
    const zones = [
      makeZone(0, 63, 'SOFT PAD    '),
      makeZone(64, 127, 'HARD PAD    '),
    ];

    render(
      <VelocityRangeBar zones={zones} selectedZone={0} onSelectZone={vi.fn()} />,
    );

    expect(screen.getByTestId('velocity-range-zone-0')).toBeInTheDocument();
    expect(screen.getByTestId('velocity-range-zone-1')).toBeInTheDocument();
  });

  it('shows sample names in zones', () => {
    const zones = [
      makeZone(0, 63, 'SOFT PAD    '),
      makeZone(64, 127, 'HARD PAD    '),
    ];

    render(
      <VelocityRangeBar zones={zones} selectedZone={0} onSelectZone={vi.fn()} />,
    );

    expect(screen.getByText('SOFT PAD')).toBeInTheDocument();
    expect(screen.getByText('HARD PAD')).toBeInTheDocument();
  });

  it('shows fallback label for zones with empty sample names', () => {
    const zones = [
      makeZone(0, 63, '            '),
      makeZone(64, 127, '            '),
    ];

    render(
      <VelocityRangeBar zones={zones} selectedZone={0} onSelectZone={vi.fn()} />,
    );

    expect(screen.getByText('Z1')).toBeInTheDocument();
    expect(screen.getByText('Z2')).toBeInTheDocument();
  });

  it('clicking a zone calls onSelectZone with correct index', () => {
    const zones = [
      makeZone(0, 63, 'SOFT        '),
      makeZone(64, 127, 'HARD        '),
    ];
    const onSelectZone = vi.fn();

    render(
      <VelocityRangeBar zones={zones} selectedZone={0} onSelectZone={onSelectZone} />,
    );

    fireEvent.click(screen.getByText('HARD'));
    expect(onSelectZone).toHaveBeenCalledWith(1);
  });

  it('selected zone has distinct visual styling via CSS class', () => {
    const zones = [
      makeZone(0, 63, 'ZONE A      '),
      makeZone(64, 127, 'ZONE B      '),
    ];

    render(
      <VelocityRangeBar zones={zones} selectedZone={0} onSelectZone={vi.fn()} />,
    );

    expect(screen.getByTestId('velocity-range-zone-0').className).toContain('bg-blue-600');
    expect(screen.getByTestId('velocity-range-zone-1').className).toContain('bg-emerald-800');
  });

  it('skips zones where highVel < lowVel', () => {
    const zones = [
      makeZone(0, 127, 'VALID       '),
      makeZone(100, 50, 'INVALID     '),
    ];

    render(
      <VelocityRangeBar zones={zones} selectedZone={0} onSelectZone={vi.fn()} />,
    );

    expect(screen.getByTestId('velocity-range-zone-0')).toBeInTheDocument();
    expect(screen.queryByText('INVALID')).not.toBeInTheDocument();
  });

  it('renders title attributes with zone info', () => {
    const zones = [makeZone(0, 127, 'MY SAMPLE   ')];

    render(
      <VelocityRangeBar zones={zones} selectedZone={0} onSelectZone={vi.fn()} />,
    );

    expect(screen.getByTestId('velocity-range-zone-0')).toHaveAttribute(
      'title',
      'Zone 1: MY SAMPLE (0-127)',
    );
  });

  it('renders split handles when split dragging is enabled', () => {
    const zones = [
      makeZone(0, 63, 'SOFT PAD    '),
      makeZone(64, 127, 'HARD PAD    '),
    ];

    render(
      <VelocityRangeBar
        zones={zones}
        selectedZone={0}
        onSelectZone={vi.fn()}
        onSplitChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId('velocity-split-handle-0')).toBeInTheDocument();
  });

  it('commits split drags through onSplitChange', () => {
    const zones = [
      makeZone(0, 63, 'SOFT PAD    '),
      makeZone(64, 127, 'HARD PAD    '),
    ];
    const onSelectZone = vi.fn();
    const onSplitChange = vi.fn();

    render(
      <VelocityRangeBar
        zones={zones}
        selectedZone={0}
        onSelectZone={onSelectZone}
        onSplitChange={onSplitChange}
      />,
    );
    setSurfaceRect();

    fireEvent.mouseDown(screen.getByTestId('velocity-split-handle-0'), {
      clientX: 228,
      clientY: 30,
    });
    fireEvent.mouseMove(document, { clientX: 260, clientY: 30 });
    fireEvent.mouseUp(document, { clientX: 260, clientY: 30 });

    expect(onSelectZone).toHaveBeenCalledWith(0);
    expect(onSplitChange).toHaveBeenCalledWith(0, 80);
  });

  it('clamps split drags so the right zone keeps at least one velocity step', () => {
    const zones = [
      makeZone(0, 63, 'SOFT PAD    '),
      makeZone(64, 96, 'MID PAD     '),
    ];
    const onSplitChange = vi.fn();

    render(
      <VelocityRangeBar
        zones={zones}
        selectedZone={0}
        onSelectZone={vi.fn()}
        onSplitChange={onSplitChange}
      />,
    );
    setSurfaceRect();

    fireEvent.mouseDown(screen.getByTestId('velocity-split-handle-0'), {
      clientX: 228,
      clientY: 30,
    });
    fireEvent.mouseMove(document, { clientX: 350, clientY: 30 });
    fireEvent.mouseUp(document, { clientX: 350, clientY: 30 });

    expect(onSplitChange).toHaveBeenCalledWith(0, 95);
  });
});
