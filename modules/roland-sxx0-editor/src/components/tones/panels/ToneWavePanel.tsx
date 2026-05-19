/**
 * ToneEditor — Wave tab panel.
 *
 * Three sub-sections:
 *   - SOURCE — identity + playback config. Original Key (slider), Sample
 *     Rate (display), Bank (toggle), Loop Mode (toggle), Output (toggle).
 *   - WAVE REGION — Start / Loop Point / End wave-memory addresses.
 *   - SEGMENT — Segment Top / Length / Loop Tune sliders.
 *
 * Operator-visible enums (Bank / Loop Mode / Output) render as
 * AcToggle segmented controls rather than dropdowns so the operator
 * can see all options at a glance and pick one without opening a menu.
 * Output's 9 positions (Mix + Out 1..8) is at the practical upper
 * bound of segmented-control width; if it ever grows beyond 9, fall
 * back to AcSlider with discrete steps.
 *
 * Per-option `dataTestId` on every toggle so wiring specs can target
 * a specific value via `tone-<field>-<value>` instead of selectOption().
 */

import { type SamplerTone, toneHasWaveData } from '@/core/midi/SamplerClient';

type SamplerLoopMode = SamplerTone['loopMode'];
import { midiNoteToName } from '@/lib/utils';
import { AcToggle } from '@audiocontrol/editor-core';
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

const SEGMENTS_PER_BANK = 18;

/**
 * 18-cell strip showing which segments of the wave bank this tone
 * occupies. Cells in [segmentTop, segmentTop + segmentLength) are lit
 * in the accent color; the first and last cells of the range pick up
 * an extra-bright border to mark the boundaries.
 *
 * Read-only for now; the segmentTop/segmentLength sliders below remain
 * the precise edit affordance. Future iteration could add drag-to-
 * resize directly on the strip endpoints.
 */
function WaveSegmentRange({
  segmentTop,
  segmentLength,
}: {
  segmentTop: number;
  segmentLength: number;
}): JSX.Element {
  const rangeStart = Math.max(0, Math.min(SEGMENTS_PER_BANK - 1, segmentTop));
  const rangeEndExcl = Math.max(
    rangeStart,
    Math.min(SEGMENTS_PER_BANK, rangeStart + segmentLength),
  );
  const lastIdx = rangeEndExcl - 1;

  const cellState = (i: number): 'idle' | 'in-range' | 'boundary' => {
    if (i < rangeStart || i >= rangeEndExcl) return 'idle';
    if (i === rangeStart || i === lastIdx) return 'boundary';
    return 'in-range';
  };

  return (
    <div className="tones__segment-strip" role="img"
         aria-label={`Wave bank segments ${rangeStart}..${lastIdx} (${segmentLength} segments)`}>
      <span className="ac-field-label">Segments</span>
      <div className="tones__segment-strip-cells" aria-hidden="true">
        {Array.from({ length: SEGMENTS_PER_BANK }, (_, i) => (
          <div
            key={i}
            className="tones__segment-strip-cell"
            data-state={cellState(i)}
            data-index={i}
            title={`Segment ${i}`}
          />
        ))}
      </div>
      <span className="tones__segment-strip-readout">
        {segmentLength > 0 ? (
          <>
            <strong>{rangeStart}</strong>
            <span className="tones__segment-strip-sep">→</span>
            <strong>{lastIdx}</strong>
          </>
        ) : (
          <strong>—</strong>
        )}
      </span>
    </div>
  );
}

const LOOP_MODE_OPTIONS = [
  { value: 'forward' as const,     label: 'FWD', dataTestId: 'tone-loop-mode-forward' },
  { value: 'alternating' as const, label: 'ALT', dataTestId: 'tone-loop-mode-alternating' },
  { value: 'one-shot' as const,    label: 'ONE', dataTestId: 'tone-loop-mode-one-shot' },
  { value: 'reverse' as const,     label: 'REV', dataTestId: 'tone-loop-mode-reverse' },
] as const;

const OUTPUT_OPTIONS = [
  { value: '0', label: 'MIX', dataTestId: 'tone-output-0' },
  { value: '1', label: '1',   dataTestId: 'tone-output-1' },
  { value: '2', label: '2',   dataTestId: 'tone-output-2' },
  { value: '3', label: '3',   dataTestId: 'tone-output-3' },
  { value: '4', label: '4',   dataTestId: 'tone-output-4' },
  { value: '5', label: '5',   dataTestId: 'tone-output-5' },
  { value: '6', label: '6',   dataTestId: 'tone-output-6' },
  { value: '7', label: '7',   dataTestId: 'tone-output-7' },
  { value: '8', label: '8',   dataTestId: 'tone-output-8' },
] as const;

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
  const hasSampleData = toneHasWaveData(tone);
  const { memoryLayout } = useDeviceConfig();
  const { labels: waveBankLabels, indices: waveBankIndices } =
    memoryLayout.getWaveBanksForTone(toneIndex);

  const bankOptions = waveBankIndices.map((bankIndex, i) => ({
    value: String(bankIndex),
    label: waveBankLabels[i],
    dataTestId: `tone-wave-bank-${bankIndex}`,
  }));

  const commit = (next: SamplerTone): void => {
    onUpdate?.(next);
    onCommit?.(next);
  };

  const handleOriginalKeyChange = (originalKey: number): void => {
    commit({ ...tone, originalKey });
  };

  const handleBankChange = (value: string): void => {
    commit({ ...tone, wave: { ...tone.wave, bank: parseInt(value, 10) } });
  };

  const handleLoopModeChange = (value: SamplerLoopMode): void => {
    commit({ ...tone, loopMode: value });
  };

  const handleOutputChange = (value: string): void => {
    commit({ ...tone, outputAssign: parseInt(value, 10) });
  };

  const handleStartChange = (raw: number): void => {
    commit({ ...tone, wave: { ...tone.wave, startPoint: Math.max(0, raw) } });
  };

  const handleLoopPointChange = (raw: number): void => {
    commit({ ...tone, wave: { ...tone.wave, loopPoint: Math.max(0, raw) } });
  };

  const handleEndChange = (raw: number): void => {
    commit({ ...tone, wave: { ...tone.wave, endPoint: Math.max(4, raw) } });
  };

  const handleSegmentTopChange = (segmentTop: number): void => {
    commit({ ...tone, wave: { ...tone.wave, segmentTop } });
  };

  const handleSegmentLengthChange = (segmentLength: number): void => {
    commit({ ...tone, wave: { ...tone.wave, segmentLength } });
  };

  const handleLoopTuneChange = (loopTune: number): void => {
    commit({ ...tone, loopTune });
  };

  return (
    <div className="tones__panel-stack">
      {/* ============ SOURCE ============ */}
      <section className="tones__subsection">
        <header className="tones__subsection-head">
          <span>Source</span>
        </header>

        {/* Original Key wants horizontal space (slider over 0..127), so
            it owns its own row. */}
        <ParamSliderRow
          label="Original Key"
          value={tone.originalKey}
          min={0}
          max={127}
          onChange={handleOriginalKeyChange}
          tooltip={TONE_TOOLTIPS.originalKey}
          unit={midiNoteToName(tone.originalKey)}
        />

        {/* Compact toggles + readout flow horizontally with their
            labels on top. Sized to natural width, wrap when narrow. */}
        <div className="tones__compact-grid">
          <Tooltip content={TONE_TOOLTIPS.sampleRate}>
            <div className="tones__compact-field tones__compact-field--readout">
              <span className="ac-field-label">Sample Rate</span>
              <span className="tones__field-readout">
                <strong>{tone.sampleRate}</strong>
              </span>
            </div>
          </Tooltip>

          <Tooltip content={TONE_TOOLTIPS.waveBank}>
            <div className="tones__compact-field">
              <span className="ac-field-label">Bank</span>
              <AcToggle
                value={String(tone.wave.bank)}
                options={bankOptions}
                onChange={handleBankChange}
                ariaLabel="Wave Bank"
                name="tone-wave-bank"
              />
            </div>
          </Tooltip>

          <Tooltip content={TONE_TOOLTIPS.loopMode}>
            <div className="tones__compact-field">
              <span className="ac-field-label">Loop Mode</span>
              <AcToggle
                value={tone.loopMode}
                options={LOOP_MODE_OPTIONS}
                onChange={handleLoopModeChange}
                ariaLabel="Loop Mode"
                name="tone-loop-mode"
              />
            </div>
          </Tooltip>

          <Tooltip content={TONE_TOOLTIPS.outputAssign}>
            <div className="tones__compact-field">
              <span className="ac-field-label">Output</span>
              <AcToggle
                value={String(tone.outputAssign)}
                options={OUTPUT_OPTIONS}
                onChange={handleOutputChange}
                ariaLabel="Output Assign"
                name="tone-output"
              />
            </div>
          </Tooltip>
        </div>
      </section>

      {/* ============ WAVE REGION ============ */}
      <section className="tones__subsection">
        <header className="tones__subsection-head">
          <span>Wave Region</span>
        </header>

        <div className="tones__addresses">
          <Tooltip content={TONE_TOOLTIPS.waveStart}>
            <div>
              <label className="ac-field-label">Start</label>
              <input
                type="number"
                min={0}
                max={0x221180}
                value={tone.wave.startPoint}
                onChange={(e) => handleStartChange(parseInt(e.target.value) || 0)}
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
                onChange={(e) => handleLoopPointChange(parseInt(e.target.value) || 0)}
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
                onChange={(e) => handleEndChange(parseInt(e.target.value) || 4)}
                className="ac-input font-mono"
              />
            </div>
          </Tooltip>
        </div>
      </section>

      {/* ============ SEGMENT ============ */}
      <section className="tones__subsection">
        <header className="tones__subsection-head">
          <span>Segment</span>
        </header>

        {/* 18-cell wave-bank strip with this tone's segment range
            highlighted. Gives the operator a glanceable "which segments
            of bank X does this tone occupy" affordance — the
            segmentTop/segmentLength sliders alone don't communicate
            this, and the import dialogs' MemoryMapPanel only shows it
            during import. */}
        <WaveSegmentRange
          segmentTop={tone.wave.segmentTop}
          segmentLength={tone.wave.segmentLength}
        />

        <div className="tones__slider-stack">
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

      {/* ============ LOOP EDITOR (only when sample is loaded) ============ */}
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
