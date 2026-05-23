/**
 * tools/scope-discovery/util/editors.ts
 *
 * Single-source-of-truth for "the set of editor modules participating
 * in cross-editor symmetry checks." Consumed by `check-editor-symmetry`
 * (T6.3) and intended for `check-deprecations` (T6.4) once that lands.
 *
 * The repo convention is that every device-specific editor lives under
 * `modules/<slug>-editor/`. The shared editor infrastructure module is
 * `modules/editor-core/` — note the `-core` suffix, NOT `-editor`, so a
 * suffix filter cleanly excludes it. We honor that convention by
 * deriving the editor list from the on-disk directory layout rather
 * than a hard-coded constant:
 *   - survives editor adds/removes without scanner edits,
 *   - survives editor renames at refactor time,
 *   - the single point of change is the directory name itself, which
 *     is also load-bearing for build / import paths / docs.
 *
 * Why not a hard-coded constant: every other scope-discovery surface
 * already trusts the directory layout (clone detector glob includes
 * `modules/**`, adopter manifests author globs against
 * `modules/<editor>/**`, etc.). A separate "editor allow-list"
 * constant would be a parallel registry that drifts the moment a new
 * editor lands without the developer remembering to update the
 * constant. The directory walk costs ~1ms; not the bottleneck.
 *
 * Why not `package.json keywords`: spot-checked 2026-05-22 and the
 * existing editor modules are inconsistent (some declare
 * `keywords: ["editor"]`, others have empty `keywords: []`).
 * Tightening that convention is its own effort; the suffix-match
 * heuristic works today and is auditable from `ls modules/`.
 *
 * Exclusions: `editor-core` is structurally not an editor — it's the
 * shared primitives module that editors import from. The `-editor`
 * suffix filter excludes it automatically (it ends with `-core`).
 * Future shared modules ending in `-editor-helpers` etc. would need
 * an explicit exclusion list here, but no such module exists today.
 */

import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { errorMessage, isEnoent } from './typeguards.js';

const MODULES_DIR = 'modules';
const EDITOR_SUFFIX = '-editor';

/**
 * Discover the set of editor modules under `<rootAbs>/modules/`.
 * Returns sorted slugs (the directory names, e.g.,
 * `roland-sxx0-editor`). Throws on infra errors; returns an empty
 * array if `modules/` doesn't exist (the scanner caller treats that
 * as "no editors → matrix is empty").
 */
export async function discoverEditors(rootAbs: string): Promise<readonly string[]> {
  const modulesRoot = resolve(rootAbs, MODULES_DIR);
  let entries: Awaited<ReturnType<typeof readdir>>;
  try {
    entries = await readdir(modulesRoot, { withFileTypes: true });
  } catch (err) {
    if (isEnoent(err)) return [];
    throw new Error(`editors: cannot read ${modulesRoot}: ${errorMessage(err)}`);
  }
  const editors: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.endsWith(EDITOR_SUFFIX)) {
      editors.push(entry.name);
    }
  }
  editors.sort();
  return editors;
}

/**
 * Bucket a repo-relative POSIX path to its owning editor, if any. A
 * path under `modules/<editor>/...` returns `<editor>` (when
 * `<editor>` is in `editors`); otherwise returns null. This is the
 * load-bearing heuristic for the symmetry matrix: a manifest entry's
 * matched files are bucketed per-editor by inspecting the path
 * segments, NOT by re-parsing the glob.
 *
 * Why path-based bucketing rather than glob-based: a glob like
 * `modules/{roland-sxx0,akai-s3k}-editor/src/**\/*Page.tsx` covers
 * two editors. The compiled regex matches paths in either tree, and
 * the matrix wants to surface BOTH columns. The simplest correct
 * answer is: enumerate the matched files (the scanner already does
 * this), then bucket by `modules/<editor>/` prefix. The result is
 * a per-(manifest × editor) cell straight from the path data.
 *
 * Returns null for paths outside `modules/`, paths whose
 * `modules/<x>/` segment doesn't end in `-editor`, or paths whose
 * editor segment isn't in the supplied editor set.
 */
export function editorForPath(
  repoRelPath: string,
  editors: readonly string[],
): string | null {
  const segments = repoRelPath.split('/');
  if (segments.length < 2 || segments[0] !== MODULES_DIR) return null;
  const candidate = segments[1];
  return editors.includes(candidate) ? candidate : null;
}

/**
 * Determine the static directory prefix of a glob, splitting at the
 * first wildcard-bearing segment. Returns the prefix as an array of
 * literal segments (empty array if the very first segment has a
 * wildcard). Brace alternations are expanded into one prefix per
 * alternative — the caller treats each prefix as a separate edge of
 * the glob's coverage. Patterns with nested braces are not
 * supported (the glob compiler rejects those at parse time, so we
 * can't see them here).
 *
 * Examples (input → flattened prefixes):
 *   `modules/roland-sxx0-editor/src/**\/*Page.tsx`
 *     → [['modules', 'roland-sxx0-editor', 'src']]
 *   `modules/{roland-sxx0,akai-s3k}-editor/src/**\/*Page.tsx`
 *     → [['modules', 'roland-sxx0-editor', 'src'],
 *        ['modules', 'akai-s3k-editor', 'src']]
 *   `modules/**\/*Page.tsx`
 *     → [['modules']]
 *   `modules/*-editor/src/**\/*Page.tsx`
 *     → [['modules']]   (wildcard in segment #2 → prefix stops at #1)
 *
 * Used by `editorsTargetedByGlob` to compute the editor column set
 * without needing a basename-probe (which would be brittle against
 * literal-basename globs).
 */
export function staticPrefixes(globPattern: string): readonly (readonly string[])[] {
  const expanded = expandBraceAlternatives(globPattern);
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const variant of expanded) {
    const prefix = leadingLiteralSegments(variant);
    const key = prefix.join('/');
    if (!seen.has(key)) {
      seen.add(key);
      out.push(prefix);
    }
  }
  return out;
}

/**
 * Compute which editors a glob targets by inspecting the glob's
 * static directory prefix. An editor is targeted if either:
 *   (a) the prefix is `modules/<editor>/...` (matches the editor
 *       directory literally), or
 *   (b) the prefix is `modules` or shorter (the glob spans all
 *       editors via a wildcard in the editor-segment position).
 *
 * Order of the returned slugs matches `editors`. Used by the matrix
 * to decide n/a vs. ✗-with-zero cells: an editor not in the
 * targeted set gets a — cell; an editor in the targeted set with
 * zero matching files gets a ✗ cell (the glob was supposed to find
 * files in that editor but didn't — possible regime drift).
 */
export function editorsTargetedByGlob(
  globPattern: string,
  editors: readonly string[],
): readonly string[] {
  const prefixes = staticPrefixes(globPattern);
  const targeted = new Set<string>();
  for (const prefix of prefixes) {
    if (prefix.length === 0 || prefix[0] !== MODULES_DIR) {
      // The glob doesn't start with `modules/...`. Treat as spanning
      // all editors (e.g., a hypothetical `lib/**`); the matrix is
      // editor-scoped and the manifest authoring convention is
      // `modules/<editor>/...`, so this is a misauthored glob, but
      // we don't reject — we just include every editor and let the
      // matched-file count decide ✗ vs ✓.
      for (const e of editors) targeted.add(e);
      continue;
    }
    if (prefix.length === 1) {
      // Prefix is exactly `modules` — glob spans all editors.
      for (const e of editors) targeted.add(e);
      continue;
    }
    // Prefix is `modules/<X>/...` — X must be in the editor set.
    const candidate = prefix[1];
    if (editors.includes(candidate)) targeted.add(candidate);
  }
  return editors.filter((e) => targeted.has(e));
}

/**
 * Internal: expand `{a,b,c}` alternations into a flat list of
 * variant patterns. Mirrors the glob compiler's brace expansion but
 * emits strings (not regex pieces) so callers can inspect the
 * static prefix. Throws on unmatched / nested braces, same as the
 * compiler.
 */
function expandBraceAlternatives(pattern: string): readonly string[] {
  const variants: string[] = [''];
  let i = 0;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === '{') {
      const closeIndex = pattern.indexOf('}', i + 1);
      if (closeIndex === -1) {
        throw new Error(`editors: unmatched '{' at index ${i} in "${pattern}"`);
      }
      const inner = pattern.substring(i + 1, closeIndex);
      if (inner.includes('{')) {
        throw new Error(`editors: nested braces not supported in "${pattern}"`);
      }
      const parts = inner.split(',').map((s) => s.trim());
      const next: string[] = [];
      for (const v of variants) {
        for (const p of parts) next.push(v + p);
      }
      variants.splice(0, variants.length, ...next);
      i = closeIndex + 1;
    } else {
      for (let k = 0; k < variants.length; k += 1) variants[k] += ch;
      i += 1;
    }
  }
  return variants;
}

/**
 * Return the leading literal-path segments of a glob (no wildcards).
 * Stops at the first segment containing `*`, `?`, or `**`. A segment
 * that is purely literal contributes; everything after the first
 * wildcard-bearing segment is dropped.
 */
function leadingLiteralSegments(pattern: string): string[] {
  const segments = pattern.split('/');
  const out: string[] = [];
  for (const seg of segments) {
    if (seg === '**' || seg.includes('*') || seg.includes('?')) break;
    out.push(seg);
  }
  return out;
}
