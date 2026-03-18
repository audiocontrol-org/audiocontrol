/**
 * Storage operations for chopped samples.
 *
 * Handles CRUD operations for device-agnostic chopped sample bundles,
 * each containing a manifest.yaml and source.wav.
 *
 * @packageDocumentation
 */

import { readFile, writeFile, mkdir, readdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname } from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import {
  ChoppedSampleSchema,
  type ChoppedSample,
  type ChoppedSampleInfo,
} from '@/schemas/chopped-sample-schema.js';
import {
  getChoppedSamplesDirectory,
  getChoppedSampleDirectory,
  getChoppedSampleManifestPath,
  getChoppedSampleSourcePath,
} from './chopped-sample-paths.js';
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
 * Write a WAV file from raw PCM data (16-bit mono).
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

  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileSize, true);
  writeString(view, 8, 'WAVE');

  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

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
 * Storage implementation for chopped samples.
 *
 * Provides CRUD operations for device-agnostic chopped sample bundles.
 */
export class ChoppedSampleStorage {
  /**
   * Save a chopped sample with its source audio.
   *
   * @param manifest - Chopped sample manifest data
   * @param wavData - Raw PCM audio data (16-bit)
   * @throws Error if the sample already exists
   */
  async save(manifest: ChoppedSample, wavData: Uint8Array): Promise<void> {
    const result = ChoppedSampleSchema.safeParse(manifest);
    if (!result.success) {
      throw new Error(`Invalid chopped sample manifest: ${result.error.message}`);
    }

    const safeName = sanitizeFilename(manifest.name);
    const sampleDir = getChoppedSampleDirectory(safeName);

    if (existsSync(sampleDir)) {
      throw new Error(`Chopped sample "${manifest.name}" already exists`);
    }

    await ensureDirectory(sampleDir);

    const now = new Date().toISOString();
    const manifestWithTimestamps: ChoppedSample = {
      ...manifest,
      createdAt: manifest.createdAt ?? now,
      modifiedAt: now,
    };

    const manifestPath = getChoppedSampleManifestPath(safeName);
    const yamlContent = stringifyYaml(manifestWithTimestamps, {
      indent: 2,
      lineWidth: 120,
    });
    await writeFile(manifestPath, yamlContent, 'utf-8');

    const sourcePath = getChoppedSampleSourcePath(safeName);
    await writeWavFile(sourcePath, wavData, manifest.sampleRate);
  }

  /**
   * Load a chopped sample manifest and source path.
   *
   * @param name - Sample name
   * @returns Manifest and path to the source WAV file
   */
  async load(name: string): Promise<{ manifest: ChoppedSample; sourcePath: string }> {
    const safeName = sanitizeFilename(name);
    const manifestPath = getChoppedSampleManifestPath(safeName);

    if (!existsSync(manifestPath)) {
      throw new Error(`Chopped sample "${name}" not found`);
    }

    const yamlContent = await readFile(manifestPath, 'utf-8');
    const parsed = parseYaml(yamlContent);
    const result = ChoppedSampleSchema.safeParse(parsed);

    if (!result.success) {
      throw new Error(`Invalid chopped sample manifest at ${manifestPath}: ${result.error.message}`);
    }

    return {
      manifest: result.data,
      sourcePath: getChoppedSampleSourcePath(safeName),
    };
  }

  /**
   * List all chopped samples.
   *
   * @returns Array of chopped sample info sorted by name
   */
  async list(): Promise<ChoppedSampleInfo[]> {
    const samplesDir = getChoppedSamplesDirectory();

    if (!existsSync(samplesDir)) {
      return [];
    }

    const entries = await readdir(samplesDir, { withFileTypes: true });
    const directories = entries.filter((e) => e.isDirectory());

    const samples: ChoppedSampleInfo[] = [];

    for (const dir of directories) {
      try {
        const { manifest } = await this.load(dir.name);
        samples.push({
          name: manifest.name,
          variant: manifest.variant,
          sliceCount: manifest.slices.length,
          description: manifest.description,
          createdAt: manifest.createdAt,
          modifiedAt: manifest.modifiedAt,
        });
      } catch {
        // Skip invalid entries
      }
    }

    return samples.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Update a chopped sample's manifest (does not replace the source WAV).
   *
   * @param name - Sample name
   * @param manifest - Updated manifest data
   */
  async update(name: string, manifest: ChoppedSample): Promise<void> {
    const safeName = sanitizeFilename(name);
    const sampleDir = getChoppedSampleDirectory(safeName);

    if (!existsSync(sampleDir)) {
      throw new Error(`Chopped sample "${name}" not found`);
    }

    const result = ChoppedSampleSchema.safeParse(manifest);
    if (!result.success) {
      throw new Error(`Invalid chopped sample manifest: ${result.error.message}`);
    }

    const updatedManifest: ChoppedSample = {
      ...manifest,
      modifiedAt: new Date().toISOString(),
    };

    const manifestPath = getChoppedSampleManifestPath(safeName);
    const yamlContent = stringifyYaml(updatedManifest, {
      indent: 2,
      lineWidth: 120,
    });
    await writeFile(manifestPath, yamlContent, 'utf-8');
  }

  /**
   * Delete a chopped sample and all its files.
   *
   * @param name - Sample name
   */
  async delete(name: string): Promise<void> {
    const safeName = sanitizeFilename(name);
    const sampleDir = getChoppedSampleDirectory(safeName);

    if (existsSync(sampleDir)) {
      await rm(sampleDir, { recursive: true, force: true });
    }
  }

  /**
   * Check if a chopped sample exists.
   *
   * @param name - Sample name
   * @returns True if the sample exists
   */
  exists(name: string): boolean {
    const safeName = sanitizeFilename(name);
    return existsSync(getChoppedSampleManifestPath(safeName));
  }
}

/**
 * Default chopped sample storage instance.
 */
export const choppedSampleStorage = new ChoppedSampleStorage();
