/**
 * Interactive envelope editor for S3K keygroup editor.
 *
 * Single EnvelopeEditor component renders a draggable polyline envelope.
 * AdsrDisplay and MultiPointEnvelopeDisplay are thin wrappers that
 * compute points and map drag positions back to parameter values.
 */

import { useCallback, useRef } from 'react';

// =========================================================================
// Shared renderer with drag support
// =========================================================================

interface EnvelopePoint {
  x: number;
  y: number;
  /** Whether this point can be dragged */
  draggable?: boolean;
}

interface EnvelopeEditorProps {
  points: EnvelopePoint[];
  labels: { text: string; x: number }[];
  ariaLabel: string;
  /** Called when a draggable point is moved. Receives point index and new SVG coordinates. */
  onDrag?: (pointIndex: number, x: number, y: number) => void;
}

const PADDING = 12;
const VIEW_WIDTH = 400;
const VIEW_HEIGHT = 80;
const LABEL_HEIGHT = 16;
const DRAW_WIDTH = VIEW_WIDTH - PADDING * 2;
const DRAW_HEIGHT = VIEW_HEIGHT - PADDING * 2;
const BOTTOM = PADDING + DRAW_HEIGHT;
const TOP = PADDING;

function EnvelopeEditor({ points, labels, ariaLabel, onDrag }: EnvelopeEditorProps): JSX.Element {
  const svgRef = useRef<SVGSVGElement>(null);

  const getSvgCoords = useCallback((clientX: number, clientY: number): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const scaleX = VIEW_WIDTH / rect.width;
    const scaleY = (VIEW_HEIGHT + LABEL_HEIGHT) / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);

  const handleMouseDown = useCallback((pointIndex: number) => (e: React.MouseEvent) => {
    if (!onDrag) return;
    e.preventDefault();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const coords = getSvgCoords(moveEvent.clientX, moveEvent.clientY);
      onDrag(pointIndex, coords.x, coords.y);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onDrag, getSvgCoords]);

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
      <path d={fillD} className="s3k-adsr-fill" />
      <path d={pathD} className="s3k-adsr-line" />
      {points.map((pt, i) => (
        <circle
          key={i}
          cx={pt.x}
          cy={pt.y}
          r={pt.draggable ? 5 : 3}
          className={pt.draggable ? 's3k-adsr-dot s3k-adsr-dot--draggable' : 's3k-adsr-dot'}
          onMouseDown={pt.draggable ? handleMouseDown(i) : undefined}
        />
      ))}
      {labels.map((l) => (
        <text key={l.text} x={l.x} y={VIEW_HEIGHT + 12} className="s3k-adsr-label">{l.text}</text>
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

/** Map a 0-99 rate to a visual width fraction. Higher rate = faster = shorter. */
function rateFraction(rate: number): number {
  const minFraction = 0.08;
  return minFraction + (1 - minFraction) * ((99 - rate) / 99);
}

/** Inverse of rateFraction: SVG x-distance back to 0-99 rate */
function xToRate(xFraction: number): number {
  const minFraction = 0.08;
  const normalized = (xFraction - minFraction) / (1 - minFraction);
  return clamp(99 - normalized * 99, 0, 99);
}

/** Map SVG y to 0-99 level */
function yToLevel(y: number): number {
  return clamp(((BOTTOM - y) / DRAW_HEIGHT) * 99, 0, 99);
}

function segmentXPositions(widths: number[]): number[] {
  const totalW = widths.reduce((a, b) => a + b, 0);
  const xs = [PADDING];
  let cumulative = 0;
  for (const w of widths) {
    cumulative += w;
    xs.push(PADDING + (cumulative / totalW) * DRAW_WIDTH);
  }
  return xs;
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
}

export function AdsrDisplay({ attack, decay, sustain, release, onChange }: AdsrDisplayProps): JSX.Element {
  const segWidths = [
    rateFraction(attack),
    rateFraction(decay),
    0.25,
    rateFraction(release),
  ];
  const xs = segmentXPositions(segWidths);
  const totalW = segWidths.reduce((a, b) => a + b, 0);
  const susY = BOTTOM - (sustain / 99) * DRAW_HEIGHT;

  const points: EnvelopePoint[] = [
    { x: xs[0], y: BOTTOM },                          // origin (fixed)
    { x: xs[1], y: TOP, draggable: !!onChange },       // attack peak: drag X = attack rate
    { x: xs[2], y: susY, draggable: !!onChange },      // decay end: drag X = decay rate, drag Y = sustain level
    { x: xs[3], y: susY },                             // sustain end (fixed X, follows sustain level)
    { x: xs[4], y: BOTTOM, draggable: !!onChange },    // release end: drag X = release rate
  ];

  const labels = [
    { text: 'A', x: (xs[0] + xs[1]) / 2 },
    { text: 'D', x: (xs[1] + xs[2]) / 2 },
    { text: 'S', x: (xs[2] + xs[3]) / 2 },
    { text: 'R', x: (xs[3] + xs[4]) / 2 },
  ];

  const handleDrag = useCallback((pointIndex: number, svgX: number, svgY: number) => {
    if (!onChange) return;

    // Clamp X to drawing area
    const clampedX = Math.max(PADDING, Math.min(PADDING + DRAW_WIDTH, svgX));

    if (pointIndex === 1) {
      // Attack peak: X position determines attack rate
      const attackFraction = (clampedX - xs[0]) / DRAW_WIDTH;
      const newRate = xToRate(attackFraction * totalW);
      onChange('ATTAK1', newRate);
    } else if (pointIndex === 2) {
      // Decay end: X = decay rate, Y = sustain level
      const decayFraction = (clampedX - xs[1]) / DRAW_WIDTH;
      if (decayFraction > 0.01) {
        onChange('DECAY1', xToRate(decayFraction * totalW));
      }
      onChange('SUSTN1', yToLevel(svgY));
    } else if (pointIndex === 4) {
      // Release end: X = release rate
      const relFraction = (clampedX - xs[3]) / DRAW_WIDTH;
      if (relFraction > 0.01) {
        onChange('RELSE1', xToRate(relFraction * totalW));
      }
    }
  }, [onChange, xs, totalW]);

  return (
    <EnvelopeEditor
      points={points}
      labels={labels}
      ariaLabel={`ADSR: A=${attack} D=${decay} S=${sustain} R=${release}`}
      onDrag={onChange ? handleDrag : undefined}
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
}

export function MultiPointEnvelopeDisplay({ rates, levels, onChange }: MultiPointEnvelopeDisplayProps): JSX.Element {
  const xs = segmentXPositions(rates.map(rateFraction));

  const points: EnvelopePoint[] = [
    { x: xs[0], y: BOTTOM },
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

  // Field name mapping: index 1-4 in points array → ENV2L1-4
  const levelFields = ['ENV2L1', 'ENV2L2', 'ENV2L3', 'ENV2L4'];

  const handleDrag = useCallback((_pointIndex: number, _svgX: number, svgY: number) => {
    if (!onChange) return;
    // Points 1-4 are the draggable level points
    const levelIndex = _pointIndex - 1;
    if (levelIndex >= 0 && levelIndex < 4) {
      onChange(levelFields[levelIndex], yToLevel(svgY));
    }
  }, [onChange]);

  return (
    <EnvelopeEditor
      points={points}
      labels={labels}
      ariaLabel={`Filter envelope: ${rates.map((r, i) => `R${i + 1}=${r} L${i + 1}=${levels[i]}`).join(' ')}`}
      onDrag={onChange ? handleDrag : undefined}
    />
  );
}
