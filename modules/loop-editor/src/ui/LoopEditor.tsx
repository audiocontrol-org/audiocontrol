/**
 * Loop Editor Component
 *
 * Split-pane waveform view for finding loop points.
 * Left pane shows waveform approaching the end point (where the loop restarts).
 * Right pane shows waveform from the loop point (where playback jumps to).
 * The splice point is at the center, allowing visual alignment of waveforms.
 *
 * Uses the AudioPlayback interface from WorkflowEnvironment instead of
 * browser-specific audio APIs — no browser globals referenced here.
 */

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import type { LoopCandidate } from '@audiocontrol/sampler-library';
import { createSmoothedCopy } from '@audiocontrol/sampler-library/browser';
import type { AudioPlayback } from '@audiocontrol/editor-core';
import type { LoopDetectionProgress } from '@/types';
import { cn } from './utils';

export interface LoopEditorProps {
  /** Audio samples (16-bit signed integers) */
  samples: Int16Array | null;
  /** Sample rate in Hz */
  sampleRate: number;
  /** Start point in samples */
  startPoint: number;
  /** Loop point in samples (where playback jumps to after end) */
  loopPoint: number;
  /** End point in samples (where the loop restarts from) */
  endPoint: number;
  /** Called when loop point changes */
  onLoopPointChange?: (loopPoint: number) => void;
  /** Called when end point changes */
  onEndPointChange?: (endPoint: number) => void;
  /** Called when changes should be committed to device */
  onCommit?: () => void;
  /** Height of each waveform pane */
  height?: number;
  /** Whether the editor is loading wave data */
  isLoading?: boolean;
  /** Loading progress (0-100) */
  loadingProgress?: number;
  /** Custom class name */
  className?: string;
  /** Loop point candidates from auto-detection */
  candidates?: LoopCandidate[];
  /** Index of the currently selected candidate */
  selectedCandidateIndex?: number;
  /** Called when a candidate is selected */
  onCandidateSelect?: (index: number) => void;
  /** Called when a candidate is applied (sets both loop and end points) */
  onApplyCandidate?: (loopStart: number, loopEnd: number) => void;
  /** Called to trigger auto-detection */
  onAutoDetect?: () => void;
  /** Whether auto-detection is in progress */
  isSearching?: boolean;
  /** Auto-detection search progress */
  searchProgress?: LoopDetectionProgress;
  /** Called to smooth the loop splice point with crossfade */
  onSmoothLoop?: (mode: 'linear' | 'equal-power') => void;
  /** Whether smoothing is in progress */
  isSmoothing?: boolean;
  /** AudioPlayback implementation from the workflow environment */
  audio?: AudioPlayback;
}

/** Waveform colors */
const WAVEFORM_COLOR = 'rgba(59, 130, 246, 0.8)';
const BACKGROUND_COLOR_LEFT = '#1a1a2e';
const BACKGROUND_COLOR_RIGHT = '#1e1e32';
const CENTER_LINE_COLOR = '#333';
const MARKER_COLOR = 'rgba(34, 197, 94, 0.8)';
const CANDIDATE_MARKER_COLOR = 'rgba(249, 115, 22, 0.8)';
const SELECTED_CANDIDATE_COLOR = 'rgba(34, 197, 94, 1.0)';

/** Zoom settings */
const MIN_ZOOM = 1;
const MAX_ZOOM = 128;
const ZOOM_STEP = 2;

/** Window sizes in samples */
const DEFAULT_WINDOW_SAMPLES = 4096;

export function LoopEditor({
  samples,
  sampleRate,
  startPoint,
  loopPoint,
  endPoint,
  onLoopPointChange,
  onEndPointChange,
  onCommit,
  height = 120,
  isLoading = false,
  loadingProgress,
  className,
  candidates = [],
  selectedCandidateIndex,
  onCandidateSelect,
  onApplyCandidate,
  onAutoDetect,
  isSearching = false,
  searchProgress,
  onSmoothLoop,
  isSmoothing = false,
  audio,
}: LoopEditorProps): JSX.Element {
  const leftCanvasRef = useRef<HTMLCanvasElement>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasContainerWidth, setCanvasContainerWidth] = useState(600);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState<'loop' | 'end' | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartValue, setDragStartValue] = useState(0);
  const [previewMode, setPreviewMode] = useState<'normal' | 'smoothed' | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Track audio state changes
  useEffect(() => {
    if (!audio) return;
    audio.onStateChange((state) => {
      setIsPlaying(state.playing);
      if (!state.playing) {
        setPreviewMode(null);
      }
    });
    return () => { audio.onStateChange(null); };
  }, [audio]);

  // Calculate window size based on zoom
  const windowSamples = Math.round(DEFAULT_WINDOW_SAMPLES / zoom);

  // Effective pane width (half of canvas container)
  const paneWidth = useMemo(() => Math.floor(canvasContainerWidth / 2), [canvasContainerWidth]);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      const style = getComputedStyle(container);
      const paddingLeft = parseFloat(style.paddingLeft) || 0;
      const paddingRight = parseFloat(style.paddingRight) || 0;
      const contentWidth = container.clientWidth - paddingLeft - paddingRight;
      setCanvasContainerWidth(contentWidth);
    };

    const resizeObserver = new ResizeObserver(() => { updateWidth(); });
    resizeObserver.observe(container);
    updateWidth();
    return () => resizeObserver.disconnect();
  }, []);

  // Convert pixel offset to sample offset
  const pixelToSampleOffset = useCallback(
    (pixelOffset: number): number => {
      if (paneWidth === 0) return 0;
      const samplesPerPixel = windowSamples / paneWidth;
      return Math.round(pixelOffset * samplesPerPixel);
    },
    [paneWidth, windowSamples],
  );

  // Create loop preview buffer
  const createLoopPreview = useCallback(
    (sourceSamples: Int16Array, applySmoothing: boolean): Int16Array => {
      const loopLength = endPoint - loopPoint;
      if (loopLength < 32) {
        throw new Error('Loop too short to preview');
      }

      const leadInSamples = Math.min(Math.floor(sampleRate * 0.1), loopPoint - startPoint);
      const leadInStart = endPoint - leadInSamples;
      const loopIterations = 3;
      const totalLength = leadInSamples + (loopLength * loopIterations);
      const preview = new Int16Array(totalLength);

      const processedSamples = applySmoothing
        ? createSmoothedCopy(sourceSamples, loopPoint, endPoint, { mode: 'equal-power', crossfadeLength: 64 })
        : sourceSamples;

      let writePos = 0;
      for (let i = 0; i < leadInSamples; i++) {
        preview[writePos++] = processedSamples[leadInStart + i] ?? 0;
      }

      for (let iter = 0; iter < loopIterations; iter++) {
        for (let i = 0; i < loopLength; i++) {
          preview[writePos++] = processedSamples[loopPoint + i] ?? 0;
        }
      }

      return preview;
    },
    [startPoint, loopPoint, endPoint, sampleRate],
  );

  // Preview the loop
  const handlePreviewLoop = useCallback(() => {
    if (!samples || !audio) return;
    try {
      audio.stop();
      setPreviewMode('normal');
      const preview = createLoopPreview(samples, false);
      const buffer = audio.createBuffer(preview, sampleRate);
      audio.play(buffer);
    } catch (err) {
      console.error('Failed to preview loop:', err);
    }
  }, [samples, audio, createLoopPreview, sampleRate]);

  // Preview with smoothing
  const handlePreviewSmoothed = useCallback(() => {
    if (!samples || !audio) return;
    try {
      audio.stop();
      setPreviewMode('smoothed');
      const preview = createLoopPreview(samples, true);
      const buffer = audio.createBuffer(preview, sampleRate);
      audio.play(buffer);
    } catch (err) {
      console.error('Failed to preview smoothed loop:', err);
    }
  }, [samples, audio, createLoopPreview, sampleRate]);

  // Stop preview
  const handleStopPreview = useCallback(() => {
    audio?.stop();
    setPreviewMode(null);
  }, [audio]);

  // Draw waveform
  const drawWaveform = useCallback(
    (canvas: HTMLCanvasElement, startSample: number, direction: 'left' | 'right') => {
      const ctx = canvas.getContext('2d');
      if (!ctx || !samples || samples.length === 0) return;

      const width = canvas.width;
      const canvasHeight = canvas.height;
      const midY = canvasHeight / 2;

      ctx.fillStyle = direction === 'left' ? BACKGROUND_COLOR_LEFT : BACKGROUND_COLOR_RIGHT;
      ctx.fillRect(0, 0, width, canvasHeight);

      ctx.strokeStyle = CENTER_LINE_COLOR;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(width, midY);
      ctx.stroke();

      const samplesPerPixel = windowSamples / width;
      let sampleStart: number;
      let sampleEnd: number;

      if (direction === 'left') {
        sampleEnd = startSample;
        sampleStart = sampleEnd - windowSamples;
      } else {
        sampleStart = startSample;
        sampleEnd = sampleStart + windowSamples;
      }

      sampleStart = Math.max(0, sampleStart);
      sampleEnd = Math.min(samples.length, sampleEnd);

      // Draw candidate markers
      if (candidates.length > 0) {
        candidates.forEach((candidate, index) => {
          const candidatePoint = direction === 'left' ? candidate.loopEnd : candidate.loopStart;
          const isSelected = index === selectedCandidateIndex;

          let xPos: number | null = null;
          if (candidatePoint >= sampleStart && candidatePoint <= sampleEnd) {
            if (direction === 'left') {
              xPos = ((candidatePoint - (startSample - windowSamples)) / windowSamples) * width;
            } else {
              xPos = ((candidatePoint - startSample) / windowSamples) * width;
            }
          }

          if (xPos !== null) {
            ctx.strokeStyle = isSelected ? SELECTED_CANDIDATE_COLOR : CANDIDATE_MARKER_COLOR;
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.setLineDash([4, 2]);
            ctx.beginPath();
            ctx.moveTo(xPos, 0);
            ctx.lineTo(xPos, canvasHeight);
            ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = isSelected ? SELECTED_CANDIDATE_COLOR : CANDIDATE_MARKER_COLOR;
            ctx.font = '9px monospace';
            ctx.fillText(`${index + 1}`, xPos + 2, canvasHeight - 4);
          }
        });
      }

      // Draw waveform
      ctx.beginPath();
      ctx.strokeStyle = WAVEFORM_COLOR;
      ctx.lineWidth = 1;

      let firstPoint = true;
      for (let x = 0; x < width; x++) {
        let sampleIndex: number;
        if (direction === 'left') {
          sampleIndex = Math.floor(sampleEnd - windowSamples + x * samplesPerPixel);
        } else {
          sampleIndex = Math.floor(sampleStart + x * samplesPerPixel);
        }

        if (sampleIndex < 0 || sampleIndex >= samples.length) continue;

        const pixelSampleStart = sampleIndex;
        const pixelSampleEnd = Math.min(samples.length - 1, Math.floor(sampleIndex + samplesPerPixel));

        let minVal = samples[pixelSampleStart];
        let maxVal = samples[pixelSampleStart];
        for (let s = pixelSampleStart; s <= pixelSampleEnd; s++) {
          if (samples[s] < minVal) minVal = samples[s];
          if (samples[s] > maxVal) maxVal = samples[s];
        }

        const yMin = midY - (maxVal / 32768) * (midY - 2);
        const yMax = midY - (minVal / 32768) * (midY - 2);

        if (firstPoint) {
          ctx.moveTo(x, yMin);
          firstPoint = false;
        }
        ctx.lineTo(x, yMin);
        ctx.lineTo(x, yMax);
      }
      ctx.stroke();

      // Position label
      ctx.fillStyle = MARKER_COLOR;
      ctx.font = '10px monospace';
      const label = direction === 'left' ? `End: ${endPoint}` : `Loop: ${loopPoint}`;
      const labelX = direction === 'left' ? width - 60 : 4;
      ctx.fillText(label, labelX, 12);
    },
    [samples, windowSamples, endPoint, loopPoint, candidates, selectedCandidateIndex],
  );

  // Redraw canvases
  useEffect(() => {
    if (!samples || samples.length === 0) return;
    const leftCanvas = leftCanvasRef.current;
    const rightCanvas = rightCanvasRef.current;
    if (leftCanvas) drawWaveform(leftCanvas, endPoint, 'left');
    if (rightCanvas) drawWaveform(rightCanvas, loopPoint, 'right');
  }, [samples, endPoint, loopPoint, drawWaveform, paneWidth, height, zoom, candidates, selectedCandidateIndex]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, z * ZOOM_STEP));
  }, []);
  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, z / ZOOM_STEP));
  }, []);
  const handleZoomReset = useCallback(() => { setZoom(1); }, []);

  // Drag handlers
  const handleMouseDown = useCallback(
    (pane: 'loop' | 'end', e: React.MouseEvent) => {
      setIsDragging(pane);
      setDragStartX(e.clientX);
      setDragStartValue(pane === 'loop' ? loopPoint : endPoint);
    },
    [loopPoint, endPoint],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragStartX;
      const deltaSamples = -pixelToSampleOffset(deltaX);
      const newValue = Math.max(startPoint, Math.min(samples?.length ?? 0, dragStartValue + deltaSamples));

      if (isDragging === 'loop') {
        onLoopPointChange?.(Math.min(newValue, endPoint));
      } else {
        onEndPointChange?.(Math.max(newValue, loopPoint));
      }
    },
    [isDragging, dragStartX, dragStartValue, pixelToSampleOffset, startPoint, endPoint, loopPoint, samples, onLoopPointChange, onEndPointChange],
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging) onCommit?.();
    setIsDragging(null);
  }, [isDragging, onCommit]);

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

  // Nudge controls
  const nudgeLoopPoint = useCallback(
    (delta: number) => {
      const newValue = Math.max(startPoint, Math.min(endPoint, loopPoint + delta));
      onLoopPointChange?.(newValue);
      onCommit?.();
    },
    [loopPoint, startPoint, endPoint, onLoopPointChange, onCommit],
  );

  const nudgeEndPoint = useCallback(
    (delta: number) => {
      const newValue = Math.max(loopPoint, Math.min(samples?.length ?? 0, endPoint + delta));
      onEndPointChange?.(newValue);
      onCommit?.();
    },
    [endPoint, loopPoint, samples, onEndPointChange, onCommit],
  );

  const loopLength = endPoint - loopPoint;
  const loopDurationMs = sampleRate > 0 ? (loopLength / sampleRate) * 1000 : 0;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement)) return;
      const nudgeAmount = e.shiftKey ? 100 : 1;

      switch (e.key) {
        case 'ArrowLeft':
          if (e.ctrlKey || e.metaKey) { nudgeLoopPoint(-nudgeAmount); }
          else { nudgeEndPoint(-nudgeAmount); }
          e.preventDefault();
          break;
        case 'ArrowRight':
          if (e.ctrlKey || e.metaKey) { nudgeLoopPoint(nudgeAmount); }
          else { nudgeEndPoint(nudgeAmount); }
          e.preventDefault();
          break;
        case '+': case '=':
          handleZoomIn();
          e.preventDefault();
          break;
        case '-':
          handleZoomOut();
          e.preventDefault();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nudgeLoopPoint, nudgeEndPoint, handleZoomIn, handleZoomOut]);

  if (isLoading) {
    return (
      <div className={cn('card', className)}>
        <h4 className="font-medium text-s330-text mb-4">Loop Editor</h4>
        <div className="flex flex-col items-center justify-center py-6 gap-3">
          <div className="flex items-center">
            <span className="inline-block w-4 h-4 border-2 border-s330-highlight border-t-transparent rounded-full animate-spin mr-2" />
            <span className="text-s330-muted">Loading wave data...</span>
          </div>
          {loadingProgress !== undefined && (
            <div className="w-48">
              <div className="h-2 bg-s330-panel rounded-full overflow-hidden">
                <div
                  className="h-full bg-s330-highlight transition-all duration-150 ease-out"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
              <p className="text-s330-muted text-xs text-center mt-1">
                {loadingProgress.toFixed(0)}%
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!samples || samples.length === 0) {
    return (
      <div className={cn('card', className)}>
        <div className="text-center py-8 text-s330-muted">
          No wave data available. Export or import a sample first.
        </div>
      </div>
    );
  }

  return (
    <div className={cn('card', className)} ref={containerRef} tabIndex={0} data-loop-editor>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h4 className="font-medium text-s330-text">Loop Editor</h4>
          {onAutoDetect && (
            <button
              onClick={onAutoDetect}
              disabled={isSearching}
              className="ac-btn ac-btn-xs ac-btn-primary"
              title="Auto-detect loop points"
            >
              {isSearching ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                  Searching...
                </>
              ) : (
                'Auto-Detect'
              )}
            </button>
          )}
          {/* Preview controls */}
          {audio && (
            <div className="flex items-center gap-1 border-l border-s330-accent/20 pl-3 ml-1">
              {!isPlaying ? (
                <>
                  <button
                    onClick={handlePreviewLoop}
                    disabled={!samples}
                    className="ac-btn ac-btn-xs ac-btn-ghost"
                    title="Preview loop (hear the splice point)"
                  >
                    &#9654; Preview
                  </button>
                  <button
                    onClick={handlePreviewSmoothed}
                    disabled={!samples}
                    className="ac-btn ac-btn-xs ac-btn-ghost"
                    title="Preview with crossfade smoothing applied"
                  >
                    &#9654; Smoothed
                  </button>
                </>
              ) : (
                <button
                  onClick={handleStopPreview}
                  className="ac-btn ac-btn-xs ac-btn-secondary"
                  title="Stop playback"
                >
                  &#9632; Stop {previewMode === 'smoothed' ? '(smoothed)' : ''}
                </button>
              )}
            </div>
          )}
          {onSmoothLoop && (
            <button
              onClick={() => onSmoothLoop('equal-power')}
              disabled={isSmoothing || isPlaying}
              className="ac-btn ac-btn-xs ac-btn-secondary"
              title="Apply crossfade at loop splice point to eliminate clicks"
            >
              {isSmoothing ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                  Smoothing...
                </>
              ) : (
                'Apply Smoothing'
              )}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleZoomOut} disabled={zoom <= MIN_ZOOM} className="ac-btn ac-btn-xs ac-btn-ghost" title="Zoom out">−</button>
          <button onClick={handleZoomReset} className="ac-btn ac-btn-xs ac-btn-ghost min-w-[40px]" title="Reset zoom">{zoom}x</button>
          <button onClick={handleZoomIn} disabled={zoom >= MAX_ZOOM} className="ac-btn ac-btn-xs ac-btn-ghost" title="Zoom in">+</button>
        </div>
      </div>

      {/* Search progress */}
      {isSearching && searchProgress && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-s330-muted mb-1">
            <span>{searchProgress.stage}</span>
            <span>{searchProgress.percent.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-s330-panel rounded-full overflow-hidden">
            <div className="h-full bg-s330-highlight transition-all duration-150 ease-out" style={{ width: `${searchProgress.percent}%` }} />
          </div>
        </div>
      )}

      {/* Info bar */}
      <div className="flex items-center justify-between mb-2 text-xs text-s330-muted">
        <span>Loop length: {loopLength} samples ({loopDurationMs.toFixed(1)}ms)</span>
        <span>Drag to adjust &bull; Arrow keys to nudge &bull; +/- to zoom</span>
      </div>

      {/* Split pane waveform display */}
      <div className="flex mb-1">
        <div className="flex-1 text-xs text-s330-muted text-center">&larr; Approaching End Point</div>
        <div className="flex-1 text-xs text-s330-muted text-center">Loop Point Continues &rarr;</div>
      </div>
      <div className="flex w-full" ref={canvasContainerRef}>
        <canvas
          ref={leftCanvasRef}
          width={paneWidth}
          height={height}
          style={{ width: '50%', height }}
          className={cn('rounded-l cursor-ew-resize', isDragging === 'end' && 'ring-2 ring-s330-highlight')}
          onMouseDown={(e) => handleMouseDown('end', e)}
        />
        <canvas
          ref={rightCanvasRef}
          width={paneWidth}
          height={height}
          style={{ width: '50%', height }}
          className={cn('rounded-r cursor-ew-resize', isDragging === 'loop' && 'ring-2 ring-s330-highlight')}
          onMouseDown={(e) => handleMouseDown('loop', e)}
        />
      </div>

      {/* Nudge controls */}
      <div className="flex gap-4 mt-4">
        <div className="flex-1">
          <label className="text-xs text-s330-muted block mb-1">End Point</label>
          <div className="flex items-center gap-1">
            <button onClick={() => nudgeEndPoint(-100)} className="ac-btn ac-btn-xs ac-btn-ghost" title="Move end point -100 samples">&lsaquo;&lsaquo;</button>
            <button onClick={() => nudgeEndPoint(-1)} className="ac-btn ac-btn-xs ac-btn-ghost" title="Move end point -1 sample">&lsaquo;</button>
            <input
              type="number"
              value={endPoint}
              onChange={(e) => { onEndPointChange?.(Math.max(loopPoint, parseInt(e.target.value) || 0)); }}
              onBlur={() => onCommit?.()}
              className="flex-1 min-w-0 text-sm font-mono bg-s330-bg border border-s330-accent/30 rounded px-2 py-1 text-s330-text text-center"
            />
            <button onClick={() => nudgeEndPoint(1)} className="ac-btn ac-btn-xs ac-btn-ghost" title="Move end point +1 sample">&rsaquo;</button>
            <button onClick={() => nudgeEndPoint(100)} className="ac-btn ac-btn-xs ac-btn-ghost" title="Move end point +100 samples">&rsaquo;&rsaquo;</button>
          </div>
        </div>
        <div className="flex-1">
          <label className="text-xs text-s330-muted block mb-1">Loop Point</label>
          <div className="flex items-center gap-1">
            <button onClick={() => nudgeLoopPoint(-100)} className="ac-btn ac-btn-xs ac-btn-ghost" title="Move loop point -100 samples">&lsaquo;&lsaquo;</button>
            <button onClick={() => nudgeLoopPoint(-1)} className="ac-btn ac-btn-xs ac-btn-ghost" title="Move loop point -1 sample">&lsaquo;</button>
            <input
              type="number"
              value={loopPoint}
              onChange={(e) => { onLoopPointChange?.(Math.min(endPoint, Math.max(startPoint, parseInt(e.target.value) || 0))); }}
              onBlur={() => onCommit?.()}
              className="flex-1 min-w-0 text-sm font-mono bg-s330-bg border border-s330-accent/30 rounded px-2 py-1 text-s330-text text-center"
            />
            <button onClick={() => nudgeLoopPoint(1)} className="ac-btn ac-btn-xs ac-btn-ghost" title="Move loop point +1 sample">&rsaquo;</button>
            <button onClick={() => nudgeLoopPoint(100)} className="ac-btn ac-btn-xs ac-btn-ghost" title="Move loop point +100 samples">&rsaquo;&rsaquo;</button>
          </div>
        </div>
      </div>

      {/* Candidates list */}
      {candidates.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-s330-muted">Loop Candidates ({candidates.length})</label>
            <span className="text-xs text-s330-muted">Click to apply &bull; Score: NCC / Spectral / Slope</span>
          </div>
          <div className="grid gap-1 max-h-36 overflow-y-auto pr-1">
            {candidates.map((candidate, index) => (
              <button
                key={`${candidate.loopStart}-${candidate.loopEnd}`}
                onClick={() => {
                  onCandidateSelect?.(index);
                  if (onApplyCandidate) {
                    onApplyCandidate(candidate.loopStart, candidate.loopEnd);
                  } else {
                    onLoopPointChange?.(candidate.loopStart);
                    onEndPointChange?.(candidate.loopEnd);
                  }
                  onCommit?.();
                }}
                className={cn(
                  'flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors',
                  'hover:bg-s330-panel/50',
                  index === selectedCandidateIndex
                    ? 'bg-s330-highlight/20 text-s330-highlight border border-s330-highlight/30'
                    : 'bg-s330-bg border border-s330-accent/10 text-s330-text',
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="font-mono w-4 text-center">{index + 1}</span>
                  <span className="font-mono">{candidate.loopStart} &rarr; {candidate.loopEnd}</span>
                  <span className="text-s330-muted">({candidate.loopEnd - candidate.loopStart} samples)</span>
                </span>
                <span className="font-mono text-s330-muted">
                  {(candidate.nccScore * 100).toFixed(0)}% /
                  {(candidate.spectralScore * 100).toFixed(0)}% /
                  {(candidate.slopeScore * 100).toFixed(0)}%
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
