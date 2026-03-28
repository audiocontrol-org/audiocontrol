# Edit Workflow Architecture

**Status:** Planning
**Branch:** `feature/edit-workflow-architecture`
**Phase:** 1 (Roadmap)

## Overview

Define the architectural pattern for non-modal edit workflows, environment capability interfaces, the standalone dev harness convention, and the two-part module export standard. This is the foundation feature that unblocks all workflow implementations in Phases 2-5, the Akai editor track, and the hardware platform track.

## Documentation

- [PRD](prd.md) -- problem statement, user stories, success criteria, scope, open questions
- [Workplan](workplan.md) -- implementation phases and task breakdown (draft)
- [Implementation Summary](implementation-summary.md) -- post-completion report (template)

## GitHub Tracking

- **Milestone:** TBD
- **Parent Issue:** TBD

## Key Decisions

_To be recorded as decisions are made:_

| Decision | Status | Notes |
|----------|--------|-------|
| Route-based vs panel-based vs hybrid navigation | Open | See PRD open questions |
| Environment interface module location | Open | `editor-core` vs new module |
| Reference workflow selection | Open | Loop editor is leading candidate |
| State persistence mechanism | Open | Context, URL params, IndexedDB, or library layer |
| Interface granularity | Open | Single composite vs separate interfaces |

## Related Features

| Feature | Relationship |
|---------|-------------|
| `library-common-area` | Sibling in Phase 1; uses workflow pattern for common-area operations |
| `sample-trim-normalize` | Phase 2; first workflow built on this architecture |
| `loop-editor-fixes` | Phase 2; reference workflow may be the loop editor |
| `common-area-chopping` | Phase 2; connects existing chopper via workflow pattern |
| `http-midi-transport` | Hardware track; environment capability interfaces enable Electron deployment |
| `kiosk-display-profiles` | Hardware track; benefits from workflow UX patterns |
