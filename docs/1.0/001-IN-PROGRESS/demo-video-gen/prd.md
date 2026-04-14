# Demo Video Generator - Product Requirements Document

**Created:** 2026-04-13
**Status:** Approved
**Owner:** oletizi

## Problem Statement

Demo videos for audiocontrol features are created manually, which means they go stale when new versions ship and are expensive to redo. There is no automated pipeline to generate demo videos from scripted browser interactions. This makes it difficult to keep marketing materials, contributor onboarding, and feature showcases current across releases.

## User Stories

1. **As a developer shipping a new version,** I want to regenerate all demo videos from existing scenario definitions so that demo content stays current without manual screen recording effort.

2. **As a marketer creating feature showcases,** I want captioned demo videos with timed text overlays and VO scripts so that I can produce polished promotional content from automated recordings.

3. **As a contributor evaluating the project,** I want to see working demo videos of key features so that I can understand what the editors do before setting up hardware.

4. **As a scenario author,** I want to write demo scenarios as TypeScript files using Playwright so that I can leverage existing test infrastructure and type safety.

## Success Criteria

- Demo scenarios are defined as TypeScript files that script Playwright browser interactions.
- Running a scenario produces: raw screen recording (MP4 and GIF), timed captions transcript (YAML in @videocontrol/text-overlay format).
- Scenarios can target either the browser test harness (fixture data, no device) or the full editor (real device, flagged in scenario metadata).
- A Make target runs all scenarios and outputs videos to a `dist/` directory.
- Three output tiers: silent (raw video only), captioned (video + text-overlay YAML for compositing), or scripted (proposed VO script for post-production).
- Videos can be regenerated from the same scenario definitions when new versions ship.
- A local preview gallery lets developers browse generated videos without regenerating.
- Published videos are durably stored with per-scenario revision history.
- Videos can be regenerated from the gallery UI without switching to the terminal.
- Caption text can be burned into the video or displayed as a live overlay in the gallery player.

## Scope

### In Scope

- Scenario definition format (TypeScript files with Playwright interactions)
- Scenario runner that launches Playwright with `recordVideo`, executes scenario, closes browser
- ffmpeg conversion from WebM to MP4 and GIF
- Caption generation as YAML matching @videocontrol/text-overlay project format
- VO script generation from caption data
- Make targets for running individual or all scenarios
- Harness mode (fixture data, no device required) and device mode (real hardware)
- Output directory structure under `dist/`

- Local preview gallery (Vite dev server) for browsing generated videos without regenerating
- Video publishing pipeline with per-scenario revision history
- Storage backend research and selection for durable video hosting
- Gallery-triggered video regeneration (generate from the browser, no terminal required)
- Text overlay rendering: ffmpeg burn-in (captioned MP4) and live HTML overlay in the gallery player

### Out of Scope

- Audio narration recording or synthesis
- Video editing UI
- Thumbnail generation
- Video streaming or adaptive bitrate encoding

## Dependencies

| Dependency | Type | Purpose |
|---|---|---|
| Playwright | Runtime | Browser automation and `recordVideo` capture |
| ffmpeg | Runtime | WebM to MP4 and GIF conversion |
| @audiocontrol-org/videocontrol | Format target | text-overlay YAML caption format |
| modules/akai-s3k-editor | Demo target | S3000XL editor scenarios (not modified) |
| modules/roland-sxx0-editor | Demo target | Roland S-330/S-550 editor scenarios (not modified) |

## Open Questions

- What resolution and frame rate? (1920x1080 @ 30fps proposed as standard)
- Should scenarios include mouse cursor visualization?
- How should GIF quality/size be managed? (palette optimization, frame skipping, max duration)
