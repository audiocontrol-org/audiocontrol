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

  if (!bumpType || !['major', 'minor', 'patch'].includes(bumpType)) {
    console.error('Usage: pnpm release <major|minor|patch>');
    console.error('\nExample:');
    console.error('  pnpm release patch  # 1.0.1 → 1.0.2');
    console.error('  pnpm release minor  # 1.0.1 → 1.1.0');
    console.error('  pnpm release major  # 1.0.1 → 2.0.0');
    process.exit(1);
  }

  const rootDir = join(import.meta.dirname, '..');

  console.log('=== Release Process ===\n');

  console.log('Step 1: Bump version');
  execCommand(`tsx scripts/bump-version.ts ${bumpType}`, rootDir);

  const version = getVersion(rootDir);
  const modules = getPublishedModules(rootDir);

  console.log('\nStep 2: Publish modules');
  execCommand('tsx scripts/publish-modules.ts', rootDir);

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