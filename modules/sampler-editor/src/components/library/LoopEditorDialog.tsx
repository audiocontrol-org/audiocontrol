/**
 * LoopEditorDialog — modal wrapper around the LoopEditor component.
 *
 * Opens a full-screen dialog for editing loop points on library samples.
 * Manages loop state, auto-detection, and save-back to library.
 */

import { useState, useCallback, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { LoopEditor, useLoopDetection } from '@audiocontrol/loop-editor/ui';
import { createBrowserAudioPlayback } from '@audiocontrol/editor-core';

// =========================================================================
// Types
// =========================================================================

export interface LoopEditorDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Called when dialog open state changes. */
  onOpenChange: (open: boolean) => void;
  /** Audio samples (16-bit signed integers). */
  samples: Int16Array | null;
  /** Sample rate in Hz. */
  sampleRate: number;
  /** Display name for the sample. */
  sampleName: string;
  /** Initial loop start point. */
  loopStart?: number;
  /** Initial loop end point. */
  loopEnd?: number;
  /** Called when the user saves loop points. */
  onSave?: (loopStart: number, loopEnd: number) => void;
}

// =========================================================================
// Component
// =========================================================================

export function LoopEditorDialog({
  open,
  onOpenChange,
  samples,
  sampleRate,
  sampleName,
  loopStart: initialLoopStart,
  loopEnd: initialLoopEnd,
  onSave,
}: LoopEditorDialogProps): JSX.Element {
  const [loopPoint, setLoopPoint] = useState(initialLoopStart ?? 0);
  const [endPoint, setEndPoint] = useState(initialLoopEnd ?? (samples?.length ?? 0));
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState<number | undefined>(undefined);

  // Reset state when dialog opens with new data
  const [prevSamples, setPrevSamples] = useState<Int16Array | null>(null);
  if (samples !== prevSamples) {
    setPrevSamples(samples);
    setLoopPoint(initialLoopStart ?? 0);
    setEndPoint(initialLoopEnd ?? (samples?.length ?? 0));
    setSelectedCandidateIndex(undefined);
  }

  const audio = useMemo(() => createBrowserAudioPlayback(), []);

  const {
    isSearching,
    progress,
    candidates,
    searchLoopPoints,
    clearResults,
  } = useLoopDetection();

  const handleAutoDetect = useCallback(() => {
    if (!samples) return;
    clearResults();
    setSelectedCandidateIndex(undefined);
    searchLoopPoints(new Int16Array(samples), sampleRate, endPoint);
  }, [samples, sampleRate, endPoint, clearResults, searchLoopPoints]);

  const handleApplyCandidate = useCallback((loopStart: number, loopEnd: number) => {
    setLoopPoint(loopStart);
    setEndPoint(loopEnd);
  }, []);

  const handleSave = useCallback(() => {
    onSave?.(loopPoint, endPoint);
    onOpenChange(false);
  }, [loopPoint, endPoint, onSave, onOpenChange]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed z-50 inset-4 bg-s330-panel border border-s330-accent rounded-lg shadow-xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-s330-accent shrink-0">
            <div>
              <Dialog.Title className="text-lg font-bold text-s330-text">
                Loop Editor
              </Dialog.Title>
              <Dialog.Description className="text-sm text-s330-muted">
                {sampleName} — {sampleRate} Hz
              </Dialog.Description>
            </div>
            <div className="flex items-center gap-2">
              {onSave && (
                <button
                  onClick={handleSave}
                  className="ac-btn ac-btn-sm ac-btn-primary"
                >
                  Save Loop Points
                </button>
              )}
              <Dialog.Close className="p-2 text-s330-muted hover:text-s330-text transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Dialog.Close>
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1 overflow-auto p-4">
            <LoopEditor
              samples={samples}
              sampleRate={sampleRate}
              startPoint={0}
              loopPoint={loopPoint}
              endPoint={endPoint}
              onLoopPointChange={setLoopPoint}
              onEndPointChange={setEndPoint}
              candidates={candidates}
              selectedCandidateIndex={selectedCandidateIndex}
              onCandidateSelect={setSelectedCandidateIndex}
              onApplyCandidate={handleApplyCandidate}
              onAutoDetect={handleAutoDetect}
              isSearching={isSearching}
              searchProgress={progress}
              audio={audio}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
