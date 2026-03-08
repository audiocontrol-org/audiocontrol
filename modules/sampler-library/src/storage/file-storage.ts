/**
 * File storage operations for the sampler library.
 *
 * Handles reading and writing YAML configuration files and WAV audio files.
 *
 * @packageDocumentation
 */

import { readFile, writeFile, mkdir, readdir, unlink, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname } from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { DeviceType, LibraryItemInfo } from '@/types/index.js';
import type { ToneYaml, PatchYaml, TemplateYaml } from '@/schemas/index.js';
import { ToneYamlSchema, PatchYamlSchema, TemplateYamlSchema } from '@/schemas/index.js';
import {
  getTonesDirectory,
  getPatchesDirectory,
  getTemplatesDirectory,
  getTonePath,
  getToneWavePath,
  getPatchPath,
  getTemplatePath,
  sanitizeFilename,
  getBaseName,
} from './library-paths.js';

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
 *
 * Creates a standard WAV file with the given sample data.
 *
 * @param filePath - Path to write the WAV file
 * @param pcmData - Raw PCM audio data (16-bit signed)
 * @param sampleRate - Sample rate in Hz
 * @param channels - Number of audio channels (default: 1)
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
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // audio format (PCM)
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Copy PCM data
  const wavData = new Uint8Array(buffer);
  wavData.set(pcmData, 44);

  await ensureDirectory(dirname(filePath));
  await writeFile(filePath, wavData);
}

/**
 * Helper to write a string to a DataView.
 */
function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * File storage implementation for the sampler library.
 */
export class FileStorage {
  /**
   * Save a tone to the library.
   *
   * @param device - Device type
   * @param name - Tone name
   * @param yaml - Tone YAML data
   * @param wavData - Raw PCM audio data (16-bit signed)
   * @param sampleRate - Sample rate in Hz
   */
  async saveTone(
    device: DeviceType,
    name: string,
    yaml: ToneYaml,
    wavData: Uint8Array,
    sampleRate: number
  ): Promise<void> {
    const safeName = sanitizeFilename(name);
    const yamlPath = getTonePath(device, safeName);
    const wavPath = getToneWavePath(device, safeName);

    // Update the wave file reference in YAML
    const yamlWithWavRef: ToneYaml = {
      ...yaml,
      wave: {
        ...yaml.wave,
        file: `${safeName}.wav`,
      },
    };

    await ensureDirectory(getTonesDirectory(device));

    // Write YAML file
    const yamlContent = stringifyYaml(yamlWithWavRef, {
      indent: 2,
      lineWidth: 120,
    });
    await writeFile(yamlPath, yamlContent, 'utf-8');

    // Write WAV file
    await writeWavFile(wavPath, wavData, sampleRate);
  }

  /**
   * Load a tone from the library.
   *
   * @param device - Device type
   * @param name - Tone name
   * @returns Tone YAML data and path to WAV file
   */
  async loadTone(
    device: DeviceType,
    name: string
  ): Promise<{ yaml: ToneYaml; wavPath: string }> {
    const safeName = sanitizeFilename(name);
    const yamlPath = getTonePath(device, safeName);
    const wavPath = getToneWavePath(device, safeName);

    const yamlContent = await readFile(yamlPath, 'utf-8');
    const parsed = parseYaml(yamlContent);
    const result = ToneYamlSchema.safeParse(parsed);

    if (!result.success) {
      throw new Error(`Invalid tone YAML at ${yamlPath}: ${result.error.message}`);
    }

    return { yaml: result.data, wavPath };
  }

  /**
   * List all tones in the library for a device.
   *
   * @param device - Device type
   * @returns Array of tone info objects
   */
  async listTones(device: DeviceType): Promise<LibraryItemInfo[]> {
    const tonesDir = getTonesDirectory(device);

    if (!existsSync(tonesDir)) {
      return [];
    }

    const files = await readdir(tonesDir);
    const yamlFiles = files.filter((f) => f.endsWith('.yaml'));

    const items: LibraryItemInfo[] = [];
    for (const file of yamlFiles) {
      const name = getBaseName(file);
      const path = getTonePath(device, name);

      try {
        const stats = await stat(path);
        items.push({
          name,
          device,
          path,
          modifiedAt: stats.mtime,
        });
      } catch {
        // Skip files we can't stat
      }
    }

    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Delete a tone from the library.
   *
   * @param device - Device type
   * @param name - Tone name
   */
  async deleteTone(device: DeviceType, name: string): Promise<void> {
    const safeName = sanitizeFilename(name);
    const yamlPath = getTonePath(device, safeName);
    const wavPath = getToneWavePath(device, safeName);

    // Delete both files, ignoring errors if they don't exist
    await Promise.all([
      unlink(yamlPath).catch(() => {}),
      unlink(wavPath).catch(() => {}),
    ]);
  }

  /**
   * Save a patch to the library.
   *
   * @param device - Device type
   * @param name - Patch name
   * @param yaml - Patch YAML data
   */
  async savePatch(device: DeviceType, name: string, yaml: PatchYaml): Promise<void> {
    const safeName = sanitizeFilename(name);
    const yamlPath = getPatchPath(device, safeName);

    await ensureDirectory(getPatchesDirectory(device));

    const yamlContent = stringifyYaml(yaml, {
      indent: 2,
      lineWidth: 120,
    });
    await writeFile(yamlPath, yamlContent, 'utf-8');
  }

  /**
   * Load a patch from the library.
   *
   * @param device - Device type
   * @param name - Patch name
   * @returns Patch YAML data
   */
  async loadPatch(device: DeviceType, name: string): Promise<PatchYaml> {
    const safeName = sanitizeFilename(name);
    const yamlPath = getPatchPath(device, safeName);

    const yamlContent = await readFile(yamlPath, 'utf-8');
    const parsed = parseYaml(yamlContent);
    const result = PatchYamlSchema.safeParse(parsed);

    if (!result.success) {
      throw new Error(`Invalid patch YAML at ${yamlPath}: ${result.error.message}`);
    }

    return result.data;
  }

  /**
   * List all patches in the library for a device.
   *
   * @param device - Device type
   * @returns Array of patch info objects
   */
  async listPatches(device: DeviceType): Promise<LibraryItemInfo[]> {
    const patchesDir = getPatchesDirectory(device);

    if (!existsSync(patchesDir)) {
      return [];
    }

    const files = await readdir(patchesDir);
    const yamlFiles = files.filter((f) => f.endsWith('.yaml'));

    const items: LibraryItemInfo[] = [];
    for (const file of yamlFiles) {
      const name = getBaseName(file);
      const path = getPatchPath(device, name);

      try {
        const stats = await stat(path);
        items.push({
          name,
          device,
          path,
          modifiedAt: stats.mtime,
        });
      } catch {
        // Skip files we can't stat
      }
    }

    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Delete a patch from the library.
   *
   * @param device - Device type
   * @param name - Patch name
   */
  async deletePatch(device: DeviceType, name: string): Promise<void> {
    const safeName = sanitizeFilename(name);
    const yamlPath = getPatchPath(device, safeName);

    await unlink(yamlPath).catch(() => {});
  }

  /**
   * Load a template from the library.
   *
   * @param device - Device type
   * @param name - Template name
   * @returns Template YAML data
   */
  async loadTemplate(device: DeviceType, name: string): Promise<TemplateYaml> {
    const safeName = sanitizeFilename(name);
    const yamlPath = getTemplatePath(device, safeName);

    const yamlContent = await readFile(yamlPath, 'utf-8');
    const parsed = parseYaml(yamlContent);
    const result = TemplateYamlSchema.safeParse(parsed);

    if (!result.success) {
      throw new Error(`Invalid template YAML at ${yamlPath}: ${result.error.message}`);
    }

    return result.data;
  }

  /**
   * List all templates in the library for a device.
   *
   * @param device - Device type
   * @returns Array of template info objects
   */
  async listTemplates(device: DeviceType): Promise<LibraryItemInfo[]> {
    const templatesDir = getTemplatesDirectory(device);

    if (!existsSync(templatesDir)) {
      return [];
    }

    const files = await readdir(templatesDir);
    const yamlFiles = files.filter((f) => f.endsWith('.yaml'));

    const items: LibraryItemInfo[] = [];
    for (const file of yamlFiles) {
      const name = getBaseName(file);
      const path = getTemplatePath(device, name);

      try {
        const stats = await stat(path);
        items.push({
          name,
          device,
          path,
          modifiedAt: stats.mtime,
        });
      } catch {
        // Skip files we can't stat
      }
    }

    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Check if a tone exists in the library.
   *
   * @param device - Device type
   * @param name - Tone name
   * @returns True if the tone exists
   */
  toneExists(device: DeviceType, name: string): boolean {
    const safeName = sanitizeFilename(name);
    return existsSync(getTonePath(device, safeName));
  }

  /**
   * Check if a patch exists in the library.
   *
   * @param device - Device type
   * @param name - Patch name
   * @returns True if the patch exists
   */
  patchExists(device: DeviceType, name: string): boolean {
    const safeName = sanitizeFilename(name);
    return existsSync(getPatchPath(device, safeName));
  }

  /**
   * Check if a template exists in the library.
   *
   * @param device - Device type
   * @param name - Template name
   * @returns True if the template exists
   */
  templateExists(device: DeviceType, name: string): boolean {
    const safeName = sanitizeFilename(name);
    return existsSync(getTemplatePath(device, safeName));
  }
}

/**
 * Default file storage instance.
 */
export const fileStorage = new FileStorage();
