/**
 * ToneEditor — LFO tab panel (Phase 9 Task 4 polish).
 *
 * Free-running LFO controls (rate / delay / offset) + key sync,
 * mode, peak-hold flags.
 *
 * data-testid preservation:
 *   - tone-lfo-sync
 */

import type { SamplerTone } from '@/core/midi/SamplerClient';
import { formatPercent } from '@audiocontrol/editor-core';
import { ParameterSlider } from '@/components/ui/ParameterSlider';
import { Tooltip } from '@/components/ui/Tooltip';
import { TONE_TOOLTIPS } from '@/constants/tone-tooltips';

interface ToneLfoPanelProps {
  tone: SamplerTone;
  onUpdate?: (tone: SamplerTone) => void;
  onCommit?: (updatedTone?: SamplerTone) => void;
}

export function ToneLfoPanel({ tone, onUpdate, onCommit }: ToneLfoPanelProps) {
  return (
    <section className="tones__section">
      <header className="tones__section-head">
        <h4 className="tones__section-title">LFO</h4>
        <span className="tones__section-eyebrow">Modulation · §05</span>
      </header>
      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <ParameterSlider label="Rate" value={tone.lfo.rate} onChange={(v) => onUpdate?.({ ...tone, lfo: { ...tone.lfo, rate: v } })} onCommit={onCommit} formatValue={formatPercent} tooltip={TONE_TOOLTIPS.lfoRate} />
        <ParameterSlider label="Delay" value={tone.lfo.delay} onChange={(v) => onUpdate?.({ ...tone, lfo: { ...tone.lfo, delay: v } })} onCommit={onCommit} formatValue={formatPercent} tooltip={TONE_TOOLTIPS.lfoDelay} />
        <ParameterSlider label="Offset" value={tone.lfo.offset} onChange={(v) => onUpdate?.({ ...tone, lfo: { ...tone.lfo, offset: v } })} onCommit={onCommit} formatValue={formatPercent} tooltip={TONE_TOOLTIPS.lfoOffset} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Tooltip content={TONE_TOOLTIPS.lfoSync}>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="lfoSync"
              checked={tone.lfo.sync}
              data-testid="tone-lfo-sync"
              onChange={(e) => {
                const updatedTone = { ...tone, lfo: { ...tone.lfo, sync: e.target.checked } };
                onUpdate?.(updatedTone);
                onCommit?.(updatedTone);
              }}
              className="rounded"
            />
            <label htmlFor="lfoSync" className="text-sm text-s330-text">Key Sync</label>
          </div>
        </Tooltip>
        <Tooltip content={TONE_TOOLTIPS.lfoMode}>
          <div>
            <label className="text-xs text-s330-muted">Mode</label>
            <div className="text-sm text-s330-text capitalize">{tone.lfo.mode}</div>
          </div>
        </Tooltip>
        <Tooltip content={TONE_TOOLTIPS.lfoPeakHold}>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="lfoPolarity"
              checked={tone.lfo.polarity}
              onChange={(e) => {
                const updatedTone = { ...tone, lfo: { ...tone.lfo, polarity: e.target.checked } };
                onUpdate?.(updatedTone);
                onCommit?.(updatedTone);
              }}
              className="rounded"
            />
            <label htmlFor="lfoPolarity" className="text-sm text-s330-text">Peak Hold</label>
          </div>
        </Tooltip>
      </div>
    </section>
  );
}
