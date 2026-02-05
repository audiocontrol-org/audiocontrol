/**
 * Roland S-330 Parameter Definitions
 *
 * Parameter parsing, validation, and conversion utilities.
 * See /docs/s330_sysex.md for complete protocol documentation.
 *
 * @packageDocumentation
 */

import {
    S330SystemParams,
    S330PatchCommon,
    S330Tone,
    S330Envelope,
    S330TvaParams,
    S330TvfParams,
    S330LfoParams,
    S330WaveParams,
    S330KeyMode,
    S330AftertouchAssign,
    S330KeyAssign,
    S330LoopMode,
    S330SampleRate,
    S330EgPolarity,
    S330LfoMode,
    S330LevelCurve,
} from './s330-types.js';

import {
    SYSTEM_OFFSETS,
    PATCH_COMMON_OFFSETS,
    TONE_OFFSETS,
    TONE_BLOCK_SIZE,
    PATCH_PARAMS,
} from './s330-addresses.js';

// =============================================================================
// Value Conversion Functions
// =============================================================================

/**
 * Convert key mode byte to enum
 */
export function parseKeyMode(value: number): S330KeyMode {
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
export function encodeKeyMode(mode: S330KeyMode): number {
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
export function parseAftertouchAssign(value: number): S330AftertouchAssign {
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
export function encodeAftertouchAssign(assign: S330AftertouchAssign): number {
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
export function parseKeyAssign(value: number): S330KeyAssign {
    return value === 1 ? 'fix' : 'rotary';
}

/**
 * Convert key assign enum to byte
 */
export function encodeKeyAssign(assign: S330KeyAssign): number {
    return assign === 'fix' ? 1 : 0;
}

/**
 * Convert loop mode byte to enum
 */
export function parseLoopMode(value: number): S330LoopMode {
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
export function encodeLoopMode(mode: S330LoopMode): number {
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
export function parseEgPolarity(value: number): S330EgPolarity {
    return value === 1 ? 'reverse' : 'normal';
}

/**
 * Convert EG polarity enum to byte
 */
export function encodeEgPolarity(polarity: S330EgPolarity): number {
    return polarity === 'reverse' ? 1 : 0;
}

/**
 * Convert LFO mode byte to enum
 */
export function parseLfoMode(value: number): S330LfoMode {
    return value === 1 ? 'one-shot' : 'normal';
}

/**
 * Convert LFO mode enum to byte
 */
export function encodeLfoMode(mode: S330LfoMode): number {
    return mode === 'one-shot' ? 1 : 0;
}

/**
 * Parse level curve value (clamp to 0-5)
 */
export function parseLevelCurve(value: number): S330LevelCurve {
    const clamped = Math.max(0, Math.min(5, value));
    return clamped as S330LevelCurve;
}

/**
 * Convert sample rate byte to enum
 */
export function parseSampleRate(value: number): S330SampleRate {
    return value === 1 ? '30kHz' : '15kHz';
}

/**
 * Convert sample rate enum to byte
 */
export function encodeSampleRate(rate: S330SampleRate): number {
    return rate === '30kHz' ? 1 : 0;
}

/**
 * Extract ASCII name from buffer (supports variable length for S-330 patches)
 * S-330 patches use 12 characters, tones use 8 characters
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
 * Encode ASCII name to buffer (supports variable length for S-330 patches)
 */
export function encodeName(name: string, length: number = 8): number[] {
    const result: number[] = [];
    const padded = name.padEnd(length, ' ').substring(0, length);
    for (let i = 0; i < length; i++) {
        result.push(padded.charCodeAt(i) & 0x7F);
    }
    return result;
}

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
): S330Envelope {
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

    return {
        levels,
        rates,
        sustainPoint: data[sustainOffset] ?? 0,
        endPoint: data[endOffset] ?? 8,
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
    envelope: S330Envelope,
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
// Structure Parsing Functions
// =============================================================================

/**
 * Parse system parameters from SysEx data
 * TODO: Implement actual parsing logic
 */
export function parseSystemParams(_data: number[]): S330SystemParams {
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
 * Data should be de-nibblized patch data (512 bytes total).
 * Offsets are taken from PATCH_PARAMS for consistency with the client setters.
 *
 * @param data De-nibblized patch data (512 bytes)
 * @returns Parsed patch common parameters
 */
export function parsePatchCommon(data: number[]): S330PatchCommon {
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

    // Tone layer 1 (109 entries, each is -1 to 31; 0xFF = -1 = OFF)
    const toneLayer1: number[] = [];
    for (let i = 0; i < PATCH_PARAMS.toneLayer1.size; i++) {
        const value = data[PATCH_PARAMS.toneLayer1.byteOffset + i];
        toneLayer1.push(value === 0xFF ? -1 : value);
    }

    // Tone layer 2 (109 entries)
    const toneLayer2: number[] = [];
    for (let i = 0; i < PATCH_PARAMS.toneLayer2.size; i++) {
        toneLayer2.push(data[PATCH_PARAMS.toneLayer2.byteOffset + i]);
    }

    // Copy source
    const copySource = data[PATCH_PARAMS.copySource.byteOffset];

    // Octave shift (signed value -2 to +2)
    const octaveShift = parseSignedValue(data[PATCH_PARAMS.octaveShift.byteOffset], 2);

    // Output level
    const level = data[PATCH_PARAMS.level.byteOffset];

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
 * Create an empty patch common structure
 * Used when a patch slot is empty or read fails.
 *
 * @param index Optional patch index for identification
 * @returns Empty patch common with default values
 */
export function createEmptyPatchCommon(index?: number): S330PatchCommon {
    // Create empty tone layer arrays (109 entries each)
    const emptyToneLayer1 = new Array(109).fill(-1); // -1 = OFF for layer 1
    const emptyToneLayer2 = new Array(109).fill(0);  // 0 = first tone for layer 2

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
 * Parses de-nibblized tone data (256 bytes) into S330Tone structure.
 * Uses TONE_OFFSETS for byte positions.
 *
 * @param data De-nibblized tone data (256 bytes)
 * @returns Parsed tone parameters
 */
export function parseTone(data: number[]): S330Tone {
    // Helper to safely get a byte with default
    const getByte = (offset: number, defaultVal: number = 0): number =>
        data[offset] ?? defaultVal;

    // Parse wave parameters
    const wave: S330WaveParams = {
        bank: getByte(TONE_OFFSETS.WAVE_BANK),
        segmentTop: getByte(TONE_OFFSETS.WAVE_SEGMENT_TOP),
        segmentLength: getByte(TONE_OFFSETS.WAVE_SEGMENT_LENGTH),
        startPoint: parse24BitAddress(data, TONE_OFFSETS.START_POINT),
        endPoint: parse24BitAddress(data, TONE_OFFSETS.END_POINT),
        loopPoint: parse24BitAddress(data, TONE_OFFSETS.LOOP_POINT),
        loopLength: parse24BitAddress(data, TONE_OFFSETS.LOOP_LENGTH),
    };

    // Parse LFO parameters
    const lfo: S330LfoParams = {
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
    const tva: S330TvaParams = {
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
    const tvf: S330TvfParams = {
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
        // Basic info
        name: parseName(data, TONE_OFFSETS.NAME, 8),
        outputAssign: getByte(TONE_OFFSETS.OUTPUT_ASSIGN),
        sourceTone: getByte(TONE_OFFSETS.SOURCE_TONE),
        origSubTone: getByte(TONE_OFFSETS.ORIG_SUB_TONE),
        sampleRate: parseSampleRate(getByte(TONE_OFFSETS.SAMPLING_FREQ)),
        originalKey: getByte(TONE_OFFSETS.ORIG_KEY_NUMBER, 60),

        // Wave parameters
        wave,
        loopMode: parseLoopMode(getByte(TONE_OFFSETS.LOOP_MODE)),

        // LFO
        lfo,
        tvaLfoDepth: getByte(TONE_OFFSETS.TVA_LFO_DEPTH),

        // Pitch
        transpose: getByte(TONE_OFFSETS.TRANSPOSE, 64),
        fineTune: parseSignedValue(getByte(TONE_OFFSETS.FINE_TUNE, 64)),

        // TVF and TVA
        tvf,
        tva,

        // Switches
        benderEnabled: getByte(TONE_OFFSETS.BENDER_SWITCH) === 1,
        aftertouchEnabled: getByte(TONE_OFFSETS.AFTERTOUCH_SWITCH) === 1,
        pitchFollow: getByte(TONE_OFFSETS.PITCH_FOLLOW) === 1,

        // Recording/misc parameters
        recThreshold: getByte(TONE_OFFSETS.REC_THRESHOLD),
        recPreTrigger: getByte(TONE_OFFSETS.REC_PRE_TRIGGER),
        loopTune: parseSignedValue(getByte(TONE_OFFSETS.LOOP_TUNE, 64)),
        envZoom: getByte(TONE_OFFSETS.ENV_ZOOM),
        copySource: getByte(TONE_OFFSETS.COPY_SOURCE),
    };
}

// =============================================================================
// Structure Encoding Functions
// =============================================================================

/**
 * Encode system parameters to SysEx data
 * TODO: Implement actual encoding logic
 */
export function encodeSystemParams(_params: S330SystemParams): number[] {
    // Stub implementation
    return [];
}

/**
 * Encode patch common parameters to de-nibblized SysEx data
 *
 * Reverses parsePatchCommon to convert patch parameters back to
 * the 512-byte de-nibblized format expected by the S-330.
 * Offsets are taken from PATCH_PARAMS for consistency with the client setters.
 *
 * @param params Patch common parameters to encode
 * @returns 512-byte array ready for nibblization and transmission
 */
export function encodePatchCommon(params: S330PatchCommon): number[] {
    // Create 512-byte array initialized to 0
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
    for (let i = 0; i < PATCH_PARAMS.toneLayer1.size; i++) {
        const value = params.toneLayer1[i];
        result[PATCH_PARAMS.toneLayer1.byteOffset + i] = value === -1 ? 0xFF : value;
    }

    // Tone layer 2 (109 entries)
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
 * Encodes S330Tone structure to 256-byte array for transmission.
 * Uses TONE_OFFSETS for byte positions.
 *
 * @param tone Tone parameters to encode
 * @returns 256-byte array ready for nibblization
 */
export function encodeTone(tone: S330Tone): number[] {
    const data = new Array(TONE_BLOCK_SIZE).fill(0);

    // Name (8 bytes)
    const nameBytes = encodeName(tone.name, 8);
    for (let i = 0; i < 8; i++) {
        data[TONE_OFFSETS.NAME + i] = nameBytes[i];
    }

    // Basic info
    data[TONE_OFFSETS.OUTPUT_ASSIGN] = tone.outputAssign & 0x7F;
    data[TONE_OFFSETS.SOURCE_TONE] = tone.sourceTone & 0x1F;
    data[TONE_OFFSETS.ORIG_SUB_TONE] = tone.origSubTone & 0x01;
    data[TONE_OFFSETS.SAMPLING_FREQ] = encodeSampleRate(tone.sampleRate);
    data[TONE_OFFSETS.ORIG_KEY_NUMBER] = tone.originalKey & 0x7F;

    // Wave parameters
    data[TONE_OFFSETS.WAVE_BANK] = tone.wave.bank & 0x01;
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
    data[TONE_OFFSETS.TRANSPOSE] = tone.transpose & 0x7F;
    data[TONE_OFFSETS.FINE_TUNE] = encodeSignedValue(tone.fineTune);

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
    data[TONE_OFFSETS.COPY_SOURCE] = tone.copySource & 0x1F;
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
 * Validate patch number is in range
 */
export function isValidPatchNumber(num: number): boolean {
    return num >= 0 && num <= 63;
}

/**
 * Validate tone number is in range
 */
export function isValidToneNumber(num: number): boolean {
    return num >= 0 && num <= 31;
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
