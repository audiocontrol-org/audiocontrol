/**
 * tools/check-css-duplication.validate.ts
 *
 * Proves that `tools/check-css-duplication.ts` actually catches the
 * known cross-page duplications on this branch. Reads the
 * ground-truth list from `.tmp/expected-duplications.txt` (lines
 * starting with `#` are comments) and runs the checker. Every stem on
 * the ground-truth list MUST appear in the checker's output. If any
 * entry is missing, this validator exits non-zero and names what was
 * dropped — that means the checker is broken and needs to be fixed
 * before its result can be trusted.
 *
 * The checker is allowed to find MORE than the ground truth — that's
 * a feature, not a bug. The reverse (checker finds less) is the bug
 * this script guards against.
 *
 * Run via:
 *   tsx tools/check-css-duplication.validate.ts
 *
 * Exit code:
 *   0   every ground-truth stem appears in checker output
 *   1   one or more missing
 *   2   filesystem / process error
 */

import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

interface CheckerPair {
  stem: string;
  identical: boolean;
}

async function runChecker(): Promise<CheckerPair[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'tsx',
      ['tools/check-css-duplication.ts', '--json'],
      { stdio: ['ignore', 'pipe', 'inherit'] },
    );
    let buf = '';
    child.stdout.on('data', (chunk) => {
      buf += chunk.toString();
    });
    child.on('close', (code) => {
      // checker exits 1 when duplicates exist — that's expected here
      if (code === 2) {
        reject(new Error(`checker exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(buf));
      } catch (err) {
        reject(err);
      }
    });
    child.on('error', reject);
  });
}

async function readGroundTruth(path: string): Promise<string[]> {
  const text = await readFile(path, 'utf8');
  return text
    .split('\n')
    .map((l) => l.replace(/#.*/, '').trim())
    .filter((l) => l.length > 0);
}

async function main(): Promise<void> {
  const expected = await readGroundTruth('tools/check-css-duplication.expected.txt');
  const found = await runChecker();
  const foundStems = new Set(found.map((p) => p.stem));

  const missing = expected.filter((stem) => !foundStems.has(stem));
  const extra = [...foundStems].filter((stem) => !expected.includes(stem));

  process.stdout.write(`expected ${expected.length} stems, checker found ${found.length}\n`);
  if (missing.length === 0) {
    process.stdout.write('  ✓ every expected stem appears in checker output\n');
  } else {
    process.stdout.write(`  ✗ ${missing.length} expected stem(s) MISSING from checker output:\n`);
    for (const s of missing) process.stdout.write(`     - "${s}"\n`);
  }
  if (extra.length > 0) {
    process.stdout.write(`  · ${extra.length} extra stem(s) found by checker (not in ground truth):\n`);
    for (const s of extra) process.stdout.write(`     + "${s}"\n`);
    process.stdout.write('    (these may be real duplicates the hand audit missed; add to ground truth or fix the duplication)\n');
  }
  process.exit(missing.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
