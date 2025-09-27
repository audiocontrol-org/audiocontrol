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

function updatePackageVersion(path: string, newVersion: string): void {
  const content = readFileSync(path, 'utf-8');
  const pkg: PackageJson = JSON.parse(content);
  pkg.version = newVersion;
  writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
}

function bumpAllVersions(bumpType: BumpType | string) {
  const rootDir = join(import.meta.dirname, '..');
  const modulesDir = join(rootDir, 'modules');
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

  console.log(`Bumping version: ${currentVersion} → ${newVersion}`);

  updatePackageVersion(rootPackagePath, newVersion);
  console.log(`  ✓ Root package.json`);

  const modules = readdirSync(modulesDir).filter((name) => {
    const modulePath = join(modulesDir, name);
    return statSync(modulePath).isDirectory();
  });

  for (const moduleName of modules) {
    const packagePath = join(modulesDir, moduleName, 'package.json');
    updatePackageVersion(packagePath, newVersion);
    console.log(`  ✓ ${moduleName}/package.json`);
  }

  console.log(`\nVersion bump complete: ${newVersion}`);
  return newVersion;
}

const bumpType = process.argv[2];
if (!bumpType) {
  console.error('Usage: tsx scripts/bump-version.ts <major|minor|patch|x.y.z>');
  process.exit(1);
}

bumpAllVersions(bumpType);