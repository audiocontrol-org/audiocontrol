/**
 * useSampleChopper Hook
 *
 * State and logic for the sample chopper dialog: slice detection,
 * manual editing, strip silence, zoom, and slice manipulation.
 *
 * Device-specific state (kit config, sample rate selection) is NOT managed here.
 * Use the renderOutputConfig prop on SampleChopperDialog for that.
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  sliceAudio,
  analyzeForSlicing,
} from '@/chopper.js';
import type {
  SliceConfig,
  SliceResult,
} from '@/types.js';
import { DEFAULT_SLICE_LABELS } from '@/types.js';
import type { SliceMarker, SliceChange } from '@/ui/components/WaveformEditor.js';
import { useSliceHistory, type HistoryEntry } from '@/ui/hooks/useSliceHistory.js';

export type SliceMethodTab = 'transient' | 'fixed' | 'manual';

/** Slice definition for output. */
export interface SliceDefinitionOutput {
  label: string;
  startSample: number;
  endSample: number;
}

/** Initial slice definition for edit mode. */
export interface InitialSliceDefinition {
  label: string;
  startSample: number;
  endSample: number;
}

const DEFAULT_MIN_SLICE_SAMPLES = 500;
const MIN_SAMPLES_AFTER_STRIP = 100;
const MIN_ZOOM = 1;
const MAX_ZOOM = 64;
const ZOOM_STEP = 1.5;

export { MIN_ZOOM, MAX_ZOOM };

function findFirstAboveThreshold(
  samples: Int16Array, startSample: number, endSample: number, thresholdDb: number
): number {
  const threshold = Math.pow(10, thresholdDb / 20) * 32768;
  for (let i = startSample; i < endSample; i++) {
    if (Math.abs(samples[i]) >= threshold) return i;
  }
  return startSample;
}

function findLastAboveThreshold(
  samples: Int16Array, startSample: number, endSample: number, thresholdDb: number
): number {
  const threshold = Math.pow(10, thresholdDb / 20) * 32768;
  for (let i = endSample - 1; i >= startSample; i--) {
    if (Math.abs(samples[i]) >= threshold) return i + 1;
  }
  return endSample;
}

export interface UseSampleChopperParams {
  samples: Int16Array | null;
  sampleRate: number;
  open: boolean;
  editMode: boolean;
  initialSlices?: InitialSliceDefinition[];
  /** Labels for slices (comma-separated), defaults to kick,snare,hhc,hho */
  labels?: string;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useSampleChopper({
  samples, sampleRate, open, editMode, initialSlices, labels: externalLabels,
}: UseSampleChopperParams) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [joinedEdges, setJoinedEdges] = useState(true);
  const [stripSilenceThreshold, setStripSilenceThreshold] = useState(-40);
  const [stripSilenceActive, setStripSilenceActive] = useState(false);
  const [originalSliceBoundaries, setOriginalSliceBoundaries] = useState<
    Array<{ startSample: number; endSample: number }>
  >([]);
  const [selectedMethod, setSelectedMethod] = useState<SliceMethodTab>('manual');
  const [useInitialSlices, setUseInitialSlices] = useState(editMode && !!initialSlices);
  const [transientThreshold, setTransientThreshold] = useState(0.3);
  const [transientMinGap, setTransientMinGap] = useState(100);
  const [transientPrePad, setTransientPrePad] = useState(5);
  const [fixedCount, setFixedCount] = useState(16);
  const [kitLabels, setKitLabels] = useState(externalLabels ?? DEFAULT_SLICE_LABELS.join(','));
  const [autoSliceResult, setAutoSliceResult] = useState<SliceResult | null>(null);
  const [selectedSlice, setSelectedSlice] = useState<number | undefined>(undefined);
  const [sliceError, setSliceError] = useState<string | null>(null);
  const [manualSlices, setManualSlices] = useState<SliceDefinitionOutput[]>(
    initialSlices?.map((s) => ({ ...s })) ?? []
  );
  const history = useSliceHistory();

  // Reset zoom when dialog opens/closes
  useEffect(() => {
    if (open) { setZoom(1); setIsFullscreen(false); }
  }, [open]);

  // Reset slice state when samples change (new audio loaded)
  useEffect(() => {
    setAutoSliceResult(null);
    setManualSlices([]);
    setSelectedSlice(undefined);
    setSliceError(null);
    setOriginalSliceBoundaries([]);
    setUseInitialSlices(false);
    history.clear();
  }, [samples]);

  // Initialize labels from initial slices when in edit mode
  useEffect(() => {
    if (open && editMode && initialSlices && initialSlices.length > 0) {
      setKitLabels(initialSlices.map((s) => s.label).join(','));
      const slices = initialSlices.map((s) => ({ ...s }));
      setManualSlices(slices);
      setUseInitialSlices(true);
      setSelectedMethod('manual');
      history.clear();
      history.push(slices, 'Load slices');
    }
  }, [open, editMode, initialSlices]);

  // Analyze audio and suggest parameters when dialog opens
  useEffect(() => {
    if (open && samples && samples.length > 0) {
      const analysis = analyzeForSlicing(samples, sampleRate);
      setTransientThreshold(Math.round(analysis.suggestedTransientThreshold * 100) / 100);
      setStripSilenceThreshold(analysis.suggestedSilenceThresholdDb);
      if (analysis.duration.ms >= 1000) {
        const estimatedBeats = Math.round(analysis.duration.ms / 500);
        if (estimatedBeats >= 2 && estimatedBeats <= 16) {
          setFixedCount(estimatedBeats);
        }
      }
    }
  }, [open, samples, sampleRate]);

  const sliceConfig = useMemo((): SliceConfig => {
    switch (selectedMethod) {
      case 'transient':
        return { method: 'transient', threshold: transientThreshold, minGapMs: transientMinGap, prePadMs: transientPrePad };
      case 'fixed':
        return { method: 'fixed', count: fixedCount };
      case 'manual':
        return { method: 'transient', threshold: transientThreshold, minGapMs: transientMinGap, prePadMs: transientPrePad };
    }
  }, [selectedMethod, transientThreshold, transientMinGap, transientPrePad, fixedCount]);

  // Perform auto-slicing when config changes (preview only — does not overwrite manualSlices)
  useEffect(() => {
    if (!samples || samples.length === 0) { setAutoSliceResult(null); return; }
    if (selectedMethod === 'manual') { setAutoSliceResult(null); return; }
    if (useInitialSlices) { return; }
    try {
      const result = sliceAudio(samples, sampleRate, sliceConfig);
      setAutoSliceResult(result);
      setSliceError(null);
      setSelectedSlice(undefined);
    } catch (err) {
      setSliceError(err instanceof Error ? err.message : 'Slicing failed');
      setAutoSliceResult(null);
    }
  }, [samples, sampleRate, sliceConfig, selectedMethod, useInitialSlices]);

  const currentSliceResult = useMemo((): SliceResult | null => {
    if (!samples || samples.length === 0) return null;
    if (selectedMethod === 'manual' || useInitialSlices) {
      if (manualSlices.length === 0) return null;
      const totalDurationMs = (samples.length / sampleRate) * 1000;
      return {
        slices: manualSlices.map((slice, index) => ({
          index, startSample: slice.startSample, endSample: slice.endSample,
          samples: samples.slice(slice.startSample, slice.endSample),
          durationMs: ((slice.endSample - slice.startSample) / sampleRate) * 1000,
        })),
        sampleRate, totalDurationMs,
      };
    }
    return autoSliceResult;
  }, [samples, sampleRate, selectedMethod, useInitialSlices, manualSlices, autoSliceResult]);

  const computeStrippedBoundaries = useCallback(
    (originalStart: number, originalEnd: number, threshold: number) => {
      if (!samples) return { startSample: originalStart, endSample: originalEnd };
      const newStart = findFirstAboveThreshold(samples, originalStart, originalEnd, threshold);
      const newEnd = findLastAboveThreshold(samples, originalStart, originalEnd, threshold);
      if (newEnd - newStart < MIN_SAMPLES_AFTER_STRIP) {
        return { startSample: originalStart, endSample: originalEnd };
      }
      return { startSample: newStart, endSample: newEnd };
    },
    [samples]
  );

  const strippedPreview = useMemo(() => {
    if (!stripSilenceActive || originalSliceBoundaries.length === 0) return null;
    return originalSliceBoundaries.map((original) =>
      computeStrippedBoundaries(original.startSample, original.endSample, stripSilenceThreshold)
    );
  }, [stripSilenceActive, originalSliceBoundaries, stripSilenceThreshold, computeStrippedBoundaries]);

  const sliceMarkers = useMemo((): SliceMarker[] => {
    if (selectedMethod === 'manual' || useInitialSlices) {
      if (stripSilenceActive && strippedPreview) {
        return manualSlices.map((slice, i) => ({
          startSample: strippedPreview[i]?.startSample ?? slice.startSample,
          endSample: strippedPreview[i]?.endSample ?? slice.endSample,
          label: slice.label,
        }));
      }
      return manualSlices.map((slice) => ({
        startSample: slice.startSample, endSample: slice.endSample, label: slice.label,
      }));
    }
    if (!autoSliceResult) return [];
    const labels = kitLabels.split(',').map((s) => s.trim().toUpperCase());
    return autoSliceResult.slices.map((slice, i) => ({
      startSample: slice.startSample, endSample: slice.endSample,
      label: labels[i % labels.length] ?? `${i + 1}`,
    }));
  }, [selectedMethod, useInitialSlices, manualSlices, autoSliceResult, kitLabels, stripSilenceActive, strippedPreview]);

  const handleSliceChange = useCallback((index: number, marker: SliceMarker) => {
    setManualSlices((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], startSample: marker.startSample, endSample: marker.endSample };
      }
      history.push(updated, 'Adjust edge');
      return updated;
    });
  }, [history.push]);

  const handleSlicesChange = useCallback((changes: SliceChange[]) => {
    setManualSlices((prev) => {
      const updated = [...prev];
      for (const change of changes) {
        if (updated[change.index]) {
          updated[change.index] = {
            ...updated[change.index],
            startSample: change.marker.startSample, endSample: change.marker.endSample,
          };
        }
      }
      history.push(updated, 'Adjust edges');
      return updated;
    });
  }, [history.push]);

  const handleSliceAdd = useCallback((samplePosition: number) => {
    if (!samples) return;
    const labels = kitLabels.split(',').map((s) => s.trim());
    setManualSlices((prev) => {
      const newSlices = [...prev];
      for (let i = 0; i < newSlices.length; i++) {
        const slice = newSlices[i];
        if (samplePosition > slice.startSample + DEFAULT_MIN_SLICE_SAMPLES &&
            samplePosition < slice.endSample - DEFAULT_MIN_SLICE_SAMPLES) {
          const originalEnd = slice.endSample;
          newSlices[i] = { ...slice, endSample: samplePosition };
          newSlices.splice(i + 1, 0, {
            label: labels[(i + 1) % labels.length] ?? `S${newSlices.length + 1}`,
            startSample: samplePosition, endSample: originalEnd,
          });
          history.push(newSlices, 'Split slice');
          return newSlices;
        }
      }
      let endSample = samples.length;
      for (const slice of newSlices) {
        if (slice.startSample > samplePosition && slice.startSample < endSample) {
          endSample = slice.startSample;
        }
      }
      let startSample = samplePosition;
      for (const slice of newSlices) {
        if (slice.endSample <= samplePosition && slice.endSample > startSample - (endSample - samplePosition)) {
          startSample = slice.endSample;
        }
      }
      if (endSample - startSample < DEFAULT_MIN_SLICE_SAMPLES) {
        endSample = Math.min(startSample + DEFAULT_MIN_SLICE_SAMPLES, samples.length);
      }
      const newSlice: SliceDefinitionOutput = {
        label: labels[newSlices.length % labels.length] ?? `S${newSlices.length + 1}`,
        startSample, endSample,
      };
      const insertIndex = newSlices.findIndex((s) => s.startSample > startSample);
      if (insertIndex === -1) { newSlices.push(newSlice); } else { newSlices.splice(insertIndex, 0, newSlice); }
      history.push(newSlices, 'Add slice');
      return newSlices;
    });
  }, [samples, kitLabels, history.push]);

  const handleSliceDelete = useCallback((index: number) => {
    setManualSlices((prev) => {
      if (prev.length <= 1) return prev;
      const updated = [...prev];
      updated.splice(index, 1);
      history.push(updated, 'Delete slice');
      return updated;
    });
    setSelectedSlice(undefined);
  }, [history.push]);

  const handleApplyStripSilence = useCallback(() => {
    if (!strippedPreview) return;
    setManualSlices((prev) => {
      const updated = prev.map((slice, i) => ({
        ...slice,
        startSample: strippedPreview[i]?.startSample ?? slice.startSample,
        endSample: strippedPreview[i]?.endSample ?? slice.endSample,
      }));
      history.push(updated, 'Strip silence');
      return updated;
    });
    setStripSilenceActive(false);
    setOriginalSliceBoundaries([]);
  }, [strippedPreview, history.push]);

  const handleCancelStripSilence = useCallback(() => {
    setStripSilenceActive(false);
    setOriginalSliceBoundaries([]);
  }, []);

  const handleZoomIn = useCallback(() => { setZoom((prev) => Math.min(MAX_ZOOM, prev * ZOOM_STEP)); }, []);
  const handleZoomOut = useCallback(() => { setZoom((prev) => Math.max(MIN_ZOOM, prev / ZOOM_STEP)); }, []);
  const handleZoomReset = useCallback(() => { setZoom(1); }, []);

  /** Apply auto-detected slices to manual slices and switch to manual mode. */
  const handleApplyAutoSlice = useCallback(() => {
    if (!autoSliceResult || autoSliceResult.slices.length === 0) return;
    const labels = kitLabels.split(',').map((s) => s.trim());
    const slices = autoSliceResult.slices.map((slice, i) => ({
      label: labels[i % labels.length] ?? `S${i + 1}`,
      startSample: slice.startSample, endSample: slice.endSample,
    }));
    setManualSlices(slices);
    history.push(slices, `Apply ${selectedMethod}`);
    setSelectedMethod('manual');
    setUseInitialSlices(false);
  }, [autoSliceResult, kitLabels, selectedMethod, history.push]);

  const handleSwitchToManual = useCallback(() => {
    setSelectedMethod('manual');
    setUseInitialSlices(false);
  }, []);

  const handleMethodChange = useCallback((newMethod: SliceMethodTab) => {
    setSelectedMethod(newMethod);
    if (newMethod !== 'manual') { setUseInitialSlices(false); }
    setStripSilenceActive(false);
    setOriginalSliceBoundaries([]);
  }, []);

  const handleUndo = useCallback(() => {
    const slices = history.undo();
    if (slices) {
      setManualSlices(slices);
      setSelectedSlice(undefined);
    }
  }, [history.undo]);

  const handleRedo = useCallback(() => {
    const slices = history.redo();
    if (slices) {
      setManualSlices(slices);
      setSelectedSlice(undefined);
    }
  }, [history.redo]);

  const handleRestoreHistory = useCallback((index: number) => {
    const slices = history.restore(index);
    setManualSlices(slices);
    setSelectedSlice(undefined);
  }, [history.restore]);

  const activateStripSilence = useCallback(() => {
    if (manualSlices.length === 0) return;
    setOriginalSliceBoundaries(manualSlices.map((s) => ({ startSample: s.startSample, endSample: s.endSample })));
    setStripSilenceActive(true);
  }, [manualSlices]);

  const durationMs = samples ? (samples.length / sampleRate) * 1000 : 0;
  const isManualMode = selectedMethod === 'manual';

  return {
    isFullscreen, setIsFullscreen,
    zoom, setZoom, handleZoomIn, handleZoomOut, handleZoomReset,
    joinedEdges, setJoinedEdges,
    stripSilenceThreshold, setStripSilenceThreshold, stripSilenceActive,
    strippedPreview, originalSliceBoundaries,
    handleApplyStripSilence, handleCancelStripSilence, activateStripSilence,
    selectedMethod, handleMethodChange,
    transientThreshold, setTransientThreshold,
    transientMinGap, setTransientMinGap,
    transientPrePad, setTransientPrePad,
    fixedCount, setFixedCount,
    kitLabels, setKitLabels,
    autoSliceResult, currentSliceResult,
    selectedSlice, setSelectedSlice, sliceError, sliceMarkers, manualSlices, setManualSlices,
    handleSliceChange, handleSlicesChange, handleSliceAdd, handleSliceDelete,
    handleApplyAutoSlice, handleSwitchToManual,
    durationMs, isManualMode, useInitialSlices,
    handleUndo, handleRedo, handleRestoreHistory,
    canUndo: history.canUndo, canRedo: history.canRedo,
    historyEntries: history.entries, historyIndex: history.currentIndex,
    pushHistory: history.push,
  };
}
