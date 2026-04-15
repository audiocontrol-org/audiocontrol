# Text Overlay Generator - Product Requirements Document

**Created:** 2026-02-05
**Status:** Approved
**Owner:** Orion Letizi

## Problem Statement

Video creators need to add professional text overlays (titles, lower-thirds, callouts, code blocks) to their videos. The existing `oletizi/video-control` repository contains a working Remotion-based text overlay generator that should be integrated into the videocontrol monorepo to consolidate video generation tools under one project.

## User Stories

- As a video creator, I want to define text overlays in YAML so that I can version-control my video projects
- As a video creator, I want to render overlays to ProRes 4444 with alpha channel so that I can composite them in DaVinci Resolve or Final Cut Pro
- As a video creator, I want multiple overlay templates (title, lower-third, callout, code, parameter) so that I can create professional-looking videos
- As a video creator, I want configurable transitions (fade, slide, typewriter) so that my overlays animate smoothly
- As a developer, I want a CLI tool to render, validate, and preview overlay projects so that I can automate my workflow

## Success Criteria

- [ ] All existing functionality from oletizi/video-control works in the monorepo
- [ ] CLI commands work: render, validate, templates, init
- [ ] Remotion Studio preview works via `pnpm dev`
- [ ] ProRes 4444 output with alpha channel renders correctly
- [ ] All 5 overlay templates work: title, lower-third, callout, code, parameter
- [ ] All 7 transition types work: cut, fade, slide-up/down/left/right, typewriter
- [ ] Multi-section overlays with independent timing work
- [ ] Custom CSS styles apply correctly

## Scope

### In Scope

- Migrate oletizi/video-control to modules/text-overlay in videocontrol monorepo
- Adapt to @videocontrol namespace
- Ensure compatibility with pnpm workspace structure
- Preserve all existing CLI functionality
- Preserve Remotion Studio development workflow

### Out of Scope

- New overlay template types (future feature)
- Audio waveform integration (separate module)
- Cloud rendering service
- GUI editor for YAML projects

## Source Repository

**Repository:** [oletizi/video-control](https://github.com/oletizi/video-control)

### Key Components

```
src/
├── cli/           # CLI entry point and commands (render, validate, templates, init)
├── parser/        # YAML parsing and Zod schemas
├── templates/     # Remotion overlay components (Title, LowerThird, Callout, Code, Parameter)
├── transitions/   # Animation utilities (fade, slide, typewriter)
├── composition/   # Main Remotion composition
└── utils/         # Timing utilities
```

### Dependencies

- **Remotion** - React-based video rendering framework
- **Shiki** - Syntax highlighting for code overlays
- **js-yaml** - YAML parsing
- **Zod** - Schema validation
- **Commander** - CLI framework

## Technical Considerations

### Module Integration

The text-overlay module differs from phosphor-scope:
- Uses **Remotion** instead of Vite for bundling/rendering
- Outputs **ProRes video files** instead of browser-based recording
- Is a **CLI tool** rather than a web application
- Has its own **Remotion Studio** dev server

### Namespace Changes

- Package name: `text-overlay-generator` → `@videocontrol/text-overlay`
- CLI binary: `textoverlay` (preserved)
- Import paths: Update to use workspace dependencies if shared code emerges

### Workspace Compatibility

- Add to `pnpm-workspace.yaml` packages list
- Ensure Remotion's custom bundling doesn't conflict with other modules
- Preserve existing scripts (dev, build, cli, etc.)

## Open Questions

- [x] Should this share any code with phosphor-scope? (No - different tech stacks)
- [ ] Should the CLI be globally installable via npm? (TBD - currently local only)
- [ ] Future: integrate with phosphor-scope for audio-reactive text? (Out of scope for now)
