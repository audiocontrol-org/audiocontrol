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
 *
 * The `@credibleAgainst` header parser lives in
 * `tools/check-credibility/parse-header.ts` so each file stays within the
 * project's 500-line cap.
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process';
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
// `.js` extension is required by NodeNext module resolution (the project's
// tsconfig.base.json uses module/moduleResolution: NodeNext); tsx resolves
// the corresponding .ts source at runtime.
import {
  parseCredibilityHeader,
  type CredibilityEntry,
} from './check-credibility/parse-header.js';

// ─── Types ─────────────────────────────────────────────────────────────────

interface BrokenResult {
  slot: string;
  variant: string;
  envVar: 'AC_BROKEN_VARIANT' | 'AC_BROKEN_CONTEXT';
  expectedFail: true;
  actuallyFailed: boolean;
  durationMs: number;
  // Last ~1000 chars of stdout+stderr from the Playwright run, captured ONLY
  // when the outcome was unexpected (i.e. `actuallyFailed === false` — a
  // broken variant that did not fail). Expected outcomes carry no diagnostic
  // payload so the manifest stays free of noise.
  unexpectedOutput?: string;
}

interface SpecCredibility {
  specPath: string;
  module: string;
  tier: 2 | 3;
  declarations: ReadonlyArray<CredibilityEntry>;
  unbrokenPasses: boolean;
  unbrokenDurationMs: number;
  // Last ~1000 chars of stdout+stderr from the unbroken Playwright run,
  // captured ONLY when the unbroken run unexpectedly failed
  // (`unbrokenPasses === false`). The downstream task (T7 / T8) uses this to
  // surface why the spec was deemed not credible without re-running the suite.
  unbrokenError?: string;
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

// ─── Vite dev-server lifecycle (per module) ────────────────────────────────

interface ViteHandle {
  port: number;
  kill: () => void;
}

// Bounded ring-buffer tail size for post-detection vite output. The tail is
// kept (small) so an error-path message still has diagnostic context, but the
// buffer cannot grow unbounded across a multi-spec session.
const VITE_TAIL_MAX = 4_000;

function startVite(moduleAbs: string): Promise<ViteHandle> {
  return new Promise((resolveStart, rejectStart) => {
    const proc = spawn('pnpm', ['vite', '--port', '0'], {
      cwd: moduleAbs,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    // Pre-detection buffer: accumulates until the port-advertisement match.
    // After detection, this is dropped and the post-detection tail takes
    // over so memory does not grow unbounded with vite's HMR chatter.
    let preBuf = '';
    // Post-detection ring buffer: bounded tail used to surface vite output
    // if the process later exits unexpectedly (the foreground loop kills
    // vite normally, so this is purely diagnostic).
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
        // After resolution the pre-detection listeners are removed, but a
        // chunk may still be in flight; route it to the bounded tail.
        appendPost(s);
        return;
      }
      preBuf += s;
      const m = preBuf.match(/https?:\/\/localhost:(\d+)/);
      if (m !== null) {
        resolved = true;
        clearTimeout(timer);
        const port = Number(m[1]);
        // Stop appending to the unbounded pre-detection buffer. Detach the
        // chunk listeners and re-attach a bounded tail collector so future
        // output (HMR notices, warnings) cannot leak memory across a long
        // multi-spec session.
        proc.stdout.off('data', onPreChunk);
        proc.stderr.off('data', onPreChunk);
        const onPostChunk = (c: Buffer): void => {
          appendPost(c.toString('utf8'));
        };
        proc.stdout.on('data', onPostChunk);
        proc.stderr.on('data', onPostChunk);
        // Release the pre-detection buffer once the relevant tail is in the
        // bounded post-detection buffer.
        appendPost(preBuf.slice(-VITE_TAIL_MAX));
        preBuf = '';
        const kill = (): void => {
          // SIGTERM first, SIGKILL after a short grace period to match the
          // shell-script teardown's behavior.
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
      // Post-detection exit. The normal teardown path sends SIGTERM (then
      // SIGKILL) from kill() above, which produces signal !== null. Surface
      // a diagnostic line ONLY when vite exited on its own — i.e. neither
      // a clean code=0 shutdown nor a signalled teardown.
      if (signal !== null) return;
      if (code === 0) return;
      process.stderr.write(
        `[check-credibility] vite exited unexpectedly (code=${String(code)}); tail: ${postBuf.slice(-1000)}\n`,
      );
    });
  });
}

// ─── Playwright invocation ─────────────────────────────────────────────────

interface PlaywrightOutcome {
  passed: boolean;
  durationMs: number;
  // Last ~1000 chars of stdout+stderr from the Playwright run. The caller
  // decides whether to persist this — expected outcomes (unbroken passed,
  // broken failed) drop it on the floor; unexpected outcomes propagate it
  // into the manifest so a diagnostic trail survives the script's exit.
  outputTail: string;
}

// Tail size for Playwright stdout/stderr captured per run. ~1000 chars is
// enough to catch the spec-error block + the "X failed" line; larger sizes
// would balloon the manifest without adding signal.
const PLAYWRIGHT_TAIL_MAX = 1_000;

function tailOf(s: string, max: number = PLAYWRIGHT_TAIL_MAX): string {
  return s.length > max ? s.slice(-max) : s;
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
  const stdout = typeof result.stdout === 'string' ? result.stdout : '';
  const stderr = typeof result.stderr === 'string' ? result.stderr : '';
  // Concatenate stderr after stdout so Playwright's failure summary (which
  // it writes to stderr) lands at the end of the tail when truncated.
  const combined = stdout + stderr;
  return {
    passed: result.status === 0,
    durationMs: Date.now() - start,
    outputTail: tailOf(combined),
  };
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
  const parsed = parseCredibilityHeader(source);
  const declarations = parsed.entries;
  const errors: string[] = [];

  // Surface any malformed `@credibleAgainst` lines into the manifest BEFORE
  // the "no declaration" error so the operator sees the actual typo rather
  // than just "missing declaration" when both shapes coexist.
  for (const w of parsed.warnings) {
    errors.push(w);
  }

  if (declarations.length === 0) {
    errors.push(
      "no @credibleAgainst declaration in JSDoc header — every Tier 2/3 spec must list the broken variants it claims to catch",
    );
  }

  const unbroken = runPlaywrightSpec(spec.modulePath, spec.absPath, port, {});
  // Only retain the captured tail when the outcome was UNEXPECTED. Expected
  // outcomes are non-diagnostic and would just balloon the manifest.
  let unbrokenError: string | undefined;
  if (!unbroken.passed) {
    errors.push('unbroken run failed — a credible spec must pass against the real harness');
    unbrokenError = unbroken.outputTail;
  }

  const brokenResults: BrokenResult[] = [];
  for (const decl of declarations) {
    const envVar = envVarForSlot(decl.slot);
    for (const variant of decl.variants) {
      const outcome = runPlaywrightSpec(spec.modulePath, spec.absPath, port, {
        [envVar]: variant,
      });
      const entry: BrokenResult = {
        slot: decl.slot,
        variant,
        envVar,
        expectedFail: true,
        actuallyFailed: !outcome.passed,
        durationMs: outcome.durationMs,
      };
      if (outcome.passed) {
        // Broken variant unexpectedly passed; surface the Playwright tail so
        // a debugger can see WHY the broken primitive did not produce the
        // expected failure (e.g. broken impl no-ops, harness routed wrong).
        entry.unexpectedOutput = outcome.outputTail;
        errors.push(
          `spec passed against broken variant ${decl.slot}/${variant} (${envVar}=${variant}) — credibility requires failure`,
        );
      }
      brokenResults.push(entry);
    }
  }

  const credible =
    declarations.length > 0 &&
    unbroken.passed &&
    brokenResults.length > 0 &&
    brokenResults.every((r) => r.actuallyFailed);

  const record: SpecCredibility = {
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
  if (unbrokenError !== undefined) {
    record.unbrokenError = unbrokenError;
  }
  return record;
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

/**
 * Verify that `pnpm` is on PATH before any spawn() / spawnSync() call relies
 * on it. Both the Vite dev-server launch and the Playwright invocation depend
 * on `pnpm exec`; missing binary used to produce an opaque ENOENT mid-run.
 * Failing here gives the operator a single, descriptive line.
 */
function assertPnpmAvailable(): void {
  try {
    // `command -v pnpm` is a POSIX-portable existence check. We pipe via
    // /bin/sh because `command` is a shell builtin, not a standalone binary.
    execFileSync('/bin/sh', ['-c', 'command -v pnpm'], { stdio: 'ignore' });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `check-credibility requires 'pnpm' on PATH (used for both 'pnpm vite' and 'pnpm exec playwright'). Install pnpm or activate the project's pnpm via corepack before re-running. Underlying error: ${detail}`,
    );
  }
}

async function main(): Promise<void> {
  assertPnpmAvailable();
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
