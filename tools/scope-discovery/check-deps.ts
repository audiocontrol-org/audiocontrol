/**
 * tools/scope-discovery/check-deps.ts
 *
 * Pre-flight guard for `make scope-inventory FEATURE=<slug>` (T7.2).
 *
 * Why this script exists
 * ----------------------
 * The `/scope-inventory` skill fans out discovery agents that import
 * `yaml`, `ajv`, and `ajv-formats` at module-load time. When one of
 * those deps isn't installed (fresh clone, interrupted `pnpm install`,
 * stale lockfile), the discovery agents crash with a raw
 * `ERR_MODULE_NOT_FOUND` mid-dispatch — far from where the operator
 * can correlate it with "I haven't installed yet". This guard runs
 * BEFORE the Make target hands off to the skill and converts that
 * failure mode into an actionable error message naming both the
 * missing dep AND the fix invocation (`pnpm install`).
 *
 * Convention choice (Option A in T7.2's workplan).
 *   Other tsx-driven check/validate targets in the Makefile do NOT
 *   depend on `$(INSTALL_STAMP)`; only build targets that compile
 *   modules carry that dependency (see `$(MIDI_CORE): $(INSTALL_STAMP)
 *   ...` at Makefile:827). The convention for tsx-based targets is
 *   "deps must already be installed; fail clearly if not." This
 *   script is the "fail clearly" half. It does NOT run `pnpm install`
 *   itself — that's the operator's call (the script's recommendation
 *   is explicit so they can run it).
 *
 * Behaviour
 *   - Reads the required-deps list from `check-deps.required.ts` so
 *     there is exactly one source of truth.
 *   - Attempts a dynamic `import()` of each. A
 *     `ERR_MODULE_NOT_FOUND` (or any thrown error mentioning the dep
 *     name) is treated as "missing".
 *   - If all resolve, exits 0 silently (success is silent so the
 *     calling Make target's own output is what the operator sees).
 *   - If any are missing, prints an actionable error listing EVERY
 *     missing dep and the install invocation, then exits 1.
 *
 * Invocation
 *   tsx tools/scope-discovery/check-deps.ts
 *
 * Exit code
 *   0   all required deps resolve
 *   1   one or more required deps are missing
 *   2   harness infrastructure error
 */

import { INSTALL_INVOCATION, REQUIRED_SCOPE_DISCOVERY_DEPS } from './check-deps.required.js';
import { errorMessage } from './util/typeguards.js';

interface DepProbeResult {
  readonly name: string;
  readonly ok: boolean;
  readonly errorDetail: string | null;
}

/**
 * Pure resolver: given an importer (defaults to the real dynamic
 * import), probe one dep name and report whether it resolves.
 *
 * Factored as a pluggable function so the validator can inject a
 * synthetic importer that throws for chosen names without touching
 * the on-disk node_modules. Same code path under the same callers.
 */
export type DepImporter = (name: string) => Promise<unknown>;

export async function probeDep(name: string, importer: DepImporter): Promise<DepProbeResult> {
  try {
    await importer(name);
    return { name, ok: true, errorDetail: null };
  } catch (err) {
    return { name, ok: false, errorDetail: errorMessage(err) };
  }
}

export async function probeAll(
  names: ReadonlyArray<string>,
  importer: DepImporter,
): Promise<ReadonlyArray<DepProbeResult>> {
  const results: DepProbeResult[] = [];
  for (const name of names) {
    results.push(await probeDep(name, importer));
  }
  return results;
}

/**
 * Build the actionable error message. Public so the validator can
 * assert on its content without re-running the full guard.
 */
export function formatMissingDepsMessage(
  missing: ReadonlyArray<DepProbeResult>,
  required: ReadonlyArray<string>,
  invocation: string,
): string {
  if (missing.length === 0) {
    throw new Error('formatMissingDepsMessage called with no missing deps');
  }
  const missingNames = missing.map((m) => m.name);
  const lines: string[] = [];
  lines.push(`error: scope-discovery deps missing — cannot run \`make scope-inventory\`.`);
  lines.push('');
  for (const m of missing) {
    lines.push(`  - missing: ${m.name}`);
    if (m.errorDetail !== null && m.errorDetail !== '') {
      lines.push(`      detail: ${m.errorDetail}`);
    }
  }
  lines.push('');
  lines.push(`Run \`${invocation}\` first — the scope-discovery agents require: ${required.join(', ')}.`);
  lines.push(`Missing in this run: ${missingNames.join(', ')}.`);
  lines.push('');
  return lines.join('\n');
}

const realImporter: DepImporter = (name) => import(name);

async function main(): Promise<number> {
  const results = await probeAll(REQUIRED_SCOPE_DISCOVERY_DEPS, realImporter);
  const missing = results.filter((r) => !r.ok);
  if (missing.length === 0) {
    return 0;
  }
  process.stderr.write(
    formatMissingDepsMessage(missing, REQUIRED_SCOPE_DISCOVERY_DEPS, INSTALL_INVOCATION),
  );
  return 1;
}

// Only run main() when this file is the entry point (not when imported
// by the validator).
const isMainEntry =
  process.argv[1] !== undefined && process.argv[1].endsWith('check-deps.ts');

if (isMainEntry) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`check-deps: harness error: ${errorMessage(err)}\n`);
      process.exit(2);
    },
  );
}
