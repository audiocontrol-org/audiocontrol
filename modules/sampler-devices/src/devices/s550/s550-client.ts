/**
 * Roland S-550 MIDI SysEx Client
 *
 * Client for communicating with Roland S-550 samplers via SysEx.
 * Uses the shared S-series client infrastructure.
 *
 * @packageDocumentation
 */

import type {
    SSeriesMidiAdapter,
    SSeriesClientOptions,
    SSeriesWaveParams,
} from '../roland-s-series/index.js';

import {
    createSSeriesClient,
    type SSeriesClientInterface,
    type SSeriesParserFunctions,
    type SSeriesAddressBuilders,
} from '../roland-s-series/index.js';

import { S550_CONFIG } from './s550-config.js';

import type {
    S550Patch,
    S550PatchCommon,
    S550Tone,
    S550ImportToneInput,
} from './s550-types.js';

import {
    parsePatchCommon,
    parseTone,
    encodePatchCommon,
    encodeTone,
} from './s550-params.js';

import {
    PATCH_PARAMS,
    ADDR_WAVE_DATA,
    TONE_STRIDE,
} from './s550-addresses.js';

import { createTone } from './s550-tone-factory.js';

// =============================================================================
// Type Aliases for S-550
// =============================================================================

/**
 * S-550 client interface
 */
export type S550ClientInterface = SSeriesClientInterface<S550Patch, S550Tone, S550PatchCommon>;

// =============================================================================
// Address Builders
// =============================================================================

const S550_ADDRESS_BUILDERS: SSeriesAddressBuilders = {
    buildPatchAddress(patchIndex: number): number[] {
        // S-550 patch address: 00 00 [patch*4] 00
        return [0x00, 0x00, (patchIndex * 4) & 0x7f, 0x00];
    },

    buildToneAddress(toneIndex: number): number[] {
        // S-550 tone address: 00 03 [tone*STRIDE] 00
        const byte2 = toneIndex * TONE_STRIDE;
        return [0x00, 0x03, byte2 & 0x7f, 0x00];
    },

    buildPatchParamAddress(patchIndex: number, paramName: string): number[] {
        const param = PATCH_PARAMS[paramName as keyof typeof PATCH_PARAMS];
        if (!param) {
            throw new Error(`Unknown patch parameter: ${paramName}`);
        }
        const [high, low] = param.address;
        return [0x00, 0x00, (patchIndex * 4 + high) & 0x7f, low & 0x7f];
    },

    buildWaveDataAddress(waveBank: number, segmentIndex: number): number[] {
        // Wave data address: 01 [bank] [segment*8] 00
        // Each segment is 12000 samples * 2 bytes = 24000 bytes
        // Segment stride in address space is 8 in byte 2
        const byte1 = waveBank & 0x03;
        const byte2 = (segmentIndex * 8) & 0x7f;
        return [ADDR_WAVE_DATA[0], byte1, byte2, 0x00];
    },
};

// =============================================================================
// Parser Functions
// =============================================================================

const S550_PARSERS: SSeriesParserFunctions<S550Patch, S550Tone, S550PatchCommon> = {
    parsePatchCommon,
    parseTone,
    encodePatchCommon,
    encodeTone,

    createTone(params: {
        name: string;
        sampleRate: '15kHz' | '30kHz';
        waveBank: number;
        segmentTop: number;
        segmentLength: number;
        sampleCount: number;
        loopMode: 'forward' | 'alternating' | 'one-shot' | 'reverse';
        loopPoint: number;
        originalKey: number;
    }): S550Tone {
        return createTone({
            ...params,
            waveBank: params.waveBank as 0 | 1 | 2 | 3,
        });
    },

    getPatchCommon(patch: S550Patch): S550PatchCommon {
        return patch.common;
    },

    createPatch(common: S550PatchCommon): S550Patch {
        return { common };
    },

    getToneWave(tone: S550Tone): SSeriesWaveParams {
        return tone.wave;
    },

    setToneWave(tone: S550Tone, wave: SSeriesWaveParams): S550Tone {
        return { ...tone, wave };
    },
};

// =============================================================================
// Client Factory
// =============================================================================

/**
 * Create S-550 MIDI client
 *
 * @param midiAdapter - MIDI transport adapter (easymidi or Web MIDI)
 * @param options - Client configuration options
 * @returns S550ClientInterface instance
 *
 * @example Browser with Web MIDI
 * ```typescript
 * import { createS550Client } from '@audiocontrol/sampler-devices/s550';
 * import { createWebMidiAdapter } from './midi/WebMidiAdapter';
 *
 * const adapter = await createWebMidiAdapter(inputPort, outputPort);
 * const client = createS550Client(adapter, { deviceId: 0 });
 * await client.connect();
 * const patches = await client.loadPatchRange(0, 32);
 * ```
 */
export function createS550Client(
    midiAdapter: SSeriesMidiAdapter,
    options: SSeriesClientOptions = {}
): S550ClientInterface {
    return createSSeriesClient<S550Patch, S550Tone, S550PatchCommon>(
        S550_CONFIG,
        midiAdapter,
        S550_PARSERS,
        S550_ADDRESS_BUILDERS,
        PATCH_PARAMS,
        options
    );
}

// =============================================================================
// Re-exports for convenience
// =============================================================================

export type {
    S550Patch,
    S550PatchCommon,
    S550Tone,
    S550ImportToneInput,
};

export { S550_CONFIG } from './s550-config.js';
