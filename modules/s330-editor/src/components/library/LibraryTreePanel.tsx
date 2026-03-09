/**
 * Library Tree Panel
 *
 * Center panel showing library contents in a tree structure:
 * - Sets (expandable folders showing their tones/patches)
 * - Global Tones
 * - Global Patches
 *
 * Supports drag and drop from device memory to export items to library.
 */

import { useState, useCallback, useEffect } from 'react';
import type { SetInfo, SetYaml } from '@audiocontrol/sampler-library/browser';
import { loadSetManifest, type DrumKitInfo, type LibraryToneInfo } from '@/lib/library-service';
import { cn } from '@/lib/utils';
import { DEVICE_DRAG_MIME, type DeviceDragData } from './DeviceMemoryPanel';

interface LibraryTreePanelProps {
  libraryHandle: FileSystemDirectoryHandle | null;
  sets: SetInfo[];
  drumKits: DrumKitInfo[];
  individualTones: LibraryToneInfo[];
  selectedName?: string;
  selectedType?: 'tone' | 'patch' | 'set' | 'drumKit' | 'individualTone';
  selectedSetName?: string;
  onSelectSet: (name: string) => void;
  onSelectTone: (name: string, setName: string) => void;
  onSelectPatch: (name: string, setName: string) => void;
  onSelectDrumKit: (name: string) => void;
  onSelectIndividualTone: (name: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
  /** Callback when a device item is dropped to export to library */
  onDropDeviceItem?: (data: DeviceDragData) => void;
  /** Callback to delete a set */
  onDeleteSet?: (name: string) => void;
  /** Callback to delete an individual tone */
  onDeleteIndividualTone?: (fileName: string) => void;
  /** Callback to delete a drum kit */
  onDeleteDrumKit?: (directoryName: string) => void;
}

/**
 * Folder icon component
 */
function FolderIcon({ isOpen }: { isOpen: boolean }): JSX.Element {
  return (
    <svg
      className={cn('w-4 h-4', isOpen ? 'text-s330-highlight' : 'text-s330-muted')}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      {isOpen ? (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
        />
      ) : (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
        />
      )}
    </svg>
  );
}

/**
 * Chevron icon for expandable items
 */
function ChevronIcon({ isExpanded }: { isExpanded: boolean }): JSX.Element {
  return (
    <svg
      className={cn(
        'w-3 h-3 text-s330-muted transition-transform',
        isExpanded && 'rotate-90'
      )}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

/**
 * Wave icon for tones
 */
function WaveIcon(): JSX.Element {
  return (
    <svg className="w-3.5 h-3.5 text-s330-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
      />
    </svg>
  );
}

/**
 * Patch icon
 */
function PatchIcon(): JSX.Element {
  return (
    <svg className="w-3.5 h-3.5 text-s330-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      />
    </svg>
  );
}

/**
 * Drum kit icon
 */
function DrumKitIcon(): JSX.Element {
  return (
    <svg className="w-3.5 h-3.5 text-s330-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <circle cx="12" cy="12" r="8" strokeWidth={2} />
      <circle cx="12" cy="12" r="3" strokeWidth={2} />
    </svg>
  );
}

/**
 * Delete button that appears on hover/focus
 */
function DeleteButton({
  onClick,
  title = 'Delete',
}: {
  onClick: (e: React.MouseEvent) => void;
  title?: string;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'p-1 rounded opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
        'hover:bg-red-500/20 hover:text-red-400 text-s330-muted/50',
        'transition-opacity focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-red-400'
      )}
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
    </button>
  );
}

/**
 * Drum kit item
 */
function DrumKitItem({
  kitInfo,
  isSelected,
  onSelect,
  onDelete,
}: {
  kitInfo: DrumKitInfo;
  isSelected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}): JSX.Element {
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  }, [onDelete]);

  return (
    <div
      className={cn(
        'group w-full text-left px-2 py-1.5 rounded text-sm transition-colors',
        'flex items-center gap-2 cursor-pointer',
        isSelected
          ? 'bg-s330-highlight/20 text-s330-highlight'
          : 'text-s330-text hover:bg-s330-accent/30'
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
    >
      <DrumKitIcon />
      <span className="flex-1 truncate font-medium">{kitInfo.name}</span>
      <span className="text-xs text-s330-muted">
        {kitInfo.kitCount} kit{kitInfo.kitCount !== 1 ? 's' : ''} / {kitInfo.sampleCount} samples
      </span>
      {onDelete && <DeleteButton onClick={handleDelete} title="Delete drum kit" />}
    </div>
  );
}

/**
 * Set item with expandable contents showing individual tones/patches
 */
function SetItem({
  setInfo,
  manifest,
  isSelected,
  isExpanded,
  selectedItemName,
  selectedItemType,
  onToggle,
  onSelect,
  onSelectTone,
  onSelectPatch,
  isLoadingManifest,
  onDelete,
}: {
  setInfo: SetInfo;
  manifest: SetYaml | null;
  isSelected: boolean;
  isExpanded: boolean;
  selectedItemName?: string;
  selectedItemType?: 'tone' | 'patch' | 'set';
  onToggle: () => void;
  onSelect: () => void;
  onSelectTone: (toneFile: string) => void;
  onSelectPatch: (patchFile: string) => void;
  isLoadingManifest: boolean;
  onDelete?: () => void;
}): JSX.Element {
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  }, [onDelete]);

  return (
    <div>
      <div
        className={cn(
          'group w-full text-left px-2 py-1.5 rounded text-sm transition-colors',
          'flex items-center gap-2',
          isSelected
            ? 'bg-s330-highlight/20 text-s330-highlight'
            : 'text-s330-text hover:bg-s330-accent/30'
        )}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('.expand-toggle')) {
            onToggle();
          } else if (!(e.target as HTMLElement).closest('.delete-btn')) {
            onSelect();
          }
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      >
        <span className="expand-toggle cursor-pointer p-0.5 -ml-0.5">
          <ChevronIcon isExpanded={isExpanded} />
        </span>
        <FolderIcon isOpen={isExpanded} />
        <span className="flex-1 truncate font-medium">{setInfo.name}</span>
        <span className="text-xs text-s330-muted">
          {setInfo.toneCount}T / {setInfo.patchCount}P
        </span>
        {onDelete && (
          <span className="delete-btn">
            <DeleteButton onClick={handleDelete} title="Delete set" />
          </span>
        )}
      </div>

      {/* Expanded contents with individual items */}
      {isExpanded && (
        <div className="ml-6 mt-0.5 space-y-0.5 border-l border-s330-accent/30 pl-2">
          {isLoadingManifest ? (
            <div className="text-xs text-s330-muted py-2 flex items-center gap-2">
              <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              Loading...
            </div>
          ) : manifest ? (
            <>
              {/* Tones section */}
              {manifest.tones.length > 0 && (
                <div className="py-1">
                  <div className="text-xs text-s330-muted uppercase tracking-wide mb-1">
                    Tones
                  </div>
                  <div className="space-y-0.5">
                    {manifest.tones.map((entry) => (
                      <button
                        key={entry.file}
                        onClick={() => onSelectTone(entry.file)}
                        className={cn(
                          'w-full text-left px-2 py-1 rounded text-xs transition-colors',
                          'flex items-center gap-2',
                          selectedItemType === 'tone' && selectedItemName === entry.file
                            ? 'bg-s330-highlight/20 text-s330-highlight'
                            : 'text-s330-text hover:bg-s330-accent/30'
                        )}
                      >
                        <WaveIcon />
                        <span className="truncate">{entry.file}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Patches section */}
              {manifest.patches.length > 0 && (
                <div className="py-1">
                  <div className="text-xs text-s330-muted uppercase tracking-wide mb-1">
                    Patches
                  </div>
                  <div className="space-y-0.5">
                    {manifest.patches.map((entry) => (
                      <button
                        key={entry.file}
                        onClick={() => onSelectPatch(entry.file)}
                        className={cn(
                          'w-full text-left px-2 py-1 rounded text-xs transition-colors',
                          'flex items-center gap-2',
                          selectedItemType === 'patch' && selectedItemName === entry.file
                            ? 'bg-s330-highlight/20 text-s330-highlight'
                            : 'text-s330-text hover:bg-s330-accent/30'
                        )}
                      >
                        <PatchIcon />
                        <span className="truncate">{entry.file}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Description if present */}
              {setInfo.description && (
                <div className="text-xs text-s330-muted/70 py-1 italic">
                  {setInfo.description}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Fallback when manifest not loaded */}
              {setInfo.toneCount > 0 && (
                <div className="text-xs text-s330-muted py-1">
                  {setInfo.toneCount} tone{setInfo.toneCount !== 1 ? 's' : ''}
                </div>
              )}
              {setInfo.patchCount > 0 && (
                <div className="text-xs text-s330-muted py-1">
                  {setInfo.patchCount} patch{setInfo.patchCount !== 1 ? 'es' : ''}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function LibraryTreePanel({
  libraryHandle,
  sets,
  drumKits,
  individualTones,
  selectedName,
  selectedType,
  selectedSetName,
  onSelectSet,
  onSelectTone,
  onSelectPatch,
  onSelectDrumKit,
  onSelectIndividualTone,
  onRefresh,
  isLoading,
  onDropDeviceItem,
  onDeleteSet,
  onDeleteIndividualTone,
  onDeleteDrumKit,
}: LibraryTreePanelProps): JSX.Element {
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());
  const [manifests, setManifests] = useState<Map<string, SetYaml>>(new Map());
  const [loadingManifests, setLoadingManifests] = useState<Set<string>>(new Set());
  const [isDragOver, setIsDragOver] = useState(false);

  // Handle drag over for drop zone
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DEVICE_DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(DEVICE_DRAG_MIME)) {
      e.preventDefault();
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if we're leaving the container, not entering a child
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const jsonData = e.dataTransfer.getData(DEVICE_DRAG_MIME);
    if (!jsonData) return;

    try {
      const data = JSON.parse(jsonData) as DeviceDragData;
      onDropDeviceItem?.(data);
    } catch (err) {
      console.error('[LibraryTreePanel] Failed to parse drop data:', err);
    }
  }, [onDropDeviceItem]);

  const toggleSet = useCallback((name: string) => {
    setExpandedSets((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  // Load manifest when a set is expanded
  useEffect(() => {
    if (!libraryHandle) return;

    for (const setName of expandedSets) {
      if (manifests.has(setName) || loadingManifests.has(setName)) continue;

      setLoadingManifests((prev) => new Set(prev).add(setName));

      loadSetManifest(libraryHandle, setName)
        .then((manifest) => {
          setManifests((prev) => new Map(prev).set(setName, manifest));
        })
        .catch((err) => {
          console.error(`[LibraryTreePanel] Failed to load manifest for ${setName}:`, err);
        })
        .finally(() => {
          setLoadingManifests((prev) => {
            const next = new Set(prev);
            next.delete(setName);
            return next;
          });
        });
    }
  }, [expandedSets, libraryHandle, manifests, loadingManifests]);

  if (!libraryHandle) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-s330-accent">
          <h3 className="font-bold text-s330-text">Library</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-s330-muted text-sm">
            <p className="mb-2">No library folder selected</p>
            <p className="text-xs">
              Click "Select Library Folder" above to connect your library.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-s330-accent">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-s330-text">Library</h3>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className={cn(
              'text-s330-muted hover:text-s330-text transition-colors p-1',
              isLoading && 'animate-spin'
            )}
            title="Refresh library"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
        <p className="text-xs text-s330-muted mt-1">
          {sets.length} set{sets.length !== 1 ? 's' : ''}
          {drumKits.length > 0 && ` / ${drumKits.length} drum kit${drumKits.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Sets Section */}
        <div className="p-2">
          <div className="text-xs font-medium text-s330-muted uppercase tracking-wide px-2 py-1">
            Sets
          </div>

          {sets.length === 0 ? (
            <div className="text-sm text-s330-muted/70 px-2 py-4 text-center italic">
              No sets in library
            </div>
          ) : (
            <div className="space-y-0.5">
              {sets.map((setInfo) => (
                <SetItem
                  key={setInfo.name}
                  setInfo={setInfo}
                  manifest={manifests.get(setInfo.name) ?? null}
                  isSelected={selectedType === 'set' && selectedName === setInfo.name}
                  isExpanded={expandedSets.has(setInfo.name)}
                  selectedItemName={selectedSetName === setInfo.name ? selectedName : undefined}
                  selectedItemType={selectedSetName === setInfo.name && selectedType !== 'drumKit' && selectedType !== 'individualTone' ? selectedType : undefined}
                  onToggle={() => toggleSet(setInfo.name)}
                  onSelect={() => onSelectSet(setInfo.name)}
                  onSelectTone={(toneFile) => onSelectTone(toneFile, setInfo.name)}
                  onSelectPatch={(patchFile) => onSelectPatch(patchFile, setInfo.name)}
                  isLoadingManifest={loadingManifests.has(setInfo.name)}
                  onDelete={onDeleteSet ? () => onDeleteSet(setInfo.name) : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {/* Individual Tones Section - Drop Zone */}
        <div
          className={cn(
            'p-2 border-t border-s330-accent/30 transition-colors',
            isDragOver && 'bg-s330-highlight/10 border-s330-highlight'
          )}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="text-xs font-medium text-s330-muted uppercase tracking-wide px-2 py-1 flex items-center gap-2">
            Individual Tones
            {isDragOver && (
              <span className="text-s330-highlight font-normal normal-case">
                — Drop to export
              </span>
            )}
          </div>

          {individualTones.length === 0 && !isDragOver ? (
            <div className="text-sm text-s330-muted/70 px-2 py-4 text-center italic">
              Drag tones from device to export
            </div>
          ) : (
            <div className="space-y-0.5">
              {individualTones.map((toneInfo) => (
                <div
                  key={toneInfo.fileName}
                  onClick={() => onSelectIndividualTone(toneInfo.fileName)}
                  className={cn(
                    'group w-full text-left px-2 py-1.5 rounded text-sm transition-colors cursor-pointer',
                    'flex items-center gap-2',
                    selectedType === 'individualTone' && selectedName === toneInfo.fileName
                      ? 'bg-s330-highlight/20 text-s330-highlight'
                      : 'text-s330-text hover:bg-s330-accent/30'
                  )}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onSelectIndividualTone(toneInfo.fileName)}
                >
                  <WaveIcon />
                  <span className="flex-1 truncate font-medium">{toneInfo.name}</span>
                  {onDeleteIndividualTone && (
                    <DeleteButton
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteIndividualTone(toneInfo.fileName);
                      }}
                      title="Delete tone"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {isDragOver && (
            <div className="mt-2 p-3 border-2 border-dashed border-s330-highlight/50 rounded text-center text-sm text-s330-highlight">
              Drop here to export to library
            </div>
          )}
        </div>

        {/* Drum Kits Section */}
        <div className="p-2 border-t border-s330-accent/30">
          <div className="text-xs font-medium text-s330-muted uppercase tracking-wide px-2 py-1">
            Drum Kits
          </div>

          {drumKits.length === 0 ? (
            <div className="text-sm text-s330-muted/70 px-2 py-4 text-center italic">
              No drum kits in library
            </div>
          ) : (
            <div className="space-y-0.5">
              {drumKits.map((kitInfo) => (
                <DrumKitItem
                  key={kitInfo.directoryName}
                  kitInfo={kitInfo}
                  isSelected={selectedType === 'drumKit' && selectedName === kitInfo.directoryName}
                  onSelect={() => onSelectDrumKit(kitInfo.directoryName)}
                  onDelete={onDeleteDrumKit ? () => onDeleteDrumKit(kitInfo.directoryName) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
