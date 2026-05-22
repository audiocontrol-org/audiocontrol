/**
 * tools/scope-discovery/migrate-clone-ids.ts
 *
 * One-time T7.1 migration: re-key docs/scope-discovery/clones.yaml under
 * the new content-hashed ID derivation. Reads the old yaml, runs jscpd
 * to compute fresh content-hashed IDs, matches old entries to new
 * entries by `members[]` (sorted) so that operator-authored dispositions
 * (refactor / keep-with-reason / ignore-with-justification) carry
 * forward onto the new IDs.
 *
 * Writes:
 *   docs/scope-discovery/clones.yaml         re-keyed under new IDs
 *   docs/scope-discovery/migration-map.yaml  forensic old-id → new-id
 *
 * CLI:
 *   tsx tools/scope-discovery/migrate-clone-ids.ts             # write
 *   tsx tools/scope-discovery/migrate-clone-ids.ts --dry-run   # plan only
 *   tsx tools/scope-discovery/migrate-clone-ids.ts --allow-unmapped
 *       # proceed even if some old entries have no matching new entry
 *       # (their dispositions become orphans and are recorded under
 *       # migration-map.yaml `unmapped:`). Default is to FAIL when
 *       # unmapped > 0 so orphaning dispositioned entries requires
 *       # explicit operator override.
 *
 * Exit codes:
 *   0   migration completed (or dry-run summary printed)
 *   1   unmapped old entries detected and --allow-unmapped not passed
 *   2   I/O or parse error
 *
 * Idempotence: running twice in a row is a no-op. The second run reads
 * the already-migrated yaml, matches every entry to its new-form self
 * by `members[]`, recomputes the same IDs (because the source tree
 * didn't change), and writes the same yaml back. migration-map.yaml is
 * regenerated with `<id>: <id>` entries — a trivial diff if the file
 * existed; effectively a no-op.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify as stringifyYaml } from 'yaml';
import {
  type CloneGroup,
  type ClonesYaml,
  extractBarePath,
  hasRefactorDisposition,
  parseClonesYaml,
  serializeClonesYaml,
} from './clones-yaml.js';
import { JSCPD_REPORT_PATH, parseJscpdReport, runJscpd } from './jscpd-runner.js';
import { errorMessage, isEnoent } from './util/typeguards.js';

const REPO_ROOT = process.cwd();
const DEFAULT_BASELINE = 'docs/scope-discovery/clones.yaml';
const DEFAULT_MAP_PATH = 'docs/scope-discovery/migration-map.yaml';

interface Cli {
  readonly dryRun: boolean;
  readonly allowUnmapped: boolean;
  readonly baselinePath: string;
  readonly mapPath: string;
}

function parseCli(argv: readonly string[]): Cli {
  let dryRun = false;
  let allowUnmapped = false;
  let baselinePath = DEFAULT_BASELINE;
  let mapPath = DEFAULT_MAP_PATH;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') dryRun = true;
    else if (a === '--allow-unmapped') allowUnmapped = true;
    else if (a === '--baseline') {
      const next = argv[++i];
      if (next === undefined) throw new Error('--baseline requires a path');
      baselinePath = next;
    } else if (a === '--map') {
      const next = argv[++i];
      if (next === undefined) throw new Error('--map requires a path');
      mapPath = next;
    } else throw new Error(`unknown arg: ${a}`);
  }
  return { dryRun, allowUnmapped, baselinePath, mapPath };
}

/**
 * Two-phase matching keys. The migration deliberately does NOT compare
 * IDs (the whole point of T7.1 is that they're changing). Instead we
 * pair old<->new entries in two passes:
 *
 *   1. exactMembersKey   — full `<path>:<start>:<end>` per member,
 *                          sorted, joined. This matches when the source
 *                          tree hasn't shifted around the clone group
 *                          (the vast majority of cases on the initial
 *                          migration). Guaranteed unique per group.
 *
 *   2. shiftTolerantKey  — sorted BARE file paths + `lines` count. Used
 *                          for old entries that didn't get an exact
 *                          match. Multiple clone groups can share the
 *                          same bare-path pair when one file pair
 *                          contains several distinct duplicated
 *                          fragments at different sites. `lines` count
 *                          differentiates siblings of differing length;
 *                          shift-tolerant matching only collides when
 *                          two sibling fragments happen to share length
 *                          AND file pair AND both shifted, which is
 *                          rare. Collisions in this pass are reported
 *                          honestly: when multiple new entries match
 *                          the same shift-tolerant key, the FIRST
 *                          unmatched new entry wins; subsequent old
 *                          entries with the same key surface as
 *                          unmapped so the operator decides.
 */
function exactMembersKey(group: CloneGroup): string {
  return [...group.members].sort().join('|');
}

function shiftTolerantKey(group: CloneGroup): string {
  const bare = [...group.members].map(extractBarePath).sort().join('|');
  return `${bare}#L${group.lines}`;
}

/** Disposition-count tally for the summary line. */
interface DispositionCounts {
  readonly pending: number;
  readonly 'keep-with-reason': number;
  readonly 'ignore-with-justification': number;
  readonly refactor: number;
}

function countDispositions(groups: readonly CloneGroup[]): DispositionCounts {
  let pending = 0;
  let keepWithReason = 0;
  let ignoreWithJustification = 0;
  let refactor = 0;
  for (const g of groups) {
    if (g.disposition === 'pending') pending += 1;
    else if (g.disposition === 'keep-with-reason') keepWithReason += 1;
    else if (g.disposition === 'ignore-with-justification') ignoreWithJustification += 1;
    else refactor += 1;
  }
  return {
    pending,
    'keep-with-reason': keepWithReason,
    'ignore-with-justification': ignoreWithJustification,
    refactor,
  };
}

/**
 * Carry an old entry's disposition forward onto a new entry. New entry
 * keeps its (freshly-derived) id; everything else (`disposition`,
 * `reason`, and refactor-only fields when present) comes from old.
 */
function carryForward(newGroup: CloneGroup, oldGroup: CloneGroup): CloneGroup {
  if (hasRefactorDisposition(oldGroup)) {
    return {
      id: newGroup.id,
      lines: newGroup.lines,
      members: newGroup.members,
      disposition: 'refactor',
      reason: oldGroup.reason,
      canonical_side: oldGroup.canonical_side,
      canonical_reason: oldGroup.canonical_reason,
      tests: oldGroup.tests,
      tests_proof: oldGroup.tests_proof,
      ...(oldGroup.new_shape_summary !== undefined
        ? { new_shape_summary: oldGroup.new_shape_summary }
        : {}),
    };
  }
  return {
    id: newGroup.id,
    lines: newGroup.lines,
    members: newGroup.members,
    disposition: oldGroup.disposition,
    reason: oldGroup.reason,
  };
}

interface MigrationResult {
  readonly migratedGroups: CloneGroup[];
  readonly idMap: ReadonlyMap<string, string>;
  readonly unmapped: readonly CloneGroup[];
  readonly newOnly: readonly CloneGroup[];
}

/**
 * Match old entries to new entries in two passes:
 *
 *   Pass 1 (exact): match by full `<path>:<start>:<end>` per member.
 *                   Captures every clone group whose line ranges
 *                   haven't shifted.
 *   Pass 2 (shift-tolerant): for the leftovers, match by sorted bare
 *                   paths + `lines` count. Captures clone groups whose
 *                   line ranges shifted but whose duplication signature
 *                   stayed the same.
 *
 * Old entries with no match in either pass surface as `unmapped`. New
 * entries with no old match surface as `newOnly` (default disposition).
 *
 * Each new entry can be claimed by at most one old entry (first-pass
 * exact match wins over second-pass shift-tolerant match). Each old
 * entry can match at most one new entry (the first that hashes to the
 * same shift-tolerant key on pass 2; subsequent old entries with the
 * same key surface as unmapped).
 */
export function migrateGroups(
  newGroups: readonly CloneGroup[],
  oldGroups: readonly CloneGroup[],
): MigrationResult {
  // Build new-by-key maps for both passes.
  const newByExact = new Map<string, CloneGroup>();
  for (const g of newGroups) newByExact.set(exactMembersKey(g), g);
  const newByShift = new Map<string, CloneGroup>();
  for (const g of newGroups) newByShift.set(shiftTolerantKey(g), g);

  // Track which new entries have been claimed and which old entries
  // have been paired. Two passes so exact wins over shift-tolerant.
  const newClaimed = new Set<string>(); // new entry ids
  const idMap = new Map<string, string>();
  const oldByOldId = new Map<string, CloneGroup>();
  for (const g of oldGroups) oldByOldId.set(g.id, g);
  const oldMatched = new Set<string>();

  // Pass 1: exact match.
  for (const oldG of oldGroups) {
    const newMatch = newByExact.get(exactMembersKey(oldG));
    if (newMatch !== undefined && !newClaimed.has(newMatch.id)) {
      newClaimed.add(newMatch.id);
      oldMatched.add(oldG.id);
      idMap.set(oldG.id, newMatch.id);
    }
  }

  // Pass 2: shift-tolerant match (only for un-matched olds).
  for (const oldG of oldGroups) {
    if (oldMatched.has(oldG.id)) continue;
    const newMatch = newByShift.get(shiftTolerantKey(oldG));
    if (newMatch !== undefined && !newClaimed.has(newMatch.id)) {
      newClaimed.add(newMatch.id);
      oldMatched.add(oldG.id);
      idMap.set(oldG.id, newMatch.id);
    }
  }

  // Build the migrated list: for each new entry, either carry forward
  // the matching old disposition or keep it as-is (default pending).
  const migrated: CloneGroup[] = [];
  const newOnly: CloneGroup[] = [];
  // Invert idMap to find old by new.
  const oldByNewId = new Map<string, string>();
  for (const [oldId, newId] of idMap) oldByNewId.set(newId, oldId);

  for (const g of newGroups) {
    const oldId = oldByNewId.get(g.id);
    if (oldId === undefined) {
      newOnly.push(g);
      migrated.push(g);
      continue;
    }
    const oldG = oldByOldId.get(oldId);
    if (oldG === undefined) {
      // Defensive: shouldn't happen because idMap was populated from oldGroups.
      newOnly.push(g);
      migrated.push(g);
      continue;
    }
    migrated.push(carryForward(g, oldG));
  }

  const unmapped: CloneGroup[] = [];
  for (const g of oldGroups) {
    if (!oldMatched.has(g.id)) unmapped.push(g);
  }

  return { migratedGroups: migrated, idMap, unmapped, newOnly };
}

interface MigrationMapDoc {
  readonly generated_at: string;
  readonly mappings: Record<string, string>;
  readonly unmapped?: readonly { id: string; disposition: string; members: readonly string[] }[];
  readonly new_only?: readonly { id: string; members: readonly string[] }[];
}

function serializeMigrationMap(doc: MigrationMapDoc): string {
  // Build the YAML root with stable key order: header → mappings → diagnostics.
  const root: Record<string, unknown> = {
    generated_at: doc.generated_at,
    mappings: doc.mappings,
  };
  if (doc.unmapped !== undefined && doc.unmapped.length > 0) {
    root['unmapped'] = doc.unmapped;
  }
  if (doc.new_only !== undefined && doc.new_only.length > 0) {
    root['new_only'] = doc.new_only;
  }
  return stringifyYaml(root, { lineWidth: 0 });
}

async function readOldBaseline(path: string): Promise<ClonesYaml | null> {
  try {
    const text = await readFile(path, 'utf8');
    return parseClonesYaml(text);
  } catch (err) {
    if (isEnoent(err)) return null;
    throw err;
  }
}

interface PreparedMigration {
  readonly oldGroups: readonly CloneGroup[];
  readonly newGroups: readonly CloneGroup[];
  readonly result: MigrationResult;
}

async function prepareMigration(cli: Cli): Promise<PreparedMigration> {
  const baselineAbs = resolve(REPO_ROOT, cli.baselinePath);
  const oldDoc = await readOldBaseline(baselineAbs);
  if (oldDoc === null) {
    throw new Error(
      `Baseline at ${cli.baselinePath} not found or malformed. T7.1 migration ` +
        `requires the existing baseline; nothing to migrate from.`,
    );
  }
  await runJscpd({ repoRoot: REPO_ROOT, rootOverride: null });
  const reportText = await readFile(join(REPO_ROOT, JSCPD_REPORT_PATH), 'utf8');
  const newGroups = parseJscpdReport(reportText);
  const result = migrateGroups(newGroups, oldDoc.clones);
  return { oldGroups: oldDoc.clones, newGroups, result };
}

function reportSummary(prepared: PreparedMigration): void {
  const { oldGroups, newGroups, result } = prepared;
  const counts = countDispositions(result.migratedGroups);
  const mapped = result.idMap.size;
  process.stdout.write(`Read ${oldGroups.length} groups from baseline.\n`);
  process.stdout.write(`Detected ${newGroups.length} groups from jscpd.\n`);
  process.stdout.write(
    `Computed new content-hashed IDs:\n` +
      `  ${mapped} matched (members-key parity)\n` +
      `  ${result.newOnly.length} new-only (no old match; default disposition)\n` +
      `  ${result.unmapped.length} unmapped (old entries with no new match)\n`,
  );
  process.stdout.write(
    `Dispositions carried forward:\n` +
      `  pending: ${counts.pending}\n` +
      `  keep-with-reason: ${counts['keep-with-reason']}\n` +
      `  ignore-with-justification: ${counts['ignore-with-justification']}\n` +
      `  refactor: ${counts.refactor}\n`,
  );
}

async function writeMigration(cli: Cli, prepared: PreparedMigration): Promise<void> {
  const { result } = prepared;
  const baselineAbs = resolve(REPO_ROOT, cli.baselinePath);
  const mapAbs = resolve(REPO_ROOT, cli.mapPath);
  const generatedAt = new Date().toISOString();

  const newYaml: ClonesYaml = {
    generated_at: generatedAt,
    clones: [...result.migratedGroups],
  };
  await mkdir(resolve(baselineAbs, '..'), { recursive: true });
  await writeFile(baselineAbs, serializeClonesYaml(newYaml), 'utf8');

  const mappings: Record<string, string> = {};
  // Sort by old id for stable diffs.
  const sortedEntries = [...result.idMap.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  for (const [oldId, newId] of sortedEntries) mappings[oldId] = newId;

  const mapDoc: MigrationMapDoc = {
    generated_at: generatedAt,
    mappings,
    ...(result.unmapped.length > 0
      ? {
          unmapped: result.unmapped.map((g) => ({
            id: g.id,
            disposition: g.disposition,
            members: g.members,
          })),
        }
      : {}),
    ...(result.newOnly.length > 0
      ? {
          new_only: result.newOnly.map((g) => ({
            id: g.id,
            members: g.members,
          })),
        }
      : {}),
  };
  await writeFile(mapAbs, serializeMigrationMap(mapDoc), 'utf8');

  process.stdout.write(`Wrote ${cli.baselinePath} (${result.migratedGroups.length} groups).\n`);
  process.stdout.write(`Wrote ${cli.mapPath} (${result.idMap.size} mappings).\n`);
}

async function main(): Promise<number> {
  let cli: Cli;
  try {
    cli = parseCli(process.argv.slice(2));
  } catch (err) {
    console.error(errorMessage(err));
    return 2;
  }
  let prepared: PreparedMigration;
  try {
    prepared = await prepareMigration(cli);
  } catch (err) {
    console.error(`migration prep failed: ${errorMessage(err)}`);
    return 2;
  }
  reportSummary(prepared);

  if (prepared.result.unmapped.length > 0 && !cli.allowUnmapped) {
    console.error(
      `\nERROR: ${prepared.result.unmapped.length} old entries have no matching new entry. ` +
        `Their dispositions would be orphaned by the migration.\n` +
        `Inspect the entries below and either:\n` +
        `  - investigate why their members don't appear in the fresh jscpd output\n` +
        `    (the source may have shifted; refactor preconditions may need updating);\n` +
        `  - re-run with --allow-unmapped to record the orphans in migration-map.yaml\n` +
        `    and proceed with the migration.\n`,
    );
    for (const g of prepared.result.unmapped) {
      console.error(`  unmapped: ${g.id} (${g.disposition}) — ${g.members.join(', ')}`);
    }
    return 1;
  }

  if (cli.dryRun) {
    process.stdout.write(`\nDry-run: no files written.\n`);
    return 0;
  }
  try {
    await writeMigration(cli, prepared);
  } catch (err) {
    console.error(`migration write failed: ${errorMessage(err)}`);
    return 2;
  }
  process.stdout.write(`Done.\n`);
  return 0;
}

/**
 * Only execute the CLI when this file is invoked directly. The
 * migration-scenarios validator imports `migrateGroups` from this
 * module for pure-function testing; we MUST NOT trigger the full
 * migration (including a real jscpd run) as a side effect of that
 * import. Matches the canonical isCliEntryPoint() pattern used by
 * check-adopters, check-anti-patterns, check-deprecations, etc.
 */
function isCliEntryPoint(): boolean {
  const invoked = process.argv[1];
  if (invoked === undefined) return false;
  return invoked === fileURLToPath(import.meta.url);
}

if (isCliEntryPoint()) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(`unexpected failure: ${errorMessage(err)}`);
      process.exit(2);
    },
  );
}
