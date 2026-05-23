/**
 * tools/scope-discovery/editor-symmetry-report.ts
 *
 * Markdown-table renderer for the T6.3 cross-editor symmetry matrix.
 * The CLI calls this twice: once for stdout (operator scanning) and
 * once for the committed artifact at
 * `docs/scope-discovery/editor-symmetry.md` when `--write` is passed.
 *
 * Output shape (one row per manifest entry, one column per editor):
 *
 *   | Convention | <editor-a> | <editor-b> |
 *   |---|---|---|
 *   | <id> (<from>) | ✓ 4/4 | ⚠ 2/3 (1 holdout) |
 *
 * Cell formatting per status:
 *   - ok      → "✓ N/N"
 *   - partial → "⚠ A/E (H holdout(s))"
 *   - missing → "✗ A/E"  (with "no matching files" when E === 0)
 *   - na      → "—"
 *
 * Empty matrix (no manifest entries) emits a "no manifests" placeholder
 * paragraph so the committed artifact at `editor-symmetry.md` never
 * becomes blank.
 */

import type {
  CellStatus,
  MatrixCell,
  MatrixRow,
  SymmetryMatrix,
} from './editor-symmetry-matrix.js';

/** Default destination path for the committed artifact (relative to repo root). */
export const ARTIFACT_PATH = 'docs/scope-discovery/editor-symmetry.md';

/** Map a status to its glyph. The renderer is the only place these live. */
export const STATUS_GLYPH: Record<CellStatus, string> = {
  ok: '✓',
  partial: '⚠',
  missing: '✗',
  na: '—',
};

export function renderMatrix(matrix: SymmetryMatrix): string {
  const lines: string[] = [];
  lines.push('# Cross-editor symmetry matrix');
  lines.push('');
  lines.push(intro());
  lines.push('');
  if (matrix.rows.length === 0) {
    lines.push(
      'No adopter-manifest entries are registered yet; the matrix is empty.',
    );
    lines.push('');
    lines.push(
      'Each refactor commit that PROMOTES a primitive to a shared location ' +
        'SHOULD append an entry to `docs/scope-discovery/adopter-manifests.yaml`. ' +
        '`make check-editor-symmetry-write` rewrites this file from the registry.',
    );
    lines.push('');
    return lines.join('\n') + '\n';
  }
  lines.push(renderTable(matrix));
  lines.push('');
  const suggestions = renderSuggestions(matrix);
  if (suggestions.length > 0) {
    lines.push('## Actionable holdouts');
    lines.push('');
    for (const block of suggestions) lines.push(block);
  }
  return lines.join('\n') + '\n';
}

function intro(): string {
  return (
    'Rows are adoption conventions declared in ' +
    '`docs/scope-discovery/adopter-manifests.yaml`; columns are editor ' +
    'modules under `modules/*-editor/`. Cells show adoption status: ' +
    '`✓ N/N` = all files in the editor matching the manifest glob import ' +
    'the canonical path; `⚠ A/E (H holdout(s))` = partial adoption with ' +
    '`H` files holding out; `✗` = the editor was targeted by the glob ' +
    'but has zero matched files or zero adopters; `—` = the manifest ' +
    'does not target this editor (n/a).'
  );
}

function renderTable(matrix: SymmetryMatrix): string {
  const headers = ['Convention', ...matrix.editors];
  const sep = headers.map(() => '---');
  const lines: string[] = [];
  lines.push(`| ${headers.join(' | ')} |`);
  lines.push(`| ${sep.join(' | ')} |`);
  for (const row of matrix.rows) {
    lines.push(`| ${renderRow(row).join(' | ')} |`);
  }
  return lines.join('\n');
}

function renderRow(row: MatrixRow): string[] {
  const label = `${row.entry.id} (\`${row.entry.from}\`)`;
  return [label, ...row.cells.map(renderCell)];
}

function renderCell(cell: MatrixCell): string {
  switch (cell.status) {
    case 'ok':
      return `${STATUS_GLYPH.ok} ${cell.actual + cell.exempted}/${cell.expected}`;
    case 'partial':
      return (
        `${STATUS_GLYPH.partial} ${cell.actual + cell.exempted}/${cell.expected} ` +
        `(${cell.holdouts} holdout${cell.holdouts === 1 ? '' : 's'})`
      );
    case 'missing':
      if (cell.expected === 0) {
        return `${STATUS_GLYPH.missing} no matching files`;
      }
      return `${STATUS_GLYPH.missing} ${cell.actual + cell.exempted}/${cell.expected}`;
    case 'na':
      return STATUS_GLYPH.na;
  }
}

/**
 * Per-manifest actionable suggestion blocks. One block per manifest row
 * with at least one ⚠ or ✗ cell. Format mirrors the human-readable
 * holdout output from T6.2's adopter-manifests report so operators see
 * a consistent shape across `check-adopters` and `check-editor-symmetry`.
 */
function renderSuggestions(matrix: SymmetryMatrix): readonly string[] {
  const blocks: string[] = [];
  for (const row of matrix.rows) {
    const missing = row.cells
      .map((cell, idx) => ({ cell, editor: matrix.editors[idx] }))
      .filter(({ cell }) => cell.status === 'missing' || cell.status === 'partial');
    if (missing.length === 0) continue;
    const lines: string[] = [];
    lines.push(`### ${row.entry.id} — \`${row.entry.from}\``);
    lines.push('');
    for (const { cell, editor } of missing) {
      const glyph = STATUS_GLYPH[cell.status];
      if (cell.status === 'missing' && cell.expected === 0) {
        lines.push(
          `- ${glyph} **${editor}**: glob targets the editor but no matching files exist. ` +
            `Either the editor hasn't built the relevant surface yet, or the manifest ` +
            `glob is mis-authored.`,
        );
      } else {
        lines.push(
          `- ${glyph} **${editor}**: ${cell.actual + cell.exempted}/${cell.expected} adopters ` +
            `(${cell.holdouts} holdout${cell.holdouts === 1 ? '' : 's'}). ` +
            `Run \`make check-adopters\` for the per-file list.`,
        );
      }
    }
    lines.push('');
    lines.push('Suggested replacement:');
    lines.push('');
    lines.push('```');
    lines.push(row.entry.message.trim());
    lines.push('```');
    lines.push('');
    blocks.push(lines.join('\n'));
  }
  return blocks;
}

/**
 * Count cells across the matrix by status. Used by the CLI's summary
 * line + the validator's structural assertions.
 */
export function tallyStatuses(matrix: SymmetryMatrix): Record<CellStatus, number> {
  const totals: Record<CellStatus, number> = { ok: 0, partial: 0, missing: 0, na: 0 };
  for (const row of matrix.rows) {
    for (const cell of row.cells) {
      totals[cell.status] += 1;
    }
  }
  return totals;
}
