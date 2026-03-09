/**
 * Sample Chopper Dialog
 *
 * Dialog for slicing a contiguous audio sample into individual drum hits
 * and creating a drum kit for import.
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
  type Slice,
  type ResolvedDrumKitBundle,
} from '@audiocontrol/sampler-library/browser';
import { cn } from '@/lib/utils';
import { WaveformEditor, type SliceMarker } from './WaveformEditor';

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
  /** Callback when drum kit is created */
  onKitCreated: (
    kit: ResolvedDrumKitBundle,
    slices: Slice[],
    sampleRate: number
  ) => void;
}

type SliceMethodTab = 'transient' | 'silence' | 'fixed' | 'manual';

export function SampleChopperDialog({
  open,
  onOpenChange,
  samples,
  sampleRate,
  sourceName,
  onKitCreated,
}: SampleChopperDialogProps): JSX.Element {
  // Slice method selection
  const [selectedMethod, setSelectedMethod] = useState<SliceMethodTab>('transient');

  // Transient detection parameters
  const [transientThreshold, setTransientThreshold] = useState(0.3);
  const [transientMinGap, setTransientMinGap] = useState(100);
  const [transientPrePad, setTransientPrePad] = useState(5);

  // Silence detection parameters
  const [silenceThreshold, setSilenceThreshold] = useState(-40);
  const [silenceMinDuration, setSilenceMinDuration] = useState(50);
  const [silenceMinSample, setSilenceMinSample] = useState(10);

  // Fixed interval parameters
  const [fixedInterval, setFixedInterval] = useState(500);
  const [fixedCount, setFixedCount] = useState<number | undefined>(undefined);

  // Manual regions (simplified - just showing detected slices)
  // Full manual editing would require more complex UI

  // Kit configuration
  const [kitName, setKitName] = useState('');
  const [kitLabels, setKitLabels] = useState(DEFAULT_DRUM_TYPES.join(','));
  const [kitSampleRate, setKitSampleRate] = useState<15000 | 30000>(15000);
  const [kitBaseNote, setKitBaseNote] = useState(DEFAULT_BASE_NOTE);

  // Slice result state
  const [sliceResult, setSliceResult] = useState<SliceResult | null>(null);
  const [selectedSlice, setSelectedSlice] = useState<number | undefined>(undefined);
  const [sliceError, setSliceError] = useState<string | null>(null);

  // Initialize kit name from source
  useEffect(() => {
    if (open && sourceName && !kitName) {
      setKitName(sourceName.replace(/\.wav$/i, '').toUpperCase().slice(0, 12));
    }
  }, [open, sourceName, kitName]);

  // Analyze audio and suggest parameters when dialog opens
  useEffect(() => {
    if (open && samples && samples.length > 0) {
      const analysis = analyzeForSlicing(samples, sampleRate);
      setTransientThreshold(
        Math.round(analysis.suggestedTransientThreshold * 100) / 100
      );
      setSilenceThreshold(analysis.suggestedSilenceThresholdDb);

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
      case 'silence':
        return {
          method: 'silence',
          thresholdDb: silenceThreshold,
          minSilenceMs: silenceMinDuration,
          minSampleMs: silenceMinSample,
        };
      case 'fixed':
        return {
          method: 'fixed',
          intervalMs: fixedInterval,
          count: fixedCount,
        };
      case 'manual':
        // For manual mode, use transient as base and show results
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
    silenceThreshold,
    silenceMinDuration,
    silenceMinSample,
    fixedInterval,
    fixedCount,
  ]);

  // Perform slicing when config changes
  useEffect(() => {
    if (!samples || samples.length === 0) {
      setSliceResult(null);
      return;
    }

    try {
      const result = sliceAudio(samples, sampleRate, sliceConfig);
      setSliceResult(result);
      setSliceError(null);
      setSelectedSlice(undefined);
    } catch (err) {
      setSliceError(err instanceof Error ? err.message : 'Slicing failed');
      setSliceResult(null);
    }
  }, [samples, sampleRate, sliceConfig]);

  // Convert slices to waveform markers
  const sliceMarkers = useMemo((): SliceMarker[] => {
    if (!sliceResult) return [];

    const labels = kitLabels.split(',').map((s) => s.trim().toUpperCase());

    return sliceResult.slices.map((slice, i) => ({
      startSample: slice.startSample,
      endSample: slice.endSample,
      label: labels[i % labels.length] ?? `${i + 1}`,
    }));
  }, [sliceResult, kitLabels]);

  // Handle create kit
  const handleCreateKit = useCallback(() => {
    if (!sliceResult || sliceResult.slices.length === 0) return;

    const labels = kitLabels.split(',').map((s) => s.trim());

    const kit = slicesToDrumKit(sliceResult, {
      name: kitName || 'DRUM-KIT',
      sampleRate: kitSampleRate,
      baseNote: kitBaseNote,
      drumTypes: labels.length > 0 ? labels : undefined,
    });

    onKitCreated(kit, sliceResult.slices, sampleRate);
    onOpenChange(false);
  }, [
    sliceResult,
    kitName,
    kitSampleRate,
    kitBaseNote,
    kitLabels,
    sampleRate,
    onKitCreated,
    onOpenChange,
  ]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // Duration info
  const durationMs = samples ? (samples.length / sampleRate) * 1000 : 0;

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-s330-panel border border-s330-accent rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
          <Dialog.Title className="text-lg font-bold text-s330-text mb-2">
            Chop Sample
          </Dialog.Title>
          <Dialog.Description className="text-sm text-s330-muted mb-4">
            Slice "{sourceName}" into individual drum hits
            {durationMs > 0 && ` (${durationMs.toFixed(0)}ms)`}
          </Dialog.Description>

          <div className="space-y-4">
            {/* Waveform Preview */}
            <div className="space-y-2">
              <div className="text-xs text-s330-muted uppercase tracking-wide">
                Waveform & Slice Preview
              </div>
              <WaveformEditor
                samples={samples}
                sampleRate={sampleRate}
                sliceMarkers={sliceMarkers}
                selectedSlice={selectedSlice}
                onSliceClick={setSelectedSlice}
                height={120}
              />
              {sliceResult && (
                <div className="text-xs text-s330-muted">
                  Detected {sliceResult.slices.length} slice
                  {sliceResult.slices.length !== 1 ? 's' : ''}
                  {selectedSlice !== undefined && sliceResult.slices[selectedSlice] && (
                    <span className="ml-2 text-s330-text">
                      • Selected: {sliceResult.slices[selectedSlice]?.durationMs.toFixed(0)}ms
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Slice Method Tabs */}
            <Tabs.Root
              value={selectedMethod}
              onValueChange={(v) => setSelectedMethod(v as SliceMethodTab)}
            >
              <Tabs.List className="flex border-b border-s330-accent/30 mb-4">
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
                  Silence
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

              {/* Silence Detection Controls */}
              <Tabs.Content value="silence" className="space-y-3">
                <p className="text-xs text-s330-muted">
                  Split at gaps of silence between drum hits.
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-s330-muted mb-1">
                      Threshold (dB)
                    </label>
                    <input
                      type="number"
                      min="-80"
                      max="-10"
                      step="5"
                      value={silenceThreshold}
                      onChange={(e) => setSilenceThreshold(parseInt(e.target.value) || -40)}
                      className="w-full bg-s330-bg border border-s330-accent/50 rounded px-2 py-1 text-sm text-s330-text"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-s330-muted mb-1">
                      Min Silence (ms)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="500"
                      step="10"
                      value={silenceMinDuration}
                      onChange={(e) => setSilenceMinDuration(parseInt(e.target.value) || 50)}
                      className="w-full bg-s330-bg border border-s330-accent/50 rounded px-2 py-1 text-sm text-s330-text"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-s330-muted mb-1">
                      Min Sample (ms)
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="500"
                      step="5"
                      value={silenceMinSample}
                      onChange={(e) => setSilenceMinSample(parseInt(e.target.value) || 10)}
                      className="w-full bg-s330-bg border border-s330-accent/50 rounded px-2 py-1 text-sm text-s330-text"
                    />
                  </div>
                </div>
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

            {/* Kit Configuration */}
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
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={handleClose} className="ac-btn ac-btn-ghost">
                Cancel
              </button>
              <button
                onClick={handleCreateKit}
                disabled={!sliceResult || sliceResult.slices.length === 0}
                className={cn(
                  'ac-btn ac-btn-primary',
                  (!sliceResult || sliceResult.slices.length === 0) &&
                    'opacity-50 cursor-not-allowed'
                )}
              >
                Create Drum Kit ({sliceResult?.slices.length ?? 0} samples)
              </button>
            </div>
          </div>

          {/* Close button */}
          <Dialog.Close asChild>
            <button
              className="absolute top-4 right-4 text-s330-muted hover:text-s330-text"
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
