/**
 * ToneEditor — Filter (TVF) tab panel.
 *
 * Per project memory `feedback_tabbed_detail_pane`, the TVF parameters
 * and the TVF envelope live in the SAME tab because they interact
 * strongly when dialing in a sound.
 *
 * v2 filter-tab compaction (design SSOT
 * `docs/1.0/001-IN-PROGRESS/roland-bugfix/explorations/04-tones-v2.html`):
 * the tab is two open section-collapsibles — "Envelope — TVF" (the
 * 8-segment envelope graphic) and "Filter Response — TVF" (the
 * `AcFilterCurveEditor` LPF curve). The numeric back-channel (the
 * parameter sliders + Filter-Enable/EG-Polarity modes) lives under a
 * collapsed-by-default "Tweak" disclosure INSIDE the Filter Response
 * section, so the default tab shows only the two graphics — both
 * above-the-fold at the default viewport (T8.10/T8.12/T8.13).
 *
 * v3 atomic primitives:
 *   - ParameterSlider → ParamSliderRow (AcSlider + AcNumberInput editable;
 *     streaming writes per `feedback_live_editing_no_save`).
 *   - Filter-Enable / EG-Polarity → AcToggle segmented controls.
 *   - EnvelopeEditor → ToneEnvelopeEditor (composes AcEnvelope; its
 *     per-segment numeric grid is itself Tweak-disclosed — T8.11).
 *
 * data-testid preservation:
 *   - tone-tvf-enabled-on / -off, tone-tvf-polarity-normal / -reverse
 *     (on the AcToggle segments)
 */

import type {
  SamplerTone, SamplerEnvelope, SamplerEgPolarity, SamplerLevelCurve,
} from '@/core/midi/SamplerClient';
import { AcToggle, AcFilterCurveEditor, AcDisclosure } from '@audiocontrol/editor-core';
import { ParamSliderRow } from '@/components/ui/ParamSliderRow';
import { ToneEnvelopeEditor } from '@/components/ui/ToneEnvelopeEditor';
import { Tooltip } from '@/components/ui/Tooltip';
import { TONE_TOOLTIPS } from '@/constants/tone-tooltips';
import {
  TONES_SECTION_DISCLOSURE_THEME,
  TONES_TWEAK_DISCLOSURE_THEME,
} from '@/constants/tones-disclosure';

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

  // The filter curve dot drags cutoff (X) and resonance (Y) together. Stream
  // both during the drag (onUpdate only — no per-frame device write), commit
  // the latest tone on mouseup. Same two-stage shape as the TVF envelope.
  const handleFilterCurveChange = (cutoff: number, resonance: number) => {
    onUpdate?.({ ...tone, tvf: { ...tvf, cutoff, resonance } });
  };
  const handleFilterCurveCommit = () => {
    onCommit?.(tone);
  };

  return (
    <section className="tones__section">
      {/* Envelope — TVF: the 8-segment envelope graphic, open by default.
          Its per-segment numeric grid is Tweak-disclosed inside
          ToneEnvelopeEditor (T8.11), so the section is compact. */}
      <AcDisclosure
        title="Envelope — TVF"
        titleAs="h4"
        defaultOpen
        theme={TONES_SECTION_DISCLOSURE_THEME}
      >
        <ToneEnvelopeEditor
          envelope={tvf.envelope}
          onChange={handleTvfEnvelopeChange}
          onCommit={handleTvfEnvelopeCommit}
          label="TVF"
          disabled={!tvf.enabled}
        />
      </AcDisclosure>

      {/* Filter Response — TVF: the LPF response curve, open by default.
          The numeric back-channel (sliders + mode toggles) hides under a
          collapsed-by-default Tweak so the curve sits above-the-fold. */}
      <AcDisclosure
        title="Filter Response — TVF"
        titleAs="h4"
        defaultOpen
        theme={TONES_SECTION_DISCLOSURE_THEME}
      >
        <AcFilterCurveEditor
          frequency={tvf.cutoff}
          resonance={tvf.resonance}
          cutoffMax={127}
          qMax={127}
          onChange={handleFilterCurveChange}
          onCommit={handleFilterCurveCommit}
          disabled={!tvf.enabled}
        />

        <AcDisclosure
          title="Tweak"
          hint="parameters · modes"
          titleAs="span"
          defaultOpen={false}
          theme={TONES_TWEAK_DISCLOSURE_THEME}
        >
          <div className="tones__param-rows">
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
              the shared compact-grid layout. */}
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
        </AcDisclosure>
      </AcDisclosure>
    </section>
  );
}
