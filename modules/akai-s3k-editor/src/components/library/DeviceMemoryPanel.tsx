/**
 * DeviceMemoryPanel — displays programs and samples resident in device memory.
 *
 * Renders two scrollable lists (programs and samples) fetched from the
 * S3000XL. Supports item selection, manual refresh, and drag-and-drop
 * import from the library tree.
 *
 * Items in the panel are draggable so they can be dropped onto the library
 * tree to trigger an export (program) or receive (sample) transfer.
 */

import { useState, useCallback } from 'react';
import { LIBRARY_ITEM_MIME, LoadingBar, ContextMenu, ConfirmDialog, DeleteIcon, CloneIcon, type LibraryDragPayload, type ContextMenuAction } from '@audiocontrol/editor-core';
import { cn } from '@/lib/utils';
import { DISK_ITEM_MIME, type DiskDragPayload } from '@/components/library/DiskBrowserPanel';

/** MIME type for device memory items dragged from the DeviceMemoryPanel. */
export const DEVICE_MEMORY_MIME = 'application/x-s3k-device-item';

/** Drag payload for device memory items. */
export interface DeviceMemoryDragPayload {
  source: 'device-memory';
  type: 'program' | 'sample';
  index: number;
  name: string;
}

interface DeviceMemoryPanelProps {
  programNames: string[];
  sampleNames: string[];
  selectedIndex: number | null;
  selectedType: 'program' | 'sample' | null;
  onSelectProgram: (index: number) => void;
  onSelectSample: (index: number) => void;
  onRefresh: () => void;
  onImportSample?: (sampleName: string, samplePath: string[]) => void;
  onImportProgram?: (dirName: string, displayName: string, categoryId: string) => void;
  /** Called when a disk browser item is dropped on the device memory panel. */
  onDiskItemDrop?: (payload: DiskDragPayload) => void;
  /** Save a device sample to the common library area. */
  onSaveSampleToCommonLibrary?: (index: number, name: string) => void;
  /** Save a device sample to the Akai device-specific library area. */
  onSaveSampleToDeviceLibrary?: (index: number, name: string) => void;
  /** Save a device program to the common library area. */
  onSaveProgramToCommonLibrary?: (index: number, name: string) => void;
  /** Save a device program to the Akai device-specific library area. */
  onSaveProgramToDeviceLibrary?: (index: number, name: string) => void;
  /** Rename a device sample. */
  onRenameSample?: (index: number, name: string) => void;
  /** Rename a device program. */
  onRenameProgram?: (index: number, name: string) => void;
  /** Delete a sample from device memory. */
  onDeleteSample?: (index: number, name: string) => void;
  /** Delete a program from device memory. */
  onDeleteProgram?: (index: number, name: string) => void;
  /** Clone a program on the device. */
  onCloneProgram?: (index: number, name: string) => void;
  /** Clone a sample on the device. */
  onCloneSample?: (index: number, name: string) => void;
  isConnected: boolean;
  isLoading: boolean;
}

/** Inline text input for renaming device memory items. */
function InlineRenameInput({
  value,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const handleRef = useCallback((el: HTMLInputElement | null) => {
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit(value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }, [value, onSubmit, onCancel]);

  return (
    <input
      ref={handleRef}
      type="text"
      className="flex-1 bg-gray-800 text-gray-100 text-sm px-1 py-0 border border-blue-500 rounded outline-none"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => onSubmit(value)}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

function NameList({
  title,
  names,
  type,
  selectedIndex,
  selectedType,
  onSelect,
  onSaveToCommonLibrary,
  onSaveToDeviceLibrary,
  onRename,
  onDelete,
  onClone,
  draggable: isDraggable,
}: {
  title: string;
  names: string[];
  type: 'program' | 'sample';
  selectedIndex: number | null;
  selectedType: 'program' | 'sample' | null;
  onSelect: (index: number) => void;
  onSaveToCommonLibrary?: (index: number, name: string) => void;
  onSaveToDeviceLibrary?: (index: number, name: string) => void;
  onRename?: (index: number, name: string) => void;
  onDelete?: (index: number, name: string) => void;
  onClone?: (index: number, name: string) => void;
  /** When true, each list item is draggable with DEVICE_MEMORY_MIME payload. */
  draggable?: boolean;
}) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; index: number } | null>(null);
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  if (names.length === 0) {
    return (
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-1">
          {title}
        </h4>
        <p className="text-sm text-gray-500 italic">None</p>
      </div>
    );
  }

  const confirmDeleteName = confirmDeleteIndex !== null ? names[confirmDeleteIndex] : undefined;

  return (
    <div className="mb-4">
      <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-1">
        {title} ({names.length})
      </h4>
      <ul className="overflow-y-auto space-y-px">
        {names.map((name, index) => {
          const isSelected = selectedType === type && selectedIndex === index;
          return (
            <li key={index} className="group relative">
              <button
                type="button"
                data-testid={`device-${type}-${index}`}
                className={cn(
                  'w-full text-left flex items-center px-2 py-1 text-sm rounded transition-colors',
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700',
                  isDraggable && 'cursor-grab active:cursor-grabbing',
                )}
                draggable={isDraggable}
                onDragStart={isDraggable ? (e) => {
                  const payload: DeviceMemoryDragPayload = {
                    source: 'device-memory',
                    type,
                    index,
                    name,
                  };
                  e.dataTransfer.setData(DEVICE_MEMORY_MIME, JSON.stringify(payload));
                  e.dataTransfer.effectAllowed = 'copy';
                } : undefined}
                onClick={() => onSelect(index)}
                onDoubleClick={() => {
                  if (onRename) {
                    setRenamingIndex(index);
                    setRenameValue(name);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onSelect(index);
                  setContextMenu({ x: e.clientX, y: e.clientY, index });
                }}
              >
                <span className={cn('mr-2 tabular-nums', isSelected ? 'text-blue-200' : 'text-gray-500')}>{index}:</span>
                {renamingIndex === index && onRename ? (
                  <InlineRenameInput
                    value={renameValue}
                    onChange={setRenameValue}
                    onSubmit={(newName) => {
                      if (newName.trim() && newName.trim() !== name) {
                        onRename(index, newName.trim());
                      }
                      setRenamingIndex(null);
                    }}
                    onCancel={() => setRenamingIndex(null)}
                  />
                ) : (
                  <span className="flex-1 truncate">{name}</span>
                )}
              </button>
              {(onClone || onDelete) && renamingIndex !== index && (
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onClone && (
                    <button
                      type="button"
                      className={cn(
                        'ac-list-action-btn',
                        isSelected && 'ac-list-action-btn--selected',
                      )}
                      title={`Clone ${type}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onClone(index, name);
                      }}
                    >
                      <CloneIcon />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      type="button"
                      className={cn(
                        'ac-list-action-btn',
                        isSelected && 'ac-list-action-btn--selected',
                        'ac-list-action-btn--danger',
                      )}
                      title="Delete from device"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteIndex(index);
                      }}
                    >
                      <DeleteIcon />
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {contextMenu && (() => {
        const name = names[contextMenu.index];
        const commonLabel = type === 'program' ? 'Save to Common Library' : 'Save to Common Samples';
        const deviceLabel = type === 'program' ? 'Save to Akai Library' : 'Save to Akai Samples';
        const actions: ContextMenuAction[] = [];
        if (onSaveToCommonLibrary) {
          actions.push({ label: commonLabel, onClick: () => onSaveToCommonLibrary(contextMenu.index, name) });
        }
        if (onSaveToDeviceLibrary) {
          actions.push({ label: deviceLabel, onClick: () => onSaveToDeviceLibrary(contextMenu.index, name) });
        }
        if (onRename) {
          if (actions.length > 0) {
            actions.push({ label: '', onClick: () => {}, separator: true });
          }
          actions.push({ label: 'Rename', onClick: () => {
            setRenamingIndex(contextMenu.index);
            setRenameValue(name);
          } });
        }
        if (onClone) {
          actions.push({ label: 'Clone', onClick: () => onClone(contextMenu.index, name) });
        }
        if (onDelete) {
          if (actions.length > 0 && !onRename && !onClone) {
            actions.push({ label: '', onClick: () => {}, separator: true });
          }
          actions.push({ label: 'Delete from Device', onClick: () => setConfirmDeleteIndex(contextMenu.index), danger: true });
        }
        if (actions.length === 0) return null;
        return (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            actions={actions}
            onClose={() => setContextMenu(null)}
          />
        );
      })()}
      {onDelete && (
        <ConfirmDialog
          open={confirmDeleteIndex !== null}
          title={`Delete ${type === 'program' ? 'Program' : 'Sample'}`}
          message={deleteInProgress
            ? `Deleting ${confirmDeleteName ?? ''}...`
            : `Delete '${confirmDeleteName ?? ''}' from device? This cannot be undone.`}
          confirmLabel={deleteInProgress ? 'Deleting...' : 'Delete'}
          cancelLabel="Cancel"
          danger
          onConfirm={() => {
            if (confirmDeleteIndex === null || deleteInProgress) return;
            setDeleteInProgress(true);
            Promise.resolve(onDelete(confirmDeleteIndex, names[confirmDeleteIndex]!))
              .finally(() => {
                setDeleteInProgress(false);
                setConfirmDeleteIndex(null);
              });
          }}
          onCancel={() => {
            if (!deleteInProgress) setConfirmDeleteIndex(null);
          }}
        />
      )}
    </div>
  );
}

export function DeviceMemoryPanel({
  programNames,
  sampleNames,
  selectedIndex,
  selectedType,
  onSelectProgram,
  onSelectSample,
  onRefresh,
  onImportSample,
  onImportProgram,
  onDiskItemDrop,
  onSaveSampleToCommonLibrary,
  onSaveSampleToDeviceLibrary,
  onSaveProgramToCommonLibrary,
  onSaveProgramToDeviceLibrary,
  onRenameSample,
  onRenameProgram,
  onDeleteSample,
  onDeleteProgram,
  onCloneProgram,
  onCloneSample,
  isConnected,
  isLoading,
}: DeviceMemoryPanelProps): JSX.Element {
  const [programDropOver, setProgramDropOver] = useState(false);
  const [sampleDropOver, setSampleDropOver] = useState(false);
  const hasData = programNames.length > 0 || sampleNames.length > 0;
  if (!isConnected && !hasData) {
    return (
      <div>
        <div className="ac-panel-header">
          <span className="ac-panel-header-title">Device Memory</span>
        </div>
        <div className="p-3">
          <p className="text-sm text-gray-400 italic">
            Connect to S3000XL first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="ac-panel-header">
        <span className="ac-panel-header-title">Device Memory</span>
        <button
          type="button"
          className="ac-panel-refresh-btn"
          onClick={onRefresh}
          disabled={isLoading || !isConnected}
          title="Refresh device memory"
        >
          {isLoading ? '...' : '\u21BB'}
        </button>
      </div>
      <LoadingBar active={isLoading || (!isConnected && hasData)} />
      <div className="p-3">

      <div
        className={`rounded transition-colors ${programDropOver ? 'bg-blue-900/30 ring-1 ring-blue-500/50' : ''}`}
        onDragOver={(e) => {
          const hasLibraryProgram = e.dataTransfer.types.includes(`${LIBRARY_ITEM_MIME}/program`);
          const hasDiskItem = e.dataTransfer.types.includes(DISK_ITEM_MIME);
          if (!hasLibraryProgram && !hasDiskItem) return;
          if (hasLibraryProgram && !onImportProgram) return;
          if (hasDiskItem && !onDiskItemDrop) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          setProgramDropOver(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setProgramDropOver(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setProgramDropOver(false);
          // Handle library item drops
          const libRaw = e.dataTransfer.getData(LIBRARY_ITEM_MIME);
          if (libRaw && onImportProgram) {
            const payload = JSON.parse(libRaw) as LibraryDragPayload;
            if (payload.nodeType === 'program') {
              const dirName = (payload.meta.dirName as string | undefined) ?? payload.nodeName;
              onImportProgram(dirName, payload.nodeName, payload.categoryId);
              return;
            }
          }
          // Handle disk item drops
          const diskRaw = e.dataTransfer.getData(DISK_ITEM_MIME);
          if (diskRaw && onDiskItemDrop) {
            const payload = JSON.parse(diskRaw) as DiskDragPayload;
            onDiskItemDrop(payload);
          }
        }}
      >
        <NameList
          title="Programs"
          names={programNames}
          type="program"
          selectedIndex={selectedIndex}
          selectedType={selectedType}
          onSelect={onSelectProgram}
          onSaveToCommonLibrary={onSaveProgramToCommonLibrary}
          onSaveToDeviceLibrary={onSaveProgramToDeviceLibrary}
          onRename={onRenameProgram}
          onDelete={onDeleteProgram}
          onClone={onCloneProgram}
          draggable={isConnected && !!onSaveProgramToCommonLibrary}
        />
        {programDropOver && (
          <div className="text-xs text-blue-400 text-center py-2 border border-dashed border-blue-500/50 rounded mx-1 mb-2">
            Drop to send to device
          </div>
        )}
      </div>

      <div
        className={`rounded transition-colors ${sampleDropOver ? 'bg-blue-900/30 ring-1 ring-blue-500/50' : ''}`}
        onDragOver={(e) => {
          const hasLibrarySample = e.dataTransfer.types.includes(`${LIBRARY_ITEM_MIME}/sample`);
          const hasDiskItem = e.dataTransfer.types.includes(DISK_ITEM_MIME);
          if (!hasLibrarySample && !hasDiskItem) return;
          if (hasLibrarySample && !onImportSample) return;
          if (hasDiskItem && !onDiskItemDrop) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          setSampleDropOver(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setSampleDropOver(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setSampleDropOver(false);
          // Handle library item drops
          const libRaw = e.dataTransfer.getData(LIBRARY_ITEM_MIME);
          if (libRaw && onImportSample) {
            const payload = JSON.parse(libRaw) as LibraryDragPayload;
            if (payload.nodeType === 'sample') {
              const path = (payload.meta.path as string[] | undefined) ?? [];
              onImportSample(payload.nodeName, path);
              return;
            }
          }
          // Handle disk item drops
          const diskRaw = e.dataTransfer.getData(DISK_ITEM_MIME);
          if (diskRaw && onDiskItemDrop) {
            const payload = JSON.parse(diskRaw) as DiskDragPayload;
            onDiskItemDrop(payload);
          }
        }}
      >
        <NameList
          title="Samples"
          names={sampleNames}
          type="sample"
          selectedIndex={selectedIndex}
          selectedType={selectedType}
          onSelect={onSelectSample}
          onSaveToCommonLibrary={onSaveSampleToCommonLibrary}
          onSaveToDeviceLibrary={onSaveSampleToDeviceLibrary}
          onRename={onRenameSample}
          onClone={onCloneSample}
          onDelete={onDeleteSample}
          draggable={isConnected && !!onSaveSampleToCommonLibrary}
        />
        {sampleDropOver && (
          <div className="text-xs text-blue-400 text-center py-2 border border-dashed border-blue-500/50 rounded mx-1 mb-2">
            Drop to send to device
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

