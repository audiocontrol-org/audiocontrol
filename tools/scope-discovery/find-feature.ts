/**
 * tools/scope-discovery/find-feature.ts
 *
 * Backing script for `make scope-inventory FEATURE=<slug>` (T2.7).
 *
 * Operator ergonomics + validation shim. Searches the version's status
 * directories under `docs/<version>/` for a feature directory matching
 * the supplied slug, and either:
 *
 *   - prints the resolved path + instructions for invoking the
 *     `/scope-inventory` skill (success path, exit 0); OR
 *   - prints the list of candidate paths searched and exits non-zero
 *     (failure path) so the caller (operator or hook) sees a clear
 *     error instead of a silent no-op.
 *
 * This script does NOT run discovery itself. Discovery is performed by
 * the `/scope-inventory` skill (Phase 3 T3.3) which the operator types
 * inside a Claude Code session. Skills are not shell-callable; this
 * Make target's job is to validate the feature exists + tell the
 * operator what to type next.
 *
 * Layout reference: docs/scope-discovery/LAYOUT.md.
 *
 * Invocation:
 *   tsx tools/scope-discovery/find-feature.ts <slug>
 *
 * Exit code:
 *   0   feature found; instructions printed
 *   1   feature not found in any status dir; candidate paths printed
 *   2   usage error (missing slug)
 */

import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { errorMessage } from './util/typeguards.js';

const REPO_ROOT = process.cwd();
const VERSION = '1.0';
const STATUS_DIRS: ReadonlyArray<string> = [
  '000-PENDING',
  '001-IN-PROGRESS',
  '002-BLOCKED',
  '003-COMPLETE',
];

interface FoundFeature {
  readonly status: string;
  readonly absPath: string;
  readonly relPath: string;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function candidatePaths(slug: string): ReadonlyArray<{ status: string; absPath: string; relPath: string }> {
  return STATUS_DIRS.map((status) => {
    const relPath = join('docs', VERSION, status, slug);
    return {
      status,
      absPath: join(REPO_ROOT, relPath),
      relPath,
    };
  });
}

async function findFeature(slug: string): Promise<FoundFeature | null> {
  for (const candidate of candidatePaths(slug)) {
    if (await pathExists(candidate.absPath)) {
      return candidate;
    }
  }
  return null;
}

function printInstructions(found: FoundFeature, slug: string): void {
  const scopeInventoryDir = join(found.relPath, 'scope-inventory');
  process.stdout.write(
    [
      `feature found: ${found.relPath} (status: ${found.status})`,
      '',
      `To run discovery, invoke the skill inside a Claude Code session:`,
      ``,
      `    /scope-inventory ${slug}`,
      ``,
      `The skill will create a new run directory at:`,
      ``,
      `    ${scopeInventoryDir}/runs/<ISO-stamp>-<runId>/`,
      ``,
      `containing per-agent findings/, captures/, meta.json, synthesis.md,`,
      `and appending an entry to:`,
      ``,
      `    ${scopeInventoryDir}/journal.md`,
      ``,
      `Layout reference: docs/scope-discovery/LAYOUT.md`,
      '',
    ].join('\n'),
  );
}

function printNotFound(slug: string): void {
  process.stderr.write(`error: no feature directory found for slug "${slug}"\n`);
  process.stderr.write(`searched (under docs/${VERSION}/):\n`);
  for (const candidate of candidatePaths(slug)) {
    process.stderr.write(`  - ${candidate.relPath}\n`);
  }
  process.stderr.write(
    [
      '',
      'Hint: the feature directory is created by `/dw-lifecycle:setup <slug>`',
      'and lives in one of the four status directories above. Confirm the',
      'slug spelling and that setup has been run for this feature.',
      '',
    ].join('\n'),
  );
}

function printUsage(): void {
  process.stderr.write('Usage: make scope-inventory FEATURE=<feature-slug>\n');
  process.stderr.write('   or: tsx tools/scope-discovery/find-feature.ts <feature-slug>\n');
}

async function main(argv: ReadonlyArray<string>): Promise<number> {
  const slug = argv[0];
  if (slug === undefined || slug.trim() === '') {
    printUsage();
    return 2;
  }
  const found = await findFeature(slug);
  if (found === null) {
    printNotFound(slug);
    return 1;
  }
  printInstructions(found, slug);
  return 0;
}

main(process.argv.slice(2))
  .then((code) => {
    process.exit(code);
  })
  .catch((err: unknown) => {
    process.stderr.write(`find-feature: ${errorMessage(err)}\n`);
    process.exit(2);
  });
