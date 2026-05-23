/**
 * tools/scope-discovery/editor-symmetry-matrix.ts
 *
 * Matrix computation for the T6.3 cross-editor symmetry checker.
 * Walks `docs/scope-discovery/adopter-manifests.yaml` (the same
 * registry T6.2's `check-adopters` consumes) and, for each manifest
 * entry, computes a per-editor adoption status from the entry's
 * `expected_adopters_glob` + canonical `from` path.
 *
 * Output shape: an in-memory `SymmetryMatrix` whose `rows[i].cells[j]`
 * holds the adoption status of `editors[j]` for `manifests[i]`. The
 * renderer (`editor-symmetry-report.ts`) emits the matrix as a
 * markdown table. The CLI (`check-editor-symmetry.ts`) wires the
 * pieces together.
 *
 * Status semantics per cell:
 *   - ✓: every glob-matched file in the editor imports the canonical
 *        path OR is exempted; no holdouts.
 *   - ⚠: at least one glob-matched file in the editor does NOT import
 *        the canonical path and is not exempted (partial adoption).
 *   - ✗: the manifest's glob targets the editor (the glob's static
 *        prefix is `modules/<editor>/...` or a wildcard editor segment)
 *        but no glob-matched files exist in the editor OR all
 *        matched files are holdouts with no adoption. The editor was
 *        EXPECTED to participate but isn't.
 *   - —: the manifest's glob does not target this editor at all
 *        (n/a). The cell carries no signal; it's there for matrix
 *        alignment.
 *
 * DRY: re-uses `loadRegistry` + `AdopterManifestEntry` from T6.2's
 * `adopter-manifests-registry.ts`, the glob walker from `util/glob.ts`,
 * the editor-set helpers from `util/editors.ts`, and the import-regex
 * builder from T6.2's `check-adopters.ts`. No copy-paste.
 */

import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  loadRegistry,
  type AdopterManifestEntry,
} from './adopter-manifests-registry.js';
import { buildImportRegex } from './check-adopters.js';
import { discoverEditors, editorForPath, editorsTargetedByGlob } from './util/editors.js';
import { listFilesMatching, toPosix } from './util/glob.js';
import { errorMessage } from './util/typeguards.js';

const SCANNED_EXTENSIONS: ReadonlySet<string> = new Set(['.ts', '.tsx']);

const SKIP_DIRS: ReadonlySet<string> = new Set([
  'node_modules',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage',
  '.git',
]);

/** Adoption status of one (manifest × editor) cell. */
export type CellStatus = 'ok' | 'partial' | 'missing' | 'na';

export interface MatrixCell {
  readonly status: CellStatus;
  /** Files in the editor matching the manifest's glob (count). */
  readonly expected: number;
  /** Subset of `expected` that import the canonical `from` path. */
  readonly actual: number;
  /** Subset of `expected` that match a declared exception. */
  readonly exempted: number;
  /** Subset of `expected` flagged as holdouts (not adopting, not exempted). */
  readonly holdouts: number;
}

export interface MatrixRow {
  readonly entry: AdopterManifestEntry;
  /** One cell per editor, in `editors` order. */
  readonly cells: readonly MatrixCell[];
}

export interface SymmetryMatrix {
  readonly editors: readonly string[];
  readonly rows: readonly MatrixRow[];
  /** Total unique TS/TSX files visited across all manifest scans. */
  readonly filesVisited: number;
}

export interface ComputeOptions {
  readonly registryPath: string;
  readonly scanRoot: string;
}

/**
 * Compute the full editor-symmetry matrix from the on-disk registry +
 * editor set. Empty registry → matrix with zero rows; the renderer
 * produces a "no manifests" placeholder body in that case.
 */
export async function computeMatrix(opts: ComputeOptions): Promise<SymmetryMatrix> {
  const rootAbs = resolve(opts.scanRoot);
  const editors = await discoverEditors(rootAbs);
  const registry = await loadRegistry(opts.registryPath);
  if (registry.entries.length === 0) {
    return { editors, rows: [], filesVisited: 0 };
  }
  const visited = new Set<string>();
  const rows: MatrixRow[] = [];
  for (const entry of registry.entries) {
    rows.push(await computeRow(entry, rootAbs, editors, visited));
  }
  return { editors, rows, filesVisited: visited.size };
}

interface PerEditorBuckets {
  expected: Set<string>;
  actual: Set<string>;
  exempted: Set<string>;
  holdouts: Set<string>;
}

async function computeRow(
  entry: AdopterManifestEntry,
  rootAbs: string,
  editors: readonly string[],
  visited: Set<string>,
): Promise<MatrixRow> {
  // Step 1: find every file matching ANY of the entry's globs. The scanner
  // walks the tree once; we bucket per-editor below.
  const globRegexes = entry.globs.map((g) => g.regex);
  const matchedAbs = await listFilesMatching(rootAbs, globRegexes, SKIP_DIRS, SCANNED_EXTENSIONS);

  // Step 2: build a per-editor bucket map. Keys are editor slugs;
  // values are sets of repo-relative paths.
  const buckets = new Map<string, PerEditorBuckets>();
  for (const editor of editors) {
    buckets.set(editor, {
      expected: new Set(),
      actual: new Set(),
      exempted: new Set(),
      holdouts: new Set(),
    });
  }

  const exceptionSet = new Set(entry.exceptions.map((e) => e.path));
  const importRe = buildImportRegex(entry.from);

  for (const abs of matchedAbs) {
    visited.add(abs);
    const rel = toPosix(toRepoRel(abs, rootAbs));
    const editor = editorForPath(rel, editors);
    if (editor === null) continue;
    const bucket = buckets.get(editor);
    if (bucket === undefined) continue;
    bucket.expected.add(rel);
    if (exceptionSet.has(rel)) {
      bucket.exempted.add(rel);
      continue;
    }
    const content = await readFileSafe(abs);
    if (importRe.test(content)) {
      bucket.actual.add(rel);
    } else {
      bucket.holdouts.add(rel);
    }
  }

  // Step 3: which editors does this manifest target? An editor is in
  // scope if at least one of its globs' static prefixes covers it.
  const targetedEditors = new Set<string>();
  for (const glob of entry.globs) {
    for (const ed of editorsTargetedByGlob(glob.pattern, editors)) {
      targetedEditors.add(ed);
    }
  }

  // Step 4: build the cells, in `editors` order.
  const cells: MatrixCell[] = editors.map((editor) => {
    const bucket = buckets.get(editor);
    if (bucket === undefined) {
      return cellNa();
    }
    const expected = bucket.expected.size;
    const actual = bucket.actual.size;
    const exempted = bucket.exempted.size;
    const holdouts = bucket.holdouts.size;
    if (!targetedEditors.has(editor)) {
      // The glob doesn't target this editor's tree.
      return { status: 'na', expected: 0, actual: 0, exempted: 0, holdouts: 0 };
    }
    const status = deriveStatus(expected, actual, exempted, holdouts);
    return { status, expected, actual, exempted, holdouts };
  });

  return { entry, cells };
}

function deriveStatus(
  expected: number,
  actual: number,
  exempted: number,
  holdouts: number,
): CellStatus {
  if (expected === 0) return 'missing';
  if (holdouts === 0 && actual + exempted === expected) return 'ok';
  if (actual === 0 && exempted === 0) return 'missing';
  return 'partial';
}

function cellNa(): MatrixCell {
  return { status: 'na', expected: 0, actual: 0, exempted: 0, holdouts: 0 };
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
    throw new Error(`editor-symmetry: failed to read ${path}: ${errorMessage(err)}`);
  }
}
