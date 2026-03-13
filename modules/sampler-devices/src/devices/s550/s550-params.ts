/**
 * Roland S-550 Parameter Definitions
 *
 * Parameter parsing, validation, and conversion utilities.
 * Uses shared S-series utilities and adds S-550 specific parsing.
 *
 * @packageDocumentation
 */

import type {
    SSeriesKeyMode,
    SSeriesAftertouchAssign,
    SSeriesKeyAssign,
    SSeriesLoopMode,
    SSeriesSampleRate,
    SSeriesEgPolarity,
    SSeriesLfoMode,
    SSeriesLevelCurve,
    SSeriesEnvelope,
    SSeriesWaveParams,
    SSeriesLfoParams,
    SSeriesTvaParams,
    SSeriesTvfParams,
} from '../roland-s-series/index.js';

import type {
    S550SystemParams,
    S550PatchCommon,
    S550Tone,
} from './s550-types.js';

import {
    TONE_OFFSETS,
    TONE_BLOCK_SIZE,
    PATCH_PARAMS,
} from './s550-addresses.js';

// =============================================================================
// Re-export shared parameter utilities
// =============================================================================

export {
    parseKeyMode,
    encodeKeyMode,
    parseAftertouchAssign,
    encodeAftertouchAssign,
    parseKeyAssign,
    encodeKeyAssign,
    parseLoopMode,
    encodeLoopMode,
    parseEgPolarity,
    encodeEgPolarity,
    parseLfoMode,
    encodeLfoMode,
    parseLevelCurve,
    parseSampleRate,
    encodeSampleRate,
    parseName,
    encodeName,
    parse21BitAddress,
    encode21BitAddress,
    parse24BitAddress,
    encode24BitAddress,
    parseSignedValue,
    encodeSignedValue,
    parseEnvelope,
    encodeEnvelope,
    isValidDeviceId,
    isValidMidiChannel,
    isValid7BitValue,
    clamp7Bit,
} from '../roland-s-series/index.js';

// Import for local use
import {
    parseKeyMode,
    parseAftertouchAssign,
    parseKeyAssign,
    parseLoopMode,
    parseEgPolarity,
    parseLfoMode,
    parseLevelCurve,
    parseSampleRate,
    parseName,
    encodeName,
    parse24BitAddress,
    encode24BitAddress,
    parseSignedValue,
    encodeSignedValue,
    parseEnvelope,
    encodeEnvelope,
    encodeKeyMode,
    encodeAftertouchAssign,
    encodeKeyAssign,
    encodeLoopMode,
    encodeEgPolarity,
    encodeLfoMode,
    encodeSampleRate,
} from '../roland-s-series/index.js';

// =============================================================================
// Structure Parsing Functions
// =============================================================================

/**
 * Parse system parameters from SysEx data
 */
export function parseSystemParams(_data: number[]): S550SystemParams {
    // Stub implementation - returns default values
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
 * Parse patch common parameters from de-nibblized SysEx data
 *
 * @param data De-nibblized patch data (512 bytes)
 * @returns Parsed patch common parameters
 */
export function parsePatchCommon(data: number[]): S550PatchCommon {
    // Patch name (12 characters)
    const name = parseName(data, PATCH_PARAMS.name.byteOffset, PATCH_PARAMS.name.size);

    // Bend range
    const benderRange = data[PATCH_PARAMS.benderRange.byteOffset];

    // Aftertouch sensitivity
    const aftertouchSens = data[PATCH_PARAMS.aftertouchSens.byteOffset];

    // Key mode
    const keyMode = parseKeyMode(data[PATCH_PARAMS.keyMode.byteOffset]);

    // Velocity threshold
    const velocityThreshold = data[PATCH_PARAMS.velocityThreshold.byteOffset];

    // Tone layer 1 (109 entries, each is -1 to 63; 0xFF = -1 = OFF)
    // S-550 can reference tones 0-63 (vs S-330's 0-31)
    const toneLayer1: number[] = [];
    for (let i = 0; i < PATCH_PARAMS.toneLayer1.size; i++) {
        const value = data[PATCH_PARAMS.toneLayer1.byteOffset + i];
        toneLayer1.push(value === 0xFF ? -1 : value);
    }

    // Tone layer 2 (109 entries, values 0-63)
    const toneLayer2: number[] = [];
    for (let i = 0; i < PATCH_PARAMS.toneLayer2.size; i++) {
        toneLayer2.push(data[PATCH_PARAMS.toneLayer2.byteOffset + i]);
    }

    // Copy source
    const copySource = data[PATCH_PARAMS.copySource.byteOffset];

    // Octave shift (signed value -2 to +2)
    const octaveShift = parseSignedValue(data[PATCH_PARAMS.octaveShift.byteOffset], 2);

    // Output level (default to max for empty patches)
    const level = name.trim() ? data[PATCH_PARAMS.level.byteOffset] : 127;

    // Detune (signed value -64 to +63)
    const detune = parseSignedValue(data[PATCH_PARAMS.detune.byteOffset]);

    // Velocity mix ratio
    const velocityMixRatio = data[PATCH_PARAMS.velocityMixRatio.byteOffset];

    // Aftertouch assign
    const aftertouchAssign = parseAftertouchAssign(data[PATCH_PARAMS.aftertouchAssign.byteOffset]);

    // Key assign
    const keyAssign = parseKeyAssign(data[PATCH_PARAMS.keyAssign.byteOffset]);

    // Output assign
    const outputAssign = data[PATCH_PARAMS.outputAssign.byteOffset];

    return {
        name,
        benderRange,
        aftertouchSens,
        keyMode,
        velocityThreshold,
        toneLayer1,
        toneLayer2,
        copySource,
        octaveShift,
        level,
        detune,
        velocityMixRatio,
        aftertouchAssign,
        keyAssign,
        outputAssign,
    };
}

/**
 * Create an empty patch common structure for S-550
 */
export function createEmptyPatchCommon(_index?: number): S550PatchCommon {
    const emptyToneLayer1 = new Array(109).fill(-1);
    const emptyToneLayer2 = new Array(109).fill(0);

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
        toneLayer1: emptyToneLayer1,
        toneLayer2: emptyToneLayer2,
        copySource: 0,
    };
}

/**
 * Parse tone parameters from SysEx data
 *
 * @param data De-nibblized tone data (256 bytes)
 * @returns Parsed tone parameters
 */
export function parseTone(data: number[]): S550Tone {
    const getByte = (offset: number, defaultVal: number = 0): number =>
        data[offset] ?? defaultVal;

    // Parse wave parameters
    // S-550 has 4 wave banks (0-3) vs S-330's 2 (0-1)
    const wave: SSeriesWaveParams = {
        bank: getByte(TONE_OFFSETS.WAVE_BANK),
        segmentTop: getByte(TONE_OFFSETS.WAVE_SEGMENT_TOP),
        segmentLength: getByte(TONE_OFFSETS.WAVE_SEGMENT_LENGTH),
        startPoint: parse24BitAddress(data, TONE_OFFSETS.START_POINT),
        endPoint: parse24BitAddress(data, TONE_OFFSETS.END_POINT),
        loopPoint: parse24BitAddress(data, TONE_OFFSETS.LOOP_POINT),
        loopLength: parse24BitAddress(data, TONE_OFFSETS.LOOP_LENGTH),
    };

    // Parse LFO parameters
    const lfo: SSeriesLfoParams = {
        rate: getByte(TONE_OFFSETS.LFO_RATE),
        sync: getByte(TONE_OFFSETS.LFO_SYNC) === 1,
        delay: getByte(TONE_OFFSETS.LFO_DELAY),
        mode: parseLfoMode(getByte(TONE_OFFSETS.LFO_MODE)),
        polarity: getByte(TONE_OFFSETS.LFO_POLARITY) === 1,
        offset: getByte(TONE_OFFSETS.LFO_OFFSET),
    };

    // Parse TVA envelope
    const tvaEnvelope = parseEnvelope(
        data,
        TONE_OFFSETS.TVA_ENV_SUSTAIN_POINT,
        TONE_OFFSETS.TVA_ENV_END_POINT,
        TONE_OFFSETS.TVA_ENV_LEVEL_1
    );

    // Parse TVA parameters
    const tva: SSeriesTvaParams = {
        lfoDepth: getByte(TONE_OFFSETS.TVA_LFO_DEPTH),
        keyRate: getByte(TONE_OFFSETS.TVA_KEY_RATE),
        level: getByte(TONE_OFFSETS.TVA_LEVEL, 127),
        velRate: getByte(TONE_OFFSETS.TVA_VEL_RATE),
        levelCurve: parseLevelCurve(getByte(TONE_OFFSETS.TVA_LEVEL_CURVE)),
        envelope: tvaEnvelope,
    };

    // Parse TVF envelope
    const tvfEnvelope = parseEnvelope(
        data,
        TONE_OFFSETS.TVF_ENV_SUSTAIN_POINT,
        TONE_OFFSETS.TVF_ENV_END_POINT,
        TONE_OFFSETS.TVF_ENV_LEVEL_1
    );

    // Parse TVF parameters
    const tvf: SSeriesTvfParams = {
        cutoff: getByte(TONE_OFFSETS.TVF_CUTOFF, 127),
        resonance: getByte(TONE_OFFSETS.TVF_RESONANCE),
        keyFollow: getByte(TONE_OFFSETS.TVF_KEY_FOLLOW),
        lfoDepth: getByte(TONE_OFFSETS.TVF_LFO_DEPTH),
        egDepth: getByte(TONE_OFFSETS.TVF_EG_DEPTH),
        egPolarity: parseEgPolarity(getByte(TONE_OFFSETS.TVF_EG_POLARITY)),
        levelCurve: parseLevelCurve(getByte(TONE_OFFSETS.TVF_LEVEL_CURVE)),
        keyRateFollow: getByte(TONE_OFFSETS.TVF_KEY_RATE_FOLLOW),
        velRateFollow: getByte(TONE_OFFSETS.TVF_VEL_RATE_FOLLOW),
        enabled: getByte(TONE_OFFSETS.TVF_SWITCH) === 1,
        envelope: tvfEnvelope,
    };

    return {
        name: parseName(data, TONE_OFFSETS.NAME, 8),
        outputAssign: getByte(TONE_OFFSETS.OUTPUT_ASSIGN),
        // S-550 has 64 tones, so sourceTone can be 0-63
        sourceTone: getByte(TONE_OFFSETS.SOURCE_TONE),
        origSubTone: getByte(TONE_OFFSETS.ORIG_SUB_TONE),
        sampleRate: parseSampleRate(getByte(TONE_OFFSETS.SAMPLING_FREQ)),
        originalKey: getByte(TONE_OFFSETS.ORIG_KEY_NUMBER, 60),
        wave,
        loopMode: parseLoopMode(getByte(TONE_OFFSETS.LOOP_MODE)),
        lfo,
        tvaLfoDepth: getByte(TONE_OFFSETS.TVA_LFO_DEPTH),
        transpose: (() => {
            const raw = getByte(TONE_OFFSETS.TRANSPOSE, 0);
            return raw > 127 ? raw - 256 : raw;
        })(),
        fineTune: getByte(TONE_OFFSETS.FINE_TUNE, 0),
        tvf,
        tva,
        benderEnabled: getByte(TONE_OFFSETS.BENDER_SWITCH) === 1,
        aftertouchEnabled: getByte(TONE_OFFSETS.AFTERTOUCH_SWITCH) === 1,
        pitchFollow: getByte(TONE_OFFSETS.PITCH_FOLLOW) === 1,
        recThreshold: getByte(TONE_OFFSETS.REC_THRESHOLD),
        recPreTrigger: getByte(TONE_OFFSETS.REC_PRE_TRIGGER),
        loopTune: parseSignedValue(getByte(TONE_OFFSETS.LOOP_TUNE, 64)),
        envZoom: getByte(TONE_OFFSETS.ENV_ZOOM),
        // S-550 has 64 tones, so copySource can be 0-63
        copySource: getByte(TONE_OFFSETS.COPY_SOURCE),
    };
}

// =============================================================================
// Structure Encoding Functions
// =============================================================================

/**
 * Encode system parameters to SysEx data
 */
export function encodeSystemParams(_params: S550SystemParams): number[] {
    // Stub implementation
    return [];
}

/**
 * Encode patch common parameters to de-nibblized SysEx data
 *
 * @param params Patch common parameters to encode
 * @returns 512-byte array ready for nibblization and transmission
 */
export function encodePatchCommon(params: S550PatchCommon): number[] {
    const result = new Array(512).fill(0);

    // Patch name
    const nameBytes = encodeName(params.name, PATCH_PARAMS.name.size);
    for (let i = 0; i < PATCH_PARAMS.name.size; i++) {
        result[PATCH_PARAMS.name.byteOffset + i] = nameBytes[i];
    }

    // Bend range
    result[PATCH_PARAMS.benderRange.byteOffset] = params.benderRange;

    // Aftertouch sensitivity
    result[PATCH_PARAMS.aftertouchSens.byteOffset] = params.aftertouchSens;

    // Key mode
    result[PATCH_PARAMS.keyMode.byteOffset] = encodeKeyMode(params.keyMode);

    // Velocity threshold
    result[PATCH_PARAMS.velocityThreshold.byteOffset] = params.velocityThreshold;

    // Tone layer 1 (109 entries; -1 maps to 0xFF for OFF)
    // S-550 allows values 0-63 (vs S-330's 0-31)
    for (let i = 0; i < PATCH_PARAMS.toneLayer1.size; i++) {
        const value = params.toneLayer1[i];
        result[PATCH_PARAMS.toneLayer1.byteOffset + i] = value === -1 ? 0xFF : value;
    }

    // Tone layer 2 (109 entries, values 0-63)
    for (let i = 0; i < PATCH_PARAMS.toneLayer2.size; i++) {
        result[PATCH_PARAMS.toneLayer2.byteOffset + i] = params.toneLayer2[i];
    }

    // Copy source
    result[PATCH_PARAMS.copySource.byteOffset] = params.copySource;

    // Octave shift (signed value -2 to +2)
    result[PATCH_PARAMS.octaveShift.byteOffset] = encodeSignedValue(params.octaveShift, 2);

    // Output level
    result[PATCH_PARAMS.level.byteOffset] = params.level;

    // Detune (signed value -64 to +63)
    result[PATCH_PARAMS.detune.byteOffset] = encodeSignedValue(params.detune);

    // Velocity mix ratio
    result[PATCH_PARAMS.velocityMixRatio.byteOffset] = params.velocityMixRatio;

    // Aftertouch assign
    result[PATCH_PARAMS.aftertouchAssign.byteOffset] = encodeAftertouchAssign(params.aftertouchAssign);

    // Key assign
    result[PATCH_PARAMS.keyAssign.byteOffset] = encodeKeyAssign(params.keyAssign);

    // Output assign
    result[PATCH_PARAMS.outputAssign.byteOffset] = params.outputAssign;

    return result;
}

/**
 * Encode tone parameters to SysEx data
 *
 * @param tone Tone parameters to encode
 * @returns 256-byte array ready for nibblization
 */
export function encodeTone(tone: S550Tone): number[] {
    const data = new Array(TONE_BLOCK_SIZE).fill(0);

    // Name (8 bytes)
    const nameBytes = encodeName(tone.name, 8);
    for (let i = 0; i < 8; i++) {
        data[TONE_OFFSETS.NAME + i] = nameBytes[i];
    }

    // Basic info
    data[TONE_OFFSETS.OUTPUT_ASSIGN] = tone.outputAssign & 0x7F;
    // S-550 has 64 tones, so sourceTone uses 6 bits (0-63)
    data[TONE_OFFSETS.SOURCE_TONE] = tone.sourceTone & 0x3F;
    data[TONE_OFFSETS.ORIG_SUB_TONE] = tone.origSubTone & 0x01;
    data[TONE_OFFSETS.SAMPLING_FREQ] = encodeSampleRate(tone.sampleRate);
    data[TONE_OFFSETS.ORIG_KEY_NUMBER] = tone.originalKey & 0x7F;

    // Wave parameters
    // S-550 has 4 wave banks (0-3), so bank uses 2 bits
    data[TONE_OFFSETS.WAVE_BANK] = tone.wave.bank & 0x03;
    data[TONE_OFFSETS.WAVE_SEGMENT_TOP] = tone.wave.segmentTop & 0x7F;
    data[TONE_OFFSETS.WAVE_SEGMENT_LENGTH] = tone.wave.segmentLength & 0x7F;

    // 24-bit wave addresses
    const startAddr = encode24BitAddress(tone.wave.startPoint);
    const endAddr = encode24BitAddress(tone.wave.endPoint);
    const loopAddr = encode24BitAddress(tone.wave.loopPoint);
    const loopLen = encode24BitAddress(tone.wave.loopLength);

    for (let i = 0; i < 3; i++) {
        data[TONE_OFFSETS.START_POINT + i] = startAddr[i];
        data[TONE_OFFSETS.END_POINT + i] = endAddr[i];
        data[TONE_OFFSETS.LOOP_POINT + i] = loopAddr[i];
        data[TONE_OFFSETS.LOOP_LENGTH + i] = loopLen[i];
    }

    // Loop mode
    data[TONE_OFFSETS.LOOP_MODE] = encodeLoopMode(tone.loopMode);

    // LFO parameters
    data[TONE_OFFSETS.TVA_LFO_DEPTH] = tone.tvaLfoDepth & 0x7F;
    data[TONE_OFFSETS.LFO_RATE] = tone.lfo.rate & 0x7F;
    data[TONE_OFFSETS.LFO_SYNC] = tone.lfo.sync ? 1 : 0;
    data[TONE_OFFSETS.LFO_DELAY] = tone.lfo.delay & 0x7F;
    data[TONE_OFFSETS.LFO_MODE] = encodeLfoMode(tone.lfo.mode);
    data[TONE_OFFSETS.LFO_POLARITY] = tone.lfo.polarity ? 1 : 0;
    data[TONE_OFFSETS.LFO_OFFSET] = tone.lfo.offset & 0x7F;

    // Pitch parameters
    data[TONE_OFFSETS.TRANSPOSE] = tone.transpose < 0 ? tone.transpose + 256 : tone.transpose;
    data[TONE_OFFSETS.FINE_TUNE] = tone.fineTune & 0x7F;

    // TVF parameters
    data[TONE_OFFSETS.TVF_CUTOFF] = tone.tvf.cutoff & 0x7F;
    data[TONE_OFFSETS.TVF_RESONANCE] = tone.tvf.resonance & 0x7F;
    data[TONE_OFFSETS.TVF_KEY_FOLLOW] = tone.tvf.keyFollow & 0x7F;
    data[TONE_OFFSETS.TVF_LFO_DEPTH] = tone.tvf.lfoDepth & 0x7F;
    data[TONE_OFFSETS.TVF_EG_DEPTH] = tone.tvf.egDepth & 0x7F;
    data[TONE_OFFSETS.TVF_EG_POLARITY] = encodeEgPolarity(tone.tvf.egPolarity);
    data[TONE_OFFSETS.TVF_LEVEL_CURVE] = tone.tvf.levelCurve & 0x07;
    data[TONE_OFFSETS.TVF_KEY_RATE_FOLLOW] = tone.tvf.keyRateFollow & 0x7F;
    data[TONE_OFFSETS.TVF_VEL_RATE_FOLLOW] = tone.tvf.velRateFollow & 0x7F;
    data[TONE_OFFSETS.TVF_SWITCH] = tone.tvf.enabled ? 1 : 0;

    // Bender switch
    data[TONE_OFFSETS.BENDER_SWITCH] = tone.benderEnabled ? 1 : 0;

    // TVA envelope
    encodeEnvelope(
        tone.tva.envelope,
        TONE_OFFSETS.TVA_ENV_SUSTAIN_POINT,
        TONE_OFFSETS.TVA_ENV_END_POINT,
        TONE_OFFSETS.TVA_ENV_LEVEL_1,
        data
    );

    // TVA additional parameters
    data[TONE_OFFSETS.TVA_KEY_RATE] = tone.tva.keyRate & 0x7F;
    data[TONE_OFFSETS.TVA_LEVEL] = tone.tva.level & 0x7F;
    data[TONE_OFFSETS.TVA_VEL_RATE] = tone.tva.velRate & 0x7F;
    data[TONE_OFFSETS.TVA_LEVEL_CURVE] = tone.tva.levelCurve & 0x07;

    // Recording parameters
    data[TONE_OFFSETS.REC_THRESHOLD] = tone.recThreshold & 0x7F;
    data[TONE_OFFSETS.REC_PRE_TRIGGER] = tone.recPreTrigger & 0x03;
    // S-550 has 64 tones, so copySource uses 6 bits (0-63)
    data[TONE_OFFSETS.COPY_SOURCE] = tone.copySource & 0x3F;
    data[TONE_OFFSETS.LOOP_TUNE] = encodeSignedValue(tone.loopTune);

    // Additional settings
    data[TONE_OFFSETS.PITCH_FOLLOW] = tone.pitchFollow ? 1 : 0;
    data[TONE_OFFSETS.ENV_ZOOM] = tone.envZoom & 0x07;

    // TVF envelope
    encodeEnvelope(
        tone.tvf.envelope,
        TONE_OFFSETS.TVF_ENV_SUSTAIN_POINT,
        TONE_OFFSETS.TVF_ENV_END_POINT,
        TONE_OFFSETS.TVF_ENV_LEVEL_1,
        data
    );

    // Aftertouch switch
    data[TONE_OFFSETS.AFTERTOUCH_SWITCH] = tone.aftertouchEnabled ? 1 : 0;

    return data;
}

// =============================================================================
// S-550 Specific Validation Functions
// =============================================================================

/**
 * Validate patch number is in range for S-550 (0-31)
 */
export function isValidPatchNumber(num: number): boolean {
    return num >= 0 && num <= 31;
}

/**
 * Validate tone number is in range for S-550 (0-63)
 */
export function isValidToneNumber(num: number): boolean {
    return num >= 0 && num <= 63;
}
