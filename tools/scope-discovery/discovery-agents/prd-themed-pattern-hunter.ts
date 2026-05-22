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

import { join } from 'node:path';
import type {
  DiscoveryAgentInput,
  PrdThemedFindings,
  ThemeFinding,
  ThemeOccurrence,
} from './types.js';
import {
  MODULES_DIR,
  isDirectory,
  modulesInScopeForFeature,
  readPrd,
  readUtf8,
  repoAbs,
  runIfMain,
  walkSourceFiles,
} from './shared.js';
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
 */
const STOPWORDS: ReadonlySet<string> = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'over',
  'each', 'have', 'will', 'when', 'what', 'they', 'them', 'were', 'been',
  'being', 'where', 'which', 'than', 'then', 'such', 'some', 'most',
  'much', 'more', 'less', 'only', 'also', 'just', 'very', 'must', 'should',
  'would', 'could', 'about', 'after', 'again', 'before', 'between',
  'their', 'these', 'those', 'because', 'while', 'until', 'across',
  'whether', 'inside', 'among', 'against', 'every', 'either', 'neither',
  'within', 'through', 'without', 'around', 'above', 'below', 'under',
  'phase', 'task', 'feature', 'work', 'tool', 'tools', 'file', 'files',
  'code', 'codebase', 'repo', 'docs', 'document', 'documentation',
  'operator', 'agent', 'agents', 'session', 'sessions', 'change',
  'changes', 'value', 'values', 'pattern', 'patterns', 'block', 'blocks',
  'group', 'groups', 'item', 'items', 'list', 'lists', 'note', 'notes',
  'name', 'names', 'path', 'paths', 'line', 'lines', 'page', 'pages',
  'meta', 'data', 'output', 'input', 'time', 'times', 'first', 'last',
  'next', 'real', 'same', 'best', 'open', 'good', 'true', 'false',
  'kind', 'kinds', 'type', 'types', 'shape', 'shapes', 'case', 'cases',
  'used', 'using', 'use', 'used', 'made', 'make', 'makes', 'made',
]);

interface TermRank {
  readonly term: string;
  readonly freq: number;
}

/**
 * Tokenize PRD text into bag-of-words counts. Lowercases, splits on
 * non-word, drops stopwords + numeric-only tokens + sub-MIN_TERM_LEN
 * tokens.
 */
function tokenizePrd(text: string): ReadonlyArray<TermRank> {
  const counts = new Map<string, number>();
  // Strip code-fence blocks so we don't seed themes from embedded
  // shell-snippets or yaml fragments.
  const stripped = text.replace(/```[\s\S]*?```/g, ' ');
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

interface FileScan {
  readonly file: string;
  readonly lines: ReadonlyArray<string>;
}

async function scanFile(args: {
  readonly repoRoot: string;
  readonly relFile: string;
}): Promise<FileScan | null> {
  try {
    const text = await readUtf8(repoAbs(args.repoRoot, args.relFile));
    return { file: args.relFile, lines: text.split(/\r?\n/) };
  } catch {
    return null;
  }
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
  readonly scans: ReadonlyArray<FileScan>;
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
 * Public agent entrypoint. Imported by the synthesis layer + `/scope-
 * inventory` skill.
 */
export async function huntPrdThemes(
  input: DiscoveryAgentInput,
): Promise<PrdThemedFindings> {
  const prdText = await readPrd(input);
  const ranked = tokenizePrd(prdText);
  const files = await gatherInScopeFiles(input);
  const scans: FileScan[] = [];
  for (const f of files) {
    const s = await scanFile({ repoRoot: input.repoRoot, relFile: f });
    if (s !== null) scans.push(s);
  }
  const themes: ThemeFinding[] = [];
  for (const rank of ranked) {
    const occurrences = gatherOccurrences({ term: rank.term, scans });
    themes.push({ term: rank.term, occurrences });
  }
  return {
    agent: 'prd-themed-pattern-hunter',
    featureSlug: input.featureSlug,
    themes,
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
