/**
 * ToneEditor — Filter (TVF) tab panel (Phase 9 Task 4 polish).
 *
 * Per project memory `feedback_tabbed_detail_pane`, the TVF parameters
 * and the TVF envelope live in the SAME tab because they interact
 * strongly when dialing in a sound.
 *
 * data-testid preservation:
 *   - tone-tvf-enabled, tone-tvf-polarity, tone-tvf-curve
 */

import type {
  SamplerTone, SamplerEnvelope, SamplerEgPolarity, SamplerLevelCurve,
} from '@/core/midi/SamplerClient';
import { formatPercent } from '@audiocontrol/editor-core';
import { cn } from '@/lib/utils';
import { ParameterSlider } from '@/components/ui/ParameterSlider';
import { EnvelopeEditor } from '@/components/ui/EnvelopeEditor';
import { Tooltip } from '@/components/ui/Tooltip';
import { TONE_TOOLTIPS } from '@/constants/tone-tooltips';

interface ToneFilterPanelProps {
  tone: SamplerTone;
  onUpdate?: (tone: SamplerTone) => void;
  onCommit?: (updatedTone?: SamplerTone) => void;
}

export function ToneFilterPanel({ tone, onUpdate, onCommit }: ToneFilterPanelProps) {
  const handleTvfEnvelopeChange = (envelope: SamplerEnvelope) => {
    onUpdate?.({ ...tone, tvf: { ...tone.tvf, envelope } });
  };

  return (
    <section className="tones__section">
      <header className="tones__section-head">
        <h4 className="tones__section-title">
          Filter — TVF
          <span className={cn(
            'ml-2 text-xs px-2 py-0.5 rounded',
            tone.tvf.enabled ? 'bg-s330-highlight/20 text-s330-highlight' : 'bg-s330-muted/20 text-s330-muted',
          )}>
            {tone.tvf.enabled ? 'ON' : 'OFF'}
          </span>
        </h4>
        <span className="tones__section-eyebrow">Time-variant · §03</span>
      </header>
      <Tooltip content={TONE_TOOLTIPS.tvfEnabled}>
        <div className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            id="tvfEnabled"
            checked={tone.tvf.enabled}
            data-testid="tone-tvf-enabled"
            onChange={(e) => {
              const updatedTone = { ...tone, tvf: { ...tone.tvf, enabled: e.target.checked } };
              onUpdate?.(updatedTone);
              onCommit?.(updatedTone);
            }}
            className="rounded"
          />
          <label htmlFor="tvfEnabled" className="text-sm text-s330-text">Enable Filter</label>
        </div>
      </Tooltip>
      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <ParameterSlider label="Cutoff" value={tone.tvf.cutoff} onChange={(v) => onUpdate?.({ ...tone, tvf: { ...tone.tvf, cutoff: v } })} onCommit={onCommit} formatValue={formatPercent} disabled={!tone.tvf.enabled} tooltip={TONE_TOOLTIPS.tvfCutoff} />
        <ParameterSlider label="Resonance" value={tone.tvf.resonance} onChange={(v) => onUpdate?.({ ...tone, tvf: { ...tone.tvf, resonance: v } })} onCommit={onCommit} formatValue={formatPercent} disabled={!tone.tvf.enabled} tooltip={TONE_TOOLTIPS.tvfResonance} />
        <ParameterSlider label="Key Follow" value={tone.tvf.keyFollow} onChange={(v) => onUpdate?.({ ...tone, tvf: { ...tone.tvf, keyFollow: v } })} onCommit={onCommit} formatValue={formatPercent} disabled={!tone.tvf.enabled} tooltip={TONE_TOOLTIPS.tvfKeyFollow} />
      </div>
      <div className="grid gap-4 md:grid-cols-4 mb-4">
        <ParameterSlider label="LFO Depth" value={tone.tvf.lfoDepth} onChange={(v) => onUpdate?.({ ...tone, tvf: { ...tone.tvf, lfoDepth: v } })} onCommit={onCommit} formatValue={formatPercent} disabled={!tone.tvf.enabled} tooltip={TONE_TOOLTIPS.tvfLfoDepth} />
        <ParameterSlider label="EG Depth" value={tone.tvf.egDepth} onChange={(v) => onUpdate?.({ ...tone, tvf: { ...tone.tvf, egDepth: v } })} onCommit={onCommit} formatValue={formatPercent} disabled={!tone.tvf.enabled} tooltip={TONE_TOOLTIPS.tvfEgDepth} />
        <ParameterSlider label="Key Rate" value={tone.tvf.keyRateFollow} onChange={(v) => onUpdate?.({ ...tone, tvf: { ...tone.tvf, keyRateFollow: v } })} onCommit={onCommit} formatValue={formatPercent} disabled={!tone.tvf.enabled} tooltip={TONE_TOOLTIPS.tvfKeyRate} />
        <ParameterSlider label="Vel Rate" value={tone.tvf.velRateFollow} onChange={(v) => onUpdate?.({ ...tone, tvf: { ...tone.tvf, velRateFollow: v } })} onCommit={onCommit} formatValue={formatPercent} disabled={!tone.tvf.enabled} tooltip={TONE_TOOLTIPS.tvfVelRate} />
      </div>
      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <Tooltip content={TONE_TOOLTIPS.tvfEgPolarity}>
          <div>
            <label className="text-xs text-s330-muted mb-1 block">EG Polarity</label>
            <select
              value={tone.tvf.egPolarity}
              onChange={(e) => {
                const updatedTone = { ...tone, tvf: { ...tone.tvf, egPolarity: e.target.value as SamplerEgPolarity } };
                onUpdate?.(updatedTone);
                onCommit?.(updatedTone);
              }}
              disabled={!tone.tvf.enabled}
              data-testid="tone-tvf-polarity"
              className="w-full text-sm bg-s330-bg border border-s330-accent/30 rounded px-2 py-1 text-s330-text disabled:opacity-50"
            >
              <option value="normal">Normal</option>
              <option value="reverse">Reverse</option>
            </select>
          </div>
        </Tooltip>
        <Tooltip content={TONE_TOOLTIPS.tvfLevelCurve}>
          <div>
            <label className="text-xs text-s330-muted mb-1 block">Level Curve</label>
            <select
              value={tone.tvf.levelCurve}
              onChange={(e) => {
                const updatedTone = { ...tone, tvf: { ...tone.tvf, levelCurve: Number(e.target.value) as SamplerLevelCurve } };
                onUpdate?.(updatedTone);
                onCommit?.(updatedTone);
              }}
              disabled={!tone.tvf.enabled}
              data-testid="tone-tvf-curve"
              className="w-full text-sm bg-s330-bg border border-s330-accent/30 rounded px-2 py-1 text-s330-text disabled:opacity-50"
            >
              {[0, 1, 2, 3, 4, 5].map((i) => (<option key={i} value={i}>{i}</option>))}
            </select>
          </div>
        </Tooltip>
      </div>
      <EnvelopeEditor
        envelope={tone.tvf.envelope}
        onChange={handleTvfEnvelopeChange}
        onCommit={onCommit}
        label="TVF"
        disabled={!tone.tvf.enabled}
      />
    </section>
  );
}
