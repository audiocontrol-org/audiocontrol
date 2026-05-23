/**
 * Patch loading helpers for ImportLibraryPatchDialog.
 *
 * Extracted from the host dialog file so the dialog stays under the
 * 500-line cap. The host owns chrome + state; this file owns the
 * pure-data loading logic (patch + tone-bundle materialisation,
 * allocation suggestion).
 */

import type { SamplerTone, SamplerPatch } from '@/core/midi/SamplerClient';
import type {
  StorageDirectoryHandle,
} from '@audiocontrol/sampler-library/browser';
import {
  loadPatchFromSet,
  loadToneFromSet,
  loadSetManifest,
  loadIndividualPatch,
  convertYamlToS330Patch,
  convertYamlToS330Tone,
  getPatchToneDependencies,
} from '@/lib/library-service';
import {
  suggestPatchAllocation,
  type WaveBankIndex,
} from '@/lib/slot-allocation';
import type { ToneImportMapping } from '@/components/library/ImportLibraryPatchDialogBody';

export interface DependentTone {
  originalSlot: number;
  segmentsNeeded: number;
  fileName: string;
  preferredBank: WaveBankIndex;
}

export interface LoadPatchResult {
  patch: SamplerPatch;
  toneMappings: ToneImportMapping[];
  missingToneSlots: number[];
  patchSlot: number;
}

export interface LoadPatchOptions {
  libraryHandle: StorageDirectoryHandle;
  setName: string;
  patchFile: string;
  patchPath?: string[];
  deviceTones: (SamplerTone | undefined)[];
  devicePatches: (SamplerPatch | undefined)[];
  initialTargetSlot?: number;
}

/**
 * Load a patch + its dependent tones, resolve a suggested allocation,
 * and produce the initial ToneImportMapping[] for the dialog's table.
 *
 * Throws on load / parse failure. The caller is responsible for
 * capturing the error and feeding it into setLocalError so the v3
 * SlideDrawer's step-log renders a failed row (BUG-002 contract).
 */
export async function loadPatchForImport({
  libraryHandle,
  setName,
  patchFile,
  patchPath,
  deviceTones,
  devicePatches,
  initialTargetSlot,
}: LoadPatchOptions): Promise<LoadPatchResult> {
  const isIndividual = setName === '__individual__';
  let convertedPatch: SamplerPatch;
  let dependentTones: DependentTone[] = [];
  let missing: number[] = [];

  if (isIndividual) {
    const bundle = await loadIndividualPatch(
      libraryHandle,
      patchFile,
      patchPath ?? [],
    );
    convertedPatch = convertYamlToS330Patch(bundle.patch);

    const requiredTones = getPatchToneDependencies(convertedPatch);
    for (const slot of requiredTones) {
      const toneData = bundle.tones.get(slot);
      if (toneData) {
        const convertedTone = convertYamlToS330Tone(toneData.yaml);
        dependentTones.push({
          originalSlot: slot,
          segmentsNeeded: toneData.segmentsNeeded,
          fileName: `T${String(slot + 1).padStart(2, '0')}`,
          preferredBank: convertedTone.wave.bank as WaveBankIndex,
        });
      } else {
        missing.push(slot);
      }
    }
  } else {
    const loadedManifest = await loadSetManifest(libraryHandle, setName);
    const patchYaml = await loadPatchFromSet(
      libraryHandle,
      setName,
      patchFile,
    );
    convertedPatch = convertYamlToS330Patch(patchYaml);

    const requiredTones = getPatchToneDependencies(convertedPatch);
    for (const slot of requiredTones) {
      const toneEntry = loadedManifest.tones.find((t) => t.slot === slot);
      if (toneEntry) {
        dependentTones.push({
          originalSlot: slot,
          segmentsNeeded: toneEntry.waveAllocation.segmentLength,
          fileName: toneEntry.file,
          preferredBank: toneEntry.waveAllocation.bank,
        });
      } else {
        missing.push(slot);
      }
    }
  }

  const allocation = suggestPatchAllocation(
    deviceTones,
    devicePatches,
    dependentTones.map((t) => ({
      originalSlot: t.originalSlot,
      segmentsNeeded: t.segmentsNeeded,
    })),
    initialTargetSlot,
    dependentTones[0]?.preferredBank,
  );

  const patchSlot =
    initialTargetSlot !== undefined ? initialTargetSlot : allocation.patchSlot;

  const toneMappings: ToneImportMapping[] = dependentTones.map(
    (tone, index) => {
      const toneAlloc = allocation.toneAllocations[index];
      return {
        originalSlot: tone.originalSlot,
        fileName: tone.fileName,
        targetSlot: toneAlloc?.suggestedSlot ?? tone.originalSlot,
        waveBank: toneAlloc?.waveMemory?.bank ?? tone.preferredBank,
        segmentTop: toneAlloc?.waveMemory?.segmentTop ?? 0,
        segmentsNeeded: tone.segmentsNeeded,
      };
    },
  );

  return {
    patch: convertedPatch,
    toneMappings,
    missingToneSlots: missing,
    patchSlot,
  };
}

export interface MaterialiseToneOptions {
  libraryHandle: StorageDirectoryHandle;
  setName: string;
  patchFile: string;
  patchPath?: string[];
  toneMappings: ToneImportMapping[];
}

export interface MaterialisedTone {
  tone: SamplerTone;
  wavData: Uint8Array;
  targetSlot: number;
  waveBank: number;
  segmentTop: number;
  segmentLength: number;
}

/**
 * Materialise the dependent tones for the import — re-load them from
 * the same library handle, attach the user-edited target slot + wave
 * bank + segment-top from the mapping table, and return the array the
 * onImport callback expects.
 */
export async function materialiseDependentTones({
  libraryHandle,
  setName,
  patchFile,
  patchPath,
  toneMappings,
}: MaterialiseToneOptions): Promise<MaterialisedTone[]> {
  const isIndividual = setName === '__individual__';
  const tonesData: MaterialisedTone[] = [];

  if (isIndividual) {
    const bundle = await loadIndividualPatch(
      libraryHandle,
      patchFile,
      patchPath ?? [],
    );
    for (const mapping of toneMappings) {
      const toneData = bundle.tones.get(mapping.originalSlot);
      if (!toneData) {
        throw new Error(
          `Tone at slot ${mapping.originalSlot} not found in bundle`,
        );
      }
      const tone = convertYamlToS330Tone(toneData.yaml);
      tonesData.push({
        tone,
        wavData: toneData.wavData,
        targetSlot: mapping.targetSlot,
        waveBank: mapping.waveBank,
        segmentTop: mapping.segmentTop,
        segmentLength: toneData.segmentsNeeded,
      });
    }
  } else {
    for (const mapping of toneMappings) {
      const { yaml, wavData } = await loadToneFromSet(
        libraryHandle,
        setName,
        mapping.fileName,
      );
      const tone = convertYamlToS330Tone(yaml);
      tonesData.push({
        tone,
        wavData,
        targetSlot: mapping.targetSlot,
        waveBank: mapping.waveBank,
        segmentTop: mapping.segmentTop,
        segmentLength: mapping.segmentsNeeded,
      });
    }
  }

  return tonesData;
}
