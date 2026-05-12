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
import { cn } from '@/lib/utils';
import { AcCheckbox } from '@audiocontrol/editor-core';
import { ParamSliderRow } from '@/components/ui/ParamSliderRow';
import { ToneEnvelopeEditor } from '@/components/ui/ToneEnvelopeEditor';
import { Tooltip } from '@/components/ui/Tooltip';
import { TONE_TOOLTIPS } from '@/constants/tone-tooltips';

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
      <header className="tones__section-head">
        <h4 className="tones__section-title">
          Filter — TVF
          <span className={cn(
            'ml-2 text-xs px-2 py-0.5 rounded',
            tvf.enabled ? 'bg-s330-highlight/20 text-s330-highlight' : 'bg-s330-muted/20 text-s330-muted',
          )}>
            {tvf.enabled ? 'ON' : 'OFF'}
          </span>
        </h4>
        <span className="tones__section-eyebrow">Time-variant · §03</span>
      </header>
      <Tooltip content={TONE_TOOLTIPS.tvfEnabled}>
        <AcCheckbox
          id="tvfEnabled"
          dataTestId="tone-tvf-enabled"
          checked={tvf.enabled}
          onChange={(checked) => updateTvf({ enabled: checked })}
          className="mb-4"
        >
          Enable Filter
        </AcCheckbox>
      </Tooltip>
      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <ParamSliderRow label="Cutoff" value={tvf.cutoff} onChange={handleCutoffChange} tooltip={TONE_TOOLTIPS.tvfCutoff} disabled={!tvf.enabled} />
        <ParamSliderRow label="Resonance" value={tvf.resonance} onChange={handleResonanceChange} tooltip={TONE_TOOLTIPS.tvfResonance} disabled={!tvf.enabled} />
        <ParamSliderRow label="Key Follow" value={tvf.keyFollow} onChange={handleKeyFollowChange} tooltip={TONE_TOOLTIPS.tvfKeyFollow} disabled={!tvf.enabled} />
      </div>
      <div className="grid gap-4 md:grid-cols-4 mb-4">
        <ParamSliderRow label="LFO Depth" value={tvf.lfoDepth} onChange={handleLfoDepthChange} tooltip={TONE_TOOLTIPS.tvfLfoDepth} disabled={!tvf.enabled} />
        <ParamSliderRow label="EG Depth" value={tvf.egDepth} onChange={handleEgDepthChange} tooltip={TONE_TOOLTIPS.tvfEgDepth} disabled={!tvf.enabled} />
        <ParamSliderRow label="Key Rate" value={tvf.keyRateFollow} onChange={handleKeyRateChange} tooltip={TONE_TOOLTIPS.tvfKeyRate} disabled={!tvf.enabled} />
        <ParamSliderRow label="Vel Rate" value={tvf.velRateFollow} onChange={handleVelRateChange} tooltip={TONE_TOOLTIPS.tvfVelRate} disabled={!tvf.enabled} />
      </div>
      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <Tooltip content={TONE_TOOLTIPS.tvfEgPolarity}>
          <div>
            <label className="ac-field-label mb-1 block">EG Polarity</label>
            <select
              value={tvf.egPolarity}
              onChange={(e) => updateTvf({ egPolarity: e.target.value as SamplerEgPolarity })}
              disabled={!tvf.enabled}
              data-testid="tone-tvf-polarity"
              className="ac-select"
            >
              <option value="normal">Normal</option>
              <option value="reverse">Reverse</option>
            </select>
          </div>
        </Tooltip>
        <Tooltip content={TONE_TOOLTIPS.tvfLevelCurve}>
          <div>
            <label className="ac-field-label mb-1 block">Level Curve</label>
            <select
              value={tvf.levelCurve}
              onChange={(e) => updateTvf({ levelCurve: Number(e.target.value) as SamplerLevelCurve })}
              disabled={!tvf.enabled}
              data-testid="tone-tvf-curve"
              className="ac-select"
            >
              {[0, 1, 2, 3, 4, 5].map((i) => (<option key={i} value={i}>{i}</option>))}
            </select>
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
