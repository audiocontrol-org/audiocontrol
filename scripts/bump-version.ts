#!/usr/bin/env tsx
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

type BumpType = 'major' | 'minor' | 'patch' | 'premajor' | 'preminor' | 'prepatch' | 'prerelease';

interface PackageJson {
  name: string;
  version: string;
  [key: string]: unknown;
}

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}

function parseVersion(version: string): ParsedVersion {
  // Split on '-' to separate core version from prerelease
  const [coreVersion, ...prereleaseParts] = version.split('-');
  const prerelease = prereleaseParts.length > 0 ? prereleaseParts.join('-') : undefined;

  // Parse core version (e.g., "1.0.0")
  const parts = coreVersion.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid version format: ${version}`);
  }

  return {
    major: parts[0],
    minor: parts[1],
    patch: parts[2],
    prerelease,
  };
}

function bumpVersion(version: string, type: BumpType, prereleaseId: string = 'alpha'): string {
  const parsed = parseVersion(version);
  const { major, minor, patch, prerelease } = parsed;

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    case 'premajor':
      return `${major + 1}.0.0-${prereleaseId}.0`;
    case 'preminor':
      return `${major}.${minor + 1}.0-${prereleaseId}.0`;
    case 'prepatch':
      return `${major}.${minor}.${patch + 1}-${prereleaseId}.0`;
    case 'prerelease':
      if (!prerelease) {
        // If no prerelease, bump patch and add prerelease
        return `${major}.${minor}.${patch + 1}-${prereleaseId}.0`;
      }
      // Parse prerelease (e.g., "alpha.0" -> ["alpha", "0"])
      const prereleaseParts = prerelease.split('.');
      const lastPart = prereleaseParts[prereleaseParts.length - 1];
      const prereleaseNum = parseInt(lastPart, 10);

      if (!isNaN(prereleaseNum)) {
        // Increment the numeric part
        prereleaseParts[prereleaseParts.length - 1] = String(prereleaseNum + 1);
        return `${major}.${minor}.${patch}-${prereleaseParts.join('.')}`;
      } else {
        // No numeric part, add .0
        return `${major}.${minor}.${patch}-${prerelease}.0`;
      }
  }
}

function updatePackageVersion(path: string, newVersion: string, dryRun: boolean): void {
  const content = readFileSync(path, 'utf-8');
  const pkg: PackageJson = JSON.parse(content);
  pkg.version = newVersion;
  if (!dryRun) {
    writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
  }
}

function bumpAllVersions(bumpType: BumpType | string, prereleaseId: string, dryRun: boolean) {
  const rootDir = join(import.meta.dirname, '..');
  const modulesDir = join(rootDir, 'modules');
  const rootPackagePath = join(rootDir, 'package.json');

  const rootPkg: PackageJson = JSON.parse(readFileSync(rootPackagePath, 'utf-8'));
  const currentVersion = rootPkg.version;

  const validBumpTypes: BumpType[] = ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease'];
  const newVersion = validBumpTypes.includes(bumpType as BumpType)
    ? bumpVersion(currentVersion, bumpType as BumpType, prereleaseId)
    : bumpType;

  // Validate the new version
  const parsed = parseVersion(newVersion);
  if (isNaN(parsed.major) || isNaN(parsed.minor) || isNaN(parsed.patch)) {
    throw new Error(`Invalid version: ${newVersion}`);
  }

  if (dryRun) {
    console.log(`Would bump version: ${currentVersion} → ${newVersion}`);
  } else {
    console.log(`Bumping version: ${currentVersion} → ${newVersion}`);
  }

  updatePackageVersion(rootPackagePath, newVersion, dryRun);
  console.log(`  ${dryRun ? '→' : '✓'} Root package.json`);

  const modules = readdirSync(modulesDir).filter((name) => {
    const modulePath = join(modulesDir, name);
    return statSync(modulePath).isDirectory();
  });

  for (const moduleName of modules) {
    const packagePath = join(modulesDir, moduleName, 'package.json');
    updatePackageVersion(packagePath, newVersion, dryRun);
    console.log(`  ${dryRun ? '→' : '✓'} ${moduleName}/package.json`);
  }

  if (dryRun) {
    console.log(`\nDry run complete - would bump to: ${newVersion}`);
  } else {
    console.log(`\nVersion bump complete: ${newVersion}`);
  }
  return newVersion;
}

const bumpType = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

// Check for --preid flag
const preidIndex = process.argv.indexOf('--preid');
const prereleaseId = preidIndex !== -1 && process.argv[preidIndex + 1]
  ? process.argv[preidIndex + 1]
  : 'alpha';

if (!bumpType) {
  console.error('Usage: tsx scripts/bump-version.ts <major|minor|patch|premajor|preminor|prepatch|prerelease|x.y.z> [--preid <id>] [--dry-run]');
  console.error('\nExamples:');
  console.error('  tsx scripts/bump-version.ts patch              # 1.0.0 → 1.0.1');
  console.error('  tsx scripts/bump-version.ts prepatch           # 1.0.0 → 1.0.1-alpha.0');
  console.error('  tsx scripts/bump-version.ts prepatch --preid beta  # 1.0.0 → 1.0.1-beta.0');
  console.error('  tsx scripts/bump-version.ts prerelease         # 1.0.0-alpha.0 → 1.0.0-alpha.1');
  console.error('  tsx scripts/bump-version.ts 1.0.0-alpha.1      # Set exact version');
  process.exit(1);
}

bumpAllVersions(bumpType, prereleaseId, dryRun);