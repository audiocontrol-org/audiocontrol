/**
 * AcZoneStrip — unit tests for the segmented 1D zone-strip primitive
 * promoted from roland's inline `.ac-zone-*` family during
 * akai-harmonization Phase 2 task 2.2.
 *
 * Coverage targets the public API surface:
 *   - zone count + position math (range mapping, +1 inclusive width)
 *   - hue derivation (explicit override + index-derived default)
 *   - drag-handle dispatch (per-edge mode 'start'/'end'; splitHandles
 *     mode 'split' with zoneIndex = LEFT zone of boundary)
 *   - selection click → onSelect(zoneIndex)
 *   - empty state (zones.length === 0 → .ac-zone-bar-empty)
 *   - ARIA: role="group" + aria-label flows through
 *   - per-edge vs splitHandles render distinctly (per-edge handles vs
 *     split handles; testid distinguishes them)
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AcZoneStrip, defaultZoneHue, type AcZoneStripZone } from './AcZoneStrip';

describe('AcZoneStrip', () => {
  const RANGE_127 = { min: 0, max: 127 };

  describe('zone rendering', () => {
    it('renders one segment per zone, positioned via range mapping', () => {
      const zones: AcZoneStripZone[] = [
        { startValue: 0, endValue: 63, label: 'A' },
        { startValue: 64, endValue: 127, label: 'B' },
      ];
      render(<AcZoneStrip zones={zones} range={RANGE_127} ariaLabel="test" />);
      // The two per-zone segments are present (the inner click body
      // carries the testid that's stable across modes).
      expect(screen.getByTestId('ac-zone-segment-body-0')).toBeInTheDocument();
      expect(screen.getByTestId('ac-zone-segment-body-1')).toBeInTheDocument();
    });

    it('positions each segment via inline left% / width%', () => {
      const zones: AcZoneStripZone[] = [
        { startValue: 0, endValue: 63 },
        { startValue: 64, endValue: 127 },
      ];
      const { container } = render(
        <AcZoneStrip zones={zones} range={RANGE_127} ariaLabel="test" />,
      );
      const segments = container.querySelectorAll('.ac-zone-segment');
      expect(segments).toHaveLength(2);
      const [first, second] = Array.from(segments) as HTMLElement[];
      // First zone: left=0%, width=50% (64 keys / 128 total)
      expect(first.style.left).toBe('0%');
      expect(first.style.width).toBe('50%');
      // Second zone: left=50%, width=50%
      expect(second.style.left).toBe('50%');
      expect(second.style.width).toBe('50%');
    });

    it('renders single-value zones at minimum 1% width', () => {
      const zones: AcZoneStripZone[] = [
        { startValue: 64, endValue: 64, label: 'point' },
      ];
      const { container } = render(
        <AcZoneStrip zones={zones} range={RANGE_127} ariaLabel="test" />,
      );
      const segment = container.querySelector('.ac-zone-segment') as HTMLElement;
      // (64-64+1)/128 = 0.78% → floored at 1%
      expect(parseFloat(segment.style.width)).toBeGreaterThanOrEqual(1);
    });

    it('renders the label only when widthPercent > 8', () => {
      const zones: AcZoneStripZone[] = [
        // Wide zone — label SHOULD render.
        { startValue: 0, endValue: 127, label: 'WIDE' },
      ];
      render(<AcZoneStrip zones={zones} range={RANGE_127} ariaLabel="test" />);
      expect(screen.getByText('WIDE')).toBeInTheDocument();
    });

    it('suppresses the label when the zone is narrower than 8%', () => {
      const zones: AcZoneStripZone[] = [
        // 5/128 = 3.9% — under the 8% threshold.
        { startValue: 0, endValue: 4, label: 'NARROW' },
      ];
      render(<AcZoneStrip zones={zones} range={RANGE_127} ariaLabel="test" />);
      expect(screen.queryByText('NARROW')).not.toBeInTheDocument();
    });
  });

  describe('hue derivation', () => {
    it('uses explicit hue when supplied', () => {
      const zones: AcZoneStripZone[] = [
        { startValue: 0, endValue: 127, hue: 200 },
      ];
      const { container } = render(
        <AcZoneStrip zones={zones} range={RANGE_127} ariaLabel="test" />,
      );
      const segment = container.querySelector('.ac-zone-segment') as HTMLElement;
      expect(segment.style.getPropertyValue('--ac-zone-hue')).toBe('200');
    });

    it('falls back to index-derived hue when omitted', () => {
      const zones: AcZoneStripZone[] = [
        { startValue: 0, endValue: 31 },
        { startValue: 32, endValue: 63 },
        { startValue: 64, endValue: 127 },
      ];
      const { container } = render(
        <AcZoneStrip zones={zones} range={RANGE_127} ariaLabel="test" />,
      );
      const segments = container.querySelectorAll('.ac-zone-segment');
      const [s0, s1, s2] = Array.from(segments) as HTMLElement[];
      // index*31 % 360
      expect(s0.style.getPropertyValue('--ac-zone-hue')).toBe('0');
      expect(s1.style.getPropertyValue('--ac-zone-hue')).toBe('31');
      expect(s2.style.getPropertyValue('--ac-zone-hue')).toBe('62');
    });

    it('defaultZoneHue matches roland\'s pre-extraction formula', () => {
      // Sanity-check the exported helper against the formula that
      // roland's tone-zone-utils.ts uses (`(toneIndex * 31) % 360`).
      expect(defaultZoneHue(0)).toBe(0);
      expect(defaultZoneHue(1)).toBe(31);
      expect(defaultZoneHue(8)).toBe(248);
      // Wraps past 360
      expect(defaultZoneHue(12)).toBe((12 * 31) % 360);
      // Negative clamps to 0 (matches roland's `if (toneIndex < 0) return 0`)
      expect(defaultZoneHue(-1)).toBe(0);
    });
  });

  describe('selection', () => {
    it('clicking a zone\'s body fires onSelect with the zone index', () => {
      const onSelect = vi.fn();
      const zones: AcZoneStripZone[] = [
        { startValue: 0, endValue: 63, label: 'A' },
        { startValue: 64, endValue: 127, label: 'B' },
      ];
      render(
        <AcZoneStrip zones={zones} range={RANGE_127} onSelect={onSelect} ariaLabel="test" />,
      );
      fireEvent.click(screen.getByTestId('ac-zone-segment-body-1'));
      expect(onSelect).toHaveBeenCalledWith(1);
    });

    it('marks the selected zone via .ac-zone-segment--editing + aria-pressed', () => {
      const zones: AcZoneStripZone[] = [
        { startValue: 0, endValue: 63, isSelected: true },
        { startValue: 64, endValue: 127 },
      ];
      const { container } = render(
        <AcZoneStrip zones={zones} range={RANGE_127} ariaLabel="test" />,
      );
      const segments = container.querySelectorAll('.ac-zone-segment');
      const [first, second] = Array.from(segments) as HTMLElement[];
      expect(first.classList.contains('ac-zone-segment--editing')).toBe(true);
      expect(first.getAttribute('aria-pressed')).toBe('true');
      expect(second.classList.contains('ac-zone-segment--editing')).toBe(false);
      // unselected zone should NOT carry aria-pressed at all
      expect(second.getAttribute('aria-pressed')).toBeNull();
    });
  });

  describe('drag-handle dispatch — per-edge mode (default)', () => {
    it('renders start + end handles per zone', () => {
      const zones: AcZoneStripZone[] = [
        { startValue: 0, endValue: 63 },
        { startValue: 64, endValue: 127 },
      ];
      render(<AcZoneStrip zones={zones} range={RANGE_127} ariaLabel="test" />);
      expect(screen.getByTestId('ac-zone-handle-start-0')).toBeInTheDocument();
      expect(screen.getByTestId('ac-zone-handle-end-0')).toBeInTheDocument();
      expect(screen.getByTestId('ac-zone-handle-start-1')).toBeInTheDocument();
      expect(screen.getByTestId('ac-zone-handle-end-1')).toBeInTheDocument();
      // No split handles in default mode.
      expect(screen.queryByTestId('ac-zone-handle-split-0')).not.toBeInTheDocument();
    });

    it('start handle pointerdown fires onStartDrag(zoneIndex, "start")', () => {
      const onStartDrag = vi.fn();
      const zones: AcZoneStripZone[] = [
        { startValue: 0, endValue: 63 },
        { startValue: 64, endValue: 127 },
      ];
      render(
        <AcZoneStrip
          zones={zones}
          range={RANGE_127}
          onStartDrag={onStartDrag}
          ariaLabel="test"
        />,
      );
      fireEvent.pointerDown(screen.getByTestId('ac-zone-handle-start-1'));
      expect(onStartDrag).toHaveBeenCalledTimes(1);
      // The third arg is the event; assert only the (zoneIndex, handle)
      // contract.
      expect(onStartDrag.mock.calls[0][0]).toBe(1);
      expect(onStartDrag.mock.calls[0][1]).toBe('start');
    });

    it('end handle pointerdown fires onStartDrag(zoneIndex, "end")', () => {
      const onStartDrag = vi.fn();
      const zones: AcZoneStripZone[] = [{ startValue: 0, endValue: 127 }];
      render(
        <AcZoneStrip
          zones={zones}
          range={RANGE_127}
          onStartDrag={onStartDrag}
          ariaLabel="test"
        />,
      );
      fireEvent.pointerDown(screen.getByTestId('ac-zone-handle-end-0'));
      expect(onStartDrag).toHaveBeenCalledWith(0, 'end', expect.anything());
    });
  });

  describe('drag-handle dispatch — splitHandles mode', () => {
    it('renders N-1 split handles for N zones', () => {
      const zones: AcZoneStripZone[] = [
        { startValue: 0, endValue: 31 },
        { startValue: 32, endValue: 63 },
        { startValue: 64, endValue: 127 },
      ];
      render(
        <AcZoneStrip zones={zones} range={RANGE_127} splitHandles={true} ariaLabel="test" />,
      );
      expect(screen.getByTestId('ac-zone-handle-split-0')).toBeInTheDocument();
      expect(screen.getByTestId('ac-zone-handle-split-1')).toBeInTheDocument();
      expect(screen.queryByTestId('ac-zone-handle-split-2')).not.toBeInTheDocument();
    });

    it('does not render per-edge handles when splitHandles is true', () => {
      const zones: AcZoneStripZone[] = [
        { startValue: 0, endValue: 63 },
        { startValue: 64, endValue: 127 },
      ];
      render(
        <AcZoneStrip zones={zones} range={RANGE_127} splitHandles={true} ariaLabel="test" />,
      );
      expect(screen.queryByTestId('ac-zone-handle-start-0')).not.toBeInTheDocument();
      expect(screen.queryByTestId('ac-zone-handle-end-0')).not.toBeInTheDocument();
    });

    it('split handle pointerdown fires onStartDrag(leftZoneIndex, "split")', () => {
      const onStartDrag = vi.fn();
      const zones: AcZoneStripZone[] = [
        { startValue: 0, endValue: 31 },
        { startValue: 32, endValue: 63 },
        { startValue: 64, endValue: 127 },
      ];
      render(
        <AcZoneStrip
          zones={zones}
          range={RANGE_127}
          splitHandles={true}
          onStartDrag={onStartDrag}
          ariaLabel="test"
        />,
      );
      fireEvent.pointerDown(screen.getByTestId('ac-zone-handle-split-1'));
      // splitIndex=1 means boundary between zones[1] and zones[2]; the
      // contract is that `zoneIndex` refers to the LEFT zone.
      expect(onStartDrag).toHaveBeenCalledWith(1, 'split', expect.anything());
    });

    it('does not render a split handle when only one zone exists', () => {
      const zones: AcZoneStripZone[] = [{ startValue: 0, endValue: 127 }];
      render(
        <AcZoneStrip zones={zones} range={RANGE_127} splitHandles={true} ariaLabel="test" />,
      );
      expect(screen.queryByTestId('ac-zone-handle-split-0')).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('renders .ac-zone-bar-empty placeholder when zones.length === 0', () => {
      const { container } = render(
        <AcZoneStrip zones={[]} range={RANGE_127} ariaLabel="test" />,
      );
      const empty = container.querySelector('.ac-zone-bar-empty');
      expect(empty).toBeInTheDocument();
      expect(empty?.textContent).toBe('No zones');
    });

    it('honors custom emptyText', () => {
      render(
        <AcZoneStrip
          zones={[]}
          range={RANGE_127}
          emptyText="No keygroups · click + to create one"
          ariaLabel="test"
        />,
      );
      expect(
        screen.getByText('No keygroups · click + to create one'),
      ).toBeInTheDocument();
    });

    it('does not render segments or handles in empty state', () => {
      render(
        <AcZoneStrip
          zones={[]}
          range={RANGE_127}
          onStartDrag={vi.fn()}
          splitHandles={true}
          ariaLabel="test"
        />,
      );
      expect(screen.queryByTestId('ac-zone-segment-body-0')).not.toBeInTheDocument();
      expect(screen.queryByTestId('ac-zone-handle-split-0')).not.toBeInTheDocument();
    });
  });

  describe('ARIA', () => {
    it('exposes role="group" + aria-label on the bar root', () => {
      const zones: AcZoneStripZone[] = [{ startValue: 0, endValue: 127 }];
      render(
        <AcZoneStrip zones={zones} range={RANGE_127} ariaLabel="Velocity zones" />,
      );
      const group = screen.getByRole('group', { name: 'Velocity zones' });
      expect(group).toBeInTheDocument();
    });

    it('uses the zone\'s ariaLabel override when provided', () => {
      const zones: AcZoneStripZone[] = [
        { startValue: 0, endValue: 127, ariaLabel: 'KG 1: C-1 to G9' },
      ];
      render(
        <AcZoneStrip zones={zones} range={RANGE_127} ariaLabel="strip" />,
      );
      // The zone segment is itself a role="group" with its own label.
      expect(screen.getByRole('group', { name: 'KG 1: C-1 to G9' })).toBeInTheDocument();
    });
  });

  describe('per-edge vs splitHandles render distinctly', () => {
    it('per-edge: handles inside segments; splitHandles: handles on the bar root', () => {
      const zones: AcZoneStripZone[] = [
        { startValue: 0, endValue: 63 },
        { startValue: 64, endValue: 127 },
      ];

      const { container: perEdgeContainer, unmount } = render(
        <AcZoneStrip zones={zones} range={RANGE_127} ariaLabel="per-edge" />,
      );
      // Per-edge: 4 handles (start + end × 2 zones).
      expect(perEdgeContainer.querySelectorAll('.ac-zone-handle--start')).toHaveLength(2);
      expect(perEdgeContainer.querySelectorAll('.ac-zone-handle--end')).toHaveLength(2);
      expect(perEdgeContainer.querySelectorAll('.ac-zone-handle--split')).toHaveLength(0);
      unmount();

      const { container: splitContainer } = render(
        <AcZoneStrip
          zones={zones}
          range={RANGE_127}
          splitHandles={true}
          ariaLabel="split"
        />,
      );
      // Split: 1 boundary handle (N-1 for N=2).
      expect(splitContainer.querySelectorAll('.ac-zone-handle--start')).toHaveLength(0);
      expect(splitContainer.querySelectorAll('.ac-zone-handle--end')).toHaveLength(0);
      expect(splitContainer.querySelectorAll('.ac-zone-handle--split')).toHaveLength(1);
    });
  });

  describe('drag visual feedback', () => {
    it('isDragging flag swaps cursor via .ac-zone-segment--dragging', () => {
      const zones: AcZoneStripZone[] = [
        { startValue: 0, endValue: 127, isDragging: true },
      ];
      const { container } = render(
        <AcZoneStrip zones={zones} range={RANGE_127} ariaLabel="test" />,
      );
      const segment = container.querySelector('.ac-zone-segment') as HTMLElement;
      expect(segment.classList.contains('ac-zone-segment--dragging')).toBe(true);
      // In per-edge mode the dragging zone's edge handles ALSO show the dragging class
      const startHandle = segment.querySelector('.ac-zone-handle--start') as HTMLElement;
      expect(startHandle.classList.contains('ac-zone-handle--dragging')).toBe(true);
    });
  });

  describe('off state', () => {
    it('isOff flag applies .ac-zone-segment--off', () => {
      const zones: AcZoneStripZone[] = [
        { startValue: 0, endValue: 127, isOff: true, label: 'OFF' },
      ];
      const { container } = render(
        <AcZoneStrip zones={zones} range={RANGE_127} ariaLabel="test" />,
      );
      const segment = container.querySelector('.ac-zone-segment') as HTMLElement;
      expect(segment.classList.contains('ac-zone-segment--off')).toBe(true);
    });
  });
});
