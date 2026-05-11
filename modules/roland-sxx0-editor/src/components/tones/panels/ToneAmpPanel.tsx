/**
 * ToneEditor — Amplifier (TVA) tab panel (Phase 9 Task 4 polish).
 *
 * Per project memory `feedback_tabbed_detail_pane`, the TVA parameters
 * and the TVA envelope live in the SAME tab because they interact
 * strongly when dialing in level dynamics.
 *
 * data-testid preservation:
 *   - tone-tva-curve
 */

import type { SamplerTone, SamplerEnvelope, SamplerLevelCurve } from '@/core/midi/SamplerClient';
import { formatPercent } from '@audiocontrol/editor-core';
import { ParameterSlider } from '@/components/ui/ParameterSlider';
import { EnvelopeEditor } from '@/components/ui/EnvelopeEditor';
import { Tooltip } from '@/components/ui/Tooltip';
import { TONE_TOOLTIPS } from '@/constants/tone-tooltips';

interface ToneAmpPanelProps {
  tone: SamplerTone;
  onUpdate?: (tone: SamplerTone) => void;
  onCommit?: (updatedTone?: SamplerTone) => void;
}

export function ToneAmpPanel({ tone, onUpdate, onCommit }: ToneAmpPanelProps) {
  const handleTvaEnvelopeChange = (envelope: SamplerEnvelope) => {
    onUpdate?.({ ...tone, tva: { ...tone.tva, envelope } });
  };

  return (
    <section className="tones__section">
      <header className="tones__section-head">
        <h4 className="tones__section-title">Amplifier — TVA</h4>
        <span className="tones__section-eyebrow">Level · §04</span>
      </header>
      <div className="grid gap-4 md:grid-cols-4 mb-4">
        <ParameterSlider label="Level" value={tone.tva.level} onChange={(v) => onUpdate?.({ ...tone, tva: { ...tone.tva, level: v } })} onCommit={onCommit} formatValue={formatPercent} tooltip={TONE_TOOLTIPS.tvaLevel} />
        <ParameterSlider label="LFO Depth" value={tone.tva.lfoDepth} onChange={(v) => onUpdate?.({ ...tone, tva: { ...tone.tva, lfoDepth: v } })} onCommit={onCommit} formatValue={formatPercent} tooltip={TONE_TOOLTIPS.tvaLfoDepth} />
        <ParameterSlider label="Key Rate" value={tone.tva.keyRate} onChange={(v) => onUpdate?.({ ...tone, tva: { ...tone.tva, keyRate: v } })} onCommit={onCommit} formatValue={formatPercent} tooltip={TONE_TOOLTIPS.tvaKeyRate} />
        <ParameterSlider label="Vel Rate" value={tone.tva.velRate} onChange={(v) => onUpdate?.({ ...tone, tva: { ...tone.tva, velRate: v } })} onCommit={onCommit} formatValue={formatPercent} tooltip={TONE_TOOLTIPS.tvaVelRate} />
      </div>
      <Tooltip content={TONE_TOOLTIPS.tvaLevelCurve}>
        <div className="mb-4 max-w-[200px]">
          <label className="text-xs text-s330-muted mb-1 block">Level Curve</label>
          <select
            value={tone.tva.levelCurve}
            onChange={(e) => {
              const updatedTone = { ...tone, tva: { ...tone.tva, levelCurve: Number(e.target.value) as SamplerLevelCurve } };
              onUpdate?.(updatedTone);
              onCommit?.(updatedTone);
            }}
            data-testid="tone-tva-curve"
            className="w-full text-sm bg-s330-bg border border-s330-accent/30 rounded px-2 py-1 text-s330-text"
          >
            {[0, 1, 2, 3, 4, 5].map((i) => (<option key={i} value={i}>{i}</option>))}
          </select>
        </div>
      </Tooltip>
      <EnvelopeEditor
        envelope={tone.tva.envelope}
        onChange={handleTvaEnvelopeChange}
        onCommit={onCommit}
        label="TVA"
      />
    </section>
  );
}
