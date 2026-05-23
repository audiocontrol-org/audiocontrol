/**
 * tools/scope-discovery/check-editor-symmetry.ts
 *
 * Cross-editor symmetry gate (workplan T6.3). Reads
 * `docs/scope-discovery/adopter-manifests.yaml` (T6.2's registry) and
 * produces a fleet matrix: rows = adopter-manifest conventions,
 * columns = editor modules discovered under `modules/*-editor/`.
 *
 * Two outputs:
 *   - stdout (always): the rendered markdown table, suitable for
 *     piping into a markdown renderer or scanning in a terminal.
 *   - `docs/scope-discovery/editor-symmetry.md` (only with `--write`):
 *     the committed operator-readable artifact. The pre-commit hook
 *     runs WITHOUT `--write`; the operator runs `make check-editor-
 *     symmetry-write` to refresh the artifact when the registry
 *     changes.
 *
 * Exit codes:
 *   0   empty registry OR matrix has no ⚠ / ✗ cells.
 *   1   at least one cell is ⚠ (partial adoption) or ✗ (missing).
 *   2   infra / parse / IO error.
 *
 * DRY: re-uses `computeMatrix` from `editor-symmetry-matrix.ts` and
 * the renderer from `editor-symmetry-report.ts`; the registry parser
 * + glob walker + import detection are inherited via the T6.2
 * extraction. No duplicated YAML loading, no duplicated glob walk,
 * no duplicated import regex.
 */

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeMatrix, type SymmetryMatrix } from './editor-symmetry-matrix.js';
import { ARTIFACT_PATH, renderMatrix, tallyStatuses } from './editor-symmetry-report.js';
import { errorMessage } from './util/typeguards.js';

const DEFAULT_REGISTRY = 'docs/scope-discovery/adopter-manifests.yaml';
const DEFAULT_ROOT = '.';

export interface CliOptions {
  readonly registryPath: string;
  readonly scanRoot: string;
  readonly writeArtifact: boolean;
  readonly artifactPath: string;
  readonly quiet: boolean;
}

export function parseCli(argv: readonly string[]): CliOptions {
  let registryPath = DEFAULT_REGISTRY;
  let scanRoot = DEFAULT_ROOT;
  let writeArtifact = false;
  let artifactPath = ARTIFACT_PATH;
  let quiet = false;
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
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        throw new Error('unreachable');
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }
  return { registryPath, scanRoot, writeArtifact, artifactPath, quiet };
}

function printHelp(): void {
  process.stdout.write(
    [
      'tsx tools/scope-discovery/check-editor-symmetry.ts [options]',
      '',
      'Options:',
      '  --registry <path>  Override registry path (default: docs/scope-discovery/adopter-manifests.yaml)',
      '  --root <path>      Override scan root (default: repo root cwd)',
      '  --write            Write the rendered matrix to --artifact path',
      `  --artifact <path>  Override artifact path (default: ${ARTIFACT_PATH})`,
      '  --quiet            Suppress matrix output on stdout; summary line only',
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
    process.stderr.write(`editor-symmetry: ${errorMessage(err)}\n`);
    return 2;
  }
  let matrix: SymmetryMatrix;
  try {
    matrix = await computeMatrix({
      registryPath: opts.registryPath,
      scanRoot: opts.scanRoot,
    });
  } catch (err) {
    process.stderr.write(`editor-symmetry: ${errorMessage(err)}\n`);
    return 2;
  }
  const rendered = renderMatrix(matrix);
  if (opts.writeArtifact) {
    try {
      const dest = resolve(opts.scanRoot, opts.artifactPath);
      await writeFile(dest, rendered, 'utf8');
    } catch (err) {
      process.stderr.write(`editor-symmetry: write artifact failed: ${errorMessage(err)}\n`);
      return 2;
    }
  }
  const totals = tallyStatuses(matrix);
  if (!opts.quiet) {
    process.stdout.write(rendered);
  }
  const summary = formatSummary(matrix, totals);
  process.stdout.write(summary + '\n');
  if (matrix.rows.length === 0) return 0;
  return totals.partial + totals.missing === 0 ? 0 : 1;
}

function formatSummary(
  matrix: SymmetryMatrix,
  totals: Record<string, number>,
): string {
  if (matrix.rows.length === 0) {
    return 'editor-symmetry: registry empty; nothing to check.';
  }
  const cellCount = matrix.rows.length * matrix.editors.length;
  return (
    `editor-symmetry: ${matrix.rows.length} convention(s) × ${matrix.editors.length} editor(s) ` +
    `= ${cellCount} cells; ` +
    `${totals.ok} ✓, ${totals.partial} ⚠, ${totals.missing} ✗, ${totals.tracked} ⏳, ${totals.na} —.`
  );
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
      process.stderr.write(`editor-symmetry: fatal: ${errorMessage(err)}\n`);
      process.exit(2);
    },
  );
}
