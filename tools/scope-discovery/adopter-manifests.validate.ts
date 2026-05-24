/**
 * tools/scope-discovery/adopter-manifests.validate.ts
 *
 * Adversarial validator entry-point for `check-adopters.ts` (workplan
 * T6.2). The scenarios + fixture payloads live in the sibling
 * `adopter-manifests.scenarios.ts` module to keep this file under the
 * 300-500 line cap mandated by ~/work/CLAUDE.md.
 *
 * Pattern mirrors anti-patterns.validate.ts and the other scope-
 * discovery validators:
 *   - subprocess invocation of the scanner (no programmatic coupling),
 *   - per-scenario isolated fixture directory,
 *   - PASS to stdout, FAIL to stderr (CI greps stderr for FAIL),
 *   - gutted self-check stubs the scanner to always exit 0 and asserts
 *     that the detection-required scenarios DON'T accept the stub.
 *
 * Run via:
 *   tsx tools/scope-discovery/adopter-manifests.validate.ts
 *   make check-adopters-validate
 *
 * Exit code:
 *   0   every scenario asserts as expected
 *   1   one or more assertions failed (scanner is broken)
 *   2   harness infrastructure error
 */

import { SCENARIOS, type ScenarioResult } from './adopter-manifests.scenarios.js';
import { TRACKED_HOLDOUTS_SCENARIOS } from './adopter-manifests.tracked-holdouts-scenarios.js';
import { FROM_LIST_SCENARIOS } from './adopter-manifests.from-list-scenarios.js';
import { SUMMARY_ORDERING_SCENARIOS } from './adopter-manifests.summary-ordering-scenarios.js';
import { errorMessage } from './util/typeguards.js';

const ALL_SCENARIOS: ReadonlyArray<() => Promise<ScenarioResult>> = [
  ...SCENARIOS,
  ...TRACKED_HOLDOUTS_SCENARIOS,
  // AUDIT-20260524-08 Part A — `from:` may be a string OR a non-empty
  // list of strings to support cross-module primitive promotion.
  ...FROM_LIST_SCENARIOS,
  // AUDIT-20260524-13 — summary line is always the last non-empty line
  // of stdout; `--quiet` honors real-holdout presence.
  ...SUMMARY_ORDERING_SCENARIOS,
];

async function runAll(): Promise<readonly ScenarioResult[]> {
  const results: ScenarioResult[] = [];
  for (const fn of ALL_SCENARIOS) {
    try {
      results.push(await fn());
    } catch (err) {
      results.push({
        name: fn.name,
        passed: false,
        detail: `harness error: ${errorMessage(err)}`,
      });
    }
  }
  return results;
}

async function main(): Promise<number> {
  let results: readonly ScenarioResult[];
  try {
    results = await runAll();
  } catch (err) {
    process.stderr.write(`adopter-manifests.validate: infra error: ${errorMessage(err)}\n`);
    return 2;
  }
  let passed = 0;
  for (const r of results) {
    if (r.passed) {
      process.stdout.write(`PASS ${r.name}: ${r.detail}\n`);
      passed += 1;
    } else {
      process.stderr.write(`FAIL ${r.name}: ${r.detail}\n`);
    }
  }
  process.stdout.write(`Summary: ${passed}/${results.length} scenarios passed\n`);
  return passed === results.length ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    process.stderr.write(`adopter-manifests.validate crashed: ${errorMessage(err)}\n`);
    process.exit(2);
  },
);
