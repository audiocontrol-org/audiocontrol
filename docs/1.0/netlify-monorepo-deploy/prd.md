# Netlify Monorepo Deployment Configuration

## Problem Statement

The audiocontrol monorepo hosts multiple web editors (Roland S-330, S-550, and future devices from other manufacturers). The current Netlify deployment configuration:

1. Uses module-specific `netlify.toml` that conflicts with the repo-root-based `make` build system
2. Has a module named `sampler-editor` that doesn't reflect its multi-device scope (S-330, S-550)
3. Has a Netlify site named `s330` that doesn't reflect the editor's multi-device support
4. Lacks a scalable pattern for adding additional editor deployments

## Goals

1. Establish a per-site Netlify configuration pattern that works with the monorepo's Make-based build system
2. Rename the module and Netlify site to reflect multi-device support
3. Document the deployment workflow in CLAUDE.md

## Success Criteria

- [ ] Module renamed from `sampler-editor` to `roland-sxx0-editor`
- [ ] Netlify site renamed from `s330` to `roland-sxx0-editor`
- [ ] Netlify config structure supports multiple sites with per-site `_redirects` and `_headers`
- [ ] Build uses `make` from repo root with site-specific publish directory
- [ ] Deploy branch renamed from `deploy/s330-editor` to `deploy/roland-sxx0-editor`
- [ ] CLAUDE.md updated with deployment documentation
- [ ] External `audiocontrol.org` proxy config updated to point to new site

## Scope

### In Scope

- Rename `modules/sampler-editor` to `modules/roland-sxx0-editor`
- Rename Netlify site from `s330` to `roland-sxx0-editor`
- Create `netlify/roland-sxx0-editor/` config directory with `_redirects` and `_headers`
- Update Makefile references
- Update workspace dependencies
- Update deploy branch
- Update CLAUDE.md deployment section

### Out of Scope

- Adding new editor deployments (future work)
- Changes to the editor application code itself
- Changes to other modules

## Dependencies

- External: `@oletizi/audiocontrol.org` repo must be updated to proxy to new Netlify site name

## Open Questions

None.
