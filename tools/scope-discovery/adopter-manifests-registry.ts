/**
 * tools/scope-discovery/adopter-manifests-registry.ts
 *
 * Parser + types for `docs/scope-discovery/adopter-manifests.yaml`
 * (workplan T6.2). Adopter manifests pair with anti-patterns: anti-
 * patterns find LEGACY shapes that should be REPLACED; adopter
 * manifests find FILES that should be USING a canonical primitive but
 * aren't (regime-holdout / missing-adopter case).
 *
 * Registry schema (see adopter-manifests.yaml header for full prose):
 *
 *   adopter_manifests:
 *     - id: <kebab-case-id>
 *       introduced_in: <7-40 lowercase hex>
 *       from: <canonical import path STRING or LIST OF STRINGS>
 *       expected_adopters_glob:
 *         - <glob string>
 *         - <glob string>
 *       exceptions:                  # permanent opt-outs
 *         - path: <exact repo-relative file path>
 *           reason: <multi-line explanation>
 *       tracked_holdouts:            # deferred-but-known holdouts (AUDIT-06)
 *         - path: <exact repo-relative file path>
 *           issue: <URL / GitHub-ref of the tracking issue>
 *           reason: <multi-line explanation>
 *       message: <multi-line replacement instruction>
 *
 * `from:` (AUDIT-08): may be a single non-empty string (back-compat)
 * OR a non-empty list of non-empty strings. The list form supports
 * cross-module primitive promotion (e.g., `@/components/common/X`
 * promoted to `@audiocontrol/editor-core`): list BOTH paths during the
 * transition so consumers importing via EITHER path count as adopters
 * and the gate does not produce false holdouts. A single string parses
 * to a one-element array internally; ordering is preserved so the
 * first element is the "primary" canonical path used for display in
 * the report layers.
 *
 * Parse-time validation rejects:
 *   - non-object entries
 *   - missing/malformed required fields
 *   - empty / non-string globs
 *   - `from:` that is neither a non-empty string nor a non-empty list
 *     of non-empty strings
 *   - exceptions whose `path` is empty or whose `reason` is empty
 *   - tracked-holdouts missing any of `path` / `issue` / `reason`
 *   - tracked-holdouts whose `path` doesn't match any glob
 *   - paths listed in BOTH `exceptions:` and `tracked_holdouts:`
 *   - duplicate ids
 *
 * File-read + YAML-walk + unique-id enforcement live in
 * `util/registry-yaml.ts` (shared with T6.1).
 */

import { globToRegex } from './util/glob.js';
import {
  loadKeyedListRegistry,
  parseKeyedListRegistry,
  requireString,
  validateGitSha,
  validateKebabId,
  type ParsedKeyedListRegistry,
  type RegistrySchema,
} from './util/registry-yaml.js';
import { errorMessage, isPlainObject } from './util/typeguards.js';

const NAMESPACE = 'adopter-manifests';
const TOP_LEVEL_KEY = 'adopter_manifests';

/** One exception entry inside an adopter-manifest. */
export interface AdopterException {
  /** Exact repo-relative POSIX path of the file excluded from holdout reporting. */
  readonly path: string;
  /** Multi-line explanation for why this file legitimately bypasses the primitive. */
  readonly reason: string;
}

/**
 * One tracked-holdout entry inside an adopter-manifest. Tracked holdouts
 * are files that DO need to adopt the primitive but have a tracked
 * follow-up issue deferring the migration. They are NOT findings (the
 * gate exits 0 when only tracked holdouts remain) but are surfaced in a
 * separate report section + render as a distinct `⏳` glyph in the
 * editor-symmetry matrix. The mandatory `issue:` URL prevents the field
 * from becoming a "I'll fix it later" deferral dumping ground.
 */
export interface TrackedHoldout {
  /** Exact repo-relative POSIX path of the deferred holdout file. */
  readonly path: string;
  /**
   * Tracking issue. Must be non-empty and either contain `://`
   * (URL-shaped) or start with `#` (GitHub-style cross-repo ref).
   */
  readonly issue: string;
  /** Multi-line explanation naming the deferral context. */
  readonly reason: string;
}

/** One glob in the manifest, compiled to a regex matched against repo-relative POSIX paths. */
export interface AdopterGlob {
  /** Original glob pattern as authored in the YAML. */
  readonly pattern: string;
  /** Pre-compiled regex (anchored). */
  readonly regex: RegExp;
}

/** One entry in the registry, with globs pre-compiled. */
export interface AdopterManifestEntry {
  readonly id: string;
  readonly introducedIn: string;
  /**
   * Canonical import path(s) the entry asserts. Always a non-empty
   * array: a single YAML string `from: '@/x'` normalizes to `['@/x']`;
   * a YAML list `from: ['@a/x', '@b/x']` keeps its ordering. The
   * first element is the "primary" path used for display in the
   * report (the current canonical); additional elements are
   * transitional aliases (e.g., the pre-promotion module-local path
   * that consumers may still import during a multi-step refactor).
   * Adoption detection requires ANY listed path to appear in the
   * consumer file (AUDIT-08).
   */
  readonly from: readonly string[];
  /** Pre-compiled adopter globs; at least one. */
  readonly globs: readonly AdopterGlob[];
  /** Exception list; empty when no exceptions are declared. */
  readonly exceptions: readonly AdopterException[];
  /** Tracked-holdout list; empty when no tracked holdouts are declared. */
  readonly trackedHoldouts: readonly TrackedHoldout[];
  /** Multi-line replacement message rendered when a holdout is found. */
  readonly message: string;
}

export type ParsedAdopterRegistry = ParsedKeyedListRegistry<AdopterManifestEntry>;

const SCHEMA: RegistrySchema<AdopterManifestEntry> = {
  namespace: NAMESPACE,
  topLevelKey: TOP_LEVEL_KEY,
  parseEntry,
};

/** Read + parse the registry from disk. Throws on parse error or schema violation. */
export async function loadRegistry(path: string): Promise<ParsedAdopterRegistry> {
  return loadKeyedListRegistry(path, SCHEMA);
}

/**
 * Parse the registry from a YAML string. Separate from `loadRegistry` so the
 * adversarial validator can plant fixtures in memory without touching disk.
 */
export function parseRegistry(yamlText: string, sourcePath: string): ParsedAdopterRegistry {
  return parseKeyedListRegistry(yamlText, sourcePath, SCHEMA);
}

function parseEntry(raw: Record<string, unknown>, ctx: string): AdopterManifestEntry {
  const id = requireString(raw, 'id', ctx, NAMESPACE);
  validateKebabId(id, ctx, NAMESPACE);
  const introducedIn = requireString(raw, 'introduced_in', ctx, NAMESPACE);
  validateGitSha(introducedIn, 'introduced_in', ctx, NAMESPACE);
  const from = parseFrom(raw['from'], ctx);
  const message = requireString(raw, 'message', ctx, NAMESPACE);
  const globs = parseGlobs(raw['expected_adopters_glob'], ctx);
  const exceptions = parseExceptions(raw['exceptions'], ctx);
  const trackedHoldouts = parseTrackedHoldouts(raw['tracked_holdouts'], ctx);
  validatePathsMatchGlobs(exceptions, globs, ctx, 'exception');
  validatePathsMatchGlobs(trackedHoldouts, globs, ctx, 'tracked_holdout');
  validateNoPathConflict(exceptions, trackedHoldouts, ctx);
  return { id, introducedIn, from, globs, exceptions, trackedHoldouts, message };
}

/**
 * Parse the `from:` field. Accepts EITHER a single non-empty string
 * (back-compat with pre-AUDIT-08 entries) OR a non-empty list of
 * non-empty strings (post-AUDIT-08 multi-path form for cross-module
 * primitive promotion). Always normalizes to a non-empty `string[]`.
 *
 * An empty array, an empty string element, or a non-string element
 * are all rejected with a descriptive parse error — the field is
 * load-bearing for the import-detection regex; silently dropping bad
 * entries would produce wrong holdout reports.
 */
function parseFrom(raw: unknown, ctx: string): readonly string[] {
  if (typeof raw === 'string') {
    if (raw.length === 0) {
      throw new Error(`${NAMESPACE}: ${ctx} requires non-empty string \`from\``);
    }
    return [raw];
  }
  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      throw new Error(
        `${NAMESPACE}: ${ctx} \`from\` list must contain >= 1 import path`,
      );
    }
    return raw.map((value, index) => {
      if (typeof value !== 'string' || value.length === 0) {
        throw new Error(
          `${NAMESPACE}: ${ctx} \`from[${index}]\` must be a non-empty string; got ${typeof value}`,
        );
      }
      return value;
    });
  }
  throw new Error(
    `${NAMESPACE}: ${ctx} \`from\` must be a non-empty string OR a non-empty list of strings; got ${typeof raw}`,
  );
}

function parseGlobs(raw: unknown, ctx: string): readonly AdopterGlob[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(
      `${NAMESPACE}: ${ctx} requires \`expected_adopters_glob\` (non-empty list of strings)`,
    );
  }
  return raw.map((value, index) => {
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(
        `${NAMESPACE}: ${ctx} \`expected_adopters_glob[${index}]\` must be a non-empty string`,
      );
    }
    let regex: RegExp;
    try {
      regex = globToRegex(value);
    } catch (err) {
      throw new Error(
        `${NAMESPACE}: ${ctx} \`expected_adopters_glob[${index}]\` is not a valid glob: ${errorMessage(err)}`,
      );
    }
    return { pattern: value, regex };
  });
}

function parseExceptions(raw: unknown, ctx: string): readonly AdopterException[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new Error(`${NAMESPACE}: ${ctx} \`exceptions\` must be a list; got ${typeof raw}`);
  }
  return raw.map((value, index) => {
    if (!isPlainObject(value)) {
      throw new Error(
        `${NAMESPACE}: ${ctx} \`exceptions[${index}]\` must be a mapping; got ${typeof value}`,
      );
    }
    const exCtx = `${ctx} exceptions[${index}]`;
    const path = requireString(value, 'path', exCtx, NAMESPACE);
    const reason = requireString(value, 'reason', exCtx, NAMESPACE);
    return { path, reason };
  });
}

function parseTrackedHoldouts(raw: unknown, ctx: string): readonly TrackedHoldout[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new Error(
      `${NAMESPACE}: ${ctx} \`tracked_holdouts\` must be a list; got ${typeof raw}`,
    );
  }
  return raw.map((value, index) => {
    if (!isPlainObject(value)) {
      throw new Error(
        `${NAMESPACE}: ${ctx} \`tracked_holdouts[${index}]\` must be a mapping; got ${typeof value}`,
      );
    }
    const thCtx = `${ctx} tracked_holdouts[${index}]`;
    const path = requireString(value, 'path', thCtx, NAMESPACE);
    const issue = requireString(value, 'issue', thCtx, NAMESPACE);
    if (!issue.includes('://') && !issue.startsWith('#')) {
      throw new Error(
        `${NAMESPACE}: ${thCtx} \`issue\` must be a URL (containing \`://\`) or a GitHub-style ref (starting with \`#\`); got "${issue}"`,
      );
    }
    const reason = requireString(value, 'reason', thCtx, NAMESPACE);
    return { path, issue, reason };
  });
}

/**
 * Both `exceptions:` and `tracked_holdouts:` must point to a path that
 * matches at least one of the manifest's globs. A path that doesn't
 * match any glob is useless (it would be ignored by the holdout
 * calculation anyway) and almost certainly a typo, so we fail-fast at
 * parse time per the workplan's "report malformed entries" requirement.
 *
 * `label` distinguishes which list the path came from so the parse
 * error names the right field.
 */
function validatePathsMatchGlobs(
  entries: ReadonlyArray<{ readonly path: string }>,
  globs: readonly AdopterGlob[],
  ctx: string,
  label: 'exception' | 'tracked_holdout',
): void {
  const fieldName = label === 'exception' ? 'exceptions' : 'tracked_holdouts';
  for (const entry of entries) {
    const matched = globs.some((g) => g.regex.test(entry.path));
    if (!matched) {
      throw new Error(
        `${NAMESPACE}: ${ctx} ${label} \`${entry.path}\` does not match any of \`expected_adopters_glob\`; ` +
          `the ${fieldName} entry would be inert (the holdout calculation only looks at files that match a glob).`,
      );
    }
  }
}

/**
 * A single path cannot be both a permanent exception AND a tracked
 * holdout — the two dispositions are mutually exclusive (the file is
 * either legitimately opted-out OR a known-deferred adopter). Listing
 * it in both fields is a contradiction that the operator must resolve
 * explicitly.
 */
function validateNoPathConflict(
  exceptions: readonly AdopterException[],
  trackedHoldouts: readonly TrackedHoldout[],
  ctx: string,
): void {
  const exceptionSet = new Set(exceptions.map((e) => e.path));
  for (const th of trackedHoldouts) {
    if (exceptionSet.has(th.path)) {
      throw new Error(
        `${NAMESPACE}: ${ctx} path \`${th.path}\` is listed in both \`exceptions\` and ` +
          `\`tracked_holdouts\`; these dispositions are mutually exclusive — choose one.`,
      );
    }
  }
}
