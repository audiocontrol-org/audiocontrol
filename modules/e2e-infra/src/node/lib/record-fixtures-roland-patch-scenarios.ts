/**
 * record-fixtures-roland — patch-write scenarios (Wave 2a).
 *
 * 11 fixtures, one per patch-common affordance (D-PATCH-01..05, 07..12;
 * D-PATCH-06 Octave Shift is display-only pending issue #10).
 *
 * Each scenario shares the PatchesPage mount prelude (connect +
 * loadPatchRange(0, 8)) — see `runPatchPageMount` in
 * `record-fixtures-roland-page-scenarios.ts` — then calls exactly one
 * setter to capture its outbound SysEx bytes. The corresponding UI
 * capability spec (`test/wiring/patch-writes.spec.ts`) drives
 * the matching UI affordance and asserts the bytes match.
 *
 * Sibling files — see `record-fixtures-roland-core-scenarios.ts` header.
 *
 * @packageDocumentation
 */
import type {
    SSeriesAftertouchAssign,
    SSeriesKeyAssign,
} from '@audiocontrol/sampler-devices/roland-s-series';
import {
    asClient,
    type Scenario,
} from '#node/lib/record-fixtures-roland-core-scenarios.js';
import {
    runPatchPageMount,
    type PatchModeClient,
} from '#node/lib/record-fixtures-roland-page-scenarios.js';

// ---------------------------------------------------------------------------
// Patch-write scenarios — table-driven
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

export const PATCH_SCENARIOS: Record<string, Scenario> = Object.fromEntries(
    PATCH_WRITE_SCENARIOS.map(buildPatchWriteScenario),
);
