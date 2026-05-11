/**
 * record-fixtures-roland — scenario registry.
 *
 * Sister file to record-fixtures-roland.ts (the CLI driver). Pulled into
 * its own module so each side stays under the 300-500 line file cap as
 * Wave 2a / Wave 2c add patch + tone setter scenarios.
 *
 * Each `Scenario` describes a sequence of client calls to drive against
 * a real S-series device through the `RecordingProxyAdapter`. The CLI
 * driver picks one by name, runs it, and writes the resulting fixture
 * to disk for replay by `SimulatedAdapter`.
 *
 * @packageDocumentation
 */
import type {
    RecordingProxyAdapter,
    FixtureDevice,
} from '@audiocontrol/sampler-devices/recording';
import type {
    SSeriesAftertouchAssign,
    SSeriesKeyAssign,
} from '@audiocontrol/sampler-devices/roland-s-series';

// ---------------------------------------------------------------------------
// Scenario types
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
 * This is the SINGLE place in the file where we bypass `as Type` strict
 * mode. Every scenario MUST narrow its client via this helper rather
 * than introducing inline `client as X` casts at call sites. Each scenario
 * defines a local interface listing the client methods it actually uses
 * (`ConnectOnlyClient`, `LoadEverythingClient`, etc.) and passes it as
 * the type argument — so the cast happens once per scenario, against an
 * explicit named contract, and the rest of the scenario body is fully
 * type-checked against that contract.
 *
 * Rationale: parameterizing `ScenarioContext<TClient>` end-to-end would
 * require Scenario.run to be existentially typed inside `Record<string,
 * Scenario>`, which TypeScript cannot express cleanly. Concentrating the
 * cast in this one helper makes the unsafe boundary auditable.
 */
function asClient<T>(client: unknown): T {
    return client as T;
}

// ---------------------------------------------------------------------------
// Mount helpers — shared preludes
// ---------------------------------------------------------------------------

/**
 * Subset of S330/S550 client surface used by the PlayPage mount + setter
 * scenarios. Named so each scenario can extend with its setter signature.
 */
interface MultiModeClient {
    connect: () => Promise<boolean>;
    loadPatchRange: (start: number, count: number) => Promise<unknown[]>;
    requestFunctionParameters: () => Promise<unknown[]>;
}

/**
 * Run the shared PlayPage mount sequence (connect + loadPatchRange(0, 8) +
 * requestFunctionParameters) against the proxy, emitting annotations for
 * each step. The 4 multi-mode write scenarios share this prelude; Wave 2c's
 * tone-setter scenarios will likely share the same shape. Returns the
 * narrowed client so callers can chain the setter call on the result.
 */
async function runMultiModeMount(
    client: unknown,
    proxy: ScenarioContext['proxy'],
): Promise<MultiModeClient> {
    const c = asClient<MultiModeClient>(client);
    proxy.annotate('connect()');
    await c.connect();
    proxy.annotate('loadPatchRange(0, 8)');
    await c.loadPatchRange(0, 8);
    proxy.annotate('requestFunctionParameters()');
    await c.requestFunctionParameters();
    return c;
}

/**
 * Subset of S330/S550 client surface used by the PatchesPage mount +
 * setter scenarios. PatchesPage doesn't need requestFunctionParameters;
 * the editor mount only needs the bank-0 patches loaded so PatchEditor
 * can decode + drive setters.
 */
interface PatchModeClient {
    connect: () => Promise<boolean>;
    loadPatchRange: (start: number, count: number) => Promise<unknown[]>;
}

/**
 * Run the shared PatchesPage mount sequence (connect + loadPatchRange(0, 8))
 * against the proxy, emitting annotations for each step. The 11 patch-edit
 * write scenarios (D-PATCH-01..05, 07..12) share this prelude.
 */
async function runPatchPageMount(
    client: unknown,
    proxy: ScenarioContext['proxy'],
): Promise<PatchModeClient> {
    const c = asClient<PatchModeClient>(client);
    proxy.annotate('connect()');
    await c.connect();
    proxy.annotate('loadPatchRange(0, 8)');
    await c.loadPatchRange(0, 8);
    return c;
}

// ---------------------------------------------------------------------------
// Patch write scenarios — table-driven
// ---------------------------------------------------------------------------

/**
 * Full client signature surface used by the 11 patch-write scenarios.
 * Listed in one place so individual scenarios don't repeat the `as`
 * narrowing for the parts they happen to use.
 */
type PatchClient = PatchModeClient & {
    setPatchName: (idx: number, name: string) => Promise<void>;
    setPatchKeyMode: (
        idx: number,
        mode: 'normal' | 'v-sw' | 'x-fade' | 'v-mix' | 'unison',
    ) => Promise<void>;
    setPatchKeyAssign: (idx: number, assign: SSeriesKeyAssign) => Promise<void>;
    setPatchBenderRange: (idx: number, range: number) => Promise<void>;
    setPatchAftertouchAssign: (idx: number, assign: SSeriesAftertouchAssign) => Promise<void>;
    setPatchOutput: (idx: number, output: number) => Promise<void>;
    setPatchLevel: (idx: number, level: number) => Promise<void>;
    setPatchAftertouchSens: (idx: number, sens: number) => Promise<void>;
    setPatchDetune: (idx: number, detune: number) => Promise<void>;
    setPatchVelocityThreshold: (idx: number, threshold: number) => Promise<void>;
    setPatchVelocityMixRatio: (idx: number, ratio: number) => Promise<void>;
};

/**
 * One row per patch-edit affordance. The optional `keyModePrelude` field
 * encodes the conditional-slider rule: D-PATCH-10/11/12 are only enabled
 * when patch.common.keyMode matches a specific mode, so the scenario
 * MUST flip keyMode before the slider call to make the UI control
 * reachable. Without the prelude, the corresponding UI test couldn't
 * drive the slider at all (the Radix Slider is `disabled`).
 *
 * Value-selection criteria (mirrors the multi-mode block above):
 *   - Each value MUST be non-default for patch 0 on the recording device
 *     so the UI driving the control actually emits a setter call. A
 *     no-op selectOption / slider-commit / fill emits nothing, which
 *     would make the capability spec silently false-pass.
 *   - For enums, the chosen value differs from a typical stock value
 *     (e.g., keyMode='x-fade' vs typical 'normal'; aftertouchAssign='filter'
 *     vs typical 'modulation' or 'bend+').
 *   - For numerics, pick non-default mid-range values that are obviously
 *     distinct from common stock values (e.g., level=100, threshold=80,
 *     ratio=64 — verify against each scenario's captured outbound bytes
 *     so the UI driver always sees a state change). Avoid 0/127 edges
 *     where the device's stock value is more likely to coincide.
 *   - For the 12-char name, pick "TESTNAME" — short, ASCII, unlikely to
 *     match any preset.
 *
 * Scenario ordering note: the conditional sliders' keyMode preludes
 * leave patch 0 in different modes between consecutive recordings. The
 * unconditional `patch-0-key-mode` scenario targets a distinct fifth
 * mode ('x-fade') so its UI driver always sees a state change.
 */
interface PatchWriteScenarioSpec {
    /** Inventory ID — included in the description for traceability. */
    detail: string;
    /** Suffix appended to 'patch-0-' to form the scenario name. */
    suffix: string;
    /** Human label used in annotations + fixture description. */
    label: string;
    /** Drive the setter against the narrowed client. */
    drive: (client: PatchClient) => Promise<void>;
    /**
     * If set, the scenario first calls setPatchKeyMode(0, mode) before
     * `drive`. Required for D-PATCH-10/11/12 — the conditional sliders.
     */
    keyModePrelude?: 'unison' | 'v-sw' | 'v-mix';
}

const PATCH_WRITE_SCENARIOS: PatchWriteScenarioSpec[] = [
    { detail: 'D-PATCH-01', suffix: 'name',          label: 'setPatchName(0, "TESTNAME")',           drive: (c) => c.setPatchName(0, 'TESTNAME') },
    { detail: 'D-PATCH-02', suffix: 'key-mode',      label: 'setPatchKeyMode(0, "x-fade")',          drive: (c) => c.setPatchKeyMode(0, 'x-fade') },
    { detail: 'D-PATCH-03', suffix: 'key-assign',    label: 'setPatchKeyAssign(0, "fix")',           drive: (c) => c.setPatchKeyAssign(0, 'fix') },
    { detail: 'D-PATCH-04', suffix: 'bender-range',  label: 'setPatchBenderRange(0, 8)',             drive: (c) => c.setPatchBenderRange(0, 8) },
    { detail: 'D-PATCH-05', suffix: 'at-assign',     label: 'setPatchAftertouchAssign(0, "filter")', drive: (c) => c.setPatchAftertouchAssign(0, 'filter') },
    { detail: 'D-PATCH-07', suffix: 'output',        label: 'setPatchOutput(0, 4)',                  drive: (c) => c.setPatchOutput(0, 4) },
    { detail: 'D-PATCH-08', suffix: 'level',         label: 'setPatchLevel(0, 100)',                 drive: (c) => c.setPatchLevel(0, 100) },
    { detail: 'D-PATCH-09', suffix: 'at-sens',       label: 'setPatchAftertouchSens(0, 75)',         drive: (c) => c.setPatchAftertouchSens(0, 75) },
    { detail: 'D-PATCH-10', suffix: 'detune',        label: 'setPatchDetune(0, 20)',                 drive: (c) => c.setPatchDetune(0, 20),                 keyModePrelude: 'unison' },
    { detail: 'D-PATCH-11', suffix: 'vsw-threshold', label: 'setPatchVelocityThreshold(0, 80)',      drive: (c) => c.setPatchVelocityThreshold(0, 80),      keyModePrelude: 'v-sw' },
    { detail: 'D-PATCH-12', suffix: 'vmix-ratio',    label: 'setPatchVelocityMixRatio(0, 64)',       drive: (c) => c.setPatchVelocityMixRatio(0, 64),       keyModePrelude: 'v-mix' },
];

function buildPatchWriteScenario(spec: PatchWriteScenarioSpec): [string, Scenario] {
    const name = `patch-0-${spec.suffix}`;
    const preludeNote = spec.keyModePrelude
        ? ` (keyMode='${spec.keyModePrelude}' prelude enables the conditional slider)`
        : '';
    return [
        name,
        {
            name,
            description: `PatchesPage init + ${spec.label} — ${spec.detail}${preludeNote}`,
            run: async ({ client, proxy }) => {
                // Single narrowed cast for this scenario: PatchClient is a
                // structural superset of the PatchModeClient runPatchPageMount
                // returns. The mount helper does the same connect+load against
                // whichever structural subset the caller asks for.
                await runPatchPageMount(client, proxy);
                const c = asClient<PatchClient>(client);
                if (spec.keyModePrelude) {
                    proxy.annotate(`setPatchKeyMode(0, '${spec.keyModePrelude}')`);
                    await c.setPatchKeyMode(0, spec.keyModePrelude);
                }
                proxy.annotate(spec.label);
                await spec.drive(c);
            },
        },
    ];
}

// ---------------------------------------------------------------------------
// Per-scenario client interfaces — named structural subsets each scenario
// requires. Used with `asClient<T>` to centralize the unsafe cast.
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

interface PatchesBankClient extends ConnectOnlyClient {
    loadPatchRange: (start: number, count: number) => Promise<unknown[]>;
}

interface TonesBankClient extends ConnectOnlyClient {
    loadToneRange: (start: number, count: number) => Promise<unknown[]>;
}

interface PlayInitClient extends ConnectOnlyClient {
    loadPatchRange: (start: number, count: number) => Promise<unknown[]>;
    requestFunctionParameters: () => Promise<unknown[]>;
}

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

// ---------------------------------------------------------------------------
// SCENARIOS registry
// ---------------------------------------------------------------------------

export const SCENARIOS: Record<string, Scenario> = {
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

    // Page-shaped scenarios — capture the SysEx sequence each editor page
    // emits on mount, so the harness can replay it deterministically.
    // See GitHub #404; both S-330 and S-550 use 8 patches/tones per bank.

    'patches-bank-0': {
        name: 'patches-bank-0',
        description: 'PatchesPage.loadPatchBank(0) — connect() + loadPatchRange(0, 8)',
        run: async ({ client, proxy }) => {
            const c = asClient<PatchesBankClient>(client);
            proxy.annotate('connect()');
            await c.connect();
            proxy.annotate('loadPatchRange(0, 8)');
            await c.loadPatchRange(0, 8);
        },
    },

    'tones-bank-0': {
        name: 'tones-bank-0',
        description: 'TonesPage.loadToneBank(0) — connect() + loadToneRange(0, 8)',
        run: async ({ client, proxy }) => {
            const c = asClient<TonesBankClient>(client);
            proxy.annotate('connect()');
            await c.connect();
            proxy.annotate('loadToneRange(0, 8)');
            await c.loadToneRange(0, 8);
        },
    },

    'play-init': {
        name: 'play-init',
        description: 'PlayPage initial load — connect() + loadPatchRange(0, 8) + requestFunctionParameters()',
        run: async ({ client, proxy }) => {
            const c = asClient<PlayInitClient>(client);
            proxy.annotate('connect()');
            await c.connect();
            proxy.annotate('loadPatchRange(0, 8)');
            await c.loadPatchRange(0, 8);
            proxy.annotate('requestFunctionParameters()');
            await c.requestFunctionParameters();
        },
    },

    // Multi-mode write scenarios — PlayPage mount sequence plus one setter
    // call each. Driven from the UI in Wave 2b's capability spec to assert
    // each affordance emits the captured outbound byte sequence. See
    // ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md rows D-PLAY-04..07.
    //
    // Value-selection criteria: each value is chosen to be non-default
    // and in-range so that driving the corresponding UI control actually
    // emits a setter call. A no-op selectOption / fill / change that
    // matches the current control value emits nothing, which would make
    // the capability spec silently false-pass. Specific values:
    //   channel = 5   — MIDI channel 6 (display); non-default vs part 0
    //                   stock channel
    //   patch   = 3   — patch slot 4 (display); non-default selection
    //   output  = 4   — output 5 (display); non-default
    //   level   = 80  — non-default; emits setMultiLevel(0, 80) when the
    //                   slider is committed at value 80

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

    // Patch write scenarios (Wave 2a) — PatchesPage mount sequence plus one
    // setter call each. Driven from the UI in capability spec
    // `capabilities/patch-writes.spec.ts` to assert each affordance emits
    // the captured outbound byte sequence. See ROLAND-S550-EDITOR-CAPABILITIES
    // -DETAILED.md rows D-PATCH-01..05, 07..12. (D-PATCH-06 Oct.Shift is
    // display-only pending issue #10 and is intentionally skipped.)
    //
    // Generated table-driven from PATCH_WRITE_SCENARIOS above; see the spec
    // shape comment there for value-selection criteria.
    ...Object.fromEntries(PATCH_WRITE_SCENARIOS.map(buildPatchWriteScenario)),
};

export function listScenarios(): string[] {
    return Object.keys(SCENARIOS);
}
