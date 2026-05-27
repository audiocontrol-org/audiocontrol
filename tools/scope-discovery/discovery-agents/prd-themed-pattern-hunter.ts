/**
 * tools/scope-discovery/discovery-agents/prd-themed-pattern-hunter.ts
 *
 * Discovery Agent 4 — PRD-themed targeted-pattern hunter (T3.1).
 *
 * What it does:
 *   1. Read the feature's `prd.md`.
 *   2. Extract theme keywords from the Goals + Acceptance Criteria +
 *      "Modules Affected" / "Technical Approach" sections (naive
 *      whitespace-split + stopword drop + frequency-rank).
 *   3. For each top-ranked theme term, grep across `modules/*\/src/`
 *      for occurrences and report file:line hits.
 *   4. Emit structured PrdThemedFindings JSON.
 *
 * Engine choice: naive keyword extraction (whitespace + stopword + min-
 * frequency threshold). Smarter NLP (TF-IDF, embeddings) is a v2
 * enhancement; the v1 produces usable signal for PRDs that ARE
 * domain-specific (the s550-support PRD has clearly-distinguished
 * domain terms — "patches", "tones", "library", "VFD", "envelope").
 *
 * For PRDs that read more like meta-documents (the scope-discovery-
 * protocol PRD itself is one example — its domain terms are "scope",
 * "discovery", "manifest", which match across the entire repo), the
 * agent still emits findings but the synthesis layer + operator
 * curation prunes false positives.
 *
 * CLI:
 *   tsx tools/scope-discovery/discovery-agents/prd-themed-pattern-hunter.ts \
 *     --feature <slug> --prd-path <path> [--repo-root <path>]
 */

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  DiscoveryAgentInput,
  PrdModuleRelevanceEntry,
  PrdThemedFindings,
  ThemeFinding,
  ThemeOccurrence,
} from './types.js';
import {
  MODULES_DIR,
  type SourceFileView,
  isDirectory,
  modulesInScopeForFeature,
  readPrd,
  readSourceFile,
  repoAbs,
  runIfMain,
  walkSourceFiles,
} from './shared.js';
import { parseModuleRelevance } from './prd-relevance.js';
import { errorMessage } from '../util/typeguards.js';

/** Tunables for keyword extraction. */
const MIN_TERM_LEN = 4;
const MIN_TERM_FREQ = 3;        // term must appear >= N times in the PRD
const MAX_THEMES = 12;          // surface only top-N to keep output sane
const MAX_OCCURRENCES_PER_TERM = 50;
const SNIPPET_MAX_LEN = 200;

/**
 * Stopwords scrubbed during PRD tokenization. Conservative list —
 * domain-specific terms (e.g., "tone", "patch") stay; only generic
 * English plus reasonably-common PRD vocabulary is removed.
 *
 * Sorted alphabetically so future additions land in a diff-friendly
 * spot; the `Set` constructor handles any accidental duplicates but the
 * source list itself is kept unique.
 */
const STOPWORDS: ReadonlySet<string> = new Set([
  'about', 'above', 'across', 'after', 'again', 'against', 'agent',
  'agents', 'also', 'among', 'and', 'around', 'because', 'been',
  'before', 'being', 'below', 'best', 'between', 'block', 'blocks',
  'case', 'cases', 'change', 'changes', 'code', 'codebase', 'could',
  'data', 'docs', 'document', 'documentation', 'each', 'either',
  'every', 'false', 'feature', 'file', 'files', 'first', 'for', 'from',
  'good', 'group', 'groups', 'have', 'input', 'inside', 'into', 'item',
  'items', 'just', 'kind', 'kinds', 'last', 'less', 'line', 'lines',
  'list', 'lists', 'made', 'make', 'makes', 'meta', 'more', 'most',
  'much', 'must', 'name', 'names', 'neither', 'next', 'note', 'notes',
  'only', 'open', 'operator', 'output', 'over', 'page', 'pages', 'path',
  'paths', 'pattern', 'patterns', 'phase', 'real', 'repo', 'same',
  'session', 'sessions', 'shape', 'shapes', 'should', 'some', 'such',
  'task', 'than', 'that', 'the', 'their', 'them', 'then', 'these',
  'they', 'this', 'those', 'through', 'time', 'times', 'tool', 'tools',
  'true', 'type', 'types', 'under', 'until', 'use', 'used', 'using',
  'value', 'values', 'very', 'were', 'what', 'when', 'where', 'whether',
  'which', 'while', 'will', 'with', 'within', 'without', 'work',
  'would',
]);

export interface TermRank {
  readonly term: string;
  readonly freq: number;
}

/**
 * Match an `https?://...` URL (and bare `<host>.com/...` style hosts) so
 * the tokenizer can strip them BEFORE splitting on non-word. Without
 * this, the components of a URL (e.g., `github`, `com`, `https`,
 * `example`) leak into the theme bag-of-words and pollute the top-N
 * ranking — a PRD with a handful of `github.com` reference links can
 * promote `github` over the actual domain terms.
 *
 * Strips:
 *   - http:// or https:// URLs up to next whitespace
 *   - Bare hosts like `github.com/...` or `example.org/...`
 * Replaces matched span with a single space so word boundaries are
 * preserved across the stripped region.
 */
const URL_RE = /\bhttps?:\/\/\S+/gi;
const BARE_HOST_RE = /\b[A-Za-z0-9-]+\.(com|org|net|io|dev|md|sh|gov|edu)(?:\/\S*)?/gi;

/**
 * Tokenize PRD text into bag-of-words counts. Lowercases, splits on
 * non-word, drops stopwords + numeric-only tokens + sub-MIN_TERM_LEN
 * tokens. URL components and bare hostnames are stripped upstream of
 * the tokenizer so they never enter the bag (T7.5 polish item).
 */
export function tokenizePrd(text: string): ReadonlyArray<TermRank> {
  const counts = new Map<string, number>();
  // Strip code-fence blocks so we don't seed themes from embedded
  // shell-snippets or yaml fragments.
  const noFences = text.replace(/```[\s\S]*?```/g, ' ');
  // Strip URL/host components (see URL_RE / BARE_HOST_RE for rationale).
  const stripped = noFences.replace(URL_RE, ' ').replace(BARE_HOST_RE, ' ');
  for (const rawTok of stripped.split(/[^A-Za-z0-9-]+/g)) {
    const tok = rawTok.toLowerCase();
    if (tok.length < MIN_TERM_LEN) continue;
    if (STOPWORDS.has(tok)) continue;
    if (/^\d+$/.test(tok)) continue;
    counts.set(tok, (counts.get(tok) ?? 0) + 1);
  }
  const ranked: TermRank[] = [];
  for (const [term, freq] of counts) {
    if (freq < MIN_TERM_FREQ) continue;
    ranked.push({ term, freq });
  }
  ranked.sort((a, b) => {
    if (a.freq !== b.freq) return b.freq - a.freq;
    return a.term < b.term ? -1 : a.term > b.term ? 1 : 0;
  });
  return ranked.slice(0, MAX_THEMES);
}

function snippet(line: string): string {
  const trimmed = line.trim();
  if (trimmed.length <= SNIPPET_MAX_LEN) return trimmed;
  return `${trimmed.slice(0, SNIPPET_MAX_LEN - 3)}...`;
}

/**
 * Escape a term for use as a literal regex source. We use the `\b`
 * word-boundary check so "tone" doesn't match "stone"; the term is
 * lowercased so we can search case-insensitive without an extra flag.
 */
function termRegex(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i');
}

function gatherOccurrences(args: {
  readonly term: string;
  readonly scans: ReadonlyArray<SourceFileView>;
}): ReadonlyArray<ThemeOccurrence> {
  const re = termRegex(args.term);
  const out: ThemeOccurrence[] = [];
  for (const scan of args.scans) {
    for (let i = 0; i < scan.lines.length; i += 1) {
      const line = scan.lines[i];
      if (line === undefined) continue;
      if (re.test(line)) {
        out.push({ file: scan.file, line: i + 1, snippet: snippet(line) });
        if (out.length >= MAX_OCCURRENCES_PER_TERM) return out;
      }
    }
  }
  return out;
}

async function gatherInScopeFiles(
  input: DiscoveryAgentInput,
): Promise<ReadonlyArray<string>> {
  const modulesInScope = await modulesInScopeForFeature(input);
  const collected: string[] = [];
  for (const module of modulesInScope) {
    const modSrc = repoAbs(input.repoRoot, join(MODULES_DIR, module, 'src'));
    if (!(await isDirectory(modSrc))) continue;
    const files = await walkSourceFiles({
      rootAbs: modSrc,
      repoRoot: input.repoRoot,
    });
    for (const f of files) collected.push(f);
  }
  return collected.sort();
}

/**
 * Enumerate the workspace's actual module names (the `modules/<name>/`
 * directories at the repo root). Passed to `parseModuleRelevance` so
 * bare module-name mentions in the PRD's scope sections (e.g.,
 * "d110-editor" without the `modules/` prefix) resolve correctly.
 *
 * Returns an empty array when the `modules/` directory is missing —
 * the relevance parser then degrades to `modules/<name>` path-only
 * detection (still useful for PRDs that always use the path form).
 */
async function listWorkspaceModules(
  repoRoot: string,
): Promise<ReadonlyArray<string>> {
  const modulesAbs = repoAbs(repoRoot, MODULES_DIR);
  if (!(await isDirectory(modulesAbs))) return [];
  const entries = await readdir(modulesAbs, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();
}

/**
 * Compute the per-module relevance entries from the PRD's scope
 * sections (AUDIT-20260524-11). Returns undefined when the PRD has
 * neither "In Scope" nor "Out of Scope" sections so the synthesis
 * layer's no-signal path (default-medium for every module) kicks in.
 */
async function computeModuleRelevance(
  prdText: string,
  repoRoot: string,
): Promise<ReadonlyArray<PrdModuleRelevanceEntry> | undefined> {
  const workspaceModules = await listWorkspaceModules(repoRoot);
  const parsed = parseModuleRelevance(prdText, workspaceModules);
  if (parsed.scores.size === 0) return undefined;
  const entries: PrdModuleRelevanceEntry[] = [];
  for (const [module, relevance] of parsed.scores) {
    entries.push({
      module,
      relevance,
      section: parsed.sections.get(module) ?? '',
    });
  }
  entries.sort((a, b) =>
    a.module < b.module ? -1 : a.module > b.module ? 1 : 0,
  );
  return entries;
}

/**
 * Public agent entrypoint. Imported by the synthesis layer + `/scope-
 * inventory` skill.
 */
export async function huntPrdThemes(
  input: DiscoveryAgentInput,
): Promise<PrdThemedFindings> {
  const prdText = await readPrd(input);
  const ranked = tokenizePrd(prdText);
  const files = await gatherInScopeFiles(input);
  const scans: SourceFileView[] = [];
  for (const f of files) {
    scans.push(await readSourceFile({ repoRoot: input.repoRoot, relFile: f }));
  }
  const themes: ThemeFinding[] = [];
  for (const rank of ranked) {
    const occurrences = gatherOccurrences({ term: rank.term, scans });
    themes.push({ term: rank.term, occurrences });
  }
  const moduleRelevance = await computeModuleRelevance(prdText, input.repoRoot);
  return {
    agent: 'prd-themed-pattern-hunter',
    featureSlug: input.featureSlug,
    themes,
    ...(moduleRelevance !== undefined ? { moduleRelevance } : {}),
  };
}

runIfMain({
  importMetaUrl: import.meta.url,
  agentName: 'prd-themed-pattern-hunter',
  run: async (input) => {
    try {
      return await huntPrdThemes(input);
    } catch (err) {
      throw new Error(`prd-themed-pattern-hunter failed: ${errorMessage(err)}`);
    }
  },
});
