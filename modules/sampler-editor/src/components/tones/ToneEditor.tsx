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

import type { S330Tone, S330Envelope, S330EgPolarity, S330LevelCurve } from '@/core/midi/S330Client';
import type { LoopCandidate } from '@audiocontrol/sampler-library';
import { formatPercent } from '@audiocontrol/editor-core';
import { midiNoteToName, cn, formatS330Number } from '@/lib/utils';
import { ParameterSlider } from '@/components/ui/ParameterSlider';
import { EnvelopeEditor } from '@/components/ui/EnvelopeEditor';
import { Tooltip } from '@/components/ui/Tooltip';
import { TONE_TOOLTIPS } from '@/constants/tone-tooltips';
import { LoopEditor } from '@/components/tones/LoopEditor';
import type { LoopDetectionProgress } from '@/hooks/useLoopDetection';

interface ToneEditorProps {
    tone: S330Tone;
    index: number;
    onUpdate?: (tone: S330Tone) => void;
    // Called to commit changes to device
    // For immediate commits (checkbox/dropdown), pass the updated tone directly
    // For drag-end commits, call with no args (reads from store)
    onCommit?: (updatedTone?: S330Tone) => void;
    // Called when user clicks Export Sample button
    // Handler should fetch wave data and trigger download
    onExportSample?: () => void;
    // Whether sample export is in progress
    isExporting?: boolean;
    // Export progress (0-100), shown when exporting
    exportProgress?: number;
    // Called when user clicks Export to Library button
    onExportToLibrary?: () => void;
    // Whether library export is in progress
    isExportingToLibrary?: boolean;
    // Called when user clicks Import Sample button
    onImportSample?: () => void;
    // Whether sample import is in progress
    isImporting?: boolean;
    // Wave data for loop editor (16-bit signed samples)
    waveData?: Int16Array | null;
    // Whether wave data is currently loading
    isLoadingWaveData?: boolean;
    // Wave data loading progress (0-100)
    waveDataLoadProgress?: number;
    // Called when user wants to load wave data for loop editor
    onLoadWaveData?: () => void;
    // Loop detection props
    loopCandidates?: LoopCandidate[];
    selectedLoopCandidateIndex?: number;
    onLoopCandidateSelect?: (index: number) => void;
    onAutoDetectLoopPoints?: () => void;
    isSearchingLoopPoints?: boolean;
    loopSearchProgress?: LoopDetectionProgress;
    // Loop smoothing props
    onSmoothLoop?: (mode: 'linear' | 'equal-power') => void;
    isSmoothingLoop?: boolean;
}

export function ToneEditor({
    tone,
    index,
    onUpdate,
    onCommit,
    onExportSample,
    isExporting = false,
    exportProgress,
    onExportToLibrary,
    isExportingToLibrary = false,
    onImportSample,
    isImporting = false,
    waveData,
    isLoadingWaveData = false,
    waveDataLoadProgress,
    onLoadWaveData,
    loopCandidates,
    selectedLoopCandidateIndex,
    onLoopCandidateSelect,
    onAutoDetectLoopPoints,
    isSearchingLoopPoints,
    loopSearchProgress,
    onSmoothLoop,
    isSmoothingLoop,
}: ToneEditorProps) {
    const handleTvaEnvelopeChange = (envelope: S330Envelope) => {
        onUpdate?.({ ...tone, tva: { ...tone.tva, envelope } });
    };

    const handleTvfEnvelopeChange = (envelope: S330Envelope) => {
        onUpdate?.({ ...tone, tvf: { ...tone.tvf, envelope } });
    };

    // Check if this tone has valid sample data
    const hasSampleData = tone.wave.endPoint > tone.wave.startPoint;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="card">
                <div className="mb-4 flex items-start justify-between">
                    <div>
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
                    {/* Export Buttons */}
                    <div className="flex flex-col items-end gap-2">
                        <div className="flex gap-2">
                            {/* Export to Library Button */}
                            {onExportToLibrary && (
                                <Tooltip content={hasSampleData ? 'Export tone and sample to library' : 'No sample data to export'}>
                                    <button
                                        onClick={onExportToLibrary}
                                        disabled={isExportingToLibrary || isExporting || !hasSampleData}
                                        className={cn(
                                            'ac-btn ac-btn-sm',
                                            hasSampleData ? 'ac-btn-primary' : 'ac-btn-ghost opacity-50',
                                            (isExportingToLibrary || isExporting) && 'opacity-50 cursor-wait'
                                        )}
                                    >
                                        {isExportingToLibrary ? (
                                            <>
                                                <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                                                Exporting...
                                            </>
                                        ) : (
                                            'Export to Library'
                                        )}
                                    </button>
                                </Tooltip>
                            )}
                            {/* Export Sample Button */}
                            {onExportSample && (
                                <Tooltip content={hasSampleData ? 'Download this sample as a WAV file' : 'No sample data to export'}>
                                    <button
                                        onClick={onExportSample}
                                        disabled={isExporting || isExportingToLibrary || !hasSampleData}
                                        className={cn(
                                            'ac-btn ac-btn-sm',
                                            hasSampleData ? 'ac-btn-secondary' : 'ac-btn-ghost opacity-50',
                                            (isExporting || isExportingToLibrary) && 'opacity-50 cursor-wait'
                                        )}
                                    >
                                        {isExporting ? (
                                            <>
                                                <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                                                Exporting...
                                            </>
                                        ) : (
                                            'Export Sample'
                                        )}
                                    </button>
                                </Tooltip>
                            )}
                            {/* Import Sample Button */}
                            {onImportSample && (
                                <Tooltip content="Import a WAV file from disk to this tone slot">
                                    <button
                                        onClick={onImportSample}
                                        disabled={isImporting || isExporting || isExportingToLibrary}
                                        className={cn(
                                            'ac-btn ac-btn-sm ac-btn-ghost',
                                            (isImporting || isExporting || isExportingToLibrary) && 'opacity-50 cursor-wait'
                                        )}
                                    >
                                        {isImporting ? (
                                            <>
                                                <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                                                Importing...
                                            </>
                                        ) : (
                                            'Import Sample'
                                        )}
                                    </button>
                                </Tooltip>
                            )}
                        </div>
                        {isExporting && exportProgress !== undefined && (
                            <div className="w-32">
                                <div className="h-1.5 bg-s330-panel rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-s330-highlight transition-all duration-150 ease-out"
                                        style={{ width: `${exportProgress}%` }}
                                    />
                                </div>
                                <p className="text-s330-muted text-xs text-right mt-0.5">
                                    {exportProgress.toFixed(0)}%
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Basic Info */}
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

                {/* Wave Addresses */}
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
            </div>

            {/* Loop Editor */}
            {hasSampleData && (
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
                    <LoopEditor
                        samples={waveData ?? null}
                        sampleRate={tone.sampleRate === '30kHz' ? 30000 : 15000}
                        startPoint={tone.wave.startPoint}
                        loopPoint={tone.wave.loopPoint}
                        endPoint={tone.wave.endPoint}
                        onLoopPointChange={(loopPoint) => {
                            const updatedTone = { ...tone, wave: { ...tone.wave, loopPoint } };
                            onUpdate?.(updatedTone);
                        }}
                        onEndPointChange={(endPoint) => {
                            const updatedTone = { ...tone, wave: { ...tone.wave, endPoint } };
                            onUpdate?.(updatedTone);
                        }}
                        onApplyCandidate={(loopStart, loopEnd) => {
                            const updatedTone = { ...tone, wave: { ...tone.wave, loopPoint: loopStart, endPoint: loopEnd } };
                            onUpdate?.(updatedTone);
                        }}
                        onCommit={onCommit}
                        isLoading={isLoadingWaveData}
                        loadingProgress={waveDataLoadProgress}
                        candidates={loopCandidates}
                        selectedCandidateIndex={selectedLoopCandidateIndex}
                        onCandidateSelect={onLoopCandidateSelect}
                        onAutoDetect={onAutoDetectLoopPoints}
                        isSearching={isSearchingLoopPoints}
                        searchProgress={loopSearchProgress}
                        onSmoothLoop={onSmoothLoop}
                        isSmoothing={isSmoothingLoop}
                    />
                </div>
            )}

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
                <Tooltip content={TONE_TOOLTIPS.tvfEnabled}>
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
                </Tooltip>
                <div className="grid gap-4 md:grid-cols-3 mb-4">
                    <ParameterSlider
                        label="Cutoff"
                        value={tone.tvf.cutoff}
                        onChange={(v) => onUpdate?.({ ...tone, tvf: { ...tone.tvf, cutoff: v } })}
                        onCommit={onCommit}
                        formatValue={formatPercent}
                        disabled={!tone.tvf.enabled}
                        tooltip={TONE_TOOLTIPS.tvfCutoff}
                    />
                    <ParameterSlider
                        label="Resonance"
                        value={tone.tvf.resonance}
                        onChange={(v) => onUpdate?.({ ...tone, tvf: { ...tone.tvf, resonance: v } })}
                        onCommit={onCommit}
                        formatValue={formatPercent}
                        disabled={!tone.tvf.enabled}
                        tooltip={TONE_TOOLTIPS.tvfResonance}
                    />
                    <ParameterSlider
                        label="Key Follow"
                        value={tone.tvf.keyFollow}
                        onChange={(v) => onUpdate?.({ ...tone, tvf: { ...tone.tvf, keyFollow: v } })}
                        onCommit={onCommit}
                        formatValue={formatPercent}
                        disabled={!tone.tvf.enabled}
                        tooltip={TONE_TOOLTIPS.tvfKeyFollow}
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
                        tooltip={TONE_TOOLTIPS.tvfLfoDepth}
                    />
                    <ParameterSlider
                        label="EG Depth"
                        value={tone.tvf.egDepth}
                        onChange={(v) => onUpdate?.({ ...tone, tvf: { ...tone.tvf, egDepth: v } })}
                        onCommit={onCommit}
                        formatValue={formatPercent}
                        disabled={!tone.tvf.enabled}
                        tooltip={TONE_TOOLTIPS.tvfEgDepth}
                    />
                    <ParameterSlider
                        label="Key Rate"
                        value={tone.tvf.keyRateFollow}
                        onChange={(v) => onUpdate?.({ ...tone, tvf: { ...tone.tvf, keyRateFollow: v } })}
                        onCommit={onCommit}
                        formatValue={formatPercent}
                        disabled={!tone.tvf.enabled}
                        tooltip={TONE_TOOLTIPS.tvfKeyRate}
                    />
                    <ParameterSlider
                        label="Vel Rate"
                        value={tone.tvf.velRateFollow}
                        onChange={(v) => onUpdate?.({ ...tone, tvf: { ...tone.tvf, velRateFollow: v } })}
                        onCommit={onCommit}
                        formatValue={formatPercent}
                        disabled={!tone.tvf.enabled}
                        tooltip={TONE_TOOLTIPS.tvfVelRate}
                    />
                </div>
                <div className="mb-4 grid gap-4 md:grid-cols-2">
                    <Tooltip content={TONE_TOOLTIPS.tvfEgPolarity}>
                        <div>
                            <label className="text-xs text-s330-muted mb-1 block">EG Polarity</label>
                            <select
                                value={tone.tvf.egPolarity}
                                onChange={(e) => {
                                    const updatedTone = { ...tone, tvf: { ...tone.tvf, egPolarity: e.target.value as S330EgPolarity } };
                                    onUpdate?.(updatedTone);
                                    onCommit?.(updatedTone);
                                }}
                                disabled={!tone.tvf.enabled}
                                className="w-full text-sm bg-s330-bg border border-s330-accent/30 rounded px-2 py-1 text-s330-text disabled:opacity-50"
                            >
                                <option value="normal">Normal</option>
                                <option value="reverse">Reverse</option>
                            </select>
                        </div>
                    </Tooltip>
                    <Tooltip content={TONE_TOOLTIPS.tvfLevelCurve}>
                        <div>
                            <label className="text-xs text-s330-muted mb-1 block">Level Curve</label>
                            <select
                                value={tone.tvf.levelCurve}
                                onChange={(e) => {
                                    const updatedTone = { ...tone, tvf: { ...tone.tvf, levelCurve: Number(e.target.value) as S330LevelCurve } };
                                    onUpdate?.(updatedTone);
                                    onCommit?.(updatedTone);
                                }}
                                disabled={!tone.tvf.enabled}
                                className="w-full text-sm bg-s330-bg border border-s330-accent/30 rounded px-2 py-1 text-s330-text disabled:opacity-50"
                            >
                                {[0, 1, 2, 3, 4, 5].map((i) => (
                                    <option key={i} value={i}>{i}</option>
                                ))}
                            </select>
                        </div>
                    </Tooltip>
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
                        tooltip={TONE_TOOLTIPS.lfoRate}
                    />
                    <ParameterSlider
                        label="Delay"
                        value={tone.lfo.delay}
                        onChange={(v) => onUpdate?.({ ...tone, lfo: { ...tone.lfo, delay: v } })}
                        onCommit={onCommit}
                        formatValue={formatPercent}
                        tooltip={TONE_TOOLTIPS.lfoDelay}
                    />
                    <ParameterSlider
                        label="Offset"
                        value={tone.lfo.offset}
                        onChange={(v) => onUpdate?.({ ...tone, lfo: { ...tone.lfo, offset: v } })}
                        onCommit={onCommit}
                        formatValue={formatPercent}
                        tooltip={TONE_TOOLTIPS.lfoOffset}
                    />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                    <Tooltip content={TONE_TOOLTIPS.lfoSync}>
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
                            <label htmlFor="lfoPolarity" className="text-sm text-s330-text">
                                Peak Hold
                            </label>
                        </div>
                    </Tooltip>
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
                                onChange={(e) => {
                                    const updatedTone = { ...tone, pitchFollow: e.target.checked };
                                    onUpdate?.(updatedTone);
                                    onCommit?.(updatedTone);
                                }}
                                className="rounded"
                            />
                            <label htmlFor="pitchFollow" className="text-sm text-s330-text">
                                Pitch Follow
                            </label>
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
                            <label htmlFor="benderEnabled" className="text-sm text-s330-text">
                                Pitch Bender
                            </label>
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
                            <label htmlFor="aftertouchEnabled" className="text-sm text-s330-text">
                                Aftertouch
                            </label>
                        </div>
                    </Tooltip>
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
                        tooltip={TONE_TOOLTIPS.tvaLevel}
                    />
                    <ParameterSlider
                        label="LFO Depth"
                        value={tone.tva.lfoDepth}
                        onChange={(v) => onUpdate?.({ ...tone, tva: { ...tone.tva, lfoDepth: v } })}
                        onCommit={onCommit}
                        formatValue={formatPercent}
                        tooltip={TONE_TOOLTIPS.tvaLfoDepth}
                    />
                    <ParameterSlider
                        label="Key Rate"
                        value={tone.tva.keyRate}
                        onChange={(v) => onUpdate?.({ ...tone, tva: { ...tone.tva, keyRate: v } })}
                        onCommit={onCommit}
                        formatValue={formatPercent}
                        tooltip={TONE_TOOLTIPS.tvaKeyRate}
                    />
                    <ParameterSlider
                        label="Vel Rate"
                        value={tone.tva.velRate}
                        onChange={(v) => onUpdate?.({ ...tone, tva: { ...tone.tva, velRate: v } })}
                        onCommit={onCommit}
                        formatValue={formatPercent}
                        tooltip={TONE_TOOLTIPS.tvaVelRate}
                    />
                </div>
                <Tooltip content={TONE_TOOLTIPS.tvaLevelCurve}>
                    <div className="mb-4 max-w-[200px]">
                        <label className="text-xs text-s330-muted mb-1 block">Level Curve</label>
                        <select
                            value={tone.tva.levelCurve}
                            onChange={(e) => {
                                const updatedTone = { ...tone, tva: { ...tone.tva, levelCurve: Number(e.target.value) as S330LevelCurve } };
                                onUpdate?.(updatedTone);
                                onCommit?.(updatedTone);
                            }}
                            className="w-full text-sm bg-s330-bg border border-s330-accent/30 rounded px-2 py-1 text-s330-text"
                        >
                            {[0, 1, 2, 3, 4, 5].map((i) => (
                                <option key={i} value={i}>{i}</option>
                            ))}
                        </select>
                    </div>
                </Tooltip>
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
