/**
 * DiskBrowserPanel — displays the contents of Akai-formatted SCSI disks.
 *
 * Scans SCSI IDs 0-5 for disk targets, then shows a tree of partitions,
 * volumes, and files. Samples can be downloaded as WAV by double-clicking.
 * Programs display their keygroup structure on selection.
 */

import { useEffect, useState, useImperativeHandle, type MouseEvent } from 'react';
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
import { ContextMenu, ChevronIcon, type ContextMenuAction } from '@audiocontrol/editor-core';

// ---------------------------------------------------------------------------
// Session cache — show previous disk tree instantly on reload
// ---------------------------------------------------------------------------

const DISK_CACHE_KEY = 's3k-disk-browser-cache';

interface DiskBrowserCache {
  targets: DiskTarget[];
  volumes: Record<number, VolumeWithFiles[]>;
  expandedTarget: number | null;
}

function loadDiskCache(): DiskBrowserCache | null {
  try {
    const raw = sessionStorage.getItem(DISK_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DiskBrowserCache;
  } catch {
    return null;
  }
}

function saveDiskCache(targets: DiskTarget[], volumes: Map<number, VolumeWithFiles[]>, expandedTarget: number | null): void {
  if (targets.length === 0) return;
  try {
    const volumeObj: Record<number, VolumeWithFiles[]> = {};
    volumes.forEach((v, k) => { volumeObj[k] = v; });
    sessionStorage.setItem(DISK_CACHE_KEY, JSON.stringify({ targets, volumes: volumeObj, expandedTarget }));
  } catch {
    // sessionStorage full or unavailable
  }
}

const cachedDisk = loadDiskCache();

/** Custom MIME type for dragging disk browser items to the library. */
export const DISK_ITEM_MIME = 'application/x-akai-disk-item';

/** Serializable drag payload for disk browser items. */
export interface DiskDragPayload {
  file: AkaiDiskFileEntry;
  targetId: number;
  volumeStartBlock: number;
}

interface VolumeWithFiles {
  name: string;
  startBlock: number;
  files: AkaiDiskFileEntry[];
}

/** Imperative handle for resolving disk drag payloads to save context. */
export interface DiskBrowserHandle {
  resolveDragPayload(payload: DiskDragPayload): {
    partitionData: Uint8Array;
    ensureFileBlocks: (fileEntry: AkaiDiskFileEntry) => Promise<void>;
  } | null;
}

interface Props {
  bridgeUrl: string | null;
  /** Called when the user wants to save a file to the library. */
  onSaveToLibrary?: (
    file: AkaiDiskFileEntry,
    targetId: number,
    partitionData: Uint8Array,
    volumeStartBlock: number,
    ensureFileBlocks: (fileEntry: AkaiDiskFileEntry) => Promise<void>,
  ) => void;
  /** Ref for imperative access to disk browser state (for drag-drop). */
  browserRef?: React.Ref<DiskBrowserHandle>;
}

export function DiskBrowserPanel({ bridgeUrl, onSaveToLibrary, browserRef }: Props) {
  const {
    loading,
    error,
    targets,
    scanTargets,
    loadDiskData,
    partitionData,
    ensureFileBlocks,
  } = useDiskBrowser(bridgeUrl, cachedDisk?.targets);

  // Expose imperative handle for drag-drop resolution
  useImperativeHandle(browserRef, () => ({
    resolveDragPayload(payload: DiskDragPayload) {
      const data = partitionData.get(payload.targetId);
      if (!data) return null;
      const partitions = parsePartitionTable(data);
      for (const partition of partitions) {
        const partStart = partition.offsetInBlocks * BLOCK_SIZE;
        if (partStart + BLOCK_SIZE > data.length) continue;
        const partData = data.subarray(partStart);
        const vols = parseVolumeList(partData);
        if (vols.some(v => v.startBlock === payload.volumeStartBlock)) {
          const boundEnsure = (f: AkaiDiskFileEntry) => ensureFileBlocks(payload.targetId, f);
          return { partitionData: partData, ensureFileBlocks: boundEnsure };
        }
      }
      return null;
    },
  }), [partitionData, ensureFileBlocks]);

  const [expandedTarget, setExpandedTarget] = useState<number | null>(cachedDisk?.expandedTarget ?? null);
  const [loadingTarget, setLoadingTarget] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState<AkaiDiskFileEntry | null>(null);
  const [savingFile, setSavingFile] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [volumes, setVolumes] = useState<Map<number, VolumeWithFiles[]>>(() => {
    if (!cachedDisk) return new Map();
    const map = new Map<number, VolumeWithFiles[]>();
    for (const [k, v] of Object.entries(cachedDisk.volumes)) {
      map.set(Number(k), v);
    }
    return map;
  });

  useEffect(() => {
    if (bridgeUrl) {
      scanTargets();
    }
  }, [bridgeUrl, scanTargets]);

  // Write-through: cache targets when they arrive from scan
  useEffect(() => {
    if (targets.length > 0) {
      saveDiskCache(targets, volumes, expandedTarget);
    }
  }, [targets]);

  const handleExpandTarget = async (target: DiskTarget) => {
    if (expandedTarget === target.id) {
      setExpandedTarget(null);
      return;
    }
    setExpandedTarget(target.id);

    let data = partitionData.get(target.id);
    if (!data) {
      setLoadingTarget(target.id);
      try {
        data = (await loadDiskData(target.id)) ?? undefined;
      } finally {
        setLoadingTarget(null);
      }
    }
    if (!data) return;

    try {
      const partitions = parsePartitionTable(data);
      console.log(`[DiskBrowser] Loaded ${data.length} bytes, ${partitions.length} partitions`);
      const allVolumes: VolumeWithFiles[] = [];

      for (const partition of partitions) {
        const partStart = partition.offsetInBlocks * BLOCK_SIZE;
        console.log(`[DiskBrowser] Partition: offset=${partition.offsetInBlocks} blocks, start=${partStart} bytes, data.length=${data.length}`);
        if (partStart + BLOCK_SIZE > data.length) {
          console.log(`[DiskBrowser] Skipping partition — extends beyond loaded data`);
          continue;
        }
        const partData = data.subarray(partStart);
        const vols: AkaiDiskVolumeEntry[] = parseVolumeList(partData);
        console.log(`[DiskBrowser] Found ${vols.length} volumes in partition`);
        for (const vol of vols) {
          const files = parseFileList(partData, vol.startBlock);
          console.log(`[DiskBrowser] Volume "${vol.name}": ${files.length} files`);
          allVolumes.push({ name: vol.name, startBlock: vol.startBlock, files });
        }
      }

      setVolumes((prev) => {
        const next = new Map(prev);
        next.set(target.id, allVolumes);
        saveDiskCache(targets, next, target.id);
        return next;
      });
    } catch (err) {
      console.error('Failed to parse disk structure:', err);
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

      {loading && targets.length === 0 && (
        <p className="text-sm text-gray-400 animate-pulse">Scanning SCSI bus...</p>
      )}

      {targets.length === 0 && !loading && (
        <p className="text-sm text-gray-500 italic">No SCSI disks found</p>
      )}

      {saveError && (
        <div className="mb-2 px-2 py-1.5 bg-red-900/50 border border-red-700 rounded text-sm text-red-300">
          {saveError}
          <button
            type="button"
            className="ml-2 text-red-400 hover:text-red-200 underline"
            onClick={() => setSaveError(null)}
          >
            dismiss
          </button>
        </div>
      )}

      <div className="space-y-1">
        {targets.map((target) => (
          <TargetNode
            key={target.id}
            target={target}
            expanded={expandedTarget === target.id}
            loading={loadingTarget === target.id}
            volumes={volumes.get(target.id) ?? []}
            selectedFile={selectedFile}
            onToggle={() => handleExpandTarget(target)}
            onSelectFile={setSelectedFile}
            savingFile={savingFile}
            onSaveToLibrary={onSaveToLibrary ? async (file, vol) => {
              setSaveError(null);
              setSavingFile(file.name);
              try {
                const data = partitionData.get(target.id);
                if (!data) {
                  throw new Error('Disk data not loaded — try collapsing and re-expanding the target');
                }

                // Only load the clicked file's blocks — not the entire volume.
                await ensureFileBlocks(target.id, file);

                const partitions = parsePartitionTable(data);
                for (const partition of partitions) {
                  const partStart = partition.offsetInBlocks * BLOCK_SIZE;
                  if (partStart + BLOCK_SIZE > data.length) continue;
                  const partData = data.subarray(partStart);
                  const vols = parseVolumeList(partData);
                  if (vols.some(v => v.startBlock === vol.startBlock)) {
                    const boundEnsure = (f: AkaiDiskFileEntry) => ensureFileBlocks(target.id, f);
                    onSaveToLibrary(file, target.id, partData, vol.startBlock, boundEnsure);
                    return;
                  }
                }
                throw new Error('Could not find volume for file — try re-scanning the disk');
              } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                console.error('[DiskBrowser] Save to library failed:', message);
                setSaveError(`Failed to save "${file.name}": ${message}`);
              } finally {
                setSavingFile(null);
              }
            } : undefined}
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
  loading: boolean;
  volumes: VolumeWithFiles[];
  selectedFile: AkaiDiskFileEntry | null;
  savingFile: string | null;
  onToggle: () => void;
  onSelectFile: (file: AkaiDiskFileEntry) => void;
  onSaveToLibrary?: (file: AkaiDiskFileEntry, volume: VolumeWithFiles) => void;
}

function TargetNode({
  target,
  expanded,
  loading,
  volumes,
  selectedFile,
  savingFile,
  onToggle,
  onSelectFile,
  onSaveToLibrary,
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
        <ChevronIcon isExpanded={expanded} />
        <span>
          ID {target.id}: {target.vendor.trim()} {target.product.trim()}
        </span>
        <span className="text-gray-500 ml-auto tabular-nums">{sizeMB} MB</span>
      </button>

      {expanded && loading && (
        <div className="ml-6 py-2 text-sm text-gray-400 animate-pulse">
          Reading disk...
        </div>
      )}

      {expanded && !loading &&
        volumes.map((vol, vi) => (
          <VolumeNode
            key={vi}
            volume={vol}
            targetId={target.id}
            selectedFile={selectedFile}
            savingFile={savingFile}
            onSelectFile={onSelectFile}
            onSaveToLibrary={onSaveToLibrary ? (file) => onSaveToLibrary(file, vol) : undefined}
          />
        ))}

      {expanded && !loading && volumes.length === 0 && (
        <p className="ml-6 py-1 text-xs text-gray-600 italic">No volumes found</p>
      )}
    </div>
  );
}

interface VolumeNodeProps {
  volume: VolumeWithFiles;
  targetId: number;
  selectedFile: AkaiDiskFileEntry | null;
  savingFile: string | null;
  onSelectFile: (file: AkaiDiskFileEntry) => void;
  onSaveToLibrary?: (file: AkaiDiskFileEntry) => void;
}

function VolumeNode({
  volume,
  targetId,
  selectedFile,
  savingFile,
  onSelectFile,
  onSaveToLibrary,
}: VolumeNodeProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="ml-4">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left text-sm font-medium text-gray-400 py-1 px-2 rounded hover:bg-gray-700 flex items-center gap-1"
      >
        <ChevronIcon isExpanded={expanded} />
        <span>{volume.name}</span>
        <span className="text-gray-500 ml-auto text-xs">{volume.files.length} files</span>
      </button>
      {expanded && volume.files.length === 0 && (
        <p className="text-xs text-gray-600 italic pl-6">Empty</p>
      )}
      {expanded && volume.files.map((file, fi) => (
        <FileNode
          key={fi}
          file={file}
          targetId={targetId}
          volumeStartBlock={volume.startBlock}
          isSelected={selectedFile === file}
          isSaving={savingFile === file.name}
          onSelect={() => onSelectFile(file)}
          onSaveToLibrary={onSaveToLibrary ? () => onSaveToLibrary(file) : undefined}
        />
      ))}
    </div>
  );
}

interface FileNodeProps {
  file: AkaiDiskFileEntry;
  targetId: number;
  volumeStartBlock: number;
  isSelected: boolean;
  isSaving: boolean;
  onSelect: () => void;
  onSaveToLibrary?: () => void;
}

function FileNode({ file, targetId, volumeStartBlock, isSelected, isSaving, onSelect, onSaveToLibrary }: FileNodeProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const typeLabel =
    file.type === FILE_TYPE_SAMPLE
      ? 'Sample'
      : file.type === FILE_TYPE_PROGRAM
        ? 'Program'
        : `Type ${file.type}`;

  const sizeKB = file.size > 0 ? `${Math.round(file.size / 1024)} KB` : '';

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    onSelect();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleDragStart = (e: React.DragEvent) => {
    const payload: DiskDragPayload = { file, targetId, volumeStartBlock };
    e.dataTransfer.setData(DISK_ITEM_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copy';
    console.log('[DiskBrowser] drag started:', file.name);
  };

  const actions: ContextMenuAction[] = [];
  if (onSaveToLibrary && !isSaving) {
    actions.push({
      label: 'Save to Library',
      onClick: () => { onSaveToLibrary(); },
    });
  }

  return (
    <>
      <button
        type="button"
        draggable
        className={`w-full text-left flex items-center gap-1 px-6 py-0.5 text-sm rounded transition-colors cursor-pointer ${
          isSelected
            ? 'bg-blue-600 text-white'
            : 'text-gray-300 hover:bg-gray-700'
        }`}
        onClick={onSelect}
        onDragStart={handleDragStart}
        onContextMenu={handleContextMenu}
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
        {isSelected && onSaveToLibrary && (
          <span
            role="button"
            tabIndex={0}
            aria-disabled={isSaving}
            onClick={(e) => { e.stopPropagation(); if (!isSaving) onSaveToLibrary(); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !isSaving) { e.stopPropagation(); onSaveToLibrary(); } }}
            className={`ml-1 ${isSaving ? 'text-gray-500 animate-pulse' : 'text-blue-200 hover:text-white'}`}
            title="Save to Library"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v12m0 0l-4-4m4 4l4-4M4 18h16" />
            </svg>
          </span>
        )}
      </button>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={actions}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
