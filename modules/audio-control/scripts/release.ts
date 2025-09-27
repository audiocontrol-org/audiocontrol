#!/usr/bin/env tsx
import { execSync } from 'child_process';
import { join } from 'path';

function execCommand(command: string, cwd?: string): void {
  console.log(`\n→ ${command}`);
  execSync(command, {
    cwd,
    stdio: 'inherit',
    encoding: 'utf-8',
  });
}

function release() {
  const bumpType = process.argv[2];

  if (!bumpType || !['major', 'minor', 'patch'].includes(bumpType)) {
    console.error('Usage: pnpm release <major|minor|patch>');
    console.error('\nExample:');
    console.error('  pnpm release patch  # 1.0.1 → 1.0.2');
    console.error('  pnpm release minor  # 1.0.1 → 1.1.0');
    console.error('  pnpm release major  # 1.0.1 → 2.0.0');
    process.exit(1);
  }

  const rootDir = join(import.meta.dirname, '..');

  console.log('=== Release Process ===\n');

  console.log('Step 1: Bump version');
  execCommand(`tsx scripts/bump-version.ts ${bumpType}`, rootDir);

  console.log('\nStep 2: Publish modules');
  execCommand('tsx scripts/publish-modules.ts', rootDir);

  console.log('\n=== Release Complete ===');
}

release();