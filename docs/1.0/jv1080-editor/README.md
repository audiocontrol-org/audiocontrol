# JV-1080 Editor

**Status:** Planning
**Branch:** `feature/jv1080-editor`
**Milestone:** [Week of Feb 3-7](https://github.com/audiocontrol-org/audiocontrol/milestone/1)

## Overview

Port Roland JV-1080 editor work from `oletizi/ol_dsp` into this monorepo as first-class `@audiocontrol/*` modules, using the archived JV-1080 MIDI implementation in `sampler-attic` as the code baseline.

## Documentation

- [PRD](./prd.md) - Product requirements, scope, and source analysis
- [Workplan](./workplan.md) - Implementation phases and GitHub tracking links
- [Implementation Summary](./implementation-summary.md) - Post-completion report template

## GitHub Tracking

- Parent issue: [[sampler-devices] JV-1080 Editor (#4)](https://github.com/audiocontrol-org/audiocontrol/issues/4)
- Source feature issue: [[audio-tools] JV-1080 Editor (#49)](https://github.com/oletizi/ol_dsp/issues/49)
- Source implementation issues:
  - [#50 Extract JV-1080 client from sampler-attic](https://github.com/oletizi/ol_dsp/issues/50)
  - [#51 Create jv1080-editor web application scaffold](https://github.com/oletizi/ol_dsp/issues/51)
  - [#52 Implement JV-1080 system parameter controls](https://github.com/oletizi/ol_dsp/issues/52)
  - [#53 Implement JV-1080 effects editor](https://github.com/oletizi/ol_dsp/issues/53)

## Quick Links

- Active archived code: `modules/sampler-attic/src/midi/roland-jv-1080.ts`
- Recommended extraction target: `modules/sampler-devices/src/devices/jv1080/`
- Recommended web editor target: `modules/jv1080-editor/`
