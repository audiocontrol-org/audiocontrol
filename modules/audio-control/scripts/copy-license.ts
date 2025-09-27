#!/usr/bin/env tsx
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const rootDir = join(import.meta.dirname, '..');
const modulesDir = join(rootDir, 'modules');
const licenseSource = join(rootDir, 'LICENCE.md');

function copyLicenseToModules() {
  const licenseContent = readFileSync(licenseSource, 'utf-8');
  const modules = readdirSync(modulesDir).filter((name) => {
    const modulePath = join(modulesDir, name);
    return statSync(modulePath).isDirectory();
  });

  console.log(`Copying license to ${modules.length} modules...`);

  for (const moduleName of modules) {
    const licenseDest = join(modulesDir, moduleName, 'LICENSE');
    writeFileSync(licenseDest, licenseContent, 'utf-8');
    console.log(`  ✓ ${moduleName}/LICENSE`);
  }

  console.log('License copy complete.');
}

copyLicenseToModules();