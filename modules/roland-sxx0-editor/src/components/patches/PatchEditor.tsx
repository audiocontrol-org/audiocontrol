/**
 * Patch editor component
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import type { SamplerPatch, SamplerKeyMode, SamplerTone, SamplerClientInterface } from '@/core/midi/SamplerClient';
import { useMidiStore } from '@/stores/midiStore';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { PatchEditorTabs } from './PatchEditorTabs';
import { PatchCommonPanel } from './PatchCommonPanel';
import { PatchMappingPanel } from './PatchMappingPanel';
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

  // Patch name handler — commits on blur (same pattern as the tone
  // editor's always-editable name input). Keystrokes only update local
  // state; the device write happens on blur.
  const commitName = async () => {
    if (nameValue === common.name) return;
    updatePatch({ ...common, name: nameValue });
    if (clientRef.current) {
      try {
        await clientRef.current.setPatchName(index, nameValue);
      } catch (err) {
        console.error('[PatchEditor] Failed to update patch name:', err);
      }
    }
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

  // Numeric parameter handlers — AcNumberInput emits onChange per
  // keystroke, so each handler streams the value to the device on
  // change rather than batching to a drag-end commit (per project
  // memory `feedback_live_editing_no_save`: parameter edits stream
  // live; no save/cancel/undo). Pre-migration, the Radix
  // ParameterSlider split this into a state-only onChange + a
  // device-write onCommit fired on pointerup — the new editable
  // number readout has no pointer-up edge, so the streaming write IS
  // the model.

  const handleLevelChange = async (level: number) => {
    updatePatch({ ...common, level });
    if (clientRef.current) {
      try {
        await clientRef.current.setPatchLevel(index, level);
      } catch (err) {
        console.error('[PatchEditor] Failed to update level:', err);
      }
    }
  };

  const handleAftertouchSensChange = async (sens: number) => {
    updatePatch({ ...common, aftertouchSens: sens });
    if (clientRef.current) {
      try {
        await clientRef.current.setPatchAftertouchSens(index, sens);
      } catch (err) {
        console.error('[PatchEditor] Failed to update aftertouch sensitivity:', err);
      }
    }
  };

  const handleDetuneChange = async (detune: number) => {
    updatePatch({ ...common, detune });
    if (clientRef.current) {
      try {
        await clientRef.current.setPatchDetune(index, detune);
      } catch (err) {
        console.error('[PatchEditor] Failed to update detune:', err);
      }
    }
  };

  const handleVelocityThresholdChange = async (threshold: number) => {
    updatePatch({ ...common, velocityThreshold: threshold });
    if (clientRef.current) {
      try {
        await clientRef.current.setPatchVelocityThreshold(index, threshold);
      } catch (err) {
        console.error('[PatchEditor] Failed to update velocity threshold:', err);
      }
    }
  };

  const handleVelocityMixRatioChange = async (ratio: number) => {
    updatePatch({ ...common, velocityMixRatio: ratio });
    if (clientRef.current) {
      try {
        await clientRef.current.setPatchVelocityMixRatio(index, ratio);
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

  return (
    <div data-testid="patch-editor" data-capability="C-PATCH-04">
      {/* Detail head — same shape as ToneEditorHead (eyebrow row +
          slot + always-editable name input). Both pages render
          pixel-identical chrome via the .ac-detail-* primitives in
          editor-core/src/design/detail-pane-primitives.css (promoted
          from roland-sxx0-editor 2026-05-25 per AUDIT-20260525-26). */}
      <header className="ac-detail-head">
        <div className="ac-detail-eyebrow-row">
          <span>Patch</span>
          <span className="ac-detail-eyebrow-sep">·</span>
          <span className="ac-detail-eyebrow-accent">Editing</span>
          <span className="ac-detail-eyebrow-sep">·</span>
          <span>Source · {config.deviceName}</span>
        </div>
        <h3 id="patch-detail-title" className="ac-detail-title">
          <span className="ac-detail-slot">
            <PatchLabel index={index} memoryLayout={config.memoryLayout} />
          </span>
          <input
            type="text"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value.slice(0, 12))}
            onBlur={() => { void commitName(); }}
            placeholder="(unnamed)"
            data-testid="patch-name-input"
            maxLength={12}
            size={12}
            className="ac-input ac-detail-name-input"
          />
        </h3>
      </header>

      <div className="ac-detail-body">
        <PatchEditorTabs
          groupName={`patch-tabs-${index}`}
          panels={{
            'pt-common': (
              <PatchCommonPanel
                common={common}
                onKeyModeChange={handleKeyModeChange}
                onKeyAssignChange={handleKeyAssignChange}
                onBenderRangeChange={handleBenderRangeChange}
                onAftertouchAssignChange={handleAftertouchAssignChange}
                onOutputChange={handleOutputChange}
                onLevelChange={handleLevelChange}
                onAftertouchSensChange={handleAftertouchSensChange}
                onDetuneChange={handleDetuneChange}
                onVelocityThresholdChange={handleVelocityThresholdChange}
                onVelocityMixRatioChange={handleVelocityMixRatioChange}
              />
            ),
            'pt-mapping': (
              <PatchMappingPanel
                keyMode={common.keyMode as SamplerKeyMode}
                toneLayer1={toneLayer1}
                toneLayer2={toneLayer2}
                tones={tones}
                onLayer1Update={handleToneLayer1Update}
                onLayer2Update={handleToneLayer2Update}
              />
            ),
          }}
        />
      </div>
    </div>
  );
}
