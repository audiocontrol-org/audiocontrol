/**
 * tools/generate-coverage-manifest/write-manifest.ts
 *
 * Serializes the computed coverage state to disk:
 *   - `coverage-manifest/coverage-manifest.json` — machine-readable.
 *   - `coverage-manifest/coverage-manifest.md`   — human-readable rollup,
 *     grouped by coverage rating, with each D-ID + intent + missing tiers.
 *
 * The MD file is intentionally not a faithful render of every JSON field
 * — it is a navigation aid the operator uses to spot which capabilities
 * are short which tier. The JSON is canonical.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import type { CoverageManifest, CoverageRating, DidEntry } from './types.js';

function ratingLabel(r: CoverageRating): string {
  switch (r) {
    case 'confident':
      return 'Confident';
    case 'partial':
      return 'Partial';
    case 'none':
      return 'None';
    case 'n/a':
      return 'N/A';
  }
}

function missingTierSummary(entry: DidEntry): string {
  if (entry.coverage === 'n/a') return 'n/a (removed or n/a sign-off)';
  if (entry.coverage === 'confident') return 'all tiers present';
  const missing: string[] = [];
  if (!entry.tiersMet.includes(2)) missing.push('Tier 2 (primitive contract)');
  if (!entry.tiersMet.includes(3)) missing.push('Tier 3 (in-context)');
  if (!entry.tiersMet.includes(4)) missing.push('Tier 4 (operator sign-off)');
  if (missing.length === 0) {
    // All tiers met but rating wasn't `confident` — defensive fallthrough.
    return 'all tiers met (defensive)';
  }
  return `missing: ${missing.join(', ')}`;
}

function renderSection(
  rating: CoverageRating,
  entries: ReadonlyArray<readonly [string, DidEntry]>,
): string {
  const lines: string[] = [];
  lines.push(`## ${ratingLabel(rating)} (${String(entries.length)})`);
  lines.push('');
  if (entries.length === 0) {
    lines.push('_(none)_');
    lines.push('');
    return lines.join('\n');
  }
  lines.push('| D-ID | Intent | Status | Tiers met | Notes |');
  lines.push('|---|---|---|---|---|');
  for (const [dId, entry] of entries) {
    const intent = entry.intent.replace(/\|/g, '\\|');
    const tiers = entry.tiersMet.length === 0 ? '—' : entry.tiersMet.join(', ');
    const notes = missingTierSummary(entry);
    lines.push(`| ${dId} | ${intent} | ${entry.status} | ${tiers} | ${notes} |`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderMarkdown(manifest: CoverageManifest): string {
  const lines: string[] = [];
  lines.push('# Coverage manifest');
  lines.push('');
  lines.push(`Generated: ${manifest.generatedAt}`);
  lines.push('');
  lines.push('Per reform spec §6 — machine-generated; do not hand-edit.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Total inventory rows: ${String(manifest.summary.total)}`);
  lines.push(`- Confident: ${String(manifest.summary.confident)}`);
  lines.push(`- Partial: ${String(manifest.summary.partial)}`);
  lines.push(`- None: ${String(manifest.summary.none)}`);
  lines.push(`- N/A: ${String(manifest.summary.naCount)}`);
  lines.push('');

  // Section ordering: surface gaps first (none → partial), then confident,
  // then n/a. This is how the operator should triage the manifest.
  const order: ReadonlyArray<CoverageRating> = ['none', 'partial', 'confident', 'n/a'];
  // Object.entries on a Record<string, DidEntry> yields `[string, DidEntry][]`
  // — the only widening we want is to `ReadonlyArray<...>`, which is implicit
  // when assigned to the typed variable below. No type assertion needed.
  const entriesAll: ReadonlyArray<readonly [string, DidEntry]> = Object.entries(manifest.byDid);
  for (const rating of order) {
    const matching = entriesAll
      .filter(([, e]) => e.coverage === rating)
      .sort(([a], [b]) => a.localeCompare(b));
    lines.push(renderSection(rating, matching));
  }

  if (manifest.warnings.length > 0) {
    lines.push('## Warnings');
    lines.push('');
    for (const w of manifest.warnings) lines.push(`- ${w}`);
    lines.push('');
  }

  if (manifest.orphanSpecs.length > 0) {
    lines.push('## Orphan specs (D-IDs in tests not present in the inventory)');
    lines.push('');
    for (const o of manifest.orphanSpecs) {
      lines.push(`- ${o.path} :: \`${o.title}\` → ${o.unmatchedDIds.join(', ')}`);
    }
    lines.push('');
  }

  if (manifest.specsWithoutDIds.length > 0) {
    lines.push('## Specs without a parseable D-ID in any test title');
    lines.push('');
    for (const p of manifest.specsWithoutDIds) lines.push(`- ${p}`);
    lines.push('');
  }
  return lines.join('\n');
}

export interface WriteOptions {
  readonly jsonPath: string;
  readonly mdPath: string;
}

export function writeManifest(manifest: CoverageManifest, opts: WriteOptions): void {
  mkdirSync(dirname(opts.jsonPath), { recursive: true });
  writeFileSync(opts.jsonPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  writeFileSync(opts.mdPath, renderMarkdown(manifest) + '\n', 'utf8');
}
