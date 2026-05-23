/**
 * tools/scope-discovery/jscpd-runner.ts
 *
 * Owns the subprocess invocation of `jscpd` and the parse of its JSON
 * report into stable CloneGroup records. Split out of clone-detector.ts
 * to keep that file under the 300-line cap and to make the engine
 * boundary explicit — if we ever swap jscpd for something else (the
 * PRD requires the gate to detect component-level clones; an AST tool
 * would be the obvious successor), only this file changes.
 *
 * Engine boundary contract:
 *   runJscpd(opts)        → side effects only; writes the JSON report
 *   parseJscpdReport(txt) → pure; returns CloneGroup[]
 *
 * jscpd reports each clone as a PAIR (firstFile + secondFile). When the
 * same fragment appears in 3+ files, jscpd emits multiple overlapping
 * pairs (A↔B, A↔C, B↔C). We collapse those into a single group because
 * the operator-facing question is "which sites need refactoring," and
 * three files sharing the same fragment is one site, not three.
 */

import { mkdir, rm, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { type CloneGroup, makeCloneGroup, sha1HexOfText } from './clones-yaml.js';
import { isEnoent, isPlainObject } from './util/typeguards.js';

export const JSCPD_REPORT_PATH = 'reports/duplication/jscpd-report.json';

/**
 * Invoke jscpd as a subprocess. We use the subprocess approach (not
 * jscpd's programmatic API) because:
 *   - The .jscpd.json config has reporters/output/threshold/ignore lists
 *     the operator can tweak; we want this tool to honor any change
 *     they make without code edits here.
 *   - `pnpm duplication:check` (which devs already run) IS this same
 *     subprocess invocation — keeping the invocation shape identical
 *     means "what the gate sees" matches "what the dev sees".
 *   - jscpd exits non-zero when the duplication threshold trips; we
 *     interpret non-zero as "duplicates found" (treated as data, not
 *     error). Only a kill-signal is a real error.
 */
export async function runJscpd(opts: {
  readonly repoRoot: string;
  readonly rootOverride: string | null;
}): Promise<void> {
  const reportAbs = join(opts.repoRoot, JSCPD_REPORT_PATH);
  await mkdir(dirname(reportAbs), { recursive: true });
  // Remove any stale report so we can detect jscpd failing silently.
  try {
    await rm(reportAbs);
  } catch (err) {
    if (!isEnoent(err)) throw err;
  }
  // When --root is provided we override the config's `path` setting by
  // passing the path as a positional argument AFTER --config. jscpd's
  // CLI accepts `<path ...>` positional after options. The config still
  // contributes thresholds/ignores/reporters; only the scan root changes.
  const args = ['jscpd', '--config', '.jscpd.json'];
  if (opts.rootOverride !== null) {
    args.push(opts.rootOverride);
  }
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const proc = spawn('pnpm', ['exec', ...args], {
      cwd: opts.repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    proc.stdout?.on('data', () => {
      /* swallow jscpd's progress output; we read the JSON instead */
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    proc.on('error', (err) => rejectPromise(err));
    proc.on('exit', (code) => {
      if (code === null) {
        rejectPromise(new Error(`jscpd terminated by signal; stderr:\n${stderr}`));
      } else {
        resolvePromise();
      }
    });
  });
  try {
    await stat(reportAbs);
  } catch (err) {
    if (isEnoent(err)) {
      throw new Error(
        `jscpd ran but did not write ${JSCPD_REPORT_PATH}. ` +
          `The .jscpd.json reporters list must include "json".`,
      );
    }
    throw err;
  }
}

interface RawPair {
  readonly members: string[];
  readonly lines: number;
  readonly fragmentSha: string;
}

/**
 * Read jscpd-report.json and convert each `duplicates[]` entry into a
 * CloneGroup. We collapse overlapping pairs (see file header).
 *
 * Each `duplicates[]` entry carries a `fragment` field — the duplicated
 * source text as jscpd normalised it. We sha1-hex that fragment to
 * produce the per-pair `tokenFingerprint`, which threads into
 * `deriveContentHashedId` to keep clone-group IDs stable across
 * unrelated line shifts (T7.1).
 */
export function parseJscpdReport(reportText: string): CloneGroup[] {
  const parsed: unknown = JSON.parse(reportText);
  if (!isPlainObject(parsed)) {
    throw new Error('jscpd-report.json did not parse to an object');
  }
  const duplicates = parsed['duplicates'];
  if (!Array.isArray(duplicates)) {
    throw new Error('jscpd-report.json missing duplicates[] array');
  }
  const pairs: RawPair[] = [];
  for (const dup of duplicates) {
    if (!isPlainObject(dup)) continue;
    const lines = dup['lines'];
    const fragment = dup['fragment'];
    const a = memberFromFile(dup['firstFile']);
    const b = memberFromFile(dup['secondFile']);
    if (a === null || b === null) continue;
    if (typeof fragment !== 'string' || fragment.length === 0) {
      throw new Error(
        'jscpd-report.json duplicates[] entry missing non-empty `fragment` field; ' +
          'T7.1 content-hashed IDs cannot be derived without it. Check that the ' +
          'jscpd version in use surfaces the duplicated source text in its JSON report.',
      );
    }
    pairs.push({
      members: [a, b].sort(),
      lines: typeof lines === 'number' ? lines : 0,
      fragmentSha: sha1HexOfText(fragment),
    });
  }
  return collapsePairsIntoGroups(pairs).map((p) =>
    makeCloneGroup({
      members: p.members,
      lines: p.lines,
      disposition: 'pending',
      reason: null,
      tokenFingerprint: p.fragmentSha,
    }),
  );
}

function memberFromFile(file: unknown): string | null {
  if (!isPlainObject(file)) return null;
  const name = file['name'];
  const start = file['start'];
  const end = file['end'];
  if (typeof name !== 'string') return null;
  if (typeof start !== 'number') return null;
  if (typeof end !== 'number') return null;
  return `${name}:${start}:${end}`;
}

/**
 * Pairs sharing any member AND the same `lines` value merge into one
 * group. We require `lines` parity to avoid collapsing unrelated
 * clones that happen to overlap a hot file.
 *
 * tokenFingerprint propagation for collapsed groups: when 3+ files
 * clone the same fragment, jscpd reports A↔B, A↔C, B↔C as separate
 * pairs. The per-pair fragment text can differ slightly across these
 * pairs because jscpd reports each pair's matched range independently
 * — boundary normalisation may extend one pair's match by a few
 * tokens beyond another's even when the underlying duplicated body
 * is the same. We therefore aggregate the SET of pair-level
 * fragment-shas in the collapsed group and use a sorted hash of that
 * set as the group's tokenFingerprint. Pair set is symmetric (A↔B
 * == B↔A; jscpd guarantees this via the alphabetical pair ordering),
 * so the same source tree always produces the same group fingerprint
 * across runs.
 */
function collapsePairsIntoGroups(pairs: readonly RawPair[]): RawPair[] {
  const groups: { members: Set<string>; lines: number; fragmentShas: Set<string> }[] = [];
  for (const pair of pairs) {
    const candidate = groups.find(
      (g) => g.lines === pair.lines && pair.members.some((m) => g.members.has(m)),
    );
    if (candidate === undefined) {
      groups.push({
        members: new Set(pair.members),
        lines: pair.lines,
        fragmentShas: new Set([pair.fragmentSha]),
      });
    } else {
      for (const m of pair.members) candidate.members.add(m);
      candidate.fragmentShas.add(pair.fragmentSha);
    }
  }
  return groups.map((g) => ({
    members: [...g.members].sort(),
    lines: g.lines,
    fragmentSha: sha1HexOfText([...g.fragmentShas].sort().join('\n')),
  }));
}
