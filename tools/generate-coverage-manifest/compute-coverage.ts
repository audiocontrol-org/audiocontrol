/**
 * tools/generate-coverage-manifest/compute-coverage.ts
 *
 * Folds the four evidence sources — scanned specs, test outcomes,
 * credibility records, and inventory sign-off — into a per-D-ID manifest
 * entry. Coverage rating is computed per reform spec §6:
 *
 *   - `n/a`        — inventory row's status is `removed` OR sign-off is
 *                    `n/a`.
 *   - `confident`  — Tier 2 + Tier 3 specs both present, both passing,
 *                    both credibly verified, AND a non-revoked operator
 *                    sign-off exists.
 *   - `partial`    — some evidence exists but the `confident` bar is not
 *                    met (e.g. only Tier 2; or all tiers but no sign-off).
 *   - `none`       — only Tier 1 evidence OR no evidence at all.
 *
 * The function takes plain data — it does not read from disk and does not
 * shell out — so it stays unit-testable. The main orchestrator wires the
 * IO-bearing modules into this function.
 */

import type {
  CoverageRating,
  CredibilityRecord,
  DidEntry,
  DidSpecEntry,
  DiscoveredSpec,
  InventoryRow,
  TestOutcome,
} from './types.js';

export interface ComputeOptions {
  readonly specs: ReadonlyArray<DiscoveredSpec>;
  readonly outcomes: ReadonlyArray<TestOutcome>;
  readonly credibility: ReadonlyArray<CredibilityRecord>;
  readonly inventoryRows: ReadonlyArray<InventoryRow>;
}

export interface ComputeResult {
  readonly byDid: Readonly<Record<string, DidEntry>>;
  readonly orphanSpecs: ReadonlyArray<{
    readonly path: string;
    readonly title: string;
    readonly unmatchedDIds: ReadonlyArray<string>;
  }>;
  readonly specsWithoutDIds: ReadonlyArray<string>;
}

interface SpecKey {
  readonly path: string;
  readonly title: string;
}

function outcomeKey(specRelPath: string, title: string): string {
  return `${specRelPath}::${title}`;
}

function buildOutcomeIndex(
  outcomes: ReadonlyArray<TestOutcome>,
): ReadonlyMap<string, boolean> {
  const m = new Map<string, boolean>();
  for (const o of outcomes) {
    m.set(outcomeKey(o.specRelPath, o.title), o.passing);
  }
  return m;
}

function buildCredibilityIndex(
  records: ReadonlyArray<CredibilityRecord>,
): ReadonlyMap<string, CredibilityRecord> {
  const m = new Map<string, CredibilityRecord>();
  for (const r of records) m.set(r.specPath, r);
  return m;
}

function lookupOutcome(
  index: ReadonlyMap<string, boolean>,
  key: SpecKey,
): boolean {
  // If we cannot find an outcome for the test the suite did not actually
  // run it (e.g. spec was discovered by scan-specs but Playwright filtered
  // it out via testMatch). Treat as failing so coverage doesn't silently
  // promote a non-running spec.
  return index.get(outcomeKey(key.path, key.title)) ?? false;
}

interface TierFlags {
  readonly hasTier1: boolean;
  readonly hasTier2: boolean;
  readonly hasTier3: boolean;
}

function computeTiersMet(
  specs: ReadonlyArray<DidSpecEntry>,
  signoffSigned: boolean,
): ReadonlyArray<1 | 2 | 3 | 4> {
  const flags: TierFlags = {
    hasTier1: specs.some((s) => s.tier === 1 && s.passing),
    hasTier2: specs.some((s) => s.tier === 2 && s.passing && s.credibleVerified),
    hasTier3: specs.some((s) => s.tier === 3 && s.passing && s.credibleVerified),
  };
  const tiers: (1 | 2 | 3 | 4)[] = [];
  if (flags.hasTier1) tiers.push(1);
  if (flags.hasTier2) tiers.push(2);
  if (flags.hasTier3) tiers.push(3);
  if (signoffSigned) tiers.push(4);
  return tiers;
}

function computeRating(
  row: InventoryRow,
  tiers: ReadonlyArray<1 | 2 | 3 | 4>,
): CoverageRating {
  if (row.status === 'removed') return 'n/a';
  if (row.signoff.kind === 'na') return 'n/a';
  const has2 = tiers.includes(2);
  const has3 = tiers.includes(3);
  const has4 = tiers.includes(4);
  if (has2 && has3 && has4) return 'confident';
  if (tiers.length === 0) return 'none';
  // Only Tier 1 evidence and nothing else is `none` per §6.
  if (tiers.length === 1 && tiers[0] === 1) return 'none';
  return 'partial';
}

export function computeCoverage(opts: ComputeOptions): ComputeResult {
  const outcomeIndex = buildOutcomeIndex(opts.outcomes);
  const credIndex = buildCredibilityIndex(opts.credibility);
  const inventoryIndex = new Map<string, InventoryRow>();
  for (const row of opts.inventoryRows) inventoryIndex.set(row.dId, row);

  // Bucket DidSpecEntry instances per D-ID. We construct DidSpecEntry once
  // per (spec, test, dId) triple so a test that cites multiple D-IDs counts
  // toward each.
  const byDidSpecs = new Map<string, DidSpecEntry[]>();
  const orphans: { path: string; title: string; unmatchedDIds: string[] }[] = [];
  const specsWithoutDIds: string[] = [];

  for (const spec of opts.specs) {
    const credRecord = credIndex.get(spec.relPath);
    const credibleVerified = credRecord?.credible ?? false;
    const credibleAgainst: ReadonlyArray<string> =
      credRecord?.declarations.flatMap((d) => d.variants) ?? [];
    let anyDIdInThisSpec = false;
    for (const t of spec.tests) {
      if (t.dIds.length === 0) continue;
      anyDIdInThisSpec = true;
      const passing = lookupOutcome(outcomeIndex, { path: spec.relPath, title: t.title });
      // Per reform spec §6: Tier 1 entries do not need credibility.
      // credibleVerified for Tier 1 is documented as N/A (we surface `false`
      // because the credibility runner does not exercise Tier 1, but the
      // rating logic ignores Tier 1's credibility flag.
      const entry: DidSpecEntry = {
        path: spec.relPath,
        testName: t.title,
        tier: spec.tier,
        passing,
        credibleAgainst,
        credibleVerified,
      };
      const unmatched: string[] = [];
      for (const dId of t.dIds) {
        if (!inventoryIndex.has(dId)) {
          unmatched.push(dId);
          continue;
        }
        const list = byDidSpecs.get(dId) ?? [];
        list.push(entry);
        byDidSpecs.set(dId, list);
      }
      if (unmatched.length > 0) {
        orphans.push({ path: spec.relPath, title: t.title, unmatchedDIds: unmatched });
      }
    }
    if (!anyDIdInThisSpec && spec.tests.length > 0) {
      specsWithoutDIds.push(spec.relPath);
    }
  }

  const byDid: Record<string, DidEntry> = {};
  for (const row of opts.inventoryRows) {
    const specs = byDidSpecs.get(row.dId) ?? [];
    const signoffSigned = row.signoff.kind === 'signed';
    // For Tier 1 evidence we still need a passing test (computeTiersMet's
    // s.tier===1 && s.passing).
    const tiers = computeTiersMet(specs, signoffSigned);
    const coverage = computeRating(row, tiers);
    byDid[row.dId] = {
      intent: row.affordance,
      sourceOfTruth: row.sourceOfTruth,
      origin: row.origin,
      status: row.status,
      specs,
      operatorSignoff: row.signoff,
      tiersMet: tiers,
      coverage,
    };
  }

  return { byDid, orphanSpecs: orphans, specsWithoutDIds };
}
