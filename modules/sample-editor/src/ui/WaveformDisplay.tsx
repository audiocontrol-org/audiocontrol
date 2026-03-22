/**
 * WaveformDisplay — canvas-based waveform visualization with selection.
 *
 * Renders a peak-decimated waveform on a <canvas> element.
 * Supports click-drag to create a selection region (for trim preview).
 * Handles resize via ResizeObserver.
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { cn } from '@/ui/utils';

export interface WaveformDisplayProps {
  samples: Int16Array | null;
  sampleRate: number;
  /** Optional selection region (for trim preview). */
  selection?: { start: number; end: number } | null;
  /** Called when user drags to create/adjust selection. */
  onSelectionChange?: (sel: { start: number; end: number } | null) => void;
  height?: number;
  className?: string;
  /** When true, waveform is showing a preview (uses a different color). */
  isPreview?: boolean;
}

const WAVEFORM_COLOR = '#4a9eff';
const PREVIEW_WAVEFORM_COLOR = '#f0a030';
const SELECTION_COLOR = 'rgba(74, 158, 255, 0.25)';
const BG_COLOR = '#1a1a2e';
const CENTER_LINE_COLOR = '#333355';

export function WaveformDisplay({
  samples,
  sampleRate,
  selection,
  onSelectionChange,
  height = 200,
  className,
  isPreview = false,
}: WaveformDisplayProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(800);
  const dragStart = useRef<number | null>(null);

  // Observe container size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasWidth(Math.floor(entry.contentRect.width));
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, w, h);

    // Center line
    ctx.strokeStyle = CENTER_LINE_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    if (!samples || samples.length === 0) return;

    // Selection overlay
    if (selection) {
      const x0 = (selection.start / samples.length) * w;
      const x1 = (selection.end / samples.length) * w;
      ctx.fillStyle = SELECTION_COLOR;
      ctx.fillRect(x0, 0, x1 - x0, h);
    }

    // Peak-decimated waveform
    const samplesPerPixel = samples.length / w;
    ctx.strokeStyle = isPreview ? PREVIEW_WAVEFORM_COLOR : WAVEFORM_COLOR;
    ctx.lineWidth = 1;

    ctx.beginPath();
    for (let x = 0; x < w; x++) {
      const start = Math.floor(x * samplesPerPixel);
      const end = Math.min(Math.floor((x + 1) * samplesPerPixel), samples.length);

      let min = 0;
      let max = 0;
      for (let i = start; i < end; i++) {
        if (samples[i] < min) min = samples[i];
        if (samples[i] > max) max = samples[i];
      }

      const yMin = ((1 - max / 32768) * h) / 2;
      const yMax = ((1 - min / 32768) * h) / 2;

      ctx.moveTo(x + 0.5, yMin);
      ctx.lineTo(x + 0.5, yMax);
    }
    ctx.stroke();
  }, [samples, canvasWidth, height, selection, isPreview]);

  const pixelToSample = useCallback(
    (clientX: number): number => {
      const canvas = canvasRef.current;
      if (!canvas || !samples) return 0;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      return Math.floor((x / rect.width) * samples.length);
    },
    [samples],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!onSelectionChange || !samples) return;
      dragStart.current = pixelToSample(e.clientX);
    },
    [onSelectionChange, samples, pixelToSample],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragStart.current === null || !onSelectionChange || !samples) return;
      const current = pixelToSample(e.clientX);
      const start = Math.max(0, Math.min(dragStart.current, current));
      const end = Math.min(samples.length, Math.max(dragStart.current, current));
      onSelectionChange({ start, end });
    },
    [onSelectionChange, samples, pixelToSample],
  );

  const handleMouseUp = useCallback(() => {
    dragStart.current = null;
  }, []);

  return (
    <div ref={containerRef} className={cn('w-full rounded overflow-hidden', className)}>
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={height}
        className="w-full cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
}
