/**
 * React hook for S-330 device operations
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { S330MidiIO } from '@/core/midi/types';
import {
  createS330Client,
  S330_DATA_TYPES,
  type S330ClientInterface,
  type S330Patch,
  type S330Tone,
} from '@/core/midi/S330Client';

export interface UseS330State {
  isConnected: boolean;
  deviceId: number;
  patches: S330Patch[];
  tones: S330Tone[];
  isLoading: boolean;
  error: string | null;
}

export interface UseS330Actions {
  setDeviceId: (id: number) => void;
  fetchPatches: (bank?: 1 | 2) => Promise<void>;
  fetchTones: (bank?: 1 | 2) => Promise<void>;
  fetchAll: () => Promise<void>;
}

export type UseS330Return = UseS330State & UseS330Actions & { client: S330ClientInterface | null };

export interface UseS330Options {
  deviceId?: number;
  timeoutMs?: number;
}

/**
 * Hook for S-330 device operations
 */
export function useS330(
  adapter: S330MidiIO | null,
  options: UseS330Options = {}
): UseS330Return {
  const [deviceId, setDeviceIdState] = useState(options.deviceId ?? 0);
  const [patches, setPatches] = useState<S330Patch[]>([]);
  const [tones, setTones] = useState<S330Tone[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create client when adapter changes
  const client = useMemo(() => {
    if (!adapter) return null;
    return createS330Client(adapter, {
      deviceId,
      timeoutMs: options.timeoutMs,
    });
  }, [adapter, deviceId, options.timeoutMs]);

  // Connect client when it's created
  useEffect(() => {
    if (client) {
      client.connect();
    }
    return () => {
      if (client) {
        client.disconnect();
      }
    };
  }, [client]);

  const setDeviceId = useCallback((id: number) => {
    if (id >= 0 && id <= 31) {
      setDeviceIdState(id);
    }
  }, []);

  /**
   * Fetch patches from device
   */
  const fetchPatches = useCallback(async (bank: 1 | 2 = 1) => {
    if (!client) {
      setError('Not connected to device');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const dataType = bank === 1 ? S330_DATA_TYPES.PATCH_1_32 : S330_DATA_TYPES.PATCH_33_64;
      const packets = await client.requestBulkDump(dataType);
      const parsedPatches = client.parsePatches(packets);

      if (bank === 1) {
        setPatches((prev) => [...parsedPatches, ...prev.slice(32)]);
      } else {
        setPatches((prev) => [...prev.slice(0, 32), ...parsedPatches]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch patches';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  /**
   * Fetch tones from device
   */
  const fetchTones = useCallback(async (bank: 1 | 2 = 1) => {
    if (!client) {
      setError('Not connected to device');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const dataType = bank === 1 ? S330_DATA_TYPES.TONE_1_32 : S330_DATA_TYPES.TONE_33_64;
      const packets = await client.requestBulkDump(dataType);
      const parsedTones = client.parseTones(packets);

      if (bank === 1) {
        setTones((prev) => [...parsedTones, ...prev.slice(32)]);
      } else {
        setTones((prev) => [...prev.slice(0, 32), ...parsedTones]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch tones';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  /**
   * Fetch all data from device
   */
  const fetchAll = useCallback(async () => {
    if (!client) {
      setError('Not connected to device');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch patches bank 1
      const patchPackets1 = await client.requestBulkDump(S330_DATA_TYPES.PATCH_1_32);
      const patches1 = client.parsePatches(patchPackets1);

      // Fetch tones bank 1
      const tonePackets1 = await client.requestBulkDump(S330_DATA_TYPES.TONE_1_32);
      const tones1 = client.parseTones(tonePackets1);

      setPatches(patches1);
      setTones(tones1);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  return {
    isConnected: client?.isConnected() ?? false,
    deviceId,
    patches,
    tones,
    isLoading,
    error,
    client,
    setDeviceId,
    fetchPatches,
    fetchTones,
    fetchAll,
  };
}
