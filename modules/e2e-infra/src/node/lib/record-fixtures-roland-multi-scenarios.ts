/**
 * record-fixtures-roland — multi-mode write scenarios (Wave 2b).
 *
 * 4 fixtures, one per multi-mode part-0 affordance (D-PLAY-04..07).
 *
 * Each scenario shares the PlayPage mount prelude (connect +
 * loadPatchRange(0, 8) + requestFunctionParameters) — see
 * `runMultiModeMount` in `record-fixtures-roland-page-scenarios.ts` —
 * then calls exactly one multi-mode setter to capture its outbound
 * SysEx bytes. The corresponding UI capability spec
 * (`test/ui/capabilities/play-writes.spec.ts`) drives the matching UI
 * control and asserts the bytes match.
 *
 * Value-selection criteria: each value is chosen to be non-default
 * and in-range so that driving the corresponding UI control actually
 * emits a setter call. A no-op selectOption / fill / change that
 * matches the current control value emits nothing, which would make
 * the capability spec silently false-pass. Specific values:
 *
 *   channel = 5   — MIDI channel 6 (display); non-default vs part 0
 *                   stock channel
 *   patch   = 3   — patch slot 4 (display); non-default selection
 *   output  = 4   — output 5 (display); non-default
 *   level   = 80  — non-default; emits setMultiLevel(0, 80) when the
 *                   slider is committed at value 80
 *
 * Sibling files — see `record-fixtures-roland-core-scenarios.ts` header.
 *
 * @packageDocumentation
 */
import {
    asClient,
    type Scenario,
} from '#node/lib/record-fixtures-roland-core-scenarios.js';
import {
    runMultiModeMount,
    type MultiModeClient,
} from '#node/lib/record-fixtures-roland-page-scenarios.js';

// ---------------------------------------------------------------------------
// Per-scenario client interfaces — named structural subsets each
// multi-mode setter scenario requires.
// ---------------------------------------------------------------------------

interface MultiChannelClient extends MultiModeClient {
    setMultiChannel: (part: number, channel: number) => Promise<void>;
}

interface MultiPatchClient extends MultiModeClient {
    setMultiPatch: (part: number, patchIndex: number | null) => Promise<void>;
}

interface MultiOutputClient extends MultiModeClient {
    setMultiOutput: (part: number, output: number) => Promise<void>;
}

interface MultiLevelClient extends MultiModeClient {
    setMultiLevel: (part: number, level: number) => Promise<void>;
}

export const MULTI_SCENARIOS: Record<string, Scenario> = {
    'multi-part-0-channel': {
        name: 'multi-part-0-channel',
        description: 'PlayPage init + setMultiChannel(0, 5) — D-PLAY-04',
        run: async ({ client, proxy }) => {
            await runMultiModeMount(client, proxy);
            const c = asClient<MultiChannelClient>(client);
            proxy.annotate('setMultiChannel(0, 5)');
            await c.setMultiChannel(0, 5);
        },
    },

    'multi-part-0-patch': {
        name: 'multi-part-0-patch',
        description: 'PlayPage init + setMultiPatch(0, 3) — D-PLAY-05',
        run: async ({ client, proxy }) => {
            await runMultiModeMount(client, proxy);
            const c = asClient<MultiPatchClient>(client);
            proxy.annotate('setMultiPatch(0, 3)');
            await c.setMultiPatch(0, 3);
        },
    },

    'multi-part-0-output': {
        name: 'multi-part-0-output',
        description: 'PlayPage init + setMultiOutput(0, 4) — D-PLAY-06',
        run: async ({ client, proxy }) => {
            await runMultiModeMount(client, proxy);
            const c = asClient<MultiOutputClient>(client);
            proxy.annotate('setMultiOutput(0, 4)');
            await c.setMultiOutput(0, 4);
        },
    },

    'multi-part-0-level': {
        name: 'multi-part-0-level',
        description: 'PlayPage init + setMultiLevel(0, 80) — D-PLAY-07',
        run: async ({ client, proxy }) => {
            await runMultiModeMount(client, proxy);
            const c = asClient<MultiLevelClient>(client);
            proxy.annotate('setMultiLevel(0, 80)');
            await c.setMultiLevel(0, 80);
        },
    },
};
