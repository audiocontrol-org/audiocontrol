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
 */

import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { errorMessage, isPlainObject } from './util/typeguards.js';

/** Default max line gap between regex matches when `shape_regex` is a list. */
export const DEFAULT_MIN_DISTANCE = 50;

/** Required regex flags — global so we find every occurrence, multi-line so ^/$ work per-line. */
const REGEX_FLAGS = 'gm';

/** Regex for `added_in` — 7-40 chars of lowercase hex (git short → full SHA range). */
const ADDED_IN_RE = /^[0-9a-f]{7,40}$/;

/** Regex for `id` — kebab-case (lowercase letters, digits, hyphens; no leading/trailing/double hyphens). */
const ID_RE = /^[a-z0-9](?:-?[a-z0-9]+)*$/;

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

export interface ParsedRegistry {
  readonly entries: readonly AntiPatternEntry[];
}

/** Read + parse the registry from disk. Throws on parse error or schema violation. */
export async function loadRegistry(path: string): Promise<ParsedRegistry> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (err) {
    throw new Error(`anti-patterns: cannot read ${path}: ${errorMessage(err)}`);
  }
  return parseRegistry(raw, path);
}

/**
 * Parse the registry from a YAML string. Separate from `loadRegistry` so the
 * adversarial validator can plant fixtures in memory without touching disk.
 */
export function parseRegistry(yamlText: string, sourcePath: string): ParsedRegistry {
  let doc: unknown;
  try {
    doc = parseYaml(yamlText);
  } catch (err) {
    throw new Error(`anti-patterns: YAML parse error in ${sourcePath}: ${errorMessage(err)}`);
  }
  if (doc === null || doc === undefined) {
    // Empty file is treated as "no entries"; matches the workplan's
    // "empty registry → exit 0" contract.
    return { entries: [] };
  }
  if (!isPlainObject(doc)) {
    throw new Error(
      `anti-patterns: top-level value in ${sourcePath} must be a mapping; got ${typeof doc}`,
    );
  }
  const rawEntries = doc['anti_patterns'];
  if (rawEntries === undefined || rawEntries === null) {
    return { entries: [] };
  }
  if (!Array.isArray(rawEntries)) {
    throw new Error(
      `anti-patterns: ${sourcePath} \`anti_patterns\` must be a list; got ${typeof rawEntries}`,
    );
  }
  const entries: AntiPatternEntry[] = [];
  const seenIds = new Set<string>();
  rawEntries.forEach((raw, index) => {
    const entry = parseEntry(raw, sourcePath, index);
    if (seenIds.has(entry.id)) {
      throw new Error(
        `anti-patterns: ${sourcePath} entry #${index} duplicates id "${entry.id}"`,
      );
    }
    seenIds.add(entry.id);
    entries.push(entry);
  });
  return { entries };
}

function parseEntry(raw: unknown, source: string, index: number): AntiPatternEntry {
  const ctx = `${source} entry #${index}`;
  if (!isPlainObject(raw)) {
    throw new Error(`anti-patterns: ${ctx} must be a mapping; got ${typeof raw}`);
  }
  const id = requireString(raw, 'id', ctx);
  if (!ID_RE.test(id)) {
    throw new Error(`anti-patterns: ${ctx} \`id\` must be kebab-case; got "${id}"`);
  }
  const addedIn = requireString(raw, 'added_in', ctx);
  if (!ADDED_IN_RE.test(addedIn)) {
    throw new Error(
      `anti-patterns: ${ctx} \`added_in\` must be 7-40 lowercase hex chars; got "${addedIn}"`,
    );
  }
  const primitive = requireString(raw, 'primitive', ctx);
  const from = requireString(raw, 'from', ctx);
  const message = requireString(raw, 'message', ctx);
  const patterns = parsePatterns(raw['shape_regex'], ctx);
  const minDistance = parseMinDistance(raw['min_distance'], ctx);
  return { id, addedIn, primitive, from, patterns, minDistance, message };
}

function requireString(record: Record<string, unknown>, key: string, ctx: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`anti-patterns: ${ctx} requires non-empty string \`${key}\``);
  }
  return value;
}

function parsePatterns(raw: unknown, ctx: string): readonly RegExp[] {
  if (typeof raw === 'string') {
    return [compilePattern(raw, ctx, 0)];
  }
  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      throw new Error(`anti-patterns: ${ctx} \`shape_regex\` list must contain >= 1 pattern`);
    }
    return raw.map((value, i) => {
      if (typeof value !== 'string') {
        throw new Error(
          `anti-patterns: ${ctx} \`shape_regex[${i}]\` must be a string; got ${typeof value}`,
        );
      }
      return compilePattern(value, ctx, i);
    });
  }
  throw new Error(
    `anti-patterns: ${ctx} requires \`shape_regex\` (string OR list of strings); got ${typeof raw}`,
  );
}

function compilePattern(source: string, ctx: string, index: number): RegExp {
  if (source.length === 0) {
    throw new Error(`anti-patterns: ${ctx} \`shape_regex[${index}]\` must be non-empty`);
  }
  try {
    return new RegExp(source, REGEX_FLAGS);
  } catch (err) {
    throw new Error(
      `anti-patterns: ${ctx} \`shape_regex[${index}]\` is not a valid regex: ${errorMessage(err)}`,
    );
  }
}

function parseMinDistance(raw: unknown, ctx: string): number {
  if (raw === undefined || raw === null) {
    return DEFAULT_MIN_DISTANCE;
  }
  if (typeof raw !== 'number' || !Number.isFinite(raw) || !Number.isInteger(raw) || raw <= 0) {
    throw new Error(
      `anti-patterns: ${ctx} \`min_distance\` must be a positive integer; got ${String(raw)}`,
    );
  }
  return raw;
}
