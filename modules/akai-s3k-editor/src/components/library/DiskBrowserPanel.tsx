/**
 * DiskBrowserPanel — displays the contents of Akai-formatted SCSI disks.
 *
 * Scans SCSI IDs 0-5 for disk targets, then shows a tree of partitions,
 * volumes, and files. Samples can be downloaded as WAV by double-clicking.
 * Programs display their keygroup structure on selection.
 */

import { useEffect, useMemo, useState, useImperativeHandle, type MouseEvent } from 'react';
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
import { ContextMenu, ChevronIcon, LoadingBar, SampleIcon, ProgramIcon, type ContextMenuAction } from '@audiocontrol/editor-core';

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

// `cachedDisk` is read INSIDE the component (via useMemo) rather than at
// module-load time so a test harness can seed `sessionStorage` BEFORE
// mounting the panel — see TestLibraryFullPage for the mock-bridge
// pattern. Module-level reads are captured once when the JS module
// evaluates, which races any harness-level seeding.

/** SCSI disk icon */
function DiskIcon(): JSX.Element {
  return (
    <svg className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="2" y1="14" x2="22" y2="14" />
      <circle cx="18" cy="18" r="1" fill="currentColor" />
    </svg>
  );
}

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
  /** Called when the user wants to send a file directly to the device. */
  onSendToDevice?: (
    file: AkaiDiskFileEntry,
    targetId: number,
    partitionData: Uint8Array,
    volumeStartBlock: number,
    ensureFileBlocks: (fileEntry: AkaiDiskFileEntry) => Promise<void>,
  ) => void;
  /** Ref for imperative access to disk browser state (for drag-drop). */
  browserRef?: React.Ref<DiskBrowserHandle>;
  /**
   * Controlled-mode selected-file. When provided, the panel uses this
   * value instead of its internal selection state — lets a parent
   * (LibraryPage) coordinate single-selection across panels. When
   * `undefined`, the panel falls back to its own `useState`.
   */
  selectedFile?: AkaiDiskFileEntry | null;
  /**
   * Controlled-mode selection callback. Fires on every selection
   * change (user click on a FileNode). Pair with `selectedFile` for
   * fully controlled mode. When `undefined`, internal `setSelectedFile`
   * (uncontrolled) runs instead.
   */
  onSelectFile?: (file: AkaiDiskFileEntry | null) => void;
}

export function DiskBrowserPanel({
  bridgeUrl,
  onSaveToLibrary,
  onSendToDevice,
  browserRef,
  selectedFile: controlledSelectedFile,
  onSelectFile: controlledOnSelectFile,
}: Props) {
  // Read the disk cache via useMemo so a test harness can seed
  // sessionStorage before this panel mounts (see TestLibraryFullPage).
  // Module-level capture would race the harness's useEffect-driven
  // seeding because the module evaluates once at import time.
  const cachedDisk = useMemo(() => loadDiskCache(), []);
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
  // Controlled/uncontrolled selection state. If the parent passes
  // `selectedFile` + `onSelectFile`, this panel becomes controlled
  // (parent coordinates single-selection across the library page).
  // Otherwise the panel manages its own state.
  const [internalSelectedFile, setInternalSelectedFile] = useState<AkaiDiskFileEntry | null>(null);
  const selectedFile = controlledSelectedFile !== undefined ? controlledSelectedFile : internalSelectedFile;
  const setSelectedFile = controlledOnSelectFile ?? setInternalSelectedFile;
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


  /** Resolve disk file blocks and find its volume, then invoke the callback. */
  async function resolveDiskFile(
    targetId: number,
    file: AkaiDiskFileEntry,
    vol: VolumeWithFiles,
    callback: Props['onSaveToLibrary'] & {},
  ) {
    setSaveError(null);
    setSavingFile(file.name);
    try {
      let data = partitionData.get(targetId);
      if (!data) {
        // Partition data missing (e.g., after page reload with cached tree).
        // Reload from disk automatically.
        data = (await loadDiskData(targetId)) ?? undefined;
        if (!data) {
          throw new Error('Failed to load disk data — check SCSI connection');
        }
      }
      await ensureFileBlocks(targetId, file);
      const partitions = parsePartitionTable(data);
      for (const partition of partitions) {
        const partStart = partition.offsetInBlocks * BLOCK_SIZE;
        if (partStart + BLOCK_SIZE > data.length) continue;
        const partData = data.subarray(partStart);
        const vols = parseVolumeList(partData);
        if (vols.some(v => v.startBlock === vol.startBlock)) {
          const boundEnsure = (f: AkaiDiskFileEntry) => ensureFileBlocks(targetId, f);
          callback(file, targetId, partData, vol.startBlock, boundEnsure);
          return;
        }
      }
      throw new Error('Could not find volume for file — try re-scanning the disk');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[DiskBrowser] Operation failed:', message);
      setSaveError(`Failed: "${file.name}": ${message}`);
    } finally {
      setSavingFile(null);
    }
  }

  if (!bridgeUrl) {
    return (
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-200 mb-2">
          SCSI Disks
        </h3>
        <p className="text-sm text-gray-400 italic">
          SCSI transport not active.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="ac-panel-header">
        <span className="ac-panel-header-title">SCSI Disks</span>
        <button
          type="button"
          className="ac-panel-refresh-btn"
          onClick={() => scanTargets()}
          disabled={loading}
          title="Scan SCSI bus"
        >
          &#x21BB;
        </button>
      </div>
      <LoadingBar active={loading || loadingTarget !== null} />
      <div className="p-3">

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
            onSaveToLibrary={onSaveToLibrary ? (file, vol) => {
              void resolveDiskFile(target.id, file, vol, onSaveToLibrary);
            } : undefined}
            onSendToDevice={onSendToDevice ? (file, vol) => {
              void resolveDiskFile(target.id, file, vol, onSendToDevice);
            } : undefined}
          />
        ))}
      </div>
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
  onSendToDevice?: (file: AkaiDiskFileEntry, volume: VolumeWithFiles) => void;
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
  onSendToDevice,
}: TargetNodeProps) {
  const sizeMB = Math.round(
    (target.blockCount * target.blockSize) / 1024 / 1024,
  );

  // Clean up SCSI inquiry strings for display.
  // s2p product strings look like "SCSI HD 540 MiB" — extract just the type.
  const product = target.product.trim();
  const diskLabel = product
    .replace(/\s*\d+\s*MiB\s*$/i, '')  // strip trailing size (e.g., "540 MiB")
    .trim() || product;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-2 py-1 text-sm rounded transition-colors text-gray-300 hover:bg-gray-700 flex items-center gap-1.5"
      >
        <ChevronIcon isExpanded={expanded} />
        <DiskIcon />
        <span className="text-gray-400 tabular-nums">{target.id}</span>
        <span className="truncate">{diskLabel}</span>
        <span className="text-gray-500 ml-auto tabular-nums whitespace-nowrap">{sizeMB} MB</span>
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
            onSendToDevice={onSendToDevice ? (file) => onSendToDevice(file, vol) : undefined}
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
  onSendToDevice?: (file: AkaiDiskFileEntry) => void;
}

function VolumeNode({
  volume,
  targetId,
  selectedFile,
  savingFile,
  onSelectFile,
  onSaveToLibrary,
  onSendToDevice,
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
      {expanded && volume.files.length > 0 && (() => {
        const programs = volume.files.filter((f) => f.type === FILE_TYPE_PROGRAM);
        const samples = volume.files.filter((f) => f.type === FILE_TYPE_SAMPLE);
        const other = volume.files.filter((f) => f.type !== FILE_TYPE_PROGRAM && f.type !== FILE_TYPE_SAMPLE);
        return (
          <>
            {programs.length > 0 && (
              <div className="ml-4">
                <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 pt-2 pb-0.5">
                  Programs ({programs.length})
                </h5>
                {programs.map((file, fi) => (
                  <FileNode
                    key={`p-${fi}`}
                    file={file}
                    targetId={targetId}
                    volumeStartBlock={volume.startBlock}
                    isSelected={selectedFile === file}
                    isSaving={savingFile === file.name}
                    onSelect={() => onSelectFile(file)}
                    onSaveToLibrary={onSaveToLibrary ? () => onSaveToLibrary(file) : undefined}
                    onSendToDevice={onSendToDevice ? () => onSendToDevice(file) : undefined}
                  />
                ))}
              </div>
            )}
            {samples.length > 0 && (
              <div className="ml-4">
                <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-2 pt-2 pb-0.5">
                  Samples ({samples.length})
                </h5>
                {samples.map((file, fi) => (
                  <FileNode
                    key={`s-${fi}`}
                    file={file}
                    targetId={targetId}
                    volumeStartBlock={volume.startBlock}
                    isSelected={selectedFile === file}
                    isSaving={savingFile === file.name}
                    onSelect={() => onSelectFile(file)}
                    onSaveToLibrary={onSaveToLibrary ? () => onSaveToLibrary(file) : undefined}
                    onSendToDevice={onSendToDevice ? () => onSendToDevice(file) : undefined}
                  />
                ))}
              </div>
            )}
            {other.map((file, fi) => (
              <FileNode
                key={`o-${fi}`}
                file={file}
                targetId={targetId}
                volumeStartBlock={volume.startBlock}
                isSelected={selectedFile === file}
                isSaving={savingFile === file.name}
                onSelect={() => onSelectFile(file)}
                onSaveToLibrary={onSaveToLibrary ? () => onSaveToLibrary(file) : undefined}
                onSendToDevice={onSendToDevice ? () => onSendToDevice(file) : undefined}
              />
            ))}
          </>
        );
      })()}
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
  onSendToDevice?: () => void;
}

function FileNode({ file, targetId, volumeStartBlock, isSelected, isSaving, onSelect, onSaveToLibrary, onSendToDevice }: FileNodeProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const typeIcon = file.type === FILE_TYPE_SAMPLE
    ? <SampleIcon className="w-3 h-3 flex-shrink-0" />
    : file.type === FILE_TYPE_PROGRAM
      ? <ProgramIcon className="w-3 h-3 flex-shrink-0" />
      : null;

  const sizeKB = file.size > 0 ? `${Math.round(file.size / 1024)}K` : '';

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

  const isSample = file.type === FILE_TYPE_SAMPLE;

  const commonLabel = isSample ? 'Save to Common Samples' : 'Save to Common Library';
  const deviceLabel = isSample ? 'Save to Akai Samples' : 'Save to Akai Library';

  const actions: ContextMenuAction[] = [];
  if (onSaveToLibrary && !isSaving) {
    actions.push({ label: commonLabel, onClick: () => { onSaveToLibrary(); } });
    actions.push({ label: deviceLabel, onClick: () => { onSaveToLibrary(); } });
  }
  if (onSendToDevice && !isSaving) {
    actions.push({ label: 'Send to Device', onClick: () => { onSendToDevice(); } });
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
        <span className={isSelected ? 'text-blue-200' : 'text-gray-500'}>{typeIcon}</span>
        <span className="truncate">{file.name}</span>
        <span
          className={`ml-auto whitespace-nowrap tabular-nums ${
            isSelected ? 'text-blue-200' : 'text-gray-500'
          }`}
        >
          {sizeKB}
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
