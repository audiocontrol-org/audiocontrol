/**
 * Tone editor component
 */

import type { S330Tone } from '@/core/midi/S330Client';
import { midiNoteToName, formatPercent } from '@/lib/utils';
import { ParameterSlider } from '@/components/ui/ParameterSlider';
import { EnvelopeDisplay } from '@/components/ui/EnvelopeDisplay';

interface ToneEditorProps {
  tone: S330Tone;
  index: number;
}

export function ToneEditor({ tone, index }: ToneEditorProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-sm text-s330-muted">Tone {index + 1}</span>
            <h3 className="text-xl font-bold text-s330-text font-mono">
              {tone.name || '(unnamed)'}
            </h3>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary text-sm">
              Save to Library
            </button>
            <button className="btn btn-primary text-sm">
              Send to S-330
            </button>
          </div>
        </div>

        {/* Sample Info */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs text-s330-muted">Original Key</label>
            <div className="text-sm text-s330-text">
              {midiNoteToName(tone.originalKey)} ({tone.originalKey})
            </div>
          </div>
          <div>
            <label className="text-xs text-s330-muted">Sample Rate</label>
            <div className="text-sm text-s330-text">{tone.sampleRate}</div>
          </div>
          <div>
            <label className="text-xs text-s330-muted">Loop Mode</label>
            <div className="text-sm text-s330-text capitalize">{tone.loopMode}</div>
          </div>
          <div>
            <label className="text-xs text-s330-muted">Level</label>
            <div className="text-sm text-s330-text">{formatPercent(tone.level)}</div>
          </div>
        </div>

        {/* Sample Addresses */}
        <div className="mt-4 grid gap-4 md:grid-cols-3 text-xs">
          <div className="bg-s330-bg p-2 rounded">
            <span className="text-s330-muted">Start: </span>
            <span className="font-mono text-s330-text">0x{tone.startAddress.toString(16).padStart(6, '0')}</span>
          </div>
          <div className="bg-s330-bg p-2 rounded">
            <span className="text-s330-muted">Loop Start: </span>
            <span className="font-mono text-s330-text">0x{tone.loopStart.toString(16).padStart(6, '0')}</span>
          </div>
          <div className="bg-s330-bg p-2 rounded">
            <span className="text-s330-muted">Loop End: </span>
            <span className="font-mono text-s330-text">0x{tone.loopEnd.toString(16).padStart(6, '0')}</span>
          </div>
        </div>

        {/* Tuning */}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ParameterSlider
            label="Coarse Tune"
            value={tone.coarseTune}
            onChange={() => {}}
            min={0}
            max={127}
            formatValue={(v) => `${v - 64} semitones`}
          />
          <ParameterSlider
            label="Fine Tune"
            value={tone.fineTune}
            onChange={() => {}}
            min={0}
            max={127}
            formatValue={(v) => `${v - 64} cents`}
          />
        </div>
      </div>

      {/* TVA (Amplifier Envelope) */}
      <div className="card">
        <h4 className="font-medium text-s330-text mb-4">TVA (Amplifier)</h4>
        <EnvelopeDisplay envelope={tone.tva} label="TVA" />
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <ParameterSlider
            label="Attack"
            value={tone.tva.attack}
            onChange={() => {}}
            formatValue={formatPercent}
          />
          <ParameterSlider
            label="Decay"
            value={tone.tva.decay}
            onChange={() => {}}
            formatValue={formatPercent}
          />
          <ParameterSlider
            label="Sustain"
            value={tone.tva.sustain}
            onChange={() => {}}
            formatValue={formatPercent}
          />
          <ParameterSlider
            label="Release"
            value={tone.tva.release}
            onChange={() => {}}
            formatValue={formatPercent}
          />
        </div>
      </div>

      {/* TVF (Filter) */}
      <div className="card">
        <h4 className="font-medium text-s330-text mb-4">TVF (Filter)</h4>
        <div className="grid gap-4 md:grid-cols-3 mb-4">
          <ParameterSlider
            label="Cutoff"
            value={tone.tvf.cutoff}
            onChange={() => {}}
            formatValue={formatPercent}
          />
          <ParameterSlider
            label="Resonance"
            value={tone.tvf.resonance}
            onChange={() => {}}
            formatValue={formatPercent}
          />
          <ParameterSlider
            label="Env Depth"
            value={tone.tvf.envDepth}
            onChange={() => {}}
            formatValue={formatPercent}
          />
        </div>
        <EnvelopeDisplay envelope={tone.tvf.envelope} label="TVF" />
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <ParameterSlider
            label="Attack"
            value={tone.tvf.envelope.attack}
            onChange={() => {}}
            formatValue={formatPercent}
          />
          <ParameterSlider
            label="Decay"
            value={tone.tvf.envelope.decay}
            onChange={() => {}}
            formatValue={formatPercent}
          />
          <ParameterSlider
            label="Sustain"
            value={tone.tvf.envelope.sustain}
            onChange={() => {}}
            formatValue={formatPercent}
          />
          <ParameterSlider
            label="Release"
            value={tone.tvf.envelope.release}
            onChange={() => {}}
            formatValue={formatPercent}
          />
        </div>
      </div>

      {/* LFO */}
      <div className="card">
        <h4 className="font-medium text-s330-text mb-4">LFO</h4>
        <div className="mb-4">
          <label className="text-xs text-s330-muted">Destination</label>
          <div className="text-sm text-s330-text uppercase">{tone.lfo.destination}</div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <ParameterSlider
            label="Rate"
            value={tone.lfo.rate}
            onChange={() => {}}
            formatValue={formatPercent}
          />
          <ParameterSlider
            label="Depth"
            value={tone.lfo.depth}
            onChange={() => {}}
            formatValue={formatPercent}
          />
          <ParameterSlider
            label="Delay"
            value={tone.lfo.delay}
            onChange={() => {}}
            formatValue={formatPercent}
          />
        </div>
      </div>
    </div>
  );
}
