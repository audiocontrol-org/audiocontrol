/**
 * tools/scope-discovery/editor-core-css-exports.validate.ts
 *
 * Adversarial validator harness for `tools/check-editor-core-css-exports.ts`
 * (akai-harmonization Phase 2 task 2.9). Runs the paired scenarios
 * defined in `editor-core-css-exports.scenarios.ts` and reports PASS
 * to stdout, FAIL to stderr.
 *
 * Pattern mirrors the existing validators (e.g., anti-patterns.validate.ts,
 * adopter-manifests.validate.ts): import the scenario list from a
 * sibling module, iterate, render results uniformly. The scenario
 * file itself owns the fixture-planting + assertion logic so that this
 * harness stays under the file-length cap and the scenario file can
 * be inspected in isolation.
 *
 * Run via:
 *   tsx tools/scope-discovery/editor-core-css-exports.validate.ts
 *   make check-editor-core-css-exports-validate
 *   pnpm test:scope-discovery   (rolled into the global suite)
 *
 * Exit code:
 *   0   every scenario asserts as expected
 *   1   one or more assertions failed (gate is broken)
 *   2   harness infrastructure error
 */

import { errorMessage } from './util/typeguards.js';
import {
  EDITOR_CORE_CSS_EXPORTS_SCENARIOS,
  type ScenarioResult,
} from './editor-core-css-exports.scenarios.js';

async function runAll(): Promise<readonly ScenarioResult[]> {
  const results: ScenarioResult[] = [];
  for (const fn of EDITOR_CORE_CSS_EXPORTS_SCENARIOS) {
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
      `editor-core-css-exports.validate: infra error: ${errorMessage(err)}\n`,
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
      `editor-core-css-exports.validate crashed: ${errorMessage(err)}\n`,
    );
    process.exit(2);
  },
);
