/**
 * DiskToLibraryDialog -- saves an Akai disk file to the library.
 *
 * Uses SteppedProgressDrawer. Auto-starts on open -- no confirm phase.
 * For programs: saves program + referenced samples.
 * For samples: saves WAV + metadata.
 *
 * The exported saveToCommonLibrary and saveToS3kLibrary functions are
 * also used directly by the disk browser drag-drop handlers.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
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
import { SteppedProgressDrawer, type ProgressStep, type OperationProgress, formatBytes } from '@audiocontrol/editor-core';
import {
  serializeDiskProgram,
} from '@/lib/program-serialization';
import {
  saveProgramToLibrary,
  saveProgramSample,
} from '@/lib/program-storage';

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

type SaveTarget = 's3k' | 'common';

/**
 * Progress for disk-to-library save operations.
 *
 * Extends OperationProgress with a startTime for elapsed/ETA calculation.
 * Field mapping from the former SaveProgress:
 *   currentItem -> stepLabel
 *   currentIndex -> currentStep
 *   totalItems -> totalSteps
 *   bytesTransferred -> bytesSent
 *   totalBytes -> bytesTotal
 */
export type SaveProgress = OperationProgress & { startTime: number };

// =========================================================================
// Helpers
// =========================================================================

async function writeFile(dir: StorageDirectoryHandle, name: string, data: ArrayBuffer | string): Promise<void> {
  const handle = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(data);
  await writable.close();
}

function collectSampleNames(programFileData: Uint8Array): string[] {
  try {
    const program = parseProgramFromDisk(programFileData);
    const names: string[] = [];
    for (const kg of program.keygroups) {
      for (const sn of kg.sampleNames) {
        const trimmed = sn.trim();
        if (trimmed.length > 0 && !names.includes(trimmed)) {
          names.push(trimmed);
        }
      }
    }
    return names;
  } catch {
    return [];
  }
}

function extractSample(
  partitionData: Uint8Array,
  volumeStartBlock: number,
  sampleName: string,
  ensureBlocks?: (fileEntry: AkaiDiskFileEntry) => Promise<void>,
): Promise<{ wav: Uint8Array; header: AkaiDiskSampleHeader } | null> {
  return (async () => {
    const volumeFiles = parseFileList(partitionData, volumeStartBlock);
    const sampleFile = volumeFiles.find(
      (f) => isAkaiSample(f.type) && f.name.trim() === sampleName,
    );
    if (!sampleFile) return null;
    if (ensureBlocks) await ensureBlocks(sampleFile);
    const sampleData = readFileData(partitionData, sampleFile);
    const header = parseSampleHeaderFromDisk(sampleData);
    const pcm = extractSampleAudio(sampleData, header);
    const wav = akaiSampleToWav(header, pcm);
    return { wav, header };
  })();
}

// =========================================================================
// Exported save functions (used by drag-drop handlers)
// =========================================================================

export { collectSampleNames };

/** Estimate total bytes for progress tracking. */
export function estimateTotalBytes(
  file: AkaiDiskFileEntry,
  sampleNames: string[],
  partitionData: Uint8Array,
  volumeStartBlock: number,
): number {
  let total = file.size;
  const volumeFiles = parseFileList(partitionData, volumeStartBlock);
  for (const name of sampleNames) {
    const sf = volumeFiles.find((f) => isAkaiSample(f.type) && f.name.trim() === name);
    if (sf) total += sf.size;
  }
  return total;
}

/** Save to S3K library section (raw Akai bytes, no translation). */
export async function saveToS3kLibrary(
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
    onProgress({ bytesSent: file.size, stepLabel: name });

    let samplesFound = 0;
    const sampleNames = collectSampleNames(fileData);

    for (let i = 0; i < sampleNames.length; i++) {
      const trimmed = sampleNames[i];
      onProgress({ stepLabel: trimmed, currentStep: i + 1 });
      try {
        const result = await extractSample(partitionData, volumeStartBlock, trimmed, ensureBlocks);
        if (result) {
          await saveProgramSample(libraryRoot, name, trimmed, result.wav.buffer as ArrayBuffer);
          samplesFound++;
          onProgress({ bytesSent: file.size + result.wav.length });
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
    onProgress({ bytesSent: file.size, currentStep: 1 });
    return 1;
  }
  return 0;
}

/** Save to common area (vendor-neutral format). */
export async function saveToCommonLibrary(
  file: AkaiDiskFileEntry,
  fileData: Uint8Array,
  partitionData: Uint8Array,
  volumeStartBlock: number,
  name: string,
  libraryRoot: StorageDirectoryHandle,
  onProgress: (update: Partial<SaveProgress>) => void,
  ensureBlocks?: (fileEntry: AkaiDiskFileEntry) => Promise<void>,
  targetPath: string[] = [],
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
    }, targetPath);
    onProgress({ bytesSent: file.size, currentStep: 1 });
    return 1;
  } else if (isAkaiProgram(file.type)) {
    const program = parseProgramFromDisk(fileData);
    const volumeFiles = parseFileList(partitionData, volumeStartBlock);
    const sampleNames = collectSampleNames(fileData);

    const { stringify: stringifyYaml } = await import('yaml');
    const { getNestedDirectory } = await import('@audiocontrol/sampler-library/browser');

    const programDir = await getNestedDirectory(libraryRoot, [
      'library', 'common', 'programs', name,
    ]);
    const samplesDir = await programDir.getDirectoryHandle('samples', { create: true });

    const sampleHeaders = new Map<string, AkaiDiskSampleHeader>();
    let bytesSent = file.size;

    for (let i = 0; i < sampleNames.length; i++) {
      const sampleName = sampleNames[i];
      onProgress({ stepLabel: sampleName, currentStep: i + 1 });

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

        await writeFile(samplesDir, `${sampleName.trim()}.wav`, wav.buffer as ArrayBuffer);

        const commonSample = akaiSampleToCommon(header);
        commonSample.name = sampleName;
        const sampleYaml = stringifyYaml(commonSample, { indent: 2 });
        await writeFile(samplesDir, `${sampleName.trim()}.yaml`, sampleYaml);

        bytesSent += sampleFile.size;
        onProgress({ bytesSent });
      } catch (err) {
        console.warn(`Failed to save sample "${sampleName}" to program:`, err);
      }
    }

    const commonProgram = akaiProgramToCommon(program, sampleHeaders);
    commonProgram.name = name;
    const programYaml = stringifyYaml(commonProgram, { indent: 2 });

    await writeFile(programDir, 'program.yaml', programYaml);

    return sampleHeaders.size;
  }
  return 0;
}

// =========================================================================
// Dialog Component
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
  const [steps, setSteps] = useState<ProgressStep[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [summary, setSummary] = useState<string | undefined>();
  const cancelledRef = useRef(false);
  // Stable refs for callbacks to avoid re-triggering the effect
  const onTransferCompleteRef = useRef(onTransferComplete);
  onTransferCompleteRef.current = onTransferComplete;
  const ensureFileBlocksRef = useRef(ensureFileBlocks);
  ensureFileBlocksRef.current = ensureFileBlocks;

  const updateStep = useCallback((id: string, update: Partial<ProgressStep>) => {
    setSteps((prev) => prev.map((s) => s.id === id ? { ...s, ...update } : s));
  }, []);

  useEffect(() => {
    if (!open || !file || !partitionData) return;

    cancelledRef.current = false;
    setIsComplete(false);
    setHasError(false);
    setSummary(undefined);

    const name = file.name.trim();
    const isProgram = isAkaiProgram(file.type);
    const saveTarget: SaveTarget = 'common'; // Default to common area

    setSteps([
      { id: 'read', label: `Read "${name}" from disk`, status: 'active' },
    ]);

    void (async () => {
      try {
        // Step 1: Read file data
        if (ensureFileBlocksRef.current) await ensureFileBlocksRef.current(file);
        const fileData = readFileData(partitionData, file);

        const sampleNames = isProgram ? collectSampleNames(fileData) : [];

        updateStep('read', {
          status: 'complete',
          detail: isProgram ? `${sampleNames.length} referenced samples` : formatBytes(file.size),
        });

        if (cancelledRef.current) return;

        // Build step list
        const saveStepLabel = saveTarget === 'common'
          ? `Save to common library`
          : `Save to Akai library`;

        setSteps((prev) => [
          ...prev,
          { id: 'save', label: saveStepLabel, status: 'pending' },
          ...(isProgram && sampleNames.length > 0
            ? sampleNames.map((sn) => ({
                id: `sample-${sn}`,
                label: `Save sample "${sn}"`,
                status: 'pending' as const,
              }))
            : []),
        ]);

        // Step 2: Save to library
        updateStep('save', { status: 'active' });

        let samplesCount = 0;

        if (saveTarget === 'common') {
          if (isAkaiSample(file.type)) {
            samplesCount = await saveToCommonLibrary(
              file, fileData, partitionData, volumeStartBlock,
              name, libraryRoot, () => {}, ensureFileBlocksRef.current,
            );
            updateStep('save', { status: 'complete', detail: 'Saved as WAV' });
          } else {
            // For programs, track per-sample progress
            const onSampleProgress = (sn: string, status: 'active' | 'complete' | 'failed', detail?: string) => {
              updateStep(`sample-${sn}`, { status, detail });
            };

            // Save program structure first
            const program = parseProgramFromDisk(fileData);
            const volumeFiles = parseFileList(partitionData, volumeStartBlock);

            const { stringify: stringifyYaml } = await import('yaml');
            const { getNestedDirectory } = await import('@audiocontrol/sampler-library/browser');

            const programDir = await getNestedDirectory(libraryRoot, [
              'library', 'common', 'programs', name,
            ]);
            const samplesDir = await programDir.getDirectoryHandle('samples', { create: true });

            updateStep('save', { status: 'complete', detail: 'Program directory created' });

            const sampleHeaders = new Map<string, AkaiDiskSampleHeader>();

            for (const sampleName of sampleNames) {
              if (cancelledRef.current) return;
              onSampleProgress(sampleName, 'active');

              const sampleFile = volumeFiles.find(
                (f) => isAkaiSample(f.type) && f.name.trim() === sampleName,
              );
              if (!sampleFile) {
                onSampleProgress(sampleName, 'failed', 'Not found on disk');
                continue;
              }

              try {
                if (ensureFileBlocksRef.current) await ensureFileBlocksRef.current(sampleFile);
                const sampleData = readFileData(partitionData, sampleFile);
                const header = parseSampleHeaderFromDisk(sampleData);
                const pcm = extractSampleAudio(sampleData, header);
                const wav = akaiSampleToWav(header, pcm);
                sampleHeaders.set(sampleName, header);

                await writeFile(samplesDir, `${sampleName.trim()}.wav`, wav.buffer as ArrayBuffer);
                const commonSample = akaiSampleToCommon(header);
                commonSample.name = sampleName;
                await writeFile(samplesDir, `${sampleName.trim()}.yaml`, stringifyYaml(commonSample, { indent: 2 }));

                onSampleProgress(sampleName, 'complete', formatBytes(wav.length));
                samplesCount++;
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                onSampleProgress(sampleName, 'failed', msg);
              }
            }

            const commonProgram = akaiProgramToCommon(program, sampleHeaders);
            commonProgram.name = name;
            await writeFile(programDir, 'program.yaml', stringifyYaml(commonProgram, { indent: 2 }));
          }
        } else {
          samplesCount = await saveToS3kLibrary(
            file, fileData, partitionData, volumeStartBlock,
            name, libraryRoot, () => {}, ensureFileBlocks,
          );
          updateStep('save', { status: 'complete' });
        }

        setSummary(
          isProgram
            ? `Saved "${name}" with ${samplesCount} sample${samplesCount !== 1 ? 's' : ''}.`
            : `Saved "${name}" to library.`,
        );
        setIsComplete(true);
        await onTransferCompleteRef.current();

      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[DiskToLibrary] Failed:', err);
        setSteps((prev) => {
          const updated = [...prev];
          const idx = updated.findIndex((s) => s.status === 'active' || s.status === 'pending');
          if (idx >= 0) {
            updated[idx] = { ...updated[idx], status: 'failed', error: message };
          }
          return updated;
        });
        setHasError(true);
      }
    })();

    return () => { cancelledRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file, partitionData, volumeStartBlock, libraryRoot]);

  const displayName = file?.name.trim() ?? 'item';

  return (
    <SteppedProgressDrawer
      open={open && file !== null}
      title={`Save "${displayName}" to Library`}
      onClose={onClose}
      onCancel={() => { cancelledRef.current = true; }}
      steps={steps}
      isComplete={isComplete}
      hasError={hasError}
      summary={summary}
    />
  );
}
