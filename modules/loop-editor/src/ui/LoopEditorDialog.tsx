/**
 * LoopEditorDialog — modal wrapper around the LoopEditor component.
 *
 * Opens a full-screen dialog for editing loop points on library samples.
 * Delegates loop state, detection, audio preview, and playback to
 * the shared useLoopEditor hook. Keyboard input is built into the hook;
 * MIDI input can be passed via the noteInput prop.
 */

import { useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { LoopEditor } from '@/ui/LoopEditor';
import { useLoopEditor } from '@/ui/hooks/use-loop-editor';
import type { NoteInput } from '@audiocontrol/synth-core';

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
  /** Root key (MIDI note) for pitched playback — default 60 (C4). */
  rootKey?: number;
  /** Optional external MIDI input — keyboard input is always built in. */
  noteInput?: NoteInput | null;
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
  rootKey = 60,
  noteInput,
}: LoopEditorDialogProps): JSX.Element {
  const editor = useLoopEditor({
    samples,
    sampleRate,
    initialLoopStart,
    initialLoopEnd,
    rootKey,
    noteInput,
  });

  const handleSave = useCallback(() => {
    onSave?.(editor.loopPoint, editor.endPoint);
    onOpenChange(false);
  }, [editor.loopPoint, editor.endPoint, onSave, onOpenChange]);

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
              {editor.activeNotes.size > 0 && (
                <span className="text-xs text-s330-muted px-2">
                  MIDI: {editor.activeNotes.size} {editor.activeNotes.size === 1 ? 'voice' : 'voices'}
                </span>
              )}
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
              loopPoint={editor.loopPoint}
              endPoint={editor.endPoint}
              onLoopPointChange={editor.setLoopPoint}
              onEndPointChange={editor.setEndPoint}
              candidates={editor.candidates}
              selectedCandidateIndex={editor.selectedCandidateIndex}
              onCandidateSelect={editor.setSelectedCandidateIndex}
              onApplyCandidate={editor.handleApplyCandidate}
              onAutoDetect={editor.handleAutoDetect}
              isSearching={editor.isSearching}
              searchProgress={editor.searchProgress}
              audio={editor.audio}
              playbackMode={editor.playbackMode}
              onPlaybackModeChange={editor.setPlaybackMode}
              discontinuity={editor.discontinuity}
              crossfadeLength={editor.crossfadeLength}
              onCrossfadeLengthChange={editor.setCrossfadeLength}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
