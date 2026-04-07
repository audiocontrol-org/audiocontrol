/**
 * DiskToLibraryDialog — saves an Akai disk file (program or sample) to the
 * S3K section of the browser library.
 *
 * Programs are stored as YAML with base64-encoded raw on-disk bytes plus
 * WAV files for each referenced sample. Samples are stored as WAV files
 * directly.
 */

import { useState, useEffect, useCallback } from 'react';
import type { AkaiDiskFileEntry } from '@audiocontrol/sampler-devices/s3k';
import {
  readFileData,
  parseFileList,
  parseProgramFromDisk,
  parseSampleHeaderFromDisk,
  extractSampleAudio,
  akaiSampleToWav,
  isAkaiSample,
  isAkaiProgram,
} from '@audiocontrol/sampler-devices/s3k';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import {
  serializeDiskProgram,
} from '@/lib/program-serialization';
import {
  saveProgramToLibrary,
  saveProgramSample,
} from '@/lib/program-storage';
import {
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogActions,
} from '@/components/ui/Dialog';

// =========================================================================
// Types
// =========================================================================

export interface DiskToLibraryDialogProps {
  open: boolean;
  onClose: () => void;
  /** The file entry selected in the disk browser. */
  file: AkaiDiskFileEntry | null;
  /** Raw partition data containing the file. */
  partitionData: Uint8Array | null;
  /** Volume's start block (needed to find sibling sample files). */
  volumeStartBlock: number;
  /** Library root storage handle. */
  libraryRoot: StorageDirectoryHandle;
  /** Called on success to refresh the library tree. */
  onTransferComplete: () => Promise<void>;
}

type DialogPhase = 'confirm' | 'saving' | 'success' | 'error';

// =========================================================================
// Component
// =========================================================================

export function DiskToLibraryDialog({
  open,
  onClose,
  file,
  partitionData,
  volumeStartBlock,
  libraryRoot,
  onTransferComplete,
}: DiskToLibraryDialogProps) {
  const [phase, setPhase] = useState<DialogPhase>('confirm');
  const [saveName, setSaveName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [savedSampleCount, setSavedSampleCount] = useState(0);

  // Reset state when dialog opens
  useEffect(() => {
    if (open && file) {
      setPhase('confirm');
      setSaveName(file.name.trim());
      setErrorMessage('');
      setSavedSampleCount(0);
    }
  }, [open, file]);

  const handleClose = useCallback(() => {
    if (phase === 'saving') return;
    onClose();
  }, [phase, onClose]);

  const handleSave = useCallback(async () => {
    if (!file || !partitionData) return;
    const name = saveName.trim();
    if (!name) return;

    setPhase('saving');
    try {
      const fileData = readFileData(partitionData, file);

      if (isAkaiProgram(file.type)) {
        // Parse program and serialize to YAML
        const program = parseProgramFromDisk(fileData);
        const yaml = serializeDiskProgram(program, fileData);
        await saveProgramToLibrary(libraryRoot, name, yaml);

        // Find and save referenced sample files from the same volume
        const volumeFiles = parseFileList(partitionData, volumeStartBlock);
        let samplesFound = 0;

        for (const kg of program.keygroups) {
          for (const sampleName of kg.sampleNames) {
            const trimmed = sampleName.trim();
            if (!trimmed) continue;

            const sampleFile = volumeFiles.find(
              (f) => isAkaiSample(f.type) && f.name.trim() === trimmed,
            );
            if (!sampleFile) continue;

            try {
              const sampleData = readFileData(partitionData, sampleFile);
              const header = parseSampleHeaderFromDisk(sampleData);
              const pcm = extractSampleAudio(sampleData, header);
              const wav = akaiSampleToWav(header, pcm);
              await saveProgramSample(
                libraryRoot,
                name,
                trimmed,
                wav.buffer as ArrayBuffer,
              );
              samplesFound++;
            } catch (err) {
              console.warn(`Failed to save sample "${trimmed}":`, err);
            }
          }
        }

        setSavedSampleCount(samplesFound);
      } else if (isAkaiSample(file.type)) {
        // Save sample directly as a standalone program bundle with just the WAV
        const header = parseSampleHeaderFromDisk(fileData);
        const pcm = extractSampleAudio(fileData, header);
        const wav = akaiSampleToWav(header, pcm);

        // Store as a simple program bundle with just the sample
        const yaml = [
          'format: s3000xl-disk-sample',
          'version: 1',
          `name: "${name}"`,
          `sampleRate: ${header.sampleRate}`,
          `sampleLength: ${header.sampleLength}`,
        ].join('\n');

        await saveProgramToLibrary(libraryRoot, name, yaml);
        await saveProgramSample(libraryRoot, name, name, wav.buffer as ArrayBuffer);
        setSavedSampleCount(1);
      }

      setPhase('success');
      await onTransferComplete();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setPhase('error');
    }
  }, [file, partitionData, volumeStartBlock, saveName, libraryRoot, onTransferComplete]);

  if (!file) return null;

  const fileTypeLabel = isAkaiProgram(file.type) ? 'Program' : 'Sample';

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Save {fileTypeLabel} to Library</DialogTitle>

      {phase === 'confirm' && (
        <>
          <DialogDescription>
            Save <strong>{file.name.trim()}</strong> ({fileTypeLabel},{' '}
            {Math.round(file.size / 1024)} KB) from disk to the S3K library.
          </DialogDescription>

          <div className="my-4">
            <label className="block text-sm text-gray-400 mb-1">
              Save as:
            </label>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
              maxLength={12}
            />
          </div>

          <DialogActions>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-1.5 text-sm text-gray-400 hover:text-gray-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!saveName.trim()}
              className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-50"
            >
              Save
            </button>
          </DialogActions>
        </>
      )}

      {phase === 'saving' && (
        <DialogDescription>
          Saving to library...
        </DialogDescription>
      )}

      {phase === 'success' && (
        <>
          <DialogDescription>
            Saved <strong>{saveName}</strong> to library.
            {savedSampleCount > 0 && (
              <> Included {savedSampleCount} sample{savedSampleCount !== 1 ? 's' : ''}.</>
            )}
          </DialogDescription>
          <DialogActions>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded"
            >
              Done
            </button>
          </DialogActions>
        </>
      )}

      {phase === 'error' && (
        <>
          <DialogDescription>
            <span className="text-red-400">Error: {errorMessage}</span>
          </DialogDescription>
          <DialogActions>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-1.5 text-sm text-gray-400 hover:text-gray-200"
            >
              Close
            </button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
