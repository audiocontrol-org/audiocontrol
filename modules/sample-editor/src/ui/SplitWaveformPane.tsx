/**
 * SplitWaveformPane — split-screen waveform display for zoomed trim editing.
 *
 * When the sample editor is zoomed in, this component renders two side-by-side
 * canvas panes: the left pane is centered on trimRegion.start and the right
 * pane is centered on trimRegion.end. Each pane shows totalSamples / zoom
 * samples, with the trim handle rendered as a vertical center line that the
 * user can drag to adjust the trim point.
 *
 * Visual patterns (colors, center line, background tints) follow the loop
 * editor's split-pane implementation.
 */

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { cn } from '@/ui/utils';

export interface SplitWaveformPaneProps {
  samples: Int16Array;
  sampleRate: number;
  trimRegion: { start: number; end: number };
  onTrimRegionChange: (region: { start: number; end: number }) => void;
  zoom: number;
  height?: number;
  className?: string;
  isPreview?: boolean;
}

const WAVEFORM_COLOR = '#4a9eff';
const PREVIEW_WAVEFORM_COLOR = '#f0a030';
const BG_COLOR_LEFT = '#1a1a2e';
const BG_COLOR_RIGHT = '#1e1e32';
const CENTER_LINE_COLOR = '#333355';
const HANDLE_COLOR = '#f0a030';

type DragTarget = 'start' | 'end' | null;

export function SplitWaveformPane({
  samples,
  sampleRate: _sampleRate,
  trimRegion,
  onTrimRegionChange,
  zoom,
  height = 200,
  className,
  isPreview = false,
}: SplitWaveformPaneProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftCanvasRef = useRef<HTMLCanvasElement>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [isDragging, setIsDragging] = useState<DragTarget>(null);
  const dragStartX = useRef(0);
  const dragStartValue = useRef(0);

  const windowSamples = useMemo(
    () => Math.round(samples.length / zoom),
    [samples.length, zoom],
  );

  const paneWidth = useMemo(
    () => Math.floor(containerWidth / 2),
    [containerWidth],
  );

  // Observe container size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(Math.floor(entry.contentRect.width));
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Draw a single pane centered on a sample position
  const drawPane = useCallback(
    (canvas: HTMLCanvasElement, centerSample: number, side: 'left' | 'right') => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      const midY = h / 2;

      // Background
      ctx.fillStyle = side === 'left' ? BG_COLOR_LEFT : BG_COLOR_RIGHT;
      ctx.fillRect(0, 0, w, h);

      // Horizontal center line
      ctx.strokeStyle = CENTER_LINE_COLOR;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(w, midY);
      ctx.stroke();

      // Calculate the sample range visible in this pane
      const halfWindow = Math.floor(windowSamples / 2);
      const rangeStart = Math.max(0, centerSample - halfWindow);
      const rangeEnd = Math.min(samples.length, centerSample + halfWindow);

      // Draw waveform
      const samplesPerPixel = windowSamples / w;
      ctx.beginPath();
      ctx.strokeStyle = isPreview ? PREVIEW_WAVEFORM_COLOR : WAVEFORM_COLOR;
      ctx.lineWidth = 1;

      for (let x = 0; x < w; x++) {
        const sampleOffset = centerSample - halfWindow + x * samplesPerPixel;
        const sIdx = Math.floor(sampleOffset);
        const sEnd = Math.min(Math.floor(sampleOffset + samplesPerPixel), samples.length - 1);

        if (sIdx < 0 || sIdx >= samples.length) continue;

        let min = 0;
        let max = 0;
        for (let i = Math.max(0, sIdx); i <= Math.min(sEnd, samples.length - 1); i++) {
          if (samples[i] < min) min = samples[i];
          if (samples[i] > max) max = samples[i];
        }

        const yMin = midY - (max / 32768) * (midY - 2);
        const yMax = midY - (min / 32768) * (midY - 2);
        ctx.moveTo(x + 0.5, yMin);
        ctx.lineTo(x + 0.5, yMax);
      }
      ctx.stroke();

      // Vertical handle line at center
      ctx.strokeStyle = HANDLE_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const centerX = Math.floor(w / 2) + 0.5;
      ctx.moveTo(centerX, 0);
      ctx.lineTo(centerX, h);
      ctx.stroke();

      // Label
      ctx.fillStyle = HANDLE_COLOR;
      ctx.font = '10px monospace';
      const label = side === 'left'
        ? `Start: ${trimRegion.start}`
        : `End: ${trimRegion.end}`;
      const labelX = side === 'left' ? 4 : w - 80;
      ctx.fillText(label, labelX, 12);
    },
    [samples, windowSamples, isPreview, trimRegion.start, trimRegion.end],
  );

  // Redraw canvases when dependencies change
  useEffect(() => {
    const leftCanvas = leftCanvasRef.current;
    const rightCanvas = rightCanvasRef.current;
    if (leftCanvas) drawPane(leftCanvas, trimRegion.start, 'left');
    if (rightCanvas) drawPane(rightCanvas, trimRegion.end, 'right');
  }, [drawPane, trimRegion.start, trimRegion.end, paneWidth, height]);

  // Convert pixel offset to sample offset
  const pixelToSampleOffset = useCallback(
    (pixelDelta: number): number => {
      if (paneWidth === 0) return 0;
      return Math.round(pixelDelta * (windowSamples / paneWidth));
    },
    [paneWidth, windowSamples],
  );

  // Drag handlers
  const handleMouseDown = useCallback(
    (target: DragTarget, e: React.MouseEvent) => {
      if (!target) return;
      setIsDragging(target);
      dragStartX.current = e.clientX;
      dragStartValue.current = target === 'start' ? trimRegion.start : trimRegion.end;
      e.preventDefault();
    },
    [trimRegion],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragStartX.current;
      const deltaSamples = pixelToSampleOffset(deltaX);
      const newValue = dragStartValue.current + deltaSamples;

      const region = { ...trimRegion };
      if (isDragging === 'start') {
        region.start = Math.max(0, Math.min(newValue, region.end - 1));
      } else {
        region.end = Math.max(region.start + 1, Math.min(newValue, samples.length));
      }
      onTrimRegionChange(region);
    },
    [isDragging, pixelToSampleOffset, trimRegion, samples.length, onTrimRegionChange],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  // Register global mousemove/mouseup during drag
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div ref={containerRef} className={cn('w-full rounded overflow-hidden', className)}>
      <div className="flex w-full">
        <canvas
          ref={leftCanvasRef}
          width={paneWidth}
          height={height}
          style={{ width: '50%', height }}
          className={cn(
            'rounded-l cursor-ew-resize',
            isDragging === 'start' && 'ring-2 ring-amber-400',
          )}
          onMouseDown={(e) => handleMouseDown('start', e)}
        />
        <div className="w-[2px] bg-gray-600 shrink-0" />
        <canvas
          ref={rightCanvasRef}
          width={paneWidth}
          height={height}
          style={{ width: '50%', height }}
          className={cn(
            'rounded-r cursor-ew-resize',
            isDragging === 'end' && 'ring-2 ring-amber-400',
          )}
          onMouseDown={(e) => handleMouseDown('end', e)}
        />
      </div>
    </div>
  );
}
