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
import { type CloneGroup, makeCloneGroup } from './clones-yaml.js';
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
}

/**
 * Read jscpd-report.json and convert each `duplicates[]` entry into a
 * CloneGroup. We collapse overlapping pairs (see file header).
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
    const a = memberFromFile(dup['firstFile']);
    const b = memberFromFile(dup['secondFile']);
    if (a === null || b === null) continue;
    pairs.push({
      members: [a, b].sort(),
      lines: typeof lines === 'number' ? lines : 0,
    });
  }
  return collapsePairsIntoGroups(pairs).map((p) =>
    makeCloneGroup({
      members: p.members,
      lines: p.lines,
      disposition: 'pending',
      reason: null,
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
 */
function collapsePairsIntoGroups(
  pairs: readonly RawPair[],
): RawPair[] {
  const groups: { members: Set<string>; lines: number }[] = [];
  for (const pair of pairs) {
    const candidate = groups.find(
      (g) => g.lines === pair.lines && pair.members.some((m) => g.members.has(m)),
    );
    if (candidate === undefined) {
      groups.push({
        members: new Set(pair.members),
        lines: pair.lines,
      });
    } else {
      for (const m of pair.members) candidate.members.add(m);
    }
  }
  return groups.map((g) => ({
    members: [...g.members].sort(),
    lines: g.lines,
  }));
}
