# Branching, Deployment, and Versioning Strategy

**Purpose:** Define the branching model, deployment workflow, and versioning scheme for the audiocontrol monorepo.

---

## Branching Model

The repo uses a simplified GitHub Flow: feature branches merge to `main` via pull request, and `main` is always the stable, deployable branch. There is no `develop` or integration branch — with a single active developer, the coordination overhead of an extra branch outweighs its benefits.

### Branch Types

| Branch | Purpose | Lifetime |
| ------ | ------- | -------- |
| `main` | Stable trunk. All feature work merges here. | Permanent |
| `feature/<slug>` | Active feature development. One per feature, matches the feature slug in `docs/`. | Until merged |
| `deploy/<module>` | Deployment trigger for Netlify. Force-pushed from `main` when ready to ship. | Permanent |

### Branch Lifecycle

```
feature/synth-core  ──PR──▶  main  ──force-push──▶  deploy/s330-editor
                                    ──tag──▶  v0.2.0
```

1. **Create** a feature branch and worktree per [PROJECT-MANAGEMENT.md](./PROJECT-MANAGEMENT.md#git-worktree-structure)
2. **Develop** on the feature branch with commits
3. **Open a PR** to `main`. CI runs workspace version checks.
4. **Merge** the PR. `main` is updated.
5. **Deploy** (when ready) by force-pushing `main` to the appropriate `deploy/<module>` branch
6. **Tag** a release on `main` when a meaningful set of changes has landed (see [Versioning](#versioning))
7. **Clean up** the worktree and feature branch after merge

### When to Add a `develop` Branch

If the project gains multiple active contributors who need an integration branch to test combined work before promoting to `main`, introduce `develop` as:

```
feature/* → develop → main → deploy/*
```

Until then, the extra merge step is unnecessary overhead.

---

## Versioning

The project uses [semantic versioning](https://semver.org/) with [Changesets](https://github.com/changesets/changesets) for version management.

### Current State

The workspace is at **0.x** — pre-MVP. The `0.x` range signals that the software is deployed and functional but not yet feature-complete.

### Version Numbering

| Range | Meaning |
| ----- | ------- |
| `0.x.y` | Pre-MVP. Deployed and usable, but not feature-complete. Breaking changes may occur between minor versions. |
| `1.0.0` | MVP. The feature set defined in `docs/1.0/` is complete and polished. |
| `1.x.y` | Post-MVP. Standard semver: patch for fixes, minor for features, major for breaking changes. |

### Relationship Between `docs/<version>/` and Version Tags

The `docs/<version>/` directory structure is a **planning target**, not a claim about the current version. `docs/1.0/synth-core/` means "synth-core is planned for the 1.0 release" — the `v1.0.0` tag is created when all planned features in `docs/1.0/` are complete.

### Release Tags

**Format:** `v<major>.<minor>.<patch>` (e.g., `v0.1.0`, `v0.2.0`, `v1.0.0`)

Tags are created on `main` when a meaningful set of changes has landed — typically after merging a feature or a batch of related work. Not every merge needs a tag.

```bash
# Tag a release on main
git tag v0.2.0
git push origin v0.2.0
```

### Changesets Workflow

The repo has Changesets configured for version bumps and publishing:

```bash
# Create a changeset (describe what changed)
pnpm changeset

# Bump versions based on changesets
pnpm version:bump

# Full publish workflow
pnpm release:publish
```

Pre-release channels are available: `release:alpha`, `release:beta`, `release:stable`.

---

## Deployment

Deployments are triggered by pushing to `deploy/<module>` branches. Netlify watches these branches and runs the module's build on push.

### Deploy Branch Convention

**Format:** `deploy/<module-name>`

| Branch | Deploys | Target |
| ------ | ------- | ------ |
| `deploy/s330-editor` | S-330 web editor | Netlify |
| `deploy/d110-editor` | D-110 web editor | Netlify |
| `deploy/jv1080-editor` | JV-1080 web editor | Netlify |

### Deployment Workflow

Deployments are ad-hoc — push to a deploy branch when the current state of `main` is ready to ship for that app.

```bash
# Deploy the latest main to s330-editor
git fetch origin main
git push origin origin/main:refs/heads/deploy/s330-editor --force
```

The force-push is intentional: deploy branches are not developed on, they simply point to the commit being deployed. Their history is not meaningful.

### Adding a New Deployable Module

1. Configure the module's `netlify.toml` with build command and publish directory
2. Create the deploy branch: `git push origin main:refs/heads/deploy/<module-name>`
3. Configure Netlify to watch the new branch
4. Add the branch to the table above

---

## Summary

```
feature/foo ──PR──▶ main ──force-push──▶ deploy/s330-editor (Netlify)
                      │
                      └──tag──▶ v0.2.0
```

- **One trunk** (`main`) — always stable
- **Feature branches** — short-lived, one per feature
- **Deploy branches** — permanent, force-pushed from main when ready
- **Semver tags** — `0.x` until MVP, `1.0.0` when `docs/1.0/` is complete
- **No `develop` branch** — revisit if the team grows
