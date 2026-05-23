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
 *       from: <canonical import path>
 *       expected_adopters_glob:
 *         - <glob string>
 *         - <glob string>
 *       exceptions:
 *         - path: <exact repo-relative file path>
 *           reason: <multi-line explanation>
 *       message: <multi-line replacement instruction>
 *
 * Parse-time validation rejects:
 *   - non-object entries
 *   - missing/malformed required fields
 *   - empty / non-string globs
 *   - exceptions whose `path` is empty or whose `reason` is empty
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
  /** Canonical import path the entry asserts (e.g., '@/components/SlideDrawer'). */
  readonly from: string;
  /** Pre-compiled adopter globs; at least one. */
  readonly globs: readonly AdopterGlob[];
  /** Exception list; empty when no exceptions are declared. */
  readonly exceptions: readonly AdopterException[];
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
  const from = requireString(raw, 'from', ctx, NAMESPACE);
  const message = requireString(raw, 'message', ctx, NAMESPACE);
  const globs = parseGlobs(raw['expected_adopters_glob'], ctx);
  const exceptions = parseExceptions(raw['exceptions'], ctx);
  validateExceptionsMatchGlobs(exceptions, globs, ctx);
  return { id, introducedIn, from, globs, exceptions, message };
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

/**
 * Exceptions must point to a path that matches at least one of the
 * manifest's globs. An exception whose `path` doesn't match any glob is
 * useless (it would be ignored by the holdout calculation anyway) and
 * almost certainly a typo, so we fail-fast at parse time per the
 * workplan's "report malformed entries" requirement.
 */
function validateExceptionsMatchGlobs(
  exceptions: readonly AdopterException[],
  globs: readonly AdopterGlob[],
  ctx: string,
): void {
  for (const ex of exceptions) {
    const matched = globs.some((g) => g.regex.test(ex.path));
    if (!matched) {
      throw new Error(
        `${NAMESPACE}: ${ctx} exception \`${ex.path}\` does not match any of \`expected_adopters_glob\`; ` +
          `the exception would be inert (the holdout calculation only looks at files that match a glob).`,
      );
    }
  }
}
