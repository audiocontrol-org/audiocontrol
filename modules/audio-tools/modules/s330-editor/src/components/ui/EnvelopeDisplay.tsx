/**
 * 8-point envelope visualization (read-only display)
 *
 * Displays an S-330 8-point envelope with levels, rates, sustain and end points.
 * For editable version, use EnvelopeEditor.
 */

import type { S330Envelope } from '@oletizi/sampler-devices/s330';
import { cn } from '@/lib/utils';

interface EnvelopeDisplayProps {
    envelope: S330Envelope;
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
    const { levels, rates, sustainPoint, endPoint } = envelope;

    const padding = 10;
    const drawWidth = width - padding * 2;
    const drawHeight = height - padding * 2;

    // Calculate X positions based on rates (higher rate = faster = shorter segment)
    const activePoints = endPoint;
    const totalTimeUnits = rates.slice(0, activePoints).reduce((sum, r) => sum + (128 - r), 0);

    const xPositions = [padding];
    let cumulativeTime = 0;

    for (let i = 0; i < activePoints; i++) {
        cumulativeTime += 128 - rates[i];
        xPositions.push(padding + (cumulativeTime / totalTimeUnits) * drawWidth);
    }

    // Calculate Y positions based on levels
    const yPositions = [height - padding];
    for (let i = 0; i < activePoints; i++) {
        yPositions.push(padding + (1 - levels[i] / 127) * drawHeight);
    }

    // Build path
    const pathPoints = xPositions.map((x, i) => ({ x, y: yPositions[i] }));
    const pathData = pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

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

                {/* Sustain point indicator */}
                {sustainPoint < activePoints && (
                    <line
                        x1={xPositions[sustainPoint + 1]}
                        y1={padding}
                        x2={xPositions[sustainPoint + 1]}
                        y2={height - padding}
                        stroke="#e94560"
                        strokeOpacity={0.3}
                        strokeWidth={1}
                        strokeDasharray="4 2"
                    />
                )}

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
                {pathPoints.slice(1).map((p, i) => (
                    <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r={i === sustainPoint ? 4 : 3}
                        fill={i === sustainPoint ? '#e94560' : '#1a1a2e'}
                        stroke="#e94560"
                        strokeWidth={1}
                    />
                ))}

                {/* Start point */}
                <circle
                    cx={pathPoints[0].x}
                    cy={pathPoints[0].y}
                    r={2}
                    fill="#1a1a2e"
                    stroke="#e94560"
                    strokeWidth={1}
                />
            </svg>

            {/* Point labels */}
            <div className="flex justify-between text-[9px] text-s330-muted mt-1 px-1">
                <span>0</span>
                {Array.from({ length: endPoint }, (_, i) => (
                    <span
                        key={i}
                        className={cn(i === sustainPoint && 'text-s330-highlight font-bold')}
                    >
                        {i + 1}
                    </span>
                ))}
            </div>
        </div>
    );
}
