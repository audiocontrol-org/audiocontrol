/**
 * tools/scope-discovery/discovery-agents/ast-grep-matrix.ts
 *
 * Discovery Agent 2 — AST/grep matrix builder (T3.1).
 *
 * What it does: walks `modules/*\/src/` for `.ts`/`.tsx` files and
 * produces a matrix of `{ pattern, file:line }` for a curated set of
 * cross-cutting concerns:
 *
 *   - ac-class-consumer       — `className="ac-foo"` or `className={...ac-...}` consumers
 *   - as-type-cast            — `as <TypeName>` casts (banned per CLAUDE.md)
 *   - any-annotation          — `: any` type annotations (banned per CLAUDE.md)
 *   - ts-ignore-pragma        — `@ts-ignore` / `@ts-expect-error` (banned)
 *   - magic-number            — inline numeric literals not bound to const/named (heuristic)
 *
 * Engine choice: line-grep with carefully-tuned regexes. A true AST
 * walk (via `typescript`'s own compiler API or `ts-morph`) would catch
 * fewer false-positives on the `magic-number` rule and could resolve
 * `as Type` past comments, but the cost is a new dependency, ~10× the
 * wall-clock, and significantly more code. Line-grep produces usable
 * signal at low cost — the synthesis layer + operator curation
 * prunes false positives. AST-aware is a v2 enhancement; documented
 * inline here so a future maintainer sees the deliberate choice.
 *
 * CLI:
 *   tsx tools/scope-discovery/discovery-agents/ast-grep-matrix.ts \
 *     --feature <slug> --prd-path <path> [--repo-root <path>]
 */

import { join } from 'node:path';
import type {
  AstGrepMatrixFindings,
  DiscoveryAgentInput,
  PatternFinding,
  PatternHit,
} from './types.js';
import {
  MODULES_DIR,
  isDirectory,
  modulesInScopeForFeature,
  readUtf8,
  repoAbs,
  runIfMain,
  walkSourceFiles,
} from './shared.js';
import { errorMessage } from '../util/typeguards.js';

/**
 * Curated pattern catalog. Each entry has a stable `id` so the synthesis
 * layer can address patterns by identity; the `regex` source is captured
 * verbatim in the output for traceability.
 *
 * The regexes are intentionally conservative — the synthesis layer
 * deduplicates and ranks; false positives at this layer are cheaper
 * than false negatives (a missed pattern won't be surfaced; a noisy
 * pattern will be pruned by the operator).
 */
interface PatternDef {
  readonly id: string;
  readonly description: string;
  readonly regex: RegExp;
  readonly extensions?: ReadonlyArray<string>;
}

const PATTERNS: ReadonlyArray<PatternDef> = [
  {
    id: 'ac-class-consumer',
    description:
      'Consumer of an .ac-* CSS class (className string literal or template containing "ac-")',
    // Matches className="...ac-foo..." or className={`...ac-foo...`}.
    // Tolerates whitespace + escaped quotes.
    regex: /className\s*=\s*[{"`'][^"`'}\n]*\bac-[a-z][a-z0-9-]*/g,
    extensions: ['.tsx'],
  },
  {
    id: 'as-type-cast',
    description: '`as <TypeName>` cast (banned per CLAUDE.md "never bypass typing")',
    // Match `as <PascalCase>` not followed by a comparison/word char.
    // Excludes `as const` (legal narrowing) and `as unknown` (allowed bridge).
    regex: /\bas\s+(?!const\b|unknown\b)[A-Z][A-Za-z0-9_]*/g,
  },
  {
    id: 'any-annotation',
    description: '`: any` type annotation (banned per CLAUDE.md)',
    // Match `: any` followed by terminator (whitespace, `,`, `)`, `]`,
    // `;`, `=>`, `=`). Tolerates `Array<any>` etc.
    regex: /:\s*any\b(?![A-Za-z0-9_])/g,
  },
  {
    id: 'ts-ignore-pragma',
    description: '`@ts-ignore` or `@ts-expect-error` (banned per CLAUDE.md)',
    regex: /@ts-(?:ignore|expect-error)\b/g,
  },
  {
    id: 'magic-number',
    description:
      'Inline numeric literal >= 2 not bound to a const/named identifier (heuristic — synthesis layer + operator curate)',
    // Match a numeric literal that is NOT preceded by `=` (i.e., NOT a
    // binding) AND NOT inside a string/comment line obviously. We can't
    // robustly detect strings/comments without an AST, so this regex
    // surfaces candidates and the operator prunes. We exclude 0 and 1
    // (commonly indices/flags) and require >= 2 digits OR a decimal
    // point to skip the noisiest cases.
    regex: /(?<![A-Za-z0-9_.=])\d{2,}\b/g,
  },
];

const SNIPPET_MAX_LEN = 200;

function snippet(line: string): string {
  const trimmed = line.trim();
  if (trimmed.length <= SNIPPET_MAX_LEN) return trimmed;
  return `${trimmed.slice(0, SNIPPET_MAX_LEN - 3)}...`;
}

interface FileScan {
  readonly file: string;
  readonly text: string;
}

async function scanFile(args: {
  readonly repoRoot: string;
  readonly relFile: string;
}): Promise<FileScan | null> {
  try {
    const text = await readUtf8(repoAbs(args.repoRoot, args.relFile));
    return { file: args.relFile, text };
  } catch {
    return null;
  }
}

function applyPattern(args: {
  readonly pattern: PatternDef;
  readonly scans: ReadonlyArray<FileScan>;
}): PatternFinding {
  const hits: PatternHit[] = [];
  for (const scan of args.scans) {
    if (
      args.pattern.extensions !== undefined &&
      !args.pattern.extensions.some((e) => scan.file.toLowerCase().endsWith(e))
    ) {
      continue;
    }
    const lines = scan.text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (line === undefined) continue;
      const re = new RegExp(args.pattern.regex.source, args.pattern.regex.flags);
      if (re.test(line)) {
        hits.push({
          file: scan.file,
          line: i + 1,
          snippet: snippet(line),
        });
      }
    }
  }
  return {
    id: args.pattern.id,
    description: args.pattern.description,
    regex: args.pattern.regex.source,
    hits,
  };
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
export async function buildAstGrepMatrix(
  input: DiscoveryAgentInput,
): Promise<AstGrepMatrixFindings> {
  const files = await gatherInScopeFiles(input);
  const scans: FileScan[] = [];
  for (const f of files) {
    const s = await scanFile({ repoRoot: input.repoRoot, relFile: f });
    if (s !== null) scans.push(s);
  }
  const patterns: PatternFinding[] = [];
  for (const pat of PATTERNS) {
    patterns.push(applyPattern({ pattern: pat, scans }));
  }
  return {
    agent: 'ast-grep-matrix',
    featureSlug: input.featureSlug,
    patterns,
  };
}

runIfMain({
  importMetaUrl: import.meta.url,
  agentName: 'ast-grep-matrix',
  run: async (input) => {
    try {
      return await buildAstGrepMatrix(input);
    } catch (err) {
      throw new Error(`ast-grep-matrix failed: ${errorMessage(err)}`);
    }
  },
});
