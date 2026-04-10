/**
 * Library filesystem operations — directory management and editor-specific
 * operations (rename, move, delete, create).
 *
 * Types and scanning functions are re-exported from @audiocontrol/sampler-library.
 * Connection management is handled by useLibraryConnection from editor-core.
 */

import {
  LIBRARY_CATEGORIES as _LIBRARY_CATEGORIES,
  getNestedDirectory,
  getNestedDirectoryIfExists,
  copyDirectoryContents,
  type LibraryCategory,
  type StorageDirectoryHandle,
} from '@audiocontrol/sampler-library/browser';

// Re-export shared types and helpers from sampler-library
export type { LibraryCategory, LibraryTreeNode, StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
export {
  LIBRARY_CATEGORIES,
  getNestedDirectory,
  getNestedDirectoryIfExists,
} from '@audiocontrol/sampler-library/browser';

// =========================================================================
// Directory Operations
// =========================================================================

/**
 * Create a subdirectory within a library category.
 */
export async function createDirectory(
  libraryDir: StorageDirectoryHandle,
  category: LibraryCategory,
  path: string[],
  name: string
): Promise<void> {
  const sanitizedName = name.replace(/[<>:"/\\|?*]/g, '_').trim();
  if (!sanitizedName) {
    throw new Error('Directory name cannot be empty');
  }

  const parentDir = await getNestedDirectory(libraryDir, ['library', 's330', category, ...path]);
  await parentDir.getDirectoryHandle(sanitizedName, { create: true });
}

/**
 * Move a single file from source to target directory.
 */
async function moveFile(
  sourceDir: StorageDirectoryHandle,
  targetDir: StorageDirectoryHandle,
  fileName: string
): Promise<void> {
  const sourceFile = await sourceDir.getFileHandle(fileName);
  const file = await sourceFile.getFile();
  const targetFile = await targetDir.getFileHandle(fileName, { create: true });
  const writable = await targetFile.createWritable();
  await writable.write(await file.arrayBuffer());
  await writable.close();
  await sourceDir.removeEntry(fileName);
}

/**
 * Rename a directory within a library category.
 */
export async function renameDirectory(
  libraryDir: StorageDirectoryHandle,
  category: LibraryCategory,
  path: string[],
  newName: string
): Promise<void> {
  if (path.length === 0) {
    throw new Error('Cannot rename root category directory');
  }

  const sanitizedNewName = newName.replace(/[<>:"/\\|?*]/g, '_').trim();
  if (!sanitizedNewName) {
    throw new Error('Directory name cannot be empty');
  }

  const parentPath = path.slice(0, -1);
  const oldName = path[path.length - 1];

  if (oldName === sanitizedNewName) {
    return;
  }

  const parentDir = await getNestedDirectory(libraryDir, ['library', 's330', category, ...parentPath]);
  const sourceDir = await parentDir.getDirectoryHandle(oldName, { create: false });
  const targetDir = await parentDir.getDirectoryHandle(sanitizedNewName, { create: true });

  await copyDirectoryContents(sourceDir, targetDir);
  await parentDir.removeEntry(oldName, { recursive: true });
}

/**
 * Rename an individual tone (YAML + WAV files).
 */
export async function renameIndividualTone(
  libraryDir: StorageDirectoryHandle,
  oldName: string,
  newName: string,
  path: string[] = []
): Promise<void> {
  const sanitizedNewName = newName.replace(/[<>:"/\\|?*]/g, '_').trim();
  if (!sanitizedNewName) {
    throw new Error('Tone name cannot be empty');
  }

  if (oldName === sanitizedNewName) {
    return;
  }

  const tonesDir = await getNestedDirectory(libraryDir, ['library', 's330', 'tones', ...path]);

  // Rename YAML file
  const oldYamlFile = await tonesDir.getFileHandle(`${oldName}.yaml`, { create: false });
  const yamlContent = await (await oldYamlFile.getFile()).arrayBuffer();
  const newYamlFile = await tonesDir.getFileHandle(`${sanitizedNewName}.yaml`, { create: true });
  const yamlWritable = await newYamlFile.createWritable();
  await yamlWritable.write(yamlContent);
  await yamlWritable.close();
  await tonesDir.removeEntry(`${oldName}.yaml`);

  // Rename WAV file if it exists
  try {
    const oldWavFile = await tonesDir.getFileHandle(`${oldName}.wav`, { create: false });
    const wavContent = await (await oldWavFile.getFile()).arrayBuffer();
    const newWavFile = await tonesDir.getFileHandle(`${sanitizedNewName}.wav`, { create: true });
    const wavWritable = await newWavFile.createWritable();
    await wavWritable.write(wavContent);
    await wavWritable.close();
    await tonesDir.removeEntry(`${oldName}.wav`);
  } catch {
    // WAV file might not exist, that's OK
  }
}

/**
 * Rename an individual patch bundle (directory).
 */
export async function renameIndividualPatch(
  libraryDir: StorageDirectoryHandle,
  oldName: string,
  newName: string,
  path: string[] = []
): Promise<void> {
  await renameDirectory(libraryDir, 'patches', [...path, oldName], newName);
}

/**
 * Delete a directory from a library category.
 */
export async function deleteDirectory(
  libraryDir: StorageDirectoryHandle,
  category: LibraryCategory,
  path: string[],
  recursive: boolean = true
): Promise<void> {
  if (path.length === 0) {
    throw new Error('Cannot delete root category directory');
  }

  const parentPath = path.slice(0, -1);
  const dirName = path[path.length - 1];

  const parentDir = await getNestedDirectory(libraryDir, ['library', 's330', category, ...parentPath]);
  await parentDir.removeEntry(dirName, { recursive });
}

/**
 * Get directory contents for display (items and subdirectories at a path).
 */
export async function getDirectoryContents(
  libraryDir: StorageDirectoryHandle,
  category: LibraryCategory,
  path: string[]
): Promise<{ files: string[]; directories: string[] }> {
  const files: string[] = [];
  const directories: string[] = [];

  const targetDir = await getNestedDirectoryIfExists(
    libraryDir,
    ['library', 's330', category, ...path]
  );

  if (!targetDir) {
    return { files, directories };
  }

  for await (const entry of targetDir.values()) {
    if (entry.kind === 'directory') {
      directories.push(entry.name);
    } else {
      files.push(entry.name);
    }
  }

  return {
    files: files.sort((a, b) => a.localeCompare(b)),
    directories: directories.sort((a, b) => a.localeCompare(b)),
  };
}

/**
 * Move an item (tone, patch, drum-kit, or directory) to a new location.
 */
export async function moveItem(
  libraryDir: StorageDirectoryHandle,
  category: LibraryCategory,
  sourcePath: string[],
  itemName: string,
  targetPath: string[]
): Promise<void> {
  const sourceDir = await getNestedDirectory(libraryDir, ['library', 's330', category, ...sourcePath]);
  const targetDir = await getNestedDirectory(libraryDir, ['library', 's330', category, ...targetPath]);

  // Check if source exists as a directory
  let isDirectory = false;
  try {
    await sourceDir.getDirectoryHandle(itemName, { create: false });
    isDirectory = true;
  } catch {
    // Not a directory, might be files
  }

  if (isDirectory) {
    const sourceDirHandle = await sourceDir.getDirectoryHandle(itemName, { create: false });
    const targetDirHandle = await targetDir.getDirectoryHandle(itemName, { create: true });

    await copyDirectoryContents(sourceDirHandle, targetDirHandle);
    await sourceDir.removeEntry(itemName, { recursive: true });
  } else {
    if (category === 'tones') {
      await moveFile(sourceDir, targetDir, `${itemName}.yaml`);
      try {
        await moveFile(sourceDir, targetDir, `${itemName}.wav`);
      } catch {
        // WAV file might not exist
      }
    } else {
      const itemDir = await sourceDir.getDirectoryHandle(itemName, { create: false });
      const targetItemDir = await targetDir.getDirectoryHandle(itemName, { create: true });
      await copyDirectoryContents(itemDir, targetItemDir);
      await sourceDir.removeEntry(itemName, { recursive: true });
    }
  }
}

// =========================================================================
// TypeScript declarations for File System Access API (editor-specific)
// =========================================================================

// Core FSAA types are declared in @audiocontrol/sampler-library.
// These extend them with editor-specific picker types.

declare global {
  interface Window {
    showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
    showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
    showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
  }

  interface SaveFilePickerOptions {
    suggestedName?: string;
    types?: FilePickerAcceptType[];
  }

  interface OpenFilePickerOptions {
    multiple?: boolean;
    types?: FilePickerAcceptType[];
  }

  interface DirectoryPickerOptions {
    id?: string;
    mode?: 'read' | 'readwrite';
    startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
  }

  interface FilePickerAcceptType {
    description?: string;
    accept: Record<string, string[]>;
  }

  interface FileSystemFileHandle {
    createWritable(): Promise<FileSystemWritableFileStream>;
  }

  interface FileSystemDirectoryHandle {
    queryPermission(options?: { mode?: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
    requestPermission(options?: { mode?: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
  }

  interface FileSystemWritableFileStream extends WritableStream {
    write(data: string | Blob | ArrayBuffer): Promise<void>;
    close(): Promise<void>;
  }
}
