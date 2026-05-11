/**
 * ToneEditor — Pitch tab panel (Phase 9 Task 4 polish).
 *
 * Pitch tracking (Transpose / Fine Tune) + key/bender/aftertouch flags.
 *
 * data-testid preservation:
 *   - tone-pitch-follow
 */

import type { SamplerTone } from '@/core/midi/SamplerClient';
import { ParameterSlider } from '@/components/ui/ParameterSlider';
import { Tooltip } from '@/components/ui/Tooltip';
import { TONE_TOOLTIPS } from '@/constants/tone-tooltips';

interface TonePitchPanelProps {
  tone: SamplerTone;
  onUpdate?: (tone: SamplerTone) => void;
  onCommit?: (updatedTone?: SamplerTone) => void;
}

export function TonePitchPanel({ tone, onUpdate, onCommit }: TonePitchPanelProps) {
  return (
    <section className="tones__section">
      <header className="tones__section-head">
        <h4 className="tones__section-title">Pitch</h4>
        <span className="tones__section-eyebrow">Tracking · §02</span>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <ParameterSlider
          label="Transpose"
          value={tone.transpose}
          onChange={(v) => onUpdate?.({ ...tone, transpose: v })}
          onCommit={onCommit}
          min={-24}
          max={24}
          formatValue={(v) => `${v} semitones`}
          disabled
          tooltip={TONE_TOOLTIPS.transpose}
        />
        <ParameterSlider
          label="Fine Tune"
          value={tone.fineTune + 64}
          onChange={(v) => onUpdate?.({ ...tone, fineTune: v - 64 })}
          onCommit={onCommit}
          min={0}
          max={127}
          formatValue={(v) => `${v - 64} cents`}
          tooltip={TONE_TOOLTIPS.fineTune}
        />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Tooltip content={TONE_TOOLTIPS.pitchFollow}>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="pitchFollow"
              checked={tone.pitchFollow}
              data-testid="tone-pitch-follow"
              onChange={(e) => {
                const updatedTone = { ...tone, pitchFollow: e.target.checked };
                onUpdate?.(updatedTone);
                onCommit?.(updatedTone);
              }}
              className="rounded"
            />
            <label htmlFor="pitchFollow" className="text-sm text-s330-text">Pitch Follow</label>
          </div>
        </Tooltip>
        <Tooltip content={TONE_TOOLTIPS.benderEnabled}>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="benderEnabled"
              checked={tone.benderEnabled}
              onChange={(e) => {
                const updatedTone = { ...tone, benderEnabled: e.target.checked };
                onUpdate?.(updatedTone);
                onCommit?.(updatedTone);
              }}
              className="rounded"
            />
            <label htmlFor="benderEnabled" className="text-sm text-s330-text">Pitch Bender</label>
          </div>
        </Tooltip>
        <Tooltip content={TONE_TOOLTIPS.aftertouchEnabled}>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="aftertouchEnabled"
              checked={tone.aftertouchEnabled}
              onChange={(e) => {
                const updatedTone = { ...tone, aftertouchEnabled: e.target.checked };
                onUpdate?.(updatedTone);
                onCommit?.(updatedTone);
              }}
              className="rounded"
            />
            <label htmlFor="aftertouchEnabled" className="text-sm text-s330-text">Aftertouch</label>
          </div>
        </Tooltip>
      </div>
    </section>
  );
}
