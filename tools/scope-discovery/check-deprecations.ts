/**
 * tools/scope-discovery/check-deprecations.ts
 *
 * Deprecation-driven scan (workplan T6.4) — CLI entry-point. Walks the
 * source tree for file-level `@deprecated` JSDoc tags + inline
 * `// DEPRECATED:` markers, counts remaining importers per deprecated
 * file, and emits a status report split into:
 *
 *   - "blocked" (importers > 0 — deletion is blocked until every
 *     importer migrates; the report names every importer with
 *     file:line),
 *   - "safe-to-delete" (importers === 0 — the next refactor commit
 *     can remove the file).
 *
 * Two outputs:
 *   - stdout (always, unless --quiet): the rendered markdown body +
 *     a summary line. The summary line + counts let an operator scan
 *     the terminal without parsing the markdown.
 *   - `docs/scope-discovery/deprecation-queue.md` (only with --write):
 *     the operator-readable artifact committed to the repo. Refreshed
 *     manually via `make check-deprecations-write` — there is NO
 *     pre-commit hook for this gate; the deprecation lifecycle is
 *     operator-driven, not commit-driven.
 *
 * Exit codes:
 *   0   scan completed successfully (the gate is informational; a
 *       non-zero importer count is NOT an error — it's a tracked
 *       in-flight status).
 *   2   scanner internal / IO error.
 *
 * Note: this gate intentionally does NOT exit 1 when importers exist.
 * The other Phase 6 gates (T6.1 anti-patterns, T6.2 adopters, T6.3
 * editor-symmetry) DO block commits because they surface "you
 * regressed the regime" conditions. Deprecation is the dual —
 * "someone marked this for deletion; here's who's still holding it
 * in place" — which is information, not a regression to block. The
 * operator drains the queue when ready; the gate's job is to make
 * "ready" observable.
 *
 * DRY: re-uses `util/glob.ts`'s walker (via `deprecation-scan.ts`),
 * mirrors the CLI shape of `check-editor-symmetry.ts` for parity, and
 * shares the `errorMessage` type-guard from `util/typeguards.ts`. No
 * copy-paste of subprocess / glob / regex utilities.
 */

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scan, type ScanResult } from './deprecation-scan.js';
import {
  ARTIFACT_PATH,
  renderJson,
  renderMarkdown,
  summaryLine,
} from './deprecation-report.js';
import { errorMessage } from './util/typeguards.js';

const DEFAULT_ROOT = '.';

export interface CliOptions {
  readonly scanRoot: string;
  readonly writeArtifact: boolean;
  readonly artifactPath: string;
  readonly quiet: boolean;
  readonly json: boolean;
}

export function parseCli(argv: readonly string[]): CliOptions {
  let scanRoot = DEFAULT_ROOT;
  let writeArtifact = false;
  let artifactPath = ARTIFACT_PATH;
  let quiet = false;
  let json = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--root': {
        const next = argv[i + 1];
        if (next === undefined) throw new Error('--root requires a path argument');
        scanRoot = next;
        i += 1;
        break;
      }
      case '--write':
        writeArtifact = true;
        break;
      case '--artifact': {
        const next = argv[i + 1];
        if (next === undefined) throw new Error('--artifact requires a path argument');
        artifactPath = next;
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
  return { scanRoot, writeArtifact, artifactPath, quiet, json };
}

function printHelp(): void {
  process.stdout.write(
    [
      'tsx tools/scope-discovery/check-deprecations.ts [options]',
      '',
      'Options:',
      '  --root <path>      Override scan root (default: repo root cwd)',
      '  --write            Write the rendered markdown to --artifact path',
      `  --artifact <path>  Override artifact path (default: ${ARTIFACT_PATH})`,
      '  --quiet            Suppress markdown body on stdout; summary line only',
      '  --json             Emit JSON to stdout instead of the markdown body',
      '  --help, -h         Show this help',
      '',
    ].join('\n'),
  );
}

export async function main(argv: readonly string[]): Promise<number> {
  let opts: CliOptions;
  try {
    opts = parseCli(argv);
  } catch (err) {
    process.stderr.write(`deprecation-scan: ${errorMessage(err)}\n`);
    return 2;
  }
  let result: ScanResult;
  try {
    result = await scan({ scanRoot: opts.scanRoot });
  } catch (err) {
    process.stderr.write(`deprecation-scan: ${errorMessage(err)}\n`);
    return 2;
  }
  const markdown = renderMarkdown(result);
  if (opts.writeArtifact) {
    try {
      const dest = resolve(opts.scanRoot, opts.artifactPath);
      await writeFile(dest, markdown, 'utf8');
    } catch (err) {
      process.stderr.write(`deprecation-scan: write artifact failed: ${errorMessage(err)}\n`);
      return 2;
    }
  }
  if (opts.json) {
    // JSON mode: stdout is pure JSON so downstream tools (jq, etc.)
    // can consume it. The summary line + markdown body go nowhere
    // — the JSON object carries the same counts.
    process.stdout.write(renderJson(result) + '\n');
    return 0;
  }
  if (!opts.quiet) {
    process.stdout.write(markdown);
  }
  process.stdout.write(summaryLine(result) + '\n');
  return 0;
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
      process.stderr.write(`deprecation-scan: fatal: ${errorMessage(err)}\n`);
      process.exit(2);
    },
  );
}
