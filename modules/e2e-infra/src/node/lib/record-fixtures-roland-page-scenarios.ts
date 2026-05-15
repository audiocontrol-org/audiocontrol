/**
 * record-fixtures-roland — page-mount scenarios + shared preludes.
 *
 * One slice of the scenario registry. This slice carries:
 *
 *   - The three "page mount" baseline scenarios — `patches-bank-0`,
 *     `tones-bank-0`, `play-init` — used by the page-level capability
 *     specs (wiring/patches.spec.ts, tones.spec.ts, etc.).
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
import { createFrontPanelController } from '@audiocontrol/sampler-devices/s330';

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

/**
 * Subset of S330/S550 client surface used by the LibraryPage's
 * `handleLoadDeviceData` ("Refresh Device" button) sequence — see #421.
 * The per-bank loop in LibraryPage.tsx:241-250 walks tones-first then
 * patches-first, eight slots per bank, with `forceReload=true`. The
 * recorded byte stream is byte-equivalent to one big `loadToneRange(0,
 * totalTones)` + `loadPatchRange(0, totalPatches)` (the underlying
 * `requestToneData` / `requestPatchData` calls are issued one slot at
 * a time regardless of bank chunking) — but we recreate the page's
 * per-bank loop verbatim so any future page-side change (different
 * bank size, different ordering) forces a scenario edit + recapture.
 */
export interface LibraryPageClient {
    connect: () => Promise<boolean>;
    loadToneRange: (start: number, count: number) => Promise<unknown[]>;
    loadPatchRange: (start: number, count: number) => Promise<unknown[]>;
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

/**
 * Per-device totals consumed by the `library-page-load` scenario.
 * The values match `modules/roland-sxx0-editor/src/configs/s550.ts:27-30`
 * and `modules/roland-sxx0-editor/src/configs/s330.ts:28-31` — keep these
 * pinned to the editor configs (i.e. if the editor's totalPatches /
 * totalTones / bank-size constants ever change, this map MUST update in
 * lock-step or the fixture will diverge from the page on replay).
 *
 *   - S-550: 64 tones (8 banks × 8) + 32 patches (4 banks × 8) = 12 bank loads
 *   - S-330: 32 tones (4 banks × 8) + 16 patches (2 banks × 8) =  6 bank loads
 */
const LIBRARY_PAGE_TOTALS = {
    s550: { totalTones: 64, totalPatches: 32, tonesPerBank: 8, patchesPerBank: 8 },
    s330: { totalTones: 32, totalPatches: 16, tonesPerBank: 8, patchesPerBank: 8 },
} as const;

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

    /**
     * Wave 5 close-out (#421) — captures the byte stream LibraryPage's
     * `handleLoadDeviceData` callback emits when the user clicks
     * "Refresh Device" (`modules/roland-sxx0-editor/src/pages/
     * LibraryPage.tsx:232-255`, button at :333).
     *
     * The page mounts the s330 simulated transport (because
     * `useMidiStore = getMidiStore('s330')` is hardcoded in
     * `midiStore.ts:137`), so the fixture lives under the `s330/`
     * directory even when captured against S-550 hardware — the same
     * convention `tones.spec.ts:11-15` documents for `tones-bank-0`.
     *
     * The page state (totalTones / totalPatches / bank sizes) comes from
     * `useDeviceConfig()` keyed off the URL `:device` segment. When the
     * spec mounts `/roland/s550/editor/library`, the S-550 config drives
     * the bank-count loop AND `config.createClient` returns an S-550
     * client whose `loadToneRange` / `loadPatchRange` emits S-550 RQDs.
     * Capturing this scenario against the real S-550 (`make
     * record-fixtures-roland-s550 ARGS="--scenario library-page-load"`)
     * therefore produces the exact bytes the spec will see at replay
     * time.
     *
     * Why not reuse `load-everything`: `load-everything` issues ONE
     * `loadPatchRange(0, totalPatches)` followed by ONE
     * `loadToneRange(0, totalTones)` — patch-first, tone-second, in a
     * single call each. `handleLoadDeviceData` issues per-bank
     * `loadToneRange` calls FIRST, then per-bank `loadPatchRange` calls.
     * The underlying `requestToneData` / `requestPatchData` byte stream
     * differs in (a) ordering (tones-first, not patches-first) and (b)
     * scheduling (per-bank chunking — though each `requestXxxData` is
     * still issued one slot at a time the per-bank loop interleaves
     * `markXxxBankLoaded` calls between chunks, which has no MIDI
     * effect today but locks the page's behaviour to a specific
     * sequence the spec should replay verbatim).
     *
     * The `client.connect()` call at LibraryPage.tsx:238 emits no
     * SysEx (client-level connect just sets an internal `connected`
     * flag — see `s-series-client.ts:754-757`), so the `connect()`
     * annotation issued at the top of the scenario never lands in the
     * captured stream: the recorder's `pendingAnnotation` is overwritten
     * by the first `loadToneRange` annotation before any record is
     * written (recording-proxy.ts:113-115 — annotations attach to the
     * next outbound record). The first recorded byte is the bank-1
     * `loadToneRange` RQD; subsequent per-bank annotations attach to
     * the first RQD of each bank load.
     *
     * Fixture totals captured against S-550 on Volt 4: 1310 records
     * (703 outbound RQDs + 607 inbound DT1 fragments). The inbound
     * count exceeds the outbound count because the S-550's tone-data
     * response is sent as multiple DT1 fragments per request to
     * accommodate the wave-segment metadata. 12 of the outbound
     * records carry an `annotation` field (one per bank load); the
     * other 691 are mid-load RQDs without annotations.
     */
    'library-page-load': {
        name: 'library-page-load',
        description:
            'LibraryPage Refresh Device — connect() + per-bank loadToneRange + per-bank loadPatchRange',
        run: async ({ client, device, proxy }) => {
            const c = asClient<LibraryPageClient>(client);
            const totals = LIBRARY_PAGE_TOTALS[device];
            const toneBankCount = Math.ceil(totals.totalTones / totals.tonesPerBank);
            const patchBankCount = Math.ceil(totals.totalPatches / totals.patchesPerBank);

            proxy.annotate('connect()');
            await c.connect();

            for (let bank = 0; bank < toneBankCount; bank += 1) {
                const start = bank * totals.tonesPerBank;
                proxy.annotate(`loadToneRange(${start}, ${totals.tonesPerBank}) — bank ${bank + 1}/${toneBankCount}`);
                await c.loadToneRange(start, totals.tonesPerBank);
            }

            for (let bank = 0; bank < patchBankCount; bank += 1) {
                const start = bank * totals.patchesPerBank;
                proxy.annotate(`loadPatchRange(${start}, ${totals.patchesPerBank}) — bank ${bank + 1}/${patchBankCount}`);
                await c.loadPatchRange(start, totals.patchesPerBank);
            }
        },
    },

    /**
     * Wave 6 (#417) — captures the bytes emitted when the user clicks
     * the MIDI Panic button in Layout's header (D-XX-11).
     *
     * The Panic button calls `useMidiStore.sendPanic()`
     * (modules/editor-core/src/stores/createMidiStore.ts:273), which
     * emits — per channel 0..15, in this order — CC 120 (All Sound
     * Off) then CC 123 (All Notes Off): two 3-byte channel messages
     * per channel for a total of 32 outbound records. Critically, the
     * order is CC120-then-CC123 (NOT the client `panic()` method's
     * CC123-then-CC120 order); the page wires through the store, not
     * the client, so the fixture must match the store's ordering
     * exactly. We emit via `proxy.send()` rather than `client.panic()`
     * so the recorded bytes are byte-for-byte what the production
     * page will emit at replay time.
     *
     * The prelude is `runPatchPageMount` (connect + loadPatchRange(0, 8))
     * so the harness mounts the PatchesPage where Layout is hosted.
     * The Panic button is enabled only once `status === 'connected'`,
     * so the mount prelude is load-bearing for the spec, not just
     * scenery.
     */
    'panic-flow': {
        name: 'panic-flow',
        description:
            'Layout MIDI Panic — connect() + loadPatchRange(0, 8) + 32 outbound CCs (CC 120 + 123 across 16 channels)',
        run: async ({ client, proxy }) => {
            await runPatchPageMount(client, proxy);
            proxy.annotate('sendPanic() — 32 outbound CCs across 16 channels');
            for (let channel = 0; channel < 16; channel += 1) {
                const status = 0xb0 + channel;
                proxy.send([status, 120, 0]);
                proxy.send([status, 123, 0]);
            }
        },
    },

    /**
     * Wave 6 (#417) — captures the bytes emitted when the user clicks each
     * of the five drawer-embedded function buttons in order: MODE, MENU,
     * SUB, COM, EXEC (D-XX-04).
     *
     * The drawer-embedded front panel (mounted via VideoCapture.tsx:363-380)
     * routes button clicks through `useFrontPanel` →
     * `createFrontPanelController(adapter, { deviceId })`.
     * `pressFunction(button)` emits a single category-01 DT1 message per
     * call (FUNCTION_CODES in s330-front-panel.ts:131-135), so the recorded
     * bytes are exactly 5 outbound DT1 messages after the mount prelude.
     *
     * We drive the production controller against the recording proxy so
     * the captured bytes are byte-for-byte what the React tree will emit
     * at replay time. This is the same recording shape used for the panic
     * fixture — the controller wraps a real `SSeriesMidiAdapter`, and
     * `proxy` implements that interface, so passing it in lets the
     * controller's `midiAdapter.send()` calls flow straight into the
     * fixture.
     */
    'front-panel-function-flow': {
        name: 'front-panel-function-flow',
        description:
            'Drawer-embedded function buttons (D-XX-04) — connect() + loadPatchRange(0, 8) + 5 DT1 presses (MODE, MENU, SUB, COM, EXEC)',
        run: async ({ client, proxy, deviceId }) => {
            await runPatchPageMount(client, proxy);
            const controller = createFrontPanelController(proxy, { deviceId });
            const buttons = ['mode', 'menu', 'sub-menu', 'com', 'execute'] as const;
            for (const button of buttons) {
                proxy.annotate(`pressFunction('${button}')`);
                await controller.pressFunction(button);
            }
        },
    },

    /**
     * Wave 6 (#417) — captures the bytes emitted when the user clicks the
     * four drawer-embedded arrow buttons in 'menu' mode (D-XX-02). Order:
     * Up, Down, Left, Right.
     *
     * 'menu' mode is the React state's default (useFrontPanel.ts:93). The
     * drawer's "Arrow category" toggle (01 vs 09) controls which mode
     * `pressNavigation` uses; the matching capability spec explicitly does
     * NOT touch that toggle, so this fixture is captured against the
     * default category-01 path. Each arrow press emits ONE DT1 message
     * (ARROW_CODES_CAT01 in s330-front-panel.ts:97-102) — 4 outbound DT1
     * records after the mount prelude.
     */
    'front-panel-nav-flow': {
        name: 'front-panel-nav-flow',
        description:
            "Drawer-embedded arrow buttons (D-XX-02) — connect() + loadPatchRange(0, 8) + 4 DT1 presses (Up, Down, Left, Right) in 'menu' mode",
        run: async ({ client, proxy, deviceId }) => {
            await runPatchPageMount(client, proxy);
            const controller = createFrontPanelController(proxy, { deviceId });
            const arrows = ['up', 'down', 'left', 'right'] as const;
            for (const arrow of arrows) {
                proxy.annotate(`pressNavigation('${arrow}', 'menu')`);
                await controller.pressNavigation(arrow, 'menu');
            }
        },
    },

    /**
     * Wave 6 (#417) — captures the bytes emitted when the user clicks the
     * two drawer-embedded value buttons in order: Inc, Dec (D-XX-03).
     *
     * Inc/Dec always use category-09 press/release pairs (VALUE_CODES in
     * s330-front-panel.ts:119-122). `pressNavigation('inc')` emits:
     *   1. press DT1 [0x09, 0x04]
     *   2. await delay(NAVIGATION_DELAY_MS = 50ms)
     *   3. release DT1 [0x09, 0x0c]
     * So each value-button click contributes TWO DT1 records. Two clicks
     * (inc + dec) = 4 outbound DT1 records after the mount prelude.
     */
    'front-panel-value-flow': {
        name: 'front-panel-value-flow',
        description:
            'Drawer-embedded value buttons (D-XX-03) — connect() + loadPatchRange(0, 8) + 4 DT1 records (inc press+release, dec press+release)',
        run: async ({ client, proxy, deviceId }) => {
            await runPatchPageMount(client, proxy);
            const controller = createFrontPanelController(proxy, { deviceId });
            const values = ['inc', 'dec'] as const;
            for (const value of values) {
                proxy.annotate(`pressNavigation('${value}') — press + release`);
                await controller.pressNavigation(value);
            }
        },
    },
};
