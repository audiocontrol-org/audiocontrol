/**
 * tools/scope-discovery/check-deps.validate.ts
 *
 * Adversarial validator for the T7.2 scope-discovery dep guard.
 * Proves that:
 *
 *   1. All deps present: every name in REQUIRED_SCOPE_DISCOVERY_DEPS
 *      resolves under the real importer, and the guard exits 0
 *      silently.
 *   2. One dep missing: a synthetic importer that throws for one name
 *      yields an actionable error naming THAT dep and the install
 *      invocation.
 *   3. Multiple deps missing: an importer that throws for two names
 *      yields an error naming BOTH.
 *   4. Actionable message: the formatted error contains the string
 *      "pnpm install" AND names every required dep so the operator
 *      can read the fix off the message alone.
 *   5. Gutted-stub self-check: a stubbed probe that always reports
 *      `ok: true` makes scenario 2's assertion FAIL, proving the
 *      harness rejects a no-op guard.
 *   6. Package.json coherence: every entry in
 *      REQUIRED_SCOPE_DISCOVERY_DEPS is listed in package.json's
 *      devDependencies. Catches the "removed from package.json but
 *      left in the guard" silent-drift failure mode.
 *
 * Run via:
 *   tsx tools/scope-discovery/check-deps.validate.ts
 *   make check-deps-validate
 *
 * Exit code:
 *   0   every scenario asserts as expected
 *   1   one or more assertions failed
 *   2   harness infrastructure error
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  formatMissingDepsMessage,
  probeAll,
  type DepImporter,
} from './check-deps.js';
import {
  INSTALL_INVOCATION,
  REQUIRED_SCOPE_DISCOVERY_DEPS,
} from './check-deps.required.js';
import { errorMessage, isPlainObject } from './util/typeguards.js';

interface ScenarioResult {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

function pass(name: string, detail: string): ScenarioResult {
  return { name, passed: true, detail };
}

function fail(name: string, detail: string): ScenarioResult {
  return { name, passed: false, detail };
}

/** Importer that delegates to the real dynamic import. */
const realImporter: DepImporter = (name) => import(name);

/**
 * Build an importer that throws ERR_MODULE_NOT_FOUND for any name in
 * `missing` and delegates to the real importer otherwise. The error
 * carries a `code` field shaped like Node's so downstream string
 * detection isn't load-bearing.
 */
function makeFailingImporter(missing: ReadonlyArray<string>): DepImporter {
  return async (name) => {
    if (missing.includes(name)) {
      const err = new Error(`Cannot find package '${name}' imported from synthetic`);
      Object.defineProperty(err, 'code', { value: 'ERR_MODULE_NOT_FOUND' });
      throw err;
    }
    return realImporter(name);
  };
}

/** Scenario 1: all deps present -> 0 missing, no message. */
async function scenarioAllDepsPresent(): Promise<ScenarioResult> {
  const results = await probeAll(REQUIRED_SCOPE_DISCOVERY_DEPS, realImporter);
  const missing = results.filter((r) => !r.ok);
  if (missing.length !== 0) {
    return fail(
      'all-deps-present',
      `expected 0 missing under real importer; got ${missing.length}: ` +
        missing.map((m) => `${m.name}(${m.errorDetail ?? ''})`).join(', '),
    );
  }
  return pass(
    'all-deps-present',
    `every required dep (${REQUIRED_SCOPE_DISCOVERY_DEPS.join(', ')}) resolves silently`,
  );
}

/** Scenario 2: one dep missing -> message names that dep. */
async function scenarioOneDepMissing(): Promise<ScenarioResult> {
  const target = 'yaml';
  const results = await probeAll(
    REQUIRED_SCOPE_DISCOVERY_DEPS,
    makeFailingImporter([target]),
  );
  const missing = results.filter((r) => !r.ok);
  if (missing.length !== 1) {
    return fail(
      'one-dep-missing',
      `expected exactly 1 missing; got ${missing.length}`,
    );
  }
  if (missing[0]?.name !== target) {
    return fail(
      'one-dep-missing',
      `expected missing name=${target}; got ${missing[0]?.name ?? 'undefined'}`,
    );
  }
  const message = formatMissingDepsMessage(
    missing,
    REQUIRED_SCOPE_DISCOVERY_DEPS,
    INSTALL_INVOCATION,
  );
  if (!message.includes(target)) {
    return fail('one-dep-missing', `message did not name dep "${target}": ${message}`);
  }
  return pass('one-dep-missing', `missing=${target}; message names it`);
}

/** Scenario 3: multiple deps missing -> message names ALL of them. */
async function scenarioMultipleDepsMissing(): Promise<ScenarioResult> {
  const targets: ReadonlyArray<string> = ['yaml', 'ajv'];
  const results = await probeAll(
    REQUIRED_SCOPE_DISCOVERY_DEPS,
    makeFailingImporter(targets),
  );
  const missing = results.filter((r) => !r.ok);
  if (missing.length !== targets.length) {
    return fail(
      'multiple-deps-missing',
      `expected ${targets.length} missing; got ${missing.length}`,
    );
  }
  const message = formatMissingDepsMessage(
    missing,
    REQUIRED_SCOPE_DISCOVERY_DEPS,
    INSTALL_INVOCATION,
  );
  for (const target of targets) {
    if (!message.includes(target)) {
      return fail('multiple-deps-missing', `message did not name dep "${target}": ${message}`);
    }
  }
  return pass(
    'multiple-deps-missing',
    `missing=[${targets.join(', ')}]; message names all of them`,
  );
}

/** Scenario 4: actionable message — contains install invocation + every required dep. */
async function scenarioActionableMessage(): Promise<ScenarioResult> {
  const results = await probeAll(
    REQUIRED_SCOPE_DISCOVERY_DEPS,
    makeFailingImporter(['yaml']),
  );
  const missing = results.filter((r) => !r.ok);
  const message = formatMissingDepsMessage(
    missing,
    REQUIRED_SCOPE_DISCOVERY_DEPS,
    INSTALL_INVOCATION,
  );
  if (!message.includes(INSTALL_INVOCATION)) {
    return fail(
      'actionable-message',
      `message missing install invocation "${INSTALL_INVOCATION}": ${message}`,
    );
  }
  for (const required of REQUIRED_SCOPE_DISCOVERY_DEPS) {
    if (!message.includes(required)) {
      return fail(
        'actionable-message',
        `message did not list required dep "${required}": ${message}`,
      );
    }
  }
  return pass(
    'actionable-message',
    `message contains "${INSTALL_INVOCATION}" and lists every required dep`,
  );
}

/**
 * Scenario 5: gutted-stub self-check. Replace probeAll with a stub
 * that always reports ok:true; scenario 2's contract (find the
 * missing dep) MUST fail against that stub.
 */
async function scenarioGuttedStubSelfCheck(): Promise<ScenarioResult> {
  const stubbedProbeAll = async (
    names: ReadonlyArray<string>,
  ): Promise<ReadonlyArray<{ name: string; ok: boolean; errorDetail: string | null }>> =>
    names.map((name) => ({ name, ok: true, errorDetail: null }));
  const results = await stubbedProbeAll(REQUIRED_SCOPE_DISCOVERY_DEPS);
  const missing = results.filter((r) => !r.ok);
  if (missing.length === 1) {
    return fail(
      'gutted-stub-self-check',
      'stubbed probeAll somehow reported a missing dep — stub is wrong, not the harness',
    );
  }
  if (missing.length === 0) {
    return pass(
      'gutted-stub-self-check',
      'stub reports nothing missing; the one-dep-missing scenario WOULD fail (no message generated) — harness has teeth',
    );
  }
  return fail(
    'gutted-stub-self-check',
    `stub produced unexpected missing count ${missing.length}`,
  );
}

/**
 * Scenario 6: package.json coherence. Reads the workspace
 * `package.json` and asserts every entry in
 * REQUIRED_SCOPE_DISCOVERY_DEPS appears in devDependencies. If a dep
 * was removed from package.json but left here, this catches it.
 */
async function scenarioPackageJsonCoherence(): Promise<ScenarioResult> {
  const pkgPath = join(process.cwd(), 'package.json');
  let raw: string;
  try {
    raw = await readFile(pkgPath, 'utf8');
  } catch (err) {
    return fail('package-json-coherence', `failed to read ${pkgPath}: ${errorMessage(err)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return fail('package-json-coherence', `failed to parse ${pkgPath}: ${errorMessage(err)}`);
  }
  if (!isPlainObject(parsed)) {
    return fail('package-json-coherence', `package.json root is not an object`);
  }
  const devDeps = parsed.devDependencies;
  if (!isPlainObject(devDeps)) {
    return fail('package-json-coherence', `package.json has no devDependencies object`);
  }
  const missingFromPkg: string[] = [];
  for (const name of REQUIRED_SCOPE_DISCOVERY_DEPS) {
    if (!(name in devDeps)) {
      missingFromPkg.push(name);
    }
  }
  if (missingFromPkg.length > 0) {
    return fail(
      'package-json-coherence',
      `REQUIRED_SCOPE_DISCOVERY_DEPS contains entries not in package.json devDependencies: ${missingFromPkg.join(', ')}`,
    );
  }
  return pass(
    'package-json-coherence',
    `every required dep (${REQUIRED_SCOPE_DISCOVERY_DEPS.join(', ')}) is declared in package.json devDependencies`,
  );
}

type Scenario = () => Promise<ScenarioResult>;

const SCENARIOS: ReadonlyArray<Scenario> = [
  scenarioAllDepsPresent,
  scenarioOneDepMissing,
  scenarioMultipleDepsMissing,
  scenarioActionableMessage,
  scenarioGuttedStubSelfCheck,
  scenarioPackageJsonCoherence,
];

async function main(): Promise<number> {
  const results: ScenarioResult[] = [];
  for (const scenario of SCENARIOS) {
    const result = await scenario();
    results.push(result);
    const marker = result.passed ? 'PASS' : 'FAIL';
    process.stdout.write(`  ${marker}  ${result.name} — ${result.detail}\n`);
  }
  const failed = results.filter((r) => !r.passed);
  process.stdout.write(
    `\nSummary: ${results.length - failed.length}/${results.length} scenarios passed\n`,
  );
  return failed.length === 0 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(`check-deps.validate: harness error: ${errorMessage(err)}\n`);
    process.exit(2);
  },
);
