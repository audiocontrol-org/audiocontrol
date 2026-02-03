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
"@audiocontrol/launch-control-xl3": patch
"@audiocontrol/canonical-midi-maps": patch
"@audiocontrol/ardour-midi-maps": patch
"@audiocontrol/live-max-cc-router": patch
---

Automated release
`;

  writeFileSync(changesetPath, changeset, 'utf-8');
  console.log(`✓ Created automatic changeset: ${changesetPath}`);
}

ensureChangeset();
