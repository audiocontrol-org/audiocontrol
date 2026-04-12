/**
 * Common-area CRUD operations for programs.
 *
 * Programs are higher-order constructs that reference samples and define
 * how they're mapped across the keyboard. Stored as directory bundles in
 * `library/common/samples/`.
 *
 * All functions accept a {@link StorageDirectoryHandle} library root
 * and are runtime-agnostic — the same code works with browser FSAA
 * handles or a Node.js adapter.
 *
 * @packageDocumentation
 */

import { parse as parseYaml } from 'yaml';

import type { StorageDirectoryHandle } from '@/storage-handles.js';
import type { ProgramYaml } from '@/schemas/index.js';
import { ProgramYamlSchema } from '@/schemas/index.js';
import { getNestedDirectoryReadOnly } from '@/library-fs.js';
import { sanitizeForFilename } from './import.js';

const SAMPLES_ROOT = ['library', 'common', 'samples'];
const PROGRAMS_ROOT = ['library', 'common', 'programs'];

/** Get samples directory for read-only access (cacheable). */
async function getSamplesDirReadOnly(
  root: StorageDirectoryHandle,
  path: string[] = [],
): Promise<StorageDirectoryHandle> {
  return getNestedDirectoryReadOnly(root, [...SAMPLES_ROOT, ...path]);
}

/**
 * Load a program's metadata from the common area.
 *
 * Programs are stored as directory bundles:
 *   {name}/program.yaml
 *
 * @param root - Library root directory handle
 * @param name - Program directory name
 * @param path - Optional subdirectory path within samples folder
 */
export async function loadProgramMeta(
  root: StorageDirectoryHandle,
  name: string,
  path: string[] = [],
): Promise<ProgramYaml> {
  const parentDir = await getSamplesDirReadOnly(root, path);
  const safeName = sanitizeForFilename(name);

  // Navigate into program directory bundle (fallback to raw name for pre-migration dirs)
  let programDir: StorageDirectoryHandle;
  try {
    programDir = await parentDir.getDirectoryHandle(safeName);
  } catch {
    programDir = await parentDir.getDirectoryHandle(name.trim());
  }

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
 * Load a program's metadata from `library/common/programs/`.
 *
 * This is the dedicated programs directory (separate from samples).
 * Programs saved via disk-to-library use this path.
 */
export async function loadProgramFromProgramsDir(
  root: StorageDirectoryHandle,
  name: string,
): Promise<ProgramYaml> {
  const programsDir = await getNestedDirectoryReadOnly(root, PROGRAMS_ROOT);
  const safeName = sanitizeForFilename(name);
  let programDir: StorageDirectoryHandle;
  try {
    programDir = await programsDir.getDirectoryHandle(safeName);
  } catch {
    // Fallback: try the raw name (for directories created before space→underscore migration)
    programDir = await programsDir.getDirectoryHandle(name.trim());
  }

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
 * Get the program's directory handle from `library/common/programs/`.
 */
export async function getProgramDirFromProgramsDir(
  root: StorageDirectoryHandle,
  name: string,
): Promise<StorageDirectoryHandle> {
  const programsDir = await getNestedDirectoryReadOnly(root, PROGRAMS_ROOT);
  const safeName = sanitizeForFilename(name);
  try {
    return await programsDir.getDirectoryHandle(safeName);
  } catch {
    return programsDir.getDirectoryHandle(name.trim());
  }
}
