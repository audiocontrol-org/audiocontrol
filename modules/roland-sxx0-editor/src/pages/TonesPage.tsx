/**
 * Tones page — list-detail editor with the v3 mockup polish applied.
 *
 * Data is cached in deviceDataStore and persists across page navigation.
 * Loads first bank (8 tones) by default for faster startup. The number
 * of tone banks adapts to the device (S-330: 4 banks, S-550: 8 banks).
 *
 * Visual treatment is the operator-approved v3 mockup direction (Phase
 * 9 Task 4, page 2 of 6):
 *   - Lean page header: h2 + red rule + "<n> of <N> loaded" metric +
 *     single refresh icon-button. Replaces the per-bank reload toolbar
 *     (DESIGN-SYSTEM.md "List-Level Actions"); per-row click-to-load
 *     remains for unloaded banks.
 *   - 2-column app shell (list + detail). The mockup reserves a
 *     CRT/front-panel column on the right; that's a cross-page concern
 *     (every editor page mounts the virtual front panel per project
 *     memory `feedback_virtual_front_panel`) and lands in a separate
 *     commit so this file stays focused on the tones surface.
 *   - Detail pane uses a radio-driven 5-tab shell (Wave · Pitch ·
 *     Filter · Amp · LFO) per project memory `feedback_tabbed_detail_pane`.
 *   - Live-edit footer in the detail pane (no save/cancel/undo) — edits
 *     stream to the device in real time per project memory
 *     `feedback_live_editing_no_save`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMidiStore } from '@/stores/midiStore';
import { useEditorStore } from '@/stores/editorStore';
import { useDeviceDataStore } from '@/stores/deviceDataStore';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { useBankLoader } from '@/hooks/useBankLoader';
import { useWaveDataCache } from '@/hooks/useWaveDataCache';
import { useLoopEditorSync } from '@/hooks/useLoopEditorSync';
import type { SamplerClientInterface, SamplerTone } from '@/core/midi/SamplerClient';
import { toneSampleRateHz } from '@/core/midi/SamplerClient';
import { ToneList } from '@/components/tones/ToneList';
import { ToneEditor } from '@/components/tones/ToneEditor';
import { AcLiveStatusFooter, PageTitleRow } from '@audiocontrol/editor-core';
import { useLoopEditor } from '@audiocontrol/loop-editor/ui';

export function TonesPage() {
  const config = useDeviceConfig();
  const { totalPatches, totalTones, patchesPerBank, tonesPerBank, deviceName } = config;
  const { adapter, deviceId, status } = useMidiStore();
  const {
    selectedToneIndex,
    isLoading,
    loadingMessage,
    loadingProgress,
    error,
    selectTone,
    setLoading,
    setError,
    setProgress,
    clearProgress,
  } = useEditorStore();

  const isConnected = status === 'connected' && adapter !== null;

  // Shared device data store
  const {
    tones,
    loadedToneBanks: loadedBanks,
    setPatch,
    setTone,
    markPatchBankLoaded,
    markToneBankLoaded,
    ensurePatchArraySize,
    ensureToneArraySize,
    invalidateToneCache,
  } = useDeviceDataStore();

  // Keep a ref to the device client (S-330 / S-550 / etc.)
  const clientRef = useRef<SamplerClientInterface | null>(null);

  // Track if we've already initiated loading to prevent loops
  const hasInitiatedLoad = useRef(false);

  // Bank loading state
  const [loadingBank, setLoadingBank] = useState<number | null>(null);

  // Wave data cache — owns decoded Int16Array per tone (for the loop editor).
  const waveCache = useWaveDataCache({ clientRef, setError });

  // Loop editor hook — owns loop point state, detection, audio preview, and smoothing
  const selectedToneForLoop = selectedToneIndex !== null ? tones[selectedToneIndex] : null;
  const loopEditorSamples =
    selectedToneIndex !== null ? waveCache.getSamples(selectedToneIndex) : null;
  // When no tone is selected, `loopEditorSamples` is also null and every
  // consumer of `sampleRate` inside `useLoopEditor` short-circuits on
  // `!samples`. The seed below is therefore inert in that state — `0`
  // makes the never-consulted nature unmistakable rather than implying a
  // 15 kHz default.
  const loopEditor = useLoopEditor({
    samples: loopEditorSamples,
    sampleRate: selectedToneForLoop ? toneSampleRateHz(selectedToneForLoop) : 0,
    initialLoopStart: selectedToneForLoop?.wave.loopPoint,
    initialLoopEnd: selectedToneForLoop?.wave.endPoint,
    rootKey: selectedToneForLoop?.originalKey,
  });

  // Sync loop-editor state with the device tone store (both directions).
  useLoopEditorSync({ loopEditor, selectedToneIndex, tones, setTone, totalTones });

  // Initialize client when adapter changes
  useEffect(() => {
    clientRef.current = adapter ? config.createClient(adapter, { deviceId }) : null;
  }, [adapter, deviceId]);

  // Load a specific range of tones (updates UI progressively)
  const { loadToneBank } = useBankLoader({
    clientRef,
    stores: {
      setLoading, setError, setProgress, clearProgress,
      setPatch, setTone, markPatchBankLoaded, markToneBankLoaded,
      ensurePatchArraySize, ensureToneArraySize,
    },
    config: { totalPatches, totalTones, patchesPerBank, tonesPerBank },
    onBeforeToneLoad: (startIndex, count, forceReload) => {
      if (forceReload) {
        waveCache.invalidateRange(startIndex, count);
      }
    },
  });

  // Load a bank with loading indicator
  const loadBankWithIndicator = useCallback(async (bankIndex: number, forceReload = false) => {
    setLoadingBank(bankIndex);
    try {
      await loadToneBank(bankIndex, forceReload);
    } finally {
      setLoadingBank(null);
    }
  }, [loadToneBank]);

  // Load initial data (first bank)
  const loadInitialData = useCallback(async () => {
    await loadBankWithIndicator(0);
  }, [loadBankWithIndicator]);

  // Refresh-from-device — replaces the per-bank reload toolbar.
  // Invalidates caches and reloads every bank. The icon-button on the
  // title row binds to this; per-row click-to-load (in ToneList) still
  // handles single-bank loads for unloaded banks.
  const refreshAll = useCallback(async () => {
    if (!clientRef.current) return;
    clientRef.current.invalidateToneCache();
    invalidateToneCache();
    const bankCount = Math.ceil(totalTones / tonesPerBank);
    for (let bank = 0; bank < bankCount; bank++) {
      await loadToneBank(bank, true);
    }
  }, [loadToneBank, invalidateToneCache, totalTones, tonesPerBank]);

  // Auto-select the first loaded tone so the editor mounts immediately
  // without a "SELECT A TONE TO EDIT" placeholder. See PatchesPage for
  // the same pattern.
  useEffect(() => {
    if (selectedToneIndex !== null) return;
    const firstLoaded = tones.findIndex((t) => t !== undefined);
    if (firstLoaded === -1) return;
    selectTone(firstLoaded);
  }, [tones, selectedToneIndex, selectTone]);

  // Handle tone updates from the editor
  const handleToneUpdate = useCallback((tone: SamplerTone) => {
    if (selectedToneIndex === null) return;
    setTone(selectedToneIndex, tone, totalTones);
  }, [selectedToneIndex, setTone, totalTones]);

  // Live-status footer timestamp — updated whenever a parameter edit
  // streams to the device. Per harmonization-spec section 2.5 plus the
  // `feedback_live_editing_no_save` operator memory.
  const [lastEditAt, setLastEditAt] = useState<number | null>(null);

  // Commit changes to device — sendToneData is the explicit
  // device-write callback (handleToneUpdate above is store-only).
  const handleToneCommit = useCallback(
    (tone?: SamplerTone) => {
      if (selectedToneIndex === null || !clientRef.current) return;

      // Read from Zustand store directly (not the React closure `tones`)
      // to get the latest value after synchronous store updates.
      const toneData = tone ?? useDeviceDataStore.getState().tones[selectedToneIndex];
      if (!toneData) return;

      clientRef.current.sendToneData(selectedToneIndex, toneData).then(() => {
        setLastEditAt(Date.now());
      }).catch((err) => {
        console.error('[TonesPage] Failed to send tone data:', err);
        setError(err instanceof Error ? err.message : 'Failed to send tone data');
      });
    },
    [selectedToneIndex, setError],
  );

  // Auto-load initial data when connected
  useEffect(() => {
    if (!isConnected || hasInitiatedLoad.current) return;

    // Check if data already loaded from cache
    if (tones.length > 0) {
      hasInitiatedLoad.current = true;
      return;
    }

    if (!isLoading) {
      hasInitiatedLoad.current = true;
      loadInitialData();
    }
  }, [isConnected, tones.length, isLoading, loadInitialData]);

  // Loaded counters for the title-row metric.
  const loadedTones = tones.filter((t): t is SamplerTone => t !== undefined);
  const loadedToneCount = loadedTones.length;

  const selectedTone =
    selectedToneIndex !== null ? tones[selectedToneIndex] : null;

  // Acknowledge `loadedBanks` to keep the hook return shape used; the
  // per-bank state is still threaded into ToneList for the per-bank
  // click-to-load handler.
  void loadedBanks;

  if (!isConnected) {
    return (
      <div className="ac-page">
        <div className="card text-center py-12">
          <h2 className="text-xl font-bold text-s330-text mb-2">Not Connected</h2>
          <p className="text-s330-muted mb-4">
            Connect to your {deviceName} to view and edit tones.
          </p>
          <a href="/" className="ac-btn ac-btn-primary inline-block">
            Go to Connection
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="ac-page ac-page-shell ac-page-shell--fixed-viewport">
      {/* Lean page header — h2 + red rule + status + refresh icon.
          Composed from .ac-page-title-* shared primitives. The
          `--fixed-viewport` modifier opts this page into the height-
          bounded shell so the list + detail columns scroll internally
          and the document does not scroll as one tall page (see
          DESIGN-SYSTEM.md § "Page Shell Pattern"). */}
      <PageTitleRow
        headingId="tones-heading"
        headingText="Tones"
        metric={
          <>
            <strong>{loadedToneCount}</strong> of <strong>{totalTones}</strong> loaded
          </>
        }
        loadingMessage={loadingMessage}
        isLoading={isLoading}
        onRefresh={refreshAll}
        refreshLabel="Refresh all tones from device"
        loadingProgress={loadingProgress}
      />

      {/* Error display */}
      {error && (
        <div data-testid="error-message" className="ac-alert ac-alert-error">
          <p className="ac-text-error text-sm">{error}</p>
        </div>
      )}

      {/* List + detail */}
      {tones.length > 0 && (
        <div className="ac-app-shell" aria-labelledby="tones-heading">
          <ToneList
            tones={tones}
            selectedIndex={selectedToneIndex}
            onSelect={selectTone}
            loadedBanks={loadedBanks}
            tonesPerBank={tonesPerBank}
            loadingBank={loadingBank}
            onLoadBank={(bank) => loadBankWithIndicator(bank)}
            onReloadBank={(bank) => loadBankWithIndicator(bank, true)}
          />
          {selectedTone ? (
            <ToneEditor
              tone={selectedTone}
              index={selectedToneIndex!}
              onUpdate={handleToneUpdate}
              onCommit={handleToneCommit}
              waveData={loopEditorSamples}
              isLoadingWaveData={waveCache.isLoading}
              waveDataLoadProgress={waveCache.progress}
              onLoadWaveData={() => {
                if (selectedToneIndex !== null) void waveCache.loadWaveData(selectedToneIndex);
              }}
              loopEditorProps={loopEditor.editorProps}
            />
          ) : (
            <div className="ac-detail-empty">Select a tone to edit</div>
          )}
        </div>
      )}

      {/* Empty State - no tones loaded yet */}
      {!isLoading && loadedTones.length === 0 && !error && (
        <div className="card text-center py-12">
          <p className="text-s330-muted mb-4">No tones loaded</p>
          <button onClick={loadInitialData} className="ac-btn ac-btn-primary">
            Load Tones
          </button>
        </div>
      )}

      {/* Live-editing footer — parameter edits stream to the device via
          sendToneData (wired through handleToneCommit). The footer
          surfaces the last-edit timestamp instead of a save/cancel/undo
          affordance. Per harmonization-spec section 2.5 + project
          memories `feedback_live_editing_no_save` and `feedback_rec_led_accent`. */}
      <AcLiveStatusFooter
        deviceLabel={deviceName}
        lastEditAt={lastEditAt}
        state={isConnected ? 'live' : 'offline'}
      />
    </div>
  );
}
