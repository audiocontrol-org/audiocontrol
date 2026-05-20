/**
 * PatchEditor — Common params panel.
 *
 * Extracted from `PatchEditor.tsx` when the editor moved to a tabbed
 * shell so the file stays under the per-file length cap. Renders the
 * patch's routing/mode controls plus the Level / A.T Sense / Unison
 * Detune / V-Sw Thresh / V-Mix Ratio sliders.
 *
 * Per project memory `feedback_editor_tools_all_devices` + the
 * "9 is the practical upper bound" segmented-control rule established
 * on the tones page: Key Mode (5), Key Assign (2), A.T Assign (5),
 * and Output Assign (9) all render as `<AcToggle>` segmented
 * controls. P.Bend Range (13 semitones) is past that bound and keeps
 * the `<select>` shell.
 *
 * Per-option `dataTestId` on every toggle so wiring specs can target
 * a specific value via `patch-<field>-<value>` instead of
 * `selectOption()`.
 *
 * The Unison Detune / V-Sw Thresh / V-Mix Ratio rows dim and disable
 * when the patch's `keyMode` is not the matching mode — those
 * parameters are only meaningful under their respective key modes.
 */

import type { SamplerPatchCommon } from '@/core/midi/SamplerClient';
import { AcToggle } from '@audiocontrol/editor-core';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/Tooltip';
import { ParamSliderRow } from '@/components/ui/ParamSliderRow';
import { PATCH_TOOLTIPS } from '@/constants/patch-tooltips';

type KeyMode = 'normal' | 'v-sw' | 'x-fade' | 'v-mix' | 'unison';
type KeyAssign = 'rotary' | 'fix';
type AftertouchAssign = 'modulation' | 'volume' | 'bend+' | 'bend-' | 'filter';

const KEY_MODE_OPTIONS = [
  { value: 'normal' as KeyMode, label: 'Normal', dataTestId: 'patch-key-mode-normal' },
  { value: 'v-sw'   as KeyMode, label: 'V-Sw',   dataTestId: 'patch-key-mode-v-sw' },
  { value: 'x-fade' as KeyMode, label: 'X-Fade', dataTestId: 'patch-key-mode-x-fade' },
  { value: 'v-mix'  as KeyMode, label: 'V-Mix',  dataTestId: 'patch-key-mode-v-mix' },
  { value: 'unison' as KeyMode, label: 'Unison', dataTestId: 'patch-key-mode-unison' },
] as const;

const KEY_ASSIGN_OPTIONS = [
  { value: 'rotary' as KeyAssign, label: 'Rotary', dataTestId: 'patch-key-assign-rotary' },
  { value: 'fix'    as KeyAssign, label: 'Fix',    dataTestId: 'patch-key-assign-fix' },
] as const;

const AFTERTOUCH_ASSIGN_OPTIONS = [
  { value: 'modulation' as AftertouchAssign, label: 'Mod',    dataTestId: 'patch-at-assign-modulation' },
  { value: 'volume'     as AftertouchAssign, label: 'Vol',    dataTestId: 'patch-at-assign-volume' },
  { value: 'bend+'      as AftertouchAssign, label: 'Bend+',  dataTestId: 'patch-at-assign-bend-plus' },
  { value: 'bend-'      as AftertouchAssign, label: 'Bend-',  dataTestId: 'patch-at-assign-bend-minus' },
  { value: 'filter'     as AftertouchAssign, label: 'Filter', dataTestId: 'patch-at-assign-filter' },
] as const;

// Output: Out 1..8 (values 0..7) + TONE (value 8). Same 9-option
// shape as the tones page output toggle, different semantics.
const OUTPUT_OPTIONS = [
  { value: '0', label: '1',    dataTestId: 'patch-output-0' },
  { value: '1', label: '2',    dataTestId: 'patch-output-1' },
  { value: '2', label: '3',    dataTestId: 'patch-output-2' },
  { value: '3', label: '4',    dataTestId: 'patch-output-3' },
  { value: '4', label: '5',    dataTestId: 'patch-output-4' },
  { value: '5', label: '6',    dataTestId: 'patch-output-5' },
  { value: '6', label: '7',    dataTestId: 'patch-output-6' },
  { value: '7', label: '8',    dataTestId: 'patch-output-7' },
  { value: '8', label: 'TONE', dataTestId: 'patch-output-8' },
] as const;

export interface PatchCommonPanelProps {
  common: SamplerPatchCommon;
  onKeyModeChange: (m: KeyMode) => void;
  onKeyAssignChange: (a: KeyAssign) => void;
  onBenderRangeChange: (r: number) => void;
  onAftertouchAssignChange: (a: AftertouchAssign) => void;
  onOutputChange: (o: number) => void;
  onLevelChange: (v: number) => void;
  onAftertouchSensChange: (v: number) => void;
  onDetuneChange: (v: number) => void;
  onVelocityThresholdChange: (v: number) => void;
  onVelocityMixRatioChange: (v: number) => void;
}

export function PatchCommonPanel({
  common,
  onKeyModeChange,
  onKeyAssignChange,
  onBenderRangeChange,
  onAftertouchAssignChange,
  onOutputChange,
  onLevelChange,
  onAftertouchSensChange,
  onDetuneChange,
  onVelocityThresholdChange,
  onVelocityMixRatioChange,
}: PatchCommonPanelProps) {
  return (
    <div className="ac-panel-stack">
      {/* Routing / mode toggles laid out in the shared wrap container
          — same primitive the tones-page wave panel uses for
          Bank / Loop Mode / Output. */}
      <div className="ac-compact-grid">
        <Tooltip content={PATCH_TOOLTIPS.keyMode}>
          <div className="ac-compact-field">
            <span className="ac-field-label">Key Mode</span>
            <AcToggle
              value={common.keyMode as KeyMode}
              options={KEY_MODE_OPTIONS}
              onChange={onKeyModeChange}
              ariaLabel="Key Mode"
              name="patch-key-mode"
            />
          </div>
        </Tooltip>

        <Tooltip content={PATCH_TOOLTIPS.keyAssign}>
          <div className="ac-compact-field">
            <span className="ac-field-label">Key Assign</span>
            <AcToggle
              value={common.keyAssign as KeyAssign}
              options={KEY_ASSIGN_OPTIONS}
              onChange={onKeyAssignChange}
              ariaLabel="Key Assign"
              name="patch-key-assign"
            />
          </div>
        </Tooltip>

        <Tooltip content={PATCH_TOOLTIPS.aftertouchAssign}>
          <div className="ac-compact-field">
            <span className="ac-field-label">A.T Assign</span>
            <AcToggle
              value={common.aftertouchAssign as AftertouchAssign}
              options={AFTERTOUCH_ASSIGN_OPTIONS}
              onChange={onAftertouchAssignChange}
              ariaLabel="Aftertouch Assign"
              name="patch-at-assign"
            />
          </div>
        </Tooltip>

        <Tooltip content={PATCH_TOOLTIPS.outputAssign}>
          <div className="ac-compact-field">
            <span className="ac-field-label">Output</span>
            <AcToggle
              value={String(common.outputAssign)}
              options={OUTPUT_OPTIONS}
              onChange={(value) => onOutputChange(parseInt(value, 10))}
              ariaLabel="Output Assign"
              name="patch-output"
            />
          </div>
        </Tooltip>

        {/* P.Bend Range — 13 semitones past the practical toggle bound;
            stays as a styled select. */}
        <Tooltip content={PATCH_TOOLTIPS.benderRange}>
          <div className="ac-compact-field">
            <span className="ac-field-label">P.Bend Range</span>
            <select
              value={common.benderRange}
              onChange={(e) => onBenderRangeChange(Number(e.target.value))}
              data-testid="patch-bender-range"
              className="ac-select"
              aria-label="Pitch Bender Range"
            >
              {Array.from({ length: 13 }, (_, i) => (
                <option key={i} value={i}>{i} semitones</option>
              ))}
            </select>
          </div>
        </Tooltip>

        {/* Oct.Shift — currently disabled per issue #10 parsing bug.
            Kept as readonly readout so the operator can still see the
            current value while editing the patch elsewhere. */}
        <Tooltip content={PATCH_TOOLTIPS.octaveShift + ' (Currently disabled - see issue #10)'}>
          <div className="ac-compact-field opacity-50">
            <span className="ac-field-label">Oct.Shift</span>
            <div
              className={cn(
                'px-2 py-1.5 text-sm font-mono',
                'bg-s330-panel border border-s330-accent/50 rounded',
                'text-s330-muted cursor-not-allowed',
              )}
              style={{ minWidth: '4rem', textAlign: 'center' }}
            >
              {common.octaveShift > 0 ? '+' : ''}{common.octaveShift}
            </div>
          </div>
        </Tooltip>
      </div>

      {/* Level + A.T Sense sliders. */}
      <div className="grid gap-4 md:grid-cols-2">
        <ParamSliderRow
          label="Level"
          value={common.level}
          onChange={onLevelChange}
          tooltip={PATCH_TOOLTIPS.level}
        />
        <ParamSliderRow
          label="A.T Sense"
          value={common.aftertouchSens}
          onChange={onAftertouchSensChange}
          tooltip={PATCH_TOOLTIPS.aftertouchSens}
        />
      </div>

      {/* Mode-specific velocity sliders. The stored Unison Detune is a
          signed offset (-64..+63); the slider presents 0..127 (= detune + 64)
          and converts back on edit. */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className={cn(common.keyMode !== 'unison' && 'opacity-50')}>
          <ParamSliderRow
            label="Unison Detune"
            value={common.detune + 64}
            onChange={(val) => onDetuneChange(val - 64)}
            tooltip={PATCH_TOOLTIPS.detune}
            disabled={common.keyMode !== 'unison'}
          />
        </div>

        <div className={cn(common.keyMode !== 'v-sw' && 'opacity-50')}>
          <ParamSliderRow
            label="V-Sw Thresh."
            value={common.velocityThreshold}
            onChange={onVelocityThresholdChange}
            tooltip={PATCH_TOOLTIPS.velocityThreshold}
            disabled={common.keyMode !== 'v-sw'}
          />
        </div>

        <div className={cn(common.keyMode !== 'v-mix' && 'opacity-50')}>
          <ParamSliderRow
            label="V-Mix Ratio"
            value={common.velocityMixRatio}
            onChange={onVelocityMixRatioChange}
            tooltip={PATCH_TOOLTIPS.velocityMixRatio}
            disabled={common.keyMode !== 'v-mix'}
          />
        </div>
      </div>
    </div>
  );
}
