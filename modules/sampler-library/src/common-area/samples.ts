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
import { readFileWithProgress, readTextWithProgress, type ReadProgressCallback } from './streaming.js';

/**
 * Structured progress for a multi-step operation.
 *
 * This type is intentionally compatible with `OperationProgress` from
 * `@audiocontrol/editor-core`, allowing progress data to be passed directly
 * to UI components like `OperationProgressBar`.
 *
 * Overall progress is byte-weighted (not step-weighted) so that a
 * 10 MB upload step doesn't appear as equal to a 100-byte metadata write.
 */
export interface OperationProgress {
  /** Current step number (1-based) */
  currentStep: number;
  /** Total number of steps in the operation */
  totalSteps: number;
  /** Human-readable label for the current step (e.g., "Loading KICK1.wav") */
  stepLabel: string;
  /** Bytes transferred in the current step */
  bytesSent: number;
  /** Total bytes to transfer in the current step */
  bytesTotal: number;
  /** Bytes completed in all prior steps (for byte-weighted overall progress) */
  bytesSentAllSteps: number;
  /** Total bytes across ALL steps in the entire operation */
  bytesTotalAllSteps: number;
}

/**
 * Progress callback for sample operations.
 *
 * The callback receives {@link OperationProgress} data that can be passed
 * directly to `OperationProgressBar` from `@audiocontrol/editor-core`.
 */
export interface SampleProgressCallback {
  (progress: OperationProgress): void;
}

/**
 * Options for sample load operations.
 */
export interface SampleLoadOptions {
  /** Optional progress callback for tracking download progress. */
  onProgress?: SampleProgressCallback;
}

/**
 * Options for sample save operations.
 */
export interface SampleSaveOptions {
  /** Optional progress callback for tracking upload progress. */
  onProgress?: SampleProgressCallback;
}

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
 *
 * @param root - Library root directory handle
 * @param payload - Sample data to save (name, yaml, wavData)
 * @param path - Optional subdirectory path within samples folder
 * @param options - Optional progress tracking options
 *
 * @example
 * ```typescript
 * // Basic save without progress
 * await saveSample(root, { name: 'kick', yaml, wavData });
 *
 * // Save with progress reporting (for UI feedback)
 * await saveSample(root, { name: 'kick', yaml, wavData }, [], {
 *   onProgress: (p) => {
 *     console.log(`${p.stepLabel}: ${p.bytesSent}/${p.bytesTotal} bytes`);
 *     // Use with OperationProgressBar from @audiocontrol/editor-core
 *     setProgress(p);
 *   },
 * });
 * ```
 */
export async function saveSample(
  root: StorageDirectoryHandle,
  payload: SampleSavePayload,
  path: string[] = [],
  options?: SampleSaveOptions,
): Promise<void> {
  const dir = await getSamplesDir(root, path);
  const safeName = sanitizeForFilename(payload.name);
  const { onProgress } = options ?? {};

  const yamlContent = stringifyYaml(payload.yaml, { indent: 2, lineWidth: 120 });
  const yamlBytes = new TextEncoder().encode(yamlContent).length;
  const wavBytes = payload.wavData.byteLength;
  const totalBytes = yamlBytes + wavBytes;

  // Step 1: Save YAML metadata
  onProgress?.({
    currentStep: 1,
    totalSteps: 2,
    stepLabel: `Saving metadata: ${safeName}.yaml`,
    bytesSent: 0,
    bytesTotal: yamlBytes,
    bytesSentAllSteps: 0,
    bytesTotalAllSteps: totalBytes,
  });

  const yamlHandle = await dir.getFileHandle(`${safeName}.yaml`, { create: true });
  const yamlWritable = await yamlHandle.createWritable();
  await yamlWritable.write(yamlContent);
  await yamlWritable.close();

  onProgress?.({
    currentStep: 1,
    totalSteps: 2,
    stepLabel: `Saving metadata: ${safeName}.yaml`,
    bytesSent: yamlBytes,
    bytesTotal: yamlBytes,
    bytesSentAllSteps: 0,
    bytesTotalAllSteps: totalBytes,
  });

  // Step 2: Save WAV audio data
  onProgress?.({
    currentStep: 2,
    totalSteps: 2,
    stepLabel: `Saving audio: ${safeName}.wav`,
    bytesSent: 0,
    bytesTotal: wavBytes,
    bytesSentAllSteps: yamlBytes,
    bytesTotalAllSteps: totalBytes,
  });

  const wavHandle = await dir.getFileHandle(`${safeName}.wav`, { create: true });
  const wavWritable = await wavHandle.createWritable();
  await wavWritable.write(payload.wavData);
  await wavWritable.close();

  onProgress?.({
    currentStep: 2,
    totalSteps: 2,
    stepLabel: `Saving audio: ${safeName}.wav`,
    bytesSent: wavBytes,
    bytesTotal: wavBytes,
    bytesSentAllSteps: yamlBytes,
    bytesTotalAllSteps: totalBytes,
  });
}

/**
 * Load a sample YAML + WAV pair from the common area.
 *
 * @param root - Library root directory handle
 * @param name - Sample name (without extension)
 * @param path - Optional subdirectory path within samples folder
 * @param options - Optional progress tracking options
 *
 * @example
 * ```typescript
 * // Basic load without progress
 * const { yaml, wavData } = await loadSample(root, 'kick');
 *
 * // Load with progress reporting (useful for large files on slow backends)
 * const result = await loadSample(root, 'kick', [], {
 *   onProgress: (p) => {
 *     const percent = Math.round((p.bytesSentAllSteps + p.bytesSent) / p.bytesTotalAllSteps * 100);
 *     console.log(`Loading: ${percent}%`);
 *     // Or pass directly to OperationProgressBar from @audiocontrol/editor-core
 *     setLoadProgress(p);
 *   },
 * });
 * ```
 */
export async function loadSample(
  root: StorageDirectoryHandle,
  name: string,
  path: string[] = [],
  options?: SampleLoadOptions,
): Promise<SampleLoadResult> {
  const dir = await getSamplesDirReadOnly(root, path);
  const safeName = sanitizeForFilename(name);
  const { onProgress } = options ?? {};

  // Step 1: Load YAML metadata
  const yamlHandle = await dir.getFileHandle(`${safeName}.yaml`);
  const yamlFile = await yamlHandle.getFile();

  // Get WAV file handle to determine total bytes upfront
  const wavHandle = await dir.getFileHandle(`${safeName}.wav`);
  const wavFile = await wavHandle.getFile();

  const yamlSize = yamlFile.size;
  const wavSize = wavFile.size;
  const totalBytes = yamlSize + wavSize;

  // Read YAML with progress
  const yamlProgressCallback: ReadProgressCallback | undefined = onProgress
    ? (bytesRead, bytesTotal) => {
        onProgress({
          currentStep: 1,
          totalSteps: 2,
          stepLabel: `Loading metadata: ${safeName}.yaml`,
          bytesSent: bytesRead,
          bytesTotal,
          bytesSentAllSteps: 0,
          bytesTotalAllSteps: totalBytes,
        });
      }
    : undefined;

  const yamlText = await readTextWithProgress(yamlFile, yamlProgressCallback);
  const parsed = parseYaml(yamlText);
  const result = SampleYamlSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid sample YAML for "${name}": ${result.error.message}`);
  }

  // Step 2: Load WAV data with progress
  const wavProgressCallback: ReadProgressCallback | undefined = onProgress
    ? (bytesRead, bytesTotal) => {
        onProgress({
          currentStep: 2,
          totalSteps: 2,
          stepLabel: `Loading audio: ${safeName}.wav`,
          bytesSent: bytesRead,
          bytesTotal,
          bytesSentAllSteps: yamlSize,
          bytesTotalAllSteps: totalBytes,
        });
      }
    : undefined;

  const wavData = await readFileWithProgress(wavFile, wavProgressCallback);

  return { yaml: result.data, wavData };
}

/**
 * Load only the sample YAML metadata (without the WAV file).
 *
 * Use this when displaying sample info without needing audio data.
 * Much faster than loadSample for high-latency backends.
 *
 * @param root - Library root directory handle
 * @param name - Sample name (without extension)
 * @param path - Optional subdirectory path within samples folder
 * @param options - Optional progress tracking options
 *
 * @example
 * ```typescript
 * // Quick metadata load for UI display
 * const meta = await loadSampleMeta(root, 'kick');
 * console.log(`Sample: ${meta.name}, ${meta.sampleRate}Hz`);
 *
 * // With progress (rarely needed for small YAML files)
 * const meta = await loadSampleMeta(root, 'kick', [], {
 *   onProgress: setLoadProgress,
 * });
 * ```
 */
export async function loadSampleMeta(
  root: StorageDirectoryHandle,
  name: string,
  path: string[] = [],
  options?: SampleLoadOptions,
): Promise<SampleYaml> {
  const dir = await getSamplesDirReadOnly(root, path);
  const safeName = sanitizeForFilename(name);
  const { onProgress } = options ?? {};

  const yamlHandle = await dir.getFileHandle(`${safeName}.yaml`);
  const yamlFile = await yamlHandle.getFile();
  const totalBytes = yamlFile.size;

  const progressCallback: ReadProgressCallback | undefined = onProgress
    ? (bytesRead, bytesTotal) => {
        onProgress({
          currentStep: 1,
          totalSteps: 1,
          stepLabel: `Loading metadata: ${safeName}.yaml`,
          bytesSent: bytesRead,
          bytesTotal,
          bytesSentAllSteps: 0,
          bytesTotalAllSteps: totalBytes,
        });
      }
    : undefined;

  const yamlText = await readTextWithProgress(yamlFile, progressCallback);
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
