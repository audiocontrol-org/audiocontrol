import { useState, useCallback, useMemo, useRef } from 'react';
import {
  createScsiDiskClient,
  type ScsiDiskClient,
} from '@audiocontrol/midi-core';
import {
  parsePartitionTable,
  parseVolumeList,
  parseFileList,
  readFatChain,
  readFileData,
  parseSampleHeaderFromDisk,
  extractSampleAudio,
  parseProgramFromDisk,
  akaiSampleToWav,
  BLOCK_SIZE,
  FAT_OFFSET,
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
  /**
   * Cached partition metadata per SCSI target ID.
   * Contains partition table + volume dir + FAT + file directory blocks.
   * File data blocks are read on demand into this buffer.
   */
  partitionData: Map<number, Uint8Array>;
}

/**
 * Hook that manages SCSI disk browser state.
 *
 * Disk reads are lazy: only metadata (partition table, FAT, volume/file
 * directories) is read upfront. File content is read on demand when the
 * user downloads a sample or program.
 */
export function useDiskBrowser(bridgeUrl: string | null, cachedTargets?: DiskTarget[]) {
  const [state, setState] = useState<DiskBrowserState>({
    loading: false,
    error: null,
    targets: cachedTargets ?? [],
    partitionData: new Map(),
  });

  // Ref to access current state from stable callbacks without stale closures.
  const stateRef = useRef(state);
  stateRef.current = state;

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
   * Read specific Akai blocks from disk into a buffer at their correct
   * offsets. Groups contiguous blocks into single SCSI reads for efficiency.
   */
  async function readAkaiBlocksInto(
    scsiClient: ScsiDiskClient,
    targetId: number,
    sectorSize: number,
    akaiBlocks: number[],
    buffer: Uint8Array,
    partitionByteOffset: number,
  ): Promise<void> {
    if (akaiBlocks.length === 0) return;
    const sectorsPerAkaiBlock = BLOCK_SIZE / sectorSize;
    const MAX_SECTORS_PER_READ = 4096;

    // Sort blocks and group contiguous runs for batch reads.
    const sorted = [...akaiBlocks].sort((a, b) => a - b);
    const runs: { start: number; count: number }[] = [];
    let runStart = sorted[0];
    let runCount = 1;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === sorted[i - 1] + 1 &&
          runCount * sectorsPerAkaiBlock < MAX_SECTORS_PER_READ) {
        runCount++;
      } else {
        runs.push({ start: runStart, count: runCount });
        runStart = sorted[i];
        runCount = 1;
      }
    }
    runs.push({ start: runStart, count: runCount });

    for (const run of runs) {
      const byteOffset = partitionByteOffset + run.start * BLOCK_SIZE;
      const lba = byteOffset / sectorSize;
      const totalSectors = run.count * sectorsPerAkaiBlock;
      const chunk = await scsiClient.readBlocks(targetId, lba, totalSectors);
      buffer.set(chunk, byteOffset);
    }
  }

  /**
   * Load disk metadata for a target — partition table, FAT, volume directory,
   * and file directory blocks. Does NOT read file content.
   *
   * Allocates a full-partition-sized buffer but only populates the metadata
   * blocks. This lets the existing parsers (which index by block * BLOCK_SIZE)
   * work without modification.
   */
  const loadDiskData = useCallback(
    async (targetId: number): Promise<Uint8Array | null> => {
      if (!client) return null;

      const target = state.targets.find(t => t.id === targetId);
      const sectorSize = target?.blockSize || 512;

      // Phase 1: read partition table (0x4600 bytes from disk start)
      const ptSectors = Math.ceil(0x4600 / sectorSize);
      const ptData = await client.readBlocks(targetId, 0, ptSectors);

      const partitions = parsePartitionTable(ptData);
      if (partitions.length === 0) return ptData;

      const part0 = partitions[0];
      const partitionByteOffset = part0.offsetInBlocks * BLOCK_SIZE;

      // Allocate full-partition-sized buffer. Only metadata blocks are
      // populated; file data blocks are read on demand during download.
      const partitionBytes = part0.sizeInBlocks * BLOCK_SIZE;
      const totalBytes = partitionByteOffset + partitionBytes;
      const buffer = new Uint8Array(totalBytes);
      buffer.set(ptData, 0);

      // Phase 2: read metadata blocks (volume directory + FAT).
      // Volume dir starts at 0xca (block 0). FAT starts at 0x70a and has
      // 2 bytes per block in the partition.
      const fatEndByte = FAT_OFFSET + part0.sizeInBlocks * 2;
      const metadataBlockCount = Math.ceil(fatEndByte / BLOCK_SIZE);
      const metadataBlockList = Array.from(
        { length: metadataBlockCount },
        (_, i) => i,
      );
      await readAkaiBlocksInto(
        client, targetId, sectorSize,
        metadataBlockList, buffer, partitionByteOffset,
      );

      // Phase 3: parse volumes and read file directory blocks that lie
      // beyond the metadata range.
      const partView = buffer.subarray(partitionByteOffset);
      const volumes = parseVolumeList(partView);
      const dirBlocksToRead = new Set<number>();
      for (const vol of volumes) {
        const chain = readFatChain(partView, vol.startBlock);
        for (const block of chain) {
          if (block >= metadataBlockCount) {
            dirBlocksToRead.add(block);
          }
        }
      }

      if (dirBlocksToRead.size > 0) {
        await readAkaiBlocksInto(
          client, targetId, sectorSize,
          [...dirBlocksToRead], buffer, partitionByteOffset,
        );
      }

      setState((s) => {
        const newMap = new Map(s.partitionData);
        newMap.set(targetId, buffer);
        return { ...s, partitionData: newMap };
      });

      return buffer;
    },
    [client],
  );

  /**
   * Ensure that a file's data blocks are present in the cached buffer.
   * Reads only the missing blocks from disk via SCSI.
   */
  const ensureFileBlocks = useCallback(
    async (targetId: number, fileEntry: AkaiDiskFileEntry): Promise<void> => {
      if (!client) return;

      // Read state snapshot inside the callback to avoid stale closures.
      const currentState = stateRef.current;
      const buffer = currentState.partitionData.get(targetId);
      if (!buffer) return;

      const target = currentState.targets.find(t => t.id === targetId);
      const sectorSize = target?.blockSize || 512;

      const partitions = parsePartitionTable(buffer);
      if (partitions.length === 0) return;
      const partitionByteOffset = partitions[0].offsetInBlocks * BLOCK_SIZE;
      const partView = buffer.subarray(partitionByteOffset);

      const chain = readFatChain(partView, fileEntry.startBlock);
      console.log(`[ensureFileBlocks] ${fileEntry.name}: chain=${chain.length} blocks`);

      // Find blocks that haven't been read yet (all-zero first 16 bytes).
      const missingBlocks: number[] = [];
      for (const block of chain) {
        const offset = block * BLOCK_SIZE;
        if (offset + BLOCK_SIZE > partView.length) continue;
        let allZero = true;
        for (let i = 0; i < 16; i++) {
          if (partView[offset + i] !== 0) {
            allZero = false;
            break;
          }
        }
        if (allZero) missingBlocks.push(block);
      }

      console.log(`[ensureFileBlocks] ${fileEntry.name}: ${missingBlocks.length} missing blocks to read`);

      if (missingBlocks.length > 0) {
        await readAkaiBlocksInto(
          client, targetId, sectorSize,
          missingBlocks, buffer, partitionByteOffset,
        );
      }
    },
    [client],
  );

  /**
   * Read file data on demand and convert an Akai sample to WAV.
   */
  const downloadSample = useCallback(
    async (
      targetId: number,
      partitionData: Uint8Array,
      fileEntry: AkaiDiskFileEntry,
    ): Promise<Blob> => {
      await ensureFileBlocks(targetId, fileEntry);
      const partitions = parsePartitionTable(partitionData);
      const partStart = partitions.length > 0
        ? partitions[0].offsetInBlocks * BLOCK_SIZE
        : 0;
      const partView = partitionData.subarray(partStart);
      const fileData = readFileData(partView, fileEntry);
      const header = parseSampleHeaderFromDisk(fileData);
      const pcm = extractSampleAudio(fileData, header);
      const wav = akaiSampleToWav(header, pcm);
      return new Blob([new Uint8Array(wav)], { type: 'audio/wav' });
    },
    [ensureFileBlocks],
  );

  /**
   * Read file data on demand and parse an Akai program.
   */
  const downloadProgram = useCallback(
    async (
      targetId: number,
      partitionData: Uint8Array,
      fileEntry: AkaiDiskFileEntry,
    ): Promise<AkaiDiskProgram> => {
      await ensureFileBlocks(targetId, fileEntry);
      const partitions = parsePartitionTable(partitionData);
      const partStart = partitions.length > 0
        ? partitions[0].offsetInBlocks * BLOCK_SIZE
        : 0;
      const partView = partitionData.subarray(partStart);
      const fileData = readFileData(partView, fileEntry);
      return parseProgramFromDisk(fileData);
    },
    [ensureFileBlocks],
  );

  return {
    ...state,
    scanTargets,
    loadDiskData,
    downloadSample,
    downloadProgram,
    ensureFileBlocks,
    client,
  };
}

export { parsePartitionTable, parseVolumeList, parseFileList };
export { FILE_TYPE_SAMPLE, FILE_TYPE_PROGRAM } from '@audiocontrol/sampler-devices/s3k';
