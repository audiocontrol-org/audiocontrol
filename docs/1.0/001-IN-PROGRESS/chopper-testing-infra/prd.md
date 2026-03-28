# Sample Chopper Testing Infrastructure - Product Requirements Document

**Created:** 2026-03-22
**Status:** Draft
**Owner:** Orion Letizi

## Problem Statement

The loop editor has a complete dual-surface testing infrastructure: a standalone dev harness with mock library auto-connect and full library CRUD, plus E2E tests that validate identical behavior on both the sampler-editor production page and the dev harness. This ensures the loop editor works correctly in both contexts.

The sample chopper has none of this. Its dev harness is a standalone WAV file picker with no mock library support, no "Open in Chopper" production flow mirroring, no round-trip save to library, and no E2E tests. There's no way to verify that the chopper works correctly from the library page without manual testing.

## User Stories

- As a developer, I want E2E tests that validate the "Open in Chopper" flow from the library page so I can catch regressions.
- As a developer, I want the chopper dev harness to mirror the production flow so I can develop and debug independently of the sampler editor.
- As a developer, I want the same test suite to run on both surfaces so feature parity is enforced automatically.

## Success Criteria

- [ ] Chopper dev harness has mock library with auto-connect via `?library=mock`
- [ ] Dev harness has "Open in Chopper" button that mirrors the production flow
- [ ] Chopper dialog saves sliced samples back to library as `sample.yaml`
- [ ] E2E tests validate dialog opens, slicing works, and save works on both surfaces
- [ ] Run script starts both servers on OS-assigned ports (no race conditions)
- [ ] Production LibraryPage passes `onSave` to `SampleChopperDialog`

## Scope

### In Scope

- Restructure chopper dev harness for library browsing + mock support
- Wire `onSave` in production LibraryPage chopper dialog
- Create E2E test spec for chopper operations
- Create Playwright config and run script
- Fix stale comments in loop editor E2E

### Out of Scope

- Chopper algorithm changes
- New slicing features
- Visual regression testing for chopper UI
