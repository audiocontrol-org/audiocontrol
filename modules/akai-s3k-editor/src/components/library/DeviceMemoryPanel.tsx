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
  onDelete?: (index: number, name: string) => void;
}) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; index: number } | null>(null);

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
          return (
            <li key={index}>
              <button
                type="button"
                data-testid={`device-${type}-${index}`}
                className={`w-full text-left px-2 py-1 text-sm rounded transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
                onClick={() => onSelect(index)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onSelect(index);
                  setContextMenu({ x: e.clientX, y: e.clientY, index });
                }}
              >
                <span className="text-gray-500 mr-2 tabular-nums">{index}:</span>
                {name}
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
        if (onDelete) {
          actions.push({ label: 'Delete from Device', onClick: () => onDelete(contextMenu.index, name), danger: true, separator: actions.length > 0 });
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
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-100 mb-2">Device Memory</h3>
        <p className="text-sm text-gray-400 italic">
          Connect to S3000XL first.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-lg font-semibold text-gray-100">Device Memory</h3>
        <button
          type="button"
          className="text-gray-400 hover:text-gray-200 text-lg px-1 disabled:opacity-50"
          onClick={onRefresh}
          disabled={isLoading || !isConnected}
          title="Refresh device memory"
        >
          {isLoading ? '...' : '\u21BB'}
        </button>
      </div>
      <LoadingBar active={isLoading || (!isConnected && hasData)} />

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
          onDelete={onDeleteSample}
        />
        {sampleDropOver && (
          <div className="text-xs text-blue-400 text-center py-2 border border-dashed border-blue-500/50 rounded mx-1 mb-2">
            Drop to send to device
          </div>
        )}
      </div>
    </div>
  );
}

