/**
 * Slice List Component
 *
 * Displays a scrollable list of manual slices with play, select, and delete controls.
 */

import type { ReactNode } from 'react';
import { cn } from '@/ui/utils.js';
import type { SliceDefinitionOutput } from '@/ui/hooks/useSampleChopper.js';

export interface SliceListProps {
  slices: SliceDefinitionOutput[];
  selectedSlice?: number;
  sampleRate: number;
  isPlaying: boolean;
  onSliceSelect: (index: number) => void;
  onSlicePlay: (index: number) => void;
  onSliceDelete: (index: number) => void;
}

export function SliceList({
  slices,
  selectedSlice,
  sampleRate,
  isPlaying,
  onSliceSelect,
  onSlicePlay,
  onSliceDelete,
}: SliceListProps): JSX.Element {
  if (slices.length === 0) {
    return (
      <div className="text-sm text-ac-muted text-center py-4">
        Click on the waveform to add slice points
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
        </div>
      ))}
    </div>
  );
}
