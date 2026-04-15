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

describe('VelocityRangeBar', () => {
  it('renders zone segments for each zone', () => {
    const zones = [
      makeZone(0, 63, 'SOFT PAD    '),
      makeZone(64, 127, 'HARD PAD    '),
    ];

    render(
      <VelocityRangeBar zones={zones} selectedZone={0} onSelectZone={vi.fn()} />,
    );

    // Each zone renders a button
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
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

    // Empty sample name falls back to "Z1", "Z2"
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

  it('clicking the first zone calls onSelectZone with index 0', () => {
    const zones = [
      makeZone(0, 63, 'FIRST       '),
      makeZone(64, 127, 'SECOND      '),
    ];
    const onSelectZone = vi.fn();

    render(
      <VelocityRangeBar zones={zones} selectedZone={1} onSelectZone={onSelectZone} />,
    );

    fireEvent.click(screen.getByText('FIRST'));
    expect(onSelectZone).toHaveBeenCalledWith(0);
  });

  it('selected zone has distinct visual styling via CSS class', () => {
    const zones = [
      makeZone(0, 63, 'ZONE A      '),
      makeZone(64, 127, 'ZONE B      '),
    ];

    render(
      <VelocityRangeBar zones={zones} selectedZone={0} onSelectZone={vi.fn()} />,
    );

    const buttons = screen.getAllByRole('button');

    // First zone (selected) should have the selected class (bg-blue-600)
    expect(buttons[0].className).toContain('bg-blue-600');
    // Second zone (not selected) should have the non-selected class (bg-emerald-800)
    expect(buttons[1].className).toContain('bg-emerald-800');
  });

  it('skips zones where highVel < lowVel', () => {
    const zones = [
      makeZone(0, 127, 'VALID       '),
      makeZone(100, 50, 'INVALID     '), // highVel < lowVel
    ];

    render(
      <VelocityRangeBar zones={zones} selectedZone={0} onSelectZone={vi.fn()} />,
    );

    // Only the valid zone should render
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(screen.getByText('VALID')).toBeInTheDocument();
    expect(screen.queryByText('INVALID')).not.toBeInTheDocument();
  });

  it('renders title attributes with zone info', () => {
    const zones = [makeZone(0, 127, 'MY SAMPLE   ')];

    render(
      <VelocityRangeBar zones={zones} selectedZone={0} onSelectZone={vi.fn()} />,
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title', 'Zone 1: MY SAMPLE (0-127)');
  });

  describe('split handles', () => {
    it('renders split handles between adjacent zones when callbacks are provided', () => {
      const zones = [
        makeZone(0, 63, 'SOFT        '),
        makeZone(64, 127, 'HARD        '),
      ];

      render(
        <VelocityRangeBar
          zones={zones}
          selectedZone={0}
          onSelectZone={vi.fn()}
          onSplitDrag={vi.fn()}
          onSplitCommit={vi.fn()}
        />,
      );

      const handle = screen.getByTestId('split-handle-0');
      expect(handle).toBeInTheDocument();
      expect(handle.style.cursor).toBe('ew-resize');
    });

    it('does not render split handles when callbacks are absent', () => {
      const zones = [
        makeZone(0, 63, 'SOFT        '),
        makeZone(64, 127, 'HARD        '),
      ];

      render(
        <VelocityRangeBar zones={zones} selectedZone={0} onSelectZone={vi.fn()} />,
      );

      expect(screen.queryByTestId('split-handle-0')).not.toBeInTheDocument();
    });

    it('renders one handle per boundary (N-1 handles for N zones)', () => {
      const zones = [
        makeZone(0, 42, 'ZONE1       '),
        makeZone(43, 85, 'ZONE2       '),
        makeZone(86, 127, 'ZONE3       '),
      ];

      render(
        <VelocityRangeBar
          zones={zones}
          selectedZone={0}
          onSelectZone={vi.fn()}
          onSplitDrag={vi.fn()}
          onSplitCommit={vi.fn()}
        />,
      );

      expect(screen.getByTestId('split-handle-0')).toBeInTheDocument();
      expect(screen.getByTestId('split-handle-1')).toBeInTheDocument();
      expect(screen.queryByTestId('split-handle-2')).not.toBeInTheDocument();
    });

    it('does not render handle when only one zone exists', () => {
      const zones = [makeZone(0, 127, 'SINGLE      ')];

      render(
        <VelocityRangeBar
          zones={zones}
          selectedZone={0}
          onSelectZone={vi.fn()}
          onSplitDrag={vi.fn()}
          onSplitCommit={vi.fn()}
        />,
      );

      expect(screen.queryByTestId('split-handle-0')).not.toBeInTheDocument();
    });

    it('calls onSplitDrag on mousedown with initial velocity', () => {
      const zones = [
        makeZone(0, 63, 'SOFT        '),
        makeZone(64, 127, 'HARD        '),
      ];
      const onSplitDrag = vi.fn();

      render(
        <VelocityRangeBar
          zones={zones}
          selectedZone={0}
          onSelectZone={vi.fn()}
          onSplitDrag={onSplitDrag}
          onSplitCommit={vi.fn()}
        />,
      );

      const handle = screen.getByTestId('split-handle-0');
      fireEvent.mouseDown(handle, { clientX: 100 });

      // Should be called with splitIndex 0 and some velocity value
      expect(onSplitDrag).toHaveBeenCalledTimes(1);
      expect(onSplitDrag).toHaveBeenCalledWith(0, expect.any(Number));
    });
  });
});
