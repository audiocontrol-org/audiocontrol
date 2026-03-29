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
 * OPFS-backed library connection for browser environments.
 *
 * Unlike {@link BrowserLibraryConnection}, this does not require a user
 * gesture to connect - the OPFS root is available immediately.
 *
 * Note: The library functions (listTonesTree, etc.) expect the root to be
 * the PARENT of the `library/` folder. So getRoot() returns the OPFS root,
 * not the library folder itself. The `library/` folder is created inside
 * the OPFS root to ensure it exists.
 */
export class OPFSLibraryConnection implements LibraryConnection {
  private opfsRoot: StorageDirectoryHandle | null = null;

  /**
   * Connect to the OPFS-backed library.
   *
   * Gets the OPFS root via `navigator.storage.getDirectory()` and ensures
   * the `library` directory exists inside it.
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

      // Ensure the library directory exists (but return the OPFS root, not library)
      await opfsRoot.getDirectoryHandle('library', { create: true });

      // Cast to our interface - FSAA handles satisfy StorageDirectoryHandle structurally
      this.opfsRoot = opfsRoot as unknown as StorageDirectoryHandle;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a library connection is established.
   */
  isConnected(): boolean {
    return this.opfsRoot !== null;
  }

  /**
   * Get the storage root directory handle.
   *
   * @returns The OPFS root (parent of library/)
   * @throws Error if not connected
   */
  getRoot(): StorageDirectoryHandle {
    if (!this.opfsRoot) {
      throw new Error('Library not connected - call connect() first');
    }
    return this.opfsRoot;
  }
}
