# Promo screenshots

Curated, marketing-ready screenshots of the editors for the website, blog,
and social posts.

## How they're made

`make promo-shots` renders the device-free scene manifest
(`modules/e2e-infra/src/promo/scenes.ts`) with no hardware attached — each
editor's dev server is launched on an OS-assigned port, the real components
render via the simulated-MIDI harness replaying real-device-captured
fixtures, and Playwright captures a full-page PNG per scene at 1280×800 @2x.

Generated PNGs land in `out/promo/` (gitignored). **Promote the shots worth
keeping into this directory** (`docs/promo/`) — only curated, committed
images live here.

## Regenerating

```
make promo-shots
```

Then copy the chosen files from `out/promo/<id>.png` into this directory.

See the editor-ux-refinement workplan §Phase 2 for the scene manifest and
the capture engine.
