/**
 * ToneEditor — Wave tab panel (Phase 9 Task 4 polish).
 *
 * Wave-source params (Original Key / Sample Rate / Loop Mode / Output)
 * + sample wave-address controls (Start / Loop Point / End) + the
 * visual loop editor (when sample data is available).
 *
 * data-testid preservation:
 *   - tone-original-key, tone-loop-mode, tone-output
 */

import type { SamplerTone } from '@/core/midi/SamplerClient';
import { midiNoteToName } from '@/lib/utils';
import { Tooltip } from '@/components/ui/Tooltip';
import { TONE_TOOLTIPS } from '@/constants/tone-tooltips';
import { LoopEditor } from '@audiocontrol/loop-editor/ui';
import type { LoopEditorProps } from '@audiocontrol/loop-editor/ui';

interface ToneWavePanelProps {
  tone: SamplerTone;
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
  onUpdate,
  onCommit,
  waveData,
  isLoadingWaveData = false,
  waveDataLoadProgress,
  onLoadWaveData,
  loopEditorProps,
}: ToneWavePanelProps) {
  const hasSampleData = tone.wave.endPoint > tone.wave.startPoint;

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
              <label className="text-xs text-s330-muted">Original Key</label>
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
                  className="w-16 text-sm bg-s330-bg border border-s330-accent/30 rounded px-2 py-1 text-s330-text"
                />
                <span className="text-sm text-s330-muted">{midiNoteToName(tone.originalKey)}</span>
              </div>
            </div>
          </Tooltip>
          <Tooltip content={TONE_TOOLTIPS.sampleRate}>
            <div>
              <label className="text-xs text-s330-muted">Sample Rate</label>
              <div className="text-sm text-s330-text">{tone.sampleRate}</div>
            </div>
          </Tooltip>
          <Tooltip content={TONE_TOOLTIPS.loopMode}>
            <div>
              <label className="text-xs text-s330-muted">Loop Mode</label>
              <select
                value={tone.loopMode}
                onChange={(e) => {
                  const updatedTone = { ...tone, loopMode: e.target.value as SamplerTone['loopMode'] };
                  onUpdate?.(updatedTone);
                  onCommit?.(updatedTone);
                }}
                data-testid="tone-loop-mode"
                className="w-full text-sm bg-s330-bg border border-s330-accent/30 rounded px-2 py-1 text-s330-text"
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
              <label className="text-xs text-s330-muted">Output</label>
              <select
                value={tone.outputAssign}
                onChange={(e) => {
                  const updatedTone = { ...tone, outputAssign: parseInt(e.target.value) };
                  onUpdate?.(updatedTone);
                  onCommit?.(updatedTone);
                }}
                data-testid="tone-output"
                className="w-full text-sm bg-s330-bg border border-s330-accent/30 rounded px-2 py-1 text-s330-text"
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

        <div className="mt-4 grid gap-4 md:grid-cols-3 text-xs">
          <Tooltip content={TONE_TOOLTIPS.waveStart}>
            <div className="bg-s330-bg p-2 rounded">
              <label className="text-s330-muted block mb-1">Start</label>
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
                className="w-full font-mono bg-transparent border border-s330-accent/30 rounded px-2 py-1 text-s330-text"
              />
            </div>
          </Tooltip>
          <Tooltip content={TONE_TOOLTIPS.waveLoop}>
            <div className="bg-s330-bg p-2 rounded">
              <label className="text-s330-muted block mb-1">Loop Point</label>
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
                className="w-full font-mono bg-transparent border border-s330-accent/30 rounded px-2 py-1 text-s330-text"
              />
            </div>
          </Tooltip>
          <Tooltip content={TONE_TOOLTIPS.waveEnd}>
            <div className="bg-s330-bg p-2 rounded">
              <label className="text-s330-muted block mb-1">End</label>
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
                className="w-full font-mono bg-transparent border border-s330-accent/30 rounded px-2 py-1 text-s330-text"
              />
            </div>
          </Tooltip>
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
