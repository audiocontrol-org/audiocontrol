/**
 * WaveformDisplay — canvas-based waveform visualization with selection and trim handles.
 *
 * Renders a peak-decimated waveform on a <canvas> element.
 * Supports click-drag to create a selection region (for non-trim operations).
 * When trimRegion is set, renders draggable trim handles instead.
 * Handles resize via ResizeObserver.
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { cn } from '@/ui/utils';
import { SplitWaveformPane } from '@/ui/SplitWaveformPane';

export interface WaveformDisplayProps {
  samples: Int16Array | null;
  sampleRate: number;
  /** Optional selection region (for non-trim operations). */
  selection?: { start: number; end: number } | null;
  /** Called when user drags to create/adjust selection. */
  onSelectionChange?: (sel: { start: number; end: number } | null) => void;
  /** Trim region with draggable handles. Outside regions are dimmed. */
  trimRegion?: { start: number; end: number } | null;
  /** Called when user drags a trim handle. */
  onTrimRegionChange?: (region: { start: number; end: number }) => void;
  height?: number;
  className?: string;
  /** When true, waveform is showing a preview (uses a different color). */
  isPreview?: boolean;
  /** Zoom level (1 = full sample, >1 = split-pane mode centered on trim handles). */
  zoom?: number;
}

const WAVEFORM_COLOR = '#4a9eff';
const PREVIEW_WAVEFORM_COLOR = '#f0a030';
const SELECTION_COLOR = 'rgba(74, 158, 255, 0.25)';
const BG_COLOR = '#1a1a2e';
const CENTER_LINE_COLOR = '#333355';
const TRIM_OVERLAY_COLOR = 'rgba(0, 0, 0, 0.55)';
const TRIM_HANDLE_COLOR = '#f0a030';
const HANDLE_HIT_PX = 6;

type DragTarget = 'start' | 'end' | null;

export function WaveformDisplay({
  samples,
  sampleRate,
  selection,
  onSelectionChange,
  trimRegion,
  onTrimRegionChange,
  height = 200,
  className,
  isPreview = false,
  zoom = 1,
}: WaveformDisplayProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(800);

  // Selection drag state (non-trim mode)
  const selectionDragStart = useRef<number | null>(null);

  // Trim handle drag state — refs to avoid re-renders during drag
  const trimDragTarget = useRef<DragTarget>(null);
  const trimDragRegion = useRef<{ start: number; end: number } | null>(null);
  const [cursorStyle, setCursorStyle] = useState<string>('crosshair');

  const hasTrimHandles = trimRegion != null && onTrimRegionChange != null;
  const useSplitPane = zoom > 1 && hasTrimHandles && trimRegion != null && samples != null && samples.length > 0;

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

    // Selection overlay (non-trim mode)
    if (!hasTrimHandles && selection) {
      const x0 = (selection.start / samples.length) * w;
      const x1 = (selection.end / samples.length) * w;
      ctx.fillStyle = SELECTION_COLOR;
      ctx.fillRect(x0, 0, x1 - x0, h);
    }

    // Peak-decimated waveform
    drawWaveform(ctx, samples, w, h, isPreview);

    // Trim overlays and handles
    if (hasTrimHandles && trimRegion) {
      const xStart = (trimRegion.start / samples.length) * w;
      const xEnd = (trimRegion.end / samples.length) * w;

      // Dim the trimmed-away regions
      ctx.fillStyle = TRIM_OVERLAY_COLOR;
      ctx.fillRect(0, 0, xStart, h);
      ctx.fillRect(xEnd, 0, w - xEnd, h);

      // Draw handle lines
      ctx.strokeStyle = TRIM_HANDLE_COLOR;
      ctx.lineWidth = 2;
      for (const x of [xStart, xEnd]) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
    }
  }, [samples, canvasWidth, height, selection, isPreview, trimRegion, hasTrimHandles]);

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

  const pixelX = useCallback(
    (clientX: number): number => {
      const canvas = canvasRef.current;
      if (!canvas) return 0;
      const rect = canvas.getBoundingClientRect();
      return clientX - rect.left;
    },
    [],
  );

  const sampleToPixelX = useCallback(
    (sample: number): number => {
      const canvas = canvasRef.current;
      if (!canvas || !samples) return 0;
      return (sample / samples.length) * canvas.getBoundingClientRect().width;
    },
    [samples],
  );

  // Detect which trim handle is near the cursor
  const hitTestHandle = useCallback(
    (clientX: number): DragTarget => {
      if (!trimRegion || !samples) return null;
      const px = pixelX(clientX);
      const startPx = sampleToPixelX(trimRegion.start);
      const endPx = sampleToPixelX(trimRegion.end);

      if (Math.abs(px - startPx) <= HANDLE_HIT_PX) return 'start';
      if (Math.abs(px - endPx) <= HANDLE_HIT_PX) return 'end';
      return null;
    },
    [trimRegion, samples, pixelX, sampleToPixelX],
  );

  // --- Mouse handlers ---

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!samples) return;

      if (hasTrimHandles) {
        const target = hitTestHandle(e.clientX);
        if (target) {
          trimDragTarget.current = target;
          trimDragRegion.current = trimRegion ? { ...trimRegion } : null;
          e.preventDefault();
        }
        return;
      }

      // Non-trim: selection drag
      if (onSelectionChange) {
        selectionDragStart.current = pixelToSample(e.clientX);
      }
    },
    [samples, hasTrimHandles, hitTestHandle, trimRegion, onSelectionChange, pixelToSample],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!samples) return;

      if (hasTrimHandles) {
        // During drag: update region via ref, redraw via state on commit
        if (trimDragTarget.current && trimDragRegion.current && onTrimRegionChange) {
          const sample = Math.max(0, Math.min(samples.length, pixelToSample(e.clientX)));
          const region = { ...trimDragRegion.current };

          if (trimDragTarget.current === 'start') {
            region.start = Math.min(sample, region.end - 1);
          } else {
            region.end = Math.max(sample, region.start + 1);
          }

          trimDragRegion.current = region;
          onTrimRegionChange(region);
          return;
        }

        // Hover: update cursor
        const target = hitTestHandle(e.clientX);
        setCursorStyle(target ? 'col-resize' : 'default');
        return;
      }

      // Non-trim: selection drag
      if (selectionDragStart.current === null || !onSelectionChange) return;
      const current = pixelToSample(e.clientX);
      const start = Math.max(0, Math.min(selectionDragStart.current, current));
      const end = Math.min(samples.length, Math.max(selectionDragStart.current, current));
      onSelectionChange({ start, end });
    },
    [samples, hasTrimHandles, onTrimRegionChange, hitTestHandle, onSelectionChange, pixelToSample],
  );

  const handleMouseUp = useCallback(() => {
    trimDragTarget.current = null;
    trimDragRegion.current = null;
    selectionDragStart.current = null;
  }, []);

  if (useSplitPane) {
    return (
      <SplitWaveformPane
        samples={samples!}
        sampleRate={sampleRate}
        trimRegion={trimRegion!}
        onTrimRegionChange={onTrimRegionChange!}
        zoom={zoom}
        height={height}
        className={className}
        isPreview={isPreview}
      />
    );
  }

  return (
    <div ref={containerRef} className={cn('w-full rounded overflow-hidden', className)}>
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={height}
        className="w-full"
        style={{ cursor: cursorStyle }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
}

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  samples: Int16Array,
  w: number,
  h: number,
  isPreview: boolean,
): void {
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
}
