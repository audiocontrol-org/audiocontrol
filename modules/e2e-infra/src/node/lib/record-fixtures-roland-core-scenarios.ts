/**
 * record-fixtures-roland — core scenario types + baseline scenarios.
 *
 * One slice of the scenario registry (split during Wave 2c because the
 * combined file pushed past the 300-500 line cap). This slice carries:
 *
 *   - The exported `Scenario`, `ScenarioContext`, `ScenarioFn` types
 *     every other scenario file imports.
 *   - The centralized `asClient<T>` helper — the SINGLE place we narrow
 *     the heterogeneous `ScenarioContext.client` (typed `unknown`) to a
 *     scenario-specific structural subset. Every scenario file MUST
 *     narrow via this helper rather than introducing inline `as` casts.
 *   - The 4 baseline scenarios that don't share preludes with anything
 *     else: `connect-only`, `load-everything`, `fetch-patch-0`,
 *     `fetch-tone-0`. These are the original unit-scale fixtures the
 *     other slices grew out of.
 *
 * Siblings (each registered into the same top-level `SCENARIOS` map by
 * `record-fixtures-roland-scenarios.ts`):
 *
 *   - `record-fixtures-roland-page-scenarios.ts` — page-mount scenarios
 *     (patches-bank-0, tones-bank-0, play-init) + the shared mount
 *     helpers (`runPatchPageMount`, `runTonePageMount`, `runMultiModeMount`)
 *     and their client interfaces.
 *   - `record-fixtures-roland-patch-scenarios.ts` — 11 patch-edit write
 *     scenarios (D-PATCH-01..05, 07..12).
 *   - `record-fixtures-roland-multi-scenarios.ts` — 4 multi-mode write
 *     scenarios (D-PLAY-04..07).
 *   - `record-fixtures-roland-tone-scenarios.ts` — Wave 2c tone-write
 *     scenarios (~39 D-TONE-* affordances, per-field).
 *
 * @packageDocumentation
 */
import type {
    RecordingProxyAdapter,
    FixtureDevice,
} from '@audiocontrol/sampler-devices/recording';

// ---------------------------------------------------------------------------
// Scenario types — exported, re-used by every scenario slice
// ---------------------------------------------------------------------------

export interface ScenarioContext {
    device: FixtureDevice;
    deviceId: number;
    proxy: RecordingProxyAdapter;
    /**
     * Either an `S550ClientInterface` or `S330ClientInterface`; both
     * structurally implement the same operations the scenarios need. We
     * keep the type as `unknown` here and let scenario implementations
     * narrow once via the `asClient<T>` helper below.
     */
    client: unknown;
}

export type ScenarioFn = (ctx: ScenarioContext) => Promise<void>;

export interface Scenario {
    name: string;
    description: string;
    run: ScenarioFn;
}

/**
 * Centralized unsafe-cast site for narrowing `ScenarioContext.client`
 * (typed `unknown` because the registry stores heterogeneous scenarios
 * with different client surface requirements) to the specific structural
 * subset a scenario needs.
 *
 * This is the SINGLE place across ALL scenario files where we bypass
 * `as Type` strict mode. Every scenario MUST narrow its client via this
 * helper rather than introducing inline `client as X` casts at call
 * sites. Each scenario defines a local interface listing the client
 * methods it actually uses (`ConnectOnlyClient`, `LoadEverythingClient`,
 * `ToneEditClient`, etc.) and passes it as the type argument — so the
 * cast happens once per scenario, against an explicit named contract,
 * and the rest of the scenario body is fully type-checked against that
 * contract.
 *
 * Rationale: parameterizing `ScenarioContext<TClient>` end-to-end would
 * require Scenario.run to be existentially typed inside `Record<string,
 * Scenario>`, which TypeScript cannot express cleanly. Concentrating the
 * cast in this one helper makes the unsafe boundary auditable.
 */
export function asClient<T>(client: unknown): T {
    return client as T;
}

// ---------------------------------------------------------------------------
// Per-scenario client interfaces — named structural subsets the baseline
// scenarios below require. Used with `asClient<T>` to centralize the
// unsafe cast.
// ---------------------------------------------------------------------------

interface ConnectOnlyClient {
    connect: () => Promise<boolean>;
}

interface LoadEverythingClient extends ConnectOnlyClient {
    loadPatchRange: (start: number, count: number) => Promise<unknown[]>;
    loadToneRange: (start: number, count: number) => Promise<unknown[]>;
}

interface FetchPatchClient extends ConnectOnlyClient {
    requestPatchData: (idx: number) => Promise<unknown | null>;
}

interface FetchToneClient extends ConnectOnlyClient {
    requestToneData: (idx: number) => Promise<unknown | null>;
}

// ---------------------------------------------------------------------------
// Baseline scenarios — unit-scale fixtures (connect / load-all / fetch-one)
// that aren't tied to any specific editor page.
// ---------------------------------------------------------------------------

export const CORE_SCENARIOS: Record<string, Scenario> = {
    'connect-only': {
        name: 'connect-only',
        description: 'Open MIDI, request system params, disconnect — minimal fixture',
        run: async ({ client, proxy }) => {
            const c = asClient<ConnectOnlyClient>(client);
            proxy.annotate('connect()');
            const ok = await c.connect();
            if (!ok) throw new Error('connect-only: client.connect() returned false');
        },
    },

    'load-everything': {
        name: 'load-everything',
        description: 'Connect + load all patches + load all tones (mirrors editor startup)',
        run: async ({ client, device, proxy }) => {
            const c = asClient<LoadEverythingClient>(client);
            proxy.annotate('connect()');
            await c.connect();

            const patchCount = device === 's550' ? 32 : 64;
            const toneCount = device === 's550' ? 64 : 32;

            proxy.annotate(`loadPatchRange(0, ${patchCount})`);
            await c.loadPatchRange(0, patchCount);

            proxy.annotate(`loadToneRange(0, ${toneCount})`);
            await c.loadToneRange(0, toneCount);
        },
    },

    'fetch-patch-0': {
        name: 'fetch-patch-0',
        description: 'Read a single patch (for unit-scale fixture testing)',
        run: async ({ client, proxy }) => {
            const c = asClient<FetchPatchClient>(client);
            proxy.annotate('connect()');
            await c.connect();
            proxy.annotate('requestPatchData(0)');
            await c.requestPatchData(0);
        },
    },

    'fetch-tone-0': {
        name: 'fetch-tone-0',
        description: 'Read a single tone',
        run: async ({ client, proxy }) => {
            const c = asClient<FetchToneClient>(client);
            proxy.annotate('connect()');
            await c.connect();
            proxy.annotate('requestToneData(0)');
            await c.requestToneData(0);
        },
    },
};
