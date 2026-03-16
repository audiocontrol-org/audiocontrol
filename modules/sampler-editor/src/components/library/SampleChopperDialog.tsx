/**
 * Sample Chopper Dialog
 *
 * Dialog for slicing a contiguous audio sample into individual drum hits
 * and creating a drum kit for import. Supports both auto-detection and
 * manual slice editing (drag to adjust, click to add, delete).
 *
 * Features:
 * - Fullscreen mode for detailed waveform editing
 * - Horizontal zoom (+/- keys) for fine-grained slice adjustment
 * - Multiple detection methods: transient, silence, fixed interval
 * - Manual slice editing with drag-to-adjust
 * - Audio preview for slices (Space to play selected)
 */

import { useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import {
  slicesToDrumKit,
  type ResolvedDrumKitBundle,
} from '@audiocontrol/sampler-library/browser';
import { cn } from '@/lib/utils';
import { WaveformEditor } from './WaveformEditor';
import { useAudioPreview } from '@/hooks/useAudioPreview';
import {
  useSampleChopper,
  MIN_ZOOM,
  MAX_ZOOM,
  type SliceMethodTab,
  type SliceDefinitionOutput,
  type InitialSliceDefinition,
} from '@/hooks/useSampleChopper';

// Re-export types so existing consumers (LibraryPage, ItemPreviewPanel) aren't broken
export type { SliceDefinitionOutput, InitialSliceDefinition };

export interface SampleChopperDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onOpenChange: (open: boolean) => void;
  /** Audio samples to chop (16-bit signed integers) */
  samples: Int16Array | null;
  /** Sample rate of the audio in Hz */
  sampleRate: number;
  /** Source file name (for default kit name) */
  sourceName: string;
  /**
   * Callback when drum kit is created (new kit).
   * @param kit - The resolved drum kit bundle
   * @param slices - Slice definitions with labels and sample boundaries
   * @param sourceWav - The original source audio samples and sample rate
   */
  onKitCreated: (
    kit: ResolvedDrumKitBundle,
    slices: SliceDefinitionOutput[],
    sourceWav: { samples: Int16Array; sampleRate: number }
  ) => void;
  /** Edit mode: pre-populate with existing slices */
  editMode?: boolean;
  /** Initial slice definitions for edit mode */
  initialSlices?: InitialSliceDefinition[];
  /** Kit configuration for edit mode (pre-populated values) */
  initialKitConfig?: {
    name: string;
    sampleRate: 15000 | 30000;
    baseNote: number;
    transpose?: number;
    velocitySensitivity?: number;
  };
  /**
   * Callback when slices are updated (edit mode).
   * @param slices - Updated slice definitions
   * @param kitConfig - Updated kit configuration (transpose, velocitySensitivity)
   */
  onSlicesUpdated?: (
    slices: SliceDefinitionOutput[],
    kitConfig: { transpose?: number; velocitySensitivity?: number }
  ) => void;
}

export function SampleChopperDialog({
  open,
  onOpenChange,
  samples,
  sampleRate,
  sourceName,
  onKitCreated,
  editMode = false,
  initialSlices,
  initialKitConfig,
  onSlicesUpdated,
}: SampleChopperDialogProps): JSX.Element {
  const chopper = useSampleChopper({
    samples,
    sampleRate,
    open,
    editMode,
    initialSlices,
    initialKitConfig,
  });

  // Audio preview (UI concern, stays in dialog)
  const { play, stop, isPlaying, playbackPosition } = useAudioPreview({ sampleRate });

  // Stop playback when dialog closes
  const handleClose = useCallback(() => {
    stop();
    onOpenChange(false);
  }, [onOpenChange, stop]);

  // Initialize kit name from source (only for new kits)
  // This effect uses sourceName which is a dialog-level prop
  if (open && sourceName && !chopper.kitName && !editMode) {
    chopper.setKitName(sourceName.replace(/\.wav$/i, '').toUpperCase().slice(0, 12));
  }

  // Play a specific slice
  const handlePlaySlice = useCallback(
    (index: number) => {
      if (!samples || !chopper.currentSliceResult) return;
      const slice = chopper.currentSliceResult.slices[index];
      if (!slice) return;

      if (isPlaying && chopper.selectedSlice === index) {
        stop();
        return;
      }

      chopper.setSelectedSlice(index);
      play(samples, slice.startSample, slice.endSample);
    },
    [samples, chopper.currentSliceResult, isPlaying, chopper.selectedSlice, play, stop, chopper.setSelectedSlice]
  );

  // Play all slices (full audio)
  const handlePlayAll = useCallback(() => {
    if (!samples) return;

    if (isPlaying) {
      stop();
      return;
    }

    play(samples);
  }, [samples, isPlaying, play, stop]);

  // Handle create/update kit
  const handleCreateKit = useCallback(() => {
    if (!chopper.currentSliceResult || chopper.currentSliceResult.slices.length === 0 || !samples) return;

    const labels = chopper.kitLabels.split(',').map((s) => s.trim());

    const sliceDefinitions: SliceDefinitionOutput[] =
      chopper.selectedMethod === 'manual' || chopper.selectedMethod === 'silence' || chopper.useInitialSlices
        ? chopper.manualSlices
        : chopper.currentSliceResult.slices.map((slice, i) => ({
            label: labels[i % labels.length] ?? `S${i + 1}`,
            startSample: slice.startSample,
            endSample: slice.endSample,
          }));

    if (editMode && onSlicesUpdated) {
      onSlicesUpdated(sliceDefinitions, {
        transpose: chopper.kitTranspose,
        velocitySensitivity: chopper.kitVelocitySensitivity,
      });
      onOpenChange(false);
    } else {
      const kit = slicesToDrumKit(chopper.currentSliceResult, {
        name: chopper.kitName || 'DRUM-KIT',
        sampleRate: chopper.kitSampleRate,
        baseNote: chopper.kitBaseNote,
        drumTypes: labels.length > 0 ? labels : undefined,
        transpose: chopper.kitTranspose !== 0 ? chopper.kitTranspose : undefined,
        velocitySensitivity: chopper.kitVelocitySensitivity,
      });

      onKitCreated(kit, sliceDefinitions, { samples, sampleRate });
      onOpenChange(false);
    }
  }, [
    chopper.currentSliceResult, samples, chopper.kitName, chopper.kitSampleRate,
    chopper.kitBaseNote, chopper.kitLabels, chopper.kitTranspose, chopper.kitVelocitySensitivity,
    sampleRate, chopper.selectedMethod, chopper.useInitialSlices, chopper.manualSlices,
    editMode, onKitCreated, onSlicesUpdated, onOpenChange,
  ]);

  // Handle keyboard shortcuts at dialog level
  const handleDialogKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        event.stopPropagation();
        chopper.handleZoomIn();
        return;
      }
      if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        event.stopPropagation();
        chopper.handleZoomOut();
        return;
      }
      if (event.key === '0') {
        event.preventDefault();
        event.stopPropagation();
        chopper.handleZoomReset();
        return;
      }
      if (event.key === 'f' || event.key === 'F' || event.key === 'F11') {
        event.preventDefault();
        event.stopPropagation();
        chopper.setIsFullscreen((prev) => !prev);
        return;
      }
      if (event.key === 'Escape' && chopper.isFullscreen) {
        event.preventDefault();
        event.stopPropagation();
        chopper.setIsFullscreen(false);
        return;
      }
      if (event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        if (chopper.selectedSlice !== undefined) {
          handlePlaySlice(chopper.selectedSlice);
        } else {
          handlePlayAll();
        }
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && chopper.selectedMethod === 'manual' && chopper.selectedSlice !== undefined) {
        event.preventDefault();
        event.stopPropagation();
        chopper.handleSliceDelete(chopper.selectedSlice);
        return;
      }
      if (event.key === 'ArrowLeft' && chopper.currentSliceResult && chopper.currentSliceResult.slices.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        const newIndex = chopper.selectedSlice !== undefined
          ? Math.max(0, chopper.selectedSlice - 1)
          : chopper.currentSliceResult.slices.length - 1;
        chopper.setSelectedSlice(newIndex);
        return;
      }
      if (event.key === 'ArrowRight' && chopper.currentSliceResult && chopper.currentSliceResult.slices.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        const newIndex = chopper.selectedSlice !== undefined
          ? Math.min(chopper.currentSliceResult.slices.length - 1, chopper.selectedSlice + 1)
          : 0;
        chopper.setSelectedSlice(newIndex);
        return;
      }
    },
    [chopper, handlePlaySlice, handlePlayAll]
  );

  // Waveform height based on fullscreen mode
  const waveformHeight = chopper.isFullscreen ? 400 : 140;

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content
          className={cn(
            'fixed z-50 bg-s330-panel border border-s330-accent rounded-lg shadow-xl overflow-hidden flex flex-col',
            chopper.isFullscreen
              ? 'inset-4'
              : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl max-h-[90vh]'
          )}
          onKeyDown={handleDialogKeyDown}
          data-slice-editor-open="true"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-s330-accent shrink-0">
            <div>
              <Dialog.Title className="text-lg font-bold text-s330-text">
                {editMode ? 'Edit Kit' : 'Chop Sample'}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-s330-muted">
                {editMode
                  ? `Edit slices and playback settings for "${sourceName}"`
                  : `Slice "${sourceName}" into individual drum hits`}
                {chopper.durationMs > 0 && ` (${chopper.durationMs.toFixed(0)}ms)`}
              </Dialog.Description>
            </div>
            <div className="flex items-center gap-2">
              {/* Fullscreen toggle */}
              <button
                onClick={() => chopper.setIsFullscreen((prev) => !prev)}
                className="p-2 text-s330-muted hover:text-s330-text transition-colors"
                title={chopper.isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
              >
                {chopper.isFullscreen ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                )}
              </button>
              {/* Close button */}
              <Dialog.Close asChild>
                <button
                  className="p-2 text-s330-muted hover:text-s330-text transition-colors"
                  aria-label="Close"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Content - scrollable */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {/* Waveform Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-s330-muted uppercase tracking-wide">
                    Waveform & Slice Preview
                  </div>
                  <div className="flex items-center gap-3">
                    {chopper.isManualMode && !chopper.stripSilenceActive && (
                      <div className="text-xs text-s330-muted">
                        Drag edges to adjust • Double-click to split • Delete to remove
                      </div>
                    )}
                    {chopper.stripSilenceActive && (
                      <div className="text-xs text-s330-highlight">
                        Strip Silence Preview - Adjust threshold below
                      </div>
                    )}
                    {/* Joined edges toggle */}
                    {chopper.isManualMode && !chopper.stripSilenceActive && (
                      <button
                        onClick={() => chopper.setJoinedEdges((prev) => !prev)}
                        className={cn(
                          'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors',
                          chopper.joinedEdges
                            ? 'bg-s330-highlight/20 text-s330-highlight'
                            : 'bg-s330-bg text-s330-muted hover:text-s330-text'
                        )}
                        title={chopper.joinedEdges ? 'Joined edges: ON - Adjacent boundaries move together' : 'Joined edges: OFF - Move boundaries independently'}
                      >
                        {/* Chain link icon */}
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        {chopper.joinedEdges ? 'Joined' : 'Split'}
                      </button>
                    )}
                    {/* Play controls */}
                    <div className="flex items-center gap-1 bg-s330-bg rounded px-2 py-1">
                      <button
                        onClick={() => chopper.selectedSlice !== undefined ? handlePlaySlice(chopper.selectedSlice) : handlePlayAll()}
                        className={cn(
                          'p-1 transition-colors',
                          isPlaying
                            ? 'text-red-400 hover:text-red-300'
                            : 'text-s330-muted hover:text-s330-text'
                        )}
                        title={isPlaying ? 'Stop (Space)' : chopper.selectedSlice !== undefined ? 'Play selected slice (Space)' : 'Play all (Space)'}
                      >
                        {isPlaying ? (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <rect x="6" y="5" width="4" height="14" rx="1" />
                            <rect x="14" y="5" width="4" height="14" rx="1" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {/* Zoom controls */}
                    <div className="flex items-center gap-1 bg-s330-bg rounded px-2 py-1">
                      <button
                        onClick={chopper.handleZoomOut}
                        disabled={chopper.zoom <= MIN_ZOOM}
                        className={cn(
                          'p-1 text-s330-muted hover:text-s330-text transition-colors',
                          chopper.zoom <= MIN_ZOOM && 'opacity-30 cursor-not-allowed'
                        )}
                        title="Zoom out (-)"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                        </svg>
                      </button>
                      <button
                        onClick={chopper.handleZoomReset}
                        className="px-2 text-xs text-s330-muted hover:text-s330-text transition-colors min-w-[3rem]"
                        title="Reset zoom (0)"
                      >
                        {chopper.zoom > 1 ? `${chopper.zoom.toFixed(1)}×` : 'Fit'}
                      </button>
                      <button
                        onClick={chopper.handleZoomIn}
                        disabled={chopper.zoom >= MAX_ZOOM}
                        className={cn(
                          'p-1 text-s330-muted hover:text-s330-text transition-colors',
                          chopper.zoom >= MAX_ZOOM && 'opacity-30 cursor-not-allowed'
                        )}
                        title="Zoom in (+)"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                <WaveformEditor
                  samples={samples}
                  sampleRate={sampleRate}
                  sliceMarkers={chopper.sliceMarkers}
                  selectedSlice={chopper.selectedSlice}
                  onSliceClick={chopper.setSelectedSlice}
                  height={waveformHeight}
                  editable={chopper.isManualMode && !chopper.stripSilenceActive}
                  onSliceChange={chopper.isManualMode && !chopper.stripSilenceActive ? chopper.handleSliceChange : undefined}
                  onSlicesChange={chopper.isManualMode && !chopper.stripSilenceActive ? chopper.handleSlicesChange : undefined}
                  onSliceAdd={chopper.isManualMode && !chopper.stripSilenceActive ? chopper.handleSliceAdd : undefined}
                  onSliceDelete={chopper.isManualMode && !chopper.stripSilenceActive ? chopper.handleSliceDelete : undefined}
                  zoom={chopper.zoom}
                  onZoomChange={chopper.setZoom}
                  joinedEdges={chopper.isManualMode && chopper.joinedEdges && !chopper.stripSilenceActive}
                  playbackPosition={playbackPosition}
                />
                {chopper.currentSliceResult && (
                  <div className="flex items-center justify-between text-xs text-s330-muted">
                    <span>
                      {chopper.currentSliceResult.slices.length} slice
                      {chopper.currentSliceResult.slices.length !== 1 ? 's' : ''}
                      {chopper.selectedSlice !== undefined && chopper.currentSliceResult.slices[chopper.selectedSlice] && (
                        <span className="ml-2 text-s330-text">
                          • Selected: {chopper.currentSliceResult.slices[chopper.selectedSlice]?.durationMs.toFixed(0)}ms
                        </span>
                      )}
                    </span>
                    {!chopper.isManualMode && chopper.autoSliceResult && chopper.autoSliceResult.slices.length > 0 && (
                      <button
                        onClick={chopper.handleSwitchToManual}
                        className="text-s330-highlight hover:underline"
                      >
                        Edit manually
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Slice Method Tabs */}
              <Tabs.Root
                value={chopper.selectedMethod}
                onValueChange={(v) => chopper.handleMethodChange(v as SliceMethodTab)}
              >
                <Tabs.List className="flex border-b border-s330-accent/30 mb-4">
                  <Tabs.Trigger
                    value="manual"
                    className={cn(
                      'px-4 py-2 text-sm border-b-2 -mb-px transition-colors',
                      chopper.selectedMethod === 'manual'
                        ? 'border-s330-highlight text-s330-text'
                        : 'border-transparent text-s330-muted hover:text-s330-text'
                    )}
                  >
                    Manual
                  </Tabs.Trigger>
                  <Tabs.Trigger
                    value="transient"
                    className={cn(
                      'px-4 py-2 text-sm border-b-2 -mb-px transition-colors',
                      chopper.selectedMethod === 'transient'
                        ? 'border-s330-highlight text-s330-text'
                        : 'border-transparent text-s330-muted hover:text-s330-text'
                    )}
                  >
                    Transient
                  </Tabs.Trigger>
                  <Tabs.Trigger
                    value="silence"
                    className={cn(
                      'px-4 py-2 text-sm border-b-2 -mb-px transition-colors',
                      chopper.selectedMethod === 'silence'
                        ? 'border-s330-highlight text-s330-text'
                        : 'border-transparent text-s330-muted hover:text-s330-text'
                    )}
                  >
                    Strip Silence
                  </Tabs.Trigger>
                  <Tabs.Trigger
                    value="fixed"
                    className={cn(
                      'px-4 py-2 text-sm border-b-2 -mb-px transition-colors',
                      chopper.selectedMethod === 'fixed'
                        ? 'border-s330-highlight text-s330-text'
                        : 'border-transparent text-s330-muted hover:text-s330-text'
                    )}
                  >
                    Fixed
                  </Tabs.Trigger>
                </Tabs.List>

                {/* Manual Mode Controls */}
                <Tabs.Content value="manual" className="space-y-3">
                  <p className="text-xs text-s330-muted">
                    Double-click on a slice to split it. Drag slice edges to adjust boundaries.
                    Use +/- to zoom for fine adjustments.
                  </p>

                  {/* Slice List */}
                  {chopper.manualSlices.length > 0 && (
                    <div className="bg-s330-bg rounded p-3 space-y-2 max-h-32 overflow-y-auto">
                      <div className="text-xs text-s330-muted uppercase tracking-wide mb-2">
                        Slices ({chopper.manualSlices.length})
                      </div>
                      {chopper.manualSlices.map((slice, i) => (
                        <div
                          key={i}
                          className={cn(
                            'flex items-center gap-2 text-xs py-1 px-2 rounded cursor-pointer',
                            chopper.selectedSlice === i
                              ? 'bg-s330-highlight/20 text-s330-text'
                              : 'hover:bg-s330-accent/20 text-s330-muted'
                          )}
                          onClick={() => chopper.setSelectedSlice(i)}
                        >
                          {/* Play button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlaySlice(i);
                            }}
                            className={cn(
                              'p-0.5 rounded transition-colors',
                              isPlaying && chopper.selectedSlice === i
                                ? 'text-red-400 hover:text-red-300'
                                : 'text-s330-muted hover:text-s330-text'
                            )}
                            title={isPlaying && chopper.selectedSlice === i ? 'Stop' : 'Play slice'}
                          >
                            {isPlaying && chopper.selectedSlice === i ? (
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                <rect x="6" y="5" width="4" height="14" rx="1" />
                                <rect x="14" y="5" width="4" height="14" rx="1" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            )}
                          </button>
                          <span className="font-medium flex-1">{slice.label}</span>
                          <span className="text-s330-muted">
                            {((slice.endSample - slice.startSample) / sampleRate * 1000).toFixed(0)}ms
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              chopper.handleSliceDelete(i);
                            }}
                            disabled={chopper.manualSlices.length <= 1}
                            className={cn(
                              'text-red-400 hover:text-red-300 px-1',
                              chopper.manualSlices.length <= 1 && 'opacity-30 cursor-not-allowed'
                            )}
                            title="Delete slice"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {chopper.manualSlices.length === 0 && (
                    <div className="text-sm text-s330-muted text-center py-4">
                      Click on the waveform to add slice points
                    </div>
                  )}
                </Tabs.Content>

                {/* Transient Detection Controls */}
                <Tabs.Content value="transient" className="space-y-3">
                  <p className="text-xs text-s330-muted">
                    Detect drum hits by amplitude spikes above a threshold.
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-s330-muted mb-1">
                        Threshold ({(chopper.transientThreshold * 100).toFixed(0)}%)
                      </label>
                      <input
                        type="range"
                        min="0.05"
                        max="0.9"
                        step="0.05"
                        value={chopper.transientThreshold}
                        onChange={(e) => chopper.setTransientThreshold(parseFloat(e.target.value))}
                        className="w-full accent-s330-highlight"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-s330-muted mb-1">
                        Min Gap (ms)
                      </label>
                      <input
                        type="number"
                        min="10"
                        max="1000"
                        step="10"
                        value={chopper.transientMinGap}
                        onChange={(e) => chopper.setTransientMinGap(parseInt(e.target.value) || 100)}
                        className="w-full bg-s330-bg border border-s330-accent/50 rounded px-2 py-1 text-sm text-s330-text"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-s330-muted mb-1">
                        Pre-pad (ms)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="5"
                        value={chopper.transientPrePad}
                        onChange={(e) => chopper.setTransientPrePad(parseInt(e.target.value) || 0)}
                        className="w-full bg-s330-bg border border-s330-accent/50 rounded px-2 py-1 text-sm text-s330-text"
                      />
                    </div>
                  </div>
                </Tabs.Content>

                {/* Strip Silence Controls */}
                <Tabs.Content value="silence" className="space-y-3">
                  {chopper.manualSlices.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-s330-muted mb-2">
                        No slices to strip silence from.
                      </p>
                      <p className="text-xs text-s330-muted">
                        Use Manual, Transient, or Fixed tabs to create slices first.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-s330-muted">
                        Remove silence from the beginning and end of each slice.
                        Adjust threshold to preview changes live on the waveform.
                      </p>

                      <div>
                        <label className="block text-xs text-s330-muted mb-1">
                          Threshold: {chopper.stripSilenceThreshold} dB
                        </label>
                        <input
                          type="range"
                          min="-60"
                          max="-10"
                          step="1"
                          value={chopper.stripSilenceThreshold}
                          onChange={(e) => chopper.setStripSilenceThreshold(parseInt(e.target.value))}
                          className="w-full accent-s330-highlight"
                        />
                        <div className="flex justify-between text-xs text-s330-muted mt-0.5">
                          <span>-60 dB (quieter)</span>
                          <span>-10 dB (louder)</span>
                        </div>
                      </div>

                      {/* Stats about what will change */}
                      {chopper.strippedPreview && (
                        <div className="text-xs text-s330-muted bg-s330-bg rounded p-2">
                          <span className="font-medium text-s330-text">
                            {chopper.strippedPreview.filter((p, i) =>
                              p.startSample !== chopper.originalSliceBoundaries[i]?.startSample ||
                              p.endSample !== chopper.originalSliceBoundaries[i]?.endSample
                            ).length}
                          </span>
                          {' '}of {chopper.manualSlices.length} slices will be trimmed
                        </div>
                      )}

                      {/* Apply/Reset buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={chopper.handleCancelStripSilence}
                          className="flex-1 px-3 py-1.5 text-xs rounded bg-s330-bg hover:bg-s330-accent/50 text-s330-muted transition-colors"
                        >
                          Reset
                        </button>
                        <button
                          onClick={chopper.handleApplyStripSilence}
                          className="flex-1 px-3 py-1.5 text-xs rounded bg-s330-highlight hover:bg-s330-highlight/80 text-white font-medium transition-colors"
                        >
                          Apply Strip
                        </button>
                      </div>
                    </div>
                  )}
                </Tabs.Content>

                {/* Fixed Interval Controls */}
                <Tabs.Content value="fixed" className="space-y-3">
                  <p className="text-xs text-s330-muted">
                    Split at regular time intervals (for metronome-recorded hits).
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-s330-muted mb-1">
                        Interval (ms)
                      </label>
                      <input
                        type="number"
                        min="50"
                        max="5000"
                        step="50"
                        value={chopper.fixedInterval}
                        onChange={(e) => chopper.setFixedInterval(parseInt(e.target.value) || 500)}
                        className="w-full bg-s330-bg border border-s330-accent/50 rounded px-2 py-1 text-sm text-s330-text"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-s330-muted mb-1">
                        Expected Count (optional)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="32"
                        step="1"
                        value={chopper.fixedCount ?? ''}
                        onChange={(e) =>
                          chopper.setFixedCount(e.target.value ? parseInt(e.target.value) : undefined)
                        }
                        placeholder="auto"
                        className="w-full bg-s330-bg border border-s330-accent/50 rounded px-2 py-1 text-sm text-s330-text"
                      />
                    </div>
                  </div>
                </Tabs.Content>
              </Tabs.Root>

              {/* Error Display */}
              {chopper.sliceError && (
                <div className="text-sm text-red-400 bg-red-900/20 rounded p-2">
                  {chopper.sliceError}
                </div>
              )}

              {/* Kit Configuration - only show in create mode */}
              {!editMode && (
                <div className="bg-s330-bg rounded p-3 space-y-3">
                  <div className="text-xs text-s330-muted uppercase tracking-wide">
                    Drum Kit Output
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-s330-muted mb-1">
                        Kit Name (max 12 chars)
                      </label>
                      <input
                        type="text"
                        maxLength={12}
                        value={chopper.kitName}
                        onChange={(e) => chopper.setKitName(e.target.value.toUpperCase())}
                        placeholder="DRUM-KIT"
                        className="w-full bg-s330-panel border border-s330-accent/50 rounded px-2 py-1 text-sm text-s330-text uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-s330-muted mb-1">
                        Sample Rate
                      </label>
                      <select
                        value={chopper.kitSampleRate}
                        onChange={(e) =>
                          chopper.setKitSampleRate(parseInt(e.target.value) as 15000 | 30000)
                        }
                        className="w-full bg-s330-panel border border-s330-accent/50 rounded px-2 py-1 text-sm text-s330-text"
                      >
                        <option value={15000}>15 kHz</option>
                        <option value={30000}>30 kHz</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-s330-muted mb-1">
                        Base MIDI Note
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="120"
                        value={chopper.kitBaseNote}
                        onChange={(e) => chopper.setKitBaseNote(parseInt(e.target.value) || 36)}
                        className="w-full bg-s330-panel border border-s330-accent/50 rounded px-2 py-1 text-sm text-s330-text"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-s330-muted mb-1">
                        Labels (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={chopper.kitLabels}
                        onChange={(e) => chopper.setKitLabels(e.target.value)}
                        placeholder="kick,snare,hhc,hho"
                        className="w-full bg-s330-panel border border-s330-accent/50 rounded px-2 py-1 text-sm text-s330-text"
                      />
                    </div>
                  </div>
                  {/* Transpose control */}
                  <div>
                    <label className="block text-xs text-s330-muted mb-1">
                      Pitch Adjust (semitones: {chopper.kitTranspose > 0 ? '+' : ''}
                      {chopper.kitTranspose})
                    </label>
                    <input
                      type="range"
                      min="-24"
                      max="24"
                      step="1"
                      value={chopper.kitTranspose}
                      onChange={(e) => chopper.setKitTranspose(parseInt(e.target.value))}
                      className="w-full accent-s330-highlight"
                    />
                    <div className="flex justify-between text-xs text-s330-muted mt-1">
                      <span>-2 oct</span>
                      <button
                        onClick={() => chopper.setKitTranspose(0)}
                        className="text-s330-highlight hover:underline"
                      >
                        Reset
                      </button>
                      <span>+2 oct</span>
                    </div>
                    <p className="text-xs text-s330-muted mt-1">
                      Use to pitch down samples recorded at high speed.
                    </p>
                  </div>
                  {/* Velocity Sensitivity control */}
                  <div>
                    <label className="block text-xs text-s330-muted mb-1">
                      Velocity Sensitivity: {chopper.kitVelocitySensitivity}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="1"
                      value={chopper.kitVelocitySensitivity}
                      onChange={(e) => chopper.setKitVelocitySensitivity(parseInt(e.target.value))}
                      className="w-full accent-s330-highlight"
                    />
                    <div className="flex justify-between text-xs text-s330-muted mt-1">
                      <span>None</span>
                      <span>Max</span>
                    </div>
                    <p className="text-xs text-s330-muted mt-1">
                      How much MIDI velocity affects sample volume.
                    </p>
                  </div>
                </div>
              )}

              {/* Playback Settings - show in edit mode */}
              {editMode && (
                <div className="bg-s330-bg rounded p-3 space-y-3">
                  <div className="text-xs text-s330-muted uppercase tracking-wide">
                    Playback Settings
                  </div>
                  {/* Transpose control */}
                  <div>
                    <label className="block text-xs text-s330-muted mb-1">
                      Pitch Adjust (semitones: {chopper.kitTranspose > 0 ? '+' : ''}
                      {chopper.kitTranspose})
                    </label>
                    <input
                      type="range"
                      min="-24"
                      max="24"
                      step="1"
                      value={chopper.kitTranspose}
                      onChange={(e) => chopper.setKitTranspose(parseInt(e.target.value))}
                      className="w-full accent-s330-highlight"
                    />
                    <div className="flex justify-between text-xs text-s330-muted mt-1">
                      <span>-2 oct</span>
                      <button
                        onClick={() => chopper.setKitTranspose(0)}
                        className="text-s330-highlight hover:underline"
                      >
                        Reset
                      </button>
                      <span>+2 oct</span>
                    </div>
                    <p className="text-xs text-s330-muted mt-1">
                      Use to pitch down samples recorded at high speed.
                    </p>
                  </div>
                  {/* Velocity Sensitivity control */}
                  <div>
                    <label className="block text-xs text-s330-muted mb-1">
                      Velocity Sensitivity: {chopper.kitVelocitySensitivity}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="1"
                      value={chopper.kitVelocitySensitivity}
                      onChange={(e) => chopper.setKitVelocitySensitivity(parseInt(e.target.value))}
                      className="w-full accent-s330-highlight"
                    />
                    <div className="flex justify-between text-xs text-s330-muted mt-1">
                      <span>None</span>
                      <span>Max</span>
                    </div>
                    <p className="text-xs text-s330-muted mt-1">
                      How much MIDI velocity affects sample volume.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer - fixed at bottom */}
          <div className="flex justify-between items-center gap-2 p-4 border-t border-s330-accent shrink-0 bg-s330-panel">
            <div className="text-xs text-s330-muted">
              Space play • ←→ navigate • +/- zoom • F fullscreen
            </div>
            <div className="flex gap-2">
              <button onClick={handleClose} className="ac-btn ac-btn-ghost">
                Cancel
              </button>
              <button
                onClick={handleCreateKit}
                disabled={!chopper.currentSliceResult || chopper.currentSliceResult.slices.length === 0}
                className={cn(
                  'ac-btn ac-btn-primary',
                  (!chopper.currentSliceResult || chopper.currentSliceResult.slices.length === 0) &&
                    'opacity-50 cursor-not-allowed'
                )}
              >
                {editMode
                  ? `Save Changes (${chopper.currentSliceResult?.slices.length ?? 0} slices)`
                  : `Create Drum Kit (${chopper.currentSliceResult?.slices.length ?? 0} samples)`}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
