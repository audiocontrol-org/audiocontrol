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
  akaiSampleToCommon,
  akaiProgramToCommon,
  isAkaiSample,
  isAkaiProgram,
  type AkaiDiskSampleHeader,
} from '@audiocontrol/sampler-devices/s3k';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import { saveSample, type SampleSavePayload } from '@audiocontrol/sampler-library/browser';
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
  /** Lazily load a file's data blocks from disk into the partition buffer. */
  ensureFileBlocks?: (fileEntry: AkaiDiskFileEntry) => Promise<void>;
}

type DialogPhase = 'confirm' | 'saving' | 'success' | 'error';
type SaveTarget = 's3k' | 'common';

// =========================================================================
// Save helpers
// =========================================================================

/** Extract a sample's WAV and header from partition data. */
async function extractSample(
  partitionData: Uint8Array,
  volumeStartBlock: number,
  sampleName: string,
  ensureBlocks?: (fileEntry: AkaiDiskFileEntry) => Promise<void>,
): Promise<{ wav: Uint8Array; header: AkaiDiskSampleHeader } | null> {
  const files = parseFileList(partitionData, volumeStartBlock);
  const sampleFile = files.find(
    (f) => isAkaiSample(f.type) && f.name.trim() === sampleName,
  );
  if (!sampleFile) return null;

  if (ensureBlocks) await ensureBlocks(sampleFile);

  const sampleData = readFileData(partitionData, sampleFile);
  const header = parseSampleHeaderFromDisk(sampleData);
  const pcm = extractSampleAudio(sampleData, header);
  const wav = akaiSampleToWav(header, pcm);
  return { wav, header };
}

/** Save to S3K library section (raw Akai bytes, no translation). */
async function saveToS3kLibrary(
  file: AkaiDiskFileEntry,
  fileData: Uint8Array,
  partitionData: Uint8Array,
  volumeStartBlock: number,
  name: string,
  libraryRoot: StorageDirectoryHandle,
  setSavedSampleCount: (n: number) => void,
  ensureBlocks?: (fileEntry: AkaiDiskFileEntry) => Promise<void>,
) {
  if (isAkaiProgram(file.type)) {
    const program = parseProgramFromDisk(fileData);
    const yaml = serializeDiskProgram(program, fileData);
    await saveProgramToLibrary(libraryRoot, name, yaml);

    let samplesFound = 0;
    for (const kg of program.keygroups) {
      for (const sampleName of kg.sampleNames) {
        const trimmed = sampleName.trim();
        if (!trimmed) continue;
        try {
          const result = await extractSample(partitionData, volumeStartBlock, trimmed, ensureBlocks);
          if (result) {
            await saveProgramSample(libraryRoot, name, trimmed, result.wav.buffer as ArrayBuffer);
            samplesFound++;
          }
        } catch (err) {
          console.warn(`Failed to save sample "${trimmed}":`, err);
        }
      }
    }
    setSavedSampleCount(samplesFound);
  } else if (isAkaiSample(file.type)) {
    const header = parseSampleHeaderFromDisk(fileData);
    const pcm = extractSampleAudio(fileData, header);
    const wav = akaiSampleToWav(header, pcm);

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
}

/** Save to common library section (translated to vendor-neutral format). */
async function saveToCommonLibrary(
  file: AkaiDiskFileEntry,
  fileData: Uint8Array,
  partitionData: Uint8Array,
  volumeStartBlock: number,
  name: string,
  libraryRoot: StorageDirectoryHandle,
  ensureBlocks?: (fileEntry: AkaiDiskFileEntry) => Promise<void>,
) {
  if (isAkaiSample(file.type)) {
    const header = parseSampleHeaderFromDisk(fileData);
    const pcm = extractSampleAudio(fileData, header);
    const wav = akaiSampleToWav(header, pcm);
    const commonSample = akaiSampleToCommon(header);
    commonSample.name = name;

    await saveSample(libraryRoot, {
      name,
      yaml: commonSample as SampleSavePayload['yaml'],
      wavData: wav.buffer as ArrayBuffer,
    });
  } else if (isAkaiProgram(file.type)) {
    const program = parseProgramFromDisk(fileData);
    const volumeFiles = parseFileList(partitionData, volumeStartBlock);

    // Collect sample headers for root key info
    const sampleHeaders = new Map<string, AkaiDiskSampleHeader>();
    const allSampleNames = new Set<string>();
    for (const kg of program.keygroups) {
      for (const sn of kg.sampleNames) {
        const trimmed = sn.trim();
        if (trimmed) allSampleNames.add(trimmed);
      }
    }

    // Save each referenced sample to common library
    for (const sampleName of allSampleNames) {
      const sampleFile = volumeFiles.find(
        (f) => isAkaiSample(f.type) && f.name.trim() === sampleName,
      );
      if (!sampleFile) continue;

      try {
        if (ensureBlocks) await ensureBlocks(sampleFile);
        const sampleData = readFileData(partitionData, sampleFile);
        const header = parseSampleHeaderFromDisk(sampleData);
        const pcm = extractSampleAudio(sampleData, header);
        const wav = akaiSampleToWav(header, pcm);
        sampleHeaders.set(sampleName, header);

        const commonSample = akaiSampleToCommon(header);
        commonSample.name = sampleName;

        await saveSample(libraryRoot, {
          name: sampleName,
          yaml: commonSample as SampleSavePayload['yaml'],
          wavData: wav.buffer as ArrayBuffer,
        });
      } catch (err) {
        console.warn(`Failed to save sample "${sampleName}" to common library:`, err);
      }
    }

    // Save program metadata to common library
    const commonProgram = akaiProgramToCommon(program, sampleHeaders);
    commonProgram.name = name;

    const { stringify: stringifyYaml } = await import('yaml');
    const programYaml = stringifyYaml(commonProgram, { indent: 2 });

    const { getNestedDirectory } = await import('@audiocontrol/sampler-library/browser');
    const programDir = await getNestedDirectory(libraryRoot, [
      'library', 'common', 'programs', name,
    ]);
    const fileHandle = await programDir.getFileHandle('program.yaml', { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(programYaml);
    await writable.close();
  }
}

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
  ensureFileBlocks,
}: DiskToLibraryDialogProps) {
  const [phase, setPhase] = useState<DialogPhase>('confirm');
  const [saveName, setSaveName] = useState('');
  const [saveTarget, setSaveTarget] = useState<SaveTarget>('s3k');
  const [errorMessage, setErrorMessage] = useState('');
  const [savedSampleCount, setSavedSampleCount] = useState(0);

  // Reset state when dialog opens
  useEffect(() => {
    if (open && file) {
      setPhase('confirm');
      setSaveName(file.name.trim());
      setSaveTarget('s3k');
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
      if (ensureFileBlocks) await ensureFileBlocks(file);
      const fileData = readFileData(partitionData, file);

      if (saveTarget === 'common') {
        await saveToCommonLibrary(file, fileData, partitionData, volumeStartBlock, name, libraryRoot, ensureFileBlocks);
      } else {
        await saveToS3kLibrary(file, fileData, partitionData, volumeStartBlock, name, libraryRoot, setSavedSampleCount, ensureFileBlocks);
      }

      setPhase('success');
      await onTransferComplete();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setPhase('error');
    }
  }, [file, partitionData, volumeStartBlock, saveName, saveTarget, libraryRoot, onTransferComplete, ensureFileBlocks]);

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

          <div className="my-4 space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Save as:
              </label>
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                maxLength={128}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Destination:
              </label>
              <select
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-100"
                value={saveTarget}
                onChange={(e) => setSaveTarget(e.target.value as SaveTarget)}
              >
                <option value="s3k">S3K Library (Akai native format)</option>
                <option value="common">Common Library (vendor-neutral)</option>
              </select>
            </div>
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
