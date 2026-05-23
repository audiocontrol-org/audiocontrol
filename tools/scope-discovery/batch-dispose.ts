/**
 * tools/scope-discovery/batch-dispose.ts
 *
 * Operator CLI: apply a single (disposition, reason) to N clone-group
 * ids at once. Promoted from the operator-built `.tmp/batch-dispose.ts`
 * per workplan T7.4 so it's discoverable + tested.
 *
 * CLI flags:
 *   --ids <id1,id2,...>      required, comma-separated content-hashed ids
 *   --disposition <kind>     required; one of pending,
 *                             keep-with-reason, ignore-with-justification.
 *                             `refactor` is REJECTED — refactor entries
 *                             carry five precondition fields (canonical_side,
 *                             canonical_reason, [new_shape_summary], tests,
 *                             tests_proof) that don't fit a single --reason
 *                             text; the CLI prints an actionable redirect
 *                             to manual editing + the validate target.
 *   --reason "<text>"        required; applied to every id in --ids.
 *   --show-existing          opt-in; for ids that are ALREADY non-pending,
 *                             print the existing disposition + reason
 *                             (we never overwrite a non-pending entry).
 *   --clones <path>          override clones.yaml path
 *                             (default: docs/scope-discovery/clones.yaml).
 *   --dry-run                load, plan, summarize; skip write + verify.
 *
 * Exit codes:
 *   0  applied + verified (or no APPLY work to do).
 *   1  wrote but verify-after-write detected a mismatch (the failure mode
 *      this task exists to prevent — never silent).
 *   2  invalid args, missing/malformed clones.yaml, or any unknown id.
 *
 * Unknown ids fail HARD (exit 2) — silent-skipping a typoed id would let
 * the typo slip through.
 *
 * DRY: reuses `parseClonesYaml`, `serializeClonesYaml`, and the
 * `Disposition` / `CloneGroup` types from `clones-yaml.ts`. No
 * hand-rolled YAML.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  type CloneGroup,
  type ClonesYaml,
  type Disposition,
  hasRefactorDisposition,
  parseClonesYaml,
  serializeClonesYaml,
} from './clones-yaml.js';
import { errorMessage } from './util/typeguards.js';

const DEFAULT_CLONES_PATH = 'docs/scope-discovery/clones.yaml';

/**
 * Dispositions a controller can apply via this CLI. `refactor` is
 * intentionally excluded — refactor entries require the five
 * precondition fields that don't fit a single --reason. The constant
 * doubles as the source-of-truth for the error-message enumeration.
 */
export const APPLYABLE_DISPOSITIONS: ReadonlyArray<
  Exclude<Disposition, 'refactor'>
> = ['pending', 'keep-with-reason', 'ignore-with-justification'];

function isApplyableDisposition(
  v: string,
): v is Exclude<Disposition, 'refactor'> {
  return (APPLYABLE_DISPOSITIONS as readonly string[]).includes(v);
}

interface ParsedArgs {
  readonly ids: readonly string[];
  readonly disposition: Exclude<Disposition, 'refactor'>;
  readonly reason: string;
  readonly showExisting: boolean;
  readonly clonesPath: string;
  readonly dryRun: boolean;
}

/**
 * CLI argument parser. Throws on missing required arg, unknown flag,
 * empty --ids, invalid --disposition, or --disposition refactor. The
 * caller catches and exits 2.
 */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  let idsRaw: string | null = null;
  let dispositionRaw: string | null = null;
  let reason: string | null = null;
  let showExisting = false;
  let clonesPath: string = DEFAULT_CLONES_PATH;
  let dryRun = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--ids') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error(`--ids requires a value`);
      idsRaw = next;
      i += 1;
    } else if (arg === '--disposition') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error(`--disposition requires a value`);
      dispositionRaw = next;
      i += 1;
    } else if (arg === '--reason') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error(`--reason requires a value`);
      reason = next;
      i += 1;
    } else if (arg === '--clones') {
      const next = argv[i + 1];
      if (next === undefined) throw new Error(`--clones requires a path value`);
      clonesPath = next;
      i += 1;
    } else if (arg === '--show-existing') {
      showExisting = true;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else {
      throw new Error(`unknown flag: ${arg}`);
    }
  }
  if (idsRaw === null) {
    throw new Error(`--ids <id1,id2,...> is required`);
  }
  const ids = idsRaw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (ids.length === 0) {
    throw new Error(`--ids must contain at least one id (got empty list)`);
  }
  if (dispositionRaw === null) {
    throw new Error(
      `--disposition <kind> is required; one of: ${APPLYABLE_DISPOSITIONS.join(', ')}`,
    );
  }
  if (dispositionRaw === 'refactor') {
    throw new Error(
      `refactor dispositions require manual editing (canonical_side, ` +
        `tests, tests_proof). Use a text editor + ` +
        `\`make check-refactor-preconditions-validate\` to verify.`,
    );
  }
  if (!isApplyableDisposition(dispositionRaw)) {
    throw new Error(
      `--disposition must be one of: ${APPLYABLE_DISPOSITIONS.join(', ')} ` +
        `(got "${dispositionRaw}")`,
    );
  }
  if (reason === null) {
    throw new Error(`--reason "<text>" is required`);
  }
  if (reason.length === 0) {
    throw new Error(`--reason must be non-empty`);
  }
  return {
    ids,
    disposition: dispositionRaw,
    reason,
    showExisting,
    clonesPath,
    dryRun,
  };
}

/** Per-id classification computed during planning. */
type IdPlan =
  | { readonly kind: 'apply'; readonly id: string; readonly group: CloneGroup }
  | {
      readonly kind: 'skip';
      readonly id: string;
      readonly group: CloneGroup;
      readonly existingDisposition: Disposition;
      readonly existingReason: string | null;
    }
  | { readonly kind: 'unknown'; readonly id: string };

export interface BatchDisposeResult {
  readonly code: 0 | 1 | 2;
  readonly applied: readonly string[];
  readonly skipped: readonly string[];
  readonly unknown: readonly string[];
  readonly verified: boolean;
}

/**
 * Injectable filesystem operations so the adversarial validator can
 * simulate a forged-write scenario (writer flips one entry's reason
 * between write and re-read) without monkey-patching fs.
 */
export interface BatchDisposeIO {
  readonly readFile: (path: string) => Promise<string>;
  readonly writeFile: (path: string, contents: string) => Promise<void>;
  readonly stdout: (line: string) => void;
  readonly stderr: (line: string) => void;
}

const DEFAULT_IO: BatchDisposeIO = {
  readFile: (path) => readFile(path, 'utf8'),
  writeFile: (path, contents) => writeFile(path, contents, 'utf8'),
  stdout: (line) => process.stdout.write(line),
  stderr: (line) => process.stderr.write(line),
};

/**
 * Programmatic entrypoint. Exported so the adversarial validator can
 * drive it without spawning a subprocess.
 */
export async function runBatchDispose(
  argv: readonly string[],
  io: BatchDisposeIO = DEFAULT_IO,
): Promise<BatchDisposeResult> {
  let args: ParsedArgs;
  try {
    args = parseArgs(argv);
  } catch (err) {
    io.stderr(`error: ${errorMessage(err)}\n`);
    return emptyResult(2);
  }
  const absPath = resolve(args.clonesPath);
  let doc: ClonesYaml;
  try {
    doc = await loadClones(absPath, io);
  } catch (err) {
    io.stderr(`error: ${errorMessage(err)}\n`);
    return emptyResult(2);
  }
  const plan = classify(doc.clones, args.ids);
  const unknownIds = plan.filter((p) => p.kind === 'unknown').map((p) => p.id);
  if (unknownIds.length > 0) {
    io.stderr(
      `error: unknown id${unknownIds.length === 1 ? '' : 's'} (not in ${args.clonesPath}): ${unknownIds.join(', ')}\n`,
    );
    return {
      code: 2,
      applied: [],
      skipped: [],
      unknown: unknownIds,
      verified: false,
    };
  }
  printSkipMessages(plan, args, io);
  const applyPlans = plan.filter(
    (p): p is Extract<IdPlan, { kind: 'apply' }> => p.kind === 'apply',
  );
  const appliedIds = applyPlans.map((p) => p.id);
  const skippedIds = plan
    .filter((p): p is Extract<IdPlan, { kind: 'skip' }> => p.kind === 'skip')
    .map((p) => p.id);
  if (args.dryRun) {
    printDryRun(applyPlans, args, io);
    return summarize(
      { code: 0, applied: appliedIds, skipped: skippedIds, unknown: [], verified: false },
      io,
      args,
    );
  }
  if (applyPlans.length === 0) {
    return summarize(
      { code: 0, applied: [], skipped: skippedIds, unknown: [], verified: true },
      io,
      args,
    );
  }
  const updated = applyDispositions(doc, applyPlans, args);
  try {
    await io.writeFile(absPath, serializeClonesYaml(updated));
  } catch (err) {
    io.stderr(`error: write failed: ${errorMessage(err)}\n`);
    return {
      code: 1,
      applied: appliedIds,
      skipped: skippedIds,
      unknown: [],
      verified: false,
    };
  }
  const verified = await verifyAfterWrite(absPath, applyPlans, args, io);
  return summarize(
    {
      code: verified ? 0 : 1,
      applied: appliedIds,
      skipped: skippedIds,
      unknown: [],
      verified,
    },
    io,
    args,
  );
}

function emptyResult(code: 0 | 1 | 2): BatchDisposeResult {
  return { code, applied: [], skipped: [], unknown: [], verified: false };
}

async function loadClones(
  absPath: string,
  io: BatchDisposeIO,
): Promise<ClonesYaml> {
  let text: string;
  try {
    text = await io.readFile(absPath);
  } catch (err) {
    throw new Error(`failed to read clones file at ${absPath}: ${errorMessage(err)}`);
  }
  const parsed = parseClonesYaml(text);
  if (parsed === null) {
    throw new Error(
      `clones file at ${absPath} has malformed shape (missing top-level keys or wrong types)`,
    );
  }
  return parsed;
}

/**
 * Classify each id as apply / skip / unknown. Preserves input order in
 * the returned array so summary output is predictable.
 */
function classify(
  clones: readonly CloneGroup[],
  ids: readonly string[],
): readonly IdPlan[] {
  const byId = new Map<string, CloneGroup>();
  for (const g of clones) byId.set(g.id, g);
  return ids.map((id): IdPlan => {
    const group = byId.get(id);
    if (group === undefined) return { kind: 'unknown', id };
    if (group.disposition === 'pending') return { kind: 'apply', id, group };
    return {
      kind: 'skip',
      id,
      group,
      existingDisposition: group.disposition,
      existingReason: group.reason,
    };
  });
}

function printSkipMessages(
  plan: readonly IdPlan[],
  args: ParsedArgs,
  io: BatchDisposeIO,
): void {
  for (const p of plan) {
    if (p.kind !== 'skip') continue;
    if (args.showExisting) {
      const reasonText = p.existingReason ?? '(null)';
      io.stdout(
        `id=${p.id}: already disposed as ${p.existingDisposition}: ${reasonText}\n`,
      );
    } else {
      io.stdout(
        `id=${p.id}: skipped (already ${p.existingDisposition}; use --show-existing for details)\n`,
      );
    }
  }
}

function printDryRun(
  applyPlans: ReadonlyArray<Extract<IdPlan, { kind: 'apply' }>>,
  args: ParsedArgs,
  io: BatchDisposeIO,
): void {
  io.stdout(`dry-run: would apply disposition=${args.disposition} reason=${JSON.stringify(args.reason)} to ${applyPlans.length} id(s):\n`);
  for (const p of applyPlans) {
    io.stdout(`  - ${p.id}\n`);
  }
}

/**
 * Build a new ClonesYaml document with the applied dispositions in
 * place. Non-affected groups are passed through unchanged. The
 * refactor-disposition variant cannot appear in applyPlans (refactor
 * groups would be kind=skip), so the rebuilt group is always the
 * non-refactor shape.
 */
function applyDispositions(
  doc: ClonesYaml,
  applyPlans: ReadonlyArray<Extract<IdPlan, { kind: 'apply' }>>,
  args: ParsedArgs,
): ClonesYaml {
  const applySet = new Set(applyPlans.map((p) => p.id));
  return {
    generated_at: doc.generated_at,
    clones: doc.clones.map((g) => {
      if (!applySet.has(g.id)) return g;
      // Defensive: refactor groups are filtered upstream (they have
      // disposition !== 'pending' and thus end up in skip plans). If
      // one ever reached here, the disposition switch would silently
      // drop the refactor-only fields — throw instead.
      if (hasRefactorDisposition(g)) {
        throw new Error(
          `internal error: tried to apply non-refactor disposition to refactor group ${g.id}`,
        );
      }
      return {
        id: g.id,
        lines: g.lines,
        members: g.members,
        disposition: args.disposition,
        reason: args.reason,
      };
    }),
  };
}

/**
 * Re-read the file we just wrote and confirm each applied id ended up
 * with the expected (disposition, reason). The function is robust
 * against simultaneous external edits: if the re-read parses but a row
 * doesn't match, we report the mismatch — silent miswrite is the
 * failure mode this task exists to prevent.
 */
async function verifyAfterWrite(
  absPath: string,
  applyPlans: ReadonlyArray<Extract<IdPlan, { kind: 'apply' }>>,
  args: ParsedArgs,
  io: BatchDisposeIO,
): Promise<boolean> {
  let doc: ClonesYaml;
  try {
    doc = await loadClones(absPath, io);
  } catch (err) {
    io.stderr(`error: verify-after-write re-read failed: ${errorMessage(err)}\n`);
    return false;
  }
  const byId = new Map(doc.clones.map((g) => [g.id, g] as const));
  const mismatches: string[] = [];
  for (const p of applyPlans) {
    const after = byId.get(p.id);
    if (after === undefined) {
      mismatches.push(`${p.id}: missing after write`);
      continue;
    }
    if (after.disposition !== args.disposition) {
      mismatches.push(
        `${p.id}: disposition expected ${args.disposition}, got ${after.disposition}`,
      );
    }
    if (after.reason !== args.reason) {
      mismatches.push(
        `${p.id}: reason expected ${JSON.stringify(args.reason)}, got ${JSON.stringify(after.reason)}`,
      );
    }
  }
  if (mismatches.length > 0) {
    io.stderr(
      `error: verify-after-write detected ${mismatches.length} mismatch(es):\n` +
        mismatches.map((m) => `  - ${m}\n`).join(''),
    );
    return false;
  }
  return true;
}

function summarize(
  result: BatchDisposeResult,
  io: BatchDisposeIO,
  args: ParsedArgs,
): BatchDisposeResult {
  const verifiedText = args.dryRun
    ? 'N/A (dry-run)'
    : result.verified
      ? 'Y'
      : 'N';
  io.stdout(
    `\nApplied: ${result.applied.length}` +
      (result.applied.length > 0 ? ` [${result.applied.join(', ')}]` : '') +
      '\n',
  );
  io.stdout(
    `Skipped (already-disposed): ${result.skipped.length}` +
      (result.skipped.length > 0 ? ` [${result.skipped.join(', ')}]` : '') +
      '\n',
  );
  io.stdout(
    `Unknown ids: ${result.unknown.length}` +
      (result.unknown.length > 0 ? ` [${result.unknown.join(', ')}]` : '') +
      '\n',
  );
  io.stdout(`Verified: ${verifiedText}\n`);
  return result;
}

// Invoke as CLI when this file is the entrypoint. Importing modules
// (validators, in particular) do NOT trigger process.exit.
const invokedDirect = import.meta.url === `file://${process.argv[1]}`;
if (invokedDirect) {
  runBatchDispose(process.argv.slice(2)).then(
    (result) => process.exit(result.code),
    (err) => {
      process.stderr.write(`harness error: ${errorMessage(err)}\n`);
      process.exit(2);
    },
  );
}
