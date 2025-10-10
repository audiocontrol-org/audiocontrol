#!/usr/bin/env tsx
import { readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

function ensureChangeset() {
  const rootDir = join(import.meta.dirname, '..');
  const changesetDir = join(rootDir, '.changeset');

  // Get all .md files except README.md and config.json
  const files = readdirSync(changesetDir).filter(
    f => f.endsWith('.md') && f !== 'README.md'
  );

  if (files.length > 0) {
    console.log(`✓ Found ${files.length} existing changeset(s), proceeding with release`);
    return;
  }

  console.log('No changesets found, creating automatic changeset...');

  // Get current date for changeset name
  const timestamp = new Date().toISOString().split('T')[0];
  const changesetPath = join(changesetDir, `auto-release-${timestamp}.md`);

  // Create changeset with all packages
  const changeset = `---
"@oletizi/audiotools": patch
"@oletizi/audiotools-config": patch
"@oletizi/sampler-lib": patch
"@oletizi/sampler-devices": patch
"@oletizi/sampler-midi": patch
"@oletizi/sampler-translate": patch
"@oletizi/sampler-export": patch
"@oletizi/sampler-backup": patch
"@oletizi/lib-runtime": patch
"@oletizi/lib-device-uuid": patch
"@oletizi/sampler-attic": patch
---

Automated release
`;

  writeFileSync(changesetPath, changeset, 'utf-8');
  console.log(`✓ Created automatic changeset: ${changesetPath}`);
}

ensureChangeset();
