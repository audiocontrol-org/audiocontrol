# Changesets Implementation Plan

**Date**: 2025-10-09
**Project**: audio-control monorepo & launch-control-xl3 module
**Goal**: Replace manual versioning with Changesets for alpha/beta release automation

---

## Executive Summary

Migrate from manual version bumping to **Changesets** - the industry-standard release management tool for pnpm workspace monorepos. This enables `pnpm release prerelease` capability with proper dist-tags for alpha/beta releases.

---

## Background

### Current State

**audio-tools** (reference implementation)
- Custom release scripts: `release.ts`, `bump-version.ts`, `publish-modules.ts` (~200 LOC)
- Supports: major/minor/patch, premajor/preminor/prepatch/prerelease
- Handles: dist-tags, GitHub releases, installer assets
- Command: `pnpm release prerelease --preid alpha`

**audio-control** (monorepo workspace)
- pnpm workspace with 4 modules:
  - `@oletizi/launch-control-xl3` (v1.20.0)
  - `@oletizi/canonical-midi-maps`
  - `@oletizi/ardour-midi-maps`
  - `@oletizi/live-max-cc-router`
- No release automation
- Manual versioning per module (edit package.json → build → publish)
- No prerelease workflow
- No changelog generation

### Why Changesets?

**Pros:**
- ✅ Built for pnpm workspaces (first-class support)
- ✅ Industry standard (used by pnpm, Remix, Radix UI, Turborepo)
- ✅ Prerelease workflow with proper dist-tags
- ✅ Independent package versioning
- ✅ Automatic changelog generation
- ✅ Actively maintained with large community
- ✅ Low maintenance burden

**Cons:**
- Learning curve for changeset workflow
- Different mental model than semantic versioning commits

**Why NOT semantic-release?**
- ❌ No native monorepo support
- ❌ Community monorepo plugin is unmaintained (last commit 2022)
- ❌ Complex setup for multi-package repos
- ❌ Tightly couples versioning to commit messages

**Why NOT custom scripts?**
- ❌ Maintenance burden (you own all bugs)
- ❌ Not reusable across projects
- ❌ Limited community support
- ❌ Must implement all features manually

---

## Implementation Strategy

### Phase 1: Monorepo Setup (audio-control)

**Target**: Install Changesets at workspace root
**Timeline**: 2-3 hours
**Success criteria**:
- Can publish launch-control-xl3 1.21.0-alpha.0 with alpha dist-tag
- Can publish multiple packages with independent versions
- Prerelease workflow functions correctly

### Phase 2: Evaluate audio-tools Migration

**Decision point**: After Phase 1 success
**Options**:
- A) Full migration to Changesets (simpler)
- B) Keep custom GitHub release logic (preserves installer workflow)

### Phase 3: Shared Configuration (Optional)

**Target**: Create `@oletizi/release-config` package
**Timeline**: 1 hour
**Benefit**: Reusable across all TypeScript projects

---

## Phase 1: Monorepo Setup (audio-control)

### Step 1.1: Install at Workspace Root

```bash
cd /Users/orion/work/ol_dsp/modules/audio-control
pnpm add -Dw @changesets/cli
pnpm changeset init
```

### Step 1.2: Configure for Monorepo

Edit `.changeset/config.json`:

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": [],
  "___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH": {
    "onlyUpdatePeerDependentsWhenOutOfRange": true
  }
}
```

### Step 1.3: Add Root Scripts

Add to root `package.json`:

```json
{
  "scripts": {
    "changeset": "changeset",
    "version": "changeset version",
    "publish": "pnpm build && changeset publish",
    "release:pre:alpha": "changeset pre enter alpha",
    "release:pre:beta": "changeset pre enter beta",
    "release:pre:exit": "changeset pre exit"
  }
}
```

### Step 1.4: Document Workflow

Create `.changeset/README.md`:

```markdown
# Release Workflow with Changesets

## Standard Release (1.20.0 → 1.21.0)

1. Make your changes
2. Create changeset: `pnpm changeset`
3. Select packages and bump type (patch/minor/major)
4. Describe changes
5. Commit changeset file
6. Bump version: `pnpm version`
7. Commit version bump
8. Publish: `pnpm publish`

## Alpha/Beta Release (1.20.0 → 1.21.0-alpha.0)

1. Enter prerelease mode: `pnpm release:pre:alpha`
2. Create changeset: `pnpm changeset`
3. Select packages and describe changes
4. Bump version: `pnpm version`
5. Commit changes
6. Publish: `pnpm publish`
7. (Repeat 2-6 for more alpha releases)
8. Exit prerelease: `pnpm release:pre:exit`

## Quick Commands

```bash
# Enter alpha prerelease mode
pnpm release:pre:alpha

# Enter beta prerelease mode
pnpm release:pre:beta

# Exit prerelease mode
pnpm release:pre:exit
```
```

### Step 1.5: Test Single Package Alpha Release

```bash
cd /Users/orion/work/ol_dsp/modules/audio-control

# Enter alpha mode
pnpm release:pre:alpha

# Create changeset for launch-control-xl3
pnpm changeset
# ✓ Which packages would you like to include?
#   ✓ @oletizi/launch-control-xl3
# Select "patch", describe "Test alpha release"

# Bump version
pnpm version  # Bumps launch-control-xl3 to 1.21.0-alpha.0

# Build all packages
pnpm -r build

# Publish
pnpm publish
```

**Verification**:
```bash
npm view @oletizi/launch-control-xl3 dist-tags
# Should show: alpha: 1.21.0-alpha.0
```

### Step 1.6: Test Multi-Package Release

```bash
# Still in alpha mode, create multiple changesets

# Fix bug in launch-control-xl3
pnpm changeset
# Select: @oletizi/launch-control-xl3, bump: patch

# Add feature to canonical-midi-maps
pnpm changeset
# Select: @oletizi/canonical-midi-maps, bump: minor

# Bump versions
pnpm version
# Updates: launch-control-xl3 (1.21.0-alpha.1), canonical-midi-maps (minor)

# Build and publish both
pnpm -r build
pnpm publish
```

**Verification**:
```bash
npm view @oletizi/launch-control-xl3 dist-tags
npm view @oletizi/canonical-midi-maps dist-tags
# Both should show alpha tags
```

### Step 1.7: Exit Prerelease & Stable Release

```bash
# Exit alpha mode
pnpm release:pre:exit

# Create stable release changeset
pnpm changeset
# Select packages for stable release

# Bump to stable versions
pnpm version  # Removes -alpha suffix

# Build and publish
pnpm -r build
pnpm publish  # Publishes with dist-tag: latest
```

---

## Phase 2: audio-tools Migration (Decision Point)

### Option A: Full Changesets Migration

**Pros:**
- Simpler maintenance
- Standard workflow
- Community support

**Cons:**
- Lose custom GitHub release formatting
- Lose installer asset attachment

**Implementation:**
1. Replace `scripts/release.ts` with Changesets
2. Migrate `scripts/bump-version.ts` → `changeset version`
3. Migrate `scripts/publish-modules.ts` → `changeset publish`
4. Keep `scripts/update-docs-version.ts` as separate step

### Option B: Hybrid Approach

**Pros:**
- Keep installer asset workflow
- Custom GitHub release notes

**Cons:**
- More complex
- Two systems to maintain

**Implementation:**
1. Use Changesets for version/publish
2. Keep custom GitHub release script
3. Call Changesets from `scripts/release.ts`

**Recommended**: Option A, implement installer assets differently

---

## Phase 3: Shared Configuration Package

### Structure

```
audio-control/
├── modules/
│   ├── release-config/
│   │   ├── changeset-config.json
│   │   ├── github-release.ts
│   │   ├── README.md
│   │   └── package.json
│   ├── launch-control-xl3/
│   ├── canonical-midi-maps/
│   └── ...
```

### Package Contents

**`package.json`:**
```json
{
  "name": "@oletizi/release-config",
  "version": "1.0.0",
  "files": [
    "changeset-config.json",
    "github-release.ts"
  ]
}
```

**`changeset-config.json`:**
```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "access": "public",
  "baseBranch": "main"
}
```

### Usage in Other Projects

```bash
# Install in any TypeScript project
pnpm add -D @oletizi/release-config @changesets/cli

# Copy config
cp node_modules/@oletizi/release-config/changeset-config.json .changeset/config.json

# Use workflow
pnpm changeset
pnpm version
pnpm publish
```

---

## Comparison: Before & After

### Before (Manual)

```bash
# Edit package.json manually: 1.20.0 → 1.21.0-alpha.0
pnpm build
npm publish --tag alpha
# Manually update CHANGELOG.md
git add .
git commit -m "chore: release 1.21.0-alpha.0"
git tag v1.21.0-alpha.0
git push --tags
```

**Problems:**
- Easy to forget steps
- Manual changelog updates
- No validation
- Dist-tag errors common

### After (Changesets)

```bash
pnpm changeset pre enter alpha
pnpm changeset
pnpm version
pnpm build
pnpm changeset:publish
git add .
git commit -m "chore: release alpha"
git push
```

**Benefits:**
- Guided workflow
- Auto-generated changelog
- Validation built-in
- Correct dist-tags guaranteed

---

## Workflows

### Workflow 1: Alpha Release Series

```bash
# Start alpha series (1.20.0 → 1.21.0-alpha.0)
pnpm changeset pre enter alpha
pnpm changeset               # Describe changes
pnpm version                 # Bump to 1.21.0-alpha.0
git commit -am "chore: alpha.0"
pnpm build && pnpm changeset:publish

# Continue with alpha.1
pnpm changeset               # More changes
pnpm version                 # Bump to 1.21.0-alpha.1
git commit -am "chore: alpha.1"
pnpm build && pnpm changeset:publish

# Continue with alpha.2
pnpm changeset               # More changes
pnpm version                 # Bump to 1.21.0-alpha.2
git commit -am "chore: alpha.2"
pnpm build && pnpm changeset:publish

# Exit to stable (1.21.0)
pnpm changeset pre exit
pnpm version                 # Bump to 1.21.0
git commit -am "chore: release 1.21.0"
pnpm build && pnpm changeset:publish
```

### Workflow 2: Beta After Alpha

```bash
# Current: 1.21.0-alpha.5

# Exit alpha
pnpm changeset pre exit

# Enter beta
pnpm changeset pre enter beta
pnpm version                 # Bump to 1.21.0-beta.0
git commit -am "chore: enter beta"
pnpm build && pnpm changeset:publish

# Continue beta series
pnpm changeset
pnpm version                 # Bump to 1.21.0-beta.1
git commit -am "chore: beta.1"
pnpm build && pnpm changeset:publish
```

### Workflow 3: Stable Release

```bash
# Current: 1.20.0

pnpm changeset               # Describe changes, select "minor"
pnpm version                 # Bump to 1.21.0
git commit -am "chore: release 1.21.0"
pnpm build && pnpm changeset:publish
git push
```

---

## Rollback & Recovery

### Unpublish Alpha (if needed)

```bash
# Unpublish specific version (within 72 hours)
npm unpublish @oletizi/launch-control-xl3@1.21.0-alpha.0

# Deprecate instead (safer)
npm deprecate @oletizi/launch-control-xl3@1.21.0-alpha.0 "Use 1.21.0-alpha.1 instead"
```

### Reset Prerelease Mode

```bash
# If stuck in prerelease mode
rm .changeset/pre.json
git add .changeset/pre.json
git commit -m "chore: exit prerelease mode"
```

### Fix Version After Publish

```bash
# If published wrong version, can't change
# Must publish new version
pnpm changeset
pnpm version  # Bump again
pnpm build && pnpm changeset:publish
```

---

## Testing Checklist

### Phase 1: Monorepo Setup

- [ ] Install at workspace root
- [ ] Configure for monorepo
- [ ] Create changeset (single package)
- [ ] Create changeset (multiple packages)
- [ ] Bump versions independently
- [ ] Publish multiple packages
- [ ] Verify all published correctly
- [ ] Enter alpha mode
- [ ] Publish alpha.0 for single package (launch-control-xl3)
- [ ] Verify alpha dist-tag
- [ ] Publish alpha.1 with multiple packages
- [ ] Exit alpha mode
- [ ] Publish stable releases

### Phase 2: Migration

- [ ] Compare audio-tools workflow
- [ ] Decide on Option A or B
- [ ] Implement chosen option
- [ ] Test full release cycle
- [ ] Update documentation

---

## Documentation Updates

### Files to Update

1. **README.md** - Add "Releasing" section
2. **CONTRIBUTING.md** - Document changeset workflow
3. **CHANGELOG.md** - Note migration to automated changelog
4. **.changeset/README.md** - Detailed workflow guide

### README.md Addition

```markdown
## Releasing

This project uses [Changesets](https://github.com/changesets/changesets) for version management.

### Stable Release

\`\`\`bash
pnpm changeset       # Describe changes
pnpm version         # Bump version
pnpm build && pnpm changeset:publish
\`\`\`

### Alpha/Beta Release

\`\`\`bash
pnpm changeset pre enter alpha
pnpm changeset
pnpm version
pnpm build && pnpm changeset:publish
pnpm changeset pre exit  # When done
\`\`\`

See `.changeset/README.md` for detailed workflow.
```

---

## Success Metrics

### Must Have
- ✅ Can publish alpha releases with correct dist-tag
- ✅ Can publish beta releases with correct dist-tag
- ✅ Can publish stable releases with `latest` tag
- ✅ Changelogs auto-generated
- ✅ Package versions bump correctly

### Nice to Have
- ✅ Multiple packages can version independently
- ✅ Workflow documented for future maintainers
- ✅ Shared config reusable across projects
- ✅ GitHub releases automated

---

## Resources

### Official Documentation
- Changesets: https://github.com/changesets/changesets
- Prerelease guide: https://changesets-docs.vercel.app/en/prereleases
- pnpm + Changesets: https://pnpm.io/using-changesets

### Examples in the Wild
- pnpm itself: https://github.com/pnpm/pnpm
- Remix: https://github.com/remix-run/remix
- Radix UI: https://github.com/radix-ui/primitives
- Turborepo: https://github.com/vercel/turbo

### Reference Implementations
- audio-tools custom scripts: `/Users/orion/work/ol_dsp/modules/audio-tools/scripts/`
- This workplan: `/Users/orion/work/xl3-web/docs/1.0/changesets/implementation/workplan.md`

---

## Timeline Estimate

| Phase | Duration | Dependency |
|-------|----------|------------|
| Phase 1: audio-control monorepo | 2-3 hours | None |
| Phase 2: audio-tools decision | 1 hour | Phase 1 success |
| Phase 3: Shared config | 1 hour | Optional |
| **Total** | **4-5 hours** | |

---

## Next Steps

1. **Review this plan** with team/maintainer
2. **Start Phase 1** on a feature branch (from audio-control monorepo root)
3. **Test alpha release** for launch-control-xl3
4. **Test multi-package release** with other modules
5. **Evaluate** if Changesets meets requirements
6. **Proceed to Phase 2** (audio-tools) if successful
7. **Document learnings** for future reference

---

**Status**: Draft
**Last Updated**: 2025-10-09
**Owner**: Development Team
**Approval Required**: Yes
