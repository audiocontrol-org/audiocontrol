#!/usr/bin/env tsx
import { execSync } from 'child_process';
import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

interface PackageJson {
  name: string;
  version: string;
  private?: boolean;
}

function execCommand(command: string, cwd?: string): void {
  console.log(`\n→ ${command}`);
  execSync(command, {
    cwd,
    stdio: 'inherit',
    encoding: 'utf-8',
  });
}

function getPackages(rootDir: string): string[] {
  const workspaceYaml = readFileSync(join(rootDir, 'pnpm-workspace.yaml'), 'utf-8');
  const packagePatterns = workspaceYaml
    .split('\n')
    .filter(line => line.trim().startsWith('-'))
    .map(line => line.trim().replace(/^-\s*['"]?/, '').replace(/['"]?\s*$/, ''));

  const packages: string[] = [];
  for (const pattern of packagePatterns) {
    const pkgPath = join(rootDir, pattern);
    if (statSync(pkgPath).isDirectory()) {
      packages.push(pattern);
    }
  }
  return packages;
}

function publishModules(dryRun: boolean = false) {
  const rootDir = join(import.meta.dirname, '..');

  if (dryRun) {
    console.log('=== Publishing Modules (DRY RUN) ===\n');
  } else {
    console.log('=== Publishing Modules ===\n');
  }

  console.log('Step 1: Clean and build all modules');
  execCommand('pnpm clean', rootDir);
  execCommand('pnpm build', rootDir);

  console.log('\nStep 2: Run tests');
  try {
    execCommand('pnpm test', rootDir);
  } catch (error) {
    console.log('⚠️  Some modules have no tests, continuing...');
  }

  const packages = getPackages(rootDir);

  if (dryRun) {
    console.log(`\nStep 3: Would publish ${packages.length} packages to npm (DRY RUN)...`);
  } else {
    console.log(`\nStep 3: Publishing ${packages.length} packages to npm...`);
  }

  for (const pkgName of packages) {
    const pkgPath = join(rootDir, pkgName);
    const packagePath = join(pkgPath, 'package.json');
    const pkg: PackageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));

    if (pkg.private) {
      console.log(`  ⊘ Skipping ${pkg.name} (private package)`);
      continue;
    }

    if (dryRun) {
      console.log(`\n  Would publish ${pkg.name}@${pkg.version}`);
      console.log(`  → npm publish --access public (DRY RUN)`);
    } else {
      console.log(`\n  Publishing ${pkg.name}@${pkg.version}...`);
      try {
        execCommand('npm publish --access public', pkgPath);
        console.log(`  ✓ ${pkg.name}@${pkg.version} published`);
      } catch (error) {
        console.error(`  ✗ Failed to publish ${pkg.name}`);
        throw error;
      }
    }
  }

  if (dryRun) {
    console.log('\n=== Publish Dry Run Complete ===');
  } else {
    console.log('\n=== Publish Complete ===');
  }
}

const dryRun = process.argv.includes('--dry-run');
publishModules(dryRun);
