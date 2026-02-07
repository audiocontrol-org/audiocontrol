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
import type { S330Envelope } from '@audiocontrol/sampler-devices/s330';

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
    const [isExpanded, setIsExpanded] = useState(false);

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

    // Close expanded view on Escape key
    useEffect(() => {
        if (!isExpanded) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsExpanded(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isExpanded]);

    return (
        <div className={cn('space-y-4', disabled && 'opacity-50 pointer-events-none')}>
            {/* Envelope visualization with expand button */}
            <div className="relative">
                <EnvelopeVisualization
                    levels={levels}
                    rates={rates}
                    sustainPoint={sustainPoint}
                    endPoint={endPoint}
                    label={label}
                    onLevelAndRateChange={updateLevelAndRate}
                    onDragEnd={onCommit}
                    disabled={disabled}
                    expanded={false}
                />
                {/* Expand button */}
                <button
                    type="button"
                    onClick={() => setIsExpanded(true)}
                    className="absolute top-2 right-2 p-1 rounded bg-s330-accent/20 hover:bg-s330-accent/40 text-s330-muted hover:text-s330-text transition-colors"
                    title="Expand envelope editor"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                    </svg>
                </button>
            </div>

            {/* Expanded fullscreen overlay */}
            {isExpanded && (
                <div
                    className="fixed inset-0 z-50 bg-s330-bg/95 backdrop-blur-sm flex flex-col p-6"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsExpanded(false);
                    }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-s330-text">{label} Envelope</h3>
                        <button
                            type="button"
                            onClick={() => setIsExpanded(false)}
                            className="p-2 rounded bg-s330-accent/20 hover:bg-s330-accent/40 text-s330-muted hover:text-s330-text transition-colors"
                            title="Close (Esc)"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Expanded visualization */}
                    <div className="flex-1 min-h-0">
                        <EnvelopeVisualization
                            levels={levels}
                            rates={rates}
                            sustainPoint={sustainPoint}
                            endPoint={endPoint}
                            label={label}
                            onLevelAndRateChange={updateLevelAndRate}
                            onDragEnd={onCommit}
                            disabled={disabled}
                            expanded={true}
                        />
                    </div>

                    {/* Controls in expanded view */}
                    <div className="mt-4 grid grid-cols-2 gap-4 max-w-md">
                        <div className="space-y-1">
                            <label className="text-xs text-s330-muted">Sustain Point</label>
                            <select
                                className="w-full bg-s330-card text-s330-text text-sm rounded px-2 py-1 border border-s330-accent/30"
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
                                className="w-full bg-s330-card text-s330-text text-sm rounded px-2 py-1 border border-s330-accent/30"
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

                    <div className="mt-2 text-xs text-s330-muted/60 text-center">
                        Press Esc or click outside to close
                    </div>
                </div>
            )}

            {/* Sustain and End point selectors (normal view) */}
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
                            <td className="py-2 px-2 text-s330-muted">Rate</td>
                            {rates.map((rate, i) => (
                                <td key={i} className="py-1 px-1">
                                    <input
                                        type="number"
                                        min={1}
                                        max={127}
                                        value={rate}
                                        onChange={(e) => {
                                            updateRate(i, Number(e.target.value));
                                            onCommit?.();
                                        }}
                                        className="w-full bg-s330-bg text-s330-text text-center rounded px-1 py-0.5 border border-s330-accent/20"
                                        disabled={disabled || i >= endPoint}
                                    />
                                </td>
                            ))}
                        </tr>
                        <tr>
                            <td className="py-2 px-2 text-s330-muted">Level</td>
                            {levels.map((level, i) => (
                                <td key={i} className="py-1 px-1">
                                    <input
                                        type="number"
                                        min={0}
                                        max={127}
                                        value={level}
                                        onChange={(e) => {
                                            updateLevel(i, Number(e.target.value));
                                            onCommit?.();
                                        }}
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
 *
 * When expanded=true, uses full viewport width and taller height.
 * Horizontal scaling is based on active points only for better precision.
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
    expanded = false,
}: {
    levels: S330Envelope['levels'];
    rates: S330Envelope['rates'];
    sustainPoint: number;
    endPoint: number;
    label: string;
    onLevelAndRateChange: (index: number, level: number, rate: number) => void;
    onDragEnd?: () => void;
    disabled?: boolean;
    expanded?: boolean;
}) {
    const [dragging, setDragging] = useState<number | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 300, height: 120 });

    // Update dimensions based on container size when expanded
    useEffect(() => {
        if (!expanded || !containerRef.current) {
            setDimensions({ width: 300, height: 120 });
            return;
        }

        const updateDimensions = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                // Use container width, cap height at 400px for usability
                setDimensions({
                    width: Math.max(300, rect.width - 32), // Account for padding
                    height: Math.min(400, Math.max(200, rect.height - 60)),
                });
            }
        };

        updateDimensions();
        window.addEventListener('resize', updateDimensions);
        return () => window.removeEventListener('resize', updateDimensions);
    }, [expanded]);

    const { width, height } = dimensions;
    const padding = expanded ? 30 : 15;
    const drawWidth = width - padding * 2;
    const drawHeight = height - padding * 2;

    // Clamp activePoints to valid range 1-8 defensively
    const activePoints = Math.max(1, Math.min(8, endPoint));

    // Fixed scale based on number of active points
    // Each point has a fixed horizontal range of 127 time units (max rate segment)
    // This ensures dragging one point doesn't shift other points
    const maxTime = activePoints * 127;

    // Calculate cumulative time and X positions
    const xPositions = [padding];
    let cumulativeTime = 0;
    for (let i = 0; i < activePoints; i++) {
        const rate = (rates[i] >= 1 && rates[i] <= 127) ? rates[i] : 64;
        cumulativeTime += 128 - rate;
        xPositions.push(padding + (cumulativeTime / maxTime) * drawWidth);
    }

    // Calculate Y positions based on levels (0 at bottom, 127 at top)
    const yPositions = [height - padding];
    for (let i = 0; i < activePoints; i++) {
        const level = (levels[i] >= 0 && levels[i] <= 127) ? levels[i] : 0;
        yPositions.push(padding + (1 - level / 127) * drawHeight);
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

            // Calculate rate (horizontal)
            // The rate determines the time to reach this point from the previous point
            // We need to calculate what rate would place this point at the mouse X position
            const prevPointX = xPositions[dragging];
            const minX = prevPointX + 2; // Minimum distance
            const maxX = width - padding;
            const clampedX = Math.max(minX, Math.min(maxX, pos.x));

            // Convert X position to time, then to rate
            // segmentWidth / drawWidth * maxTime = time units for this segment
            const segmentWidth = clampedX - prevPointX;
            const timeUnits = (segmentWidth / drawWidth) * maxTime;

            // Convert time units to rate: rate = 128 - timeUnits
            // Clamp to valid range [1, 127]
            const newRate = Math.round(Math.max(1, Math.min(127, 128 - timeUnits)));

            onLevelAndRateChange(dragging, newLevel, newRate);
        },
        [dragging, xPositions, drawHeight, drawWidth, width, maxTime, onLevelAndRateChange, padding]
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

    const pointRadius = expanded ? 8 : 5;
    const sustainPointRadius = expanded ? 10 : 6;
    const hitAreaRadius = expanded ? 16 : 12;
    const strokeWidth = expanded ? 3 : 2;

    return (
        <div
            ref={containerRef}
            className={cn(
                'bg-s330-bg rounded-md',
                expanded ? 'h-full p-4' : 'p-2'
            )}
            aria-label={`${label} envelope`}
        >
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

                {/* Vertical grid lines for each point (expanded mode) */}
                {expanded && pathPoints.slice(1).map((p, i) => (
                    <line
                        key={`vgrid-${i}`}
                        x1={p.x}
                        y1={padding}
                        x2={p.x}
                        y2={height - padding}
                        stroke="currentColor"
                        strokeOpacity={0.05}
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
                    strokeWidth={strokeWidth}
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
                            r={hitAreaRadius}
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
                            r={i === sustainPoint ? sustainPointRadius : pointRadius}
                            fill={dragging === i ? '#ff6b8a' : i === sustainPoint ? '#e94560' : '#1a1a2e'}
                            stroke="#e94560"
                            strokeWidth={i === sustainPoint ? 2 : 1.5}
                            className={cn(
                                !disabled && i < endPoint && 'cursor-grab',
                                dragging === i && 'cursor-grabbing'
                            )}
                            onMouseDown={handleMouseDown(i)}
                        />
                        {/* Level value label - always show in expanded, only when dragging in normal */}
                        {(dragging === i || expanded) && (
                            <text
                                x={p.x}
                                y={p.y - (expanded ? 16 : 12)}
                                textAnchor="middle"
                                fill="#e94560"
                                fontSize={expanded ? 12 : 10}
                                fontFamily="monospace"
                            >
                                {levels[i]}
                            </text>
                        )}
                        {/* Rate value label (expanded mode only) */}
                        {expanded && (
                            <text
                                x={p.x}
                                y={height - padding + 16}
                                textAnchor="middle"
                                fill="#e94560"
                                fontSize={10}
                                fontFamily="monospace"
                                opacity={0.6}
                            >
                                R{rates[i]}
                            </text>
                        )}
                    </g>
                ))}

                {/* Start point (not draggable) */}
                <circle
                    cx={pathPoints[0].x}
                    cy={pathPoints[0].y}
                    r={expanded ? 4 : 3}
                    fill="#1a1a2e"
                    stroke="#e94560"
                    strokeWidth={1}
                />
            </svg>

            {/* Point labels (normal mode only) */}
            {!expanded && (
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
            )}

            {/* Drag hint (normal mode only) */}
            {!disabled && !expanded && (
                <div className="text-[9px] text-s330-muted/60 text-center mt-1">
                    Drag points to adjust · Click expand for precision editing
                </div>
            )}
        </div>
    );
}
