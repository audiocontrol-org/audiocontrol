/**
 * Shared hook for loading patch and tone banks from the device.
 *
 * Eliminates the duplicated loadPatchBank/loadToneBank patterns
 * across PatchesPage, PlayPage, and TonesPage.
 */

import { useCallback, MutableRefObject } from 'react';
import type { SamplerClientInterface, SamplerPatch, SamplerTone } from '@/core/midi/SamplerClient';

interface BankLoaderStores {
  setLoading: (loading: boolean, message?: string) => void;
  setError: (error: string | null) => void;
  setProgress: (current: number, total: number) => void;
  clearProgress: () => void;
  setPatch: (index: number, patch: SamplerPatch, totalPatches: number) => void;
  setTone: (index: number, tone: SamplerTone, totalTones: number) => void;
  markPatchBankLoaded: (bankIndex: number) => void;
  markToneBankLoaded: (bankIndex: number) => void;
  ensurePatchArraySize: (size: number) => void;
  ensureToneArraySize: (size: number) => void;
}

interface BankLoaderConfig {
  totalPatches: number;
  totalTones: number;
  patchesPerBank: number;
  tonesPerBank: number;
}

interface UseBankLoaderOptions {
  clientRef: MutableRefObject<SamplerClientInterface | null>;
  stores: BankLoaderStores;
  config: BankLoaderConfig;
  /** Optional callback before loading tones (e.g., to clear cached wave data) */
  onBeforeToneLoad?: (startIndex: number, count: number, forceReload: boolean) => void;
}

interface UseBankLoaderReturn {
  loadPatchBank: (bankIndex: number, forceReload?: boolean) => Promise<void>;
  loadToneBank: (bankIndex: number, forceReload?: boolean) => Promise<void>;
}

export function useBankLoader({
  clientRef,
  stores,
  config,
  onBeforeToneLoad,
}: UseBankLoaderOptions): UseBankLoaderReturn {
  const { totalPatches, totalTones, patchesPerBank, tonesPerBank } = config;
  const {
    setLoading, setError, setProgress, clearProgress,
    setPatch, setTone,
    markPatchBankLoaded, markToneBankLoaded,
    ensurePatchArraySize, ensureToneArraySize,
  } = stores;

  const loadPatchBank = useCallback(async (bankIndex: number, forceReload = false) => {
    if (!clientRef.current) return;

    const startIndex = bankIndex * patchesPerBank;
    const count = patchesPerBank;

    try {
      setLoading(true, `${forceReload ? 'Reloading' : 'Loading'} patches ${startIndex + 1}-${startIndex + count}...`);
      setError(null);
      ensurePatchArraySize(totalPatches);

      await clientRef.current.connect();
      await clientRef.current.loadPatchRange(
        startIndex,
        count,
        (current, total) => setProgress(current, total),
        (index, patch) => setPatch(index, patch, totalPatches),
        forceReload
      );

      markPatchBankLoaded(bankIndex);
      clearProgress();
      setLoading(false);
    } catch (err) {
      console.error('[useBankLoader] Error loading patches:', err);
      const message = err instanceof Error ? err.message : 'Failed to load patches';
      setError(message);
      clearProgress();
      setLoading(false);
    }
  }, [clientRef, setLoading, setError, setProgress, clearProgress, ensurePatchArraySize, setPatch, markPatchBankLoaded, patchesPerBank, totalPatches]);

  const loadToneBank = useCallback(async (bankIndex: number, forceReload = false) => {
    if (!clientRef.current) return;

    const startIndex = bankIndex * tonesPerBank;
    const count = tonesPerBank;

    try {
      setLoading(true, `${forceReload ? 'Reloading' : 'Loading'} tones ${startIndex + 1}-${startIndex + count}...`);
      setError(null);

      onBeforeToneLoad?.(startIndex, count, forceReload);

      ensureToneArraySize(totalTones);

      await clientRef.current.connect();
      await clientRef.current.loadToneRange(
        startIndex,
        count,
        (current, total) => setProgress(current, total),
        (index, tone) => setTone(index, tone, totalTones),
        forceReload
      );

      markToneBankLoaded(bankIndex);
      clearProgress();
      setLoading(false);
    } catch (err) {
      console.error('[useBankLoader] Error loading tones:', err);
      const message = err instanceof Error ? err.message : 'Failed to load tones';
      setError(message);
      clearProgress();
      setLoading(false);
    }
  }, [clientRef, setLoading, setError, setProgress, clearProgress, ensureToneArraySize, setTone, markToneBankLoaded, tonesPerBank, totalTones, onBeforeToneLoad]);

  return { loadPatchBank, loadToneBank };
}
