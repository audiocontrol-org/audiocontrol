# Code Review: loop-editor Module

**Module**: `@audiocontrol/loop-editor`
**Review Date**: 2026-03-28
**Reviewer**: Senior Code Reviewer Agent
**Overall Grade**: B-

---

## Executive Summary

The loop-editor module provides split-pane waveform visualization for finding loop points in audio samples, with auto-detection using NCC (Normalized Cross-Correlation) scoring. The module demonstrates solid architectural decisions in its export separation (algorithms vs UI) and Web Worker usage for CPU-intensive operations. However, the primary UI component (`LoopEditor.tsx`) at **788 lines** significantly exceeds the project's 300-500 line guideline, requiring refactoring for maintainability.

---

## Strengths

### 1. Clean Export Pattern (Algorithm vs UI Separation)
The module correctly separates concerns with dual entry points:

```typescript
// src/index.ts - Algorithm/type exports (no React dependency)
export type { LoopCandidate, SearchConfig, LoopDetectionProgress } from './types';

// src/ui/index.ts - React UI exports
export { LoopEditor } from './LoopEditor';
export { useLoopDetection } from './hooks/useLoopDetection';
export { useLoopEditor } from '@/ui/hooks/use-loop-editor';
```

**Package exports** in `package.json` properly support this pattern:
```json
"exports": {
  ".": { "import": "./dist/index.js" },
  "./ui": { "import": "./dist/ui/index.js" }
}
```

This allows consumers to import algorithms without React as a dependency.

### 2. Web Worker Architecture for Loop Detection
CPU-intensive loop point search runs off the main thread via a dedicated Web Worker:

**File**: `/Users/orion/work/audiocontrol-work/audiocontrol/modules/loop-editor/src/workers/loop-detection.worker.ts`

```typescript
self.onmessage = (event: MessageEvent<WorkerSearchRequest>) => {
  // ... runs searchLoopPoints off main thread with progress callbacks
  const onProgress = (percent: number, stage: string) => {
    self.postMessage({ type: 'progress', percent, stage });
  };
  const candidates = searchLoopPoints(samples, sampleRate, targetEndPoint, config, onProgress);
  self.postMessage({ type: 'complete', candidates });
};
```

The hook `useLoopDetection.ts` properly manages Worker lifecycle including termination on unmount and cancellation.

### 3. Interface-First Design for Audio Playback
The component correctly uses the `AudioPlayback` interface from `@audiocontrol/editor-core` rather than browser APIs directly:

```typescript
// LoopEditor.tsx
import type { AudioPlayback } from '@audiocontrol/editor-core';
// ...
audio?: AudioPlayback;
```

This enables testability and platform abstraction.

### 4. Composable Hook Pattern
`use-loop-editor.ts` encapsulates all loop editing state, detection, and playback in a single composable hook that provides a pre-packaged `editorProps` object:

```typescript
const editorProps: LoopEditorProps = useMemo(() => ({
  samples, sampleRate, loopPoint, endPoint, ...
}), [...]);
```

### 5. Dev Harness Pattern
The `/dev` directory provides a standalone development environment that mirrors the production integration, enabling isolated testing:

**File**: `/Users/orion/work/audiocontrol-work/audiocontrol/modules/loop-editor/dev/main.tsx`

### 6. Proper TypeScript Configuration
- Uses `@/` path alias consistently
- Strict mode enabled
- Documented deviation from path alias in Worker URL (necessary limitation)

---

## Issues Found

### CRITICAL: File Size Violation

#### LoopEditor.tsx - 788 lines (32KB)

**File**: `/Users/orion/work/audiocontrol-work/audiocontrol/modules/loop-editor/src/ui/LoopEditor.tsx`

**Violation**: Exceeds 300-500 line guideline by 288-488 lines (57-158% over limit)

**Impact**:
- Reduced readability and maintainability
- Difficult to test individual rendering concerns
- Risk of merge conflicts in team development
- Cognitive load for new contributors

**Root Cause Analysis**:
The component mixes multiple distinct responsibilities:
1. Canvas waveform rendering (lines 240-352) - 112 lines
2. Drag interaction handlers (lines 372-431) - 59 lines
3. Keyboard shortcut handling (lines 437-466) - 29 lines
4. Preview playback logic (lines 199-237) - 38 lines
5. Loading states (lines 468-503) - 35 lines
6. Main render JSX (lines 505-788) - 283 lines including:
   - Header with controls
   - Search progress bar
   - Split-pane canvas display
   - Nudge controls
   - Candidates list

---

### HIGH: Insufficient Test Coverage

**Finding**: Only one smoke test file exists (`types.test.ts`, 17 lines) that tests type construction:

```typescript
it('can construct a valid progress object', () => {
  const progress: LoopDetectionProgress = { percent: 50, stage: 'NCC scoring' };
  expect(progress.percent).toBe(50);
});
```

**Missing Tests**:
- No unit tests for `useLoopDetection` hook
- No unit tests for `useLoopEditor` hook
- No tests for canvas rendering logic
- No tests for drag/nudge interactions
- No tests for keyboard shortcuts
- No integration tests for Worker communication

---

### MEDIUM: Inconsistent Hook Naming Convention

**Finding**: Two hooks with different naming patterns:
- `useLoopDetection.ts` (camelCase)
- `use-loop-editor.ts` (kebab-case)

**Location**: `/Users/orion/work/audiocontrol-work/audiocontrol/modules/loop-editor/src/ui/hooks/`

**Recommendation**: Standardize on one pattern (prefer `useXxx.ts` to match React conventions).

---

### MEDIUM: Magic Numbers in Canvas Rendering

**File**: `/Users/orion/work/audiocontrol-work/audiocontrol/modules/loop-editor/src/ui/LoopEditor.tsx`

```typescript
const yMin = midY - (maxVal / 32768) * (midY - 2);  // Line 332
const yMax = midY - (minVal / 32768) * (midY - 2);  // Line 333
```

The value `32768` (INT16_MAX) and `2` (pixel margin) are unexplained. Should be named constants.

---

### MEDIUM: Dev Harness Approaching Size Limit

**File**: `/Users/orion/work/audiocontrol-work/audiocontrol/modules/loop-editor/dev/main.tsx`
**Lines**: 394 (within limit but approaching threshold)

The dev harness duplicates library connection/CRUD logic that exists in `sampler-editor`. Consider extracting shared dev utilities.

---

### LOW: Local Type Declarations for sampler-library

**File**: `/Users/orion/work/audiocontrol-work/audiocontrol/modules/loop-editor/src/types/sampler-library.d.ts`

The comment indicates this is a workaround for missing upstream DTS:
```typescript
// Once its DTS build is fixed upstream, this file can be removed
```

This creates a maintenance burden and potential type drift.

---

### LOW: Optional Chaining Without Nullish Coalescing in Some Places

**File**: `/Users/orion/work/audiocontrol-work/audiocontrol/modules/loop-editor/src/ui/LoopEditor.tsx`

```typescript
const newValue = Math.max(startPoint, Math.min(samples?.length ?? 0, dragStartValue + deltaSamples));
```

vs

```typescript
onChange={(e) => { onEndPointChange?.(Math.max(loopPoint, parseInt(e.target.value) || 0)); }}
```

Using `|| 0` vs `?? 0` inconsistently. The `|| 0` form will coerce `0` to the fallback, which may not be intended for sample indices.

---

## Recommended Component Decomposition for LoopEditor.tsx

### Proposed Directory Structure

```
src/ui/
  LoopEditor.tsx              (< 150 lines - orchestration only)
  components/
    WaveformCanvas.tsx        (~120 lines - canvas rendering)
    WaveformSplitPane.tsx     (~60 lines - two canvases with splice point)
    LoopEditorHeader.tsx      (~100 lines - controls, playback mode, MIDI toggle)
    LoopEditorControls.tsx    (~80 lines - nudge buttons, inputs)
    CandidatesList.tsx        (~70 lines - loop candidate selection)
    SearchProgressBar.tsx     (~30 lines - auto-detect progress)
  hooks/
    useWaveformCanvas.ts      (~80 lines - canvas drawing logic)
    useDragInteraction.ts     (~60 lines - drag handlers)
    useKeyboardShortcuts.ts   (~40 lines - keyboard navigation)
    useLoopDetection.ts       (existing)
    useLoopEditor.ts          (rename from use-loop-editor.ts)
```

### Refactoring Strategy

#### Phase 1: Extract Canvas Rendering
Create `WaveformCanvas.tsx` and `useWaveformCanvas.ts` to encapsulate:
- `drawWaveform()` callback
- Canvas ref management
- Resize observer logic
- Color constants

#### Phase 2: Extract Interaction Handlers
Create `useDragInteraction.ts` and `useKeyboardShortcuts.ts`:
- Mouse down/move/up handlers
- Pixel-to-sample conversion
- Keyboard event handlers

#### Phase 3: Extract UI Sections
Split render JSX into focused components:
- `LoopEditorHeader` - Title, auto-detect button, playback controls
- `LoopEditorControls` - Nudge buttons and numeric inputs
- `CandidatesList` - Candidate selection UI
- `SearchProgressBar` - Progress indicator

#### Phase 4: Simplify Main Component
`LoopEditor.tsx` becomes an orchestration layer:
```typescript
export function LoopEditor(props: LoopEditorProps) {
  const canvas = useWaveformCanvas(props.samples, props.zoom);
  const drag = useDragInteraction(props);
  useKeyboardShortcuts(props);

  if (props.isLoading) return <LoadingState />;
  if (!props.samples) return <EmptyState />;

  return (
    <div ref={containerRef}>
      <LoopEditorHeader {...headerProps} />
      <WaveformSplitPane {...canvasProps} />
      <LoopEditorControls {...controlProps} />
      <CandidatesList {...candidatesProps} />
    </div>
  );
}
```

---

## Algorithm Quality Assessment

### NCC Scoring (Normalized Cross-Correlation)
The algorithm implementation is delegated to `@audiocontrol/sampler-library/browser`. The interface design is sound:

```typescript
interface SearchConfig {
  minLoopLength: number;
  maxLoopLength: number;
  candidateCount: number;
  nccWindowSize: number;
  spectralWindowSize: number;
  endPointSearchRadius: number;
  loopStartSearchRadius: number;
  weights: { ncc: number; spectral: number; slope: number; };
}
```

The multi-factor scoring (NCC + spectral + slope) is displayed in the UI:
```typescript
{(candidate.nccScore * 100).toFixed(0)}% /
{(candidate.spectralScore * 100).toFixed(0)}% /
{(candidate.slopeScore * 100).toFixed(0)}%
```

### Splice Smoothing
Crossfade smoothing is properly parameterized:
```typescript
const smoothed = createSmoothedCopy(samples, loopPoint, endPoint, {
  mode: 'equal-power',
  crossfadeLength: 64
});
```

The `use-loop-editor.ts` hook exposes crossfade length control (8-2048 samples).

### Discontinuity Analysis
Real-time splice quality feedback via `analyzeDiscontinuity()`:
```typescript
interface DiscontinuityAnalysis {
  amplitudeStep: number;
  normalizedAmplitudeStep: number;
  slopeDifference: number;
  normalizedSlopeDifference: number;
  needsSmoothing: boolean;
  recommendedCrossfadeLength: number;
}
```

---

## Performance Assessment

### Web Worker Usage - GOOD
Loop detection runs entirely off main thread, preventing UI blocking during analysis.

### Canvas Rendering - ADEQUATE
- Uses min/max envelope drawing for efficiency
- Redraws on dependency changes via `useEffect`
- Could benefit from `requestAnimationFrame` throttling during drag operations

### Memory Considerations - ACCEPTABLE
- Worker transfers buffer ownership: `worker.postMessage(request, [samples.buffer])`
- Smoothed buffer is memoized and recomputed only when needed
- No obvious memory leaks in hook cleanup

### Potential Optimizations
1. Add `requestAnimationFrame` throttling for drag updates
2. Consider `OffscreenCanvas` for Worker-based rendering
3. Implement canvas caching to avoid full redraws on zoom

---

## Security Assessment

No security concerns identified. The module:
- Does not handle user credentials
- Does not make network requests
- Processes only local audio data
- Uses standard DOM APIs

---

## Recommendations Summary

| Priority | Issue | Action |
|----------|-------|--------|
| CRITICAL | LoopEditor.tsx size violation | Decompose into 6-8 smaller components |
| HIGH | Insufficient test coverage | Add unit tests for hooks and interactions |
| MEDIUM | Hook naming inconsistency | Rename `use-loop-editor.ts` to `useLoopEditor.ts` |
| MEDIUM | Magic numbers | Extract INT16_MAX and margins to constants |
| LOW | Local type declarations | Track upstream DTS fix |
| LOW | Inconsistent nullish handling | Standardize on `?? 0` for numeric fallbacks |

---

## Conclusion

The loop-editor module demonstrates good architectural decisions: clean export separation, proper Web Worker usage, and composable hook design. The algorithm integration (NCC, spectral, slope scoring) is well-designed with appropriate UI feedback for splice quality.

However, the **788-line LoopEditor.tsx component is a significant maintainability concern** that should be addressed before adding new features. The recommended decomposition into ~8 focused files would bring the module into compliance with project guidelines while improving testability.

Test coverage is the most significant gap. The current single smoke test provides minimal confidence. Adding unit tests for the hooks and interaction handlers should be prioritized.

**Grade Breakdown**:
- Architecture: A- (clean separation, good patterns)
- Code Quality: C (size violation, insufficient tests)
- TypeScript: B+ (good interface design, minor inconsistencies)
- Algorithm Design: B+ (solid multi-factor scoring)
- Performance: B (good Worker usage, room for optimization)

**Final Grade: B-**
