#!/usr/bin/env tsx
import { execSync } from 'child_process';
import { join } from 'path';
import { readFileSync, readdirSync, statSync } from 'fs';

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

function getPublishedModules(rootDir: string): string[] {
  const modulesDir = join(rootDir, 'modules');
  const modules = readdirSync(modulesDir).filter((name) => {
    const modulePath = join(modulesDir, name);
    return statSync(modulePath).isDirectory();
  });

  const published: string[] = [];
  for (const moduleName of modules) {
    const packagePath = join(modulesDir, moduleName, 'package.json');
    const pkg: PackageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
    if (!pkg.private) {
      published.push(pkg.name);
    }
  }
  return published;
}

function createGitHubRelease(rootDir: string, version: string, modules: string[]): void {

  const tag = `audio-control@${version}`;
  const title = `audio-control ${version}`;
  const notes = `## Published Modules

${modules.map(name => `- ${name}@${version}`).join('\n')}

Published to npm with Apache-2.0 license.

**Module**: \`modules/audio-control\` within the ol_dsp monorepo

## Installation

\`\`\`bash
npm install ${modules[0]}
\`\`\`

See individual package READMEs for usage details.`;

  console.log(`\nCreating module tarball...`);
  const tarballName = `audio-control-${version}.tar.gz`;
  const tarballPath = join(rootDir, tarballName);

  // Create tarball of just this module directory
  execCommand(`tar -czf "${tarballPath}" --exclude node_modules --exclude dist --exclude '*.tsbuildinfo' .`, rootDir);
  console.log(`✓ Created ${tarballName}`);

  console.log(`\nCreating GitHub release ${tag}...`);

  try {
    execCommand(`gh release create "${tag}" --title "${title}" --notes "${notes}" "${tarballPath}"`, rootDir);
    console.log(`✓ GitHub release created: ${tag}`);

    // Clean up tarball
    execCommand(`rm -f "${tarballPath}"`, rootDir);
  } catch (error) {
    console.error('⚠️  Failed to create GitHub release');
    console.error('You can create it manually with:');
    console.error(`  gh release create "${tag}" --title "${title}" --notes "${notes}" "${tarballPath}"`);
    // Clean up tarball even on error
    execCommand(`rm -f "${tarballPath}"`, rootDir);
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
    console.error('  pnpm release patch                    # 1.20.0 → 1.20.1');
    console.error('  pnpm release minor                    # 1.20.0 → 1.21.0');
    console.error('  pnpm release major                    # 1.20.0 → 2.0.0');
    console.error('\nPre-releases:');
    console.error('  pnpm release prepatch                 # 1.20.0 → 1.20.1-alpha.0');
    console.error('  pnpm release prepatch --preid beta    # 1.20.0 → 1.20.1-beta.0');
    console.error('  pnpm release prerelease               # 1.20.0-alpha.0 → 1.20.0-alpha.1');
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
    console.log(`  • Committed audio-control@${version}`);
    console.log(`  • Created GitHub release: audio-control@${version}`);
    console.log(`\nNo changes were made.`);
    return;
  }

  console.log('\nStep 3: Commit version changes');
  execCommand('git add .', rootDir);
  execCommand(`git commit -m "chore(release): publish audio-control@${version}"`, rootDir);
  console.log(`✓ Committed version ${version}`);

  console.log('\nStep 4: Create GitHub release and push');
  createGitHubRelease(rootDir, version, modules);
  execCommand('git push origin HEAD --follow-tags', rootDir);
  console.log('✓ Pushed commits and tags to remote');

  console.log('\n=== Release Complete ===');
  console.log(`\n✓ Published ${modules.length} modules at v${version}`);
  console.log(`✓ Committed and pushed audio-control@${version}`);
  console.log(`✓ Created GitHub release: audio-control@${version}`);
}

release();
