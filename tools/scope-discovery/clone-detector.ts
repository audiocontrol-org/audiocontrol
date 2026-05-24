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
 *   --diff                    print only NEW + DROPPED groups (subset of
 *                             default output); useful for CI-style diffing.
 *                             Implies --quiet for the headline; full per-group
 *                             listing is replaced by NEW/DROPPED sections only.
 *
 * Exit code:
 *   0   no NEW clone groups (or first-run baseline written)
 *   1   one or more NEW groups since the baseline
 *   2   I/O, parse, or jscpd-crash error
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import {
  type CloneDiff,
  type CloneGroup,
  type ClonesYaml,
  ClonesYamlParseError,
  diffClones,
  mergeDispositions,
  parseClonesYamlStrict,
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
  readonly diff: boolean;
}

function parseCli(argv: readonly string[]): Cli {
  let root: string | null = null;
  let quiet = false;
  let json = false;
  let baselinePath = DEFAULT_BASELINE;
  let refreshBaseline = false;
  let diff = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--root') {
      const next = argv[++i];
      if (next === undefined) throw new Error('--root requires a path');
      root = next;
    } else if (a === '--quiet') quiet = true;
    else if (a === '--json') json = true;
    else if (a === '--diff') diff = true;
    else if (a === '--baseline') {
      const next = argv[++i];
      if (next === undefined) throw new Error('--baseline requires a path');
      baselinePath = next;
    } else if (a === '--refresh-baseline') refreshBaseline = true;
    else throw new Error(`unknown arg: ${a}`);
  }
  return { root, quiet, json, baselinePath, refreshBaseline, diff };
}

/**
 * Read the baseline file.
 *
 * Returns null ONLY when the file is truly absent (ENOENT). When the file
 * exists but parses to a shape error, throws `ClonesYamlParseError` so
 * the detector exits 2 with an actionable diagnostic — silently treating
 * a malformed-but-present baseline as null would let the subsequent
 * `--refresh-baseline` write wipe every operator disposition without a
 * visible diff (AUDIT-20260524-14).
 *
 * `RefactorPreconditionError` from `parseClonesYamlStrict` also
 * propagates — refactor-only field errors were already loud and the
 * strict path preserves that contract.
 */
async function readBaseline(path: string): Promise<ClonesYaml | null> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (err) {
    if (isEnoent(err)) return null;
    throw err;
  }
  return parseClonesYamlStrict(text);
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

/**
 * Single-line summary shared by --refresh-baseline and --diff modes.
 * Shape: `summary: N dropped, M new (net X)` where net = new - dropped.
 * Distinct from the headline `K groups; N NEW; M DROPPED` so the two
 * lines can be grep-distinguished by downstream tooling.
 */
function summaryLine(diff: CloneDiff): string {
  const newCount = diff.newGroups.length;
  const droppedCount = diff.droppedGroups.length;
  const net = newCount - droppedCount;
  const netStr = net >= 0 ? `+${net}` : `${net}`;
  return `summary: ${droppedCount} dropped, ${newCount} new (net ${netStr})`;
}

/**
 * Per-NEW-group operator hint: a pre-filled `batch-dispose.ts` command
 * the operator can paste-and-edit instead of hand-writing a YAML entry
 * at the right insertion point in docs/scope-discovery/clones.yaml.
 *
 * Closes AUDIT-20260524-09 (TF-003 from akai-harmonization): the prior
 * NEW-group output named the id and member files but never cited the
 * existing `tools/scope-discovery/batch-dispose.ts` automation, so
 * operators reinvented the manual workflow each time.
 *
 * Emitted ADDITIVELY — every existing NEW-group line is preserved so
 * downstream consumers grepping for `NEW    <id>` or member paths
 * continue to work. DROPPED groups intentionally do NOT get this hint:
 * they are removed via the clones-yaml refresh (`make refresh-clones-baseline`),
 * not via batch-dispose.
 *
 * The `indent` parameter matches each caller's existing per-group
 * indentation: `reportHuman` indents NEW lines by 2 spaces (default
 * mode); `reportDiff` does not indent (--diff mode is the strict
 * subset). The hint is indented one level deeper than the `NEW` line
 * itself so the visual hierarchy stays consistent within each caller.
 */
function batchDisposeHintLines(id: string, indent: string): readonly string[] {
  const lead = `${indent}  Run:  `;
  const cont = `${indent}          `;
  return [
    `${lead}tsx tools/scope-discovery/batch-dispose.ts \\\n`,
    `${cont}--ids ${id} \\\n`,
    `${cont}--disposition <refactor|keep-with-reason|ignore-with-justification> \\\n`,
    `${cont}--reason "<one-line rationale>"\n`,
  ];
}

function writeBatchDisposeHint(id: string, indent: string): void {
  for (const line of batchDisposeHintLines(id, indent)) {
    process.stdout.write(line);
  }
}

/**
 * Emit only NEW + DROPPED group sections plus the summary line. Subset
 * of the default-mode output; the full per-group listing is omitted.
 */
function reportDiff(diff: CloneDiff): void {
  for (const g of diff.newGroups) {
    process.stdout.write(`NEW    ${g.id} (${g.lines} lines)\n`);
    for (const m of g.members) process.stdout.write(`         ${m}\n`);
    writeBatchDisposeHint(g.id, '');
  }
  for (const g of diff.droppedGroups) {
    process.stdout.write(`DROPPED ${g.id} (${g.lines} lines)\n`);
    for (const m of g.members) process.stdout.write(`         ${m}\n`);
  }
  process.stdout.write(`${summaryLine(diff)}\n`);
}

function reportHuman(opts: ReportOpts): void {
  const { groups, diff, quiet, baselineExisted } = opts;
  if (quiet) {
    process.stdout.write(
      `${groups.length} groups; ${diff.newGroups.length} NEW; ` +
        `${diff.droppedGroups.length} DROPPED\n`,
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
      `${diff.droppedGroups.length} DROPPED.\n`,
  );
  for (const g of diff.newGroups) {
    process.stdout.write(`  NEW    ${g.id} (${g.lines} lines)\n`);
    for (const m of g.members) process.stdout.write(`           ${m}\n`);
    writeBatchDisposeHint(g.id, '  ');
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
  let baseline: ClonesYaml | null;
  try {
    baseline = await readBaseline(baselineAbs);
  } catch (err) {
    if (err instanceof ClonesYamlParseError) {
      // AUDIT-20260524-14: refuse to silently overwrite an existing-but-
      // malformed baseline. The previous lenient behavior treated this
      // as `null` and the subsequent refresh-write erased every operator
      // disposition without a diff. Fail loud with the structured reason
      // so the operator can hand-fix the YAML.
      console.error(
        `baseline ${baselineAbs} exists but is malformed:\n  ${err.reason}\n` +
          `\nRefusing to silently overwrite operator-curated dispositions. ` +
          `Hand-fix the YAML and re-run, OR explicitly remove the file to ` +
          `regenerate from scratch.`,
      );
      return 2;
    }
    throw err;
  }
  const baselineExisted = baseline !== null;
  const diff = diffClones(detectedGroups, baseline);

  // Baseline-write modes:
  //   - First run (no baseline file): write the baseline with every
  //     detected group at disposition: pending. Exit 0.
  //   - --refresh-baseline: rewrite preserving non-pending dispositions.
  //     Exit 0.
  // Compare mode (normal):
  //   - Don't touch the file. Exit 1 if NEW, else 0.
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
      // Polish T7.5: --refresh-baseline always trails with a single-line
      // summary in the `summary: N dropped, M new (net X)` shape, distinct
      // from the headline above. Survives --quiet for grep-friendliness.
      if (cli.refreshBaseline) {
        process.stdout.write(`${summaryLine(diff)}\n`);
      }
    }
    return 0;
  }

  if (cli.json) {
    reportJson(detectedGroups, diff);
  } else if (cli.diff) {
    reportDiff(diff);
  } else {
    reportHuman({ groups: detectedGroups, diff, quiet: cli.quiet, baselineExisted });
  }
  const failing = diff.newGroups.length;
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
