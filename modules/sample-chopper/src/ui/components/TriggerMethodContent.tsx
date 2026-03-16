/**
 * Trigger Method Content
 *
 * UI for the Trigger tab in the sample chopper dialog.
 * Shows different content based on the trigger state machine state:
 * idle, armed, recording, or complete.
 */

import { cn } from '@/ui/utils.js';
import type { TriggerState } from '@/ui/hooks/useTriggerInput.js';

export interface TriggerMethodContentProps {
  state: TriggerState;
  midiAvailable: boolean;
  triggerCount: number;
  onArm: () => void;
  onStop: () => void;
  onReset: () => void;
  onEditManually: () => void;
}

export function TriggerMethodContent({
  state,
  midiAvailable,
  triggerCount,
  onArm,
  onStop,
  onReset,
  onEditManually,
}: TriggerMethodContentProps): JSX.Element {
  if (state === 'recording') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </span>
          <span className="text-sm text-ac-text font-medium">Recording triggers...</span>
        </div>
        <div className="text-xs text-ac-muted">
          Press any key or MIDI pad to mark slice points. {triggerCount} trigger{triggerCount !== 1 ? 's' : ''} captured.
        </div>
        <button
          onClick={onStop}
          className="px-3 py-1.5 text-xs rounded bg-red-600 hover:bg-red-500 text-white font-medium transition-colors"
        >
          Stop Recording
        </button>
      </div>
    );
  }

  if (state === 'armed') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500" />
          </span>
          <span className="text-sm text-ac-text font-medium">Armed — press any key to start</span>
        </div>
        <p className="text-xs text-ac-muted">
          Press any key or MIDI pad to begin playback and mark your first slice point.
        </p>
        <button
          onClick={onReset}
          className="px-3 py-1.5 text-xs rounded bg-ac-bg hover:bg-ac-accent/50 text-ac-muted transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (state === 'complete') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ac-text">
          {triggerCount} trigger{triggerCount !== 1 ? 's' : ''} captured — {triggerCount} slice{triggerCount !== 1 ? 's' : ''} created.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onReset}
            className="px-3 py-1.5 text-xs rounded bg-ac-bg hover:bg-ac-accent/50 text-ac-muted transition-colors"
          >
            Record Again
          </button>
          <button
            onClick={onEditManually}
            className="px-3 py-1.5 text-xs rounded bg-ac-highlight hover:bg-ac-highlight/80 text-white font-medium transition-colors"
          >
            Edit Manually
          </button>
        </div>
      </div>
    );
  }

  // idle state
  return (
    <div className="space-y-3">
      <p className="text-xs text-ac-muted">
        Play back audio and mark slice points in real time by pressing any key or MIDI pad.
        Each keypress marks a slice boundary at the current playback position.
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={onArm}
          className="px-3 py-1.5 text-xs rounded bg-ac-highlight hover:bg-ac-highlight/80 text-white font-medium transition-colors"
        >
          Arm
        </button>
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs',
            midiAvailable
              ? 'bg-green-900/30 text-green-400'
              : 'bg-ac-bg text-ac-muted'
          )}
        >
          <span className={cn(
            'inline-block w-1.5 h-1.5 rounded-full',
            midiAvailable ? 'bg-green-400' : 'bg-ac-muted'
          )} />
          {midiAvailable ? 'MIDI connected' : 'No MIDI (keyboard only)'}
        </span>
      </div>
    </div>
  );
}
