/**
 * D-110 Envelope Editor
 *
 * Interactive editor for D-110's 5-stage envelopes.
 * Supports pitch, TVF, and TVA envelope types with different structures.
 *
 * Envelope structures:
 * - Pitch: L0 → L1 → L2 → Sustain → End (5 levels, 4 times)
 * - TVF/TVA: 0 → L1 → L2 → L3 → Sustain (starts at 0, 4 editable levels, 5 times)
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { VfdGlowDefs } from '@audiocontrol/editor-core';

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
  //
  // Pitch envelope: 5 points (L0 → L1 → L2 → Sus → End), 4 times between them
  // TVF/TVA envelope: 5 points (0 → L1 → L2 → L3 → Sus), 4 times + T5 (release)
  //   - Starts at 0, rises to L1 over T1, then L2 over T2, etc.
  //
  // For visualization, we show 5 points with 4 times before sustain.
  // T5 (release time) is shown separately in the table for TVF/TVA.
  // TVF/TVA envelopes start at 0, rise through L1-L3 to sustain, then release back to 0
  const levels = isPitch
    ? [pitchData.level0, pitchData.level1, pitchData.level2, pitchData.sustainLevel, pitchData.endLevel]
    : [0, tvfTvaData.level1, tvfTvaData.level2, tvfTvaData.level3, tvfTvaData.sustainLevel, 0];

  // Times shown in visualization
  // Pitch: 4 times (T1-T4) between 5 points
  // TVF/TVA: 5 times (T1-T5) between 6 points, including release
  const displayTimes = isPitch
    ? [pitchData.time1, pitchData.time2, pitchData.time3, pitchData.time4]
    : [tvfTvaData.time1, tvfTvaData.time2, tvfTvaData.time3, tvfTvaData.time4, tvfTvaData.time5];


  // levelKeys: which points can have their level edited (null = fixed level)
  // For TVF/TVA: Start (0) and Release (0) are fixed, others are editable
  const levelKeys = isPitch
    ? ['level0', 'level1', 'level2', 'sustainLevel', 'endLevel']
    : [null, 'level1', 'level2', 'level3', 'sustainLevel', null];

  const timeKeys = isPitch
    ? ['time1', 'time2', 'time3', 'time4']
    : ['time1', 'time2', 'time3', 'time4', 'time5'];

  const pointLabels = isPitch
    ? ['L0', 'L1', 'L2', 'Sus', 'End']
    : ['Start', 'L1', 'L2', 'L3', 'Sus', 'Rel'];

  const handleLevelChange = (index: number, value: number) => {
    const key = levelKeys[index];
    if (key) onChange(key, Math.max(0, Math.min(100, value)));
  };

  const handleTimeChange = (index: number, value: number) => {
    const key = timeKeys[index];
    if (key) onChange(key, Math.max(0, Math.min(100, value)));
  };

  // Time labels for table header
  const timeLabels = isPitch
    ? ['T1', 'T2', 'T3', 'T4']
    : ['T1', 'T2', 'T3', 'T4', 'T5'];

  return (
    <div className={cn('space-y-4', disabled && 'opacity-50 pointer-events-none')}>
      {/* Envelope visualization */}
      <EnvelopeVisualization
        levels={levels}
        times={displayTimes}
        pointLabels={pointLabels}
        label={label}
        isPitch={isPitch}
        levelKeys={levelKeys}
        onLevelChange={handleLevelChange}
        onTimeChange={handleTimeChange}
        onDragEnd={onCommit}
        disabled={disabled}
      />

      {/* Point-by-point editing table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-d110-muted border-b border-d110-border">
              <th className="text-left py-1 px-2 w-16">Param</th>
              {pointLabels.map((lbl, i) => {
                const isRelease = !isPitch && i === pointLabels.length - 1;
                return (
                  <th
                    key={i}
                    className={cn(
                      'text-center py-1 px-1 min-w-[50px]',
                      isRelease && 'text-amber-400'
                    )}
                  >
                    {lbl}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* Level row */}
            <tr className="border-b border-d110-border/50">
              <td className="py-2 px-2 text-d110-muted">Level</td>
              {levels.map((level, i) => {
                const isRelease = !isPitch && i === levels.length - 1;
                return (
                  <td key={i} className="py-1 px-1">
                    {levelKeys[i] === null ? (
                      <span className={cn(
                        'text-center block',
                        isRelease ? 'text-amber-400/50' : 'text-d110-muted/50'
                      )}>
                        {level}
                      </span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={level}
                        onChange={(e) => handleLevelChange(i, Number(e.target.value))}
                        onBlur={() => onCommit?.()}
                        className="w-full bg-d110-surface text-d110-text text-center rounded px-1 py-0.5 border border-d110-border"
                        disabled={disabled}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
            {/* Time row */}
            <tr>
              <td className="py-2 px-2 text-d110-muted">Time</td>
              {/* First cell is empty (no time before first point) */}
              <td className="py-1 px-1">
                <span className="text-d110-muted/50 text-center block">-</span>
              </td>
              {displayTimes.map((time, i) => {
                const isRelease = !isPitch && i === displayTimes.length - 1;
                return (
                  <td key={i} className="py-1 px-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={time}
                      onChange={(e) => handleTimeChange(i, Number(e.target.value))}
                      onBlur={() => onCommit?.()}
                      className={cn(
                        'w-full bg-d110-surface text-d110-text text-center rounded px-1 py-0.5 border border-d110-border',
                        isRelease && 'border-amber-400/50'
                      )}
                      disabled={disabled}
                      title={timeLabels[i]}
                    />
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Interactive SVG visualization of the envelope
 *
 * X-axis layout: Uses cumulative time positioning with an absolute scale.
 * Full draw width = 400 time units (4 segments × 100 max each).
 * When dragging a point, all points to the right shift with it.
 */
function EnvelopeVisualization({
  levels,
  times,
  pointLabels,
  label,
  isPitch,
  levelKeys,
  onLevelChange,
  onTimeChange,
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
  onTimeChange: (index: number, value: number) => void;
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

  // Absolute time scale: full draw width = 400 time units (4 segments × 100 max)
  // This gives intuitive dragging where point position directly maps to cumulative time
  const maxTotalTime = times.length * 100;

  // Calculate X positions based on cumulative time (absolute scale, not normalized)
  // Point 0 is at the start (padding)
  // Point i (i > 0) is at: padding + (cumTime / maxTotalTime) * drawWidth
  const xPositions = [padding];
  let cumTime = 0;
  for (let i = 0; i < times.length; i++) {
    cumTime += times[i];
    xPositions.push(padding + (cumTime / maxTotalTime) * drawWidth);
  }

  // Calculate Y positions based on levels (0 at bottom, 100 at top)
  const yPositions = levels.map((level) => padding + (1 - level / 100) * drawHeight);

  // Build path - for TVF/TVA, exclude the release point (drawn separately in amber)
  const mainPathPoints = isPitch ? xPositions.length : xPositions.length - 1;
  const pathData = xPositions
    .slice(0, mainPathPoints)
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

  // Convert mouse X position to time value for a given point
  // Uses cumulative positioning: the time is the difference between
  // the target cumulative time (from mouse position) and the previous point's cumulative time
  const getTimeFromMouseX = (e: MouseEvent, pointIndex: number): number => {
    if (!svgRef.current || pointIndex < 1) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = width / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;

    // Calculate cumulative time up to the point BEFORE the one being dragged
    let prevCumTime = 0;
    for (let i = 0; i < pointIndex - 1; i++) {
      prevCumTime += times[i];
    }

    // Convert mouse position to target cumulative time
    const clampedX = Math.max(padding, Math.min(width - padding, mouseX));
    const targetCumTime = ((clampedX - padding) / drawWidth) * maxTotalTime;

    // New time value = target cumulative time - previous cumulative time
    const newTime = targetCumTime - prevCumTime;

    return Math.round(Math.max(0, Math.min(100, newTime)));
  };

  const handleMouseDown = (index: number) => (e: React.MouseEvent) => {
    // A point can be dragged if it can edit level OR time
    // - levelKeys[index] !== null means level is editable
    // - index > 0 means time is editable (there's a time segment before this point)
    const canEditLevel = levelKeys[index] !== null;
    const canEditTime = index > 0;
    if (disabled || (!canEditLevel && !canEditTime)) return;
    e.preventDefault();
    setDragging(index);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (dragging === null) return;

      // Vertical (level) adjustment - only if level is editable
      if (levelKeys[dragging] !== null) {
        const level = getMouseY(e);
        onLevelChange(dragging, level);
      }

      // Horizontal (time) adjustment - only for points > 0
      // Point 0 has no time segment before it
      if (dragging > 0) {
        const newTime = getTimeFromMouseX(e, dragging);
        const timeIndex = dragging - 1;
        if (newTime !== times[timeIndex]) {
          onTimeChange(timeIndex, newTime);
        }
      }
    },
    [dragging, levelKeys, onLevelChange, onTimeChange, times, maxTotalTime]
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

  // Sustain point index (TVF/TVA now has 6 points: 0, L1, L2, L3, Sus, Rel)
  const sustainIndex = isPitch ? 3 : 4;

  // Release point index (only for TVF/TVA)
  const releaseIndex = isPitch ? -1 : 5;

  const envelopeColor = 'var(--ac-highlight)';
  const envelopeColorActive = 'color-mix(in srgb, var(--ac-highlight) 78%, white)';
  const envelopeSurface = 'var(--ac-bg-panel)';
  const releaseColor = '#f59e0b'; // Amber for release segment

  return (
    <div className="bg-d110-surface rounded-md p-2" aria-label={`${label} envelope`}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={cn('w-full h-auto', !disabled && 'cursor-crosshair')}
      >
        <VfdGlowDefs />

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
          stroke={envelopeColor}
          strokeOpacity={0.3}
          strokeWidth={1}
          strokeDasharray="4 2"
          filter="url(#vfd-glow-subtle)"
        />

        {/* Envelope curve - main attack/decay portion */}
        <path
          d={pathData}
          fill="none"
          stroke={envelopeColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#vfd-glow)"
        />

        {/* Release segment (TVF/TVA only) - drawn in amber */}
        {releaseIndex > 0 && (
          <line
            x1={xPositions[sustainIndex]}
            y1={yPositions[sustainIndex]}
            x2={xPositions[releaseIndex]}
            y2={yPositions[releaseIndex]}
            stroke={releaseColor}
            strokeWidth={2}
            strokeLinecap="round"
            filter="url(#vfd-glow)"
          />
        )}

        {/* Draggable points */}
        {xPositions.map((x, i) => {
          const canEditLevel = levelKeys[i] !== null;
          const canEditTime = i > 0;
          const canDrag = canEditLevel || canEditTime;
          const isSustain = i === sustainIndex;
          const isRelease = i === releaseIndex;
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
                    !disabled && (canEditLevel ? 'cursor-grab' : 'cursor-ew-resize'),
                    dragging === i && 'cursor-grabbing'
                  )}
                  onMouseDown={handleMouseDown(i)}
                />
              )}
              {/* Visible point */}
              <circle
                cx={x}
                cy={yPositions[i]}
                r={isSustain ? 6 : isRelease ? 5 : 5}
                fill={dragging === i ? envelopeColorActive : isSustain ? envelopeColor : isRelease ? releaseColor : envelopeSurface}
                stroke={isRelease ? releaseColor : envelopeColor}
                strokeWidth={isSustain ? 2 : 1.5}
                filter={dragging === i ? 'url(#vfd-glow-intense)' : 'url(#vfd-glow)'}
                className={cn(
                  !disabled && canDrag && (canEditLevel ? 'cursor-grab' : 'cursor-ew-resize'),
                  dragging === i && 'cursor-grabbing'
                )}
                onMouseDown={canDrag ? handleMouseDown(i) : undefined}
              />
              {/* Value labels on drag */}
              {dragging === i && (
                <>
                  {/* Level value above point (only if level is editable) */}
                  {canEditLevel && (
                    <text
                      x={x}
                      y={yPositions[i] - 12}
                      textAnchor="middle"
                      fill={envelopeColor}
                      fontSize={10}
                      fontFamily="monospace"
                    >
                      L:{levels[i]}
                    </text>
                  )}
                  {/* Time value below point (only for points > 0) */}
                  {canEditTime && (
                    <text
                      x={x}
                      y={yPositions[i] + 18}
                      textAnchor="middle"
                      fill={isRelease ? releaseColor : envelopeColor}
                      fontSize={10}
                      fontFamily="monospace"
                    >
                      T:{times[i - 1]}
                    </text>
                  )}
                </>
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
          Drag points: vertical = level, horizontal = time
        </div>
      )}
    </div>
  );
}
