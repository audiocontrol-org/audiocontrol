/**
 * tools/scope-discovery/discovery-agents/regime-holdout-detector.validate.ts
 *
 * Adversarial validator entry-point for the T6.5 regime-holdout-
 * detector discovery agent. Scenarios live in
 * `regime-holdout-detector.scenarios.ts`; this module is the harness
 * that runs them in sequence and emits PASS/FAIL lines.
 *
 * Mirrors the T6.1 / T6.2 / T6.3 / T6.4 validators: each scenario uses
 * an isolated fixture directory + subprocess invocation; PASS to
 * stdout, FAIL to stderr; a gutted-stub self-check guards against the
 * harness silently accepting a broken agent.
 *
 * Run via:
 *   tsx tools/scope-discovery/discovery-agents/regime-holdout-detector.validate.ts
 *   make check-regime-holdout-validate
 *
 * Exit codes:
 *   0   every scenario asserts as expected
 *   1   one or more assertions failed (agent is broken)
 *   2   harness infrastructure error
 */

import {
  SCENARIOS,
  type ScenarioResult,
} from './regime-holdout-detector.scenarios.js';
import { errorMessage } from '../util/typeguards.js';

async function runAll(): Promise<readonly ScenarioResult[]> {
  const results: ScenarioResult[] = [];
  for (const fn of SCENARIOS) {
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
      `regime-holdout-detector.validate: infra error: ${errorMessage(err)}\n`,
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
      `regime-holdout-detector.validate crashed: ${errorMessage(err)}\n`,
    );
    process.exit(2);
  },
);
