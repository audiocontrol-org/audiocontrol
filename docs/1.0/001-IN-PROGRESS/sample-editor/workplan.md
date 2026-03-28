# Sample Editor Module — Implementation Workplan

**Feature:** Sample Editor Module
**PRD:** [prd.md](./prd.md)

## Implementation Phases

### Phase 1: Module scaffolding

Create `modules/sample-editor/` with standard structure:
- package.json (dual exports: `.` and `./ui`, peer deps on React + Radix)
- tsconfig.json, tsup.config.ts, vitest.config.ts
- src/index.ts, src/ui/index.ts, src/types.ts
- Add to pnpm-workspace.yaml and Makefile

### Phase 2: Core operations (pure functions, unit tested)

- `src/operations/trim.ts` — `trimSamples(samples, start, end)`, `trimSilence(samples, sampleRate, thresholdDb)`
- `src/operations/normalize.ts` — `normalize(samples, targetPeakDb)`, `applyGain(samples, gainDb)`
- `src/operations/fade.ts` — `fadeIn(samples, sampleRate, durationMs, curve)`, `fadeOut(samples, sampleRate, durationMs, curve)`
- `src/operations/reverse.ts` — `reverseSamples(samples)`
- Unit tests for each operation

### Phase 3: Editor state management hook

- `src/ui/hooks/useSampleEditor.ts` — manages:
  - Current samples + sampleRate
  - Operation history (undo/redo stack)
  - Selection region (startSample, endSample)
  - Pending operation preview
  - Apply/revert operations

### Phase 4: UI components

- `SampleEditorDialog.tsx` — Radix dialog, header with save/close, waveform + controls
- `WaveformDisplay.tsx` — Canvas-based waveform with selection region
- `OperationPanel.tsx` — Controls for each operation (trim, normalize, fade, reverse, gain)

### Phase 5: Dev harness

- `dev/main.tsx` — standalone app with useLibraryConnection, mock library, "Open in Editor" button
- `dev/vite.config.ts` — standard config matching loop-editor/sample-chopper pattern
- `dev/index.html`

### Phase 6: Library page integration

- Add "Open in Sample Editor" to context menu (item-types.tsx) and preview panel
- Add `SampleEditorDialog` to LibraryPage.tsx
- Wire `handleOpenInSampleEditor` with WAV loading and save callback

### Phase 7: E2E tests

- `sampler-editor/e2e/sample-editor-production.spec.ts`
- `sampler-editor/playwright.sample-editor.config.ts`
- `sampler-editor/scripts/run-sample-editor-e2e.sh`
- Tests: dialog open, waveform display, trim, normalize, undo/redo, save

## Task Breakdown

1. Create module scaffolding
2. Implement trim operations + tests
3. Implement normalize/gain operations + tests
4. Implement fade operations + tests
5. Implement reverse operation + tests
6. Create useSampleEditor hook
7. Create WaveformDisplay component
8. Create OperationPanel component
9. Create SampleEditorDialog
10. Create dev harness
11. Add context menu and preview panel integration
12. Wire into LibraryPage
13. Create E2E test infrastructure
14. Write E2E tests
15. Build and verify
