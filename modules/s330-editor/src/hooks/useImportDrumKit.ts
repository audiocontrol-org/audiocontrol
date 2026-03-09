/**
 * useImportDrumKit Hook
 *
 * Handles importing drum kit bundles to the device.
 * Creates tones with one-shot loop mode and a patch with correct MIDI mappings.
 */

import { useState, useCallback, MutableRefObject } from 'react';
import type { S330ClientInterface, S330Tone, S330Patch } from '@/core/midi/S330Client';
import type { ResolvedDrumKitBundle } from '@audiocontrol/sampler-library/browser';
import { createEmptyToneLayer, setToneAtMidiNote, createDrumTone, createDrumKitPatch } from '@audiocontrol/sampler-devices/s330';
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
    singlePatch?: boolean;
    patchName?: string;
  }) => Promise<void>;
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
  // Use canonical tone layer functions from sampler-devices
  const toneLayer1 = createEmptyToneLayer(1);
  setToneAtMidiNote(toneLayer1, midiNote, toneSlot);

  return {
    common: {
      name: name.slice(0, 12).toUpperCase().padEnd(12, ' '), // Patch names are 12 chars
      benderRange: 2,
      aftertouchSens: 64,
      keyMode: 'normal',
      velocityThreshold: 64,
      toneLayer1,
      toneLayer2: createEmptyToneLayer(2),
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
    singlePatch?: boolean;
    patchName?: string;
  }) => {
    if (!clientRef.current || !libraryHandle || !importDrumKitDialog) {
      throw new Error('Missing required resources for import');
    }

    const { bundle, kitName } = importDrumKitDialog;
    const { startingToneSlot, waveBank, startingSegment, targetPatchSlot } = params;
    // Default to single-patch mode
    const useSinglePatch = params.singlePatch ?? true;
    const patchName = params.patchName || kitName;

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

        // Load WAV file and convert using the canonical conversion function
        const wavBytes = await loadDrumKitSample(libraryHandle, kitName, sample.filename);
        const prepared = prepareWavForS330(wavBytes.buffer as ArrayBuffer, bundle.sampleRate);

        // Create tone name (use drumType and kit number)
        const toneName = `${sample.drumType.slice(0, 4).toUpperCase()}${sample.kitNumber}`;

        // Create tone object using canonical createDrumTone
        // Pass transpose value directly (0 = no pitch change)
        const tone = createDrumTone(
          toneName,
          bundle.sampleRate,
          waveBank,
          currentSegment,
          prepared.segmentLength,
          prepared.sampleCount,
          sample.midiNote,
          bundle.transpose ?? 0
        );

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

      // Create and upload patches
      console.log('[useImportDrumKit] Bundle baseNote:', bundle.baseNote);
      console.log('[useImportDrumKit] Samples with MIDI notes:', samples.map(s => ({
        drumType: s.drumType,
        midiNote: s.midiNote
      })));
      console.log('[useImportDrumKit] Single patch mode:', useSinglePatch);

      if (useSinglePatch) {
        // Single patch mode: create one patch with all tone mappings
        setImportStatus(`Creating patch ${patchName}...`);

        const toneMappings = samples.map((sample, i) => ({
          midiNote: sample.midiNote,
          toneSlot: startingToneSlot + i,
        }));

        console.log(`[useImportDrumKit] Creating single patch "${patchName}" with ${toneMappings.length} mappings`);

        const patch = createDrumKitPatch(patchName, toneMappings);
        await clientRef.current.sendPatchData(targetPatchSlot, patch.common);
        setPatch(targetPatchSlot, patch);
      } else {
        // Multi-patch mode: create one patch per sample
        setImportStatus('Creating patches...');

        for (let i = 0; i < samples.length; i++) {
          const sample = samples[i]!;
          const toneSlot = startingToneSlot + i;
          const patchSlot = targetPatchSlot + i;

          // Create patch name from drum type and kit number
          const samplePatchName = `${sample.drumType.slice(0, 4).toUpperCase()}${sample.kitNumber}`;

          console.log(`[useImportDrumKit] Creating patch ${samplePatchName}: tone=${toneSlot}, midiNote=${sample.midiNote}`);

          const patch = createSingleDrumPatch(samplePatchName, toneSlot, sample.midiNote);

          setImportStatus(`Creating patch ${samplePatchName}...`);
          await clientRef.current.sendPatchData(patchSlot, patch.common);
          setPatch(patchSlot, patch);

          // Small delay between patch uploads
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
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
