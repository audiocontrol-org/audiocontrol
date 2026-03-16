# Trigger Chopping - Workplan

**GitHub Milestone:** TBD
**GitHub Issues:** TBD

## Technical Approach

Add a "Trigger" slice method to the sample chopper dialog. The trigger mode plays back audio and captures slice boundaries in real time from keyboard and MIDI events. It produces the same `SliceDefinitionOutput[]` as manual mode — no new algorithm types needed.

**Key design decisions:**

1. **New tab, not sub-mode** — Trigger has distinct UI states (idle/armed/recording/complete) that don't fit as a manual sub-mode
2. **Two hooks** — `useTriggerInput` (raw capture) + `useTriggerRecording` (slice logic), separated for testability
3. **Keyboard-first, MIDI optional** — No dependency on shared-midi or external stores
4. **No new SliceConfig type** — Trigger is a UI workflow producing manual slices

## New Files

| File | Purpose |
|------|---------|
| `src/ui/hooks/useTriggerInput.ts` | Keyboard + MIDI event capture, state machine |
| `src/ui/hooks/useTriggerRecording.ts` | Composes trigger input with slice generation |
| `src/ui/components/TriggerMethodContent.tsx` | UI for Trigger tab states |

## Modified Files

| File | Change |
|------|--------|
| `src/ui/hooks/useAudioPreview.ts` | Add `playbackPositionRef` for low-latency position reads |
| `src/ui/hooks/useSampleChopper.ts` | Add `'trigger'` to `SliceMethodTab`, expose `setManualSlices` |
| `src/ui/components/SliceMethodPanel.tsx` | Add Trigger tab |
| `src/ui/components/SampleChopperDialog.tsx` | Instantiate trigger hooks, yield keyboard during recording |
| `src/ui/index.ts` | Export new hooks and component |

## Implementation Phases

### Phase 1: Low-Latency Position Tracking

Add `playbackPositionRef` to `useAudioPreview` — a ref updated alongside state in `requestAnimationFrame`. The trigger system reads this for sample-accurate positions.

### Phase 2: Extend Slice Method Types

Add `'trigger'` to `SliceMethodTab`. In `useSampleChopper`: treat trigger like manual for `sliceConfig`, `currentSliceResult`, and `sliceMarkers`. Expose `setManualSlices` in return value.

### Phase 3: Trigger Input Hook

Create `useTriggerInput` with state machine (idle → armed → recording → complete). Captures keyboard `keydown` events (ignoring modifiers/repeats/input elements) and MIDI Note On messages. Fires `onTrigger(samplePosition)` for each event.

### Phase 4: Trigger Recording Hook

Create `useTriggerRecording` composing `useTriggerInput`. Maintains trigger positions array, derives `recordedSlices` by sorting positions and creating adjacent slices `[0, pos1], [pos1, pos2], ..., [posN, total]`.

### Phase 5: Trigger Tab UI

Create `TriggerMethodContent` component with three visual states:
- **Idle:** Instructions + Arm button + MIDI badge
- **Recording:** Red indicator, trigger count, Stop button
- **Complete:** Summary, Record Again + Edit Manually buttons

Integrate into `SliceMethodPanel` as new tab.

### Phase 6: Dialog Integration

In `SampleChopperDialog`:
- Instantiate `useTriggerRecording`
- On complete: inject `recordedSlices` into `chopper.setManualSlices`
- In `handleDialogKeyDown`: yield to trigger system when recording

### Phase 7: Verification

Build, test, and manual verification via dev harness.

## Verification

- `pnpm --filter sample-chopper build` succeeds
- `pnpm --filter sample-chopper test` passes
- Dev harness: load WAV, select Trigger tab, arm, press keys to chop
- Slices appear on waveform in real time during recording
- Switching Trigger → Manual preserves slices
- MIDI triggers work when controller connected, graceful degradation when not
- All existing modes unchanged
