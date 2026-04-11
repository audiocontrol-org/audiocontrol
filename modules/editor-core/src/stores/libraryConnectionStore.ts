/**
 * Zustand store for library connection state.
 *
 * Manages persistent connection state across page navigation:
 * - Active backend selection (local/Google Drive/OPFS)
 * - Storage directory handle
 * - Connection instances
 *
 * This store ensures library connections persist when users navigate
 * between pages (e.g., Library -> Tones -> Library).
 */

import { create } from 'zustand';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import type { LibraryConnection } from '@audiocontrol/sampler-library/browser';
import { BrowserLibraryConnection } from '@audiocontrol/sampler-library/browser';
import type { CacheMetrics } from '@audiocontrol/sampler-library/browser';

// =========================================================================
// Types
// =========================================================================

export type LibraryBackend = 'none' | 'local' | 'google-drive' | 'opfs';

export interface GoogleDriveCredentials {
  clientId: string;
  clientSecret: string;
}

interface LibraryConnectionState {
  /** Currently active backend. */
  activeBackend: LibraryBackend;
  /** The library root handle, or null if not connected. */
  root: StorageDirectoryHandle | null;
}

interface LibraryConnectionActions {
  /** Set connection state after successful connection. */
  setConnected: (backend: LibraryBackend, root: StorageDirectoryHandle) => void;
  /** Clear connection state on disconnect. */
  setDisconnected: () => void;
}

type LibraryConnectionStore = LibraryConnectionState & LibraryConnectionActions;

// =========================================================================
// Module-level connection instances
// =========================================================================

// Connection instances are stored at module level to persist across
// component unmounts. These are NOT part of Zustand state because they
// contain methods and non-serializable data.
let localConnection: BrowserLibraryConnection | null = null;
let googleDriveConnection: LibraryConnection | null = null;
let opfsConnection: LibraryConnection | null = null;
let activeConnection: LibraryConnection | null = null;

// =========================================================================
// Store
// =========================================================================

const BACKEND_STORAGE_KEY = 'audiocontrol-library-backend';

function saveBackendPreference(backend: LibraryBackend): void {
  try {
    if (backend === 'none') {
      localStorage.removeItem(BACKEND_STORAGE_KEY);
    } else {
      localStorage.setItem(BACKEND_STORAGE_KEY, backend);
    }
  } catch {
    // localStorage may be unavailable in some contexts
  }
}

export function getSavedBackendPreference(): LibraryBackend {
  try {
    const saved = localStorage.getItem(BACKEND_STORAGE_KEY);
    if (saved === 'local' || saved === 'google-drive' || saved === 'opfs') {
      return saved;
    }
  } catch {
    // localStorage may be unavailable
  }
  return 'none';
}

export const useLibraryConnectionStore = create<LibraryConnectionStore>((set) => ({
  // Initial state
  activeBackend: 'none',
  root: null,

  // Actions
  setConnected: (backend, root) => {
    saveBackendPreference(backend);
    set({ activeBackend: backend, root });
  },
  setDisconnected: () => {
    saveBackendPreference('none');
    set({ activeBackend: 'none', root: null });
  },
}));

// =========================================================================
// Connection management functions
// =========================================================================

export interface LibraryConnectionConfig {
  /** Identifier for FSAA directory picker memory. */
  pickerId?: string;
  /** Google Drive OAuth config. Omit to disable Google Drive. */
  googleDrive?: GoogleDriveCredentials;
}

/**
 * Get or create the local (FSAA) connection instance.
 */
export function getLocalConnection(config: LibraryConnectionConfig): BrowserLibraryConnection {
  if (!localConnection) {
    localConnection = new BrowserLibraryConnection({
      pickerId: config.pickerId ?? 'audiocontrol-library',
      startIn: 'documents',
    });
  }
  return localConnection;
}

/**
 * Get or create the Google Drive connection instance.
 * Returns null if Google Drive is not configured.
 */
export async function getGoogleDriveConnection(
  config: LibraryConnectionConfig,
): Promise<LibraryConnection | null> {
  if (!config.googleDrive) return null;
  if (googleDriveConnection) return googleDriveConnection;

  // Dynamic import to avoid loading Google Drive code when not needed
  const { GoogleDriveLibraryConnection } = await import(
    '@audiocontrol/sampler-library/google-drive'
  );
  const conn = new GoogleDriveLibraryConnection({
    clientId: config.googleDrive.clientId,
    clientSecret: config.googleDrive.clientSecret,
  });
  googleDriveConnection = conn;
  return conn;
}

/**
 * Get or create the OPFS connection instance.
 * Returns null if OPFS is not available.
 */
export async function getOPFSConnection(): Promise<LibraryConnection | null> {
  const hasOPFS = 'storage' in navigator;
  if (!hasOPFS) return null;
  if (opfsConnection) return opfsConnection;

  // Dynamic import to avoid loading OPFS code when not needed
  const { OPFSLibraryConnection } = await import('@audiocontrol/sampler-library/browser');
  const conn = new OPFSLibraryConnection();
  opfsConnection = conn;
  return conn;
}

/**
 * Get the currently active connection instance.
 */
export function getActiveConnection(): LibraryConnection | null {
  return activeConnection;
}

/**
 * Set the active connection instance.
 */
export function setActiveConnection(connection: LibraryConnection | null): void {
  activeConnection = connection;
}

/**
 * Connect to a storage backend.
 */
export async function connectToBackend(
  backend: 'local' | 'google-drive' | 'opfs',
  config: LibraryConnectionConfig,
): Promise<boolean> {
  const { setConnected } = useLibraryConnectionStore.getState();

  if (backend === 'local') {
    const conn = getLocalConnection(config);
    const ok = await conn.connect();
    if (ok) {
      activeConnection = conn;
      setConnected('local', conn.getRoot());
    }
    return ok;
  }

  if (backend === 'google-drive') {
    const conn = await getGoogleDriveConnection(config);
    if (!conn) return false;
    const ok = await conn.connect();
    if (ok) {
      activeConnection = conn;
      setConnected('google-drive', conn.getRoot());
    }
    return ok;
  }

  if (backend === 'opfs') {
    const conn = await getOPFSConnection();
    if (!conn) return false;
    const ok = await conn.connect();
    if (ok) {
      activeConnection = conn;
      setConnected('opfs', conn.getRoot());
    }
    return ok;
  }

  return false;
}

/**
 * Disconnect from the current backend.
 */
export function disconnectFromBackend(): void {
  const { setDisconnected } = useLibraryConnectionStore.getState();
  activeConnection = null;
  setDisconnected();
}

/**
 * Clear the active connection's cache.
 */
export function clearConnectionCache(): void {
  activeConnection?.clearCache?.();
}

/**
 * Get cache metrics from the active connection.
 */
export function getConnectionMetrics(): CacheMetrics | undefined {
  return activeConnection?.getMetrics?.();
}

/**
 * Reset cache metrics on the active connection.
 */
export function resetConnectionMetrics(): void {
  activeConnection?.resetMetrics?.();
}

/**
 * Handle Google Drive OAuth redirect on mount.
 * Call this once on app initialization.
 */
export async function handleGoogleDriveRedirect(
  config: LibraryConnectionConfig,
): Promise<boolean> {
  if (!config.googleDrive) return false;

  const conn = await getGoogleDriveConnection(config);
  if (!conn) return false;

  const { setConnected } = useLibraryConnectionStore.getState();

  // handleRedirect is specific to GoogleDriveLibraryConnection
  const gdConn = conn as {
    handleRedirect?: () => Promise<boolean>;
    tryRestore?: () => Promise<boolean>;
  };

  if (gdConn.handleRedirect) {
    const handled = await gdConn.handleRedirect();
    if (handled && gdConn.tryRestore) {
      const restored = await gdConn.tryRestore();
      if (restored) {
        activeConnection = conn;
        setConnected('google-drive', conn.getRoot());
        return true;
      }
    }

    // Try restoring an existing Google Drive session
    if (!handled && gdConn.tryRestore) {
      const restored = await gdConn.tryRestore();
      if (restored) {
        activeConnection = conn;
        setConnected('google-drive', conn.getRoot());
        return true;
      }
    }
  }

  return false;
}
