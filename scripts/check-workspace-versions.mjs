#!/usr/bin/env node

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function readPackageJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const rootPackagePath = 'package.json';
const modulesDir = 'modules';

const rootPackage = readPackageJson(rootPackagePath);
const rootVersion = rootPackage.version;

if (!rootVersion) {
  console.error(`Missing version in ${rootPackagePath}`);
  process.exit(1);
}

const mismatches = [];

for (const moduleName of readdirSync(modulesDir)) {
  const modulePackagePath = join(modulesDir, moduleName, 'package.json');
  try {
    const modulePackage = readPackageJson(modulePackagePath);
    if (!modulePackage.version) {
      mismatches.push(`${modulePackagePath}: missing version`);
      continue;
    }
    if (modulePackage.version !== rootVersion) {
      mismatches.push(
        `${modulePackagePath}: ${modulePackage.version} (expected ${rootVersion})`,
      );
    }
  } catch {
    // Skip entries in modules/ that are not package directories.
  }
}

if (mismatches.length > 0) {
  console.error('Workspace version check failed. Found mismatched package versions:');
  for (const mismatch of mismatches) {
    console.error(`- ${mismatch}`);
  }
  process.exit(1);
}

console.log(`Workspace version check passed (${rootVersion}).`);
