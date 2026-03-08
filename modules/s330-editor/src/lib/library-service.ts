/**
 * Browser-compatible Library Service
 *
 * Handles library operations in the browser using the File System Access API
 * when available, with fallback to download/upload for older browsers.
 *
 * Note: Full filesystem persistence requires the File System Access API
 * (Chrome/Edge) or a backend server. This implementation focuses on
 * the immediate export/import workflows.
 */

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { S330Tone, S330Patch } from '@audiocontrol/sampler-devices/s330';
import type { S330WaveDataResponse } from '@audiocontrol/sampler-devices/s330';
import {
  ToneYamlSchema,
  SetYamlSchema,
  DrumKitBundleSchema,
  s330ToneConverter,
  s330PatchConverter,
  deviceStateToSet,
  setToDeviceState,
  parseWav,
  wavToS330,
  calculateSegmentsNeeded,
  loadDrumKitBundle as parseDrumKitBundle,
  type ToneYaml,
  type PatchYaml,
  type SetYaml,
  type SetInfo,
  type DeviceStateInput,
  type SetToDeviceInput,
  type DrumKitBundle,
  type ResolvedDrumKitBundle,
} from '@audiocontrol/sampler-library/browser';
import { createWavBlobFromSamples, unpack12BitTo16Bit } from '@/lib/wave-export';

// =========================================================================
// WAV to S330 Conversion (Single Code Path)
// =========================================================================

/**
 * Prepared S330 sample data ready for device upload.
 */
export interface PreparedS330Sample {
  /** S330 12-bit packed wave data */
  data: Uint8Array;
  /** Number of samples (not bytes) */
  sampleCount: number;
  /** Number of segments needed on device */
  segmentLength: number;
  /** Target sample rate */
  sampleRate: 15000 | 30000;
}

/**
 * Convert raw WAV file bytes to S330 format.
 *
 * This is the ONLY function that should be used for WAV → S330 conversion.
 * All UI components and hooks must use this function to ensure consistent
 * conversion behavior.
 *
 * @param wavBytes - Raw WAV file data
 * @param targetSampleRate - Target sample rate (15000 or 30000 Hz)
 * @returns Prepared sample data ready for device upload
 */
export function prepareWavForS330(
  wavBytes: ArrayBuffer,
  targetSampleRate: 15000 | 30000
): PreparedS330Sample {
  const wavData = parseWav(wavBytes);
  const s330Data = wavToS330(wavData, targetSampleRate);
  const segmentLength = calculateSegmentsNeeded(s330Data.sampleCount);

  return {
    data: s330Data.data,
    sampleCount: s330Data.sampleCount,
    segmentLength,
    sampleRate: targetSampleRate,
  };
}

/**
 * Parse WAV file and return metadata for display purposes.
 * Use this for showing file info before conversion.
 */
export interface WavFileInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  sampleCount: number;
  duration: number;
}

/**
 * Get WAV file info for display purposes.
 *
 * @param wavBytes - Raw WAV file data
 * @returns WAV file metadata
 */
export function getWavFileInfo(wavBytes: ArrayBuffer): WavFileInfo {
  const wavData = parseWav(wavBytes);
  return {
    sampleRate: wavData.sampleRate,
    channels: wavData.channels,
    bitsPerSample: wavData.bitsPerSample,
    sampleCount: wavData.samples.length,
    duration: wavData.samples.length / wavData.sampleRate,
  };
}

/**
 * Calculate segments needed for a WAV file at a target sample rate.
 * Use this for UI display before actual conversion.
 *
 * @param wavBytes - Raw WAV file data
 * @param targetSampleRate - Target sample rate
 * @returns Number of segments needed
 */
export function calculateWavSegmentsNeeded(
  wavBytes: ArrayBuffer,
  targetSampleRate: 15000 | 30000
): number {
  const wavData = parseWav(wavBytes);
  // Calculate output sample count after resampling
  const outputSampleCount = Math.floor(
    wavData.samples.length * (targetSampleRate / wavData.sampleRate)
  );
  return calculateSegmentsNeeded(outputSampleCount);
}

// =========================================================================
// File System Access API
// =========================================================================

/**
 * Check if the File System Access API is available
 */
export function hasFileSystemAccess(): boolean {
  return 'showSaveFilePicker' in window && 'showDirectoryPicker' in window;
}

// In-memory cache for the library directory handle
let cachedDirectoryHandle: FileSystemDirectoryHandle | null = null;

/**
 * Get the cached library directory handle, if available and still has permission.
 */
export async function getCachedLibraryDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!cachedDirectoryHandle) {
    return null;
  }

  // Verify we still have permission
  try {
    const permission = await cachedDirectoryHandle.queryPermission({ mode: 'readwrite' });
    if (permission === 'granted') {
      return cachedDirectoryHandle;
    }

    // Try to request permission
    const requested = await cachedDirectoryHandle.requestPermission({ mode: 'readwrite' });
    if (requested === 'granted') {
      return cachedDirectoryHandle;
    }
  } catch {
    // Permission check failed, clear cache
    cachedDirectoryHandle = null;
  }

  return null;
}

/**
 * Set the cached library directory handle.
 */
export function setCachedLibraryDirectory(handle: FileSystemDirectoryHandle | null): void {
  cachedDirectoryHandle = handle;
}

/**
 * Export result containing the generated files
 */
export interface ExportResult {
  yamlContent: string;
  wavBlob: Blob;
  toneName: string;
}

/**
 * Convert S330 tone and wave data to library format
 */
export function prepareExport(
  tone: S330Tone,
  waveData: S330WaveDataResponse,
  customName?: string
): ExportResult {
  const toneName = customName || tone.name || 'untitled';
  const wavFilename = `${toneName}.wav`;

  // Convert S330 tone to YAML format
  const toneYaml = s330ToneConverter.toYaml(tone, wavFilename);

  // Generate YAML content
  const yamlContent = stringifyYaml(toneYaml, {
    indent: 2,
    lineWidth: 120,
  });

  // Create WAV blob
  const samples = unpack12BitTo16Bit(waveData.data);
  const wavBlob = createWavBlobFromSamples(samples, waveData.sampleRate);

  return {
    yamlContent,
    wavBlob,
    toneName,
  };
}

/**
 * Download a file to the user's computer
 */
function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Get a directory handle for the library.
 * Must be called directly from a user gesture (click handler).
 * Returns null if user cancels or API not available.
 */
export async function pickLibraryDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!hasFileSystemAccess()) {
    return null;
  }

  try {
    return await window.showDirectoryPicker({
      id: 'sampler-library',
      mode: 'readwrite',
      startIn: 'documents',
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return null; // User cancelled
    }
    throw err;
  }
}

/**
 * Get or create a nested directory path within a directory handle.
 */
async function getNestedDirectory(
  rootHandle: FileSystemDirectoryHandle,
  path: string[]
): Promise<FileSystemDirectoryHandle> {
  let current = rootHandle;
  for (const segment of path) {
    current = await current.getDirectoryHandle(segment, { create: true });
  }
  return current;
}

/**
 * Export tone to a specific directory using File System Access API.
 * Automatically creates library/s330/tones/ subdirectory structure.
 */
export async function exportToneToDirectory(
  directoryHandle: FileSystemDirectoryHandle,
  tone: S330Tone,
  waveData: S330WaveDataResponse,
  customName?: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  const { yamlContent, wavBlob, toneName } = prepareExport(tone, waveData, customName);

  onProgress?.(50);

  // Create library/s330/tones/ subdirectory structure
  const tonesDir = await getNestedDirectory(directoryHandle, ['library', 's330', 'tones']);

  // Write YAML file
  const yamlHandle = await tonesDir.getFileHandle(`${toneName}.yaml`, { create: true });
  const yamlWritable = await yamlHandle.createWritable();
  await yamlWritable.write(yamlContent);
  await yamlWritable.close();

  onProgress?.(75);

  // Write WAV file
  const wavHandle = await tonesDir.getFileHandle(`${toneName}.wav`, { create: true });
  const wavWritable = await wavHandle.createWritable();
  await wavWritable.write(wavBlob);
  await wavWritable.close();

  onProgress?.(100);
}

/**
 * Export tone to library by downloading files (fallback)
 */
export async function exportToneAsDownload(
  tone: S330Tone,
  waveData: S330WaveDataResponse,
  customName?: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  const { yamlContent, wavBlob, toneName } = prepareExport(tone, waveData, customName);

  onProgress?.(50);

  // Download both files
  downloadFile(new Blob([yamlContent], { type: 'text/yaml' }), `${toneName}.yaml`);
  onProgress?.(75);
  downloadFile(wavBlob, `${toneName}.wav`);
  onProgress?.(100);
}

/**
 * Import tone from YAML file
 * Returns the parsed ToneYaml
 */
export async function importToneFromFile(): Promise<ToneYaml> {
  if (hasFileSystemAccess()) {
    // Use File System Access API
    const [fileHandle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'YAML files',
          accept: { 'text/yaml': ['.yaml', '.yml'] },
        },
      ],
    });
    const file = await fileHandle.getFile();
    const content = await file.text();
    const data = parseYaml(content);
    return ToneYamlSchema.parse(data);
  } else {
    // Fallback: use file input
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.yaml,.yml';

      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          reject(new Error('No file selected'));
          return;
        }

        try {
          const content = await file.text();
          const data = parseYaml(content);
          const tone = ToneYamlSchema.parse(data);
          resolve(tone);
        } catch (err) {
          reject(err);
        }
      };

      input.oncancel = () => {
        reject(new Error('Import cancelled'));
      };

      input.click();
    });
  }
}

/**
 * Import WAV file and return as Uint8Array
 */
export async function importWavFile(): Promise<{ data: Uint8Array; filename: string }> {
  if (hasFileSystemAccess()) {
    const [fileHandle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'WAV files',
          accept: { 'audio/wav': ['.wav'] },
        },
      ],
    });
    const file = await fileHandle.getFile();
    const arrayBuffer = await file.arrayBuffer();
    return {
      data: new Uint8Array(arrayBuffer),
      filename: file.name,
    };
  } else {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.wav';

      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          reject(new Error('No file selected'));
          return;
        }

        try {
          const arrayBuffer = await file.arrayBuffer();
          resolve({
            data: new Uint8Array(arrayBuffer),
            filename: file.name,
          });
        } catch (err) {
          reject(err);
        }
      };

      input.oncancel = () => {
        reject(new Error('Import cancelled'));
      };

      input.click();
    });
  }
}

/**
 * Convert ToneYaml back to S330Tone for device upload
 */
export function convertYamlToS330Tone(yaml: ToneYaml): S330Tone {
  return s330ToneConverter.fromYaml(yaml);
}

/**
 * Convert PatchYaml back to S330Patch for device upload
 */
export function convertYamlToS330Patch(yaml: PatchYaml): S330Patch {
  return s330PatchConverter.fromYaml(yaml);
}

// =========================================================================
// Set Operations
// =========================================================================

/**
 * List all sets in the library directory
 */
export async function listSets(
  directoryHandle: FileSystemDirectoryHandle
): Promise<SetInfo[]> {
  const sets: SetInfo[] = [];

  try {
    // Navigate to library/s330/sets/
    const libraryDir = await directoryHandle.getDirectoryHandle('library', { create: false });
    const s330Dir = await libraryDir.getDirectoryHandle('s330', { create: false });
    const setsDir = await s330Dir.getDirectoryHandle('sets', { create: false });

    // Iterate through set directories
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
    // Sets directory doesn't exist yet
    return [];
  }

  return sets.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Save device state to a new set
 */
export async function saveDeviceToSet(
  directoryHandle: FileSystemDirectoryHandle,
  setName: string,
  description: string | undefined,
  tones: (S330Tone | null)[],
  patches: (S330Patch | null)[],
  waveData: Map<number, { data: Uint8Array; sampleRate: number }>,
  onProgress?: (progress: number) => void
): Promise<void> {
  // Convert device state to set format
  const input: DeviceStateInput = { tones, patches, waveData };
  const setResult = deviceStateToSet(setName, description, input);

  onProgress?.(10);

  // Create directory structure
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

    // Write YAML
    const yamlContent = stringifyYaml(toneData.yaml, { indent: 2, lineWidth: 120 });
    const yamlHandle = await tonesDir.getFileHandle(`${toneFile}.yaml`, { create: true });
    const yamlWritable = await yamlHandle.createWritable();
    await yamlWritable.write(yamlContent);
    await yamlWritable.close();

    // Write WAV - convert from S330 12-bit packed format to 16-bit samples
    const samples = unpack12BitTo16Bit(toneData.wavData);
    const wavBlob = createWavBlobFromSamples(samples, toneData.sampleRate);
    const wavHandle = await tonesDir.getFileHandle(`${toneFile}.wav`, { create: true });
    const wavWritable = await wavHandle.createWritable();
    await wavWritable.write(wavBlob);
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

/**
 * Save device state to a set incrementally.
 *
 * IMPORTANT: This function fetches ALL data fresh from the device.
 * It does NOT use any cached UI state to ensure accuracy even when
 * the device state has changed (e.g., after loading a diskette).
 *
 * Writes each tone/patch to disk immediately after fetching, so partial saves
 * are preserved even if the operation fails partway through.
 */
export async function saveDeviceToSetIncremental(
  directoryHandle: FileSystemDirectoryHandle,
  setName: string,
  description: string | undefined,
  fetchToneData: FetchToneDataCallback,
  fetchPatchData: FetchPatchDataCallback,
  fetchWaveData: FetchWaveDataCallback,
  onProgress?: (progress: number) => void,
  onStatus?: (message: string) => void
): Promise<void> {
  const sanitizedSetName = setName.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');

  // Create directory structure first
  onStatus?.('Creating set directory...');
  const setsDir = await getNestedDirectory(directoryHandle, ['library', 's330', 'sets']);
  const setDir = await setsDir.getDirectoryHandle(sanitizedSetName, { create: true });
  const tonesDir = await setDir.getDirectoryHandle('tones', { create: true });
  const patchesDir = await setDir.getDirectoryHandle('patches', { create: true });

  onProgress?.(2);

  // Track manifest entries for final write
  const toneEntries: { slot: number; file: string; waveAllocation: { bank: 0 | 1; segmentTop: number; segmentLength: number } }[] = [];
  const patchEntries: { slot: number; file: string }[] = [];

  // Phase 1: Scan device for valid tones and patches
  onStatus?.('Scanning device for tones and patches...');
  const validTones: { index: number; tone: S330Tone }[] = [];
  const validPatches: { index: number; patch: S330Patch }[] = [];

  // Scan all tone slots
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

  // Scan all patch slots
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

  // Phase 2: Process each tone - fetch wave data and write to disk
  for (const { index, tone } of validTones) {
    const toneSlot = `T${String(index + 1).padStart(2, '0')}`;
    const sanitizedName = (tone.name || '').trim().replace(/[<>:"/\\|?*]/g, '_');
    const toneFile = sanitizedName ? `${toneSlot} ${sanitizedName}` : toneSlot;
    onStatus?.(`Fetching wave data for ${tone.name || toneSlot}...`);

    try {
      // Fetch wave data fresh from device
      const waveResponse = await fetchWaveData(index, (_received, _total) => {
        // Could add sub-progress here
      });

      onStatus?.(`Writing ${tone.name || toneSlot} to disk...`);

      // Convert tone to YAML (tone was already fetched fresh from device)
      const toneYaml = s330ToneConverter.toYaml(tone, `${toneFile}.wav`);
      const yamlContent = stringifyYaml(toneYaml, { indent: 2, lineWidth: 120 });

      // Write YAML
      const yamlHandle = await tonesDir.getFileHandle(`${toneFile}.yaml`, { create: true });
      const yamlWritable = await yamlHandle.createWritable();
      await yamlWritable.write(yamlContent);
      await yamlWritable.close();

      // Convert and write WAV - using the proper 12-bit to 16-bit conversion
      const samples = unpack12BitTo16Bit(waveResponse.data);
      const wavBlob = createWavBlobFromSamples(samples, waveResponse.sampleRate);
      const wavHandle = await tonesDir.getFileHandle(`${toneFile}.wav`, { create: true });
      const wavWritable = await wavHandle.createWritable();
      await wavWritable.write(wavBlob);
      await wavWritable.close();

      // Track for manifest - use fresh tone data for allocation info
      const actualSegmentLength = calculateSegmentsNeeded(samples.length);
      toneEntries.push({
        slot: index,
        file: toneFile,
        waveAllocation: {
          bank: tone.wave.bank as 0 | 1,
          segmentTop: tone.wave.segmentTop,
          segmentLength: actualSegmentLength,
        },
      });
    } catch (err) {
      console.warn(`[saveDeviceToSetIncremental] Failed to save tone ${index}:`, err);
      // Continue with other tones - don't lose everything
    }

    processed++;
    onProgress?.(15 + Math.floor((processed / totalItems) * 75));
  }

  // Phase 3: Process each patch - write to disk (already fetched fresh)
  for (const { index, patch } of validPatches) {
    const patchSlot = `P${String(index + 1).padStart(2, '0')}`;
    const sanitizedName = (patch.common.name || '').trim().replace(/[<>:"/\\|?*]/g, '_');
    const patchFile = sanitizedName ? `${patchSlot} ${sanitizedName}` : patchSlot;
    onStatus?.(`Writing ${patch.common.name || patchSlot} to disk...`);

    try {
      // Convert patch to YAML
      const patchYaml = s330PatchConverter.toYaml(patch);
      const yamlContent = stringifyYaml(patchYaml, { indent: 2, lineWidth: 120 });

      // Write YAML
      const yamlHandle = await patchesDir.getFileHandle(`${patchFile}.yaml`, { create: true });
      const yamlWritable = await yamlHandle.createWritable();
      await yamlWritable.write(yamlContent);
      await yamlWritable.close();

      // Track for manifest
      patchEntries.push({
        slot: index,
        file: patchFile,
      });
    } catch (err) {
      console.warn(`[saveDeviceToSetIncremental] Failed to save patch ${index}:`, err);
      // Continue with other patches
    }

    processed++;
    onProgress?.(5 + Math.floor((processed / totalItems) * 85));
  }

  // Write manifest last (so we know what actually succeeded)
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
  directoryHandle: FileSystemDirectoryHandle,
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
  directoryHandle: FileSystemDirectoryHandle,
  setName: string,
  toneFile: string
): Promise<{ yaml: ToneYaml; wavData: Uint8Array }> {
  const sanitizedName = setName.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');

  const tonesDir = await getNestedDirectory(directoryHandle, [
    'library', 's330', 'sets', sanitizedName, 'tones'
  ]);

  // Load YAML
  const yamlHandle = await tonesDir.getFileHandle(`${toneFile}.yaml`);
  const yamlFile = await yamlHandle.getFile();
  const yamlContent = await yamlFile.text();
  const yaml = ToneYamlSchema.parse(parseYaml(yamlContent));

  // Load WAV and convert using the single code path
  const wavHandle = await tonesDir.getFileHandle(`${toneFile}.wav`);
  const wavFile = await wavHandle.getFile();
  const wavFileBuffer = await wavFile.arrayBuffer();
  const targetSampleRate = yaml.wave.sampleRate as 15000 | 30000;
  const prepared = prepareWavForS330(wavFileBuffer, targetSampleRate);

  return { yaml, wavData: prepared.data };
}

/**
 * Load a patch from a set
 */
export async function loadPatchFromSet(
  directoryHandle: FileSystemDirectoryHandle,
  setName: string,
  patchFile: string
): Promise<PatchYaml> {
  const sanitizedName = setName.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');

  const patchesDir = await getNestedDirectory(directoryHandle, [
    'library', 's330', 'sets', sanitizedName, 'patches'
  ]);

  // Load YAML
  const yamlHandle = await patchesDir.getFileHandle(`${patchFile}.yaml`);
  const yamlFile = await yamlHandle.getFile();
  const yamlContent = await yamlFile.text();

  // Note: We'd need a PatchYamlSchema here - for now just parse directly
  return parseYaml(yamlContent) as PatchYaml;
}

/**
 * Load a complete set and convert to device state format.
 *
 * @param directoryHandle - Library directory handle
 * @param setName - Name of the set to load
 * @param onProgress - Optional progress callback (0-100)
 * @returns Device-ready tones and patches
 */
export async function loadSetToDevice(
  directoryHandle: FileSystemDirectoryHandle,
  setName: string,
  onProgress?: (progress: number) => void
): Promise<ReturnType<typeof setToDeviceState>> {
  onProgress?.(0);

  // Load manifest
  const manifest = await loadSetManifest(directoryHandle, setName);
  onProgress?.(10);

  // Load all tones
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

  // Load all patches
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

  // Convert to device state
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
  directoryHandle: FileSystemDirectoryHandle,
  setName: string
): Promise<void> {
  const sanitizedName = setName.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');

  const setsDir = await getNestedDirectory(directoryHandle, ['library', 's330', 'sets']);

  // Remove the set directory recursively
  await setsDir.removeEntry(sanitizedName, { recursive: true });
}

// =========================================================================
// Patch Dependency Analysis
// =========================================================================

/**
 * Analyze a patch to find which tones it references.
 *
 * Examines toneLayer1 and toneLayer2 arrays to find all unique tone indices.
 * Returns sorted array of tone slot indices (0-31).
 *
 * Note: toneLayer2 is only meaningful when keyMode uses velocity switching
 * ('v-sw', 'x-fade', 'v-mix') AND the corresponding toneLayer1 entry is >= 0.
 * Otherwise toneLayer2 values are just defaults (all 0s) and should be ignored.
 */
export function getPatchToneDependencies(patch: S330Patch): number[] {
  const usedTones = new Set<number>();
  const { keyMode, toneLayer1, toneLayer2 } = patch.common;

  // Check toneLayer1 (indices 0-31, -1 means no tone assigned)
  for (const toneIndex of toneLayer1) {
    if (toneIndex >= 0 && toneIndex <= 31) {
      usedTones.add(toneIndex);
    }
  }

  // Check toneLayer2 only if velocity switching is active
  // and only for keys that have a layer 1 assignment
  const usesVelocitySwitching = keyMode === 'v-sw' || keyMode === 'x-fade' || keyMode === 'v-mix';
  if (usesVelocitySwitching) {
    for (let i = 0; i < toneLayer2.length; i++) {
      // Only count layer 2 if layer 1 is assigned for this key
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
 *
 * Creates a new patch with updated toneLayer1 and toneLayer2 arrays
 * where all tone references are remapped according to the provided mapping.
 *
 * @param patch - Original patch
 * @param toneMapping - Map of original tone slot -> new tone slot
 * @returns New patch with remapped tone layers
 */
export function remapPatchToneLayers(
  patch: S330Patch,
  toneMapping: Map<number, number>
): S330Patch {
  const newToneLayer1 = patch.common.toneLayer1.map((toneIndex) => {
    if (toneIndex < 0) return toneIndex; // -1 stays -1
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
// Drum Kit Operations
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
}

/**
 * List all drum kit bundles in the library.
 *
 * Scans `library/s330/drum-kits/` for directories containing WAV files.
 */
export async function listDrumKits(
  directoryHandle: FileSystemDirectoryHandle
): Promise<DrumKitInfo[]> {
  const kits: DrumKitInfo[] = [];

  try {
    // Navigate to library/s330/drum-kits/
    const libraryDir = await directoryHandle.getDirectoryHandle('library', { create: false });
    const s330Dir = await libraryDir.getDirectoryHandle('s330', { create: false });
    const drumKitsDir = await s330Dir.getDirectoryHandle('drum-kits', { create: false });

    // Iterate through drum kit directories
    for await (const entry of drumKitsDir.values()) {
      if (entry.kind !== 'directory') continue;

      try {
        const kitDir = await drumKitsDir.getDirectoryHandle(entry.name);

        // Collect WAV files and check for kit.yaml
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

        // Skip directories without WAV files
        if (wavFiles.length === 0) continue;

        // Parse the bundle to get kit info
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
    // Drum kits directory doesn't exist yet
    return [];
  }

  return kits.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Load a drum kit bundle with full metadata and sample information.
 */
export async function loadDrumKitBundle(
  directoryHandle: FileSystemDirectoryHandle,
  kitName: string
): Promise<ResolvedDrumKitBundle> {
  // Navigate to the kit directory
  const kitDir = await getNestedDirectory(directoryHandle, [
    'library', 's330', 'drum-kits', kitName
  ]);

  // Collect WAV files and check for kit.yaml
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

  // Parse the bundle
  return parseDrumKitBundle(kitYaml, wavFiles, kitName);
}

/**
 * Load a single WAV file from a drum kit bundle.
 *
 * @param directoryHandle - Library directory handle
 * @param kitName - Directory name of the drum kit
 * @param fileName - WAV filename to load
 * @returns Raw WAV file data
 */
export async function loadDrumKitSample(
  directoryHandle: FileSystemDirectoryHandle,
  kitName: string,
  fileName: string
): Promise<Uint8Array> {
  const kitDir = await getNestedDirectory(directoryHandle, [
    'library', 's330', 'drum-kits', kitName
  ]);

  const fileHandle = await kitDir.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  const arrayBuffer = await file.arrayBuffer();

  return new Uint8Array(arrayBuffer);
}

// TypeScript declarations for File System Access API
declare global {
  interface Window {
    showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
    showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
    showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
  }

  interface SaveFilePickerOptions {
    suggestedName?: string;
    types?: FilePickerAcceptType[];
  }

  interface OpenFilePickerOptions {
    multiple?: boolean;
    types?: FilePickerAcceptType[];
  }

  interface DirectoryPickerOptions {
    id?: string;
    mode?: 'read' | 'readwrite';
    startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
  }

  interface FilePickerAcceptType {
    description?: string;
    accept: Record<string, string[]>;
  }

  interface FileSystemFileHandle {
    getFile(): Promise<File>;
    createWritable(): Promise<FileSystemWritableFileStream>;
  }

  interface FileSystemDirectoryHandle {
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
    getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
    queryPermission(options?: { mode?: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
    requestPermission(options?: { mode?: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
    removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
    values(): AsyncIterable<FileSystemHandle>;
  }

  interface FileSystemHandle {
    readonly kind: 'file' | 'directory';
    readonly name: string;
  }

  interface FileSystemWritableFileStream extends WritableStream {
    write(data: string | Blob | ArrayBuffer): Promise<void>;
    close(): Promise<void>;
  }
}
