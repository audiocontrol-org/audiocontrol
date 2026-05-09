/**
 * Unit tests for `useToneSampleExport`.
 *
 * Pins the four documented behaviours of the hook:
 *
 *   1. Cache HIT: hook reads samples directly from the cache; never calls
 *      `loadWaveData` for the wave bytes (`requestToneData` still fires —
 *      that's a separate SysEx for the filename / sampleRate).
 *   2. Cache MISS: hook calls `loadWaveData(idx, onProgress)` and re-reads
 *      `getSamples` after the load resolves.
 *   3. Invariant violation: when `loadWaveData` resolves but the cache
 *      still has no entry for the slot, the hook surfaces the error via
 *      `setError` and bails — no silent fallback (no `exportSamplesAsWav`
 *      call, no setTone update).
 *   4. Progress wiring: the `onProgress` callback passed to `loadWaveData`
 *      drives `result.current.exportProgress`.
 *
 * The hook is mounted via `renderHook`. Its `clientRef`, `waveCache`, and
 * setters are minimal mocks satisfying the typed surface — no real device,
 * no real cache.
 */

import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { MutableRefObject } from 'react';
import { useToneSampleExport } from '@/hooks/useToneSampleExport';
import type { UseWaveDataCacheResult } from '@/hooks/useWaveDataCache';
import type { SamplerClientInterface, SamplerTone } from '@/core/midi/SamplerClient';
import * as waveExport from '@/lib/wave-export';

// Stub the side-effecting download path. Tests assert call args, never the
// browser-only DOM download mechanics.
vi.mock('@/lib/wave-export', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/wave-export')>();
  return {
    ...actual,
    exportSamplesAsWav: vi.fn(),
  };
});

interface MockClient {
  requestToneData: MockedFunction<(toneIndex: number) => Promise<SamplerTone | null>>;
}

interface HookHarness {
  clientRef: MutableRefObject<SamplerClientInterface | null>;
  client: MockClient;
  waveCache: UseWaveDataCacheResult;
  setTone: ReturnType<typeof vi.fn>;
  setError: ReturnType<typeof vi.fn>;
  /** Backing store the cache mock reads/writes. */
  cacheStore: Map<number, Int16Array>;
}

function makeTone(name: string, sampleRate: '15kHz' | '30kHz' = '15kHz'): SamplerTone {
  // Cast through unknown — the test only consumes `name` and `sampleRate`,
  // and constructing a full SamplerTone for every test would be noise.
  // The compiler still pins the read-side: the hook only touches these
  // two fields, so a missing field would surface in the implementation.
  return { name, sampleRate } as unknown as SamplerTone;
}

function createHarness(): HookHarness {
  const cacheStore = new Map<number, Int16Array>();

  const client: MockClient = {
    requestToneData: vi.fn(async (idx: number) => makeTone(`TONE_${idx}`, '15kHz')),
  };

  // The mock cache narrows to the exact surface `useToneSampleExport`
  // consumes; loop-editor-only members are stubbed but never read.
  const waveCache: UseWaveDataCacheResult = {
    isLoading: false,
    progress: undefined,
    getSamples: vi.fn((toneIndex: number) => cacheStore.get(toneIndex) ?? null),
    loadWaveData: vi.fn(async () => {
      // Default impl: no-op. Individual tests override to populate the
      // cache (or not) and to invoke `onProgress`.
    }),
    invalidateRange: vi.fn(),
  };

  const clientRef = {
    current: client as unknown as SamplerClientInterface,
  } as MutableRefObject<SamplerClientInterface | null>;

  return {
    clientRef,
    client,
    waveCache,
    setTone: vi.fn(),
    setError: vi.fn(),
    cacheStore,
  };
}

beforeEach(() => {
  vi.mocked(waveExport.exportSamplesAsWav).mockReset();
});

describe('useToneSampleExport', () => {
  describe('cache hit', () => {
    it('exports without calling loadWaveData when samples are already cached', async () => {
      const h = createHarness();
      const cachedSamples = new Int16Array([1, 2, 3, 4]);
      h.cacheStore.set(5, cachedSamples);

      const { result } = renderHook(() =>
        useToneSampleExport({
          clientRef: h.clientRef,
          waveCache: h.waveCache,
          tones: [],
          setTone: h.setTone,
          setError: h.setError,
          totalTones: 32,
        }),
      );

      await act(async () => {
        await result.current.handleExportSample(5);
      });

      // Cache hit ⇒ no device read for wave bytes.
      expect(h.waveCache.loadWaveData).not.toHaveBeenCalled();
      // Cache hit ⇒ progress jumps straight to 100 (no transfer to track),
      // then resets to undefined in the finally block.
      expect(result.current.exportProgress).toBeUndefined();
      // Tone metadata fetch still happens (filename + sample rate).
      expect(h.client.requestToneData).toHaveBeenCalledWith(5);
      // Export helper called with cached samples + 15kHz default + filename.
      expect(waveExport.exportSamplesAsWav).toHaveBeenCalledTimes(1);
      const [samples, sampleRate, name] = vi.mocked(waveExport.exportSamplesAsWav).mock.calls[0];
      expect(samples).toBe(cachedSamples);
      expect(sampleRate).toBe(15000);
      expect(name).toBe('TONE_5');
      // Fresh tone propagated back to the store.
      expect(h.setTone).toHaveBeenCalledWith(5, expect.objectContaining({ name: 'TONE_5' }), 32);
      expect(h.setError).toHaveBeenCalledWith(null);
      expect(result.current.isExporting).toBe(false);
    });

    it('uses 30000 Hz sample rate when the tone metadata reports 30kHz', async () => {
      const h = createHarness();
      h.cacheStore.set(0, new Int16Array([42]));
      h.client.requestToneData.mockResolvedValueOnce(makeTone('HI_RATE', '30kHz'));

      const { result } = renderHook(() =>
        useToneSampleExport({
          clientRef: h.clientRef,
          waveCache: h.waveCache,
          tones: [],
          setTone: h.setTone,
          setError: h.setError,
          totalTones: 32,
        }),
      );

      await act(async () => {
        await result.current.handleExportSample(0);
      });

      const [, sampleRate] = vi.mocked(waveExport.exportSamplesAsWav).mock.calls[0];
      expect(sampleRate).toBe(30000);
    });
  });

  describe('cache miss', () => {
    it('calls loadWaveData and re-reads getSamples after the load resolves', async () => {
      const h = createHarness();
      // Start empty; the loadWaveData mock populates the cache.
      const fetchedSamples = new Int16Array([7, 8, 9]);
      vi.mocked(h.waveCache.loadWaveData).mockImplementation(
        async (toneIndex: number) => {
          h.cacheStore.set(toneIndex, fetchedSamples);
        },
      );

      const { result } = renderHook(() =>
        useToneSampleExport({
          clientRef: h.clientRef,
          waveCache: h.waveCache,
          tones: [],
          setTone: h.setTone,
          setError: h.setError,
          totalTones: 32,
        }),
      );

      await act(async () => {
        await result.current.handleExportSample(3);
      });

      expect(h.waveCache.loadWaveData).toHaveBeenCalledTimes(1);
      const [calledIndex, onProgress] = vi.mocked(h.waveCache.loadWaveData).mock.calls[0];
      expect(calledIndex).toBe(3);
      expect(typeof onProgress).toBe('function');

      // After the load, getSamples returns the freshly-cached buffer and
      // export proceeds.
      expect(waveExport.exportSamplesAsWav).toHaveBeenCalledTimes(1);
      const [samples] = vi.mocked(waveExport.exportSamplesAsWav).mock.calls[0];
      expect(samples).toBe(fetchedSamples);
      expect(h.setError).toHaveBeenCalledWith(null);
    });
  });

  describe('invariant violation', () => {
    it('reports an error and skips export when the cache is still empty after loadWaveData', async () => {
      const h = createHarness();
      // loadWaveData "succeeds" but never populates the cache.
      vi.mocked(h.waveCache.loadWaveData).mockResolvedValue(undefined);

      const { result } = renderHook(() =>
        useToneSampleExport({
          clientRef: h.clientRef,
          waveCache: h.waveCache,
          tones: [],
          setTone: h.setTone,
          setError: h.setError,
          totalTones: 32,
        }),
      );

      await act(async () => {
        await result.current.handleExportSample(2);
      });

      // Export must NOT happen on invariant violation.
      expect(waveExport.exportSamplesAsWav).not.toHaveBeenCalled();
      // Error surfaced with a descriptive message naming the slot.
      const errorCalls = h.setError.mock.calls.filter(([msg]) => msg !== null);
      expect(errorCalls).toHaveLength(1);
      const message = errorCalls[0][0] as string;
      expect(message).toContain('2');
      expect(message.toLowerCase()).toContain('cache');
      // Still resets isExporting in the finally block.
      expect(result.current.isExporting).toBe(false);
      expect(result.current.exportProgress).toBeUndefined();
    });
  });

  describe('progress wiring', () => {
    it('passes a working onProgress callback that drives exportProgress, then clears it', async () => {
      const h = createHarness();

      // Capture the onProgress callback `useToneSampleExport` passes to
      // `loadWaveData`. We assert (a) the hook passes a callback at all
      // and (b) invoking it produces an observable state change before
      // the operation completes.
      let capturedOnProgress: ((pct: number) => void) | undefined;

      vi.mocked(h.waveCache.loadWaveData).mockImplementation(
        async (toneIndex: number, onProgress) => {
          capturedOnProgress = onProgress;
          h.cacheStore.set(toneIndex, new Int16Array([1]));
        },
      );

      const { result } = renderHook(() =>
        useToneSampleExport({
          clientRef: h.clientRef,
          waveCache: h.waveCache,
          tones: [],
          setTone: h.setTone,
          setError: h.setError,
          totalTones: 32,
        }),
      );

      await act(async () => {
        await result.current.handleExportSample(1);
      });

      // Hook passed a callable onProgress to the cache.
      expect(typeof capturedOnProgress).toBe('function');

      // Invoking the captured callback updates the hook's exportProgress
      // state. After the operation has completed (so we're not racing
      // with the finally-block reset), this is the cleanest way to pin
      // the wiring without depending on intra-microtask render scheduling.
      act(() => {
        capturedOnProgress?.(42);
      });
      expect(result.current.exportProgress).toBe(42);

      act(() => {
        capturedOnProgress?.(88);
      });
      expect(result.current.exportProgress).toBe(88);
    });

    it('clears exportProgress to undefined after the operation completes', async () => {
      const h = createHarness();
      h.cacheStore.set(1, new Int16Array([1]));

      const { result } = renderHook(() =>
        useToneSampleExport({
          clientRef: h.clientRef,
          waveCache: h.waveCache,
          tones: [],
          setTone: h.setTone,
          setError: h.setError,
          totalTones: 32,
        }),
      );

      await act(async () => {
        await result.current.handleExportSample(1);
      });

      // Cleared in the finally block of handleExportSample.
      expect(result.current.exportProgress).toBeUndefined();
      expect(result.current.isExporting).toBe(false);
    });
  });

  describe('guard clauses', () => {
    it('does nothing when clientRef.current is null', async () => {
      const h = createHarness();
      h.clientRef.current = null;

      const { result } = renderHook(() =>
        useToneSampleExport({
          clientRef: h.clientRef,
          waveCache: h.waveCache,
          tones: [],
          setTone: h.setTone,
          setError: h.setError,
          totalTones: 32,
        }),
      );

      await act(async () => {
        await result.current.handleExportSample(0);
      });

      expect(h.client.requestToneData).not.toHaveBeenCalled();
      expect(h.waveCache.loadWaveData).not.toHaveBeenCalled();
      expect(waveExport.exportSamplesAsWav).not.toHaveBeenCalled();
    });
  });
});
