/**
 * Set operations — listing, saving (batch), loading, deleting, and
 * renaming sets in the library.
 *
 * The incremental save (`saveDeviceToSetIncremental`) lives in its own
 * file (`library-sets-save-incremental.ts`) because its byte-accurate
 * `OperationProgress` reporting makes it substantial enough to warrant
 * a dedicated module. It is re-exported below so existing imports
 * (`from '@/lib/library-sets'` via `library-service.ts`) continue to
 * work unchanged.
 */

import {
  SetYamlSchema,
  deviceStateToSet,
  setToDeviceState,
  type ToneYaml,
  type PatchYaml,
  type SetYaml,
  type SetInfo,
  type DeviceStateInput,
  type SetToDeviceInput,
  type StorageDirectoryHandle,
  getNestedDirectory,
  copyDirectoryContents,
} from '@audiocontrol/sampler-library/browser';
import type { S330Tone, S330Patch } from '@/core/midi/S330Client';
import { createWavBlobFromSamples, unpack12BitTo16Bit } from '@/lib/wave-export';
import {
  parseYaml,
  stringifyYaml,
  readToneFilesFromDirectory,
} from '@/lib/library-io';

// Re-export the incremental save and its shared callback types from
// their dedicated modules so this file remains the single entry point
// for set operations.
export { saveDeviceToSetIncremental } from '@/lib/library-sets-save-incremental';
export type {
  FetchToneDataCallback,
  FetchPatchDataCallback,
  FetchWaveDataCallback,
} from '@/lib/library-sets-types';

// =========================================================================
// Set Operations
// =========================================================================

/**
 * List all sets in the library directory
 */
export async function listSets(
  directoryHandle: StorageDirectoryHandle
): Promise<SetInfo[]> {
  const sets: SetInfo[] = [];

  try {
    const libraryDir = await directoryHandle.getDirectoryHandle('library', { create: false });
    const s330Dir = await libraryDir.getDirectoryHandle('s330', { create: false });
    const setsDir = await s330Dir.getDirectoryHandle('sets', { create: false });

    for await (const entry of setsDir.values()) {
      if (entry.kind !== 'directory') continue;

      try {
        const setDir = await setsDir.getDirectoryHandle(entry.name);
        const manifestHandle = await setDir.getFileHandle('set.yaml');
        const manifestFile = await manifestHandle.getFile();
        const manifestContent = await manifestFile.text();
        const manifest = SetYamlSchema.parse(parseYaml(manifestContent));

        sets.push({
          name: manifest.name,
          description: manifest.description,
          createdAt: manifest.createdAt,
          modifiedAt: manifest.modifiedAt,
          toneCount: manifest.tones.length,
          patchCount: manifest.patches.length,
        });
      } catch {
        // Skip invalid sets
      }
    }
  } catch {
    return [];
  }

  return sets.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Save device state to a new set
 */
export async function saveDeviceToSet(
  directoryHandle: StorageDirectoryHandle,
  setName: string,
  description: string | undefined,
  tones: (S330Tone | null)[],
  patches: (S330Patch | null)[],
  waveData: Map<number, { data: Uint8Array; sampleRate: number }>,
  onProgress?: (progress: number) => void
): Promise<void> {
  const input: DeviceStateInput = { tones, patches, waveData };
  const setResult = deviceStateToSet(setName, description, input);

  onProgress?.(10);

  const setsDir = await getNestedDirectory(directoryHandle, ['library', 's330', 'sets']);
  const sanitizedName = setName.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
  const setDir = await setsDir.getDirectoryHandle(sanitizedName, { create: true });
  const tonesDir = await setDir.getDirectoryHandle('tones', { create: true });
  const patchesDir = await setDir.getDirectoryHandle('patches', { create: true });

  onProgress?.(20);

  // Write manifest
  const manifestContent = stringifyYaml(setResult.manifest, { indent: 2, lineWidth: 120 });
  const manifestHandle = await setDir.getFileHandle('set.yaml', { create: true });
  const manifestWritable = await manifestHandle.createWritable();
  await manifestWritable.write(manifestContent);
  await manifestWritable.close();

  onProgress?.(30);

  // Write tones
  const toneCount = setResult.tones.size;
  let toneIndex = 0;
  for (const [slot, toneData] of setResult.tones) {
    const toneFile = `T${String(slot + 1).padStart(2, '0')}`;

    const yamlContent = stringifyYaml(toneData.yaml, { indent: 2, lineWidth: 120 });
    const yamlHandle = await tonesDir.getFileHandle(`${toneFile}.yaml`, { create: true });
    const yamlWritable = await yamlHandle.createWritable();
    await yamlWritable.write(yamlContent);
    await yamlWritable.close();

    const samples = unpack12BitTo16Bit(toneData.wavData);
    const wavBlob = createWavBlobFromSamples(samples, toneData.sampleRate);
    const wavHandle = await tonesDir.getFileHandle(`${toneFile}.wav`, { create: true });
    const wavWritable = await wavHandle.createWritable();
    await wavWritable.write(await wavBlob.arrayBuffer());
    await wavWritable.close();

    toneIndex++;
    onProgress?.(30 + Math.floor((toneIndex / toneCount) * 50));
  }

  onProgress?.(80);

  // Write patches
  for (const [slot, patchYaml] of setResult.patches) {
    const patchFile = `P${String(slot + 1).padStart(2, '0')}`;
    const yamlContent = stringifyYaml(patchYaml, { indent: 2, lineWidth: 120 });
    const yamlHandle = await patchesDir.getFileHandle(`${patchFile}.yaml`, { create: true });
    const yamlWritable = await yamlHandle.createWritable();
    await yamlWritable.write(yamlContent);
    await yamlWritable.close();
  }

  onProgress?.(100);
}

/**
 * Load set manifest from library
 */
export async function loadSetManifest(
  directoryHandle: StorageDirectoryHandle,
  setName: string
): Promise<SetYaml> {
  const sanitizedName = setName.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');

  const setsDir = await getNestedDirectory(directoryHandle, ['library', 's330', 'sets']);
  const setDir = await setsDir.getDirectoryHandle(sanitizedName);
  const manifestHandle = await setDir.getFileHandle('set.yaml');
  const manifestFile = await manifestHandle.getFile();
  const manifestContent = await manifestFile.text();

  return SetYamlSchema.parse(parseYaml(manifestContent));
}

/**
 * Load a tone from a set
 */
export async function loadToneFromSet(
  directoryHandle: StorageDirectoryHandle,
  setName: string,
  toneFile: string
): Promise<{ yaml: ToneYaml; wavData: Uint8Array }> {
  const sanitizedName = setName.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');

  const tonesDir = await getNestedDirectory(directoryHandle, [
    'library', 's330', 'sets', sanitizedName, 'tones'
  ]);

  const { yaml, wavData } = await readToneFilesFromDirectory(tonesDir, toneFile);
  return { yaml, wavData };
}

/**
 * Load a patch from a set
 */
export async function loadPatchFromSet(
  directoryHandle: StorageDirectoryHandle,
  setName: string,
  patchFile: string
): Promise<PatchYaml> {
  const sanitizedName = setName.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');

  const patchesDir = await getNestedDirectory(directoryHandle, [
    'library', 's330', 'sets', sanitizedName, 'patches'
  ]);

  const yamlHandle = await patchesDir.getFileHandle(`${patchFile}.yaml`);
  const yamlFile = await yamlHandle.getFile();
  const yamlContent = await yamlFile.text();

  return parseYaml(yamlContent) as PatchYaml;
}

/**
 * Load a complete set and convert to device state format.
 */
export async function loadSetToDevice(
  directoryHandle: StorageDirectoryHandle,
  setName: string,
  onProgress?: (progress: number) => void
): Promise<ReturnType<typeof setToDeviceState>> {
  onProgress?.(0);

  const manifest = await loadSetManifest(directoryHandle, setName);
  onProgress?.(10);

  const tones = new Map<number, { yaml: ToneYaml; wavData: Uint8Array }>();
  const toneCount = manifest.tones.length;

  for (let i = 0; i < toneCount; i++) {
    const entry = manifest.tones[i];
    if (!entry) continue;

    const toneData = await loadToneFromSet(directoryHandle, setName, entry.file);
    tones.set(entry.slot, toneData);
    onProgress?.(10 + Math.floor(((i + 1) / toneCount) * 50));
  }

  onProgress?.(60);

  const patches = new Map<number, PatchYaml>();
  const patchCount = manifest.patches.length;

  for (let i = 0; i < patchCount; i++) {
    const entry = manifest.patches[i];
    if (!entry) continue;

    const patchYaml = await loadPatchFromSet(directoryHandle, setName, entry.file);
    patches.set(entry.slot, patchYaml);
    onProgress?.(60 + Math.floor(((i + 1) / patchCount) * 30));
  }

  onProgress?.(90);

  const input: SetToDeviceInput = {
    manifest,
    tones,
    patches,
  };

  const result = setToDeviceState(input);
  onProgress?.(100);

  return result;
}

/**
 * Delete a set from the library
 */
export async function deleteSet(
  directoryHandle: StorageDirectoryHandle,
  setName: string
): Promise<void> {
  const sanitizedName = setName.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');

  const setsDir = await getNestedDirectory(directoryHandle, ['library', 's330', 'sets']);
  await setsDir.removeEntry(sanitizedName, { recursive: true });
}

/**
 * Rename a set in the library
 */
export async function renameSet(
  directoryHandle: StorageDirectoryHandle,
  oldName: string,
  newName: string
): Promise<void> {
  const sanitizedOldName = oldName.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');
  const sanitizedNewName = newName.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_').trim();

  if (!sanitizedNewName) {
    throw new Error('Set name cannot be empty');
  }

  if (sanitizedOldName === sanitizedNewName) {
    return;
  }

  const setsDir = await getNestedDirectory(directoryHandle, ['library', 's330', 'sets']);

  const sourceDir = await setsDir.getDirectoryHandle(sanitizedOldName, { create: false });
  const targetDir = await setsDir.getDirectoryHandle(sanitizedNewName, { create: true });

  await copyDirectoryContents(sourceDir, targetDir);
  await setsDir.removeEntry(sanitizedOldName, { recursive: true });
}
