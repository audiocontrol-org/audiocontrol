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

import { useState, useCallback, useMemo, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import {
  sliceAudio,
  slicesToDrumKit,
  analyzeForSlicing,
  DEFAULT_DRUM_TYPES,
  DEFAULT_BASE_NOTE,
  type SliceConfig,
  type SliceResult,
  type ResolvedDrumKitBundle,
} from '@audiocontrol/sampler-library/browser';
import { cn } from '@/lib/utils';
import { WaveformEditor, type SliceMarker, type SliceChange } from './WaveformEditor';
import { useAudioPreview } from '@/hooks/useAudioPreview';

/**
 * Slice definition for deferred chopping.
 */
export interface SliceDefinitionOutput {
  label: string;
  startSample: number;
  endSample: number;
}

/**
 * Initial slice definition for edit mode.
 */
export interface InitialSliceDefinition {
  label: string;
  startSample: number;
  endSample: number;
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

type SliceMethodTab = 'transient' | 'silence' | 'fixed' | 'manual';

/** Default minimum slice size in samples */
const DEFAULT_MIN_SLICE_SAMPLES = 500;

/** Minimum samples to keep after strip silence */
const MIN_SAMPLES_AFTER_STRIP = 100;

/** Zoom limits */
const MIN_ZOOM = 1;
const MAX_ZOOM = 64;
const ZOOM_STEP = 1.5;

/**
 * Find the first sample index where amplitude exceeds threshold.
 * @param samples - Audio samples
 * @param startSample - Start of search range
 * @param endSample - End of search range
 * @param thresholdDb - Threshold in dB (e.g., -40)
 * @returns Sample index or startSample if not found
 */
function findFirstAboveThreshold(
  samples: Int16Array,
  startSample: number,
  endSample: number,
  thresholdDb: number
): number {
  const threshold = Math.pow(10, thresholdDb / 20) * 32768;
  for (let i = startSample; i < endSample; i++) {
    if (Math.abs(samples[i]) >= threshold) {
      return i;
    }
  }
  return startSample;
}

/**
 * Find the last sample index where amplitude exceeds threshold.
 * @param samples - Audio samples
 * @param startSample - Start of search range
 * @param endSample - End of search range
 * @param thresholdDb - Threshold in dB (e.g., -40)
 * @returns Sample index or endSample if not found
 */
function findLastAboveThreshold(
  samples: Int16Array,
  startSample: number,
  endSample: number,
  thresholdDb: number
): number {
  const threshold = Math.pow(10, thresholdDb / 20) * 32768;
  for (let i = endSample - 1; i >= startSample; i--) {
    if (Math.abs(samples[i]) >= threshold) {
      return i + 1; // Return end position (exclusive)
    }
  }
  return endSample;
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
  // Fullscreen mode
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Zoom level
  const [zoom, setZoom] = useState(1);

  // Joined edges mode - adjacent slice boundaries move together
  const [joinedEdges, setJoinedEdges] = useState(true);

  // Strip silence state
  const [stripSilenceThreshold, setStripSilenceThreshold] = useState(-40);
  const [stripSilenceActive, setStripSilenceActive] = useState(false);
  const [originalSliceBoundaries, setOriginalSliceBoundaries] = useState<
    Array<{ startSample: number; endSample: number }>
  >([]);

  // Slice method selection - default to 'manual' in edit mode
  const [selectedMethod, setSelectedMethod] = useState<SliceMethodTab>(
    editMode ? 'manual' : 'transient'
  );

  // Track whether we're using initial slices (edit mode without re-detection)
  const [useInitialSlices, setUseInitialSlices] = useState(editMode && !!initialSlices);

  // Transient detection parameters
  const [transientThreshold, setTransientThreshold] = useState(0.3);
  const [transientMinGap, setTransientMinGap] = useState(100);
  const [transientPrePad, setTransientPrePad] = useState(5);

  // Fixed interval parameters
  const [fixedInterval, setFixedInterval] = useState(500);
  const [fixedCount, setFixedCount] = useState<number | undefined>(undefined);

  // Kit configuration - initialize from initialKitConfig in edit mode
  const [kitName, setKitName] = useState(initialKitConfig?.name ?? '');
  const [kitLabels, setKitLabels] = useState(DEFAULT_DRUM_TYPES.join(','));
  const [kitSampleRate, setKitSampleRate] = useState<15000 | 30000>(
    initialKitConfig?.sampleRate ?? 15000
  );
  const [kitBaseNote, setKitBaseNote] = useState(initialKitConfig?.baseNote ?? DEFAULT_BASE_NOTE);
  const [kitTranspose, setKitTranspose] = useState(initialKitConfig?.transpose ?? 0);
  const [kitVelocitySensitivity, setKitVelocitySensitivity] = useState(
    initialKitConfig?.velocitySensitivity ?? 2
  ); // Default to moderate sensitivity

  // Slice result state (from auto-detection)
  const [autoSliceResult, setAutoSliceResult] = useState<SliceResult | null>(null);
  const [selectedSlice, setSelectedSlice] = useState<number | undefined>(undefined);
  const [sliceError, setSliceError] = useState<string | null>(null);

  // Manual slice state (editable)
  const [manualSlices, setManualSlices] = useState<SliceDefinitionOutput[]>(
    initialSlices?.map((s) => ({ ...s })) ?? []
  );

  // Audio preview
  const { play, stop, isPlaying, playbackPosition } = useAudioPreview({ sampleRate });

  // Reset zoom and stop playback when dialog opens/closes
  useEffect(() => {
    if (open) {
      setZoom(1);
      setIsFullscreen(false);
    } else {
      // Stop playback when dialog closes
      stop();
    }
  }, [open, stop]);

  // Initialize kit name from source (only for new kits)
  useEffect(() => {
    if (open && sourceName && !kitName && !editMode) {
      setKitName(sourceName.replace(/\.wav$/i, '').toUpperCase().slice(0, 12));
    }
  }, [open, sourceName, kitName, editMode]);

  // Initialize from initialKitConfig when opening in edit mode
  useEffect(() => {
    if (open && editMode && initialKitConfig) {
      setKitName(initialKitConfig.name);
      setKitSampleRate(initialKitConfig.sampleRate);
      setKitBaseNote(initialKitConfig.baseNote);
      setKitTranspose(initialKitConfig.transpose ?? 0);
      setKitVelocitySensitivity(initialKitConfig.velocitySensitivity ?? 2);
    }
  }, [open, editMode, initialKitConfig]);

  // Initialize labels from initial slices when in edit mode
  useEffect(() => {
    if (open && editMode && initialSlices && initialSlices.length > 0) {
      const labels = initialSlices.map((s) => s.label);
      setKitLabels(labels.join(','));
      setManualSlices(initialSlices.map((s) => ({ ...s })));
      setUseInitialSlices(true);
    }
  }, [open, editMode, initialSlices]);

  // Analyze audio and suggest parameters when dialog opens
  useEffect(() => {
    if (open && samples && samples.length > 0) {
      const analysis = analyzeForSlicing(samples, sampleRate);
      setTransientThreshold(
        Math.round(analysis.suggestedTransientThreshold * 100) / 100
      );
      setStripSilenceThreshold(analysis.suggestedSilenceThresholdDb);

      // Suggest fixed interval based on duration
      if (analysis.duration.ms >= 1000) {
        const estimatedBeats = Math.round(analysis.duration.ms / 500);
        if (estimatedBeats >= 2 && estimatedBeats <= 16) {
          setFixedInterval(Math.round(analysis.duration.ms / estimatedBeats));
          setFixedCount(estimatedBeats);
        }
      }
    }
  }, [open, samples, sampleRate]);

  // Build slice config based on selected method
  const sliceConfig = useMemo((): SliceConfig => {
    switch (selectedMethod) {
      case 'transient':
        return {
          method: 'transient',
          threshold: transientThreshold,
          minGapMs: transientMinGap,
          prePadMs: transientPrePad,
        };
      case 'fixed':
        return {
          method: 'fixed',
          intervalMs: fixedInterval,
          count: fixedCount,
        };
      case 'manual':
      case 'silence':
        // Manual and silence (strip silence) modes don't use auto-detection
        return {
          method: 'transient',
          threshold: transientThreshold,
          minGapMs: transientMinGap,
          prePadMs: transientPrePad,
        };
    }
  }, [
    selectedMethod,
    transientThreshold,
    transientMinGap,
    transientPrePad,
    fixedInterval,
    fixedCount,
  ]);

  // Perform auto-slicing when config changes (non-manual modes)
  useEffect(() => {
    if (!samples || samples.length === 0) {
      setAutoSliceResult(null);
      return;
    }

    // Skip auto-detection in manual and silence (strip silence) modes
    if (selectedMethod === 'manual' || selectedMethod === 'silence') {
      setAutoSliceResult(null);
      return;
    }

    try {
      const result = sliceAudio(samples, sampleRate, sliceConfig);
      setAutoSliceResult(result);
      setSliceError(null);
      setSelectedSlice(undefined);
      // Sync manual slices from auto-detection for easy switching
      const labels = kitLabels.split(',').map((s) => s.trim());
      setManualSlices(
        result.slices.map((slice, i) => ({
          label: labels[i % labels.length] ?? `S${i + 1}`,
          startSample: slice.startSample,
          endSample: slice.endSample,
        }))
      );
      setUseInitialSlices(false);
    } catch (err) {
      setSliceError(err instanceof Error ? err.message : 'Slicing failed');
      setAutoSliceResult(null);
    }
  }, [samples, sampleRate, sliceConfig, selectedMethod, kitLabels]);

  // Get current slice result (from auto or manual)
  const currentSliceResult = useMemo((): SliceResult | null => {
    if (!samples || samples.length === 0) return null;

    // Manual and silence modes work on manualSlices
    if (selectedMethod === 'manual' || selectedMethod === 'silence' || useInitialSlices) {
      // Build SliceResult from manual slices
      if (manualSlices.length === 0) return null;

      const totalDurationMs = (samples.length / sampleRate) * 1000;
      return {
        slices: manualSlices.map((slice, index) => ({
          index,
          startSample: slice.startSample,
          endSample: slice.endSample,
          samples: samples.slice(slice.startSample, slice.endSample),
          durationMs: ((slice.endSample - slice.startSample) / sampleRate) * 1000,
        })),
        sampleRate,
        totalDurationMs,
      };
    }

    return autoSliceResult;
  }, [samples, sampleRate, selectedMethod, useInitialSlices, manualSlices, autoSliceResult]);

  // Strip silence from a single slice using original boundaries
  const computeStrippedBoundaries = useCallback(
    (
      originalStart: number,
      originalEnd: number,
      threshold: number
    ): { startSample: number; endSample: number } => {
      if (!samples) return { startSample: originalStart, endSample: originalEnd };

      const newStart = findFirstAboveThreshold(samples, originalStart, originalEnd, threshold);
      const newEnd = findLastAboveThreshold(samples, originalStart, originalEnd, threshold);

      // Ensure minimum size - if too small, keep original
      if (newEnd - newStart < MIN_SAMPLES_AFTER_STRIP) {
        return { startSample: originalStart, endSample: originalEnd };
      }

      return { startSample: newStart, endSample: newEnd };
    },
    [samples]
  );

  // Compute preview boundaries when strip silence is active
  const strippedPreview = useMemo(() => {
    if (!stripSilenceActive || originalSliceBoundaries.length === 0) return null;

    return originalSliceBoundaries.map((original) =>
      computeStrippedBoundaries(original.startSample, original.endSample, stripSilenceThreshold)
    );
  }, [stripSilenceActive, originalSliceBoundaries, stripSilenceThreshold, computeStrippedBoundaries]);

  // Convert slices to waveform markers
  // When strip silence is active, show preview boundaries instead
  const sliceMarkers = useMemo((): SliceMarker[] => {
    // Manual and silence modes work on manualSlices
    if (selectedMethod === 'manual' || selectedMethod === 'silence' || useInitialSlices) {
      // If strip silence preview is active, use preview boundaries
      if (stripSilenceActive && strippedPreview) {
        return manualSlices.map((slice, i) => ({
          startSample: strippedPreview[i]?.startSample ?? slice.startSample,
          endSample: strippedPreview[i]?.endSample ?? slice.endSample,
          label: slice.label,
        }));
      }
      return manualSlices.map((slice) => ({
        startSample: slice.startSample,
        endSample: slice.endSample,
        label: slice.label,
      }));
    }

    if (!autoSliceResult) return [];

    const labels = kitLabels.split(',').map((s) => s.trim().toUpperCase());

    return autoSliceResult.slices.map((slice, i) => ({
      startSample: slice.startSample,
      endSample: slice.endSample,
      label: labels[i % labels.length] ?? `${i + 1}`,
    }));
  }, [selectedMethod, useInitialSlices, manualSlices, autoSliceResult, kitLabels, stripSilenceActive, strippedPreview]);

  // Handle slice marker drag (manual mode)
  const handleSliceChange = useCallback(
    (index: number, marker: SliceMarker) => {
      setManualSlices((prev) => {
        const updated = [...prev];
        if (updated[index]) {
          updated[index] = {
            ...updated[index],
            startSample: marker.startSample,
            endSample: marker.endSample,
          };
        }
        return updated;
      });
    },
    []
  );

  // Handle batch slice changes (for joined edges mode)
  const handleSlicesChange = useCallback(
    (changes: SliceChange[]) => {
      setManualSlices((prev) => {
        const updated = [...prev];
        for (const change of changes) {
          if (updated[change.index]) {
            updated[change.index] = {
              ...updated[change.index],
              startSample: change.marker.startSample,
              endSample: change.marker.endSample,
            };
          }
        }
        return updated;
      });
    },
    []
  );

  // Handle adding a new slice point (manual mode)
  const handleSliceAdd = useCallback(
    (samplePosition: number) => {
      if (!samples) return;

      const labels = kitLabels.split(',').map((s) => s.trim());

      setManualSlices((prev) => {
        // Find where to insert the new slice
        const newSlices = [...prev];

        // Check if clicking inside an existing slice - if so, split it
        for (let i = 0; i < newSlices.length; i++) {
          const slice = newSlices[i];
          if (samplePosition > slice.startSample + DEFAULT_MIN_SLICE_SAMPLES &&
              samplePosition < slice.endSample - DEFAULT_MIN_SLICE_SAMPLES) {
            // Split this slice at the click position
            const originalEnd = slice.endSample;
            const newLabel = labels[(i + 1) % labels.length] ?? `S${newSlices.length + 1}`;

            // Shrink original slice
            newSlices[i] = {
              ...slice,
              endSample: samplePosition,
            };

            // Insert new slice
            newSlices.splice(i + 1, 0, {
              label: newLabel,
              startSample: samplePosition,
              endSample: originalEnd,
            });

            return newSlices;
          }
        }

        // Not inside a slice - create a new one
        // Find the end position (next slice start or end of audio)
        let endSample = samples.length;
        for (const slice of newSlices) {
          if (slice.startSample > samplePosition && slice.startSample < endSample) {
            endSample = slice.startSample;
          }
        }

        // Find the start position (previous slice end or click position)
        let startSample = samplePosition;
        for (const slice of newSlices) {
          if (slice.endSample <= samplePosition && slice.endSample > startSample - (endSample - samplePosition)) {
            startSample = slice.endSample;
          }
        }

        // Ensure minimum size
        if (endSample - startSample < DEFAULT_MIN_SLICE_SAMPLES) {
          endSample = Math.min(startSample + DEFAULT_MIN_SLICE_SAMPLES, samples.length);
        }

        const newSlice: SliceDefinitionOutput = {
          label: labels[newSlices.length % labels.length] ?? `S${newSlices.length + 1}`,
          startSample,
          endSample,
        };

        // Insert in sorted order
        const insertIndex = newSlices.findIndex((s) => s.startSample > startSample);
        if (insertIndex === -1) {
          newSlices.push(newSlice);
        } else {
          newSlices.splice(insertIndex, 0, newSlice);
        }

        return newSlices;
      });
    },
    [samples, kitLabels]
  );

  // Handle deleting a slice (manual mode)
  const handleSliceDelete = useCallback(
    (index: number) => {
      setManualSlices((prev) => {
        if (prev.length <= 1) return prev; // Keep at least one slice
        const updated = [...prev];
        updated.splice(index, 1);
        return updated;
      });
      setSelectedSlice(undefined);
    },
    []
  );

  // Play a specific slice
  const handlePlaySlice = useCallback(
    (index: number) => {
      if (!samples || !currentSliceResult) return;
      const slice = currentSliceResult.slices[index];
      if (!slice) return;

      // If already playing this slice, stop
      if (isPlaying && selectedSlice === index) {
        stop();
        return;
      }

      setSelectedSlice(index);
      play(samples, slice.startSample, slice.endSample);
    },
    [samples, currentSliceResult, isPlaying, selectedSlice, play, stop]
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

  // Apply strip silence - commit preview to slices
  const handleApplyStripSilence = useCallback(() => {
    if (!strippedPreview) return;

    setManualSlices((prev) =>
      prev.map((slice, i) => ({
        ...slice,
        startSample: strippedPreview[i]?.startSample ?? slice.startSample,
        endSample: strippedPreview[i]?.endSample ?? slice.endSample,
      }))
    );
    setStripSilenceActive(false);
    setOriginalSliceBoundaries([]);
  }, [strippedPreview]);

  // Cancel strip silence - discard preview
  const handleCancelStripSilence = useCallback(() => {
    setStripSilenceActive(false);
    setOriginalSliceBoundaries([]);
  }, []);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(MAX_ZOOM, prev * ZOOM_STEP));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(MIN_ZOOM, prev / ZOOM_STEP));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
  }, []);

  // Handle create/update kit
  const handleCreateKit = useCallback(() => {
    if (!currentSliceResult || currentSliceResult.slices.length === 0 || !samples) return;

    const labels = kitLabels.split(',').map((s) => s.trim());

    // Use manual slices if in manual or silence mode, otherwise build from auto result
    const sliceDefinitions: SliceDefinitionOutput[] =
      selectedMethod === 'manual' || selectedMethod === 'silence' || useInitialSlices
        ? manualSlices
        : currentSliceResult.slices.map((slice, i) => ({
            label: labels[i % labels.length] ?? `S${i + 1}`,
            startSample: slice.startSample,
            endSample: slice.endSample,
          }));

    if (editMode && onSlicesUpdated) {
      // Edit mode: update slices and kit config
      onSlicesUpdated(sliceDefinitions, {
        transpose: kitTranspose !== 0 ? kitTranspose : undefined,
        velocitySensitivity: kitVelocitySensitivity,
      });
      onOpenChange(false);
    } else {
      // Create mode: create new drum kit
      const kit = slicesToDrumKit(currentSliceResult, {
        name: kitName || 'DRUM-KIT',
        sampleRate: kitSampleRate,
        baseNote: kitBaseNote,
        drumTypes: labels.length > 0 ? labels : undefined,
        // Pass semitones directly - conversion to S-330 raw value happens at import time
        transpose: kitTranspose !== 0 ? kitTranspose : undefined,
        velocitySensitivity: kitVelocitySensitivity,
      });

      // Pass source WAV and slice definitions for deferred chopping
      onKitCreated(kit, sliceDefinitions, { samples, sampleRate });
      onOpenChange(false);
    }
  }, [
    currentSliceResult,
    samples,
    kitName,
    kitSampleRate,
    kitBaseNote,
    kitLabels,
    kitTranspose,
    kitVelocitySensitivity,
    sampleRate,
    selectedMethod,
    useInitialSlices,
    manualSlices,
    editMode,
    onKitCreated,
    onSlicesUpdated,
    onOpenChange,
  ]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // Switch to manual mode (copy current auto slices)
  const handleSwitchToManual = useCallback(() => {
    if (autoSliceResult && autoSliceResult.slices.length > 0) {
      const labels = kitLabels.split(',').map((s) => s.trim());
      setManualSlices(
        autoSliceResult.slices.map((slice, i) => ({
          label: labels[i % labels.length] ?? `S${i + 1}`,
          startSample: slice.startSample,
          endSample: slice.endSample,
        }))
      );
    }
    setSelectedMethod('manual');
    setUseInitialSlices(false);
  }, [autoSliceResult, kitLabels]);

  // Handle keyboard shortcuts at dialog level
  const handleDialogKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      // Don't capture keys when typing in an input
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

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
      // Toggle fullscreen with F or F11
      if (event.key === 'f' || event.key === 'F' || event.key === 'F11') {
        event.preventDefault();
        event.stopPropagation();
        setIsFullscreen((prev) => !prev);
        return;
      }
      // Escape exits fullscreen first, then closes dialog
      if (event.key === 'Escape' && isFullscreen) {
        event.preventDefault();
        event.stopPropagation();
        setIsFullscreen(false);
        return;
      }
      // Space to play selected slice or all
      if (event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        if (selectedSlice !== undefined) {
          handlePlaySlice(selectedSlice);
        } else {
          handlePlayAll();
        }
        return;
      }
      // Delete/Backspace to delete selected slice (in manual mode)
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedMethod === 'manual' && selectedSlice !== undefined) {
        event.preventDefault();
        event.stopPropagation();
        handleSliceDelete(selectedSlice);
        return;
      }
      // Arrow keys to navigate slices
      if (event.key === 'ArrowLeft' && currentSliceResult && currentSliceResult.slices.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        const newIndex = selectedSlice !== undefined
          ? Math.max(0, selectedSlice - 1)
          : currentSliceResult.slices.length - 1;
        setSelectedSlice(newIndex);
        return;
      }
      if (event.key === 'ArrowRight' && currentSliceResult && currentSliceResult.slices.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        const newIndex = selectedSlice !== undefined
          ? Math.min(currentSliceResult.slices.length - 1, selectedSlice + 1)
          : 0;
        setSelectedSlice(newIndex);
        return;
      }
    },
    [handleZoomIn, handleZoomOut, handleZoomReset, isFullscreen, selectedSlice, handlePlaySlice, handlePlayAll, selectedMethod, handleSliceDelete, currentSliceResult]
  );

  // Duration info
  const durationMs = samples ? (samples.length / sampleRate) * 1000 : 0;

  // Check if we're in an interactive editing mode
  const isManualMode = selectedMethod === 'manual';

  // Waveform height based on fullscreen mode
  const waveformHeight = isFullscreen ? 400 : 140;

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content
          className={cn(
            'fixed z-50 bg-s330-panel border border-s330-accent rounded-lg shadow-xl overflow-hidden flex flex-col',
            isFullscreen
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
                {durationMs > 0 && ` (${durationMs.toFixed(0)}ms)`}
              </Dialog.Description>
            </div>
            <div className="flex items-center gap-2">
              {/* Fullscreen toggle */}
              <button
                onClick={() => setIsFullscreen((prev) => !prev)}
                className="p-2 text-s330-muted hover:text-s330-text transition-colors"
                title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
              >
                {isFullscreen ? (
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
                    {isManualMode && !stripSilenceActive && (
                      <div className="text-xs text-s330-muted">
                        Drag edges to adjust • Click to split • Delete to remove
                      </div>
                    )}
                    {stripSilenceActive && (
                      <div className="text-xs text-s330-highlight">
                        Strip Silence Preview - Adjust threshold below
                      </div>
                    )}
                    {/* Joined edges toggle */}
                    {isManualMode && !stripSilenceActive && (
                      <button
                        onClick={() => setJoinedEdges((prev) => !prev)}
                        className={cn(
                          'flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors',
                          joinedEdges
                            ? 'bg-s330-highlight/20 text-s330-highlight'
                            : 'bg-s330-bg text-s330-muted hover:text-s330-text'
                        )}
                        title={joinedEdges ? 'Joined edges: ON - Adjacent boundaries move together' : 'Joined edges: OFF - Move boundaries independently'}
                      >
                        {/* Chain link icon */}
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        {joinedEdges ? 'Joined' : 'Split'}
                      </button>
                    )}
                    {/* Play controls */}
                    <div className="flex items-center gap-1 bg-s330-bg rounded px-2 py-1">
                      <button
                        onClick={() => selectedSlice !== undefined ? handlePlaySlice(selectedSlice) : handlePlayAll()}
                        className={cn(
                          'p-1 transition-colors',
                          isPlaying
                            ? 'text-red-400 hover:text-red-300'
                            : 'text-s330-muted hover:text-s330-text'
                        )}
                        title={isPlaying ? 'Stop (Space)' : selectedSlice !== undefined ? 'Play selected slice (Space)' : 'Play all (Space)'}
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
                        onClick={handleZoomOut}
                        disabled={zoom <= MIN_ZOOM}
                        className={cn(
                          'p-1 text-s330-muted hover:text-s330-text transition-colors',
                          zoom <= MIN_ZOOM && 'opacity-30 cursor-not-allowed'
                        )}
                        title="Zoom out (-)"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                        </svg>
                      </button>
                      <button
                        onClick={handleZoomReset}
                        className="px-2 text-xs text-s330-muted hover:text-s330-text transition-colors min-w-[3rem]"
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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                <WaveformEditor
                  samples={samples}
                  sampleRate={sampleRate}
                  sliceMarkers={sliceMarkers}
                  selectedSlice={selectedSlice}
                  onSliceClick={setSelectedSlice}
                  height={waveformHeight}
                  editable={isManualMode && !stripSilenceActive}
                  onSliceChange={isManualMode && !stripSilenceActive ? handleSliceChange : undefined}
                  onSlicesChange={isManualMode && !stripSilenceActive ? handleSlicesChange : undefined}
                  onSliceAdd={isManualMode && !stripSilenceActive ? handleSliceAdd : undefined}
                  onSliceDelete={isManualMode && !stripSilenceActive ? handleSliceDelete : undefined}
                  zoom={zoom}
                  onZoomChange={setZoom}
                  joinedEdges={isManualMode && joinedEdges && !stripSilenceActive}
                  playbackPosition={playbackPosition}
                />
                {currentSliceResult && (
                  <div className="flex items-center justify-between text-xs text-s330-muted">
                    <span>
                      {currentSliceResult.slices.length} slice
                      {currentSliceResult.slices.length !== 1 ? 's' : ''}
                      {selectedSlice !== undefined && currentSliceResult.slices[selectedSlice] && (
                        <span className="ml-2 text-s330-text">
                          • Selected: {currentSliceResult.slices[selectedSlice]?.durationMs.toFixed(0)}ms
                        </span>
                      )}
                    </span>
                    {!isManualMode && autoSliceResult && autoSliceResult.slices.length > 0 && (
                      <button
                        onClick={handleSwitchToManual}
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
                value={selectedMethod}
                onValueChange={(v) => {
                  const newMethod = v as SliceMethodTab;
                  setSelectedMethod(newMethod);
                  if (newMethod !== 'manual') {
                    setUseInitialSlices(false);
                  }
                  // Auto-enter strip silence mode when switching to silence tab
                  if (newMethod === 'silence' && manualSlices.length > 0) {
                    setOriginalSliceBoundaries(
                      manualSlices.map((s) => ({ startSample: s.startSample, endSample: s.endSample }))
                    );
                    setStripSilenceActive(true);
                  } else if (newMethod !== 'silence') {
                    // Exit strip silence mode when switching away
                    setStripSilenceActive(false);
                    setOriginalSliceBoundaries([]);
                  }
                }}
              >
                <Tabs.List className="flex border-b border-s330-accent/30 mb-4">
                  <Tabs.Trigger
                    value="manual"
                    className={cn(
                      'px-4 py-2 text-sm border-b-2 -mb-px transition-colors',
                      selectedMethod === 'manual'
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
                      selectedMethod === 'transient'
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
                      selectedMethod === 'silence'
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
                      selectedMethod === 'fixed'
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
                    Manually define slice points by clicking on the waveform. Drag slice edges to adjust boundaries.
                    Use +/- to zoom for fine adjustments.
                  </p>

                  {/* Slice List */}
                  {manualSlices.length > 0 && (
                    <div className="bg-s330-bg rounded p-3 space-y-2 max-h-32 overflow-y-auto">
                      <div className="text-xs text-s330-muted uppercase tracking-wide mb-2">
                        Slices ({manualSlices.length})
                      </div>
                      {manualSlices.map((slice, i) => (
                        <div
                          key={i}
                          className={cn(
                            'flex items-center gap-2 text-xs py-1 px-2 rounded cursor-pointer',
                            selectedSlice === i
                              ? 'bg-s330-highlight/20 text-s330-text'
                              : 'hover:bg-s330-accent/20 text-s330-muted'
                          )}
                          onClick={() => setSelectedSlice(i)}
                        >
                          {/* Play button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlaySlice(i);
                            }}
                            className={cn(
                              'p-0.5 rounded transition-colors',
                              isPlaying && selectedSlice === i
                                ? 'text-red-400 hover:text-red-300'
                                : 'text-s330-muted hover:text-s330-text'
                            )}
                            title={isPlaying && selectedSlice === i ? 'Stop' : 'Play slice'}
                          >
                            {isPlaying && selectedSlice === i ? (
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
                              handleSliceDelete(i);
                            }}
                            disabled={manualSlices.length <= 1}
                            className={cn(
                              'text-red-400 hover:text-red-300 px-1',
                              manualSlices.length <= 1 && 'opacity-30 cursor-not-allowed'
                            )}
                            title="Delete slice"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {manualSlices.length === 0 && (
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
                        Threshold ({(transientThreshold * 100).toFixed(0)}%)
                      </label>
                      <input
                        type="range"
                        min="0.05"
                        max="0.9"
                        step="0.05"
                        value={transientThreshold}
                        onChange={(e) => setTransientThreshold(parseFloat(e.target.value))}
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
                        value={transientMinGap}
                        onChange={(e) => setTransientMinGap(parseInt(e.target.value) || 100)}
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
                        value={transientPrePad}
                        onChange={(e) => setTransientPrePad(parseInt(e.target.value) || 0)}
                        className="w-full bg-s330-bg border border-s330-accent/50 rounded px-2 py-1 text-sm text-s330-text"
                      />
                    </div>
                  </div>
                </Tabs.Content>

                {/* Strip Silence Controls */}
                <Tabs.Content value="silence" className="space-y-3">
                  {manualSlices.length === 0 ? (
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
                          Threshold: {stripSilenceThreshold} dB
                        </label>
                        <input
                          type="range"
                          min="-60"
                          max="-10"
                          step="1"
                          value={stripSilenceThreshold}
                          onChange={(e) => setStripSilenceThreshold(parseInt(e.target.value))}
                          className="w-full accent-s330-highlight"
                        />
                        <div className="flex justify-between text-xs text-s330-muted mt-0.5">
                          <span>-60 dB (quieter)</span>
                          <span>-10 dB (louder)</span>
                        </div>
                      </div>

                      {/* Stats about what will change */}
                      {strippedPreview && (
                        <div className="text-xs text-s330-muted bg-s330-bg rounded p-2">
                          <span className="font-medium text-s330-text">
                            {strippedPreview.filter((p, i) =>
                              p.startSample !== originalSliceBoundaries[i]?.startSample ||
                              p.endSample !== originalSliceBoundaries[i]?.endSample
                            ).length}
                          </span>
                          {' '}of {manualSlices.length} slices will be trimmed
                        </div>
                      )}

                      {/* Apply/Reset buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={handleCancelStripSilence}
                          className="flex-1 px-3 py-1.5 text-xs rounded bg-s330-bg hover:bg-s330-accent/50 text-s330-muted transition-colors"
                        >
                          Reset
                        </button>
                        <button
                          onClick={handleApplyStripSilence}
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
                        value={fixedInterval}
                        onChange={(e) => setFixedInterval(parseInt(e.target.value) || 500)}
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
                        value={fixedCount ?? ''}
                        onChange={(e) =>
                          setFixedCount(e.target.value ? parseInt(e.target.value) : undefined)
                        }
                        placeholder="auto"
                        className="w-full bg-s330-bg border border-s330-accent/50 rounded px-2 py-1 text-sm text-s330-text"
                      />
                    </div>
                  </div>
                </Tabs.Content>
              </Tabs.Root>

              {/* Error Display */}
              {sliceError && (
                <div className="text-sm text-red-400 bg-red-900/20 rounded p-2">
                  {sliceError}
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
                        value={kitName}
                        onChange={(e) => setKitName(e.target.value.toUpperCase())}
                        placeholder="DRUM-KIT"
                        className="w-full bg-s330-panel border border-s330-accent/50 rounded px-2 py-1 text-sm text-s330-text uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-s330-muted mb-1">
                        Sample Rate
                      </label>
                      <select
                        value={kitSampleRate}
                        onChange={(e) =>
                          setKitSampleRate(parseInt(e.target.value) as 15000 | 30000)
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
                        value={kitBaseNote}
                        onChange={(e) => setKitBaseNote(parseInt(e.target.value) || 36)}
                        className="w-full bg-s330-panel border border-s330-accent/50 rounded px-2 py-1 text-sm text-s330-text"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-s330-muted mb-1">
                        Labels (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={kitLabels}
                        onChange={(e) => setKitLabels(e.target.value)}
                        placeholder="kick,snare,hhc,hho"
                        className="w-full bg-s330-panel border border-s330-accent/50 rounded px-2 py-1 text-sm text-s330-text"
                      />
                    </div>
                  </div>
                  {/* Transpose control */}
                  <div>
                    <label className="block text-xs text-s330-muted mb-1">
                      Pitch Adjust (semitones: {kitTranspose > 0 ? '+' : ''}
                      {kitTranspose})
                    </label>
                    <input
                      type="range"
                      min="-24"
                      max="24"
                      step="1"
                      value={kitTranspose}
                      onChange={(e) => setKitTranspose(parseInt(e.target.value))}
                      className="w-full accent-s330-highlight"
                    />
                    <div className="flex justify-between text-xs text-s330-muted mt-1">
                      <span>-2 oct</span>
                      <button
                        onClick={() => setKitTranspose(0)}
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
                      Velocity Sensitivity: {kitVelocitySensitivity}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="1"
                      value={kitVelocitySensitivity}
                      onChange={(e) => setKitVelocitySensitivity(parseInt(e.target.value))}
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
                  {/* Velocity Sensitivity control */}
                  <div>
                    <label className="block text-xs text-s330-muted mb-1">
                      Velocity Sensitivity: {kitVelocitySensitivity}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="1"
                      value={kitVelocitySensitivity}
                      onChange={(e) => setKitVelocitySensitivity(parseInt(e.target.value))}
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
                disabled={!currentSliceResult || currentSliceResult.slices.length === 0}
                className={cn(
                  'ac-btn ac-btn-primary',
                  (!currentSliceResult || currentSliceResult.slices.length === 0) &&
                    'opacity-50 cursor-not-allowed'
                )}
              >
                {editMode
                  ? `Save Changes (${currentSliceResult?.slices.length ?? 0} slices)`
                  : `Create Drum Kit (${currentSliceResult?.slices.length ?? 0} samples)`}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
