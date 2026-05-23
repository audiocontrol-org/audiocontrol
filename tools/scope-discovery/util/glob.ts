/**
 * tools/scope-discovery/util/glob.ts
 *
 * Minimal glob-to-regex compiler + file walker for the scope-discovery
 * tooling. The adopter-manifest gate (T6.2) needs to match repo-relative
 * paths against patterns like
 *   modules/{roland-sxx0,akai-s3k}-editor/src/**\/*Editor*.tsx
 * and ask "which files match this glob and which don't import the
 * canonical primitive?"
 *
 * Why not pull in `fast-glob` / `picomatch` / `globby`: none are a
 * direct dependency of this repo (they appear only transitively under
 * tsx / jscpd / eslint), and adding a top-level glob package for the
 * narrow shapes adopter manifests actually use (`**`, `*`, brace
 * alternation, literal segments) would widen the dep surface for
 * marginal benefit. The shape grammar is small and finite; a 100-line
 * compiler beats a 2MB dep. Matches T6.1's pure-regex stance.
 *
 * Supported pattern syntax:
 *   - `**`        — any number of path segments (including zero)
 *   - `*`         — any run of non-`/` characters
 *   - `?`         — any single non-`/` character
 *   - `{a,b,c}`   — alternation; commas at the brace's top level are
 *                   separators. Each alternative is itself a glob —
 *                   wildcards (`*`, `**`, `?`), literal `/`, and nested
 *                   braces are all valid inside the alternation.
 *                   Resolved AUDIT-20260522-05: alternatives are
 *                   recursively re-compiled through the same pipeline
 *                   instead of being literal-escaped.
 *   - literal `/` — path separator (always forward-slash; callers
 *                   normalize Windows-style backslashes before calling)
 *   - everything else is matched literally (regex metacharacters are
 *     escaped before assembly)
 *
 * Patterns are always anchored against the full repo-relative path
 * (an implicit `^` and `$`). Callers feeding repo-relative paths in
 * forward-slash form get deterministic matches.
 */

import { readdir } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';
import { errorMessage, isEnoent } from './typeguards.js';

/** Compile a glob pattern to an anchored RegExp. */
export function globToRegex(pattern: string): RegExp {
  return new RegExp(`^${compileGlobBody(pattern)}$`);
}

/**
 * Compile a glob pattern to a regex source string WITHOUT anchors. The
 * top-level `globToRegex` wraps the result in `^…$`; the alternation
 * handler in `compileSegment` calls back into this same compiler for
 * each `{a,b,c}` alternative, so wildcards (`*`, `**`, `?`), literal
 * `/`, and nested braces all work inside an alternation.
 *
 * AUDIT-20260522-05 fix: the prior implementation passed each
 * alternative through `escapeRegex` directly, which literal-escaped
 * `*` / `?` inside braces (so `{a*c,b*d}` compiled to `(?:a\*c|b\*d)`
 * and matched zero files). Re-routing alternatives through the full
 * pipeline lets each one expand its own wildcards and recursively
 * resolve any nested braces.
 */
function compileGlobBody(pattern: string): string {
  const expanded = expandBraces(pattern);
  return compileSegmentwise(expanded);
}

/**
 * Recursively walk `rootAbs` and return every file whose repo-relative
 * (POSIX-form) path matches at least one of `patterns`. Repo-relative
 * paths are computed against `rootAbs` itself; callers feeding
 * multiple roots should call this multiple times.
 *
 * Returns absolute paths so callers can read files directly; the
 * pattern match is against the repo-relative form.
 */
export async function listFilesMatching(
  rootAbs: string,
  patterns: readonly RegExp[],
  skipDirs: ReadonlySet<string>,
  scannedExtensions: ReadonlySet<string>,
): Promise<string[]> {
  const root = resolve(rootAbs);
  const out: string[] = [];
  await walk(root, root, patterns, skipDirs, scannedExtensions, out);
  out.sort();
  return out;
}

async function walk(
  root: string,
  dir: string,
  patterns: readonly RegExp[],
  skipDirs: ReadonlySet<string>,
  scannedExtensions: ReadonlySet<string>,
  out: string[],
): Promise<void> {
  let entries: Awaited<ReturnType<typeof readdir>>;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (isEnoent(err)) return;
    throw new Error(`glob: readdir ${dir} failed: ${errorMessage(err)}`);
  }
  for (const entry of entries) {
    if (skipDirs.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(root, full, patterns, skipDirs, scannedExtensions, out);
    } else if (entry.isFile()) {
      if (!scannedExtensions.has(extname(entry.name))) continue;
      const rel = toPosix(relative(root, full));
      if (patterns.some((re) => re.test(rel))) {
        out.push(full);
      }
    }
  }
}

/** Convert a path to POSIX (forward-slash) form for pattern matching. */
export function toPosix(path: string): string {
  return sep === '/' ? path : path.split(sep).join('/');
}

// ---------------------------------------------------------------------------
// Compiler internals
// ---------------------------------------------------------------------------

/**
 * Lift top-level `{a,b,c}` alternations into placeholder tokens so the
 * segmentwise compiler doesn't have to track brace depth across `/`
 * boundaries. Returns the pattern with each top-level brace group
 * replaced by `__GLOB_ALT_<n>__` and the corresponding alternatives.
 *
 * Top-level here means "at brace depth 0 at the moment we encounter
 * the `{`." Brace depth is tracked properly so nested braces are
 * lifted intact as part of the outer alternative — the recursive
 * compile in `compileSegment` re-runs the pipeline on each
 * alternative, which expands the inner braces on a later pass.
 *
 * Commas inside nested braces are NOT separators of the outer group.
 *
 * Implementation note: we avoid emitting regex pieces during expansion
 * so the segmentwise compiler can still see literal `/` between
 * alternation tokens.
 */
interface BraceExpansion {
  readonly skeleton: string;
  readonly alternatives: ReadonlyArray<readonly string[]>;
}

function expandBraces(pattern: string): BraceExpansion {
  const alternatives: string[][] = [];
  let skeleton = '';
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '{') {
      const closeIndex = findMatchingBrace(pattern, i);
      const inner = pattern.substring(i + 1, closeIndex);
      const parts = splitTopLevelCommas(inner).map((s) => s.trim());
      if (parts.length < 2 || parts.some((p) => p.length === 0)) {
        throw new Error(`glob: brace group must have >=2 non-empty alternatives in "${pattern}"`);
      }
      const token = `__GLOB_ALT_${alternatives.length}__`;
      alternatives.push(parts);
      skeleton += token;
      i = closeIndex + 1;
    } else {
      skeleton += ch;
      i += 1;
    }
  }
  return { skeleton, alternatives };
}

/**
 * Locate the `}` that closes the `{` at `openIndex`, accounting for
 * nesting. Returns the index of the matching close brace; throws when
 * the input ends before a matching `}` is found.
 */
function findMatchingBrace(pattern: string, openIndex: number): number {
  let depth = 0;
  for (let j = openIndex; j < pattern.length; j += 1) {
    const c = pattern[j];
    if (c === '{') depth += 1;
    else if (c === '}') {
      depth -= 1;
      if (depth === 0) return j;
    }
  }
  throw new Error(`glob: unmatched '{' at index ${openIndex} in "${pattern}"`);
}

/**
 * Split `inner` on commas that are AT brace depth 0. Commas inside a
 * nested `{…}` belong to the inner group and are not separators of the
 * outer one.
 */
function splitTopLevelCommas(inner: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let buf = '';
  for (let j = 0; j < inner.length; j += 1) {
    const c = inner[j];
    if (c === '{') {
      depth += 1;
      buf += c;
    } else if (c === '}') {
      depth -= 1;
      buf += c;
    } else if (c === ',' && depth === 0) {
      parts.push(buf);
      buf = '';
    } else {
      buf += c;
    }
  }
  parts.push(buf);
  return parts;
}

/**
 * Segmentwise compile: split on `/`, compile each segment to regex,
 * then re-join with `/` or — for `**` segments — a multi-segment skip.
 *
 * `**` between literal slashes matches zero or more path segments
 * (the canonical shell-glob semantics). Adjacent `**` segments
 * collapse so `a/**\/**\/*.tsx` reads as `a/**\/*.tsx` semantically.
 */
function compileSegmentwise(expansion: BraceExpansion): string {
  const segments = expansion.skeleton.split('/');
  const pieces: string[] = [];
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    if (seg === '**') {
      // Collapse runs of `**` into a single multi-segment skip.
      while (i + 1 < segments.length && segments[i + 1] === '**') i += 1;
      if (i === segments.length - 1) {
        // Trailing `**` matches the remainder of the path (zero or more
        // segments). The preceding `/` was already emitted as the segment
        // separator; consume it so `a/**` matches both `a` and `a/b/c`.
        if (pieces.length > 0 && pieces[pieces.length - 1] === '/') {
          pieces.pop();
          pieces.push('(?:/[^/]+)*');
        } else {
          pieces.push('(?:[^/]+(?:/[^/]+)*)?');
        }
      } else {
        // `**/` in the middle matches zero or more segments followed by a `/`.
        pieces.push('(?:[^/]+/)*');
        continue; // skip emitting another `/` below
      }
    } else {
      pieces.push(compileSegment(seg, expansion.alternatives));
    }
    if (i < segments.length - 1) pieces.push('/');
  }
  return pieces.join('');
}

function compileSegment(segment: string, alternatives: ReadonlyArray<readonly string[]>): string {
  let out = '';
  let i = 0;
  while (i < segment.length) {
    const ch = segment[i];
    if (ch === '*') {
      out += '[^/]*';
      i += 1;
      continue;
    }
    if (ch === '?') {
      out += '[^/]';
      i += 1;
      continue;
    }
    // Brace-alternation token expansion. Each alternative is itself a
    // sub-glob and is recursively re-compiled through the full
    // pipeline (AUDIT-20260522-05) so wildcards / `**` / `?` / nested
    // braces inside an alternative resolve correctly instead of being
    // literal-escaped.
    if (segment.startsWith('__GLOB_ALT_', i)) {
      const end = segment.indexOf('__', i + '__GLOB_ALT_'.length);
      if (end !== -1) {
        const indexStr = segment.substring(i + '__GLOB_ALT_'.length, end);
        const altIndex = Number(indexStr);
        if (Number.isInteger(altIndex) && altIndex >= 0 && altIndex < alternatives.length) {
          const alts = alternatives[altIndex];
          out += `(?:${alts.map(compileGlobBody).join('|')})`;
          i = end + 2;
          continue;
        }
      }
    }
    out += escapeRegex(ch);
    i += 1;
  }
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
