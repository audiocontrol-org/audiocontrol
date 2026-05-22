/**
 * tools/scope-discovery/refactor-preconditions.validate.ts
 *
 * Adversarial validator harness for the T5.3 refactor-precondition gate
 * at `tools/scope-discovery/check-refactor-preconditions.ts`.
 *
 * Plants 7 scenarios + a gutted-stub self-check, each with its own
 * isolated temp baseline + commit-message. PASS to stdout, FAIL to
 * stderr (CI greps stderr for FAIL). Exit 0 = all pass; 1 = any fail;
 * 2 = infra. Pattern follows clone-detector.validate.ts +
 * dispatch-wrapper.validate.ts. Run via:
 *   tsx tools/scope-discovery/refactor-preconditions.validate.ts
 *   make check-refactor-preconditions-validate
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  type Cli,
  type GateResult,
  runGate,
} from './check-refactor-preconditions.js';
import { errorMessage } from './util/typeguards.js';

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

// Fixtures use the real git repo (current working tree) for tests_proof.sha
// resolution; REAL_SHA is pinned to T5.1's initial commit on this branch
// (752ba934). FAKE_SHA must NOT appear in git history. Canonical-side paths:
// EXISTING_CANONICAL must exist; MISSING_CANONICAL must not.
const REAL_SHA = '752ba934';
// Must be 7-40 lowercase hex (passes T5.1 parse-time regex) but not a
// commit reachable in this repo's history. 40-char fake is least likely
// to collide with a real abbrev sha.
const FAKE_SHA = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
const EXISTING_CANONICAL = 'tools/scope-discovery/clones-yaml.ts';
const MISSING_CANONICAL = 'tools/scope-discovery/this-file-does-not-exist.ts';

// 12 hex-char clone-group ids; distinct from real production ids in
// clones.yaml so a state leak between harness and prod yaml is obvious.
const ID_HAPPY = 'aaaaaaaaaaaa';
const ID_MISSING_FILE = 'bbbbbbbbbbbb';
const ID_BAD_SHA = 'cccccccccccc';
const ID_FAILING_TEST = 'dddddddddddd';
const ID_PENDING = 'eeeeeeeeeeee';
const ID_NOT_IN_YAML = 'ffffffffffff';

interface YamlEntryInput {
  readonly id: string;
  readonly disposition: 'pending' | 'refactor';
  readonly canonical_side?: string;
  readonly canonical_reason?: string;
  readonly tests?: readonly string[];
  readonly tests_proof?: { readonly sha: string; readonly demonstration: string };
}

function buildYaml(entries: readonly YamlEntryInput[]): string {
  const lines: string[] = [];
  lines.push(`generated_at: 2026-05-22T00:00:00Z`);
  lines.push(`clones:`);
  for (const e of entries) {
    lines.push(`  - id: ${e.id}`);
    lines.push(`    lines: 7`);
    lines.push(`    members:`);
    // Two synthetic members per group; their existence is not checked
    // by the gate, only their string shape, so any path is fine here.
    lines.push(`      - modules/synthetic-a/src/${e.id}.ts:1:7`);
    lines.push(`      - modules/synthetic-b/src/${e.id}.ts:1:7`);
    lines.push(`    disposition: ${e.disposition}`);
    lines.push(`    reason: null`);
    if (e.disposition === 'refactor') {
      if (e.canonical_side === undefined || e.canonical_reason === undefined) {
        throw new Error(`buildYaml: refactor entry ${e.id} missing canonical_side/canonical_reason`);
      }
      if (e.tests === undefined || e.tests_proof === undefined) {
        throw new Error(`buildYaml: refactor entry ${e.id} missing tests/tests_proof`);
      }
      lines.push(`    canonical_side: ${JSON.stringify(e.canonical_side)}`);
      lines.push(`    canonical_reason: ${JSON.stringify(e.canonical_reason)}`);
      lines.push(`    tests:`);
      for (const t of e.tests) lines.push(`      - ${JSON.stringify(t)}`);
      lines.push(`    tests_proof:`);
      lines.push(`      sha: ${JSON.stringify(e.tests_proof.sha)}`);
      lines.push(`      demonstration: ${JSON.stringify(e.tests_proof.demonstration)}`);
    }
  }
  return lines.join('\n') + '\n';
}

interface Scenario {
  readonly name: string;
  readonly slug: string;
  readonly buildYaml: () => string;
  readonly commitMsg: string;
  readonly expect: ScenarioExpectation;
  /**
   * When set, the scenario passes --skip-test-run to the gate. Used by
   * scenarios that test failure modes OTHER than failing test execution,
   * so the harness doesn't spend time spawning real test commands for
   * every scenario.
   */
  readonly skipTestRun?: boolean;
}

type ScenarioExpectation =
  | { readonly kind: 'accept' }
  | {
      readonly kind: 'reject';
      readonly substrings: ReadonlyArray<string>;
      readonly fieldHints?: ReadonlyArray<string>;
    };

// Scenarios: 7 here + a gutted-stub self-check appended by main().
const SCENARIOS: ReadonlyArray<Scenario> = [
  {
    name: 'happy path: all preconditions satisfied',
    slug: 'happy',
    buildYaml: () =>
      buildYaml([
        {
          id: ID_HAPPY,
          disposition: 'refactor',
          canonical_side: EXISTING_CANONICAL,
          canonical_reason: 'synthetic — chosen because this file exists on the branch',
          tests: ['true'], // shell builtin; always exits 0; runs in ~1ms
          tests_proof: {
            sha: REAL_SHA,
            demonstration: 'synthetic — points to T5.1 commit which exists in history',
          },
        },
      ]),
    commitMsg: `refactor: collapse clone\n\nCloses clones.yaml ${ID_HAPPY}\n`,
    expect: { kind: 'accept' },
  },
  {
    name: 'reject: canonical_side file does not exist',
    slug: 'missing-canonical',
    buildYaml: () =>
      buildYaml([
        {
          id: ID_MISSING_FILE,
          disposition: 'refactor',
          canonical_side: MISSING_CANONICAL,
          canonical_reason: 'synthetic — deliberately points to a non-existent path',
          tests: ['true'],
          tests_proof: {
            sha: REAL_SHA,
            demonstration: 'synthetic — points to T5.1 commit',
          },
        },
      ]),
    commitMsg: `refactor: collapse clone\n\nCloses clones.yaml ${ID_MISSING_FILE}\n`,
    expect: {
      kind: 'reject',
      substrings: [
        'canonical_side',
        MISSING_CANONICAL,
        'does not exist',
      ],
      fieldHints: ['canonical_side'],
    },
    skipTestRun: true,
  },
  {
    name: 'reject: tests_proof.sha does not resolve in git history',
    slug: 'bad-sha',
    buildYaml: () =>
      buildYaml([
        {
          id: ID_BAD_SHA,
          disposition: 'refactor',
          canonical_side: EXISTING_CANONICAL,
          canonical_reason: 'synthetic',
          tests: ['true'],
          tests_proof: {
            sha: FAKE_SHA,
            demonstration: 'synthetic — sha is not present in git history',
          },
        },
      ]),
    commitMsg: `refactor: collapse clone\n\nCloses clones.yaml ${ID_BAD_SHA}\n`,
    expect: {
      kind: 'reject',
      substrings: ['tests_proof.sha', FAKE_SHA, 'does not resolve'],
      fieldHints: ['tests_proof.sha'],
    },
    skipTestRun: true,
  },
  {
    name: 'reject: named test command exits non-zero at HEAD',
    slug: 'failing-test',
    buildYaml: () =>
      buildYaml([
        {
          id: ID_FAILING_TEST,
          disposition: 'refactor',
          canonical_side: EXISTING_CANONICAL,
          canonical_reason: 'synthetic',
          tests: ['false'], // shell builtin; always exits 1
          tests_proof: {
            sha: REAL_SHA,
            demonstration: 'synthetic — but the test command is /usr/bin/false, which fails',
          },
        },
      ]),
    commitMsg: `refactor: collapse clone\n\nCloses clones.yaml ${ID_FAILING_TEST}\n`,
    expect: {
      kind: 'reject',
      substrings: ['tests[0]', 'false', 'exited'],
      fieldHints: ['tests[0]'],
    },
  },
  {
    name: 'reject: refactor marker names a clone-group id not in clones.yaml',
    slug: 'not-in-yaml',
    buildYaml: () =>
      buildYaml([
        {
          id: ID_HAPPY, // an entry, but a DIFFERENT id from the marker
          disposition: 'refactor',
          canonical_side: EXISTING_CANONICAL,
          canonical_reason: 'synthetic — unrelated entry',
          tests: ['true'],
          tests_proof: { sha: REAL_SHA, demonstration: 'synthetic' },
        },
      ]),
    commitMsg: `refactor: collapse clone\n\nCloses clones.yaml ${ID_NOT_IN_YAML}\n`,
    expect: {
      kind: 'reject',
      substrings: [ID_NOT_IN_YAML, 'no entry exists'],
      fieldHints: ['<entry>'],
    },
    skipTestRun: true,
  },
  {
    name: 'reject: marker names a clone-group whose disposition is pending',
    slug: 'pending-disposition',
    buildYaml: () =>
      buildYaml([
        { id: ID_PENDING, disposition: 'pending' },
      ]),
    commitMsg: `refactor: collapse clone\n\nCloses clones.yaml ${ID_PENDING}\n`,
    expect: {
      kind: 'reject',
      substrings: [ID_PENDING, "disposition is 'pending'", 'not'],
      fieldHints: ['disposition'],
    },
    skipTestRun: true,
  },
  {
    name: 'accept (silent): commit message has no refactor marker',
    slug: 'no-marker',
    buildYaml: () =>
      buildYaml([
        { id: ID_PENDING, disposition: 'pending' },
      ]),
    commitMsg: `feat(foo): unrelated change\n\nFixes a thing in modules/foo/Bar.tsx.\n`,
    expect: { kind: 'accept' },
    skipTestRun: true,
  },
];

function buildCli(scenario: Scenario, dir: string): Cli {
  return {
    commitMsgFile: null,
    commitMsgInline: scenario.commitMsg,
    baselinePath: join(dir, 'clones.yaml'),
    repoRoot: process.cwd(),
    testTimeoutSeconds: 60,
    skipTestRun: scenario.skipTestRun === true,
  };
}

type RunGateFn = (cli: Cli, commitMessage: string) => Promise<GateResult>;

async function runScenario(scenario: Scenario, dir: string, gate: RunGateFn): Promise<ScenarioResult> {
  await mkdir(dir, { recursive: true });
  const yamlPath = join(dir, 'clones.yaml');
  try {
    await writeFile(yamlPath, scenario.buildYaml(), 'utf8');
  } catch (e) {
    return fail(scenario.name, `failed to write fixture yaml: ${errorMessage(e)}`);
  }
  const cli = buildCli(scenario, dir);
  let result: GateResult;
  try {
    result = await gate(cli, scenario.commitMsg);
  } catch (e) {
    return fail(scenario.name, `gate threw: ${errorMessage(e)}`);
  }
  if (scenario.expect.kind === 'accept') {
    if (result.errors.length === 0) {
      return pass(
        scenario.name,
        `gate exited cleanly (${result.markedIds.length} marker(s))`,
      );
    }
    return fail(
      scenario.name,
      `expected accept; got ${result.errors.length} error(s):\n` +
        result.errors.map((e) => `        - [${e.field}] ${e.detail}`).join('\n'),
    );
  }
  // Reject expectation.
  if (result.errors.length === 0) {
    return fail(
      scenario.name,
      `expected reject; gate accepted (markedIds=${result.markedIds.join(',')})`,
    );
  }
  const combined = result.errors
    .map((e) => `[${e.field}] ${e.detail} — next step: ${e.nextStep}`)
    .join(' || ');
  const missingSubs = scenario.expect.substrings.filter((s) => !combined.includes(s));
  if (missingSubs.length > 0) {
    return fail(
      scenario.name,
      `rejected, but error text lacks substring(s): [${missingSubs.join(', ')}]\n` +
        `      actual:\n` +
        result.errors
          .map((e) => `        - [${e.field}] ${e.detail}`)
          .join('\n'),
    );
  }
  const hints = scenario.expect.fieldHints;
  if (hints !== undefined) {
    const seenFields = new Set(result.errors.map((e) => e.field));
    const missingFields = hints.filter((h) => !seenFields.has(h));
    if (missingFields.length > 0) {
      return fail(
        scenario.name,
        `rejected, but expected error in field(s): [${missingFields.join(', ')}] — ` +
          `actual fields: [${[...seenFields].join(', ')}]`,
      );
    }
  }
  return pass(
    scenario.name,
    `rejected as expected (${result.errors.length} error(s); fields=` +
      result.errors.map((e) => e.field).join(',') +
      `)`,
  );
}

// Gutted-logic self-check — mirrors the pattern from clone-detector.validate.ts
// and dispatch-wrapper.validate.ts. A "gutted gate" returns no errors
// regardless of input. The harness runs every REJECT scenario against the
// stub; if any passes (i.e. the harness accepts silence as a valid reject),
// the harness itself is broken.
const guttedRunGate: RunGateFn = async (_cli, commitMessage) => ({
  markedIds: commitMessage.includes('Closes clones.yaml') ? ['guttedstub00'] : [],
  errors: [],
});

async function guttedSelfCheck(rootDir: string): Promise<ScenarioResult> {
  const rejectionScenarios = SCENARIOS.filter((s) => s.expect.kind === 'reject');
  if (rejectionScenarios.length === 0) {
    return fail(
      'gutted-stub self-check',
      'no rejection scenarios in SCENARIOS — self-check has nothing to assert',
    );
  }
  const incorrectlyPassedAgainstStub: string[] = [];
  for (const scenario of rejectionScenarios) {
    const dir = join(rootDir, `gutted-${scenario.slug}`);
    const result = await runScenario(scenario, dir, guttedRunGate);
    // Under the gutted stub, the assertion should FAIL (because the stub
    // returns no errors and the scenario expects a rejection). If
    // runScenario reports PASS against the stub, the assertion isn't
    // catching the regression class.
    if (result.passed) {
      incorrectlyPassedAgainstStub.push(scenario.name);
    }
  }
  if (incorrectlyPassedAgainstStub.length > 0) {
    return fail(
      'gutted-stub self-check',
      `assertions passed against gutted runGate stub for: ` +
        incorrectlyPassedAgainstStub.join('; ') +
        ` — the harness has no teeth on these scenarios.`,
    );
  }
  return pass(
    'gutted-stub self-check',
    `${rejectionScenarios.length} rejection scenario(s) all correctly failed against ` +
      `the gutted-gate stub; harness is load-bearing.`,
  );
}

function emitScenarioLine(result: ScenarioResult): void {
  if (result.passed) {
    process.stdout.write(`  PASS  ${result.name} — ${result.detail}\n`);
  } else {
    process.stderr.write(`  FAIL  ${result.name} — ${result.detail}\n`);
  }
}

/**
 * Sanity-check the harness's pinned SHAs: REAL_SHA must resolve, FAKE_SHA
 * must not. If REAL_SHA is missing (e.g. run from a clone without the
 * feature branch), bad-sha's expectation is meaningless and we fail loudly.
 */
function preflightShaResolution(): string | null {
  const r1 = spawnSync('git', ['rev-parse', '--verify', `${REAL_SHA}^{commit}`], { encoding: 'utf8' });
  if (r1.status !== 0) {
    return `preflight: REAL_SHA ${REAL_SHA} does not resolve via git rev-parse.`;
  }
  const r2 = spawnSync('git', ['rev-parse', '--verify', `${FAKE_SHA}^{commit}`], { encoding: 'utf8' });
  if (r2.status === 0) {
    return `preflight: FAKE_SHA ${FAKE_SHA} unexpectedly resolves — pick a different fake.`;
  }
  return null;
}

async function main(): Promise<number> {
  const preflightErr = preflightShaResolution();
  if (preflightErr !== null) {
    process.stderr.write(`refactor-preconditions.validate: ${preflightErr}\n`);
    return 2;
  }
  const tmpRoot = await mkdtemp(join(tmpdir(), 'refactor-preconditions-validator-'));
  const results: ScenarioResult[] = [];
  try {
    for (const scenario of SCENARIOS) {
      const dir = join(tmpRoot, scenario.slug);
      const result = await runScenario(scenario, dir, runGate);
      results.push(result);
      emitScenarioLine(result);
    }
    const guttedResult = await guttedSelfCheck(tmpRoot);
    results.push(guttedResult);
    emitScenarioLine(guttedResult);
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
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
    process.stderr.write(`harness infrastructure error: ${errorMessage(err)}\n`);
    process.exit(2);
  },
);
