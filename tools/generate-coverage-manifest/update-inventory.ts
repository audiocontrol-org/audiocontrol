/**
 * tools/generate-coverage-manifest/update-inventory.ts
 *
 * In-place update of the `Coverage` column in
 * `ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md`. The `Sign-off` column is
 * operator-owned per reform spec §7 and must NEVER be touched here.
 *
 * The strategy:
 *   1. Read the file line-by-line.
 *   2. Detect each operative table by the presence of its load-bearing
 *      columns (`ID`, `Status`, `Sign-off`, `Coverage`). Tables lacking
 *      `Sign-off` + `Coverage` are skipped — that's what excludes the
 *      missing-affordances roll-up at the top of the doc. The legacy
 *      `Test` column was removed in 9R-A.3; Tier 1 evidence now lives
 *      under `modules/<editor>/test/wiring/` and is discovered via
 *      `scan-specs.ts`.
 *   3. For each D-row in such a table, recompute ONLY the Coverage cell
 *      from the manifest. Every other cell is copied through verbatim,
 *      preserving whitespace + content.
 *
 * Markdown-table whitespace preservation is intentional: the rest of the
 * row's source text is left byte-for-byte unchanged. The only altered
 * bytes per run are the Coverage cell contents.
 */

import { readFileSync, writeFileSync } from 'node:fs';

import type { CoverageManifest } from './types.js';

interface TableHeader {
  /** 0-based column indices (per the cells[] array after splitRow()). */
  readonly idIdx: number;
  readonly statusIdx: number;
  readonly coverageIdx: number;
  /** Snapshot of the header cells; used to assert the table shape. */
  readonly columns: ReadonlyArray<string>;
}

function splitRow(line: string): string[] {
  const cells = line.split('|').map((c) => c.trim());
  if (cells.length > 0 && cells[0] === '') cells.shift();
  if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
  return cells;
}

function isSeparator(cells: ReadonlyArray<string>): boolean {
  if (cells.length === 0) return false;
  return cells.every((c) => /^[:\-\s]+$/.test(c));
}

function parseTableHeader(cells: ReadonlyArray<string>): TableHeader | null {
  const requiredColumns = ['ID', 'Status', 'Sign-off', 'Coverage'] as const;
  const indices = new Map<string, number>();
  cells.forEach((c, i) => {
    indices.set(c, i);
  });
  for (const c of requiredColumns) {
    if (!indices.has(c)) return null;
  }
  const idIdx = indices.get('ID') ?? -1;
  const statusIdx = indices.get('Status') ?? -1;
  const coverageIdx = indices.get('Coverage') ?? -1;
  if (idIdx < 0 || statusIdx < 0 || coverageIdx < 0) return null;
  return { idIdx, statusIdx, coverageIdx, columns: cells };
}

/**
 * Rewrite ONLY the `Coverage` cell on the given row, leaving every other
 * byte (including each cell's internal whitespace padding) untouched.
 *
 * We split the raw line on `|` to get the segments, mutate the cell at the
 * Coverage index, and rejoin — preserving leading/trailing/inner spacing
 * within each segment except the one we replace. The replacement cell is
 * formatted as ` <value> ` to match the surrounding markdown's one-space
 * padding convention.
 */
function rewriteCoverageCell(rawLine: string, header: TableHeader, value: string): string {
  // Split on `|` WITHOUT trimming the segments. Each segment includes its
  // surrounding spaces.
  const segments = rawLine.split('|');
  // For a markdown row `| a | b | c |`, split yields ['', ' a ', ' b ', ' c ', ''].
  // Cell index N corresponds to segments[N + 1] when the line starts with `|`.
  if (segments.length === 0) return rawLine;
  const leadingEmpty = segments[0] === '';
  const offset = leadingEmpty ? 1 : 0;
  const targetIdx = header.coverageIdx + offset;
  if (targetIdx >= segments.length) return rawLine;
  // Replace the target segment, preserving the single-space padding shape.
  segments[targetIdx] = ` ${value} `;
  return segments.join('|');
}

function isDRow(cells: ReadonlyArray<string>): boolean {
  if (cells.length === 0) return false;
  return /^D(?:-[A-Z]+)+-\d+$/.test(cells[0] ?? '');
}

export interface UpdateResult {
  /** Number of D-rows whose Coverage cell changed. */
  readonly rowsChanged: number;
  /** Number of D-rows visited (changed or already correct). */
  readonly rowsVisited: number;
}

export function updateInventoryCoverageColumn(
  inventoryPath: string,
  manifest: CoverageManifest,
): UpdateResult {
  const text = readFileSync(inventoryPath, 'utf8');
  const lines = text.split('\n');
  const out: string[] = [];
  let header: TableHeader | null = null;
  let rowsChanged = 0;
  let rowsVisited = 0;
  let separatorSeen = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) {
      out.push(line);
      header = null;
      separatorSeen = false;
      continue;
    }
    const cells = splitRow(trimmed);
    if (header === null) {
      header = parseTableHeader(cells);
      separatorSeen = false;
      out.push(line);
      continue;
    }
    if (!separatorSeen) {
      if (isSeparator(cells)) {
        separatorSeen = true;
        out.push(line);
        continue;
      }
      // Header was followed by a non-separator: not a real markdown table.
      // Clear header and pass through unchanged.
      header = null;
      out.push(line);
      continue;
    }
    if (isDRow(cells)) {
      const dId = cells[header.idIdx] ?? '';
      const entry = manifest.byDid[dId];
      if (entry === undefined) {
        // The row's D-ID is not in the manifest (e.g. row is missing from
        // the inventory parse, or a typo). Leave the row alone; warnings
        // are surfaced by parse-inventory + compute-coverage.
        out.push(line);
        continue;
      }
      rowsVisited++;
      const currentCoverage = (cells[header.coverageIdx] ?? '').trim();
      const desired = entry.coverage;
      if (currentCoverage === desired) {
        out.push(line);
        continue;
      }
      out.push(rewriteCoverageCell(line, header, desired));
      rowsChanged++;
      continue;
    }
    out.push(line);
  }

  const updated = out.join('\n');
  if (updated !== text) {
    writeFileSync(inventoryPath, updated, 'utf8');
  }
  return { rowsChanged, rowsVisited };
}
