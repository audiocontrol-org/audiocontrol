/**
 * Trigger Method Content
 *
 * UI for the Trigger tab in the sample chopper dialog.
 * Shows different content based on the trigger state machine state:
 * idle, armed, recording, or complete.
 * Includes playback configuration (polyphony, mode, mute groups).
 */

import { cn } from '@/ui/utils.js';
import type { TriggerState } from '@/ui/hooks/useTriggerInput.js';
import type {
  TriggerPlaybackConfig,
  PolyphonyMode,
  PlaybackMode,
} from '@/ui/hooks/useTriggerPlayback.js';
import type { SliceDefinitionOutput } from '@/ui/hooks/useSampleChopper.js';

export interface TriggerMethodContentProps {
  state: TriggerState;
  midiAvailable: boolean;
  triggerCount: number;
  onArm: () => void;
  onStop: () => void;
  onReset: () => void;
  playbackConfig: TriggerPlaybackConfig;
  onPolyphonyChange: (mode: PolyphonyMode) => void;
  onPlaybackModeChange: (mode: PlaybackMode) => void;
  onMuteGroupChange: (sliceIndex: number, group: number) => void;
  slices: SliceDefinitionOutput[];
  /** Audio output latency in milliseconds, null if not yet measured */
  latencyMs: number | null;
}

export function PlaybackControls({
  playbackConfig,
  onPolyphonyChange,
  onPlaybackModeChange,
  onMuteGroupChange,
  slices,
  latencyMs,
}: {
  playbackConfig: TriggerPlaybackConfig;
  onPolyphonyChange: (mode: PolyphonyMode) => void;
  onPlaybackModeChange: (mode: PlaybackMode) => void;
  onMuteGroupChange: (sliceIndex: number, group: number) => void;
  slices: SliceDefinitionOutput[];
  latencyMs: number | null;
}): JSX.Element {
  return (
    <div className="space-y-3 border-t border-ac-accent/30 pt-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-ac-muted uppercase tracking-wide">Playback</div>
        {latencyMs !== null && (
          <div className="text-xs text-ac-muted" title="Audio output latency (baseLatency + outputLatency)">
            {latencyMs}ms latency
          </div>
        )}
      </div>

      <div className="flex gap-4">
        {/* Polyphony toggle */}
        <div className="space-y-1">
          <div className="text-xs text-ac-muted">Voices</div>
          <div className="flex rounded overflow-hidden border border-ac-accent/50">
            {(['mono', 'poly'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onPolyphonyChange(mode)}
                className={cn(
                  'px-3 py-1 text-xs transition-colors',
                  playbackConfig.polyphony === mode
                    ? 'bg-ac-highlight text-white'
                    : 'bg-ac-bg text-ac-muted hover:text-ac-text'
                )}
              >
                {mode === 'mono' ? 'Mono' : 'Poly'}
              </button>
            ))}
          </div>
        </div>

        {/* Playback mode toggle */}
        <div className="space-y-1">
          <div className="text-xs text-ac-muted">Mode</div>
          <div className="flex rounded overflow-hidden border border-ac-accent/50">
            {(['one-shot', 'gate'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onPlaybackModeChange(mode)}
                className={cn(
                  'px-3 py-1 text-xs transition-colors',
                  playbackConfig.playbackMode === mode
                    ? 'bg-ac-highlight text-white'
                    : 'bg-ac-bg text-ac-muted hover:text-ac-text'
                )}
              >
                {mode === 'one-shot' ? 'One-Shot' : 'Gate'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mute groups — only shown in poly mode */}
      {playbackConfig.polyphony === 'poly' && slices.length > 1 && (
        <div className="space-y-1">
          <div className="text-xs text-ac-muted">
            Mute Groups
            <span className="ml-1 text-ac-muted/60">(slices in the same group choke each other)</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {slices.map((slice, i) => {
              const group = playbackConfig.muteGroups[i] ?? 0;
              return (
                <div key={i} className="flex items-center gap-1 bg-ac-bg rounded px-2 py-0.5">
                  <span className="text-xs text-ac-text truncate max-w-[4rem]" title={slice.label}>
                    {slice.label}
                  </span>
                  <select
                    value={group}
                    onChange={(e) => onMuteGroupChange(i, parseInt(e.target.value))}
                    className="bg-transparent text-xs text-ac-muted border-none outline-none cursor-pointer py-0"
                    title={`Mute group for ${slice.label}`}
                  >
                    <option value={0}>—</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((g) => (
                      <option key={g} value={g}>G{g}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function TriggerMethodContent({
  state,
  midiAvailable,
  triggerCount,
  onArm,
  onStop,
  onReset,
  playbackConfig,
  onPolyphonyChange,
  onPlaybackModeChange,
  onMuteGroupChange,
  slices,
  latencyMs,
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
          Press mapped keys to play slices.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onReset}
            className="px-3 py-1.5 text-xs rounded bg-ac-bg hover:bg-ac-accent/50 text-ac-muted transition-colors"
          >
            Record Again
          </button>
        </div>
        <PlaybackControls
          playbackConfig={playbackConfig}
          onPolyphonyChange={onPolyphonyChange}
          onPlaybackModeChange={onPlaybackModeChange}
          onMuteGroupChange={onMuteGroupChange}
          slices={slices}
          latencyMs={latencyMs}
        />
      </div>
    );
  }

  // idle state
  return (
    <div className="space-y-3">
      <p className="text-xs text-ac-muted">
        Arm to play back audio and mark slice points in real time by pressing any key or MIDI pad.
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
