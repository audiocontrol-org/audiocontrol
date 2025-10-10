#!/usr/bin/env tsx
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface PackageJson {
  version: string;
}

function updateDocumentationVersion(filePath: string, newVersion: string): void {
  const content = readFileSync(filePath, 'utf-8');

  // Replace all occurrences of audio-tools@X.X.X-alpha.X with new version
  const updatedContent = content.replace(
    /audio-tools@\d+\.\d+\.\d+(-[a-z]+\.\d+)?/g,
    `audio-tools@${newVersion}`
  );

  if (content !== updatedContent) {
    writeFileSync(filePath, updatedContent, 'utf-8');
    console.log(`✓ Updated ${filePath}`);
  } else {
    console.log(`  No changes needed in ${filePath}`);
  }
}

function updateDocsVersion() {
  const rootDir = join(import.meta.dirname, '..');

  // Get version from a published module's package.json (not root)
  // Use sampler-lib as the canonical version source
  const pkgPath = join(rootDir, 'modules/sampler-lib/package.json');
  const pkg: PackageJson = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const version = pkg.version;

  console.log(`\nUpdating documentation to version ${version}...\n`);

  // List of documentation files to update
  const docsToUpdate = [
    'README.md',
    'modules/sampler-backup/README.md',
    'modules/sampler-export/README.md',
  ];

  for (const docPath of docsToUpdate) {
    const fullPath = join(rootDir, docPath);
    updateDocumentationVersion(fullPath, version);
  }

  console.log(`\n✓ Documentation updated to version ${version}\n`);
}

updateDocsVersion();
