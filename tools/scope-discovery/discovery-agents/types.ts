/**
 * tools/scope-discovery/discovery-agents/types.ts
 *
 * Shared types for the discovery-agent fleet (T3.1). The fleet is a
 * group of TypeScript modules — NOT Claude Code sub-agents — that the
 * `/scope-inventory` skill (T3.3) invokes in parallel; the synthesis
 * pass (T3.2) consumes their findings.
 *
 * Each agent takes the same input contract (feature slug + PRD path +
 * repo root) and emits a discriminated-union finding shape so the
 * synthesizer can branch on `agent` without an `as Type` cast.
 *
 * No fallbacks, no mock data — agents that can't read their inputs
 * throw descriptive errors so the upstream skill surfaces real failures
 * (per the project rule against fallbacks).
 */

import { isPlainObject } from '../util/typeguards.js';

/**
 * Input contract every discovery agent honors. Paths are absolute (the
 * skill resolves them before invocation); `featureSlug` is the short
 * directory name under `docs/<version>/<status>/`.
 */
export interface DiscoveryAgentInput {
  readonly featureSlug: string;
  readonly prdPath: string;
  readonly repoRoot: string;
}

/** A single editor route discovered in a module's React Router config. */
export interface UiRoute {
  readonly module: string;        // e.g., "roland-sxx0-editor"
  readonly path: string;          // e.g., "patches" or "/akai/s3000xl/editor/programs"
  readonly file: string;          // repo-relative path to the App.tsx that declares the route
  readonly pageFile: string | null; // repo-relative path to the page TSX, if locatable
}

export interface UiRouteFindings {
  readonly agent: 'ui-route-enumerator';
  readonly featureSlug: string;
  readonly modulesInScope: ReadonlyArray<string>;
  readonly routes: ReadonlyArray<UiRoute>;
}

/** A single hit of one cross-cutting pattern across the codebase. */
export interface PatternHit {
  readonly file: string;          // repo-relative
  readonly line: number;          // 1-indexed
  readonly snippet: string;       // trimmed source line
}

export interface PatternFinding {
  readonly id: string;            // stable identifier: "ac-class-consumer", "as-type-cast", ...
  readonly description: string;
  readonly regex: string;         // the regex source string (for traceability)
  readonly hits: ReadonlyArray<PatternHit>;
}

export interface AstGrepMatrixFindings {
  readonly agent: 'ast-grep-matrix';
  readonly featureSlug: string;
  readonly patterns: ReadonlyArray<PatternFinding>;
}

/** A clone group surfaced from the dispositioned baseline. */
export interface CloneGroupFinding {
  readonly id: string;
  readonly members: ReadonlyArray<string>;  // "path:start:end"
  readonly lines: number;
  readonly disposition: string;             // pending | refactor | keep-with-reason | ignore-with-justification
}

export interface CloneDetectorFindings {
  readonly agent: 'clone-detector-reader';
  readonly featureSlug: string;
  readonly baselinePath: string;            // repo-relative
  readonly filterApplied: 'none' | 'modules-in-scope';
  readonly modulesInScope: ReadonlyArray<string>;
  readonly clones: ReadonlyArray<CloneGroupFinding>;
}

/** One PRD-derived theme keyword + its occurrences across modules/*. */
export interface ThemeOccurrence {
  readonly file: string;
  readonly line: number;
  readonly snippet: string;
}

export interface ThemeFinding {
  readonly term: string;
  readonly occurrences: ReadonlyArray<ThemeOccurrence>;
}

export interface PrdThemedFindings {
  readonly agent: 'prd-themed-pattern-hunter';
  readonly featureSlug: string;
  readonly themes: ReadonlyArray<ThemeFinding>;
}

/**
 * Source bucket a regime-holdout finding came from. Mirrors the four
 * T6.1–T6.4 gates the T6.5 detector fuses:
 *   - 'anti-pattern'     — code matches a registered legacy shape
 *     (T6.1 anti-patterns.yaml).
 *   - 'adopter-manifest' — file matches a manifest's expected-adopter
 *     glob but does NOT import the canonical primitive (T6.2
 *     adopter-manifests.yaml).
 *   - 'editor-symmetry'  — one editor in a multi-editor manifest fails
 *     to adopt while peers do (T6.3 editor-symmetry matrix).
 *   - 'deprecation'      — an importer of a `@deprecated` file is
 *     blocking the file's deletion (T6.4 deprecation queue).
 */
export type RegimeHoldoutSource =
  | 'anti-pattern'
  | 'adopter-manifest'
  | 'editor-symmetry'
  | 'deprecation';

/**
 * Back-pointer to the registry entry that caught a holdout. Lets the
 * synthesized manifest carry traceable evidence: an operator reading
 * the manifest can grep `registryPath` for `registryId` and find the
 * exact entry whose pattern matched. Empty `registryId` is allowed for
 * sources that do not key on a single registry id (e.g.,
 * editor-symmetry cells reference `<manifest-id>:<editor>`).
 */
export interface RegimeHoldoutEvidence {
  /** Repo-relative path of the registry / scan output that caught the holdout. */
  readonly registryPath: string;
  /** Stable identifier within the registry (anti-pattern id, manifest id, or composite). */
  readonly registryId: string;
}

/** One regime-holdout finding. */
export interface RegimeHoldoutFinding {
  /** Which gate caught it. */
  readonly source: RegimeHoldoutSource;
  /** Registry / manifest / file identifier (back-pointer-friendly). */
  readonly id: string;
  /** Repo-relative POSIX path of the offending file. */
  readonly file: string;
  /** 1-based source line; undefined for whole-file findings (e.g., adopter-manifest holdouts). */
  readonly line?: number;
  /** Human description of the legacy / missing / drifted shape. */
  readonly shape: string;
  /** Human description of the canonical replacement. */
  readonly replacement: string;
  /** Evidence back-pointer for operator traceability. */
  readonly evidence: RegimeHoldoutEvidence;
}

/** Per-source counts + total — surfaced verbatim by the synthesis pass. */
export interface RegimeHoldoutMeta {
  readonly anti_pattern_count: number;
  readonly adopter_manifest_count: number;
  readonly editor_symmetry_holdout_count: number;
  readonly deprecation_count: number;
  readonly total: number;
}

export interface RegimeHoldoutFindings {
  readonly agent: 'regime-holdout-detector';
  readonly featureSlug: string;
  readonly findings: ReadonlyArray<RegimeHoldoutFinding>;
  readonly meta: RegimeHoldoutMeta;
}

/**
 * Discriminated union covering every shape a discovery agent can emit.
 * Consumers branch on `finding.agent` for type-safe narrowing — no
 * `as` casts, no `any` bag of properties.
 */
export type DiscoveryAgentFinding =
  | UiRouteFindings
  | AstGrepMatrixFindings
  | CloneDetectorFindings
  | PrdThemedFindings
  | RegimeHoldoutFindings;

/** Discriminator literal — exported so consumers can switch exhaustively. */
export type DiscoveryAgentName = DiscoveryAgentFinding['agent'];

/**
 * Type-predicate variants for synthesizers / smoke-test harnesses that
 * receive `unknown` from JSON.parse. Each predicate validates the
 * structural key for its agent so downstream consumers branch with
 * proper TS narrowing rather than `as Type` casts.
 *
 * Per CLAUDE.md: "Avoid `any` — use `unknown` with type guards."
 * Predicates are the idiomatic TypeScript escape hatch for narrowing
 * untrusted JSON without runtime casts.
 */
export function isUiRouteFindings(v: unknown): v is UiRouteFindings {
  if (!isPlainObject(v)) return false;
  return v['agent'] === 'ui-route-enumerator' && Array.isArray(v['routes']);
}

export function isAstGrepMatrixFindings(
  v: unknown,
): v is AstGrepMatrixFindings {
  if (!isPlainObject(v)) return false;
  return v['agent'] === 'ast-grep-matrix' && Array.isArray(v['patterns']);
}

export function isCloneDetectorFindings(
  v: unknown,
): v is CloneDetectorFindings {
  if (!isPlainObject(v)) return false;
  return v['agent'] === 'clone-detector-reader' && Array.isArray(v['clones']);
}

export function isPrdThemedFindings(v: unknown): v is PrdThemedFindings {
  if (!isPlainObject(v)) return false;
  return v['agent'] === 'prd-themed-pattern-hunter' && Array.isArray(v['themes']);
}

export function isRegimeHoldoutFindings(
  v: unknown,
): v is RegimeHoldoutFindings {
  if (!isPlainObject(v)) return false;
  return (
    v['agent'] === 'regime-holdout-detector' &&
    Array.isArray(v['findings']) &&
    isPlainObject(v['meta'])
  );
}

/**
 * Combined predicate covering all five shapes. Returns true when the
 * value matches any agent's structural contract; the per-agent
 * predicates above narrow further.
 */
export function isDiscoveryAgentFinding(
  v: unknown,
): v is DiscoveryAgentFinding {
  return (
    isUiRouteFindings(v) ||
    isAstGrepMatrixFindings(v) ||
    isCloneDetectorFindings(v) ||
    isPrdThemedFindings(v) ||
    isRegimeHoldoutFindings(v)
  );
}
