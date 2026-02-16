# Release Process

This document describes the happy path for releasing packages in the audio-control monorepo.

## Quick Reference

**One-click ship (truly one command):**
```bash
pnpm release:ship
```

This does EVERYTHING automatically:
- Auto-creates changeset if none exist (patch bump for all packages)
- Bumps versions
- Builds all packages
- Commits and pushes changes
- Publishes to npm

**No manual changeset creation required!**

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

### 2. Ship It! 🚀

```bash
pnpm release:ship
```

**What this does (in order):**
1. **Validates workspace version sync**: `pnpm version:check`
2. **Auto-creates changeset** if none exist (all packages, patch bump)
3. **Bumps versions** from changesets: `pnpm changeset:version`
   - Reads `.changeset/*.md` files
   - Updates all `package.json` versions
   - Updates `CHANGELOG.md` files
   - Deletes processed changeset files
4. **Builds** all packages: `pnpm -r build`
5. **Stages** changes: `git add .`
6. **Commits** with message: `chore(release): publish packages`
7. **Pushes** to remote: `git push`
8. **Publishes** to npm: `pnpm changeset:publish`

**You will be prompted for:**
- 2FA/OTP code from your authenticator app

**Expected output:**
```
🦋  info Publishing "@audiocontrol/package-name" at "0.1.1-alpha.0"
🦋  success packages published successfully:
🦋  @audiocontrol/package-name@0.1.1-alpha.0
```

### 4. Verify Publication

```bash
npm view @audiocontrol/launch-control-xl3 dist-tags
npm view @audiocontrol/canonical-midi-maps dist-tags
npm view @audiocontrol/ardour-midi-maps dist-tags
npm view @audiocontrol/live-max-cc-router dist-tags
```

**Expected output:**
```
{ latest: '0.1.0', alpha: '0.1.1-alpha.0' }
```

## Complete Workflow Example

```bash
# One-time setup: Enter alpha mode
pnpm release:pre:alpha

# That's it! Just run:
pnpm release:ship
# Enter your 2FA/OTP when prompted

# Verify it worked
npm view @audiocontrol/launch-control-xl3 dist-tags
```

**Optional: Create custom changeset before shipping**

If you want a custom changeset message instead of "Automated release":

```bash
pnpm changeset
# Select packages and bump type, write description

# Then ship
pnpm release:ship
```

## Version Consistency

All workspace packages share one common version, starting from `0.1.0`.

This is enforced by:
- `.changeset/config.json` `fixed` group containing all workspace packages
- `pnpm version:check` guard script, which fails when a module version diverges from root

**To verify sync manually:**
```bash
pnpm version:check
```

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

# Ship it! (version bump + build + commit + push + publish)
pnpm release:ship
```

## Troubleshooting

### "This operation requires a one-time password"
**Solution:** Enter your 6-digit 2FA code from your authenticator app.

### "Package not found" after publishing
**Solution:** Wait 1-2 minutes for npm CDN propagation, then check again.

### Versions out of sync
**Solution:** Set root and module versions to the same value, then run `pnpm version:check` until it passes.

### Wrong dist-tag
**Issue:** Package published to `latest` instead of `alpha`
**Cause:** Package has never had a stable release
**Solution:** This is expected behavior. The package will use `alpha` dist-tag once a stable version exists.

## Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm version:check` | Verify all workspace package versions match the root version |
| `pnpm release:ship` | **One-click:** Version bump + build + commit + push + publish |
| `pnpm release:publish` | Version + build + publish (no git operations) |
| `pnpm changeset` | Create a new changeset interactively |
| `pnpm changeset:version` | Bump versions based on changesets (called by release:ship) |
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
7. **Run version guard first** - `pnpm version:check`

## Emergency Rollback

If you published a bad version:

```bash
# Deprecate the bad version
npm deprecate @audiocontrol/package-name@0.1.1-alpha.0 "Broken release, use 0.1.1-alpha.1"

# Tag a previous version as alpha
npm dist-tag add @audiocontrol/package-name@0.1.0 alpha
```

Then fix the issue and publish a new version.
