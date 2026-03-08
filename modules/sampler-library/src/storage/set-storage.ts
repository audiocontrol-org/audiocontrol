/**
 * Set storage operations for the sampler library.
 *
 * Handles reading and writing complete sets including their manifests,
 * tones, patches, and wave data.
 *
 * @packageDocumentation
 */

import { readFile, writeFile, mkdir, readdir, rm, stat, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { DeviceType } from '@/types/index.js';
import type {
  SetYaml,
  SetInfo,
  SetData,
  SetToneEntry,
  SetPatchEntry,
  WaveSegmentAllocation,
  ToneYaml,
  PatchYaml,
} from '@/schemas/index.js';
import { SetYamlSchema, ToneYamlSchema, PatchYamlSchema } from '@/schemas/index.js';
import {
  getSetsDirectory,
  getSetDirectory,
  getSetManifestPath,
  getSetTonesDirectory,
  getSetPatchesDirectory,
  getSetTonePath,
  getSetToneWavePath,
  getSetPatchPath,
  getToneFilename,
  getPatchFilename,
} from './set-paths.js';
import { sanitizeFilename } from './library-paths.js';

/**
 * Ensure a directory exists, creating it if necessary.
 */
async function ensureDirectory(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

/**
 * Write a WAV file from raw PCM data.
 */
async function writeWavFile(
  filePath: string,
  pcmData: Uint8Array,
  sampleRate: number,
  channels: number = 1
): Promise<void> {
  const bitsPerSample = 16;
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const dataSize = pcmData.length;
  const fileSize = 36 + dataSize;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileSize, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const wavData = new Uint8Array(buffer);
  wavData.set(pcmData, 44);

  await ensureDirectory(dirname(filePath));
  await writeFile(filePath, wavData);
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Set storage implementation for the sampler library.
 *
 * Provides CRUD operations for sets, which are named collections
 * of tones, patches, and their wave data.
 */
export class SetStorage {
  /**
   * Create a new set with the given manifest.
   *
   * Creates the set directory structure and writes the manifest file.
   * Does not create any tone or patch files - those must be added separately.
   *
   * @param device - Device type
   * @param manifest - Set manifest data
   * @throws Error if the set already exists
   */
  async createSet(device: DeviceType, manifest: SetYaml): Promise<void> {
    const setName = sanitizeFilename(manifest.name);
    const setDir = getSetDirectory(device, setName);

    if (existsSync(setDir)) {
      throw new Error(`Set "${manifest.name}" already exists`);
    }

    // Create directory structure
    await ensureDirectory(getSetTonesDirectory(device, setName));
    await ensureDirectory(getSetPatchesDirectory(device, setName));

    // Write manifest
    const manifestPath = getSetManifestPath(device, setName);
    const yamlContent = stringifyYaml(manifest, {
      indent: 2,
      lineWidth: 120,
    });
    await writeFile(manifestPath, yamlContent, 'utf-8');
  }

  /**
   * Load a complete set including all tone and patch file paths.
   *
   * @param device - Device type
   * @param setName - Set name
   * @returns Set data with manifest and file paths
   */
  async loadSet(device: DeviceType, setName: string): Promise<SetData> {
    const safeName = sanitizeFilename(setName);
    const manifest = await this.loadSetManifest(device, safeName);

    const tones = new Map<number, { yamlPath: string; wavPath: string }>();
    const patches = new Map<number, { yamlPath: string }>();

    // Map tone entries to file paths
    for (const toneEntry of manifest.tones) {
      const yamlPath = getSetTonePath(device, safeName, toneEntry.file);
      const wavPath = getSetToneWavePath(device, safeName, toneEntry.file);

      if (existsSync(yamlPath)) {
        tones.set(toneEntry.slot, { yamlPath, wavPath });
      }
    }

    // Map patch entries to file paths
    for (const patchEntry of manifest.patches) {
      const yamlPath = getSetPatchPath(device, safeName, patchEntry.file);

      if (existsSync(yamlPath)) {
        patches.set(patchEntry.slot, { yamlPath });
      }
    }

    return { manifest, tones, patches };
  }

  /**
   * Load only the set manifest (for listing/preview).
   *
   * @param device - Device type
   * @param setName - Set name
   * @returns Set manifest
   */
  async loadSetManifest(device: DeviceType, setName: string): Promise<SetYaml> {
    const safeName = sanitizeFilename(setName);
    const manifestPath = getSetManifestPath(device, safeName);

    if (!existsSync(manifestPath)) {
      throw new Error(`Set "${setName}" not found`);
    }

    const yamlContent = await readFile(manifestPath, 'utf-8');
    const parsed = parseYaml(yamlContent);
    const result = SetYamlSchema.safeParse(parsed);

    if (!result.success) {
      throw new Error(`Invalid set manifest at ${manifestPath}: ${result.error.message}`);
    }

    return result.data;
  }

  /**
   * Update a set's manifest.
   *
   * @param device - Device type
   * @param setName - Set name
   * @param manifest - Updated manifest data
   */
  async updateSetManifest(
    device: DeviceType,
    setName: string,
    manifest: SetYaml
  ): Promise<void> {
    const safeName = sanitizeFilename(setName);
    const manifestPath = getSetManifestPath(device, safeName);

    if (!existsSync(getSetDirectory(device, safeName))) {
      throw new Error(`Set "${setName}" not found`);
    }

    // Update modification timestamp
    const updatedManifest: SetYaml = {
      ...manifest,
      modifiedAt: new Date().toISOString(),
    };

    const yamlContent = stringifyYaml(updatedManifest, {
      indent: 2,
      lineWidth: 120,
    });
    await writeFile(manifestPath, yamlContent, 'utf-8');
  }

  /**
   * Delete a set and all its contents.
   *
   * @param device - Device type
   * @param setName - Set name
   */
  async deleteSet(device: DeviceType, setName: string): Promise<void> {
    const safeName = sanitizeFilename(setName);
    const setDir = getSetDirectory(device, safeName);

    if (existsSync(setDir)) {
      await rm(setDir, { recursive: true, force: true });
    }
  }

  /**
   * List all sets for a device.
   *
   * @param device - Device type
   * @returns Array of set info objects
   */
  async listSets(device: DeviceType): Promise<SetInfo[]> {
    const setsDir = getSetsDirectory(device);

    if (!existsSync(setsDir)) {
      return [];
    }

    const entries = await readdir(setsDir, { withFileTypes: true });
    const directories = entries.filter((e) => e.isDirectory());

    const sets: SetInfo[] = [];

    for (const dir of directories) {
      try {
        const manifest = await this.loadSetManifest(device, dir.name);
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

    return sets.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Check if a set exists.
   *
   * @param device - Device type
   * @param setName - Set name
   * @returns True if the set exists
   */
  setExists(device: DeviceType, setName: string): boolean {
    const safeName = sanitizeFilename(setName);
    return existsSync(getSetManifestPath(device, safeName));
  }

  /**
   * Save a tone to a set.
   *
   * @param device - Device type
   * @param setName - Set name
   * @param slot - Tone slot index (0-31)
   * @param yaml - Tone YAML data
   * @param wavData - Raw PCM audio data
   * @param sampleRate - Sample rate in Hz
   * @param allocation - Wave segment allocation
   */
  async saveToneToSet(
    device: DeviceType,
    setName: string,
    slot: number,
    yaml: ToneYaml,
    wavData: Uint8Array,
    sampleRate: number,
    allocation: WaveSegmentAllocation
  ): Promise<void> {
    const safeName = sanitizeFilename(setName);
    const toneFile = getToneFilename(slot);

    // Ensure tones directory exists
    await ensureDirectory(getSetTonesDirectory(device, safeName));

    // Update wave file reference
    const yamlWithWavRef: ToneYaml = {
      ...yaml,
      wave: {
        ...yaml.wave,
        file: `${toneFile}.wav`,
      },
    };

    // Write YAML file
    const yamlPath = getSetTonePath(device, safeName, toneFile);
    const yamlContent = stringifyYaml(yamlWithWavRef, {
      indent: 2,
      lineWidth: 120,
    });
    await writeFile(yamlPath, yamlContent, 'utf-8');

    // Write WAV file
    const wavPath = getSetToneWavePath(device, safeName, toneFile);
    await writeWavFile(wavPath, wavData, sampleRate);

    // Update manifest with tone entry
    const manifest = await this.loadSetManifest(device, safeName);
    const existingIndex = manifest.tones.findIndex((t) => t.slot === slot);
    const newEntry: SetToneEntry = {
      slot,
      file: toneFile,
      waveAllocation: allocation,
    };

    if (existingIndex >= 0) {
      manifest.tones[existingIndex] = newEntry;
    } else {
      manifest.tones.push(newEntry);
      manifest.tones.sort((a, b) => a.slot - b.slot);
    }

    await this.updateSetManifest(device, safeName, manifest);
  }

  /**
   * Load a tone from a set.
   *
   * @param device - Device type
   * @param setName - Set name
   * @param slot - Tone slot index (0-31)
   * @returns Tone YAML and wave file path
   */
  async loadToneFromSet(
    device: DeviceType,
    setName: string,
    slot: number
  ): Promise<{ yaml: ToneYaml; wavPath: string; allocation: WaveSegmentAllocation }> {
    const safeName = sanitizeFilename(setName);
    const manifest = await this.loadSetManifest(device, safeName);

    const toneEntry = manifest.tones.find((t) => t.slot === slot);
    if (!toneEntry) {
      throw new Error(`Tone at slot ${slot} not found in set "${setName}"`);
    }

    const yamlPath = getSetTonePath(device, safeName, toneEntry.file);
    const wavPath = getSetToneWavePath(device, safeName, toneEntry.file);

    const yamlContent = await readFile(yamlPath, 'utf-8');
    const parsed = parseYaml(yamlContent);
    const result = ToneYamlSchema.safeParse(parsed);

    if (!result.success) {
      throw new Error(`Invalid tone YAML at ${yamlPath}: ${result.error.message}`);
    }

    return {
      yaml: result.data,
      wavPath,
      allocation: toneEntry.waveAllocation,
    };
  }

  /**
   * Save a patch to a set.
   *
   * @param device - Device type
   * @param setName - Set name
   * @param slot - Patch slot index (0-15)
   * @param yaml - Patch YAML data
   */
  async savePatchToSet(
    device: DeviceType,
    setName: string,
    slot: number,
    yaml: PatchYaml
  ): Promise<void> {
    const safeName = sanitizeFilename(setName);
    const patchFile = getPatchFilename(slot);

    // Ensure patches directory exists
    await ensureDirectory(getSetPatchesDirectory(device, safeName));

    // Write YAML file
    const yamlPath = getSetPatchPath(device, safeName, patchFile);
    const yamlContent = stringifyYaml(yaml, {
      indent: 2,
      lineWidth: 120,
    });
    await writeFile(yamlPath, yamlContent, 'utf-8');

    // Update manifest with patch entry
    const manifest = await this.loadSetManifest(device, safeName);
    const existingIndex = manifest.patches.findIndex((p) => p.slot === slot);
    const newEntry: SetPatchEntry = {
      slot,
      file: patchFile,
    };

    if (existingIndex >= 0) {
      manifest.patches[existingIndex] = newEntry;
    } else {
      manifest.patches.push(newEntry);
      manifest.patches.sort((a, b) => a.slot - b.slot);
    }

    await this.updateSetManifest(device, safeName, manifest);
  }

  /**
   * Load a patch from a set.
   *
   * @param device - Device type
   * @param setName - Set name
   * @param slot - Patch slot index (0-15)
   * @returns Patch YAML data
   */
  async loadPatchFromSet(
    device: DeviceType,
    setName: string,
    slot: number
  ): Promise<PatchYaml> {
    const safeName = sanitizeFilename(setName);
    const manifest = await this.loadSetManifest(device, safeName);

    const patchEntry = manifest.patches.find((p) => p.slot === slot);
    if (!patchEntry) {
      throw new Error(`Patch at slot ${slot} not found in set "${setName}"`);
    }

    const yamlPath = getSetPatchPath(device, safeName, patchEntry.file);
    const yamlContent = await readFile(yamlPath, 'utf-8');
    const parsed = parseYaml(yamlContent);
    const result = PatchYamlSchema.safeParse(parsed);

    if (!result.success) {
      throw new Error(`Invalid patch YAML at ${yamlPath}: ${result.error.message}`);
    }

    return result.data;
  }

  /**
   * Remove a tone from a set.
   *
   * @param device - Device type
   * @param setName - Set name
   * @param slot - Tone slot index
   */
  async removeToneFromSet(
    device: DeviceType,
    setName: string,
    slot: number
  ): Promise<void> {
    const safeName = sanitizeFilename(setName);
    const manifest = await this.loadSetManifest(device, safeName);

    const toneEntry = manifest.tones.find((t) => t.slot === slot);
    if (!toneEntry) {
      return; // Nothing to remove
    }

    // Remove files
    const yamlPath = getSetTonePath(device, safeName, toneEntry.file);
    const wavPath = getSetToneWavePath(device, safeName, toneEntry.file);

    await rm(yamlPath, { force: true }).catch(() => {});
    await rm(wavPath, { force: true }).catch(() => {});

    // Update manifest
    manifest.tones = manifest.tones.filter((t) => t.slot !== slot);
    await this.updateSetManifest(device, safeName, manifest);
  }

  /**
   * Remove a patch from a set.
   *
   * @param device - Device type
   * @param setName - Set name
   * @param slot - Patch slot index
   */
  async removePatchFromSet(
    device: DeviceType,
    setName: string,
    slot: number
  ): Promise<void> {
    const safeName = sanitizeFilename(setName);
    const manifest = await this.loadSetManifest(device, safeName);

    const patchEntry = manifest.patches.find((p) => p.slot === slot);
    if (!patchEntry) {
      return; // Nothing to remove
    }

    // Remove file
    const yamlPath = getSetPatchPath(device, safeName, patchEntry.file);
    await rm(yamlPath, { force: true }).catch(() => {});

    // Update manifest
    manifest.patches = manifest.patches.filter((p) => p.slot !== slot);
    await this.updateSetManifest(device, safeName, manifest);
  }
}

/**
 * Default set storage instance.
 */
export const setStorage = new SetStorage();
