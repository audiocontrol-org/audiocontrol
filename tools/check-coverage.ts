#!/usr/bin/env tsx
/**
 * tools/check-coverage.ts
 *
 * Pipeline orchestrator: lint -> test -> credibility -> manifest -> exit gate.
 *
 * Exit non-zero if any `implemented` D-row ends up with `coverage: none`.
 *
 * Workplan 9R-A.1 T8. Reform spec §6 (the coverage gate that prevents
 * shipping while implemented capabilities have no real coverage).
 *
 * This file is a thin pipeline: each step shells out to an existing
 * tool. No business logic, no manifest computation, no inventory
 * parsing lives here — those concerns belong to T5 (eslint plugin),
 * T6 (check-credibility), and T7 (generate-coverage-manifest).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

interface CoverageManifestRow {
  status: 'implemented' | 'partial' | 'missing' | 'removed';
  coverage: 'confident' | 'partial' | 'none' | 'n/a';
}

interface CoverageManifest {
  summary: {
    total: number;
    confident: number;
    partial: number;
    none: number;
    naCount: number;
  };
  byDid: Record<string, CoverageManifestRow>;
}

/**
 * Tier 2/3 spec paths to lint. The shared .eslintrc.cjs override only
 * activates on these directories (reform spec §4, Validity Claim A).
 * Tier 1 capability specs and legacy wiring tests are explicitly NOT
 * linted by the test-discipline rules.
 *
 * We pass --no-error-on-unmatched-pattern because in-context/ may be
 * empty while the harness routes accumulate during 9R-B+C.
 */
const LINT_PATHS: readonly string[] = [
  'modules/roland-sxx0-editor/test/ui/contract',
  'modules/roland-sxx0-editor/test/ui/in-context',
];

function runStep(name: string, cmd: string, args: readonly string[]): void {
  console.log(`[check-coverage] Step: ${name}`);
  const result = spawnSync(cmd, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(
      `Step '${name}' failed with exit code ${result.status ?? 'unknown'}`,
    );
  }
}

function isNumberRecord(value: unknown, keys: readonly string[]): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const rec: Record<string, unknown> = { ...value };
  for (const k of keys) {
    if (typeof rec[k] !== 'number') return false;
  }
  return true;
}

function isCoverageManifest(value: unknown): value is CoverageManifest {
  if (typeof value !== 'object' || value === null) return false;
  if (!('summary' in value) || !('byDid' in value)) return false;
  const obj: Record<string, unknown> = { ...value };
  if (typeof obj.byDid !== 'object' || obj.byDid === null) return false;
  return isNumberRecord(obj.summary, [
    'total',
    'confident',
    'partial',
    'none',
    'naCount',
  ]);
}

function readManifest(): CoverageManifest {
  const manifestPath = join(
    process.cwd(),
    'coverage-manifest/coverage-manifest.json',
  );
  const raw = readFileSync(manifestPath, 'utf-8');
  const parsed: unknown = JSON.parse(raw);
  if (!isCoverageManifest(parsed)) {
    throw new Error(
      `Manifest at ${manifestPath} does not match the expected schema.`,
    );
  }
  return parsed;
}

function applyGate(manifest: CoverageManifest): void {
  const failures: string[] = [];
  for (const [dId, row] of Object.entries(manifest.byDid)) {
    if (row.status === 'implemented' && row.coverage === 'none') {
      failures.push(dId);
    }
  }
  if (failures.length > 0) {
    console.error(
      `[check-coverage] GATE FAILED: ${failures.length} implemented capabilities have coverage 'none'.`,
    );
    console.error(
      `[check-coverage] See coverage-manifest/coverage-manifest.md for the per-D-ID table.`,
    );
    console.error(
      `[check-coverage] First 10: ${failures.slice(0, 10).join(', ')}`,
    );
    process.exit(1);
  }
  console.log(`[check-coverage] GATE PASSED.`);
  console.log(`  total: ${manifest.summary.total}`);
  console.log(`  confident: ${manifest.summary.confident}`);
  console.log(`  partial: ${manifest.summary.partial}`);
  console.log(`  none: ${manifest.summary.none}`);
  console.log(`  n/a: ${manifest.summary.naCount}`);
}

function main(): void {
  // 1. Lint Tier 2/3 specs (T5 plugin enforces @audiocontrol/test-discipline)
  runStep('lint', 'pnpm', [
    'exec',
    'eslint',
    '--ext',
    '.ts,.tsx',
    '--no-error-on-unmatched-pattern',
    ...LINT_PATHS,
  ]);

  // 2. Tier 1 wiring suite — runs the device-write-seam specs migrated
  //    from test/ui/capabilities/ to test/wiring/ in 9R-A.2. Placed
  //    before the slower UI suite so wiring regressions fail fast.
  runStep('test-wiring-roland', 'make', ['test-wiring-roland']);

  // 3. Tests via the canonical make wrapper (test-ui-roland covers the
  //    harness-driven contract + in-context paths).
  runStep('test-ui-roland', 'make', ['test-ui-roland']);

  // 4. Credibility check (T6) — verifies each spec's claims against
  //    its credibility-url and operator-signoff state.
  runStep('check-credibility', 'pnpm', ['run', 'check-credibility']);

  // 5. Manifest generation (T7) — materializes the per-D-ID coverage
  //    state into coverage-manifest/{json,md}.
  runStep('generate-coverage-manifest', 'pnpm', [
    'run',
    'generate-coverage-manifest',
  ]);

  // 6. Gate: any implemented row with coverage: none fails the build.
  const manifest = readManifest();
  applyGate(manifest);
}

try {
  main();
} catch (e: unknown) {
  console.error(`[check-coverage] FATAL: ${(e as Error).message}`);
  process.exit(1);
}
