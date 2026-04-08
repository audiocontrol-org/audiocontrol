/**
 * LibraryToDiskDialog — writes an S3K library program (with samples) to an
 * Akai-formatted SCSI disk image via the bridge.
 *
 * Reads the serialized program from the library, decodes raw disk bytes,
 * allocates blocks on the target volume, and writes via SCSI block I/O.
 */

import { useState, useEffect, useCallback } from 'react';
import type { ScsiDiskClient } from '@audiocontrol/midi-core';
import {
  parsePartitionTable,
  parseVolumeList,
  writeFileToVolume,
  FILE_TYPE_PROGRAM_S3000,
  BLOCK_SIZE,
} from '@audiocontrol/sampler-devices/s3k';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import {
  detectProgramFormat,
  deserializeDiskProgram,
  decodeDiskProgramRaw,
} from '@/lib/program-serialization';
import { loadProgramFromLibrary } from '@/lib/program-storage';
import type { DiskTarget } from '@/hooks/useDiskBrowser';
import {
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogActions,
} from '@/components/ui/Dialog';

// =========================================================================
// Types
// =========================================================================

export interface LibraryToDiskDialogProps {
  open: boolean;
  onClose: () => void;
  /** Library program directory name. */
  programDirName: string;
  programName: string;
  /** Library root storage handle. */
  libraryRoot: StorageDirectoryHandle;
  /** Available SCSI disk targets. */
  diskTargets: DiskTarget[];
  /** SCSI disk client for reading/writing blocks. */
  diskClient: ScsiDiskClient | null;
  /** Called on success. */
  onUploadComplete: () => Promise<void>;
}

interface VolumeOption {
  name: string;
  startBlock: number;
  partitionOffset: number;
}

type DialogPhase = 'loading' | 'confirm' | 'writing' | 'success' | 'error';

// =========================================================================
// Component
// =========================================================================

export function LibraryToDiskDialog({
  open,
  onClose,
  programDirName,
  programName,
  libraryRoot,
  diskTargets,
  diskClient,
  onUploadComplete,
}: LibraryToDiskDialogProps) {
  const [phase, setPhase] = useState<DialogPhase>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState<number | null>(null);
  const [volumes, setVolumes] = useState<VolumeOption[]>([]);
  const [selectedVolume, setSelectedVolume] = useState<number>(0);
  const [programFormat, setProgramFormat] = useState<string>('');
  const [sampleCount, setSampleCount] = useState(0);

  // Load program and scan volumes when dialog opens
  useEffect(() => {
    if (!open) return;

    setPhase('loading');
    setErrorMessage('');
    setVolumes([]);
    setSelectedTargetId(diskTargets.length > 0 ? diskTargets[0].id : null);

    (async () => {
      try {
        const yaml = await loadProgramFromLibrary(libraryRoot, programDirName);
        const format = detectProgramFormat(yaml);
        setProgramFormat(format);

        if (format === 's3000xl-disk-program') {
          const parsed = deserializeDiskProgram(yaml);
          setSampleCount(parsed.sampleReferences.length);
        }

        setPhase('confirm');
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : String(err));
        setPhase('error');
      }
    })();
  }, [open, programDirName, libraryRoot, diskTargets]);

  // Load volumes when target changes
  useEffect(() => {
    if (selectedTargetId === null || !diskClient) return;

    (async () => {
      try {
        const data = await diskClient.readBlocks(selectedTargetId, 0, Math.ceil(0x10000 / BLOCK_SIZE));
        const partitions = parsePartitionTable(data);
        const opts: VolumeOption[] = [];

        for (const partition of partitions) {
          const partStart = partition.offsetInBlocks * BLOCK_SIZE;
          if (partStart + BLOCK_SIZE > data.length) continue;
          const partData = data.subarray(partStart);
          const vols = parseVolumeList(partData);
          for (const vol of vols) {
            opts.push({
              name: vol.name,
              startBlock: vol.startBlock,
              partitionOffset: partStart,
            });
          }
        }

        setVolumes(opts);
        setSelectedVolume(0);
      } catch (err) {
        console.error('Failed to scan volumes:', err);
        setVolumes([]);
      }
    })();
  }, [selectedTargetId, diskClient]);

  const handleClose = useCallback(() => {
    if (phase === 'writing') return;
    onClose();
  }, [phase, onClose]);

  const handleWrite = useCallback(async () => {
    if (!diskClient || selectedTargetId === null || volumes.length === 0) return;

    const vol = volumes[selectedVolume];
    setPhase('writing');

    try {
      const yaml = await loadProgramFromLibrary(libraryRoot, programDirName);
      const format = detectProgramFormat(yaml);

      if (format !== 's3000xl-disk-program') {
        throw new Error(`Cannot write ${format} to disk — only disk-origin programs are supported`);
      }

      const parsed = deserializeDiskProgram(yaml);
      const fileData = decodeDiskProgramRaw(parsed);

      // Read the full partition data we'll modify
      // Calculate how many SCSI sectors to read for the partition
      const target = diskTargets.find(t => t.id === selectedTargetId);
      const totalBytes = target ? target.blockCount * target.blockSize : 0x100000;
      const sectorsToRead = Math.ceil(totalBytes / 512);
      const partitionRaw = await diskClient.readBlocks(selectedTargetId, 0, sectorsToRead);

      // Get partition-level data
      const partData = new Uint8Array(partitionRaw.length - vol.partitionOffset);
      partData.set(partitionRaw.subarray(vol.partitionOffset));

      // Write program file to the volume
      const modifiedBlocks = writeFileToVolume(
        partData,
        vol.startBlock,
        parsed.name,
        FILE_TYPE_PROGRAM_S3000,
        fileData,
      );

      // Write modified blocks back to disk
      for (const akaiBlock of modifiedBlocks) {
        const blockOffset = akaiBlock * BLOCK_SIZE;
        const lba = (vol.partitionOffset + blockOffset) / 512;
        const blockData = partData.subarray(blockOffset, blockOffset + BLOCK_SIZE);
        await diskClient.writeBlocks(selectedTargetId, lba, blockData);
      }

      // TODO: Write sample files similarly (load WAV from library, convert, write)

      setPhase('success');
      await onUploadComplete();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
      setPhase('error');
    }
  }, [diskClient, selectedTargetId, volumes, selectedVolume, libraryRoot, programDirName, diskTargets, onUploadComplete]);

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Send Program to Disk</DialogTitle>

      {phase === 'loading' && (
        <DialogDescription>Loading program...</DialogDescription>
      )}

      {phase === 'confirm' && (
        <>
          <DialogDescription>
            Write <strong>{programName}</strong> to an Akai disk.
            {sampleCount > 0 && <> ({sampleCount} referenced samples)</>}
            {programFormat !== 's3000xl-disk-program' && (
              <div className="mt-2 text-yellow-400 text-xs">
                Note: Only disk-origin programs can be written to disk.
                This program was saved from {programFormat === 's3000xl-program' ? 'device SysEx' : 'an unknown source'}.
              </div>
            )}
          </DialogDescription>

          <div className="my-4 space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Target Disk:</label>
              <select
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-100"
                value={selectedTargetId ?? ''}
                onChange={(e) => setSelectedTargetId(Number(e.target.value))}
              >
                {diskTargets.map(t => (
                  <option key={t.id} value={t.id}>
                    ID {t.id}: {t.vendor.trim()} {t.product.trim()}
                  </option>
                ))}
              </select>
            </div>

            {volumes.length > 0 && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">Target Volume:</label>
                <select
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-100"
                  value={selectedVolume}
                  onChange={(e) => setSelectedVolume(Number(e.target.value))}
                >
                  {volumes.map((v, i) => (
                    <option key={i} value={i}>{v.name}</option>
                  ))}
                </select>
              </div>
            )}
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
              onClick={handleWrite}
              disabled={programFormat !== 's3000xl-disk-program' || volumes.length === 0}
              className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded disabled:opacity-50"
            >
              Write to Disk
            </button>
          </DialogActions>
        </>
      )}

      {phase === 'writing' && (
        <DialogDescription>Writing to disk...</DialogDescription>
      )}

      {phase === 'success' && (
        <>
          <DialogDescription>
            Successfully wrote <strong>{programName}</strong> to disk.
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
