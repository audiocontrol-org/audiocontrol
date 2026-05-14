/**
 * ToneEditor — Wave tab panel (Phase 9 Task 4 TonesPage amend).
 *
 * Wave-source params (Original Key / Sample Rate / Loop Mode / Output / Bank)
 * + wave-memory segment controls (Segment Top / Segment Length)
 * + sample wave-address controls (Start / Loop Point / End / Loop Tune)
 * + the visual loop editor (when sample data is available).
 *
 * v3 atomic primitives:
 *   - vanilla `<input type="number">` -> `.ac-input` (Original Key, Start,
 *     Loop Point, End).
 *   - vanilla `<select>` -> `.ac-select` (Loop Mode, Output, Bank).
 *   - ParamSliderRow for Segment Top / Segment Length / Loop Tune (#408
 *     Phase B — D-TONE-WAVE-10/11, D-TONE-ADV-05).
 *   - all field labels -> `.ac-field-label`.
 *
 * Bank options come from the device-config registry (`waveBankLabels` on the
 * active tone group). S-330 yields A/B; S-550 yields A/B/C/D. The select
 * never branches on device type — it iterates the registry-supplied labels.
 *
 * data-testid preservation:
 *   - tone-original-key, tone-loop-mode, tone-output
 *   - tone-wave-bank (new; #408 Phase B — D-TONE-WAVE-09)
 *   - ParamSliderRow rows expose data-testid via labelToTestId(label):
 *     `param-segment-top`, `param-segment-length`, `param-loop-tune`.
 *
 * The Start / Loop Point / End inputs are targeted by spec helpers via
 * adjacent `<label>` text (see `fillLabeledNumber` in tone-writes-
 * helpers.ts); the .ac-field-label class doesn't change the `<label>+ <input>`
 * adjacency the helper relies on.
 */

import type { SamplerTone } from '@/core/midi/SamplerClient';
import { midiNoteToName } from '@/lib/utils';
import { Tooltip } from '@/components/ui/Tooltip';
import { ParamSliderRow } from '@/components/ui/ParamSliderRow';
import { TONE_TOOLTIPS } from '@/constants/tone-tooltips';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { LoopEditor } from '@audiocontrol/loop-editor/ui';
import type { LoopEditorProps } from '@audiocontrol/loop-editor/ui';

interface ToneWavePanelProps {
  tone: SamplerTone;
  toneIndex: number;
  onUpdate?: (tone: SamplerTone) => void;
  onCommit?: (updatedTone?: SamplerTone) => void;
  waveData?: Int16Array | null;
  isLoadingWaveData?: boolean;
  waveDataLoadProgress?: number;
  onLoadWaveData?: () => void;
  loopEditorProps?: LoopEditorProps;
}

export function ToneWavePanel({
  tone,
  toneIndex,
  onUpdate,
  onCommit,
  waveData,
  isLoadingWaveData = false,
  waveDataLoadProgress,
  onLoadWaveData,
  loopEditorProps,
}: ToneWavePanelProps) {
  const hasSampleData = tone.wave.endPoint > tone.wave.startPoint;
  const { memoryLayout } = useDeviceConfig();
  const { labels: waveBankLabels, indices: waveBankIndices } =
    memoryLayout.getWaveBanksForTone(toneIndex);

  const handleBankChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const updatedTone: SamplerTone = {
      ...tone,
      wave: { ...tone.wave, bank: parseInt(e.target.value, 10) },
    };
    onUpdate?.(updatedTone);
    onCommit?.(updatedTone);
  };

  const handleSegmentTopChange = (segmentTop: number): void => {
    const updatedTone: SamplerTone = {
      ...tone,
      wave: { ...tone.wave, segmentTop },
    };
    onUpdate?.(updatedTone);
    onCommit?.(updatedTone);
  };

  const handleSegmentLengthChange = (segmentLength: number): void => {
    const updatedTone: SamplerTone = {
      ...tone,
      wave: { ...tone.wave, segmentLength },
    };
    onUpdate?.(updatedTone);
    onCommit?.(updatedTone);
  };

  const handleLoopTuneChange = (loopTune: number): void => {
    const updatedTone: SamplerTone = { ...tone, loopTune };
    onUpdate?.(updatedTone);
    onCommit?.(updatedTone);
  };

  return (
    <div className="tones__panel-stack">
      <section className="tones__section">
        <header className="tones__section-head">
          <h4 className="tones__section-title">Wave</h4>
          <span className="tones__section-eyebrow">Source · §01</span>
        </header>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Tooltip content={TONE_TOOLTIPS.originalKey}>
            <div>
              <label className="ac-field-label">Original Key</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={127}
                  value={tone.originalKey}
                  onChange={(e) => {
                    const updatedTone = { ...tone, originalKey: Math.max(0, Math.min(127, parseInt(e.target.value) || 0)) };
                    onUpdate?.(updatedTone);
                    onCommit?.(updatedTone);
                  }}
                  data-testid="tone-original-key"
                  className="ac-input w-16 font-mono"
                />
                <span className="text-sm text-s330-muted">{midiNoteToName(tone.originalKey)}</span>
              </div>
            </div>
          </Tooltip>
          <Tooltip content={TONE_TOOLTIPS.sampleRate}>
            <div>
              <label className="ac-field-label">Sample Rate</label>
              <div className="text-sm text-s330-text">{tone.sampleRate}</div>
            </div>
          </Tooltip>
          <Tooltip content={TONE_TOOLTIPS.loopMode}>
            <div>
              <label className="ac-field-label">Loop Mode</label>
              <select
                value={tone.loopMode}
                onChange={(e) => {
                  const updatedTone = { ...tone, loopMode: e.target.value as SamplerTone['loopMode'] };
                  onUpdate?.(updatedTone);
                  onCommit?.(updatedTone);
                }}
                data-testid="tone-loop-mode"
                className="ac-select"
              >
                <option value="forward">Forward</option>
                <option value="alternating">Alternating</option>
                <option value="one-shot">One-Shot</option>
                <option value="reverse">Reverse</option>
              </select>
            </div>
          </Tooltip>
          <Tooltip content={TONE_TOOLTIPS.outputAssign}>
            <div>
              <label className="ac-field-label">Output</label>
              <select
                value={tone.outputAssign}
                onChange={(e) => {
                  const updatedTone = { ...tone, outputAssign: parseInt(e.target.value) };
                  onUpdate?.(updatedTone);
                  onCommit?.(updatedTone);
                }}
                data-testid="tone-output"
                className="ac-select"
              >
                <option value={0}>Mix</option>
                <option value={1}>Out 1</option>
                <option value={2}>Out 2</option>
                <option value={3}>Out 3</option>
                <option value={4}>Out 4</option>
                <option value={5}>Out 5</option>
                <option value={6}>Out 6</option>
                <option value={7}>Out 7</option>
                <option value={8}>Out 8</option>
              </select>
            </div>
          </Tooltip>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3 lg:grid-cols-3">
          <Tooltip content={TONE_TOOLTIPS.waveBank}>
            <div>
              <label className="ac-field-label">Bank</label>
              <select
                value={tone.wave.bank}
                onChange={handleBankChange}
                data-testid="tone-wave-bank"
                className="ac-select"
              >
                {waveBankIndices.map((bankIndex, i) => (
                  <option key={bankIndex} value={bankIndex}>
                    {waveBankLabels[i]}
                  </option>
                ))}
              </select>
            </div>
          </Tooltip>
          <ParamSliderRow
            label="Segment Top"
            value={tone.wave.segmentTop}
            min={0}
            max={17}
            onChange={handleSegmentTopChange}
            tooltip={TONE_TOOLTIPS.waveSegmentTop}
          />
          <ParamSliderRow
            label="Segment Length"
            value={tone.wave.segmentLength}
            min={0}
            max={18}
            onChange={handleSegmentLengthChange}
            tooltip={TONE_TOOLTIPS.waveSegmentLength}
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-4 text-xs">
          <Tooltip content={TONE_TOOLTIPS.waveStart}>
            <div>
              <label className="ac-field-label">Start</label>
              <input
                type="number"
                min={0}
                max={0x221180}
                value={tone.wave.startPoint}
                onChange={(e) => {
                  const updatedTone = { ...tone, wave: { ...tone.wave, startPoint: Math.max(0, parseInt(e.target.value) || 0) } };
                  onUpdate?.(updatedTone);
                  onCommit?.(updatedTone);
                }}
                className="ac-input font-mono"
              />
            </div>
          </Tooltip>
          <Tooltip content={TONE_TOOLTIPS.waveLoop}>
            <div>
              <label className="ac-field-label">Loop Point</label>
              <input
                type="number"
                min={0}
                max={0x221184}
                value={tone.wave.loopPoint}
                onChange={(e) => {
                  const updatedTone = { ...tone, wave: { ...tone.wave, loopPoint: Math.max(0, parseInt(e.target.value) || 0) } };
                  onUpdate?.(updatedTone);
                  onCommit?.(updatedTone);
                }}
                className="ac-input font-mono"
              />
            </div>
          </Tooltip>
          <Tooltip content={TONE_TOOLTIPS.waveEnd}>
            <div>
              <label className="ac-field-label">End</label>
              <input
                type="number"
                min={4}
                max={0x221184}
                value={tone.wave.endPoint}
                onChange={(e) => {
                  const updatedTone = { ...tone, wave: { ...tone.wave, endPoint: Math.max(4, parseInt(e.target.value) || 4) } };
                  onUpdate?.(updatedTone);
                  onCommit?.(updatedTone);
                }}
                className="ac-input font-mono"
              />
            </div>
          </Tooltip>
          <ParamSliderRow
            label="Loop Tune"
            value={tone.loopTune}
            min={-127}
            max={127}
            onChange={handleLoopTuneChange}
            tooltip={TONE_TOOLTIPS.loopTune}
          />
        </div>
      </section>

      {hasSampleData && (
        <section className="tones__section">
          <header className="tones__section-head">
            <h4 className="tones__section-title">Loop Editor</h4>
            <span className="tones__section-eyebrow">Sample · §02</span>
          </header>
          <div className="space-y-2">
            {!waveData && !isLoadingWaveData && onLoadWaveData && (
              <div className="card text-center py-4">
                <p className="text-s330-muted text-sm mb-2">
                  Load wave data to use the visual loop editor
                </p>
                <button
                  onClick={onLoadWaveData}
                  className="ac-btn ac-btn-sm ac-btn-secondary"
                >
                  Load Wave Data
                </button>
              </div>
            )}
            {loopEditorProps && (
              <LoopEditor
                {...loopEditorProps}
                isLoading={isLoadingWaveData}
                loadingProgress={waveDataLoadProgress}
                onCommit={onCommit}
              />
            )}
          </div>
        </section>
      )}
    </div>
  );
}
