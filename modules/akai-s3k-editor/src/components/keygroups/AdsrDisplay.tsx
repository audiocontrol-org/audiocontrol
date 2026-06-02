/**
 * Interactive envelope editors for S3K keygroup editor.
 *
 * Layout: each segment has a FIXED horizontal budget (like Roland).
 * The value determines how much of that budget is filled.
 * Higher value = more time = wider segment.
 * This prevents dragging one point from shifting others.
 *
 * S3K values 0-99 are TIMES (not rates): 0 = instant, 99 = slowest.
 * This is the opposite of Roland (where rate 127 = fastest).
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// =========================================================================
// Constants
// =========================================================================

const WIDTH = 400;
const HEIGHT = 120;
const PADDING = 16;
const DRAW_WIDTH = WIDTH - PADDING * 2;
const DRAW_HEIGHT = HEIGHT - PADDING * 2;
const BOTTOM = PADDING + DRAW_HEIGHT;
const TOP = PADDING;
const MAX_VAL = 99;
const HIT_RADIUS = 14;
const POINT_RADIUS = 5;
const POINT_RADIUS_ACTIVE = 7;
const LABEL_Y = HEIGHT + 14;
const TOTAL_HEIGHT = HEIGHT + 20;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

/**
 * Fixed-scale X positions.
 *
 * Each segment gets a budget of MAX_VAL pixels worth of time.
 * The value (0-99) determines how much of that budget is used.
 * Value 0 = instant (minimum width), value 99 = full budget.
 *
 * Total possible width = segCount * MAX_VAL.
 * Actual width = sum of values + minimum widths.
 * Scale factor maps this to DRAW_WIDTH.
 */
function fixedScaleXPositions(values: number[], segCount: number): number[] {
  // Each segment: value + a small minimum so even 0 is visible
  const MIN_SEG = 5;
  const maxTotal = segCount * (MAX_VAL + MIN_SEG);

  const xs = [PADDING];
  let cumulative = 0;
  for (let i = 0; i < values.length; i++) {
    cumulative += clamp(values[i], 0, MAX_VAL) + MIN_SEG;
    xs.push(PADDING + (cumulative / maxTotal) * DRAW_WIDTH);
  }
  return xs;
}

// =========================================================================
// ADSR Editor (Amp Envelope)
// =========================================================================

interface AdsrDisplayProps {
  attack: number;   // 0-99 time
  decay: number;    // 0-99 time
  sustain: number;  // 0-99 level
  release: number;  // 0-99 time
  onChange?: (changes: Record<string, number>) => void;
  onCommit?: () => void;
}

export function AdsrDisplay({ attack, decay, sustain, release, onChange, onCommit }: AdsrDisplayProps): JSX.Element {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  // Layout: point 3 (sustain end) is fixed at 75% of draw width.
  // Attack + decay + sustain share the left 75%.
  // Release gets the right 25%.
  const SPLIT = 0.75;
  const LEFT_WIDTH = DRAW_WIDTH * SPLIT;   // for attack + decay + sustain hold
  const RIGHT_WIDTH = DRAW_WIDTH * (1 - SPLIT); // for release

  // Attack and decay share the left zone with a fixed-scale budget each
  const MIN_SEG = 5;
  const adBudget = 2 * (MAX_VAL + MIN_SEG); // total budget for attack + decay
  const atkPx = ((attack + MIN_SEG) / adBudget) * LEFT_WIDTH;
  const decPx = ((decay + MIN_SEG) / adBudget) * LEFT_WIDTH;
  // Sustain hold fills whatever remains of the left zone (not stored, just visual)

  // Release fills the right zone proportionally
  const relPx = ((release + MIN_SEG) / (MAX_VAL + MIN_SEG)) * RIGHT_WIDTH;

  const x0 = PADDING;
  const x1 = x0 + atkPx;
  const x2 = x1 + decPx;
  const x3 = x0 + LEFT_WIDTH; // fixed at 75%
  const x4 = x3 + relPx;

  const xs = [x0, x1, x2, x3, x4];
  const susY = BOTTOM - (sustain / MAX_VAL) * DRAW_HEIGHT;

  const points = [
    { x: x0, y: BOTTOM },   // 0: origin
    { x: x1, y: TOP },      // 1: attack peak
    { x: x2, y: susY },     // 2: decay end / sustain start
    { x: x3, y: susY },     // 3: sustain end (fixed at 75%)
    { x: x4, y: BOTTOM },   // 4: release end
  ];
  const draggable = [false, true, true, false, true];

  const getMousePos = useCallback((e: MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (WIDTH / rect.width),
      y: (e.clientY - rect.top) * (TOTAL_HEIGHT / rect.height),
    };
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragging === null || !onChange) return;
    const pos = getMousePos(e);

    // Attack and decay: map pixel width back to 0-99 using the left zone budget
    const adPxPerUnit = LEFT_WIDTH / adBudget;

    if (dragging === 1) {
      // Attack peak: pixel distance from origin
      const segPx = Math.max(0, pos.x - x0);
      onChange({ ATTAK1: clamp(segPx / adPxPerUnit - MIN_SEG, 0, MAX_VAL) });
    } else if (dragging === 2) {
      // Decay end: pixel distance from attack peak, Y → sustain level
      const segPx = Math.max(0, pos.x - x1);
      const newSustain = clamp((1 - (pos.y - PADDING) / DRAW_HEIGHT) * MAX_VAL, 0, MAX_VAL);
      onChange({ DECAY1: clamp(segPx / adPxPerUnit - MIN_SEG, 0, MAX_VAL), SUSTN1: newSustain });
    } else if (dragging === 4) {
      // Release end: pixel distance from fixed point 3, using right zone scale
      const relPxPerUnit = RIGHT_WIDTH / (MAX_VAL + MIN_SEG);
      const segPx = Math.max(0, pos.x - x3);
      onChange({ RELSE1: clamp(segPx / relPxPerUnit - MIN_SEG, 0, MAX_VAL) });
    }
  }, [dragging, onChange, getMousePos, x0, x1, x3, LEFT_WIDTH, RIGHT_WIDTH, adBudget]);

  const handleMouseUp = useCallback(() => {
    if (dragging !== null) onCommit?.();
    setDragging(null);
  }, [dragging, onCommit]);

  useEffect(() => {
    if (dragging !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const fillD = `${pathD} L ${points[4].x} ${BOTTOM} L ${points[0].x} ${BOTTOM} Z`;

  const labels = [
    { text: 'A', x: (xs[0] + xs[1]) / 2 },
    { text: 'D', x: (xs[1] + xs[2]) / 2 },
    { text: 'S', x: (xs[2] + xs[3]) / 2 },
    { text: 'R', x: (xs[3] + xs[4]) / 2 },
  ];

  return (
    <svg ref={svgRef} width={WIDTH} height={TOTAL_HEIGHT}
      viewBox={`0 0 ${WIDTH} ${TOTAL_HEIGHT}`} className="ac-curve-display"
      aria-label={`ADSR: A=${attack} D=${decay} S=${sustain} R=${release}`}>
      <rect x={0} y={0} width={WIDTH} height={HEIGHT} rx={4} className="ac-curve-bg" />
      {[0.25, 0.5, 0.75].map((pct) => (
        <line key={pct} x1={PADDING} y1={TOP + pct * DRAW_HEIGHT}
          x2={PADDING + DRAW_WIDTH} y2={TOP + pct * DRAW_HEIGHT}
          stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
      ))}
      <path d={fillD} className="ac-curve-fill" />
      <path d={pathD} className="ac-curve-line" />
      {points.map((p, i) => (
        <g key={i}>
          {draggable[i] && onChange && (
            <circle cx={p.x} cy={p.y} r={HIT_RADIUS} fill="transparent"
              className={dragging === i ? 'ac-curve-hit--dragging' : 'ac-curve-hit'}
              onMouseDown={(e) => { e.preventDefault(); setDragging(i); }} />
          )}
          <circle cx={p.x} cy={p.y}
            r={dragging === i ? POINT_RADIUS_ACTIVE : (draggable[i] ? POINT_RADIUS : 3)}
            className={draggable[i] && onChange ? 'ac-curve-dot ac-curve-dot--draggable' : 'ac-curve-dot'}
            onMouseDown={draggable[i] && onChange ? (e) => { e.preventDefault(); setDragging(i); } : undefined} />
        </g>
      ))}
      {labels.map((l) => (
        <text key={l.text} x={l.x} y={LABEL_Y} className="s3k-adsr-label">{l.text}</text>
      ))}
    </svg>
  );
}

// =========================================================================
// Multi-Point Envelope (Filter Envelope)
// =========================================================================

interface MultiPointEnvelopeDisplayProps {
  rates: [number, number, number, number];
  levels: [number, number, number, number];
  onChange?: (changes: Record<string, number>) => void;
  onCommit?: () => void;
}

export function MultiPointEnvelopeDisplay({ rates, levels, onChange, onCommit }: MultiPointEnvelopeDisplayProps): JSX.Element {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  const segCount = 4;
  const xs = fixedScaleXPositions([...rates], segCount);

  const yPositions = [BOTTOM];
  for (let i = 0; i < 4; i++) {
    yPositions.push(PADDING + (1 - levels[i] / MAX_VAL) * DRAW_HEIGHT);
  }

  const rateFields = ['ENV2R1', 'ENV2R2', 'ENV2R3', 'ENV2R4'];
  const levelFields = ['ENV2L1', 'ENV2L2', 'ENV2L3', 'ENV2L4'];

  const getMousePos = useCallback((e: MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (WIDTH / rect.width),
      y: (e.clientY - rect.top) * (TOTAL_HEIGHT / rect.height),
    };
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragging === null || !onChange) return;
    const segIndex = dragging - 1;
    if (segIndex < 0 || segIndex >= 4) return;

    const pos = getMousePos(e);

    const MIN_SEG = 5;
    const maxTotal = segCount * (MAX_VAL + MIN_SEG);
    const pxPerUnit = DRAW_WIDTH / maxTotal;

    // Level from Y
    const newLevel = clamp((1 - (pos.y - PADDING) / DRAW_HEIGHT) * MAX_VAL, 0, MAX_VAL);

    // Rate from segment width
    const prevX = xs[segIndex];
    const segPx = Math.max(0, pos.x - prevX);
    const units = segPx / pxPerUnit - MIN_SEG;
    const newRate = clamp(units, 0, MAX_VAL);

    onChange({ [levelFields[segIndex]]: newLevel, [rateFields[segIndex]]: newRate });
  }, [dragging, onChange, getMousePos, xs, segCount]);

  const handleMouseUp = useCallback(() => {
    if (dragging !== null) onCommit?.();
    setDragging(null);
  }, [dragging, onCommit]);

  useEffect(() => {
    if (dragging !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  const points = xs.map((x, i) => ({ x, y: yPositions[i] }));
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const fillD = `${pathD} L ${xs[4]} ${BOTTOM} L ${xs[0]} ${BOTTOM} Z`;

  const labels = rates.map((_, i) => ({
    text: String(i + 1),
    x: (xs[i] + xs[i + 1]) / 2,
  }));

  return (
    <svg ref={svgRef} width={WIDTH} height={TOTAL_HEIGHT}
      viewBox={`0 0 ${WIDTH} ${TOTAL_HEIGHT}`} className="ac-curve-display"
      aria-label={`Filter envelope: ${rates.map((r, i) => `R${i + 1}=${r} L${i + 1}=${levels[i]}`).join(' ')}`}>
      <rect x={0} y={0} width={WIDTH} height={HEIGHT} rx={4} className="ac-curve-bg" />
      {[0.25, 0.5, 0.75].map((pct) => (
        <line key={pct} x1={PADDING} y1={TOP + pct * DRAW_HEIGHT}
          x2={PADDING + DRAW_WIDTH} y2={TOP + pct * DRAW_HEIGHT}
          stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
      ))}
      <path d={fillD} className="ac-curve-fill" />
      <path d={pathD} className="ac-curve-line" />
      {points.map((p, i) => {
        const isDraggable = i > 0 && onChange;
        return (
          <g key={i}>
            {isDraggable && (
              <circle cx={p.x} cy={p.y} r={HIT_RADIUS} fill="transparent"
                className={dragging === i ? 'ac-curve-hit--dragging' : 'ac-curve-hit'}
                onMouseDown={(e) => { e.preventDefault(); setDragging(i); }} />
            )}
            <circle cx={p.x} cy={p.y}
              r={dragging === i ? POINT_RADIUS_ACTIVE : (isDraggable ? POINT_RADIUS : 3)}
              className={isDraggable ? 'ac-curve-dot ac-curve-dot--draggable' : 'ac-curve-dot'}
              onMouseDown={isDraggable ? (e) => { e.preventDefault(); setDragging(i); } : undefined} />
          </g>
        );
      })}
      {labels.map((l) => (
        <text key={l.text} x={l.x} y={LABEL_Y} className="s3k-adsr-label">{l.text}</text>
      ))}
    </svg>
  );
}
