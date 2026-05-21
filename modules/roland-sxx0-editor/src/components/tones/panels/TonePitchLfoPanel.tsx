/**
 * ToneEditor — merged Pitch & LFO tab panel.
 *
 * Pitch-tracking parameters (Transpose / Fine Tune) + pitch-modulation
 * flags (Pitch Follow / Pitch Bender / Aftertouch) + the LFO that
 * drives pitch modulation (Rate / Delay / Offset + Key Sync / Mode /
 * Peak Hold). The two halves live in the same tab because LFO output
 * IS pitch modulation; toggling between them in separate tabs forces
 * the operator to context-switch for a single conceptual edit.
 *
 * Toggles instead of checkboxes for every binary parameter; AcToggle
 * with per-option dataTestId so wiring specs target a specific value.
 *
 * data-testid preservation (per-toggle option for spec compatibility):
 *   - tone-pitch-follow-{on,off}
 *   - tone-pitch-bender-{on,off}
 *   - tone-pitch-aftertouch-{on,off}
 *   - tone-lfo-sync-{on,off}
 *   - tone-lfo-mode-{normal,one-shot}
 *   - tone-lfo-peak-hold-{on,off}
 */

import type { SamplerTone } from '@/core/midi/SamplerClient';
import { AcToggle } from '@audiocontrol/editor-core';
import { ParamSliderRow } from '@/components/ui/ParamSliderRow';
import { Tooltip } from '@/components/ui/Tooltip';
import { TONE_TOOLTIPS } from '@/constants/tone-tooltips';

type LfoMode = SamplerTone['lfo']['mode'];

const ON_OFF_OPTIONS_FACTORY = (idBase: string) => [
  { value: 'on' as const,  label: 'On',  dataTestId: `${idBase}-on` },
  { value: 'off' as const, label: 'Off', dataTestId: `${idBase}-off` },
];

const PITCH_FOLLOW_OPTIONS = ON_OFF_OPTIONS_FACTORY('tone-pitch-follow') as ReadonlyArray<{
  value: 'on' | 'off';
  label: string;
  dataTestId: string;
}>;
const PITCH_BENDER_OPTIONS = ON_OFF_OPTIONS_FACTORY('tone-pitch-bender') as ReadonlyArray<{
  value: 'on' | 'off';
  label: string;
  dataTestId: string;
}>;
const AFTERTOUCH_OPTIONS = ON_OFF_OPTIONS_FACTORY('tone-pitch-aftertouch') as ReadonlyArray<{
  value: 'on' | 'off';
  label: string;
  dataTestId: string;
}>;
const LFO_SYNC_OPTIONS = ON_OFF_OPTIONS_FACTORY('tone-lfo-sync') as ReadonlyArray<{
  value: 'on' | 'off';
  label: string;
  dataTestId: string;
}>;
const LFO_PEAK_HOLD_OPTIONS = ON_OFF_OPTIONS_FACTORY('tone-lfo-peak-hold') as ReadonlyArray<{
  value: 'on' | 'off';
  label: string;
  dataTestId: string;
}>;

const LFO_MODE_OPTIONS = [
  { value: 'normal' as const,    label: 'Normal',   dataTestId: 'tone-lfo-mode-normal' },
  { value: 'one-shot' as const,  label: 'One-Shot', dataTestId: 'tone-lfo-mode-one-shot' },
] as const;

interface Props {
  tone: SamplerTone;
  onUpdate?: (tone: SamplerTone) => void;
  onCommit?: (updatedTone?: SamplerTone) => void;
}

export function TonePitchLfoPanel({ tone, onUpdate, onCommit }: Props): JSX.Element {
  const lfo = tone.lfo;

  const commit = (next: SamplerTone): void => {
    onUpdate?.(next);
    onCommit?.(next);
  };

  // ---- Pitch handlers ---------------------------------------------
  const handleTransposeChange = (transpose: number) => commit({ ...tone, transpose });
  // Slider 0..127 ↔ stored -64..+63: stored = position - 64.
  const handleFineTuneChange = (fineTunePlus64: number) =>
    commit({ ...tone, fineTune: fineTunePlus64 - 64 });
  const handlePitchFollowChange = (v: string) =>
    commit({ ...tone, pitchFollow: v === 'on' });
  const handleBenderChange = (v: string) =>
    commit({ ...tone, benderEnabled: v === 'on' });
  const handleAftertouchChange = (v: string) =>
    commit({ ...tone, aftertouchEnabled: v === 'on' });

  // ---- LFO handlers -----------------------------------------------
  const updateLfo = (next: Partial<typeof lfo>) =>
    commit({ ...tone, lfo: { ...lfo, ...next } });
  const handleRateChange = (rate: number) => updateLfo({ rate });
  const handleDelayChange = (delay: number) => updateLfo({ delay });
  const handleOffsetChange = (offset: number) => updateLfo({ offset });
  const handleLfoSyncChange = (v: string) => updateLfo({ sync: v === 'on' });
  const handleLfoModeChange = (v: string) => updateLfo({ mode: v as LfoMode });
  const handlePeakHoldChange = (v: string) => updateLfo({ polarity: v === 'on' });

  return (
    <section className="tones__section">
      {/* PITCH subsection ------------------------------------------- */}
      <header className="tones__subsection-head">
        <span>Pitch</span>
      </header>

      <div className="tones__param-rows">
        <ParamSliderRow
          label="Transpose"
          value={tone.transpose}
          min={-24}
          max={24}
          onChange={handleTransposeChange}
          tooltip={TONE_TOOLTIPS.transpose}
          disabled
        />
        <ParamSliderRow
          label="Fine Tune"
          value={tone.fineTune + 64}
          onChange={handleFineTuneChange}
          tooltip={TONE_TOOLTIPS.fineTune}
        />
      </div>

      <div className="ac-compact-grid">
        <Tooltip content={TONE_TOOLTIPS.pitchFollow}>
          <div className="ac-compact-field">
            <span className="ac-field-label">Pitch Follow</span>
            <AcToggle
              value={tone.pitchFollow ? 'on' : 'off'}
              options={PITCH_FOLLOW_OPTIONS}
              onChange={handlePitchFollowChange}
              ariaLabel="Pitch Follow"
              name="tone-pitch-follow"
            />
          </div>
        </Tooltip>
        <Tooltip content={TONE_TOOLTIPS.benderEnabled}>
          <div className="ac-compact-field">
            <span className="ac-field-label">Pitch Bender</span>
            <AcToggle
              value={tone.benderEnabled ? 'on' : 'off'}
              options={PITCH_BENDER_OPTIONS}
              onChange={handleBenderChange}
              ariaLabel="Pitch Bender"
              name="tone-pitch-bender"
            />
          </div>
        </Tooltip>
        <Tooltip content={TONE_TOOLTIPS.aftertouchEnabled}>
          <div className="ac-compact-field">
            <span className="ac-field-label">Aftertouch</span>
            <AcToggle
              value={tone.aftertouchEnabled ? 'on' : 'off'}
              options={AFTERTOUCH_OPTIONS}
              onChange={handleAftertouchChange}
              ariaLabel="Aftertouch"
              name="tone-pitch-aftertouch"
            />
          </div>
        </Tooltip>
      </div>

      {/* LFO subsection -------------------------------------------- */}
      <header className="tones__subsection-head">
        <span>LFO</span>
      </header>

      {/* Full-width slider stack rather than the multi-column param-
          rows grid — the LFO sliders need every pixel of horizontal
          resolution we can give them so the operator can dial in
          subtle rate / delay / offset values without overshooting. */}
      <div className="tones__slider-stack">
        <ParamSliderRow label="Rate"   value={lfo.rate}   onChange={handleRateChange}   tooltip={TONE_TOOLTIPS.lfoRate} />
        <ParamSliderRow label="Delay"  value={lfo.delay}  onChange={handleDelayChange}  tooltip={TONE_TOOLTIPS.lfoDelay} />
        <ParamSliderRow label="Offset" value={lfo.offset} onChange={handleOffsetChange} tooltip={TONE_TOOLTIPS.lfoOffset} />
      </div>

      <div className="ac-compact-grid">
        <Tooltip content={TONE_TOOLTIPS.lfoSync}>
          <div className="ac-compact-field">
            <span className="ac-field-label">Key Sync</span>
            <AcToggle
              value={lfo.sync ? 'on' : 'off'}
              options={LFO_SYNC_OPTIONS}
              onChange={handleLfoSyncChange}
              ariaLabel="Key Sync"
              name="tone-lfo-sync"
            />
          </div>
        </Tooltip>
        <Tooltip content={TONE_TOOLTIPS.lfoMode}>
          <div className="ac-compact-field">
            <span className="ac-field-label">Mode</span>
            <AcToggle
              value={lfo.mode}
              options={LFO_MODE_OPTIONS}
              onChange={handleLfoModeChange}
              ariaLabel="LFO Mode"
              name="tone-lfo-mode"
            />
          </div>
        </Tooltip>
        <Tooltip content={TONE_TOOLTIPS.lfoPeakHold}>
          <div className="ac-compact-field">
            <span className="ac-field-label">Peak Hold</span>
            <AcToggle
              value={lfo.polarity ? 'on' : 'off'}
              options={LFO_PEAK_HOLD_OPTIONS}
              onChange={handlePeakHoldChange}
              ariaLabel="Peak Hold"
              name="tone-lfo-peak-hold"
            />
          </div>
        </Tooltip>
      </div>
    </section>
  );
}
