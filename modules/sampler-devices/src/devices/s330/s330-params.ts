/**
 * Roland S-330 Parameter Definitions
 *
 * Thin wrapper around shared S-series parsers with S-330 specific limits.
 *
 * @packageDocumentation
 */

import type { S330SystemParams, S330PatchCommon, S330Tone } from './s330-types.js';
import type { SSeriesDeviceLimits } from '../roland-s-series/index.js';
import { TONE_OFFSETS, TONE_BLOCK_SIZE, PATCH_PARAMS } from './s330-addresses.js';

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
// S-330 Device Limits
// =============================================================================

const S330_LIMITS: SSeriesDeviceLimits = {
    sourcetoneMask: 0x1F,
    waveBankMask: 0x01,
    copySourceMask: 0x1F,
    maxPatchNumber: 63,
    maxToneNumber: 31,
};

// =============================================================================
// S-330 Parse/Encode Wrappers
// =============================================================================

export const parseSystemParams = (data: number[]): S330SystemParams =>
    parseSeriesSystemParams(data) as S330SystemParams;

export const encodeSystemParams = (params: S330SystemParams): number[] =>
    encodeSeriesSystemParams(params);

export const parsePatchCommon = (data: number[]): S330PatchCommon =>
    parseSeriesPatchCommon(data, PATCH_PARAMS) as S330PatchCommon;

export const encodePatchCommon = (params: S330PatchCommon): number[] =>
    encodeSeriesPatchCommon(params, PATCH_PARAMS);

export const createEmptyPatchCommon = (_index?: number): S330PatchCommon =>
    createEmptySeriesPatchCommon() as S330PatchCommon;

export const parseTone = (data: number[]): S330Tone =>
    parseSeriesTone(data, TONE_OFFSETS) as S330Tone;

export const encodeTone = (tone: S330Tone): number[] =>
    encodeSeriesTone(tone, TONE_OFFSETS, TONE_BLOCK_SIZE, S330_LIMITS);

export const isValidPatchNumber = (num: number): boolean =>
    num >= 0 && num <= S330_LIMITS.maxPatchNumber;

export const isValidToneNumber = (num: number): boolean =>
    num >= 0 && num <= S330_LIMITS.maxToneNumber;
