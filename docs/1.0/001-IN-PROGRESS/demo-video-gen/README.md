# Demo Video Generator

Automated demo video generation from scripted Playwright browser interactions.

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Infrastructure (runner, ffmpeg, Make targets) | Complete |
| Phase 2 | Caption Generation (YAML, VO scripts) | Complete |
| Phase 3 | First Scenarios (S3000XL, Roland S-330) | Complete (device scenario optional) |
| Phase 4 | Video Preview Gallery (Vite dev server) | Complete |
| Phase 5 | Port videocontrol Repo | Complete |
| Phase 6 | Video Publishing & Versioning | Planning |
| Phase 7 | Gallery-Triggered Generation | Complete |
| Phase 8 | Text Overlay Rendering | Complete |
| Phase 9 | Generation Progress Indicator | Planning |

## Links

| Resource | Link |
|----------|------|
| PRD | [prd.md](https://github.com/audiocontrol-org/audiocontrol/blob/feature/demo-video-gen/docs/1.0/001-IN-PROGRESS/demo-video-gen/prd.md) |
| Workplan | [workplan.md](https://github.com/audiocontrol-org/audiocontrol/blob/feature/demo-video-gen/docs/1.0/001-IN-PROGRESS/demo-video-gen/workplan.md) |
| Implementation Summary | [implementation-summary.md](https://github.com/audiocontrol-org/audiocontrol/blob/feature/demo-video-gen/docs/1.0/001-IN-PROGRESS/demo-video-gen/implementation-summary.md) |
| Branch | [feature/demo-video-gen](https://github.com/audiocontrol-org/audiocontrol/tree/feature/demo-video-gen) |
| Worktree | `~/work/audiocontrol-work/audiocontrol-demo-video-gen/` |

## Overview

This feature adds automated demo video generation to the audiocontrol project. Demo scenarios are written as TypeScript files that drive Playwright browser interactions. Running a scenario produces screen recordings (MP4 and GIF) and timed caption data (YAML for @videocontrol/text-overlay).

Scenarios operate in two modes:

- **Harness mode:** Uses the editor's test harness with fixture data. No hardware required.
- **Device mode:** Connects to real hardware. Requires device and is skipped in CI.

Three output tiers:

- **Silent:** Raw video only (MP4 + GIF)
- **Captioned:** Video + text-overlay YAML for compositing
- **Scripted:** Video + YAML + proposed VO script for post-production
