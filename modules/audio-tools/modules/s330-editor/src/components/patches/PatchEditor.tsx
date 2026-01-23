/**
 * Patch editor component
 */

import { useRef } from 'react';
import type { S330Patch } from '@/core/midi/S330Client';
import type { S330ClientInterface } from '@/core/midi/S330Client';
import { createS330Client } from '@/core/midi/S330Client';
import { useMidiStore } from '@/stores/midiStore';
import { midiNoteToName, formatPercent, formatPan, cn } from '@/lib/utils';
import { ParameterSlider } from '@/components/ui/ParameterSlider';

interface PatchEditorProps {
  patch: S330Patch;
  index: number;
}

export function PatchEditor({ patch, index }: PatchEditorProps) {
  const { common } = patch;
  const { adapter, deviceId } = useMidiStore();
  const clientRef = useRef<S330ClientInterface | null>(null);

  // Initialize client if not already created
  if (adapter && !clientRef.current) {
    clientRef.current = createS330Client(adapter, { deviceId });
  }

  // Parameter update handlers
  const handleKeyModeChange = async (keyMode: 'normal' | 'v-sw' | 'x-fade' | 'v-mix' | 'unison') => {
    if (clientRef.current) {
      try {
        await clientRef.current.setPatchKeyMode(index, keyMode);
      } catch (err) {
        console.error('[PatchEditor] Failed to update key mode:', err);
      }
    }
  };

  const handleBenderRangeChange = async (range: number) => {
    if (clientRef.current) {
      try {
        await clientRef.current.setPatchBenderRange(index, range);
      } catch (err) {
        console.error('[PatchEditor] Failed to update bender range:', err);
      }
    }
  };

  const handleOutputChange = async (output: number) => {
    if (clientRef.current) {
      try {
        await clientRef.current.setPatchOutput(index, output);
      } catch (err) {
        console.error('[PatchEditor] Failed to update output:', err);
      }
    }
  };

  const handleLevelChange = async (level: number) => {
    if (clientRef.current) {
      try {
        await clientRef.current.setPatchLevel(index, level);
      } catch (err) {
        console.error('[PatchEditor] Failed to update level:', err);
      }
    }
  };

  const handleAftertouchSensChange = async (sens: number) => {
    if (clientRef.current) {
      try {
        await clientRef.current.setPatchAftertouchSens(index, sens);
      } catch (err) {
        console.error('[PatchEditor] Failed to update aftertouch sensitivity:', err);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="mb-4">
          <span className="text-sm text-s330-muted">Patch P{String(index + 11).padStart(2, '0')}</span>
          <h3 className="text-xl font-bold text-s330-text font-mono">
            {common.name}
          </h3>
        </div>

        {/* Common Parameters */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="text-xs text-s330-muted mb-1 block">Key Mode</label>
            <select
              value={common.keyMode}
              onChange={(e) => handleKeyModeChange(e.target.value as 'normal' | 'v-sw' | 'x-fade' | 'v-mix' | 'unison')}
              className={cn(
                'w-full px-2 py-1.5 text-sm font-mono',
                'bg-s330-panel border border-s330-accent rounded',
                'text-s330-text hover:bg-s330-accent/30',
                'focus:outline-none focus:ring-1 focus:ring-s330-highlight'
              )}
            >
              <option value="normal">Normal</option>
              <option value="v-sw">V-Sw</option>
              <option value="x-fade">X-Fade</option>
              <option value="v-mix">V-Mix</option>
              <option value="unison">Unison</option>
            </select>
          </div>
          {common.keyMode === 'v-sw' && (
            <div>
              <label className="text-xs text-s330-muted mb-1 block">V-Sw Threshold</label>
              <div className="text-sm text-s330-text font-mono">
                {common.velocityThreshold}
              </div>
            </div>
          )}
          {common.keyMode === 'v-mix' && (
            <div>
              <label className="text-xs text-s330-muted mb-1 block">V-Mix Ratio</label>
              <div className="text-sm text-s330-text font-mono">
                {formatPercent(common.velocityMixRatio)}
              </div>
            </div>
          )}
          {common.keyMode === 'unison' && (
            <div>
              <label className="text-xs text-s330-muted mb-1 block">Detune</label>
              <div className="text-sm text-s330-text font-mono">
                {common.detune > 0 ? '+' : ''}{common.detune}
              </div>
            </div>
          )}
          <div>
            <label className="text-xs text-s330-muted mb-1 block">P.Bend Range</label>
            <select
              value={common.benderRange}
              onChange={(e) => handleBenderRangeChange(Number(e.target.value))}
              className={cn(
                'w-full px-2 py-1.5 text-sm font-mono',
                'bg-s330-panel border border-s330-accent rounded',
                'text-s330-text hover:bg-s330-accent/30',
                'focus:outline-none focus:ring-1 focus:ring-s330-highlight'
              )}
            >
              {Array.from({ length: 13 }, (_, i) => (
                <option key={i} value={i}>
                  {i} semitones
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-s330-muted mb-1 block">Output Assign</label>
            <select
              value={common.outputAssign}
              onChange={(e) => handleOutputChange(Number(e.target.value))}
              className={cn(
                'w-full px-2 py-1.5 text-sm font-mono',
                'bg-s330-panel border border-s330-accent rounded',
                'text-s330-text hover:bg-s330-accent/30',
                'focus:outline-none focus:ring-1 focus:ring-s330-highlight'
              )}
            >
              {Array.from({ length: 8 }, (_, i) => (
                <option key={i} value={i}>
                  Out {i + 1}
                </option>
              ))}
              <option value={8}>TONE</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-s330-muted mb-1 block">Oct.Shift</label>
            <div className="text-sm text-s330-text font-mono">
              {common.octaveShift > 0 ? '+' : ''}{common.octaveShift}
            </div>
          </div>
          <div>
            <label className="text-xs text-s330-muted mb-1 block">Key Assign</label>
            <div className="text-sm text-s330-text capitalize">
              {common.keyAssign}
            </div>
          </div>
          <div>
            <label className="text-xs text-s330-muted mb-1 block">A.T Assign</label>
            <div className="text-sm text-s330-text capitalize">
              {common.aftertouchAssign}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ParameterSlider
            label="Level"
            value={common.level}
            onChange={handleLevelChange}
            formatValue={formatPercent}
          />
          <ParameterSlider
            label="A.T Sense"
            value={common.aftertouchSens}
            onChange={handleAftertouchSensChange}
            formatValue={formatPercent}
          />
        </div>
      </div>

      {/* Tone Mapping Info */}
      <div className="card">
        <h4 className="font-medium text-s330-text mb-4">
          Tone Mapping
        </h4>
        <p className="text-s330-muted text-sm mb-2">
          Layer 1 active keys: {common.toneLayer1.filter(t => t !== -1).length} / 109
        </p>
        <p className="text-s330-muted text-sm">
          Layer 2 active keys: {common.toneLayer2.filter(t => t !== 0).length} / 109
        </p>
      </div>
    </div>
  );
}
