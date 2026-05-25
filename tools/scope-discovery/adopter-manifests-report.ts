/**
 * tools/scope-discovery/adopter-manifests-report.ts
 *
 * Reporting helpers for `check-adopters.ts` (workplan T6.2). Split into
 * a sibling module so the scanner stays under the 300-line cap.
 *
 * Two output modes:
 *   - reportText: human-readable; per-manifest header (expected /
 *     exception / actual / holdout counts) followed by one block per
 *     holdout naming the file + the suggested replacement message.
 *     Tracked holdouts (AUDIT-06) appear in a separate gate-passing
 *     section so the operator can see "work-to-do" counts without the
 *     gate blocking. AUDIT-13: the summary line is ALWAYS the LAST
 *     non-empty line of output so operators can `tail -1` reliably,
 *     and always matches the regex
 *       /^adopter-manifests: \d+ holdouts? across \d+ manifest/.
 *     `--quiet` behavior (AUDIT-13): when ZERO real holdouts exist,
 *     emit only the summary line (no per-manifest details, no tracked-
 *     holdouts section); when ANY real holdouts exist, emit the full
 *     report so the operator sees what to act on.
 *   - reportJson: structured stable-shape JSON for downstream tooling.
 */

import type {
  AdopterManifestEntry,
  TrackedHoldout,
} from './adopter-manifests-registry.js';

/** Per-manifest scan outcome. */
export interface ManifestResult {
  readonly entry: AdopterManifestEntry;
  /** Repo-relative POSIX paths matched by the entry's globs. */
  readonly expectedFiles: readonly string[];
  /** Subset of `expectedFiles` that import the canonical `from`. */
  readonly actualAdopters: readonly string[];
  /** Subset of `expectedFiles` that match a declared exception. */
  readonly exemptedFiles: readonly string[];
  /**
   * Subset of `expectedFiles` that match a declared `tracked_holdouts:`
   * entry. NOT findings — the gate exits 0 when these are the only
   * non-adopters. Reported in their own report section so the operator
   * sees the work-to-do count without the gate blocking.
   */
  readonly trackedHoldoutFiles: readonly TrackedHoldout[];
  /**
   * Files that match the glob but do NOT import `from` AND are neither
   * exempted nor tracked-holdouts. These ARE findings; the gate exits
   * 1 if any are present.
   */
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
    // Empty-registry summary still matches the regex `^adopter-manifests:
    // \d+ holdouts? across \d+ manifest` so `tail -1` consumers don't
    // have to special-case this path.
    return 'adopter-manifests: 0 holdouts across 0 manifest(s).\n';
  }
  const totalHoldouts = result.manifests.reduce((n, m) => n + m.holdouts.length, 0);
  const totalTracked = result.manifests.reduce(
    (n, m) => n + m.trackedHoldoutFiles.length,
    0,
  );
  const summary = buildSummaryLine(result.entriesScanned, totalHoldouts, totalTracked);
  // AUDIT-13: `--quiet` only suppresses details when there are ZERO real
  // holdouts. If any real holdouts exist, the operator needs the full
  // report to act, so we emit details regardless of `--quiet`.
  if (opts.quiet && totalHoldouts === 0) {
    return summary + '\n';
  }
  const lines: string[] = [];
  for (const manifest of result.manifests) {
    appendManifestBlock(lines, manifest);
  }
  // AUDIT-13: summary is ALWAYS the last non-empty line of output so
  // `make check-adopters | tail -1` reliably returns the finding count.
  lines.push(summary);
  return lines.join('\n') + '\n';
}

/**
 * Single source of truth for the summary line. The shape always matches
 * the regex `/^adopter-manifests: \d+ holdouts? across \d+ manifest/`
 * (AUDIT-13) so `tail -1` consumers can parse the count without
 * special-casing the "zero" / "tracked-holdouts-present" branches. The
 * tracked-holdouts tail appears only when there is at least one.
 */
function buildSummaryLine(
  entriesScanned: number,
  totalHoldouts: number,
  totalTracked: number,
): string {
  const holdoutWord = totalHoldouts === 1 ? 'holdout' : 'holdouts';
  const manifestWord = entriesScanned === 1 ? 'manifest' : 'manifest(s)';
  const base = `adopter-manifests: ${totalHoldouts} ${holdoutWord} across ${entriesScanned} ${manifestWord}.`;
  if (totalTracked === 0) return base;
  const trackedWord = totalTracked === 1 ? 'tracked holdout' : 'tracked holdout(s)';
  return `${base} ${totalTracked} ${trackedWord} reported separately.`;
}

/**
 * Append one manifest's detail block (head + counts + tracked-holdouts
 * + per-holdout lines + suggested-replacement message) to the running
 * lines array. Kept as a single function so the per-manifest layout
 * lives in one place; both real-holdout and tracked-only branches push
 * a trailing empty line so the next manifest's block is visually
 * separated.
 */
function appendManifestBlock(lines: string[], manifest: ManifestResult): void {
  // `entry.from` is a non-empty array (AUDIT-08). The primary path
  // (index 0) is the current canonical; any additional paths are
  // transitional aliases listed in `(... | ...)` form so the operator
  // sees both when a primitive is mid-promotion.
  const fromDisplay = renderFromList(manifest.entry.from);
  lines.push(
    `manifest=${manifest.entry.id} primitive=${fromDisplay} ` +
      `(introduced in ${manifest.entry.introducedIn})`,
  );
  lines.push(
    `  expected adopters: ${manifest.expectedFiles.length} file(s) match glob(s)`,
  );
  lines.push(`  exceptions: ${manifest.exemptedFiles.length} file(s) excluded`);
  lines.push(
    `  actual adopters: ${manifest.actualAdopters.length} file(s) import ${fromDisplay}`,
  );
  lines.push(`  holdouts: ${manifest.holdouts.length} file(s)`);
  if (manifest.trackedHoldoutFiles.length > 0) {
    lines.push(
      `  tracked holdouts (gate-passing, pending follow-up): ${manifest.trackedHoldoutFiles.length} file(s)`,
    );
    for (const th of manifest.trackedHoldoutFiles) {
      const reasonFirstLine = th.reason.trim().split('\n')[0] ?? '';
      // `issue:` is optional post-AUDIT-20260525-20: when absent, the
      // entry is anchored to a substantive inline `reason:` instead.
      // Display the issue clause only when present so the report stays
      // honest about whether a navigable tracker artifact exists.
      const issueClause = th.issue !== undefined ? ` — issue: ${th.issue}` : '';
      lines.push(`    ${th.path}${issueClause} — reason: ${reasonFirstLine}`);
    }
  }
  if (manifest.holdouts.length === 0) {
    lines.push('');
    return;
  }
  for (const path of manifest.holdouts) {
    lines.push(`    ${path} — no import matches ${fromDisplay}`);
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

export function reportJson(result: ScanResult): string {
  const payload = {
    files_visited: result.filesVisited,
    entries_scanned: result.entriesScanned,
    manifests: result.manifests.map((m) => ({
      id: m.entry.id,
      // `from` is always a non-empty array post-AUDIT-08; downstream
      // JSON consumers parse the canonical primary as `from[0]` and
      // see transitional aliases at subsequent indices.
      from: m.entry.from,
      introduced_in: m.entry.introducedIn,
      expected_files: m.expectedFiles,
      actual_adopters: m.actualAdopters,
      exempted_files: m.exemptedFiles,
      holdouts: m.holdouts,
      // `issue:` is optional (AUDIT-20260525-20); only emit the JSON
      // key when present so downstream consumers can branch on
      // hasOwnProperty('issue') instead of guessing whether `null` or
      // `undefined` means "no tracker artifact exists".
      tracked_holdouts: m.trackedHoldoutFiles.map((th) => {
        const base: { path: string; reason: string; issue?: string } = {
          path: th.path,
          reason: th.reason,
        };
        if (th.issue !== undefined) base.issue = th.issue;
        return base;
      }),
      message: m.entry.message,
    })),
  };
  return JSON.stringify(payload, null, 2) + '\n';
}

/**
 * Render a `from:` list for display. Single-element arrays render as
 * the bare path (preserves existing report shape for back-compat
 * single-string entries); multi-element arrays render as
 * `<primary> (alias: <a1>, <a2>, …)` so the operator sees the
 * transitional aliases inline. The primary path (index 0) always
 * appears first.
 */
function renderFromList(from: readonly string[]): string {
  const [primary, ...aliases] = from;
  if (primary === undefined) {
    throw new Error('renderFromList: from array must be non-empty');
  }
  if (aliases.length === 0) return primary;
  return `${primary} (alias: ${aliases.join(', ')})`;
}
