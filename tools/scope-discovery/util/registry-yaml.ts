/**
 * tools/scope-discovery/util/registry-yaml.ts
 *
 * Shared YAML-registry parsing helpers used by the scope-discovery
 * scanners. Both `anti-patterns-registry.ts` (T6.1) and
 * `adopter-manifests-registry.ts` (T6.2) load a top-level list under
 * a known key, walk each raw entry through a per-registry per-entry
 * parser, and enforce unique kebab-case ids. This module owns the
 * file-read + YAML-parse + top-level-shape extraction + walker shape;
 * each scanner provides the (a) namespace prefix used in error
 * messages, (b) top-level key, and (c) per-entry parser.
 *
 * Extracted at T6.2 to avoid copy-paste of T6.1's `loadRegistry` /
 * `parseRegistry` walker. Per the project rules screaming DRY: this
 * module is the canonical entry-point; new registries should consume
 * `loadKeyedListRegistry` rather than reinventing the walker.
 */

import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { errorMessage, isPlainObject } from './typeguards.js';

/** Regex for `id` — kebab-case (lowercase letters, digits, hyphens; no leading/trailing/double hyphens). */
export const KEBAB_CASE_ID_RE = /^[a-z0-9](?:-?[a-z0-9]+)*$/;

/** Regex for git SHA-like fields (e.g., `added_in`, `introduced_in`) — 7-40 chars of lowercase hex. */
export const GIT_SHA_RE = /^[0-9a-f]{7,40}$/;

/**
 * Per-registry contract. The scanner provides:
 *   - `namespace`: prefix on every error message (e.g., "anti-patterns").
 *   - `topLevelKey`: the YAML key whose value is the entry list
 *     (e.g., "anti_patterns", "adopter_manifests").
 *   - `parseEntry`: maps one raw entry (already-narrowed to a plain
 *     object) into the typed entry shape. Throws with a prefixed
 *     message on validation failure. The walker calls this once per
 *     raw entry and aggregates the return values, enforcing unique
 *     ids across the entry list.
 */
export interface RegistrySchema<TEntry extends { readonly id: string }> {
  readonly namespace: string;
  readonly topLevelKey: string;
  parseEntry(raw: Record<string, unknown>, ctx: string): TEntry;
}

export interface ParsedKeyedListRegistry<TEntry> {
  readonly entries: readonly TEntry[];
}

/** Read + parse a keyed-list registry from disk. */
export async function loadKeyedListRegistry<TEntry extends { readonly id: string }>(
  path: string,
  schema: RegistrySchema<TEntry>,
): Promise<ParsedKeyedListRegistry<TEntry>> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (err) {
    throw new Error(`${schema.namespace}: cannot read ${path}: ${errorMessage(err)}`);
  }
  return parseKeyedListRegistry(raw, path, schema);
}

/**
 * Parse a keyed-list registry from a YAML string. Separate from
 * `loadKeyedListRegistry` so the adversarial validators can plant
 * fixtures in memory without touching disk.
 */
export function parseKeyedListRegistry<TEntry extends { readonly id: string }>(
  yamlText: string,
  sourcePath: string,
  schema: RegistrySchema<TEntry>,
): ParsedKeyedListRegistry<TEntry> {
  let doc: unknown;
  try {
    doc = parseYaml(yamlText);
  } catch (err) {
    throw new Error(
      `${schema.namespace}: YAML parse error in ${sourcePath}: ${errorMessage(err)}`,
    );
  }
  if (doc === null || doc === undefined) {
    // Empty file is treated as "no entries"; matches the workplan's
    // "empty registry → exit 0" contract.
    return { entries: [] };
  }
  if (!isPlainObject(doc)) {
    throw new Error(
      `${schema.namespace}: top-level value in ${sourcePath} must be a mapping; got ${typeof doc}`,
    );
  }
  const rawEntries = doc[schema.topLevelKey];
  if (rawEntries === undefined || rawEntries === null) {
    return { entries: [] };
  }
  if (!Array.isArray(rawEntries)) {
    throw new Error(
      `${schema.namespace}: ${sourcePath} \`${schema.topLevelKey}\` must be a list; got ${typeof rawEntries}`,
    );
  }
  const entries: TEntry[] = [];
  const seenIds = new Set<string>();
  rawEntries.forEach((rawEntry, index) => {
    const ctx = `${sourcePath} entry #${index}`;
    if (!isPlainObject(rawEntry)) {
      throw new Error(
        `${schema.namespace}: ${ctx} must be a mapping; got ${typeof rawEntry}`,
      );
    }
    const entry = schema.parseEntry(rawEntry, ctx);
    if (seenIds.has(entry.id)) {
      throw new Error(
        `${schema.namespace}: ${ctx} duplicates id "${entry.id}"`,
      );
    }
    seenIds.add(entry.id);
    entries.push(entry);
  });
  return { entries };
}

/**
 * Pull a required non-empty string field from a raw YAML record.
 * Throws a namespaced error with the entry context on miss / wrong type.
 */
export function requireString(
  record: Record<string, unknown>,
  key: string,
  ctx: string,
  namespace: string,
): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${namespace}: ${ctx} requires non-empty string \`${key}\``);
  }
  return value;
}

/**
 * Validate an `id` field — kebab-case. Helper because both T6.1 and
 * T6.2 use the same identifier shape; further scanners should reuse
 * this rather than redefining the regex.
 */
export function validateKebabId(id: string, ctx: string, namespace: string): void {
  if (!KEBAB_CASE_ID_RE.test(id)) {
    throw new Error(`${namespace}: ${ctx} \`id\` must be kebab-case; got "${id}"`);
  }
}

/**
 * Validate a git-SHA-like field (7-40 lowercase hex chars). Helper
 * because both T6.1's `added_in` and T6.2's `introduced_in` use this
 * shape; future scanners should reuse rather than redefine.
 */
export function validateGitSha(value: string, fieldName: string, ctx: string, namespace: string): void {
  if (!GIT_SHA_RE.test(value)) {
    throw new Error(
      `${namespace}: ${ctx} \`${fieldName}\` must be 7-40 lowercase hex chars; got "${value}"`,
    );
  }
}
