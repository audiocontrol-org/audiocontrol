/**
 * Play page - Main overview similar to S-330's PLAY screen
 *
 * Shows 8 MIDI parts (A-H) with their patch assignments,
 * output routing, and levels.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMidiStore } from '@/stores/midiStore';
import { useS330Store } from '@/stores/s330Store';
import { createS330Client } from '@/core/midi/S330Client';
import { cn } from '@/lib/utils';

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
  const { adapter, deviceId, status } = useMidiStore();
  const { patchNames, setPatchNames, setLoading, setError, isLoading, error } =
    useS330Store();

  const isConnected = status === 'connected' && adapter !== null;

  // Mock MIDI parts - in reality this would come from system parameters
  // The S-330 stores part assignments in system memory
  const [parts, setParts] = useState<MidiPart[]>(
    PART_LABELS.map((id, i) => ({
      id,
      channel: i + 1,
      patchIndex: null,
      patchName: '',
      output: 1,
      level: 127,
      active: true,
    }))
  );

  const [selectedPart, setSelectedPart] = useState<number | null>(null);
  const [displayMode, setDisplayMode] = useState<'standard' | 'multi'>('standard');

  // Fetch patch names if not loaded
  const fetchPatchNames = useCallback(async () => {
    if (!adapter || patchNames.length > 0) return;

    try {
      setLoading(true, 'Loading patches...');
      const client = createS330Client(adapter, { deviceId });
      await client.connect();
      const names = await client.requestAllPatchNames();
      setPatchNames(names);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load patches');
      setLoading(false);
    }
  }, [adapter, deviceId, patchNames.length, setPatchNames, setLoading, setError]);

  useEffect(() => {
    if (isConnected) {
      fetchPatchNames();
    }
  }, [isConnected, fetchPatchNames]);

  // Update parts with actual patch data once loaded
  useEffect(() => {
    if (patchNames.length === 0) return;

    // Find non-empty patches and assign them to parts
    const nonEmptyPatches = patchNames.filter((p) => !p.isEmpty);

    setParts((prev) =>
      prev.map((part, i) => {
        const patch = nonEmptyPatches[i];
        if (patch) {
          return {
            ...part,
            patchIndex: patch.index,
            patchName: patch.name,
          };
        }
        return { ...part, patchIndex: null, patchName: '' };
      })
    );
  }, [patchNames]);

  // Handle patch selection for a part
  const handlePatchSelect = (partIndex: number, patchIndex: number) => {
    const patch = patchNames.find((p) => p.index === patchIndex);
    setParts((prev) =>
      prev.map((part, i) =>
        i === partIndex
          ? { ...part, patchIndex, patchName: patch?.name ?? '' }
          : part
      )
    );
    setSelectedPart(null);
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
          <div className="grid grid-cols-12 gap-2 mb-2 text-s330-muted text-xs">
            <div className="col-span-1"></div>
            <div className="col-span-1">VAL</div>
            <div className="col-span-1 text-center">CH</div>
            <div className="col-span-5">Patch</div>
            <div className="col-span-2 text-center">Out</div>
            <div className="col-span-2 text-right">Level</div>
          </div>

          {/* Part rows */}
          {parts.map((part, index) => (
            <div
              key={part.id}
              onClick={() => setSelectedPart(selectedPart === index ? null : index)}
              className={cn(
                'grid grid-cols-12 gap-2 py-1.5 px-1 rounded cursor-pointer transition-colors',
                selectedPart === index
                  ? 'bg-s330-highlight/20'
                  : 'hover:bg-s330-accent/30'
              )}
            >
              {/* Part label */}
              <div className="col-span-1 text-s330-highlight font-bold">
                {part.id}
              </div>

              {/* VAL (active indicator) */}
              <div className="col-span-1 text-s330-text">
                {part.active ? '*' : ''}
              </div>

              {/* Channel */}
              <div className="col-span-1 text-center text-s330-text">
                {part.channel}
              </div>

              {/* Patch */}
              <div className="col-span-5 text-s330-text">
                {part.patchIndex !== null ? (
                  <span>
                    <span className="text-s330-muted">P</span>
                    {String(part.patchIndex + 1).padStart(2, '0')}{' '}
                    <span className="text-s330-highlight">{part.patchName}</span>
                  </span>
                ) : (
                  <span className="text-s330-muted">---</span>
                )}
              </div>

              {/* Output */}
              <div className="col-span-2 text-center text-s330-text">
                {part.output}
              </div>

              {/* Level */}
              <div className="col-span-2 text-right text-s330-text">
                {part.level}
              </div>
            </div>
          ))}
        </div>

        {/* Patch selector (when a part is selected) */}
        {selectedPart !== null && (
          <div className="border-t border-s330-accent p-4">
            <div className="text-xs text-s330-muted mb-2">
              Select patch for Part {PART_LABELS[selectedPart]}:
            </div>
            <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
              {patchNames
                .filter((p) => !p.isEmpty)
                .map((patch) => (
                  <button
                    key={patch.index}
                    onClick={() => handlePatchSelect(selectedPart, patch.index)}
                    className={cn(
                      'px-2 py-1 rounded text-xs font-mono text-left transition-colors',
                      parts[selectedPart].patchIndex === patch.index
                        ? 'bg-s330-highlight text-white'
                        : 'bg-s330-accent/50 text-s330-text hover:bg-s330-accent'
                    )}
                  >
                    P{String(patch.index + 1).padStart(2, '0')} {patch.name}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Display section - shows current patches summary */}
      <div className="bg-s330-panel border border-s330-accent rounded-md p-4">
        <div className="text-xs text-s330-muted mb-3 font-mono">
          Display P1-P{Math.min(8, patchNames.filter((p) => !p.isEmpty).length)}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 font-mono text-sm">
          {parts.slice(0, 8).map((part) => (
            <div key={part.id} className="text-s330-text">
              {part.patchIndex !== null ? (
                <>
                  <span className="text-s330-muted">P</span>
                  {String(part.patchIndex + 1).padStart(2, '0')}{' '}
                  <span className="text-s330-highlight">{part.patchName}</span>
                </>
              ) : (
                <span className="text-s330-muted">
                  P{String(part.channel).padStart(2, '0')}
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
