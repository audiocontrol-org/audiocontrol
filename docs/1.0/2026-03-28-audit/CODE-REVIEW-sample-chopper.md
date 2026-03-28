# Code Review: sample-chopper Module

**Review Date:** 2026-03-28
**Reviewer:** Senior Code Review Agent
**Module Path:** `/modules/sample-chopper/`

---

## Overall Assessment: B+

The sample-chopper module demonstrates solid architecture with clean separation between algorithm and UI layers. The audio processing algorithms are well-implemented with appropriate documentation. The React hooks follow composition patterns effectively. However, there are several areas requiring attention, particularly around file sizes and hook complexity.

---

## Executive Summary

### Strengths
- Excellent separation between algorithm layer (pure functions) and UI layer (React hooks/components)
- Well-documented audio utility functions with clear JSDoc comments
- Comprehensive type definitions with discriminated unions for slice configurations
- Good use of composition in the trigger system architecture
- Clean interface exports with proper type exports
- Solid test coverage for core algorithms
- Appropriate use of Web Audio API patterns

### Areas for Improvement
- Several files exceed the 300-500 line guideline
- Complex hook interdependencies in the trigger system
- Some components have high cyclomatic complexity
- Missing explicit return types on some functions
- Potential performance concerns in canvas rendering loop

---

## Detailed Findings

### Critical Issues (None)

No security vulnerabilities or data corruption risks identified.

---

### High Priority Issues

#### 1. File Size Violations

**WaveformEditor.tsx (805 lines)**
File: `/modules/sample-chopper/src/ui/components/WaveformEditor.tsx`

This component significantly exceeds the 300-500 line guideline. The file handles multiple responsibilities:
- Canvas rendering logic (lines 256-463)
- Mouse event handling (lines 466-616)
- Hit testing logic (lines 187-214)
- Zoom management (lines 217-253)

**Recommendation:** Extract into multiple modules:
- `WaveformCanvas.tsx` - Pure canvas rendering
- `useWaveformInteraction.ts` - Mouse/keyboard event handling
- `useWaveformZoom.ts` - Zoom state and calculations
- `waveform-utils.ts` - Hit testing, time calculations

**SampleChopperDialog.tsx (793 lines)**
File: `/modules/sample-chopper/src/ui/components/SampleChopperDialog.tsx`

Also exceeds guidelines significantly with multiple concerns:
- Hook orchestration (lines 120-256)
- Keyboard event handling (lines 322-415)
- Complex JSX structure (lines 419-793)

**Recommendation:** Decompose into:
- `useSampleChopperState.ts` - Orchestrate all state hooks
- `useChopperKeyboardShortcuts.ts` - Keyboard handling
- `SampleChopperHeader.tsx`, `SampleChopperContent.tsx`, `SampleChopperFooter.tsx`

#### 2. Circular Dependency Risk in Trigger Hooks

File: `/modules/sample-chopper/src/ui/components/SampleChopperDialog.tsx:145-169`

```typescript
const recorderRef = useRef<{ triggerToSliceIndex: Map<string, number>; recordedSlices: ... }>({
  triggerToSliceIndex: new Map(),
  recordedSlices: [],
});

const recorder = useTriggerRecorder({
  ...
  onRetrigger: useCallback((triggerId: string) => {
    const { triggerToSliceIndex, recordedSlices } = recorderRef.current;
    // Uses recorderRef which is updated after this callback is defined
  }, [play]),
});

recorderRef.current = recorder;  // Ref updated after recorder created
```

This pattern creates a subtle timing dependency where `onRetrigger` reads from `recorderRef` which is populated after the callback is created. While currently functional, this is fragile and hard to reason about.

**Recommendation:** Refactor to pass current state explicitly or use a more explicit state machine pattern.

---

### Medium Priority Issues

#### 3. useSampleChopper Hook Complexity (427 lines)

File: `/modules/sample-chopper/src/ui/hooks/useSampleChopper.ts`

This hook manages too many concerns:
- Zoom state
- Slice state
- History management
- Strip silence state
- Multiple detection method configurations

Line 77-78 has a suppressed ESLint rule:
```typescript
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useSampleChopper({
```

**Recommendation:**
1. Add explicit return type
2. Extract into smaller, composable hooks:
   - `useSliceZoom()` - Zoom state management
   - `useSliceMethodConfig()` - Method-specific configuration
   - `useSliceManipulation()` - Add/delete/modify operations

#### 4. Canvas Re-render Performance

File: `/modules/sample-chopper/src/ui/components/WaveformEditor.tsx:256-463`

The `useEffect` for canvas rendering has 14 dependencies and performs full canvas redraws on every change:

```typescript
}, [samples, sampleRate, sliceMarkers, selectedSlice, zoomedWidth, height,
    showTimeLabels, editable, hoverState, dragState, zoom, joinedEdges, playbackPosition]);
```

With large audio files and frequent playback position updates, this could cause performance issues.

**Recommendation:**
1. Separate waveform drawing (expensive, changes rarely) from overlay drawing (markers, playhead)
2. Consider using multiple canvas layers or offscreen canvas for static content
3. Implement dirty region tracking for partial redraws

#### 5. SliceMethodPanel File Size (487 lines)

File: `/modules/sample-chopper/src/ui/components/SliceMethodPanel.tsx`

Approaching the upper limit of the guideline. Contains multiple internal components:
- `AutoMapPanel` (lines 56-169)
- `SliceMethodPanel` (lines 201-486)

**Recommendation:** Extract `AutoMapPanel` to its own file.

#### 6. Missing Error Boundaries

The audio playback hooks (`useAudioPreview`, `useTriggerPlayback`) catch errors but don't provide recovery mechanisms:

File: `/modules/sample-chopper/src/ui/hooks/useAudioPreview.ts:153-155`
```typescript
} catch (err) {
  setError(err instanceof Error ? err.message : 'Playback failed');
  setIsPlaying(false);
}
```

**Recommendation:** Add retry logic and more detailed error states to help users recover from transient Web Audio failures.

---

### Low Priority Issues

#### 7. Duplicated IGNORED_KEYS Constant

The same set of ignored keys is defined in three places:
- `/modules/sample-chopper/src/ui/hooks/useTriggerInput.ts:55-59`
- `/modules/sample-chopper/src/ui/hooks/useTriggerPlaybackListeners.ts:19-23`
- `/modules/sample-chopper/src/ui/hooks/useMidiLearn.ts:34-40`

**Recommendation:** Extract to a shared constants file in `@/ui/constants.ts`.

#### 8. Magic Numbers in Algorithm Code

File: `/modules/sample-chopper/src/transient-detector.ts:50-52`
```typescript
const windowSizeMs = 10; // 10ms analysis window
const hopSizeSamples = msToSamples(5, sampleRate); // 5ms hop for smoother detection
```

File: `/modules/sample-chopper/src/silence-detector.ts:47-48`
```typescript
const windowSizeSamples = msToSamples(10, sampleRate); // 10ms analysis window
```

**Recommendation:** Extract these into configurable algorithm parameters or named constants at module level.

#### 9. Console.warn in Library Code

File: `/modules/sample-chopper/src/manual-slicer.ts:114-116`
```typescript
console.warn(
  `Warning: ${currLabel} (${curr.start}ms) overlaps with ${prevLabel} (ends at ${prev.end}ms)`
);
```

**Recommendation:** Replace with a callback or event emission pattern to allow consumers to handle warnings appropriately.

#### 10. Unused Variable in Canvas Rendering

File: `/modules/sample-chopper/src/ui/components/WaveformEditor.tsx:315-316`
```typescript
const startHovered = hoverState?.sliceIndex === i && hoverState?.edge === 'start';
const startIsJoined = i > 0 && joinedBoundaries.has(i - 1);
```

`startIsJoined` is calculated but only used conditionally in editable mode, yet it's computed for every slice on every render.

**Recommendation:** Move joined boundary calculation inside the editable block.

---

## Architecture Assessment

### Algorithm Layer Separation: Excellent

The algorithm layer (`src/*.ts`) is cleanly separated from UI concerns:

```
src/
  audio-utils.ts     - Pure utility functions
  transient-detector.ts - Transient-based slicing
  silence-detector.ts   - Silence-based slicing
  fixed-slicer.ts      - Fixed interval slicing
  manual-slicer.ts     - Manual region slicing
  chopper.ts           - Orchestrator
  types.ts             - Type definitions
```

All functions are pure, well-typed, and testable. The discriminated union pattern for `SliceConfig` is well-designed:

```typescript
export type SliceConfig =
  | TransientConfig
  | SilenceConfig
  | FixedConfig
  | ManualConfig;
```

### Hook Composition: Good with Complexity Concerns

The trigger system demonstrates good composition:

```
useTriggerInput        - State machine + event capture
useTriggerRecorder     - Recording workflow orchestration
useTriggerMappings     - Mapping layer management
useTriggerPlayback     - Voice engine delegation
useTriggerPlaybackListeners - Event binding
useMidiLearn           - MIDI learn mode
```

However, the composition in `SampleChopperDialog` creates deep interdependencies that are difficult to trace. Consider using a more explicit state machine library (xstate) for the trigger workflow.

### Type Safety: Strong

Good use of TypeScript features:
- Discriminated unions for configurations
- Proper interface exports
- Generic hook patterns
- Explicit type annotations (with a few exceptions)

---

## Trigger Architecture Deep Dive

### useTriggerRecorder

File: `/modules/sample-chopper/src/ui/hooks/useTriggerRecorder.ts`

**Strengths:**
- Clean delegation to `useTriggerInput`
- Proper handling of retrigger scenarios
- Good use of refs for avoiding stale closures

**Issues:**
- The `preventAutoCompleteRef` pattern is clever but obscure
- Lines 78-98 contain complex logic that would benefit from comments explaining the retrigger flow

### useTriggerMappings

File: `/modules/sample-chopper/src/ui/hooks/useTriggerMappings.ts`

**Strengths:**
- Clear three-layer merge strategy documented in comments
- Clean separation of learned vs recorded vs restored mappings
- Proper immutable state updates

**No significant issues.**

### useTriggerPlaybackListeners

File: `/modules/sample-chopper/src/ui/hooks/useTriggerPlaybackListeners.ts`

**Strengths:**
- Uses refs pattern to avoid recreating event listeners
- Proper cleanup on unmount
- Handles both keyboard and MIDI sources

**Issues:**
- The pattern of updating refs on every render (lines 64-71) is unusual and could be simplified
- No debouncing for rapid key repeats (keyboard repeat is filtered, but MIDI flooding isn't)

---

## Performance Considerations

### Web Audio Usage: Good

- Proper AudioContext lifecycle management
- Cleanup on unmount
- Context resume handling for autoplay policies

### Real-time Concerns

1. **Canvas Rendering:** Full redraws during playback could cause jank on slower devices
2. **MIDI Processing:** Event handlers are synchronous, which is correct for low-latency
3. **Memory:** Int16Array slicing creates copies; for large files, consider views

---

## Test Coverage Assessment

Tests exist for core algorithms:
- `audio-utils.test.ts`
- `transient-detector.test.ts`
- `silence-detector.test.ts`
- `fixed-slicer.test.ts`
- `manual-slicer.test.ts`
- `chopper.test.ts`

**Missing:** UI hook tests. Consider adding:
- `useSampleChopper.test.ts` - State management logic
- `useTriggerRecorder.test.ts` - Recording workflow
- `useSliceHistory.test.ts` - Undo/redo behavior

---

## Refactoring Priorities

### Priority 1: File Size Reduction
1. Extract `WaveformEditor.tsx` into multiple modules
2. Extract `SampleChopperDialog.tsx` into smaller components
3. Extract `useSampleChopper.ts` into composable hooks

### Priority 2: Performance
1. Implement layered canvas rendering for `WaveformEditor`
2. Add dirty region tracking for partial redraws

### Priority 3: Code Quality
1. Add explicit return types to all exported functions
2. Extract shared constants (IGNORED_KEYS, magic numbers)
3. Replace console.warn with proper event handling

### Priority 4: Testability
1. Add unit tests for UI hooks
2. Consider dependency injection for MIDI/Audio contexts in tests

---

## File Reference Summary

| File | Lines | Status | Action Required |
|------|-------|--------|-----------------|
| `WaveformEditor.tsx` | 805 | Exceeds limit | Refactor into multiple files |
| `SampleChopperDialog.tsx` | 793 | Exceeds limit | Refactor into multiple files |
| `SliceMethodPanel.tsx` | 487 | Near limit | Extract AutoMapPanel |
| `useSampleChopper.ts` | 427 | Near limit | Extract sub-hooks |
| `transient-detector.ts` | 239 | OK | Minor improvements |
| `silence-detector.ts` | 194 | OK | Minor improvements |
| `audio-utils.ts` | 202 | OK | Well-structured |
| `useTriggerInput.ts` | 185 | OK | Good |
| `useTriggerPlaybackListeners.ts` | 181 | OK | Good |
| `useTriggerRecorder.ts` | 167 | OK | Good |
| `useTriggerMappings.ts` | 155 | OK | Good |
| `useSliceHistory.ts` | 144 | OK | Good |
| `useMidiLearn.ts` | 144 | OK | Good |
| `useAudioPreview.ts` | 185 | OK | Good |
| `useTriggerPlayback.ts` | 80 | OK | Good |
| `types.ts` | 133 | OK | Well-designed |
| `chopper.ts` | 105 | OK | Clean orchestration |
| `manual-slicer.ts` | 194 | OK | Good |
| `fixed-slicer.ts` | 85 | OK | Good |
| `SliceList.tsx` | 191 | OK | Good |
| `TriggerMethodContent.tsx` | 260 | OK | Good |
| `ChangeHistory.tsx` | 77 | OK | Good |

---

## Conclusion

The sample-chopper module is well-architected with clean separation of concerns. The main areas requiring attention are file sizes and hook complexity. The trigger system architecture, while functional, could benefit from simplification or better documentation of the state flow. Audio processing code is solid with good type safety. Addressing the high-priority file size issues would significantly improve maintainability.
