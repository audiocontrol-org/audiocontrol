/**
 * Roland S-550 Parameter Definitions
 *
 * Thin wrapper around shared S-series parsers with S-550 specific limits.
 *
 * @packageDocumentation
 */

import type { S550SystemParams, S550PatchCommon, S550Tone } from './s550-types.js';
import type { SSeriesDeviceLimits } from '../roland-s-series/index.js';
import { TONE_OFFSETS, TONE_BLOCK_SIZE, PATCH_PARAMS } from './s550-addresses.js';

import {
    parseSeriesSystemParams,
    encodeSeriesSystemParams,
    parseSeriesPatchCommon,
    encodeSeriesPatchCommon,
    createEmptySeriesPatchCommon,
    parseSeriesTone,
    encodeSeriesTone,
} from '../roland-s-series/index.js';

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

// =============================================================================
// S-550 Device Limits
// =============================================================================

const S550_LIMITS: SSeriesDeviceLimits = {
    sourcetoneMask: 0x3F,
    waveBankMask: 0x03,
    copySourceMask: 0x3F,
    maxPatchNumber: 31,
    maxToneNumber: 63,
};

// =============================================================================
// S-550 Parse/Encode Wrappers
// =============================================================================

export const parseSystemParams = (data: number[]): S550SystemParams =>
    parseSeriesSystemParams(data) as S550SystemParams;

export const encodeSystemParams = (params: S550SystemParams): number[] =>
    encodeSeriesSystemParams(params);

export const parsePatchCommon = (data: number[]): S550PatchCommon =>
    parseSeriesPatchCommon(data, PATCH_PARAMS) as S550PatchCommon;

export const encodePatchCommon = (params: S550PatchCommon): number[] =>
    encodeSeriesPatchCommon(params, PATCH_PARAMS);

export const createEmptyPatchCommon = (_index?: number): S550PatchCommon =>
    createEmptySeriesPatchCommon() as S550PatchCommon;

export const parseTone = (data: number[]): S550Tone =>
    parseSeriesTone(data, TONE_OFFSETS) as S550Tone;

export const encodeTone = (tone: S550Tone): number[] =>
    encodeSeriesTone(tone, TONE_OFFSETS, TONE_BLOCK_SIZE, S550_LIMITS);

export const isValidPatchNumber = (num: number): boolean =>
    num >= 0 && num <= S550_LIMITS.maxPatchNumber;

export const isValidToneNumber = (num: number): boolean =>
    num >= 0 && num <= S550_LIMITS.maxToneNumber;
