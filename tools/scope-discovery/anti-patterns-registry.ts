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
 *       message: <multi-line replacement instruction>
 *
 * Parse-time validation rejects:
 *   - non-object entries
 *   - missing/malformed required fields
 *   - empty regex pattern list
 *   - unparseable regex
 *   - non-positive min_distance
 *
 * Returns a `ParsedRegistry` with the entries narrowed to concrete shapes
 * (single-pattern vs multi-pattern fingerprint), with regexes pre-compiled.
 *
 * File-read + YAML-walk + unique-id enforcement live in
 * `util/registry-yaml.ts` (shared with T6.2's adopter-manifests
 * registry); this module only owns the per-entry shape + regex compile.
 */

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

/**
 * One entry in the registry, with regex pre-compiled.
 * Single-pattern fingerprints carry `patterns.length === 1`; multi-pattern
 * fingerprints carry length >= 2 and `minDistance > 0`.
 */
export interface AntiPatternEntry {
  readonly id: string;
  readonly addedIn: string;
  readonly primitive: string;
  readonly from: string;
  readonly patterns: readonly RegExp[];
  readonly minDistance: number;
  readonly message: string;
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
  return { id, addedIn, primitive, from, patterns, minDistance, message };
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
