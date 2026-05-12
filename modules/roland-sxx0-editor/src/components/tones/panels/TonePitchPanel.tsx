/**
 * ToneEditor — Pitch tab panel (Phase 9 Task 4 TonesPage amend).
 *
 * Pitch tracking (Transpose / Fine Tune) + key/bender/aftertouch flags.
 *
 * v3 atomic primitives:
 *   - ParameterSlider → ParamSliderRow (AcSlider + AcNumberInput editable
 *     readout, streaming writes per `feedback_live_editing_no_save`).
 *   - vanilla `<input type="checkbox">` → AcCheckbox. The `dataTestId` /
 *     `id` props land the capability-spec selectors on the `<input>`
 *     element directly.
 *
 * data-testid preservation:
 *   - tone-pitch-follow (on the AcCheckbox `<input>` via dataTestId)
 *   - id="benderEnabled" / id="aftertouchEnabled" (via AcCheckbox `id`)
 */

import type { SamplerTone } from '@/core/midi/SamplerClient';
import { AcCheckbox } from '@audiocontrol/editor-core';
import { ParamSliderRow } from '@/components/ui/ParamSliderRow';
import { Tooltip } from '@/components/ui/Tooltip';
import { TONE_TOOLTIPS } from '@/constants/tone-tooltips';

interface TonePitchPanelProps {
  tone: SamplerTone;
  onUpdate?: (tone: SamplerTone) => void;
  onCommit?: (updatedTone?: SamplerTone) => void;
}

export function TonePitchPanel({ tone, onUpdate, onCommit }: TonePitchPanelProps) {
  // Streaming writes: AcNumberInput's onChange fires per keystroke, so each
  // slider edit streams the value to the device. The single async handler
  // does the local update AND the device write (mirrors PatchEditor's
  // post-amend pattern).
  const handleTransposeChange = (transpose: number) => {
    const updatedTone = { ...tone, transpose };
    onUpdate?.(updatedTone);
    onCommit?.(updatedTone);
  };

  const handleFineTuneChange = (fineTunePlus64: number) => {
    // Slider 0..127 ↔ stored -64..+63: stored = position - 64.
    const updatedTone = { ...tone, fineTune: fineTunePlus64 - 64 };
    onUpdate?.(updatedTone);
    onCommit?.(updatedTone);
  };

  return (
    <section className="tones__section">
      <header className="tones__section-head">
        <h4 className="tones__section-title">Pitch</h4>
        <span className="tones__section-eyebrow">Tracking · §02</span>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <ParamSliderRow
          label="Transpose"
          value={tone.transpose}
          onChange={handleTransposeChange}
          tooltip={TONE_TOOLTIPS.transpose}
          min={-24}
          max={24}
          disabled
        />
        <ParamSliderRow
          label="Fine Tune"
          value={tone.fineTune + 64}
          onChange={handleFineTuneChange}
          tooltip={TONE_TOOLTIPS.fineTune}
        />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Tooltip content={TONE_TOOLTIPS.pitchFollow}>
          {/* Wrap in <div> so Radix Tooltip's ref forwarding lands on a DOM
              element. AcCheckbox is a function component without forwardRef;
              passing the ref through directly emits a React warning that
              the spec harness treats as a page error. Sibling AcCheckboxes
              below use the same pattern. */}
          <div>
            <AcCheckbox
              id="pitchFollow"
              dataTestId="tone-pitch-follow"
              checked={tone.pitchFollow}
              onChange={(checked) => {
                const updatedTone = { ...tone, pitchFollow: checked };
                onUpdate?.(updatedTone);
                onCommit?.(updatedTone);
              }}
            >
              Pitch Follow
            </AcCheckbox>
          </div>
        </Tooltip>
        <Tooltip content={TONE_TOOLTIPS.benderEnabled}>
          <div>
            <AcCheckbox
              id="benderEnabled"
              checked={tone.benderEnabled}
              onChange={(checked) => {
                const updatedTone = { ...tone, benderEnabled: checked };
                onUpdate?.(updatedTone);
                onCommit?.(updatedTone);
              }}
            >
              Pitch Bender
            </AcCheckbox>
          </div>
        </Tooltip>
        <Tooltip content={TONE_TOOLTIPS.aftertouchEnabled}>
          <div>
            <AcCheckbox
              id="aftertouchEnabled"
              checked={tone.aftertouchEnabled}
              onChange={(checked) => {
                const updatedTone = { ...tone, aftertouchEnabled: checked };
                onUpdate?.(updatedTone);
                onCommit?.(updatedTone);
              }}
            >
              Aftertouch
            </AcCheckbox>
          </div>
        </Tooltip>
      </div>
    </section>
  );
}
