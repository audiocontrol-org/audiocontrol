#!/usr/bin/env tsx

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, renameSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

interface InventoryRowState {
  signOff: string;
  coverage: string;
}

const moduleRoot = process.cwd();
const repoRoot = resolve(moduleRoot, '../..');
const inventoryPath = join(repoRoot, 'ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md');
const tier3SpecRelative =
  'modules/roland-sxx0-editor/test/ui/in-context/tones.envelope.in-context.spec.ts';
const tier3SpecPath = join(repoRoot, tier3SpecRelative);
const dId = 'D-TONE-ENV-02';

function readInventoryRowState(path: string, rowId: string): InventoryRowState {
  const line = readFileSync(path, 'utf8')
    .split('\n')
    .find((candidate) => candidate.startsWith(`| ${rowId} |`));

  if (!line) {
    throw new Error(`Inventory row not found for ${rowId}`);
  }

  const cells = line
    .split('|')
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0);

  if (cells.length < 8) {
    throw new Error(`Inventory row for ${rowId} had unexpected shape.`);
  }

  return {
    signOff: cells[6],
    coverage: cells[7],
  };
}

function run(cmd: string, args: string[], cwd: string): void {
  execFileSync(cmd, args, {
    cwd,
    stdio: 'inherit',
  });
}

export function readCurrentBaseline(): InventoryRowState {
  return readInventoryRowState(inventoryPath, dId);
}

export function assertSmokePrereqs(baseline: InventoryRowState): void {
  if (baseline.coverage !== 'confident') {
    throw new Error(
      `Blocked: ${dId} must be at coverage=confident before the Tier 3 drop smoke can prove a downgrade. Current state: signOff=${baseline.signOff}, coverage=${baseline.coverage}.`
    );
  }

  if (baseline.signOff === 'none') {
    throw new Error(
      `Blocked: ${dId} must carry a real operator sign-off before the Tier 3 drop smoke can run.`
    );
  }
}

function main(): void {
  const baseline = readCurrentBaseline();
  assertSmokePrereqs(baseline);

  const tempWorktree = mkdtempSync(join(tmpdir(), 'ac-runbook-tier3-smoke-'));
  let worktreeAdded = false;

  try {
    run('git', ['worktree', 'add', '--detach', tempWorktree, 'HEAD'], repoRoot);
    worktreeAdded = true;

    const tempSpecPath = join(tempWorktree, tier3SpecRelative);
    renameSync(tempSpecPath, `${tempSpecPath}.disabled`);

    run('pnpm', ['run', 'check-credibility'], tempWorktree);
    run('pnpm', ['run', 'generate-coverage-manifest'], tempWorktree);

    const afterRemoval = readInventoryRowState(
      join(tempWorktree, 'ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md'),
      dId
    );

    if (afterRemoval.coverage !== 'partial') {
      throw new Error(
        `Expected ${dId} to drop to coverage=partial after removing Tier 3 evidence in the temp worktree. Saw coverage=${afterRemoval.coverage}.`
      );
    }

    process.stdout.write(
      `[runbook-tier3-drop-smoke] PASS: ${dId} dropped from confident to partial in temp worktree ${tempWorktree}\n`
    );
  } finally {
    if (worktreeAdded) {
      run('git', ['worktree', 'remove', '--force', tempWorktree], repoRoot);
    }
  }
}

try {
  const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
  const scriptPath = resolve(moduleRoot, 'scripts/runbook-tier3-drop-smoke.ts');
  if (invokedPath === scriptPath) {
    main();
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[runbook-tier3-drop-smoke] ${message}\n`);
  process.exit(1);
}
