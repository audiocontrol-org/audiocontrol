/**
 * tools/check-css-duplication.ts
 *
 * Detects cross-page CSS duplication — pairs of `.pageA__X { ... }` and
 * `.pageB__X { ... }` rules whose bodies are identical or near-identical.
 * Each such pair is either a DRY violation (extract to a shared `.ac-*`
 * class) or an intentional divergence that should be parameterized via a
 * CSS custom property.
 *
 * Failure mode this guards against — landed on this branch already:
 * I built each editor page by copying the prior page's chrome, never
 * extracting on the second use. By the time `patches.css` and
 * `tones.css` both shipped, their `.detail-head`, `.detail-slot`,
 * `.list-row`, `.list-row:hover`, etc. were byte-identical. Future
 * edits drift them further apart silently. This checker is the gate
 * that fires when the duplication first appears.
 *
 * Wiring:
 *   make check-css-duplication      # runs this script
 *   pre-commit hook                 # invokes the make target
 *
 * Configurable via:
 *   --root <path>      where to walk for stylesheets (default: modules/)
 *   --quiet            suppress per-pair output; print only summary + exit
 *   --json             emit JSON for tooling (one object per pair)
 *   --baseline <path>  treat stems listed in the baseline file as
 *                      pre-existing — they still report but don't
 *                      flip the exit code. Only stems NOT in the
 *                      baseline cause non-zero exit. Lets the hook
 *                      block NEW duplication while a backlog of known
 *                      pairs is being worked down. Comments (`#`) and
 *                      blank lines are ignored.
 *
 * Exit code:
 *   0   no NEW duplicates found (or no duplicates at all)
 *   1   one or more duplicate pairs found that aren't in the baseline
 *   2   argument or filesystem error
 *
 * Validation harness:
 *   tools/check-css-duplication.validate.ts compares this script's
 *   output against `.claude/rules/css-duplication-expected.txt` to
 *   prove the checker actually surfaces the known-existing
 *   duplications. If you change either the script's report shape or
 *   the ground-truth list, run the validator before committing.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

interface Rule {
  /** Source file the rule was parsed from. */
  file: string;
  /** Source-relative path for stable reporting. */
  rel: string;
  /** Page namespace prefix (e.g., 'tones', 'patches'). */
  prefix: string;
  /** Stem after `pageprefix__`, e.g. 'list-row' or 'list-row :hover'. */
  stem: string;
  /** Full selector as written, useful for error reporting. */
  selector: string;
  /** Normalized rule body — declarations joined by `;`, whitespace
   *  collapsed, comments stripped. The comparison key. */
  bodyNorm: string;
  /** Approximate line number in the source file (1-indexed). */
  line: number;
}

interface Pair {
  stem: string;
  a: Rule;
  b: Rule;
  /** True when normalized bodies are byte-identical. */
  identical: boolean;
  /** Diff lines (`a-only` / `b-only`) when not identical. */
  diff: { aOnly: string[]; bOnly: string[] };
}

/**
 * Match `.<prefix>__<stem><extra> {` where:
 *   - prefix is a snake_case identifier (`tones`, `patches`, etc.)
 *   - stem is the kebab-or-bem identifier after `__`
 *   - extra captures pseudo-classes / attribute selectors / descendant
 *     combinators that follow the prefixed class
 *
 * Crucially we match only the FIRST selector group; multi-selector
 * rules are reported under their first matching selector.
 */
const SELECTOR_RE =
  /\.([a-z][a-z0-9_]*)__([a-zA-Z][a-zA-Z0-9_-]*)((?:[:[][^{,]*)?(?:\s+[^{,]+)?)/;

/** Strip /* ... *\/ comments — both inline and block. */
function stripComments(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Naïve top-level CSS rule extractor. Walks the source character by
 * character tracking brace depth + comment regions, yielding one
 * `{ selector, body, line }` tuple per top-level rule. Handles
 * comments, ignores @-rules (their inner rules are handled as
 * top-level inside the @-block).
 */
function* iterRules(source: string): Generator<{
  selector: string;
  body: string;
  line: number;
}> {
  const src = source;
  let i = 0;
  let lineCount = 1;
  while (i < src.length) {
    // skip comments
    if (src.startsWith('/*', i)) {
      const end = src.indexOf('*/', i + 2);
      if (end < 0) return;
      lineCount += countNewlines(src, i, end + 2);
      i = end + 2;
      continue;
    }
    // skip whitespace
    if (/\s/.test(src[i])) {
      if (src[i] === '\n') lineCount += 1;
      i += 1;
      continue;
    }
    // @-rule: skip the prelude up to the matching `{`, then recurse
    // into the body so nested rules surface as top-level. For our
    // purposes we don't need real nesting support — none of our
    // stylesheets nest selectors inside @media, etc.
    if (src[i] === '@') {
      const blockStart = src.indexOf('{', i);
      if (blockStart < 0) return;
      lineCount += countNewlines(src, i, blockStart);
      // Find matching brace
      let depth = 1;
      let j = blockStart + 1;
      while (j < src.length && depth > 0) {
        if (src.startsWith('/*', j)) {
          const end = src.indexOf('*/', j + 2);
          if (end < 0) return;
          j = end + 2;
          continue;
        }
        if (src[j] === '{') depth += 1;
        else if (src[j] === '}') depth -= 1;
        if (src[j] === '\n') lineCount += 1;
        j += 1;
      }
      // Recurse into inner block
      yield* iterRules(src.slice(blockStart + 1, j - 1));
      i = j;
      continue;
    }
    // selector — read up to the matching `{`
    const startLine = lineCount;
    const braceAt = src.indexOf('{', i);
    if (braceAt < 0) return;
    const selector = stripComments(src.slice(i, braceAt)).trim();
    lineCount += countNewlines(src, i, braceAt);
    // body — read up to matching `}`
    let depth = 1;
    let j = braceAt + 1;
    while (j < src.length && depth > 0) {
      if (src.startsWith('/*', j)) {
        const end = src.indexOf('*/', j + 2);
        if (end < 0) return;
        j = end + 2;
        continue;
      }
      if (src[j] === '{') depth += 1;
      else if (src[j] === '}') depth -= 1;
      if (src[j] === '\n') lineCount += 1;
      if (depth === 0) break;
      j += 1;
    }
    const body = src.slice(braceAt + 1, j);
    yield { selector, body, line: startLine };
    i = j + 1;
  }
}

function countNewlines(s: string, start: number, end: number): number {
  let n = 0;
  for (let k = start; k < end; k += 1) if (s[k] === '\n') n += 1;
  return n;
}

/**
 * Normalize a rule body for comparison. Strips comments, collapses
 * whitespace, lowercases property names, removes empty declarations
 * and trailing semicolons, sorts declarations alphabetically so the
 * order of properties doesn't cause false negatives.
 */
function normalizeBody(body: string): string {
  const cleaned = stripComments(body);
  const decls = cleaned
    .split(';')
    .map((d) => d.trim())
    .filter((d) => d.length > 0)
    .map((d) => {
      // Normalize internal whitespace
      const idx = d.indexOf(':');
      if (idx < 0) return d.replace(/\s+/g, ' ');
      const prop = d.slice(0, idx).trim().toLowerCase();
      const value = d.slice(idx + 1).trim().replace(/\s+/g, ' ');
      return `${prop}: ${value}`;
    })
    .sort();
  return decls.join('; ');
}

async function walkCss(rootAbs: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name.startsWith('.')) continue;
      const p = join(dir, ent.name);
      if (ent.isDirectory()) await walk(p);
      else if (ent.isFile() && ent.name.endsWith('.css')) out.push(p);
    }
  }
  await walk(rootAbs);
  return out;
}

async function collectRules(files: string[], repoRoot: string): Promise<Rule[]> {
  const rules: Rule[] = [];
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    const rel = relative(repoRoot, file);
    for (const { selector, body, line } of iterRules(text)) {
      const m = SELECTOR_RE.exec(selector);
      if (!m) continue;
      const [, prefix, stem, extra] = m;
      // Skip prefixes that aren't page-scoped editors. Tighten this
      // allowlist if a non-page namespace ever clashes accidentally.
      if (prefix === 'ac' || prefix === 'tw') continue;
      rules.push({
        file,
        rel,
        prefix,
        stem: extra ? `${stem} ${extra.trim()}` : stem,
        selector: selector.trim(),
        bodyNorm: normalizeBody(body),
        line,
      });
    }
  }
  return rules;
}

function findPairs(rules: Rule[]): Pair[] {
  // Group by stem, then for any stem with rules from 2+ different
  // prefixes, emit a pair per (prefix-A, prefix-B) combination.
  const byStem = new Map<string, Rule[]>();
  for (const r of rules) {
    const arr = byStem.get(r.stem) ?? [];
    arr.push(r);
    byStem.set(r.stem, arr);
  }
  const pairs: Pair[] = [];
  for (const [stem, group] of byStem) {
    if (group.length < 2) continue;
    // For each pair of rules with different prefixes
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = group[i];
        const b = group[j];
        if (a.prefix === b.prefix) continue;
        const aDecls = a.bodyNorm.split('; ').filter(Boolean);
        const bDecls = b.bodyNorm.split('; ').filter(Boolean);
        const aSet = new Set(aDecls);
        const bSet = new Set(bDecls);
        const aOnly = aDecls.filter((d) => !bSet.has(d));
        const bOnly = bDecls.filter((d) => !aSet.has(d));
        pairs.push({
          stem,
          a,
          b,
          identical: aOnly.length === 0 && bOnly.length === 0,
          diff: { aOnly, bOnly },
        });
      }
    }
  }
  pairs.sort((p, q) => p.stem.localeCompare(q.stem));
  return pairs;
}

function formatReport(pairs: Pair[]): string {
  if (pairs.length === 0) return 'No cross-page CSS duplication detected.';
  const out: string[] = [];
  out.push(`Found ${pairs.length} cross-page CSS pair(s) with overlapping rule bodies:`);
  out.push('');
  for (const p of pairs) {
    const tag = p.identical ? 'IDENTICAL' : 'DIFFERS';
    out.push(
      `  ${tag.padEnd(10)} stem="${p.stem}"  .${p.a.prefix}__${p.stem.split(' ')[0]} ↔ .${p.b.prefix}__${p.stem.split(' ')[0]}`,
    );
    out.push(`    ${p.a.rel}:${p.a.line}`);
    out.push(`    ${p.b.rel}:${p.b.line}`);
    if (!p.identical) {
      for (const d of p.diff.aOnly) out.push(`      ${p.a.prefix} only: ${d}`);
      for (const d of p.diff.bOnly) out.push(`      ${p.b.prefix} only: ${d}`);
    }
    out.push('');
  }
  out.push(
    'Either extract to a shared `.ac-*` class in editor-core / `_shared.css`,',
  );
  out.push(
    'or — when the divergence is load-bearing — parameterize the differing',
  );
  out.push(
    'values via a CSS custom property and keep one rule definition.',
  );
  return out.join('\n');
}

async function readBaseline(path: string): Promise<Set<string>> {
  const text = await readFile(path, 'utf8');
  return new Set(
    text
      .split('\n')
      .map((l) => l.replace(/#.*/, '').trim())
      .filter((l) => l.length > 0),
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let root = 'modules';
  let quiet = false;
  let json = false;
  let baselinePath: string | null = null;
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--root') {
      root = args[++i];
      if (!root) {
        console.error('--root requires a path');
        process.exit(2);
      }
    } else if (a === '--quiet') quiet = true;
    else if (a === '--json') json = true;
    else if (a === '--baseline') {
      baselinePath = args[++i];
      if (!baselinePath) {
        console.error('--baseline requires a path');
        process.exit(2);
      }
    } else {
      console.error(`unknown arg: ${a}`);
      process.exit(2);
    }
  }

  const repoRoot = process.cwd();
  const rootAbs = root.startsWith('/') ? root : join(repoRoot, root);
  const files = await walkCss(rootAbs);
  const rules = await collectRules(files, repoRoot);
  const pairs = findPairs(rules);

  // Partition into pre-existing (in baseline) vs new (not in baseline)
  let baseline: Set<string> = new Set();
  if (baselinePath !== null) {
    baseline = await readBaseline(baselinePath);
  }
  const newPairs = pairs.filter((p) => !baseline.has(p.stem));

  if (json) {
    process.stdout.write(
      JSON.stringify(
        pairs.map((p) => ({
          stem: p.stem,
          identical: p.identical,
          isNew: !baseline.has(p.stem),
          a: { file: p.a.rel, line: p.a.line, prefix: p.a.prefix },
          b: { file: p.b.rel, line: p.b.line, prefix: p.b.prefix },
          aOnly: p.diff.aOnly,
          bOnly: p.diff.bOnly,
        })),
        null,
        2,
      ) + '\n',
    );
  } else if (!quiet) {
    process.stdout.write(formatReport(pairs) + '\n');
    if (baselinePath !== null) {
      process.stdout.write(
        `\n${baseline.size} stem(s) in baseline ${baselinePath} (pre-existing, not blocking).\n`,
      );
      if (newPairs.length > 0) {
        process.stdout.write(
          `\nNEW DUPLICATIONS not in baseline (${newPairs.length}):\n`,
        );
        for (const p of newPairs) {
          process.stdout.write(`  ✗ "${p.stem}"\n`);
        }
      }
    }
  } else {
    process.stdout.write(
      `${pairs.length} total pair(s), ${newPairs.length} new\n`,
    );
  }

  // Exit non-zero only on NEW pairs when a baseline is provided.
  // Without a baseline, any pair is a failure.
  const failing = baselinePath !== null ? newPairs.length : pairs.length;
  process.exit(failing > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
