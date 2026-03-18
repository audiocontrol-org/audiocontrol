/**
 * Roland S-Series Shared Parameter Utilities
 *
 * Parameter parsing, encoding, and conversion utilities shared between
 * S-330 and S-550 samplers.
 *
 * @packageDocumentation
 */

import type {
    SSeriesEnvelope,
    SSeriesKeyMode,
    SSeriesAftertouchAssign,
    SSeriesKeyAssign,
    SSeriesLoopMode,
    SSeriesSampleRate,
    SSeriesEgPolarity,
    SSeriesLfoMode,
    SSeriesLevelCurve,
    SSeriesBaseTone,
    SSeriesBasePatchCommon,
    SSeriesBaseSystemParams,
    SSeriesDeviceLimits,
    SSeriesPatchParamMap,
    SSeriesToneOffsetMap,
    SSeriesWaveParams,
    SSeriesLfoParams,
    SSeriesTvaParams,
    SSeriesTvfParams,
} from './s-series-types.js';

// =============================================================================
// Value Conversion Functions
// =============================================================================

/**
 * Convert key mode byte to enum
 */
export function parseKeyMode(value: number): SSeriesKeyMode {
    switch (value) {
        case 0: return 'normal';
        case 1: return 'v-sw';
        case 2: return 'x-fade';
        case 3: return 'v-mix';
        case 4: return 'unison';
        default: return 'normal';
    }
}

/**
 * Convert key mode enum to byte
 */
export function encodeKeyMode(mode: SSeriesKeyMode): number {
    switch (mode) {
        case 'normal': return 0;
        case 'v-sw': return 1;
        case 'x-fade': return 2;
        case 'v-mix': return 3;
        case 'unison': return 4;
    }
}

/**
 * Convert aftertouch assign byte to enum
 */
export function parseAftertouchAssign(value: number): SSeriesAftertouchAssign {
    switch (value) {
        case 0: return 'modulation';
        case 1: return 'volume';
        case 2: return 'bend+';
        case 3: return 'bend-';
        case 4: return 'filter';
        default: return 'modulation';
    }
}

/**
 * Convert aftertouch assign enum to byte
 */
export function encodeAftertouchAssign(assign: SSeriesAftertouchAssign): number {
    switch (assign) {
        case 'modulation': return 0;
        case 'volume': return 1;
        case 'bend+': return 2;
        case 'bend-': return 3;
        case 'filter': return 4;
    }
}

/**
 * Convert key assign byte to enum
 */
export function parseKeyAssign(value: number): SSeriesKeyAssign {
    return value === 1 ? 'fix' : 'rotary';
}

/**
 * Convert key assign enum to byte
 */
export function encodeKeyAssign(assign: SSeriesKeyAssign): number {
    return assign === 'fix' ? 1 : 0;
}

/**
 * Convert loop mode byte to enum
 */
export function parseLoopMode(value: number): SSeriesLoopMode {
    switch (value) {
        case 0: return 'forward';
        case 1: return 'alternating';
        case 2: return 'one-shot';
        case 3: return 'reverse';
        default: return 'forward';
    }
}

/**
 * Convert loop mode enum to byte
 */
export function encodeLoopMode(mode: SSeriesLoopMode): number {
    switch (mode) {
        case 'forward': return 0;
        case 'alternating': return 1;
        case 'one-shot': return 2;
        case 'reverse': return 3;
    }
}

/**
 * Convert EG polarity byte to enum
 */
export function parseEgPolarity(value: number): SSeriesEgPolarity {
    return value === 1 ? 'reverse' : 'normal';
}

/**
 * Convert EG polarity enum to byte
 */
export function encodeEgPolarity(polarity: SSeriesEgPolarity): number {
    return polarity === 'reverse' ? 1 : 0;
}

/**
 * Convert LFO mode byte to enum
 */
export function parseLfoMode(value: number): SSeriesLfoMode {
    return value === 1 ? 'one-shot' : 'normal';
}

/**
 * Convert LFO mode enum to byte
 */
export function encodeLfoMode(mode: SSeriesLfoMode): number {
    return mode === 'one-shot' ? 1 : 0;
}

/**
 * Parse level curve value (clamp to 0-5)
 */
export function parseLevelCurve(value: number): SSeriesLevelCurve {
    const clamped = Math.max(0, Math.min(5, value));
    return clamped as SSeriesLevelCurve;
}

/**
 * Convert sample rate byte to enum
 * Per S-series spec: 0=30kHz, 1=15kHz
 */
export function parseSampleRate(value: number): SSeriesSampleRate {
    return value === 0 ? '30kHz' : '15kHz';
}

/**
 * Convert sample rate enum to byte
 * Per S-series spec: 0=30kHz, 1=15kHz
 */
export function encodeSampleRate(rate: SSeriesSampleRate): number {
    return rate === '30kHz' ? 0 : 1;
}

// =============================================================================
// Name Parsing/Encoding
// =============================================================================

/**
 * Extract ASCII name from buffer (supports variable length)
 * S-series patches use 12 characters, tones use 8 characters
 */
export function parseName(data: number[], offset: number, length: number = 8): string {
    let name = '';
    for (let i = 0; i < length; i++) {
        const char = data[offset + i] & 0x7F;
        if (char >= 0x20 && char <= 0x7E) {
            name += String.fromCharCode(char);
        } else {
            name += ' ';
        }
    }
    return name.trimEnd();
}

/**
 * Encode ASCII name to buffer (supports variable length)
 */
export function encodeName(name: string, length: number = 8): number[] {
    const result: number[] = [];
    const padded = name.padEnd(length, ' ').substring(0, length);
    for (let i = 0; i < length; i++) {
        result.push(padded.charCodeAt(i) & 0x7F);
    }
    return result;
}

// =============================================================================
// Address Encoding/Decoding
// =============================================================================

/**
 * Extract 21-bit address from 3 bytes (7-bit MIDI encoding)
 */
export function parse21BitAddress(data: number[], offset: number): number {
    return (
        ((data[offset] & 0x7F) << 14) |
        ((data[offset + 1] & 0x7F) << 7) |
        (data[offset + 2] & 0x7F)
    );
}

/**
 * Encode 21-bit address to 3 bytes (7-bit MIDI encoding)
 */
export function encode21BitAddress(value: number): number[] {
    return [
        (value >> 14) & 0x7F,
        (value >> 7) & 0x7F,
        value & 0x7F,
    ];
}

/**
 * Extract 24-bit wave address from 3 bytes
 * Used for tone wave parameters (START/END/LOOP points)
 */
export function parse24BitAddress(data: number[], offset: number): number {
    const b0 = data[offset] ?? 0;
    const b1 = data[offset + 1] ?? 0;
    const b2 = data[offset + 2] ?? 0;
    return (b0 << 16) | (b1 << 8) | b2;
}

/**
 * Encode 24-bit wave address to 3 bytes
 */
export function encode24BitAddress(value: number): number[] {
    return [
        (value >> 16) & 0xFF,
        (value >> 8) & 0xFF,
        value & 0xFF,
    ];
}

// =============================================================================
// Signed Value Encoding
// =============================================================================

/**
 * Convert signed 7-bit value (64 = 0, range -64 to +63)
 */
export function parseSignedValue(value: number, center: number = 64): number {
    return value - center;
}

/**
 * Encode signed value to 7-bit (center = 64)
 */
export function encodeSignedValue(value: number, center: number = 64): number {
    return Math.max(0, Math.min(127, value + center));
}

// =============================================================================
// Envelope Parsing/Encoding
// =============================================================================

/**
 * Parse 8-point envelope from tone data
 *
 * @param data - De-nibblized tone data
 * @param sustainOffset - Byte offset for sustain point
 * @param endOffset - Byte offset for end point
 * @param levelsStart - Byte offset for first level
 * @returns Parsed envelope
 */
export function parseEnvelope(
    data: number[],
    sustainOffset: number,
    endOffset: number,
    levelsStart: number
): SSeriesEnvelope {
    const levels: [number, number, number, number, number, number, number, number] = [
        data[levelsStart] ?? 0,
        data[levelsStart + 2] ?? 0,
        data[levelsStart + 4] ?? 0,
        data[levelsStart + 6] ?? 0,
        data[levelsStart + 8] ?? 0,
        data[levelsStart + 10] ?? 0,
        data[levelsStart + 12] ?? 0,
        data[levelsStart + 14] ?? 0,
    ];

    const rates: [number, number, number, number, number, number, number, number] = [
        data[levelsStart + 1] ?? 1,
        data[levelsStart + 3] ?? 1,
        data[levelsStart + 5] ?? 1,
        data[levelsStart + 7] ?? 1,
        data[levelsStart + 9] ?? 1,
        data[levelsStart + 11] ?? 1,
        data[levelsStart + 13] ?? 1,
        data[levelsStart + 15] ?? 1,
    ];

    // Ensure endPoint is clamped to valid range 1-8 to prevent display issues
    const rawEndPoint = data[endOffset] ?? 8;
    const endPoint = Math.max(1, Math.min(8, rawEndPoint));

    return {
        levels,
        rates,
        sustainPoint: data[sustainOffset] ?? 0,
        endPoint,
    };
}

/**
 * Encode 8-point envelope to byte array
 *
 * @param envelope - Envelope to encode
 * @param sustainOffset - Byte offset for sustain point in output
 * @param endOffset - Byte offset for end point in output
 * @param levelsStart - Byte offset for first level in output
 * @param output - Output array to write to
 */
export function encodeEnvelope(
    envelope: SSeriesEnvelope,
    sustainOffset: number,
    endOffset: number,
    levelsStart: number,
    output: number[]
): void {
    output[sustainOffset] = envelope.sustainPoint & 0x7F;
    output[endOffset] = envelope.endPoint & 0x7F;

    for (let i = 0; i < 8; i++) {
        output[levelsStart + i * 2] = envelope.levels[i] & 0x7F;
        output[levelsStart + i * 2 + 1] = Math.max(1, envelope.rates[i]) & 0x7F;
    }
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate device ID is in range
 */
export function isValidDeviceId(id: number): boolean {
    return id >= 0 && id <= 31;
}

/**
 * Validate MIDI channel is in range
 */
export function isValidMidiChannel(channel: number): boolean {
    return channel >= 0 && channel <= 15;
}

/**
 * Validate 7-bit MIDI value
 */
export function isValid7BitValue(value: number): boolean {
    return value >= 0 && value <= 127;
}

/**
 * Clamp value to 7-bit range
 */
export function clamp7Bit(value: number): number {
    return Math.max(0, Math.min(127, Math.round(value)));
}

// =============================================================================
// Shared Structure Parsing Functions
// =============================================================================

/**
 * Parse system parameters from SysEx data (stub — returns defaults)
 */
export function parseSeriesSystemParams(_data: number[]): SSeriesBaseSystemParams {
    return {
        masterTune: 64,
        masterLevel: 127,
        midiChannel: 0,
        deviceId: 0,
        exclusiveEnabled: true,
        progChangeEnabled: true,
        ctrlChangeEnabled: true,
        benderEnabled: true,
        modWheelEnabled: true,
        aftertouchEnabled: true,
        holdPedalEnabled: true,
    };
}

/**
 * Encode system parameters to SysEx data (stub — returns empty)
 */
export function encodeSeriesSystemParams(_params: SSeriesBaseSystemParams): number[] {
    return [];
}

/**
 * Parse patch common parameters from de-nibblized SysEx data
 */
export function parseSeriesPatchCommon(data: number[], params: SSeriesPatchParamMap): SSeriesBasePatchCommon {
    const name = parseName(data, params.name.byteOffset, params.name.size);

    const toneLayer1: number[] = [];
    for (let i = 0; i < params.toneLayer1.size; i++) {
        const value = data[params.toneLayer1.byteOffset + i];
        toneLayer1.push(value === 0xFF ? -1 : value);
    }

    const toneLayer2: number[] = [];
    for (let i = 0; i < params.toneLayer2.size; i++) {
        toneLayer2.push(data[params.toneLayer2.byteOffset + i]);
    }

    // Octave shift: clamp to valid range — uninitialized patches may have 0xFF
    const octaveShiftRaw = data[params.octaveShift.byteOffset];
    const octaveShift = octaveShiftRaw > 4 ? 0 : parseSignedValue(octaveShiftRaw, 2);

    // Output level: default to max for empty patches
    const level = name.trim() ? data[params.level.byteOffset] : 127;

    return {
        name,
        benderRange: data[params.benderRange.byteOffset],
        aftertouchSens: data[params.aftertouchSens.byteOffset],
        keyMode: parseKeyMode(data[params.keyMode.byteOffset]),
        velocityThreshold: data[params.velocityThreshold.byteOffset],
        toneLayer1,
        toneLayer2,
        copySource: data[params.copySource.byteOffset],
        octaveShift,
        level,
        detune: parseSignedValue(data[params.detune.byteOffset]),
        velocityMixRatio: data[params.velocityMixRatio.byteOffset],
        aftertouchAssign: parseAftertouchAssign(data[params.aftertouchAssign.byteOffset]),
        keyAssign: parseKeyAssign(data[params.keyAssign.byteOffset]),
        outputAssign: data[params.outputAssign.byteOffset],
    };
}

/**
 * Encode patch common parameters to de-nibblized SysEx data
 */
export function encodeSeriesPatchCommon(patchCommon: SSeriesBasePatchCommon, params: SSeriesPatchParamMap): number[] {
    const result = new Array(512).fill(0);

    const nameBytes = encodeName(patchCommon.name, params.name.size);
    for (let i = 0; i < params.name.size; i++) {
        result[params.name.byteOffset + i] = nameBytes[i];
    }

    result[params.benderRange.byteOffset] = patchCommon.benderRange;
    result[params.aftertouchSens.byteOffset] = patchCommon.aftertouchSens;
    result[params.keyMode.byteOffset] = encodeKeyMode(patchCommon.keyMode);
    result[params.velocityThreshold.byteOffset] = patchCommon.velocityThreshold;

    for (let i = 0; i < params.toneLayer1.size; i++) {
        const value = patchCommon.toneLayer1[i];
        result[params.toneLayer1.byteOffset + i] = value === -1 ? 0xFF : value;
    }

    for (let i = 0; i < params.toneLayer2.size; i++) {
        result[params.toneLayer2.byteOffset + i] = patchCommon.toneLayer2[i];
    }

    result[params.copySource.byteOffset] = patchCommon.copySource;
    result[params.octaveShift.byteOffset] = encodeSignedValue(patchCommon.octaveShift, 2);
    result[params.level.byteOffset] = patchCommon.level;
    result[params.detune.byteOffset] = encodeSignedValue(patchCommon.detune);
    result[params.velocityMixRatio.byteOffset] = patchCommon.velocityMixRatio;
    result[params.aftertouchAssign.byteOffset] = encodeAftertouchAssign(patchCommon.aftertouchAssign);
    result[params.keyAssign.byteOffset] = encodeKeyAssign(patchCommon.keyAssign);
    result[params.outputAssign.byteOffset] = patchCommon.outputAssign;

    return result;
}

/**
 * Create an empty patch common structure
 */
export function createEmptySeriesPatchCommon(): SSeriesBasePatchCommon {
    return {
        name: '',
        keyMode: 'normal',
        benderRange: 2,
        aftertouchSens: 0,
        velocityThreshold: 64,
        velocityMixRatio: 64,
        level: 127,
        detune: 0,
        octaveShift: 0,
        aftertouchAssign: 'modulation',
        keyAssign: 'rotary',
        outputAssign: 0,
        toneLayer1: new Array(109).fill(-1),
        toneLayer2: new Array(109).fill(0),
        copySource: 0,
    };
}

/**
 * Parse tone parameters from de-nibblized SysEx data
 */
export function parseSeriesTone(data: number[], offsets: SSeriesToneOffsetMap): SSeriesBaseTone {
    const getByte = (offset: number, defaultVal: number = 0): number =>
        data[offset] ?? defaultVal;

    const wave: SSeriesWaveParams = {
        bank: getByte(offsets.WAVE_BANK),
        segmentTop: getByte(offsets.WAVE_SEGMENT_TOP),
        segmentLength: getByte(offsets.WAVE_SEGMENT_LENGTH),
        startPoint: parse24BitAddress(data, offsets.START_POINT),
        endPoint: parse24BitAddress(data, offsets.END_POINT),
        loopPoint: parse24BitAddress(data, offsets.LOOP_POINT),
        loopLength: parse24BitAddress(data, offsets.LOOP_LENGTH),
    };

    const lfo: SSeriesLfoParams = {
        rate: getByte(offsets.LFO_RATE),
        sync: getByte(offsets.LFO_SYNC) === 1,
        delay: getByte(offsets.LFO_DELAY),
        mode: parseLfoMode(getByte(offsets.LFO_MODE)),
        polarity: getByte(offsets.LFO_POLARITY) === 1,
        offset: getByte(offsets.LFO_OFFSET),
    };

    const tvaEnvelope = parseEnvelope(
        data,
        offsets.TVA_ENV_SUSTAIN_POINT,
        offsets.TVA_ENV_END_POINT,
        offsets.TVA_ENV_LEVEL_1
    );

    const tva: SSeriesTvaParams = {
        lfoDepth: getByte(offsets.TVA_LFO_DEPTH),
        keyRate: getByte(offsets.TVA_KEY_RATE),
        level: getByte(offsets.TVA_LEVEL, 127),
        velRate: getByte(offsets.TVA_VEL_RATE),
        levelCurve: parseLevelCurve(getByte(offsets.TVA_LEVEL_CURVE)),
        envelope: tvaEnvelope,
    };

    const tvfEnvelope = parseEnvelope(
        data,
        offsets.TVF_ENV_SUSTAIN_POINT,
        offsets.TVF_ENV_END_POINT,
        offsets.TVF_ENV_LEVEL_1
    );

    const tvf: SSeriesTvfParams = {
        cutoff: getByte(offsets.TVF_CUTOFF, 127),
        resonance: getByte(offsets.TVF_RESONANCE),
        keyFollow: getByte(offsets.TVF_KEY_FOLLOW),
        lfoDepth: getByte(offsets.TVF_LFO_DEPTH),
        egDepth: getByte(offsets.TVF_EG_DEPTH),
        egPolarity: parseEgPolarity(getByte(offsets.TVF_EG_POLARITY)),
        levelCurve: parseLevelCurve(getByte(offsets.TVF_LEVEL_CURVE)),
        keyRateFollow: getByte(offsets.TVF_KEY_RATE_FOLLOW),
        velRateFollow: getByte(offsets.TVF_VEL_RATE_FOLLOW),
        enabled: getByte(offsets.TVF_SWITCH) === 1,
        envelope: tvfEnvelope,
    };

    return {
        name: parseName(data, offsets.NAME, 8),
        outputAssign: getByte(offsets.OUTPUT_ASSIGN),
        sourceTone: getByte(offsets.SOURCE_TONE),
        origSubTone: getByte(offsets.ORIG_SUB_TONE),
        sampleRate: parseSampleRate(getByte(offsets.SAMPLING_FREQ)),
        originalKey: getByte(offsets.ORIG_KEY_NUMBER, 60),
        wave,
        loopMode: parseLoopMode(getByte(offsets.LOOP_MODE)),
        lfo,
        tvaLfoDepth: getByte(offsets.TVA_LFO_DEPTH),
        transpose: (() => {
            const raw = getByte(offsets.TRANSPOSE, 0);
            return raw > 127 ? raw - 256 : raw;
        })(),
        fineTune: getByte(offsets.FINE_TUNE, 0),
        tvf,
        tva,
        benderEnabled: getByte(offsets.BENDER_SWITCH) === 1,
        aftertouchEnabled: getByte(offsets.AFTERTOUCH_SWITCH) === 1,
        pitchFollow: getByte(offsets.PITCH_FOLLOW) === 1,
        recThreshold: getByte(offsets.REC_THRESHOLD),
        recPreTrigger: getByte(offsets.REC_PRE_TRIGGER),
        loopTune: (() => {
            const raw = getByte(offsets.LOOP_TUNE, 0);
            return raw > 127 ? raw - 256 : raw;
        })(),
        envZoom: getByte(offsets.ENV_ZOOM),
        copySource: getByte(offsets.COPY_SOURCE),
    };
}

/**
 * Encode tone parameters to SysEx data.
 * The `limits` parameter controls device-specific bit masks.
 */
export function encodeSeriesTone(
    tone: SSeriesBaseTone,
    offsets: SSeriesToneOffsetMap,
    toneBlockSize: number,
    limits: SSeriesDeviceLimits,
): number[] {
    const data = new Array(toneBlockSize).fill(0);

    // Name (8 bytes)
    const nameBytes = encodeName(tone.name, 8);
    for (let i = 0; i < 8; i++) {
        data[offsets.NAME + i] = nameBytes[i];
    }

    // Basic info — bit masks vary by device
    data[offsets.OUTPUT_ASSIGN] = tone.outputAssign & 0x7F;
    data[offsets.SOURCE_TONE] = tone.sourceTone & limits.sourcetoneMask;
    data[offsets.ORIG_SUB_TONE] = tone.origSubTone & 0x01;
    data[offsets.SAMPLING_FREQ] = encodeSampleRate(tone.sampleRate);
    data[offsets.ORIG_KEY_NUMBER] = tone.originalKey & 0x7F;

    // Wave parameters — bank mask varies by device
    data[offsets.WAVE_BANK] = tone.wave.bank & limits.waveBankMask;
    data[offsets.WAVE_SEGMENT_TOP] = tone.wave.segmentTop & 0x7F;
    data[offsets.WAVE_SEGMENT_LENGTH] = tone.wave.segmentLength & 0x7F;

    // 24-bit wave addresses
    const startAddr = encode24BitAddress(tone.wave.startPoint);
    const endAddr = encode24BitAddress(tone.wave.endPoint);
    const loopAddr = encode24BitAddress(tone.wave.loopPoint);
    const loopLen = encode24BitAddress(tone.wave.loopLength);

    for (let i = 0; i < 3; i++) {
        data[offsets.START_POINT + i] = startAddr[i];
        data[offsets.END_POINT + i] = endAddr[i];
        data[offsets.LOOP_POINT + i] = loopAddr[i];
        data[offsets.LOOP_LENGTH + i] = loopLen[i];
    }

    // Loop mode
    data[offsets.LOOP_MODE] = encodeLoopMode(tone.loopMode);

    // LFO parameters
    data[offsets.TVA_LFO_DEPTH] = tone.tvaLfoDepth & 0x7F;
    data[offsets.LFO_RATE] = tone.lfo.rate & 0x7F;
    data[offsets.LFO_SYNC] = tone.lfo.sync ? 1 : 0;
    data[offsets.LFO_DELAY] = tone.lfo.delay & 0x7F;
    data[offsets.LFO_MODE] = encodeLfoMode(tone.lfo.mode);
    data[offsets.LFO_POLARITY] = tone.lfo.polarity ? 1 : 0;
    data[offsets.LFO_OFFSET] = tone.lfo.offset & 0x7F;

    // Pitch parameters
    data[offsets.TRANSPOSE] = tone.transpose < 0 ? tone.transpose + 256 : tone.transpose;
    data[offsets.FINE_TUNE] = tone.fineTune & 0x7F;

    // TVF parameters
    data[offsets.TVF_CUTOFF] = tone.tvf.cutoff & 0x7F;
    data[offsets.TVF_RESONANCE] = tone.tvf.resonance & 0x7F;
    data[offsets.TVF_KEY_FOLLOW] = tone.tvf.keyFollow & 0x7F;
    data[offsets.TVF_LFO_DEPTH] = tone.tvf.lfoDepth & 0x7F;
    data[offsets.TVF_EG_DEPTH] = tone.tvf.egDepth & 0x7F;
    data[offsets.TVF_EG_POLARITY] = encodeEgPolarity(tone.tvf.egPolarity);
    data[offsets.TVF_LEVEL_CURVE] = tone.tvf.levelCurve & 0x07;
    data[offsets.TVF_KEY_RATE_FOLLOW] = tone.tvf.keyRateFollow & 0x7F;
    data[offsets.TVF_VEL_RATE_FOLLOW] = tone.tvf.velRateFollow & 0x7F;
    data[offsets.TVF_SWITCH] = tone.tvf.enabled ? 1 : 0;

    // Bender switch
    data[offsets.BENDER_SWITCH] = tone.benderEnabled ? 1 : 0;

    // TVA envelope
    encodeEnvelope(
        tone.tva.envelope,
        offsets.TVA_ENV_SUSTAIN_POINT,
        offsets.TVA_ENV_END_POINT,
        offsets.TVA_ENV_LEVEL_1,
        data
    );

    // TVA additional parameters
    data[offsets.TVA_KEY_RATE] = tone.tva.keyRate & 0x7F;
    data[offsets.TVA_LEVEL] = tone.tva.level & 0x7F;
    data[offsets.TVA_VEL_RATE] = tone.tva.velRate & 0x7F;
    data[offsets.TVA_LEVEL_CURVE] = tone.tva.levelCurve & 0x07;

    // Recording parameters — copySource mask varies by device
    data[offsets.REC_THRESHOLD] = tone.recThreshold & 0x7F;
    data[offsets.REC_PRE_TRIGGER] = tone.recPreTrigger & 0x03;
    data[offsets.COPY_SOURCE] = tone.copySource & limits.copySourceMask;
    data[offsets.LOOP_TUNE] = tone.loopTune < 0 ? tone.loopTune + 256 : tone.loopTune;

    // Additional settings
    data[offsets.PITCH_FOLLOW] = tone.pitchFollow ? 1 : 0;
    data[offsets.ENV_ZOOM] = tone.envZoom & 0x07;

    // TVF envelope
    encodeEnvelope(
        tone.tvf.envelope,
        offsets.TVF_ENV_SUSTAIN_POINT,
        offsets.TVF_ENV_END_POINT,
        offsets.TVF_ENV_LEVEL_1,
        data
    );

    // Aftertouch switch
    data[offsets.AFTERTOUCH_SWITCH] = tone.aftertouchEnabled ? 1 : 0;

    return data;
}
