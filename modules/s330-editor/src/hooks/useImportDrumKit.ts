/**
 * useImportDrumKit Hook
 *
 * Handles importing drum kit bundles to the device.
 * Creates tones with one-shot loop mode and a patch with correct MIDI mappings.
 */

import { useState, useCallback, MutableRefObject } from 'react';
import type { S330ClientInterface, S330Tone, S330Patch } from '@/core/midi/S330Client';
import type { ResolvedDrumKitBundle } from '@audiocontrol/sampler-library/browser';
import { loadDrumKitSample, prepareWavForS330 } from '@/lib/library-service';

interface ImportDrumKitDialogState {
  kitName: string;
  bundle: ResolvedDrumKitBundle;
}

interface UseImportDrumKitOptions {
  clientRef: MutableRefObject<S330ClientInterface | null>;
  libraryHandle: FileSystemDirectoryHandle | null;
  setTone: (index: number, tone: S330Tone) => void;
  setPatch: (index: number, patch: S330Patch) => void;
}

interface UseImportDrumKitReturn {
  // Dialog state
  importDrumKitDialog: ImportDrumKitDialogState | null;
  isImporting: boolean;
  importProgress: number | undefined;
  importError: string | null;
  importStatus: string | null;

  // Dialog handlers
  openImportDrumKitDialog: (kitName: string, bundle: ResolvedDrumKitBundle) => void;
  closeImportDrumKitDialog: () => void;

  // Import handler
  handleImportDrumKit: (params: {
    startingToneSlot: number;
    waveBank: 0 | 1;
    startingSegment: number;
    targetPatchSlot: number;
  }) => Promise<void>;
}

/**
 * Create an S330Tone object for a drum sample with one-shot loop mode.
 */
function createDrumTone(
  name: string,
  sampleRate: 15000 | 30000,
  waveBank: 0 | 1,
  segmentTop: number,
  segmentLength: number,
  originalKey: number
): S330Tone {
  return {
    // Basic Info
    name: name.slice(0, 8).toUpperCase().padEnd(8, ' '), // S-330 names are 8 chars
    outputAssign: 0, // Mix output
    sourceTone: 0,
    origSubTone: 0,
    sampleRate: sampleRate === 30000 ? '30kHz' : '15kHz',
    originalKey,

    // Wave params
    wave: {
      bank: waveBank,
      segmentTop,
      segmentLength,
      startPoint: 0,
      endPoint: 0, // Will be set based on wave data
      loopPoint: 0,
      loopLength: 0,
    },
    loopMode: 'one-shot',

    // LFO
    lfo: {
      rate: 50,
      sync: false,
      delay: 0,
      mode: 'normal',
      polarity: false,
      offset: 64,
    },
    tvaLfoDepth: 0,

    // Pitch
    transpose: 64, // Center
    fineTune: 0,

    // TVF
    tvf: {
      cutoff: 127,
      resonance: 0,
      keyFollow: 0,
      lfoDepth: 0,
      egDepth: 0,
      egPolarity: 'normal',
      levelCurve: 0,
      keyRateFollow: 0,
      velRateFollow: 0,
      enabled: false,
      envelope: {
        levels: [127, 127, 127, 127, 127, 127, 127, 127],
        rates: [127, 127, 127, 127, 127, 127, 127, 127],
        sustainPoint: 7,
        endPoint: 8,
      },
    },

    // TVA
    tva: {
      lfoDepth: 0,
      keyRate: 0,
      level: 127,
      velRate: 0,
      levelCurve: 0,
      envelope: {
        levels: [127, 127, 127, 127, 127, 127, 127, 0],
        rates: [127, 127, 127, 127, 127, 127, 127, 30],
        sustainPoint: 6,
        endPoint: 8,
      },
    },

    // Switches
    benderEnabled: false,
    aftertouchEnabled: false,
    pitchFollow: false, // Drums play at original pitch regardless of MIDI note

    // Recording params (defaults)
    recThreshold: 64,
    recPreTrigger: 0,
    loopTune: 0,
    envZoom: 0,
    copySource: 0,
  };
}

/**
 * Create tone layer array for S-330 patch (109 elements for MIDI 21-127).
 * Returns -1 for unmapped notes.
 */
function createToneLayer(): number[] {
  return Array(109).fill(-1);
}

/**
 * Convert MIDI note to tone layer index (MIDI 21-127 -> 0-108).
 */
function midiNoteToLayerIndex(midiNote: number): number {
  return midiNote - 21;
}

/**
 * Create an S330Patch for a single drum sample.
 * Maps one MIDI note to one tone.
 */
function createSingleDrumPatch(
  name: string,
  toneSlot: number,
  midiNote: number
): S330Patch {
  const toneLayer1 = createToneLayer();

  // Map the single MIDI note to the tone
  const layerIndex = midiNoteToLayerIndex(midiNote);
  if (layerIndex >= 0 && layerIndex < 109) {
    toneLayer1[layerIndex] = toneSlot;
  }

  return {
    common: {
      name: name.slice(0, 12).toUpperCase().padEnd(12, ' '), // Patch names are 12 chars
      benderRange: 2,
      aftertouchSens: 64,
      keyMode: 'normal',
      velocityThreshold: 64,
      toneLayer1,
      toneLayer2: createToneLayer(),
      copySource: 0,
      octaveShift: 0,
      level: 127,
      detune: 0,
      velocityMixRatio: 64,
      aftertouchAssign: 'modulation',
      keyAssign: 'rotary',
      outputAssign: 8, // TONE (uses individual tone outputs)
    },
  };
}

export function useImportDrumKit({
  clientRef,
  libraryHandle,
  setTone,
  setPatch,
}: UseImportDrumKitOptions): UseImportDrumKitReturn {
  // Dialog state
  const [importDrumKitDialog, setImportDrumKitDialog] = useState<ImportDrumKitDialogState | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<number | undefined>(undefined);
  const [importError, setImportError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Open dialog
  const openImportDrumKitDialog = useCallback((kitName: string, bundle: ResolvedDrumKitBundle) => {
    setImportError(null);
    setImportProgress(undefined);
    setImportStatus(null);
    setImportDrumKitDialog({ kitName, bundle });
  }, []);

  // Close dialog
  const closeImportDrumKitDialog = useCallback(() => {
    setImportDrumKitDialog(null);
  }, []);

  // Import drum kit
  const handleImportDrumKit = useCallback(async (params: {
    startingToneSlot: number;
    waveBank: 0 | 1;
    startingSegment: number;
    targetPatchSlot: number;
  }) => {
    if (!clientRef.current || !libraryHandle || !importDrumKitDialog) {
      throw new Error('Missing required resources for import');
    }

    const { bundle, kitName } = importDrumKitDialog;
    const { startingToneSlot, waveBank, startingSegment, targetPatchSlot } = params;

    setIsImporting(true);
    setImportProgress(0);
    setImportError(null);

    try {
      // Collect all samples with their info
      const samples: Array<{
        filename: string;
        drumType: string;
        kitNumber: number;
        midiNote: number;
      }> = [];

      const drumOrder = ['kick', 'snare', 'hhClosed', 'hhOpen'] as const;

      for (const kit of bundle.kits) {
        for (const drumType of drumOrder) {
          const filename = kit.samples[drumType];
          if (filename) {
            samples.push({
              filename,
              drumType,
              kitNumber: kit.kitNumber,
              midiNote: kit.midiNotes[drumType],
            });
          }
        }
      }

      const totalSteps = samples.length + 1; // samples + patch
      let completedSteps = 0;
      let currentSegment = startingSegment;

      // Import each sample as a tone
      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i]!;
        const toneSlot = startingToneSlot + i;

        setImportStatus(`Loading ${sample.filename}...`);

        // Load WAV file and convert using the single code path
        const wavBytes = await loadDrumKitSample(libraryHandle, kitName, sample.filename);
        const prepared = prepareWavForS330(wavBytes.buffer as ArrayBuffer, bundle.sampleRate);

        console.log(`[useImportDrumKit] Sample ${i}: ${sample.filename}`);
        console.log(`[useImportDrumKit]   - WAV bytes: ${wavBytes.length}`);
        console.log(`[useImportDrumKit]   - S330 data bytes: ${prepared.data.length}`);
        console.log(`[useImportDrumKit]   - Sample count: ${prepared.sampleCount}`);
        console.log(`[useImportDrumKit]   - Segment length: ${prepared.segmentLength}`);
        console.log(`[useImportDrumKit]   - Current segment: ${currentSegment}`);
        console.log(`[useImportDrumKit]   - Tone slot: ${toneSlot}`);

        // Create tone name (use drumType and kit number)
        const toneName = `${sample.drumType.slice(0, 4).toUpperCase()}${sample.kitNumber}`;

        // Create tone object
        const tone = createDrumTone(
          toneName,
          bundle.sampleRate,
          waveBank,
          currentSegment,
          prepared.segmentLength,
          sample.midiNote
        );

        // Update end point based on sample length
        tone.wave.endPoint = prepared.sampleCount;

        setImportStatus(`Uploading ${sample.filename}...`);

        // Upload to device
        await clientRef.current.importTone(
          {
            toneIndex: toneSlot,
            waveData: prepared.data,
            waveBank,
            segmentTop: currentSegment,
            segmentLength: prepared.segmentLength,
            tone,
          },
          (bytesSent, totalBytes) => {
            const tonePct = totalBytes > 0 ? (bytesSent / totalBytes) : 0;
            const overallPct = ((completedSteps + tonePct) / totalSteps) * 100;
            setImportProgress(Math.floor(overallPct));
          }
        );

        // Update local state
        setTone(toneSlot, tone);

        // Move to next segment
        currentSegment += prepared.segmentLength;
        completedSteps++;

        // Give the S-330 time to process wave data before next upload
        // The S-330 needs significant time to write to internal memory
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Create and upload one patch per sample
      setImportStatus('Creating patches...');

      console.log('[useImportDrumKit] Bundle baseNote:', bundle.baseNote);
      console.log('[useImportDrumKit] Samples with MIDI notes:', samples.map(s => ({
        drumType: s.drumType,
        midiNote: s.midiNote
      })));

      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i]!;
        const toneSlot = startingToneSlot + i;
        const patchSlot = targetPatchSlot + i;

        // Create patch name from drum type and kit number
        const patchName = `${sample.drumType.slice(0, 4).toUpperCase()}${sample.kitNumber}`;

        console.log(`[useImportDrumKit] Creating patch ${patchName}: tone=${toneSlot}, midiNote=${sample.midiNote}`);

        const patch = createSingleDrumPatch(patchName, toneSlot, sample.midiNote);

        setImportStatus(`Creating patch ${patchName}...`);
        await clientRef.current.sendPatchData(patchSlot, patch.common);
        setPatch(patchSlot, patch);

        // Small delay between patch uploads
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      completedSteps++;
      setImportProgress(100);
      setImportStatus('Import complete!');

      // Brief delay to show completion
      await new Promise((resolve) => setTimeout(resolve, 500));

    } catch (err) {
      console.error('[useImportDrumKit] Failed to import drum kit:', err);
      setImportError(err instanceof Error ? err.message : 'Failed to import drum kit');
      throw err;
    } finally {
      setIsImporting(false);
    }
  }, [clientRef, libraryHandle, importDrumKitDialog, setTone, setPatch]);

  return {
    importDrumKitDialog,
    isImporting,
    importProgress,
    importError,
    importStatus,
    openImportDrumKitDialog,
    closeImportDrumKitDialog,
    handleImportDrumKit,
  };
}
