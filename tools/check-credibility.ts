#!/usr/bin/env tsx
/**
 * tools/check-credibility.ts
 *
 * For each Tier 2 (`test/ui/contract/`) and Tier 3 (`test/ui/in-context/`)
 * spec with a `@credibleAgainst` JSDoc declaration, run the spec twice:
 *
 *   1. Against the unbroken harness (must PASS).
 *   2. For each declared broken variant via `?broken=<v>` / `?context=<v>`
 *      threaded through the AC_BROKEN_VARIANT / AC_BROKEN_CONTEXT env vars
 *      (must FAIL).
 *
 * A spec is "credible" iff (1) AND ALL of (2). Per-spec records are written
 * to `coverage-manifest/credibility.json` at the repo root.
 *
 * Implements Validity Claim B of the testing/inventory reform spec:
 *   docs/1.0/001-IN-PROGRESS/s550-support/testing-and-inventory-reform-spec.md §5
 * Workplan §9R-A.1 T6 (GH #392).
 *
 * Exits 0 always — the manifest IS the output. Downstream tasks (T7 / T8)
 * decide how to gate releases on what this tool found.
 */
import { spawn, spawnSync } from 'node:child_process';
import {
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── Types ─────────────────────────────────────────────────────────────────

interface CredibilityEntry {
  slot: string;
  variants: ReadonlyArray<string>;
}

interface BrokenResult {
  slot: string;
  variant: string;
  envVar: 'AC_BROKEN_VARIANT' | 'AC_BROKEN_CONTEXT';
  expectedFail: true;
  actuallyFailed: boolean;
  durationMs: number;
}

interface SpecCredibility {
  specPath: string;
  module: string;
  tier: 2 | 3;
  declarations: ReadonlyArray<CredibilityEntry>;
  unbrokenPasses: boolean;
  unbrokenDurationMs: number;
  brokenResults: ReadonlyArray<BrokenResult>;
  credible: boolean;
  errors: ReadonlyArray<string>;
}

interface CredibilityManifest {
  generatedAt: string;
  specsChecked: number;
  credible: number;
  notCredible: number;
  results: ReadonlyArray<SpecCredibility>;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const MANIFEST_DIR = join(REPO_ROOT, 'coverage-manifest');
const MANIFEST_PATH = join(MANIFEST_DIR, 'credibility.json');

// Modules that own Tier 2 / Tier 3 spec directories. The reform spec names
// these explicitly; extending the list is a deliberate per-editor decision.
const MODULE_DIRS: ReadonlyArray<string> = [
  'modules/roland-sxx0-editor',
  'modules/akai-s3k-editor',
];

const CONTRACT_DIR_REL = 'test/ui/contract';
const IN_CONTEXT_DIR_REL = 'test/ui/in-context';

// Slots that map to BROKEN_PRIMITIVES vs. BROKEN_CONTEXTS in the registry.
// Used to pick the right env var name when invoking Playwright.
const CONTEXT_SLOT = 'contexts';

// ─── Spec discovery ────────────────────────────────────────────────────────

function listSpecFiles(dir: string): ReadonlyArray<string> {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listSpecFiles(full));
      continue;
    }
    // Skip helpers and READMEs; the runner only cares about spec files.
    // Helper convention: filename starts with `_` (see _credibility-url.ts).
    if (!entry.endsWith('.spec.ts')) continue;
    if (entry.startsWith('_')) continue;
    out.push(full);
  }
  return out;
}

interface DiscoveredSpec {
  absPath: string;
  modulePath: string;
  tier: 2 | 3;
}

function discoverSpecs(): ReadonlyArray<DiscoveredSpec> {
  const out: DiscoveredSpec[] = [];
  for (const moduleRel of MODULE_DIRS) {
    const moduleAbs = join(REPO_ROOT, moduleRel);
    const contractDir = join(moduleAbs, CONTRACT_DIR_REL);
    const inContextDir = join(moduleAbs, IN_CONTEXT_DIR_REL);
    for (const f of listSpecFiles(contractDir)) {
      out.push({ absPath: f, modulePath: moduleAbs, tier: 2 });
    }
    for (const f of listSpecFiles(inContextDir)) {
      out.push({ absPath: f, modulePath: moduleAbs, tier: 3 });
    }
  }
  return out;
}

// ─── @credibleAgainst header parsing ───────────────────────────────────────

/**
 * Parse one or more `@credibleAgainst <slot> <variant> [<variant> ...]`
 * lines from a spec's leading JSDoc block. Returns an empty array when no
 * declaration is present — the caller treats that as a hard failure.
 *
 * Slot tokens are restricted to identifier-shape to avoid runaway matches
 * on multi-line JSDoc bodies; variant tokens are whitespace-separated up to
 * the line end (the regex stops at `\n` and `*`).
 */
function parseCredibilityHeader(source: string): ReadonlyArray<CredibilityEntry> {
  const entries: CredibilityEntry[] = [];
  const re = /@credibleAgainst\s+([A-Za-z][A-Za-z0-9_-]*)\s+([^\n*]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    // Two capture groups are present whenever the regex matches; the
    // explicit narrowing guards against an empty alternation slipping in
    // when this regex is extended later. The runtime check fails loudly
    // rather than silently producing an empty slot/variant pair.
    const slot = match[1];
    const tail = match[2];
    if (slot === undefined || tail === undefined) {
      throw new Error(
        `@credibleAgainst regex captured a match with no groups; raw match: ${match[0]}`,
      );
    }
    const variants = tail.trim().split(/\s+/).filter((v) => v !== '');
    if (variants.length === 0) continue;
    entries.push({ slot, variants });
  }
  return entries;
}

// ─── Vite dev-server lifecycle (per module) ────────────────────────────────

interface ViteHandle {
  port: number;
  kill: () => void;
}

function startVite(moduleAbs: string): Promise<ViteHandle> {
  return new Promise((resolveStart, rejectStart) => {
    const proc = spawn('pnpm', ['vite', '--port', '0'], {
      cwd: moduleAbs,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdoutBuf = '';
    let resolved = false;
    const timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      proc.kill('SIGKILL');
      rejectStart(
        new Error(
          `vite did not advertise a port within 30s for ${moduleAbs}; output: ${stdoutBuf.slice(-2000)}`,
        ),
      );
    }, 30_000);
    const onChunk = (chunk: Buffer): void => {
      stdoutBuf += chunk.toString('utf8');
      const m = stdoutBuf.match(/https?:\/\/localhost:(\d+)/);
      if (m !== null && !resolved) {
        resolved = true;
        clearTimeout(timer);
        const port = Number(m[1]);
        const kill = (): void => {
          // SIGTERM first, SIGKILL after a short grace period to match the
          // shell-script teardown's behavior.
          proc.kill('SIGTERM');
          setTimeout(() => proc.kill('SIGKILL'), 500);
        };
        resolveStart({ port, kill });
      }
    };
    proc.stdout.on('data', onChunk);
    proc.stderr.on('data', onChunk);
    proc.on('exit', (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        rejectStart(
          new Error(
            `vite exited (code=${String(code)}) before advertising a port; output: ${stdoutBuf.slice(-2000)}`,
          ),
        );
      }
    });
  });
}

// ─── Playwright invocation ─────────────────────────────────────────────────

interface PlaywrightOutcome {
  passed: boolean;
  durationMs: number;
}

function runPlaywrightSpec(
  moduleAbs: string,
  specAbs: string,
  port: number,
  extraEnv: Readonly<Record<string, string>>,
): PlaywrightOutcome {
  const specRel = relative(moduleAbs, specAbs);
  const start = Date.now();
  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'playwright',
      'test',
      '--config',
      'playwright.test-harness.config.ts',
      specRel,
    ],
    {
      cwd: moduleAbs,
      env: { ...process.env, ...extraEnv, E2E_PORT: String(port) },
      stdio: 'pipe',
      encoding: 'utf8',
    },
  );
  return { passed: result.status === 0, durationMs: Date.now() - start };
}

// ─── Per-spec credibility check ────────────────────────────────────────────

function envVarForSlot(slot: string): 'AC_BROKEN_VARIANT' | 'AC_BROKEN_CONTEXT' {
  // The reform spec maps slot names to env-var routes:
  //   `contexts` → AC_BROKEN_CONTEXT (wraps the harness with a broken parent)
  //   any other → AC_BROKEN_VARIANT  (swaps the primitive component itself)
  // Both env vars are read by `_credibility-url.ts` to build the URL params.
  return slot === CONTEXT_SLOT ? 'AC_BROKEN_CONTEXT' : 'AC_BROKEN_VARIANT';
}

function checkSpec(spec: DiscoveredSpec, port: number): SpecCredibility {
  const moduleName = relative(REPO_ROOT, spec.modulePath);
  const specRel = relative(REPO_ROOT, spec.absPath);
  const source = readFileSync(spec.absPath, 'utf8');
  const declarations = parseCredibilityHeader(source);
  const errors: string[] = [];

  if (declarations.length === 0) {
    errors.push(
      "no @credibleAgainst declaration in JSDoc header — every Tier 2/3 spec must list the broken variants it claims to catch",
    );
  }

  const unbroken = runPlaywrightSpec(spec.modulePath, spec.absPath, port, {});
  if (!unbroken.passed) {
    errors.push('unbroken run failed — a credible spec must pass against the real harness');
  }

  const brokenResults: BrokenResult[] = [];
  for (const decl of declarations) {
    const envVar = envVarForSlot(decl.slot);
    for (const variant of decl.variants) {
      const outcome = runPlaywrightSpec(spec.modulePath, spec.absPath, port, {
        [envVar]: variant,
      });
      brokenResults.push({
        slot: decl.slot,
        variant,
        envVar,
        expectedFail: true,
        actuallyFailed: !outcome.passed,
        durationMs: outcome.durationMs,
      });
      if (outcome.passed) {
        errors.push(
          `spec passed against broken variant ${decl.slot}/${variant} (${envVar}=${variant}) — credibility requires failure`,
        );
      }
    }
  }

  const credible =
    declarations.length > 0 &&
    unbroken.passed &&
    brokenResults.length > 0 &&
    brokenResults.every((r) => r.actuallyFailed);

  return {
    specPath: specRel,
    module: moduleName,
    tier: spec.tier,
    declarations,
    unbrokenPasses: unbroken.passed,
    unbrokenDurationMs: unbroken.durationMs,
    brokenResults,
    credible,
    errors,
  };
}

// ─── Driver ────────────────────────────────────────────────────────────────

interface ModuleGroup {
  modulePath: string;
  specs: ReadonlyArray<DiscoveredSpec>;
}

function groupByModule(specs: ReadonlyArray<DiscoveredSpec>): ReadonlyArray<ModuleGroup> {
  const byModule = new Map<string, DiscoveredSpec[]>();
  for (const s of specs) {
    const list = byModule.get(s.modulePath) ?? [];
    list.push(s);
    byModule.set(s.modulePath, list);
  }
  return Array.from(byModule, ([modulePath, list]) => ({ modulePath, specs: list }));
}

async function main(): Promise<void> {
  const specs = discoverSpecs();
  const groups = groupByModule(specs);
  const results: SpecCredibility[] = [];

  for (const group of groups) {
    if (group.specs.length === 0) continue;
    const moduleRel = relative(REPO_ROOT, group.modulePath);
    process.stderr.write(
      `[check-credibility] Starting vite for ${moduleRel} (${String(group.specs.length)} spec(s))…\n`,
    );
    const vite = await startVite(group.modulePath);
    process.stderr.write(
      `[check-credibility]   vite listening on port ${String(vite.port)}\n`,
    );
    try {
      for (const spec of group.specs) {
        const specRel = relative(REPO_ROOT, spec.absPath);
        process.stderr.write(`[check-credibility]   checking ${specRel}\n`);
        const record = checkSpec(spec, vite.port);
        results.push(record);
        const status = record.credible ? 'CREDIBLE' : 'NOT CREDIBLE';
        process.stderr.write(`[check-credibility]     → ${status}\n`);
      }
    } finally {
      vite.kill();
    }
  }

  const manifest: CredibilityManifest = {
    generatedAt: new Date().toISOString(),
    specsChecked: results.length,
    credible: results.filter((r) => r.credible).length,
    notCredible: results.filter((r) => !r.credible).length,
    results,
  };
  mkdirSync(MANIFEST_DIR, { recursive: true });
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  process.stderr.write(
    `[check-credibility] Specs checked: ${String(manifest.specsChecked)}. ` +
      `Credible: ${String(manifest.credible)}. ` +
      `Not credible: ${String(manifest.notCredible)}.\n`,
  );
  process.stderr.write(
    `[check-credibility] Wrote ${relative(REPO_ROOT, MANIFEST_PATH)}\n`,
  );
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  process.stderr.write(`[check-credibility] fatal: ${msg}\n`);
  process.exit(1);
});
