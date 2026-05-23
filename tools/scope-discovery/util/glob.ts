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
 *   - `{a,b,c}`   — alternation; commas inside the braces are
 *                   separators; no nesting
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
  // Expand brace alternations first so the segment-aware compiler doesn't
  // have to track brace depth across `/` boundaries. The output is a
  // single regex with alternation groups in place of each `{a,b}`.
  const expanded = expandBraces(pattern);
  const compiled = compileSegmentwise(expanded);
  return new RegExp(`^${compiled}$`);
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
 * Expand `{a,b}` alternations into a single regex alternation in-line.
 * Returns the pattern with each `{a,b,c}` replaced by `__GLOB_ALT_<n>__`
 * tokens, alongside the per-token alternative lists. Then the segmentwise
 * compiler substitutes the tokens back as regex alternation groups.
 *
 * Implementation note: we avoid emitting regex pieces during expansion so
 * the segmentwise compiler can still see literal `/` between alternation
 * tokens.
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
      const closeIndex = pattern.indexOf('}', i + 1);
      if (closeIndex === -1) {
        throw new Error(`glob: unmatched '{' at index ${i} in "${pattern}"`);
      }
      const inner = pattern.substring(i + 1, closeIndex);
      if (inner.includes('{')) {
        throw new Error(`glob: nested braces not supported (pattern: "${pattern}")`);
      }
      const parts = inner.split(',').map((s) => s.trim());
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
    // Brace-alternation token expansion.
    if (segment.startsWith('__GLOB_ALT_', i)) {
      const end = segment.indexOf('__', i + '__GLOB_ALT_'.length);
      if (end !== -1) {
        const indexStr = segment.substring(i + '__GLOB_ALT_'.length, end);
        const altIndex = Number(indexStr);
        if (Number.isInteger(altIndex) && altIndex >= 0 && altIndex < alternatives.length) {
          const alts = alternatives[altIndex];
          out += `(?:${alts.map(escapeRegex).join('|')})`;
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
