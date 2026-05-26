/**
 * ToneEditor — Filter (TVF) tab panel (Phase 9 Task 4 TonesPage amend).
 *
 * Per project memory `feedback_tabbed_detail_pane`, the TVF parameters
 * and the TVF envelope live in the SAME tab because they interact
 * strongly when dialing in a sound.
 *
 * v3 atomic primitives:
 *   - ParameterSlider → ParamSliderRow (AcSlider + AcNumberInput editable;
 *     streaming writes per `feedback_live_editing_no_save`).
 *   - vanilla `<select>` → `.ac-select` with adjacent `.ac-field-label`.
 *   - vanilla `<input type="checkbox">` (Enable Filter) → AcCheckbox with
 *     `dataTestId` (lands the `data-testid` on the `<input>` so the spec
 *     selector `tone-tvf-enabled` hits the toggle target directly).
 *   - EnvelopeEditor → ToneEnvelopeEditor (composes AcEnvelope for
 *     graph+pip+readout plus an inline edit grid).
 *
 * data-testid preservation:
 *   - tone-tvf-enabled (on the AcCheckbox `<input>`)
 *   - tone-tvf-polarity, tone-tvf-curve (selects)
 */

import type {
  SamplerTone, SamplerEnvelope, SamplerEgPolarity, SamplerLevelCurve,
} from '@/core/midi/SamplerClient';
import { AcToggle } from '@audiocontrol/editor-core';
import { ParamSliderRow } from '@/components/ui/ParamSliderRow';
import { ToneEnvelopeEditor } from '@/components/ui/ToneEnvelopeEditor';
import { Tooltip } from '@/components/ui/Tooltip';
import { TONE_TOOLTIPS } from '@/constants/tone-tooltips';

const FILTER_ENABLED_OPTIONS = [
  { value: 'on' as const,  label: 'On',  dataTestId: 'tone-tvf-enabled-on' },
  { value: 'off' as const, label: 'Off', dataTestId: 'tone-tvf-enabled-off' },
] as const;

const EG_POLARITY_OPTIONS = [
  { value: 'normal' as const, label: 'Normal', dataTestId: 'tone-tvf-polarity-normal' },
  { value: 'reverse' as const, label: 'Reverse', dataTestId: 'tone-tvf-polarity-reverse' },
] as const;

interface ToneFilterPanelProps {
  tone: SamplerTone;
  onUpdate?: (tone: SamplerTone) => void;
  onCommit?: (updatedTone?: SamplerTone) => void;
}

export function ToneFilterPanel({ tone, onUpdate, onCommit }: ToneFilterPanelProps) {
  // Streaming writes — single async handler per parameter (PatchEditor
  // post-amend pattern; mirrors `feedback_live_editing_no_save`).
  const tvf = tone.tvf;
  const updateTvf = (next: Partial<typeof tvf>) => {
    const updatedTone = { ...tone, tvf: { ...tvf, ...next } };
    onUpdate?.(updatedTone);
    onCommit?.(updatedTone);
  };
  const handleCutoffChange = (cutoff: number) => updateTvf({ cutoff });
  const handleResonanceChange = (resonance: number) => updateTvf({ resonance });
  const handleKeyFollowChange = (keyFollow: number) => updateTvf({ keyFollow });
  const handleLfoDepthChange = (lfoDepth: number) => updateTvf({ lfoDepth });
  const handleEgDepthChange = (egDepth: number) => updateTvf({ egDepth });
  const handleKeyRateChange = (keyRateFollow: number) => updateTvf({ keyRateFollow });
  const handleVelRateChange = (velRateFollow: number) => updateTvf({ velRateFollow });

  const handleTvfEnvelopeChange = (envelope: SamplerEnvelope) => {
    onUpdate?.({ ...tone, tvf: { ...tvf, envelope } });
  };
  const handleTvfEnvelopeCommit = (envelope: SamplerEnvelope) => {
    const updatedTone = { ...tone, tvf: { ...tvf, envelope } };
    onCommit?.(updatedTone);
  };

  return (
    <section className="tones__section">
      {/* No section header — duplicates the active FILTER tab. */}

      {/* Slider grid first. Filter Enable + EG Polarity share a single
          compact-grid row below, since both are binary/few-position
          enums that read better as segmented controls than as a
          checkbox + dropdown. */}
      <div className="ac-param-rows">
        <ParamSliderRow label="Cutoff" value={tvf.cutoff} onChange={handleCutoffChange} tooltip={TONE_TOOLTIPS.tvfCutoff} disabled={!tvf.enabled} />
        <ParamSliderRow label="Resonance" value={tvf.resonance} onChange={handleResonanceChange} tooltip={TONE_TOOLTIPS.tvfResonance} disabled={!tvf.enabled} />
        <ParamSliderRow label="Key Follow" value={tvf.keyFollow} onChange={handleKeyFollowChange} tooltip={TONE_TOOLTIPS.tvfKeyFollow} disabled={!tvf.enabled} />
        <ParamSliderRow label="LFO Depth" value={tvf.lfoDepth} onChange={handleLfoDepthChange} tooltip={TONE_TOOLTIPS.tvfLfoDepth} disabled={!tvf.enabled} />
        <ParamSliderRow label="EG Depth" value={tvf.egDepth} onChange={handleEgDepthChange} tooltip={TONE_TOOLTIPS.tvfEgDepth} disabled={!tvf.enabled} />
        <ParamSliderRow label="Key Rate" value={tvf.keyRateFollow} onChange={handleKeyRateChange} tooltip={TONE_TOOLTIPS.tvfKeyRate} disabled={!tvf.enabled} />
        <ParamSliderRow label="Vel Rate" value={tvf.velRateFollow} onChange={handleVelRateChange} tooltip={TONE_TOOLTIPS.tvfVelRate} disabled={!tvf.enabled} />
        <ParamSliderRow label="Level Curve" value={tvf.levelCurve} min={0} max={5} onChange={(v: number) => updateTvf({ levelCurve: v as SamplerLevelCurve })} tooltip={TONE_TOOLTIPS.tvfLevelCurve} disabled={!tvf.enabled} />
      </div>

      {/* Enable Filter + EG Polarity on one row — both are AcToggle
          segmented controls with label-above-control bundles inside
          the shared compact-grid layout. Saves a row vs the previous
          full-width Enable Filter checkbox above the sliders, and
          matches the visual rhythm of the toggles in the Wave panel
          (BANK / LOOP MODE / OUTPUT). */}
      <div className="ac-compact-grid">
        <Tooltip content={TONE_TOOLTIPS.tvfEnabled}>
          <div className="ac-compact-field">
            <span className="ac-field-label">Filter</span>
            <AcToggle
              value={tvf.enabled ? 'on' : 'off'}
              options={FILTER_ENABLED_OPTIONS}
              onChange={(v) => updateTvf({ enabled: v === 'on' })}
              ariaLabel="Enable Filter"
              name="tvf-enabled"
            />
          </div>
        </Tooltip>
        <Tooltip content={TONE_TOOLTIPS.tvfEgPolarity}>
          <div className="ac-compact-field">
            <span className="ac-field-label">EG Polarity</span>
            <AcToggle
              value={tvf.egPolarity}
              options={EG_POLARITY_OPTIONS}
              onChange={(v) => updateTvf({ egPolarity: v as SamplerEgPolarity })}
              disabled={!tvf.enabled}
              ariaLabel="EG Polarity"
              name="tvf-polarity"
            />
          </div>
        </Tooltip>
      </div>

      <ToneEnvelopeEditor
        envelope={tvf.envelope}
        onChange={handleTvfEnvelopeChange}
        onCommit={handleTvfEnvelopeCommit}
        label="TVF"
        disabled={!tvf.enabled}
      />
    </section>
  );
}
