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
  file: AkaiDiskFileEntry | null;
  partitionData: Uint8Array | null;
  volumeStartBlock: number;
  libraryRoot: StorageDirectoryHandle;
  onTransferComplete: () => Promise<void>;
  ensureFileBlocks?: (fileEntry: AkaiDiskFileEntry) => Promise<void>;
}

type DialogPhase = 'confirm' | 'saving' | 'success' | 'error';
type SaveTarget = 's3k' | 'common';

interface SaveProgress {
  currentItem: string;
  currentIndex: number;
  totalItems: number;
  bytesTransferred: number;
  totalBytes: number;
  startTime: number;
}

// =========================================================================
// Progress helpers
// =========================================================================

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

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

/** Collect unique sample names referenced by a program. */
function collectSampleNames(fileData: Uint8Array): string[] {
  const program = parseProgramFromDisk(fileData);
  const names = new Set<string>();
  for (const kg of program.keygroups) {
    for (const sn of kg.sampleNames) {
      const trimmed = sn.trim();
      if (trimmed) names.add(trimmed);
    }
  }
  return [...names];
}

/** Estimate total bytes for a set of files. */
function estimateTotalBytes(
  file: AkaiDiskFileEntry,
  sampleNames: string[],
  partitionData: Uint8Array,
  volumeStartBlock: number,
): number {
  let total = file.size;
  if (isAkaiProgram(file.type)) {
    const files = parseFileList(partitionData, volumeStartBlock);
    for (const name of sampleNames) {
      const sampleFile = files.find(
        (f) => isAkaiSample(f.type) && f.name.trim() === name,
      );
      if (sampleFile) total += sampleFile.size;
    }
  }
  return total;
}

/** Save to S3K library section (raw Akai bytes, no translation). */
async function saveToS3kLibrary(
  file: AkaiDiskFileEntry,
  fileData: Uint8Array,
  partitionData: Uint8Array,
  volumeStartBlock: number,
  name: string,
  libraryRoot: StorageDirectoryHandle,
  onProgress: (update: Partial<SaveProgress>) => void,
  ensureBlocks?: (fileEntry: AkaiDiskFileEntry) => Promise<void>,
): Promise<number> {
  if (isAkaiProgram(file.type)) {
    const program = parseProgramFromDisk(fileData);
    const yaml = serializeDiskProgram(program, fileData);
    await saveProgramToLibrary(libraryRoot, name, yaml);
    onProgress({ bytesTransferred: file.size, currentItem: name });

    let samplesFound = 0;
    const sampleNames = collectSampleNames(fileData);

    for (let i = 0; i < sampleNames.length; i++) {
      const trimmed = sampleNames[i];
      onProgress({ currentItem: trimmed, currentIndex: i + 1 });
      try {
        const result = await extractSample(partitionData, volumeStartBlock, trimmed, ensureBlocks);
        if (result) {
          await saveProgramSample(libraryRoot, name, trimmed, result.wav.buffer as ArrayBuffer);
          samplesFound++;
          onProgress({ bytesTransferred: file.size + result.wav.length });
        }
      } catch (err) {
        console.warn(`Failed to save sample "${trimmed}":`, err);
      }
    }
    return samplesFound;
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
    onProgress({ bytesTransferred: file.size, currentIndex: 1 });
    return 1;
  }
  return 0;
}

/** Save to common library section (translated to vendor-neutral format). */
async function saveToCommonLibrary(
  file: AkaiDiskFileEntry,
  fileData: Uint8Array,
  partitionData: Uint8Array,
  volumeStartBlock: number,
  name: string,
  libraryRoot: StorageDirectoryHandle,
  onProgress: (update: Partial<SaveProgress>) => void,
  ensureBlocks?: (fileEntry: AkaiDiskFileEntry) => Promise<void>,
): Promise<number> {
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
    onProgress({ bytesTransferred: file.size, currentIndex: 1 });
    return 1;
  } else if (isAkaiProgram(file.type)) {
    const program = parseProgramFromDisk(fileData);
    const volumeFiles = parseFileList(partitionData, volumeStartBlock);
    const sampleNames = collectSampleNames(fileData);

    const sampleHeaders = new Map<string, AkaiDiskSampleHeader>();
    let bytesTransferred = file.size;

    for (let i = 0; i < sampleNames.length; i++) {
      const sampleName = sampleNames[i];
      onProgress({ currentItem: sampleName, currentIndex: i + 1 });

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
        bytesTransferred += sampleFile.size;
        onProgress({ bytesTransferred });
      } catch (err) {
        console.warn(`Failed to save sample "${sampleName}" to common library:`, err);
      }
    }

    // Save program metadata
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

    return sampleHeaders.size;
  }
  return 0;
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
  const [progress, setProgress] = useState<SaveProgress>({
    currentItem: '',
    currentIndex: 0,
    totalItems: 0,
    bytesTransferred: 0,
    totalBytes: 0,
    startTime: 0,
  });

  // Reset state when dialog opens
  useEffect(() => {
    if (open && file) {
      setPhase('confirm');
      setSaveName(file.name.trim());
      setSaveTarget('s3k');
      setErrorMessage('');
      setSavedSampleCount(0);
      setProgress({
        currentItem: '',
        currentIndex: 0,
        totalItems: 0,
        bytesTransferred: 0,
        totalBytes: 0,
        startTime: 0,
      });
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

    // Calculate total items and bytes before starting
    const sampleNames = isAkaiProgram(file.type)
      ? (() => {
          try {
            if (ensureFileBlocks) {
              // File blocks should already be loaded from the click handler
            }
            const fileData = readFileData(partitionData, file);
            return collectSampleNames(fileData);
          } catch {
            return [];
          }
        })()
      : [];

    const totalItems = 1 + sampleNames.length; // program/sample + referenced samples
    const totalBytes = estimateTotalBytes(file, sampleNames, partitionData, volumeStartBlock);
    const startTime = Date.now();

    setProgress({
      currentItem: file.name.trim(),
      currentIndex: 0,
      totalItems,
      bytesTransferred: 0,
      totalBytes,
      startTime,
    });
    setPhase('saving');

    try {
      if (ensureFileBlocks) await ensureFileBlocks(file);
      const fileData = readFileData(partitionData, file);

      const onProgress = (update: Partial<SaveProgress>) => {
        setProgress((prev) => ({ ...prev, ...update }));
      };

      let samplesCount: number;
      if (saveTarget === 'common') {
        samplesCount = await saveToCommonLibrary(
          file, fileData, partitionData, volumeStartBlock,
          name, libraryRoot, onProgress, ensureFileBlocks,
        );
      } else {
        samplesCount = await saveToS3kLibrary(
          file, fileData, partitionData, volumeStartBlock,
          name, libraryRoot, onProgress, ensureFileBlocks,
        );
      }

      setSavedSampleCount(samplesCount);
      setPhase('success');
      await onTransferComplete();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setPhase('error');
    }
  }, [file, partitionData, volumeStartBlock, saveName, saveTarget, libraryRoot, onTransferComplete, ensureFileBlocks]);

  if (!file) return null;

  const fileTypeLabel = isAkaiProgram(file.type) ? 'Program' : 'Sample';

  // Progress calculations
  const elapsed = phase === 'saving' ? Date.now() - progress.startTime : 0;
  const percent = progress.totalBytes > 0
    ? Math.round((progress.bytesTransferred / progress.totalBytes) * 100)
    : 0;
  const bytesPerMs = elapsed > 0 ? progress.bytesTransferred / elapsed : 0;
  const remainingBytes = progress.totalBytes - progress.bytesTransferred;
  const etaMs = bytesPerMs > 0 ? remainingBytes / bytesPerMs : 0;

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
        <div className="my-4 space-y-3">
          {/* Progress bar */}
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(percent, 2)}%` }}
            />
          </div>

          {/* Stats */}
          <div className="text-sm text-gray-300 space-y-1">
            <div className="flex justify-between">
              <span>
                {progress.currentIndex} / {progress.totalItems} items
              </span>
              <span>{percent}%</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>
                {formatBytes(progress.bytesTransferred)} / {formatBytes(progress.totalBytes)}
              </span>
              <span>
                {elapsed > 1000 && `${formatDuration(elapsed)} elapsed`}
                {etaMs > 1000 && ` \u2022 ~${formatDuration(etaMs)} remaining`}
              </span>
            </div>
            <div className="text-gray-500 truncate">
              {progress.currentItem}
            </div>
          </div>
        </div>
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
