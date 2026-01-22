/**
 * ADSR envelope visualization
 */

import type { S330TvaEnvelope } from '@oletizi/sampler-devices/s330';

interface EnvelopeDisplayProps {
  envelope: S330TvaEnvelope;
  label: string;
  width?: number;
  height?: number;
}

export function EnvelopeDisplay({
  envelope,
  label,
  width = 200,
  height = 80,
}: EnvelopeDisplayProps) {
  const { attack, decay, sustain, release } = envelope;

  // Normalize values to 0-1 range
  const a = attack / 127;
  const d = decay / 127;
  const s = sustain / 127;
  const r = release / 127;

  // Calculate envelope points
  // Time segments: attack=25%, decay=25%, sustain=25%, release=25%
  const segmentWidth = width / 4;
  const padding = 10;
  const drawHeight = height - padding * 2;

  // Envelope path points
  const points = [
    // Start (bottom-left)
    { x: padding, y: height - padding },
    // End of attack (top, based on attack time)
    { x: padding + (a * segmentWidth), y: padding },
    // End of decay (sustain level)
    { x: padding + segmentWidth + (d * segmentWidth), y: padding + (1 - s) * drawHeight },
    // End of sustain (same level)
    { x: padding + segmentWidth * 2 + segmentWidth * 0.5, y: padding + (1 - s) * drawHeight },
    // End of release (bottom)
    { x: padding + segmentWidth * 3 + (r * segmentWidth), y: height - padding },
  ];

  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <div className="bg-s330-bg rounded-md p-2" aria-label={`${label} envelope`}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
      >
        {/* Grid lines */}
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth={1}
        />
        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth={1}
        />

        {/* Sustain level line */}
        <line
          x1={padding}
          y1={padding + (1 - s) * drawHeight}
          x2={width - padding}
          y2={padding + (1 - s) * drawHeight}
          stroke="currentColor"
          strokeOpacity={0.1}
          strokeWidth={1}
          strokeDasharray="4 4"
        />

        {/* Envelope curve */}
        <path
          d={pathData}
          fill="none"
          stroke="#e94560"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3}
            fill={i === 0 || i === 4 ? '#1a1a2e' : '#e94560'}
            stroke="#e94560"
            strokeWidth={1}
          />
        ))}
      </svg>

      {/* Labels */}
      <div className="flex justify-between text-[10px] text-s330-muted mt-1 px-1">
        <span>A</span>
        <span>D</span>
        <span>S</span>
        <span>R</span>
      </div>
    </div>
  );
}
