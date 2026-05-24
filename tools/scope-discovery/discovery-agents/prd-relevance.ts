/**
 * tools/scope-discovery/discovery-agents/prd-relevance.ts
 *
 * AUDIT-20260524-11 — PRD-scoped module pruning.
 *
 * The `/scope-inventory` flow previously emitted strawman manifests that
 * listed every workspace module any discovery agent matched, regardless
 * of whether the PRD's "In Scope" / "Out of Scope" sections named the
 * module as in or out. Result: the operator manually pruned ~50% of the
 * modules from the strawman before curating (the akai-harmonization
 * synthesis listed 12/12 workspace modules; operator dropped 6 as
 * out-of-scope).
 *
 * This helper parses the PRD's scope sections and emits a per-module
 * relevance score (`high` | `medium` | `low` | `excluded`) that the
 * synthesis pass consumes:
 *   - `excluded` → module DROPPED from manifest, exclusion noted in
 *      synthesis warnings
 *   - `low`      → included with `relevance: low` annotation
 *   - `medium`   → included unchanged (the default for modules the PRD
 *      did not address — preserves pre-AUDIT-11 behavior)
 *   - `high`     → included unchanged (named in "In Scope")
 *
 * ## Heuristic
 *
 * 1. Find sections whose heading (H2 `##` or H3 `###`, case-insensitive)
 *    matches one of:
 *      - `In Scope` / `Scope` (high-relevance bucket)
 *      - `Out of Scope` / `Non-goals` / `Non Goals` (excluded bucket)
 * 2. Read the section body until the NEXT heading at the same OR
 *    shallower depth (so an `## In Scope` section terminates at the
 *    next `## ...` heading, NOT at an `### Subsection`).
 * 3. Within each section's body, extract module references:
 *      - `modules/<name>` paths (regex)
 *      - bare module names from the workspace's actual module list
 *        (passed in as `workspaceModules`)
 * 4. Each extracted module gets the section's relevance:
 *      - "in scope" → 'high'
 *      - "out of scope" → 'excluded'
 *
 * ## Limits (documented intentionally)
 *
 * - PRDs that use prose rather than bullet lists in the scope sections
 *   may not surface module references the parser recognizes — only the
 *   `modules/<name>` literal and bare workspace-module-name shapes are
 *   detected. The synthesis layer's "no signal" behavior then falls
 *   back to operator curation (no relevance scoring; all matched
 *   modules appear at default 'medium').
 * - A module mentioned in BOTH "In Scope" and "Out of Scope" (an
 *   author mistake) resolves to 'excluded' — the more restrictive
 *   signal wins so an accidental in-scope mention does not silently
 *   override an explicit out-of-scope declaration.
 * - Surrounding context like "if a real hardware repro surfaces one"
 *   is NOT parsed; conditional inclusions still resolve to 'high'.
 *   The synthesis pass surfaces the section text alongside the
 *   relevance map so the operator can read the qualifier.
 */

/** Per-module relevance score. */
export type ModuleRelevance = 'high' | 'medium' | 'low' | 'excluded';

/**
 * Output of `parseModuleRelevance`. The map keys are workspace module
 * names (NOT paths); the synthesis layer queries this map by extracting
 * the slug from each `modules/<slug>/...` path.
 *
 * Modules NOT in the map have unstated relevance — the synthesis layer
 * treats them as 'medium' (default) so PRDs that omit scope sections
 * produce the pre-AUDIT-11 behavior verbatim.
 */
export interface PrdModuleRelevance {
  /** Module name → relevance score. */
  readonly scores: ReadonlyMap<string, ModuleRelevance>;
  /**
   * Per-module section attribution — `(module, sectionHeading)` pairs
   * the synthesis layer surfaces in warnings so the operator sees
   * which heading drove the exclusion. Indexed by module name.
   */
  readonly sections: ReadonlyMap<string, string>;
}

/** Heading kinds the parser recognizes (after lowercase normalization). */
const IN_SCOPE_HEADINGS: ReadonlySet<string> = new Set([
  'in scope',
  'scope',
]);
const OUT_OF_SCOPE_HEADINGS: ReadonlySet<string> = new Set([
  'out of scope',
  'non-goals',
  'non goals',
  'nongoals',
]);

/**
 * Match a markdown heading line and capture the depth (# count) and the
 * heading text. Matches H2..H4 — H1 is the document title (irrelevant
 * for scope sections); H5+ is too deep for a real scope section.
 */
const HEADING_RE = /^(#{2,4})\s+(.+?)\s*$/;

/** Match an embedded `modules/<name>` reference (path or codeblock). */
const MODULE_PATH_RE = /modules\/([a-z0-9][a-z0-9-]*)/g;

/**
 * Parse a PRD's "In Scope" / "Out of Scope" / "Non-goals" sections and
 * emit a per-module relevance map.
 *
 * @param prdText           Full PRD markdown.
 * @param workspaceModules  The workspace's actual module names (used
 *                          for bare-name detection — e.g., "d110-editor"
 *                          mentioned without the `modules/` prefix).
 *                          Pass `[]` to disable bare-name detection.
 */
export function parseModuleRelevance(
  prdText: string,
  workspaceModules: ReadonlyArray<string>,
): PrdModuleRelevance {
  // Strip fenced code blocks so YAML / shell snippets inside the scope
  // section don't drag in unrelated module mentions.
  const noFences = prdText.replace(/```[\s\S]*?```/g, ' ');
  const lines = noFences.split(/\r?\n/);
  const sections = extractScopeSections(lines);
  const scores = new Map<string, ModuleRelevance>();
  const attribution = new Map<string, string>();
  // Sort workspace modules longest-first so "roland-sxx0-editor" wins
  // over a shorter substring match like "roland". Filters undefined out
  // (impossible — sort returns the same array shape — but the type
  // system needs the guarantee).
  const sortedWorkspace = [...workspaceModules].sort(
    (a, b) => b.length - a.length,
  );
  for (const section of sections) {
    const relevance: ModuleRelevance =
      section.kind === 'in-scope' ? 'high' : 'excluded';
    const mentioned = extractModuleMentions(section.body, sortedWorkspace);
    for (const mod of mentioned) {
      const existing = scores.get(mod);
      // 'excluded' wins over 'high' — if both sections mention the same
      // module (an author mistake), the more restrictive signal applies.
      // 'high' upgrades nothing already present.
      if (existing === 'excluded') continue;
      scores.set(mod, relevance);
      attribution.set(mod, section.heading);
    }
  }
  return { scores, sections: attribution };
}

interface ScopeSection {
  readonly kind: 'in-scope' | 'out-of-scope';
  readonly heading: string;
  readonly body: string;
}

/**
 * Walk the PRD lines, find headings that match one of the scope
 * heading kinds, accumulate body text until the next heading at the
 * same OR shallower depth.
 *
 * Same-or-shallower termination semantics: an `## In Scope` section
 * runs through any nested `### Subsection` headings inside it, but
 * terminates at the next `## Other Section`. An `### In Scope` inside
 * `## Scope` terminates at the next `### ...` peer.
 */
function extractScopeSections(lines: ReadonlyArray<string>): ScopeSection[] {
  const sections: ScopeSection[] = [];
  let current: { kind: ScopeSection['kind']; heading: string; depth: number; body: string[] } | null = null;
  for (const line of lines) {
    const match = line.match(HEADING_RE);
    if (match !== null) {
      const hashes = match[1];
      const text = match[2];
      if (hashes === undefined || text === undefined) continue;
      const depth = hashes.length;
      const normalized = text.toLowerCase().trim();
      // If we're inside a section, terminate when we hit a heading at
      // the same OR shallower depth.
      if (current !== null && depth <= current.depth) {
        sections.push({
          kind: current.kind,
          heading: current.heading,
          body: current.body.join('\n'),
        });
        current = null;
      }
      // Then check whether THIS heading opens a new scope section.
      if (IN_SCOPE_HEADINGS.has(normalized)) {
        current = { kind: 'in-scope', heading: text.trim(), depth, body: [] };
      } else if (OUT_OF_SCOPE_HEADINGS.has(normalized)) {
        current = { kind: 'out-of-scope', heading: text.trim(), depth, body: [] };
      }
      continue;
    }
    if (current !== null) current.body.push(line);
  }
  if (current !== null) {
    sections.push({
      kind: current.kind,
      heading: current.heading,
      body: current.body.join('\n'),
    });
  }
  return sections;
}

/**
 * Extract every distinct workspace module name referenced inside the
 * section body. Two detection modes:
 *
 *   - `modules/<name>` paths — captured via regex (the canonical form
 *     PRDs use when naming source-tree locations).
 *   - Bare module names from the `workspaceModules` allow-list —
 *     matched as whole-word case-insensitive substrings so a PRD that
 *     writes "the d110-editor surface" without the `modules/` prefix
 *     still resolves the reference.
 *
 * Returns the set of module names (deduped) in insertion order.
 */
function extractModuleMentions(
  body: string,
  workspaceModulesSortedLongestFirst: ReadonlyArray<string>,
): ReadonlySet<string> {
  const found = new Set<string>();
  // Pass 1: modules/<name>
  // The `g` flag on a shared RE plus `lastIndex` mutation is unsafe to
  // share across calls — recompile per-call to keep state local.
  const re = new RegExp(MODULE_PATH_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const slug = m[1];
    if (slug !== undefined) found.add(slug);
  }
  // Pass 2: bare workspace-module names (whole-word, case-insensitive).
  // We restrict to the workspace's actual module list to avoid matching
  // generic English words that happen to appear in module names (e.g.,
  // a hypothetical "core" module would match every "core" mention).
  // Sorted longest-first so "roland-sxx0-editor" wins over "roland".
  // We mask each match with spaces before scanning for the next
  // workspace term so a long match (e.g., "akai-s3k-editor") isn't
  // re-matched as its substrings ("akai", "editor").
  let scratch = body;
  for (const mod of workspaceModulesSortedLongestFirst) {
    const escaped = mod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordRe = new RegExp(`\\b${escaped}\\b`, 'gi');
    let found2: RegExpExecArray | null;
    let matched = false;
    while ((found2 = wordRe.exec(scratch)) !== null) {
      matched = true;
    }
    if (matched) {
      found.add(mod);
      // Mask all occurrences before scanning the next term.
      scratch = scratch.replace(wordRe, (s) => ' '.repeat(s.length));
    }
  }
  return found;
}
