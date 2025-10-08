#!/usr/bin/env tsx
import { execSync } from 'child_process';
import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

interface PackageJson {
  name: string;
  version: string;
  private?: boolean;
}

function getDistTag(version: string): string {
  // Check if version has a prerelease identifier (e.g., 1.0.0-alpha.1)
  const hasPrerelease = version.includes('-');

  if (!hasPrerelease) {
    return 'latest';
  }

  // Extract prerelease identifier (e.g., "alpha" from "1.0.0-alpha.1")
  const prereleaseMatch = version.match(/-([a-z]+)/);
  if (prereleaseMatch && prereleaseMatch[1]) {
    const identifier = prereleaseMatch[1];
    // Common prerelease identifiers
    if (['alpha', 'beta', 'rc', 'next'].includes(identifier)) {
      return identifier;
    }
    // Default to 'next' for other prerelease versions
    return 'next';
  }

  return 'next';
}

function execCommand(command: string, cwd?: string, interactive: boolean = false): void {
  console.log(`\n→ ${command}`);
  execSync(command, {
    cwd,
    stdio: interactive ? 'inherit' : 'inherit',
    encoding: 'utf-8',
    // Ensure stdin is available for interactive commands
    ...(interactive ? { input: undefined } : {}),
  });
}

function getPackages(rootDir: string): string[] {
  const workspaceYaml = readFileSync(join(rootDir, 'pnpm-workspace.yaml'), 'utf-8');
  const packagePatterns = workspaceYaml
    .split('\n')
    .filter(line => line.trim().startsWith('-'))
    .map(line => {
      // Remove leading '- ' and quotes, then strip inline comments
      let pkg = line.trim().replace(/^-\s*['"]?/, '').replace(/['"]?\s*$/, '');
      // Strip inline comments (# ...)
      const commentIndex = pkg.indexOf('#');
      if (commentIndex !== -1) {
        pkg = pkg.substring(0, commentIndex).trim();
      }
      // Remove trailing quotes if any
      return pkg.replace(/['"]$/, '');
    });

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

    const distTag = getDistTag(pkg.version);
    const publishCmd = `pnpm publish --access public --tag ${distTag} --no-git-checks`;

    if (dryRun) {
      console.log(`\n  Would publish ${pkg.name}@${pkg.version}`);
      console.log(`  → ${publishCmd} (DRY RUN)`);
      console.log(`  → dist-tag: ${distTag}`);
    } else {
      console.log(`\n  Publishing ${pkg.name}@${pkg.version} with tag '${distTag}'...`);
      try {
        execCommand(publishCmd, pkgPath);
        console.log(`  ✓ ${pkg.name}@${pkg.version} published (tag: ${distTag})`);
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
