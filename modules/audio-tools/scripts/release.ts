#!/usr/bin/env tsx
import { execSync } from 'child_process';
import { join } from 'path';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { createHash } from 'crypto';

interface PackageJson {
  name: string;
  version: string;
  private?: boolean;
}

interface InstallerAsset {
  path: string;
  name: string;
  checksumPath: string;
  checksumName: string;
}

function execCommand(command: string, cwd?: string): void {
  console.log(`\n→ ${command}`);
  execSync(command, {
    cwd,
    stdio: 'inherit',
    encoding: 'utf-8',
  });
}

function getVersion(rootDir: string): string {
  const pkg: PackageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
  return pkg.version;
}

function getPackages(rootDir: string): string[] {
  const workspaceYaml = readFileSync(join(rootDir, 'pnpm-workspace.yaml'), 'utf-8');
  const packagePatterns = workspaceYaml
    .split('\n')
    .filter(line => line.trim().startsWith('-'))
    .map(line => {
      // Remove leading '- ' and quotes, then strip inline comments
      let pkg = line.trim().replace(/^-\s*['"]?/, '').replace(/['"]?\s*$/, '');
      // Strip inline comments (# ...)
      const commentIndex = pkg.indexOf('#');
      if (commentIndex !== -1) {
        pkg = pkg.substring(0, commentIndex).trim();
      }
      // Remove trailing quotes if any
      return pkg.replace(/['"]$/, '');
    });

  const packages: string[] = [];
  for (const pattern of packagePatterns) {
    const pkgPath = join(rootDir, pattern);
    if (statSync(pkgPath).isDirectory()) {
      packages.push(pattern);
    }
  }
  return packages;
}

function getPublishedModules(rootDir: string): string[] {
  const packages = getPackages(rootDir);
  const published: string[] = [];

  for (const pkgName of packages) {
    const packagePath = join(rootDir, pkgName, 'package.json');
    const pkg: PackageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
    if (!pkg.private) {
      published.push(pkg.name);
    }
  }
  return published;
}

function prepareInstallerAsset(rootDir: string, version: string): InstallerAsset {
  const installerSource = join(rootDir, 'install.sh');
  const assetsDir = join(rootDir, '.release-assets');

  // Create assets directory
  execCommand(`mkdir -p "${assetsDir}"`, rootDir);

  // Read installer content
  const installerContent = readFileSync(installerSource, 'utf-8');

  // Update INSTALLER_VERSION to match package version
  const versionedInstaller = installerContent.replace(
    /^INSTALLER_VERSION="[^"]*"$/m,
    `INSTALLER_VERSION="${version}"`
  );

  // Write versioned installer
  const installerAssetPath = join(assetsDir, 'install.sh');
  writeFileSync(installerAssetPath, versionedInstaller, 'utf-8');

  // Make installer executable
  execCommand(`chmod +x "${installerAssetPath}"`, rootDir);

  // Generate SHA256 checksum
  const hash = createHash('sha256');
  hash.update(versionedInstaller);
  const checksum = hash.digest('hex');

  // Write checksum file (format: <hash>  <filename>)
  const checksumContent = `${checksum}  install.sh\n`;
  const checksumPath = join(assetsDir, 'install.sh.sha256');
  writeFileSync(checksumPath, checksumContent, 'utf-8');

  console.log(`✓ Prepared installer asset with SHA256: ${checksum.substring(0, 16)}...`);

  return {
    path: installerAssetPath,
    name: 'install.sh',
    checksumPath: checksumPath,
    checksumName: 'install.sh.sha256',
  };
}

function cleanupInstallerAssets(rootDir: string): void {
  const assetsDir = join(rootDir, '.release-assets');
  execCommand(`rm -rf "${assetsDir}"`, rootDir);
}

function createGitHubRelease(rootDir: string, version: string, modules: string[]): void {
  const tag = `audio-tools@${version}`;
  const title = `audio-tools ${version}`;

  // Prepare installer asset
  const installerAsset = prepareInstallerAsset(rootDir, version);

  const notes = `## Published Modules

${modules.map(name => `- ${name}@${version}`).join('\n')}

Published to npm with Apache-2.0 license.

**Module**: \`modules/audio-tools\` within the ol_dsp monorepo

## Installation

### Quick Install (Recommended)
\`\`\`bash
# Install from this release
curl -fsSL https://github.com/oletizi/ol_dsp/releases/download/${tag}/install.sh | bash

# Or download and inspect first
curl -fsSL https://github.com/oletizi/ol_dsp/releases/download/${tag}/install.sh -o install.sh
chmod +x install.sh
./install.sh
\`\`\`

### Verify Installer (Optional)
\`\`\`bash
# Download checksum
curl -fsSL https://github.com/oletizi/ol_dsp/releases/download/${tag}/install.sh.sha256 -o install.sh.sha256

# Verify (macOS/Linux)
shasum -a 256 -c install.sh.sha256
\`\`\`

### npm Installation
\`\`\`bash
npm install ${modules[0]}
\`\`\`

See individual package READMEs for usage details.

## Installer Version Compatibility

- **Installer Version**: \`${version}\`
- **Minimum Package Version**: \`${version}\`
- **Tested Package Versions**: \`${version}\`

This installer is specifically tested with packages at version \`${version}\`. For other package versions, download the matching installer release.`;

  console.log(`\nCreating module tarball...`);
  const tarballName = `audio-tools-${version}.tar.gz`;
  const tarballPath = join(rootDir, tarballName);

  execCommand(`tar -czf "${tarballPath}" --exclude node_modules --exclude dist --exclude '*.tsbuildinfo' --exclude .release-assets .`, rootDir);
  console.log(`✓ Created ${tarballName}`);

  console.log(`\nCreating GitHub release ${tag}...`);

  // Write notes to temporary file to avoid shell escaping issues
  const notesFile = join(rootDir, '.release-notes.tmp');
  writeFileSync(notesFile, notes, 'utf-8');

  try {
    // Create release with multiple assets
    execCommand(
      `gh release create "${tag}" ` +
      `--title "${title}" ` +
      `--notes-file "${notesFile}" ` +
      `"${tarballPath}" ` +
      `"${installerAsset.path}#Installer Script" ` +
      `"${installerAsset.checksumPath}#Installer SHA256 Checksum"`,
      rootDir
    );
    console.log(`✓ GitHub release created: ${tag}`);
    console.log(`✓ Installer attached: ${installerAsset.name}`);
    console.log(`✓ Checksum attached: ${installerAsset.checksumName}`);

    // Cleanup
    execCommand(`rm -f "${tarballPath}" "${notesFile}"`, rootDir);
    cleanupInstallerAssets(rootDir);
  } catch (error) {
    console.error('⚠️  Failed to create GitHub release');
    console.error('You can create it manually with:');
    console.error(`  gh release create "${tag}" --title "${title}" --notes-file "${notesFile}" "${tarballPath}" "${installerAsset.path}" "${installerAsset.checksumPath}"`);
    execCommand(`rm -f "${tarballPath}" "${notesFile}"`, rootDir);
    cleanupInstallerAssets(rootDir);
    throw error;
  }
}

function release() {
  const bumpType = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');

  // Check for --preid flag
  const preidIndex = process.argv.indexOf('--preid');
  const prereleaseId = preidIndex !== -1 && process.argv[preidIndex + 1]
    ? process.argv[preidIndex + 1]
    : 'alpha';

  const validBumpTypes = ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease'];

  if (!bumpType || !validBumpTypes.includes(bumpType)) {
    console.error('Usage: pnpm release <major|minor|patch|premajor|preminor|prepatch|prerelease> [--preid <id>] [--dry-run]');
    console.error('\nStable releases:');
    console.error('  pnpm release patch                    # 1.0.0 → 1.0.1');
    console.error('  pnpm release minor                    # 1.0.0 → 1.1.0');
    console.error('  pnpm release major                    # 1.0.0 → 2.0.0');
    console.error('\nPre-releases:');
    console.error('  pnpm release prepatch                 # 1.0.0 → 1.0.1-alpha.0');
    console.error('  pnpm release prepatch --preid beta    # 1.0.0 → 1.0.1-beta.0');
    console.error('  pnpm release prerelease               # 1.0.0-alpha.0 → 1.0.0-alpha.1');
    console.error('\nOther:');
    console.error('  pnpm release minor --dry-run          # Test release without changes');
    process.exit(1);
  }

  const rootDir = join(import.meta.dirname, '..');

  if (dryRun) {
    console.log('=== DRY RUN - No Changes Will Be Made ===\n');
  } else {
    console.log('=== Release Process ===\n');
  }

  console.log('Step 1: Bump version');
  const preidFlag = prereleaseId !== 'alpha' ? ` --preid ${prereleaseId}` : '';
  execCommand(`tsx scripts/bump-version.ts ${bumpType}${preidFlag}${dryRun ? ' --dry-run' : ''}`, rootDir);

  const version = getVersion(rootDir);
  const modules = getPublishedModules(rootDir);

  console.log('\nStep 2: Update documentation URLs');
  if (!dryRun) {
    execCommand(`tsx scripts/update-docs-version.ts`, rootDir);
  } else {
    console.log(`Would update documentation to version ${version}`);
  }

  console.log('\nStep 3: Publish modules');
  execCommand(`tsx scripts/publish-modules.ts${dryRun ? ' --dry-run' : ''}`, rootDir);

  if (dryRun) {
    console.log('\n=== Dry Run Complete ===');
    console.log(`\nWould have:`);
    console.log(`  • Updated documentation URLs to v${version}`);
    console.log(`  • Published ${modules.length} modules at v${version}`);
    console.log(`  • Committed audio-tools@${version}`);
    console.log(`  • Created GitHub release: audio-tools@${version}`);
    console.log(`\nNo changes were made.`);
    return;
  }

  console.log('\nStep 4: Commit version changes');
  execCommand('git add .', rootDir);
  execCommand(`git commit -m "chore(release): publish audio-tools@${version}"`, rootDir);
  console.log(`✓ Committed version ${version}`);

  console.log('\nStep 5: Create GitHub release and push');
  createGitHubRelease(rootDir, version, modules);
  execCommand('git push origin HEAD --follow-tags', rootDir);
  console.log('✓ Pushed commits and tags to remote');

  console.log('\n=== Release Complete ===');
  console.log(`\n✓ Published ${modules.length} modules at v${version}`);
  console.log(`✓ Committed and pushed audio-tools@${version}`);
  console.log(`✓ Created GitHub release: audio-tools@${version}`);
}

release();
