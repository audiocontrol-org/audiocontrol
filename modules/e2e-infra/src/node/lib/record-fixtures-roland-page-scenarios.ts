/**
 * record-fixtures-roland — page-mount scenarios + shared preludes.
 *
 * One slice of the scenario registry. This slice carries:
 *
 *   - The three "page mount" baseline scenarios — `patches-bank-0`,
 *     `tones-bank-0`, `play-init` — used by the page-level capability
 *     specs (capabilities/patches.spec.ts, tones.spec.ts, etc.).
 *   - The three shared mount helpers — `runPatchPageMount`,
 *     `runTonePageMount`, `runMultiModeMount` — and their named
 *     structural client interfaces (`PatchModeClient`, `ToneModeClient`,
 *     `MultiModeClient`). These are re-exported so the sibling slices
 *     (`patch-scenarios.ts`, `multi-scenarios.ts`, `tone-scenarios.ts`)
 *     can chain their setter calls after the mount prelude.
 *
 * Why a shared slice rather than per-page slices: each editor page's
 * mount sequence shows up in (a) the page-mount scenario itself and
 * (b) every setter scenario that drives that page. Co-locating the
 * mount helper with the mount scenario keeps the two in lock-step:
 * if the page's `loadInitialData` ever grows a new step, both update
 * here, and every downstream setter scenario picks up the change for
 * free.
 *
 * Sibling files — see `record-fixtures-roland-core-scenarios.ts`
 * header for the full layout.
 *
 * @packageDocumentation
 */
import {
    asClient,
    type Scenario,
    type ScenarioContext,
} from '#node/lib/record-fixtures-roland-core-scenarios.js';

// ---------------------------------------------------------------------------
// Shared mount-helper client interfaces — exported because the sibling
// setter-scenario slices extend these for their setter signatures.
// ---------------------------------------------------------------------------

/**
 * Subset of S330/S550 client surface used by the PlayPage mount + setter
 * scenarios. Named so each setter scenario can extend with its setter
 * signature.
 */
export interface MultiModeClient {
    connect: () => Promise<boolean>;
    loadPatchRange: (start: number, count: number) => Promise<unknown[]>;
    requestFunctionParameters: () => Promise<unknown[]>;
}

/**
 * Subset of S330/S550 client surface used by the PatchesPage mount +
 * setter scenarios. PatchesPage doesn't need requestFunctionParameters;
 * the editor mount only needs the bank-0 patches loaded so PatchEditor
 * can decode + drive setters.
 */
export interface PatchModeClient {
    connect: () => Promise<boolean>;
    loadPatchRange: (start: number, count: number) => Promise<unknown[]>;
}

/**
 * Subset of S330/S550 client surface used by the TonesPage mount +
 * setter scenarios. TonesPage's `loadInitialData` calls only
 * `loadToneBank(0)` (→ `loadToneRange(0, tonesPerBank)`); no patch
 * preload, no function-parameters fetch.
 */
export interface ToneModeClient {
    connect: () => Promise<boolean>;
    loadToneRange: (start: number, count: number) => Promise<unknown[]>;
}

// ---------------------------------------------------------------------------
// Shared mount helpers — emit `connect + load…` against the proxy.
// Each setter scenario calls one of these, then drives its setter on
// the returned narrowed client.
// ---------------------------------------------------------------------------

/**
 * Run the shared PlayPage mount sequence (connect + loadPatchRange(0, 8) +
 * requestFunctionParameters) against the proxy, emitting annotations for
 * each step. The 4 multi-mode write scenarios share this prelude. Returns
 * the narrowed client so callers can chain the setter call on the result.
 */
export async function runMultiModeMount(
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
 * Run the shared PatchesPage mount sequence (connect + loadPatchRange(0, 8))
 * against the proxy, emitting annotations for each step. The 11 patch-edit
 * write scenarios (D-PATCH-01..05, 07..12) share this prelude.
 */
export async function runPatchPageMount(
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

/**
 * Run the shared TonesPage mount sequence (connect + loadToneRange(0, 8))
 * against the proxy, emitting annotations for each step. Wave 2c's
 * tone-write scenarios all share this prelude. Returns the narrowed
 * client so callers can chain `sendToneData(0, mutatedTone)` on the
 * result.
 *
 * Note the asymmetry with PatchesPage: PatchesPage's actual mount also
 * calls loadToneBank(0) afterwards (which surfaces as filterable known-
 * divergence noise in patch-writes specs — see issue #405). TonesPage,
 * by contrast, only loads the tone bank; no patch preload. That keeps
 * the tone-write spec from needing a divergence filter at all.
 */
export async function runTonePageMount(
    client: unknown,
    proxy: ScenarioContext['proxy'],
): Promise<ToneModeClient> {
    const c = asClient<ToneModeClient>(client);
    proxy.annotate('connect()');
    await c.connect();
    proxy.annotate('loadToneRange(0, 8)');
    await c.loadToneRange(0, 8);
    return c;
}

// ---------------------------------------------------------------------------
// Page-mount scenarios — the editor page mount sequence captured as its
// own fixture so the matching capability spec can replay it deterministically.
// See GitHub #404; both S-330 and S-550 use 8 patches/tones per bank.
// ---------------------------------------------------------------------------

export const PAGE_SCENARIOS: Record<string, Scenario> = {
    'patches-bank-0': {
        name: 'patches-bank-0',
        description: 'PatchesPage.loadPatchBank(0) — connect() + loadPatchRange(0, 8)',
        run: async ({ client, proxy }) => {
            await runPatchPageMount(client, proxy);
        },
    },

    'tones-bank-0': {
        name: 'tones-bank-0',
        description: 'TonesPage.loadToneBank(0) — connect() + loadToneRange(0, 8)',
        run: async ({ client, proxy }) => {
            await runTonePageMount(client, proxy);
        },
    },

    'play-init': {
        name: 'play-init',
        description: 'PlayPage initial load — connect() + loadPatchRange(0, 8) + requestFunctionParameters()',
        run: async ({ client, proxy }) => {
            await runMultiModeMount(client, proxy);
        },
    },
};
