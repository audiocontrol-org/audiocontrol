/**
 * tools/scope-discovery/summary.ts
 *
 * Day-to-day "how many pending clone groups touch my surface?" reporter.
 * Reads `docs/scope-discovery/clones.yaml` and a surface glob, expands
 * the glob via the shared compiler in `util/glob.ts`, and prints a
 * 4-field summary on a single line:
 *
 *   total: N | pending-touching: M | pending-intra: K | dispositioned-touching: L
 *
 * Vocabulary (matches the workplan T7.3 specification):
 *   - total                  : every clone group in clones.yaml, regardless
 *                              of disposition or surface match.
 *   - pending-touching       : disposition == 'pending' AND at least one
 *                              member's bare path matches the surface glob.
 *   - pending-intra          : disposition == 'pending' AND ALL members'
 *                              bare paths match the surface glob.
 *   - dispositioned-touching : disposition != 'pending' (refactor /
 *                              keep-with-reason / ignore-with-justification)
 *                              AND at least one member matches the glob.
 *
 * "intra" is a subset of "touching" by construction: a group where every
 * member matches also has at least one member matching. The summary
 * surfaces both so operators can tell apart "this surface is the
 * canonical side of a cross-surface duplication" (touching > intra) from
 * "this surface has its own internal duplication" (touching == intra > 0).
 *
 * CLI:
 *   --surface <glob>   (required) the surface glob; matched against each
 *                      member's BARE file-path (the `<path>:<start>:<end>`
 *                      suffix is stripped via `extractBarePath` before
 *                      matching, so the glob is path-only).
 *   --clones <path>    override the clones.yaml path (default:
 *                      docs/scope-discovery/clones.yaml).
 *   --json             emit a JSON object with the four counts plus
 *                      the `surface` and `clones` paths, for tooling.
 *   --verbose          additionally print each matching group's id and
 *                      matching-member count to stderr.
 *
 * Exit codes:
 *   0   summary produced (regardless of count values).
 *   2   invalid CLI args, missing/malformed clones.yaml, or invalid glob.
 *
 * DRY notes: glob compilation reuses `util/glob.ts#globToRegex` (the same
 * grammar adopter-manifests + clone-summary use); YAML parsing + the
 * `CloneGroup` shape come from `clones-yaml.ts` (no re-parsing); bare-path
 * extraction reuses `extractBarePath` from `clones-yaml.id.ts` (re-exported
 * by `clones-yaml.ts`).
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  type CloneGroup,
  extractBarePath,
  parseClonesYaml,
} from './clones-yaml.js';
import { globToRegex } from './util/glob.js';
import { errorMessage } from './util/typeguards.js';

const DEFAULT_CLONES_PATH = 'docs/scope-discovery/clones.yaml';

export interface SummaryCounts {
  readonly total: number;
  readonly pendingTouching: number;
  readonly pendingIntra: number;
  readonly dispositionedTouching: number;
}

export interface MatchingGroup {
  readonly id: string;
  readonly matchingMembers: number;
  readonly totalMembers: number;
  readonly disposition: CloneGroup['disposition'];
  readonly allMatch: boolean;
}

export interface SummaryResult {
  readonly counts: SummaryCounts;
  /** Groups with at least one matching member, regardless of disposition. */
  readonly matchingGroups: readonly MatchingGroup[];
}

/**
 * Pure computation: given a list of clone groups + a compiled glob,
 * return the four counts and the per-group match details. Exported so
 * the adversarial validator can exercise the math without subprocess
 * overhead.
 */
export function computeSummary(
  clones: readonly CloneGroup[],
  surfaceRegex: RegExp,
): SummaryResult {
  let pendingTouching = 0;
  let pendingIntra = 0;
  let dispositionedTouching = 0;
  const matching: MatchingGroup[] = [];
  for (const group of clones) {
    const total = group.members.length;
    let matched = 0;
    for (const member of group.members) {
      const bare = extractBarePath(member);
      if (surfaceRegex.test(bare)) matched += 1;
    }
    if (matched === 0) continue;
    const allMatch = matched === total;
    matching.push({
      id: group.id,
      matchingMembers: matched,
      totalMembers: total,
      disposition: group.disposition,
      allMatch,
    });
    if (group.disposition === 'pending') {
      pendingTouching += 1;
      if (allMatch) pendingIntra += 1;
    } else {
      dispositionedTouching += 1;
    }
  }
  return {
    counts: {
      total: clones.length,
      pendingTouching,
      pendingIntra,
      dispositionedTouching,
    },
    matchingGroups: matching,
  };
}

/** Format the four-field summary line. Matches the workplan example exactly. */
export function formatSummaryLine(counts: SummaryCounts): string {
  return (
    `total: ${counts.total} | ` +
    `pending-touching: ${counts.pendingTouching} | ` +
    `pending-intra: ${counts.pendingIntra} | ` +
    `dispositioned-touching: ${counts.dispositionedTouching}`
  );
}

interface ParsedArgs {
  readonly surface: string;
  readonly clonesPath: string;
  readonly json: boolean;
  readonly verbose: boolean;
}

/**
 * CLI argument parser. Throws on missing required arg or unknown flag;
 * the caller catches and exits 2. Kept inline (rather than pulling a
 * dep) — the surface area is small and the existing tools all hand-roll
 * their flag parsing for the same reason.
 */
function parseArgs(argv: readonly string[]): ParsedArgs {
  let surface: string | null = null;
  let clonesPath: string = DEFAULT_CLONES_PATH;
  let json = false;
  let verbose = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--surface') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error(`--surface requires a value`);
      surface = next;
      i += 1;
    } else if (arg === '--clones') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error(`--clones requires a path value`);
      clonesPath = next;
      i += 1;
    } else if (arg === '--json') {
      json = true;
    } else if (arg === '--verbose') {
      verbose = true;
    } else {
      throw new Error(`unknown flag: ${arg}`);
    }
  }
  if (surface === null) {
    throw new Error(
      `--surface <glob> is required (e.g. --surface 'modules/roland-sxx0-editor/src/**')`,
    );
  }
  return { surface, clonesPath, json, verbose };
}

async function loadClones(path: string): Promise<readonly CloneGroup[]> {
  const abs = resolve(path);
  let text: string;
  try {
    text = await readFile(abs, 'utf8');
  } catch (err) {
    throw new Error(`failed to read clones file at ${abs}: ${errorMessage(err)}`);
  }
  const parsed = parseClonesYaml(text);
  if (parsed === null) {
    throw new Error(
      `clones file at ${abs} has malformed shape (missing top-level keys or wrong types)`,
    );
  }
  return parsed.clones;
}

interface MainResult {
  readonly code: 0 | 2;
  readonly summary?: SummaryResult;
  readonly args?: ParsedArgs;
}

/**
 * Programmatic entrypoint. Exported so tests/validators can drive it
 * without spawning a subprocess. Catches user-input errors (bad args,
 * missing files, bad glob) and converts them to exit code 2 + an
 * actionable stderr message.
 */
export async function runSummary(argv: readonly string[]): Promise<MainResult> {
  let args: ParsedArgs;
  try {
    args = parseArgs(argv);
  } catch (err) {
    process.stderr.write(`error: ${errorMessage(err)}\n`);
    return { code: 2 };
  }
  let regex: RegExp;
  try {
    regex = globToRegex(args.surface);
  } catch (err) {
    process.stderr.write(`error: invalid --surface glob: ${errorMessage(err)}\n`);
    return { code: 2 };
  }
  let clones: readonly CloneGroup[];
  try {
    clones = await loadClones(args.clonesPath);
  } catch (err) {
    process.stderr.write(`error: ${errorMessage(err)}\n`);
    return { code: 2 };
  }
  const summary = computeSummary(clones, regex);
  if (args.json) {
    const payload = {
      surface: args.surface,
      clones: args.clonesPath,
      total: summary.counts.total,
      'pending-touching': summary.counts.pendingTouching,
      'pending-intra': summary.counts.pendingIntra,
      'dispositioned-touching': summary.counts.dispositionedTouching,
    };
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } else {
    process.stdout.write(`${formatSummaryLine(summary.counts)}\n`);
  }
  if (args.verbose) {
    for (const g of summary.matchingGroups) {
      const tag = g.allMatch ? 'intra' : 'touching';
      process.stderr.write(
        `  ${g.id}  ${g.disposition}  ${tag}  ${g.matchingMembers}/${g.totalMembers}\n`,
      );
    }
  }
  return { code: 0, summary, args };
}

// Invoke as CLI when this file is the entrypoint. tsx executes the file
// top-to-bottom; the import.meta.url-vs-process.argv[1] check keeps the
// module importable from validators without triggering process.exit.
const invokedDirect = import.meta.url === `file://${process.argv[1]}`;
if (invokedDirect) {
  runSummary(process.argv.slice(2)).then(
    (result) => process.exit(result.code),
    (err) => {
      process.stderr.write(`harness error: ${errorMessage(err)}\n`);
      process.exit(2);
    },
  );
}
