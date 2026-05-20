/**
 * Loop-editor auto-detect candidates list — lean clickable rows.
 *
 * Each row applies its candidate's loop bounds when clicked. The selected
 * row carries `data-selected="true"` so the v3 selected state in
 * `loop-editor-primitives.css` highlights it with the accent color.
 */

import type { LoopCandidate } from '@audiocontrol/sampler-library';

export interface LoopEditorCandidatesProps {
  candidates: LoopCandidate[];
  selectedCandidateIndex?: number;
  onCandidateSelect?: (index: number) => void;
  onApplyCandidate?: (loopStart: number, loopEnd: number) => void;
  onLoopPointChange?: (next: number) => void;
  onEndPointChange?: (next: number) => void;
  onCommit?: () => void;
}

export function LoopEditorCandidates({
  candidates,
  selectedCandidateIndex,
  onCandidateSelect,
  onApplyCandidate,
  onLoopPointChange,
  onEndPointChange,
  onCommit,
}: LoopEditorCandidatesProps): JSX.Element | null {
  if (candidates.length === 0) return null;
  return (
    <div className="ac-loop-candidates">
      <div className="ac-loop-candidates__head">
        <span>Loop Candidates ({candidates.length})</span>
        <span>Click to apply · Score: NCC / Spectral / Slope</span>
      </div>
      <div className="ac-loop-candidates__list">
        {candidates.map((candidate, index) => (
          <button
            key={`${candidate.loopStart}-${candidate.loopEnd}`}
            onClick={() => {
              onCandidateSelect?.(index);
              if (onApplyCandidate) {
                onApplyCandidate(candidate.loopStart, candidate.loopEnd);
              } else {
                onLoopPointChange?.(candidate.loopStart);
                onEndPointChange?.(candidate.loopEnd);
              }
              onCommit?.();
            }}
            className="ac-loop-candidate"
            data-selected={index === selectedCandidateIndex ? 'true' : 'false'}
          >
            <span className="ac-loop-candidate__bounds">
              <span className="ac-loop-candidate__id">{index + 1}</span>
              <span>{candidate.loopStart} → {candidate.loopEnd}</span>
              <span className="ac-loop-candidate__bounds-length">({candidate.loopEnd - candidate.loopStart} samples)</span>
            </span>
            <span className="ac-loop-candidate__scores">
              {(candidate.nccScore * 100).toFixed(0)}% /
              {' '}{(candidate.spectralScore * 100).toFixed(0)}% /
              {' '}{(candidate.slopeScore * 100).toFixed(0)}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
