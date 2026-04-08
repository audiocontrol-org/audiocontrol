/**
 * Export Program Dialog — saves a complete program from the device to the library.
 *
 * Fetches the program header, all keygroup headers, and all referenced
 * samples from the S3000XL, then saves them as a program bundle.
 *
 * Flow:
 * 1. Show program name, confirm export
 * 2. Fetch program header from device
 * 3. Fetch each keygroup header (with progress)
 * 4. Serialize program + keygroups to YAML
 * 5. Receive each referenced sample via SDS (with progress)
 * 6. Save program YAML + sample WAVs to library
 * 7. Report success/error
 */

import { useState, useCallback, useEffect } from 'react';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import type { S3000xlClientInterface } from '@audiocontrol/sampler-devices/s3k';
import { Dialog, DialogTitle, DialogDescription, DialogActions } from '@/components/ui/Dialog';
import { serializeProgram, extractSampleReferences } from '@/lib/program-serialization';
import { saveProgramToLibrary, saveProgramSample } from '@/lib/program-storage';
import { buildWavFile } from '@/lib/wav-writer';
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
  /** Device sample names (RSLIST) for resolving sample indices */
  deviceSampleNames: string[];
  /** Called after successful save to refresh the library tree */
  onExportComplete: () => Promise<void>;
}

type DialogPhase = 'confirm' | 'fetching' | 'receiving-samples' | 'saving' | 'success' | 'error';

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
  deviceSampleNames,
  onExportComplete,
}: ExportProgramDialogProps): JSX.Element {
  const [phase, setPhase] = useState<DialogPhase>('confirm');
  const [saveName, setSaveName] = useState(programName.trim());
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [keygroupCount, setKeygroupCount] = useState<number | null>(null);
  const [sampleCount, setSampleCount] = useState<number | null>(null);
  const [missingSamples, setMissingSamples] = useState<string[]>([]);
  const [includeSamples, setIncludeSamples] = useState(true);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setPhase('confirm');
      setSaveName(programName.trim());
      setProgress({ current: 0, total: 0, label: '' });
      setErrorMessage(null);
      setKeygroupCount(null);
      setSampleCount(null);
      setMissingSamples([]);
      setIncludeSamples(true);
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

      // Step 3: Serialize program + keygroups
      const yamlContent = serializeProgram(programHeader, keygroupHeaders);

      // Step 4: Save YAML to library
      setPhase('saving');
      await saveProgramToLibrary(libraryRoot, trimmedName, yamlContent);

      // Step 5: Receive and save referenced samples via SDS
      if (includeSamples) {
        const sampleRefs = extractSampleReferences(keygroupHeaders);
        const uniqueSamples = sampleRefs.filter((name) =>
          deviceSampleNames.some((dn) => dn.trim() === name),
        );
        const missing = sampleRefs.filter((name) =>
          !deviceSampleNames.some((dn) => dn.trim() === name),
        );
        setMissingSamples(missing);

        if (uniqueSamples.length > 0) {
          setPhase('receiving-samples');
          setSampleCount(uniqueSamples.length);

          for (let i = 0; i < uniqueSamples.length; i++) {
            const sampleName = uniqueSamples[i];
            const sampleIndex = deviceSampleNames.findIndex(
              (dn) => dn.trim() === sampleName,
            );

            setProgress({
              current: i,
              total: uniqueSamples.length,
              label: `Receiving sample ${i + 1}/${uniqueSamples.length}: ${sampleName}`,
            });

            const result = await client.receiveSampleViaSds(
              sampleIndex,
              (sdsProgress) => {
                const pctStr = sdsProgress.packetsTotal > 0
                  ? ` (${Math.round((sdsProgress.packetsSent / sdsProgress.packetsTotal) * 100)}%)`
                  : '';
                setProgress({
                  current: i,
                  total: uniqueSamples.length,
                  label: `Receiving sample ${i + 1}/${uniqueSamples.length}: ${sampleName}${pctStr}`,
                });
              },
            );

            const sampleRate = Math.round(1_000_000_000 / result.header.samplePeriodNs);
            const wavData = buildWavFile(result.samples, sampleRate);
            await saveProgramSample(libraryRoot, trimmedName, sampleName, wavData);
          }
        }
      }

      setPhase('success');
      await onExportComplete();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(message);
      setPhase('error');
    }
  }, [saveName, programIndex, client, libraryRoot, deviceSampleNames, includeSamples, onExportComplete]);

  const handleClose = useCallback(() => {
    if (phase === 'fetching' || phase === 'saving' || phase === 'receiving-samples') return;
    onClose();
  }, [phase, onClose]);

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Save Program to Library</DialogTitle>

      {phase === 'confirm' && (
        <div className="space-y-4">
          <DialogDescription>
            Export program #{programIndex} (&ldquo;{programName.trim()}&rdquo;)
            from the device to your library.
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

          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={includeSamples}
              onChange={(e) => setIncludeSamples(e.target.checked)}
              className="ac-radio"
            />
            Include sample audio data (via SDS — may be slow)
          </label>

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

      {(phase === 'fetching' || phase === 'receiving-samples') && (
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
            ({keygroupCount} keygroup{keygroupCount !== 1 ? 's' : ''}
            {sampleCount != null && sampleCount > 0
              ? `, ${sampleCount} sample${sampleCount !== 1 ? 's' : ''}`
              : ''}).
          </div>
          {missingSamples.length > 0 && (
            <div className="p-3 bg-yellow-900/30 border border-yellow-700 rounded text-yellow-300 text-sm">
              <p className="font-medium">
                {missingSamples.length} referenced sample{missingSamples.length !== 1 ? 's' : ''} not
                found on device:
              </p>
              <ul className="mt-1 list-disc list-inside text-yellow-400">
                {missingSamples.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          )}
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
