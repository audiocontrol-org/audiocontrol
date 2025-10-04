#!/usr/bin/env tsx
import { copyFileSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

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

const rootDir = join(import.meta.dirname, '..');
const licensePath = join(rootDir, 'LICENSE');

const packages = getPackages(rootDir);

console.log('Copying LICENSE to all packages...');
for (const pkgName of packages) {
  const pkgPath = join(rootDir, pkgName);
  const pkgLicense = join(pkgPath, 'LICENSE');
  copyFileSync(licensePath, pkgLicense);
  console.log(`  ✓ ${pkgName}/LICENSE`);
}

console.log('\nLICENSE files copied successfully');
