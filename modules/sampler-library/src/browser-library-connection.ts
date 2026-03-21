/**
 * Browser-based library connection using the File System Access API.
 *
 * Encapsulates FSAA directory picker, handle caching, and permission
 * management. Extracted from duplicated code in sample-chopper and
 * sampler-editor dev harnesses.
 *
 * @packageDocumentation
 */

import type { StorageDirectoryHandle } from './storage-handles.js';
import type { LibraryConnection } from './library-connection.js';

export interface BrowserLibraryConnectionOptions {
  /** Identifier for the directory picker (browsers remember the last selection). */
  pickerId?: string;
  /** Suggested starting directory. */
  startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
}

/**
 * FSAA-backed library connection for browser environments.
 */
export class BrowserLibraryConnection implements LibraryConnection {
  private cachedHandle: StorageDirectoryHandle | null = null;
  private readonly pickerId: string;
  private readonly startIn: string;

  constructor(options?: BrowserLibraryConnectionOptions) {
    this.pickerId = options?.pickerId ?? 'audiocontrol-library';
    this.startIn = options?.startIn ?? 'documents';
  }

  async connect(): Promise<boolean> {
    if (!('showDirectoryPicker' in globalThis)) return false;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handle = await (globalThis as any).showDirectoryPicker({
        id: this.pickerId,
        mode: 'readwrite',
        startIn: this.startIn,
      });
      this.cachedHandle = handle;
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return false;
      throw err;
    }
  }

  isConnected(): boolean {
    return this.cachedHandle !== null;
  }

  getRoot(): StorageDirectoryHandle {
    if (!this.cachedHandle) {
      throw new Error('Library not connected — call connect() first');
    }
    return this.cachedHandle;
  }

  /**
   * Re-verify permissions on the cached handle. Returns false if
   * the user denies or the handle has been invalidated.
   */
  async verifyPermission(): Promise<boolean> {
    if (!this.cachedHandle) return false;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handle = this.cachedHandle as any;
      if (typeof handle.queryPermission !== 'function') return true;

      const perm = await handle.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') return true;

      const req = await handle.requestPermission({ mode: 'readwrite' });
      if (req === 'granted') return true;
    } catch {
      // Permission check failed
    }

    this.cachedHandle = null;
    return false;
  }
}
