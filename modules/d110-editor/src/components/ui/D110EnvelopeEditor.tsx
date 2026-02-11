/**
 * D-110 Envelope Editor
 *
 * Interactive editor for D-110's 5-stage envelopes.
 * Supports pitch, TVF, and TVA envelope types with different structures.
 *
 * Envelope structures:
 * - Pitch: L0 → L1 → L2 → Sustain → End (5 levels, 4 times)
 * - TVF/TVA: Start → L1 → L2 → L3 → Sustain (4 levels after start, 5 times)
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

export type EnvelopeType = 'pitch' | 'tvf' | 'tva';

interface PitchEnvelopeData {
  level0: number;
  level1: number;
  level2: number;
  sustainLevel: number;
  endLevel: number;
  time1: number;
  time2: number;
  time3: number;
  time4: number;
}

interface TvfTvaEnvelopeData {
  level1: number;
  level2: number;
  level3: number;
  sustainLevel: number;
  time1: number;
  time2: number;
  time3: number;
  time4: number;
  time5: number;
}

interface D110EnvelopeEditorProps {
  /** Type of envelope (determines structure) */
  type: EnvelopeType;
  /** Envelope data - structure depends on type */
  data: PitchEnvelopeData | TvfTvaEnvelopeData;
  /** Called when any value changes */
  onChange: (key: string, value: number) => void;
  /** Called when editing completes (e.g., drag end) */
  onCommit?: () => void;
  /** Section label */
  label: string;
  /** Disable the editor */
  disabled?: boolean;
}

export function D110EnvelopeEditor({
  type,
  data,
  onChange,
  onCommit,
  label,
  disabled = false,
}: D110EnvelopeEditorProps): JSX.Element {
  const isPitch = type === 'pitch';
  const pitchData = data as PitchEnvelopeData;
  const tvfTvaData = data as TvfTvaEnvelopeData;

  // Get levels and times based on envelope type
  const levels = isPitch
    ? [pitchData.level0, pitchData.level1, pitchData.level2, pitchData.sustainLevel, pitchData.endLevel]
    : [100, tvfTvaData.level1, tvfTvaData.level2, tvfTvaData.level3, tvfTvaData.sustainLevel];

  const times = isPitch
    ? [pitchData.time1, pitchData.time2, pitchData.time3, pitchData.time4]
    : [tvfTvaData.time1, tvfTvaData.time2, tvfTvaData.time3, tvfTvaData.time4, tvfTvaData.time5];

  const levelKeys = isPitch
    ? ['level0', 'level1', 'level2', 'sustainLevel', 'endLevel']
    : [null, 'level1', 'level2', 'level3', 'sustainLevel'];

  const timeKeys = isPitch
    ? ['time1', 'time2', 'time3', 'time4']
    : ['time1', 'time2', 'time3', 'time4', 'time5'];

  const pointLabels = isPitch
    ? ['L0', 'L1', 'L2', 'Sus', 'End']
    : ['Start', 'L1', 'L2', 'L3', 'Sus'];

  const handleLevelChange = (index: number, value: number) => {
    const key = levelKeys[index];
    if (key) onChange(key, Math.max(0, Math.min(100, value)));
  };

  const handleTimeChange = (index: number, value: number) => {
    const key = timeKeys[index];
    if (key) onChange(key, Math.max(0, Math.min(100, value)));
  };

  return (
    <div className={cn('space-y-4', disabled && 'opacity-50 pointer-events-none')}>
      {/* Envelope visualization */}
      <EnvelopeVisualization
        levels={levels}
        times={times}
        pointLabels={pointLabels}
        label={label}
        isPitch={isPitch}
        levelKeys={levelKeys}
        onLevelChange={handleLevelChange}
        onDragEnd={onCommit}
        disabled={disabled}
      />

      {/* Point-by-point editing table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-d110-muted border-b border-d110-border">
              <th className="text-left py-1 px-2 w-16">Param</th>
              {pointLabels.map((label, i) => (
                <th key={i} className="text-center py-1 px-1 min-w-[50px]">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Level row */}
            <tr className="border-b border-d110-border/50">
              <td className="py-2 px-2 text-d110-muted">Level</td>
              {levels.map((level, i) => (
                <td key={i} className="py-1 px-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={level}
                    onChange={(e) => handleLevelChange(i, Number(e.target.value))}
                    onBlur={() => onCommit?.()}
                    className="w-full bg-d110-surface text-d110-text text-center rounded px-1 py-0.5 border border-d110-border"
                    disabled={disabled || levelKeys[i] === null}
                  />
                </td>
              ))}
            </tr>
            {/* Time row */}
            <tr>
              <td className="py-2 px-2 text-d110-muted">Time</td>
              {/* First cell is empty (no time before first point) */}
              <td className="py-1 px-1">
                <span className="text-d110-muted/50 text-center block">-</span>
              </td>
              {times.map((time, i) => (
                <td key={i} className="py-1 px-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={time}
                    onChange={(e) => handleTimeChange(i, Number(e.target.value))}
                    onBlur={() => onCommit?.()}
                    className="w-full bg-d110-surface text-d110-text text-center rounded px-1 py-0.5 border border-d110-border"
                    disabled={disabled}
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
 * Interactive SVG visualization of the envelope
 */
function EnvelopeVisualization({
  levels,
  times,
  pointLabels,
  label,
  isPitch,
  levelKeys,
  onLevelChange,
  onDragEnd,
  disabled = false,
}: {
  levels: number[];
  times: number[];
  pointLabels: string[];
  label: string;
  isPitch: boolean;
  levelKeys: (string | null)[];
  onLevelChange: (index: number, value: number) => void;
  onDragEnd?: () => void;
  disabled?: boolean;
}): JSX.Element {
  const [dragging, setDragging] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const width = 320;
  const height = 120;
  const padding = 20;
  const drawWidth = width - padding * 2;
  const drawHeight = height - padding * 2;

  // Calculate X positions based on cumulative time
  // For TVF/TVA, times[4] (T5) is release time after sustain
  const totalTime = times.reduce((sum, t) => sum + t, 0) || 1;
  const xPositions = [padding];
  let cumTime = 0;

  for (let i = 0; i < times.length; i++) {
    cumTime += times[i];
    xPositions.push(padding + (cumTime / (totalTime || 1)) * drawWidth);
  }

  // Calculate Y positions based on levels (0 at bottom, 100 at top)
  const yPositions = levels.map((level) => padding + (1 - level / 100) * drawHeight);

  // Build path
  const pathData = xPositions
    .map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${yPositions[i]}`)
    .join(' ');

  // Convert mouse position to envelope level
  const getMouseY = (e: React.MouseEvent | MouseEvent): number => {
    if (!svgRef.current) return 50;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleY = height / rect.height;
    const y = (e.clientY - rect.top) * scaleY;
    return Math.round(Math.max(0, Math.min(100, (1 - (y - padding) / drawHeight) * 100)));
  };

  const handleMouseDown = (index: number) => (e: React.MouseEvent) => {
    if (disabled || levelKeys[index] === null) return;
    e.preventDefault();
    setDragging(index);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (dragging === null) return;
      const level = getMouseY(e);
      onLevelChange(dragging, level);
    },
    [dragging, onLevelChange]
  );

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

  // Sustain point index
  const sustainIndex = isPitch ? 3 : 4;

  return (
    <div className="bg-d110-surface rounded-md p-2" aria-label={`${label} envelope`}>
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

        {/* Sustain line */}
        <line
          x1={xPositions[sustainIndex]}
          y1={padding}
          x2={xPositions[sustainIndex]}
          y2={height - padding}
          stroke="#e94560"
          strokeOpacity={0.3}
          strokeWidth={1}
          strokeDasharray="4 2"
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

        {/* Draggable points */}
        {xPositions.map((x, i) => {
          const canDrag = levelKeys[i] !== null;
          const isSustain = i === sustainIndex;
          return (
            <g key={i}>
              {/* Larger invisible hit area */}
              {canDrag && (
                <circle
                  cx={x}
                  cy={yPositions[i]}
                  r={12}
                  fill="transparent"
                  className={cn(
                    !disabled && 'cursor-grab',
                    dragging === i && 'cursor-grabbing'
                  )}
                  onMouseDown={handleMouseDown(i)}
                />
              )}
              {/* Visible point */}
              <circle
                cx={x}
                cy={yPositions[i]}
                r={isSustain ? 6 : 5}
                fill={dragging === i ? '#ff6b8a' : isSustain ? '#e94560' : '#1a1a2e'}
                stroke="#e94560"
                strokeWidth={isSustain ? 2 : 1.5}
                className={cn(
                  !disabled && canDrag && 'cursor-grab',
                  dragging === i && 'cursor-grabbing'
                )}
                onMouseDown={canDrag ? handleMouseDown(i) : undefined}
              />
              {/* Level value label on drag */}
              {dragging === i && (
                <text
                  x={x}
                  y={yPositions[i] - 12}
                  textAnchor="middle"
                  fill="#e94560"
                  fontSize={10}
                  fontFamily="monospace"
                >
                  {levels[i]}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Point labels */}
      <div className="flex justify-between text-[10px] text-d110-muted mt-1 px-1">
        {pointLabels.map((pl, i) => (
          <span
            key={i}
            className={cn(
              i === sustainIndex && 'text-d110-highlight font-bold'
            )}
          >
            {pl}
          </span>
        ))}
      </div>

      {/* Drag hint */}
      {!disabled && (
        <div className="text-[9px] text-d110-muted/60 text-center mt-1">
          Drag points to adjust levels
        </div>
      )}
    </div>
  );
}
