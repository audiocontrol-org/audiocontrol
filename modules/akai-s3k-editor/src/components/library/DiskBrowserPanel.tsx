/**
 * DiskBrowserPanel — displays the contents of Akai-formatted SCSI disks.
 *
 * Scans SCSI IDs 0-5 for disk targets, then shows a tree of partitions,
 * volumes, and files. Samples can be downloaded as WAV by double-clicking.
 * Programs display their keygroup structure on selection.
 */

import { useEffect, useState } from 'react';
import type { AkaiDiskFileEntry, AkaiDiskVolumeEntry } from '@audiocontrol/sampler-devices/s3k';
import {
  useDiskBrowser,
  parsePartitionTable,
  parseVolumeList,
  parseFileList,
  FILE_TYPE_SAMPLE,
  FILE_TYPE_PROGRAM,
  type DiskTarget,
} from '@/hooks/useDiskBrowser';
import { BLOCK_SIZE } from '@audiocontrol/sampler-devices/s3k';

interface VolumeWithFiles {
  name: string;
  files: AkaiDiskFileEntry[];
}

interface Props {
  bridgeUrl: string | null;
}

export function DiskBrowserPanel({ bridgeUrl }: Props) {
  const {
    loading,
    error,
    targets,
    scanTargets,
    loadDiskData,
    partitionData,
    downloadSample,
  } = useDiskBrowser(bridgeUrl);

  const [expandedTarget, setExpandedTarget] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<AkaiDiskFileEntry | null>(null);
  const [volumes, setVolumes] = useState<Map<number, VolumeWithFiles[]>>(
    new Map(),
  );

  useEffect(() => {
    if (bridgeUrl) {
      scanTargets();
    }
  }, [bridgeUrl, scanTargets]);

  const handleExpandTarget = async (target: DiskTarget) => {
    if (expandedTarget === target.id) {
      setExpandedTarget(null);
      return;
    }
    setExpandedTarget(target.id);

    let data = partitionData.get(target.id);
    if (!data) {
      data = (await loadDiskData(target.id)) ?? undefined;
    }
    if (!data) return;

    try {
      const partitions = parsePartitionTable(data);
      const allVolumes: VolumeWithFiles[] = [];

      for (const partition of partitions) {
        const partStart = partition.offsetInBlocks * BLOCK_SIZE;
        if (partStart + BLOCK_SIZE > data.length) {
          // Partition extends beyond loaded data; skip for now.
          continue;
        }
        const partData = data.subarray(partStart);
        const vols: AkaiDiskVolumeEntry[] = parseVolumeList(partData);
        for (const vol of vols) {
          const files = parseFileList(partData, vol.startBlock);
          allVolumes.push({ name: vol.name, files });
        }
      }

      setVolumes((prev) => {
        const next = new Map(prev);
        next.set(target.id, allVolumes);
        return next;
      });
    } catch (err) {
      console.error('Failed to parse disk structure:', err);
    }
  };

  const handleDownload = async (
    targetId: number,
    file: AkaiDiskFileEntry,
  ) => {
    const data = partitionData.get(targetId);
    if (!data) return;

    // Find the partition that contains this file. The file's startBlock is
    // relative to the partition, so we need the partition-level subarray.
    const partitions = parsePartitionTable(data);
    for (const partition of partitions) {
      const partStart = partition.offsetInBlocks * BLOCK_SIZE;
      if (partStart + BLOCK_SIZE > data.length) continue;
      const partData = data.subarray(partStart);

      try {
        const blob = await downloadSample(partData, file);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${file.name.trim()}.wav`;
        a.click();
        URL.revokeObjectURL(url);
        return;
      } catch {
        // File might not be in this partition; try the next one.
      }
    }
  };

  if (!bridgeUrl) {
    return (
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-100 mb-2">
          SCSI Disks
        </h3>
        <p className="text-sm text-gray-400 italic">
          SCSI transport not active.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-100">SCSI Disks</h3>
        <button
          type="button"
          className="text-gray-400 hover:text-gray-200 text-lg px-1 disabled:opacity-50"
          onClick={() => scanTargets()}
          disabled={loading}
          title="Scan SCSI bus"
        >
          {loading ? '...' : '\u21BB'}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-400 mb-2">{error}</p>
      )}

      {targets.length === 0 && !loading && (
        <p className="text-sm text-gray-500 italic">No SCSI disks found</p>
      )}

      <div className="space-y-1">
        {targets.map((target) => (
          <TargetNode
            key={target.id}
            target={target}
            expanded={expandedTarget === target.id}
            volumes={volumes.get(target.id) ?? []}
            selectedFile={selectedFile}
            onToggle={() => handleExpandTarget(target)}
            onSelectFile={setSelectedFile}
            onDownloadSample={(file) => handleDownload(target.id, file)}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface TargetNodeProps {
  target: DiskTarget;
  expanded: boolean;
  volumes: VolumeWithFiles[];
  selectedFile: AkaiDiskFileEntry | null;
  onToggle: () => void;
  onSelectFile: (file: AkaiDiskFileEntry) => void;
  onDownloadSample: (file: AkaiDiskFileEntry) => void;
}

function TargetNode({
  target,
  expanded,
  volumes,
  selectedFile,
  onToggle,
  onSelectFile,
  onDownloadSample,
}: TargetNodeProps) {
  const sizeMB = Math.round(
    (target.blockCount * target.blockSize) / 1024 / 1024,
  );

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-2 py-1 text-sm rounded transition-colors text-gray-300 hover:bg-gray-700 flex items-center gap-1"
      >
        <span className="text-gray-500">{expanded ? '\u25BE' : '\u25B8'}</span>
        <span>
          ID {target.id}: {target.vendor.trim()} {target.product.trim()}
        </span>
        <span className="text-gray-500 ml-auto tabular-nums">{sizeMB} MB</span>
      </button>

      {expanded &&
        volumes.map((vol, vi) => (
          <VolumeNode
            key={vi}
            volume={vol}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
            onDownloadSample={onDownloadSample}
          />
        ))}
    </div>
  );
}

interface VolumeNodeProps {
  volume: VolumeWithFiles;
  selectedFile: AkaiDiskFileEntry | null;
  onSelectFile: (file: AkaiDiskFileEntry) => void;
  onDownloadSample: (file: AkaiDiskFileEntry) => void;
}

function VolumeNode({
  volume,
  selectedFile,
  onSelectFile,
  onDownloadSample,
}: VolumeNodeProps) {
  return (
    <div className="ml-4">
      <div className="text-sm font-medium text-gray-400 py-1 px-2">
        {volume.name}
      </div>
      {volume.files.length === 0 && (
        <p className="text-xs text-gray-600 italic pl-6">Empty</p>
      )}
      {volume.files.map((file, fi) => (
        <FileNode
          key={fi}
          file={file}
          isSelected={selectedFile === file}
          onSelect={() => onSelectFile(file)}
          onDoubleClick={() => {
            if (file.type === FILE_TYPE_SAMPLE) {
              onDownloadSample(file);
            }
          }}
        />
      ))}
    </div>
  );
}

interface FileNodeProps {
  file: AkaiDiskFileEntry;
  isSelected: boolean;
  onSelect: () => void;
  onDoubleClick: () => void;
}

function FileNode({ file, isSelected, onSelect, onDoubleClick }: FileNodeProps) {
  const typeLabel =
    file.type === FILE_TYPE_SAMPLE
      ? 'Sample'
      : file.type === FILE_TYPE_PROGRAM
        ? 'Program'
        : `Type ${file.type}`;

  const sizeKB = file.size > 0 ? `${Math.round(file.size / 1024)} KB` : '';

  return (
    <button
      type="button"
      className={`w-full text-left flex items-center gap-1 px-6 py-0.5 text-sm rounded transition-colors cursor-pointer ${
        isSelected
          ? 'bg-blue-600 text-white'
          : 'text-gray-300 hover:bg-gray-700'
      }`}
      onClick={onSelect}
      onDoubleClick={onDoubleClick}
    >
      <span>{file.name}</span>
      <span
        className={`ml-auto tabular-nums ${
          isSelected ? 'text-blue-200' : 'text-gray-500'
        }`}
      >
        {typeLabel}
        {sizeKB && ` (${sizeKB})`}
      </span>
    </button>
  );
}
