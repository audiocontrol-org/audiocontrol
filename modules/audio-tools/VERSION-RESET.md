# Version Reset Plan

## Problem
Current versions are inflated (v7.0.0) due to aggressive major version bumping during pre-release refactoring. This gives a misleading impression of project maturity.

## Solution: Reset Before First npm Publish

Since packages are **NOT yet published to npm**, we can safely reset versions.

## Proposed Version Reset

### Core Packages (Currently v7.0.0)
Reset to **v1.0.0** to indicate "stable, ready for distribution":

- `sampler-devices`: 7.0.0 → **1.0.0**
- `sampler-lib`: 7.0.0 → **1.0.0**
- `sampler-midi`: 7.0.0 → **1.0.0**
- `sampler-translate`: 7.0.0 → **1.0.0**

**Rationale**: v1.0.0 signals "stable public API" without the inflated history

### Utility Packages (Currently v1.0.0)
Keep as-is:

- `sampler-export`: **1.0.0** ✓
- `sampler-backup`: **1.0.0** ✓

### Other Packages
- `sampler-interface`: 3.0.0 → **1.0.0** (for consistency)
- `sampler-attic`: 0.0.1 → **0.0.1** (private, not published)

### Alternative: v0.1.0 ("Still Stabilizing")

If you want to signal "API may still change":

- Core packages: 7.0.0 → **0.1.0**
- Allows breaking changes as minor versions (0.2.0, 0.3.0)
- Use v1.0.0 when API is truly stable

## Implementation Steps

### 1. Update package.json Files

```bash
# Update core packages to v1.0.0
cd modules/audio-tools
for pkg in sampler-devices sampler-lib sampler-midi sampler-translate sampler-interface; do
  jq '.version = "1.0.0"' "$pkg/package.json" > "$pkg/package.json.tmp"
  mv "$pkg/package.json.tmp" "$pkg/package.json"
done
```

### 2. Update CHANGELOG.md Files

For each package, update the version header:

```markdown
## [7.0.0] - 2025-10-04
```

Becomes:

```markdown
## [1.0.0] - 2025-10-04
```

And update the footer link:

```markdown
[7.0.0]: https://github.com/oletizi/audio-tools/releases/tag/sampler-devices-v7.0.0
```

Becomes:

```markdown
[1.0.0]: https://github.com/oletizi/audio-tools/releases/tag/sampler-devices-v1.0.0
```

### 3. Update Workspace Dependencies

Some packages depend on each other. Update `package.json` dependencies:

```json
"dependencies": {
  "@oletizi/sampler-lib": "workspace:^7.0.0"
}
```

Becomes:

```json
"dependencies": {
  "@oletizi/sampler-lib": "workspace:^1.0.0"
}
```

### 4. Update pnpm-lock.yaml

```bash
pnpm install
```

### 5. Commit the Reset

```bash
git add .
git commit -m "chore(audio-tools): reset versions to 1.0.0 before initial npm publish

BREAKING CHANGE: Version reset from inflated v7.0.0 to v1.0.0 for initial public release.

The v7.0.0 versions were artifacts of aggressive major version bumping during
pre-release refactoring. Since packages were never published to npm, we're
resetting to v1.0.0 to accurately reflect this as the first stable release.

See VERSIONS.md for historical context."
```

### 6. Create git tag

```bash
git tag -a audio-tools-v1.0.0 -m "audio-tools v1.0.0 - Initial public release"
```

### 7. Update VERSIONS.md

Add a section documenting the reset:

```markdown
## Version Reset (October 2025)

Before initial npm publish, versions were reset from v7.0.0 to v1.0.0.

**Why?** The v7.0.0 version was an artifact of aggressive major version bumping
during pre-release refactoring (7 breaking changes in 1 hour). Since packages
were never published to npm, we reset to v1.0.0 to accurately signal "first
stable public release" rather than "seven major releases."

**Safe?** Yes - no packages were published to npm, so no users were affected.
```

## Going Forward: Conservative Versioning

### New Guidelines

**Major versions (2.0.0, 3.0.0)**: Only for significant, intentional breaking changes
- Not for internal refactoring
- Not for dependency updates
- Only when you *intend* to break the public API for users

**Minor versions (1.1.0, 1.2.0)**: New features, backward compatible
- New exportable functions
- New optional parameters
- Enhanced functionality

**Patch versions (1.0.1, 1.0.2)**: Bug fixes and docs
- Bug fixes
- Documentation updates
- Internal refactoring (if no API changes)

### Pre-release Versions for Breaking Changes

If you need to experiment with breaking changes:

```
v1.0.0 → v2.0.0-alpha.1 → v2.0.0-alpha.2 → v2.0.0-beta.1 → v2.0.0
```

This allows iteration without inflating major versions.

## Verification Checklist

Before implementing:

- [ ] Confirm no packages published to npm (run `npm view @oletizi/sampler-devices`)
- [ ] Backup current state (`git tag audio-tools-v7.0.0-backup`)
- [ ] Update all package.json files
- [ ] Update all CHANGELOG.md files
- [ ] Update workspace dependencies
- [ ] Run `pnpm install` to update lockfile
- [ ] Run `pnpm test` to ensure everything still works
- [ ] Commit changes
- [ ] Create new git tag
- [ ] Update VERSIONS.md

## Timeline

- **Before reset**: v7.0.0 (inflated, never published)
- **After reset**: v1.0.0 (accurate "first stable release")
- **First npm publish**: v1.0.0
- **Future releases**: Conservative semver (1.0.x, 1.x.0, only necessary breaking changes)

---

**Decision**: Choose v1.0.0 or v0.1.0 based on API confidence:
- **v1.0.0** if you're confident the API is stable
- **v0.1.0** if you expect more breaking changes soon
