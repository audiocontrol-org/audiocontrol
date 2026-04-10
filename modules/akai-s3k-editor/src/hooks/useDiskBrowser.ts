import { useState, useCallback, useMemo } from 'react';
import {
  createScsiDiskClient,
  type ScsiDiskClient,
} from '@audiocontrol/midi-core';
import {
  parsePartitionTable,
  parseVolumeList,
  parseFileList,
  readFileData,
  parseSampleHeaderFromDisk,
  extractSampleAudio,
  parseProgramFromDisk,
  akaiSampleToWav,
  BLOCK_SIZE,
  type AkaiDiskFileEntry,
  type AkaiDiskProgram,
} from '@audiocontrol/sampler-devices/s3k';

export interface DiskTarget {
  id: number;
  vendor: string;
  product: string;
  blockCount: number;
  blockSize: number;
}

export interface DiskBrowserState {
  loading: boolean;
  error: string | null;
  targets: DiskTarget[];
  /** Cached raw disk data per SCSI target ID. */
  partitionData: Map<number, Uint8Array>;
}

/**
 * Hook that manages SCSI disk browser state.
 *
 * Creates an ScsiDiskClient from the bridge URL and provides functions for
 * scanning targets, loading disk data, and downloading samples/programs from
 * Akai-formatted SCSI disks.
 *
 * @param bridgeUrl - The SCSI bridge HTTP URL, or null if SCSI is inactive.
 */
export function useDiskBrowser(bridgeUrl: string | null) {
  const [state, setState] = useState<DiskBrowserState>({
    loading: false,
    error: null,
    targets: [],
    partitionData: new Map(),
  });

  const client = useMemo<ScsiDiskClient | null>(
    () => (bridgeUrl ? createScsiDiskClient(bridgeUrl) : null),
    [bridgeUrl],
  );

  /**
   * Scan SCSI IDs 0-5 for disk targets. IDs 6 (sampler) and 7 (Pi/host) are
   * skipped because those are the controller and initiator respectively.
   */
  const scanTargets = useCallback(async () => {
    if (!client) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const targets: DiskTarget[] = [];
      for (let id = 0; id <= 5; id++) {
        try {
          const inquiry = await client.inquiry(id);
          if (inquiry.vendor.trim()) {
            const capacity = await client.readCapacity(id);
            targets.push({
              id,
              vendor: inquiry.vendor,
              product: inquiry.product,
              blockCount: capacity.blockCount,
              blockSize: capacity.blockSize,
            });
          }
        } catch {
          // Target not present at this ID, skip.
        }
      }
      setState((s) => ({ ...s, targets, loading: false }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err instanceof Error ? err.message : String(err),
        loading: false,
      }));
    }
  }, [client]);

  /**
   * Load the raw disk data for a target. Reads enough blocks from LBA 0 to
   * cover the partition table (at 0x4500) and the first partition's volume
   * and file entries.
   *
   * For large partitions that extend beyond the initial read, the caller
   * would need to issue additional reads. This initial load covers the
   * metadata needed to enumerate volumes and files.
   */
  const loadDiskData = useCallback(
    async (targetId: number): Promise<Uint8Array | null> => {
      if (!client) return null;

      // Two-phase read:
      // 1. Read enough to get the partition table (at offset 0x4500)
      // 2. Then read the first partition in chunks (bridge limits to 65535 sectors per READ)
      const target = state.targets.find(t => t.id === targetId);
      const sectorSize = target?.blockSize || 512;
      const MAX_SECTORS_PER_READ = 4096; // Conservative — well under u16 max

      // Phase 1: read partition table
      const ptSectors = Math.ceil(0x4600 / sectorSize);
      const ptData = await client.readBlocks(targetId, 0, ptSectors);

      const partitions = parsePartitionTable(ptData);
      if (partitions.length === 0) return ptData;

      // Phase 2: read through end of first partition in chunks
      const part0End = (partitions[0].offsetInBlocks + partitions[0].sizeInBlocks) * BLOCK_SIZE;
      const totalSectors = Math.ceil(part0End / sectorSize);
      const totalBytes = totalSectors * sectorSize;
      const buffer = new Uint8Array(totalBytes);

      for (let offset = 0; offset < totalSectors; offset += MAX_SECTORS_PER_READ) {
        const count = Math.min(MAX_SECTORS_PER_READ, totalSectors - offset);
        const chunk = await client.readBlocks(targetId, offset, count);
        buffer.set(chunk, offset * sectorSize);
      }
      const data = buffer;

      setState((s) => {
        const newMap = new Map(s.partitionData);
        newMap.set(targetId, data);
        return { ...s, partitionData: newMap };
      });

      return data;
    },
    [client],
  );

  /**
   * Read file data from a partition and convert an Akai sample to a WAV blob
   * suitable for browser download.
   */
  const downloadSample = useCallback(
    async (
      partitionData: Uint8Array,
      fileEntry: AkaiDiskFileEntry,
    ): Promise<Blob> => {
      const fileData = readFileData(partitionData, fileEntry);
      const header = parseSampleHeaderFromDisk(fileData);
      const pcm = extractSampleAudio(fileData, header);
      const wav = akaiSampleToWav(header, pcm);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new Blob([wav as any], { type: 'audio/wav' });
    },
    [],
  );

  /**
   * Read file data from a partition and parse an Akai program.
   */
  const downloadProgram = useCallback(
    async (
      partitionData: Uint8Array,
      fileEntry: AkaiDiskFileEntry,
    ): Promise<AkaiDiskProgram> => {
      const fileData = readFileData(partitionData, fileEntry);
      return parseProgramFromDisk(fileData);
    },
    [],
  );

  return {
    ...state,
    scanTargets,
    loadDiskData,
    downloadSample,
    downloadProgram,
    client,
  };
}

export { parsePartitionTable, parseVolumeList, parseFileList };
export { FILE_TYPE_SAMPLE, FILE_TYPE_PROGRAM } from '@audiocontrol/sampler-devices/s3k';
