---
paths:
  - "netlify/**"
  - "deploy/**"
---

# Deployment

Web editors are deployed on Netlify. Each editor has its own Netlify site with per-site configuration.

## Netlify Sites

| Site | URL | Deploy Branch | Publish Directory |
|------|-----|---------------|-------------------|
| `roland-sxx0-editor` | https://roland-sxx0-editor.netlify.app | `deploy/roland-sxx0-editor` | `modules/roland-sxx0-editor/dist` |

## Deploying an Editor

To deploy the latest main to an editor:

```bash
git fetch origin main
git push origin origin/main:refs/heads/deploy/roland-sxx0-editor --force
```

## Netlify Configuration

Each site's config lives in `netlify/<site-name>/`:

```
netlify/
└── roland-sxx0-editor/
    ├── _redirects    # SPA routing
    └── _headers      # Security/cache headers
```

These files are copied to the publish directory during build. All sites use:
- **Build command:** `make`
- **Base directory:** repo root
