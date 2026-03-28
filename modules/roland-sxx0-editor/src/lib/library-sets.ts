/**
 * Set operations — listing, saving (batch and incremental), loading,
 * deleting, and renaming sets in the library.
 */

import type { S330Tone, S330Patch, S330WaveDataResponse } from '@/core/midi/S330Client';
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
} from '@audiocontrol/sampler-library/browser';
import { createWavBlobFromSamples, unpack12BitTo16Bit } from '@/lib/wave-export';
import { getNestedDirectory, copyDirectoryContents } from '@audiocontrol/sampler-library/browser';
import {
  parseYaml,
  stringifyYaml,
  readToneFilesFromDirectory,
  writeToneFilesToDirectory,
  writePatchFileToDirectory,
  getToneFilename,
  getPatchFilename,
} from '@/lib/library-io';

// =========================================================================
// Callback Types
// =========================================================================

/**
 * Callback for fetching tone data from device
 */
export type FetchToneDataCallback = (toneIndex: number) => Promise<S330Tone | null>;

/**
 * Callback for fetching patch data from device
 */
export type FetchPatchDataCallback = (patchIndex: number) => Promise<S330Patch | null>;

/**
 * Callback for fetching wave data from device
 */
export type FetchWaveDataCallback = (
  toneIndex: number,
  onWaveProgress?: (bytesReceived: number, totalBytes: number) => void
) => Promise<S330WaveDataResponse>;

// S-330 constants
const MAX_TONES = 48;
const MAX_PATCHES = 16;

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
 * Save device state to a set incrementally.
 *
 * IMPORTANT: This function fetches ALL data fresh from the device.
 * It does NOT use any cached UI state to ensure accuracy even when
 * the device state has changed (e.g., after loading a diskette).
 */
export async function saveDeviceToSetIncremental(
  directoryHandle: StorageDirectoryHandle,
  setName: string,
  description: string | undefined,
  fetchToneData: FetchToneDataCallback,
  fetchPatchData: FetchPatchDataCallback,
  fetchWaveData: FetchWaveDataCallback,
  onProgress?: (progress: number) => void,
  onStatus?: (message: string) => void
): Promise<void> {
  const sanitizedSetName = setName.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');

  onStatus?.('Creating set directory...');
  const setsDir = await getNestedDirectory(directoryHandle, ['library', 's330', 'sets']);
  const setDir = await setsDir.getDirectoryHandle(sanitizedSetName, { create: true });
  const tonesDir = await setDir.getDirectoryHandle('tones', { create: true });
  const patchesDir = await setDir.getDirectoryHandle('patches', { create: true });

  onProgress?.(2);

  const toneEntries: { slot: number; file: string; waveAllocation: { bank: 0 | 1; segmentTop: number; segmentLength: number } }[] = [];
  const patchEntries: { slot: number; file: string }[] = [];

  // Phase 1: Scan device for valid tones and patches
  onStatus?.('Scanning device for tones and patches...');
  const validTones: { index: number; tone: S330Tone }[] = [];
  const validPatches: { index: number; patch: S330Patch }[] = [];

  for (let i = 0; i < MAX_TONES; i++) {
    try {
      const tone = await fetchToneData(i);
      if (tone && tone.wave.segmentLength > 0) {
        validTones.push({ index: i, tone });
      }
    } catch (err) {
      console.warn(`[saveDeviceToSetIncremental] Failed to fetch tone ${i}:`, err);
    }
    onProgress?.(2 + Math.floor(((i + 1) / MAX_TONES) * 8));
  }

  for (let i = 0; i < MAX_PATCHES; i++) {
    try {
      const patch = await fetchPatchData(i);
      if (patch) {
        validPatches.push({ index: i, patch });
      }
    } catch (err) {
      console.warn(`[saveDeviceToSetIncremental] Failed to fetch patch ${i}:`, err);
    }
    onProgress?.(10 + Math.floor(((i + 1) / MAX_PATCHES) * 5));
  }

  onStatus?.(`Found ${validTones.length} tones and ${validPatches.length} patches`);
  onProgress?.(15);

  const totalItems = validTones.length + validPatches.length;
  let processed = 0;

  // Phase 2: Process each tone
  for (const { index, tone } of validTones) {
    const toneFile = getToneFilename(index, tone.name);
    onStatus?.(`Fetching wave data for ${tone.name || toneFile}...`);

    try {
      const waveResponse = await fetchWaveData(index, (_received, _total) => {
        // Could add sub-progress here
      });

      onStatus?.(`Writing ${tone.name || toneFile} to disk...`);

      const result = await writeToneFilesToDirectory(tonesDir, tone, waveResponse, toneFile);

      toneEntries.push({
        slot: index,
        file: toneFile,
        waveAllocation: {
          bank: tone.wave.bank as 0 | 1,
          segmentTop: tone.wave.segmentTop,
          segmentLength: result.segmentLength,
        },
      });
    } catch (err) {
      console.warn(`[saveDeviceToSetIncremental] Failed to save tone ${index}:`, err);
    }

    processed++;
    onProgress?.(15 + Math.floor((processed / totalItems) * 75));
  }

  // Phase 3: Process each patch
  for (const { index, patch } of validPatches) {
    const patchFile = getPatchFilename(index, patch.common.name);
    onStatus?.(`Writing ${patch.common.name || patchFile} to disk...`);

    try {
      await writePatchFileToDirectory(patchesDir, patch, patchFile);

      patchEntries.push({
        slot: index,
        file: patchFile,
      });
    } catch (err) {
      console.warn(`[saveDeviceToSetIncremental] Failed to save patch ${index}:`, err);
    }

    processed++;
    onProgress?.(5 + Math.floor((processed / totalItems) * 85));
  }

  // Write manifest last
  onStatus?.('Writing set manifest...');
  const now = new Date().toISOString();
  const manifest: SetYaml = {
    format: 'sampler-set',
    device: 's330',
    version: 1,
    name: setName,
    description,
    createdAt: now,
    modifiedAt: now,
    tones: toneEntries.sort((a, b) => a.slot - b.slot),
    patches: patchEntries.sort((a, b) => a.slot - b.slot),
  };

  const manifestContent = stringifyYaml(manifest, { indent: 2, lineWidth: 120 });
  const manifestHandle = await setDir.getFileHandle('set.yaml', { create: true });
  const manifestWritable = await manifestHandle.createWritable();
  await manifestWritable.write(manifestContent);
  await manifestWritable.close();

  onProgress?.(100);
  onStatus?.(`Saved ${toneEntries.length} tones and ${patchEntries.length} patches`);
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
