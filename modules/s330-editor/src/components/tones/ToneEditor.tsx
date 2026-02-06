/**
 * S-330 Tone Editor Component
 *
 * Full editor for S-330 tone parameters including:
 * - Basic info (name, sample rate, original key)
 * - Wave parameters (start/end/loop points)
 * - LFO parameters
 * - TVA (amplifier) with 8-point envelope
 * - TVF (filter) with 8-point envelope
 * - Pitch parameters
 */

import type { S330Tone, S330Envelope } from '@audiocontrol/sampler-devices/s330';
import { midiNoteToName, formatPercent, cn, formatS330Number } from '@/lib/utils';
import { ParameterSlider } from '@/components/ui/ParameterSlider';
import { EnvelopeEditor } from '@/components/ui/EnvelopeEditor';

interface ToneEditorProps {
    tone: S330Tone;
    index: number;
    onUpdate?: (tone: S330Tone) => void;
    // Called to commit changes to device
    // For immediate commits (checkbox/dropdown), pass the updated tone directly
    // For drag-end commits, call with no args (reads from store)
    onCommit?: (updatedTone?: S330Tone) => void;
}

export function ToneEditor({ tone, index, onUpdate, onCommit }: ToneEditorProps) {
    const handleTvaEnvelopeChange = (envelope: S330Envelope) => {
        onUpdate?.({ ...tone, tva: { ...tone.tva, envelope } });
    };

    const handleTvfEnvelopeChange = (envelope: S330Envelope) => {
        onUpdate?.({ ...tone, tvf: { ...tone.tvf, envelope } });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="card">
                <div className="mb-4">
                    <label className="text-sm text-s330-muted">Tone T{formatS330Number(index)}</label>
                    <input
                        type="text"
                        value={tone.name}
                        onChange={(e) => onUpdate?.({ ...tone, name: e.target.value.slice(0, 8) })}
                        onBlur={() => onCommit?.()}
                        placeholder="(unnamed)"
                        maxLength={8}
                        className="block text-xl font-bold text-s330-text font-mono bg-transparent border-b border-s330-accent/50 focus:border-s330-highlight focus:outline-none w-full max-w-[10ch]"
                    />
                </div>

                {/* Basic Info */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div>
                        <label className="text-xs text-s330-muted">Original Key</label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min={0}
                                max={127}
                                value={tone.originalKey}
                                onChange={(e) => onUpdate?.({ ...tone, originalKey: Math.max(0, Math.min(127, parseInt(e.target.value) || 0)) })}
                                onBlur={() => onCommit?.()}
                                className="w-16 text-sm bg-s330-bg border border-s330-accent/30 rounded px-2 py-1 text-s330-text"
                            />
                            <span className="text-sm text-s330-muted">{midiNoteToName(tone.originalKey)}</span>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-s330-muted">Sample Rate</label>
                        <div className="text-sm text-s330-text">{tone.sampleRate}</div>
                    </div>
                    <div>
                        <label className="text-xs text-s330-muted">Loop Mode</label>
                        <select
                            value={tone.loopMode}
                            onChange={(e) => {
                                const updatedTone = { ...tone, loopMode: e.target.value as S330Tone['loopMode'] };
                                onUpdate?.(updatedTone);
                                onCommit?.(updatedTone);
                            }}
                            className="w-full text-sm bg-s330-bg border border-s330-accent/30 rounded px-2 py-1 text-s330-text"
                        >
                            <option value="forward">Forward</option>
                            <option value="alternating">Alternating</option>
                            <option value="one-shot">One-Shot</option>
                            <option value="reverse">Reverse</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-s330-muted">Output</label>
                        <select
                            value={tone.outputAssign}
                            onChange={(e) => {
                                const updatedTone = { ...tone, outputAssign: parseInt(e.target.value) };
                                onUpdate?.(updatedTone);
                                onCommit?.(updatedTone);
                            }}
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
                </div>

                {/* Wave Addresses */}
                <div className="mt-4 grid gap-4 md:grid-cols-3 text-xs">
                    <div className="bg-s330-bg p-2 rounded">
                        <label className="text-s330-muted block mb-1">Start</label>
                        <input
                            type="number"
                            min={0}
                            max={0x221180}
                            value={tone.wave.startPoint}
                            onChange={(e) => onUpdate?.({ ...tone, wave: { ...tone.wave, startPoint: Math.max(0, parseInt(e.target.value) || 0) } })}
                            onBlur={() => onCommit?.()}
                            className="w-full font-mono bg-transparent border border-s330-accent/30 rounded px-2 py-1 text-s330-text"
                        />
                    </div>
                    <div className="bg-s330-bg p-2 rounded">
                        <label className="text-s330-muted block mb-1">Loop Point</label>
                        <input
                            type="number"
                            min={0}
                            max={0x221184}
                            value={tone.wave.loopPoint}
                            onChange={(e) => onUpdate?.({ ...tone, wave: { ...tone.wave, loopPoint: Math.max(0, parseInt(e.target.value) || 0) } })}
                            onBlur={() => onCommit?.()}
                            className="w-full font-mono bg-transparent border border-s330-accent/30 rounded px-2 py-1 text-s330-text"
                        />
                    </div>
                    <div className="bg-s330-bg p-2 rounded">
                        <label className="text-s330-muted block mb-1">End</label>
                        <input
                            type="number"
                            min={4}
                            max={0x221184}
                            value={tone.wave.endPoint}
                            onChange={(e) => onUpdate?.({ ...tone, wave: { ...tone.wave, endPoint: Math.max(4, parseInt(e.target.value) || 4) } })}
                            onBlur={() => onCommit?.()}
                            className="w-full font-mono bg-transparent border border-s330-accent/30 rounded px-2 py-1 text-s330-text"
                        />
                    </div>
                </div>
            </div>

            {/* TVF (Filter) */}
            <div className="card">
                <h4 className="font-medium text-s330-text mb-4">
                    TVF (Filter)
                    <span className={cn(
                        'ml-2 text-xs px-2 py-0.5 rounded',
                        tone.tvf.enabled ? 'bg-s330-highlight/20 text-s330-highlight' : 'bg-s330-muted/20 text-s330-muted'
                    )}>
                        {tone.tvf.enabled ? 'ON' : 'OFF'}
                    </span>
                </h4>
                <div className="flex items-center gap-2 mb-4">
                    <input
                        type="checkbox"
                        id="tvfEnabled"
                        checked={tone.tvf.enabled}
                        onChange={(e) => {
                            const updatedTone = { ...tone, tvf: { ...tone.tvf, enabled: e.target.checked } };
                            onUpdate?.(updatedTone);
                            onCommit?.(updatedTone);
                        }}
                        className="rounded"
                    />
                    <label htmlFor="tvfEnabled" className="text-sm text-s330-text">
                        Enable Filter
                    </label>
                </div>
                <div className="grid gap-4 md:grid-cols-3 mb-4">
                    <ParameterSlider
                        label="Cutoff"
                        value={tone.tvf.cutoff}
                        onChange={(v) => onUpdate?.({ ...tone, tvf: { ...tone.tvf, cutoff: v } })}
                        onCommit={onCommit}
                        formatValue={formatPercent}
                        disabled={!tone.tvf.enabled}
                    />
                    <ParameterSlider
                        label="Resonance"
                        value={tone.tvf.resonance}
                        onChange={(v) => onUpdate?.({ ...tone, tvf: { ...tone.tvf, resonance: v } })}
                        onCommit={onCommit}
                        formatValue={formatPercent}
                        disabled={!tone.tvf.enabled}
                    />
                    <ParameterSlider
                        label="Key Follow"
                        value={tone.tvf.keyFollow}
                        onChange={(v) => onUpdate?.({ ...tone, tvf: { ...tone.tvf, keyFollow: v } })}
                        onCommit={onCommit}
                        formatValue={formatPercent}
                        disabled={!tone.tvf.enabled}
                    />
                </div>
                <div className="grid gap-4 md:grid-cols-4 mb-4">
                    <ParameterSlider
                        label="LFO Depth"
                        value={tone.tvf.lfoDepth}
                        onChange={(v) => onUpdate?.({ ...tone, tvf: { ...tone.tvf, lfoDepth: v } })}
                        onCommit={onCommit}
                        formatValue={formatPercent}
                        disabled={!tone.tvf.enabled}
                    />
                    <ParameterSlider
                        label="EG Depth"
                        value={tone.tvf.egDepth}
                        onChange={(v) => onUpdate?.({ ...tone, tvf: { ...tone.tvf, egDepth: v } })}
                        onCommit={onCommit}
                        formatValue={formatPercent}
                        disabled={!tone.tvf.enabled}
                    />
                    <ParameterSlider
                        label="Key Rate"
                        value={tone.tvf.keyRateFollow}
                        onChange={(v) => onUpdate?.({ ...tone, tvf: { ...tone.tvf, keyRateFollow: v } })}
                        onCommit={onCommit}
                        formatValue={formatPercent}
                        disabled={!tone.tvf.enabled}
                    />
                    <ParameterSlider
                        label="Vel Rate"
                        value={tone.tvf.velRateFollow}
                        onChange={(v) => onUpdate?.({ ...tone, tvf: { ...tone.tvf, velRateFollow: v } })}
                        onCommit={onCommit}
                        formatValue={formatPercent}
                        disabled={!tone.tvf.enabled}
                    />
                </div>
                <div className="mb-2 flex gap-4">
                    <label className="text-xs text-s330-muted">
                        EG Polarity: {tone.tvf.egPolarity}
                    </label>
                    <label className="text-xs text-s330-muted">
                        Level Curve: {tone.tvf.levelCurve}
                    </label>
                </div>
                <EnvelopeEditor
                    envelope={tone.tvf.envelope}
                    onChange={handleTvfEnvelopeChange}
                    onCommit={onCommit}
                    label="TVF"
                    disabled={!tone.tvf.enabled}
                />
            </div>

            {/* LFO */}
            <div className="card">
                <h4 className="font-medium text-s330-text mb-4">LFO</h4>
                <div className="grid gap-4 md:grid-cols-3 mb-4">
                    <ParameterSlider
                        label="Rate"
                        value={tone.lfo.rate}
                        onChange={(v) => onUpdate?.({ ...tone, lfo: { ...tone.lfo, rate: v } })}
                        onCommit={onCommit}
                        formatValue={formatPercent}
                    />
                    <ParameterSlider
                        label="Delay"
                        value={tone.lfo.delay}
                        onChange={(v) => onUpdate?.({ ...tone, lfo: { ...tone.lfo, delay: v } })}
                        onCommit={onCommit}
                        formatValue={formatPercent}
                    />
                    <ParameterSlider
                        label="Offset"
                        value={tone.lfo.offset}
                        onChange={(v) => onUpdate?.({ ...tone, lfo: { ...tone.lfo, offset: v } })}
                        onCommit={onCommit}
                        formatValue={formatPercent}
                    />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="lfoSync"
                            checked={tone.lfo.sync}
                            onChange={(e) => {
                                const updatedTone = { ...tone, lfo: { ...tone.lfo, sync: e.target.checked } };
                                onUpdate?.(updatedTone);
                                onCommit?.(updatedTone);
                            }}
                            className="rounded"
                        />
                        <label htmlFor="lfoSync" className="text-sm text-s330-text">
                            Key Sync
                        </label>
                    </div>
                    <div>
                        <label className="text-xs text-s330-muted">Mode</label>
                        <div className="text-sm text-s330-text capitalize">{tone.lfo.mode}</div>
                    </div>
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
                        <label htmlFor="lfoPolarity" className="text-sm text-s330-text">
                            Peak Hold
                        </label>
                    </div>
                </div>
            </div>

            {/* Pitch */}
            <div className="card">
                <h4 className="font-medium text-s330-text mb-4">Pitch</h4>
                <div className="grid gap-4 md:grid-cols-2">
                    <ParameterSlider
                        label="Transpose"
                        value={tone.transpose}
                        onChange={(v) => onUpdate?.({ ...tone, transpose: v })}
                        onCommit={onCommit}
                        min={0}
                        max={127}
                        formatValue={(v) => `${v - 64} semitones`}
                    />
                    <ParameterSlider
                        label="Fine Tune"
                        value={tone.fineTune + 64}
                        onChange={(v) => onUpdate?.({ ...tone, fineTune: v - 64 })}
                        onCommit={onCommit}
                        min={0}
                        max={127}
                        formatValue={(v) => `${v - 64} cents`}
                    />
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
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
                        <label htmlFor="benderEnabled" className="text-sm text-s330-text">
                            Pitch Bender
                        </label>
                    </div>
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
                        <label htmlFor="aftertouchEnabled" className="text-sm text-s330-text">
                            Aftertouch
                        </label>
                    </div>
                </div>
            </div>

            {/* TVA (Amplifier) */}
            <div className="card">
                <h4 className="font-medium text-s330-text mb-4">TVA (Amplifier)</h4>
                <div className="grid gap-4 md:grid-cols-4 mb-4">
                    <ParameterSlider
                        label="Level"
                        value={tone.tva.level}
                        onChange={(v) => onUpdate?.({ ...tone, tva: { ...tone.tva, level: v } })}
                        onCommit={onCommit}
                        formatValue={formatPercent}
                    />
                    <ParameterSlider
                        label="LFO Depth"
                        value={tone.tva.lfoDepth}
                        onChange={(v) => onUpdate?.({ ...tone, tva: { ...tone.tva, lfoDepth: v } })}
                        onCommit={onCommit}
                        formatValue={formatPercent}
                    />
                    <ParameterSlider
                        label="Key Rate"
                        value={tone.tva.keyRate}
                        onChange={(v) => onUpdate?.({ ...tone, tva: { ...tone.tva, keyRate: v } })}
                        onCommit={onCommit}
                        formatValue={formatPercent}
                    />
                    <ParameterSlider
                        label="Vel Rate"
                        value={tone.tva.velRate}
                        onChange={(v) => onUpdate?.({ ...tone, tva: { ...tone.tva, velRate: v } })}
                        onCommit={onCommit}
                        formatValue={formatPercent}
                    />
                </div>
                <div className="mb-2">
                    <label className="text-xs text-s330-muted">Level Curve: {tone.tva.levelCurve}</label>
                </div>
                <EnvelopeEditor
                    envelope={tone.tva.envelope}
                    onChange={handleTvaEnvelopeChange}
                    onCommit={onCommit}
                    label="TVA"
                />
            </div>
        </div>
    );
}
