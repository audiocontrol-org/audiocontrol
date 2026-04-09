/**
 * useImportSamples Hook
 *
 * Handles importing sample bundles to the device.
 * Supports drum kit bundles (v1/v2) and samples from common library.
 *
 * Creates tones with one-shot loop mode and a patch with correct MIDI mappings.
 */

import { useState, useCallback, MutableRefObject } from 'react';
import type { OperationState, OperationProgress } from '@/types/import-operation';
import type { SamplerClientInterface, SamplerTone, SamplerPatch } from '@/core/midi/SamplerClient';
import type { ResolvedDrumKitBundle, ChoppedSample, StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import {
  createEmptyToneLayer,
  setToneAtMidiNote,
  createDrumTone,
  createDrumKitPatch,
  resample,
  importMonolithicDrumKit,
} from '@audiocontrol/sampler-devices/s330';
import {
  loadChoppedSampleSource,
  prepareWavForS330,
} from '@/lib/library-service';

// =========================================================================
// SampleImportBundle — unified import type
// =========================================================================

export interface SampleImportSlice {
  label: string;
  startSample: number;
  endSample: number;
  midiNote: number;
  /** For v1 drum kits: individual WAV filename */
  filename?: string;
}

export interface SampleImportBundle {
  name: string;
  sampleRate: 15000 | 30000;
  /** Source WAV filename (undefined for v1 drum kits with individual WAVs) */
  source?: string;
  slices: SampleImportSlice[];
  transpose?: number;
  velocitySensitivity?: number;
  /** Display metadata: number of kits for drum kit bundles */
  kitCount?: number;
}

export type ImportSourceLocation = 'drumKit' | 'sample';

// =========================================================================
// Converter functions
// =========================================================================

/**
 * Convert a ResolvedDrumKitBundle to a SampleImportBundle.
 *
 * - v2 bundles (source + slices): maps slices with MIDI note assignment
 * - v1 bundles (individual WAVs): maps kit samples with filenames
 */
export function drumKitBundleToImportBundle(bundle: ResolvedDrumKitBundle): SampleImportBundle {
  const isV2 = bundle.source && bundle.slices && bundle.slices.length > 0;

  if (isV2) {
    const slices: SampleImportSlice[] = bundle.slices!.map((slice, i) => {
      const kitMidiBase = bundle.baseNote + Math.floor(i / 4) * 4;
      const midiNote = kitMidiBase + (i % 4);
      return {
        label: slice.label,
        startSample: slice.startSample,
        endSample: slice.endSample,
        midiNote,
      };
    });

    return {
      name: bundle.name,
      sampleRate: bundle.sampleRate,
      source: bundle.source,
      slices,
      transpose: bundle.transpose,
      velocitySensitivity: bundle.velocitySensitivity,
      kitCount: bundle.kits.length,
    };
  }

  // v1: individual WAV files
  const drumOrder = ['kick', 'snare', 'hhClosed', 'hhOpen'] as const;
  const slices: SampleImportSlice[] = [];

  for (const kit of bundle.kits) {
    for (const drumType of drumOrder) {
      const filename = kit.samples[drumType];
      if (filename) {
        slices.push({
          label: `${drumType.slice(0, 4).toUpperCase()}${kit.kitNumber}`,
          startSample: 0,
          endSample: 0,
          midiNote: kit.midiNotes[drumType],
          filename,
        });
      }
    }
  }

  return {
    name: bundle.name,
    sampleRate: bundle.sampleRate,
    slices,
    transpose: bundle.transpose,
    velocitySensitivity: bundle.velocitySensitivity,
    kitCount: bundle.kits.length,
  };
}

/**
 * Convert a sample manifest (ChoppedSample) to a SampleImportBundle.
 *
 * Uses midi: trigger mappings from manifest when present.
 * Slices without a midi: trigger get consecutive notes from baseNote.
 */
export function sampleManifestToImportBundle(
  manifest: ChoppedSample,
  targetSampleRate: 15000 | 30000,
  baseNote: number
): SampleImportBundle {
  // Build MIDI note assignments from triggers
  const midiAssignments = new Map<number, number>();
  if (manifest.triggers) {
    for (const trigger of manifest.triggers) {
      const midiMatch = trigger.triggerId.match(/^midi:(\d+)$/);
      if (midiMatch) {
        midiAssignments.set(trigger.sliceIndex, parseInt(midiMatch[1]!, 10));
      }
    }
  }

  // Find the highest assigned MIDI note for gap-filling
  let highestAssigned = baseNote - 1;
  for (const note of midiAssignments.values()) {
    if (note > highestAssigned) {
      highestAssigned = note;
    }
  }

  // Assign consecutive notes to unassigned slices
  let nextNote = highestAssigned + 1;
  const slices: SampleImportSlice[] = manifest.slices.map((slice, i) => {
    let midiNote: number;
    if (midiAssignments.has(i)) {
      midiNote = midiAssignments.get(i)!;
    } else {
      midiNote = nextNote++;
    }
    return {
      label: slice.label,
      startSample: slice.startSample,
      endSample: slice.endSample,
      midiNote,
    };
  });

  return {
    name: manifest.name,
    sampleRate: targetSampleRate,
    source: manifest.source,
    slices,
    transpose: manifest.variant === 'drum-kit' ? manifest.drumKit.transpose : undefined,
    velocitySensitivity: manifest.variant === 'drum-kit' ? manifest.drumKit.velocitySensitivity : undefined,
  };
}

// =========================================================================
// Dialog state
// =========================================================================

export interface ImportSamplesDialogState {
  name: string;
  bundle: SampleImportBundle;
  path?: string[];
  sourceLocation: ImportSourceLocation;
}

interface UseImportSamplesOptions {
  clientRef: MutableRefObject<SamplerClientInterface | null>;
  libraryHandle: StorageDirectoryHandle | null;
  setTone: (index: number, tone: SamplerTone) => void;
  setPatch: (index: number, patch: SamplerPatch) => void;
}

interface UseImportSamplesReturn extends OperationState {
  importSamplesDialog: ImportSamplesDialogState | null;
  openImportSamplesDialog: (
    name: string,
    bundle: SampleImportBundle,
    sourceLocation: ImportSourceLocation,
    path?: string[]
  ) => void;
  closeImportSamplesDialog: () => void;
  handleImportSamples: (params: {
    startingToneSlot: number;
    waveBank: 0 | 1 | 2 | 3;
    startingSegment: number;
    targetPatchSlot: number;
    singlePatch?: boolean;
    patchName?: string;
    useMonolithicMode?: boolean;
  }) => Promise<void>;
}

// =========================================================================
// WAV utilities
// =========================================================================

/**
 * Create a minimal WAV ArrayBuffer from Int16Array samples.
 */
export function createWavArrayBuffer(samples: Int16Array, sampleRate: number): ArrayBuffer {
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
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data subchunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataSize, true);

  const dataOffset = 44;
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(dataOffset + i * 2, samples[i]!, true);
  }

  return buffer;
}

// =========================================================================
// Patch helpers
// =========================================================================

function createSingleDrumPatch(
  name: string,
  toneSlot: number,
  midiNote: number
): SamplerPatch {
  const toneLayer1 = createEmptyToneLayer(1);
  setToneAtMidiNote(toneLayer1, midiNote, toneSlot);

  return {
    common: {
      name: name.slice(0, 12).toUpperCase().padEnd(12, ' '),
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
      outputAssign: 8,
    },
  };
}

// =========================================================================
// Source loading
// =========================================================================

async function loadSourceWav(
  libraryHandle: StorageDirectoryHandle,
  name: string,
  sourceFilename: string,
  sourceLocation: ImportSourceLocation,
  path: string[]
): Promise<{ samples: Int16Array; sampleRate: number }> {
  if (sourceLocation === 'drumKit') {
    throw new Error('Device-specific drum kit storage has been removed. Drum kits are now common-area objects.');
  }
  return loadChoppedSampleSource(libraryHandle, name, sourceFilename, path);
}

// =========================================================================
// Hook
// =========================================================================

export function useImportSamples({
  clientRef,
  libraryHandle,
  setTone,
  setPatch,
}: UseImportSamplesOptions): UseImportSamplesReturn {
  const [importSamplesDialog, setImportSamplesDialog] = useState<ImportSamplesDialogState | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<OperationProgress | undefined>(undefined);
  const [importError, setImportError] = useState<string | null>(null);

  const openImportSamplesDialog = useCallback((
    name: string,
    bundle: SampleImportBundle,
    sourceLocation: ImportSourceLocation,
    path?: string[]
  ) => {
    setImportError(null);
    setImportProgress(undefined);
    setImportSamplesDialog({ name, bundle, path, sourceLocation });
  }, []);

  const closeImportSamplesDialog = useCallback(() => {
    setImportSamplesDialog(null);
  }, []);

  const handleImportSamples = useCallback(async (params: {
    startingToneSlot: number;
    waveBank: 0 | 1 | 2 | 3;
    startingSegment: number;
    targetPatchSlot: number;
    singlePatch?: boolean;
    patchName?: string;
    useMonolithicMode?: boolean;
  }) => {
    if (!clientRef.current || !libraryHandle || !importSamplesDialog) {
      throw new Error('Missing required resources for import');
    }

    const { bundle, name, path, sourceLocation } = importSamplesDialog;
    const { startingToneSlot, startingSegment, targetPatchSlot } = params;
    const waveBank = params.waveBank as 0 | 1;
    const useSinglePatch = params.singlePatch ?? true;
    const patchName = params.patchName || name;
    const useMonolithicMode = params.useMonolithicMode ?? false;
    const totalSamples = bundle.slices.length;

    setIsImporting(true);
    setImportProgress(undefined);
    setImportError(null);

    try {
      // ===================================================================
      // MONOLITHIC MODE
      // ===================================================================
      if (useMonolithicMode) {
        if (!bundle.source) {
          throw new Error('Monolithic mode requires a source WAV file');
        }

        const monoTotalSteps = totalSamples + 2;
        setImportProgress({
          currentStep: 1, totalSteps: monoTotalSteps,
          stepLabel: 'Loading source audio...', bytesSent: 0, bytesTotal: 0,
          bytesSentAllSteps: 0, bytesTotalAllSteps: 0,
        });

        const sourceWav = await loadSourceWav(
          libraryHandle, name, bundle.source, sourceLocation, path ?? []
        );

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

        setImportProgress({
          currentStep: 1, totalSteps: monoTotalSteps,
          stepLabel: 'Preparing wave data...', bytesSent: 0, bytesTotal: 0,
          bytesSentAllSteps: 0, bytesTotalAllSteps: 0,
        });
        const prepared = prepareWavForS330(
          createWavArrayBuffer(targetSamples, bundle.sampleRate),
          bundle.sampleRate
        );

        const waveTotalBytes = prepared.data.length;

        const result = await importMonolithicDrumKit(
          clientRef.current,
          {
            waveData: prepared.data,
            totalSampleCount: prepared.sampleCount,
            slices: bundle.slices,
            sampleRate: bundle.sampleRate,
            startingToneSlot,
            waveBank,
            startingSegment,
            patchSlot: targetPatchSlot,
            patchName,
            transpose: bundle.transpose,
            velocitySensitivity: bundle.velocitySensitivity,
          },
          (current, total, status) => {
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

        setTone(result.primaryToneSlot, result.primaryTone);
        for (let i = 0; i < result.subTones.length; i++) {
          setTone(result.subToneSlots[i]!, result.subTones[i]!);
        }
        setPatch(result.patchSlot, result.patch);

        await new Promise((resolve) => setTimeout(resolve, 500));
        return;
      }

      // ===================================================================
      // STANDARD MODE
      // ===================================================================
      const hasSource = !!bundle.source;
      const totalSteps = totalSamples + 1;
      let completedSteps = 0;
      let currentSegment = startingSegment;
      let completedWaveBytes = 0;

      // Load source WAV once if available
      let sourceWav: { samples: Int16Array; sampleRate: number } | null = null;
      if (hasSource) {
        setImportProgress({
          currentStep: 1, totalSteps,
          stepLabel: 'Loading source audio...', bytesSent: 0, bytesTotal: 0,
          bytesSentAllSteps: 0, bytesTotalAllSteps: 0,
        });
        sourceWav = await loadSourceWav(
          libraryHandle, name, bundle.source!, sourceLocation, path ?? []
        );
      }

      // Import each slice as a tone
      for (let i = 0; i < totalSamples; i++) {
        const slice = bundle.slices[i]!;
        const toneSlot = startingToneSlot + i;

        let prepared;

        if (hasSource && sourceWav) {
          // Source-based: chop slice from source
          const sliceSamples = sourceWav.samples.slice(
            slice.startSample,
            slice.endSample
          );

          let targetSamples: Int16Array;
          if (sourceWav.sampleRate !== bundle.sampleRate) {
            targetSamples = resample(sliceSamples, sourceWav.sampleRate, bundle.sampleRate);
          } else {
            targetSamples = sliceSamples;
          }

          prepared = prepareWavForS330(
            createWavArrayBuffer(targetSamples, bundle.sampleRate),
            bundle.sampleRate
          );
        } else if (slice.filename) {
          // v1 individual WAV files — device-specific drum kit storage has been removed
          throw new Error(`Device-specific drum kit storage has been removed. Slice "${slice.label}" cannot be loaded from the old format.`);
        } else {
          throw new Error(`Slice "${slice.label}" has no source or filename`);
        }

        const toneName = slice.label.slice(0, 8).toUpperCase();

        const tone = createDrumTone(
          toneName,
          bundle.sampleRate,
          waveBank,
          currentSegment,
          prepared.segmentLength,
          prepared.sampleCount,
          slice.midiNote,
          bundle.transpose ?? 0,
          bundle.velocitySensitivity ?? 2
        );

        const stepNum = completedSteps + 1;

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
              stepLabel: `Uploading ${slice.label} (tone ${i + 1} of ${totalSamples})`,
              bytesSent, bytesTotal: totalBytes,
              bytesSentAllSteps: completedWaveBytes,
              bytesTotalAllSteps: completedWaveBytes + totalBytes,
            });
          }
        );

        setTone(toneSlot, tone);
        currentSegment += prepared.segmentLength;
        completedWaveBytes += prepared.data.length;
        completedSteps++;

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Create and upload patches
      if (useSinglePatch) {
        setImportProgress({
          currentStep: totalSteps, totalSteps,
          stepLabel: `Creating patch ${patchName}`,
          bytesSent: 0, bytesTotal: 0,
          bytesSentAllSteps: completedWaveBytes, bytesTotalAllSteps: completedWaveBytes,
        });

        const toneMappings = bundle.slices.map((slice, i) => ({
          midiNote: slice.midiNote,
          toneSlot: startingToneSlot + i,
        }));

        const patch = createDrumKitPatch(patchName, toneMappings);
        await clientRef.current.sendPatchData(targetPatchSlot, patch.common);
        setPatch(targetPatchSlot, patch);
      } else {
        for (let i = 0; i < totalSamples; i++) {
          const slice = bundle.slices[i]!;
          const toneSlot = startingToneSlot + i;
          const patchSlot = targetPatchSlot + i;
          const samplePatchName = slice.label.slice(0, 12).toUpperCase();

          const patch = createSingleDrumPatch(samplePatchName, toneSlot, slice.midiNote);

          setImportProgress({
            currentStep: completedSteps + 1 + i, totalSteps: totalSteps + totalSamples - 1,
            stepLabel: `Creating patch ${samplePatchName} (${i + 1} of ${totalSamples})`,
            bytesSent: 0, bytesTotal: 0,
            bytesSentAllSteps: completedWaveBytes, bytesTotalAllSteps: completedWaveBytes,
          });
          await clientRef.current.sendPatchData(patchSlot, patch.common);
          setPatch(patchSlot, patch);

          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 500));

    } catch (err) {
      console.error('[useImportSamples] Failed to import samples:', err);
      setImportError(err instanceof Error ? err.message : 'Failed to import samples');
      throw err;
    } finally {
      setIsImporting(false);
    }
  }, [clientRef, libraryHandle, importSamplesDialog, setTone, setPatch]);

  return {
    importSamplesDialog,
    isOperating: isImporting,
    progress: importProgress,
    error: importError,
    openImportSamplesDialog,
    closeImportSamplesDialog,
    handleImportSamples,
  };
}
