/**
 * Play page - Main overview similar to S-330's PLAY screen
 *
 * Shows 8 MIDI parts (A-H) with their patch assignments,
 * output routing, and levels.
 */

import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useMidiStore } from '@/stores/midiStore';
import { useS330Store } from '@/stores/s330Store';
import { createS330Client } from '@/core/midi/S330Client';
import type { S330ClientInterface } from '@/core/midi/S330Client';
import { cn } from '@/lib/utils';

// Global flag to prevent React Strict Mode from running effects twice
// This is necessary because MIDI requests can't be safely run concurrently
let isFetchingGlobal = false;

// MIDI Part configuration (A-H = channels 1-8)
interface MidiPart {
  id: string;
  channel: number;
  patchIndex: number | null;
  patchName: string;
  level: number;
  active: boolean;
}

const PART_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export function PlayPage() {
  const { adapter, deviceId, status } = useMidiStore();
  const { patchNames, setPatchNames, setLoading, setError, isLoading, error } =
    useS330Store();

  const isConnected = status === 'connected' && adapter !== null;

  // Keep a ref to the S330 client for sending parameter updates
  const clientRef = useRef<S330ClientInterface | null>(null);

  // MIDI parts - loaded from S-330 function parameters
  const [parts, setParts] = useState<MidiPart[]>(
    PART_LABELS.map((id, i) => ({
      id,
      channel: i, // 0-15 (Ch 1-16)
      patchIndex: null,
      patchName: '',
      level: 127,
      active: true,
    }))
  );

  const [displayMode, setDisplayMode] = useState<'standard' | 'multi'>('standard');

  // Initialize client and fetch data when adapter is available
  useEffect(() => {
    if (!adapter) {
      clientRef.current = null;
      return;
    }

    // Create client
    const client = createS330Client(adapter, { deviceId });
    clientRef.current = client;

    // Skip if already fetching (React Strict Mode protection)
    if (isFetchingGlobal) {
      console.log('[PlayPage] Already fetching (React Strict Mode double-mount), skipping');
      return;
    }

    // Skip if data already loaded
    if (patchNames.length > 0) {
      console.log('[PlayPage] Data already loaded, skipping fetch');
      return;
    }

    isFetchingGlobal = true;

    // Fetch all data sequentially using the same client
    const fetchData = async () => {
      try {
        // Fetch patches first
        setLoading(true, 'Loading patches...');
        console.log('[PlayPage] Fetching patch names...');
        const names = await client.requestAllPatchNames();
        console.log('[PlayPage] Got', names.length, 'patches,', names.filter(n => !n.isEmpty).length, 'non-empty');
        console.log('[PlayPage] Non-empty:', names.filter(n => !n.isEmpty).map(n => `${n.index}:${n.name}`).join(', '));
        setPatchNames(names);

        // Then fetch function parameters
        setLoading(true, 'Loading multi mode configuration...');
        console.log('[PlayPage] Fetching function parameters...');
        const configs = await client.requestFunctionParameters();
        console.log('[PlayPage] Got function parameters:');
        configs.forEach((c, i) => {
          console.log(`  Part ${i}: channel=${c.channel}, patchIndex=${c.patchIndex}, level=${c.level}`);
        });

        // Update parts with loaded configuration
        setParts((prev) =>
          prev.map((part, i) => ({
            ...part,
            channel: configs[i]?.channel ?? i,
            patchIndex: configs[i]?.patchIndex ?? null,
            level: configs[i]?.level ?? 127,
          }))
        );

        setLoading(false);
      } catch (err) {
        console.error('[PlayPage] Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setLoading(false);
      } finally {
        isFetchingGlobal = false;
      }
    };

    fetchData();
  }, [adapter, deviceId, patchNames.length, setPatchNames, setLoading, setError]);

  // Debug: log patchNames changes
  useEffect(() => {
    console.log('[PlayPage] patchNames updated:', patchNames.length, 'total,', patchNames.filter(p => !p.isEmpty).length, 'non-empty');
  }, [patchNames]);

  // Update patch names based on patchIndex loaded from function parameters
  useEffect(() => {
    if (patchNames.length === 0) return;

    // Look up patch names based on patchIndex from function parameters
    setParts((prev) =>
      prev.map((part) => {
        if (part.patchIndex !== null) {
          const patch = patchNames.find((p) => p.index === part.patchIndex);
          if (patch && !patch.isEmpty) {
            return { ...part, patchName: patch.name };
          }
        }
        return { ...part, patchName: '' };
      })
    );
  }, [patchNames]);

  // Handle field updates
  const updatePart = (partIndex: number, updates: Partial<MidiPart>) => {
    setParts((prev) =>
      prev.map((part, i) => (i === partIndex ? { ...part, ...updates } : part))
    );
  };

  const handleChannelChange = (partIndex: number, channel: number) => {
    updatePart(partIndex, { channel });

    // Send parameter update to hardware
    if (clientRef.current) {
      try {
        clientRef.current.setMultiChannel(partIndex, channel);
      } catch (err) {
        console.error('[PlayPage] Failed to send channel parameter:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to update channel'
        );
      }
    }
  };

  const handlePatchChange = (partIndex: number, patchIndex: number) => {
    const patch = patchNames.find((p) => p.index === patchIndex);
    updatePart(partIndex, {
      patchIndex,
      patchName: patch?.name ?? '',
    });

    // Send parameter update to hardware
    if (clientRef.current) {
      try {
        clientRef.current.setMultiPatch(partIndex, patchIndex);
      } catch (err) {
        console.error('[PlayPage] Failed to send patch parameter:', err);
        setError(err instanceof Error ? err.message : 'Failed to update patch');
      }
    }
  };

  const handleLevelChange = (partIndex: number, level: number) => {
    updatePart(partIndex, { level });

    // Send parameter update to hardware
    if (clientRef.current) {
      try {
        clientRef.current.setMultiLevel(partIndex, level);
      } catch (err) {
        console.error('[PlayPage] Failed to send level parameter:', err);
        setError(err instanceof Error ? err.message : 'Failed to update level');
      }
    }
  };

  if (!isConnected) {
    return (
      <div className="card text-center py-12">
        <h2 className="text-xl font-bold text-s330-text mb-2">Not Connected</h2>
        <p className="text-s330-muted mb-4">
          Connect to your S-330 to view the play screen.
        </p>
        <Link to="/" className="btn btn-primary inline-block">
          Go to Connection
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mode Header - mimics S-330 top bar */}
      <div className="bg-s330-panel border border-s330-accent rounded-md overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-s330-accent/30 border-b border-s330-accent">
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-s330-panel border border-s330-accent rounded text-xs font-mono text-s330-text">
              MODE
            </button>
            <button className="px-3 py-1 bg-s330-panel border border-s330-accent rounded text-xs font-mono text-s330-text">
              MENU
            </button>
          </div>
          <div className="text-sm font-mono text-s330-text">
            PLAY-{displayMode === 'standard' ? 'Standard' : 'Multi'}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setDisplayMode('standard')}
              className={cn(
                'px-3 py-1 border border-s330-accent rounded text-xs font-mono',
                displayMode === 'standard'
                  ? 'bg-s330-highlight text-white'
                  : 'bg-s330-panel text-s330-text'
              )}
            >
              STD
            </button>
            <button
              onClick={() => setDisplayMode('multi')}
              className={cn(
                'px-3 py-1 border border-s330-accent rounded text-xs font-mono',
                displayMode === 'multi'
                  ? 'bg-s330-highlight text-white'
                  : 'bg-s330-panel text-s330-text'
              )}
            >
              MULTI
            </button>
          </div>
        </div>

        {/* Parts Grid */}
        <div className="p-4 font-mono text-sm">
          {/* Header row */}
          <div className="grid grid-cols-10 gap-2 mb-2 text-s330-muted text-xs">
            <div className="col-span-1"></div>
            <div className="col-span-1">VAL</div>
            <div className="col-span-1 text-center">CH</div>
            <div className="col-span-5">Patch</div>
            <div className="col-span-2 text-right">Level</div>
          </div>

          {/* Part rows */}
          {parts.map((part, index) => (
            <div
              key={part.id}
              className="grid grid-cols-10 gap-2 py-1.5 px-1 rounded transition-colors hover:bg-s330-accent/10"
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
              <div className="col-span-5">
                <select
                  value={part.patchIndex ?? -1}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (value !== -1) {
                      handlePatchChange(index, value);
                    }
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
                  {patchNames
                    .filter((p) => !p.isEmpty)
                    .map((patch) => (
                      <option key={patch.index} value={patch.index}>
                        P{String(patch.index + 11).padStart(2, '0')} {patch.name}
                      </option>
                    ))}
                </select>
              </div>

              {/* Level - editable number input */}
              <div className="col-span-2 text-right">
                <input
                  type="number"
                  min={0}
                  max={127}
                  value={part.level}
                  onChange={(e) => {
                    const value = Math.min(127, Math.max(0, Number(e.target.value)));
                    handleLevelChange(index, value);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    'w-full px-1 py-0.5 text-right text-xs font-mono',
                    'bg-s330-panel border border-s330-accent rounded',
                    'text-s330-text hover:bg-s330-accent/30',
                    'focus:outline-none focus:ring-1 focus:ring-s330-highlight',
                    '[appearance:textfield]',
                    '[&::-webkit-outer-spin-button]:appearance-none',
                    '[&::-webkit-inner-spin-button]:appearance-none'
                  )}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Display section - shows current patches summary */}
      <div className="bg-s330-panel border border-s330-accent rounded-md p-4">
        <div className="text-xs text-s330-muted mb-3 font-mono">
          Display P11-P{Math.min(8, patchNames.filter((p) => !p.isEmpty).length) + 10}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 font-mono text-sm">
          {parts.slice(0, 8).map((part) => (
            <div key={part.id} className="text-s330-text">
              {part.patchIndex !== null ? (
                <>
                  <span className="text-s330-muted">P</span>
                  {String(part.patchIndex + 11).padStart(2, '0')}{' '}
                  <span className="text-s330-highlight">{part.patchName}</span>
                </>
              ) : (
                <span className="text-s330-muted">
                  P{String(part.patchIndex !== null ? part.patchIndex + 11 : 11).padStart(2, '0')}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-500/20 border border-red-500 rounded-md p-3">
          <p className="text-red-200 text-sm">{error}</p>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="text-center py-4">
          <div className="animate-spin w-6 h-6 border-2 border-s330-highlight border-t-transparent rounded-full mx-auto" />
        </div>
      )}
    </div>
  );
}
