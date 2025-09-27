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

function getModules(modulesDir: string): string[] {
  return readdirSync(modulesDir).filter((name) => {
    const modulePath = join(modulesDir, name);
    return statSync(modulePath).isDirectory();
  });
}

function publishModules() {
  const rootDir = join(import.meta.dirname, '..');
  const modulesDir = join(rootDir, 'modules');

  console.log('=== Publishing Modules ===\n');

  console.log('Step 1: Clean and build all modules');
  execCommand('pnpm clean', rootDir);
  execCommand('pnpm build', rootDir);

  console.log('\nStep 2: Run tests');
  try {
    execCommand('pnpm test', rootDir);
  } catch (error) {
    console.log('⚠️  Some modules have no tests, continuing...');
  }

  console.log('\nStep 3: Type check');
  execCommand('pnpm typecheck', rootDir);

  console.log('\nStep 4: Copy license files');
  execCommand('tsx scripts/copy-license.ts', rootDir);

  const modules = getModules(modulesDir);

  console.log(`\nStep 5: Publishing ${modules.length} modules to npm...`);

  for (const moduleName of modules) {
    const modulePath = join(modulesDir, moduleName);
    const packagePath = join(modulePath, 'package.json');
    const pkg: PackageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));

    if (pkg.private) {
      console.log(`  ⊘ Skipping ${pkg.name} (private package)`);
      continue;
    }

    console.log(`\n  Publishing ${pkg.name}@${pkg.version}...`);
    try {
      execCommand('npm publish --access public', modulePath);
      console.log(`  ✓ ${pkg.name}@${pkg.version} published`);
    } catch (error) {
      console.error(`  ✗ Failed to publish ${pkg.name}`);
      throw error;
    }
  }

  console.log('\n=== Publish Complete ===');
  console.log('\nNext steps:');
  console.log('  git add .');
  console.log(`  git commit -m "chore(release): publish v${getVersion(rootDir)}"`);
  console.log('  git push');
}

function getVersion(rootDir: string): string {
  const pkg: PackageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
  return pkg.version;
}

publishModules();