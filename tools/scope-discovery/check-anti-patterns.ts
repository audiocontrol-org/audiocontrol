/**
 * tools/scope-discovery/check-anti-patterns.ts
 *
 * Anti-pattern gate (workplan T6.1). Walks
 * `docs/scope-discovery/anti-patterns.yaml` and scans the source tree for
 * any code matching a registered legacy shape. Refactor commits that
 * extract a primitive append an entry naming the shape the primitive
 * replaces; future drift gets caught structurally even without a token-
 * level clone match.
 *
 * Engine: pure-regex matching (single-pattern OR multi-pattern fingerprint
 * with `min_distance` proximity). See `anti-patterns-registry.ts` for the
 * schema + parse-time validation; `anti-patterns-report.ts` for output
 * formatters. ast-grep (the feedback's example) adds a binary dep the
 * repo doesn't already carry; pure-regex is adequate when fingerprints
 * are precise.
 *
 * Pre-commit hook (`.githooks/pre-commit`) invokes this via
 * `make check-anti-patterns` whenever staged changes touch .ts/.tsx.
 *
 * Usage:
 *   tsx tools/scope-discovery/check-anti-patterns.ts [--root <path>]
 *     [--registry <path>] [--quiet] [--json]
 *
 * Exit codes: 0 = empty registry OR no matches; 1 = matches; 2 = infra error.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type AntiPatternEntry,
  isPathExcluded,
  loadRegistry,
} from './anti-patterns-registry.js';
import {
  type Finding,
  type ScanResult,
  reportJson,
  reportText,
} from './anti-patterns-report.js';
import { toPosix } from './util/glob.js';
import { errorMessage } from './util/typeguards.js';

const DEFAULT_REGISTRY = 'docs/scope-discovery/anti-patterns.yaml';
const DEFAULT_ROOT = 'modules';
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
export type { Finding, ScanResult } from './anti-patterns-report.js';

// ---------------------------------------------------------------------------
// CLI surface (small + pure so the validator can test it without subprocess).
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
      'tsx tools/scope-discovery/check-anti-patterns.ts [options]',
      '',
      'Options:',
      '  --registry <path>  Override registry path (default: docs/scope-discovery/anti-patterns.yaml)',
      '  --root <path>      Override scan root (default: modules)',
      '  --quiet            Suppress per-match output; print summary only',
      '  --json             Emit findings as JSON',
      '  --help, -h         Show this help',
      '',
    ].join('\n'),
  );
}

// ---------------------------------------------------------------------------
// File walk
// ---------------------------------------------------------------------------

/**
 * Recursive walk yielding every .ts/.tsx file under `root`. Skips
 * `SKIP_DIRS` and any path containing one of them as a segment. Returns
 * absolute paths, sorted for deterministic output.
 */
export async function listSourceFiles(root: string): Promise<string[]> {
  const absRoot = resolve(root);
  const out: string[] = [];
  await walk(absRoot, out);
  out.sort();
  return out;
}

async function walk(dir: string, out: string[]): Promise<void> {
  let entries: Awaited<ReturnType<typeof readdir>>;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    // Treat ENOENT as empty; surface other errors.
    if ((err as { code?: string }).code === 'ENOENT') return;
    throw new Error(`anti-patterns: readdir ${dir} failed: ${errorMessage(err)}`);
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, out);
    } else if (entry.isFile() && SCANNED_EXTENSIONS.has(extname(entry.name))) {
      out.push(full);
    }
  }
}

// ---------------------------------------------------------------------------
// Match logic
// ---------------------------------------------------------------------------

/**
 * Scan one file against one registry entry. Returns the 1-based line of the
 * earliest match position if all patterns are satisfied; otherwise null.
 *
 * Single-pattern entries: any match returns its line.
 * Multi-pattern entries: ALL patterns must match somewhere in the file AND
 * the line-distance between the earliest and latest match must be <=
 * `minDistance`. Heuristic for "the fingerprint co-occurs in one place"
 * rather than "these phrases happen to appear elsewhere in the file."
 */
export function matchFile(content: string, entry: AntiPatternEntry): number | null {
  if (entry.patterns.length === 1) {
    const [re] = entry.patterns;
    re.lastIndex = 0;
    const match = re.exec(content);
    return match === null ? null : positionToLine(content, match.index);
  }
  const perPattern: number[][] = [];
  for (const re of entry.patterns) {
    re.lastIndex = 0;
    const positions: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      positions.push(m.index);
      if (m.index === re.lastIndex) re.lastIndex += 1; // guard zero-width.
    }
    if (positions.length === 0) return null;
    perPattern.push(positions);
  }
  // For each candidate seed in pattern 0, see if every other pattern has
  // at least one match within `minDistance` lines (in either direction).
  for (const seed of perPattern[0]) {
    const seedLine = positionToLine(content, seed);
    let allMatch = true;
    let minLine = seedLine;
    for (let p = 1; p < perPattern.length; p += 1) {
      const found = perPattern[p].find((pos) => {
        const line = positionToLine(content, pos);
        return Math.abs(line - seedLine) <= entry.minDistance;
      });
      if (found === undefined) {
        allMatch = false;
        break;
      }
      const foundLine = positionToLine(content, found);
      if (foundLine < minLine) minLine = foundLine;
    }
    if (allMatch) return minLine;
  }
  return null;
}

function positionToLine(content: string, position: number): number {
  let line = 1;
  for (let i = 0; i < position && i < content.length; i += 1) {
    if (content.charCodeAt(i) === 0x0a) line += 1;
  }
  return line;
}

// ---------------------------------------------------------------------------
// Top-level scan
// ---------------------------------------------------------------------------

export async function scan(opts: CliOptions): Promise<ScanResult> {
  const registry = await loadRegistry(opts.registryPath);
  if (registry.entries.length === 0) {
    return { findings: [], filesScanned: 0, entriesScanned: 0 };
  }
  // AUDIT-08: every entry with `canonical_implementation_file:` must
  // point at a file that exists RIGHT NOW. If it doesn't, the
  // primitive was likely git-renamed without updating the registry —
  // the entry would silently miss its auto-exclusion and flag the
  // NEW canonical location (whichever file now carries the legacy
  // shape) as a holdout against its own anti-pattern. Fail loud at
  // scan start with the entry id + the missing path so the operator
  // can update `canonical_implementation_file:` in one step.
  assertCanonicalImplementationFilesExist(registry.entries);
  const files = await listSourceFiles(opts.scanRoot);
  const findings: Finding[] = [];
  const cwd = process.cwd();
  for (const file of files) {
    // Path against which `excludes_paths:` entries match: CWD-relative,
    // POSIX-form. Matches how findings are rendered in the report, so an
    // operator copying a flagged path into `excludes_paths:` works as-is.
    const relPath = toPosix(relative(cwd, file));
    let content: string | null = null;
    for (const entry of registry.entries) {
      if (isPathExcluded(entry, relPath)) continue;
      if (content === null) {
        try {
          const fileStat = await stat(file);
          if (fileStat.size === 0) {
            content = '';
            break; // empty file: nothing to match against; skip remaining entries
          }
          content = await readFile(file, 'utf8');
        } catch (err) {
          throw new Error(`anti-patterns: failed to read ${file}: ${errorMessage(err)}`);
        }
      }
      const line = matchFile(content, entry);
      if (line !== null) findings.push({ file, line, entry });
    }
  }
  return { findings, filesScanned: files.length, entriesScanned: registry.entries.length };
}

/**
 * AUDIT-08 — guard against stale `canonical_implementation_file:`
 * entries. The check runs once at scan start (not per-file) and
 * throws on the first missing canonical so the operator gets a
 * single actionable error instead of a per-finding cascade.
 *
 * The path resolves against the scanner's CWD — matches how
 * `isPathExcluded` compares the canonical to each candidate file
 * (CWD-relative POSIX), so an entry that passes this check will
 * actually self-exclude during the per-file loop.
 */
function assertCanonicalImplementationFilesExist(
  entries: readonly AntiPatternEntry[],
): void {
  for (const entry of entries) {
    if (entry.canonicalImplementationFile === null) continue;
    const abs = resolve(process.cwd(), entry.canonicalImplementationFile);
    if (!existsSync(abs)) {
      throw new Error(
        `anti-pattern ${entry.id}: canonical_implementation_file ` +
          `'${entry.canonicalImplementationFile}' does not exist; ` +
          `the primitive may have been renamed. Update ` +
          `canonical_implementation_file: in ${entry.id} or remove the field.`,
      );
    }
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
    process.stderr.write(`anti-patterns: ${errorMessage(err)}\n`);
    return 2;
  }
  let result: ScanResult;
  try {
    result = await scan(opts);
  } catch (err) {
    process.stderr.write(`anti-patterns: ${errorMessage(err)}\n`);
    return 2;
  }
  const out = opts.json ? reportJson(result) : reportText(result, { quiet: opts.quiet });
  if (out.length > 0) process.stdout.write(out);
  return result.findings.length === 0 ? 0 : 1;
}

// Entry-point detection — matches the pattern used by the sibling
// scope-discovery CLIs (check-refactor-preconditions.ts). Importing this
// module from the validator must NOT trigger main().
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
      process.stderr.write(`anti-patterns: fatal: ${errorMessage(err)}\n`);
      process.exit(2);
    },
  );
}
