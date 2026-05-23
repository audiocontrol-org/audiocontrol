/**
 * tools/scope-discovery/check-adopters.ts
 *
 * Adopter-manifest gate (workplan T6.2). Walks
 * `docs/scope-discovery/adopter-manifests.yaml` and, for each manifest
 * entry, finds files matching the entry's `expected_adopters_glob` and
 * reports any that do NOT import the canonical `from` path (and are not
 * listed as exceptions).
 *
 * Pair with the anti-pattern registry (T6.1): anti-patterns detect
 * LEGACY shapes that should be REPLACED; adopter manifests detect
 * FILES that should be USING a canonical primitive but aren't.
 *
 * Engine: glob-to-regex + pure-regex import-string match. The escape-
 * regex helper is needed because `@/` and `/` are regex meta. Matches
 * both `import ... from '<path>'` and `import('<path>')`, with single OR
 * double quotes accepted.
 *
 * Pre-commit hook (`.githooks/pre-commit`) invokes this via
 * `make check-adopters` whenever staged changes touch .ts/.tsx.
 *
 * Usage:
 *   tsx tools/scope-discovery/check-adopters.ts [--root <path>]
 *     [--registry <path>] [--quiet] [--json]
 *
 * Exit codes: 0 = empty registry OR no holdouts; 1 = holdouts; 2 = infra error.
 */

import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadRegistry,
  type AdopterManifestEntry,
  type TrackedHoldout,
} from './adopter-manifests-registry.js';
import {
  type ManifestResult,
  type ScanResult,
  reportJson,
  reportText,
} from './adopter-manifests-report.js';
import { listFilesMatching, toPosix } from './util/glob.js';
import { errorMessage } from './util/typeguards.js';

const DEFAULT_REGISTRY = 'docs/scope-discovery/adopter-manifests.yaml';
const DEFAULT_ROOT = '.';
const SCANNED_EXTENSIONS: ReadonlySet<string> = new Set(['.ts', '.tsx']);

/** Default per-segment directory names to skip during the tree walk. */
const SKIP_DIRS: ReadonlySet<string> = new Set([
  'node_modules',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage',
  '.git',
]);

export interface CliOptions {
  readonly registryPath: string;
  readonly scanRoot: string;
  readonly quiet: boolean;
  readonly json: boolean;
}

// Re-export shared types so the validator can import everything from
// this module without depending on the report-helper split.
export type { ManifestResult, ScanResult } from './adopter-manifests-report.js';

// ---------------------------------------------------------------------------
// CLI surface
// ---------------------------------------------------------------------------

export function parseCli(argv: readonly string[]): CliOptions {
  let registryPath = DEFAULT_REGISTRY;
  let scanRoot = DEFAULT_ROOT;
  let quiet = false;
  let json = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--registry': {
        const next = argv[i + 1];
        if (next === undefined) throw new Error('--registry requires a path argument');
        registryPath = next;
        i += 1;
        break;
      }
      case '--root': {
        const next = argv[i + 1];
        if (next === undefined) throw new Error('--root requires a path argument');
        scanRoot = next;
        i += 1;
        break;
      }
      case '--quiet':
        quiet = true;
        break;
      case '--json':
        json = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        throw new Error('unreachable');
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }
  return { registryPath, scanRoot, quiet, json };
}

function printHelp(): void {
  process.stdout.write(
    [
      'tsx tools/scope-discovery/check-adopters.ts [options]',
      '',
      'Options:',
      '  --registry <path>  Override registry path (default: docs/scope-discovery/adopter-manifests.yaml)',
      '  --root <path>      Override scan root (default: repo root cwd)',
      '  --quiet            Suppress per-holdout output; print summary only',
      '  --json             Emit findings as JSON',
      '  --help, -h         Show this help',
      '',
    ].join('\n'),
  );
}

// ---------------------------------------------------------------------------
// Import detection
// ---------------------------------------------------------------------------

/**
 * Build a regex that detects an import of `path`. Matches:
 *   import ... from '<path>'
 *   import ... from "<path>"
 *   import('<path>')
 *   import("<path>")
 *   export ... from '<path>'  (re-export, counts as adoption)
 *   require('<path>')         (CommonJS interop, counts as adoption)
 *
 * The path is escaped before insertion; regex meta in `from` (slashes,
 * `@`, etc.) are matched literally.
 */
export function buildImportRegex(canonicalPath: string): RegExp {
  const escaped = escapeRegex(canonicalPath);
  // Order matters: the union below covers static imports, re-exports,
  // dynamic imports, and CJS requires. Multi-line flag so the regex
  // matches imports anywhere in the file.
  const pattern =
    `(?:` +
    `(?:import|export)\\s+(?:[^'"]*\\sfrom\\s+)?['"]${escaped}['"]` +
    `|` +
    `import\\s*\\(\\s*['"]${escaped}['"]\\s*\\)` +
    `|` +
    `require\\s*\\(\\s*['"]${escaped}['"]\\s*\\)` +
    `)`;
  return new RegExp(pattern, 'm');
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Top-level scan
// ---------------------------------------------------------------------------

export async function scan(opts: CliOptions): Promise<ScanResult> {
  const registry = await loadRegistry(opts.registryPath);
  if (registry.entries.length === 0) {
    return { manifests: [], entriesScanned: 0, filesVisited: 0 };
  }
  const rootAbs = resolve(opts.scanRoot);
  const visited = new Set<string>();
  const manifests: ManifestResult[] = [];
  for (const entry of registry.entries) {
    const result = await scanEntry(entry, rootAbs, visited);
    manifests.push(result);
  }
  return {
    manifests,
    entriesScanned: registry.entries.length,
    filesVisited: visited.size,
  };
}

async function scanEntry(
  entry: AdopterManifestEntry,
  rootAbs: string,
  visited: Set<string>,
): Promise<ManifestResult> {
  const regexes = entry.globs.map((g) => g.regex);
  const matched = await listFilesMatching(rootAbs, regexes, SKIP_DIRS, SCANNED_EXTENSIONS);
  const importRe = buildImportRegex(entry.from);
  const expectedFiles: string[] = [];
  const actualAdopters: string[] = [];
  const exemptedFiles: string[] = [];
  const holdouts: string[] = [];
  const trackedHoldoutFiles: TrackedHoldout[] = [];
  // Partition expected files into three buckets BEFORE checking imports:
  // (a) `exceptionSet` — permanent opt-outs (never findings, never tracked);
  // (b) `trackedHoldoutByPath` — deferred-but-known holdouts (never findings,
  //     surfaced in their own report section);
  // (c) everything else — regular candidates whose import status determines
  //     adopter vs. finding.
  const exceptionSet = new Set(entry.exceptions.map((e) => e.path));
  const trackedHoldoutByPath = new Map<string, TrackedHoldout>(
    entry.trackedHoldouts.map((th) => [th.path, th]),
  );
  for (const abs of matched) {
    visited.add(abs);
    const rel = toPosix(toRepoRel(abs, rootAbs));
    expectedFiles.push(rel);
    if (exceptionSet.has(rel)) {
      exemptedFiles.push(rel);
      continue;
    }
    const tracked = trackedHoldoutByPath.get(rel);
    if (tracked !== undefined) {
      trackedHoldoutFiles.push(tracked);
      continue;
    }
    const content = await readFileSafe(abs);
    if (importRe.test(content)) {
      actualAdopters.push(rel);
    } else {
      holdouts.push(rel);
    }
  }
  expectedFiles.sort();
  actualAdopters.sort();
  exemptedFiles.sort();
  holdouts.sort();
  trackedHoldoutFiles.sort((a, b) => a.path.localeCompare(b.path));
  return {
    entry,
    expectedFiles,
    actualAdopters,
    exemptedFiles,
    trackedHoldoutFiles,
    holdouts,
  };
}

function toRepoRel(abs: string, rootAbs: string): string {
  if (abs === rootAbs) return '';
  if (abs.startsWith(rootAbs + '/')) return abs.substring(rootAbs.length + 1);
  return abs;
}

async function readFileSafe(path: string): Promise<string> {
  try {
    const fileStat = await stat(path);
    if (fileStat.size === 0) return '';
    return await readFile(path, 'utf8');
  } catch (err) {
    throw new Error(`adopter-manifests: failed to read ${path}: ${errorMessage(err)}`);
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function main(argv: readonly string[]): Promise<number> {
  let opts: CliOptions;
  try {
    opts = parseCli(argv);
  } catch (err) {
    process.stderr.write(`adopter-manifests: ${errorMessage(err)}\n`);
    return 2;
  }
  let result: ScanResult;
  try {
    result = await scan(opts);
  } catch (err) {
    process.stderr.write(`adopter-manifests: ${errorMessage(err)}\n`);
    return 2;
  }
  const out = opts.json ? reportJson(result) : reportText(result, { quiet: opts.quiet });
  if (out.length > 0) process.stdout.write(out);
  const totalHoldouts = result.manifests.reduce((n, m) => n + m.holdouts.length, 0);
  return totalHoldouts === 0 ? 0 : 1;
}

function isCliEntryPoint(): boolean {
  if (typeof process === 'undefined' || process.argv.length < 2) return false;
  const invoked = process.argv[1];
  if (invoked === undefined) return false;
  return invoked === fileURLToPath(import.meta.url);
}

if (isCliEntryPoint()) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err: unknown) => {
      process.stderr.write(`adopter-manifests: fatal: ${errorMessage(err)}\n`);
      process.exit(2);
    },
  );
}
