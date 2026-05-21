/**
 * tools/scope-discovery/clone-detector.ts
 *
 * General TypeScript/TSX clone-detection gate for the scope-discovery
 * protocol (T2.2). Wraps `jscpd` (already installed; configured at
 * `.jscpd.json`; scoped to `modules/`, ts+tsx, no tests/dist), parses
 * its JSON report into stable clone-group records, and compares
 * against the committed baseline at `docs/scope-discovery/clones.yaml`.
 *
 * Engine choice — jscpd over AST-custom — rationale:
 *   1. Already installed and wired (root package.json devDep, .jscpd.json
 *      at repo root with the project's thresholds, three npm scripts
 *      anchoring the engine to repo conventions). Reinventing on AST
 *      would add a parser dependency, duplicate the
 *      ignore/threshold/format config, and fork the operator's mental
 *      model.
 *   2. jscpd's `--config` model is shared with `pnpm duplication:check`
 *      etc. — so this tool and the operator-facing scripts read the
 *      same config file. No second source of truth.
 *   3. The existing CSS-duplication gate (`tools/check-css-duplication.ts`)
 *      is hand-rolled because CSS rule-bodies have no off-the-shelf
 *      detector with the same selector/stem grouping semantics. TS/TSX
 *      clone detection does have one (jscpd) and we should use it.
 *   4. PRD §"No new package dependencies expected beyond the
 *      clone-detection engine. Confirm in Phase 2 T2.2." — confirmed:
 *      no new deps required; jscpd was already present.
 *
 * Wiring (downstream):
 *   T2.3 — .githooks/pre-commit invokes this with no --refresh-baseline
 *   T2.5 — adversarial validator at clone-detector.validate.ts
 *   T2.7 — `make refresh-clones-baseline` runs with --refresh-baseline
 *   T4.1 — first Phase-4 baseline run produces the dispositionable backlog
 *
 * Invocation:
 *   --root <path>             override .jscpd.json `path` (default: read from config)
 *   --quiet                   suppress per-clone output; print summary + exit
 *   --json                    emit JSON for tooling instead of human text
 *   --baseline <path>         override default docs/scope-discovery/clones.yaml
 *   --refresh-baseline        rewrite the baseline from this run, carrying
 *                             forward operator-authored dispositions
 *
 * Exit code:
 *   0   no NEW and no GROWN clone groups (or first-run baseline written)
 *   1   one or more NEW or GROWN groups since the baseline
 *   2   I/O, parse, or jscpd-crash error
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import {
  type CloneDiff,
  type CloneGroup,
  type ClonesYaml,
  diffClones,
  mergeDispositions,
  parseClonesYaml,
  serializeClonesYaml,
} from './clones-yaml.js';
import { JSCPD_REPORT_PATH, parseJscpdReport, runJscpd } from './jscpd-runner.js';
import { errorMessage, isEnoent } from './util/typeguards.js';

const REPO_ROOT = process.cwd();
const DEFAULT_BASELINE = 'docs/scope-discovery/clones.yaml';

interface Cli {
  readonly root: string | null;
  readonly quiet: boolean;
  readonly json: boolean;
  readonly baselinePath: string;
  readonly refreshBaseline: boolean;
}

function parseCli(argv: readonly string[]): Cli {
  let root: string | null = null;
  let quiet = false;
  let json = false;
  let baselinePath = DEFAULT_BASELINE;
  let refreshBaseline = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--root') {
      const next = argv[++i];
      if (next === undefined) throw new Error('--root requires a path');
      root = next;
    } else if (a === '--quiet') quiet = true;
    else if (a === '--json') json = true;
    else if (a === '--baseline') {
      const next = argv[++i];
      if (next === undefined) throw new Error('--baseline requires a path');
      baselinePath = next;
    } else if (a === '--refresh-baseline') refreshBaseline = true;
    else throw new Error(`unknown arg: ${a}`);
  }
  return { root, quiet, json, baselinePath, refreshBaseline };
}

async function readBaseline(path: string): Promise<ClonesYaml | null> {
  try {
    const text = await readFile(path, 'utf8');
    const parsed = parseClonesYaml(text);
    if (parsed === null) {
      console.error(
        `warning: ${path} did not parse as a clones.yaml document; treating as empty baseline.`,
      );
      return null;
    }
    return parsed;
  } catch (err) {
    if (isEnoent(err)) return null;
    throw err;
  }
}

async function writeBaseline(path: string, doc: ClonesYaml): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, serializeClonesYaml(doc), 'utf8');
}

interface ReportOpts {
  readonly groups: readonly CloneGroup[];
  readonly diff: CloneDiff;
  readonly quiet: boolean;
  readonly baselineExisted: boolean;
}

function reportHuman(opts: ReportOpts): void {
  const { groups, diff, quiet, baselineExisted } = opts;
  if (quiet) {
    process.stdout.write(
      `${groups.length} groups; ${diff.newGroups.length} NEW; ` +
        `${diff.grownGroups.length} GROWN; ${diff.droppedGroups.length} DROPPED\n`,
    );
    return;
  }
  if (groups.length === 0) {
    process.stdout.write('No clone groups detected.\n');
  } else {
    const minLines = groups.reduce((m, g) => Math.min(m, g.lines), Infinity);
    process.stdout.write(
      `Detected ${groups.length} clone group(s) (>= ${minLines} lines).\n`,
    );
  }
  if (!baselineExisted) return;
  process.stdout.write(
    `Baseline diff: ${diff.newGroups.length} NEW, ` +
      `${diff.grownGroups.length} GROWN, ${diff.droppedGroups.length} DROPPED.\n`,
  );
  for (const g of diff.newGroups) {
    process.stdout.write(`  NEW    ${g.id} (${g.lines} lines)\n`);
    for (const m of g.members) process.stdout.write(`           ${m}\n`);
  }
  for (const g of diff.grownGroups) {
    process.stdout.write(
      `  GROWN  ${g.id} (${g.lines} lines, now ${g.members.length} members)\n`,
    );
    for (const m of g.members) process.stdout.write(`           ${m}\n`);
  }
}

function reportJson(groups: readonly CloneGroup[], diff: CloneDiff): void {
  process.stdout.write(`${JSON.stringify({ groups, ...diff }, null, 2)}\n`);
}

async function main(): Promise<number> {
  let cli: Cli;
  try {
    cli = parseCli(process.argv.slice(2));
  } catch (err) {
    console.error(errorMessage(err));
    return 2;
  }
  try {
    await runJscpd({ repoRoot: REPO_ROOT, rootOverride: cli.root });
  } catch (err) {
    console.error(`jscpd invocation failed: ${errorMessage(err)}`);
    return 2;
  }
  const reportText = await readFile(join(REPO_ROOT, JSCPD_REPORT_PATH), 'utf8');
  const detectedGroups = parseJscpdReport(reportText);

  const baselineAbs = resolve(REPO_ROOT, cli.baselinePath);
  const baseline = await readBaseline(baselineAbs);
  const baselineExisted = baseline !== null;
  const diff = diffClones(detectedGroups, baseline);

  // Baseline-write modes:
  //   - First run (no baseline file): write the baseline with every
  //     detected group at disposition: pending. Exit 0.
  //   - --refresh-baseline: rewrite preserving non-pending dispositions.
  //     Exit 0.
  // Compare mode (normal):
  //   - Don't touch the file. Exit 1 if NEW or GROWN, else 0.
  const shouldWrite = !baselineExisted || cli.refreshBaseline;
  if (shouldWrite) {
    const merged = mergeDispositions(detectedGroups, baseline);
    const doc: ClonesYaml = {
      generated_at: new Date().toISOString(),
      clones: merged,
    };
    await writeBaseline(baselineAbs, doc);
    if (cli.json) {
      reportJson(merged, diff);
    } else {
      const rel = relative(REPO_ROOT, baselineAbs);
      if (!cli.quiet) {
        process.stdout.write(
          `Wrote ${baselineExisted ? 'refreshed' : 'initial'} baseline to ${rel} (${merged.length} group(s)).\n`,
        );
      }
      reportHuman({ groups: merged, diff, quiet: cli.quiet, baselineExisted });
    }
    return 0;
  }

  if (cli.json) {
    reportJson(detectedGroups, diff);
  } else {
    reportHuman({ groups: detectedGroups, diff, quiet: cli.quiet, baselineExisted });
  }
  const failing = diff.newGroups.length + diff.grownGroups.length;
  return failing > 0 ? 1 : 0;
}

main().then(
  (code) => {
    process.exit(code);
  },
  (err) => {
    console.error(`unexpected failure: ${errorMessage(err)}`);
    process.exit(2);
  },
);
