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
import { getNestedDirectory, getNestedDirectoryReadOnly, moveDirectory } from '@/library-fs.js';
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
// Sample CRUD (directory bundles: {name}/sample.yaml + sample.wav)
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
 * Save a sample as a directory bundle in the common area.
 *
 * Creates `library/common/samples/{path}/{name}/` containing:
 *   - sample.yaml (metadata)
 *   - sample.wav (audio data)
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
  const parentDir = await getSamplesDir(root, path);
  const safeName = sanitizeForFilename(payload.name);
  const { onProgress } = options ?? {};

  // Create sample directory bundle
  const sampleDir = await parentDir.getDirectoryHandle(safeName, { create: true });

  const yamlContent = stringifyYaml(payload.yaml, { indent: 2, lineWidth: 120 });
  const yamlBytes = new TextEncoder().encode(yamlContent).length;
  const wavBytes = payload.wavData.byteLength;
  const totalBytes = yamlBytes + wavBytes;

  // Step 1: Save YAML metadata
  onProgress?.({
    currentStep: 1,
    totalSteps: 2,
    stepLabel: `Saving metadata: ${safeName}/sample.yaml`,
    bytesSent: 0,
    bytesTotal: yamlBytes,
    bytesSentAllSteps: 0,
    bytesTotalAllSteps: totalBytes,
  });

  const yamlHandle = await sampleDir.getFileHandle('sample.yaml', { create: true });
  const yamlWritable = await yamlHandle.createWritable();
  await yamlWritable.write(yamlContent);
  await yamlWritable.close();

  onProgress?.({
    currentStep: 1,
    totalSteps: 2,
    stepLabel: `Saving metadata: ${safeName}/sample.yaml`,
    bytesSent: yamlBytes,
    bytesTotal: yamlBytes,
    bytesSentAllSteps: 0,
    bytesTotalAllSteps: totalBytes,
  });

  // Step 2: Save WAV audio data
  onProgress?.({
    currentStep: 2,
    totalSteps: 2,
    stepLabel: `Saving audio: ${safeName}/sample.wav`,
    bytesSent: 0,
    bytesTotal: wavBytes,
    bytesSentAllSteps: yamlBytes,
    bytesTotalAllSteps: totalBytes,
  });

  const wavHandle = await sampleDir.getFileHandle('sample.wav', { create: true });
  const wavWritable = await wavHandle.createWritable();
  await wavWritable.write(payload.wavData);
  await wavWritable.close();

  onProgress?.({
    currentStep: 2,
    totalSteps: 2,
    stepLabel: `Saving audio: ${safeName}/sample.wav`,
    bytesSent: wavBytes,
    bytesTotal: wavBytes,
    bytesSentAllSteps: yamlBytes,
    bytesTotalAllSteps: totalBytes,
  });
}

/**
 * Load a sample directory bundle from the common area.
 *
 * Reads from `library/common/samples/{path}/{name}/`:
 *   - sample.yaml (metadata)
 *   - sample.wav (audio data)
 *
 * @param root - Library root directory handle
 * @param name - Sample directory name
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
  const parentDir = await getSamplesDirReadOnly(root, path);
  const safeName = sanitizeForFilename(name);
  const { onProgress } = options ?? {};

  // Navigate into sample directory bundle
  const sampleDir = await parentDir.getDirectoryHandle(safeName);

  // Step 1: Load YAML metadata
  const yamlHandle = await sampleDir.getFileHandle('sample.yaml');
  const yamlFile = await yamlHandle.getFile();

  // Get WAV file handle to determine total bytes upfront
  const wavHandle = await sampleDir.getFileHandle('sample.wav');
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
          stepLabel: `Loading metadata: ${safeName}/sample.yaml`,
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
          stepLabel: `Loading audio: ${safeName}/sample.wav`,
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
 * @param name - Sample directory name
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
  const parentDir = await getSamplesDirReadOnly(root, path);
  const safeName = sanitizeForFilename(name);
  const { onProgress } = options ?? {};

  // Navigate into sample directory bundle
  const sampleDir = await parentDir.getDirectoryHandle(safeName);

  const yamlHandle = await sampleDir.getFileHandle('sample.yaml');
  const yamlFile = await yamlHandle.getFile();
  const totalBytes = yamlFile.size;

  const progressCallback: ReadProgressCallback | undefined = onProgress
    ? (bytesRead, bytesTotal) => {
        onProgress({
          currentStep: 1,
          totalSteps: 1,
          stepLabel: `Loading metadata: ${safeName}/sample.yaml`,
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
 * Delete a library item (directory bundle) from the common area.
 *
 * All items (samples, chopped samples, programs) are stored as directory
 * bundles, so this simply removes the directory recursively.
 *
 * The `name` parameter is the filesystem directory name,
 * NOT the display name from the YAML.
 */
export async function deleteItem(
  root: StorageDirectoryHandle,
  name: string,
  path: string[] = [],
): Promise<void> {
  const dir = await getSamplesDir(root, path);
  await dir.removeEntry(name, { recursive: true });
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
