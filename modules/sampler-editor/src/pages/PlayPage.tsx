/**
 * Play page - Main overview similar to S-330's PLAY screen
 *
 * Shows 8 MIDI parts (A-H) with their patch assignments,
 * output routing, and levels.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useMidiStore } from '@/stores/midiStore';
import { useS330Store } from '@/stores/editorStore';
import { useDeviceDataStore } from '@/stores/deviceDataStore';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { useBankLoader } from '@/hooks/useBankLoader';
import type { SamplerClientInterface, SamplerPatch } from '@/core/midi/SamplerClient';
import { cn } from '@/lib/utils';
import { isMockMidiMode } from '@/mock/mockMode';
import { MOCK_PLAY_PARTS } from '@/mock/mockState';

// MIDI Part configuration (A-H = channels 1-8)
interface MidiPart {
  id: string;
  channel: number;
  patchIndex: number | null;
  patchName: string;
  output: number;
  level: number;
  active: boolean;
}

const PART_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export function PlayPage() {
  const config = useDeviceConfig();
  const { totalPatches, totalTones, patchesPerBank, tonesPerBank } = config;

  const mockMode = isMockMidiMode();
  const { adapter, deviceId, status } = useMidiStore();
  const { setLoading, setError, isLoading, error, setProgress, clearProgress, loadingProgress, loadingMessage } =
    useS330Store();

  const isConnected = status === 'connected' && adapter !== null;

  // Shared device data store
  const {
    patches,
    loadedPatchBanks: loadedBanks,
    setPatch,
    setTone,
    markPatchBankLoaded,
    markToneBankLoaded,
    ensurePatchArraySize,
    ensureToneArraySize,
  } = useDeviceDataStore();

  // Keep a ref to the S330 client for sending parameter updates
  const clientRef = useRef<SamplerClientInterface | null>(null);

  // Track if we've already initiated loading to prevent loops
  const hasInitiatedLoad = useRef(false);

  // MIDI parts - loaded from S-330 function parameters
  const [parts, setParts] = useState<MidiPart[]>(
    PART_LABELS.map((id, i) => ({
      id,
      channel: i, // 0-15 (Ch 1-16)
      patchIndex: null,
      patchName: '',
      output: 1, // 1-8 for individual outputs
      level: 127,
      active: true,
    }))
  );

  // Initialize client when adapter changes
  useEffect(() => {
    if (mockMode) return;
    if (!adapter) {
      clientRef.current = null;
      return;
    }
    clientRef.current = config.createClient(adapter, { deviceId });
  }, [adapter, deviceId, mockMode]);

  // Deterministic mock-mode part assignments for screenshots and visual tests.
  useEffect(() => {
    if (!mockMode) return;
    hasInitiatedLoad.current = true;
    setParts((prev) =>
      prev.map((part, index) => {
        const mock = MOCK_PLAY_PARTS[index];
        if (!mock) return part;
        return {
          ...part,
          channel: mock.channel,
          patchIndex: mock.patchIndex,
          output: mock.output,
          level: mock.level,
          active: mock.active,
        };
      })
    );
  }, [mockMode]);

  const { loadPatchBank } = useBankLoader({
    clientRef,
    stores: {
      setLoading, setError, setProgress, clearProgress,
      setPatch, setTone, markPatchBankLoaded, markToneBankLoaded,
      ensurePatchArraySize, ensureToneArraySize,
    },
    config: { totalPatches, totalTones, patchesPerBank, tonesPerBank },
  });

  // Load function parameters (multi mode configuration)
  const loadFunctionParams = useCallback(async () => {
    if (!clientRef.current) return;

    try {
      setLoading(true, 'Loading multi mode configuration...');
      const configs = await clientRef.current.requestFunctionParameters();

      // Update parts with loaded configuration
      setParts((prev) =>
        prev.map((part, i) => ({
          ...part,
          channel: configs[i]?.channel ?? i,
          patchIndex: configs[i]?.patchIndex ?? null,
          output: configs[i]?.output ?? 1,
          level: configs[i]?.level ?? 127,
        }))
      );

      setLoading(false);
    } catch (err) {
      console.error('[PlayPage] Error loading function parameters:', err);
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
      setLoading(false);
    }
  }, [setLoading, setError]);

  // Load initial data when connected
  useEffect(() => {
    if (mockMode) return;
    if (!isConnected || hasInitiatedLoad.current) return;

    // Skip if data already in store
    if (patches.length > 0) {
      hasInitiatedLoad.current = true;
      loadFunctionParams();
      return;
    }

    if (!isLoading) {
      // Load first bank of patches, then function parameters
      hasInitiatedLoad.current = true;
      loadPatchBank(0).then(() => loadFunctionParams());
    }
  }, [isConnected, isLoading, patches.length, loadPatchBank, loadFunctionParams, mockMode]);

  // Update patch names when patches or parts change
  useEffect(() => {
    if (patches.length === 0) return;

    setParts((prev) =>
      prev.map((part) => {
        if (part.patchIndex !== null && part.patchIndex < patches.length) {
          const patch = patches[part.patchIndex];
          if (patch && patch.common.name.trim()) {
            return { ...part, patchName: patch.common.name };
          }
        }
        return { ...part, patchName: '' };
      })
    );
  }, [patches]);

  // Handle field updates
  const updatePart = (partIndex: number, updates: Partial<MidiPart>) => {
    setParts((prev) =>
      prev.map((part, i) => (i === partIndex ? { ...part, ...updates } : part))
    );
  };

  const handleChannelChange = (partIndex: number, channel: number) => {
    updatePart(partIndex, { channel });

    if (clientRef.current) {
      clientRef.current.setMultiChannel(partIndex, channel).catch((err) => {
        console.error('[PlayPage] Failed to send channel parameter:', err);
        setError(err instanceof Error ? err.message : 'Failed to update channel');
      });
    }
  };

  const handlePatchChange = (partIndex: number, patchIndex: number | null) => {
    const patch = patchIndex !== null && patchIndex < patches.length ? patches[patchIndex] : null;
    updatePart(partIndex, {
      patchIndex,
      patchName: patch?.common.name ?? '',
    });

    if (clientRef.current) {
      clientRef.current.setMultiPatch(partIndex, patchIndex).catch((err) => {
        console.error('[PlayPage] Failed to send patch parameter:', err);
        setError(err instanceof Error ? err.message : 'Failed to update patch');
      });
    }
  };

  const handleOutputChange = (partIndex: number, output: number) => {
    updatePart(partIndex, { output });

    if (clientRef.current) {
      clientRef.current.setMultiOutput(partIndex, output).catch((err) => {
        console.error('[PlayPage] Failed to send output parameter:', err);
        setError(err instanceof Error ? err.message : 'Failed to update output');
      });
    }
  };

  // Update level in local state only (for responsive UI)
  const handleLevelChange = (partIndex: number, level: number) => {
    updatePart(partIndex, { level });
  };

  // Send level to device when user finishes adjusting
  const handleLevelCommit = (partIndex: number, level: number) => {
    if (clientRef.current) {
      clientRef.current.setMultiLevel(partIndex, level).catch((err) => {
        console.error('[PlayPage] Failed to send level parameter:', err);
        setError(err instanceof Error ? err.message : 'Failed to update level');
      });
    }
  };

  // Check if a patch is empty
  const isPatchEmpty = (patch: SamplerPatch | undefined): boolean => {
    if (!patch) return true;
    const name = patch.common.name;
    return name === '' || name === '            ' || name.trim() === '';
  };

  if (!isConnected) {
    return (
      <div className="ac-page">
        <div className="card text-center py-12">
          <h2 className="text-xl font-bold text-s330-text mb-2">Not Connected</h2>
          <p className="text-s330-muted mb-4">
            Connect to your S-330 to view the play screen.
          </p>
          <Link to="/" className="ac-btn ac-btn-primary inline-block">
            Go to Connection
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="ac-page ac-page-shell">
      <div className="ac-page-sticky-header">
        <div className="ac-page-header">
          <h2 className="text-xl font-bold text-s330-text">Play</h2>
          <div className="flex items-center gap-4 flex-1 justify-end">
            {/* Loading Progress */}
            {isLoading && loadingProgress !== null && (
              <div className="flex-1 max-w-xs">
                <div className="h-2 bg-s330-bg rounded-full overflow-hidden">
                  <div
                    className="h-full bg-s330-highlight transition-all duration-150 ease-out"
                    style={{ width: `${loadingProgress}%` }}
                  />
                </div>
                <p className="text-s330-muted text-xs mt-0.5 truncate">{loadingMessage}</p>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-sm text-s330-muted">(Re)load:</span>
              <button
                onClick={() => loadPatchBank(0, true)}
                disabled={isLoading}
                className={cn(
                  'ac-btn ac-btn-sm',
                  loadedBanks.includes(0) ? 'ac-btn-secondary' : 'ac-btn-primary',
                  isLoading && 'opacity-50'
                )}
              >
                P11-P18
              </button>
              <button
                onClick={() => loadPatchBank(1, true)}
                disabled={isLoading}
                className={cn(
                  'ac-btn ac-btn-sm',
                  loadedBanks.includes(1) ? 'ac-btn-secondary' : 'ac-btn-primary',
                  isLoading && 'opacity-50'
                )}
              >
                P21-P28
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Parts Grid */}
      <div className="bg-s330-panel border border-s330-accent rounded-md overflow-hidden">
        {/* Parts Grid */}
        <div className="p-4 font-mono text-sm">
          {/* Header row */}
          <div className="grid grid-cols-12 gap-2 mb-2 text-s330-muted text-xs">
            <div className="col-span-1"></div>
            <div className="col-span-1">VAL</div>
            <div className="col-span-1 text-center">CH</div>
            <div className="col-span-4">Patch</div>
            <div className="col-span-1 text-center">Out</div>
            <div className="col-span-4">Level</div>
          </div>

          {/* Part rows */}
          {parts.map((part, index) => (
            <div
              key={part.id}
              className="grid grid-cols-12 gap-2 py-1.5 px-1 rounded transition-colors hover:bg-s330-accent/10"
            >
              {/* Part label */}
              <div className="col-span-1 text-s330-highlight font-bold">
                {part.id}
              </div>

              {/* VAL (active indicator) */}
              <div className="col-span-1 text-s330-text">
                {part.active ? '*' : ''}
              </div>

              {/* Channel - editable dropdown (0-15 stored, display as 1-16) */}
              <div className="col-span-1 text-center">
                <select
                  value={part.channel}
                  onChange={(e) => handleChannelChange(index, Number(e.target.value))}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    'w-full px-1 py-0.5 text-center text-xs font-mono',
                    'bg-s330-panel border border-s330-accent rounded',
                    'text-s330-text hover:bg-s330-accent/30',
                    'focus:outline-none focus:ring-1 focus:ring-s330-highlight'
                  )}
                >
                  {Array.from({ length: 16 }, (_, i) => (
                    <option key={i} value={i}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </div>

              {/* Patch - editable dropdown */}
              <div className="col-span-4">
                <select
                  value={part.patchIndex ?? -1}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    handlePatchChange(index, value === -1 ? null : value);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    'w-full px-1 py-0.5 text-xs font-mono',
                    'bg-s330-panel border border-s330-accent rounded',
                    'text-s330-text hover:bg-s330-accent/30',
                    'focus:outline-none focus:ring-1 focus:ring-s330-highlight'
                  )}
                >
                  <option value={-1} className="text-s330-muted">
                    ---
                  </option>
                  {patches.map((patch, patchIndex) => (
                    <option key={patchIndex} value={patchIndex}>
                      P{String(patchIndex + 11).padStart(2, '0')}{' '}
                      {patch ? (isPatchEmpty(patch) ? '(empty)' : patch.common.name) : '(not loaded)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Output - editable dropdown (1-8 for individual outputs) */}
              <div className="col-span-1 text-center">
                <select
                  value={part.output}
                  onChange={(e) => handleOutputChange(index, Number(e.target.value))}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    'w-full px-1 py-0.5 text-center text-xs font-mono',
                    'bg-s330-panel border border-s330-accent rounded',
                    'text-s330-text hover:bg-s330-accent/30',
                    'focus:outline-none focus:ring-1 focus:ring-s330-highlight'
                  )}
                >
                  {Array.from({ length: 8 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </div>

              {/* Level - slider with value display */}
              <div className="col-span-4 flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={127}
                  value={part.level}
                  onChange={(e) => handleLevelChange(index, Number(e.target.value))}
                  onMouseUp={(e) => handleLevelCommit(index, Number((e.target as HTMLInputElement).value))}
                  onTouchEnd={(e) => handleLevelCommit(index, Number((e.target as HTMLInputElement).value))}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    'flex-1 h-1.5 rounded-full appearance-none cursor-pointer',
                    'bg-s330-accent/50',
                    '[&::-webkit-slider-thumb]:appearance-none',
                    '[&::-webkit-slider-thumb]:w-3',
                    '[&::-webkit-slider-thumb]:h-3',
                    '[&::-webkit-slider-thumb]:rounded-full',
                    '[&::-webkit-slider-thumb]:bg-s330-highlight',
                    '[&::-webkit-slider-thumb]:hover:bg-s330-text',
                    '[&::-moz-range-thumb]:w-3',
                    '[&::-moz-range-thumb]:h-3',
                    '[&::-moz-range-thumb]:rounded-full',
                    '[&::-moz-range-thumb]:bg-s330-highlight',
                    '[&::-moz-range-thumb]:border-0',
                    '[&::-moz-range-thumb]:hover:bg-s330-text'
                  )}
                />
                <span className="w-8 text-right text-xs text-s330-text font-mono">
                  {part.level}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="ac-alert ac-alert-error">
          <p className="ac-text-error text-sm">{error}</p>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && !loadingProgress && (
        <div className="text-center py-4">
          <div className="animate-spin w-6 h-6 border-2 border-s330-highlight border-t-transparent rounded-full mx-auto" />
        </div>
      )}
    </div>
  );
}
