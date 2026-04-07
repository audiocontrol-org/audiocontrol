/**
 * Drum kit operations — listing, loading, saving, updating,
 * and deleting drum kits in the library.
 */

import { parseWav } from '@/core/midi/S330Client';
import {
  DrumKitBundleSchema,
  loadDrumKitBundle as parseDrumKitBundle,
  type DrumKitBundle,
  type ResolvedDrumKitBundle,
  type LibraryTreeNode,
  type StorageDirectoryHandle,
  listDrumKitsTree as listDrumKitsTreeShared,
  getNestedDirectory,
} from '@audiocontrol/sampler-library/browser';
import { createWavBlobFromSamples } from '@/lib/wave-export';
import { parseYaml, stringifyYaml } from '@/lib/library-io';

// =========================================================================
// Types
// =========================================================================

/**
 * Information about a drum kit bundle in the library.
 */
export interface DrumKitInfo {
  /** Name of the drum kit (from kit.yaml or directory name) */
  name: string;
  /** Optional description */
  description?: string;
  /** Number of detected kits (4 samples each) */
  kitCount: number;
  /** Total number of samples */
  sampleCount: number;
  /** Directory name for loading */
  directoryName: string;
  /** Path segments from drum-kits root (empty for root items) */
  path?: string[];
}

/**
 * Slice definition for deferred chopping (version 2 format).
 */
export interface SliceDefinitionInput {
  /** Human-readable label for this slice (e.g., "kick", "snare") */
  label: string;
  /** Start position in samples (0-indexed) */
  startSample: number;
  /** End position in samples (exclusive) */
  endSample: number;
}

/**
 * Kit configuration that can be updated in edit mode.
 */
export interface DrumKitConfigUpdate {
  /** Transpose in semitones (-64 to +63, 0 = no change) */
  transpose?: number;
  /** Velocity-to-level sensitivity (0-5, default: 2) */
  velocitySensitivity?: number;
}

// =========================================================================
// Listing
// =========================================================================

/**
 * List all drum kit bundles in the library.
 *
 * @deprecated Use listDrumKitsTree for hierarchical view
 */
export async function listDrumKits(
  directoryHandle: StorageDirectoryHandle
): Promise<DrumKitInfo[]> {
  const kits: DrumKitInfo[] = [];

  try {
    const libraryDir = await directoryHandle.getDirectoryHandle('library', { create: false });
    const s330Dir = await libraryDir.getDirectoryHandle('s330', { create: false });
    const drumKitsDir = await s330Dir.getDirectoryHandle('drum-kits', { create: false });

    for await (const entry of drumKitsDir.values()) {
      if (entry.kind !== 'directory') continue;

      try {
        const kitDir = await drumKitsDir.getDirectoryHandle(entry.name);

        const wavFiles: string[] = [];
        let kitYaml: DrumKitBundle | null = null;

        for await (const file of kitDir.values()) {
          if (file.kind !== 'file') continue;

          if (file.name.toLowerCase().endsWith('.wav')) {
            wavFiles.push(file.name);
          } else if (file.name === 'kit.yaml') {
            try {
              const fileHandle = await kitDir.getFileHandle('kit.yaml');
              const yamlFile = await fileHandle.getFile();
              const yamlContent = await yamlFile.text();
              kitYaml = DrumKitBundleSchema.parse(parseYaml(yamlContent));
            } catch {
              // Invalid kit.yaml, ignore
            }
          }
        }

        if (wavFiles.length === 0) continue;

        const resolved = parseDrumKitBundle(kitYaml, wavFiles, entry.name);

        kits.push({
          name: resolved.name,
          description: resolved.description,
          kitCount: resolved.kits.length,
          sampleCount: resolved.totalSamples,
          directoryName: entry.name,
        });
      } catch {
        // Skip invalid directories
      }
    }
  } catch {
    return [];
  }

  return kits.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * List all drum kits in the library as a hierarchical tree.
 */
export async function listDrumKitsTree(
  directoryHandle: StorageDirectoryHandle
): Promise<LibraryTreeNode[]> {
  return listDrumKitsTreeShared(directoryHandle, 's330');
}

// =========================================================================
// Load, Save, Delete, Update
// =========================================================================

/**
 * Load a drum kit bundle with full metadata and sample information.
 */
export async function loadDrumKitBundle(
  directoryHandle: StorageDirectoryHandle,
  kitName: string,
  path: string[] = []
): Promise<ResolvedDrumKitBundle> {
  const kitDir = await getNestedDirectory(directoryHandle, [
    'library', 's330', 'drum-kits', ...path, kitName
  ]);

  const wavFiles: string[] = [];
  let kitYaml: DrumKitBundle | null = null;

  for await (const file of kitDir.values()) {
    if (file.kind !== 'file') continue;

    if (file.name.toLowerCase().endsWith('.wav')) {
      wavFiles.push(file.name);
    } else if (file.name === 'kit.yaml') {
      try {
        const fileHandle = await kitDir.getFileHandle('kit.yaml');
        const yamlFile = await fileHandle.getFile();
        const yamlContent = await yamlFile.text();
        kitYaml = DrumKitBundleSchema.parse(parseYaml(yamlContent));
      } catch {
        // Invalid kit.yaml, use auto-detection only
      }
    }
  }

  return parseDrumKitBundle(kitYaml, wavFiles, kitName);
}

/**
 * Delete a drum kit from the library.
 */
export async function deleteDrumKit(
  directoryHandle: StorageDirectoryHandle,
  kitName: string,
  path: string[] = []
): Promise<void> {
  const drumKitsDir = await getNestedDirectory(directoryHandle, [
    'library', 's330', 'drum-kits', ...path
  ]);

  await drumKitsDir.removeEntry(kitName, { recursive: true });
}

/**
 * Save a drum kit to the library using deferred chopping (v2 format).
 */
export async function saveDrumKitToLibrary(
  directoryHandle: StorageDirectoryHandle,
  kitName: string,
  sourceWav: { samples: Int16Array; sampleRate: number },
  slices: SliceDefinitionInput[],
  kitConfig: {
    name: string;
    description?: string;
    sampleRate: 15000 | 30000;
    baseNote: number;
    transpose?: number;
    velocitySensitivity?: number;
  }
): Promise<void> {
  const sanitizedName = kitName.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');

  const drumKitsDir = await getNestedDirectory(directoryHandle, [
    'library', 's330', 'drum-kits', sanitizedName
  ]);

  // Write source WAV file
  const sourceFilename = 'source.wav';
  const wavBlob = createWavBlobFromSamples(sourceWav.samples, sourceWav.sampleRate);
  const wavHandle = await drumKitsDir.getFileHandle(sourceFilename, { create: true });
  const wavWritable = await wavHandle.createWritable();
  await wavWritable.write(await wavBlob.arrayBuffer());
  await wavWritable.close();

  // Write kit.yaml with v2 format
  const kitYaml: DrumKitBundle = {
    format: 'drum-kit-bundle',
    version: 2,
    name: kitConfig.name,
    description: kitConfig.description,
    sampleRate: kitConfig.sampleRate,
    baseNote: kitConfig.baseNote,
    transpose: kitConfig.transpose,
    velocitySensitivity: kitConfig.velocitySensitivity ?? 2,
    source: sourceFilename,
    slices: slices.map((slice) => ({
      label: slice.label,
      startSample: slice.startSample,
      endSample: slice.endSample,
    })),
  };

  const yamlContent = stringifyYaml(kitYaml, { indent: 2, lineWidth: 120 });
  const yamlHandle = await drumKitsDir.getFileHandle('kit.yaml', { create: true });
  const yamlWritable = await yamlHandle.createWritable();
  await yamlWritable.write(yamlContent);
  await yamlWritable.close();
}

/**
 * Load a single WAV file from a drum kit bundle.
 */
export async function loadDrumKitSample(
  directoryHandle: StorageDirectoryHandle,
  kitName: string,
  fileName: string,
  path: string[] = []
): Promise<Uint8Array> {
  const kitDir = await getNestedDirectory(directoryHandle, [
    'library', 's330', 'drum-kits', ...path, kitName
  ]);

  const fileHandle = await kitDir.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  const arrayBuffer = await file.arrayBuffer();

  return new Uint8Array(arrayBuffer);
}

/**
 * Load the source WAV from a v2 drum kit bundle (deferred chopping).
 */
export async function loadDrumKitSource(
  directoryHandle: StorageDirectoryHandle,
  kitName: string,
  sourceFilename: string,
  path: string[] = []
): Promise<{ samples: Int16Array; sampleRate: number }> {
  const kitDir = await getNestedDirectory(directoryHandle, [
    'library', 's330', 'drum-kits', ...path, kitName
  ]);

  const fileHandle = await kitDir.getFileHandle(sourceFilename);
  const file = await fileHandle.getFile();
  const arrayBuffer = await file.arrayBuffer();

  const wavData = parseWav(arrayBuffer);

  return {
    samples: wavData.samples,
    sampleRate: wavData.sampleRate,
  };
}

/**
 * Save updated source audio back to a v2 drum kit bundle.
 * Overwrites the existing source WAV file.
 */
export async function saveDrumKitSource(
  directoryHandle: StorageDirectoryHandle,
  kitName: string,
  sourceFilename: string,
  samples: Int16Array,
  sampleRate: number,
  path: string[] = []
): Promise<void> {
  const kitDir = await getNestedDirectory(directoryHandle, [
    'library', 's330', 'drum-kits', ...path, kitName
  ]);

  const wavBlob = createWavBlobFromSamples(samples, sampleRate);
  const wavHandle = await kitDir.getFileHandle(sourceFilename, { create: true });
  const writable = await wavHandle.createWritable();
  await writable.write(await wavBlob.arrayBuffer());
  await writable.close();
}

/**
 * Update the slice definitions and optionally kit config in an existing v2 drum kit.
 */
export async function updateDrumKitSlices(
  directoryHandle: StorageDirectoryHandle,
  kitName: string,
  slices: SliceDefinitionInput[],
  kitConfig?: DrumKitConfigUpdate,
  path: string[] = []
): Promise<void> {
  const kitDir = await getNestedDirectory(directoryHandle, [
    'library', 's330', 'drum-kits', ...path, kitName
  ]);

  const yamlHandle = await kitDir.getFileHandle('kit.yaml');
  const yamlFile = await yamlHandle.getFile();
  const yamlContent = await yamlFile.text();
  const existingKit = DrumKitBundleSchema.parse(parseYaml(yamlContent));

  if (!existingKit.source) {
    throw new Error('Cannot update slices: kit is not in v2 format (missing source)');
  }

  const updatedKit: DrumKitBundle = {
    ...existingKit,
    version: 2,
    slices: slices.map((slice) => ({
      label: slice.label,
      startSample: slice.startSample,
      endSample: slice.endSample,
    })),
    ...(kitConfig?.transpose !== undefined && { transpose: kitConfig.transpose }),
    ...(kitConfig?.velocitySensitivity !== undefined && { velocitySensitivity: kitConfig.velocitySensitivity }),
  };

  const updatedYamlContent = stringifyYaml(updatedKit, { indent: 2, lineWidth: 120 });
  const writableHandle = await kitDir.getFileHandle('kit.yaml', { create: true });
  const writable = await writableHandle.createWritable();
  await writable.write(updatedYamlContent);
  await writable.close();
}
