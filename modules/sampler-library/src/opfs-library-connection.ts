/**
 * OPFS-based library connection using the Origin Private File System.
 *
 * Provides persistent, sandboxed storage that does not require user
 * permission prompts. Automatically creates the library directory structure
 * (tones/, patches/, sets/) on first connection.
 *
 * @packageDocumentation
 */

import type { StorageDirectoryHandle } from '@/storage-handles.js';
import type { LibraryConnection } from '@/library-connection.js';

/**
 * Standard library subdirectories created automatically on connection.
 */
const LIBRARY_SUBDIRS = ['tones', 'patches', 'sets'] as const;

/**
 * OPFS-backed library connection for browser environments.
 *
 * Unlike {@link BrowserLibraryConnection}, this does not require a user
 * gesture to connect - the OPFS root is available immediately. The library
 * directory and its subdirectories are created automatically if they do
 * not exist.
 */
export class OPFSLibraryConnection implements LibraryConnection {
  private libraryHandle: StorageDirectoryHandle | null = null;

  /**
   * Connect to the OPFS-backed library.
   *
   * Gets the OPFS root via `navigator.storage.getDirectory()`, then creates
   * or retrieves the `library` directory with its standard subdirectories.
   *
   * @returns true if connection succeeded, false if OPFS is not available
   */
  async connect(): Promise<boolean> {
    if (!('storage' in navigator) || typeof navigator.storage.getDirectory !== 'function') {
      return false;
    }

    try {
      // Get OPFS root
      const opfsRoot = await navigator.storage.getDirectory();

      // Create or get the library directory
      const libraryDir = await opfsRoot.getDirectoryHandle('library', { create: true });

      // Create standard subdirectories if they don't exist
      await Promise.all(
        LIBRARY_SUBDIRS.map((subdir) => libraryDir.getDirectoryHandle(subdir, { create: true })),
      );

      // Cast to our interface - FSAA handles satisfy StorageDirectoryHandle structurally
      this.libraryHandle = libraryDir as unknown as StorageDirectoryHandle;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a library connection is established.
   */
  isConnected(): boolean {
    return this.libraryHandle !== null;
  }

  /**
   * Get the library root directory handle.
   *
   * @returns The library directory handle (not the OPFS root)
   * @throws Error if not connected
   */
  getRoot(): StorageDirectoryHandle {
    if (!this.libraryHandle) {
      throw new Error('Library not connected - call connect() first');
    }
    return this.libraryHandle;
  }
}
