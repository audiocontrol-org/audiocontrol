#!/usr/bin/env tsx
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

type BumpType = 'major' | 'minor' | 'patch';

interface PackageJson {
  name: string;
  version: string;
  [key: string]: unknown;
}

function parseVersion(version: string): [number, number, number] {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid version format: ${version}`);
  }
  return parts as [number, number, number];
}

function bumpVersion(version: string, type: BumpType): string {
  const [major, minor, patch] = parseVersion(version);

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
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

function bumpAllVersions(bumpType: BumpType | string, dryRun: boolean) {
  const rootDir = join(import.meta.dirname, '..');
  const rootPackagePath = join(rootDir, 'package.json');

  const rootPkg: PackageJson = JSON.parse(readFileSync(rootPackagePath, 'utf-8'));
  const currentVersion = rootPkg.version;

  const newVersion = ['major', 'minor', 'patch'].includes(bumpType)
    ? bumpVersion(currentVersion, bumpType as BumpType)
    : bumpType;

  const [major, minor, patch] = parseVersion(newVersion);
  if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
    throw new Error(`Invalid version: ${newVersion}`);
  }

  if (dryRun) {
    console.log(`Would bump version: ${currentVersion} → ${newVersion}`);
  } else {
    console.log(`Bumping version: ${currentVersion} → ${newVersion}`);
  }

  updatePackageVersion(rootPackagePath, newVersion, dryRun);
  console.log(`  ${dryRun ? '→' : '✓'} Root package.json`);

  const packages = getPackages(rootDir);

  for (const pkgName of packages) {
    const packagePath = join(rootDir, pkgName, 'package.json');
    updatePackageVersion(packagePath, newVersion, dryRun);
    console.log(`  ${dryRun ? '→' : '✓'} ${pkgName}/package.json`);
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

if (!bumpType) {
  console.error('Usage: tsx scripts/bump-version.ts <major|minor|patch|x.y.z> [--dry-run]');
  process.exit(1);
}

bumpAllVersions(bumpType, dryRun);
