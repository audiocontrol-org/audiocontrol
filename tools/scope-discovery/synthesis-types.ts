/**
 * tools/scope-discovery/synthesis-types.ts
 *
 * Output-side types for the synthesis pass (T3.2). Mirrors the shape
 * declared by tools/scope-discovery/schema/scope-manifest.schema.json
 * (T2.1). Lives in its own module so synthesis.ts and
 * synthesis-derive.ts share a single source of truth for the in-memory
 * manifest shape without circular imports.
 *
 * These types are STRUCTURAL counterparts to the JSON Schema; the
 * schema remains authoritative. Every synthesized manifest is run
 * through `validateManifest()` before write, so a drift between the
 * schema and these types surfaces at runtime as a schema-validation
 * failure rather than silent emission of malformed output.
 */

import type { DiscoveryAgentFinding } from './discovery-agents/types.js';

export type ManifestKind = 'ui' | 'code' | 'hybrid';

export type ReferenceDocRole =
  | 'prd'
  | 'workplan'
  | 'mockup'
  | 'design-language'
  | 'analysis-report'
  | 'rule'
  | 'other';

export interface ManifestScenario {
  readonly id: string;
  readonly label?: string;
  readonly description?: string;
  readonly query?: string;
}

export interface ManifestReferenceDoc {
  readonly path: string;
  readonly role?: ReferenceDocRole;
  readonly summary?: string;
}

export interface ManifestRoute {
  readonly path: string;
  readonly devices: ReadonlyArray<string>;
  readonly scenarios: ReadonlyArray<string>;
  readonly primitives?: ReadonlyArray<string>;
  readonly skip_reason?: string;
}

export type PatternKind =
  | 'ast-call'
  | 'ast-jsx'
  | 'type-cast'
  | 'grep'
  | 'clone-group'
  | 'import'
  | 'other';

export interface ManifestModulePattern {
  readonly id: string;
  readonly kind: PatternKind;
  readonly description?: string;
  readonly query?: string;
}

export interface ManifestModuleExclude {
  readonly glob: string;
  readonly reason: string;
}

export interface ManifestModule {
  readonly glob: string;
  readonly label?: string;
  readonly patterns: ReadonlyArray<ManifestModulePattern>;
  readonly excludes?: ReadonlyArray<ManifestModuleExclude>;
}

/**
 * Per-source regime-holdout entry shape, emitted under the manifest's
 * `regime_holdouts` section. Mirrors the discovery agent's per-finding
 * shape minus the `source` discriminator (the source is implied by
 * the bucket the entry lands in).
 */
export interface ManifestRegimeHoldoutEntry {
  readonly id: string;
  readonly file: string;
  readonly line?: number;
  readonly shape: string;
  readonly replacement: string;
  readonly evidence: {
    readonly registry_path: string;
    readonly registry_id: string;
  };
}

export interface ManifestRegimeHoldoutMeta {
  readonly total: number;
  readonly by_source: {
    readonly anti_pattern: number;
    readonly adopter_manifest: number;
    readonly editor_symmetry: number;
    readonly deprecation: number;
  };
}

/**
 * Top-level `regime_holdouts:` section. Produced by the synthesis
 * pass when a `regime-holdout-detector` agent finding is supplied;
 * absent when the agent was not run.
 */
export interface ManifestRegimeHoldouts {
  readonly anti_patterns: ReadonlyArray<ManifestRegimeHoldoutEntry>;
  readonly adopter_manifests: ReadonlyArray<ManifestRegimeHoldoutEntry>;
  readonly editor_symmetry: ReadonlyArray<ManifestRegimeHoldoutEntry>;
  readonly deprecations: ReadonlyArray<ManifestRegimeHoldoutEntry>;
  readonly meta: ManifestRegimeHoldoutMeta;
}

/**
 * In-memory manifest shape. JSON-serializable; `yaml.stringify()`
 * produces the canonical scope-manifest.yaml output. snake_case field
 * names mirror the schema verbatim so the YAML output stays readable
 * for the operator without a post-write rename pass.
 */
export interface ScopeManifest {
  readonly kind: ManifestKind;
  readonly feature_slug: string;
  readonly version?: string;
  readonly generated_by: 'strawman' | 'curated' | 'hand-authored';
  readonly generated_at: string;
  readonly scenarios: ReadonlyArray<ManifestScenario>;
  readonly reference_docs: ReadonlyArray<ManifestReferenceDoc>;
  readonly discovery_themes: ReadonlyArray<string>;
  readonly routes?: ReadonlyArray<ManifestRoute>;
  readonly modules?: ReadonlyArray<ManifestModule>;
  readonly regime_holdouts?: ManifestRegimeHoldouts;
  readonly notes?: string;
}

/** Input contract for the synthesis pass. */
export interface SynthesisInput {
  readonly featureSlug: string;
  readonly findings: ReadonlyArray<DiscoveryAgentFinding>;
  /** Repo-relative or absolute path to the PRD; used for both reading and reference_docs derivation. */
  readonly prdPath: string;
  /** Repo-relative form of prdPath for emission into reference_docs[]. */
  readonly prdRelPath: string;
}

/** Output of the synthesis pass. */
export interface SynthesisOutput {
  readonly manifest: ScopeManifest;
  readonly metadata: {
    readonly generatedAt: string;
    readonly agentsConsumed: ReadonlyArray<string>;
    readonly dedupCount: number;
    readonly findingsCount: number;
  };
}
