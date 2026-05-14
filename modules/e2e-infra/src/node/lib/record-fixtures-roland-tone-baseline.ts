/**
 * record-fixtures-roland — tone-write baseline-reset helper.
 *
 * Extracted from `record-fixtures-roland-tone-scenarios.ts` so the
 * affordance-scenario file stays under the 300-500 line cap as the
 * affordance table grows.
 *
 * Contents:
 *   - `RESET_BASELINE` — the deterministic tone-0 baseline that runs
 *     ONCE at the start of the tone-write capture batch.
 *   - `applyResetBaseline()` — sendToneData with that baseline; called
 *     by the `tone-0-reset-baseline` scenario in tone-scenarios.ts.
 *   - `ToneEditClient` — the structural client surface every tone-write
 *     scenario uses (load + send).
 *
 * Without the reset, each batch run sees the cumulative state from
 * prior batches, and static target values risk being a no-op (target
 * matches loaded → UI driver emits nothing → false-pass risk caught by
 * `expectFixtureFullyConsumed` in the spec).
 *
 * The reset baseline:
 *   - All numeric fields set to 0 (or to a value distinct from every
 *     target the affordance scenarios pick).
 *   - tvf.enabled = true (so subsequent TVF affordance captures find
 *     the TVF panel enabled in the UI replay).
 *   - tvf.envelope.endPoint = 6, sustainPoint = 2 (so the TVF-env
 *     captures' targets — sustain=3, end=5 — always differ from the
 *     baseline AND respect the UI's sustain < endPoint constraint).
 *   - tva.envelope.endPoint = 6, sustainPoint = 2 (same reasoning).
 *
 * @packageDocumentation
 */

import type {
    SSeriesBaseTone,
} from '@audiocontrol/sampler-devices/roland-s-series';
import type { ScenarioContext } from '#node/lib/record-fixtures-roland-core-scenarios.js';
import type { ToneModeClient } from '#node/lib/record-fixtures-roland-page-scenarios.js';

/**
 * Structural client surface every tone-write scenario uses. Pulls the
 * cache populated by `runTonePageMount`'s `loadToneRange(0, 8)` plus
 * the whole-tone write entry point.
 */
export interface ToneEditClient extends ToneModeClient {
    getLoadedTones: () => (SSeriesBaseTone | undefined)[];
    sendToneData: (toneIndex: number, tone: SSeriesBaseTone) => Promise<void>;
}

/**
 * Reset-baseline tone for the tone-0 capture batch. Apply via
 * `applyResetBaseline()`. The `tone-0-reset-baseline` scenario runs
 * once before the 39 affordance captures so each affordance starts
 * from this deterministic state.
 */
export const RESET_BASELINE: SSeriesBaseTone = {
    name: 'RESETBL',
    outputAssign: 0,
    sourceTone: 0,
    origSubTone: 0,
    sampleRate: '15kHz',
    originalKey: 64,
    wave: {
        bank: 0,
        segmentTop: 0,
        segmentLength: 0,
        startPoint: 0,
        endPoint: 0,
        loopPoint: 0,
        loopLength: 0,
    },
    loopMode: 'forward',
    lfo: {
        rate: 0,
        sync: false,
        delay: 0,
        mode: 'normal',
        polarity: false,
        offset: 0,
    },
    transpose: 0,
    fineTune: 0,
    tvf: {
        cutoff: 0,
        resonance: 0,
        keyFollow: 0,
        lfoDepth: 0,
        egDepth: 0,
        egPolarity: 'normal',
        levelCurve: 0,
        keyRateFollow: 0,
        velRateFollow: 0,
        enabled: true,
        envelope: {
            levels: [0, 0, 0, 0, 0, 0, 0, 0],
            rates: [1, 1, 1, 1, 1, 1, 1, 1],
            sustainPoint: 2,
            endPoint: 6,
        },
    },
    tva: {
        lfoDepth: 0,
        keyRate: 0,
        level: 0,
        velRate: 0,
        levelCurve: 0,
        envelope: {
            levels: [0, 0, 0, 0, 0, 0, 0, 0],
            rates: [1, 1, 1, 1, 1, 1, 1, 1],
            sustainPoint: 2,
            endPoint: 6,
        },
    },
    benderEnabled: false,
    aftertouchEnabled: false,
    pitchFollow: false,
    recThreshold: 0,
    recPreTrigger: 0,
    loopTune: 0,
    envZoom: 0,
    copySource: 0,
};

/**
 * Apply the reset baseline to the device's tone 0. Called from the
 * `tone-0-reset-baseline` scenario which runs once before the affordance
 * batch. Note we do NOT use the loaded tone here — we want a
 * DETERMINISTIC starting state, not "loaded + tweaks." That's the whole
 * point of the reset.
 */
export async function applyResetBaseline(
    client: ToneEditClient,
    proxy: ScenarioContext['proxy'],
): Promise<void> {
    proxy.annotate('sendToneData(0, RESET_BASELINE)');
    await client.sendToneData(0, RESET_BASELINE);
}
