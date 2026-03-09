/**
 * Waveform Editor
 *
 * Canvas-based waveform visualization with slice markers.
 * Displays audio samples and detected/manual slice points.
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
}

/** Colors for slice markers (cycles through these) */
const SLICE_COLORS = [
  'rgba(59, 130, 246, 0.3)',  // blue
  'rgba(34, 197, 94, 0.3)',   // green
  'rgba(234, 179, 8, 0.3)',   // yellow
  'rgba(168, 85, 247, 0.3)',  // purple
  'rgba(236, 72, 153, 0.3)',  // pink
  'rgba(20, 184, 166, 0.3)',  // teal
  'rgba(249, 115, 22, 0.3)',  // orange
  'rgba(99, 102, 241, 0.3)',  // indigo
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

export function WaveformEditor({
  samples,
  sampleRate,
  sliceMarkers,
  selectedSlice,
  onSliceClick,
  height = 150,
  showTimeLabels = true,
  className,
}: WaveformEditorProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(600);

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

    // Draw slice regions first (background)
    for (let i = 0; i < sliceMarkers.length; i++) {
      const marker = sliceMarkers[i];
      const x1 = Math.floor(marker.startSample / samplesPerPixel);
      const x2 = Math.ceil(marker.endSample / samplesPerPixel);
      const sliceWidth = x2 - x1;

      const isSelected = selectedSlice === i;
      const colorIndex = i % SLICE_COLORS.length;

      // Fill slice region
      ctx.fillStyle = isSelected
        ? SLICE_COLORS[colorIndex].replace('0.3', '0.5')
        : SLICE_COLORS[colorIndex];
      ctx.fillRect(x1, 0, sliceWidth, canvasHeight);

      // Draw slice boundary lines
      ctx.strokeStyle = SLICE_BORDER_COLORS[colorIndex];
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x1, 0);
      ctx.lineTo(x1, canvasHeight);
      ctx.stroke();
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
      const intervals = calculateTimeIntervals(durationMs);

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
  }, [samples, sampleRate, sliceMarkers, selectedSlice, canvasWidth, height, showTimeLabels]);

  // Handle click on canvas
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!samples || !onSliceClick) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const samplesPerPixel = samples.length / canvas.width;
      const clickedSample = x * samplesPerPixel;

      // Find which slice was clicked
      for (let i = 0; i < sliceMarkers.length; i++) {
        const marker = sliceMarkers[i];
        if (clickedSample >= marker.startSample && clickedSample < marker.endSample) {
          onSliceClick(i);
          return;
        }
      }
    },
    [samples, sliceMarkers, onSliceClick]
  );

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
    <div ref={containerRef} className={cn('relative', className)}>
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={height}
        onClick={handleClick}
        className={cn(
          'rounded border border-s330-accent/30',
          onSliceClick && 'cursor-pointer'
        )}
      />
      {/* Duration label */}
      <div className="absolute bottom-1 right-2 text-xs text-s330-muted">
        {((samples.length / sampleRate) * 1000).toFixed(0)}ms
      </div>
    </div>
  );
}

/**
 * Calculate time interval markers for the waveform.
 */
function calculateTimeIntervals(durationMs: number): number[] {
  // Choose appropriate interval based on duration
  let interval: number;
  if (durationMs <= 500) {
    interval = 100;
  } else if (durationMs <= 1000) {
    interval = 200;
  } else if (durationMs <= 2000) {
    interval = 500;
  } else if (durationMs <= 5000) {
    interval = 1000;
  } else {
    interval = 2000;
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
