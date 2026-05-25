/**
 * AcZoneStrip — segmented 1D zone-bar primitive.
 *
 * Visual model:
 *   .ac-zone-bar (root)
 *     .ac-zone-segment (per zone; absolute via left/width %)
 *       .ac-zone-handle--start  (per-edge mode only)
 *       .ac-zone-segment-body   (click-to-select inner target)
 *       .ac-zone-handle--end    (per-edge mode only)
 *     .ac-zone-handle--split    (splitHandles mode only; rendered on
 *                                the bar root at the boundary % between
 *                                adjacent zones)
 *
 * Two drag-handle interaction modes:
 *
 *   - **per-edge** (default): each zone has start/end handles. The
 *     consumer's `onStartDrag(zoneIndex, 'start' | 'end')` is wired to
 *     the handle's onPointerDown. Used by roland's ToneZoneEditor (the
 *     consumer's `useZoneDrag` hook resolves overlaps + binds window
 *     pointer-move/up) and by akai's KeyRangeEditor (single zone with
 *     low/high edges).
 *
 *   - **splitHandles** (opt-in via `splitHandles={true}`): a boundary
 *     handle renders BETWEEN zoneIndex and zoneIndex+1. The consumer's
 *     `onStartDrag(zoneIndex, 'split')` fires for the boundary; the
 *     `zoneIndex` refers to the zone LEFT of the boundary. Used by
 *     akai's VelocityRangeBar (4 contiguous velocity zones with shared
 *     split points).
 *
 * Per-zone hue is exposed via inline `--ac-zone-hue` style — the CSS
 * rule in `editor-core/src/design/zone-strip-primitives.css` derives
 * fill + stroke from the hue. Consumers may pass `hue` explicitly per
 * zone OR rely on the index-derived default (`index * 31 % 360`,
 * matching roland's pre-extraction palette).
 *
 * The component is intentionally PRESENTATIONAL — it emits onSelect /
 * onStartDrag events; it does NOT own drag-tracking, overlap resolution,
 * or pointer-up commit semantics. Those live in per-consumer hooks
 * (roland's `useZoneDrag` resolves overlaps; akai's split-drag binds
 * window listeners). This keeps the primitive small + composable +
 * dialect-agnostic.
 *
 * Promoted from roland's inline `.ac-zone-*` JSX in
 * `ToneZoneEditor.tsx` during akai-harmonization Phase 2 task 2.2.
 */

import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';

/**
 * Per-zone hue offset for the index-derived default palette. Matches
 * roland's pre-extraction formula in
 * `roland-sxx0-editor/src/components/patches/tone-zone-utils.ts`
 * (`zoneHueOffset(toneIndex)`). Exported as a constant so dialect
 * wrappers can mirror the rotation if they want index-derived hues
 * without mounting a full zone.
 */
export function defaultZoneHue(index: number): number {
  if (index < 0) return 0;
  return (index * 31) % 360;
}

export interface AcZoneStripZone {
  /** Start of the zone in the strip's value range (inclusive). */
  readonly startValue: number;
  /** End of the zone in the strip's value range (inclusive). */
  readonly endValue: number;
  /** Optional hue (degrees, 0-359) — drives `--ac-zone-hue` per zone.
   *  When omitted, the hue derives from the zone index via
   *  `defaultZoneHue` (matches roland's pre-extraction palette). */
  readonly hue?: number;
  /** Optional label rendered inside the zone (truncates if narrow). */
  readonly label?: string;
  /** Zone is empty/off — renders muted via `.ac-zone-segment--off`. */
  readonly isOff?: boolean;
  /** Zone is currently selected — renders the accent ring. */
  readonly isSelected?: boolean;
  /** Zone is currently being dragged — swaps cursor + suppresses click. */
  readonly isDragging?: boolean;
  /** Optional accessible label override for the SEGMENT (role="group").
   *  Defaults to a generic "Zone N: startValue-endValue" string. */
  readonly ariaLabel?: string;
  /** Optional title attribute (hover tooltip). */
  readonly title?: string;
  /** Per-edge mode only: optional handle a11y overrides. When present,
   *  the corresponding handle uses role="slider" + aria-valuenow +
   *  the supplied aria-label (canonical for interactive edge editors
   *  like akai's KeyRangeEditor). When absent, the handle stays as
   *  role="separator" with the default "Drag to set zone N start/end"
   *  label. The slider role is mutually exclusive with the separator
   *  default per the WAI-ARIA pattern: an interactive drag-edge IS a
   *  slider; a passive split-divider IS a separator. */
  readonly startHandle?: HandleA11yOverride;
  readonly endHandle?: HandleA11yOverride;
}

export interface HandleA11yOverride {
  /** Replaces the handle's default aria-label. */
  readonly ariaLabel: string;
  /** Current value carried via aria-valuenow when role=slider is set
   *  (defaults to the zone's startValue/endValue if omitted). */
  readonly ariaValueNow?: number;
  /** Min for aria-valuemin (defaults to the strip's range.min). */
  readonly ariaValueMin?: number;
  /** Max for aria-valuemax (defaults to the strip's range.max). */
  readonly ariaValueMax?: number;
}

export type AcZoneStripHandle = 'start' | 'end' | 'split';

export interface AcZoneStripProps {
  /** Ordered zones rendered left-to-right. */
  readonly zones: readonly AcZoneStripZone[];
  /** The strip's value range — defines the coordinate space the zones
   *  map into. Both endpoints are inclusive. */
  readonly range: { readonly min: number; readonly max: number };
  /** Called when the user clicks a zone's center body (not dragging).
   *  Omit to disable click-to-select. */
  readonly onSelect?: (zoneIndex: number) => void;
  /**
   * Called when the user presses pointerdown on a zone-edge handle.
   *
   * Per-edge mode (default):
   *   - handle is 'start' or 'end' of `zoneIndex`.
   *
   * splitHandles mode (`splitHandles={true}`):
   *   - handle is always 'split'.
   *   - `zoneIndex` refers to the zone LEFT of the boundary (handle
   *     sits between `zones[zoneIndex]` and `zones[zoneIndex+1]`).
   *
   * The component does NOT bind window pointermove / pointerup
   * listeners — the consumer's hook owns the drag lifecycle. The
   * primitive only signals drag-start.
   */
  readonly onStartDrag?: (zoneIndex: number, handle: AcZoneStripHandle, event: ReactPointerEvent<HTMLElement>) => void;
  /** When true, render boundary handles BETWEEN adjacent zones (akai's
   *  VelocityRangeBar pattern). When false (default), render per-edge
   *  handles on each zone (roland's ToneZoneEditor pattern). */
  readonly splitHandles?: boolean;
  /** Accessible label for the strip's `role="group"`. Recommended. */
  readonly ariaLabel?: string;
  /** Optional className appended to the bar root. */
  readonly className?: string;
  /** Optional ref forwarded to the bar root (for consumer pointer-map
   *  via `getBoundingClientRect()`). */
  readonly barRef?: React.RefObject<HTMLDivElement>;
  /** Text shown via `.ac-zone-bar-empty` when `zones.length === 0`.
   *  Defaults to "No zones". */
  readonly emptyText?: string;
}

/**
 * Map a value in `range` to a percent position on the bar (0..100).
 * Uses `(value - min) / (max - min + 1)` (NOT `/ span`) — every cell
 * is one inclusive unit, so a strip with `range={min:0, max:127}` has
 * 128 cells and position 64 lands at exactly 50%. This matches
 * roland's pre-extraction formula in ToneZoneEditor
 * (`(zone.startKey - MIN_KEY) / TOTAL_KEYS`) and akai's velocity-bar
 * formula (`velocity / VELOCITY_MAX` was the prior approximation;
 * the `+1` is the structurally correct accounting because the high
 * value is INCLUSIVE).
 *
 * Clamped — caller passes values inside `range`; we still clamp so a
 * malformed zone doesn't paint off-bar.
 */
function valueToPercent(value: number, range: { min: number; max: number }): number {
  const span = range.max - range.min + 1;
  if (span <= 0) return 0;
  const clamped = Math.max(range.min, Math.min(range.max + 1, value));
  return ((clamped - range.min) / span) * 100;
}

/**
 * Compose the segment's classlist from its state modifiers. Kept as a
 * helper (instead of inlining a template string) so the per-state
 * class names are searchable + diff-friendly.
 */
function segmentClass(zone: AcZoneStripZone): string {
  const parts = ['ac-zone-segment'];
  if (zone.isOff) parts.push('ac-zone-segment--off');
  if (zone.isSelected) parts.push('ac-zone-segment--editing');
  if (zone.isDragging) parts.push('ac-zone-segment--dragging');
  return parts.join(' ');
}

export function AcZoneStrip({
  zones,
  range,
  onSelect,
  onStartDrag,
  splitHandles = false,
  ariaLabel,
  className,
  barRef,
  emptyText = 'No zones',
}: AcZoneStripProps): JSX.Element {
  const rootClass = className ? `ac-zone-bar ${className}` : 'ac-zone-bar';

  if (zones.length === 0) {
    return (
      <div
        ref={barRef}
        className={rootClass}
        role="group"
        aria-label={ariaLabel}
      >
        <div className="ac-zone-bar-empty">{emptyText}</div>
      </div>
    );
  }

  return (
    <div
      ref={barRef}
      className={rootClass}
      role="group"
      aria-label={ariaLabel}
    >
      {zones.map((zone, index) => {
        const startPercent = valueToPercent(zone.startValue, range);
        // Width: (endValue - startValue + 1) / span — +1 because both
        // endpoints are inclusive (matches roland's TOTAL_KEYS math
        // exactly). Floor at 1% so a single-value zone still paints.
        const totalCells = range.max - range.min + 1;
        const widthPercent = Math.max(((zone.endValue - zone.startValue + 1) / totalCells) * 100, 1);
        const hue = zone.hue !== undefined ? zone.hue : defaultZoneHue(index);

        const style: CSSProperties = {
          left: `${startPercent}%`,
          width: `${widthPercent}%`,
          ['--ac-zone-hue' as string]: hue,
        };

        const defaultAriaLabel = `Zone ${index + 1}: ${zone.startValue}-${zone.endValue}`;
        const ariaLabelText = zone.ariaLabel ?? defaultAriaLabel;

        return (
          <div
            key={index}
            role="group"
            aria-label={ariaLabelText}
            aria-pressed={zone.isSelected ? true : undefined}
            className={segmentClass(zone)}
            style={style}
            title={zone.title}
          >
            {!splitHandles && (
              <div
                className={
                  zone.isDragging
                    ? 'ac-zone-handle ac-zone-handle--start ac-zone-handle--dragging'
                    : 'ac-zone-handle ac-zone-handle--start'
                }
                onPointerDown={(event) => onStartDrag?.(index, 'start', event)}
                aria-label={zone.startHandle?.ariaLabel ?? `Drag to set zone ${index + 1} start`}
                role={zone.startHandle ? 'slider' : 'separator'}
                tabIndex={zone.startHandle ? 0 : undefined}
                aria-valuenow={
                  zone.startHandle
                    ? zone.startHandle.ariaValueNow ?? zone.startValue
                    : undefined
                }
                aria-valuemin={
                  zone.startHandle
                    ? zone.startHandle.ariaValueMin ?? range.min
                    : undefined
                }
                aria-valuemax={
                  zone.startHandle
                    ? zone.startHandle.ariaValueMax ?? range.max
                    : undefined
                }
                data-testid={`ac-zone-handle-start-${index}`}
              />
            )}
            <button
              type="button"
              onClick={() => onSelect?.(index)}
              className="ac-zone-segment-body"
              data-testid={`ac-zone-segment-body-${index}`}
            >
              {widthPercent > 8 ? zone.label ?? '' : ''}
            </button>
            {!splitHandles && (
              <div
                className={
                  zone.isDragging
                    ? 'ac-zone-handle ac-zone-handle--end ac-zone-handle--dragging'
                    : 'ac-zone-handle ac-zone-handle--end'
                }
                onPointerDown={(event) => onStartDrag?.(index, 'end', event)}
                aria-label={zone.endHandle?.ariaLabel ?? `Drag to set zone ${index + 1} end`}
                role={zone.endHandle ? 'slider' : 'separator'}
                tabIndex={zone.endHandle ? 0 : undefined}
                aria-valuenow={
                  zone.endHandle
                    ? zone.endHandle.ariaValueNow ?? zone.endValue
                    : undefined
                }
                aria-valuemin={
                  zone.endHandle
                    ? zone.endHandle.ariaValueMin ?? range.min
                    : undefined
                }
                aria-valuemax={
                  zone.endHandle
                    ? zone.endHandle.ariaValueMax ?? range.max
                    : undefined
                }
                data-testid={`ac-zone-handle-end-${index}`}
              />
            )}
          </div>
        );
      })}

      {splitHandles &&
        zones.map((zone, index) => {
          // Render a boundary handle between zones[index] and zones[index+1].
          if (index >= zones.length - 1) return null;
          const next = zones[index + 1];
          // Skip when either side is invalid (defensive).
          if (zone.endValue < zone.startValue || next.endValue < next.startValue) {
            return null;
          }
          // Position at the boundary value (end of left zone, +0.5 for
          // visual centering on the gap between integer ticks).
          const boundaryPercent = valueToPercent(zone.endValue + 0.5, range);
          return (
            <div
              key={`split-${index}`}
              className="ac-zone-handle ac-zone-handle--split"
              onPointerDown={(event) => onStartDrag?.(index, 'split', event)}
              data-testid={`ac-zone-handle-split-${index}`}
              aria-label={`Drag to set boundary between zone ${index + 1} and zone ${index + 2}`}
              role="separator"
              style={{
                left: `${boundaryPercent}%`,
                width: '0.5rem',
                marginLeft: '-0.25rem',
              }}
            />
          );
        })}
    </div>
  );
}
