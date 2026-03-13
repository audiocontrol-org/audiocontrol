/**
 * Waveform Editor
 *
 * Canvas-based waveform visualization with slice markers.
 * Supports interactive editing: drag to adjust, click to add, delete slices.
 * Supports horizontal zoom and scroll for fine-grained editing.
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { cn } from '@/lib/utils';

export interface SliceMarker {
  /** Start position in samples */
  startSample: number;
  /** End position in samples */
  endSample: number;
  /** Optional label for the slice */
  label?: string;
}

/** Change to apply to a slice */
export interface SliceChange {
  index: number;
  marker: SliceMarker;
}

interface WaveformEditorProps {
  /** Audio samples (16-bit signed integers) */
  samples: Int16Array | null;
  /** Sample rate in Hz */
  sampleRate: number;
  /** Slice markers to display */
  sliceMarkers: SliceMarker[];
  /** Currently selected slice index (for highlighting) */
  selectedSlice?: number;
  /** Callback when a slice is clicked */
  onSliceClick?: (index: number) => void;
  /** Height of the waveform canvas */
  height?: number;
  /** Whether to show time labels */
  showTimeLabels?: boolean;
  /** Custom class name */
  className?: string;
  /** Enable interactive editing (drag, add, delete) */
  editable?: boolean;
  /** Callback when a slice marker is dragged (editable mode) */
  onSliceChange?: (index: number, marker: SliceMarker) => void;
  /** Callback when multiple slices change at once (for joined edges mode) */
  onSlicesChange?: (changes: SliceChange[]) => void;
  /** Callback when adding a new slice point (editable mode) */
  onSliceAdd?: (samplePosition: number) => void;
  /** Callback when deleting a slice (editable mode) */
  onSliceDelete?: (index: number) => void;
  /** Current zoom level (1 = fit all, higher = zoomed in) */
  zoom?: number;
  /** Callback when zoom changes (for external control) */
  onZoomChange?: (zoom: number) => void;
  /** Show zoom controls */
  showZoomControls?: boolean;
  /** Join adjacent slice edges so they move together */
  joinedEdges?: boolean;
  /** Current playback position in samples (for playhead indicator) */
  playbackPosition?: number | null;
}

/** Colors for slice markers (cycles through these) */
const SLICE_COLORS = [
  'rgba(59, 130, 246, 0.3)', // blue
  'rgba(34, 197, 94, 0.3)', // green
  'rgba(234, 179, 8, 0.3)', // yellow
  'rgba(168, 85, 247, 0.3)', // purple
  'rgba(236, 72, 153, 0.3)', // pink
  'rgba(20, 184, 166, 0.3)', // teal
  'rgba(249, 115, 22, 0.3)', // orange
  'rgba(99, 102, 241, 0.3)', // indigo
];

const SLICE_BORDER_COLORS = [
  'rgba(59, 130, 246, 0.8)',
  'rgba(34, 197, 94, 0.8)',
  'rgba(234, 179, 8, 0.8)',
  'rgba(168, 85, 247, 0.8)',
  'rgba(236, 72, 153, 0.8)',
  'rgba(20, 184, 166, 0.8)',
  'rgba(249, 115, 22, 0.8)',
  'rgba(99, 102, 241, 0.8)',
];

/** Pixels from edge to consider as draggable handle */
const HANDLE_WIDTH = 8;

/** Minimum slice size in samples (10ms at 44100 = 441 samples) */
const MIN_SLICE_SAMPLES = 100;

/** Zoom limits */
const MIN_ZOOM = 1;
const MAX_ZOOM = 64;
const ZOOM_STEP = 1.5;

type DragState = {
  sliceIndex: number;
  edge: 'start' | 'end';
  startX: number;
  originalSample: number;
};

type HoverState = {
  sliceIndex: number;
  edge: 'start' | 'end' | 'body';
} | null;

export function WaveformEditor({
  samples,
  sampleRate,
  sliceMarkers,
  selectedSlice,
  onSliceClick,
  height = 150,
  showTimeLabels = true,
  className,
  editable = false,
  onSliceChange,
  onSlicesChange,
  onSliceAdd,
  onSliceDelete,
  zoom: externalZoom,
  onZoomChange,
  showZoomControls = false,
  joinedEdges = false,
  playbackPosition,
}: WaveformEditorProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(600);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoverState, setHoverState] = useState<HoverState>(null);

  // Internal zoom state (used if no external control)
  const [internalZoom, setInternalZoom] = useState(1);
  const zoom = externalZoom ?? internalZoom;
  const setZoom = onZoomChange ?? setInternalZoom;


  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(container);
    setCanvasWidth(container.clientWidth);

    return () => resizeObserver.disconnect();
  }, []);

  // Zoomed canvas width
  const zoomedWidth = Math.round(canvasWidth * zoom);

  // Helper: convert pixel X (in canvas coords) to sample position
  const pixelToSample = useCallback(
    (pixelX: number): number => {
      if (!samples) return 0;
      const samplesPerPixel = samples.length / zoomedWidth;
      return Math.round(pixelX * samplesPerPixel);
    },
    [samples, zoomedWidth]
  );

  // Helper: convert sample position to pixel X (in canvas coords)
  const sampleToPixel = useCallback(
    (samplePos: number): number => {
      if (!samples) return 0;
      return (samplePos / samples.length) * zoomedWidth;
    },
    [samples, zoomedWidth]
  );

  // Detect what's under the cursor
  const hitTest = useCallback(
    (pixelX: number): HoverState => {
      if (!editable || !samples) return null;

      for (let i = 0; i < sliceMarkers.length; i++) {
        const marker = sliceMarkers[i];
        const startX = sampleToPixel(marker.startSample);
        const endX = sampleToPixel(marker.endSample);

        // Check start edge
        if (Math.abs(pixelX - startX) <= HANDLE_WIDTH) {
          return { sliceIndex: i, edge: 'start' };
        }
        // Check end edge
        if (Math.abs(pixelX - endX) <= HANDLE_WIDTH) {
          return { sliceIndex: i, edge: 'end' };
        }
        // Check body
        if (pixelX > startX + HANDLE_WIDTH && pixelX < endX - HANDLE_WIDTH) {
          return { sliceIndex: i, edge: 'body' };
        }
      }
      return null;
    },
    [editable, samples, sliceMarkers, sampleToPixel]
  );

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(MAX_ZOOM, zoom * ZOOM_STEP);
    setZoom(newZoom);
  }, [zoom, setZoom]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(MIN_ZOOM, zoom / ZOOM_STEP);
    setZoom(newZoom);
  }, [zoom, setZoom]);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
  }, [setZoom]);

  // Center view on selected slice when selection changes
  useEffect(() => {
    if (selectedSlice !== undefined && scrollContainerRef.current && samples) {
      const marker = sliceMarkers[selectedSlice];
      if (marker) {
        const sliceCenter = (marker.startSample + marker.endSample) / 2;
        const pixelCenter = sampleToPixel(sliceCenter);
        const containerWidth = scrollContainerRef.current.clientWidth;
        const scrollTarget = pixelCenter - containerWidth / 2;

        // Only scroll if the slice is not visible
        const currentScroll = scrollContainerRef.current.scrollLeft;
        const sliceStart = sampleToPixel(marker.startSample);
        const sliceEnd = sampleToPixel(marker.endSample);

        if (sliceStart < currentScroll || sliceEnd > currentScroll + containerWidth) {
          scrollContainerRef.current.scrollTo({
            left: Math.max(0, scrollTarget),
            behavior: 'smooth',
          });
        }
      }
    }
  }, [selectedSlice, sliceMarkers, samples, sampleToPixel]);

  // Draw waveform and markers
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !samples || samples.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const canvasHeight = canvas.height;
    const midY = canvasHeight / 2;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, canvasHeight);

    // Draw center line
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, midY);
    ctx.lineTo(width, midY);
    ctx.stroke();

    // Calculate samples per pixel
    const samplesPerPixel = samples.length / width;

    // Detect which boundaries are joined (adjacent slices share the same point)
    const joinedBoundaries = new Set<number>();
    if (joinedEdges) {
      for (let i = 0; i < sliceMarkers.length - 1; i++) {
        const current = sliceMarkers[i];
        const next = sliceMarkers[i + 1];
        // Consider joined if they're within 10 samples of each other
        if (next && Math.abs(current.endSample - next.startSample) <= 10) {
          joinedBoundaries.add(i); // Mark current slice's end as joined
        }
      }
    }

    // Draw slice regions first (background)
    for (let i = 0; i < sliceMarkers.length; i++) {
      const marker = sliceMarkers[i];
      const x1 = Math.floor(marker.startSample / samplesPerPixel);
      const x2 = Math.ceil(marker.endSample / samplesPerPixel);
      const sliceWidth = x2 - x1;

      const isSelected = selectedSlice === i;
      const isHovered = hoverState?.sliceIndex === i;
      const colorIndex = i % SLICE_COLORS.length;

      // Fill slice region
      const alpha = isSelected ? '0.5' : isHovered ? '0.4' : '0.3';
      ctx.fillStyle = SLICE_COLORS[colorIndex].replace('0.3', alpha);
      ctx.fillRect(x1, 0, sliceWidth, canvasHeight);

      // Draw slice boundary lines
      ctx.strokeStyle = SLICE_BORDER_COLORS[colorIndex];
      ctx.lineWidth = isSelected ? 2 : 1;

      // Start boundary
      const startHovered = hoverState?.sliceIndex === i && hoverState?.edge === 'start';
      const startIsJoined = i > 0 && joinedBoundaries.has(i - 1);
      ctx.lineWidth = startHovered || (dragState?.sliceIndex === i && dragState?.edge === 'start') ? 3 : isSelected ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x1, 0);
      ctx.lineTo(x1, canvasHeight);
      ctx.stroke();

      // End boundary
      const endHovered = hoverState?.sliceIndex === i && hoverState?.edge === 'end';
      const endIsJoined = joinedBoundaries.has(i);
      ctx.lineWidth = endHovered || (dragState?.sliceIndex === i && dragState?.edge === 'end') ? 3 : isSelected ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x2, 0);
      ctx.lineTo(x2, canvasHeight);
      ctx.stroke();

      // Draw handle indicators in editable mode
      if (editable) {
        const handleColor = SLICE_BORDER_COLORS[colorIndex];
        ctx.fillStyle = handleColor;

        // Start handle
        if (startHovered || (dragState?.sliceIndex === i && dragState?.edge === 'start')) {
          ctx.fillRect(x1 - 2, canvasHeight / 2 - 15, 4, 30);
          // Draw chain link indicator for joined edges
          if (startIsJoined && joinedEdges) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(x1 - 3, canvasHeight / 2 - 3, 6, 6);
            ctx.fillStyle = handleColor;
          }
        }
        // End handle
        if (endHovered || (dragState?.sliceIndex === i && dragState?.edge === 'end')) {
          ctx.fillRect(x2 - 2, canvasHeight / 2 - 15, 4, 30);
          // Draw chain link indicator for joined edges
          if (endIsJoined && joinedEdges) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(x2 - 3, canvasHeight / 2 - 3, 6, 6);
            ctx.fillStyle = handleColor;
          }
        }
      }

      // Draw joined edge indicator (small diamond) when joinedEdges mode is on
      if (joinedEdges && endIsJoined) {
        ctx.fillStyle = '#f59e0b'; // amber color for joined indicator
        const midY = canvasHeight / 2;
        ctx.beginPath();
        ctx.moveTo(x2, midY - 6);
        ctx.lineTo(x2 + 4, midY);
        ctx.lineTo(x2, midY + 6);
        ctx.lineTo(x2 - 4, midY);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Draw waveform
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let x = 0; x < width; x++) {
      const startSample = Math.floor(x * samplesPerPixel);
      const endSample = Math.min(Math.ceil((x + 1) * samplesPerPixel), samples.length);

      // Find min and max in this pixel's range
      let min = 0;
      let max = 0;
      for (let i = startSample; i < endSample; i++) {
        const sample = samples[i];
        if (sample < min) min = sample;
        if (sample > max) max = sample;
      }

      // Normalize to canvas height
      const yMin = midY - (max / 32768) * (midY - 10);
      const yMax = midY - (min / 32768) * (midY - 10);

      if (x === 0) {
        ctx.moveTo(x, yMin);
      }
      ctx.lineTo(x, yMin);
      ctx.lineTo(x, yMax);
    }
    ctx.stroke();

    // Draw slice labels
    ctx.font = '10px system-ui, sans-serif';
    ctx.textBaseline = 'top';

    for (let i = 0; i < sliceMarkers.length; i++) {
      const marker = sliceMarkers[i];
      const x = Math.floor(marker.startSample / samplesPerPixel) + 4;
      const label = marker.label ?? `${i + 1}`;

      const colorIndex = i % SLICE_COLORS.length;
      ctx.fillStyle = SLICE_BORDER_COLORS[colorIndex];
      ctx.fillText(label, x, 4);
    }

    // Draw time labels
    if (showTimeLabels) {
      const durationMs = (samples.length / sampleRate) * 1000;
      const intervals = calculateTimeIntervals(durationMs, zoom);

      ctx.fillStyle = '#666';
      ctx.font = '9px system-ui, sans-serif';
      ctx.textBaseline = 'bottom';

      for (const timeMs of intervals) {
        const x = (timeMs / durationMs) * width;
        const label = formatTimeLabel(timeMs);
        ctx.fillText(label, x + 2, canvasHeight - 2);

        // Small tick mark
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, canvasHeight - 12);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
      }
    }

    // Draw add hint when hovering over empty space in editable mode
    if (editable && !hoverState && !dragState) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // No text, just visual feedback when hovering
    }

    // Draw playhead indicator
    if (playbackPosition !== null && playbackPosition !== undefined) {
      const playheadX = Math.floor(playbackPosition / samplesPerPixel);

      // Draw playhead line
      ctx.strokeStyle = '#ef4444'; // red
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, canvasHeight);
      ctx.stroke();

      // Draw playhead triangle at top
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(playheadX - 6, 0);
      ctx.lineTo(playheadX + 6, 0);
      ctx.lineTo(playheadX, 8);
      ctx.closePath();
      ctx.fill();
    }
  }, [samples, sampleRate, sliceMarkers, selectedSlice, zoomedWidth, height, showTimeLabels, editable, hoverState, dragState, zoom, joinedEdges, playbackPosition]);

  // Handle mouse move for hover detection and dragging
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !samples) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;

      if (dragState && (onSliceChange || onSlicesChange)) {
        // Dragging - update slice position
        const newSample = pixelToSample(x);
        const marker = sliceMarkers[dragState.sliceIndex];
        if (!marker) return;

        let newMarker: SliceMarker;
        let adjacentChange: SliceChange | null = null;

        if (dragState.edge === 'start') {
          // Dragging start edge
          const prevSlice = dragState.sliceIndex > 0 ? sliceMarkers[dragState.sliceIndex - 1] : null;

          // In joined mode, we can move into the previous slice (adjusting its end)
          // Constraint: can't make previous slice smaller than MIN_SLICE_SAMPLES
          const minStart = joinedEdges && prevSlice
            ? prevSlice.startSample + MIN_SLICE_SAMPLES
            : (prevSlice?.endSample ?? 0);
          const maxStart = marker.endSample - MIN_SLICE_SAMPLES;
          const constrainedStart = Math.max(minStart, Math.min(maxStart, newSample));

          newMarker = { ...marker, startSample: constrainedStart };

          // In joined mode, also update the previous slice's end
          if (joinedEdges && prevSlice) {
            adjacentChange = {
              index: dragState.sliceIndex - 1,
              marker: { ...prevSlice, endSample: constrainedStart },
            };
          }
        } else {
          // Dragging end edge
          const nextSlice = sliceMarkers[dragState.sliceIndex + 1];

          // In joined mode, we can move into the next slice (adjusting its start)
          // Constraint: can't make next slice smaller than MIN_SLICE_SAMPLES
          const maxEnd = joinedEdges && nextSlice
            ? nextSlice.endSample - MIN_SLICE_SAMPLES
            : (nextSlice?.startSample ?? samples.length);
          const minEnd = marker.startSample + MIN_SLICE_SAMPLES;
          const constrainedEnd = Math.max(minEnd, Math.min(maxEnd, newSample));

          newMarker = { ...marker, endSample: constrainedEnd };

          // In joined mode, also update the next slice's start
          if (joinedEdges && nextSlice) {
            adjacentChange = {
              index: dragState.sliceIndex + 1,
              marker: { ...nextSlice, startSample: constrainedEnd },
            };
          }
        }

        // Apply changes
        if (adjacentChange && onSlicesChange) {
          // Batch update both slices
          onSlicesChange([
            { index: dragState.sliceIndex, marker: newMarker },
            adjacentChange,
          ]);
        } else if (onSliceChange) {
          // Single slice update
          onSliceChange(dragState.sliceIndex, newMarker);
        }
      } else if (editable) {
        // Just hovering - update hover state
        const hit = hitTest(x);
        setHoverState(hit);
      }
    },
    [samples, dragState, editable, sliceMarkers, pixelToSample, hitTest, onSliceChange, onSlicesChange, joinedEdges]
  );

  // Handle mouse down for starting drag
  const handleMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!editable || !samples) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const hit = hitTest(x);

      if (hit && (hit.edge === 'start' || hit.edge === 'end')) {
        // Start dragging
        const marker = sliceMarkers[hit.sliceIndex];
        if (!marker) return;

        event.preventDefault();
        setDragState({
          sliceIndex: hit.sliceIndex,
          edge: hit.edge,
          startX: x,
          originalSample: hit.edge === 'start' ? marker.startSample : marker.endSample,
        });
      }
    },
    [editable, samples, sliceMarkers, hitTest]
  );

  // Handle mouse up for ending drag
  const handleMouseUp = useCallback(() => {
    if (dragState) {
      setDragState(null);
    }
  }, [dragState]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setHoverState(null);
    if (dragState) {
      setDragState(null);
    }
  }, [dragState]);

  // Handle click on canvas
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!samples) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      // Don't process click if we just finished dragging
      if (dragState) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const clickedSample = pixelToSample(x);
      const hit = hitTest(x);

      if (hit) {
        // Clicked on a slice - select it
        if (onSliceClick && hit.edge === 'body') {
          onSliceClick(hit.sliceIndex);
        }
      } else if (editable && onSliceAdd) {
        // Clicked on empty space - add new slice point
        onSliceAdd(clickedSample);
      }
    },
    [samples, dragState, editable, pixelToSample, hitTest, onSliceClick, onSliceAdd]
  );

  // Handle double-click on canvas to split a slice
  const handleDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!samples || !editable || !onSliceAdd) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const clickedSample = pixelToSample(x);
      const hit = hitTest(x);

      // Double-click on slice body to split it
      if (hit && hit.edge === 'body') {
        event.preventDefault();
        onSliceAdd(clickedSample);
      }
    },
    [samples, editable, pixelToSample, hitTest, onSliceAdd]
  );

  // Handle keyboard for deleting selected slice and zooming
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // Zoom controls: +/= for zoom in, -/_ for zoom out
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        event.stopPropagation();
        handleZoomIn();
        return;
      }
      if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        event.stopPropagation();
        handleZoomOut();
        return;
      }
      // Reset zoom with 0
      if (event.key === '0') {
        event.preventDefault();
        event.stopPropagation();
        handleZoomReset();
        return;
      }

      // Delete slice
      if (!editable || selectedSlice === undefined || !onSliceDelete) return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        onSliceDelete(selectedSlice);
      }
    },
    [editable, selectedSlice, onSliceDelete, handleZoomIn, handleZoomOut, handleZoomReset]
  );


  // Determine cursor style
  const getCursor = (): string => {
    if (dragState) return 'ew-resize';
    if (hoverState?.edge === 'start' || hoverState?.edge === 'end') return 'ew-resize';
    if (hoverState?.edge === 'body') return 'pointer';
    if (editable) return 'crosshair';
    if (onSliceClick) return 'pointer';
    return 'default';
  };

  // Empty state
  if (!samples || samples.length === 0) {
    return (
      <div
        className={cn(
          'bg-s330-bg rounded border border-s330-accent/30 flex items-center justify-center',
          className
        )}
        style={{ height }}
      >
        <span className="text-s330-muted text-sm">No audio loaded</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative', className)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Zoom controls */}
      {showZoomControls && (
        <div className="absolute top-1 right-1 z-10 flex items-center gap-1 bg-s330-bg/80 rounded px-1">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            className={cn(
              'p-1 text-s330-muted hover:text-s330-text transition-colors',
              zoom <= MIN_ZOOM && 'opacity-30 cursor-not-allowed'
            )}
            title="Zoom out (-)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={handleZoomReset}
            className="px-1 text-xs text-s330-muted hover:text-s330-text transition-colors"
            title="Reset zoom (0)"
          >
            {zoom > 1 ? `${zoom.toFixed(1)}×` : 'Fit'}
          </button>
          <button
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            className={cn(
              'p-1 text-s330-muted hover:text-s330-text transition-colors',
              zoom >= MAX_ZOOM && 'opacity-30 cursor-not-allowed'
            )}
            title="Zoom in (+)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      )}

      {/* Scrollable container for zoomed waveform */}
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto"
        style={{ height: height + 16 }} // Extra space for scrollbar
      >
        <canvas
          ref={canvasRef}
          width={zoomedWidth}
          height={height}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          className={cn('rounded border border-s330-accent/30 outline-none')}
          style={{ cursor: getCursor() }}
        />
      </div>

      {/* Duration label */}
      <div className="absolute bottom-5 right-2 text-xs text-s330-muted pointer-events-none">
        {((samples.length / sampleRate) * 1000).toFixed(0)}ms
      </div>

      {/* Edit mode hint */}
      {editable && !dragState && sliceMarkers.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-s330-muted text-sm bg-s330-bg/80 px-2 py-1 rounded">
            Click to add slice points
          </span>
        </div>
      )}

      {/* Zoom hint (when zoomed) */}
      {zoom > 1 && (
        <div className="absolute bottom-5 left-2 text-xs text-s330-muted pointer-events-none">
          Scroll to pan • +/- to zoom
        </div>
      )}
    </div>
  );
}

/**
 * Calculate time interval markers for the waveform.
 */
function calculateTimeIntervals(durationMs: number, zoom: number): number[] {
  // Adjust interval based on zoom level
  const effectiveDuration = durationMs / zoom;

  // Choose appropriate interval based on visible duration
  let interval: number;
  if (effectiveDuration <= 100) {
    interval = 10;
  } else if (effectiveDuration <= 250) {
    interval = 25;
  } else if (effectiveDuration <= 500) {
    interval = 50;
  } else if (effectiveDuration <= 1000) {
    interval = 100;
  } else if (effectiveDuration <= 2000) {
    interval = 200;
  } else if (effectiveDuration <= 5000) {
    interval = 500;
  } else {
    interval = 1000;
  }

  const intervals: number[] = [];
  for (let t = interval; t < durationMs; t += interval) {
    intervals.push(t);
  }
  return intervals;
}

/**
 * Format time label.
 */
function formatTimeLabel(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${ms}ms`;
}
