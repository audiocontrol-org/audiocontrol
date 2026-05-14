/**
 * record-fixtures-roland — tone-write scenarios (Wave 2c).
 *
 * ~39 fixtures, one per tone affordance covered by the inventory's
 * D-TONE-{WAVE,PITCH,TVF,TVA,LFO,ENV} sections. Each scenario shares
 * the TonesPage mount prelude (connect + loadToneRange(0, 8)) — see
 * `runTonePageMount` in `record-fixtures-roland-page-scenarios.ts` —
 * then calls exactly one `sendToneData(0, mutatedTone)` capturing the
 * outbound bytes for ONE field changed.
 *
 * Why per-field rather than per-section: tones use whole-structure
 * writes (sendToneData encodes the entire 256-byte tone payload, not a
 * per-parameter setter), so each capture covers the full tone state at
 * that moment. A per-section fixture batching multiple field changes
 * would couple the UI spec's driving order to the fixture's recording
 * order — any drift breaks every test downstream. Per-field keeps each
 * test independent: drive ONE control, the captured outbound MUST
 * match. ~39 fixtures is mechanical, mirrors Wave 2a's per-setter
 * model, and amortizes against parser bugs cleanly.
 *
 * Value-selection criteria — every value is chosen to:
 *   - DIFFER from typical S-330/S-550 stock tone defaults so the UI's
 *     change handler always emits sendToneData. A no-op fill / selectOption
 *     / slider commit at the device's current value emits nothing,
 *     which would make the capability spec silently false-pass.
 *   - Stay in the field's valid range (no out-of-bound traps).
 *   - Avoid 0/127 edges where the device's stock value might coincide.
 *
 * The corresponding UI capability spec
 * (`test/ui/capabilities/tone-writes.spec.ts`) drives the matching UI
 * affordance and asserts the bytes match.
 *
 * Sibling files — see `record-fixtures-roland-core-scenarios.ts` header.
 *
 * @packageDocumentation
 */
import type {
    SSeriesBaseTone,
    SSeriesEnvelope,
    SSeriesLoopMode,
    SSeriesEgPolarity,
    SSeriesLevelCurve,
} from '@audiocontrol/sampler-devices/roland-s-series';
import {
    asClient,
    type Scenario,
} from '#node/lib/record-fixtures-roland-core-scenarios.js';
import {
    runTonePageMount,
} from '#node/lib/record-fixtures-roland-page-scenarios.js';
import {
    applyResetBaseline,
    type ToneEditClient,
} from '#node/lib/record-fixtures-roland-tone-baseline.js';

// ---------------------------------------------------------------------------
// Per-field mutation helpers — each takes the loaded tone and returns a
// new tone with exactly ONE field changed.
// ---------------------------------------------------------------------------

/**
 * Mutate a single SSeriesEnvelope rate input (envelope.rates[index]).
 * Used by D-TONE-ENV-02 (TVF) and D-TONE-ENV-08 (TVA). Index 0 is the
 * first rate input — keeping the index choice consistent across the
 * two env affordances avoids "did rate[3] coincide with the device's
 * stock value?" debugging when one scenario passes and the other fails.
 */
function withEnvelopeRate(env: SSeriesEnvelope, index: number, value: number): SSeriesEnvelope {
    const rates = [...env.rates] as SSeriesEnvelope['rates'];
    rates[index] = value;
    return { ...env, rates };
}

function withEnvelopeLevel(env: SSeriesEnvelope, index: number, value: number): SSeriesEnvelope {
    const levels = [...env.levels] as SSeriesEnvelope['levels'];
    levels[index] = value;
    return { ...env, levels };
}


// ---------------------------------------------------------------------------
// Tone-write scenario spec — one row per affordance
// ---------------------------------------------------------------------------

export interface ToneWriteScenarioSpec {
    /** Inventory ID (D-TONE-XXX-NN) — included in the description for traceability. */
    detail: string;
    /** Suffix appended to 'tone-0-' to form the scenario name. */
    suffix: string;
    /** Human label used in annotations + fixture description. */
    label: string;
    /**
     * Return a NEW tone with one field changed. The scenario calls
     * sendToneData(0, mutate(currentTone)) — the spread + assignment
     * pattern lives in each spec body so each is explicit about which
     * field is the variable.
     */
    mutate: (tone: SSeriesBaseTone) => SSeriesBaseTone;
}

// Value selections — each one chosen non-default vs typical stock tones
// AND non-zero so the UI's change handler always fires. See criteria in
// the file header.

export const TONE_WRITE_SCENARIOS: ToneWriteScenarioSpec[] = [
    // -----------------------------------------------------------------
    // Wave section (D-TONE-WAVE-01, 02, 04..08) — 7 testable
    // (WAVE-03 sample rate is display-only; 09/10/11 missing UI per #408)
    // -----------------------------------------------------------------
    {
        detail: 'D-TONE-WAVE-01',
        suffix: 'wave-name',
        label: 'name = "TST_NAME"',
        mutate: (t) => ({ ...t, name: 'TST_NAME' }),
    },
    {
        detail: 'D-TONE-WAVE-02',
        suffix: 'wave-original-key',
        label: 'originalKey = 60',
        mutate: (t) => ({ ...t, originalKey: 60 }),
    },
    {
        detail: 'D-TONE-WAVE-04',
        suffix: 'wave-loop-mode',
        label: 'loopMode = "alternating"',
        mutate: (t) => ({ ...t, loopMode: 'alternating' as SSeriesLoopMode }),
    },
    {
        detail: 'D-TONE-WAVE-05',
        suffix: 'wave-output-assign',
        label: 'outputAssign = 5',
        mutate: (t) => ({ ...t, outputAssign: 5 }),
    },
    {
        detail: 'D-TONE-WAVE-06',
        suffix: 'wave-start-point',
        label: 'wave.startPoint = 1024',
        mutate: (t) => ({ ...t, wave: { ...t.wave, startPoint: 1024 } }),
    },
    {
        detail: 'D-TONE-WAVE-07',
        suffix: 'wave-loop-point',
        label: 'wave.loopPoint = 2048',
        mutate: (t) => ({ ...t, wave: { ...t.wave, loopPoint: 2048 } }),
    },
    {
        detail: 'D-TONE-WAVE-08',
        suffix: 'wave-end-point',
        label: 'wave.endPoint = 4096',
        mutate: (t) => ({ ...t, wave: { ...t.wave, endPoint: 4096 } }),
    },

    // -----------------------------------------------------------------
    // Pitch section (D-TONE-PITCH-02..05) — 4 testable
    // (PITCH-01 transpose slider disabled per inventory)
    // -----------------------------------------------------------------
    {
        detail: 'D-TONE-PITCH-02',
        suffix: 'pitch-fine-tune',
        label: 'fineTune = 20',
        mutate: (t) => ({ ...t, fineTune: 20 }),
    },
    {
        detail: 'D-TONE-PITCH-03',
        suffix: 'pitch-follow',
        label: 'pitchFollow = !current',
        // Toggle from current to avoid coincidence with the device's
        // stock value — captured against whichever direction the load
        // surfaces; the spec drives by clicking the checkbox once.
        mutate: (t) => ({ ...t, pitchFollow: !t.pitchFollow }),
    },
    {
        detail: 'D-TONE-PITCH-04',
        suffix: 'pitch-bender-enabled',
        label: 'benderEnabled = !current',
        mutate: (t) => ({ ...t, benderEnabled: !t.benderEnabled }),
    },
    {
        detail: 'D-TONE-PITCH-05',
        suffix: 'pitch-aftertouch-enabled',
        label: 'aftertouchEnabled = !current',
        mutate: (t) => ({ ...t, aftertouchEnabled: !t.aftertouchEnabled }),
    },

    // -----------------------------------------------------------------
    // TVF section (D-TONE-TVF-01..10) — 10 testable
    //
    // Order matters: each capture leaves the device in a new state that
    // the NEXT capture sees as its loaded baseline. `tvf-enabled` toggles
    // tvf.enabled — if it ran first, every subsequent TVF capture would
    // see tvf.enabled=false on load, and the UI would render the entire
    // TVF panel disabled (`disabled={!tone.tvf.enabled}` in
    // ToneFilterPanel.tsx), making every TVF slider / select / input
    // unreachable from Playwright. So `tvf-enabled` runs LAST in the TVF
    // group, after the device has been left with enabled=true by the
    // prior wave/pitch captures.
    // -----------------------------------------------------------------
    {
        detail: 'D-TONE-TVF-02',
        suffix: 'tvf-cutoff',
        label: 'tvf.cutoff = 80',
        mutate: (t) => ({ ...t, tvf: { ...t.tvf, cutoff: 80 } }),
    },
    {
        detail: 'D-TONE-TVF-03',
        suffix: 'tvf-resonance',
        label: 'tvf.resonance = 64',
        mutate: (t) => ({ ...t, tvf: { ...t.tvf, resonance: 64 } }),
    },
    {
        detail: 'D-TONE-TVF-04',
        suffix: 'tvf-key-follow',
        label: 'tvf.keyFollow = 75',
        mutate: (t) => ({ ...t, tvf: { ...t.tvf, keyFollow: 75 } }),
    },
    {
        detail: 'D-TONE-TVF-05',
        suffix: 'tvf-lfo-depth',
        label: 'tvf.lfoDepth = 50',
        mutate: (t) => ({ ...t, tvf: { ...t.tvf, lfoDepth: 50 } }),
    },
    {
        detail: 'D-TONE-TVF-06',
        suffix: 'tvf-eg-depth',
        label: 'tvf.egDepth = 90',
        mutate: (t) => ({ ...t, tvf: { ...t.tvf, egDepth: 90 } }),
    },
    {
        detail: 'D-TONE-TVF-07',
        suffix: 'tvf-key-rate-follow',
        label: 'tvf.keyRateFollow = 40',
        mutate: (t) => ({ ...t, tvf: { ...t.tvf, keyRateFollow: 40 } }),
    },
    {
        detail: 'D-TONE-TVF-08',
        suffix: 'tvf-vel-rate-follow',
        label: 'tvf.velRateFollow = 60',
        mutate: (t) => ({ ...t, tvf: { ...t.tvf, velRateFollow: 60 } }),
    },
    {
        detail: 'D-TONE-TVF-09',
        suffix: 'tvf-eg-polarity',
        label: 'tvf.egPolarity = "reverse"',
        mutate: (t) => ({ ...t, tvf: { ...t.tvf, egPolarity: 'reverse' as SSeriesEgPolarity } }),
    },
    {
        detail: 'D-TONE-TVF-10',
        suffix: 'tvf-level-curve',
        label: 'tvf.levelCurve = 3',
        mutate: (t) => ({ ...t, tvf: { ...t.tvf, levelCurve: 3 as SSeriesLevelCurve } }),
    },

    // -----------------------------------------------------------------
    // TVA section (D-TONE-TVA-01..05) — 5 testable
    // (Prior D-TONE-TVA-06 referenced a top-level tvaLfoDepth field that
    //  aliased tva.lfoDepth at the same offset; collapsed in #408 Phase A,
    //  so TVA-02 now covers the only TVA LFO depth affordance.)
    // -----------------------------------------------------------------
    {
        detail: 'D-TONE-TVA-01',
        suffix: 'tva-level',
        label: 'tva.level = 100',
        mutate: (t) => ({ ...t, tva: { ...t.tva, level: 100 } }),
    },
    {
        detail: 'D-TONE-TVA-02',
        suffix: 'tva-lfo-depth',
        label: 'tva.lfoDepth = 45',
        mutate: (t) => ({ ...t, tva: { ...t.tva, lfoDepth: 45 } }),
    },
    {
        detail: 'D-TONE-TVA-03',
        suffix: 'tva-key-rate',
        label: 'tva.keyRate = 35',
        mutate: (t) => ({ ...t, tva: { ...t.tva, keyRate: 35 } }),
    },
    {
        detail: 'D-TONE-TVA-04',
        suffix: 'tva-vel-rate',
        label: 'tva.velRate = 55',
        mutate: (t) => ({ ...t, tva: { ...t.tva, velRate: 55 } }),
    },
    {
        detail: 'D-TONE-TVA-05',
        suffix: 'tva-level-curve',
        label: 'tva.levelCurve = 4',
        mutate: (t) => ({ ...t, tva: { ...t.tva, levelCurve: 4 as SSeriesLevelCurve } }),
    },

    // -----------------------------------------------------------------
    // LFO section (D-TONE-LFO-01..04, 06) — 5 testable
    // (LFO-05 mode display-only per inventory)
    // -----------------------------------------------------------------
    {
        detail: 'D-TONE-LFO-01',
        suffix: 'lfo-rate',
        label: 'lfo.rate = 70',
        mutate: (t) => ({ ...t, lfo: { ...t.lfo, rate: 70 } }),
    },
    {
        detail: 'D-TONE-LFO-02',
        suffix: 'lfo-delay',
        label: 'lfo.delay = 25',
        mutate: (t) => ({ ...t, lfo: { ...t.lfo, delay: 25 } }),
    },
    {
        detail: 'D-TONE-LFO-03',
        suffix: 'lfo-offset',
        label: 'lfo.offset = 90',
        mutate: (t) => ({ ...t, lfo: { ...t.lfo, offset: 90 } }),
    },
    {
        detail: 'D-TONE-LFO-04',
        suffix: 'lfo-sync',
        label: 'lfo.sync = !current',
        mutate: (t) => ({ ...t, lfo: { ...t.lfo, sync: !t.lfo.sync } }),
    },
    {
        detail: 'D-TONE-LFO-06',
        suffix: 'lfo-polarity',
        label: 'lfo.polarity = !current',
        mutate: (t) => ({ ...t, lfo: { ...t.lfo, polarity: !t.lfo.polarity } }),
    },

    // -----------------------------------------------------------------
    // Envelope section (D-TONE-ENV-02..05, 08..11) — 8 testable
    //
    // The "8 rate/level inputs" rows in the inventory each count as ONE
    // affordance — driving one input proves the row works.
    //
    // Order matters: end-point captures FIRST in each envelope so the
    // device leaves with endPoint=6, which makes the subsequent sustain-
    // point capture valid (UI enforces sustain < endPoint via per-option
    // `disabled` flags — see EnvelopeEditor.tsx). With end captured first,
    // sustain=3 is reachable from any starting state. Rate/level inputs
    // are unconstrained by sustain/end and capture last.
    //
    // The TVF envelope captures run BEFORE the TVA envelope captures,
    // and BEFORE `tvf-enabled` (last in TVF section above). That keeps
    // the TVF panel enabled during these captures so the corresponding
    // UI spec can reach the envelope controls.
    // -----------------------------------------------------------------
    {
        detail: 'D-TONE-ENV-05',
        suffix: 'tvf-env-end-point',
        label: 'tvf.envelope.endPoint = 5',
        mutate: (t) => ({
            ...t,
            tvf: { ...t.tvf, envelope: { ...t.tvf.envelope, endPoint: 5 } },
        }),
    },
    {
        detail: 'D-TONE-ENV-04',
        suffix: 'tvf-env-sustain-point',
        label: 'tvf.envelope.sustainPoint = 3',
        mutate: (t) => ({
            ...t,
            tvf: { ...t.tvf, envelope: { ...t.tvf.envelope, sustainPoint: 3 } },
        }),
    },
    {
        detail: 'D-TONE-ENV-02',
        suffix: 'tvf-env-rate-0',
        label: 'tvf.envelope.rates[0] = 50',
        mutate: (t) => ({
            ...t,
            tvf: { ...t.tvf, envelope: withEnvelopeRate(t.tvf.envelope, 0, 50) },
        }),
    },
    {
        detail: 'D-TONE-ENV-03',
        suffix: 'tvf-env-level-0',
        label: 'tvf.envelope.levels[0] = 90',
        mutate: (t) => ({
            ...t,
            tvf: { ...t.tvf, envelope: withEnvelopeLevel(t.tvf.envelope, 0, 90) },
        }),
    },
    {
        detail: 'D-TONE-ENV-11',
        suffix: 'tva-env-end-point',
        label: 'tva.envelope.endPoint = 5',
        mutate: (t) => ({
            ...t,
            tva: { ...t.tva, envelope: { ...t.tva.envelope, endPoint: 5 } },
        }),
    },
    {
        detail: 'D-TONE-ENV-10',
        suffix: 'tva-env-sustain-point',
        label: 'tva.envelope.sustainPoint = 3',
        mutate: (t) => ({
            ...t,
            tva: { ...t.tva, envelope: { ...t.tva.envelope, sustainPoint: 3 } },
        }),
    },
    {
        detail: 'D-TONE-ENV-08',
        suffix: 'tva-env-rate-0',
        label: 'tva.envelope.rates[0] = 50',
        mutate: (t) => ({
            ...t,
            tva: { ...t.tva, envelope: withEnvelopeRate(t.tva.envelope, 0, 50) },
        }),
    },
    {
        detail: 'D-TONE-ENV-09',
        suffix: 'tva-env-level-0',
        label: 'tva.envelope.levels[0] = 90',
        mutate: (t) => ({
            ...t,
            tva: { ...t.tva, envelope: withEnvelopeLevel(t.tva.envelope, 0, 90) },
        }),
    },

    // -----------------------------------------------------------------
    // TVF enable toggle — LAST in the TVF group so the prior TVF
    // captures see tvf.enabled=true on load. If captured earlier, the
    // TVF panel would be disabled in the UI for every subsequent TVF
    // affordance test and the controls would be unreachable.
    // -----------------------------------------------------------------
    {
        detail: 'D-TONE-TVF-01',
        suffix: 'tvf-enabled',
        label: 'tvf.enabled = !current',
        mutate: (t) => ({ ...t, tvf: { ...t.tvf, enabled: !t.tvf.enabled } }),
    },
];

function buildToneWriteScenario(spec: ToneWriteScenarioSpec): [string, Scenario] {
    const name = `tone-0-${spec.suffix}`;
    return [
        name,
        {
            name,
            description: `TonesPage init + sendToneData(0, tone with ${spec.label}) — ${spec.detail}`,
            run: async ({ client, proxy }) => {
                await runTonePageMount(client, proxy);
                const c = asClient<ToneEditClient>(client);

                // Read the just-loaded tone 0 out of the client cache.
                // runTonePageMount called loadToneRange(0, 8), so the
                // cache has the device's current tone-0 state. Mutating
                // a copy ensures the cache stays untouched until
                // sendToneData writes it back.
                const loaded = c.getLoadedTones()[0];
                if (!loaded) {
                    throw new Error(
                        `${name}: tone 0 not in cache after loadToneRange(0, 8) — ` +
                            `runTonePageMount didn't populate the slot`,
                    );
                }
                const mutated = spec.mutate(loaded);

                proxy.annotate(`sendToneData(0, ${spec.label})`);
                await c.sendToneData(0, mutated);
            },
        },
    ];
}

const TONE_RESET_SCENARIO: Scenario = {
    name: 'tone-0-reset-baseline',
    description: 'Reset device tone 0 to a deterministic baseline (sendToneData with RESET_BASELINE). Not a test affordance — runs once before the affordance batch so per-scenario target values reliably differ from loaded state.',
    run: async ({ client, proxy }) => {
        await runTonePageMount(client, proxy);
        const c = asClient<ToneEditClient>(client);
        await applyResetBaseline(c, proxy);
    },
};

export const TONE_SCENARIOS: Record<string, Scenario> = {
    [TONE_RESET_SCENARIO.name]: TONE_RESET_SCENARIO,
    ...Object.fromEntries(TONE_WRITE_SCENARIOS.map(buildToneWriteScenario)),
};
