/**
 * Common-area CRUD operations for samples and chopped samples.
 *
 * All functions accept a {@link StorageDirectoryHandle} library root
 * and operate within `library/common/samples/`. They are runtime-agnostic
 * — the same code works with browser FSAA handles or a Node.js adapter.
 *
 * @packageDocumentation
 */

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import type { StorageDirectoryHandle } from '@/storage-handles.js';
import type { SampleYaml } from '@/schemas/index.js';
import type { ChoppedSample } from '@/schemas/index.js';
import { SampleYamlSchema, ChoppedSampleSchema } from '@/schemas/index.js';
import { getNestedDirectory, getNestedDirectoryIfExists, getNestedDirectoryReadOnly, moveDirectory } from '@/library-fs.js';
import { sanitizeForFilename } from './import.js';

const SAMPLES_ROOT = ['library', 'common', 'samples'];

// =========================================================================
// Internal helpers
// =========================================================================

/** Get samples directory, creating if needed (for writes). */
async function getSamplesDir(
  root: StorageDirectoryHandle,
  path: string[] = [],
): Promise<StorageDirectoryHandle> {
  return getNestedDirectory(root, [...SAMPLES_ROOT, ...path]);
}

/** Get samples directory for read-only access (cacheable). */
async function getSamplesDirReadOnly(
  root: StorageDirectoryHandle,
  path: string[] = [],
): Promise<StorageDirectoryHandle> {
  return getNestedDirectoryReadOnly(root, [...SAMPLES_ROOT, ...path]);
}

// =========================================================================
// Sample CRUD (YAML + WAV file pairs)
// =========================================================================

export interface SampleSavePayload {
  name: string;
  yaml: SampleYaml;
  wavData: ArrayBuffer;
}

export interface SampleLoadResult {
  yaml: SampleYaml;
  wavData: ArrayBuffer;
}

/**
 * Save a sample as a YAML + WAV file pair in the common area.
 *
 * Files are written to `library/common/samples/{path}/{name}.yaml`
 * and `library/common/samples/{path}/{name}.wav`.
 */
export async function saveSample(
  root: StorageDirectoryHandle,
  payload: SampleSavePayload,
  path: string[] = [],
): Promise<void> {
  const dir = await getSamplesDir(root, path);
  const safeName = sanitizeForFilename(payload.name);

  const yamlContent = stringifyYaml(payload.yaml, { indent: 2, lineWidth: 120 });
  const yamlHandle = await dir.getFileHandle(`${safeName}.yaml`, { create: true });
  const yamlWritable = await yamlHandle.createWritable();
  await yamlWritable.write(yamlContent);
  await yamlWritable.close();

  const wavHandle = await dir.getFileHandle(`${safeName}.wav`, { create: true });
  const wavWritable = await wavHandle.createWritable();
  await wavWritable.write(payload.wavData);
  await wavWritable.close();
}

/**
 * Load a sample YAML + WAV pair from the common area.
 */
export async function loadSample(
  root: StorageDirectoryHandle,
  name: string,
  path: string[] = [],
): Promise<SampleLoadResult> {
  const dir = await getSamplesDirReadOnly(root, path);
  const safeName = sanitizeForFilename(name);

  const yamlHandle = await dir.getFileHandle(`${safeName}.yaml`);
  const yamlFile = await yamlHandle.getFile();
  const yamlText = await yamlFile.text();
  const parsed = parseYaml(yamlText);
  const result = SampleYamlSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid sample YAML for "${name}": ${result.error.message}`);
  }

  const wavHandle = await dir.getFileHandle(`${safeName}.wav`);
  const wavFile = await wavHandle.getFile();
  const wavData = await wavFile.arrayBuffer();

  return { yaml: result.data, wavData };
}

/**
 * Load only the sample YAML metadata (without the WAV file).
 *
 * Use this when displaying sample info without needing audio data.
 * Much faster than loadSample for high-latency backends.
 */
export async function loadSampleMeta(
  root: StorageDirectoryHandle,
  name: string,
  path: string[] = [],
): Promise<SampleYaml> {
  const dir = await getSamplesDirReadOnly(root, path);
  const safeName = sanitizeForFilename(name);

  const yamlHandle = await dir.getFileHandle(`${safeName}.yaml`);
  const yamlFile = await yamlHandle.getFile();
  const yamlText = await yamlFile.text();
  const parsed = parseYaml(yamlText);
  const result = SampleYamlSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid sample YAML for "${name}": ${result.error.message}`);
  }

  return result.data;
}

// =========================================================================
// Chopped Sample CRUD (directory bundles)
// =========================================================================

export interface ChoppedSampleSavePayload {
  name: string;
  manifest: ChoppedSample;
  wavData: ArrayBuffer;
}

export interface ChoppedSampleLoadResult {
  manifest: ChoppedSample;
  wavData: ArrayBuffer;
}

/**
 * Save a chopped sample as a directory bundle:
 * `library/common/samples/{path}/{name}/manifest.yaml` + `source.wav`.
 */
export async function saveChoppedSample(
  root: StorageDirectoryHandle,
  payload: ChoppedSampleSavePayload,
  path: string[] = [],
): Promise<void> {
  const samplesDir = await getSamplesDir(root, path);
  const safeName = sanitizeForFilename(payload.name);
  const sampleDir = await samplesDir.getDirectoryHandle(safeName, { create: true });

  const result = ChoppedSampleSchema.safeParse(payload.manifest);
  if (!result.success) {
    throw new Error(`Invalid manifest: ${result.error.message}`);
  }

  const yamlContent = stringifyYaml(result.data, { indent: 2, lineWidth: 120 });
  const yamlHandle = await sampleDir.getFileHandle('manifest.yaml', { create: true });
  const yamlWritable = await yamlHandle.createWritable();
  await yamlWritable.write(yamlContent);
  await yamlWritable.close();

  const wavHandle = await sampleDir.getFileHandle('source.wav', { create: true });
  const wavWritable = await wavHandle.createWritable();
  await wavWritable.write(payload.wavData);
  await wavWritable.close();
}

/**
 * Load a chopped sample bundle (manifest.yaml + source.wav).
 */
export async function loadChoppedSample(
  root: StorageDirectoryHandle,
  name: string,
  path: string[] = [],
): Promise<ChoppedSampleLoadResult> {
  const samplesDir = await getSamplesDir(root, path);
  const safeName = sanitizeForFilename(name);
  const sampleDir = await samplesDir.getDirectoryHandle(safeName, { create: false });

  const manifestHandle = await sampleDir.getFileHandle('manifest.yaml');
  const manifestFile = await manifestHandle.getFile();
  const manifestText = await manifestFile.text();
  const parsed = parseYaml(manifestText);
  const result = ChoppedSampleSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid manifest for "${name}": ${result.error.message}`);
  }

  const wavHandle = await sampleDir.getFileHandle('source.wav');
  const wavFile = await wavHandle.getFile();
  const wavData = await wavFile.arrayBuffer();

  return { manifest: result.data, wavData };
}

// =========================================================================
// Directory management
// =========================================================================

/**
 * Delete a library item (file pair or directory bundle) from the common area.
 *
 * For file-pair samples, removes both the `.yaml` and `.wav` files.
 * For directory bundles (chopped samples, programs), removes the directory.
 * The `name` parameter is the filesystem base name (without extension),
 * NOT the display name from the YAML.
 */
export async function deleteItem(
  root: StorageDirectoryHandle,
  name: string,
  path: string[] = [],
): Promise<void> {
  const dir = await getSamplesDir(root, path);

  // Try directory bundle first (chopped samples, programs)
  try {
    await dir.removeEntry(name, { recursive: true });
    return;
  } catch {
    // Not a directory — try file pair
  }

  // Remove file pair (.yaml + .wav)
  let deleted = false;
  for (const ext of ['.yaml', '.wav']) {
    try {
      await dir.removeEntry(name + ext);
      deleted = true;
    } catch {
      // File may not exist (e.g., orphan yaml without wav)
    }
  }

  if (!deleted) {
    throw new Error(`Could not find "${name}" to delete`);
  }
}

/**
 * Create a subdirectory in the common area for organizing samples.
 */
export async function createFolder(
  root: StorageDirectoryHandle,
  path: string[],
  name: string,
): Promise<void> {
  const parentDir = await getSamplesDir(root, path);
  await parentDir.getDirectoryHandle(name, { create: true });
}

/**
 * Move a library item between directories in the common area.
 */
export async function moveItem(
  root: StorageDirectoryHandle,
  name: string,
  fromPath: string[],
  toPath: string[],
): Promise<void> {
  const srcParent = await getSamplesDir(root, fromPath);
  const destParent = await getSamplesDir(root, toPath);
  await moveDirectory(srcParent, name, destParent);
}
