/**
 * tools/scope-discovery/discovery-agents/shared.ts
 *
 * Common scaffolding used by every discovery agent. The four agents
 * share the same CLI shape, the same modules-walking primitive, and the
 * same PRD-reading primitive — extracting it here keeps each agent file
 * under the 300-line cap and prevents the four agents from drifting
 * into four-slightly-different versions of the same helpers.
 *
 * Per .claude/CLAUDE.md: "USE DRY PRINCIPLES … DO NOT DUPLICATE CODE."
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DiscoveryAgentInput } from './types.js';
import { errorMessage } from '../util/typeguards.js';

/** Default modules root scanned by code-side agents. */
export const MODULES_DIR = 'modules';

/** Files/dirs every agent skips when walking sources. */
const SKIP_DIRS: ReadonlySet<string> = new Set([
  'node_modules',
  'dist',
  '.turbo',
  'coverage',
  '.next',
  '__snapshots__',
]);

const SRC_EXTENSIONS: ReadonlyArray<string> = ['.ts', '.tsx'];

/**
 * Parse the CLI args shared by all four agents:
 *   --feature <slug>      required
 *   --prd-path <path>     required
 *   --repo-root <path>    optional (defaults to process.cwd())
 *
 * Returns a fully-resolved DiscoveryAgentInput. Throws on missing
 * required args — the agent's main() catches and exits non-zero so the
 * skill upstream sees a real failure (not a silent fallback).
 */
export function parseAgentCli(argv: ReadonlyArray<string>): DiscoveryAgentInput {
  let featureSlug: string | null = null;
  let prdPath: string | null = null;
  let repoRoot: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--feature') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error('--feature requires a value');
      featureSlug = next;
      i += 1;
    } else if (a === '--prd-path') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error('--prd-path requires a value');
      prdPath = next;
      i += 1;
    } else if (a === '--repo-root') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error('--repo-root requires a value');
      repoRoot = next;
      i += 1;
    } else if (a === '--help' || a === '-h') {
      throw new Error('HELP');
    } else {
      throw new Error(`unknown arg: ${a}`);
    }
  }
  if (featureSlug === null) throw new Error('--feature is required');
  if (prdPath === null) throw new Error('--prd-path is required');
  const root = resolve(repoRoot ?? process.cwd());
  return {
    featureSlug,
    prdPath: resolve(root, prdPath),
    repoRoot: root,
  };
}

/**
 * Standard agent CLI entrypoint shape. Each agent's main() emits the
 * findings JSON to stdout and exits 0 on success, non-zero on infra
 * error. This wrapper centralizes argv parsing + error formatting so
 * each agent file stays focused on its discovery logic.
 */
export async function runAgentCli(
  agentName: string,
  run: (input: DiscoveryAgentInput) => Promise<unknown>,
): Promise<number> {
  let input: DiscoveryAgentInput;
  try {
    input = parseAgentCli(process.argv.slice(2));
  } catch (err) {
    const msg = errorMessage(err);
    if (msg === 'HELP') {
      printAgentUsage(agentName);
      return 0;
    }
    process.stderr.write(`${agentName}: ${msg}\n`);
    printAgentUsage(agentName);
    return 2;
  }
  try {
    const findings = await run(input);
    process.stdout.write(`${JSON.stringify(findings, null, 2)}\n`);
    return 0;
  } catch (err) {
    process.stderr.write(`${agentName}: ${errorMessage(err)}\n`);
    return 1;
  }
}

function printAgentUsage(agentName: string): void {
  process.stderr.write(
    [
      `Usage: tsx tools/scope-discovery/discovery-agents/${agentName}.ts \\`,
      '    --feature <slug> \\',
      '    --prd-path <path-to-prd.md> \\',
      '    [--repo-root <path>]',
      '',
    ].join('\n'),
  );
}

/**
 * Recursively walk a directory yielding repo-relative paths of files
 * matching `extensions`. Skips SKIP_DIRS. Returns sorted output for
 * deterministic agent runs across invocations.
 *
 * `rootAbs` must be absolute; results are relative to `repoRoot` so
 * downstream consumers (synthesis, manifest) see consistent paths.
 *
 * The root is validated up front: a missing/non-directory root throws a
 * descriptive error rather than producing zero findings (which would
 * mask a typo in `--repo-root` as a successful no-op).
 */
export async function walkSourceFiles(args: {
  readonly rootAbs: string;
  readonly repoRoot: string;
  readonly extensions?: ReadonlyArray<string>;
}): Promise<ReadonlyArray<string>> {
  const exts = args.extensions ?? SRC_EXTENSIONS;
  let rootStat: Awaited<ReturnType<typeof stat>>;
  try {
    rootStat = await stat(args.rootAbs);
  } catch (err) {
    throw new Error(
      `walkSourceFiles: source root not accessible: ${args.rootAbs}: ${errorMessage(err)}`,
    );
  }
  if (!rootStat.isDirectory()) {
    throw new Error(`walkSourceFiles: source root is not a directory: ${args.rootAbs}`);
  }
  const collected: string[] = [];
  await walkInto(args.rootAbs, args.repoRoot, exts, collected);
  return collected.sort();
}

/**
 * Recursive walker. Nested-directory `readdir` errors propagate — the
 * deliberate choice for a discovery tool is to fail loudly rather than
 * silently degrade. ENOENT mid-walk (a dir removed between scan and
 * read) is rare in this read-only context; propagating surfaces it
 * rather than hiding it as a missing-findings ghost.
 */
async function walkInto(
  dirAbs: string,
  repoRoot: string,
  exts: ReadonlyArray<string>,
  out: string[],
): Promise<void> {
  const raw = await readdir(dirAbs, { withFileTypes: true });
  const entries = raw.map((d) => ({
    name: d.name,
    isDir: d.isDirectory(),
    isFile: d.isFile(),
  }));
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dirAbs, entry.name);
    if (entry.isDir) {
      await walkInto(full, repoRoot, exts, out);
    } else if (entry.isFile) {
      const lower = entry.name.toLowerCase();
      const matches = exts.some((e) => lower.endsWith(e));
      if (matches) out.push(relative(repoRoot, full));
    }
  }
}

/**
 * Detect the editor modules present in the repo by scanning
 * `<repoRoot>/modules/` for child directories whose name ends in
 * `-editor`. Deterministic ordering (sorted).
 *
 * Convention from CLAUDE.md: editor modules live at `modules/<editor>/`
 * and are served at `https://audiocontrol.org/<manufacturer>/<device>/editor`.
 */
export async function listEditorModules(
  repoRoot: string,
): Promise<ReadonlyArray<string>> {
  const modulesAbs = join(repoRoot, MODULES_DIR);
  let entries: ReadonlyArray<string>;
  try {
    const raw = await readdir(modulesAbs, { withFileTypes: true });
    entries = raw
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((n) => n.endsWith('-editor'));
  } catch (err) {
    throw new Error(
      `cannot list ${MODULES_DIR}/ under ${repoRoot}: ${errorMessage(err)}`,
    );
  }
  return [...entries].sort();
}

/**
 * Read a UTF-8 text file. Throws a descriptive error including the
 * absolute path on failure — no silent fallback (per the project rule).
 */
export async function readUtf8(absPath: string): Promise<string> {
  try {
    return await readFile(absPath, 'utf8');
  } catch (err) {
    throw new Error(`cannot read ${absPath}: ${errorMessage(err)}`);
  }
}

/**
 * The bag-of-views every pattern-scanning agent needs for a source
 * file: the repo-relative path (for stable downstream references), the
 * full text (for whole-string regex scans like `applyPattern`), and a
 * pre-split lines array (for line-grep style scans like
 * `gatherOccurrences`). Computing once + sharing avoids re-splitting in
 * each consumer.
 */
export interface SourceFileView {
  readonly file: string;
  readonly text: string;
  readonly lines: ReadonlyArray<string>;
}

/**
 * Read a repo-relative source file and return its `SourceFileView`.
 * Errors propagate — matching the discovery-tool failure-loud posture
 * for `walkSourceFiles`. A file path produced by `walkSourceFiles` and
 * read moments later is virtually always present; if it disappears
 * (ENOENT) or the agent can't read it (EACCES), surfacing the error is
 * the right call rather than masking it as a missing finding.
 */
export async function readSourceFile(args: {
  readonly repoRoot: string;
  readonly relFile: string;
}): Promise<SourceFileView> {
  const text = await readUtf8(repoAbs(args.repoRoot, args.relFile));
  return {
    file: args.relFile,
    text,
    lines: text.split(/\r?\n/),
  };
}

/**
 * Read the feature's PRD as text. The path is the resolved absolute
 * path from the CLI; a missing file is an infra error (the upstream
 * skill must surface it).
 */
export async function readPrd(input: DiscoveryAgentInput): Promise<string> {
  return readUtf8(input.prdPath);
}

/**
 * Determine which editor modules are in scope for a given feature. The
 * heuristic (v1):
 *   1. Read the PRD.
 *   2. For every `<editor>` directory under `modules/`, check whether
 *      the PRD text mentions the module name (case-insensitive).
 *   3. If at least one match, return only the matched modules.
 *   4. Otherwise, return ALL editor modules (system-wide default).
 *
 * This is intentionally simple — naming a module in the PRD is the
 * unambiguous signal of intent; absence of any mention means the
 * feature is system-wide and should fan out across every editor.
 *
 * A missing/unreadable PRD is an infra failure, not a "default to
 * everything" condition — `readPrd` throws a descriptive error which
 * propagates to the agent's CLI wrapper (per CLAUDE.md "no fallbacks
 * outside test code"). Callers that genuinely want the system-wide set
 * without a PRD should call `listEditorModules` directly.
 */
export async function modulesInScopeForFeature(
  input: DiscoveryAgentInput,
): Promise<ReadonlyArray<string>> {
  const editors = await listEditorModules(input.repoRoot);
  const prdText = await readPrd(input);
  const lower = prdText.toLowerCase();
  const mentioned = editors.filter((m) => lower.includes(m.toLowerCase()));
  return mentioned.length > 0 ? mentioned : editors;
}

/** Resolve a repo-relative path against the repo root. */
export function repoAbs(repoRoot: string, rel: string): string {
  return resolve(repoRoot, rel);
}

/** Quick `fs.stat`-based directory existence check (no throw). */
export async function isDirectory(absPath: string): Promise<boolean> {
  try {
    const s = await stat(absPath);
    return s.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Run an agent's `runAgentCli` invocation only when the calling module
 * is the script's entry point — inert when imported by the synthesis
 * pass (T3.2) or the `/scope-inventory` skill (T3.3). Each agent passes
 * its `import.meta.url` so this helper can compare against argv[1].
 *
 * Centralized here so all four agents (and any future ones) use the
 * same idiom — keeps the entry-detection logic in one place.
 */
export function runIfMain(args: {
  readonly importMetaUrl: string;
  readonly agentName: string;
  readonly run: (input: DiscoveryAgentInput) => Promise<unknown>;
}): void {
  if (
    process.argv[1] === undefined ||
    fileURLToPath(args.importMetaUrl) !== process.argv[1]
  ) {
    return;
  }
  runAgentCli(args.agentName, args.run)
    .then((code) => {
      process.exit(code);
    })
    .catch((err: unknown) => {
      process.stderr.write(`${args.agentName}: ${errorMessage(err)}\n`);
      process.exit(1);
    });
}
