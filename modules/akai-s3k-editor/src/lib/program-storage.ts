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
  /** Sample names referenced in the YAML */
  sampleReferences: string[];
  /** WAV file names found in the samples/ subdirectory (without extension) */
  sampleFiles: string[];
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

      // Scan the samples/ subdirectory for WAV files
      const sampleFiles: string[] = [];
      try {
        const samplesDir = await subDir.getDirectoryHandle('samples');
        for await (const sampleEntry of samplesDir.values()) {
          if (sampleEntry.kind === 'file' && sampleEntry.name.endsWith('.wav')) {
            sampleFiles.push(sampleEntry.name.replace(/\.wav$/, ''));
          }
        }
        sampleFiles.sort((a, b) => a.localeCompare(b));
      } catch {
        // No samples/ directory — that's fine
      }

      results.push({ dirName: entry.name, name, keygroupCount, sampleReferences, sampleFiles });
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

/**
 * Atomically rename a sample inside a program directory.
 *
 * 1. Reads the program YAML and the sample WAV
 * 2. Writes the new WAV file
 * 3. Updates sampleReferences in the YAML
 * 4. Deletes the old WAV file
 *
 * If any step fails after the YAML has been written, the YAML is
 * reverted to its original content.
 */
export async function renameProgramSample(
  root: StorageDirectoryHandle,
  programDirName: string,
  oldSampleName: string,
  newSampleName: string,
): Promise<void> {
  const programsDir = await getProgramsDirReadOnly(root);
  if (!programsDir) throw new Error('Programs directory does not exist');

  const programDir = await programsDir.getDirectoryHandle(programDirName);
  const samplesDir = await programDir.getDirectoryHandle('samples');

  const safeOld = sanitizeForFilename(oldSampleName);
  const safeNew = sanitizeForFilename(newSampleName);
  if (safeOld === safeNew) return;

  // 1. Read original YAML content (for rollback)
  const yamlHandle = await programDir.getFileHandle(MANIFEST_FILENAME);
  const yamlFile = await yamlHandle.getFile();
  const originalYaml = await yamlFile.text();

  // 2. Read the original WAV data
  const oldWavHandle = await samplesDir.getFileHandle(`${safeOld}.wav`);
  const oldWavFile = await oldWavHandle.getFile();
  const wavData = await oldWavFile.arrayBuffer();

  // 3. Write the new WAV file
  const newWavHandle = await samplesDir.getFileHandle(`${safeNew}.wav`, { create: true });
  const newWavWritable = await newWavHandle.createWritable();
  await newWavWritable.write(wavData);
  await newWavWritable.close();

  // 4. Update YAML — replace old sample name with new in sampleReferences
  const updatedYaml = originalYaml.replace(
    new RegExp(`(  - )${escapeRegex(oldSampleName.trim())}`, 'g'),
    `$1${newSampleName.trim()}`,
  );

  try {
    const yamlWritable = await yamlHandle.createWritable();
    await yamlWritable.write(updatedYaml);
    await yamlWritable.close();
  } catch (err) {
    // YAML write failed — remove the new WAV to keep state consistent
    try { await samplesDir.removeEntry(`${safeNew}.wav`); } catch { /* best effort */ }
    throw err;
  }

  // 5. Delete the old WAV file
  try {
    await samplesDir.removeEntry(`${safeOld}.wav`);
  } catch (err) {
    // Old WAV deletion failed — rollback the YAML to original
    try {
      const rollbackWritable = await yamlHandle.createWritable();
      await rollbackWritable.write(originalYaml);
      await rollbackWritable.close();
    } catch { /* best effort rollback */ }
    // Also remove the new WAV
    try { await samplesDir.removeEntry(`${safeNew}.wav`); } catch { /* best effort */ }
    throw err;
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
