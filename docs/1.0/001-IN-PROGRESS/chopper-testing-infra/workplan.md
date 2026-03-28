# Sample Chopper Testing Infrastructure — Workplan

**Feature:** Sample Chopper Testing Infrastructure
**PRD:** [prd.md](./prd.md)
**GitHub Issues:**

- [Parent: [sample-chopper] Testing Infrastructure (#98)](https://github.com/audiocontrol-org/audiocontrol/issues/98)

## Implementation Phases

### Phase 1: Upgrade chopper dev harness
- Add useLibraryConnection with mock library support
- Three-pane layout matching loop editor pattern
- "Open in Chopper" button on selected sample
- onSave callback writing sample.yaml with slices
- data-testid attributes for e2e test entry points

### Phase 2: Wire onSave in production LibraryPage
- Pass onSave to SampleChopperDialog
- Save sliced samples back to library as sample.yaml

### Phase 3: Create E2E test spec
- Navigation helpers for both surfaces
- Feature parity tests (dialog, slicing, save)

### Phase 4: Create Playwright config and run script
- Two-project config with injected port env vars
- Run script starting both servers on port 0

### Phase 5: Fix loop editor e2e stale comments

## Task Breakdown

1. Restructure chopper dev harness with library browsing
2. Wire onSave in LibraryPage chopper dialog
3. Write sample-chopper-production.spec.ts
4. Write playwright.sample-chopper.config.ts
5. Write run-sample-chopper-e2e.sh
6. Add test:e2e:sample-chopper script to package.json
7. Fix loop editor e2e stale comments
8. Build and verify
