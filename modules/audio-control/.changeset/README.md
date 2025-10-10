# Release Workflow with Changesets

## 🚀 Quick Start (One-Click Workflows)

### Alpha Release
```bash
pnpm release:alpha          # 1. Enter alpha mode with instructions
pnpm changeset              # 2. Create changeset(s) - repeat as needed
pnpm release:publish        # 3. Version + build + publish
pnpm release:pre:exit       # 4. Exit alpha when done
```

### Beta Release
```bash
pnpm release:beta           # 1. Enter beta mode with instructions
pnpm changeset              # 2. Create changeset(s) - repeat as needed
pnpm release:publish        # 3. Version + build + publish
pnpm release:pre:exit       # 4. Exit beta when done
```

### Stable Release
```bash
pnpm changeset              # 1. Create changeset(s) - repeat as needed
pnpm release:stable         # 2. Version + build + publish (one command!)
```

---

## 📋 Detailed Workflows

### Standard Release (1.20.0 → 1.21.0)

1. Make your changes to one or more packages
2. Create changeset: `pnpm changeset`
   - Select which packages changed
   - Choose bump type (patch/minor/major)
   - Describe the changes
3. Commit changeset file: `git add .changeset/*.md && git commit -m "chore: add changeset"`
4. Publish: `pnpm release:stable`
   - Automatically runs: version bump → build → publish
5. Commit version changes: `git add . && git commit -m "chore: release packages"`
6. Push: `git push && git push --tags`

### Alpha/Beta Release (1.20.0 → 1.21.0-alpha.0)

1. Enter prerelease mode: `pnpm release:alpha` (or `pnpm release:beta`)
2. Make your changes
3. Create changeset: `pnpm changeset`
   - Select packages and describe changes
4. Commit changeset: `git add .changeset/*.md && git commit -m "chore: add changeset"`
5. Publish: `pnpm release:publish`
   - Automatically runs: version bump → build → publish
   - Will create: 1.21.0-alpha.0
6. Commit version changes: `git add . && git commit -m "chore: release alpha.0"`
7. Repeat steps 2-6 for more alpha releases (alpha.1, alpha.2, etc.)
8. Exit prerelease: `pnpm release:pre:exit`
9. Final stable release: `pnpm changeset` → `pnpm release:stable`

---

## 🎯 Command Reference

### Core Commands
- `pnpm changeset` - Create a changeset (describes what changed)
- `pnpm release:publish` - **One-click**: Version → Build → Publish

### Alpha/Beta Workflows
- `pnpm release:alpha` - Enter alpha mode with instructions
- `pnpm release:beta` - Enter beta mode with instructions
- `pnpm release:pre:exit` - Exit prerelease mode

### Stable Workflow
- `pnpm release:stable` - **One-click**: Version → Build → Publish (stable)

### Manual Control (Advanced)
- `pnpm changeset:version` - Bump versions only (no build/publish)
- `pnpm changeset:publish` - Publish only (no version/build)
- `pnpm release:pre:alpha` - Enter alpha (no instructions)
- `pnpm release:pre:beta` - Enter beta (no instructions)

---

## 💡 Tips

- **Always create changesets before publishing** - They describe what changed
- **Use `pnpm release:publish`** - It's the one-click publish command
- **Multiple changesets OK** - Create separate changesets for different changes
- **Independent versioning** - Each package can have different version bumps
- **Prerelease mode persists** - Stay in alpha mode for multiple releases
