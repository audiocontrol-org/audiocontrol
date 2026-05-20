/**
 * tools/generate-coverage-manifest/run-suite.ts
 *
 * Runs the tier-1/2/3 Playwright suite per module and records pass/fail at
 * the individual-test granularity. Strategy: spawn `pnpm exec playwright
 * test --reporter=json`, parse the JSON reporter output, and surface a flat
 * list of `TestOutcome` records keyed by spec-relative-path + test title.
 *
 * Strategy (a) — JSON reporter via child_process — was chosen over (b) the
 * Playwright programmatic API because:
 *
 *   1. It matches the existing `make test-ui-roland` / run-test-harness-e2e
 *      pipeline. The test runner shape (workers, retries, config) stays in
 *      one place: `playwright.test-harness.config.ts`.
 *   2. The JSON reporter's stable surface (`suites[].specs[].tests[]`) is
 *      simpler to consume than the programmatic API's lifecycle hooks for
 *      a one-shot reporting use case.
 *   3. Tier 1 tests run under the same harness config because the wiring
 *      directory's specs hit `/_harness/` routes — the same dev server
 *      Tier 2 / Tier 3 already need.
 *
 * The run starts a Vite dev server per module (port 0, dynamic), reuses it
 * across that module's spec invocations, then tears it down. This is the
 * same lifecycle `tools/check-credibility.ts` uses, refactored here for
 * the test-running case where we want the whole suite in one shot rather
 * than spec-by-spec.
 */

import { spawn, spawnSync } from 'node:child_process';
import { join, relative } from 'node:path';

import type { TestOutcome } from './types.js';

interface ViteHandle {
  readonly port: number;
  kill(): void;
}

const VITE_TAIL_MAX = 4_000;

/**
 * Boot a Vite dev server in `moduleAbs` and resolve once it advertises a
 * port. Mirrors the lifecycle in `tools/check-credibility.ts` so both
 * runners use a consistent server-startup contract.
 */
export function startVite(moduleAbs: string): Promise<ViteHandle> {
  return new Promise((resolveStart, rejectStart) => {
    const proc = spawn('pnpm', ['vite', '--port', '0'], {
      cwd: moduleAbs,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let preBuf = '';
    let postBuf = '';
    let resolved = false;
    const appendPost = (s: string): void => {
      postBuf = (postBuf + s).slice(-VITE_TAIL_MAX);
    };
    const timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      proc.kill('SIGKILL');
      rejectStart(
        new Error(
          `vite did not advertise a port within 30s for ${moduleAbs}; output: ${preBuf.slice(-2000)}`,
        ),
      );
    }, 30_000);
    const onPreChunk = (chunk: Buffer): void => {
      const s = chunk.toString('utf8');
      if (resolved) {
        appendPost(s);
        return;
      }
      preBuf += s;
      const m = preBuf.match(/https?:\/\/localhost:(\d+)/);
      if (m !== null) {
        resolved = true;
        clearTimeout(timer);
        const port = Number(m[1]);
        proc.stdout.off('data', onPreChunk);
        proc.stderr.off('data', onPreChunk);
        const onPostChunk = (c: Buffer): void => {
          appendPost(c.toString('utf8'));
        };
        proc.stdout.on('data', onPostChunk);
        proc.stderr.on('data', onPostChunk);
        appendPost(preBuf.slice(-VITE_TAIL_MAX));
        preBuf = '';
        const kill = (): void => {
          proc.kill('SIGTERM');
          setTimeout(() => proc.kill('SIGKILL'), 500);
        };
        resolveStart({ port, kill });
      }
    };
    proc.stdout.on('data', onPreChunk);
    proc.stderr.on('data', onPreChunk);
    proc.on('exit', (code, signal) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        rejectStart(
          new Error(
            `vite exited (code=${String(code)}) before advertising a port; output: ${preBuf.slice(-2000)}`,
          ),
        );
        return;
      }
      if (signal !== null) return;
      if (code === 0) return;
      process.stderr.write(
        `[generate-coverage-manifest] vite exited unexpectedly (code=${String(code)}); tail: ${postBuf.slice(-1000)}\n`,
      );
    });
  });
}

// ─── Playwright JSON reporter shape (only the fields we consume) ────────────

interface PwTestResult {
  readonly status?: string;
}

interface PwTest {
  readonly results?: ReadonlyArray<PwTestResult>;
}

interface PwSpec {
  readonly title?: string;
  readonly file?: string;
  readonly ok?: boolean;
  readonly tests?: ReadonlyArray<PwTest>;
}

interface PwSuite {
  readonly title?: string;
  readonly file?: string;
  readonly specs?: ReadonlyArray<PwSpec>;
  readonly suites?: ReadonlyArray<PwSuite>;
}

interface PwConfig {
  readonly rootDir?: string;
}

interface PwReport {
  readonly config?: PwConfig;
  readonly suites?: ReadonlyArray<PwSuite>;
}

function walkPwSuites(
  suites: ReadonlyArray<PwSuite> | undefined,
  parentFile: string | undefined,
  out: TestOutcome[],
  testRootDir: string,
  repoRoot: string,
): void {
  if (suites === undefined) return;
  for (const suite of suites) {
    const file = suite.file ?? parentFile;
    if (suite.specs !== undefined) {
      for (const spec of suite.specs) {
        const title = spec.title ?? '';
        const specFile = spec.file ?? file;
        if (specFile === undefined) continue;
        // Playwright's JSON reporter emits `file` relative to the config's
        // resolved `rootDir` (which is the playwright config's `testDir`,
        // not the module root). Joining onto `testRootDir` yields the
        // absolute spec path; relativizing against `repoRoot` produces the
        // stable manifest key.
        const specAbs = join(testRootDir, specFile);
        const specRel = relative(repoRoot, specAbs);
        const tests = spec.tests ?? [];
        // A spec entry can have multiple `tests[]` if the test is run across
        // projects/browsers. We collapse to "passing" iff every result for
        // the test passed. `spec.ok` from the JSON reporter aggregates this
        // already but we re-derive it for safety against report shape drift.
        let passing = tests.length > 0;
        for (const test of tests) {
          const results = test.results ?? [];
          if (results.length === 0) {
            passing = false;
            continue;
          }
          const allPassed = results.every((r) => r.status === 'passed' || r.status === 'expected');
          if (!allPassed) passing = false;
        }
        if (tests.length === 0 && spec.ok === true) {
          // Pathological case: a spec entry with no `tests` array but the
          // reporter marked it `ok`. Treat as passing.
          passing = true;
        }
        out.push({ specRelPath: specRel, title, passing });
      }
    }
    walkPwSuites(suite.suites, file, out, testRootDir, repoRoot);
  }
}

export interface RunSuiteResult {
  readonly outcomes: ReadonlyArray<TestOutcome>;
  readonly modulesRun: ReadonlyArray<string>;
}

export interface RunSuiteOptions {
  readonly repoRoot: string;
  readonly moduleDirs: ReadonlyArray<string>;
}

/**
 * Run the Playwright suite for every module in `moduleDirs` that has at
 * least one tier directory present. Returns the flat outcomes list +
 * the list of modules actually exercised.
 */
export async function runSuite(opts: RunSuiteOptions): Promise<RunSuiteResult> {
  const outcomes: TestOutcome[] = [];
  const modulesRun: string[] = [];
  for (const moduleRel of opts.moduleDirs) {
    const moduleAbs = join(opts.repoRoot, moduleRel);
    process.stderr.write(`[generate-coverage-manifest] Starting vite for ${moduleRel}…\n`);
    const vite = await startVite(moduleAbs);
    process.stderr.write(
      `[generate-coverage-manifest]   vite listening on port ${String(vite.port)}\n`,
    );
    try {
      const result = spawnSync(
        'pnpm',
        [
          'exec',
          'playwright',
          'test',
          '--config',
          'playwright.test-harness.config.ts',
          '--reporter=json',
        ],
        {
          cwd: moduleAbs,
          env: { ...process.env, E2E_PORT: String(vite.port) },
          stdio: ['ignore', 'pipe', 'inherit'],
          encoding: 'utf8',
          // Allow up to 16MB of JSON; the reporter output can be sizeable.
          maxBuffer: 16 * 1024 * 1024,
        },
      );
      const stdout = typeof result.stdout === 'string' ? result.stdout : '';
      // Playwright exits non-zero when any test fails — the JSON output is
      // still on stdout. We only fail the run if we cannot parse the JSON
      // at all (which would mean the runner crashed).
      let report: PwReport;
      try {
        // JSON.parse returns `unknown`-shaped data (declared as `any` by the
        // lib types). We assert the Playwright-reporter shape here. The
        // walker that consumes `report` defensively narrows every nested
        // field (`?? []`, `?? undefined`, type-of checks) so an unexpected
        // shape produces empty outcomes rather than a runtime crash.
        const parsed: unknown = JSON.parse(stdout);
        report = parsed as PwReport;
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        throw new Error(
          `Playwright JSON reporter output for ${moduleRel} was not parseable: ${detail}. ` +
            `First 500 chars of stdout: ${stdout.slice(0, 500)}`,
        );
      }
      const testRootDir = report.config?.rootDir;
      if (testRootDir === undefined || testRootDir === '') {
        throw new Error(
          `Playwright JSON reporter for ${moduleRel} did not include config.rootDir; ` +
            `cannot resolve relative spec paths.`,
        );
      }
      walkPwSuites(report.suites, undefined, outcomes, testRootDir, opts.repoRoot);
      modulesRun.push(moduleRel);
    } finally {
      vite.kill();
    }
  }
  return { outcomes, modulesRun };
}
