/**
 * Patch editor component
 */

import { useRef, useState, useCallback } from 'react';
import type { S330Patch, S330KeyMode } from '@/core/midi/S330Client';
import type { S330ClientInterface } from '@/core/midi/S330Client';
import { createS330Client } from '@/core/midi/S330Client';
import { useMidiStore } from '@/stores/midiStore';
import { useS330Store } from '@/stores/s330Store';
import { formatPercent, cn } from '@/lib/utils';
import { ParameterSlider } from '@/components/ui/ParameterSlider';
import { ToneZoneEditor } from './ToneZoneEditor';

interface PatchEditorProps {
  patch: S330Patch;
  index: number;
}

export function PatchEditor({ patch, index }: PatchEditorProps) {
  const { common } = patch;
  const { adapter, deviceId } = useMidiStore();
  const { toneNames } = useS330Store();
  const clientRef = useRef<S330ClientInterface | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(common.name);
  const [toneMappingExpanded, setToneMappingExpanded] = useState(false);
  const [toneLayer1, setToneLayer1] = useState(common.toneLayer1);
  const [toneLayer2, setToneLayer2] = useState(common.toneLayer2);

  // Initialize client if not already created
  if (adapter && !clientRef.current) {
    clientRef.current = createS330Client(adapter, { deviceId });
  }

  // Patch name handler
  const handleNameChange = async (newName: string) => {
    if (clientRef.current) {
      try {
        await clientRef.current.setPatchName(index, newName);
        setNameValue(newName);
      } catch (err) {
        console.error('[PatchEditor] Failed to update patch name:', err);
      }
    }
    setEditingName(false);
  };

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

  const handleDetuneChange = async (detune: number) => {
    if (clientRef.current) {
      try {
        await clientRef.current.setPatchDetune(index, detune);
      } catch (err) {
        console.error('[PatchEditor] Failed to update detune:', err);
      }
    }
  };

  const handleVelocityThresholdChange = async (threshold: number) => {
    if (clientRef.current) {
      try {
        await clientRef.current.setPatchVelocityThreshold(index, threshold);
      } catch (err) {
        console.error('[PatchEditor] Failed to update velocity threshold:', err);
      }
    }
  };

  const handleVelocityMixRatioChange = async (ratio: number) => {
    if (clientRef.current) {
      try {
        await clientRef.current.setPatchVelocityMixRatio(index, ratio);
      } catch (err) {
        console.error('[PatchEditor] Failed to update velocity mix ratio:', err);
      }
    }
  };

  const handleOctaveShiftChange = async (shift: number) => {
    if (clientRef.current) {
      try {
        await clientRef.current.setPatchOctaveShift(index, shift);
      } catch (err) {
        console.error('[PatchEditor] Failed to update octave shift:', err);
      }
    }
  };

  const handleKeyAssignChange = async (assign: 'rotary' | 'fix') => {
    if (clientRef.current) {
      try {
        await clientRef.current.setPatchKeyAssign(index, assign);
      } catch (err) {
        console.error('[PatchEditor] Failed to update key assign:', err);
      }
    }
  };

  const handleAftertouchAssignChange = async (assign: 'modulation' | 'volume' | 'bend+' | 'bend-' | 'filter') => {
    if (clientRef.current) {
      try {
        await clientRef.current.setPatchAftertouchAssign(index, assign);
      } catch (err) {
        console.error('[PatchEditor] Failed to update aftertouch assign:', err);
      }
    }
  };

  // Tone layer update handlers
  const handleToneLayer1Update = useCallback(async (data: number[]) => {
    setToneLayer1(data);
    if (clientRef.current) {
      try {
        // Create updated patch common with new tone layer
        const updatedPatch = {
          ...common,
          toneLayer1: data,
          toneLayer2,
        };
        await clientRef.current.sendPatchData(index, updatedPatch);
      } catch (err) {
        console.error('[PatchEditor] Failed to update tone layer 1:', err);
      }
    }
  }, [common, toneLayer2, index]);

  const handleToneLayer2Update = useCallback(async (data: number[]) => {
    setToneLayer2(data);
    if (clientRef.current) {
      try {
        // Create updated patch common with new tone layer
        const updatedPatch = {
          ...common,
          toneLayer1,
          toneLayer2: data,
        };
        await clientRef.current.sendPatchData(index, updatedPatch);
      } catch (err) {
        console.error('[PatchEditor] Failed to update tone layer 2:', err);
      }
    }
  }, [common, toneLayer1, index]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="mb-4">
          <span className="text-sm text-s330-muted">Patch P{String(index + 11).padStart(2, '0')}</span>
          {editingName ? (
            <input
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value.slice(0, 12))}
              onBlur={() => handleNameChange(nameValue)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleNameChange(nameValue);
                } else if (e.key === 'Escape') {
                  setNameValue(common.name);
                  setEditingName(false);
                }
              }}
              autoFocus
              maxLength={12}
              className={cn(
                'text-xl font-bold font-mono w-full',
                'bg-s330-panel border border-s330-highlight rounded px-2 py-1',
                'text-s330-text focus:outline-none focus:ring-1 focus:ring-s330-highlight'
              )}
            />
          ) : (
            <h3
              className="text-xl font-bold text-s330-text font-mono cursor-pointer hover:text-s330-highlight"
              onClick={() => setEditingName(true)}
              title="Click to edit patch name"
            >
              {nameValue}
            </h3>
          )}
        </div>

        {/* Common Parameters - matching hardware layout */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Key Mode */}
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

          {/* Key Assign */}
          <div>
            <label className="text-xs text-s330-muted mb-1 block">Key Assign</label>
            <select
              value={common.keyAssign}
              onChange={(e) => handleKeyAssignChange(e.target.value as 'rotary' | 'fix')}
              className={cn(
                'w-full px-2 py-1.5 text-sm font-mono',
                'bg-s330-panel border border-s330-accent rounded',
                'text-s330-text hover:bg-s330-accent/30',
                'focus:outline-none focus:ring-1 focus:ring-s330-highlight'
              )}
            >
              <option value="rotary">Rotary</option>
              <option value="fix">Fix</option>
            </select>
          </div>

          {/* P.Bend Range */}
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

          {/* A.T Assign */}
          <div>
            <label className="text-xs text-s330-muted mb-1 block">A.T Assign</label>
            <select
              value={common.aftertouchAssign}
              onChange={(e) => handleAftertouchAssignChange(e.target.value as 'modulation' | 'volume' | 'bend+' | 'bend-' | 'filter')}
              className={cn(
                'w-full px-2 py-1.5 text-sm font-mono',
                'bg-s330-panel border border-s330-accent rounded',
                'text-s330-text hover:bg-s330-accent/30',
                'focus:outline-none focus:ring-1 focus:ring-s330-highlight'
              )}
            >
              <option value="modulation">Modulation</option>
              <option value="volume">Volume</option>
              <option value="bend+">Bend+</option>
              <option value="bend-">Bend-</option>
              <option value="filter">Filter</option>
            </select>
          </div>

          {/* Oct.Shift */}
          <div>
            <label className="text-xs text-s330-muted mb-1 block">Oct.Shift</label>
            <select
              value={common.octaveShift}
              onChange={(e) => handleOctaveShiftChange(Number(e.target.value))}
              className={cn(
                'w-full px-2 py-1.5 text-sm font-mono',
                'bg-s330-panel border border-s330-accent rounded',
                'text-s330-text hover:bg-s330-accent/30',
                'focus:outline-none focus:ring-1 focus:ring-s330-highlight'
              )}
            >
              {[-2, -1, 0, 1, 2].map((shift) => (
                <option key={shift} value={shift}>
                  {shift > 0 ? '+' : ''}{shift}
                </option>
              ))}
            </select>
          </div>

          {/* Output Assign */}
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
        </div>

        {/* Sliders for Level and A.T Sense */}
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

        {/* Mode-specific parameters */}
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {/* Unison Detune - always visible, only active in Unison mode */}
          <div className={cn(common.keyMode !== 'unison' && 'opacity-50')}>
            <ParameterSlider
              label="Unison Detune"
              value={common.detune + 64}
              onChange={(val) => handleDetuneChange(val - 64)}
              formatValue={(val) => {
                const detune = val - 64;
                return `${detune > 0 ? '+' : ''}${detune}`;
              }}
              disabled={common.keyMode !== 'unison'}
            />
          </div>

          {/* V-Sw Thresh - always visible, only active in V-Sw mode */}
          <div className={cn(common.keyMode !== 'v-sw' && 'opacity-50')}>
            <ParameterSlider
              label="V-Sw Thresh."
              value={common.velocityThreshold}
              onChange={handleVelocityThresholdChange}
              disabled={common.keyMode !== 'v-sw'}
            />
          </div>

          {/* V-Mix Ratio - always visible, only active in V-Mix mode */}
          <div className={cn(common.keyMode !== 'v-mix' && 'opacity-50')}>
            <ParameterSlider
              label="V-Mix Ratio"
              value={common.velocityMixRatio}
              onChange={handleVelocityMixRatioChange}
              formatValue={formatPercent}
              disabled={common.keyMode !== 'v-mix'}
            />
          </div>
        </div>
      </div>

      {/* Tone Mapping Editor */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-medium text-s330-text">
            Tone Mapping
            <span className="ml-2 text-xs text-s330-muted">
              ({toneNames?.length ?? 0} tones, {toneNames?.filter(t => !t.isEmpty).length ?? 0} with names)
            </span>
          </h4>
          <button
            onClick={() => setToneMappingExpanded(!toneMappingExpanded)}
            className={cn(
              'px-3 py-1 text-sm rounded',
              'bg-s330-accent text-s330-text hover:bg-s330-highlight',
              'transition-colors'
            )}
          >
            {toneMappingExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>

        {toneMappingExpanded ? (
          <div className="space-y-6">
            {/* Layer 1 Zone Editor */}
            <ToneZoneEditor
              layer={1}
              toneData={toneLayer1}
              keyMode={common.keyMode as S330KeyMode}
              toneNames={toneNames}
              onUpdate={handleToneLayer1Update}
            />

            {/* Layer 2 Zone Editor (shown for dual-layer modes) */}
            <ToneZoneEditor
              layer={2}
              toneData={toneLayer2}
              keyMode={common.keyMode as S330KeyMode}
              toneNames={toneNames}
              onUpdate={handleToneLayer2Update}
            />
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-s330-muted text-sm">
              Layer 1 active keys: {toneLayer1.filter(t => t !== -1).length} / 109
            </p>
            {common.keyMode !== 'normal' && (
              <p className="text-s330-muted text-sm">
                Layer 2 active keys: {toneLayer2.filter(t => t !== 0).length} / 109
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
