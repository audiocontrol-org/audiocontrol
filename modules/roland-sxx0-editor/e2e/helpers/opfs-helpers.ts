/**
 * OPFS (Origin Private File System) helpers for e2e tests.
 *
 * These functions are designed to be used with Playwright's page.evaluate().
 * They work entirely in browser context using only Web APIs.
 */

// ----------------------------------------------------------------------------
// Type Augmentation for File System Access API
// ----------------------------------------------------------------------------

/**
 * FileSystemDirectoryHandle has async iterator methods that aren't fully typed
 * in all TypeScript versions. These declarations ensure type safety.
 */
declare global {
  interface FileSystemDirectoryHandle {
    keys(): AsyncIterableIterator<string>;
    values(): AsyncIterableIterator<FileSystemHandle>;
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  }
}

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface FixtureFile {
  content: string | Uint8Array;
}

export interface FixtureDirectory {
  [name: string]: FixtureFile | FixtureDirectory;
}

export interface DirectoryEntry {
  name: string;
  kind: 'file' | 'directory';
}

// ----------------------------------------------------------------------------
// Type Guards
// ----------------------------------------------------------------------------

function isFixtureFile(value: FixtureFile | FixtureDirectory): value is FixtureFile {
  return 'content' in value;
}

// ----------------------------------------------------------------------------
// Internal Helpers
// ----------------------------------------------------------------------------

/**
 * Convert Uint8Array to ArrayBuffer, ensuring we get a fresh ArrayBuffer
 * (not a view into a SharedArrayBuffer).
 */
function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  // Create a new ArrayBuffer and copy the data
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  return buffer;
}

// ----------------------------------------------------------------------------
// Core Functions
// ----------------------------------------------------------------------------

/**
 * Initialize OPFS with standard library directory structure.
 * Creates the following directories:
 * - library/tones/
 * - library/patches/
 * - library/sets/
 *
 * @returns The OPFS root directory handle
 */
export async function initializeOPFS(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();

  // Create library directory
  const libraryDir = await root.getDirectoryHandle('library', { create: true });

  // Create subdirectories
  await libraryDir.getDirectoryHandle('tones', { create: true });
  await libraryDir.getDirectoryHandle('patches', { create: true });
  await libraryDir.getDirectoryHandle('sets', { create: true });

  return root;
}

/**
 * Recursively delete all contents under OPFS root.
 * Handles errors gracefully if directories don't exist.
 */
export async function cleanupOPFS(): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory();

    // Collect all entries first to avoid iterator invalidation
    const entries: string[] = [];
    for await (const name of root.keys()) {
      entries.push(name);
    }

    // Delete each entry recursively
    for (const name of entries) {
      try {
        await root.removeEntry(name, { recursive: true });
      } catch {
        // Entry may have already been deleted or doesn't exist
      }
    }
  } catch {
    // Root directory access failed - nothing to clean up
  }
}

/**
 * Populate OPFS with fixture files and directories.
 *
 * @param rootHandle - The directory handle to populate under
 * @param fixtures - Object describing the directory/file structure to create
 *
 * @example
 * ```typescript
 * await populateFixtures(root, {
 *   library: {
 *     tones: {
 *       'test.yaml': { content: 'name: Test Tone' }
 *     }
 *   }
 * });
 * ```
 */
export async function populateFixtures(
  rootHandle: FileSystemDirectoryHandle,
  fixtures: FixtureDirectory
): Promise<void> {
  for (const [name, value] of Object.entries(fixtures)) {
    if (isFixtureFile(value)) {
      // Create file
      const fileHandle = await rootHandle.getFileHandle(name, { create: true });
      const writable = await fileHandle.createWritable();

      if (typeof value.content === 'string') {
        await writable.write(value.content);
      } else {
        // Write binary data as a fresh ArrayBuffer
        await writable.write(toArrayBuffer(value.content));
      }

      await writable.close();
    } else {
      // Create directory and recurse
      const dirHandle = await rootHandle.getDirectoryHandle(name, { create: true });
      await populateFixtures(dirHandle, value);
    }
  }
}

/**
 * Read a file from OPFS given a path.
 *
 * @param rootHandle - The root directory handle to start from
 * @param path - Path to the file (e.g., 'library/tones/test.yaml')
 * @returns File contents as string (for text) or ArrayBuffer (for binary)
 */
export async function readFile(
  rootHandle: FileSystemDirectoryHandle,
  path: string
): Promise<string | ArrayBuffer> {
  const parts = path.split('/').filter((p) => p.length > 0);

  if (parts.length === 0) {
    throw new Error('Path cannot be empty');
  }

  const fileName = parts.pop();
  if (!fileName) {
    throw new Error('Path must include a file name');
  }

  // Navigate to the containing directory
  let currentDir = rootHandle;
  for (const dirName of parts) {
    currentDir = await currentDir.getDirectoryHandle(dirName);
  }

  // Get and read the file
  const fileHandle = await currentDir.getFileHandle(fileName);
  const file = await fileHandle.getFile();

  // Try to detect if it's text or binary based on file type
  // Default to text if type is empty or text-like
  const isText =
    file.type === '' ||
    file.type.startsWith('text/') ||
    file.type === 'application/json' ||
    file.type === 'application/yaml' ||
    file.name.endsWith('.yaml') ||
    file.name.endsWith('.yml') ||
    file.name.endsWith('.json') ||
    file.name.endsWith('.txt');

  if (isText) {
    return await file.text();
  }

  return await file.arrayBuffer();
}

/**
 * List all entries in a directory.
 *
 * @param dirHandle - The directory handle to list
 * @returns Array of directory entries with name and kind
 */
export async function listDirectory(
  dirHandle: FileSystemDirectoryHandle
): Promise<DirectoryEntry[]> {
  const entries: DirectoryEntry[] = [];

  for await (const [name, handle] of dirHandle.entries()) {
    entries.push({
      name,
      kind: handle.kind,
    });
  }

  // Sort entries for consistent ordering (directories first, then alphabetically)
  entries.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return entries;
}

/**
 * Check if a file exists at the given path.
 *
 * @param rootHandle - The root directory handle to start from
 * @param path - Path to check (e.g., 'library/tones/test.yaml')
 * @returns true if file exists, false otherwise
 */
export async function fileExists(
  rootHandle: FileSystemDirectoryHandle,
  path: string
): Promise<boolean> {
  const parts = path.split('/').filter((p) => p.length > 0);

  if (parts.length === 0) {
    return false;
  }

  const fileName = parts.pop();
  if (!fileName) {
    return false;
  }

  try {
    // Navigate to the containing directory
    let currentDir = rootHandle;
    for (const dirName of parts) {
      currentDir = await currentDir.getDirectoryHandle(dirName);
    }

    // Try to get the file handle
    await currentDir.getFileHandle(fileName);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a directory exists at the given path.
 *
 * @param rootHandle - The root directory handle to start from
 * @param path - Path to check (e.g., 'library/tones')
 * @returns true if directory exists, false otherwise
 */
export async function directoryExists(
  rootHandle: FileSystemDirectoryHandle,
  path: string
): Promise<boolean> {
  const parts = path.split('/').filter((p) => p.length > 0);

  if (parts.length === 0) {
    // Root always exists
    return true;
  }

  try {
    let currentDir = rootHandle;
    for (const dirName of parts) {
      currentDir = await currentDir.getDirectoryHandle(dirName);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Get a directory handle at the given path.
 *
 * @param rootHandle - The root directory handle to start from
 * @param path - Path to the directory (e.g., 'library/tones')
 * @returns The directory handle
 */
export async function getDirectory(
  rootHandle: FileSystemDirectoryHandle,
  path: string
): Promise<FileSystemDirectoryHandle> {
  const parts = path.split('/').filter((p) => p.length > 0);

  let currentDir = rootHandle;
  for (const dirName of parts) {
    currentDir = await currentDir.getDirectoryHandle(dirName);
  }

  return currentDir;
}

/**
 * Write a file to OPFS at the given path, creating directories as needed.
 *
 * @param rootHandle - The root directory handle to start from
 * @param path - Path to the file (e.g., 'library/tones/test.yaml')
 * @param content - File content as string or Uint8Array
 */
export async function writeFile(
  rootHandle: FileSystemDirectoryHandle,
  path: string,
  content: string | Uint8Array
): Promise<void> {
  const parts = path.split('/').filter((p) => p.length > 0);

  if (parts.length === 0) {
    throw new Error('Path cannot be empty');
  }

  const fileName = parts.pop();
  if (!fileName) {
    throw new Error('Path must include a file name');
  }

  // Navigate to/create the containing directory
  let currentDir = rootHandle;
  for (const dirName of parts) {
    currentDir = await currentDir.getDirectoryHandle(dirName, { create: true });
  }

  // Create and write the file
  const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();

  if (typeof content === 'string') {
    await writable.write(content);
  } else {
    // Write binary data as a fresh ArrayBuffer
    await writable.write(toArrayBuffer(content));
  }

  await writable.close();
}

/**
 * Delete a file at the given path.
 *
 * @param rootHandle - The root directory handle to start from
 * @param path - Path to the file (e.g., 'library/tones/test.yaml')
 */
export async function deleteFile(
  rootHandle: FileSystemDirectoryHandle,
  path: string
): Promise<void> {
  const parts = path.split('/').filter((p) => p.length > 0);

  if (parts.length === 0) {
    throw new Error('Path cannot be empty');
  }

  const fileName = parts.pop();
  if (!fileName) {
    throw new Error('Path must include a file name');
  }

  // Navigate to the containing directory
  let currentDir = rootHandle;
  for (const dirName of parts) {
    currentDir = await currentDir.getDirectoryHandle(dirName);
  }

  // Delete the file
  await currentDir.removeEntry(fileName);
}

/**
 * Delete a directory at the given path (recursive).
 *
 * @param rootHandle - The root directory handle to start from
 * @param path - Path to the directory (e.g., 'library/tones')
 */
export async function deleteDirectory(
  rootHandle: FileSystemDirectoryHandle,
  path: string
): Promise<void> {
  const parts = path.split('/').filter((p) => p.length > 0);

  if (parts.length === 0) {
    throw new Error('Cannot delete root directory');
  }

  const dirName = parts.pop();
  if (!dirName) {
    throw new Error('Path must include a directory name');
  }

  // Navigate to the parent directory
  let parentDir = rootHandle;
  for (const part of parts) {
    parentDir = await parentDir.getDirectoryHandle(part);
  }

  // Delete the directory recursively
  await parentDir.removeEntry(dirName, { recursive: true });
}
