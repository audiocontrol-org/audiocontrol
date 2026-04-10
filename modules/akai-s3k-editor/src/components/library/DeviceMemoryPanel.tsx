/**
 * DeviceMemoryPanel — displays programs and samples resident in device memory.
 *
 * Renders two scrollable lists (programs and samples) fetched from the
 * S3000XL. Supports item selection, manual refresh, and drag-and-drop
 * import from the library tree.
 */

import { useState } from 'react';
import { LIBRARY_ITEM_MIME, type LibraryDragPayload } from '@audiocontrol/editor-core';
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
}: {
  title: string;
  names: string[];
  type: 'program' | 'sample';
  selectedIndex: number | null;
  selectedType: 'program' | 'sample' | null;
  onSelect: (index: number) => void;
}) {
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
      <ul className="max-h-48 overflow-y-auto space-y-px">
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
              >
                <span className="text-gray-500 mr-2 tabular-nums">{index}:</span>
                {name}
              </button>
            </li>
          );
        })}
      </ul>
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
  isConnected,
  isLoading,
}: DeviceMemoryPanelProps): JSX.Element {
  const [programDropOver, setProgramDropOver] = useState(false);
  const [sampleDropOver, setSampleDropOver] = useState(false);
  if (!isConnected) {
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
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-100">Device Memory</h3>
        <button
          type="button"
          className="text-gray-400 hover:text-gray-200 text-lg px-1 disabled:opacity-50"
          onClick={onRefresh}
          disabled={isLoading}
          title="Refresh device memory"
        >
          {isLoading ? '...' : '\u21BB'}
        </button>
      </div>

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
