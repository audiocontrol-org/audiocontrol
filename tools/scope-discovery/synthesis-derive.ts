/**
 * tools/scope-discovery/synthesis-derive.ts — per-section derivation
 * helpers for the T3.2 synthesis pass.
 *
 * Each helper consumes a slice of the discriminated-union finding set
 * and emits a typed strawman-shape fragment that synthesize() assembles
 * into the final manifest. No `as Type`, no `any`, no fallbacks.
 */

import { readFile } from 'node:fs/promises';
import { dirname, posix } from 'node:path';
import type {
  AstGrepMatrixFindings,
  CloneDetectorFindings,
  PrdThemedFindings,
  RegimeHoldoutFinding,
  RegimeHoldoutFindings,
  RegimeHoldoutSource,
  UiRouteFindings,
} from './discovery-agents/types.js';
import type {
  ManifestModule,
  ManifestModulePattern,
  ManifestReferenceDoc,
  ManifestRegimeHoldoutEntry,
  ManifestRegimeHoldouts,
  ManifestRoute,
  ManifestScenario,
} from './synthesis-types.js';
import { errorMessage } from './util/typeguards.js';

const DEFAULT_SCENARIO_ID = 'default';
const MAX_THEMES = 10;
/**
 * Single source of truth for the `modules/<slug>/...` shape used by
 * both file-path inputs (e.g., `modules/foo/src/x.ts`) and glob inputs
 * (e.g., `modules/foo/src/**\/*.{ts,tsx}`). The slug charset matches
 * the schema's slug pattern; the trailing `/` separates the slug from
 * whatever follows (a sub-path or glob continuation).
 */
const MODULE_SLUG_REGEX = /^modules\/([a-z0-9][a-z0-9-]*)\//;

/**
 * Extract the `<slug>` from a `modules/<slug>/...` path OR glob.
 * Accepts either a repo-relative file path (`modules/foo/src/x.ts`) or
 * a glob expression that starts with the same prefix
 * (`modules/foo/src/**\/*.{ts,tsx}`). Returns null when the input
 * does not begin with `modules/<slug>/`.
 */
function extractModuleSlug(pathOrGlob: string): string | null {
  const m = pathOrGlob.match(MODULE_SLUG_REGEX);
  return m === null ? null : (m[1] ?? null);
}

/** Schema requires `^/.*$` — prepend `/` for relative React-Router paths. */
function absolutizeRoutePath(rawPath: string): string {
  if (rawPath.length === 0) return '/';
  if (rawPath.startsWith('/')) return rawPath;
  return `/${rawPath}`;
}

/**
 * Derive `routes[]` from UI findings. Dedup by absolute path; sort
 * alphabetically. Devices/scenarios are populated with strawman
 * defaults — the operator's curation step fills the real matrix.
 */
export function deriveRoutes(
  uiFindings: ReadonlyArray<UiRouteFindings>,
  defaultScenarioId: string,
): ReadonlyArray<ManifestRoute> {
  const byPath = new Map<string, ManifestRoute>();
  for (const finding of uiFindings) {
    for (const r of finding.routes) {
      const path = absolutizeRoutePath(r.path);
      if (byPath.has(path)) continue;
      byPath.set(path, {
        path,
        // Strawman defaults: operator curates the device matrix. 'none'
        // is the schema-blessed device-agnostic marker.
        devices: ['none'],
        scenarios: [defaultScenarioId],
      });
    }
  }
  return Array.from(byPath.values()).sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
  );
}

interface ModuleAccumulator {
  readonly slug: string;
  patternsById: Map<string, ManifestModulePattern>;
  fileCount: number;
}

function ensureModuleEntry(
  bySlug: Map<string, ModuleAccumulator>,
  slug: string,
): ModuleAccumulator {
  const existing = bySlug.get(slug);
  if (existing !== undefined) return existing;
  const created: ModuleAccumulator = { slug, patternsById: new Map(), fileCount: 0 };
  bySlug.set(slug, created);
  return created;
}

/**
 * Derive `modules[]` from AST + clone findings. Groups by source-module
 * slug (extracted from `modules/<slug>/...` file paths). Each module
 * accumulates ast-grep patterns + any clone group whose members include
 * a file under that module.
 */
export function deriveModules(args: {
  readonly astFindings: ReadonlyArray<AstGrepMatrixFindings>;
  readonly cloneFindings: ReadonlyArray<CloneDetectorFindings>;
}): ReadonlyArray<ManifestModule> {
  const bySlug = new Map<string, ModuleAccumulator>();

  for (const ast of args.astFindings) {
    for (const pattern of ast.patterns) {
      const modulesTouchedByPattern = new Set<string>();
      for (const hit of pattern.hits) {
        const slug = extractModuleSlug(hit.file);
        if (slug === null) continue;
        modulesTouchedByPattern.add(slug);
      }
      for (const slug of modulesTouchedByPattern) {
        const acc = ensureModuleEntry(bySlug, slug);
        acc.fileCount += pattern.hits.filter(
          (h) => extractModuleSlug(h.file) === slug,
        ).length;
        if (!acc.patternsById.has(pattern.id)) {
          acc.patternsById.set(pattern.id, {
            id: pattern.id,
            kind: 'grep',
            description: pattern.description,
            query: pattern.regex,
          });
        }
      }
    }
  }

  for (const clones of args.cloneFindings) {
    for (const group of clones.clones) {
      const slugs = new Set<string>();
      for (const member of group.members) {
        const colon = member.indexOf(':');
        const path = colon === -1 ? member : member.slice(0, colon);
        const slug = extractModuleSlug(path);
        if (slug !== null) slugs.add(slug);
      }
      for (const slug of slugs) {
        const acc = ensureModuleEntry(bySlug, slug);
        const patternId = `clone-group-${group.id}`;
        if (!acc.patternsById.has(patternId)) {
          acc.patternsById.set(patternId, {
            id: patternId,
            kind: 'clone-group',
            description: `jscpd clone group ${group.id} (${group.lines} lines, disposition: ${group.disposition})`,
            query: `jscpd-group:${group.id}`,
          });
        }
      }
    }
  }

  const modules: ManifestModule[] = [];
  for (const acc of bySlug.values()) {
    modules.push({
      glob: `modules/${acc.slug}/src/**/*.{ts,tsx}`,
      label: acc.slug,
      patterns: Array.from(acc.patternsById.values()).sort((a, b) =>
        a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
      ),
    });
  }
  // Sort by member-count desc, then alphabetically (clone-only modules tie at 0).
  modules.sort((a, b) => {
    const aCount = bySlug.get(extractModuleSlug(a.glob) ?? '')?.fileCount ?? 0;
    const bCount = bySlug.get(extractModuleSlug(b.glob) ?? '')?.fileCount ?? 0;
    if (aCount !== bCount) return bCount - aCount;
    return a.glob < b.glob ? -1 : a.glob > b.glob ? 1 : 0;
  });
  return modules;
}

/** v1: single placeholder scenario (schema requires minItems:1); operator curates. */
export function deriveScenarios(): ReadonlyArray<ManifestScenario> {
  return [
    {
      id: DEFAULT_SCENARIO_ID,
      label: 'Default state',
      description: 'Strawman scenario; operator curates the real scenario matrix.',
    },
  ];
}

export function defaultScenarioId(): string {
  return DEFAULT_SCENARIO_ID;
}

/** Derive themes from PrdThemedFindings. Rank by occurrence count desc; cap at MAX_THEMES. */
export function deriveThemes(
  themedFindings: ReadonlyArray<PrdThemedFindings>,
): ReadonlyArray<string> {
  const byTerm = new Map<string, number>();
  for (const finding of themedFindings) {
    for (const theme of finding.themes) {
      const current = byTerm.get(theme.term) ?? 0;
      byTerm.set(theme.term, current + theme.occurrences.length);
    }
  }
  const ranked = Array.from(byTerm.entries()).sort((a, b) => {
    if (a[1] !== b[1]) return b[1] - a[1];
    return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
  });
  return ranked
    .slice(0, MAX_THEMES)
    .map(([term, count]) => `${term} (${count} occurrence${count === 1 ? '' : 's'})`);
}

const REFS_HEADING_RE = /^#+\s*(References|Appendix(?:\s+—\s+Source Documents)?)\b/im;
const MARKDOWN_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

/**
 * Derive `reference_docs[]` from PRD References/Appendix; defaults to
 * PRD + LAYOUT.md (logged to stderr) when no section found.
 */
export async function deriveReferenceDocs(args: {
  readonly prdPath: string;
  readonly prdRelPath: string;
}): Promise<ReadonlyArray<ManifestReferenceDoc>> {
  let prdText: string;
  try {
    prdText = await readFile(args.prdPath, 'utf8');
  } catch (err) {
    throw new Error(`cannot read PRD ${args.prdPath}: ${errorMessage(err)}`);
  }
  const refs = extractAppendixLinks(prdText, args.prdRelPath);
  if (refs.length > 0) {
    return [
      { path: args.prdRelPath, role: 'prd', summary: 'Feature PRD — synthesis anchor.' },
      ...refs,
    ];
  }
  process.stderr.write(
    'synthesis: PRD has no References/Appendix section; using PRD + LAYOUT.md defaults.\n',
  );
  return [
    { path: args.prdRelPath, role: 'prd', summary: 'Feature PRD — synthesis anchor.' },
    {
      path: 'docs/scope-discovery/LAYOUT.md',
      role: 'other',
      summary: 'On-disk layout contract for scope-discovery artifacts.',
    },
  ];
}

function extractAppendixLinks(
  prdText: string,
  prdRelPath: string,
): ManifestReferenceDoc[] {
  const headingMatch = prdText.match(REFS_HEADING_RE);
  if (headingMatch === null || headingMatch.index === undefined) return [];
  const afterHeading = prdText.slice(headingMatch.index + headingMatch[0].length);
  const nextHeadingMatch = afterHeading.match(/\n#+\s/);
  const section =
    nextHeadingMatch === null || nextHeadingMatch.index === undefined
      ? afterHeading
      : afterHeading.slice(0, nextHeadingMatch.index);
  const prdDir = dirname(prdRelPath);
  const refs: ManifestReferenceDoc[] = [];
  const linkRe = new RegExp(MARKDOWN_LINK_RE.source, MARKDOWN_LINK_RE.flags);
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(section)) !== null) {
    const label = m[1];
    const href = m[2];
    if (label === undefined || href === undefined) continue;
    if (/^https?:\/\//.test(href)) continue; // external links — skip for v1
    const resolved = resolveLinkPath(prdDir, href);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    refs.push({ path: resolved, role: 'other', summary: label.replace(/^`|`$/g, '') });
  }
  return refs;
}

/** Resolve `href` (relative to the PRD file) into a repo-rooted POSIX path. */
function resolveLinkPath(prdDir: string, href: string): string {
  if (href.startsWith('/')) return href.replace(/^\/+/, '');
  return posix.normalize(posix.join(prdDir, href));
}

/**
 * Derive the manifest's `regime_holdouts:` section from one or more
 * `regime-holdout-detector` agent outputs. The detector emits all
 * findings in a single bucket discriminated by `source`; the manifest
 * fans them out into four per-source arrays so an operator reading
 * the YAML can scan one section at a time.
 *
 * Returns null when no detector findings are supplied — the synthesis
 * pass omits the top-level `regime_holdouts:` key entirely in that
 * case (the schema marks the field optional). Returning an empty-but-
 * populated section would be a fallback shape the project's "no
 * fallbacks" rule forbids; null lets the caller decide.
 */
export function deriveRegimeHoldouts(
  detectorFindings: ReadonlyArray<RegimeHoldoutFindings>,
): ManifestRegimeHoldouts | null {
  if (detectorFindings.length === 0) return null;
  const buckets: Record<RegimeHoldoutSource, ManifestRegimeHoldoutEntry[]> = {
    'anti-pattern': [],
    'adopter-manifest': [],
    'editor-symmetry': [],
    deprecation: [],
  };
  for (const finding of detectorFindings) {
    for (const entry of finding.findings) {
      buckets[entry.source].push(toManifestEntry(entry));
    }
  }
  // Stable per-bucket ordering — already stable from the detector,
  // but re-sort after fan-out so consumers can rely on the manifest
  // shape directly even if multiple detector findings are merged.
  for (const list of Object.values(buckets)) {
    list.sort(compareEntries);
  }
  const total =
    buckets['anti-pattern'].length +
    buckets['adopter-manifest'].length +
    buckets['editor-symmetry'].length +
    buckets.deprecation.length;
  return {
    anti_patterns: buckets['anti-pattern'],
    adopter_manifests: buckets['adopter-manifest'],
    editor_symmetry: buckets['editor-symmetry'],
    deprecations: buckets.deprecation,
    meta: {
      total,
      by_source: {
        anti_pattern: buckets['anti-pattern'].length,
        adopter_manifest: buckets['adopter-manifest'].length,
        editor_symmetry: buckets['editor-symmetry'].length,
        deprecation: buckets.deprecation.length,
      },
    },
  };
}

function toManifestEntry(f: RegimeHoldoutFinding): ManifestRegimeHoldoutEntry {
  return {
    id: f.id,
    file: f.file,
    ...(f.line !== undefined ? { line: f.line } : {}),
    shape: f.shape,
    replacement: f.replacement,
    evidence: {
      registry_path: f.evidence.registryPath,
      registry_id: f.evidence.registryId,
    },
  };
}

function compareEntries(
  a: ManifestRegimeHoldoutEntry,
  b: ManifestRegimeHoldoutEntry,
): number {
  if (a.file !== b.file) return a.file < b.file ? -1 : 1;
  const aLine = a.line ?? 0;
  const bLine = b.line ?? 0;
  if (aLine !== bLine) return aLine - bLine;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

