/**
 * tools/scope-discovery/tab-active-state.validate.ts
 *
 * Adversarial validator harness for the tab-active-state gates
 * (`tools/codegen-tab-active-state.ts` — Gate A; and
 *  `tools/check-tab-active-state-sources.ts` — Gate B). Runs every
 * scenario in `tab-active-state.scenarios.ts` as a subprocess and
 * reports PASS to stdout / FAIL to stderr.
 *
 * Pattern mirrors the existing scope-discovery validator harnesses
 * (e.g., editor-core-css-exports.validate.ts): the scenario file
 * owns fixture-planting + assertion logic; this entry point just
 * iterates + renders. Keeps both files under the file-length cap
 * and lets the scenario file be inspected in isolation.
 *
 * Run via:
 *   tsx tools/scope-discovery/tab-active-state.validate.ts
 *   make check-tab-active-state-validate
 *   pnpm test:scope-discovery   (rolled into the global suite)
 *
 * Exit code:
 *   0   every scenario asserts as expected
 *   1   one or more assertions failed (gate is broken)
 *   2   harness infrastructure error
 */

import { errorMessage } from './util/typeguards.js';
import {
  TAB_ACTIVE_STATE_SCENARIOS,
  type ScenarioResult,
} from './tab-active-state.scenarios.js';

async function runAll(): Promise<readonly ScenarioResult[]> {
  const results: ScenarioResult[] = [];
  for (const fn of TAB_ACTIVE_STATE_SCENARIOS) {
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
    process.stderr.write(
      `tab-active-state.validate: infra error: ${errorMessage(err)}\n`,
    );
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
    process.stderr.write(
      `tab-active-state.validate crashed: ${errorMessage(err)}\n`,
    );
    process.exit(2);
  },
);
