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
  const clearSelectedDevice = useLibraryStore((s) => s.clearSelectedDevice);

  const [isLoading, setIsLoading] = useState(false);
  const hasFetched = useRef(false);

  const fetchNames = useCallback(async () => {
    if (!client) return;

    setIsLoading(true);
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
      setIsLoading(false);
    }
  }, [client, setDeviceProgramNames, setDeviceSampleNames]);

  // Fetch on connect, clear on disconnect
  useEffect(() => {
    if (isConnected && client && !hasFetched.current) {
      hasFetched.current = true;
      void fetchNames();
    }

    if (!isConnected) {
      hasFetched.current = false;
      setDeviceProgramNames([]);
      setDeviceSampleNames([]);
      clearSelectedDevice();
    }
  }, [isConnected, client, fetchNames, setDeviceProgramNames, setDeviceSampleNames, clearSelectedDevice]);

  const refresh = useCallback(async () => {
    if (!client) return;

    // Invalidate caches so the client re-fetches from the device
    client.invalidateProgramCache();
    client.invalidateSampleCache();
    await fetchNames();
  }, [client, fetchNames]);

  return { refresh, isLoading };
}
