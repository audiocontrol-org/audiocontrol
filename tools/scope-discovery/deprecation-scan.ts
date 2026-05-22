/**
 * tools/scope-discovery/deprecation-scan.ts
 *
 * Deprecation-driven scan (workplan T6.4). Walks the source tree for
 * file-level `@deprecated` markers and counts remaining importers per
 * deprecated file. Two output buckets per scan:
 *
 *   - `blocked`        — deprecated file with one or more importers
 *                        outside its own source. Deletion is blocked
 *                        until every importer migrates.
 *   - `safeToDelete`   — deprecated file with zero importers. Safe to
 *                        remove in the next refactor commit; the
 *                        operator consults this queue to drain.
 *
 * Marker grammar (v1, **file-level only**):
 *
 *   1. JSDoc `@deprecated` tag inside the FIRST top-of-file docblock.
 *      The docblock must be syntactically a `/** ... *\/` block at
 *      the very start of the file (whitespace + shebang permitted
 *      before it). Matches the existing repo convention for
 *      `EnvelopeDisplay.tsx` / `EnvelopeEditor.tsx`.
 *
 *   2. Inline `// DEPRECATED:` line comment within the first 20 lines
 *      of the file. The marker is the entire comment line; the
 *      message is the substring after `DEPRECATED:`.
 *
 * Symbol-level deprecation (e.g., `@deprecated` on a single exported
 * function within a file that still has other live exports) is OUT OF
 * SCOPE FOR v1. The repo currently has both forms in flight — the
 * roland-sxx0-editor's `EnvelopeDisplay.tsx` / `EnvelopeEditor.tsx`
 * are file-level (top docblock + dropped from importers), and
 * `library-tones.ts`'s `listIndividualTones` is symbol-level (one
 * function in a file with many live exports). The file-level scope
 * matches the operator's "delete this file when importers reach 0"
 * lifecycle, which is the use case this gate exists to serve. A
 * future T6.X could add symbol-level granularity if a use case arises,
 * but that requires AST walking, not regex; the project's other
 * scope-discovery gates are pure-regex and we mirror that posture.
 *
 * Importer detection (v1, **pure regex**):
 *
 *   - Builds a per-deprecated-file regex covering:
 *       - `import ... from '<spec>'`
 *       - `export ... from '<spec>'`
 *       - dynamic `import('<spec>')`
 *       - CommonJS `require('<spec>')`
 *   - `<spec>` is the union of:
 *       a) the `@/` alias form of the file's path (e.g.,
 *          `@/components/ui/EnvelopeDisplay`),
 *       b) a basename-relative form (any `./...<basename>` or
 *          `../...<basename>` path that ends in the file's basename
 *          without its extension).
 *   - The file's own contents are NOT scanned for its own importers;
 *     a deprecated file's internal re-exports / doc-comment
 *     self-references do not count as "external importers."
 *
 * The `@/` alias form is computed by stripping the `modules/<module>/src/`
 * prefix from the file's repo-relative path (this matches the
 * project-wide TypeScript path-alias convention documented in CLAUDE.md:
 * `@/` maps to each module's `src/` root). The single-source-of-truth
 * for this convention is each module's `tsconfig.json` — a future
 * enhancement could parse the tsconfig to handle modules that diverge
 * from the convention, but the v1 regex pattern works for every module
 * the scope-discovery tooling currently targets.
 *
 * DRY: re-uses `listFilesMatching` + `toPosix` from `util/glob.ts` and
 * the import-regex shape from `check-adopters.ts`. The walker is the
 * same shape as the editor-symmetry matrix's path walker; only the
 * fingerprint differs.
 */

import { readFile, stat } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { listFilesMatching, toPosix } from './util/glob.js';
import { errorMessage } from './util/typeguards.js';

/** Extensions the scanner inspects for deprecation markers. */
const SCANNED_EXTENSIONS: ReadonlySet<string> = new Set(['.ts', '.tsx']);

/** Directories the walker never descends into. */
const SKIP_DIRS: ReadonlySet<string> = new Set([
  'node_modules',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage',
  '.git',
]);

/** Walk pattern: every `.ts` / `.tsx` file under the repo. */
const WALK_PATTERN: readonly RegExp[] = [/^.+\.(?:ts|tsx)$/];

/** Inline marker prefix. The line must start with this (after optional whitespace). */
const INLINE_MARKER_PREFIX = '// DEPRECATED:';

/** Maximum line count to scan for inline `// DEPRECATED:` markers. */
const INLINE_MARKER_MAX_LINES = 20;

/** Regex matching a top-of-file JSDoc block opener (after optional shebang / blank lines). */
const TOP_DOCBLOCK_OPEN_RE = /^(?:#![^\n]*\n)?\s*\/\*\*/;

/** A single deprecated source file. */
export interface DeprecatedFile {
  /** Repo-relative POSIX path. */
  readonly path: string;
  /** Message extracted from the marker (text after `@deprecated ` or `DEPRECATED:`). */
  readonly message: string;
  /** Whether the marker was JSDoc (`@deprecated`) or inline (`// DEPRECATED:`). */
  readonly markerKind: 'jsdoc' | 'inline';
  /** Importer files (repo-relative POSIX path + 1-based line number of the first import match). */
  readonly importers: readonly DeprecatedImporter[];
}

export interface DeprecatedImporter {
  readonly path: string;
  readonly line: number;
}

export interface ScanResult {
  /** Deprecated files with at least one importer. */
  readonly blocked: readonly DeprecatedFile[];
  /** Deprecated files with zero importers. */
  readonly safeToDelete: readonly DeprecatedFile[];
  /** Total number of source files visited during the walk. */
  readonly filesVisited: number;
}

export interface ScanOptions {
  readonly scanRoot: string;
}

/**
 * Top-level scan entry. Walks the source tree once, identifies
 * deprecated files, then walks the tree a second time to count
 * importers per deprecated file. Two passes because the second pass
 * needs the set of deprecated files in hand.
 */
export async function scan(opts: ScanOptions): Promise<ScanResult> {
  const rootAbs = resolve(opts.scanRoot);
  const allFiles = await listFilesMatching(rootAbs, WALK_PATTERN, SKIP_DIRS, SCANNED_EXTENSIONS);
  const deprecatedRaw: DeprecatedRaw[] = [];
  for (const abs of allFiles) {
    const content = await readFileSafe(abs);
    const marker = detectMarker(content);
    if (marker === null) continue;
    deprecatedRaw.push({
      absPath: abs,
      relPath: toPosix(toRepoRel(abs, rootAbs)),
      message: marker.message,
      markerKind: marker.kind,
    });
  }
  if (deprecatedRaw.length === 0) {
    return { blocked: [], safeToDelete: [], filesVisited: allFiles.length };
  }
  // Build per-deprecated-file importer regex + scan every non-self file.
  const importerSearches = deprecatedRaw.map((d) => buildImporterSearch(d.relPath));
  const importersById = new Map<string, DeprecatedImporter[]>();
  for (const d of deprecatedRaw) importersById.set(d.relPath, []);
  for (const candidateAbs of allFiles) {
    const candidateRel = toPosix(toRepoRel(candidateAbs, rootAbs));
    // For each deprecated file we don't yet know is self-referential,
    // test the candidate's content against the deprecated file's
    // importer pattern. Skip the self-importer (a file's own re-exports
    // / internal references don't count).
    const content = await readFileSafe(candidateAbs);
    importerSearches.forEach((search, idx) => {
      const deprecated = deprecatedRaw[idx];
      if (deprecated.relPath === candidateRel) return;
      const match = findFirstImport(content, search.regex);
      if (match === null) return;
      const bucket = importersById.get(deprecated.relPath);
      if (bucket !== undefined) {
        bucket.push({ path: candidateRel, line: match.line });
      }
    });
  }
  const blocked: DeprecatedFile[] = [];
  const safeToDelete: DeprecatedFile[] = [];
  for (const d of deprecatedRaw) {
    const importers = (importersById.get(d.relPath) ?? []).slice().sort(byPathThenLine);
    const file: DeprecatedFile = {
      path: d.relPath,
      message: d.message,
      markerKind: d.markerKind,
      importers,
    };
    if (importers.length === 0) safeToDelete.push(file);
    else blocked.push(file);
  }
  blocked.sort(byDeprecatedPath);
  safeToDelete.sort(byDeprecatedPath);
  return { blocked, safeToDelete, filesVisited: allFiles.length };
}

interface DeprecatedRaw {
  readonly absPath: string;
  readonly relPath: string;
  readonly message: string;
  readonly markerKind: 'jsdoc' | 'inline';
}

interface MarkerDetection {
  readonly kind: 'jsdoc' | 'inline';
  readonly message: string;
}

/**
 * Inspect a file's source for a v1 deprecation marker. Returns the
 * marker kind + extracted message, or null if neither form is present.
 *
 * Precedence: JSDoc tag wins if both are present (the JSDoc form is
 * the more rigorous of the two and any inline marker in the same file
 * is redundant). We don't currently surface "both forms present" as
 * an error condition; if that pattern emerges in the wild, lint it
 * here.
 */
export function detectMarker(content: string): MarkerDetection | null {
  const jsdoc = detectJsDocDeprecated(content);
  if (jsdoc !== null) return { kind: 'jsdoc', message: jsdoc };
  const inline = detectInlineDeprecated(content);
  if (inline !== null) return { kind: 'inline', message: inline };
  return null;
}

/**
 * Look for `@deprecated [message]` inside the top-of-file JSDoc block.
 * The JSDoc block must be the FIRST non-trivial element of the file
 * (optional shebang + optional leading whitespace before the `/**`).
 * Any subsequent docblocks (above individual symbols) are ignored
 * — that's the symbol-level scope which v1 doesn't address.
 *
 * The message is everything on the `@deprecated` line after the tag,
 * trimmed; if the tag has no inline content, returns the empty string.
 */
function detectJsDocDeprecated(content: string): string | null {
  if (!TOP_DOCBLOCK_OPEN_RE.test(content)) return null;
  const openIdx = content.indexOf('/**');
  if (openIdx === -1) return null;
  const closeIdx = content.indexOf('*/', openIdx + 3);
  if (closeIdx === -1) return null;
  const block = content.substring(openIdx + 3, closeIdx);
  // Find `@deprecated` as a whole word within the block. The regex
  // ignores leading ` * ` line prefixes that JSDoc blocks decorate
  // each line with.
  const deprecatedRe = /(^|\s)@deprecated\b([^\n]*)/m;
  const match = deprecatedRe.exec(block);
  if (match === null) return null;
  // Strip a trailing `*/` fragment (the case where `@deprecated` lives
  // on the closing line) and any trailing whitespace.
  const raw = (match[2] ?? '').replace(/\*\/.*$/, '').trim();
  return raw;
}

/**
 * Look for `// DEPRECATED: <message>` within the first
 * INLINE_MARKER_MAX_LINES lines. Matches the line-comment form a few
 * files use as an alternative to the JSDoc tag.
 */
function detectInlineDeprecated(content: string): string | null {
  const lines = content.split('\n');
  const ceiling = Math.min(lines.length, INLINE_MARKER_MAX_LINES);
  for (let i = 0; i < ceiling; i += 1) {
    const line = lines[i].trimStart();
    if (line.startsWith(INLINE_MARKER_PREFIX)) {
      return line.substring(INLINE_MARKER_PREFIX.length).trim();
    }
  }
  return null;
}

interface ImporterSearch {
  readonly regex: RegExp;
}

/**
 * Build the importer-detection regex for one deprecated file. The
 * regex matches any of:
 *   - import / export / require / dynamic-import statements whose
 *     specifier is the file's `@/`-alias form,
 *   - or a relative-path form (`./<basename>` / `../**\/<basename>`)
 *     where `<basename>` is the file's basename without its extension.
 *
 * Specifier endings: a TypeScript import statement may write the
 * specifier with or without the `.js` extension (the project's
 * convention is *with* `.js` for relative paths; without for `@/`).
 * The pattern matches both shapes.
 *
 * Self-importer detection happens at the call site (we skip the file
 * whose path equals the deprecated file's path).
 */
function buildImporterSearch(deprecatedRelPath: string): ImporterSearch {
  const aliasSpec = toAliasSpec(deprecatedRelPath);
  const noExt = stripExtension(basename(deprecatedRelPath));
  const escapedAlias = aliasSpec === null ? null : escapeRegex(aliasSpec);
  const escapedBase = escapeRegex(noExt);
  // Specifier shapes to match.
  const specifierAlternatives: string[] = [];
  if (escapedAlias !== null) {
    // `@/...` with optional trailing `.js` to handle both extension
    // shapes the codebase emits.
    specifierAlternatives.push(`${escapedAlias}(?:\\.js)?`);
  }
  // Relative-path form: at least one `./` / `../` segment, ending in
  // the basename + optional `.js`. The leading `./` requirement
  // disambiguates from a literal basename appearing inside an
  // unrelated `@/...` path that just happens to share the same final
  // segment.
  specifierAlternatives.push(
    `(?:\\.\\.?/)(?:[^'"\\s]*?/)?${escapedBase}(?:\\.[tj]sx?)?`,
  );
  const specifierUnion = specifierAlternatives.join('|');
  const pattern =
    `(?:` +
    `(?:import|export)\\s+(?:[^'"]*\\sfrom\\s+)?['"](?:${specifierUnion})['"]` +
    `|` +
    `import\\s*\\(\\s*['"](?:${specifierUnion})['"]\\s*\\)` +
    `|` +
    `require\\s*\\(\\s*['"](?:${specifierUnion})['"]\\s*\\)` +
    `)`;
  return { regex: new RegExp(pattern, 'gm') };
}

/**
 * Convert a repo-relative path like
 *   `modules/roland-sxx0-editor/src/components/ui/EnvelopeDisplay.tsx`
 * into its `@/`-alias form:
 *   `@/components/ui/EnvelopeDisplay`
 *
 * Per the project's TypeScript path-alias convention (CLAUDE.md): the
 * `@/` prefix resolves to each module's `src/` root. Returns null if
 * the path doesn't match the convention (e.g., a file directly under
 * `tools/`).
 */
function toAliasSpec(relPath: string): string | null {
  const match = /^modules\/[^/]+\/src\/(.+)$/.exec(relPath);
  if (match === null) return null;
  const insideSrc = match[1];
  return `@/${stripExtension(insideSrc)}`;
}

function stripExtension(path: string): string {
  const ext = extname(path);
  return ext.length === 0 ? path : path.substring(0, path.length - ext.length);
}

interface ImportMatch {
  readonly line: number;
}

/**
 * Find the first importer match in a file's content. Returns the
 * 1-based line number of the match, or null if no match.
 */
function findFirstImport(content: string, importRe: RegExp): ImportMatch | null {
  importRe.lastIndex = 0;
  const match = importRe.exec(content);
  if (match === null) return null;
  const upto = content.substring(0, match.index);
  const line = upto.split('\n').length;
  return { line };
}

function byDeprecatedPath(a: DeprecatedFile, b: DeprecatedFile): number {
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
}

function byPathThenLine(a: DeprecatedImporter, b: DeprecatedImporter): number {
  if (a.path !== b.path) return a.path < b.path ? -1 : 1;
  return a.line - b.line;
}

function toRepoRel(abs: string, rootAbs: string): string {
  if (abs === rootAbs) return '';
  if (abs.startsWith(rootAbs + '/')) return abs.substring(rootAbs.length + 1);
  return abs;
}

async function readFileSafe(path: string): Promise<string> {
  try {
    const fileStat = await stat(path);
    if (fileStat.size === 0) return '';
    return await readFile(path, 'utf8');
  } catch (err) {
    throw new Error(`deprecation-scan: failed to read ${path}: ${errorMessage(err)}`);
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}
