/**
 * tools/generate-coverage-manifest/parse-inventory.ts
 *
 * Parses `ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md` to extract:
 *   - Each `D-<AREA>-<NN>` row from the per-area D-tables (the 8-column
 *     `| ID | Affordance | Source of truth | Parent | Origin | Status |
 *     Sign-off | Coverage |` shape). The legacy `Test` column was removed
 *     in 9R-A.3; its evidence migrated to Tier 1 wiring specs under
 *     `modules/<editor>/test/wiring/` per the reform spec.
 *   - The roll-up table at the top of the doc (4-column shape) is SKIPPED;
 *     it is a summary, not the operative inventory.
 *   - The `Sign-off` cell is parsed into a structured `OperatorSignoff`
 *     value per reform spec §7. Format:
 *       `none`            → kind: 'none'
 *       `n/a`             → kind: 'na'
 *       `<YYYY-MM-DD> <signer> <sha>` → kind: 'signed'
 *       `revoked <YYYY-MM-DD> <signer>` → kind: 'revoked'
 *       anything else → kind: 'unparseable' with a warning string
 *
 * The parser is column-name-based, not column-position-based: it reads the
 * header row to map `Sign-off` and `Coverage` to indices. This keeps the
 * generator robust against future column reorderings (per the preamble's
 * commitment).
 */

import { readFileSync } from 'node:fs';

import type { InventoryRow, OperatorSignoff } from './types.js';

interface RawRow {
  readonly cells: ReadonlyArray<string>;
  /** 1-based source line number — used in warning messages. */
  readonly lineNumber: number;
}

interface ParsedTableHeader {
  readonly columns: ReadonlyArray<string>;
  readonly index: ReadonlyMap<string, number>;
}

const SIGNED_RE = /^(\d{4}-\d{2}-\d{2})\s+(\S+)\s+(\S+)$/;
const REVOKED_RE = /^revoked\s+(\d{4}-\d{2}-\d{2})\s+(\S+)$/;

function splitRow(line: string): ReadonlyArray<string> {
  // A markdown table row looks like `| a | b | c |`. Split on `|` and drop
  // the empty pre/post-bar segments. We trim each cell so callers compare
  // against canonical text.
  const cells = line.split('|').map((c) => c.trim());
  // Drop the leading empty cell from the leading `|`. The trailing `|`
  // produces a trailing empty cell we also drop, but only if the row was
  // properly terminated; otherwise the last cell may be real content
  // without a terminator, so we trim only when empty.
  if (cells.length > 0 && cells[0] === '') cells.shift();
  if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
  return cells;
}

function isSeparatorRow(cells: ReadonlyArray<string>): boolean {
  if (cells.length === 0) return false;
  return cells.every((c) => /^[:\-\s]+$/.test(c));
}

function parseHeader(cells: ReadonlyArray<string>): ParsedTableHeader {
  const index = new Map<string, number>();
  cells.forEach((name, i) => {
    index.set(name, i);
  });
  return { columns: cells, index };
}

function parseSignoff(raw: string): OperatorSignoff {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === 'none') return { kind: 'none' };
  if (trimmed === 'n/a') return { kind: 'na' };
  const revoked = REVOKED_RE.exec(trimmed);
  if (revoked !== null) {
    const revokedAt = revoked[1];
    const revokedBy = revoked[2];
    if (revokedAt === undefined || revokedBy === undefined) {
      return {
        kind: 'unparseable',
        raw: trimmed,
        warning: `Sign-off cell matched 'revoked' pattern but capture groups were empty: ${trimmed}`,
      };
    }
    return { kind: 'revoked', raw: trimmed, revokedAt, revokedBy };
  }
  const signed = SIGNED_RE.exec(trimmed);
  if (signed !== null) {
    const signedAt = signed[1];
    const signedBy = signed[2];
    const sha = signed[3];
    if (signedAt === undefined || signedBy === undefined || sha === undefined) {
      return {
        kind: 'unparseable',
        raw: trimmed,
        warning: `Sign-off cell matched signed pattern but capture groups were empty: ${trimmed}`,
      };
    }
    return { kind: 'signed', raw: trimmed, signedAt, signedBy, sha };
  }
  return {
    kind: 'unparseable',
    raw: trimmed,
    warning:
      `Un-parseable Sign-off cell: ${trimmed}. ` +
      `Expected one of: 'none', 'n/a', '<YYYY-MM-DD> <signer> <sha>', or 'revoked <YYYY-MM-DD> <signer>'`,
  };
}

interface CellAccessor {
  readonly get: (column: string) => string | undefined;
}

function cellAccessor(header: ParsedTableHeader, row: RawRow): CellAccessor {
  return {
    get: (column: string): string | undefined => {
      const idx = header.index.get(column);
      if (idx === undefined) return undefined;
      return row.cells[idx];
    },
  };
}

/** A D-row is one whose first column starts with `D-`. */
function isDRow(cells: ReadonlyArray<string>): boolean {
  if (cells.length === 0) return false;
  const first = cells[0] ?? '';
  return /^D(?:-[A-Z]+)+-\d+$/.test(first);
}

/**
 * Iterate the file line-by-line. Each table header row is detected by the
 * `| ID |` shape; subsequent lines beginning with `|` belong to that table
 * until the first non-`|` line. Headers without an `ID` column are skipped
 * (this is what excludes the missing-affordances roll-up table at the top
 * of the doc, whose header is `| ID | Affordance | Source of truth |
 * Tracked in |`).
 *
 * IMPORTANT: the missing-affordances roll-up DOES have an `ID` column but
 * lacks the `Sign-off` + `Coverage` columns the operative tables require.
 * The required-columns check below skips it correctly.
 */
export interface InventoryParseResult {
  readonly rows: ReadonlyArray<InventoryRow>;
  readonly warnings: ReadonlyArray<string>;
}

export function parseInventory(inventoryPath: string): InventoryParseResult {
  const text = readFileSync(inventoryPath, 'utf8');
  const lines = text.split('\n');
  const rows: InventoryRow[] = [];
  const warnings: string[] = [];

  let header: ParsedTableHeader | null = null;
  let headerLineNumber = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) {
      // Outside any table.
      header = null;
      continue;
    }
    const cells = splitRow(trimmed);
    if (isSeparatorRow(cells)) continue;
    if (header === null) {
      header = parseHeader(cells);
      headerLineNumber = i + 1;
      // Require the operative-table columns. If any are missing this is a
      // roll-up / summary table and we skip until the next blank line.
      const required: ReadonlyArray<string> = [
        'ID',
        'Affordance',
        'Source of truth',
        'Parent',
        'Origin',
        'Status',
        'Sign-off',
        'Coverage',
      ];
      const missing = required.filter((c) => !header?.index.has(c));
      if (missing.length > 0) {
        // Not an operative table; clear header so subsequent rows in this
        // table are ignored. The next table's header will re-initialize.
        header = null;
      }
      continue;
    }
    if (!isDRow(cells)) {
      // A row in an operative table whose first column is not a D-ID. Could
      // be a continuation/explanation row; skip silently.
      continue;
    }
    const access = cellAccessor(header, { cells, lineNumber: i + 1 });
    const dId = access.get('ID') ?? '';
    if (dId === '') {
      warnings.push(
        `Inventory row at line ${String(i + 1)} (table header at line ${String(
          headerLineNumber,
        )}) has empty ID column; skipping.`,
      );
      continue;
    }
    const signoffRaw = access.get('Sign-off') ?? '';
    const signoff = parseSignoff(signoffRaw);
    if (signoff.kind === 'unparseable') {
      warnings.push(`${dId} @ line ${String(i + 1)}: ${signoff.warning}`);
    }
    rows.push({
      dId,
      affordance: access.get('Affordance') ?? '',
      sourceOfTruth: access.get('Source of truth') ?? '',
      parent: access.get('Parent') ?? '',
      origin: access.get('Origin') ?? '',
      status: access.get('Status') ?? '',
      signoff,
      coverage: access.get('Coverage') ?? '',
    });
  }

  return { rows, warnings };
}
