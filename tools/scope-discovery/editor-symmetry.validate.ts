/**
 * tools/scope-discovery/editor-symmetry.validate.ts
 *
 * Adversarial validator entry-point for `check-editor-symmetry.ts`
 * (workplan T6.3). Scenarios + fixture payloads live in the sibling
 * `editor-symmetry.scenarios.ts` + `editor-symmetry.fixtures.ts`
 * modules to keep this file lean.
 *
 * Mirrors the other scope-discovery validators (T6.1 anti-patterns,
 * T6.2 adopter-manifests): each scenario uses an isolated fixture
 * directory + subprocess invocation; PASS to stdout, FAIL to stderr;
 * a gutted-stub self-check guards against the harness silently
 * accepting a broken scanner.
 *
 * Run via:
 *   tsx tools/scope-discovery/editor-symmetry.validate.ts
 *   make check-editor-symmetry-validate
 *
 * Exit codes:
 *   0   every scenario asserts as expected
 *   1   one or more assertions failed (scanner is broken)
 *   2   harness infrastructure error
 */

import { SCENARIOS, type ScenarioResult } from './editor-symmetry.scenarios.js';
import { errorMessage } from './util/typeguards.js';

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
    process.stderr.write(`editor-symmetry.validate: infra error: ${errorMessage(err)}\n`);
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
    process.stderr.write(`editor-symmetry.validate crashed: ${errorMessage(err)}\n`);
    process.exit(2);
  },
);
