/**
 * tools/scope-discovery/check-disposition-survivor.ts
 *
 * Heavy backstop for AUDIT-20260524-14: fails the commit if any
 * docs/scope-discovery/clones.yaml entry transitions from a non-pending
 * disposition (keep-with-reason / ignore-with-justification / refactor)
 * to `pending` in the staged diff against HEAD.
 *
 * Why this gate exists: the clone-detector's regen path can silently
 * wipe operator-curated dispositions in failure modes the unit-level
 * `mergeDispositions` contract doesn't catch (the original audit names
 * the malformed-baseline → silent-empty path; this gate catches THAT
 * failure mode AND any future regression of the same shape, regardless
 * of root cause). The gate is the architectural floor — even if every
 * upstream merge bug is fixed, the gate ensures a destructive diff
 * can never reach a commit without explicit operator override.
 *
 * Invocation:
 *   tsx tools/scope-discovery/check-disposition-survivor.ts
 *   tsx tools/scope-discovery/check-disposition-survivor.ts --force    # override
 *   tsx tools/scope-discovery/check-disposition-survivor.ts --baseline <path>
 *   tsx tools/scope-discovery/check-disposition-survivor.ts --head-ref <ref>
 *
 * Exit code:
 *   0   no destructive transitions detected, OR clones.yaml not staged
 *   1   one or more non-pending → pending transitions in the staged diff
 *   2   I/O, parse, or git error
 *
 * Comparison semantics:
 *   HEAD-side YAML  : `git show HEAD:<baseline>`           (parsed; throws on shape error)
 *   Staged-side YAML: `git show :<baseline>` (index blob)  (parsed; throws on shape error)
 *
 * For every entry in HEAD with `disposition ∈ {keep-with-reason,
 * ignore-with-justification, refactor}`, look up the same `id` in the
 * staged version. A "destructive transition" is:
 *   - same id present in BOTH versions, AND
 *   - HEAD disposition is non-pending, AND
 *   - staged disposition is `pending`.
 *
 * Entries that legitimately disappear (id removed from staged) or
 * change id (membership/content change) are NOT flagged — those are
 * either operator-driven refactors or content-driven id rolls, both
 * of which are visible in the standard pre-commit clone-detector diff.
 * This gate's narrow job is to catch the SILENT loss path where the
 * id stays the same but the disposition reverts.
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import {
  type ClonesYaml,
  type Disposition,
  parseClonesYamlStrict,
} from './clones-yaml.js';
import { errorMessage } from './util/typeguards.js';

const REPO_ROOT = process.cwd();
const DEFAULT_BASELINE = 'docs/scope-discovery/clones.yaml';
const DEFAULT_HEAD_REF = 'HEAD';

interface Cli {
  readonly force: boolean;
  readonly baseline: string;
  readonly headRef: string;
}

function parseCli(argv: readonly string[]): Cli {
  let force = false;
  let baseline = DEFAULT_BASELINE;
  let headRef = DEFAULT_HEAD_REF;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--force') force = true;
    else if (a === '--baseline') {
      const next = argv[++i];
      if (next === undefined) throw new Error('--baseline requires a path');
      baseline = next;
    } else if (a === '--head-ref') {
      const next = argv[++i];
      if (next === undefined) throw new Error('--head-ref requires a ref');
      headRef = next;
    } else throw new Error(`unknown arg: ${a}`);
  }
  return { force, baseline, headRef };
}

/**
 * Discriminated result for `gitShowBlob`. The shape encodes the three
 * cases the caller distinguishes — file exists at the requested
 * ref/index slot vs. file missing from that ref/index slot vs. a real
 * git error (repo not initialized, bad ref, etc.). Keeps the caller
 * branchable without an `isMissing` heuristic on stderr text.
 */
type GitShowResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly missing: true }
  | { readonly ok: false; readonly missing: false; readonly stderr: string };

/**
 * Read a blob from git via `git show <spec>`. spec examples:
 *   "HEAD:docs/scope-discovery/clones.yaml"  — HEAD's version
 *   ":docs/scope-discovery/clones.yaml"      — staged (index) version
 *
 * Distinguishes "blob does not exist at this ref" (missing) from
 * "git itself errored" (e.g., not a git repo). Missing is a normal
 * branch the caller handles; git error is exit 2.
 */
function gitShowBlob(spec: string, cwd: string): GitShowResult {
  const result = spawnSync('git', ['show', spec], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  if (result.status === 0) {
    return { ok: true, text: result.stdout };
  }
  const stderr = result.stderr;
  // The two canonical "blob missing at this ref" signatures git emits.
  // Treat as missing rather than as an error — the caller's "first
  // commit; nothing in HEAD yet" + "file not staged" branches both
  // depend on this distinction.
  if (
    /exists on disk, but not in/.test(stderr) ||
    /does not exist/.test(stderr) ||
    /^fatal: path '.*' does not exist in/m.test(stderr) ||
    /unknown revision or path/.test(stderr)
  ) {
    return { ok: false, missing: true };
  }
  return { ok: false, missing: false, stderr };
}

/**
 * Returns true if `<baseline>` is staged for commit (added, modified,
 * or copied). Uses `git diff --cached --name-only --diff-filter=ACM`
 * — matches the pattern used in `.githooks/pre-commit`'s staged-files
 * sniffer. If the file isn't staged, this gate has nothing to do.
 */
function isBaselineStaged(baseline: string, cwd: string): boolean {
  const result = spawnSync(
    'git',
    ['diff', '--cached', '--name-only', '--diff-filter=ACM'],
    { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' },
  );
  if (result.status !== 0) return false;
  const normalized = path.posix.normalize(baseline);
  const lines = result.stdout.split('\n').filter((s) => s.length > 0);
  return lines.some((line) => path.posix.normalize(line) === normalized);
}

/**
 * The non-pending dispositions the gate protects. Centralised here so a
 * future disposition addition (e.g., 'deferred') can opt-in to survivor
 * protection by appending its identifier rather than scattering the set
 * across the predicate sites.
 */
const PROTECTED_DISPOSITIONS: readonly Disposition[] = [
  'keep-with-reason',
  'ignore-with-justification',
  'refactor',
];

function isProtected(disposition: Disposition): boolean {
  return (PROTECTED_DISPOSITIONS as readonly string[]).includes(disposition);
}

interface Transition {
  readonly id: string;
  readonly headDisposition: Disposition;
  readonly stagedDisposition: Disposition;
  readonly headReason: string | null;
  readonly firstMember: string;
}

/**
 * Compute the destructive-transition list (HEAD non-pending → staged
 * pending, matched by id). Pure function over two parsed `ClonesYaml`
 * documents; the I/O happens in `main()`.
 */
export function findDestructiveTransitions(
  headDoc: ClonesYaml,
  stagedDoc: ClonesYaml,
): readonly Transition[] {
  const stagedById = new Map<string, ClonesYaml['clones'][number]>();
  for (const g of stagedDoc.clones) stagedById.set(g.id, g);
  const out: Transition[] = [];
  for (const headEntry of headDoc.clones) {
    if (!isProtected(headEntry.disposition)) continue;
    const stagedEntry = stagedById.get(headEntry.id);
    if (stagedEntry === undefined) continue; // dropped entirely; not this gate's job
    if (stagedEntry.disposition !== 'pending') continue; // disposition preserved (or changed but still non-pending)
    out.push({
      id: headEntry.id,
      headDisposition: headEntry.disposition,
      stagedDisposition: stagedEntry.disposition,
      headReason: headEntry.reason,
      firstMember: headEntry.members[0] ?? '<no-members>',
    });
  }
  return out;
}

function reportTransitions(transitions: readonly Transition[]): void {
  process.stderr.write(
    `check-disposition-survivor: ${transitions.length} entries would silently revert ` +
      `to \`pending\` in this commit's clones.yaml diff:\n\n`,
  );
  for (const t of transitions) {
    process.stderr.write(`  id: ${t.id}\n`);
    process.stderr.write(`    HEAD disposition:   ${t.headDisposition}\n`);
    process.stderr.write(`    staged disposition: ${t.stagedDisposition}\n`);
    process.stderr.write(`    first member:       ${t.firstMember}\n`);
    if (t.headReason !== null) {
      const oneLine = t.headReason.split('\n')[0]?.slice(0, 120) ?? '';
      process.stderr.write(`    HEAD reason:        ${oneLine}${(t.headReason.split('\n')[0]?.length ?? 0) > 120 ? '…' : ''}\n`);
    }
    process.stderr.write('\n');
  }
  process.stderr.write(
    `If the disposition loss is intentional (e.g., you are converting the entry to\n` +
      `\`pending\` deliberately), re-run with --force to override the gate. Otherwise,\n` +
      `restore the disposition in clones.yaml before committing — the previous reason\n` +
      `is in HEAD's version of the file (\`git show HEAD:docs/scope-discovery/clones.yaml\`).\n`,
  );
}

async function main(): Promise<number> {
  let cli: Cli;
  try {
    cli = parseCli(process.argv.slice(2));
  } catch (err) {
    console.error(errorMessage(err));
    return 2;
  }

  if (!isBaselineStaged(cli.baseline, REPO_ROOT)) {
    // Nothing to do; the gate only runs when the baseline is part of
    // the commit. Silent in this branch so pre-commit output stays
    // clean for the common case (most commits don't touch clones.yaml).
    return 0;
  }

  const headSpec = `${cli.headRef}:${cli.baseline}`;
  const stagedSpec = `:${cli.baseline}`;

  const headResult = gitShowBlob(headSpec, REPO_ROOT);
  if (!headResult.ok && !headResult.missing) {
    console.error(`git show ${headSpec} failed:\n${headResult.stderr}`);
    return 2;
  }
  if (!headResult.ok) {
    // No HEAD version of the baseline (first commit to add it; nothing
    // to compare). Gate is vacuously satisfied.
    return 0;
  }

  const stagedResult = gitShowBlob(stagedSpec, REPO_ROOT);
  if (!stagedResult.ok && !stagedResult.missing) {
    console.error(`git show ${stagedSpec} failed:\n${stagedResult.stderr}`);
    return 2;
  }
  if (!stagedResult.ok) {
    // The file is staged for deletion (or otherwise unreadable from
    // index). A deletion is a destructive operation but it's visible
    // in the standard pre-commit diff — outside this gate's narrow
    // remit (silent same-id disposition reverts).
    return 0;
  }

  let headDoc: ClonesYaml;
  let stagedDoc: ClonesYaml;
  try {
    headDoc = parseClonesYamlStrict(headResult.text);
  } catch (err) {
    console.error(`failed to parse HEAD's clones.yaml: ${errorMessage(err)}`);
    return 2;
  }
  try {
    stagedDoc = parseClonesYamlStrict(stagedResult.text);
  } catch (err) {
    console.error(`failed to parse staged clones.yaml: ${errorMessage(err)}`);
    return 2;
  }

  const transitions = findDestructiveTransitions(headDoc, stagedDoc);
  if (transitions.length === 0) return 0;

  if (cli.force) {
    process.stderr.write(
      `check-disposition-survivor: --force override; ${transitions.length} ` +
        `non-pending → pending transition(s) accepted.\n`,
    );
    for (const t of transitions) {
      process.stderr.write(`  ${t.id}: ${t.headDisposition} → ${t.stagedDisposition}\n`);
    }
    return 0;
  }

  reportTransitions(transitions);
  return 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`unexpected failure: ${errorMessage(err)}`);
    process.exit(2);
  },
);
