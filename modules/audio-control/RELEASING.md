# Release Process

This document describes the happy path for releasing packages in the audio-control monorepo.

## Quick Reference

**One-click ship (after changesets created):**
```bash
pnpm release:ship
```

This builds, commits, pushes, and publishes all in one step.

## Alpha Release Process (Happy Path)

### 1. Enter Alpha Mode (First Time Only)

```bash
pnpm release:pre:alpha
```

This puts changesets into prerelease mode. You only need to do this once when starting alpha releases.

**Output:**
```
🦋  Entered pre mode!
```

### 2. Create a Changeset

```bash
pnpm changeset
```

**Or manually create:** `.changeset/descriptive-name.md`

```markdown
---
"@oletizi/launch-control-xl3": patch
"@oletizi/canonical-midi-maps": patch
"@oletizi/ardour-midi-maps": patch
"@oletizi/live-max-cc-router": patch
---

Description of what changed
```

**Bump types:**
- `patch`: Bug fixes, minor changes (1.20.0 → 1.20.1)
- `minor`: New features (1.20.0 → 1.21.0)
- `major`: Breaking changes (1.20.0 → 2.0.0)

### 3. Version Bump

```bash
pnpm changeset:version
```

This reads your changesets and updates package.json versions accordingly.

**What happens:**
- Reads `.changeset/*.md` files
- Updates `package.json` version fields
- Updates `CHANGELOG.md` files
- Deletes processed changeset files
- Adds `-alpha.X` suffix (when in prerelease mode)

### 4. Ship It! 🚀

```bash
pnpm release:ship
```

**What this does (in order):**
1. **Builds** all packages: `pnpm -r build`
2. **Stages** changes: `git add .`
3. **Commits** with message: `chore(release): publish packages`
4. **Pushes** to remote: `git push`
5. **Publishes** to npm: `pnpm changeset:publish`

**You will be prompted for:**
- 2FA/OTP code from your authenticator app

**Expected output:**
```
🦋  info Publishing "@oletizi/package-name" at "1.20.1-alpha.1"
🦋  success packages published successfully:
🦋  @oletizi/package-name@1.20.1-alpha.1
```

### 5. Verify Publication

```bash
npm view @oletizi/launch-control-xl3 dist-tags
npm view @oletizi/canonical-midi-maps dist-tags
npm view @oletizi/ardour-midi-maps dist-tags
npm view @oletizi/live-max-cc-router dist-tags
```

**Expected output:**
```
{ latest: '1.20.0', alpha: '1.20.1-alpha.1' }
```

## Complete Workflow Example

```bash
# One-time setup: Enter alpha mode
pnpm release:pre:alpha

# Create a changeset describing your changes
pnpm changeset
# Select packages and bump type, write description

# Bump versions based on changesets
pnpm changeset:version

# Ship it! (build + commit + push + publish)
pnpm release:ship
# Enter your 2FA/OTP when prompted

# Verify it worked
npm view @oletizi/launch-control-xl3 dist-tags
```

## Version Consistency

All packages should share the same version number for simplicity.

**To sync versions:**
1. Create changeset with all packages listed
2. Use same bump type for all (usually `patch`)
3. Run `pnpm changeset:version`
4. All packages will have matching versions

## Exiting Alpha Mode

When ready to publish stable releases:

```bash
pnpm release:pre:exit
```

**What this does:**
- Exits prerelease mode
- Next `changeset version` will create stable versions (no `-alpha.X` suffix)
- Publishes to `latest` dist-tag instead of `alpha`

## Stable Release Process

```bash
# Ensure you've exited prerelease mode
pnpm release:pre:exit

# Create changeset
pnpm changeset

# Version bump (creates stable versions)
pnpm changeset:version

# Ship it!
pnpm release:ship
```

## Troubleshooting

### "This operation requires a one-time password"
**Solution:** Enter your 6-digit 2FA code from your authenticator app.

### "Package not found" after publishing
**Solution:** Wait 1-2 minutes for npm CDN propagation, then check again.

### Versions out of sync
**Solution:** Create a changeset that includes all packages with the same bump type.

### Wrong dist-tag
**Issue:** Package published to `latest` instead of `alpha`
**Cause:** Package has never had a stable release
**Solution:** This is expected behavior. The package will use `alpha` dist-tag once a stable version exists.

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm release:ship` | **One-click:** Build + commit + push + publish |
| `pnpm release:publish` | Version + build + publish (no git operations) |
| `pnpm changeset` | Create a new changeset interactively |
| `pnpm changeset:version` | Bump versions based on changesets |
| `pnpm changeset:publish` | Publish to npm (only) |
| `pnpm release:pre:alpha` | Enter alpha prerelease mode |
| `pnpm release:pre:beta` | Enter beta prerelease mode |
| `pnpm release:pre:exit` | Exit prerelease mode |

## Best Practices

1. **Always create changesets** - Don't manually edit package.json versions
2. **Keep versions in sync** - Include all packages in each changeset
3. **Use descriptive changeset names** - `proper-alpha-release.md`, not `changeset-1.md`
4. **Verify before shipping** - Run `pnpm test` and `pnpm typecheck` first
5. **Check dist-tags** - Verify packages published to correct tag
6. **Git hygiene** - Ensure branch is clean before shipping

## Emergency Rollback

If you published a bad version:

```bash
# Deprecate the bad version
npm deprecate @oletizi/package-name@1.20.1-alpha.1 "Broken release, use 1.20.1-alpha.2"

# Tag a previous version as alpha
npm dist-tag add @oletizi/package-name@1.20.1-alpha.0 alpha
```

Then fix the issue and publish a new version.
