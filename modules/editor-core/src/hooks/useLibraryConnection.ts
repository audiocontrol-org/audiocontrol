/**
 * Reusable hook for managing library storage connections.
 *
 * Encapsulates backend selection (FSAA / Google Drive / OPFS), OAuth redirect
 * handling, session restoration, and cache delegation. Consumers get
 * multi-backend support with a single hook call.
 *
 * Connection state is stored in a global Zustand store so it persists
 * across page navigation.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import type { CacheMetrics } from '@audiocontrol/sampler-library/browser';
import {
  useLibraryConnectionStore,
  connectToBackend,
  disconnectFromBackend,
  clearConnectionCache,
  getConnectionMetrics,
  resetConnectionMetrics,
  handleGoogleDriveRedirect,
  getSavedBackendPreference,
  type LibraryConnectionConfig,
  type LibraryBackend,
  type GoogleDriveCredentials,
} from '@/stores/libraryConnectionStore';

// =========================================================================
// Types
// =========================================================================

// Re-export types from store for backward compatibility
export type { LibraryBackend, GoogleDriveCredentials } from '@/stores/libraryConnectionStore';

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
  connect: (backend: 'local' | 'google-drive' | 'opfs') => Promise<boolean>;
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
  /** Whether the Origin Private File System is available. */
  hasOPFS: boolean;
}

// =========================================================================
// Hook
// =========================================================================

export function useLibraryConnection(
  config: UseLibraryConnectionConfig = {},
): UseLibraryConnectionResult {
  // Get state from global store
  const activeBackend = useLibraryConnectionStore((s) => s.activeBackend);
  const root = useLibraryConnectionStore((s) => s.root);

  const initRef = useRef(false);

  const hasLocalFS = 'showDirectoryPicker' in globalThis;
  const hasGoogleDrive = config.googleDrive != null;
  const hasOPFS = 'storage' in navigator;

  // Build config object for store functions
  const storeConfig: LibraryConnectionConfig = {
    pickerId: config.pickerId,
    googleDrive: config.googleDrive,
  };

  // Connect to a backend
  const connect = useCallback(
    async (backend: 'local' | 'google-drive' | 'opfs'): Promise<boolean> => {
      return connectToBackend(backend, storeConfig);
    },
    [storeConfig.pickerId, storeConfig.googleDrive?.clientId, storeConfig.googleDrive?.clientSecret],
  );

  // Disconnect
  const disconnect = useCallback(() => {
    disconnectFromBackend();
  }, []);

  // Cache delegation
  const clearCache = useCallback(() => {
    clearConnectionCache();
  }, []);

  const getMetrics = useCallback((): CacheMetrics | undefined => {
    return getConnectionMetrics();
  }, []);

  const resetMetrics = useCallback(() => {
    resetConnectionMetrics();
  }, []);

  // On mount: try to restore the previously active backend
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    if (config.googleDrive) {
      void handleGoogleDriveRedirect(storeConfig);
    }

    // If already connected (e.g., navigating between pages), nothing to do
    if (activeBackend !== 'none') return;

    const savedBackend = getSavedBackendPreference();
    if (savedBackend === 'none') return;

    // Auto-reconnect to the previously active backend.
    // OPFS and FSAA can both restore without user interaction.
    void connectToBackend(savedBackend, storeConfig).then((restored) => {
      if (!restored) {
        console.warn(`[useLibraryConnection] Failed to restore ${savedBackend} backend`);
      }
    });
  }, [config.googleDrive, storeConfig, activeBackend]);

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
    hasOPFS,
  };
}
