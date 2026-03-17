/**
 * Slice List Component
 *
 * Displays a scrollable list of slices with play and select controls.
 * In editable mode, also shows delete controls.
 */

import { cn } from '@/ui/utils.js';
import type { SliceDefinitionOutput } from '@/ui/hooks/useSampleChopper.js';
import type { TriggerMapping } from '@/ui/hooks/useTriggerRecording.js';
import { triggerDisplayName } from '@/ui/hooks/useMidiLearn.js';

export interface SliceListProps {
  slices: SliceDefinitionOutput[];
  selectedSlice?: number;
  sampleRate: number;
  isPlaying: boolean;
  onSliceSelect: (index: number) => void;
  onSlicePlay: (index: number) => void;
  onSliceDelete?: (index: number) => void;
  /** Show delete buttons and edit-mode empty state */
  editable?: boolean;
  /** Current trigger assignments for display */
  triggerAssignments?: TriggerMapping[];
  /** Which slice index is currently in learn mode */
  learningSliceIndex?: number | null;
  /** Start MIDI learn for a slice */
  onStartLearn?: (sliceIndex: number) => void;
  /** Cancel MIDI learn */
  onCancelLearn?: () => void;
  /** Clear trigger assignment for a slice */
  onClearTrigger?: (sliceIndex: number) => void;
}

function TriggerControls({
  sliceIndex,
  triggerAssignments,
  learningSliceIndex,
  onStartLearn,
  onCancelLearn,
  onClearTrigger,
}: {
  sliceIndex: number;
  triggerAssignments: TriggerMapping[];
  learningSliceIndex: number | null;
  onStartLearn: (sliceIndex: number) => void;
  onCancelLearn?: () => void;
  onClearTrigger?: (sliceIndex: number) => void;
}): JSX.Element {
  const assignment = triggerAssignments.find((t) => t.sliceIndex === sliceIndex);
  const isLearning = learningSliceIndex === sliceIndex;

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {assignment && (
        <span className="font-mono text-[10px] bg-ac-accent/30 text-ac-text px-1.5 py-0.5 rounded">
          {triggerDisplayName(assignment.triggerId)}
        </span>
      )}
      <button
        onClick={() => isLearning ? onCancelLearn?.() : onStartLearn(sliceIndex)}
        className={cn(
          'px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors',
          isLearning
            ? 'bg-yellow-500/30 text-yellow-300 animate-pulse'
            : 'bg-ac-bg text-ac-muted hover:text-ac-text'
        )}
        title={isLearning ? 'Cancel learn' : 'Learn trigger: press a MIDI pad or key'}
      >
        {isLearning ? '...' : 'Learn'}
      </button>
      {assignment && onClearTrigger && (
        <button
          onClick={() => onClearTrigger(sliceIndex)}
          className="text-red-400 hover:text-red-300 text-[10px] px-0.5"
          title="Clear trigger assignment"
        >
          ×
        </button>
      )}
    </div>
  );
}

export function SliceList({
  slices,
  selectedSlice,
  sampleRate,
  isPlaying,
  onSliceSelect,
  onSlicePlay,
  onSliceDelete,
  editable = false,
  triggerAssignments,
  learningSliceIndex,
  onStartLearn,
  onCancelLearn,
  onClearTrigger,
}: SliceListProps): JSX.Element {
  if (slices.length === 0) {
    if (editable) {
      return (
        <div className="text-sm text-ac-muted text-center py-4">
          Click on the waveform to add slice points
        </div>
      );
    }
    return (
      <div className="text-sm text-ac-muted text-center py-4">
        No slices detected
      </div>
    );
  }

  return (
    <div className="bg-ac-bg rounded p-3 space-y-2 max-h-32 overflow-y-auto">
      <div className="text-xs text-ac-muted uppercase tracking-wide mb-2">
        Slices ({slices.length})
      </div>
      {slices.map((slice, i) => (
        <div
          key={i}
          className={cn(
            'flex items-center gap-2 text-xs py-1 px-2 rounded cursor-pointer',
            selectedSlice === i
              ? 'bg-ac-highlight/20 text-ac-text'
              : 'hover:bg-ac-accent/20 text-ac-muted'
          )}
          onClick={() => onSliceSelect(i)}
        >
          {/* Play button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSlicePlay(i);
            }}
            className={cn(
              'p-0.5 rounded transition-colors',
              isPlaying && selectedSlice === i
                ? 'text-red-400 hover:text-red-300'
                : 'text-ac-muted hover:text-ac-text'
            )}
            title={isPlaying && selectedSlice === i ? 'Stop' : 'Play slice'}
          >
            {isPlaying && selectedSlice === i ? (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <span className="font-medium flex-1">{slice.label}</span>
          <span className="text-ac-muted">
            {((slice.endSample - slice.startSample) / sampleRate * 1000).toFixed(0)}ms
          </span>
          {triggerAssignments && onStartLearn && (
            <TriggerControls
              sliceIndex={i}
              triggerAssignments={triggerAssignments}
              learningSliceIndex={learningSliceIndex ?? null}
              onStartLearn={onStartLearn}
              onCancelLearn={onCancelLearn}
              onClearTrigger={onClearTrigger}
            />
          )}
          {editable && onSliceDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSliceDelete(i);
              }}
              disabled={slices.length <= 1}
              className={cn(
                'text-red-400 hover:text-red-300 px-1',
                slices.length <= 1 && 'opacity-30 cursor-not-allowed'
              )}
              title="Delete slice"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
