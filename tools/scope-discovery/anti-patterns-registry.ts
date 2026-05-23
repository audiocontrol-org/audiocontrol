/**
 * tools/scope-discovery/anti-patterns-registry.ts
 *
 * Parser + types for `docs/scope-discovery/anti-patterns.yaml`
 * (workplan T6.1). Shape lives in a sibling module from the scanner so the
 * adversarial validator can import and exercise the parsing logic
 * independently of the file-scan path.
 *
 * Registry schema (see anti-patterns.yaml header for full prose):
 *
 *   anti_patterns:
 *     - id: <kebab-case>
 *       added_in: <7-40 hex chars>
 *       primitive: <hook/component name>
 *       from: <import path>
 *       shape_regex: <regex string OR list of regex strings>
 *       min_distance: <int; optional; defaults to DEFAULT_MIN_DISTANCE>
 *       excludes_paths: <optional list of literal paths or globs>
 *       message: <multi-line replacement instruction>
 *
 * Parse-time validation rejects:
 *   - non-object entries
 *   - missing/malformed required fields
 *   - empty regex pattern list
 *   - unparseable regex
 *   - non-positive min_distance
 *   - excludes_paths whose entries are not non-empty strings
 *
 * Returns a `ParsedRegistry` with the entries narrowed to concrete shapes
 * (single-pattern vs multi-pattern fingerprint), with regexes pre-compiled.
 *
 * File-read + YAML-walk + unique-id enforcement live in
 * `util/registry-yaml.ts` (shared with T6.2's adopter-manifests
 * registry); this module only owns the per-entry shape + regex compile.
 */

import { globToRegex } from './util/glob.js';
import { errorMessage } from './util/typeguards.js';
import {
  loadKeyedListRegistry,
  parseKeyedListRegistry,
  requireString,
  validateGitSha,
  validateKebabId,
  type ParsedKeyedListRegistry,
  type RegistrySchema,
} from './util/registry-yaml.js';

/** Default max line gap between regex matches when `shape_regex` is a list. */
export const DEFAULT_MIN_DISTANCE = 50;

/** Required regex flags — global so we find every occurrence, multi-line so ^/$ work per-line. */
const REGEX_FLAGS = 'gm';

const NAMESPACE = 'anti-patterns';
const TOP_LEVEL_KEY = 'anti_patterns';

/** One entry in the optional `excludes_paths:` list, pre-compiled. */
export interface ExcludePath {
  /** Original pattern as authored (literal path OR glob). */
  readonly pattern: string;
  /** Compiled regex matched against a candidate file's CWD-relative POSIX path. */
  readonly regex: RegExp;
}

/**
 * One entry in the registry, with regex pre-compiled.
 * Single-pattern fingerprints carry `patterns.length === 1`; multi-pattern
 * fingerprints carry length >= 2 and `minDistance > 0`.
 * `excludesPaths` is empty when the entry has no `excludes_paths:` field.
 */
export interface AntiPatternEntry {
  readonly id: string;
  readonly addedIn: string;
  readonly primitive: string;
  readonly from: string;
  readonly patterns: readonly RegExp[];
  readonly minDistance: number;
  readonly excludesPaths: readonly ExcludePath[];
  readonly message: string;
}

/**
 * True iff `relPath` (POSIX, relative to the scanner's CWD) matches any
 * pattern in `entry.excludesPaths`. Used by the scanner to skip a file
 * for this entry BEFORE running the shape patterns. Primary motivation:
 * a canonical primitive's own file whose body IS the legacy shape the
 * entry catches; secondary: test fixtures intentionally carrying the
 * legacy shape as evidence.
 */
export function isPathExcluded(entry: AntiPatternEntry, relPath: string): boolean {
  for (const exclude of entry.excludesPaths) {
    if (exclude.regex.test(relPath)) return true;
  }
  return false;
}

export type ParsedRegistry = ParsedKeyedListRegistry<AntiPatternEntry>;

const SCHEMA: RegistrySchema<AntiPatternEntry> = {
  namespace: NAMESPACE,
  topLevelKey: TOP_LEVEL_KEY,
  parseEntry,
};

/** Read + parse the registry from disk. Throws on parse error or schema violation. */
export async function loadRegistry(path: string): Promise<ParsedRegistry> {
  return loadKeyedListRegistry(path, SCHEMA);
}

/**
 * Parse the registry from a YAML string. Separate from `loadRegistry` so the
 * adversarial validator can plant fixtures in memory without touching disk.
 */
export function parseRegistry(yamlText: string, sourcePath: string): ParsedRegistry {
  return parseKeyedListRegistry(yamlText, sourcePath, SCHEMA);
}

function parseEntry(raw: Record<string, unknown>, ctx: string): AntiPatternEntry {
  const id = requireString(raw, 'id', ctx, NAMESPACE);
  validateKebabId(id, ctx, NAMESPACE);
  const addedIn = requireString(raw, 'added_in', ctx, NAMESPACE);
  validateGitSha(addedIn, 'added_in', ctx, NAMESPACE);
  const primitive = requireString(raw, 'primitive', ctx, NAMESPACE);
  const from = requireString(raw, 'from', ctx, NAMESPACE);
  const message = requireString(raw, 'message', ctx, NAMESPACE);
  const patterns = parsePatterns(raw['shape_regex'], ctx);
  const minDistance = parseMinDistance(raw['min_distance'], ctx);
  const excludesPaths = parseExcludesPaths(raw['excludes_paths'], ctx);
  return { id, addedIn, primitive, from, patterns, minDistance, excludesPaths, message };
}

function parsePatterns(raw: unknown, ctx: string): readonly RegExp[] {
  if (typeof raw === 'string') {
    return [compilePattern(raw, ctx, 0)];
  }
  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      throw new Error(`${NAMESPACE}: ${ctx} \`shape_regex\` list must contain >= 1 pattern`);
    }
    return raw.map((value, i) => {
      if (typeof value !== 'string') {
        throw new Error(
          `${NAMESPACE}: ${ctx} \`shape_regex[${i}]\` must be a string; got ${typeof value}`,
        );
      }
      return compilePattern(value, ctx, i);
    });
  }
  throw new Error(
    `${NAMESPACE}: ${ctx} requires \`shape_regex\` (string OR list of strings); got ${typeof raw}`,
  );
}

function compilePattern(source: string, ctx: string, index: number): RegExp {
  if (source.length === 0) {
    throw new Error(`${NAMESPACE}: ${ctx} \`shape_regex[${index}]\` must be non-empty`);
  }
  try {
    return new RegExp(source, REGEX_FLAGS);
  } catch (err) {
    throw new Error(
      `${NAMESPACE}: ${ctx} \`shape_regex[${index}]\` is not a valid regex: ${errorMessage(err)}`,
    );
  }
}

function parseMinDistance(raw: unknown, ctx: string): number {
  if (raw === undefined || raw === null) {
    return DEFAULT_MIN_DISTANCE;
  }
  if (typeof raw !== 'number' || !Number.isFinite(raw) || !Number.isInteger(raw) || raw <= 0) {
    throw new Error(
      `${NAMESPACE}: ${ctx} \`min_distance\` must be a positive integer; got ${String(raw)}`,
    );
  }
  return raw;
}

/**
 * Parse the optional `excludes_paths:` field. Missing field OR empty array
 * → no exclusions (returns `[]`). Each element is a literal-path or glob
 * string, compiled via `globToRegex` (literal paths are valid globs).
 * Non-array values or non-string elements raise a descriptive parse error.
 *
 * "A glob that matches nothing" is intentionally NOT an error here — it
 * matches the adopter-manifests stance on globs and keeps the registry
 * tolerant to file renames that the operator will fix on the next run.
 */
function parseExcludesPaths(raw: unknown, ctx: string): readonly ExcludePath[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new Error(
      `${NAMESPACE}: ${ctx} \`excludes_paths\` must be a list; got ${typeof raw}`,
    );
  }
  return raw.map((value, index) => {
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(
        `${NAMESPACE}: ${ctx} \`excludes_paths[${index}]\` must be a non-empty string; got ${typeof value}`,
      );
    }
    let regex: RegExp;
    try {
      regex = globToRegex(value);
    } catch (err) {
      throw new Error(
        `${NAMESPACE}: ${ctx} \`excludes_paths[${index}]\` is not a valid glob: ${errorMessage(err)}`,
      );
    }
    return { pattern: value, regex };
  });
}
