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
 * #408 Phase B adds the Env Zoom slider (D-TONE-ADV-06) directly above
 * the envelope viewport it affects — `tone.envZoom` is stored per-tone
 * and controls the device's CRT envelope-display zoom level (0..7).
 *
 * data-testid preservation:
 *   - tone-tva-curve (Level Curve select)
 *   - param-env-zoom (ParamSliderRow via labelToTestId('Env Zoom'))
 */

import type { SamplerTone, SamplerEnvelope, SamplerLevelCurve } from '@/core/midi/SamplerClient';
import { ParamSliderRow } from '@/components/ui/ParamSliderRow';
import { ToneEnvelopeEditor } from '@/components/ui/ToneEnvelopeEditor';
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

  const handleEnvZoomChange = (envZoom: number) => {
    const updatedTone = { ...tone, envZoom };
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

  const handleLevelCurveChange = (levelCurve: number) => {
    const updatedTone = { ...tone, tva: { ...tone.tva, levelCurve: levelCurve as SamplerLevelCurve } };
    onUpdate?.(updatedTone);
    onCommit?.(updatedTone);
  };

  return (
    <section className="tones__section">
      {/* No section header — duplicates the active AMP tab. */}
      <div className="ac-param-rows">
        <ParamSliderRow label="Level" value={tone.tva.level} onChange={handleLevelChange} tooltip={TONE_TOOLTIPS.tvaLevel} />
        <ParamSliderRow label="LFO Depth" value={tone.tva.lfoDepth} onChange={handleLfoDepthChange} tooltip={TONE_TOOLTIPS.tvaLfoDepth} />
        <ParamSliderRow label="Key Rate" value={tone.tva.keyRate} onChange={handleKeyRateChange} tooltip={TONE_TOOLTIPS.tvaKeyRate} />
        <ParamSliderRow label="Vel Rate" value={tone.tva.velRate} onChange={handleVelRateChange} tooltip={TONE_TOOLTIPS.tvaVelRate} />
        <ParamSliderRow label="Level Curve" value={tone.tva.levelCurve} min={0} max={5} onChange={handleLevelCurveChange} tooltip={TONE_TOOLTIPS.tvaLevelCurve} />
        <ParamSliderRow label="Env Zoom" value={tone.envZoom} min={0} max={7} onChange={handleEnvZoomChange} tooltip={TONE_TOOLTIPS.envZoom} />
      </div>
      <ToneEnvelopeEditor
        envelope={tone.tva.envelope}
        onChange={handleTvaEnvelopeChange}
        onCommit={handleTvaEnvelopeCommit}
        label="TVA"
      />
    </section>
  );
}
