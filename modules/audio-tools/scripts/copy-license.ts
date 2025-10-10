#!/usr/bin/env tsx
import { copyFileSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

function getPackages(rootDir: string): string[] {
  const workspaceYaml = readFileSync(join(rootDir, 'pnpm-workspace.yaml'), 'utf-8');
  const packagePatterns = workspaceYaml
    .split('\n')
    .filter(line => line.trim().startsWith('-'))
    .map(line => line.trim().replace(/^-\s*['"]?/, '').replace(/['"]?\s*$/, ''));

  const packages: string[] = [];
  for (const pattern of packagePatterns) {
    // Handle glob patterns like 'modules/*'
    if (pattern.includes('*')) {
      const baseDir = pattern.replace('/*', '');
      const basePath = join(rootDir, baseDir);
      try {
        const entries = readdirSync(basePath);
        for (const entry of entries) {
          const entryPath = join(basePath, entry);
          if (statSync(entryPath).isDirectory()) {
            packages.push(join(baseDir, entry));
          }
        }
      } catch (err) {
        // Skip if directory doesn't exist
      }
    } else {
      const pkgPath = join(rootDir, pattern);
      try {
        if (statSync(pkgPath).isDirectory()) {
          packages.push(pattern);
        }
      } catch (err) {
        // Skip if directory doesn't exist
      }
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
