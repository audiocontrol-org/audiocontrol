/**
 * ToneEditor — LFO tab panel (Phase 9 Task 4 TonesPage amend).
 *
 * Free-running LFO controls (rate / delay / offset) + key sync,
 * mode (display-only), peak-hold flag.
 *
 * v3 atomic primitives:
 *   - ParameterSlider → ParamSliderRow (AcSlider + AcNumberInput editable;
 *     streaming writes per `feedback_live_editing_no_save`).
 *   - vanilla `<input type="checkbox">` → AcCheckbox. The `dataTestId` /
 *     `id` props land the capability-spec selectors on the `<input>`
 *     element directly.
 *   - Mode display label → `.ac-field-label`.
 *
 * data-testid preservation:
 *   - tone-lfo-sync (on the AcCheckbox `<input>` via dataTestId)
 *   - id="lfoPolarity" (via AcCheckbox `id`)
 */

import type { SamplerTone } from '@/core/midi/SamplerClient';
import { AcCheckbox } from '@audiocontrol/editor-core';
import { ParamSliderRow } from '@/components/ui/ParamSliderRow';
import { Tooltip } from '@/components/ui/Tooltip';
import { TONE_TOOLTIPS } from '@/constants/tone-tooltips';

interface ToneLfoPanelProps {
  tone: SamplerTone;
  onUpdate?: (tone: SamplerTone) => void;
  onCommit?: (updatedTone?: SamplerTone) => void;
}

export function ToneLfoPanel({ tone, onUpdate, onCommit }: ToneLfoPanelProps) {
  const lfo = tone.lfo;
  const updateLfo = (next: Partial<typeof lfo>) => {
    const updatedTone = { ...tone, lfo: { ...lfo, ...next } };
    onUpdate?.(updatedTone);
    onCommit?.(updatedTone);
  };

  return (
    <section className="tones__section">
      <header className="tones__section-head">
        <h4 className="tones__section-title">LFO</h4>
        <span className="tones__section-eyebrow">Modulation · §05</span>
      </header>
      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <ParamSliderRow label="Rate" value={lfo.rate} onChange={(rate) => updateLfo({ rate })} tooltip={TONE_TOOLTIPS.lfoRate} />
        <ParamSliderRow label="Delay" value={lfo.delay} onChange={(delay) => updateLfo({ delay })} tooltip={TONE_TOOLTIPS.lfoDelay} />
        <ParamSliderRow label="Offset" value={lfo.offset} onChange={(offset) => updateLfo({ offset })} tooltip={TONE_TOOLTIPS.lfoOffset} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Tooltip content={TONE_TOOLTIPS.lfoSync}>
          {/* Wrap in <div> so Radix Tooltip's ref forwarding lands on a DOM
              element. AcCheckbox is a function component without
              forwardRef; matches the sibling AcCheckbox below. */}
          <div>
            <AcCheckbox
              id="lfoSync"
              dataTestId="tone-lfo-sync"
              checked={lfo.sync}
              onChange={(checked) => updateLfo({ sync: checked })}
            >
              Key Sync
            </AcCheckbox>
          </div>
        </Tooltip>
        <Tooltip content={TONE_TOOLTIPS.lfoMode}>
          <div>
            <label className="ac-field-label">Mode</label>
            <div className="text-sm text-s330-text capitalize">{lfo.mode}</div>
          </div>
        </Tooltip>
        <Tooltip content={TONE_TOOLTIPS.lfoPeakHold}>
          <div>
            <AcCheckbox
              id="lfoPolarity"
              checked={lfo.polarity}
              onChange={(checked) => updateLfo({ polarity: checked })}
            >
              Peak Hold
            </AcCheckbox>
          </div>
        </Tooltip>
      </div>
    </section>
  );
}
