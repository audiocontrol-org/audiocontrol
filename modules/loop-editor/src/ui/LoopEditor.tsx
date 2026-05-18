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
 *
 * v3 design language: chrome lives in `LoopEditorToolbar.tsx` and uses the
 * `.ac-toolbar-btn`, `.ac-icon-btn`, `<AcToggle>`, and `.ac-field-label`
 * primitives. Layout classes live in
 * `editor-core/src/design/loop-editor-primitives.css`.
 */

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import type { LoopCandidate } from '@audiocontrol/sampler-library';
import { createSmoothedCopy } from '@audiocontrol/sampler-library/browser';
import type { AudioPlayback } from '@audiocontrol/editor-core';
import type { LoopDetectionProgress } from '@/types';
import { cn } from './utils';
import { drawWaveform } from './draw-waveform';
import { LoopEditorToolbar } from './LoopEditorToolbar';
import { LoopEditorNudges } from './LoopEditorNudges';
import { LoopEditorCandidates } from './LoopEditorCandidates';

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
  /** Current playback mode for the three-way toggle */
  playbackMode?: 'no-loop' | 'loop' | 'smoothed-loop';
  /** Called when the user switches playback mode */
  onPlaybackModeChange?: (mode: 'no-loop' | 'loop' | 'smoothed-loop') => void;
  /** Discontinuity analysis at the current splice point */
  discontinuity?: { normalizedAmplitudeStep: number; needsSmoothing: boolean } | null;
  /** Current crossfade length in samples */
  crossfadeLength?: number;
  /** Called when user changes crossfade length */
  onCrossfadeLengthChange?: (length: number) => void;
  /** Whether MIDI/keyboard playback is enabled */
  midiEnabled?: boolean;
  /** Called when MIDI toggle is clicked */
  onMidiEnabledChange?: (enabled: boolean) => void;
  /** Number of currently active MIDI voices */
  activeNoteCount?: number;
}

/** Waveform colors — design-token-backed CSS variables would be ideal but
 *  canvas takes literal strings. Token equivalents documented in comments. */
const WAVEFORM_COLOR = 'rgba(59, 130, 246, 0.8)';       /* ~ var(--ac-color-accent) */
const BACKGROUND_COLOR_LEFT = '#1a1a2e';                 /* ~ canvas surface */
const BACKGROUND_COLOR_RIGHT = '#1e1e32';
const CENTER_LINE_COLOR = '#333';
const MARKER_COLOR = 'rgba(34, 197, 94, 0.8)';           /* ~ var(--ac-status-connected) */
const CANDIDATE_MARKER_COLOR = 'rgba(249, 115, 22, 0.8)'; /* ~ var(--ac-status-warning) */
const SELECTED_CANDIDATE_COLOR = 'rgba(34, 197, 94, 1.0)';

const MIN_ZOOM = 1;
const MAX_ZOOM = 128;
const ZOOM_STEP = 2;
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
  playbackMode,
  onPlaybackModeChange,
  discontinuity,
  crossfadeLength,
  onCrossfadeLengthChange,
  midiEnabled,
  onMidiEnabledChange,
  activeNoteCount,
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

  // Update loop region on the live audio source when points change during playback
  useEffect(() => {
    if (isPlaying && audio?.setLoopRegion && sampleRate > 0) {
      audio.setLoopRegion(loopPoint / sampleRate, endPoint / sampleRate);
    }
  }, [isPlaying, audio, loopPoint, endPoint, sampleRate]);

  const windowSamples = Math.round(DEFAULT_WINDOW_SAMPLES / zoom);
  const paneWidth = useMemo(() => Math.floor(canvasContainerWidth / 2), [canvasContainerWidth]);

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

  const pixelToSampleOffset = useCallback(
    (pixelOffset: number): number => {
      if (paneWidth === 0) return 0;
      const samplesPerPixel = windowSamples / paneWidth;
      return Math.round(pixelOffset * samplesPerPixel);
    },
    [paneWidth, windowSamples],
  );

  const handlePreviewLoop = useCallback(() => {
    if (!samples || !audio) return;
    try {
      audio.stop();
      setPreviewMode('normal');
      const buffer = audio.createBuffer(samples, sampleRate);
      audio.play(buffer, {
        loop: true,
        loopStart: loopPoint / sampleRate,
        loopEnd: endPoint / sampleRate,
      });
    } catch (err) {
      console.error('Failed to preview loop:', err);
    }
  }, [samples, audio, sampleRate, loopPoint, endPoint]);

  const handlePreviewSmoothed = useCallback(() => {
    if (!samples || !audio) return;
    try {
      audio.stop();
      setPreviewMode('smoothed');
      const smoothed = createSmoothedCopy(samples, loopPoint, endPoint, { mode: 'equal-power', crossfadeLength: 64 });
      const buffer = audio.createBuffer(smoothed, sampleRate);
      audio.play(buffer, {
        loop: true,
        loopStart: loopPoint / sampleRate,
        loopEnd: endPoint / sampleRate,
      });
    } catch (err) {
      console.error('Failed to preview smoothed loop:', err);
    }
  }, [samples, audio, sampleRate, loopPoint, endPoint]);

  const handleStopPreview = useCallback(() => {
    audio?.stop();
    setPreviewMode(null);
  }, [audio]);

  useEffect(() => {
    if (!samples || samples.length === 0) return;
    const colors = {
      waveform: WAVEFORM_COLOR,
      bgLeft: BACKGROUND_COLOR_LEFT,
      bgRight: BACKGROUND_COLOR_RIGHT,
      center: CENTER_LINE_COLOR,
      marker: MARKER_COLOR,
      candidate: CANDIDATE_MARKER_COLOR,
      selectedCandidate: SELECTED_CANDIDATE_COLOR,
    };
    const leftCanvas = leftCanvasRef.current;
    const rightCanvas = rightCanvasRef.current;
    if (leftCanvas) {
      drawWaveform({
        canvas: leftCanvas, samples, windowSamples,
        startSample: endPoint, direction: 'left',
        endPoint, loopPoint, candidates, selectedCandidateIndex, colors,
      });
    }
    if (rightCanvas) {
      drawWaveform({
        canvas: rightCanvas, samples, windowSamples,
        startSample: loopPoint, direction: 'right',
        endPoint, loopPoint, candidates, selectedCandidateIndex, colors,
      });
    }
  }, [samples, endPoint, loopPoint, windowSamples, paneWidth, height, zoom, candidates, selectedCandidateIndex]);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, z * ZOOM_STEP));
  }, []);
  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, z / ZOOM_STEP));
  }, []);
  const handleZoomReset = useCallback(() => { setZoom(1); }, []);

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
      <div className={cn('ac-card', className)}>
        <h3 className="ac-title-md" style={{ marginBottom: 'var(--ac-space-3)' }}>Loop Editor</h3>
        <div className="ac-loop-progress">
          <div className="ac-loop-progress__head">
            <span>Loading wave data…</span>
            {loadingProgress !== undefined && <span>{loadingProgress.toFixed(0)}%</span>}
          </div>
          {loadingProgress !== undefined && (
            <div className="ac-loop-progress__bar">
              <div className="ac-loop-progress__fill" style={{ width: `${loadingProgress}%` }} />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!samples || samples.length === 0) {
    return (
      <div className={cn('ac-card', className)}>
        <div className="ac-text-muted" style={{ textAlign: 'center', padding: 'var(--ac-space-6) 0' }}>
          No wave data available. Export or import a sample first.
        </div>
      </div>
    );
  }

  return (
    <div className={cn('ac-card', className)} ref={containerRef} tabIndex={0} data-loop-editor>
      <LoopEditorToolbar
        onAutoDetect={onAutoDetect}
        isSearching={isSearching}
        audio={Boolean(audio)}
        isPlaying={isPlaying}
        previewMode={previewMode}
        onPreviewLoop={handlePreviewLoop}
        onPreviewSmoothed={handlePreviewSmoothed}
        onStopPreview={handleStopPreview}
        playbackMode={playbackMode}
        onPlaybackModeChange={onPlaybackModeChange}
        discontinuity={discontinuity}
        crossfadeLength={crossfadeLength}
        onCrossfadeLengthChange={onCrossfadeLengthChange}
        midiEnabled={midiEnabled}
        onMidiEnabledChange={onMidiEnabledChange}
        activeNoteCount={activeNoteCount}
        onSmoothLoop={onSmoothLoop}
        isSmoothing={isSmoothing}
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
      />

      {isSearching && searchProgress && (
        <div className="ac-loop-progress">
          <div className="ac-loop-progress__head">
            <span>{searchProgress.stage}</span>
            <span>{searchProgress.percent.toFixed(0)}%</span>
          </div>
          <div className="ac-loop-progress__bar">
            <div className="ac-loop-progress__fill" style={{ width: `${searchProgress.percent}%` }} />
          </div>
        </div>
      )}

      <div className="ac-loop-info-bar">
        <span>Loop length: {loopLength} samples ({loopDurationMs.toFixed(1)}ms)</span>
        <span>Drag to adjust · Arrow keys nudge · +/- to zoom</span>
      </div>

      <div className="ac-loop-pane-labels">
        <span>← Approaching End Point</span>
        <span>Loop Point Continues →</span>
      </div>
      <div className="ac-loop-canvas-row" ref={canvasContainerRef}>
        <canvas
          ref={leftCanvasRef}
          width={paneWidth}
          height={height}
          style={{ height }}
          className={cn('ac-loop-canvas', isDragging === 'end' && 'ac-loop-canvas--dragging')}
          onMouseDown={(e) => handleMouseDown('end', e)}
        />
        <canvas
          ref={rightCanvasRef}
          width={paneWidth}
          height={height}
          style={{ height }}
          className={cn('ac-loop-canvas', isDragging === 'loop' && 'ac-loop-canvas--dragging')}
          onMouseDown={(e) => handleMouseDown('loop', e)}
        />
      </div>

      <LoopEditorNudges
        endPoint={endPoint}
        loopPoint={loopPoint}
        startPoint={startPoint}
        onEndPointChange={onEndPointChange}
        onLoopPointChange={onLoopPointChange}
        onCommit={onCommit}
        nudgeEndPoint={nudgeEndPoint}
        nudgeLoopPoint={nudgeLoopPoint}
      />

      <LoopEditorCandidates
        candidates={candidates}
        selectedCandidateIndex={selectedCandidateIndex}
        onCandidateSelect={onCandidateSelect}
        onApplyCandidate={onApplyCandidate}
        onLoopPointChange={onLoopPointChange}
        onEndPointChange={onEndPointChange}
        onCommit={onCommit}
      />
    </div>
  );
}
