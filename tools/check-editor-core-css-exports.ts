/**
 * tools/check-editor-core-css-exports.ts
 *
 * Editor-core CSS-exports gate (akai-harmonization workplan task 2.9).
 *
 * Asserts that every `modules/editor-core/src/design/*.css` file is
 * exported via the `exports:` block of `modules/editor-core/package.json`,
 * AND that every CSS-shaped exports entry points to an existing file
 * on disk under `src/design/`. Catches two symmetric failure modes
 * that were previously caught only by visual review or downstream
 * consumer breakage:
 *
 *   (a) Promote a new primitive (e.g., `list-primitives.css`) but
 *       forget to add the `./list-primitives.css` exports entry.
 *       The file is `@import`-ed via the umbrella `styles.css` so
 *       it appears to work inside editor-core, but external editors
 *       that want the primitive standalone hit ERR_PACKAGE_PATH_NOT_EXPORTED.
 *
 *   (b) Delete a CSS file but leave the matching `exports:` entry.
 *       The dangling entry rots silently until a consumer attempts
 *       the standalone import and hits a path-resolution error.
 *
 * Engine: parses `modules/editor-core/package.json` as JSON (no
 * regex over the source text); walks `modules/editor-core/src/design/`
 * for every `*.css` file (single-directory listing, no recursion —
 * the design layer is flat by convention); cross-references the two
 * sets and reports violations of either direction.
 *
 * The umbrella `./styles.css` export resolves to the same file as
 * `src/design/styles.css`, and the export keys mirror the basename:
 * the convention enforced by this gate is
 *   `"./<basename>.css": "./src/design/<basename>.css"`.
 *
 * CLI surface (mirrors the scope-discovery scanners so the validator
 * can spawn this entry against fixture directories):
 *
 *   tsx tools/check-editor-core-css-exports.ts \
 *     [--design-dir <path>] [--package-json <path>] [--json]
 *
 *   --design-dir   path to the directory holding `*.css` files
 *                  (default: modules/editor-core/src/design)
 *   --package-json path to the package.json whose `exports:` block
 *                  declares the CSS entries
 *                  (default: modules/editor-core/package.json)
 *   --json         emit a machine-readable report instead of human text
 *
 * Exit codes: 0 = every CSS file has an entry AND every entry points
 * to an existing file; 1 = one or more violations (missing entry,
 * dangling entry, or both); 2 = infra error (unreadable package.json,
 * malformed JSON, missing design dir).
 *
 * Pre-commit (`.githooks/pre-commit`) invokes this via
 * `make check-editor-core-css-exports` whenever staged changes touch
 * `modules/editor-core/src/design/*.css` OR `modules/editor-core/package.json`.
 */

import { readdir, readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { errorMessage, isPlainObject } from './scope-discovery/util/typeguards.js';

const DEFAULT_DESIGN_DIR = 'modules/editor-core/src/design';
const DEFAULT_PACKAGE_JSON = 'modules/editor-core/package.json';

export interface CliOptions {
  readonly designDir: string;
  readonly packageJsonPath: string;
  readonly json: boolean;
}

export interface MissingEntry {
  readonly cssBasename: string;
  readonly expectedKey: string;
  readonly expectedValue: string;
}

export interface DanglingEntry {
  readonly key: string;
  readonly value: string;
  readonly resolvedAbsolutePath: string;
}

export interface GateResult {
  readonly designDir: string;
  readonly packageJsonPath: string;
  readonly cssCount: number;
  readonly exportEntryCount: number;
  readonly missingEntries: readonly MissingEntry[];
  readonly danglingEntries: readonly DanglingEntry[];
}

export function parseCli(argv: readonly string[]): CliOptions {
  let designDir = DEFAULT_DESIGN_DIR;
  let packageJsonPath = DEFAULT_PACKAGE_JSON;
  let json = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--design-dir':
        designDir = argv[i + 1] ?? designDir;
        i += 1;
        break;
      case '--package-json':
        packageJsonPath = argv[i + 1] ?? packageJsonPath;
        i += 1;
        break;
      case '--json':
        json = true;
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }
  return { designDir, packageJsonPath, json };
}

/**
 * Walk the design directory and return every `*.css` basename. Single-
 * level listing (no recursion) — the design layer is flat by convention;
 * any nested directory under `src/design/` would be a new design-layer
 * sub-namespace that should land with its own gate adjustment.
 */
async function listCssFiles(designDir: string): Promise<readonly string[]> {
  const entries = await readdir(designDir, { withFileTypes: true });
  const cssFiles: string[] = [];
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.css')) {
      cssFiles.push(entry.name);
    }
  }
  cssFiles.sort();
  return cssFiles;
}

/**
 * Parse `package.json` and extract the `exports:` map as a record of
 * key (subpath) -> value (target string). Only string-valued targets
 * are returned; the conditional object form (e.g.,
 * `{ "types": "...", "import": "..." }`) is reserved for JS/TS entries
 * and does not apply to CSS files in editor-core's current shape.
 *
 * Returns ONLY entries WHOSE TARGET VALUE points under the design
 * directory (computed relative to the package.json's directory). This
 * scoping is the gate's contract boundary: editor-core exports several
 * CSS-keyed entries that legitimately point OUTSIDE the design layer
 * (e.g., `./dev/styles.css` -> `./src/dev/styles.css` for the
 * separately-versioned dev preview). Those are out of scope for this
 * gate; the gate only governs the design-layer pairing.
 */
async function readCssExports(
  packageJsonPath: string,
  designDir: string,
): Promise<ReadonlyMap<string, string>> {
  const text = await readFile(packageJsonPath, 'utf8');
  const parsed: unknown = JSON.parse(text);
  if (!isPlainObject(parsed)) {
    throw new Error(`package.json root must be an object: ${packageJsonPath}`);
  }
  const exportsField = parsed.exports;
  if (!isPlainObject(exportsField)) {
    throw new Error(
      `package.json must declare an object-valued "exports" field: ${packageJsonPath}`,
    );
  }
  const packageJsonDir = resolve(packageJsonPath, '..');
  const absDesignDir = resolve(designDir);
  const cssExports = new Map<string, string>();
  for (const [key, value] of Object.entries(exportsField)) {
    if (!key.endsWith('.css')) continue;
    if (typeof value !== 'string') {
      // CSS entries use the bare-string form. Conditional-object form
      // would imply per-environment routing that has no current
      // editor-core use case — reject loudly so the schema mismatch
      // is surfaced rather than silently dropped.
      throw new Error(
        `CSS export "${key}" must use the bare-string target form; got: ${JSON.stringify(value)}`,
      );
    }
    // Scope filter: only entries targeting files under the design dir
    // are within the gate's contract. The target value is resolved
    // against the package.json's directory (mirroring how Node's
    // exports resolution treats subpath targets) and tested for
    // descendant-ness via path-segment prefix match.
    const resolvedTarget = resolve(packageJsonDir, value);
    if (!isUnderDir(resolvedTarget, absDesignDir)) continue;
    cssExports.set(key, value);
  }
  return cssExports;
}

/**
 * Return true when `candidateAbs` is the same as or a descendant of
 * `parentAbs`. Both inputs MUST be absolute paths. Uses path-segment
 * comparison rather than string-prefix so that
 *   `/a/b/c-d.css` is NOT under `/a/b/c`
 * (the false-prefix trap of naive `startsWith`).
 */
function isUnderDir(candidateAbs: string, parentAbs: string): boolean {
  const candParts = candidateAbs.split('/').filter(Boolean);
  const parentParts = parentAbs.split('/').filter(Boolean);
  if (candParts.length < parentParts.length) return false;
  for (let i = 0; i < parentParts.length; i += 1) {
    if (candParts[i] !== parentParts[i]) return false;
  }
  return true;
}

/**
 * Cross-reference the on-disk CSS file list against the exports map.
 * Direction (a): every CSS file must have a matching entry whose key
 *   is `./<basename>` and whose value is `./src/design/<basename>`.
 * Direction (b): every CSS-keyed exports entry must point to a file
 *   that exists on disk (resolved against the package.json's directory).
 *
 * The expected value is computed relative to the package.json's
 * own directory (i.e., `modules/editor-core/`), so a fixture
 * package.json sitting next to a fixture `src/design/` works the
 * same way the production layout does.
 */
function diffExportsAgainstFiles(
  cssFiles: readonly string[],
  cssExports: ReadonlyMap<string, string>,
  designDir: string,
  packageJsonDir: string,
): { missing: readonly MissingEntry[]; dangling: readonly DanglingEntry[] } {
  const missing: MissingEntry[] = [];
  const dangling: DanglingEntry[] = [];

  // Compute the relative path from the package.json's directory to the
  // design directory so the expected `exports:` value is independent
  // of how the operator invoked the gate (relative cwd vs absolute).
  const absDesignDir = resolve(designDir);
  const absPackageJsonDir = resolve(packageJsonDir);
  const designRelToPackage = relativeFromTo(absPackageJsonDir, absDesignDir);

  for (const cssBasename of cssFiles) {
    const expectedKey = `./${cssBasename}`;
    const expectedValue = `./${designRelToPackage}/${cssBasename}`;
    const actualValue = cssExports.get(expectedKey);
    if (actualValue === undefined) {
      missing.push({ cssBasename, expectedKey, expectedValue });
      continue;
    }
    if (actualValue !== expectedValue) {
      // The entry exists but points somewhere unexpected. Surface it as
      // a missing entry with the actual value alongside, so the operator
      // sees both the convention violation and the dangling-path risk.
      missing.push({ cssBasename, expectedKey, expectedValue });
    }
  }

  const cssFileSet = new Set(cssFiles);
  for (const [key, value] of cssExports) {
    // Key form: "./<basename>.css". Strip the leading "./" to derive
    // the basename and check whether the file exists in the listing.
    const keyBasename = basename(key);
    if (!cssFileSet.has(keyBasename)) {
      const resolvedAbsolutePath = resolve(absPackageJsonDir, value);
      dangling.push({ key, value, resolvedAbsolutePath });
    }
  }

  return { missing, dangling };
}

/**
 * Compute `to` relative to `from`. Node's `path.relative` does this
 * but emits OS-native separators; we always want forward slashes so
 * the value matches the package.json export convention regardless of
 * platform. Both inputs MUST be absolute paths.
 */
function relativeFromTo(fromAbs: string, toAbs: string): string {
  // Trim shared prefix on path-segment boundaries.
  const fromParts = fromAbs.split('/').filter(Boolean);
  const toParts = toAbs.split('/').filter(Boolean);
  let i = 0;
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
    i += 1;
  }
  const upCount = fromParts.length - i;
  const downParts = toParts.slice(i);
  const segments: string[] = [];
  for (let u = 0; u < upCount; u += 1) segments.push('..');
  for (const d of downParts) segments.push(d);
  return segments.length === 0 ? '.' : segments.join('/');
}

export async function runGate(opts: CliOptions): Promise<GateResult> {
  const cssFiles = await listCssFiles(opts.designDir);
  const cssExports = await readCssExports(opts.packageJsonPath, opts.designDir);
  // Derive the package.json's directory from its file path. Used by
  // diffExportsAgainstFiles to compute the expected target value and
  // to resolve dangling-entry paths for the human-readable report.
  const packageJsonDir = resolve(opts.packageJsonPath, '..');
  const { missing, dangling } = diffExportsAgainstFiles(
    cssFiles,
    cssExports,
    opts.designDir,
    packageJsonDir,
  );
  return {
    designDir: opts.designDir,
    packageJsonPath: opts.packageJsonPath,
    cssCount: cssFiles.length,
    exportEntryCount: cssExports.size,
    missingEntries: missing,
    danglingEntries: dangling,
  };
}

function renderText(result: GateResult): string {
  const lines: string[] = [];
  lines.push(`[editor-core-css-exports] design dir: ${result.designDir}`);
  lines.push(`[editor-core-css-exports] package.json: ${result.packageJsonPath}`);
  lines.push(
    `[editor-core-css-exports] ${result.cssCount} CSS file(s); ${result.exportEntryCount} CSS export entrie(s)`,
  );
  if (result.missingEntries.length === 0 && result.danglingEntries.length === 0) {
    lines.push(
      `[editor-core-css-exports] OK — every CSS file has a matching exports entry`,
    );
    return lines.join('\n') + '\n';
  }
  lines.push('');
  if (result.missingEntries.length > 0) {
    lines.push(
      `[editor-core-css-exports] FAIL — ${result.missingEntries.length} CSS file(s) missing exports entry:`,
    );
    for (const m of result.missingEntries) {
      lines.push(`  - ${m.cssBasename}`);
      lines.push(`      add to package.json "exports":`);
      lines.push(`        "${m.expectedKey}": "${m.expectedValue}"`);
    }
    lines.push('');
  }
  if (result.danglingEntries.length > 0) {
    lines.push(
      `[editor-core-css-exports] FAIL — ${result.danglingEntries.length} exports entrie(s) point to missing files:`,
    );
    for (const d of result.danglingEntries) {
      lines.push(`  - "${d.key}": "${d.value}"`);
      lines.push(`      resolves to: ${d.resolvedAbsolutePath}`);
      lines.push(`      (no such file — either restore the file or delete the entry)`);
    }
    lines.push('');
  }
  lines.push(
    `Promoting a new editor-core/src/design/*.css file requires a paired`,
  );
  lines.push(
    `entry in modules/editor-core/package.json "exports:". Deleting one`,
  );
  lines.push(`requires removing the entry. The gate enforces both directions.`);
  return lines.join('\n') + '\n';
}

async function main(): Promise<number> {
  let opts: CliOptions;
  try {
    opts = parseCli(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(
      `check-editor-core-css-exports: argv error: ${errorMessage(err)}\n`,
    );
    return 2;
  }
  let result: GateResult;
  try {
    result = await runGate(opts);
  } catch (err) {
    process.stderr.write(
      `check-editor-core-css-exports: infra error: ${errorMessage(err)}\n`,
    );
    return 2;
  }
  const ok = result.missingEntries.length === 0 && result.danglingEntries.length === 0;
  if (opts.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    const text = renderText(result);
    if (ok) {
      process.stdout.write(text);
    } else {
      process.stderr.write(text);
    }
  }
  return ok ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    process.stderr.write(
      `check-editor-core-css-exports crashed: ${errorMessage(err)}\n`,
    );
    process.exit(2);
  },
);
