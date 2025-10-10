#!/usr/bin/env tsx
import { readFileSync, writeFileSync, copyFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { createHash } from 'crypto';

interface PackageJson {
  version: string;
}

function createGitHubRelease() {
  const rootDir = join(import.meta.dirname, '..');

  // Get version from sampler-lib package.json
  const pkgPath = join(rootDir, 'modules/sampler-lib/package.json');
  const pkg: PackageJson = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const version = pkg.version;
  const tag = `audio-tools@${version}`;

  console.log(`\nCreating GitHub release for ${tag}...\n`);

  // Check if release already exists
  try {
    execSync(`gh release view ${tag}`, { stdio: 'pipe' });
    console.log(`✓ Release ${tag} already exists, skipping creation`);
    return;
  } catch (error) {
    // Release doesn't exist, continue
  }

  // Prepare installer files in temp directory
  const tempDir = join(rootDir, '.release-temp');
  execSync(`mkdir -p ${tempDir}`, { stdio: 'inherit' });

  try {
    // Copy main installer
    const installerSrc = join(rootDir, 'scripts/install/main.sh');
    const installerDest = join(tempDir, 'install.sh');
    copyFileSync(installerSrc, installerDest);
    console.log('✓ Prepared install.sh');

    // Generate checksum
    const installerContent = readFileSync(installerDest);
    const hash = createHash('sha256').update(installerContent).digest('hex');
    const checksumContent = `${hash}  install.sh\n`;
    const checksumDest = join(tempDir, 'install.sh.sha256');
    writeFileSync(checksumDest, checksumContent, 'utf-8');
    console.log('✓ Generated install.sh.sha256');

    // Create release with gh CLI
    const releaseNotes = `Audio Tools ${version}

## Installation

\`\`\`bash
curl -fsSL https://github.com/oletizi/ol_dsp/releases/download/${tag}/install.sh | bash
\`\`\`

Or download and inspect first:

\`\`\`bash
curl -fsSL https://github.com/oletizi/ol_dsp/releases/download/${tag}/install.sh -o install.sh
chmod +x install.sh
./install.sh
\`\`\`

## npm Packages

- [@oletizi/audiotools@${version}](https://www.npmjs.com/package/@oletizi/audiotools)
- [@oletizi/sampler-lib@${version}](https://www.npmjs.com/package/@oletizi/sampler-lib)
- [@oletizi/sampler-backup@${version}](https://www.npmjs.com/package/@oletizi/sampler-backup)
- [@oletizi/sampler-export@${version}](https://www.npmjs.com/package/@oletizi/sampler-export)
`;

    const releaseNotesPath = join(tempDir, 'release-notes.md');
    writeFileSync(releaseNotesPath, releaseNotes, 'utf-8');

    // Create release
    const createCmd = [
      'gh release create',
      `"${tag}"`,
      `--title "Audio Tools ${version}"`,
      `--notes-file "${releaseNotesPath}"`,
      version.includes('alpha') || version.includes('beta') ? '--prerelease' : '',
      `"${installerDest}"`,
      `"${checksumDest}"`
    ].filter(Boolean).join(' ');

    console.log(`\n✓ Creating release: ${tag}`);
    execSync(createCmd, { stdio: 'inherit', cwd: rootDir });

    console.log(`\n✓ GitHub release created successfully!`);
    console.log(`  View at: https://github.com/oletizi/ol_dsp/releases/tag/${tag}`);

  } finally {
    // Cleanup
    execSync(`rm -rf ${tempDir}`, { stdio: 'inherit' });
  }
}

createGitHubRelease();
