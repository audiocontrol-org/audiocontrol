# Sample Chopper Extraction

**Status:** In Progress
**Branch:** `feature/s550-support`
**Milestone:** TBD

## Overview

Extract the sample slicing workflow from `sampler-library` and `sampler-editor` into a standalone `@audiocontrol/sample-chopper` module. Enables any future editor (Akai, etc.) to reuse the slicing UI without Roland coupling.

## Documentation

- [PRD](./prd.md) - Product requirements, user stories, scope
- [Workplan](./workplan.md) - Implementation phases and technical approach

## Quick Links

- **Repository:** [audiocontrol-org/audiocontrol](https://github.com/audiocontrol-org/audiocontrol)
- **New Module:** `modules/sample-chopper/`
- **Source Modules:** `modules/sampler-library/`, `modules/sampler-editor/`

## Key Design Decisions

1. **Render prop pattern** — Dialog accepts `renderOutputConfig` for device-specific UI
2. **Design tokens** — `--ac-*` CSS custom properties replace `s330-*` classes
3. **Backward compatibility** — `sampler-library` re-exports everything
4. **Zero coupling** — No imports from `sampler-devices` or `sampler-library`

## Implementation Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Module scaffold + algorithm extraction | Pending |
| 2 | Test migration | Pending |
| 3 | React UI extraction + render prop refactor | Pending |
