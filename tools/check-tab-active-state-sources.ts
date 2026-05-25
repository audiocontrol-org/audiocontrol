/**
 * tools/check-tab-active-state-sources.ts
 *
 * Source-side companion gate for `check-tab-active-state`. Closes
 * Phase 2 task 2.10's Gate B requirement: scans the codebase for
 * tab-group radio-input IDs and asserts every ID is registered in
 * `docs/scope-discovery/tab-groups.yaml`. Catches the failure mode
 * the CSS-sync gate (Gate A) doesn't: "you added an AcRadioTabs
 * consumer with `id: 'tt-NEW'` but didn't register `tt-NEW` in the
 * registry." Without this gate, the new tab would render but its
 * panel would not show (no `:checked` selector emitted for it),
 * which is exactly the silent-drop class of bug the dispatch named.
 *
 * Scan shape — derives the prefix alternation from the registry
 * itself (`allFamilyIds`), so adding a new family to the registry
 * automatically expands the scanner's coverage. We match TWO id
 * shapes:
 *
 *   1. JSX/TS literal:    `id: '<prefix>-<rest>'`  (the
 *      `AcRadioTabDef` shape, e.g.,
 *      `{ id: 'tt-wave', label: 'Wave' }` in ToneEditorTabs.tsx).
 *   2. HTML attribute:    `id="<prefix>-<rest>"`   (mockup files
 *      under `docs/.../mockups/*.html`).
 *
 * Both forms are restricted to the registry's family prefixes — no
 * over-matching of unrelated `id` attributes (`id="some-link"` is
 * untouched because `some` isn't a registered family).
 *
 * Scope — narrow on purpose, to dodge two false-positive patterns
 * observed during gate development:
 *   - completed historical explorations under
 *     `docs/1.0/003-COMPLETE/.../explorations/*.html` carry tab IDs
 *     from an older design (`tt-pitch`, `tt-lfo`) that legitimately
 *     never made it into the current registry; those are archive
 *     artifacts and must not block commits.
 *   - the scope-discovery tooling itself uses clone-group / scenario
 *     identifiers like `as-type-cast` that collide with the `as` tab
 *     family prefix on a substring match; treating those as
 *     unregistered tab IDs would over-match.
 *
 * The scanner walks ONLY the production tab-consumer surface:
 *   1. `modules/**\/*.{tsx,ts}` — every editor's source tree.
 *   2. `modules/**\/*.html` — any HTML co-located with editor code.
 *   3. `docs/1.0/001-IN-PROGRESS/akai-harmonization/mockups/*.html` —
 *      the active staging mockups whose IDs the akai-reserved
 *      registry entries are pinned to.
 * Within those trees, the standard skip-set
 * (`node_modules`/`dist`/`.tmp`/`.git`/`coverage`/`.next`)
 * filters out build artifacts.
 *
 * Exit codes:
 *   0   every found ID is registered
 *   1   one or more found IDs are missing from the registry
 *   2   infra error (registry unreadable, scan I/O failure)
 *
 * CLI:
 *   tsx tools/check-tab-active-state-sources.ts
 *     [--registry <path>]    # default: docs/scope-discovery/tab-groups.yaml
 *     [--scan-root <path>]   # default: project root (cwd); the scan
 *                            # roots above resolve relative to this
 *
 * Wired into the pre-commit gate via `check-tab-active-state-sources`
 * (Makefile), conditioned on staged `.tsx`/`.html`/the registry.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { errorMessage } from './scope-discovery/util/typeguards.js';
import {
  allFamilyIds,
  allTabIds,
  loadRegistry,
} from './scope-discovery/tab-groups-registry.js';

const DEFAULT_REGISTRY_PATH = 'docs/scope-discovery/tab-groups.yaml';

/**
 * Directories to skip during recursion. Tuned to the production
 * layout — the validator fixtures override `--scan-root` so they
 * don't depend on these exclusions matching their structure.
 */
const SKIP_DIR_NAMES = new Set<string>([
  'node_modules',
  'dist',
  '.tmp',
  '.git',
  'coverage',
  '.build-stamp',
  '.next',
]);

const SCAN_EXTENSIONS = new Set<string>(['.tsx', '.ts', '.html']);

/**
 * The scan roots relative to `--scan-root` (defaults to cwd). The
 * walker recurses into each in turn; non-existent roots are skipped
 * silently (e.g., the akai mockups dir may be absent in a fixture
 * tree the validator spins up). Each path is repo-relative + uses
 * POSIX separators; `resolve()` against the cwd produces the
 * absolute walk-start path.
 */
const PRODUCTION_SCAN_ROOTS: readonly string[] = [
  'modules',
  'docs/1.0/001-IN-PROGRESS/akai-harmonization/mockups',
];

export interface CliOptions {
  readonly registryPath: string;
  readonly scanRoot: string;
  /**
   * When non-empty, overrides the default `PRODUCTION_SCAN_ROOTS`.
   * Used by the adversarial validator scenarios (which need to scan
   * a single fixture directory rather than the production tree).
   * Each entry is resolved relative to `scanRoot`.
   */
  readonly scanSubdirs: readonly string[];
}

export function parseCli(argv: readonly string[]): CliOptions {
  let registryPath = DEFAULT_REGISTRY_PATH;
  let scanRoot = process.cwd();
  const scanSubdirs: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--registry':
        registryPath = argv[i + 1] ?? registryPath;
        i += 1;
        break;
      case '--scan-root':
        scanRoot = argv[i + 1] ?? scanRoot;
        i += 1;
        break;
      case '--scan-subdir':
        if (argv[i + 1] !== undefined) {
          scanSubdirs.push(argv[i + 1]!);
          i += 1;
        }
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }
  return { registryPath, scanRoot, scanSubdirs };
}

export interface FoundReference {
  readonly tabId: string;
  readonly file: string;
  readonly line: number;
  readonly shape: 'tsx-literal' | 'html-attribute';
}

/**
 * Build a regex that matches `id` references in a source file
 * whose value is `<family>-<rest>` for some registered family.
 *
 * Two shapes are union-ed:
 *   - `id:\s*['"]<prefix>-<rest>['"]`  (TS/TSX literal)
 *   - `id\s*=\s*['"]<prefix>-<rest>['"]`  (HTML / JSX attribute)
 *
 * The `<prefix>` alternation comes from the registry, so an
 * unrelated `id="some-link"` (where `some` is not a family) is
 * untouched. The `<rest>` requires at least one kebab-case segment
 * to filter `<prefix>-` typos that aren't full IDs.
 */
function buildScanRegex(familyIds: readonly string[]): RegExp {
  const prefixes = familyIds.map(escapeRegex).join('|');
  // Two alternates wrapped in non-capturing groups; outer capture is
  // the full tab id so the matcher can compare against the registry.
  return new RegExp(
    `(?:\\bid\\s*:\\s*['"]|\\bid\\s*=\\s*['"])((?:${prefixes})-[a-z][a-z0-9-]*)['"]`,
    'g',
  );
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Recurse into a directory, yielding the absolute path of every
 * file whose extension is in `SCAN_EXTENSIONS`. Skips directories
 * named in `SKIP_DIR_NAMES`. A missing root is silently skipped
 * (the validator fixtures may not contain every default scan root,
 * and the production tree itself can lack the akai mockups dir if
 * the workplan deletes it after the akai editor adopts the IDs).
 */
async function* walkFiles(root: string): AsyncGenerator<string> {
  let entries: Awaited<ReturnType<typeof readdir>>;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw new Error(`cannot read directory ${root}: ${errorMessage(err)}`);
  }
  for (const entry of entries) {
    const abs = join(root, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      yield* walkFiles(abs);
      continue;
    }
    if (!entry.isFile()) continue;
    const dotIdx = entry.name.lastIndexOf('.');
    if (dotIdx < 0) continue;
    const ext = entry.name.slice(dotIdx);
    if (!SCAN_EXTENSIONS.has(ext)) continue;
    yield abs;
  }
}

/**
 * Scan a single file for matches; return the references plus the
 * line numbers they fell on. Reads the whole file into memory —
 * `.tsx`/`.html` files in this project are well under 1 MB.
 */
async function scanFile(
  file: string,
  scanRoot: string,
  re: RegExp,
): Promise<readonly FoundReference[]> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (err) {
    throw new Error(`cannot read ${file}: ${errorMessage(err)}`);
  }
  const relPath = relative(scanRoot, file);
  const out: FoundReference[] = [];
  // Track newline offsets so we can convert byte index → line number
  // without a second pass.
  const newlineOffsets: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\n') newlineOffsets.push(i);
  }
  // Reset regex state per file — RegExp objects with the `g` flag
  // carry lastIndex across calls; using a single shared regex across
  // many files would skip matches at the start of each subsequent
  // file. Clone via the source/flags to avoid the shared state trap.
  const fileRe = new RegExp(re.source, re.flags);
  let m: RegExpExecArray | null;
  while ((m = fileRe.exec(text)) !== null) {
    const tabId = m[1]!;
    const line = lineOfIndex(m.index, newlineOffsets);
    const shape = text.slice(m.index, m.index + 4).startsWith('id=')
      ? 'html-attribute'
      : 'tsx-literal';
    out.push({ tabId, file: relPath, line, shape });
  }
  return out;
}

function lineOfIndex(index: number, newlineOffsets: readonly number[]): number {
  // Binary search for the first newline AFTER the index. Line numbers
  // are 1-based; newlineOffsets[0] is the index of the first `\n` in
  // the file, which terminates line 1.
  let lo = 0;
  let hi = newlineOffsets.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (newlineOffsets[mid]! < index) lo = mid + 1;
    else hi = mid;
  }
  return lo + 1;
}

export interface GateResult {
  readonly scanRoot: string;
  readonly registryPath: string;
  readonly filesScanned: number;
  readonly registeredIds: ReadonlySet<string>;
  readonly references: readonly FoundReference[];
  readonly unregistered: readonly FoundReference[];
}

export async function runGate(opts: CliOptions): Promise<GateResult> {
  const registry = await loadRegistry(opts.registryPath);
  const registeredIds = new Set(allTabIds(registry));
  const familyIds = allFamilyIds(registry);
  if (familyIds.length === 0) {
    // Empty registry → nothing to scan against; nothing is registered,
    // so any reference would be flagged. Skip the scan + report zero
    // references rather than over-matching.
    return {
      scanRoot: opts.scanRoot,
      registryPath: opts.registryPath,
      filesScanned: 0,
      registeredIds,
      references: [],
      unregistered: [],
    };
  }
  const re = buildScanRegex(familyIds);
  const references: FoundReference[] = [];
  let filesScanned = 0;
  const scanRoot = resolve(opts.scanRoot);
  const subdirs = opts.scanSubdirs.length > 0
    ? opts.scanSubdirs
    : PRODUCTION_SCAN_ROOTS;
  for (const subdir of subdirs) {
    const root = resolve(scanRoot, subdir);
    for await (const file of walkFiles(root)) {
      filesScanned += 1;
      const refs = await scanFile(file, scanRoot, re);
      references.push(...refs);
    }
  }
  const unregistered = references.filter((r) => !registeredIds.has(r.tabId));
  return {
    scanRoot,
    registryPath: opts.registryPath,
    filesScanned,
    registeredIds,
    references,
    unregistered,
  };
}

function formatReport(result: GateResult): string {
  if (result.unregistered.length === 0) {
    return (
      `check-tab-active-state-sources: OK — ` +
      `${result.references.length} registered ID reference(s) ` +
      `across ${result.filesScanned} file(s); no unregistered IDs.\n`
    );
  }
  const lines: string[] = [];
  lines.push(
    `check-tab-active-state-sources: FAIL — ` +
      `${result.unregistered.length} unregistered tab ID reference(s) ` +
      `across ${result.filesScanned} scanned file(s):`,
  );
  for (const ref of result.unregistered) {
    lines.push(`  ${ref.file}:${ref.line}  id="${ref.tabId}" (${ref.shape})`);
  }
  lines.push('');
  lines.push(
    `Fix: append the missing ID(s) to docs/scope-discovery/tab-groups.yaml under the appropriate \`tab_groups\` entry, then run \`make codegen-tab-active-state\` to regenerate the CSS.`,
  );
  return lines.join('\n') + '\n';
}

async function main(argv: readonly string[]): Promise<number> {
  let opts: CliOptions;
  try {
    opts = parseCli(argv);
  } catch (err) {
    process.stderr.write(`check-tab-active-state-sources: ${errorMessage(err)}\n`);
    return 2;
  }
  let result: GateResult;
  try {
    result = await runGate(opts);
  } catch (err) {
    process.stderr.write(`check-tab-active-state-sources: ${errorMessage(err)}\n`);
    return 2;
  }
  if (result.unregistered.length === 0) {
    process.stdout.write(formatReport(result));
    return 0;
  }
  process.stderr.write(formatReport(result));
  return 1;
}

// Invoked-as-script guard — see codegen-tab-active-state.ts for the
// rationale (this file is also imported by the adversarial validator
// scenarios, which need the `runGate` export).
const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (invokedDirectly) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err: unknown) => {
      process.stderr.write(
        `check-tab-active-state-sources crashed: ${errorMessage(err)}\n`,
      );
      process.exit(2);
    },
  );
}
