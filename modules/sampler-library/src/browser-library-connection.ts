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

// =========================================================================
// IndexedDB persistence for FileSystemDirectoryHandle
// =========================================================================

const IDB_NAME = 'audiocontrol-library-handles';
const IDB_STORE = 'handles';

function openHandleDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveHandleToIDB(key: string, handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(handle, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function loadHandleFromIDB(key: string): Promise<FileSystemDirectoryHandle | null> {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function removeHandleFromIDB(key: string): Promise<void> {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// =========================================================================
// BrowserLibraryConnection
// =========================================================================

/**
 * FSAA-backed library connection for browser environments.
 *
 * Persists the directory handle to IndexedDB so the connection can be
 * restored after page reload without re-showing the directory picker.
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
      await saveHandleToIDB(this.pickerId, handle).catch(() => {});
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return false;
      throw err;
    }
  }

  /**
   * Try to restore a previously selected directory from IndexedDB.
   * Returns true if the handle was restored and permission was granted.
   * The browser may show a permission prompt on the first restore.
   */
  async tryRestore(): Promise<boolean> {
    try {
      const handle = await loadHandleFromIDB(this.pickerId);
      if (!handle) return false;

      // Check/request permission on the restored handle
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const h = handle as any;
      const perm = await h.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        this.cachedHandle = handle;
        return true;
      }

      const req = await h.requestPermission({ mode: 'readwrite' });
      if (req === 'granted') {
        this.cachedHandle = handle;
        return true;
      }

      // Permission denied — remove stale handle
      await removeHandleFromIDB(this.pickerId).catch(() => {});
      return false;
    } catch {
      return false;
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
