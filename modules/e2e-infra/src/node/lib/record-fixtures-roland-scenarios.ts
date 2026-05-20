/**
 * record-fixtures-roland — scenario registry (aggregator).
 *
 * Sister file to record-fixtures-roland.ts (the CLI driver). This file
 * is just the aggregator: it merges every per-area scenario slice into
 * one `SCENARIOS` registry the CLI consumes. Each slice carries its own
 * scenarios + their helpers + their named structural client interfaces
 * so the per-area file caps stay well under 300-500 lines as new write
 * waves land.
 *
 * Layout:
 *
 *   - core-scenarios.ts    — `Scenario` / `ScenarioContext` / `ScenarioFn`
 *                            types, the `asClient<T>` helper, and the 4
 *                            baseline scenarios (connect-only,
 *                            load-everything, fetch-patch-0, fetch-tone-0).
 *   - page-scenarios.ts    — page-mount scenarios (patches-bank-0,
 *                            tones-bank-0, play-init) + the shared mount
 *                            helpers (runPatchPageMount, runTonePageMount,
 *                            runMultiModeMount) and their client interfaces.
 *   - patch-scenarios.ts   — 11 patch-write scenarios (D-PATCH-01..05,
 *                            07..12) — Wave 2a.
 *   - multi-scenarios.ts   — 4 multi-mode write scenarios (D-PLAY-04..07)
 *                            — Wave 2b.
 *   - tone-scenarios.ts    — ~39 tone-write scenarios (D-TONE-WAVE,
 *                            PITCH, TVF, TVA, LFO, ENV) — Wave 2c.
 *
 * Public surface re-exported here:
 *   - `SCENARIOS` — the merged registry the CLI driver consumes.
 *   - `listScenarios()` — keys of the registry, for `--list-scenarios`.
 *   - `Scenario`, `ScenarioContext`, `ScenarioFn` — the types
 *     scenario authors and CLI argument-validation use.
 *
 * @packageDocumentation
 */

import { CORE_SCENARIOS } from '#node/lib/record-fixtures-roland-core-scenarios.js';
import { PAGE_SCENARIOS } from '#node/lib/record-fixtures-roland-page-scenarios.js';
import { PATCH_SCENARIOS } from '#node/lib/record-fixtures-roland-patch-scenarios.js';
import { MULTI_SCENARIOS } from '#node/lib/record-fixtures-roland-multi-scenarios.js';
import { TONE_SCENARIOS } from '#node/lib/record-fixtures-roland-tone-scenarios.js';
import type { Scenario } from '#node/lib/record-fixtures-roland-core-scenarios.js';

// Re-export the public types so existing import sites keep working.
export type {
    Scenario,
    ScenarioContext,
    ScenarioFn,
} from '#node/lib/record-fixtures-roland-core-scenarios.js';

export const SCENARIOS: Record<string, Scenario> = {
    ...CORE_SCENARIOS,
    ...PAGE_SCENARIOS,
    ...PATCH_SCENARIOS,
    ...MULTI_SCENARIOS,
    ...TONE_SCENARIOS,
};

export function listScenarios(): string[] {
    return Object.keys(SCENARIOS);
}
