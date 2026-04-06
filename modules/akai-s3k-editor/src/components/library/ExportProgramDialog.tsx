/**
 * Export Program Dialog — saves a complete program from the device to the library.
 *
 * Fetches the program header and all keygroup headers from the S3000XL
 * via SysEx, serializes them to YAML, and saves to library storage.
 *
 * Flow:
 * 1. Show program name, confirm export
 * 2. Fetch program header from device
 * 3. Fetch each keygroup header (with progress)
 * 4. Serialize to YAML
 * 5. Save to library as a directory bundle
 * 6. Report success/error
 */

import { useState, useCallback, useEffect } from 'react';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import type { S3000xlClientInterface } from '@audiocontrol/sampler-devices/s3k';
import { Dialog, DialogTitle, DialogDescription, DialogActions } from '@/components/ui/Dialog';
import { serializeProgram } from '@/lib/program-serialization';
import { saveProgramToLibrary } from '@/lib/program-storage';
import { cn } from '@/lib/utils';

// =========================================================================
// Types
// =========================================================================

export interface ExportProgramDialogProps {
  open: boolean;
  onClose: () => void;
  /** Device program index to export */
  programIndex: number;
  /** Device program name (for display and default save name) */
  programName: string;
  client: S3000xlClientInterface;
  libraryRoot: StorageDirectoryHandle;
  /** Called after successful save to refresh the library tree */
  onExportComplete: () => Promise<void>;
}

type DialogPhase = 'confirm' | 'fetching' | 'saving' | 'success' | 'error';

// =========================================================================
// Progress display
// =========================================================================

function ProgressBar({ current, total, label }: {
  current: number;
  total: number;
  label: string;
}): JSX.Element {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-300">{label}</p>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full transition-all duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-500 text-right">{pct}%</p>
    </div>
  );
}

// =========================================================================
// Dialog
// =========================================================================

export function ExportProgramDialog({
  open,
  onClose,
  programIndex,
  programName,
  client,
  libraryRoot,
  onExportComplete,
}: ExportProgramDialogProps): JSX.Element {
  const [phase, setPhase] = useState<DialogPhase>('confirm');
  const [saveName, setSaveName] = useState(programName.trim());
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [keygroupCount, setKeygroupCount] = useState<number | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setPhase('confirm');
      setSaveName(programName.trim());
      setProgress({ current: 0, total: 0, label: '' });
      setErrorMessage(null);
      setKeygroupCount(null);
    }
  }, [open, programName]);

  const handleExport = useCallback(async () => {
    const trimmedName = saveName.trim();
    if (!trimmedName) {
      setErrorMessage('Program name is required');
      return;
    }

    setPhase('fetching');
    setErrorMessage(null);

    try {
      // Step 1: Fetch program header
      setProgress({ current: 0, total: 1, label: 'Reading program header...' });
      const programHeader = await client.fetchProgramHeader(programIndex);
      const groups = programHeader.GROUPS;
      setKeygroupCount(groups);

      // Step 2: Fetch all keygroup headers
      const keygroupHeaders = [];
      for (let i = 0; i < groups; i++) {
        setProgress({
          current: i,
          total: groups,
          label: `Reading keygroup ${i + 1} of ${groups}...`,
        });
        const kg = await client.fetchKeygroupHeader(programIndex, i);
        keygroupHeaders.push(kg);
      }

      setProgress({ current: groups, total: groups, label: 'Serializing...' });

      // Step 3: Serialize
      const yamlContent = serializeProgram(programHeader, keygroupHeaders);

      // Step 4: Save to library
      setPhase('saving');
      await saveProgramToLibrary(libraryRoot, trimmedName, yamlContent);

      setPhase('success');
      await onExportComplete();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
      setPhase('error');
    }
  }, [saveName, programIndex, client, libraryRoot, onExportComplete]);

  const handleClose = useCallback(() => {
    if (phase === 'fetching' || phase === 'saving') return;
    onClose();
  }, [phase, onClose]);

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Save Program to Library</DialogTitle>

      {phase === 'confirm' && (
        <div className="space-y-4">
          <DialogDescription>
            Export program #{programIndex} (&ldquo;{programName.trim()}&rdquo;)
            from the device to your library. This saves the program header
            and all keygroups.
          </DialogDescription>

          <div>
            <label
              htmlFor="export-program-name"
              className="block text-sm text-gray-400 mb-1"
            >
              Save as
            </label>
            <input
              id="export-program-name"
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              maxLength={128}
              className={cn(
                'w-full bg-gray-700 border rounded px-3 py-2 text-gray-200 text-sm',
                'focus:outline-none focus:ring-2 focus:ring-blue-500',
                'border-gray-600',
              )}
              placeholder="Enter program name"
              data-testid="export-program-name-input"
            />
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
              {errorMessage}
            </div>
          )}

          <DialogActions>
            <button
              className="ac-btn ac-btn-sm ac-btn-secondary"
              onClick={handleClose}
            >
              Cancel
            </button>
            <button
              className="ac-btn ac-btn-sm ac-btn-primary"
              onClick={handleExport}
              disabled={!saveName.trim()}
              data-testid="export-program-confirm"
            >
              Export
            </button>
          </DialogActions>
        </div>
      )}

      {phase === 'fetching' && (
        <div className="space-y-4">
          <ProgressBar
            current={progress.current}
            total={progress.total}
            label={progress.label}
          />
          <p className="text-xs text-gray-500">
            Do not disconnect the device during transfer.
          </p>
        </div>
      )}

      {phase === 'saving' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">Saving to library...</p>
        </div>
      )}

      {phase === 'error' && (
        <div className="space-y-3">
          <div className="p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
            {errorMessage || 'An unknown error occurred'}
          </div>
          <DialogActions>
            <button
              className="ac-btn ac-btn-sm ac-btn-secondary"
              onClick={handleClose}
            >
              Close
            </button>
          </DialogActions>
        </div>
      )}

      {phase === 'success' && (
        <div className="space-y-4">
          <div className="p-3 bg-green-900/30 border border-green-700 rounded text-green-300 text-sm">
            Program saved to library as &ldquo;{saveName.trim()}&rdquo;
            ({keygroupCount} keygroup{keygroupCount !== 1 ? 's' : ''}).
          </div>
          <DialogActions>
            <button
              className="ac-btn ac-btn-sm ac-btn-primary"
              onClick={handleClose}
              data-testid="export-program-done"
            >
              Done
            </button>
          </DialogActions>
        </div>
      )}
    </Dialog>
  );
}
