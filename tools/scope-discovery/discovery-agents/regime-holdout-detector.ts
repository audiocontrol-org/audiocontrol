/**
 * tools/scope-discovery/discovery-agents/regime-holdout-detector.ts
 *
 * Discovery Agent 5 — Regime-holdout detector (T6.5).
 *
 * Fuses the four Phase 6 gates (T6.1 anti-patterns, T6.2 adopter
 * manifests, T6.3 editor-symmetry, T6.4 deprecation queue) into a
 * single structured `RegimeHoldoutFindings` JSON object that the
 * synthesis pass (T3.2) merges into `scope-manifest.yaml` under the
 * new top-level `regime_holdouts:` section.
 *
 * What it does:
 *   1. Load the anti-pattern registry and the adopter-manifest
 *      registry. Scan the source tree for each.
 *   2. Compute the editor-symmetry matrix from the same adopter-
 *      manifest registry, surfacing per-(manifest × editor) cells
 *      flagged 'partial' or 'missing' (the operator's regime-drift
 *      attention queue).
 *   3. Run the T6.4 deprecation scan; emit one finding per importer
 *      of each `@deprecated` file (i.e., per `blocked` row's
 *      importer entry — these are the lines that block deletion).
 *   4. Emit structured findings with per-finding evidence back-pointers
 *      to the registry / scan output that caught each entry.
 *
 * DRY (per .claude/CLAUDE.md): re-uses the in-process scan APIs of
 * `check-anti-patterns.ts`, `check-adopters.ts`, `editor-symmetry-
 * matrix.ts`, and `deprecation-scan.ts` directly — no subprocess
 * round-trip, no shape duplication. The shared agent CLI wrapper
 * (`shared.ts`'s `runIfMain` + `runAgentCli`) handles argv parsing
 * and JSON serialization the same way the other four agents do.
 *
 * Engine choice: importing the four scan modules in-process lets the
 * agent run all four gates against the same on-disk snapshot in a
 * single tsx invocation; piping through subprocesses would add 4×
 * the startup cost and break the synthesis pass's "all agents are
 * importable" assumption (synthesis.ts loads agents via dynamic
 * import, not spawn).
 *
 * CLI:
 *   tsx tools/scope-discovery/discovery-agents/regime-holdout-detector.ts \
 *     --feature <slug> --prd-path <path> [--repo-root <path>]
 */

import { resolve } from 'node:path';
import { scan as scanAntiPatterns } from '../check-anti-patterns.js';
import { scan as scanAdopters } from '../check-adopters.js';
import { computeMatrix } from '../editor-symmetry-matrix.js';
import { scan as scanDeprecations } from '../deprecation-scan.js';
import type {
  DiscoveryAgentInput,
  RegimeHoldoutFinding,
  RegimeHoldoutFindings,
  RegimeHoldoutMeta,
} from './types.js';
import { runIfMain } from './shared.js';
import { errorMessage } from '../util/typeguards.js';

/** Default registry + scan-root paths — match the upstream gates' defaults. */
const ANTI_PATTERNS_REGISTRY = 'docs/scope-discovery/anti-patterns.yaml';
const ADOPTER_MANIFESTS_REGISTRY = 'docs/scope-discovery/adopter-manifests.yaml';

/**
 * The anti-pattern scanner's default `--root` is `modules`; the adopter
 * + deprecation scanners' default `--root` is the repo root (`.`). We
 * pass each its own canonical default so the in-process scan paths
 * match what `make check-*` invocations produce.
 */
const ANTI_PATTERNS_DEFAULT_ROOT = 'modules';

/**
 * Run the anti-pattern gate and convert each finding into a regime-
 * holdout entry. Anti-pattern findings carry an absolute `file` path
 * because the scanner accepts an absolute scan-root; we relativize
 * back to the repo root so downstream consumers see the same shape as
 * the other sources.
 */
async function collectAntiPatternFindings(
  repoRoot: string,
): Promise<readonly RegimeHoldoutFinding[]> {
  const result = await scanAntiPatterns({
    registryPath: resolve(repoRoot, ANTI_PATTERNS_REGISTRY),
    scanRoot: resolve(repoRoot, ANTI_PATTERNS_DEFAULT_ROOT),
    quiet: true,
    json: true,
  });
  const out: RegimeHoldoutFinding[] = [];
  for (const f of result.findings) {
    out.push({
      source: 'anti-pattern',
      id: f.entry.id,
      file: toRepoRel(f.file, repoRoot),
      line: f.line,
      shape: `matches anti-pattern '${f.entry.id}' (primitive: ${f.entry.primitive})`,
      replacement: `import ${f.entry.primitive} from ${f.entry.from} — ${oneLine(f.entry.message)}`,
      evidence: {
        registryPath: ANTI_PATTERNS_REGISTRY,
        registryId: f.entry.id,
      },
    });
  }
  return out;
}

/**
 * Run the adopter-manifest gate and convert each holdout file into a
 * whole-file regime-holdout entry (no line number — the holdout is
 * "this file matches the glob but does not import the canonical
 * primitive," not a specific line within the file).
 */
async function collectAdopterManifestFindings(
  repoRoot: string,
): Promise<readonly RegimeHoldoutFinding[]> {
  const result = await scanAdopters({
    registryPath: resolve(repoRoot, ADOPTER_MANIFESTS_REGISTRY),
    scanRoot: repoRoot,
    quiet: true,
    json: true,
  });
  const out: RegimeHoldoutFinding[] = [];
  for (const manifest of result.manifests) {
    for (const holdout of manifest.holdouts) {
      out.push({
        source: 'adopter-manifest',
        id: manifest.entry.id,
        file: holdout,
        // `entry.from` is a non-empty array (AUDIT-08). Use the
        // primary canonical path (index 0) in finding-narrative
        // text; alias paths are transitional and don't add signal
        // here.
        shape: `expected adopter of '${manifest.entry.from[0]}' (manifest '${manifest.entry.id}') — no canonical import found`,
        replacement: `import from '${manifest.entry.from[0]}' — ${oneLine(manifest.entry.message)}`,
        evidence: {
          registryPath: ADOPTER_MANIFESTS_REGISTRY,
          registryId: manifest.entry.id,
        },
      });
    }
  }
  return out;
}

/**
 * Run the editor-symmetry matrix builder and surface per-(manifest ×
 * editor) cells in 'partial' or 'missing' state. Each cell becomes a
 * finding whose `id` is `<manifest-id>:<editor>` (composite). The
 * cell does not name an offending file directly — the holdout IS the
 * editor's failure to participate — so `file` is the editor's module
 * directory and `line` is undefined.
 */
async function collectEditorSymmetryFindings(
  repoRoot: string,
): Promise<readonly RegimeHoldoutFinding[]> {
  const matrix = await computeMatrix({
    registryPath: resolve(repoRoot, ADOPTER_MANIFESTS_REGISTRY),
    scanRoot: repoRoot,
  });
  const out: RegimeHoldoutFinding[] = [];
  for (const row of matrix.rows) {
    matrix.editors.forEach((editor, idx) => {
      const cell = row.cells[idx];
      if (cell === undefined) return;
      if (cell.status !== 'partial' && cell.status !== 'missing') return;
      const composite = `${row.entry.id}:${editor}`;
      const shape =
        cell.status === 'missing'
          ? `editor '${editor}' targeted by manifest '${row.entry.id}' but has no adopters (expected ${cell.expected}, actual ${cell.actual}, holdouts ${cell.holdouts})`
          : `editor '${editor}' partially adopts manifest '${row.entry.id}' (expected ${cell.expected}, actual ${cell.actual}, holdouts ${cell.holdouts})`;
      out.push({
        source: 'editor-symmetry',
        id: composite,
        file: `modules/${editor}/`,
        shape,
        // `row.entry.from` is a non-empty array (AUDIT-08); use the
        // primary canonical path for the replacement narrative.
        replacement: `import '${row.entry.from[0]}' across the editor's adopter set — ${oneLine(row.entry.message)}`,
        evidence: {
          registryPath: ADOPTER_MANIFESTS_REGISTRY,
          registryId: row.entry.id,
        },
      });
    });
  }
  return out;
}

/**
 * Run the deprecation scan and emit one finding per importer of each
 * `@deprecated` file (i.e., per row in the `blocked` queue × each of
 * that row's importer entries). The importer's path + 1-based line
 * is what's surfaced; the `id` is the deprecated file (the holdout is
 * keyed by "what's holding this dead file alive").
 *
 * The deprecation scanner does not consult a YAML registry — the
 * markers live inline in the source files themselves. We point
 * `evidence.registryPath` at the deprecated file (the marker IS the
 * registry entry) so the operator can resolve evidence with one hop.
 */
async function collectDeprecationFindings(
  repoRoot: string,
): Promise<readonly RegimeHoldoutFinding[]> {
  const result = await scanDeprecations({ scanRoot: repoRoot });
  const out: RegimeHoldoutFinding[] = [];
  for (const dep of result.blocked) {
    for (const importer of dep.importers) {
      out.push({
        source: 'deprecation',
        id: dep.path,
        file: importer.path,
        line: importer.line,
        shape: `imports deprecated file '${dep.path}' (marker: ${dep.markerKind})`,
        replacement:
          dep.message.length > 0
            ? `migrate per the file's @deprecated note — ${oneLine(dep.message)}`
            : `migrate off '${dep.path}'; the marker carries no inline message — consult the file's header`,
        evidence: {
          registryPath: dep.path,
          registryId: dep.markerKind === 'jsdoc' ? '@deprecated' : '// DEPRECATED:',
        },
      });
    }
  }
  return out;
}

/** Compress a multi-line registry/marker message into a single line for the manifest. */
function oneLine(message: string): string {
  return message.replace(/\s+/g, ' ').trim();
}

/**
 * Anti-pattern scanner's `file` is absolute (it accepts an absolute
 * `--root`). The other scanners already emit repo-relative POSIX paths.
 * Normalize to repo-relative POSIX so the merged shape is uniform.
 */
function toRepoRel(absOrRel: string, repoRoot: string): string {
  if (!absOrRel.startsWith('/')) return absOrRel;
  const root = resolve(repoRoot);
  if (absOrRel === root) return '';
  if (absOrRel.startsWith(root + '/')) return absOrRel.substring(root.length + 1);
  return absOrRel;
}

function deriveMeta(findings: readonly RegimeHoldoutFinding[]): RegimeHoldoutMeta {
  let antiPattern = 0;
  let adopter = 0;
  let symmetry = 0;
  let deprecation = 0;
  for (const f of findings) {
    switch (f.source) {
      case 'anti-pattern':
        antiPattern += 1;
        break;
      case 'adopter-manifest':
        adopter += 1;
        break;
      case 'editor-symmetry':
        symmetry += 1;
        break;
      case 'deprecation':
        deprecation += 1;
        break;
    }
  }
  return {
    anti_pattern_count: antiPattern,
    adopter_manifest_count: adopter,
    editor_symmetry_holdout_count: symmetry,
    deprecation_count: deprecation,
    total: findings.length,
  };
}

/**
 * Public agent entrypoint. Imported by the synthesis layer + `/scope-
 * inventory` skill; invoked via the CLI wrapper at the bottom of this
 * file for standalone smoke-testing.
 */
export async function detectRegimeHoldouts(
  input: DiscoveryAgentInput,
): Promise<RegimeHoldoutFindings> {
  const repoRoot = input.repoRoot;
  // Run the four gates in parallel — they read disjoint files and
  // share no in-process state. Per gate, individual scan failures
  // propagate (no silent fallback): a misshapen registry should fail
  // loudly so the operator fixes it rather than getting a partial
  // regime picture.
  const [
    antiPattern,
    adopter,
    symmetry,
    deprecation,
  ] = await Promise.all([
    collectAntiPatternFindings(repoRoot),
    collectAdopterManifestFindings(repoRoot),
    collectEditorSymmetryFindings(repoRoot),
    collectDeprecationFindings(repoRoot),
  ]);
  const findings: RegimeHoldoutFinding[] = [
    ...antiPattern,
    ...adopter,
    ...symmetry,
    ...deprecation,
  ];
  // Stable ordering for deterministic JSON output across runs.
  findings.sort((a, b) => {
    if (a.source !== b.source) return a.source < b.source ? -1 : 1;
    if (a.file !== b.file) return a.file < b.file ? -1 : 1;
    const aLine = a.line ?? 0;
    const bLine = b.line ?? 0;
    return aLine - bLine;
  });
  return {
    agent: 'regime-holdout-detector',
    featureSlug: input.featureSlug,
    findings,
    meta: deriveMeta(findings),
  };
}

runIfMain({
  importMetaUrl: import.meta.url,
  agentName: 'regime-holdout-detector',
  run: async (input) => {
    try {
      return await detectRegimeHoldouts(input);
    } catch (err) {
      throw new Error(`regime-holdout-detector failed: ${errorMessage(err)}`);
    }
  },
});
