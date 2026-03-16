/**
 * useImportDrumKit Hook
 *
 * Handles importing drum kit bundles to the device.
 * Creates tones with one-shot loop mode and a patch with correct MIDI mappings.
 *
 * Supports two formats:
 * - Version 1: Individual WAV files (legacy)
 * - Version 2: Source WAV + slice definitions (deferred chopping)
 */

import { useState, useCallback, MutableRefObject } from 'react';
import type { ImportOperationState, ImportProgress } from '@/types/import-operation';
import type { S330ClientInterface, S330Tone, S330Patch } from '@/core/midi/S330Client';
import type { ResolvedDrumKitBundle, SliceDefinition } from '@audiocontrol/sampler-library/browser';
import {
  createEmptyToneLayer,
  setToneAtMidiNote,
  createDrumTone,
  createDrumKitPatch,
  resample,
  importMonolithicDrumKit,
} from '@audiocontrol/sampler-devices/s330';
import { loadDrumKitSample, loadDrumKitSource, prepareWavForS330 } from '@/lib/library-service';

interface ImportDrumKitDialogState {
  kitName: string;
  bundle: ResolvedDrumKitBundle;
  path?: string[];
}

interface UseImportDrumKitOptions {
  clientRef: MutableRefObject<S330ClientInterface | null>;
  libraryHandle: FileSystemDirectoryHandle | null;
  setTone: (index: number, tone: S330Tone) => void;
  setPatch: (index: number, patch: S330Patch) => void;
}

interface UseImportDrumKitReturn extends ImportOperationState {
  // Dialog state
  importDrumKitDialog: ImportDrumKitDialogState | null;

  // Dialog handlers
  openImportDrumKitDialog: (kitName: string, bundle: ResolvedDrumKitBundle, path?: string[]) => void;
  closeImportDrumKitDialog: () => void;

  // Import handler
  handleImportDrumKit: (params: {
    startingToneSlot: number;
    waveBank: 0 | 1;
    startingSegment: number;
    targetPatchSlot: number;
    singlePatch?: boolean;
    patchName?: string;
    useMonolithicMode?: boolean;
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
  const [importProgress, setImportProgress] = useState<ImportProgress | undefined>(undefined);
  const [importError, setImportError] = useState<string | null>(null);

  // Open dialog
  const openImportDrumKitDialog = useCallback((kitName: string, bundle: ResolvedDrumKitBundle, path?: string[]) => {
    setImportError(null);
    setImportProgress(undefined);
    setImportDrumKitDialog({ kitName, bundle, path });
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
    useMonolithicMode?: boolean;
  }) => {
    if (!clientRef.current || !libraryHandle || !importDrumKitDialog) {
      throw new Error('Missing required resources for import');
    }

    const { bundle, kitName, path } = importDrumKitDialog;
    const { startingToneSlot, waveBank, startingSegment, targetPatchSlot } = params;
    // Default to single-patch mode
    const useSinglePatch = params.singlePatch ?? true;
    const patchName = params.patchName || kitName;
    const useMonolithicMode = params.useMonolithicMode ?? false;

    setIsImporting(true);
    setImportProgress(undefined);
    setImportError(null);

    try {
      // =========================================================================
      // MONOLITHIC MODE (Experimental)
      // =========================================================================
      if (useMonolithicMode) {
        // Monolithic mode only works with v2 format (source + slices)
        if (!bundle.source || !bundle.slices || bundle.slices.length === 0) {
          throw new Error('Monolithic mode requires v2 format kit with source audio and slices');
        }

        // Monolithic import reports its own steps via callback
        // We estimate totalSteps as slices + 2 (wave upload + patch creation)
        const monoTotalSteps = bundle.slices.length + 2;

        setImportProgress({
          currentStep: 1, totalSteps: monoTotalSteps,
          stepLabel: 'Loading source audio...', bytesSent: 0, bytesTotal: 0,
          bytesSentAllSteps: 0, bytesTotalAllSteps: 0,
        });

        // Load the source WAV
        const sourceWav = await loadDrumKitSource(libraryHandle, kitName, bundle.source, path);

        // Resample if needed
        let targetSamples: Int16Array;
        if (sourceWav.sampleRate !== bundle.sampleRate) {
          setImportProgress({
            currentStep: 1, totalSteps: monoTotalSteps,
            stepLabel: 'Resampling audio...', bytesSent: 0, bytesTotal: 0,
            bytesSentAllSteps: 0, bytesTotalAllSteps: 0,
          });
          targetSamples = resample(sourceWav.samples, sourceWav.sampleRate, bundle.sampleRate);
        } else {
          targetSamples = sourceWav.samples;
        }

        // Prepare the entire source for S-330 (convert to 12-bit format)
        setImportProgress({
          currentStep: 1, totalSteps: monoTotalSteps,
          stepLabel: 'Preparing wave data...', bytesSent: 0, bytesTotal: 0,
          bytesSentAllSteps: 0, bytesTotalAllSteps: 0,
        });
        const prepared = prepareWavForS330(
          createWavArrayBuffer(targetSamples, bundle.sampleRate),
          bundle.sampleRate
        );

        // Build slice definitions with MIDI notes
        const slices = bundle.slices.map((slice, i) => {
          const kitMidiBase = bundle.baseNote + Math.floor(i / 4) * 4;
          const midiNote = kitMidiBase + (i % 4);
          return {
            label: slice.label,
            startSample: slice.startSample,
            endSample: slice.endSample,
            midiNote,
          };
        });

        const waveTotalBytes = prepared.data.length;

        // Use the monolithic import function
        const result = await importMonolithicDrumKit(
          clientRef.current,
          {
            waveData: prepared.data,
            totalSampleCount: prepared.sampleCount,
            slices,
            sampleRate: bundle.sampleRate as 15000 | 30000,
            startingToneSlot,
            waveBank,
            startingSegment,
            patchSlot: targetPatchSlot,
            patchName,
            transpose: bundle.transpose,
            velocitySensitivity: bundle.velocitySensitivity,
          },
          (current, total, status) => {
            // The monolithic import callback passes a fraction (0-1) for
            // the wave upload step, and integer step numbers for sub-tone/patch steps.
            const isWaveUpload = current < 1 && status.includes('wave data');
            setImportProgress({
              currentStep: isWaveUpload ? 1 : Math.ceil(current) + 1,
              totalSteps: total + 1,
              stepLabel: isWaveUpload ? `Uploading ${patchName} wave data` : status,
              bytesSent: isWaveUpload ? Math.floor(current * waveTotalBytes) : 0,
              bytesTotal: isWaveUpload ? waveTotalBytes : 0,
              bytesSentAllSteps: isWaveUpload ? 0 : waveTotalBytes,
              bytesTotalAllSteps: waveTotalBytes,
            });
          }
        );

        // Update local state with the created tones
        setTone(result.primaryToneSlot, result.primaryTone);
        for (let i = 0; i < result.subTones.length; i++) {
          setTone(result.subToneSlots[i]!, result.subTones[i]!);
        }
        setPatch(result.patchSlot, result.patch);

        // Brief delay to show completion
        await new Promise((resolve) => setTimeout(resolve, 500));
        return;
      }

      // =========================================================================
      // STANDARD MODE (separate wave per slice)
      // =========================================================================
      // Check if this is a v2 format bundle (source + slices)
      const isV2Format = bundle.source && bundle.slices && bundle.slices.length > 0;

      // Collect all samples with their info
      const samples: Array<{
        filename: string;
        drumType: string;
        kitNumber: number;
        midiNote: number;
        // For v2: slice info
        slice?: SliceDefinition;
      }> = [];

      if (isV2Format) {
        // V2 format: build samples from slices
        const slices = bundle.slices!;
        for (let i = 0; i < slices.length; i++) {
          const slice = slices[i]!;
          const kitNumber = Math.floor(i / 4) + 1;
          const kitMidiBase = bundle.baseNote + Math.floor(i / 4) * 4;
          const midiNote = kitMidiBase + (i % 4);

          samples.push({
            filename: slice.label,
            drumType: slice.label,
            kitNumber,
            midiNote,
            slice,
          });
        }
      } else {
        // V1 format: collect from kits
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
      }

      const totalSteps = samples.length + 1; // samples + patch
      let completedSteps = 0;
      let currentSegment = startingSegment;
      let completedWaveBytes = 0;

      // For v2 format, load source WAV once
      let sourceWav: { samples: Int16Array; sampleRate: number } | null = null;
      if (isV2Format) {
        setImportProgress({
          currentStep: 1, totalSteps: totalSteps,
          stepLabel: 'Loading source audio...', bytesSent: 0, bytesTotal: 0,
          bytesSentAllSteps: 0, bytesTotalAllSteps: 0,
        });
        sourceWav = await loadDrumKitSource(libraryHandle, kitName, bundle.source!, path);
      }

      // Import each sample as a tone
      for (let i = 0; i < samples.length; i++) {
        const sample = samples[i]!;
        const toneSlot = startingToneSlot + i;

        let prepared;

        if (isV2Format && sourceWav && sample.slice) {
          // V2 format: chop slice from source
          const sliceSamples = sourceWav.samples.slice(
            sample.slice.startSample,
            sample.slice.endSample
          );

          // Resample to target rate if needed
          let targetSamples: Int16Array;
          if (sourceWav.sampleRate !== bundle.sampleRate) {
            targetSamples = resample(sliceSamples, sourceWav.sampleRate, bundle.sampleRate);
          } else {
            targetSamples = sliceSamples;
          }

          // Prepare for S-330 (pack to 12-bit format)
          prepared = prepareWavForS330(
            createWavArrayBuffer(targetSamples, bundle.sampleRate),
            bundle.sampleRate
          );
        } else {
          // V1 format: load individual WAV file
          const wavBytes = await loadDrumKitSample(libraryHandle, kitName, sample.filename, path);
          prepared = prepareWavForS330(wavBytes.buffer as ArrayBuffer, bundle.sampleRate);
        }

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
          bundle.transpose ?? 0,
          bundle.velocitySensitivity ?? 2
        );

        const stepNum = completedSteps + 1;

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
            setImportProgress({
              currentStep: stepNum, totalSteps,
              stepLabel: `Uploading ${sample.filename} (tone ${i + 1} of ${samples.length})`,
              bytesSent, bytesTotal: totalBytes,
              bytesSentAllSteps: completedWaveBytes,
              bytesTotalAllSteps: completedWaveBytes + totalBytes,
            });
          }
        );

        // Update local state
        setTone(toneSlot, tone);

        // Move to next segment
        currentSegment += prepared.segmentLength;
        completedWaveBytes += prepared.data.length;
        completedSteps++;

        // Give the S-330 time to process wave data before next upload
        // The S-330 needs significant time to write to internal memory
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Create and upload patches
      if (useSinglePatch) {
        // Single patch mode: create one patch with all tone mappings
        setImportProgress({
          currentStep: totalSteps, totalSteps,
          stepLabel: `Creating patch ${patchName}`,
          bytesSent: 0, bytesTotal: 0,
          bytesSentAllSteps: completedWaveBytes, bytesTotalAllSteps: completedWaveBytes,
        });

        const toneMappings = samples.map((sample, i) => ({
          midiNote: sample.midiNote,
          toneSlot: startingToneSlot + i,
        }));

        const patch = createDrumKitPatch(patchName, toneMappings);
        await clientRef.current.sendPatchData(targetPatchSlot, patch.common);
        setPatch(targetPatchSlot, patch);
      } else {
        // Multi-patch mode: create one patch per sample
        for (let i = 0; i < samples.length; i++) {
          const sample = samples[i]!;
          const toneSlot = startingToneSlot + i;
          const patchSlot = targetPatchSlot + i;

          // Create patch name from drum type and kit number
          const samplePatchName = `${sample.drumType.slice(0, 4).toUpperCase()}${sample.kitNumber}`;

          const patch = createSingleDrumPatch(samplePatchName, toneSlot, sample.midiNote);

          setImportProgress({
            currentStep: completedSteps + 1 + i, totalSteps: totalSteps + samples.length - 1,
            stepLabel: `Creating patch ${samplePatchName} (${i + 1} of ${samples.length})`,
            bytesSent: 0, bytesTotal: 0,
            bytesSentAllSteps: completedWaveBytes, bytesTotalAllSteps: completedWaveBytes,
          });
          await clientRef.current.sendPatchData(patchSlot, patch.common);
          setPatch(patchSlot, patch);

          // Small delay between patch uploads
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

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

  /**
   * Helper to create a minimal WAV ArrayBuffer from Int16Array samples.
   * Used for v2 format when chopping slices.
   */
  function createWavArrayBuffer(samples: Int16Array, sampleRate: number): ArrayBuffer {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = samples.length * (bitsPerSample / 8);
    const fileSize = 44 + dataSize;

    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);

    // RIFF header
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, fileSize - 8, true);
    view.setUint32(8, 0x57415645, false); // "WAVE"

    // fmt subchunk
    view.setUint32(12, 0x666D7420, false); // "fmt "
    view.setUint32(16, 16, true); // Subchunk1Size (PCM)
    view.setUint16(20, 1, true); // AudioFormat (PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    // data subchunk
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, dataSize, true);

    // Write samples
    const dataOffset = 44;
    for (let i = 0; i < samples.length; i++) {
      view.setInt16(dataOffset + i * 2, samples[i]!, true);
    }

    return buffer;
  }

  return {
    importDrumKitDialog,
    isImporting,
    importProgress,
    importError,
    openImportDrumKitDialog,
    closeImportDrumKitDialog,
    handleImportDrumKit,
  };
}
