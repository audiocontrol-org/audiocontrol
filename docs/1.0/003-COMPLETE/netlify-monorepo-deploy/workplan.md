# Netlify Monorepo Deployment - Workplan

## GitHub Tracking

- **Milestone:** TBD
- **Parent Issue:** TBD

## Implementation Phases

### Phase 1: Rename Module

1. Rename directory `modules/sampler-editor` → `modules/roland-sxx0-editor`
2. Update `package.json` name field to `@audiocontrol/roland-sxx0-editor`
3. Update Makefile references to new module path
4. Update any workspace dependencies in other modules
5. Update tsconfig paths if applicable
6. Verify build succeeds with `make clean && make`

### Phase 2: Create Netlify Config Structure

1. Create directory `netlify/roland-sxx0-editor/`
2. Create `_redirects` file with SPA routing rules
3. Create `_headers` file with security and cache headers
4. Update build to copy these files to dist directory during build
5. Remove old `modules/sampler-editor/netlify.toml`

### Phase 3: Update Netlify Site

1. Rename Netlify site from `s330` to `roland-sxx0-editor` via API
2. Update publish directory to `modules/roland-sxx0-editor/dist`
3. Update allowed branches to `deploy/roland-sxx0-editor`
4. Verify build command is `make`

### Phase 4: Update Deploy Branch

1. Delete old `deploy/s330-editor` branch
2. Create new `deploy/roland-sxx0-editor` branch from main
3. Trigger deploy and verify site works

### Phase 5: Update Documentation

1. Update CLAUDE.md with deployment section
2. Update PROJECT-MANAGEMENT.md deploy branch examples if needed

### Phase 6: External Dependency (Manual)

1. Update `@oletizi/audiocontrol.org` repo to proxy to `roland-sxx0-editor.netlify.app`

## Task Breakdown

| Task | Phase | Description |
|------|-------|-------------|
| Rename module directory | 1 | `mv modules/sampler-editor modules/roland-sxx0-editor` |
| Update package.json | 1 | Change name to `@audiocontrol/roland-sxx0-editor` |
| Update Makefile | 1 | Replace all `sampler-editor` references |
| Update workspace deps | 1 | Update any modules that depend on sampler-editor |
| Create netlify config dir | 2 | `mkdir -p netlify/roland-sxx0-editor` |
| Create _redirects | 2 | SPA routing: `/* /index.html 200` |
| Create _headers | 2 | Security headers, cache headers |
| Update vite build | 2 | Copy netlify files to dist |
| Remove old netlify.toml | 2 | Delete `modules/sampler-editor/netlify.toml` |
| Rename Netlify site | 3 | Via `netlify api updateSite` |
| Update site settings | 3 | Publish dir, allowed branches |
| Update deploy branch | 4 | Delete old, create new |
| Update CLAUDE.md | 5 | Document deployment workflow |
| Update audiocontrol.org | 6 | External repo update |

## Success Criteria Per Phase

### Phase 1
- `make clean && make` succeeds
- All tests pass

### Phase 2
- Netlify config files exist in `netlify/roland-sxx0-editor/`
- Build copies files to dist

### Phase 3
- Netlify site settings show correct values

### Phase 4
- Site deploys and serves correctly at new URL

### Phase 5
- Documentation reflects new structure

### Phase 6
- `audiocontrol.org/roland/s330/editor` proxies correctly
