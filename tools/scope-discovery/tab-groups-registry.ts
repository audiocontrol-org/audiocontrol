/**
 * tools/scope-discovery/tab-groups-registry.ts
 *
 * Parser + types for `docs/scope-discovery/tab-groups.yaml` —
 * the source-of-truth registry driving the tab-active-state
 * codegen (Phase 2 task 2.10 of feature/akai-harmonization).
 *
 * Schema mirrors the YAML's header docstring. See that file for
 * the operator-facing field documentation. This module exposes
 * the parser + types to both the codegen
 * (`tools/codegen-tab-active-state.ts`) and the source-side
 * Gate B scanner (`tools/check-tab-active-state-sources.ts`),
 * so both consumers agree on the shape and validation rules.
 *
 * Validation contract:
 *   - `version` is an integer
 *   - `tab_groups` is a non-empty list of mappings
 *   - each entry has `id`, `owner_editor`, `consumer`, `mode`,
 *     `tab_ids`
 *   - `id` is lowercase alphanumeric (starts with a letter)
 *   - `mode` is one of `uncontrolled` | `reserved`
 *   - `tab_ids` is a non-empty list of strings, each prefixed
 *     with `<id>-` (the family-prefix invariant; catches typos
 *     where a tab id is filed under the wrong family)
 *   - duplicate `id` across entries is rejected
 *   - duplicate tab id across the entire registry is rejected
 *
 * Errors carry a `tab-groups: ` namespace prefix + the entry
 * context (`<file> tab_groups[<index>]`), matching the existing
 * scope-discovery registry parsers' error shape.
 */

import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { errorMessage, isPlainObject } from './util/typeguards.js';

export type TabGroupMode = 'uncontrolled' | 'reserved';

export interface TabGroup {
  readonly id: string;
  readonly ownerEditor: string;
  readonly consumer: string;
  readonly mode: TabGroupMode;
  readonly tabIds: readonly string[];
}

export interface TabGroupRegistry {
  readonly version: number;
  readonly tabGroups: readonly TabGroup[];
}

const VALID_MODES: readonly TabGroupMode[] = ['uncontrolled', 'reserved'];

/** Read + parse the tab-group registry from disk. */
export async function loadRegistry(path: string): Promise<TabGroupRegistry> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (err) {
    throw new Error(`tab-groups: cannot read ${path}: ${errorMessage(err)}`);
  }
  return parseRegistry(raw, path);
}

/** Parse + validate the tab-group registry from raw YAML text. */
export function parseRegistry(yamlText: string, sourcePath: string): TabGroupRegistry {
  let doc: unknown;
  try {
    doc = parseYaml(yamlText);
  } catch (err) {
    throw new Error(`tab-groups: YAML parse error in ${sourcePath}: ${errorMessage(err)}`);
  }
  if (!isPlainObject(doc)) {
    throw new Error(`tab-groups: top-level value in ${sourcePath} must be a mapping`);
  }
  const version = doc.version;
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    throw new Error(
      `tab-groups: ${sourcePath} requires integer \`version\` field; got ${typeof version}`,
    );
  }
  const rawGroups = doc.tab_groups;
  if (!Array.isArray(rawGroups)) {
    throw new Error(
      `tab-groups: ${sourcePath} \`tab_groups\` must be a list; got ${typeof rawGroups}`,
    );
  }
  const seenIds = new Set<string>();
  const seenTabIds = new Set<string>();
  const groups: TabGroup[] = rawGroups.map((raw, index) => {
    const ctx = `${sourcePath} tab_groups[${index}]`;
    if (!isPlainObject(raw)) {
      throw new Error(`tab-groups: ${ctx} must be a mapping; got ${typeof raw}`);
    }
    return parseEntry(raw, ctx, seenIds, seenTabIds);
  });
  return { version, tabGroups: groups };
}

function parseEntry(
  raw: Record<string, unknown>,
  ctx: string,
  seenIds: Set<string>,
  seenTabIds: Set<string>,
): TabGroup {
  const id = requireString(raw, 'id', ctx);
  if (!/^[a-z][a-z0-9]*$/.test(id)) {
    throw new Error(
      `tab-groups: ${ctx} \`id\` must be lowercase alphanumeric (and start with a letter); got "${id}"`,
    );
  }
  if (seenIds.has(id)) {
    throw new Error(`tab-groups: ${ctx} duplicates id "${id}"`);
  }
  seenIds.add(id);
  const ownerEditor = requireString(raw, 'owner_editor', ctx);
  const consumer = requireString(raw, 'consumer', ctx);
  const modeRaw = requireString(raw, 'mode', ctx);
  if (!VALID_MODES.includes(modeRaw as TabGroupMode)) {
    throw new Error(
      `tab-groups: ${ctx} \`mode\` must be one of ${VALID_MODES.join('|')}; got "${modeRaw}"`,
    );
  }
  const mode = modeRaw as TabGroupMode;
  const tabIds = requireStringList(raw, 'tab_ids', ctx);
  if (tabIds.length === 0) {
    throw new Error(`tab-groups: ${ctx} \`tab_ids\` must be a non-empty list`);
  }
  const prefix = `${id}-`;
  tabIds.forEach((tabId) => {
    if (!tabId.startsWith(prefix)) {
      throw new Error(
        `tab-groups: ${ctx} tab id "${tabId}" must be prefixed with "${prefix}" (matches family id "${id}")`,
      );
    }
    if (!/^[a-z][a-z0-9-]*$/.test(tabId)) {
      throw new Error(
        `tab-groups: ${ctx} tab id "${tabId}" must be kebab-case (lowercase alphanumeric + hyphens)`,
      );
    }
    if (seenTabIds.has(tabId)) {
      throw new Error(`tab-groups: ${ctx} duplicates tab id "${tabId}"`);
    }
    seenTabIds.add(tabId);
  });
  return { id, ownerEditor, consumer, mode, tabIds };
}

function requireString(record: Record<string, unknown>, key: string, ctx: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`tab-groups: ${ctx} requires non-empty string \`${key}\``);
  }
  return value;
}

function requireStringList(
  record: Record<string, unknown>,
  key: string,
  ctx: string,
): readonly string[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new Error(`tab-groups: ${ctx} requires list-valued \`${key}\``);
  }
  return value.map((item, idx) => {
    if (typeof item !== 'string' || item.length === 0) {
      throw new Error(`tab-groups: ${ctx} \`${key}[${idx}]\` must be a non-empty string`);
    }
    return item;
  });
}

/**
 * Return the union of every tab id across every group in the
 * registry. Used by the codegen + Gate B scanner — both want
 * the flat list, neither cares about group structure once they
 * have it.
 */
export function allTabIds(registry: TabGroupRegistry): readonly string[] {
  return registry.tabGroups.flatMap((g) => g.tabIds);
}

/**
 * Return the union of every family id (i.e., the `id:` field of
 * each entry — `tt`, `pt`, `ap`, `ak`, `as` in the current
 * registry). Used by Gate B to derive the prefix-scan alternation:
 * the scanner only flags `id="<prefix>-..."` matches whose prefix
 * is a registered family, which keeps the gate scoped to
 * tab-group identifiers and avoids collisions with unrelated id
 * attributes elsewhere in the codebase.
 */
export function allFamilyIds(registry: TabGroupRegistry): readonly string[] {
  return registry.tabGroups.map((g) => g.id);
}
