/**
 * tools/generate-coverage-manifest/types.ts
 *
 * Shared types for the coverage-manifest generator. Kept in its own file so
 * each focused submodule (scan-specs / run-suite / parse-inventory /
 * compute-coverage / write-manifest / update-inventory) imports a single
 * canonical shape and the main orchestrator (`generate-coverage-manifest.ts`)
 * is free of cross-cutting type declarations.
 *
 * Tier semantics per reform spec §2 + §6
 * (`docs/1.0/001-IN-PROGRESS/s550-support/testing-and-inventory-reform-spec.md`).
 */

export type Tier = 1 | 2 | 3;

/**
 * A spec file discovered by `scan-specs.ts` walking the tier directories.
 * The `tier` is derived from the spec's parent directory; the `dIds` are
 * extracted from inside the file by matching `D-<AREA>(-<SUB>)*-<NN>` against
 * every test-name string literal.
 */
export interface DiscoveredSpec {
  /** Absolute path on disk. */
  readonly absPath: string;
  /** Path relative to the repo root (used in manifest output). */
  readonly relPath: string;
  /** Module the spec belongs to (e.g. `modules/roland-sxx0-editor`). */
  readonly moduleRel: string;
  /** Tier inferred from the parent directory layout. */
  readonly tier: Tier;
  /**
   * Each entry: one Playwright `test('...')` title, plus the D-IDs the
   * regex pulled from that title. A single spec may declare multiple tests
   * and a single test may cite multiple D-IDs.
   */
  readonly tests: ReadonlyArray<DiscoveredTest>;
}

export interface DiscoveredTest {
  readonly title: string;
  readonly dIds: ReadonlyArray<string>;
}

/** Outcome of running one Playwright test, keyed by spec + test title. */
export interface TestOutcome {
  readonly specRelPath: string;
  readonly title: string;
  readonly passing: boolean;
}

/**
 * One Tier 2 / Tier 3 spec's credibility record, lifted out of
 * `coverage-manifest/credibility.json` so `compute-coverage.ts` can fold
 * Validity Claim B into each D-ID's manifest entry.
 *
 * Shape mirrors `SpecCredibility` from `tools/check-credibility.ts`. We
 * redeclare the subset we consume here (rather than import the full type)
 * because the check-credibility module's public API does not export its
 * internal record type and we want this submodule to depend on JSON-shape
 * stability, not on the other tool's internal symbols.
 */
export interface CredibilityRecord {
  readonly specPath: string;
  readonly tier: 2 | 3;
  readonly credible: boolean;
  readonly declarations: ReadonlyArray<{
    readonly slot: string;
    readonly variants: ReadonlyArray<string>;
  }>;
}

/**
 * Operator sign-off cell parsed from the inventory's `Sign-off` column. The
 * cell is operator-owned and hand-edited; format defined in reform spec §7.
 */
export type OperatorSignoff =
  | { readonly kind: 'none' }
  | { readonly kind: 'na' }
  | {
      readonly kind: 'signed';
      readonly raw: string;
      readonly signedAt: string;
      readonly signedBy: string;
      readonly sha: string;
    }
  | {
      readonly kind: 'revoked';
      readonly raw: string;
      readonly revokedAt: string;
      readonly revokedBy: string;
    }
  | {
      readonly kind: 'unparseable';
      readonly raw: string;
      readonly warning: string;
    };

/** One row from the inventory's D-tables, fully parsed. */
export interface InventoryRow {
  readonly dId: string;
  readonly affordance: string;
  readonly sourceOfTruth: string;
  readonly parent: string;
  readonly origin: string;
  readonly status: string;
  readonly test: string;
  readonly signoff: OperatorSignoff;
  readonly coverage: string;
}

/** Coverage rating per D-ID per reform spec §6. */
export type CoverageRating = 'confident' | 'partial' | 'none' | 'n/a';

/** One spec/test pair attributed to a D-ID. */
export interface DidSpecEntry {
  readonly path: string;
  readonly testName: string;
  readonly tier: Tier;
  readonly passing: boolean;
  readonly credibleAgainst: ReadonlyArray<string>;
  readonly credibleVerified: boolean;
}

/** Per-D-ID manifest entry. */
export interface DidEntry {
  readonly intent: string;
  readonly sourceOfTruth: string;
  readonly origin: string;
  readonly status: string;
  readonly specs: ReadonlyArray<DidSpecEntry>;
  readonly operatorSignoff: OperatorSignoff;
  readonly tiersMet: ReadonlyArray<1 | 2 | 3 | 4>;
  readonly coverage: CoverageRating;
}

export interface CoverageManifest {
  readonly generatedAt: string;
  readonly summary: {
    readonly total: number;
    readonly confident: number;
    readonly partial: number;
    readonly none: number;
    readonly naCount: number;
  };
  readonly byDid: Readonly<Record<string, DidEntry>>;
  /** Specs that contained D-IDs the inventory doesn't list. */
  readonly orphanSpecs: ReadonlyArray<{
    readonly path: string;
    readonly title: string;
    readonly unmatchedDIds: ReadonlyArray<string>;
  }>;
  /** Specs that had no parseable D-ID in any test title. */
  readonly specsWithoutDIds: ReadonlyArray<string>;
  /** Warnings collected from the inventory parser (un-parseable Sign-off, etc). */
  readonly warnings: ReadonlyArray<string>;
}
