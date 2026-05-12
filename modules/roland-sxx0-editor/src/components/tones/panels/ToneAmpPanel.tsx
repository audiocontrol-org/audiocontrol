/**
 * ToneEditor — Amplifier (TVA) tab panel (Phase 9 Task 4 TonesPage amend).
 *
 * Per project memory `feedback_tabbed_detail_pane`, the TVA parameters
 * and the TVA envelope live in the SAME tab because they interact
 * strongly when dialing in level dynamics.
 *
 * v3 atomic primitives:
 *   - ParameterSlider → ParamSliderRow (AcSlider + AcNumberInput editable;
 *     streaming writes per `feedback_live_editing_no_save`).
 *   - vanilla `<select>` → `.ac-select` with adjacent `.ac-field-label`.
 *   - EnvelopeEditor → ToneEnvelopeEditor (composes AcEnvelope from
 *     editor-core for graph+pip+readout, plus an inline edit grid for
 *     per-segment rate/level).
 *
 * data-testid preservation:
 *   - tone-tva-curve (Level Curve select)
 */

import type { SamplerTone, SamplerEnvelope, SamplerLevelCurve } from '@/core/midi/SamplerClient';
import { ParamSliderRow } from '@/components/ui/ParamSliderRow';
import { ToneEnvelopeEditor } from '@/components/ui/ToneEnvelopeEditor';
import { Tooltip } from '@/components/ui/Tooltip';
import { TONE_TOOLTIPS } from '@/constants/tone-tooltips';

interface ToneAmpPanelProps {
  tone: SamplerTone;
  onUpdate?: (tone: SamplerTone) => void;
  onCommit?: (updatedTone?: SamplerTone) => void;
}

export function ToneAmpPanel({ tone, onUpdate, onCommit }: ToneAmpPanelProps) {
  // Streaming writes — collapse the legacy onChange-state + onCommit-device
  // pair into a single async handler per parameter (mirrors PatchEditor
  // post-amend pattern).
  const handleLevelChange = (level: number) => {
    const updatedTone = { ...tone, tva: { ...tone.tva, level } };
    onUpdate?.(updatedTone);
    onCommit?.(updatedTone);
  };
  const handleLfoDepthChange = (lfoDepth: number) => {
    const updatedTone = { ...tone, tva: { ...tone.tva, lfoDepth } };
    onUpdate?.(updatedTone);
    onCommit?.(updatedTone);
  };
  const handleKeyRateChange = (keyRate: number) => {
    const updatedTone = { ...tone, tva: { ...tone.tva, keyRate } };
    onUpdate?.(updatedTone);
    onCommit?.(updatedTone);
  };
  const handleVelRateChange = (velRate: number) => {
    const updatedTone = { ...tone, tva: { ...tone.tva, velRate } };
    onUpdate?.(updatedTone);
    onCommit?.(updatedTone);
  };

  const handleTvaEnvelopeChange = (envelope: SamplerEnvelope) => {
    onUpdate?.({ ...tone, tva: { ...tone.tva, envelope } });
  };
  const handleTvaEnvelopeCommit = (envelope: SamplerEnvelope) => {
    const updatedTone = { ...tone, tva: { ...tone.tva, envelope } };
    onCommit?.(updatedTone);
  };

  return (
    <section className="tones__section">
      <header className="tones__section-head">
        <h4 className="tones__section-title">Amplifier — TVA</h4>
        <span className="tones__section-eyebrow">Level · §04</span>
      </header>
      <div className="grid gap-4 md:grid-cols-4 mb-4">
        <ParamSliderRow label="Level" value={tone.tva.level} onChange={handleLevelChange} tooltip={TONE_TOOLTIPS.tvaLevel} />
        <ParamSliderRow label="LFO Depth" value={tone.tva.lfoDepth} onChange={handleLfoDepthChange} tooltip={TONE_TOOLTIPS.tvaLfoDepth} />
        <ParamSliderRow label="Key Rate" value={tone.tva.keyRate} onChange={handleKeyRateChange} tooltip={TONE_TOOLTIPS.tvaKeyRate} />
        <ParamSliderRow label="Vel Rate" value={tone.tva.velRate} onChange={handleVelRateChange} tooltip={TONE_TOOLTIPS.tvaVelRate} />
      </div>
      <Tooltip content={TONE_TOOLTIPS.tvaLevelCurve}>
        <div className="mb-4 max-w-[200px]">
          <label className="ac-field-label mb-1 block">Level Curve</label>
          <select
            value={tone.tva.levelCurve}
            onChange={(e) => {
              const updatedTone = { ...tone, tva: { ...tone.tva, levelCurve: Number(e.target.value) as SamplerLevelCurve } };
              onUpdate?.(updatedTone);
              onCommit?.(updatedTone);
            }}
            data-testid="tone-tva-curve"
            className="ac-select"
          >
            {[0, 1, 2, 3, 4, 5].map((i) => (<option key={i} value={i}>{i}</option>))}
          </select>
        </div>
      </Tooltip>
      <ToneEnvelopeEditor
        envelope={tone.tva.envelope}
        onChange={handleTvaEnvelopeChange}
        onCommit={handleTvaEnvelopeCommit}
        label="TVA"
      />
    </section>
  );
}
