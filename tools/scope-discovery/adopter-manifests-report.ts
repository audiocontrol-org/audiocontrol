/**
 * tools/scope-discovery/adopter-manifests-report.ts
 *
 * Reporting helpers for `check-adopters.ts` (workplan T6.2). Split into
 * a sibling module so the scanner stays under the 300-line cap.
 *
 * Two output modes:
 *   - reportText: human-readable; per-manifest header (expected /
 *     exception / actual / holdout counts) followed by one block per
 *     holdout naming the file + the suggested replacement message;
 *     respects `--quiet`. When the registry is empty / no holdouts,
 *     returns a one-line acknowledgement so a dev running
 *     `make check-adopters` always sees a non-empty stdout line.
 *   - reportJson: structured stable-shape JSON for downstream tooling.
 */

import type { AdopterManifestEntry } from './adopter-manifests-registry.js';

/** Per-manifest scan outcome. */
export interface ManifestResult {
  readonly entry: AdopterManifestEntry;
  /** Repo-relative POSIX paths matched by the entry's globs. */
  readonly expectedFiles: readonly string[];
  /** Subset of `expectedFiles` that import the canonical `from`. */
  readonly actualAdopters: readonly string[];
  /** Subset of `expectedFiles` that match a declared exception. */
  readonly exemptedFiles: readonly string[];
  /** Files that match the glob but do NOT import `from` and are not exempted. */
  readonly holdouts: readonly string[];
}

export interface ScanResult {
  readonly manifests: readonly ManifestResult[];
  readonly entriesScanned: number;
  /** Total unique files visited during the scan (sum across all manifests, de-duplicated). */
  readonly filesVisited: number;
}

export interface ReportOptions {
  readonly quiet: boolean;
}

export function reportText(result: ScanResult, opts: ReportOptions): string {
  if (result.entriesScanned === 0) {
    return opts.quiet ? '' : 'adopter-manifests: registry empty; nothing to scan.\n';
  }
  const totalHoldouts = result.manifests.reduce((n, m) => n + m.holdouts.length, 0);
  if (totalHoldouts === 0) {
    return opts.quiet
      ? ''
      : `adopter-manifests: ${result.entriesScanned} entries scanned across ${result.filesVisited} files; 0 holdouts.\n`;
  }
  if (opts.quiet) {
    return `adopter-manifests: ${totalHoldouts} holdout(s).\n`;
  }
  const lines: string[] = [];
  for (const manifest of result.manifests) {
    const head =
      `manifest=${manifest.entry.id} primitive=${manifest.entry.from} ` +
      `(introduced in ${manifest.entry.introducedIn})`;
    lines.push(head);
    lines.push(
      `  expected adopters: ${manifest.expectedFiles.length} file(s) match glob(s)`,
    );
    lines.push(`  exceptions: ${manifest.exemptedFiles.length} file(s) excluded`);
    lines.push(`  actual adopters: ${manifest.actualAdopters.length} file(s) import ${manifest.entry.from}`);
    lines.push(`  holdouts: ${manifest.holdouts.length} file(s)`);
    if (manifest.holdouts.length === 0) {
      lines.push('');
      continue;
    }
    for (const path of manifest.holdouts) {
      lines.push(`    ${path} — no import matches ${manifest.entry.from}`);
    }
    lines.push('  suggested replacement:');
    const indented = manifest.entry.message
      .trim()
      .split('\n')
      .map((l) => `    ${l}`)
      .join('\n');
    lines.push(indented);
    lines.push('');
  }
  lines.push(
    `adopter-manifests: ${totalHoldouts} holdout(s) across ${result.entriesScanned} manifest(s).`,
  );
  return lines.join('\n') + '\n';
}

export function reportJson(result: ScanResult): string {
  const payload = {
    files_visited: result.filesVisited,
    entries_scanned: result.entriesScanned,
    manifests: result.manifests.map((m) => ({
      id: m.entry.id,
      from: m.entry.from,
      introduced_in: m.entry.introducedIn,
      expected_files: m.expectedFiles,
      actual_adopters: m.actualAdopters,
      exempted_files: m.exemptedFiles,
      holdouts: m.holdouts,
      message: m.entry.message,
    })),
  };
  return JSON.stringify(payload, null, 2) + '\n';
}
