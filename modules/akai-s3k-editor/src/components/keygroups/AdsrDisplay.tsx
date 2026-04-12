/**
 * Envelope visualization for S3K keygroup editor.
 *
 * Single EnvelopeDisplay component renders any polyline envelope.
 * AdsrDisplay and MultiPointEnvelopeDisplay are thin wrappers that
 * compute points from their respective parameter formats.
 */

// =========================================================================
// Shared renderer
// =========================================================================

interface EnvelopePoint {
  x: number;
  y: number;
}

interface EnvelopeDisplayProps {
  points: EnvelopePoint[];
  labels: { text: string; x: number }[];
  ariaLabel: string;
}

const PADDING = 12;
const VIEW_WIDTH = 400;
const VIEW_HEIGHT = 80;
const LABEL_HEIGHT = 16;

function EnvelopeDisplay({ points, labels, ariaLabel }: EnvelopeDisplayProps): JSX.Element {
  const pathD = points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
  const lastPt = points[points.length - 1];
  const firstPt = points[0];
  const bottom = PADDING + (VIEW_HEIGHT - PADDING * 2);
  const fillD = `${pathD} L ${lastPt.x} ${bottom} L ${firstPt.x} ${bottom} Z`;

  return (
    <svg
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
        <circle key={i} cx={pt.x} cy={pt.y} r={3} className="s3k-adsr-dot" />
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

const DRAW_WIDTH = VIEW_WIDTH - PADDING * 2;
const DRAW_HEIGHT = VIEW_HEIGHT - PADDING * 2;
const BOTTOM = PADDING + DRAW_HEIGHT;
const TOP = PADDING;

/** Map a 0-99 rate to a visual width fraction. Higher rate = faster = shorter. */
function rateFraction(rate: number): number {
  const minFraction = 0.08;
  return minFraction + (1 - minFraction) * ((99 - rate) / 99);
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
// ADSR Display (Amp Envelope)
// =========================================================================

interface AdsrDisplayProps {
  attack: number;   // 0-99
  decay: number;    // 0-99
  sustain: number;  // 0-99 (level, not time)
  release: number;  // 0-99
}

export function AdsrDisplay({ attack, decay, sustain, release }: AdsrDisplayProps): JSX.Element {
  const xs = segmentXPositions([
    rateFraction(attack),
    rateFraction(decay),
    0.25, // sustain hold
    rateFraction(release),
  ]);

  const susY = BOTTOM - (sustain / 99) * DRAW_HEIGHT;

  const points: EnvelopePoint[] = [
    { x: xs[0], y: BOTTOM },
    { x: xs[1], y: TOP },
    { x: xs[2], y: susY },
    { x: xs[3], y: susY },
    { x: xs[4], y: BOTTOM },
  ];

  const labels = [
    { text: 'A', x: (xs[0] + xs[1]) / 2 },
    { text: 'D', x: (xs[1] + xs[2]) / 2 },
    { text: 'S', x: (xs[2] + xs[3]) / 2 },
    { text: 'R', x: (xs[3] + xs[4]) / 2 },
  ];

  return (
    <EnvelopeDisplay
      points={points}
      labels={labels}
      ariaLabel={`ADSR: A=${attack} D=${decay} S=${sustain} R=${release}`}
    />
  );
}

// =========================================================================
// Multi-Point Envelope Display (Filter Envelope)
// =========================================================================

interface MultiPointEnvelopeDisplayProps {
  rates: [number, number, number, number];
  levels: [number, number, number, number];
}

export function MultiPointEnvelopeDisplay({ rates, levels }: MultiPointEnvelopeDisplayProps): JSX.Element {
  const xs = segmentXPositions(rates.map(rateFraction));

  const points: EnvelopePoint[] = [
    { x: xs[0], y: BOTTOM },
    ...levels.map((level, i) => ({
      x: xs[i + 1],
      y: PADDING + DRAW_HEIGHT - (level / 99) * DRAW_HEIGHT,
    })),
  ];

  const labels = rates.map((_, i) => ({
    text: String(i + 1),
    x: (xs[i] + xs[i + 1]) / 2,
  }));

  return (
    <EnvelopeDisplay
      points={points}
      labels={labels}
      ariaLabel={`Filter envelope: ${rates.map((r, i) => `R${i + 1}=${r} L${i + 1}=${levels[i]}`).join(' ')}`}
    />
  );
}
