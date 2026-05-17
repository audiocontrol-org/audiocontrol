import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const moduleRoot = process.cwd();
const repoRoot = resolve(moduleRoot, '../..');
const testUiRoot = resolve(moduleRoot, 'test/ui');
const inventoryPath = resolve(repoRoot, 'ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md');

function walkFiles(root: string): string[] {
  const entries = readdirSync(root);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(root, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }
    files.push(fullPath);
  }

  return files;
}

function readInventoryLine(rowId: string): string {
  const content = readFileSync(inventoryPath, 'utf8');
  const line = content
    .split('\n')
    .find((candidate) => candidate.startsWith(`| ${rowId} |`));

  if (!line) {
    throw new Error(`Inventory row not found for ${rowId}`);
  }

  return line;
}

describe('operator runbook structural checks', () => {
  it('keeps forbidden UI patterns out of functional test/ui specs', () => {
    const files = walkFiles(testUiRoot).filter((path) => /\.(ts|tsx)$/.test(path));
    const offenders: Array<{ file: string; pattern: string }> = [];

    for (const file of files) {
      const relativePath = relative(moduleRoot, file);
      const isRootUiSpec =
        relativePath.startsWith('test/ui/') &&
        !relativePath.includes('/in-context/') &&
        !relativePath.includes('/contract/') &&
        !relativePath.includes('/rendering/') &&
        !relativePath.includes('/capabilities/') &&
        !relativePath.endsWith('README.md');

      if (!isRootUiSpec) {
        continue;
      }

      const content = readFileSync(file, 'utf8');

      if (content.includes('getByTestId(')) {
        offenders.push({ file: relativePath, pattern: 'getByTestId(' });
      }
      if (content.includes('.click(')) {
        offenders.push({ file: relativePath, pattern: '.click(' });
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps the in-context tier lint-clean under the test-discipline plugin', () => {
    expect(() =>
      execFileSync('pnpm', ['exec', 'eslint', 'test/ui/in-context', '--ext', 'ts,tsx'], {
        cwd: moduleRoot,
        encoding: 'utf8',
        stdio: 'pipe',
      })
    ).not.toThrow();
  });

  it('keeps the test-discipline lint scope on the full test/ui tree', () => {
    const printed = execFileSync(
      'pnpm',
      ['exec', 'eslint', '--print-config', 'test/ui/hypothetical.spec.ts'],
      { cwd: moduleRoot, encoding: 'utf8' }
    );
    const config = JSON.parse(printed) as {
      plugins?: string[];
      rules?: Record<string, unknown>;
    };

    expect(config.plugins ?? []).toContain('@audiocontrol/test-discipline');
    expect(Object.keys(config.rules ?? {})).toContain(
      '@audiocontrol/test-discipline/no-forbidden-ui-patterns'
    );
    expect(Object.keys(config.rules ?? {})).toContain(
      '@audiocontrol/test-discipline/no-internal-imports'
    );
  });

  it('keeps the D-TONE-ENV-02 row parseable for the operator sign-off pass', () => {
    const line = readInventoryLine('D-TONE-ENV-02');
    const cells = line
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);

    expect(cells[0]).toBe('D-TONE-ENV-02');
    expect(cells[6]).toBe('none');
    expect(cells[7]).toBe('partial');
  });
});
