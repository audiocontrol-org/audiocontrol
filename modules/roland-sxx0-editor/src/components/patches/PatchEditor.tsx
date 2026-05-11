/**
 * Patch editor component
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import type { SamplerPatch, SamplerKeyMode, SamplerTone, SamplerClientInterface } from '@/core/midi/SamplerClient';
import { useMidiStore } from '@/stores/midiStore';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { formatPercent } from '@audiocontrol/editor-core';
import { cn } from '@/lib/utils';
import { ParameterSlider } from '@/components/ui/ParameterSlider';
import { Tooltip } from '@/components/ui/Tooltip';
import { ToneZoneEditor } from './ToneZoneEditor';
import { PATCH_TOOLTIPS } from '@/constants/patch-tooltips';
import { PatchLabel } from '@/components/common/PatchLabel';

interface PatchEditorProps {
  patch: SamplerPatch;
  index: number;
  /** Loaded tones (sparse array - undefined = not loaded) */
  tones: (SamplerTone | undefined)[];
  /** Callback when patch data is updated locally */
  onUpdate: (index: number, patch: SamplerPatch) => void;
}

export function PatchEditor({ patch, index, tones, onUpdate }: PatchEditorProps) {
  const { common } = patch;
  const { adapter, deviceId } = useMidiStore();
  const config = useDeviceConfig();

  // Helper to update both local state and send to device
  const updatePatch = useCallback((updatedCommon: typeof common) => {
    onUpdate(index, { common: updatedCommon });
  }, [index, onUpdate]);

  const clientRef = useRef<SamplerClientInterface | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(common.name);
  const [toneLayer1, setToneLayer1] = useState(common.toneLayer1);
  const [toneLayer2, setToneLayer2] = useState(common.toneLayer2);

  // Sync local state when patch changes
  useEffect(() => {
    setNameValue(common.name);
    setToneLayer1(common.toneLayer1);
    setToneLayer2(common.toneLayer2);
  }, [common.name, common.toneLayer1, common.toneLayer2]);

  // Initialize client if not already created
  if (adapter && !clientRef.current) {
    clientRef.current = config.createClient(adapter, { deviceId });
  }

  // Patch name handler
  const handleNameChange = async (newName: string) => {
    updatePatch({ ...common, name: newName });
    setNameValue(newName);
    if (clientRef.current) {
      try {
        await clientRef.current.setPatchName(index, newName);
      } catch (err) {
        console.error('[PatchEditor] Failed to update patch name:', err);
      }
    }
    setEditingName(false);
  };

  // Parameter update handlers - update store first, then send to device
  const handleKeyModeChange = async (keyMode: 'normal' | 'v-sw' | 'x-fade' | 'v-mix' | 'unison') => {
    updatePatch({ ...common, keyMode });
    if (clientRef.current) {
      try {
        await clientRef.current.setPatchKeyMode(index, keyMode);
      } catch (err) {
        console.error('[PatchEditor] Failed to update key mode:', err);
      }
    }
  };

  const handleBenderRangeChange = async (range: number) => {
    updatePatch({ ...common, benderRange: range });
    if (clientRef.current) {
      try {
        await clientRef.current.setPatchBenderRange(index, range);
      } catch (err) {
        console.error('[PatchEditor] Failed to update bender range:', err);
      }
    }
  };

  const handleOutputChange = async (output: number) => {
    updatePatch({ ...common, outputAssign: output });
    if (clientRef.current) {
      try {
        await clientRef.current.setPatchOutput(index, output);
      } catch (err) {
        console.error('[PatchEditor] Failed to update output:', err);
      }
    }
  };

  const handleLevelChange = (level: number) => {
    updatePatch({ ...common, level });
  };

  const handleLevelCommit = async () => {
    if (clientRef.current) {
      try {
        await clientRef.current.setPatchLevel(index, common.level);
      } catch (err) {
        console.error('[PatchEditor] Failed to update level:', err);
      }
    }
  };

  const handleAftertouchSensChange = (sens: number) => {
    updatePatch({ ...common, aftertouchSens: sens });
  };

  const handleAftertouchSensCommit = async () => {
    if (clientRef.current) {
      try {
        await clientRef.current.setPatchAftertouchSens(index, common.aftertouchSens);
      } catch (err) {
        console.error('[PatchEditor] Failed to update aftertouch sensitivity:', err);
      }
    }
  };

  const handleDetuneChange = (detune: number) => {
    updatePatch({ ...common, detune });
  };

  const handleDetuneCommit = async () => {
    if (clientRef.current) {
      try {
        await clientRef.current.setPatchDetune(index, common.detune);
      } catch (err) {
        console.error('[PatchEditor] Failed to update detune:', err);
      }
    }
  };

  const handleVelocityThresholdChange = (threshold: number) => {
    updatePatch({ ...common, velocityThreshold: threshold });
  };

  const handleVelocityThresholdCommit = async () => {
    if (clientRef.current) {
      try {
        await clientRef.current.setPatchVelocityThreshold(index, common.velocityThreshold);
      } catch (err) {
        console.error('[PatchEditor] Failed to update velocity threshold:', err);
      }
    }
  };

  const handleVelocityMixRatioChange = (ratio: number) => {
    updatePatch({ ...common, velocityMixRatio: ratio });
  };

  const handleVelocityMixRatioCommit = async () => {
    if (clientRef.current) {
      try {
        await clientRef.current.setPatchVelocityMixRatio(index, common.velocityMixRatio);
      } catch (err) {
        console.error('[PatchEditor] Failed to update velocity mix ratio:', err);
      }
    }
  };

  const handleKeyAssignChange = async (assign: 'rotary' | 'fix') => {
    updatePatch({ ...common, keyAssign: assign });
    if (clientRef.current) {
      try {
        await clientRef.current.setPatchKeyAssign(index, assign);
      } catch (err) {
        console.error('[PatchEditor] Failed to update key assign:', err);
      }
    }
  };

  const handleAftertouchAssignChange = async (assign: 'modulation' | 'volume' | 'bend+' | 'bend-' | 'filter') => {
    updatePatch({ ...common, aftertouchAssign: assign });
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

  // Count loaded tones with names
  const loadedTonesCount = tones.filter(t => t !== undefined).length;
  const namedTonesCount = tones.filter(t => t !== undefined && t.name.trim()).length;

  return (
    <div data-testid="patch-editor" data-capability="C-PATCH-04">
      {/* Detail head — eyebrow row + slot+name title (v3 mockup direction). */}
      <header className="patches__detail-head">
        <div className="patches__detail-eyebrow-row">
          <span>Patch</span>
          <span className="patches__detail-eyebrow-sep">·</span>
          <span className="patches__detail-eyebrow-accent">Editing</span>
          <span className="patches__detail-eyebrow-sep">·</span>
          <span>Source · device</span>
        </div>
        <h3 id="patch-detail-title" className="patches__detail-title">
          <span className="patches__detail-slot">
            <PatchLabel index={index} memoryLayout={config.memoryLayout} />
          </span>
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
              data-testid="patch-name-input"
              className={cn(
                'patches__detail-name font-mono',
                'bg-s330-panel border border-s330-highlight rounded px-2 py-1',
                'text-s330-text focus:outline-none focus:ring-1 focus:ring-s330-highlight'
              )}
            />
          ) : (
            <span
              className={cn(
                'patches__detail-name cursor-pointer hover:text-s330-highlight',
                !nameValue.trim() && 'opacity-60 italic'
              )}
              onClick={() => setEditingName(true)}
              title="Click to edit patch name"
            >
              {nameValue.trim() || '(unnamed)'}
            </span>
          )}
        </h3>
      </header>

      <div className="patches__detail-body space-y-6">
        {/* Common Parameters card — keep card framing for the parameter
            density we already have; further polish (param grid, range
            bars, layer cards) is structural decomposition out of scope
            for this commit. */}
        <div className="card">

        {/* Common Parameters - matching hardware layout */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Key Mode */}
          <Tooltip content={PATCH_TOOLTIPS.keyMode}>
            <div>
              <label className="text-xs text-s330-muted mb-1 block">Key Mode</label>
              <select
                value={common.keyMode}
                onChange={(e) => handleKeyModeChange(e.target.value as 'normal' | 'v-sw' | 'x-fade' | 'v-mix' | 'unison')}
                data-testid="patch-key-mode"
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
          </Tooltip>

          {/* Key Assign */}
          <Tooltip content={PATCH_TOOLTIPS.keyAssign}>
            <div>
              <label className="text-xs text-s330-muted mb-1 block">Key Assign</label>
              <select
                value={common.keyAssign}
                onChange={(e) => handleKeyAssignChange(e.target.value as 'rotary' | 'fix')}
                data-testid="patch-key-assign"
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
          </Tooltip>

          {/* P.Bend Range */}
          <Tooltip content={PATCH_TOOLTIPS.benderRange}>
            <div>
              <label className="text-xs text-s330-muted mb-1 block">P.Bend Range</label>
              <select
                value={common.benderRange}
                onChange={(e) => handleBenderRangeChange(Number(e.target.value))}
                data-testid="patch-bender-range"
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
          </Tooltip>

          {/* A.T Assign */}
          <Tooltip content={PATCH_TOOLTIPS.aftertouchAssign}>
            <div>
              <label className="text-xs text-s330-muted mb-1 block">A.T Assign</label>
              <select
                value={common.aftertouchAssign}
                onChange={(e) => handleAftertouchAssignChange(e.target.value as 'modulation' | 'volume' | 'bend+' | 'bend-' | 'filter')}
                data-testid="patch-at-assign"
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
          </Tooltip>

          {/* Oct.Shift - disabled due to parsing bug, see issue #10 */}
          <Tooltip content={PATCH_TOOLTIPS.octaveShift + ' (Currently disabled - see issue #10)'}>
            <div className="opacity-50">
              <label className="text-xs text-s330-muted mb-1 block">Oct.Shift</label>
              <div
                className={cn(
                  'w-full px-2 py-1.5 text-sm font-mono',
                  'bg-s330-panel border border-s330-accent/50 rounded',
                  'text-s330-muted cursor-not-allowed'
                )}
              >
                {common.octaveShift > 0 ? '+' : ''}{common.octaveShift}
              </div>
            </div>
          </Tooltip>

          {/* Output Assign */}
          <Tooltip content={PATCH_TOOLTIPS.outputAssign}>
            <div>
              <label className="text-xs text-s330-muted mb-1 block">Output Assign</label>
              <select
                value={common.outputAssign}
                onChange={(e) => handleOutputChange(Number(e.target.value))}
                data-testid="patch-output"
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
          </Tooltip>
        </div>

        {/* Sliders for Level and A.T Sense */}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ParameterSlider
            label="Level"
            value={common.level}
            onChange={handleLevelChange}
            onCommit={handleLevelCommit}
            formatValue={formatPercent}
            tooltip={PATCH_TOOLTIPS.level}
          />
          <ParameterSlider
            label="A.T Sense"
            value={common.aftertouchSens}
            onChange={handleAftertouchSensChange}
            onCommit={handleAftertouchSensCommit}
            formatValue={formatPercent}
            tooltip={PATCH_TOOLTIPS.aftertouchSens}
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
              onCommit={handleDetuneCommit}
              disabled={common.keyMode !== 'unison'}
              tooltip={PATCH_TOOLTIPS.detune}
            />
          </div>

          {/* V-Sw Thresh - always visible, only active in V-Sw mode */}
          <div className={cn(common.keyMode !== 'v-sw' && 'opacity-50')}>
            <ParameterSlider
              label="V-Sw Thresh."
              value={common.velocityThreshold}
              onChange={handleVelocityThresholdChange}
              onCommit={handleVelocityThresholdCommit}
              disabled={common.keyMode !== 'v-sw'}
              tooltip={PATCH_TOOLTIPS.velocityThreshold}
            />
          </div>

          {/* V-Mix Ratio - always visible, only active in V-Mix mode */}
          <div className={cn(common.keyMode !== 'v-mix' && 'opacity-50')}>
            <ParameterSlider
              label="V-Mix Ratio"
              value={common.velocityMixRatio}
              onChange={handleVelocityMixRatioChange}
              onCommit={handleVelocityMixRatioCommit}
              formatValue={formatPercent}
              disabled={common.keyMode !== 'v-mix'}
              tooltip={PATCH_TOOLTIPS.velocityMixRatio}
            />
          </div>
        </div>
      </div>

      {/* Tone Mapping Editor */}
      <div className="card">
        <h4 className="font-medium text-s330-text mb-4">
          Tone Mapping
          <span className="ml-2 text-xs text-s330-muted">
            ({loadedTonesCount} tones loaded, {namedTonesCount} with names)
          </span>
        </h4>

        <div className="space-y-6">
          {/* Layer 1 Zone Editor */}
          <ToneZoneEditor
            layer={1}
            toneData={toneLayer1}
            keyMode={common.keyMode as SamplerKeyMode}
            tones={tones}
            onUpdate={handleToneLayer1Update}
          />

          {/* Layer 2 Zone Editor (shown for dual-layer modes) */}
          <ToneZoneEditor
            layer={2}
            toneData={toneLayer2}
            keyMode={common.keyMode as SamplerKeyMode}
            tones={tones}
            onUpdate={handleToneLayer2Update}
          />
        </div>
      </div>
      </div>

      {/* Live-status footer — replaces save / cancel / undo. Edits stream
          to the device in real time per project memory
          `feedback_live_editing_no_save`. */}
      <footer className="patches__detail-live" role="status" aria-live="polite">
        <span className="patches__detail-live-led" aria-hidden="true" />
        <span>
          Live edit · changes sent to device on commit
        </span>
      </footer>
    </div>
  );
}
