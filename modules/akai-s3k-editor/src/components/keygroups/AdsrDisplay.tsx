/**
 * Interactive envelope editor for S3K keygroup editor.
 *
 * Follows the same drag interaction pattern as the Roland EnvelopeEditor:
 * - Fixed horizontal scale (each segment has a budget of 99 time units)
 * - Rate derived from segment width: rate = 99 - timeUnits
 * - Separate onChange (continuous) and onCommit (drag end) callbacks
 * - Invisible hit areas larger than visible dots
 * - Level from Y position, rate from X distance to previous point
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// =========================================================================
// Shared envelope renderer with drag support
// =========================================================================

interface EnvelopePoint {
  x: number;
  y: number;
  draggable: boolean;
}

interface EnvelopeEditorProps {
  points: EnvelopePoint[];
  labels: { text: string; x: number }[];
  ariaLabel: string;
  onDrag?: (pointIndex: number, svgX: number, svgY: number) => void;
  onDragEnd?: () => void;
}

const PADDING = 16;
const VIEW_WIDTH = 400;
const VIEW_HEIGHT = 100;
const LABEL_HEIGHT = 18;
const DRAW_WIDTH = VIEW_WIDTH - PADDING * 2;
const DRAW_HEIGHT = VIEW_HEIGHT - PADDING * 2;
const BOTTOM = PADDING + DRAW_HEIGHT;
const TOP = PADDING;

function EnvelopeEditor({ points, labels, ariaLabel, onDrag, onDragEnd }: EnvelopeEditorProps): JSX.Element {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  const getSvgCoords = useCallback((e: MouseEvent): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (VIEW_WIDTH / rect.width),
      y: (e.clientY - rect.top) * ((VIEW_HEIGHT + LABEL_HEIGHT) / rect.height),
    };
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragging === null || !onDrag) return;
    const coords = getSvgCoords(e);
    onDrag(dragging, coords.x, coords.y);
  }, [dragging, onDrag, getSvgCoords]);

  const handleMouseUp = useCallback(() => {
    if (dragging !== null) {
      onDragEnd?.();
    }
    setDragging(null);
  }, [dragging, onDragEnd]);

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

  const handleMouseDown = useCallback((index: number) => (e: React.MouseEvent) => {
    if (!onDrag) return;
    e.preventDefault();
    setDragging(index);
  }, [onDrag]);

  const pathD = points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
  const lastPt = points[points.length - 1];
  const firstPt = points[0];
  const fillD = `${pathD} L ${lastPt.x} ${BOTTOM} L ${firstPt.x} ${BOTTOM} Z`;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT + LABEL_HEIGHT}`}
      className="s3k-envelope-display"
      aria-label={ariaLabel}
      role="img"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x={0} y={0} width={VIEW_WIDTH} height={VIEW_HEIGHT} rx={4} className="s3k-adsr-bg" />

      {/* Grid lines at 25%, 50%, 75% */}
      {[0.25, 0.5, 0.75].map((pct) => (
        <line
          key={pct}
          x1={PADDING} y1={TOP + pct * DRAW_HEIGHT}
          x2={PADDING + DRAW_WIDTH} y2={TOP + pct * DRAW_HEIGHT}
          stroke="currentColor" strokeOpacity={0.08} strokeWidth={1}
        />
      ))}

      <path d={fillD} className="s3k-adsr-fill" />
      <path d={pathD} className="s3k-adsr-line" />

      {/* Points with hit areas */}
      {points.map((pt, i) => (
        <g key={i}>
          {pt.draggable && (
            <circle
              cx={pt.x} cy={pt.y} r={14}
              fill="transparent"
              className={dragging === i ? 's3k-adsr-hit--dragging' : 's3k-adsr-hit'}
              onMouseDown={handleMouseDown(i)}
            />
          )}
          <circle
            cx={pt.x} cy={pt.y}
            r={pt.draggable ? (dragging === i ? 6 : 4) : 3}
            className={pt.draggable ? 's3k-adsr-dot s3k-adsr-dot--draggable' : 's3k-adsr-dot'}
            onMouseDown={pt.draggable ? handleMouseDown(i) : undefined}
          />
        </g>
      ))}

      {/* Labels */}
      {labels.map((l) => (
        <text key={l.text} x={l.x} y={VIEW_HEIGHT + 14} className="s3k-adsr-label">{l.text}</text>
      ))}
    </svg>
  );
}

// =========================================================================
// Helpers
// =========================================================================

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

/**
 * Fixed-scale X positions for envelope segments.
 *
 * Each segment has a budget of 99 time units (max rate value).
 * Rate determines how much of that budget is used:
 *   time = 99 - rate (rate 0 = slowest = 99 units, rate 99 = fastest = 0 units)
 *
 * This matches the Roland pattern: fixed scale prevents dragging one point
 * from shifting all other points.
 */
function segmentXPositions(rates: number[], segCount: number): number[] {
  const maxTime = segCount * 99;
  const xs = [PADDING];
  let cumulative = 0;
  for (let i = 0; i < rates.length; i++) {
    const rate = clamp(rates[i], 0, 99);
    cumulative += 99 - rate;
    xs.push(PADDING + (cumulative / maxTime) * DRAW_WIDTH);
  }
  return xs;
}

/** Map SVG Y to 0-99 level */
function yToLevel(y: number): number {
  return clamp(((BOTTOM - y) / DRAW_HEIGHT) * 99, 0, 99);
}

// =========================================================================
// ADSR Editor (Amp Envelope)
// =========================================================================

interface AdsrDisplayProps {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  onChange?: (field: string, value: number) => void;
  onCommit?: () => void;
}

export function AdsrDisplay({ attack, decay, sustain, release, onChange, onCommit }: AdsrDisplayProps): JSX.Element {
  // 4 segments: attack, decay, sustain (fixed time), release
  // Sustain segment uses a fixed "rate" of 50 for visual width
  const segRates = [attack, decay, 50, release];
  const xs = segmentXPositions(segRates, 4);
  const susY = BOTTOM - (sustain / 99) * DRAW_HEIGHT;

  const points: EnvelopePoint[] = [
    { x: xs[0], y: BOTTOM, draggable: false },
    { x: xs[1], y: TOP, draggable: !!onChange },
    { x: xs[2], y: susY, draggable: !!onChange },
    { x: xs[3], y: susY, draggable: false },
    { x: xs[4], y: BOTTOM, draggable: !!onChange },
  ];

  const labels = [
    { text: 'A', x: (xs[0] + xs[1]) / 2 },
    { text: 'D', x: (xs[1] + xs[2]) / 2 },
    { text: 'S', x: (xs[2] + xs[3]) / 2 },
    { text: 'R', x: (xs[3] + xs[4]) / 2 },
  ];

  const handleDrag = useCallback((pointIndex: number, svgX: number, svgY: number) => {
    if (!onChange) return;

    if (pointIndex === 1) {
      // Attack peak: X distance from origin → attack rate
      const segWidth = Math.max(2, svgX - xs[0]);
      const timeUnits = (segWidth / DRAW_WIDTH) * (4 * 99);
      onChange('ATTAK1', clamp(99 - timeUnits, 0, 99));
    } else if (pointIndex === 2) {
      // Decay/sustain point: X distance from attack → decay rate, Y → sustain level
      const segWidth = Math.max(2, svgX - xs[1]);
      const timeUnits = (segWidth / DRAW_WIDTH) * (4 * 99);
      onChange('DECAY1', clamp(99 - timeUnits, 0, 99));
      onChange('SUSTN1', yToLevel(svgY));
    } else if (pointIndex === 4) {
      // Release end: X distance from sustain end → release rate
      const segWidth = Math.max(2, svgX - xs[3]);
      const timeUnits = (segWidth / DRAW_WIDTH) * (4 * 99);
      onChange('RELSE1', clamp(99 - timeUnits, 0, 99));
    }
  }, [onChange, xs]);

  return (
    <EnvelopeEditor
      points={points}
      labels={labels}
      ariaLabel={`ADSR: A=${attack} D=${decay} S=${sustain} R=${release}`}
      onDrag={onChange ? handleDrag : undefined}
      onDragEnd={onCommit}
    />
  );
}

// =========================================================================
// Multi-Point Envelope Editor (Filter Envelope)
// =========================================================================

interface MultiPointEnvelopeDisplayProps {
  rates: [number, number, number, number];
  levels: [number, number, number, number];
  onChange?: (field: string, value: number) => void;
  onCommit?: () => void;
}

export function MultiPointEnvelopeDisplay({ rates, levels, onChange, onCommit }: MultiPointEnvelopeDisplayProps): JSX.Element {
  const xs = segmentXPositions([...rates], 4);

  const points: EnvelopePoint[] = [
    { x: xs[0], y: BOTTOM, draggable: false },
    ...levels.map((level, i) => ({
      x: xs[i + 1],
      y: PADDING + DRAW_HEIGHT - (level / 99) * DRAW_HEIGHT,
      draggable: !!onChange,
    })),
  ];

  const labels = rates.map((_, i) => ({
    text: String(i + 1),
    x: (xs[i] + xs[i + 1]) / 2,
  }));

  const rateFields = ['ENV2R1', 'ENV2R2', 'ENV2R3', 'ENV2R4'];
  const levelFields = ['ENV2L1', 'ENV2L2', 'ENV2L3', 'ENV2L4'];

  const handleDrag = useCallback((pointIndex: number, svgX: number, svgY: number) => {
    if (!onChange) return;
    const segIndex = pointIndex - 1;
    if (segIndex < 0 || segIndex >= 4) return;

    // Y → level
    onChange(levelFields[segIndex], yToLevel(svgY));

    // X distance from previous point → rate
    const prevX = xs[segIndex];
    const segWidth = Math.max(2, svgX - prevX);
    const timeUnits = (segWidth / DRAW_WIDTH) * (4 * 99);
    onChange(rateFields[segIndex], clamp(99 - timeUnits, 0, 99));
  }, [onChange, xs]);

  return (
    <EnvelopeEditor
      points={points}
      labels={labels}
      ariaLabel={`Filter envelope: ${rates.map((r, i) => `R${i + 1}=${r} L${i + 1}=${levels[i]}`).join(' ')}`}
      onDrag={onChange ? handleDrag : undefined}
      onDragEnd={onCommit}
    />
  );
}
