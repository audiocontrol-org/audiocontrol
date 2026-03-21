/**
 * Reusable hook for managing library storage connections.
 *
 * Encapsulates backend selection (FSAA / Google Drive), OAuth redirect
 * handling, session restoration, and cache delegation. Consumers get
 * multi-backend support with a single hook call.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import type { LibraryConnection } from '@audiocontrol/sampler-library/browser';
import { BrowserLibraryConnection } from '@audiocontrol/sampler-library/browser';
import type { CacheMetrics } from '@audiocontrol/sampler-library/browser';

// =========================================================================
// Types
// =========================================================================

export type LibraryBackend = 'none' | 'local' | 'google-drive';

export interface GoogleDriveCredentials {
  clientId: string;
  clientSecret: string;
}

export interface UseLibraryConnectionConfig {
  /** Identifier for FSAA directory picker memory. */
  pickerId?: string;
  /** Google Drive OAuth config. Omit to disable Google Drive. */
  googleDrive?: GoogleDriveCredentials;
}

export interface UseLibraryConnectionResult {
  /** Currently active backend. */
  activeBackend: LibraryBackend;
  /** Whether a library root is available. */
  isConnected: boolean;
  /** The library root handle, or null if not connected. */
  root: StorageDirectoryHandle | null;
  /** Connect to the specified backend. */
  connect: (backend: 'local' | 'google-drive') => Promise<boolean>;
  /** Disconnect from the current backend. */
  disconnect: () => void;
  /** Clear any cached directory data. */
  clearCache: () => void;
  /** Get current cache metrics. */
  getMetrics: () => CacheMetrics | undefined;
  /** Reset cache metrics counters. */
  resetMetrics: () => void;
  /** Whether the File System Access API is available. */
  hasLocalFS: boolean;
  /** Whether Google Drive credentials are configured. */
  hasGoogleDrive: boolean;
}

// =========================================================================
// Hook
// =========================================================================

export function useLibraryConnection(
  config: UseLibraryConnectionConfig = {},
): UseLibraryConnectionResult {
  const [activeBackend, setActiveBackend] = useState<LibraryBackend>('none');
  const [root, setRoot] = useState<StorageDirectoryHandle | null>(null);

  // Connection instances — stable across renders
  const localRef = useRef<BrowserLibraryConnection | null>(null);
  const googleDriveRef = useRef<LibraryConnection | null>(null);
  const connectionRef = useRef<LibraryConnection | null>(null);
  const initRef = useRef(false);

  const hasLocalFS = 'showDirectoryPicker' in globalThis;
  const hasGoogleDrive = config.googleDrive != null;

  // Lazily create the FSAA connection
  const getLocalConnection = useCallback((): BrowserLibraryConnection => {
    if (!localRef.current) {
      localRef.current = new BrowserLibraryConnection({
        pickerId: config.pickerId ?? 'audiocontrol-library',
        startIn: 'documents',
      });
    }
    return localRef.current;
  }, [config.pickerId]);

  // Lazily create the Google Drive connection
  const getGoogleDriveConnection = useCallback(async (): Promise<LibraryConnection | null> => {
    if (!config.googleDrive) return null;
    if (googleDriveRef.current) return googleDriveRef.current;

    // Dynamic import to avoid loading Google Drive code when not needed
    const { GoogleDriveLibraryConnection } = await import(
      '@audiocontrol/sampler-library/google-drive'
    );
    const conn = new GoogleDriveLibraryConnection({
      clientId: config.googleDrive.clientId,
      clientSecret: config.googleDrive.clientSecret,
    });
    googleDriveRef.current = conn;
    return conn;
  }, [config.googleDrive?.clientId, config.googleDrive?.clientSecret]);

  // Connect to a backend
  const connect = useCallback(async (backend: 'local' | 'google-drive'): Promise<boolean> => {
    if (backend === 'local') {
      const conn = getLocalConnection();
      const ok = await conn.connect();
      if (ok) {
        connectionRef.current = conn;
        setActiveBackend('local');
        setRoot(conn.getRoot());
      }
      return ok;
    }

    if (backend === 'google-drive') {
      const conn = await getGoogleDriveConnection();
      if (!conn) return false;
      const ok = await conn.connect();
      if (ok) {
        connectionRef.current = conn;
        setActiveBackend('google-drive');
        setRoot(conn.getRoot());
      }
      return ok;
    }

    return false;
  }, [getLocalConnection, getGoogleDriveConnection]);

  // Disconnect
  const disconnect = useCallback(() => {
    connectionRef.current = null;
    setActiveBackend('none');
    setRoot(null);
  }, []);

  // Cache delegation
  const clearCache = useCallback(() => {
    connectionRef.current?.clearCache?.();
  }, []);

  const getMetrics = useCallback((): CacheMetrics | undefined => {
    return connectionRef.current?.getMetrics?.();
  }, []);

  const resetMetrics = useCallback(() => {
    connectionRef.current?.resetMetrics?.();
  }, []);

  // On mount: handle Google Drive OAuth redirect, then try session restore
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    (async () => {
      // 1. Check for Google Drive OAuth redirect
      if (config.googleDrive) {
        const conn = await getGoogleDriveConnection();
        if (conn) {
          // handleRedirect is specific to GoogleDriveLibraryConnection
          const gdConn = conn as { handleRedirect?: () => Promise<boolean>; tryRestore?: () => Promise<boolean> };

          if (gdConn.handleRedirect) {
            const handled = await gdConn.handleRedirect();
            if (handled && gdConn.tryRestore) {
              const restored = await gdConn.tryRestore();
              if (restored) {
                connectionRef.current = conn;
                setActiveBackend('google-drive');
                setRoot(conn.getRoot());
                return;
              }
            }

            // Try restoring an existing Google Drive session
            if (!handled && gdConn.tryRestore) {
              const restored = await gdConn.tryRestore();
              if (restored) {
                connectionRef.current = conn;
                setActiveBackend('google-drive');
                setRoot(conn.getRoot());
                return;
              }
            }
          }
        }
      }
    })();
  }, [config.googleDrive, getGoogleDriveConnection]);

  return {
    activeBackend,
    isConnected: root !== null,
    root,
    connect,
    disconnect,
    clearCache,
    getMetrics,
    resetMetrics,
    hasLocalFS,
    hasGoogleDrive,
  };
}
