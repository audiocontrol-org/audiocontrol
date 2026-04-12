/**
 * DeviceMemoryPanel — displays programs and samples resident in device memory.
 *
 * Renders two scrollable lists (programs and samples) fetched from the
 * S3000XL. Supports item selection, manual refresh, and drag-and-drop
 * import from the library tree.
 */

import { useState } from 'react';
import { LIBRARY_ITEM_MIME, LoadingBar, ContextMenu, type LibraryDragPayload, type ContextMenuAction } from '@audiocontrol/editor-core';
import { DISK_ITEM_MIME, type DiskDragPayload } from '@/components/library/DiskBrowserPanel';

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
  isConnected: boolean;
  isLoading: boolean;
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
}) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; index: number } | null>(null);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

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

  return (
    <div className="mb-4">
      <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-1">
        {title} ({names.length})
      </h4>
      <ul className="overflow-y-auto space-y-px">
        {names.map((name, index) => {
          const isSelected = selectedType === type && selectedIndex === index;
          const isDeleting = deletingIndex === index;
          return (
            <li key={index}>
              <button
                type="button"
                data-testid={`device-${type}-${index}`}
                disabled={isDeleting}
                className={`group w-full text-left flex items-center px-2 py-1 text-sm rounded transition-colors ${
                  isDeleting
                    ? 'opacity-50 animate-pulse text-gray-500'
                    : isSelected
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700'
                }`}
                onClick={() => !isDeleting && onSelect(index)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (isDeleting) return;
                  onSelect(index);
                  setContextMenu({ x: e.clientX, y: e.clientY, index });
                }}
              >
                <span className={`mr-2 tabular-nums ${isDeleting ? 'text-gray-600' : isSelected ? 'text-blue-200' : 'text-gray-500'}`}>{index}:</span>
                <span className="flex-1 truncate">{isDeleting ? `Deleting ${name}...` : name}</span>
                {onDelete && !isDeleting && (
                  <span
                    role="button"
                    tabIndex={0}
                    className={`ml-1 opacity-0 group-hover:opacity-100 transition-opacity ${isSelected ? 'text-blue-200 hover:text-red-300' : 'text-gray-500 hover:text-red-400'}`}
                    title="Delete from device"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingIndex(index);
                      Promise.resolve(onDelete(index, name)).finally(() => setDeletingIndex(null));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.stopPropagation();
                        setDeletingIndex(index);
                        Promise.resolve(onDelete(index, name)).finally(() => setDeletingIndex(null));
                      }
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a2 2 0 01-2 2H8a2 2 0 01-2-2V6h12" />
                    </svg>
                  </span>
                )}
              </button>
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
          actions.push({ label: 'Rename', onClick: () => onRename(contextMenu.index, name) });
        }
        if (onDelete) {
          if (actions.length > 0 && !onRename) {
            actions.push({ label: '', onClick: () => {}, separator: true });
          }
          actions.push({ label: 'Delete from Device', onClick: () => onDelete(contextMenu.index, name), danger: true });
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
          onDelete={onDeleteSample}
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

