import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import {
  pointerToCanvasPct,
  tryCapturePointer,
  tryReleasePointer,
} from './envelopeDragHelpers';
import {
  EnvelopeAnchorPoint,
  EnvelopeDragPoint,
  EnvelopeGridLines,
} from './envelopeChromeHelpers';

/**
 * `<AcEnvelopeGraph>` — the VFD-glow "monitor" portion of `<AcEnvelope>`.
 *
 * Renders the full-width phosphor-scanline graphic with an accent fill
 * polygon, the bright stroke line, draggable point markers, x-axis
 * ticks, the y-axis level guides, and the sustain marker label.
 *
 * Horizontal scaling — the cumulative-advance model:
 *
 *   Each segment owns a per-segment slot of width `100 / n` percent of
 *   the canvas, but the slot's left edge sits at the PREVIOUS point's
 *   X position (the anchor at x=0 for segment 1). Each segment "spends"
 *   somewhere between 0% and slot-width of horizontal space based on
 *   its time value:
 *
 *       x_i = x_{i-1} + slotFill_i * (100 / n)
 *       slotFill_i = ((maxTime + 1) - seg.time) / (maxTime + 1)
 *
 *   where `x_0 = 0` is the anchor. So a fast segment (`time` near
 *   `maxTime`) advances the cursor by a tiny amount and renders right
 *   next to the previous point; a slow segment (`time = 1`) advances by
 *   nearly the full slot width. A "zero decay" segment looks zero
 *   width — the user-visible invariant this graph honors.
 *
 *   Trade-off: dragging segment i moves segments j > i along with it
 *   horizontally, because their slots start at i's new position. This
 *   is the natural reading of "segment time = horizontal distance from
 *   the previous point." A prior slot-anchored model (slots fixed at
 *   `i/n` regardless of prior points) avoided that side-effect but
 *   gave segments 2..n a non-zero minimum visible length, which read
 *   as "even instant decays take time" — misleading. Operator
 *   confirmed the cumulative model is correct.
 *
 * Drag interaction:
 *
 *   Each per-segment point button captures the pointer on press and
 *   streams `onTimeChange(segmentIndex, time)` + `onLevelChange(...)`
 *   per move. `onCommit` fires once on release so the consuming page
 *   can perform the device write at drag-end instead of per pixel.
 *   The slot anchor for segment i is the CURRENT x of segment i-1 (or
 *   the canvas left edge for i=1), which stays stable during the drag
 *   because we only mutate the dragged segment's own time.
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

  // Per-segment X positioning. Each segment advances the cursor by
  //   slotFill_i * slotWidthPct
  // where slotFill_i ∈ (0, 1] is determined by segment i's time alone.
  // A fast segment (time near maxTime) advances by ~0 and lands next
  // to the previous point; a slow segment (time = 1) advances by the
  // full slot width. Cursor starts at the anchor (x = 0).
  const pointsXY: PointXY[] = [];
  let cursorX = 0;
  for (const seg of props.segments) {
    const slotFill = (slotSize - seg.time) / slotSize;
    cursorX += slotFill * slotWidthPct;
    pointsXY.push({
      x: cursorX,
      y: 100 - (seg.level / props.maxLevel) * 100,
    });
  }
  const allPoints: PointXY[] = [{ x: 0, y: 100 }, ...pointsXY];

  const linePath = allPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
  const fillPath = `${linePath} L 100 100 L 0 100 Z`;

  // Drag state lives in a ref so per-move updates don't trigger a render
  // cycle inside the drag loop. The slot anchor for the dragged segment
  // is the previous point's x (computed fresh on every pointermove from
  // the up-to-date `pointsXY`), which is stable because we only mutate
  // the dragged segment's time — predecessor positions don't change.
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
    tryCapturePointer(e);
    dragStateRef.current = { segmentIdx };
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLButtonElement>): void => {
    const state = dragStateRef.current;
    if (state === null) {
      return;
    }
    const pointer = pointerToCanvasPct(canvasRef.current, e);
    if (pointer === null) {
      return;
    }
    const pointerXPct = pointer.xPct;
    const pointerYPct = pointer.yPct;

    // X → slot fraction → rate. The dragged segment's slot starts at
    // the PREVIOUS point's x and is `slotWidthPct` wide. slotFill is
    // how far into the slot the pointer is; it clamps when the pointer
    // leaves either edge. The previous point's x doesn't move during
    // the drag (we only mutate the dragged segment's time), so the
    // slot anchor stays stable per pointermove. Segments j > i shift
    // along with the new cursor position — that's the cumulative
    // model's natural side effect.
    const prevPointX = state.segmentIdx === 1 ? 0 : pointsXY[state.segmentIdx - 2].x;
    const rawSlotFill = (pointerXPct - prevPointX) / slotWidthPct;
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
    tryReleasePointer(e);
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
          <EnvelopeGridLines />
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
  // Faint vertical guides at every `i/n * 100` share of the canvas.
  // In the cumulative-advance model these mark the maximum possible x
  // for segment i's point — i.e. the cursor's furthest-right position
  // after i segments at full slot width each. They give the operator
  // a reference grid for "how much horizontal room each segment can
  // occupy" without claiming the point sits there exactly.
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
  // Point 0 is the implicit anchor at (0%, 100%); it is not a selectable
  // segment and renders as a non-interactive marker.
  if (i === 0) {
    return (
      <EnvelopeAnchorPoint
        key={i}
        xPct={p.x}
        yPct={p.y}
        isActive={isActive}
      />
    );
  }
  // Selectable segments render as native buttons so keyboard activation
  // (Space + Enter) and focus semantics come for free. Drag handlers are
  // wired via pointer events; the legacy onClick path is preserved as a
  // fallback when onTimeChange/onLevelChange aren't provided.
  const disabled = props.disabled === true;
  return (
    <EnvelopeDragPoint
      key={i}
      xPct={p.x}
      yPct={p.y}
      isActive={isActive}
      disabled={disabled}
      dragEnabled={drag.dragEnabled}
      ariaLabel={`Select segment ${i}`}
      onPointerDown={(e) => drag.onPointerDown(i, e)}
      onPointerMove={drag.onPointerMove}
      onPointerUp={drag.onPointerUp}
    />
  );
}
