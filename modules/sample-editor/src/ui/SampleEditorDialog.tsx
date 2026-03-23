/**
 * SampleEditorDialog — modal wrapper for the sample editor.
 *
 * Full-screen dialog for editing audio samples with trim, normalize,
 * gain, fade, and reverse operations. Includes undo/redo and a
 * waveform display with selection support.
 *
 * Uses @radix-ui/react-dialog following the same pattern as
 * LoopEditorDialog and SampleChopperDialog.
 */

import { useCallback, useState, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/ui/utils';
import { WaveformDisplay } from '@/ui/WaveformDisplay';
import { OperationPanel } from '@/ui/OperationPanel';
import { useSampleEditor } from '@/ui/hooks/useSampleEditor';

export interface SampleEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  samples: Int16Array | null;
  sampleRate: number;
  sampleName: string;
  onSave?: (samples: Int16Array, sampleRate: number) => void;
}

export function SampleEditorDialog({
  open,
  onOpenChange,
  samples: initialSamples,
  sampleRate,
  sampleName,
  onSave,
}: SampleEditorDialogProps): JSX.Element {
  const editor = useSampleEditor({ initialSamples, sampleRate });
  const dialogRef = useRef<HTMLDivElement>(null);

  const ZOOM_STEPS = [1, 2, 4, 8, 16, 32, 64] as const;
  const [zoom, setZoom] = useState(1);

  const zoomIn = useCallback(() => {
    setZoom((z) => {
      const idx = ZOOM_STEPS.indexOf(z as typeof ZOOM_STEPS[number]);
      return idx < ZOOM_STEPS.length - 1 ? ZOOM_STEPS[idx + 1] : z;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => {
      const idx = ZOOM_STEPS.indexOf(z as typeof ZOOM_STEPS[number]);
      return idx > 0 ? ZOOM_STEPS[idx - 1] : z;
    });
  }, []);

  const zoomReset = useCallback(() => { setZoom(1); }, []);

  // Keyboard shortcuts for zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!dialogRef.current?.contains(e.target as Node)) return;
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case '+': case '=':
          zoomIn();
          e.preventDefault();
          break;
        case '-':
          zoomOut();
          e.preventDefault();
          break;
        case '0':
          zoomReset();
          e.preventDefault();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut, zoomReset]);

  const handleSave = useCallback(() => {
    if (!editor.samples || !onSave) return;
    onSave(editor.samples, editor.sampleRate);
    onOpenChange(false);
  }, [editor.samples, editor.sampleRate, onSave, onOpenChange]);

  const durationSec = editor.samples
    ? (editor.samples.length / editor.sampleRate).toFixed(3)
    : '0.000';

  const sampleCount = editor.samples?.length ?? 0;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content ref={dialogRef} className="fixed z-50 inset-4 bg-ac-panel border border-ac-accent rounded-lg shadow-xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-ac-accent shrink-0">
            <div>
              <Dialog.Title className="text-lg font-bold text-ac-text">
                Sample Editor
              </Dialog.Title>
              <Dialog.Description className="text-sm text-ac-muted">
                {sampleName}
              </Dialog.Description>
            </div>
            <div className="flex items-center gap-2">
              {/* Undo / Redo */}
              <button
                className={cn('ac-btn ac-btn-sm', !editor.canUndo && 'opacity-50 cursor-not-allowed')}
                disabled={!editor.canUndo}
                onClick={editor.undo}
                title="Undo"
              >
                Undo
              </button>
              <button
                className={cn('ac-btn ac-btn-sm', !editor.canRedo && 'opacity-50 cursor-not-allowed')}
                disabled={!editor.canRedo}
                onClick={editor.redo}
                title="Redo"
              >
                Redo
              </button>

              {/* Zoom controls */}
              <div className="flex items-center gap-1 border-l border-ac-accent pl-2 ml-1">
                <button
                  className={cn('ac-btn ac-btn-sm', zoom <= 1 && 'opacity-50 cursor-not-allowed')}
                  disabled={zoom <= 1}
                  onClick={zoomOut}
                  title="Zoom out (-)"
                >
                  -
                </button>
                <button
                  className="ac-btn ac-btn-sm min-w-[40px] text-center"
                  onClick={zoomReset}
                  title="Reset zoom (0)"
                >
                  {zoom}x
                </button>
                <button
                  className={cn('ac-btn ac-btn-sm', zoom >= 64 && 'opacity-50 cursor-not-allowed')}
                  disabled={zoom >= 64}
                  onClick={zoomIn}
                  title="Zoom in (+)"
                >
                  +
                </button>
              </div>

              {/* Save */}
              {onSave && (
                <button
                  className={cn(
                    'ac-btn ac-btn-sm ac-btn-primary',
                    !editor.isDirty && 'opacity-50 cursor-not-allowed',
                  )}
                  disabled={!editor.isDirty}
                  onClick={handleSave}
                >
                  Save
                </button>
              )}

              {/* Close */}
              <Dialog.Close className="p-2 text-ac-muted hover:text-ac-text transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Dialog.Close>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto p-4 space-y-4">
            <WaveformDisplay
              samples={editor.samples}
              sampleRate={editor.sampleRate}
              selection={editor.selection}
              onSelectionChange={editor.setSelection}
              trimRegion={editor.trimRegion}
              onTrimRegionChange={editor.setTrimRegion}
              height={220}
              isPreview={editor.preview !== null}
              zoom={zoom}
            />

            <OperationPanel
              samples={editor.samples}
              sampleRate={editor.sampleRate}
              selection={editor.selection}
              trimRegion={editor.trimRegion}
              onTrimRegionChange={editor.setTrimRegion}
              onPreview={editor.setPreview}
              onCommit={editor.commitPreview}
              onApply={editor.apply}
              hasPreview={editor.preview !== null}
            />

            {/* History */}
            {editor.history.length > 1 && (
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-ac-muted">
                  History
                </div>
                <div className="flex flex-wrap gap-1">
                  {editor.history.map((entry, i) => (
                    <span
                      key={i}
                      className={cn(
                        'text-xs px-2 py-0.5 rounded',
                        entry.isCurrent
                          ? 'bg-ac-highlight/20 text-ac-text'
                          : 'text-ac-muted',
                      )}
                    >
                      {entry.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Status bar */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-ac-accent text-xs text-ac-muted shrink-0">
            <span>{durationSec}s</span>
            <span>{sampleRate} Hz</span>
            <span>{sampleCount.toLocaleString()} samples</span>
            {editor.preview !== null && (
              <span className="text-amber-400 font-medium">Preview</span>
            )}
            {editor.isDirty && <span className="text-ac-highlight">Modified</span>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
