/**
 * Library filesystem operations — directory management, File System Access API,
 * and shared types for the library service modules.
 */

// =========================================================================
// Hierarchical Library Types
// =========================================================================

/**
 * Library item category types that support subdirectories.
 */
export type LibraryCategory = 'tones' | 'patches' | 'drum-kits';

/**
 * Tree node for rendering hierarchical library contents.
 * Used by both directories and items (tones, patches, drum-kits).
 */
export interface LibraryTreeNode {
  /** Unique identifier for this node (path joined by '/') */
  id: string;
  /** Display name */
  name: string;
  /** Node type */
  type: 'directory' | 'tone' | 'patch' | 'drum-kit';
  /** Path segments from category root (empty for root items) */
  path: string[];
  /** Child nodes (only for directories) */
  children?: LibraryTreeNode[];
  /** Whether directory is expanded in UI (client state, not persisted) */
  isExpanded?: boolean;
  /** File name for items (without extension) */
  fileName?: string;
  /** Directory name for patches/drum-kits */
  directoryName?: string;
  /** Additional metadata for patches */
  toneCount?: number;
  /** Additional metadata for drum kits */
  kitCount?: number;
  sampleCount?: number;
  description?: string;
}

/**
 * Constant for library categories (exported for consumers).
 */
export const LIBRARY_CATEGORIES: LibraryCategory[] = ['tones', 'patches', 'drum-kits'];

// =========================================================================
// File System Access API
// =========================================================================

/**
 * Check if the File System Access API is available
 */
export function hasFileSystemAccess(): boolean {
  return 'showSaveFilePicker' in window && 'showDirectoryPicker' in window;
}

// In-memory cache for the library directory handle
let cachedDirectoryHandle: FileSystemDirectoryHandle | null = null;

/**
 * Get the cached library directory handle, if available and still has permission.
 */
export async function getCachedLibraryDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!cachedDirectoryHandle) {
    return null;
  }

  // Verify we still have permission
  try {
    const permission = await cachedDirectoryHandle.queryPermission({ mode: 'readwrite' });
    if (permission === 'granted') {
      return cachedDirectoryHandle;
    }

    // Try to request permission
    const requested = await cachedDirectoryHandle.requestPermission({ mode: 'readwrite' });
    if (requested === 'granted') {
      return cachedDirectoryHandle;
    }
  } catch {
    // Permission check failed, clear cache
    cachedDirectoryHandle = null;
  }

  return null;
}

/**
 * Set the cached library directory handle.
 */
export function setCachedLibraryDirectory(handle: FileSystemDirectoryHandle | null): void {
  cachedDirectoryHandle = handle;
}

/**
 * Get a directory handle for the library.
 * Must be called directly from a user gesture (click handler).
 * Returns null if user cancels or API not available.
 */
export async function pickLibraryDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!hasFileSystemAccess()) {
    return null;
  }

  try {
    return await window.showDirectoryPicker({
      id: 'sampler-library',
      mode: 'readwrite',
      startIn: 'documents',
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return null; // User cancelled
    }
    throw err;
  }
}

// =========================================================================
// Directory Navigation Helpers (exported for other library modules)
// =========================================================================

/**
 * Get or create a nested directory path within a directory handle.
 */
export async function getNestedDirectory(
  rootHandle: FileSystemDirectoryHandle,
  path: string[]
): Promise<FileSystemDirectoryHandle> {
  let current = rootHandle;
  for (const segment of path) {
    current = await current.getDirectoryHandle(segment, { create: true });
  }
  return current;
}

/**
 * Get a nested directory without creating it.
 * Returns null if any part of the path doesn't exist.
 */
export async function getNestedDirectoryIfExists(
  rootHandle: FileSystemDirectoryHandle,
  path: string[]
): Promise<FileSystemDirectoryHandle | null> {
  let current = rootHandle;
  try {
    for (const segment of path) {
      current = await current.getDirectoryHandle(segment, { create: false });
    }
    return current;
  } catch {
    return null;
  }
}

// =========================================================================
// Directory Operations
// =========================================================================

/**
 * Create a subdirectory within a library category.
 */
export async function createDirectory(
  libraryDir: FileSystemDirectoryHandle,
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
 * Copy all contents from source directory to target directory.
 */
export async function copyDirectoryContents(
  source: FileSystemDirectoryHandle,
  target: FileSystemDirectoryHandle
): Promise<void> {
  for await (const entry of source.values()) {
    if (entry.kind === 'file') {
      const sourceFile = await source.getFileHandle(entry.name);
      const file = await sourceFile.getFile();
      const targetFile = await target.getFileHandle(entry.name, { create: true });
      const writable = await targetFile.createWritable();
      await writable.write(await file.arrayBuffer());
      await writable.close();
    } else {
      const sourceSubdir = await source.getDirectoryHandle(entry.name);
      const targetSubdir = await target.getDirectoryHandle(entry.name, { create: true });
      await copyDirectoryContents(sourceSubdir, targetSubdir);
    }
  }
}

/**
 * Move a single file from source to target directory.
 */
async function moveFile(
  sourceDir: FileSystemDirectoryHandle,
  targetDir: FileSystemDirectoryHandle,
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
  libraryDir: FileSystemDirectoryHandle,
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
  libraryDir: FileSystemDirectoryHandle,
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
  libraryDir: FileSystemDirectoryHandle,
  oldName: string,
  newName: string,
  path: string[] = []
): Promise<void> {
  await renameDirectory(libraryDir, 'patches', [...path, oldName], newName);
}

/**
 * Rename a drum kit (directory).
 */
export async function renameDrumKit(
  libraryDir: FileSystemDirectoryHandle,
  oldName: string,
  newName: string,
  path: string[] = []
): Promise<void> {
  await renameDirectory(libraryDir, 'drum-kits', [...path, oldName], newName);
}

/**
 * Delete a directory from a library category.
 */
export async function deleteDirectory(
  libraryDir: FileSystemDirectoryHandle,
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
  libraryDir: FileSystemDirectoryHandle,
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
  libraryDir: FileSystemDirectoryHandle,
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
// TypeScript declarations for File System Access API
// =========================================================================

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
    getFile(): Promise<File>;
    createWritable(): Promise<FileSystemWritableFileStream>;
  }

  interface FileSystemDirectoryHandle {
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
    getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
    queryPermission(options?: { mode?: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
    requestPermission(options?: { mode?: 'read' | 'readwrite' }): Promise<'granted' | 'denied' | 'prompt'>;
    removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
    values(): AsyncIterable<FileSystemHandle>;
  }

  interface FileSystemHandle {
    readonly kind: 'file' | 'directory';
    readonly name: string;
  }

  interface FileSystemWritableFileStream extends WritableStream {
    write(data: string | Blob | ArrayBuffer): Promise<void>;
    close(): Promise<void>;
  }
}
