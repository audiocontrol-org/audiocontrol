#!/usr/bin/env tsx
import { execSync } from 'child_process';
import { join } from 'path';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';

interface PackageJson {
  name: string;
  version: string;
  private?: boolean;
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

function createGitHubRelease(rootDir: string, version: string, modules: string[]): void {
  const tag = `audio-tools@${version}`;
  const title = `audio-tools ${version}`;
  const notes = `## Published Modules

${modules.map(name => `- ${name}@${version}`).join('\n')}

Published to npm with Apache-2.0 license.

**Module**: \`modules/audio-tools\` within the ol_dsp monorepo

## Installation

\`\`\`bash
npm install ${modules[0]}
\`\`\`

See individual package READMEs for usage details.`;

  console.log(`\nCreating module tarball...`);
  const tarballName = `audio-tools-${version}.tar.gz`;
  const tarballPath = join(rootDir, tarballName);

  execCommand(`tar -czf "${tarballPath}" --exclude node_modules --exclude dist --exclude '*.tsbuildinfo' .`, rootDir);
  console.log(`✓ Created ${tarballName}`);

  console.log(`\nCreating GitHub release ${tag}...`);

  // Write notes to temporary file to avoid shell escaping issues
  const notesFile = join(rootDir, '.release-notes.tmp');
  writeFileSync(notesFile, notes, 'utf-8');

  try {
    execCommand(`gh release create "${tag}" --title "${title}" --notes-file "${notesFile}" "${tarballPath}"`, rootDir);
    console.log(`✓ GitHub release created: ${tag}`);

    execCommand(`rm -f "${tarballPath}" "${notesFile}"`, rootDir);
  } catch (error) {
    console.error('⚠️  Failed to create GitHub release');
    console.error('You can create it manually with:');
    console.error(`  gh release create "${tag}" --title "${title}" --notes-file "${notesFile}" "${tarballPath}"`);
    execCommand(`rm -f "${tarballPath}" "${notesFile}"`, rootDir);
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

  console.log('\nStep 2: Publish modules');
  execCommand(`tsx scripts/publish-modules.ts${dryRun ? ' --dry-run' : ''}`, rootDir);

  if (dryRun) {
    console.log('\n=== Dry Run Complete ===');
    console.log(`\nWould have:`);
    console.log(`  • Published ${modules.length} modules at v${version}`);
    console.log(`  • Committed audio-tools@${version}`);
    console.log(`  • Created GitHub release: audio-tools@${version}`);
    console.log(`\nNo changes were made.`);
    return;
  }

  console.log('\nStep 3: Commit version changes');
  execCommand('git add .', rootDir);
  execCommand(`git commit -m "chore(release): publish audio-tools@${version}"`, rootDir);
  console.log(`✓ Committed version ${version}`);

  console.log('\nStep 4: Create GitHub release and push');
  createGitHubRelease(rootDir, version, modules);
  execCommand('git push origin HEAD --follow-tags', rootDir);
  console.log('✓ Pushed commits and tags to remote');

  console.log('\n=== Release Complete ===');
  console.log(`\n✓ Published ${modules.length} modules at v${version}`);
  console.log(`✓ Committed and pushed audio-tools@${version}`);
  console.log(`✓ Created GitHub release: audio-tools@${version}`);
}

release();
