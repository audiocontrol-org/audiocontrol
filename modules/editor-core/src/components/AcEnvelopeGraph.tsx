import { useRef, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * `<AcEnvelopeGraph>` — the VFD-glow "monitor" portion of `<AcEnvelope>`.
 *
 * Renders the full-width phosphor-scanline graphic with grid lines, an
 * accent fill polygon, the bright stroke line, draggable point markers,
 * x-axis ticks, the y-axis level guides, and the sustain marker label.
 *
 * Horizontal scaling (the non-obvious part):
 *
 *   Each segment owns a *fixed-width slot* of `100 / n` percent of the
 *   canvas. Segment i's point sits at
 *
 *       x_i = (i - 1) / n + slotFill_i / n
 *
 *   where `slotFill_i = ((maxTime + 1) - seg.time) / (maxTime + 1)`,
 *   so a slow rate (small `time` value) fills the slot toward its right
 *   edge while a fast rate (large `time` value) keeps the point near the
 *   slot's left edge. Crucially the X of segment i depends ONLY on
 *   segment i's own time — dragging any single point cannot move any
 *   other point horizontally.
 *
 *   This intentionally rejects the cumulative-time model used by the
 *   pre-v3 `EnvelopeEditor` (and by the naïve `cumulativeTime /
 *   totalTime` reading). The cumulative model preserves prior segments
 *   but still shifts SUBSEQUENT segments when you drag one — operators
 *   don't want that. Each segment having its own visual slot is the
 *   only model that makes dragging feel right.
 *
 * Drag interaction:
 *
 *   Each per-segment point button captures the pointer on press and
 *   streams `onTimeChange(segmentIndex, time)` + `onLevelChange(...)`
 *   per move. `onCommit` fires once on release so the consuming page
 *   can perform the device write at drag-end instead of per pixel.
 *
 * Mockup source:
 *   docs/1.0/001-IN-PROGRESS/s550-support/explorations/04-tones.html:1570-1862 (CSS),
 *   :2640-2715 (demo HTML for the graphic + envelope canvas).
 */
export interface AcEnvelopeGraphSegment {
  /** Per-segment device parameter controlling time advance (1..maxTime).
   *  Higher = faster = shorter rendered extent (slot fill = (maxTime+1) - time). */
  time: number;
  /** Level value, 0..maxLevel (typically 0..127). */
  level: number;
}

export interface AcEnvelopeGraphProps {
  label: string;
  segments: ReadonlyArray<AcEnvelopeGraphSegment>;
  /** Maximum time/rate value per segment. Defaults to 127 (S-series). */
  maxTime?: number;
  maxLevel: number;
  sustainSegment: number;
  activeSegment: number;
  helpText?: string;
  /** Called on press of a segment point; receives the 1-based segment index. */
  onPointSelect?: (index: number) => void;
  /** Per-drag-move callback. Receives 1-based segment index + new time value. */
  onTimeChange?: (segmentIndex: number, time: number) => void;
  /** Per-drag-move callback. Receives 1-based segment index + new level value. */
  onLevelChange?: (segmentIndex: number, level: number) => void;
  /** Fired once at drag end (pointerup / pointercancel). Consumer uses this to
   *  fire the device commit; per-move callbacks update local state only. */
  onCommit?: () => void;
  onExpand?: () => void;
  /**
   * When true, every selectable point `<button>` is rendered with the native
   * `disabled` attribute so the browser drops it from the tab order and
   * blocks both click and keyboard activation.
   */
  disabled?: boolean;
}

interface PointXY {
  x: number;
  y: number;
}

interface DragState {
  segmentIdx: number; // 1-based
}

export function AcEnvelopeGraph(props: AcEnvelopeGraphProps): JSX.Element {
  const n = props.segments.length;
  const maxTime = props.maxTime ?? 127;
  const slotSize = maxTime + 1;
  // Slot width in % of canvas width. Each segment owns 100/n percent.
  const slotWidthPct = n > 0 ? 100 / n : 100;

  // Per-segment X positioning. Slot i (0-based) is the range
  // [i * slotWidthPct, (i+1) * slotWidthPct]; segment i+1's point sits at
  // slot_start + slotFill * slotWidth, where slotFill ∈ (0, 1].
  // Result: each point's X depends ONLY on its own time value.
  const pointsXY: PointXY[] = props.segments.map((seg, i) => {
    const slotFill = (slotSize - seg.time) / slotSize;
    return {
      x: i * slotWidthPct + slotFill * slotWidthPct,
      y: 100 - (seg.level / props.maxLevel) * 100,
    };
  });
  const allPoints: PointXY[] = [{ x: 0, y: 100 }, ...pointsXY];

  const linePath = allPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
  const fillPath = `${linePath} L 100 100 L 0 100 Z`;

  // Drag state lives in a ref so per-move updates don't trigger a render
  // cycle inside the drag loop. The drag handlers read cumulativeSlots
  // *only* at drag start (captured via prevCumSlots) so the math is
  // stable even as the parent re-renders mid-drag with new segment
  // values from our streaming callbacks.
  const dragStateRef = useRef<DragState | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const dragEnabled =
    props.disabled !== true &&
    (props.onTimeChange !== undefined || props.onLevelChange !== undefined);

  const handlePointerDown = (
    segmentIdx: number,
    e: ReactPointerEvent<HTMLButtonElement>,
  ): void => {
    if (props.disabled === true) {
      return;
    }
    // Select the segment regardless of whether a drag follows — a press
    // without movement reads as a click in this UI.
    props.onPointSelect?.(segmentIdx);
    if (!dragEnabled) {
      return;
    }
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* setPointerCapture can throw on synthetic events; fall through to
         the fallback global-listener path that pointermove on the button
         still receives even without capture in most browsers. */
    }
    dragStateRef.current = { segmentIdx };
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLButtonElement>): void => {
    const state = dragStateRef.current;
    if (state === null) {
      return;
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect === undefined || rect.width === 0 || rect.height === 0) {
      return;
    }
    const pointerXPct = ((e.clientX - rect.left) / rect.width) * 100;
    const pointerYPct = ((e.clientY - rect.top) / rect.height) * 100;

    // X → slot fraction → rate. The dragged segment owns the slot
    // [(idx-1) * slotWidthPct, idx * slotWidthPct]. The fraction
    // `slotFill` is how far the point is filled within its own slot;
    // it clamps automatically when the pointer leaves the slot left or
    // right. Subsequent segments do NOT see this — their X positions
    // are computed from THEIR own time values only.
    const slotStartPct = (state.segmentIdx - 1) * slotWidthPct;
    const rawSlotFill = (pointerXPct - slotStartPct) / slotWidthPct;
    const clampedSlotFill = Math.max(
      1 / slotSize, // floor so rate stays ≤ maxTime
      Math.min(1, rawSlotFill), // ceiling so rate stays ≥ 1
    );
    const newTime = Math.max(
      1,
      Math.min(maxTime, Math.round(slotSize * (1 - clampedSlotFill))),
    );

    // Y → level. Linear; 0 is bottom (y=100%), maxLevel is top (y=0%).
    const newLevel = Math.max(
      0,
      Math.min(
        props.maxLevel,
        Math.round(props.maxLevel * (1 - pointerYPct / 100)),
      ),
    );

    props.onTimeChange?.(state.segmentIdx, newTime);
    props.onLevelChange?.(state.segmentIdx, newLevel);
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLButtonElement>): void => {
    if (dragStateRef.current === null) {
      return;
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* releasePointerCapture throws if no capture is active; ignore. */
    }
    dragStateRef.current = null;
    props.onCommit?.();
  };

  return (
    <div
      className="ac-envelope-graph"
      role="region"
      aria-label={`${props.label} — ${n} segments, segment ${props.activeSegment} active`}
    >
      <span className="ac-envelope-graph__label">{props.label}</span>
      {props.onExpand !== undefined ? (
        <button
          className="ac-envelope-graph__expand"
          type="button"
          aria-label="Expand for precision editing"
          onClick={props.onExpand}
        >
          {'⤢'}
        </button>
      ) : null}
      <div className="ac-envelope-y-axis" aria-hidden="true">
        <span>L{props.maxLevel}</span>
        <span>L0</span>
      </div>
      <div className="ac-envelope-canvas" ref={canvasRef}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1="0" y1="0" x2="100" y2="0" className="ac-envelope-grid-line" />
          <line x1="0" y1="50" x2="100" y2="50" className="ac-envelope-grid-line ac-envelope-grid-line--baseline" />
          <line x1="0" y1="100" x2="100" y2="100" className="ac-envelope-grid-line ac-envelope-grid-line--baseline" />
          {renderDividers(n)}
          {props.activeSegment > 0 && props.activeSegment <= n ? (
            <line
              x1={String(pointsXY[props.activeSegment - 1]?.x ?? 0)}
              y1="0"
              x2={String(pointsXY[props.activeSegment - 1]?.x ?? 0)}
              y2="100"
              className="ac-envelope-active-guide"
            />
          ) : null}
          <path d={fillPath} className="ac-envelope-fill" />
          <path d={linePath} className="ac-envelope-line" />
        </svg>
        <div className="ac-envelope-points">
          {allPoints.map((p, i) =>
            renderPoint(i, p, props, {
              onPointerDown: handlePointerDown,
              onPointerMove: handlePointerMove,
              onPointerUp: handlePointerUp,
              dragEnabled,
            }),
          )}
        </div>
        {pointsXY[props.sustainSegment - 1] !== undefined ? (
          <span
            className="ac-envelope-sustain-label"
            style={{
              left: `${pointsXY[props.sustainSegment - 1].x}%`,
              top: `${pointsXY[props.sustainSegment - 1].y}%`,
            }}
          >
            {'▸ SUS'}
          </span>
        ) : null}
      </div>
      <div className="ac-envelope-axis" aria-hidden="true">
        <span className="ac-envelope-axis-tick" style={{ left: '0%' }}>
          Start
        </span>
        {pointsXY.map((p, i) => {
          const isActive = i + 1 === props.activeSegment;
          const tickClass = isActive
            ? 'ac-envelope-axis-tick ac-envelope-axis-tick--active'
            : 'ac-envelope-axis-tick';
          return (
            <span key={i + 1} className={tickClass} style={{ left: `${p.x}%` }}>
              {i + 1}
            </span>
          );
        })}
      </div>
      {props.helpText !== undefined ? (
        <span className="ac-envelope-graph__help">{props.helpText}</span>
      ) : null}
    </div>
  );
}

function renderDividers(n: number): JSX.Element[] {
  // Dividers sit at fixed slot boundaries — every i/n share of the
  // canvas, for i in 1..n-1. They give the operator a stable visual
  // anchor for which slot each point lives in regardless of the point's
  // current slotFill. Drawing them at point positions instead would
  // make the dividers wobble as the points move, breaking the "fixed
  // slot" mental model.
  const out: JSX.Element[] = [];
  for (let i = 1; i < n; i += 1) {
    const x = (i / n) * 100;
    out.push(
      <line
        key={i}
        x1={String(x)}
        y1="0"
        x2={String(x)}
        y2="100"
        className="ac-envelope-segment-divider"
      />,
    );
  }
  return out;
}

interface DragCallbacks {
  onPointerDown: (segmentIdx: number, e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  dragEnabled: boolean;
}

function renderPoint(
  i: number,
  p: PointXY,
  props: AcEnvelopeGraphProps,
  drag: DragCallbacks,
): JSX.Element {
  const isActive = i === props.activeSegment;
  const pointClass = isActive
    ? 'ac-envelope-point ac-envelope-point--active'
    : 'ac-envelope-point';
  // Point 0 is the implicit anchor at (0%, 100%); it is not a selectable
  // segment and renders as a non-interactive marker.
  if (i === 0) {
    return (
      <span
        key={i}
        className={pointClass}
        style={{ left: `${p.x}%`, top: `${p.y}%` }}
        aria-hidden="true"
      />
    );
  }
  // Selectable segments render as native buttons so keyboard activation
  // (Space + Enter) and focus semantics come for free. Drag handlers are
  // wired via pointer events; the legacy onClick path is preserved as a
  // fallback when onTimeChange/onLevelChange aren't provided.
  const disabled = props.disabled === true;
  return (
    <button
      key={i}
      type="button"
      className={pointClass}
      style={{ left: `${p.x}%`, top: `${p.y}%` }}
      onPointerDown={
        disabled ? undefined : (e) => drag.onPointerDown(i, e)
      }
      onPointerMove={
        drag.dragEnabled && !disabled ? drag.onPointerMove : undefined
      }
      onPointerUp={
        drag.dragEnabled && !disabled ? drag.onPointerUp : undefined
      }
      onPointerCancel={
        drag.dragEnabled && !disabled ? drag.onPointerUp : undefined
      }
      aria-label={`Select segment ${i}`}
      aria-pressed={isActive}
      disabled={disabled}
    />
  );
}
