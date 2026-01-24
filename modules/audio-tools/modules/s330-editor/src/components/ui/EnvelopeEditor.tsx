/**
 * 8-point envelope editor for S-330
 *
 * The S-330 uses 8-point multi-segment envelopes for TVA and TVF.
 * Each point has a level (0-127) and rate (1-127, how fast to reach it).
 * sustainPoint (0-7) marks where envelope holds during note-on.
 * endPoint (1-8) marks where envelope playback stops.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { S330Envelope } from '@oletizi/sampler-devices/s330';

interface EnvelopeEditorProps {
    envelope: S330Envelope;
    onChange: (envelope: S330Envelope) => void;
    onCommit?: () => void; // Called when drag ends - use for device sends
    label: string;
    disabled?: boolean;
}

export function EnvelopeEditor({
    envelope,
    onChange,
    onCommit,
    label,
    disabled = false,
}: EnvelopeEditorProps) {
    const { levels, rates, sustainPoint, endPoint } = envelope;

    const updateLevel = (index: number, value: number) => {
        const newLevels = [...levels] as S330Envelope['levels'];
        newLevels[index] = value;
        onChange({ ...envelope, levels: newLevels });
    };

    const updateRate = (index: number, value: number) => {
        const newRates = [...rates] as S330Envelope['rates'];
        newRates[index] = Math.max(1, value); // Rate minimum is 1
        onChange({ ...envelope, rates: newRates });
    };

    // Combined update for simultaneous level+rate changes (used by drag)
    const updateLevelAndRate = (index: number, level: number, rate: number) => {
        const newLevels = [...levels] as S330Envelope['levels'];
        const newRates = [...rates] as S330Envelope['rates'];
        newLevels[index] = level;
        newRates[index] = Math.max(1, rate);
        onChange({ ...envelope, levels: newLevels, rates: newRates });
    };

    const updateSustainPoint = (value: number) => {
        onChange({ ...envelope, sustainPoint: Math.min(value, endPoint - 1) });
    };

    const updateEndPoint = (value: number) => {
        onChange({
            ...envelope,
            endPoint: value,
            sustainPoint: Math.min(envelope.sustainPoint, value - 1),
        });
    };

    return (
        <div className={cn('space-y-4', disabled && 'opacity-50 pointer-events-none')}>
            {/* Envelope visualization */}
            <EnvelopeVisualization
                levels={levels}
                rates={rates}
                sustainPoint={sustainPoint}
                endPoint={endPoint}
                label={label}
                onLevelAndRateChange={updateLevelAndRate}
                onDragEnd={onCommit}
                disabled={disabled}
            />

            {/* Sustain and End point selectors */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs text-s330-muted">Sustain Point</label>
                    <select
                        className="w-full bg-s330-bg text-s330-text text-sm rounded px-2 py-1 border border-s330-accent/30"
                        value={sustainPoint}
                        onChange={(e) => {
                            updateSustainPoint(Number(e.target.value));
                            onCommit?.();
                        }}
                        disabled={disabled}
                    >
                        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                            <option key={i} value={i} disabled={i >= endPoint}>
                                {i + 1}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-xs text-s330-muted">End Point</label>
                    <select
                        className="w-full bg-s330-bg text-s330-text text-sm rounded px-2 py-1 border border-s330-accent/30"
                        value={endPoint}
                        onChange={(e) => {
                            updateEndPoint(Number(e.target.value));
                            onCommit?.();
                        }}
                        disabled={disabled}
                    >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                            <option key={i} value={i} disabled={i <= sustainPoint}>
                                {i}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Point-by-point editing table */}
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="text-s330-muted border-b border-s330-accent/20">
                            <th className="text-left py-1 px-2">Point</th>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                                <th
                                    key={i}
                                    className={cn(
                                        'text-center py-1 px-1 min-w-[50px]',
                                        i - 1 === sustainPoint && 'text-s330-highlight',
                                        i === endPoint && 'text-s330-accent'
                                    )}
                                >
                                    {i}
                                    {i - 1 === sustainPoint && ' (S)'}
                                    {i === endPoint && ' (E)'}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-s330-accent/10">
                            <td className="py-2 px-2 text-s330-muted">Level</td>
                            {levels.map((level, i) => (
                                <td key={i} className="py-1 px-1">
                                    <input
                                        type="number"
                                        min={0}
                                        max={127}
                                        value={level}
                                        onChange={(e) => updateLevel(i, Number(e.target.value))}
                                        onBlur={() => onCommit?.()}
                                        className="w-full bg-s330-bg text-s330-text text-center rounded px-1 py-0.5 border border-s330-accent/20"
                                        disabled={disabled || i >= endPoint}
                                    />
                                </td>
                            ))}
                        </tr>
                        <tr>
                            <td className="py-2 px-2 text-s330-muted">Rate</td>
                            {rates.map((rate, i) => (
                                <td key={i} className="py-1 px-1">
                                    <input
                                        type="number"
                                        min={1}
                                        max={127}
                                        value={rate}
                                        onChange={(e) => updateRate(i, Number(e.target.value))}
                                        onBlur={() => onCommit?.()}
                                        className="w-full bg-s330-bg text-s330-text text-center rounded px-1 py-0.5 border border-s330-accent/20"
                                        disabled={disabled || i >= endPoint}
                                    />
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/**
 * Interactive SVG visualization of the 8-point envelope
 * Points can be dragged to adjust level (vertical) and rate (horizontal)
 */
function EnvelopeVisualization({
    levels,
    rates,
    sustainPoint,
    endPoint,
    label,
    onLevelAndRateChange,
    onDragEnd,
    disabled = false,
}: {
    levels: S330Envelope['levels'];
    rates: S330Envelope['rates'];
    sustainPoint: number;
    endPoint: number;
    label: string;
    onLevelAndRateChange: (index: number, level: number, rate: number) => void;
    onDragEnd?: () => void;
    disabled?: boolean;
}) {
    const [dragging, setDragging] = useState<number | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    const width = 300;
    const height = 120;
    const padding = 15;
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

    // Calculate Y positions based on levels (0 at bottom, 127 at top)
    const yPositions = [height - padding];
    for (let i = 0; i < activePoints; i++) {
        yPositions.push(padding + (1 - levels[i] / 127) * drawHeight);
    }

    // Build path
    const pathPoints = xPositions.map((x, i) => ({ x, y: yPositions[i] }));
    const pathData = pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    // Convert mouse position to envelope values
    const getMousePosition = (e: React.MouseEvent | MouseEvent): { x: number; y: number } => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const rect = svgRef.current.getBoundingClientRect();
        const scaleX = width / rect.width;
        const scaleY = height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        };
    };

    const handleMouseDown = (index: number) => (e: React.MouseEvent) => {
        if (disabled || index >= endPoint) return;
        e.preventDefault();
        setDragging(index);
    };

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (dragging === null || !svgRef.current) return;

            const pos = getMousePosition(e);

            // Calculate level (vertical) - clamp to valid range
            const newLevel = Math.round(
                Math.max(0, Math.min(127, (1 - (pos.y - padding) / drawHeight) * 127))
            );

            // Calculate rate (horizontal) - rate[i] controls time to reach point i
            // xPositions[dragging] is the previous point, xPositions[dragging+1] is current
            const prevPointX = xPositions[dragging];
            const minX = prevPointX + 5; // Minimum distance from previous point
            const maxX = width - padding - 5;
            const clampedX = Math.max(minX, Math.min(maxX, pos.x));

            // Calculate segment width from previous point to desired position
            const segmentWidth = clampedX - prevPointX;
            const avgSegmentWidth = drawWidth / activePoints;

            // Convert to rate: wider segment = more time = lower rate
            // Rate 127 = fastest (shortest segment), Rate 1 = slowest (longest segment)
            // timeRatio of 1.0 = average time, 2.0 = twice as long, 0.5 = half as long
            const timeRatio = segmentWidth / avgSegmentWidth;
            // Map timeRatio to rate: ratio 0.25->127, ratio 1.0->64, ratio 2.0->1
            const newRate = Math.round(Math.max(1, Math.min(127, 128 - timeRatio * 64)));

            // Update both level and rate in a single state update
            onLevelAndRateChange(dragging, newLevel, newRate);
        },
        [dragging, xPositions, activePoints, drawHeight, drawWidth, width, onLevelAndRateChange, padding]
    );

    const handleMouseUp = useCallback(() => {
        if (dragging !== null) {
            onDragEnd?.();
        }
        setDragging(null);
    }, [dragging, onDragEnd]);

    // Attach global mouse listeners when dragging
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

    return (
        <div className="bg-s330-bg rounded-md p-2" aria-label={`${label} envelope`}>
            <svg
                ref={svgRef}
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                className={cn('w-full h-auto', !disabled && 'cursor-crosshair')}
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

                {/* Horizontal grid lines at 25%, 50%, 75% */}
                {[0.25, 0.5, 0.75].map((pct) => (
                    <line
                        key={pct}
                        x1={padding}
                        y1={padding + pct * drawHeight}
                        x2={width - padding}
                        y2={padding + pct * drawHeight}
                        stroke="currentColor"
                        strokeOpacity={0.1}
                        strokeWidth={1}
                    />
                ))}

                {/* Sustain point vertical line */}
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

                {/* Draggable points */}
                {pathPoints.slice(1).map((p, i) => (
                    <g key={i}>
                        {/* Larger invisible hit area */}
                        <circle
                            cx={p.x}
                            cy={p.y}
                            r={12}
                            fill="transparent"
                            className={cn(
                                !disabled && i < endPoint && 'cursor-grab',
                                dragging === i && 'cursor-grabbing'
                            )}
                            onMouseDown={handleMouseDown(i)}
                        />
                        {/* Visible point */}
                        <circle
                            cx={p.x}
                            cy={p.y}
                            r={i === sustainPoint ? 6 : 5}
                            fill={dragging === i ? '#ff6b8a' : i === sustainPoint ? '#e94560' : '#1a1a2e'}
                            stroke="#e94560"
                            strokeWidth={i === sustainPoint ? 2 : 1.5}
                            className={cn(
                                !disabled && i < endPoint && 'cursor-grab',
                                dragging === i && 'cursor-grabbing'
                            )}
                            onMouseDown={handleMouseDown(i)}
                        />
                        {/* Level value label */}
                        {dragging === i && (
                            <text
                                x={p.x}
                                y={p.y - 12}
                                textAnchor="middle"
                                fill="#e94560"
                                fontSize={10}
                                fontFamily="monospace"
                            >
                                {levels[i]}
                            </text>
                        )}
                    </g>
                ))}

                {/* Start point (not draggable) */}
                <circle
                    cx={pathPoints[0].x}
                    cy={pathPoints[0].y}
                    r={3}
                    fill="#1a1a2e"
                    stroke="#e94560"
                    strokeWidth={1}
                />
            </svg>

            {/* Point labels */}
            <div className="flex justify-between text-[10px] text-s330-muted mt-1 px-1">
                <span>Start</span>
                {[1, 2, 3, 4, 5, 6, 7, 8].slice(0, endPoint).map((i) => (
                    <span
                        key={i}
                        className={cn(
                            i - 1 === sustainPoint && 'text-s330-highlight font-bold',
                            i === endPoint && 'text-s330-accent'
                        )}
                    >
                        {i}
                    </span>
                ))}
            </div>

            {/* Drag hint */}
            {!disabled && (
                <div className="text-[9px] text-s330-muted/60 text-center mt-1">
                    Drag points to adjust level
                </div>
            )}
        </div>
    );
}
