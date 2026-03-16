/**
 * Sample Chopper Dialog
 *
 * Generic dialog for slicing audio samples into regions.
 * Device-specific output configuration is provided via the renderOutputConfig render prop.
 *
 * Features:
 * - Fullscreen mode for detailed waveform editing
 * - Horizontal zoom (+/- keys) for fine-grained slice adjustment
 * - Multiple detection methods: transient, silence, fixed interval
 * - Manual slice editing with drag-to-adjust
 * - Audio preview for slices (Space to play selected)
 */

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/ui/utils.js';
import { WaveformEditor } from './WaveformEditor.js';
import { SliceMethodPanel } from './SliceMethodPanel.js';
import { SliceList } from './SliceList.js';
import { useAudioPreview } from '@/ui/hooks/useAudioPreview.js';
import {
  useSampleChopper,
  MIN_ZOOM,
  MAX_ZOOM,
  type SliceMethodTab,
  type SliceDefinitionOutput,
  type InitialSliceDefinition,
} from '@/ui/hooks/useSampleChopper.js';
import type { SliceResult } from '@/types.js';
import { useTriggerRecording } from '@/ui/hooks/useTriggerRecording.js';

// Re-export types for consumers
export type { SliceDefinitionOutput, InitialSliceDefinition };

/** State passed to the renderOutputConfig render prop. */
export interface ChopperOutputState {
  sliceDefinitions: SliceDefinitionOutput[];
  currentSliceResult: SliceResult | null;
  labels: string;
  onLabelsChange: (labels: string) => void;
}

/** Result passed to onConfirm callback. */
export interface ChopperResult {
  sliceDefinitions: SliceDefinitionOutput[];
  sourceAudio: { samples: Int16Array; sampleRate: number };
}

export interface SampleChopperDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onOpenChange: (open: boolean) => void;
  /** Audio samples to chop (16-bit signed integers) */
  samples: Int16Array | null;
  /** Sample rate of the audio in Hz */
  sampleRate: number;
  /** Source file name (for display) */
  sourceName: string;
  /** Callback when slicing is confirmed */
  onConfirm: (result: ChopperResult) => void;
  /** Render prop for device-specific output configuration */
  renderOutputConfig?: (state: ChopperOutputState) => ReactNode;
  /** Edit mode: pre-populate with existing slices */
  editMode?: boolean;
  /** Initial slice definitions for edit mode */
  initialSlices?: InitialSliceDefinition[];
  /** Initial labels (comma-separated) */
  initialLabels?: string;
  /** Callback when slices are updated (edit mode) */
  onSlicesUpdated?: (slices: SliceDefinitionOutput[]) => void;
}

export function SampleChopperDialog({
  open,
  onOpenChange,
  samples,
  sampleRate,
  sourceName,
  onConfirm,
  renderOutputConfig,
  editMode = false,
  initialSlices,
  initialLabels,
  onSlicesUpdated,
}: SampleChopperDialogProps): JSX.Element {
  const chopper = useSampleChopper({
    samples,
    sampleRate,
    open,
    editMode,
    initialSlices,
    labels: initialLabels,
  });

  const { play, stop, isPlaying, playbackPosition, playbackPositionRef } = useAudioPreview({ sampleRate });

  const handlePlayAll = useCallback(() => {
    if (!samples) return;
    if (isPlaying) { stop(); return; }
    play(samples);
  }, [samples, isPlaying, play, stop]);

  const samplesRef = useRef(samples);
  samplesRef.current = samples;

  const handleTriggerPlay = useCallback(() => {
    if (samplesRef.current) play(samplesRef.current);
  }, [play]);

  const trigger = useTriggerRecording({
    playbackPositionRef,
    isPlaying,
    onPlay: handleTriggerPlay,
    onStop: stop,
    totalSamples: samples?.length ?? 0,
    kitLabels: chopper.kitLabels,
  });

  // Inject slices into chopper in real time during recording and on completion
  useEffect(() => {
    if ((trigger.state === 'recording' || trigger.state === 'complete') && trigger.recordedSlices.length > 0) {
      chopper.setManualSlices(trigger.recordedSlices);
    }
  }, [trigger.state, trigger.recordedSlices, chopper.setManualSlices]);

  const handleSwitchToManualFromTrigger = useCallback(() => {
    // Slices are already injected; just switch tab
    chopper.handleMethodChange('manual');
  }, [chopper.handleMethodChange]);

  const handleClose = useCallback(() => {
    stop();
    onOpenChange(false);
  }, [onOpenChange, stop]);

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

  const handleConfirm = useCallback(() => {
    if (!chopper.currentSliceResult || chopper.currentSliceResult.slices.length === 0 || !samples) return;

    const labels = chopper.kitLabels.split(',').map((s: string) => s.trim());

    const sliceDefinitions: SliceDefinitionOutput[] =
      chopper.selectedMethod === 'manual' || chopper.selectedMethod === 'trigger' || chopper.selectedMethod === 'silence' || chopper.useInitialSlices
        ? chopper.manualSlices
        : chopper.currentSliceResult.slices.map((slice, i) => ({
            label: labels[i % labels.length] ?? `S${i + 1}`,
            startSample: slice.startSample,
            endSample: slice.endSample,
          }));

    if (editMode && onSlicesUpdated) {
      onSlicesUpdated(sliceDefinitions);
      onOpenChange(false);
    } else {
      onConfirm({
        sliceDefinitions,
        sourceAudio: { samples, sampleRate },
      });
      onOpenChange(false);
    }
  }, [
    chopper.currentSliceResult, samples, chopper.kitLabels,
    chopper.selectedMethod, chopper.useInitialSlices, chopper.manualSlices,
    sampleRate, editMode, onConfirm, onSlicesUpdated, onOpenChange,
  ]);

  const handleDialogKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      // Yield keyboard to trigger system when armed or recording
      if (chopper.selectedMethod === 'trigger' && (trigger.state === 'armed' || trigger.state === 'recording')) {
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
    [chopper, trigger.state, handlePlaySlice, handlePlayAll]
  );

  const waveformHeight = chopper.isFullscreen ? 400 : 140;

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content
          className={cn(
            'fixed z-50 bg-ac-panel border border-ac-accent rounded-lg shadow-xl overflow-hidden flex flex-col',
            chopper.isFullscreen
              ? 'inset-4'
              : 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl max-h-[90vh]'
          )}
          onKeyDown={handleDialogKeyDown}
          data-slice-editor-open="true"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-ac-accent shrink-0">
            <div>
              <Dialog.Title className="text-lg font-bold text-ac-text">
                {editMode ? 'Edit Slices' : 'Chop Sample'}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-ac-muted">
                {editMode
                  ? `Edit slices for "${sourceName}"`
                  : `Slice "${sourceName}" into individual regions`}
                {chopper.durationMs > 0 && ` (${chopper.durationMs.toFixed(0)}ms)`}
              </Dialog.Description>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => chopper.setIsFullscreen((prev) => !prev)}
                className="p-2 text-ac-muted hover:text-ac-text transition-colors"
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
              <Dialog.Close asChild>
                <button
                  className="p-2 text-ac-muted hover:text-ac-text transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
                  <div className="text-xs text-ac-muted uppercase tracking-wide">
                    Waveform & Slice Preview
                  </div>
                  <div className="flex items-center gap-3">
                    {chopper.isManualMode && !chopper.stripSilenceActive && (
                      <div className="text-xs text-ac-muted">
                        Drag edges to adjust • Double-click to split • Delete to remove
                      </div>
                    )}
                    {chopper.stripSilenceActive && (
                      <div className="text-xs text-ac-highlight">
                        Strip Silence Preview - Adjust threshold below
                      </div>
                    )}
                    {chopper.isManualMode && !chopper.stripSilenceActive && (
                      <button
                        onClick={() => chopper.setJoinedEdges((prev) => !prev)}
                        className={cn(
                          'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors',
                          chopper.joinedEdges
                            ? 'bg-ac-highlight/20 text-ac-highlight'
                            : 'bg-ac-bg text-ac-muted hover:text-ac-text'
                        )}
                        title={chopper.joinedEdges ? 'Joined edges: ON' : 'Joined edges: OFF'}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        {chopper.joinedEdges ? 'Joined' : 'Split'}
                      </button>
                    )}
                    {/* Play controls */}
                    <div className="flex items-center gap-1 bg-ac-bg rounded px-2 py-1">
                      <button
                        onClick={() => chopper.selectedSlice !== undefined ? handlePlaySlice(chopper.selectedSlice) : handlePlayAll()}
                        className={cn(
                          'p-1 transition-colors',
                          isPlaying
                            ? 'text-red-400 hover:text-red-300'
                            : 'text-ac-muted hover:text-ac-text'
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
                    <div className="flex items-center gap-1 bg-ac-bg rounded px-2 py-1">
                      <button
                        onClick={chopper.handleZoomOut}
                        disabled={chopper.zoom <= MIN_ZOOM}
                        className={cn(
                          'p-1 text-ac-muted hover:text-ac-text transition-colors',
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
                        className="px-2 text-xs text-ac-muted hover:text-ac-text transition-colors min-w-[3rem]"
                        title="Reset zoom (0)"
                      >
                        {chopper.zoom > 1 ? `${chopper.zoom.toFixed(1)}×` : 'Fit'}
                      </button>
                      <button
                        onClick={chopper.handleZoomIn}
                        disabled={chopper.zoom >= MAX_ZOOM}
                        className={cn(
                          'p-1 text-ac-muted hover:text-ac-text transition-colors',
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
                  <div className="flex items-center justify-between text-xs text-ac-muted">
                    <span>
                      {chopper.currentSliceResult.slices.length} slice
                      {chopper.currentSliceResult.slices.length !== 1 ? 's' : ''}
                      {chopper.selectedSlice !== undefined && chopper.currentSliceResult.slices[chopper.selectedSlice] && (
                        <span className="ml-2 text-ac-text">
                          • Selected: {chopper.currentSliceResult.slices[chopper.selectedSlice]?.durationMs.toFixed(0)}ms
                        </span>
                      )}
                    </span>
                    {!chopper.isManualMode && chopper.autoSliceResult && chopper.autoSliceResult.slices.length > 0 && (
                      <button
                        onClick={chopper.handleSwitchToManual}
                        className="text-ac-highlight hover:underline"
                      >
                        Edit manually
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Slice Method Tabs */}
              <SliceMethodPanel
                selectedMethod={chopper.selectedMethod}
                onMethodChange={chopper.handleMethodChange}
                transientThreshold={chopper.transientThreshold}
                onTransientThresholdChange={chopper.setTransientThreshold}
                transientMinGap={chopper.transientMinGap}
                onTransientMinGapChange={chopper.setTransientMinGap}
                transientPrePad={chopper.transientPrePad}
                onTransientPrePadChange={chopper.setTransientPrePad}
                fixedCount={chopper.fixedCount}
                onFixedCountChange={chopper.setFixedCount}
                stripSilenceThreshold={chopper.stripSilenceThreshold}
                onStripSilenceThresholdChange={chopper.setStripSilenceThreshold}
                stripSilenceActive={chopper.stripSilenceActive}
                strippedPreview={chopper.strippedPreview}
                originalSliceBoundaries={chopper.originalSliceBoundaries}
                onApplyStripSilence={chopper.handleApplyStripSilence}
                onCancelStripSilence={chopper.handleCancelStripSilence}
                manualSlices={chopper.manualSlices}
                triggerProps={{
                  state: trigger.state,
                  midiAvailable: trigger.midiAvailable,
                  triggerCount: trigger.triggerCount,
                  onArm: trigger.arm,
                  onStop: trigger.stopRecording,
                  onReset: trigger.reset,
                  onEditManually: handleSwitchToManualFromTrigger,
                }}
              />

              {/* Slice list — shown in all modes for consistent preview */}
              {chopper.sliceMarkers.length > 0 && (
                <SliceList
                  slices={chopper.manualSlices}
                  selectedSlice={chopper.selectedSlice}
                  sampleRate={sampleRate}
                  isPlaying={isPlaying}
                  onSliceSelect={chopper.setSelectedSlice}
                  onSlicePlay={handlePlaySlice}
                  onSliceDelete={chopper.handleSliceDelete}
                  editable={chopper.isManualMode}
                />
              )}

              {/* Error Display */}
              {chopper.sliceError && (
                <div className="text-sm text-red-400 bg-red-900/20 rounded p-2">
                  {chopper.sliceError}
                </div>
              )}

              {/* Device-specific output config via render prop */}
              {renderOutputConfig && renderOutputConfig({
                sliceDefinitions: chopper.manualSlices,
                currentSliceResult: chopper.currentSliceResult,
                labels: chopper.kitLabels,
                onLabelsChange: chopper.setKitLabels,
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center gap-2 p-4 border-t border-ac-accent shrink-0 bg-ac-panel">
            <div className="text-xs text-ac-muted">
              Space play • ←→ navigate • +/- zoom • F fullscreen
            </div>
            <div className="flex gap-2">
              <button onClick={handleClose} className="ac-btn ac-btn-ghost">
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!chopper.currentSliceResult || chopper.currentSliceResult.slices.length === 0}
                className={cn(
                  'ac-btn ac-btn-primary',
                  (!chopper.currentSliceResult || chopper.currentSliceResult.slices.length === 0) &&
                    'opacity-50 cursor-not-allowed'
                )}
              >
                {editMode
                  ? `Save Changes (${chopper.currentSliceResult?.slices.length ?? 0} slices)`
                  : `Confirm (${chopper.currentSliceResult?.slices.length ?? 0} slices)`}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
