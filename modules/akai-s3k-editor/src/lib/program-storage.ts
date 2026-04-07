/**
 * S3000XL program library storage.
 *
 * Saves and loads serialized S3000XL programs to/from the library
 * directory tree. Programs are stored as directory bundles under
 * `library/s3k/programs/{sanitized-name}/program.s3k.yaml`.
 *
 * Uses the abstract StorageDirectoryHandle interface from sampler-library,
 * so it works with OPFS, local FS, or any other backend.
 */

import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';

// =========================================================================
// Constants
// =========================================================================

const PROGRAMS_PATH = ['library', 's3k', 'programs'];
const MANIFEST_FILENAME = 'program.s3k.yaml';

// =========================================================================
// Helpers
// =========================================================================

/**
 * Sanitize a program name for use as a filesystem directory name.
 * Replaces characters that are invalid in common filesystems.
 */
function sanitizeForFilename(name: string): string {
  return name
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '_');
}

/**
 * Navigate to or create the programs directory.
 */
async function getProgramsDir(
  root: StorageDirectoryHandle,
): Promise<StorageDirectoryHandle> {
  let dir = root;
  for (const segment of PROGRAMS_PATH) {
    dir = await dir.getDirectoryHandle(segment, { create: true });
  }
  return dir;
}

/**
 * Navigate to the programs directory for reading.
 * Returns null if the directory does not exist.
 */
async function getProgramsDirReadOnly(
  root: StorageDirectoryHandle,
): Promise<StorageDirectoryHandle | null> {
  let dir = root;
  for (const segment of PROGRAMS_PATH) {
    try {
      dir = await dir.getDirectoryHandle(segment);
    } catch {
      return null;
    }
  }
  return dir;
}

// =========================================================================
// Public API
// =========================================================================

/**
 * Save a serialized program YAML string to the library.
 *
 * Creates a directory bundle: `programs/{name}/program.s3k.yaml`
 */
export async function saveProgramToLibrary(
  root: StorageDirectoryHandle,
  name: string,
  yamlContent: string,
): Promise<void> {
  const programsDir = await getProgramsDir(root);
  const safeName = sanitizeForFilename(name);

  const programDir = await programsDir.getDirectoryHandle(safeName, { create: true });
  const fileHandle = await programDir.getFileHandle(MANIFEST_FILENAME, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(yamlContent);
  await writable.close();
}

/**
 * Save a sample WAV file into a program's directory bundle.
 *
 * Stores at: `programs/{programName}/samples/{sampleName}.wav`
 */
export async function saveProgramSample(
  root: StorageDirectoryHandle,
  programName: string,
  sampleName: string,
  wavData: ArrayBuffer,
): Promise<void> {
  const programsDir = await getProgramsDir(root);
  const safeProgramName = sanitizeForFilename(programName);
  const safeSampleName = sanitizeForFilename(sampleName.trim());

  const programDir = await programsDir.getDirectoryHandle(safeProgramName, { create: true });
  const samplesDir = await programDir.getDirectoryHandle('samples', { create: true });
  const fileHandle = await samplesDir.getFileHandle(`${safeSampleName}.wav`, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(wavData);
  await writable.close();
}

/**
 * Load a serialized program YAML string from the library.
 *
 * @returns The raw YAML text, ready for deserializeProgram()
 */
export async function loadProgramFromLibrary(
  root: StorageDirectoryHandle,
  name: string,
): Promise<string> {
  const programsDir = await getProgramsDirReadOnly(root);
  if (!programsDir) {
    throw new Error(`Programs directory does not exist`);
  }

  const safeName = sanitizeForFilename(name);
  const programDir = await programsDir.getDirectoryHandle(safeName);
  const fileHandle = await programDir.getFileHandle(MANIFEST_FILENAME);
  const file = await fileHandle.getFile();
  return file.text();
}

/** Summary info for a stored program listing. */
export interface StoredProgramInfo {
  /** Directory name (sanitized) */
  dirName: string;
  /** Program name from the YAML (human-readable) */
  name: string;
  /** Number of keygroups */
  keygroupCount: number;
  /** Sample names referenced */
  sampleReferences: string[];
}

/**
 * List all S3000XL programs stored in the library.
 *
 * Scans `library/s3k/programs/` for directories containing
 * `program.s3k.yaml` and returns summary info for each.
 */
export async function listStoredPrograms(
  root: StorageDirectoryHandle,
): Promise<StoredProgramInfo[]> {
  const programsDir = await getProgramsDirReadOnly(root);
  if (!programsDir) return [];

  const results: StoredProgramInfo[] = [];

  for await (const entry of programsDir.values()) {
    if (entry.kind !== 'directory') continue;

    try {
      const subDir = await programsDir.getDirectoryHandle(entry.name);
      const fileHandle = await subDir.getFileHandle(MANIFEST_FILENAME);
      const file = await fileHandle.getFile();
      const text = await file.text();

      // Quick parse — just extract the top-level fields we need
      const lines = text.split('\n');
      let name = entry.name;
      let keygroupCount = 0;
      const sampleReferences: string[] = [];
      let inSampleRefs = false;

      for (const line of lines) {
        if (line.startsWith('name: ')) {
          name = line.slice(6).trim();
        } else if (line.startsWith('keygroupCount: ')) {
          keygroupCount = parseInt(line.slice(15), 10) || 0;
        } else if (line.startsWith('sampleReferences:')) {
          inSampleRefs = true;
        } else if (inSampleRefs && line.startsWith('  - ')) {
          sampleReferences.push(line.slice(4).trim());
        } else if (inSampleRefs && !line.startsWith('  ')) {
          inSampleRefs = false;
        }
      }

      results.push({ dirName: entry.name, name, keygroupCount, sampleReferences });
    } catch {
      // Skip directories without valid program manifests
    }
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Delete a stored program from the library.
 */
export async function deleteStoredProgram(
  root: StorageDirectoryHandle,
  dirName: string,
): Promise<void> {
  const programsDir = await getProgramsDirReadOnly(root);
  if (!programsDir) {
    throw new Error('Programs directory does not exist');
  }
  await programsDir.removeEntry(dirName, { recursive: true });
}
