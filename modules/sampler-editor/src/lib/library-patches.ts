/**
 * Individual patch operations — export, import, listing, loading,
 * dependency analysis, and deletion of patches in the library.
 */

import type { S330Tone, S330Patch, S330WaveDataResponse } from '@/core/midi/S330Client';
import {
  PatchYamlSchema,
  s330PatchConverter,
  type ToneYaml,
  type PatchYaml,
} from '@audiocontrol/sampler-library/browser';
import {
  type LibraryTreeNode,
  listPatchesTree as listPatchesTreeShared,
  getNestedDirectory,
} from '@audiocontrol/sampler-library/browser';
import {
  parseYaml,
  readToneFilesFromDirectory,
  writeToneFilesToDirectory,
  writePatchFileToDirectory,
  getToneFilename,
} from '@/lib/library-io';

// =========================================================================
// Patch Types
// =========================================================================

/**
 * Information about an individual patch bundle in the library.
 */
export interface LibraryPatchInfo {
  /** Patch name (from YAML) */
  name: string;
  /** Directory name for the patch bundle */
  directoryName: string;
  /** Number of dependent tones included */
  toneCount: number;
  /** Path segments from patches root (empty for root items) */
  path?: string[];
}

/**
 * Tone data to be included in a patch bundle export.
 */
export interface PatchBundleTone {
  /** Original tone slot index (0-31) */
  slot: number;
  /** The tone parameters */
  tone: S330Tone;
  /** The wave data response from device */
  waveData: S330WaveDataResponse;
}

/**
 * Result of loading a patch bundle from library.
 */
export interface LoadedPatchBundle {
  /** The patch parameters */
  patch: PatchYaml;
  /** Map of slot -> tone data for all included tones */
  tones: Map<number, { yaml: ToneYaml; wavData: Uint8Array; segmentsNeeded: number }>;
}

// =========================================================================
// YAML Conversion
// =========================================================================

/**
 * Convert PatchYaml back to S330Patch for device upload
 */
export function convertYamlToS330Patch(yaml: PatchYaml): S330Patch {
  return s330PatchConverter.fromYaml(yaml);
}

// =========================================================================
// Patch Dependency Analysis
// =========================================================================

/**
 * Get the tone indices that a patch actually depends on.
 *
 * THIS IS THE CANONICAL FUNCTION FOR PATCH TONE DEPENDENCY ANALYSIS.
 * Do not create duplicate or "simpler" versions of this function.
 *
 * Examines toneLayer1 and toneLayer2 arrays to find all unique tone indices.
 * Returns sorted array of tone slot indices (0-31).
 *
 * ============================================================================
 * CRITICAL: toneLayer2 HANDLING - READ BEFORE MODIFYING
 * ============================================================================
 *
 * toneLayer2 is ONLY meaningful when BOTH conditions are true:
 *   1. keyMode uses velocity switching ('v-sw', 'x-fade', 'v-mix')
 *   2. The corresponding toneLayer1 entry is >= 0 (key is assigned)
 *
 * Otherwise, toneLayer2 values are S-330 defaults (all 0s) and MUST be
 * ignored. If you naively iterate toneLayer2 looking for valid indices,
 * you will incorrectly include tone slot 0 (T01) for nearly every patch.
 *
 * This bug has been introduced multiple times by developers who created
 * "simpler" versions that skip the keyMode check. DO NOT DO THIS.
 *
 * See commit 405cb68 for the original fix and explanation.
 * ============================================================================
 */
export function getPatchToneDependencies(patch: S330Patch): number[] {
  const usedTones = new Set<number>();
  const { keyMode, toneLayer1, toneLayer2 } = patch.common;

  for (const toneIndex of toneLayer1) {
    if (toneIndex >= 0 && toneIndex <= 31) {
      usedTones.add(toneIndex);
    }
  }

  const usesVelocitySwitching = keyMode === 'v-sw' || keyMode === 'x-fade' || keyMode === 'v-mix';
  if (usesVelocitySwitching) {
    for (let i = 0; i < toneLayer2.length; i++) {
      if (toneLayer1[i] >= 0) {
        const toneIndex = toneLayer2[i];
        if (toneIndex >= 0 && toneIndex <= 31) {
          usedTones.add(toneIndex);
        }
      }
    }
  }

  return Array.from(usedTones).sort((a, b) => a - b);
}

/**
 * Remap tone indices in a patch's tone layers.
 */
export function remapPatchToneLayers(
  patch: S330Patch,
  toneMapping: Map<number, number>
): S330Patch {
  const newToneLayer1 = patch.common.toneLayer1.map((toneIndex) => {
    if (toneIndex < 0) return toneIndex;
    return toneMapping.get(toneIndex) ?? toneIndex;
  });

  const newToneLayer2 = patch.common.toneLayer2.map((toneIndex) => {
    if (toneIndex < 0) return toneIndex;
    return toneMapping.get(toneIndex) ?? toneIndex;
  });

  return {
    common: {
      ...patch.common,
      toneLayer1: newToneLayer1,
      toneLayer2: newToneLayer2,
    },
  };
}

// =========================================================================
// Listing
// =========================================================================

/**
 * List all individual patch bundles in the library (outside of sets).
 *
 * @deprecated Use listIndividualPatchesTree for hierarchical view
 */
export async function listIndividualPatches(
  directoryHandle: FileSystemDirectoryHandle
): Promise<LibraryPatchInfo[]> {
  const patches: LibraryPatchInfo[] = [];

  try {
    const patchesDir = await getNestedDirectory(directoryHandle, [
      'library', 's330', 'patches'
    ]);

    for await (const entry of patchesDir.values()) {
      if (entry.kind === 'directory') {
        try {
          const patchDir = await patchesDir.getDirectoryHandle(entry.name);
          const yamlHandle = await patchDir.getFileHandle('patch.yaml');
          const yamlFile = await yamlHandle.getFile();
          const content = await yamlFile.text();
          const yaml = parseYaml(content) as { name?: string };

          let toneCount = 0;
          try {
            const tonesDir = await patchDir.getDirectoryHandle('tones');
            for await (const toneEntry of tonesDir.values()) {
              if (toneEntry.kind === 'file' && toneEntry.name.endsWith('.yaml')) {
                toneCount++;
              }
            }
          } catch {
            // No tones directory
          }

          patches.push({
            name: yaml.name || entry.name,
            directoryName: entry.name,
            toneCount,
          });
        } catch {
          // Not a valid patch bundle, skip
        }
      }
    }
  } catch {
    // Directory doesn't exist yet
  }

  return patches.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * List all individual patches in the library as a hierarchical tree.
 */
export async function listIndividualPatchesTree(
  directoryHandle: FileSystemDirectoryHandle
): Promise<LibraryTreeNode[]> {
  return listPatchesTreeShared(directoryHandle, 's330');
}

// =========================================================================
// Export and Load
// =========================================================================

/**
 * Export a patch bundle to the library with all dependent tones.
 */
export async function exportPatchToDirectory(
  directoryHandle: FileSystemDirectoryHandle,
  patch: S330Patch,
  tones: PatchBundleTone[],
  customName?: string,
  onProgress?: (progress: number) => void,
  path: string[] = []
): Promise<void> {
  const patchName = customName || patch.common.name || 'untitled';
  const sanitizedName = patchName.replace(/[<>:"/\\|?*]/g, '_').trim();

  onProgress?.(5);

  const patchesDir = await getNestedDirectory(directoryHandle, ['library', 's330', 'patches', ...path]);
  const patchDir = await patchesDir.getDirectoryHandle(sanitizedName, { create: true });
  const tonesDir = await patchDir.getDirectoryHandle('tones', { create: true });

  onProgress?.(10);

  const totalTones = tones.length;
  for (let i = 0; i < totalTones; i++) {
    const { slot, tone, waveData } = tones[i];
    const toneFilename = getToneFilename(slot, tone.name);

    await writeToneFilesToDirectory(tonesDir, tone, waveData, toneFilename);

    onProgress?.(10 + Math.floor(((i + 1) / totalTones) * 70));
  }

  const patchToWrite = customName
    ? { ...patch, common: { ...patch.common, name: customName } }
    : patch;
  await writePatchFileToDirectory(patchDir, patchToWrite, 'patch');

  onProgress?.(100);
}

/**
 * Load an individual patch bundle from the library.
 */
export async function loadIndividualPatch(
  directoryHandle: FileSystemDirectoryHandle,
  patchDirName: string,
  path: string[] = []
): Promise<LoadedPatchBundle> {
  const patchesDir = await getNestedDirectory(directoryHandle, [
    'library', 's330', 'patches', ...path
  ]);

  const patchDir = await patchesDir.getDirectoryHandle(patchDirName);

  const patchHandle = await patchDir.getFileHandle('patch.yaml');
  const patchFile = await patchHandle.getFile();
  const patchContent = await patchFile.text();
  const patch = PatchYamlSchema.parse(parseYaml(patchContent));

  const tones = new Map<number, { yaml: ToneYaml; wavData: Uint8Array; segmentsNeeded: number }>();

  try {
    const tonesDir = await patchDir.getDirectoryHandle('tones');

    for await (const entry of tonesDir.values()) {
      if (entry.kind === 'file' && entry.name.endsWith('.yaml')) {
        const match = entry.name.match(/^T(\d{2})(?:\s|\.yaml)/);
        if (!match) continue;

        const slot = parseInt(match[1], 10) - 1;
        if (slot < 0 || slot >= 32) continue;

        const baseFilename = entry.name.replace('.yaml', '');

        const { yaml, wavData, segmentsNeeded } = await readToneFilesFromDirectory(tonesDir, baseFilename);
        tones.set(slot, { yaml, wavData, segmentsNeeded });
      }
    }
  } catch {
    // No tones directory
  }

  return { patch, tones };
}

/**
 * Delete an individual patch bundle from the library.
 */
export async function deleteIndividualPatch(
  directoryHandle: FileSystemDirectoryHandle,
  patchDirName: string,
  path: string[] = []
): Promise<void> {
  const patchesDir = await getNestedDirectory(directoryHandle, [
    'library', 's330', 'patches', ...path
  ]);

  await patchesDir.removeEntry(patchDirName, { recursive: true });
}
