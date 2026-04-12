/**
 * Common-area CRUD operations for programs.
 *
 * Programs are higher-order constructs that reference samples and define
 * how they're mapped across the keyboard. Stored as directory bundles:
 *
 *   library/common/programs/{name}/
 *     program.yaml
 *     samples/
 *       kick.wav
 *       snare.wav
 *
 * All functions accept a {@link StorageDirectoryHandle} library root
 * and are runtime-agnostic -- the same code works with browser FSAA
 * handles or a Node.js adapter.
 *
 * @packageDocumentation
 */

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import type { StorageDirectoryHandle } from '@/storage-handles.js';
import type { ProgramYaml } from '@/schemas/index.js';
import { ProgramYamlSchema } from '@/schemas/index.js';
import { getNestedDirectory, getNestedDirectoryReadOnly } from '@/library-fs.js';
import { sanitizeForFilename } from './import.js';
import type { SampleProgressCallback } from './samples.js';

const SAMPLES_ROOT = ['library', 'common', 'samples'];
const PROGRAMS_ROOT = ['library', 'common', 'programs'];

/** Get programs directory, creating if needed (for writes). */
async function getProgramsDir(
  root: StorageDirectoryHandle,
): Promise<StorageDirectoryHandle> {
  return getNestedDirectory(root, PROGRAMS_ROOT);
}

/** Get programs directory for read-only access (cacheable). */
async function getProgramsDirReadOnly(
  root: StorageDirectoryHandle,
): Promise<StorageDirectoryHandle> {
  return getNestedDirectoryReadOnly(root, PROGRAMS_ROOT);
}

/** Get samples directory for read-only access (legacy program location). */
async function getSamplesDirReadOnly(
  root: StorageDirectoryHandle,
  path: string[] = [],
): Promise<StorageDirectoryHandle> {
  return getNestedDirectoryReadOnly(root, [...SAMPLES_ROOT, ...path]);
}

// =========================================================================
// Types
// =========================================================================

/**
 * A WAV file to include in the program bundle.
 */
export interface ProgramWavFile {
  /** Filename for this WAV within the program's samples/ directory */
  filename: string;
  /** Raw WAV audio data */
  data: ArrayBuffer;
}

/**
 * Payload for saving a program to the common area.
 */
export interface ProgramSavePayload {
  /** Program directory name */
  name: string;
  /** Program YAML metadata */
  yaml: ProgramYaml;
  /** WAV files to include in the program bundle */
  wavFiles: ProgramWavFile[];
}

/**
 * Result of loading a program from the common area.
 */
export interface ProgramLoadResult {
  /** Parsed and validated program YAML */
  yaml: ProgramYaml;
  /** WAV files from the program's samples/ directory */
  wavFiles: ProgramWavFile[];
}

/**
 * Options for program operations.
 */
export interface ProgramSaveOptions {
  onProgress?: SampleProgressCallback;
}

export interface ProgramLoadOptions {
  onProgress?: SampleProgressCallback;
}

// =========================================================================
// Save
// =========================================================================

/**
 * Save a program as a directory bundle in the common area.
 *
 * Creates `library/common/programs/{name}/` containing:
 *   - program.yaml (metadata)
 *   - samples/{filename}.wav (one per zone)
 *
 * @param root - Library root directory handle
 * @param payload - Program data to save
 * @param options - Optional progress tracking
 */
export async function saveProgram(
  root: StorageDirectoryHandle,
  payload: ProgramSavePayload,
  options?: ProgramSaveOptions,
): Promise<void> {
  const validated = ProgramYamlSchema.safeParse(payload.yaml);
  if (!validated.success) {
    throw new Error(`Invalid program YAML: ${validated.error.message}`);
  }

  const programsDir = await getProgramsDir(root);
  const safeName = sanitizeForFilename(payload.name);
  const { onProgress } = options ?? {};

  // Create program directory bundle
  const programDir = await programsDir.getDirectoryHandle(safeName, { create: true });

  // Calculate total bytes for progress
  const yamlContent = stringifyYaml(validated.data, { indent: 2, lineWidth: 120 });
  const yamlBytes = new TextEncoder().encode(yamlContent).length;
  const wavTotalBytes = payload.wavFiles.reduce((sum, f) => sum + f.data.byteLength, 0);
  const totalBytes = yamlBytes + wavTotalBytes;
  const totalSteps = 1 + payload.wavFiles.length;

  // Step 1: Save program.yaml
  onProgress?.({
    currentStep: 1,
    totalSteps,
    stepLabel: `Saving metadata: ${safeName}/program.yaml`,
    bytesSent: 0,
    bytesTotal: yamlBytes,
    bytesSentAllSteps: 0,
    bytesTotalAllSteps: totalBytes,
  });

  const yamlHandle = await programDir.getFileHandle('program.yaml', { create: true });
  const yamlWritable = await yamlHandle.createWritable();
  await yamlWritable.write(yamlContent);
  await yamlWritable.close();

  onProgress?.({
    currentStep: 1,
    totalSteps,
    stepLabel: `Saving metadata: ${safeName}/program.yaml`,
    bytesSent: yamlBytes,
    bytesTotal: yamlBytes,
    bytesSentAllSteps: 0,
    bytesTotalAllSteps: totalBytes,
  });

  // Steps 2+: Save WAV files into samples/ subdirectory
  if (payload.wavFiles.length > 0) {
    const samplesDir = await programDir.getDirectoryHandle('samples', { create: true });
    let bytesSentPrior = yamlBytes;

    for (let i = 0; i < payload.wavFiles.length; i++) {
      const wavFile = payload.wavFiles[i];
      const step = i + 2;
      const wavBytes = wavFile.data.byteLength;

      onProgress?.({
        currentStep: step,
        totalSteps,
        stepLabel: `Saving audio: ${safeName}/samples/${wavFile.filename}`,
        bytesSent: 0,
        bytesTotal: wavBytes,
        bytesSentAllSteps: bytesSentPrior,
        bytesTotalAllSteps: totalBytes,
      });

      const wavHandle = await samplesDir.getFileHandle(wavFile.filename, { create: true });
      const wavWritable = await wavHandle.createWritable();
      await wavWritable.write(wavFile.data);
      await wavWritable.close();

      bytesSentPrior += wavBytes;

      onProgress?.({
        currentStep: step,
        totalSteps,
        stepLabel: `Saving audio: ${safeName}/samples/${wavFile.filename}`,
        bytesSent: wavBytes,
        bytesTotal: wavBytes,
        bytesSentAllSteps: bytesSentPrior,
        bytesTotalAllSteps: totalBytes,
      });
    }
  }
}

// =========================================================================
// Load
// =========================================================================

/**
 * Resolve a program directory handle by name, trying sanitized then raw name.
 */
async function resolveProgramDir(
  parentDir: StorageDirectoryHandle,
  name: string,
): Promise<StorageDirectoryHandle> {
  const safeName = sanitizeForFilename(name);
  try {
    return await parentDir.getDirectoryHandle(safeName);
  } catch {
    return parentDir.getDirectoryHandle(name.trim());
  }
}

/**
 * Read and validate program.yaml from a directory handle.
 */
async function readProgramYaml(
  programDir: StorageDirectoryHandle,
  name: string,
): Promise<ProgramYaml> {
  const yamlHandle = await programDir.getFileHandle('program.yaml');
  const yamlFile = await yamlHandle.getFile();
  const yamlText = await yamlFile.text();
  const parsed = parseYaml(yamlText);
  const result = ProgramYamlSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid program YAML for "${name}": ${result.error.message}`);
  }
  return result.data;
}

/**
 * Load a program's metadata from the common area.
 *
 * When called without `path`, reads from `library/common/programs/{name}/`.
 * When called with `path`, reads from `library/common/samples/{path}/{name}/`
 * (legacy location for programs stored alongside samples).
 *
 * @param root - Library root directory handle
 * @param name - Program directory name
 * @param path - Optional subdirectory path within samples folder (legacy)
 */
export async function loadProgramMeta(
  root: StorageDirectoryHandle,
  name: string,
  path?: string[],
): Promise<ProgramYaml> {
  const parentDir = path !== undefined
    ? await getSamplesDirReadOnly(root, path)
    : await getProgramsDirReadOnly(root);
  const programDir = await resolveProgramDir(parentDir, name);
  return readProgramYaml(programDir, name);
}

/**
 * Load a program's metadata from `library/common/programs/`.
 *
 * Alias for `loadProgramMeta(root, name)` without a path argument.
 * Exists for callers that explicitly want the dedicated programs directory.
 */
export async function loadProgramFromProgramsDir(
  root: StorageDirectoryHandle,
  name: string,
): Promise<ProgramYaml> {
  return loadProgramMeta(root, name);
}

/**
 * Load a full program bundle (metadata + WAV files) from the common area.
 *
 * @param root - Library root directory handle
 * @param name - Program directory name
 * @param options - Optional progress tracking
 */
export async function loadProgram(
  root: StorageDirectoryHandle,
  name: string,
  options?: ProgramLoadOptions,
): Promise<ProgramLoadResult> {
  const programsDir = await getProgramsDirReadOnly(root);
  const { onProgress } = options ?? {};

  const programDir = await resolveProgramDir(programsDir, name);

  // Load and validate program.yaml
  const yamlHandle = await programDir.getFileHandle('program.yaml');
  const yamlFile = await yamlHandle.getFile();
  const result = { data: await readProgramYaml(programDir, name) };

  // Enumerate WAV files in samples/ subdirectory
  const wavFiles: ProgramWavFile[] = [];
  let samplesDir: StorageDirectoryHandle;
  try {
    samplesDir = await programDir.getDirectoryHandle('samples');
  } catch {
    // No samples directory — return yaml only
    return { yaml: result.data, wavFiles: [] };
  }

  // Collect WAV file handles first to calculate total bytes
  const wavEntries: Array<{ filename: string; file: { arrayBuffer(): Promise<ArrayBuffer>; size: number } }> = [];
  for await (const entry of samplesDir.values()) {
    if (entry.kind === 'file' && entry.name.endsWith('.wav')) {
      const fileHandle = await samplesDir.getFileHandle(entry.name);
      const file = await fileHandle.getFile();
      wavEntries.push({ filename: entry.name, file });
    }
  }

  const yamlSize = yamlFile.size;
  const wavTotalBytes = wavEntries.reduce((sum, e) => sum + e.file.size, 0);
  const totalBytes = yamlSize + wavTotalBytes;
  const totalSteps = 1 + wavEntries.length;

  // Report YAML as already loaded (step 1 complete)
  onProgress?.({
    currentStep: 1,
    totalSteps,
    stepLabel: `Loaded metadata: ${name}/program.yaml`,
    bytesSent: yamlSize,
    bytesTotal: yamlSize,
    bytesSentAllSteps: 0,
    bytesTotalAllSteps: totalBytes,
  });

  // Load WAV files with progress
  let bytesSentPrior = yamlSize;
  for (let i = 0; i < wavEntries.length; i++) {
    const wavEntry = wavEntries[i];
    const step = i + 2;
    const wavBytes = wavEntry.file.size;

    onProgress?.({
      currentStep: step,
      totalSteps,
      stepLabel: `Loading audio: ${name}/samples/${wavEntry.filename}`,
      bytesSent: 0,
      bytesTotal: wavBytes,
      bytesSentAllSteps: bytesSentPrior,
      bytesTotalAllSteps: totalBytes,
    });

    const data = await wavEntry.file.arrayBuffer();
    wavFiles.push({ filename: wavEntry.filename, data });

    bytesSentPrior += wavBytes;

    onProgress?.({
      currentStep: step,
      totalSteps,
      stepLabel: `Loading audio: ${name}/samples/${wavEntry.filename}`,
      bytesSent: wavBytes,
      bytesTotal: wavBytes,
      bytesSentAllSteps: bytesSentPrior,
      bytesTotalAllSteps: totalBytes,
    });
  }

  return { yaml: result.data, wavFiles };
}

/**
 * Get the program's directory handle from `library/common/programs/`.
 */
export async function getProgramDirFromProgramsDir(
  root: StorageDirectoryHandle,
  name: string,
): Promise<StorageDirectoryHandle> {
  const programsDir = await getProgramsDirReadOnly(root);
  const safeName = sanitizeForFilename(name);
  try {
    return await programsDir.getDirectoryHandle(safeName);
  } catch {
    return programsDir.getDirectoryHandle(name.trim());
  }
}
