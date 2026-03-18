# Trigger Architecture Simplification - Workplan

**GitHub Milestone:** TBD
**GitHub Issues:** TBD

## Technical Approach

Decompose the monolithic `useTriggerRecording` hook into three focused hooks with unidirectional data flow. The single source of truth for slices (`chopper.manualSlices`) stays unchanged. The new hooks form a DAG with no circular dependencies.

### Before: One hook, four jobs, circular refs

```
useTriggerRecording (recording + mappings + config + playback listeners)
    ↕ circular refs via triggerPlaybackRef, triggerRef
useTriggerPlayback (voice engine)
```

### After: Three hooks, one job each, no cycles

```
useSampleChopper ─── manualSlices (source of truth)
    │
    ├──▸ useTriggerMappings (triggerId→sliceIndex + playback config)
    ├──▸ useTriggerRecorder (recording workflow only)
    ├──▸ useTriggerPlayback (voice engine, unchanged)
    └──▸ useTriggerPlaybackListeners (keyboard/MIDI → playSlice)
```

## New Files

| File | Purpose | ~Lines |
|------|---------|--------|
| `src/ui/hooks/useTriggerMappings.ts` | Trigger-to-slice mapping management + playback config | ~100 |
| `src/ui/hooks/useTriggerRecorder.ts` | Recording workflow only (wraps useTriggerInput) | ~100 |
| `src/ui/hooks/useTriggerPlaybackListeners.ts` | Keyboard/MIDI event listeners for slice playback | ~100 |

## Deleted Files

| File | Replaced By |
|------|-------------|
| `src/ui/hooks/useTriggerRecording.ts` | The three new hooks above |

## Modified Files

| File | Change |
|------|--------|
| `src/ui/components/SampleChopperDialog.tsx` | Replace `useTriggerRecording` with three new hooks, remove circular refs |
| `src/ui/components/TriggerMethodContent.tsx` | Remove dead `onEditManually` prop |
| `src/ui/index.ts` | Update exports |

## Unchanged Files

| File | Why |
|------|-----|
| `src/ui/hooks/useTriggerInput.ts` | Clean state machine, no changes needed |
| `src/ui/hooks/useTriggerPlayback.ts` | Clean voice engine, no changes needed |
| `src/ui/hooks/useMidiLearn.ts` | Clean learn state, no changes needed |
| `src/ui/hooks/useSampleChopper.ts` | Source of truth for slices, no changes needed |
| `src/ui/hooks/useSliceHistory.ts` | Undo/redo journal, no changes needed |
| `src/ui/components/SliceList.tsx` | No changes needed |
| `src/ui/components/SliceMethodPanel.tsx` | triggerProps sourcing changes but interface stays the same |

## Implementation Phases

### Phase 1: Create `useTriggerMappings`

Extract from `useTriggerRecording`:
- `restoredMapping` memo (from `initialTriggers`)
- `learnedMappings` state + `learnTrigger` / `clearLearnedTrigger` / `clearAllLearnedTriggers`
- `effectiveMapping` merge logic (restored ← recorded ← learned)
- `triggerMappings` serialization memo
- `playbackConfig` state + `setPolyphony` / `setPlaybackMode` / `setMuteGroup`
- `reset()` that clears learned mappings and config

New: `recordedMappings` state with `setRecordedMappings()` setter (replaces the internal `triggerToSliceIndex` that was computed inline).

### Phase 2: Create `useTriggerPlaybackListeners`

Extract from `useTriggerRecording`:
- Keyboard `keydown`/`keyup` useEffect (lines 277-316)
- MIDI `midimessage` useEffect (lines 319-368)
- `firePlayback` / `fireStopPlayback` callbacks
- All associated refs (`effectiveMappingRef`, `effectiveSlicesRef`, `stateRef`, `playbackConfigRef`, `midiLearnActiveRef`)

Params: `effectiveMapping`, `slices`, `onPlaySlice`, `onStopSlice`, `playbackMode`, `midiLearnActive`, `recordingState`.

No return value — pure side effects.

### Phase 3: Create `useTriggerRecorder`

Extract from `useTriggerRecording`:
- `triggerEvents` state + `handleTrigger` callback
- `useTriggerInput` composition
- `recordedSlices` / `triggerToSliceIndex` memo (the REAL slice computation from trigger events)

Return: `state`, `midiAvailable`, `triggerCount`, `recordedSlices` (actual computed slices), `recordedMappings` (trigger→slice Map from recording), `arm`, `stopRecording`, `reset`.

Key fix: `recordedSlices` returns the actual computed slices, not a passthrough of input.

### Phase 4: Update `SampleChopperDialog`

Replace:
```typescript
const trigger = useTriggerRecording({ ... });
```

With:
```typescript
const mappings = useTriggerMappings({ initialTriggers, initialPlaybackConfig });
const recorder = useTriggerRecorder({ playbackPositionRef, isPlaying, onPlay, onStop, totalSamples, kitLabels });
const triggerPlayback = useTriggerPlayback({ samples, sampleRate, slices: chopper.manualSlices, config: mappings.playbackConfig });
useTriggerPlaybackListeners({ effectiveMapping: mappings.effectiveMapping, slices: chopper.manualSlices, onPlaySlice: ..., onStopSlice: ..., playbackMode: mappings.playbackConfig.playbackMode, midiLearnActive: midiLearnState.isLearning, recordingState: recorder.state });
```

Remove `triggerPlaybackRef` and `triggerRef` — no circular deps.

Fix injection effects:
- `recorder.recordedSlices` → `chopper.setManualSlices` (real slices from recording)
- `recorder.recordedMappings` → `mappings.setRecordedMappings` (on completion)

Update `triggerProps` to source from `recorder` (state, arm, stop, reset) and `mappings` (playbackConfig, config setters).

Update `onAutoMap` to call `mappings.learnTrigger`.

Update `useMidiLearn` to call `mappings.learnTrigger` directly (no ref indirection).

### Phase 5: Cleanup

- Delete `useTriggerRecording.ts`
- Remove `onEditManually` from `TriggerMethodContent` (dead no-op)
- Update `src/ui/index.ts` exports

## Verification

- `pnpm --filter sample-chopper build` succeeds
- `pnpm --filter sample-chopper test` passes
- `npx vite build --config dev/vite.config.ts` succeeds
- Load sample → add slice → auto-map → save → reload → new slice is present
- Arm → record triggers → slices appear in real time → complete → slices persist
- MIDI learn on individual slices works
- Auto-map assigns correct notes
- Mono mode: only one voice at a time
- Undo/redo works across all operations
- Strip silence tool works
- Transient and fixed detection modes produce slices
