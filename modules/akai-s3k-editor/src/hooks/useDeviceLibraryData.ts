/**
 * Hook for loading device-resident program and sample names into the library store.
 *
 * Fetches program and sample name lists from the S3000XL when the MIDI
 * connection becomes available, and clears them on disconnect. Provides a
 * `refresh` callback for manual re-fetching (e.g., after a transfer).
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import type { S3000xlClientInterface } from '@audiocontrol/sampler-devices/s3k';
import { useLibraryStore } from '@/stores/libraryStore';

export interface UseDeviceLibraryDataResult {
  /** Re-fetch program and sample names from the device */
  refresh: () => Promise<void>;

  /** Whether the initial or manual fetch is in progress */
  isLoading: boolean;
}

export function useDeviceLibraryData(
  client: S3000xlClientInterface | null,
  isConnected: boolean,
): UseDeviceLibraryDataResult {
  const setDeviceProgramNames = useLibraryStore((s) => s.setDeviceProgramNames);
  const setDeviceSampleNames = useLibraryStore((s) => s.setDeviceSampleNames);

  const [isLoading, setIsLoading] = useState(false);
  const hasFetched = useRef(false);

  const fetchNames = useCallback(async (showLoading: boolean) => {
    if (!client) return;

    if (showLoading) setIsLoading(true);
    try {
      const [programs, samples] = await Promise.all([
        client.fetchProgramNames(),
        client.fetchSampleNames(),
      ]);
      setDeviceProgramNames(programs);
      setDeviceSampleNames(samples);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to fetch device names: ${message}`);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [client, setDeviceProgramNames, setDeviceSampleNames]);

  // Fetch on connect, allow re-fetch on reconnect
  useEffect(() => {
    if (isConnected && client && !hasFetched.current) {
      hasFetched.current = true;
      // Silent fetch — cached data stays visible, replaced when results arrive
      void fetchNames(false);
    }

    if (!isConnected) {
      // Reset fetch guard so we re-fetch on next connect.
      // Don't clear names — cached data stays visible with a
      // "reconnecting" indicator. The next fetch will replace them.
      hasFetched.current = false;
    }
  }, [isConnected, client, fetchNames]);

  const refresh = useCallback(async () => {
    if (!client) return;

    // Invalidate caches so the client re-fetches from the device
    client.invalidateProgramCache();
    client.invalidateSampleCache();
    await fetchNames(true);
  }, [client, fetchNames]);

  return { refresh, isLoading };
}
