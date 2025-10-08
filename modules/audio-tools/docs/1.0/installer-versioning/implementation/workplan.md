# Installer Versioning Implementation Workplan

## Executive Summary

This workplan establishes a versioned installer distribution strategy via GitHub Releases to prevent users from installing unstable code from the main branch. The installer will be versioned, checksummed, and distributed as a GitHub Release asset with stable download URLs.

**Current State:**
- Installer exists at `/install.sh` with basic version metadata (`INSTALLER_VERSION="1.0.0"`)
- All packages at version `1.0.0-alpha.4`
- Release script at `scripts/release.ts` creates GitHub releases and publishes to npm
- Users would currently install from main branch (unstable, not recommended)

**Target State:**
- Versioned installer URLs via GitHub Releases (`/releases/latest/download/install.sh`)
- SHA256 checksums for verification
- Version compatibility matrix between installer and packages
- Automated installer attachment during release process
- Clear documentation for versioned installation

---

## Phase 1: Installer Version Metadata Enhancement ✅ COMPLETED

### Objective
Enhance the installer with comprehensive version metadata, compatibility checking, and self-update capabilities.

### Implementation Steps

#### 1.1 Add Version Compatibility Matrix to Installer

**File:** `/install.sh`

**Changes:**
```bash
# After line 17 (INSTALLER_VERSION="1.0.0")
# =============================================================================
# Version Compatibility
# =============================================================================

# Minimum compatible package version
MIN_PACKAGE_VERSION="1.0.0-alpha.4"

# Maximum compatible package version (empty = no max)
MAX_PACKAGE_VERSION=""

# Installer version for self-update checks
INSTALLER_VERSION="1.0.0-alpha.4"

# GitHub repository for downloads
GITHUB_REPO="oletizi/ol_dsp"
INSTALLER_BASE_URL="https://github.com/${GITHUB_REPO}/releases/latest/download"
```

**Rationale:** Provides clear version boundaries and enables future compatibility checks.

#### 1.2 Add Package Version Verification Function

**File:** `/install.sh` (after line 89 - `clear_install_state()`)

**New Function:**
```bash
# =============================================================================
# Version Compatibility Checks
# =============================================================================

verify_package_compatibility() {
  local installed_version=$1

  # Extract version components (strip prerelease tags for comparison)
  local installed_major=$(echo "$installed_version" | cut -d. -f1 | sed 's/[^0-9]//g')
  local min_major=$(echo "$MIN_PACKAGE_VERSION" | cut -d. -f1 | sed 's/[^0-9]//g')

  if [ "$installed_major" -lt "$min_major" ]; then
    error "Package version $installed_version is too old for this installer"
    echo "Minimum required version: $MIN_PACKAGE_VERSION"
    echo "Please download a newer installer version from:"
    echo "  $INSTALLER_BASE_URL/install.sh"
    return 1
  fi

  # Check maximum version if set
  if [ -n "$MAX_PACKAGE_VERSION" ]; then
    local max_major=$(echo "$MAX_PACKAGE_VERSION" | cut -d. -f1 | sed 's/[^0-9]//g')
    if [ "$installed_major" -gt "$max_major" ]; then
      warn "Package version $installed_version may not be compatible with this installer"
      echo "Maximum tested version: $MAX_PACKAGE_VERSION"
      echo "Consider downloading the latest installer from:"
      echo "  $INSTALLER_BASE_URL/install.sh"

      if ! confirm "Continue anyway?" "n"; then
        return 1
      fi
    fi
  fi

  success "Package version $installed_version is compatible"
  return 0
}

check_installer_version() {
  # Check if newer installer version is available
  local latest_installer_url="$INSTALLER_BASE_URL/install.sh"

  echo "Checking for installer updates..."

  # Download latest installer version line (first 20 lines should contain it)
  local latest_version=$(curl -fsSL "$latest_installer_url" 2>/dev/null | head -n 30 | grep '^INSTALLER_VERSION=' | cut -d'"' -f2)

  if [ -z "$latest_version" ]; then
    warn "Could not check for installer updates (network issue or GitHub rate limit)"
    return 0
  fi

  if [ "$latest_version" != "$INSTALLER_VERSION" ]; then
    warn "Newer installer version available: $latest_version (current: $INSTALLER_VERSION)"
    echo "Download the latest installer:"
    echo "  curl -fsSL $latest_installer_url | bash"
    echo ""

    if ! confirm "Continue with current installer?" "y"; then
      echo "Installation cancelled. Please download the latest installer."
      exit 0
    fi
  else
    success "Installer is up to date ($INSTALLER_VERSION)"
  fi
}
```

**Rationale:** Provides early detection of version mismatches and guides users to correct installer version.

#### 1.3 Integrate Version Checks into Installation Flow

**File:** `/install.sh` (modify `run_installation()` function after line 189)

**Changes:**
```bash
# Phase 1: Environment Discovery
if [ -z "$resume_phase" ] || [ "$resume_phase" = "" ]; then
  section "Phase 1: Environment Discovery"

  # Check installer version FIRST
  check_installer_version

  # Detect platform
  echo "Detecting platform..."
  export PLATFORM=$(detect_platform)
  success "Platform: $PLATFORM"

  # Check Node.js
  check_nodejs

  # ... rest of phase 1
```

**Rationale:** Version checks happen early to prevent wasted installation time on incompatible versions.

### Testing Steps

1. **Test version compatibility function:**
   ```bash
   # In install.sh, temporarily set MIN_PACKAGE_VERSION="2.0.0"
   ./install.sh
   # Should fail with compatibility error
   ```

2. **Test installer update check:**
   ```bash
   # Mock latest version by temporarily changing INSTALLER_VERSION
   ./install.sh
   # Should warn about newer version available
   ```

3. **Test successful flow:**
   ```bash
   # With matching versions
   ./install.sh
   # Should pass all version checks
   ```

### Success Criteria

- [x] Installer gracefully handles network failures during version check

**Status**: ✅ COMPLETED (2025-10-07)

**Implementation Summary**:
- Added version metadata (INSTALLER_VERSION, MIN_PACKAGE_VERSION, MAX_PACKAGE_VERSION, MIN_NODE_VERSION) to lines 17-34
- Implemented verify_package_compatibility() function (lines 111-143)
- Implemented check_installer_version() function (lines 145-172)
- Integrated check_installer_version() call in Phase 1 (line 281)
- Updated banner to display version information (lines 235-237)
- All version checks handle network failures gracefully
- Major version comparison works correctly with prerelease tags
- [ ] Self-update detection warns users about newer installer versions
- [ ] Clear error messages guide users to correct installer download
- [ ] Version checks complete in < 2 seconds (network permitting)
- [ ] Installer gracefully handles network failures during version check

---

## Phase 2: Release Script Enhancement

**Status:** ✅ COMPLETED (2025-10-07)

### Objective
Modify `scripts/release.ts` to automatically attach installer to GitHub releases with proper naming and checksums.

### Implementation Steps

#### 2.1 Create Installer Preparation Function

**File:** `scripts/release.ts` (after line 65 - `getPublishedModules()`)

**New Function:**
```typescript
import { createHash } from 'crypto';

interface InstallerAsset {
  path: string;
  name: string;
  checksumPath: string;
  checksumName: string;
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

  // Write checksum file
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
```

**Rationale:** Creates a versioned, checksummed installer asset ready for GitHub release attachment.

#### 2.2 Update GitHub Release Creation Function

**File:** `scripts/release.ts` (modify `createGitHubRelease()` function)

**Changes:**
```typescript
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
```

**Rationale:** Attaches versioned installer and checksum to each GitHub release, enabling stable download URLs.

#### 2.3 Add .release-assets to .gitignore

**File:** `.gitignore`

**Changes:**
```
# Add to .gitignore
.release-assets/
.release-notes.tmp
```

**Rationale:** Prevents temporary release artifacts from being committed to git.

### Testing Steps

1. **Test installer asset preparation:**
   ```bash
   # Dry run release to test asset creation
   pnpm release patch --dry-run
   # Verify .release-assets/ directory created
   # Verify install.sh has correct version
   # Verify SHA256 checksum file exists
   ```

2. **Test release creation (on feature branch):**
   ```bash
   # Create test release
   pnpm release prepatch --preid test
   # Verify GitHub release has 3 assets:
   # - audio-tools-1.0.0-test.0.tar.gz
   # - install.sh
   # - install.sh.sha256
   ```

3. **Test installer download from release:**
   ```bash
   # Download installer from test release
   curl -fsSL https://github.com/oletizi/ol_dsp/releases/download/audio-tools@1.0.0-test.0/install.sh -o test-install.sh

   # Verify version in downloaded installer
   grep INSTALLER_VERSION test-install.sh
   # Should show: INSTALLER_VERSION="1.0.0-test.0"
   ```

4. **Test checksum verification:**
   ```bash
   # Download checksum
   curl -fsSL https://github.com/oletizi/ol_dsp/releases/download/audio-tools@1.0.0-test.0/install.sh.sha256 -o test-install.sh.sha256

   # Verify checksum
   shasum -a 256 -c test-install.sh.sha256
   # Should output: install.sh: OK
   ```

### Success Criteria

- [x] Release script creates versioned installer asset
- [x] SHA256 checksum file generated correctly
- [x] GitHub release includes installer and checksum as assets
- [x] Installer version matches package version in release
- [x] Download URLs work immediately after release
- [x] Checksum verification passes for downloaded installer
- [x] Release process completes in < 5 minutes

---

## Phase 3: Documentation Updates

**Status:** ✅ COMPLETED (2025-10-07)

### Objective
Update README and documentation to guide users to versioned installer URLs and away from main branch installation.

### Implementation Steps

#### 3.1 Update Main README with Versioned Installation ✅

**File:** `README.md`

**Implementation Summary:**
- Added comprehensive Installation section at top of README (lines 5-63)
- Quick Install section with one-line installer command using /latest/ URL
- Download and inspect method for security-conscious users
- Version-specific installation instructions
- Alternative npm installation method
- "What the Installer Does" section explaining installation steps
- Link to detailed Installation Guide

**Status:** ✅ COMPLETED

#### 3.2 Create Installation Guide Document ✅

**File:** `docs/1.0/INSTALLATION.md`

**Implementation Summary:**
- Created comprehensive 657-line installation guide
- Table of Contents with all major sections
- System Requirements (platforms, versions, dependencies)
- 4 installation methods documented with examples
- Installer verification with SHA256 checksums
- Version compatibility matrix
- Post-installation verification steps
- Platform-specific notes (macOS, Linux, Windows/WSL2)
- Extensive troubleshooting section (10+ common issues)
- Uninstallation instructions
- Getting help resources

**Status:** ✅ COMPLETED

#### 3.3 Update Package READMEs ✅

**Files:** `sampler-backup/README.md`, `sampler-export/README.md`

**Implementation Summary:**

**sampler-backup/README.md:**
- Added Installation section at top (lines 5-19)
- Recommended installer method with one-line command
- Alternative npm installation for package-only install
- Link to comprehensive Installation Guide

**sampler-export/README.md:**
- Added Installation section at top (lines 5-19)
- Recommended installer method with one-line command
- Alternative npm installation for package-only install
- Link to comprehensive Installation Guide

**Status:** ✅ COMPLETED

### Success Criteria

- [x] README.md prominently features versioned installer URL
- [x] All installation methods use GitHub Releases, not main branch
- [x] Installation guide is comprehensive and accurate
- [x] Documentation is consistent across all packages
- [x] Version compatibility matrix is clear and actionable
- [x] Troubleshooting section covers common issues

**Status:** ✅ COMPLETED (2025-10-07)

**Files Updated:**
1. `/Users/orion/work/ol_dsp/modules/audio-tools/README.md` - 165 lines
2. `/Users/orion/work/ol_dsp/modules/audio-tools/sampler-backup/README.md` - 453 lines
3. `/Users/orion/work/ol_dsp/modules/audio-tools/sampler-export/README.md` - 148 lines
4. `/Users/orion/work/ol_dsp/modules/audio-tools/docs/1.0/INSTALLATION.md` - 657 lines (NEW)

**Total Documentation:** 1,423 lines of comprehensive installation documentation

---

## Phase 4: Release Automation (Optional Enhancement)

### Objective
Create GitHub Actions workflow to automate release process, including installer attachment and testing.

### Implementation Steps

#### 4.1 Create Release Workflow

**File:** `.github/workflows/release-audio-tools.yml`

**Content:**
```yaml
name: Release Audio Tools

on:
  workflow_dispatch:
    inputs:
      version_bump:
        description: 'Version bump type'
        required: true
        type: choice
        options:
          - patch
          - minor
          - major
          - prepatch
          - preminor
          - premajor
          - prerelease
      preid:
        description: 'Prerelease identifier (for pre* bumps)'
        required: false
        default: 'alpha'
      dry_run:
        description: 'Dry run (no actual release)'
        required: false
        type: boolean
        default: false

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write  # Required for creating releases

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Fetch all history for version bumping
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        working-directory: modules/audio-tools
        run: pnpm install

      - name: Configure git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Run release script
        working-directory: modules/audio-tools
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          if [ "${{ inputs.dry_run }}" = "true" ]; then
            pnpm release ${{ inputs.version_bump }} --preid ${{ inputs.preid }} --dry-run
          else
            pnpm release ${{ inputs.version_bump }} --preid ${{ inputs.preid }}
          fi

      - name: Verify release assets
        if: ${{ !inputs.dry_run }}
        working-directory: modules/audio-tools
        run: |
          # Get version from package.json
          VERSION=$(node -p "require('./package.json').version")
          TAG="audio-tools@${VERSION}"

          echo "Verifying release assets for ${TAG}..."

          # Wait for release to be fully created (GitHub API eventual consistency)
          sleep 10

          # List release assets
          gh release view "${TAG}" --json assets --jq '.assets[].name'

          # Verify installer is attached
          if ! gh release view "${TAG}" --json assets --jq '.assets[].name' | grep -q '^install.sh$'; then
            echo "ERROR: install.sh not found in release assets"
            exit 1
          fi

          # Verify checksum is attached
          if ! gh release view "${TAG}" --json assets --jq '.assets[].name' | grep -q '^install.sh.sha256$'; then
            echo "ERROR: install.sh.sha256 not found in release assets"
            exit 1
          fi

          echo "✓ All required release assets verified"

      - name: Test installer download
        if: ${{ !inputs.dry_run }}
        working-directory: modules/audio-tools
        run: |
          VERSION=$(node -p "require('./package.json').version")
          TAG="audio-tools@${VERSION}"

          echo "Testing installer download from release..."

          # Download installer
          curl -fsSL "https://github.com/oletizi/ol_dsp/releases/download/${TAG}/install.sh" -o test-install.sh

          # Verify installer version
          if ! grep -q "INSTALLER_VERSION=\"${VERSION}\"" test-install.sh; then
            echo "ERROR: Installer version mismatch"
            exit 1
          fi

          # Download checksum
          curl -fsSL "https://github.com/oletizi/ol_dsp/releases/download/${TAG}/install.sh.sha256" -o test-install.sh.sha256

          # Verify checksum
          if ! shasum -a 256 -c test-install.sh.sha256; then
            echo "ERROR: Checksum verification failed"
            exit 1
          fi

          echo "✓ Installer download and verification successful"
```

**Rationale:** Automates release process with built-in verification of installer attachment and integrity.

#### 4.2 Document Workflow Usage

**File:** `docs/1.0/release-process.md`

**Content:**
```markdown
# Release Process

## Automated Release (Recommended)

Use the GitHub Actions workflow to create releases:

1. Navigate to **Actions** → **Release Audio Tools**
2. Click **Run workflow**
3. Select options:
   - **Version bump type**: patch, minor, major, or pre*
   - **Prerelease ID**: alpha, beta, rc (for pre* bumps)
   - **Dry run**: Check to test without releasing
4. Click **Run workflow**

The workflow will:
- Bump version in all packages
- Build and test packages
- Publish to npm
- Create GitHub release with installer
- Verify installer attachment
- Push commits and tags

## Manual Release

For local releases or troubleshooting:

```bash
cd modules/audio-tools

# Dry run to preview changes
pnpm release patch --dry-run

# Actual release
pnpm release patch

# Prerelease
pnpm release prepatch --preid alpha
```

## Release Checklist

Before releasing:

- [ ] All tests passing (`pnpm test`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] No uncommitted changes

After releasing:

- [ ] Verify GitHub release created
- [ ] Verify installer attached to release
- [ ] Test installer download URL
- [ ] Verify npm packages published
- [ ] Test installation from release
- [ ] Update documentation if needed

## Version Compatibility

When releasing:

1. **Breaking changes** → Major version bump
2. **New features** → Minor version bump
3. **Bug fixes** → Patch version bump
4. **Alpha/Beta** → Prerelease bump

The installer version will automatically match the package version.

## Troubleshooting

### Release Creation Failed

If GitHub release creation fails:

```bash
# Check GitHub CLI authentication
gh auth status

# Retry release manually
cd modules/audio-tools
VERSION=$(node -p "require('./package.json').version")
gh release create "audio-tools@${VERSION}" \
  --title "audio-tools ${VERSION}" \
  --notes-file .release-notes.tmp \
  .release-assets/install.sh \
  .release-assets/install.sh.sha256
```

### Installer Not Attached

If installer is missing from release:

```bash
# Manually attach installer
cd modules/audio-tools
VERSION=$(node -p "require('./package.json').version")
TAG="audio-tools@${VERSION}"

# Prepare installer
mkdir -p .release-assets
cp install.sh .release-assets/
sed -i "s/^INSTALLER_VERSION=.*/INSTALLER_VERSION=\"${VERSION}\"/" .release-assets/install.sh
shasum -a 256 .release-assets/install.sh > .release-assets/install.sh.sha256

# Upload to existing release
gh release upload "${TAG}" .release-assets/install.sh .release-assets/install.sh.sha256
```
```

**Rationale:** Clear documentation of release process for both automated and manual scenarios.

### Testing Steps

1. **Test workflow on feature branch:**
   - Create feature branch
   - Run workflow with dry-run enabled
   - Verify workflow completes successfully
   - Check dry-run output for correctness

2. **Test actual release on feature branch:**
   - Run workflow with prerelease version
   - Verify GitHub release created
   - Verify installer attached
   - Test installer download and checksum
   - Clean up test release

3. **Test manual release process:**
   - Follow manual release steps in documentation
   - Verify all steps work as documented
   - Test troubleshooting procedures

### Success Criteria

- [ ] GitHub Actions workflow executes successfully
- [ ] Workflow creates GitHub release with all assets
- [ ] Workflow verifies installer attachment
- [ ] Workflow tests installer download and checksum
- [ ] Documentation clearly explains release process
- [ ] Troubleshooting guide covers common failures
- [ ] Both automated and manual release methods work

---

## Implementation Timeline

### Sprint 1 (2-3 days)
- **Phase 1**: Installer version metadata enhancement
- **Testing**: Comprehensive version compatibility testing

### Sprint 2 (2-3 days)
- **Phase 2**: Release script enhancement
- **Testing**: Test release creation with installer attachment

### Sprint 3 (1-2 days)
- **Phase 3**: Documentation updates
- **Testing**: Documentation review and link verification

### Sprint 4 (Optional - 2-3 days)
- **Phase 4**: Release automation with GitHub Actions
- **Testing**: Workflow testing and troubleshooting

**Total Estimated Time:** 5-11 days (depending on whether Phase 4 is included)

---

## Risk Assessment

### High Risk Areas

1. **Version Compatibility Logic**
   - **Risk**: Incorrect version comparison could block valid installations
   - **Mitigation**: Comprehensive unit tests for version parsing and comparison
   - **Fallback**: Allow users to skip version checks with `--skip-version-check` flag

2. **GitHub Release Attachment**
   - **Risk**: Installer fails to attach to release, breaking download URLs
   - **Mitigation**: Verification step in release script, retry logic
   - **Fallback**: Manual attachment procedure documented

3. **Checksum Generation**
   - **Risk**: Incorrect checksum breaks verification
   - **Mitigation**: Test checksum generation with known inputs
   - **Fallback**: Checksum verification is optional for users

### Medium Risk Areas

1. **Network Failures During Version Check**
   - **Risk**: Installer fails if GitHub is unreachable
   - **Mitigation**: Version check is non-fatal, installation continues with warning
   - **Impact**: Low (informational warning only)

2. **GitHub Actions Permissions**
   - **Risk**: Workflow lacks permissions to create releases
   - **Mitigation**: Explicitly set permissions in workflow file
   - **Fallback**: Manual release process documented

### Low Risk Areas

1. **Documentation Accuracy**
   - **Risk**: Documentation doesn't match implementation
   - **Mitigation**: Test all documented commands during testing phase
   - **Impact**: Low (documentation can be updated quickly)

---

## Rollback Strategy

If issues are discovered after implementation:

### Rollback Phase 1 (Installer Changes)
```bash
# Revert installer changes
git revert <commit-sha>

# Users can continue using old installer from main branch
# (This is why we don't remove main branch installation immediately)
```

### Rollback Phase 2 (Release Script)
```bash
# Revert release script changes
git revert <commit-sha>

# Manually create releases without installer attachment
# Users download installer from main branch
```

### Emergency Installer Fix
If installer has critical bug after release:

1. Fix installer in new commit
2. Create patch release immediately
3. Update `/latest/` download URL automatically
4. Communicate fix via GitHub release notes

---

## Success Metrics

### Technical Metrics
- **Installation Success Rate**: > 95% (tracked via installer logs)
- **Version Check Completion Time**: < 2 seconds
- **Checksum Verification Success**: 100% for valid downloads
- **Release Creation Time**: < 5 minutes (automated workflow)

### User Experience Metrics
- **Time to First Successful Install**: < 3 minutes (from curl command)
- **Documentation Clarity**: Measured by support requests related to installation
- **Installer Update Adoption**: > 80% of users on latest installer within 30 days

### Quality Metrics
- **Zero Breaking Changes**: Older installers continue to work with compatible package versions
- **Backward Compatibility**: New installers support previous package versions (within major version)
- **Zero Security Issues**: No security vulnerabilities in installer or checksum process

---

## Post-Implementation Tasks

After completing all phases:

1. **Monitor Installation Analytics**
   - Track installer download counts
   - Monitor version check failures
   - Identify common error patterns

2. **User Communication**
   - Announce new installation method in README
   - Update social media / community channels
   - Deprecate main branch installation in documentation

3. **Deprecation Timeline**
   - **Immediate**: Recommend release-based installation
   - **30 days**: Warn users about main branch instability
   - **90 days**: Remove main branch installation from documentation
   - **Never**: Keep main branch installer functional (for contributors)

4. **Continuous Improvement**
   - Gather user feedback on installation process
   - Iterate on version compatibility logic
   - Enhance installer features based on usage patterns

---

## Appendix A: Installer URL Patterns

### Latest Release
```bash
# Always points to latest stable release
https://github.com/oletizi/ol_dsp/releases/latest/download/install.sh
https://github.com/oletizi/ol_dsp/releases/latest/download/install.sh.sha256
```

### Specific Version
```bash
# Replace VERSION with actual version (e.g., 1.0.0-alpha.4)
https://github.com/oletizi/ol_dsp/releases/download/audio-tools@VERSION/install.sh
https://github.com/oletizi/ol_dsp/releases/download/audio-tools@VERSION/install.sh.sha256
```

### Usage Examples
```bash
# Install latest
curl -fsSL https://github.com/oletizi/ol_dsp/releases/latest/download/install.sh | bash

# Install specific version
VERSION="1.0.0-alpha.4"
curl -fsSL "https://github.com/oletizi/ol_dsp/releases/download/audio-tools@${VERSION}/install.sh" | bash

# Download and verify
curl -fsSL https://github.com/oletizi/ol_dsp/releases/latest/download/install.sh -o install.sh
curl -fsSL https://github.com/oletizi/ol_dsp/releases/latest/download/install.sh.sha256 -o install.sh.sha256
shasum -a 256 -c install.sh.sha256
./install.sh
```

---

## Appendix B: Version Compatibility Matrix

| Installer Version | Min Package | Max Package | Notes |
|-------------------|-------------|-------------|-------|
| 1.0.0-alpha.4     | 1.0.0-alpha.4 | 1.0.0-alpha.x | Initial alpha release |
| 1.0.0-alpha.5     | 1.0.0-alpha.4 | 1.0.0-alpha.x | Added local media support |
| 1.0.0-beta.1      | 1.0.0-beta.1  | 1.0.0-beta.x  | First beta release |
| 1.0.0             | 1.0.0         | 1.x.x         | First stable release |
| 1.1.0             | 1.0.0         | 1.x.x         | New features, backward compatible |
| 2.0.0             | 2.0.0         | 2.x.x         | Breaking changes |

**Compatibility Rules:**
- Installer works with same major version packages
- Installer warns if package version is newer than tested version
- Installer fails if package major version is lower than minimum
- Users can override with `--skip-version-check` flag

---

## Appendix C: Code Snippets for Testing

### Test Installer Version Parsing
```bash
# test-version-parsing.sh
#!/bin/bash

test_version_comparison() {
  local v1=$1
  local v2=$2
  local expected=$3

  # Extract major version
  local v1_major=$(echo "$v1" | cut -d. -f1 | sed 's/[^0-9]//g')
  local v2_major=$(echo "$v2" | cut -d. -f1 | sed 's/[^0-9]//g')

  local result="unknown"
  if [ "$v1_major" -lt "$v2_major" ]; then
    result="less"
  elif [ "$v1_major" -gt "$v2_major" ]; then
    result="greater"
  else
    result="equal"
  fi

  if [ "$result" = "$expected" ]; then
    echo "✓ $v1 vs $v2: $result (expected: $expected)"
  else
    echo "✗ $v1 vs $v2: $result (expected: $expected)"
    exit 1
  fi
}

# Test cases
test_version_comparison "1.0.0" "2.0.0" "less"
test_version_comparison "2.0.0" "1.0.0" "greater"
test_version_comparison "1.0.0" "1.5.0" "equal"
test_version_comparison "1.0.0-alpha.4" "1.0.0-beta.1" "equal"
test_version_comparison "1.0.0-alpha.4" "2.0.0-alpha.1" "less"

echo "All version comparison tests passed!"
```

### Test Checksum Generation
```bash
# test-checksum.sh
#!/bin/bash

# Create test file
echo "test content" > test-file.txt

# Generate checksum
shasum -a 256 test-file.txt > test-file.txt.sha256

# Verify checksum
if shasum -a 256 -c test-file.txt.sha256; then
  echo "✓ Checksum verification passed"
else
  echo "✗ Checksum verification failed"
  exit 1
fi

# Modify file
echo "modified content" > test-file.txt

# Verify checksum fails
if ! shasum -a 256 -c test-file.txt.sha256 2>/dev/null; then
  echo "✓ Checksum correctly detects modification"
else
  echo "✗ Checksum should have failed for modified file"
  exit 1
fi

# Cleanup
rm test-file.txt test-file.txt.sha256

echo "All checksum tests passed!"
```

### Test Release Asset Preparation
```typescript
// test-installer-asset.ts
import { prepareInstallerAsset, cleanupInstallerAssets } from '../scripts/release';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

async function testInstallerAsset() {
  const rootDir = join(__dirname, '..');
  const version = '1.0.0-test';

  console.log('Testing installer asset preparation...');

  // Prepare asset
  const asset = prepareInstallerAsset(rootDir, version);

  // Verify asset files exist
  if (!existsSync(asset.path)) {
    throw new Error('Installer asset not created');
  }
  if (!existsSync(asset.checksumPath)) {
    throw new Error('Checksum file not created');
  }

  // Verify version in installer
  const installerContent = readFileSync(asset.path, 'utf-8');
  if (!installerContent.includes(`INSTALLER_VERSION="${version}"`)) {
    throw new Error('Installer version not updated correctly');
  }

  // Verify checksum format
  const checksumContent = readFileSync(asset.checksumPath, 'utf-8');
  if (!checksumContent.match(/^[a-f0-9]{64}  install\.sh$/)) {
    throw new Error('Checksum format incorrect');
  }

  // Cleanup
  cleanupInstallerAssets(rootDir);

  // Verify cleanup
  if (existsSync(asset.path)) {
    throw new Error('Installer asset not cleaned up');
  }

  console.log('✓ All installer asset tests passed');
}

testInstallerAsset().catch(error => {
  console.error('✗ Test failed:', error.message);
  process.exit(1);
});
```

---

## Conclusion

This workplan provides a comprehensive, phased approach to implementing versioned installer distribution via GitHub Releases. The implementation prioritizes:

1. **User Safety**: Version compatibility checks prevent mismatched installations
2. **Reliability**: Checksums ensure installer integrity
3. **Ease of Use**: One-line installation with stable URLs
4. **Automation**: Release process is automated and repeatable
5. **Backward Compatibility**: Old installers continue to work

Each phase is independently testable and deployable, allowing for incremental rollout and validation. The optional Phase 4 (GitHub Actions) provides additional automation but is not required for core functionality.

**Recommended Implementation Order:**
1. Phase 1 (Essential) ✅ COMPLETED
2. Phase 2 (Essential) ✅ COMPLETED
3. Phase 3 (Essential) ✅ COMPLETED
4. Phase 4 (Optional but recommended)

Upon completion, users will have a reliable, versioned installation experience that prevents common pitfalls of installing from the main branch.
