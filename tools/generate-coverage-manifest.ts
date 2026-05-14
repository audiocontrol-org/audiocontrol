#!/usr/bin/env tsx
/**
 * tools/generate-coverage-manifest.ts
 *
 * Generates `coverage-manifest/coverage-manifest.{json,md}` and updates the
 * `Coverage` column in `ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md`. The
 * `Sign-off` column is operator-owned per reform spec §7 and is read-only
 * to this tool.
 *
 * Pipeline:
 *   1. Discover Tier 1/2/3 specs (`scan-specs.ts`).
 *   2. Run the suite to record per-test pass/fail (`run-suite.ts`).
 *   3. Read Tier 2/3 credibility records from `coverage-manifest/credibility.json`.
 *      The companion `tools/check-credibility.ts` writes that file; this
 *      tool reads it. They are deliberately separate so credibility runs
 *      can be cached and re-used across multiple manifest regenerations.
 *      If the file is missing, this tool exits with a hint.
 *   4. Parse `Sign-off` cells from the inventory (`parse-inventory.ts`).
 *   5. Fold (specs ∧ outcomes ∧ credibility ∧ inventory) → per-D-ID rating
 *      (`compute-coverage.ts`).
 *   6. Write the manifest (`write-manifest.ts`).
 *   7. Update the inventory's Coverage column in place
 *      (`update-inventory.ts`).
 *
 * Per reform spec §6 + workplan §9R-A.1 T7. Exits 0 on success; the gate
 * decision (any `implemented` row at `none`) is owned by the downstream
 * `check-coverage` script (workplan §9R-A.1 T8).
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// `.js` extension is required by NodeNext module resolution; tsx resolves
// the .ts source at runtime.
import { computeCoverage } from './generate-coverage-manifest/compute-coverage.js';
import { parseInventory } from './generate-coverage-manifest/parse-inventory.js';
import { MODULE_DIRS, scanSpecs } from './generate-coverage-manifest/scan-specs.js';
import { runSuite } from './generate-coverage-manifest/run-suite.js';
import type {
  CoverageManifest,
  CredibilityRecord,
} from './generate-coverage-manifest/types.js';
import { updateInventoryCoverageColumn } from './generate-coverage-manifest/update-inventory.js';
import { writeManifest } from './generate-coverage-manifest/write-manifest.js';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const MANIFEST_DIR = join(REPO_ROOT, 'coverage-manifest');
const CREDIBILITY_PATH = join(MANIFEST_DIR, 'credibility.json');
const MANIFEST_JSON_PATH = join(MANIFEST_DIR, 'coverage-manifest.json');
const MANIFEST_MD_PATH = join(MANIFEST_DIR, 'coverage-manifest.md');
const INVENTORY_PATH = join(REPO_ROOT, 'ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md');

// The credibility manifest is considered fresh when its mtime is no older
// than this many milliseconds. Older runs trigger a warning but are still
// consumed; the operator can re-run check-credibility explicitly when the
// underlying specs change. The reform spec leaves freshness mechanics to
// later phases — we surface, we don't gate.
const CREDIBILITY_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

interface CredibilityFileShape {
  readonly generatedAt?: string;
  readonly results?: ReadonlyArray<{
    readonly specPath?: string;
    readonly tier?: number;
    readonly credible?: boolean;
    readonly declarations?: ReadonlyArray<{
      readonly slot?: string;
      readonly variants?: ReadonlyArray<string>;
    }>;
  }>;
}

function loadCredibility(): {
  records: ReadonlyArray<CredibilityRecord>;
  warnings: ReadonlyArray<string>;
} {
  if (!existsSync(CREDIBILITY_PATH)) {
    throw new Error(
      `Missing ${relative(REPO_ROOT, CREDIBILITY_PATH)}. Run ` +
        `\`pnpm run check-credibility\` first to produce it. The coverage ` +
        `manifest folds in Tier 2/3 credibility evidence and cannot run ` +
        `without it.`,
    );
  }
  const text = readFileSync(CREDIBILITY_PATH, 'utf8');
  const parsed: CredibilityFileShape = JSON.parse(text);
  const warnings: string[] = [];
  const st = statSync(CREDIBILITY_PATH);
  const age = Date.now() - st.mtimeMs;
  if (age > CREDIBILITY_STALE_AFTER_MS) {
    const days = (age / (24 * 60 * 60 * 1000)).toFixed(1);
    warnings.push(
      `credibility.json is ${days} days old (generated ${parsed.generatedAt ?? 'unknown'}). ` +
        `Re-run pnpm run check-credibility for fresh evidence.`,
    );
  }
  const records: CredibilityRecord[] = [];
  for (const r of parsed.results ?? []) {
    if (r.specPath === undefined) continue;
    if (r.tier !== 2 && r.tier !== 3) continue;
    if (typeof r.credible !== 'boolean') continue;
    const declarations = (r.declarations ?? [])
      .filter((d) => d.slot !== undefined && d.variants !== undefined)
      .map((d) => ({
        slot: d.slot ?? '',
        variants: (d.variants ?? []).filter((v) => typeof v === 'string'),
      }));
    records.push({
      specPath: r.specPath,
      tier: r.tier === 2 ? 2 : 3,
      credible: r.credible,
      declarations,
    });
  }
  return { records, warnings };
}

async function main(): Promise<void> {
  // ─── Step 1: scan tier directories for specs + D-IDs ─────────────────────
  process.stderr.write('[generate-coverage-manifest] Step 1: scanning tier directories…\n');
  const { specs } = scanSpecs(REPO_ROOT);
  process.stderr.write(
    `[generate-coverage-manifest]   discovered ${String(specs.length)} spec file(s).\n`,
  );

  // ─── Step 2: run the suite to record per-test pass/fail ──────────────────
  process.stderr.write('[generate-coverage-manifest] Step 2: running Playwright suite…\n');
  // Only run modules that have at least one spec, to avoid spinning up Vite
  // for an empty module.
  const moduleDirs = MODULE_DIRS.filter((m) =>
    specs.some((s) => s.moduleRel === m),
  );
  const { outcomes } = await runSuite({ repoRoot: REPO_ROOT, moduleDirs });
  process.stderr.write(
    `[generate-coverage-manifest]   recorded ${String(outcomes.length)} test outcome(s).\n`,
  );

  // ─── Step 3: load credibility records ────────────────────────────────────
  process.stderr.write('[generate-coverage-manifest] Step 3: loading credibility records…\n');
  const credibility = loadCredibility();
  process.stderr.write(
    `[generate-coverage-manifest]   loaded ${String(credibility.records.length)} credibility record(s).\n`,
  );

  // ─── Step 4: parse the inventory's Sign-off + table rows ─────────────────
  process.stderr.write('[generate-coverage-manifest] Step 4: parsing inventory rows…\n');
  const inventory = parseInventory(INVENTORY_PATH);
  process.stderr.write(
    `[generate-coverage-manifest]   parsed ${String(inventory.rows.length)} inventory row(s).\n`,
  );

  // ─── Step 5: compute per-D-ID coverage ───────────────────────────────────
  process.stderr.write('[generate-coverage-manifest] Step 5: computing per-D-ID coverage…\n');
  const compute = computeCoverage({
    specs,
    outcomes,
    credibility: credibility.records,
    inventoryRows: inventory.rows,
  });

  // ─── Step 6: assemble + write manifest ───────────────────────────────────
  process.stderr.write('[generate-coverage-manifest] Step 6: writing manifest…\n');
  let countConfident = 0;
  let countPartial = 0;
  let countNone = 0;
  let countNa = 0;
  for (const entry of Object.values(compute.byDid)) {
    switch (entry.coverage) {
      case 'confident':
        countConfident++;
        break;
      case 'partial':
        countPartial++;
        break;
      case 'none':
        countNone++;
        break;
      case 'n/a':
        countNa++;
        break;
    }
  }
  const manifest: CoverageManifest = {
    generatedAt: new Date().toISOString(),
    summary: {
      total: inventory.rows.length,
      confident: countConfident,
      partial: countPartial,
      none: countNone,
      naCount: countNa,
    },
    byDid: compute.byDid,
    orphanSpecs: compute.orphanSpecs,
    specsWithoutDIds: compute.specsWithoutDIds,
    warnings: [...inventory.warnings, ...credibility.warnings],
  };
  mkdirSync(MANIFEST_DIR, { recursive: true });
  writeManifest(manifest, { jsonPath: MANIFEST_JSON_PATH, mdPath: MANIFEST_MD_PATH });
  process.stderr.write(
    `[generate-coverage-manifest]   wrote ${relative(REPO_ROOT, MANIFEST_JSON_PATH)}\n`,
  );
  process.stderr.write(
    `[generate-coverage-manifest]   wrote ${relative(REPO_ROOT, MANIFEST_MD_PATH)}\n`,
  );

  // ─── Step 7: update the inventory's Coverage column ──────────────────────
  process.stderr.write(
    '[generate-coverage-manifest] Step 7: updating inventory Coverage column…\n',
  );
  const update = updateInventoryCoverageColumn(INVENTORY_PATH, manifest);
  process.stderr.write(
    `[generate-coverage-manifest]   visited ${String(update.rowsVisited)} row(s); ` +
      `changed ${String(update.rowsChanged)} Coverage cell(s).\n`,
  );

  // ─── Summary ─────────────────────────────────────────────────────────────
  process.stderr.write('\n[generate-coverage-manifest] Summary:\n');
  process.stderr.write(`  Total D-IDs:    ${String(manifest.summary.total)}\n`);
  process.stderr.write(`  confident:      ${String(manifest.summary.confident)}\n`);
  process.stderr.write(`  partial:        ${String(manifest.summary.partial)}\n`);
  process.stderr.write(`  none:           ${String(manifest.summary.none)}\n`);
  process.stderr.write(`  n/a:            ${String(manifest.summary.naCount)}\n`);
  if (manifest.warnings.length > 0) {
    process.stderr.write(`  warnings:       ${String(manifest.warnings.length)}\n`);
  }
  if (compute.orphanSpecs.length > 0) {
    process.stderr.write(`  orphan specs:   ${String(compute.orphanSpecs.length)}\n`);
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  process.stderr.write(`[generate-coverage-manifest] fatal: ${msg}\n`);
  process.exit(1);
});
