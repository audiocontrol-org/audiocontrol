/**
 * Library Tree Panel
 *
 * Center panel showing library contents in a tree structure:
 * - Sets (expandable folders showing their tones/patches)
 * - Individual Tones (hierarchical with subdirectories)
 * - Individual Patches (hierarchical with subdirectories)
 * - Drum Kits (hierarchical with subdirectories)
 *
 * Supports drag and drop from device memory to export items to library.
 */

import { useState, useCallback, useEffect } from 'react';
import type { SetInfo, SetYaml, StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import {
  loadSetManifest,
  type LibraryToneInfo,
  type LibraryPatchInfo,
  type LibraryTreeNode,
  type LibraryCategory,
} from '@/lib/library-service';
import { cn } from '@/lib/utils';
import { useLibraryTreeDragDrop } from '@/hooks/useLibraryTreeDragDrop';
import { useLibraryTreeActions } from '@/hooks/useLibraryTreeActions';
import { useLibraryTreeCapabilities } from '@/hooks/useLibraryTreeCapabilities';
import { type DeviceDragData } from './DeviceMemoryPanel';
import { TreeSection, ContextMenu } from '@audiocontrol/editor-core';
import { WaveIcon, PatchIcon, DeleteButton } from './LibraryTreeIcons';
import { SetItem } from './SetItem';

interface LibraryTreePanelProps {
  libraryHandle: StorageDirectoryHandle | null;
  sets: SetInfo[];
  individualTones: LibraryToneInfo[];
  individualPatches: LibraryPatchInfo[];
  /** Hierarchical tree for tones (optional, falls back to flat list) */
  tonesTree?: LibraryTreeNode[];
  /** Hierarchical tree for patches (optional, falls back to flat list) */
  patchesTree?: LibraryTreeNode[];
  /** Hierarchical tree for common-area content (samples, programs) */
  commonSamplesTree?: LibraryTreeNode[];
  /** Expanded directory paths per category */
  expandedPaths?: {
    tones: Set<string>;
    patches: Set<string>;
    samples: Set<string>;
  };
  selectedName?: string;
  selectedType?: 'tone' | 'patch' | 'set' | 'individualTone' | 'individualPatch' | 'sample' | 'program';
  selectedSetName?: string;
  /** Selected path for hierarchical items */
  selectedPath?: string[];
  onSelectSet: (name: string) => void;
  onSelectTone: (name: string, setName: string) => void;
  onSelectPatch: (name: string, setName: string) => void;
  onSelectIndividualTone: (name: string, path?: string[]) => void;
  onSelectIndividualPatch: (name: string, path?: string[]) => void;
  onSelectSample?: (name: string, path?: string[]) => void;
  onSelectProgram?: (name: string, path?: string[]) => void;
  onRefresh: () => void;
  isLoading: boolean;
  /** Callback when a device tone is dropped to export to library */
  onDropDeviceTone?: (data: DeviceDragData, targetPath?: string[]) => void;
  /** Callback when a device patch is dropped to export to library */
  onDropDevicePatch?: (data: DeviceDragData, targetPath?: string[]) => void;
  /** Callback to delete a set */
  onDeleteSet?: (name: string) => void;
  /** Callback to delete an individual tone */
  onDeleteIndividualTone?: (fileName: string, path?: string[]) => void;
  /** Callback to delete an individual patch */
  onDeleteIndividualPatch?: (fileName: string, path?: string[]) => void;
  /** Callback to toggle directory expansion */
  onToggleDirectoryExpanded?: (category: 'tones' | 'patches' | 'drumKits' | 'samples', path: string) => void;
  /** Callback to create a new directory */
  onCreateDirectory?: (category: LibraryCategory, parentPath: string[]) => void;
  /** Callback to rename a directory */
  onRenameDirectory?: (category: LibraryCategory, path: string[]) => void;
  /** Callback to delete a directory */
  onDeleteDirectory?: (category: LibraryCategory, path: string[]) => void;
  /** Callback to move an item (via dialog) */
  onMoveItem?: (category: LibraryCategory, sourcePath: string[], itemName: string) => void;
  /** Callback when an item is dropped onto a directory (drag-drop move) */
  onDropMoveItem?: (category: LibraryCategory, sourcePath: string[], itemName: string, targetPath: string[]) => void;
  /** Callback to rename an item (double-click to edit) */
  onRenameItem?: (category: LibraryCategory, path: string[], oldName: string, newName: string, isDirectory: boolean) => Promise<void>;
  /** Callback to rename a set (double-click to edit) */
  onRenameSet?: (oldName: string, newName: string) => Promise<void>;
}

export function LibraryTreePanel({
  libraryHandle,
  sets,
  individualTones,
  individualPatches,
  tonesTree,
  patchesTree,
  commonSamplesTree,
  expandedPaths,
  selectedName,
  selectedType,
  selectedSetName,
  selectedPath,
  onSelectSet,
  onSelectTone,
  onSelectPatch,
  onSelectIndividualTone,
  onSelectIndividualPatch,
  onSelectSample,
  onSelectProgram,
  onRefresh,
  isLoading,
  onDropDeviceTone,
  onDropDevicePatch,
  onDeleteSet,
  onDeleteIndividualTone,
  onDeleteIndividualPatch,
  onToggleDirectoryExpanded,
  onCreateDirectory,
  onRenameDirectory,
  onDeleteDirectory,
  onMoveItem,
  onDropMoveItem,
  onRenameItem,
  onRenameSet,
}: LibraryTreePanelProps): JSX.Element {
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());
  const [manifests, setManifests] = useState<Map<string, SetYaml>>(new Map());
  const [loadingManifests, setLoadingManifests] = useState<Set<string>>(new Set());

  // Drag-and-drop handlers
  const {
    isToneDragOver,
    isPatchDragOver,
    handleToneDragOver,
    handleToneDragEnter,
    handleToneDragLeave,
    handleToneDrop,
    handlePatchDragOver,
    handlePatchDragEnter,
    handlePatchDragLeave,
    handlePatchDrop,
    handleIndividualToneDragStart,
    handleIndividualPatchDragStart,
    handleSetToneDragStart,
    handleSetPatchDragStart,
  } = useLibraryTreeDragDrop({ onDropDeviceTone, onDropDevicePatch });

  // Context menu, tree node selection/delete, rename, move handlers
  const {
    contextMenu,
    handleTreeContextMenu,
    closeContextMenu,
    getContextMenuActions,
    handleTreeNodeSelect,
    handleTreeNodeDelete,
    computeSelectedId,
    handleDropOnDirectory,
    handleRename,
  } = useLibraryTreeActions({
    selectedName,
    selectedType,
    selectedPath,
    onSelectIndividualTone,
    onSelectIndividualPatch,
    onSelectSample,
    onSelectProgram,
    onToggleDirectoryExpanded,
    onDeleteIndividualTone,
    onDeleteIndividualPatch,
    onDeleteDirectory,
    onCreateDirectory,
    onRenameDirectory,
    onMoveItem,
    onDropMoveItem,
    onRenameItem,
  });

  // Tree capability objects for tones section
  const tonesCapabilities = useLibraryTreeCapabilities({
    category: 'tones',
    onSelect: handleTreeNodeSelect,
    onDelete: handleTreeNodeDelete,
    onContextMenu: handleTreeContextMenu,
    onDropOnDirectory: handleDropOnDirectory,
    onRename: handleRename,
  });

  // Tree capability objects for patches section
  const patchesCapabilities = useLibraryTreeCapabilities({
    category: 'patches',
    onSelect: handleTreeNodeSelect,
    onDelete: handleTreeNodeDelete,
    onContextMenu: handleTreeContextMenu,
    onDropOnDirectory: handleDropOnDirectory,
    onRename: handleRename,
  });

  // Tree capability objects for samples section (read-only)
  const samplesCapabilities = useLibraryTreeCapabilities({
    category: 'samples',
    onSelect: handleTreeNodeSelect,
  });

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
                  selectedItemType={selectedSetName === setInfo.name && selectedType !== 'individualTone' && selectedType !== 'individualPatch' && selectedType !== 'sample' && selectedType !== 'program' ? selectedType : undefined}
                  onToggle={() => toggleSet(setInfo.name)}
                  onSelect={() => onSelectSet(setInfo.name)}
                  onSelectTone={(toneFile) => onSelectTone(toneFile, setInfo.name)}
                  onSelectPatch={(patchFile) => onSelectPatch(patchFile, setInfo.name)}
                  onToneDragStart={(e, toneFile) => handleSetToneDragStart(e, toneFile, setInfo.name)}
                  onPatchDragStart={(e, patchFile) => handleSetPatchDragStart(e, patchFile, setInfo.name)}
                  isLoadingManifest={loadingManifests.has(setInfo.name)}
                  onDelete={onDeleteSet ? () => onDeleteSet(setInfo.name) : undefined}
                  onRename={onRenameSet ? (newName) => onRenameSet(setInfo.name, newName) : undefined}
                />
              ))}
            </div>
          )}
        </div>

        {/* Individual Tones Section - Drop Zone */}
        {tonesTree ? (
          // Hierarchical tree view (editor-core TreeSection with capabilities)
          <TreeSection
            title="Individual Tones"
            nodes={tonesTree}
            category="tones"
            data-testid="library-tones-section"
            expandedIds={expandedPaths?.tones ?? new Set()}
            selectedId={computeSelectedId('tones')}
            onToggleExpand={(nodeId) => onToggleDirectoryExpanded?.('tones', nodeId)}
            selection={tonesCapabilities.selection}
            edit={tonesCapabilities.edit}
            contextMenu={tonesCapabilities.contextMenu}
            drag={tonesCapabilities.drag}
            render={tonesCapabilities.render}
            emptyMessage="Drag tones from device to export"
            isDragOver={isToneDragOver}
            onDragOver={handleToneDragOver}
            onDragEnter={handleToneDragEnter}
            onDragLeave={handleToneDragLeave}
            onDrop={handleToneDrop}
            dropMessage="Drop to export"
            headerActions={
              onCreateDirectory && (
                <button
                  onClick={() => onCreateDirectory('tones', [])}
                  className="text-s330-muted hover:text-s330-text p-0.5"
                  title="New folder"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                </button>
              )
            }
          />
        ) : (
          // Flat list view (legacy)
          <div
            className={cn(
              'p-2 border-t border-s330-accent/30 transition-colors',
              isToneDragOver && 'bg-s330-highlight/10 border-s330-highlight'
            )}
            onDragOver={handleToneDragOver}
            onDragEnter={handleToneDragEnter}
            onDragLeave={handleToneDragLeave}
            onDrop={handleToneDrop}
          >
            <div className="text-xs font-medium text-s330-muted uppercase tracking-wide px-2 py-1 flex items-center gap-2">
              Individual Tones
              {isToneDragOver && (
                <span className="text-s330-highlight font-normal normal-case">
                  — Drop to export
                </span>
              )}
            </div>

            {individualTones.length === 0 && !isToneDragOver ? (
              <div className="text-sm text-s330-muted/70 px-2 py-4 text-center italic">
                Drag tones from device to export
              </div>
            ) : (
              <div className="space-y-0.5" data-testid="library-tones-list">
                {individualTones.map((toneInfo) => (
                  <div
                    key={toneInfo.fileName}
                    data-testid={`library-tone-${toneInfo.fileName}`}
                    onClick={() => onSelectIndividualTone(toneInfo.fileName)}
                    draggable
                    onDragStart={(e) => handleIndividualToneDragStart(e, toneInfo)}
                    className={cn(
                      'group w-full text-left px-2 py-1.5 rounded text-sm transition-colors',
                      'flex items-center gap-2 cursor-grab active:cursor-grabbing',
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

            {isToneDragOver && (
              <div className="mt-2 p-3 border-2 border-dashed border-s330-highlight/50 rounded text-center text-sm text-s330-highlight">
                Drop tone here to export
              </div>
            )}
          </div>
        )}

        {/* Individual Patches Section - Drop Zone */}
        {patchesTree ? (
          // Hierarchical tree view (editor-core TreeSection with capabilities)
          <TreeSection
            title="Individual Patches"
            nodes={patchesTree}
            category="patches"
            data-testid="library-patches-section"
            expandedIds={expandedPaths?.patches ?? new Set()}
            selectedId={computeSelectedId('patches')}
            onToggleExpand={(nodeId) => onToggleDirectoryExpanded?.('patches', nodeId)}
            selection={patchesCapabilities.selection}
            edit={patchesCapabilities.edit}
            contextMenu={patchesCapabilities.contextMenu}
            drag={patchesCapabilities.drag}
            render={patchesCapabilities.render}
            emptyMessage="Drag patches from device to export"
            isDragOver={isPatchDragOver}
            onDragOver={handlePatchDragOver}
            onDragEnter={handlePatchDragEnter}
            onDragLeave={handlePatchDragLeave}
            onDrop={handlePatchDrop}
            dropMessage="Drop to export"
            headerActions={
              onCreateDirectory && (
                <button
                  onClick={() => onCreateDirectory('patches', [])}
                  className="text-s330-muted hover:text-s330-text p-0.5"
                  title="New folder"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                </button>
              )
            }
          />
        ) : (
          // Flat list view (legacy)
          <div
            className={cn(
              'p-2 border-t border-s330-accent/30 transition-colors',
              isPatchDragOver && 'bg-s330-highlight/10 border-s330-highlight'
            )}
            onDragOver={handlePatchDragOver}
            onDragEnter={handlePatchDragEnter}
            onDragLeave={handlePatchDragLeave}
            onDrop={handlePatchDrop}
          >
            <div className="text-xs font-medium text-s330-muted uppercase tracking-wide px-2 py-1 flex items-center gap-2">
              Individual Patches
              {isPatchDragOver && (
                <span className="text-s330-highlight font-normal normal-case">
                  — Drop to export
                </span>
              )}
            </div>

            {individualPatches.length === 0 && !isPatchDragOver ? (
              <div className="text-sm text-s330-muted/70 px-2 py-4 text-center italic">
                Drag patches from device to export
              </div>
            ) : (
              <div className="space-y-0.5" data-testid="library-patches-list">
                {individualPatches.map((patchInfo) => (
                  <div
                    key={patchInfo.directoryName}
                    data-testid={`library-patch-${patchInfo.directoryName}`}
                    onClick={() => onSelectIndividualPatch(patchInfo.directoryName)}
                    draggable
                    onDragStart={(e) => handleIndividualPatchDragStart(e, patchInfo)}
                    className={cn(
                      'group w-full text-left px-2 py-1.5 rounded text-sm transition-colors',
                      'flex items-center gap-2 cursor-grab active:cursor-grabbing',
                      selectedType === 'individualPatch' && selectedName === patchInfo.directoryName
                        ? 'bg-s330-highlight/20 text-s330-highlight'
                        : 'text-s330-text hover:bg-s330-accent/30'
                    )}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && onSelectIndividualPatch(patchInfo.directoryName)}
                  >
                    <PatchIcon />
                    <span className="flex-1 truncate font-medium">{patchInfo.name}</span>
                    <span className="text-xs text-s330-muted">
                      {patchInfo.toneCount} tone{patchInfo.toneCount !== 1 ? 's' : ''}
                    </span>
                    {onDeleteIndividualPatch && (
                      <DeleteButton
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteIndividualPatch(patchInfo.directoryName);
                        }}
                        title="Delete patch bundle"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {isPatchDragOver && (
              <div className="mt-2 p-3 border-2 border-dashed border-s330-highlight/50 rounded text-center text-sm text-s330-highlight">
                Drop patch here to export
              </div>
            )}
          </div>
        )}

        {/* Common Samples Section (common/samples/ — samples, programs) */}
        {commonSamplesTree && commonSamplesTree.length > 0 && (
          <TreeSection
            title="Samples"
            nodes={commonSamplesTree}
            category="samples"
            data-testid="library-samples-section"
            expandedIds={expandedPaths?.samples ?? new Set()}
            selectedId={computeSelectedId('samples')}
            onToggleExpand={(nodeId) => onToggleDirectoryExpanded?.('samples', nodeId)}
            selection={samplesCapabilities.selection}
            render={samplesCapabilities.render}
            emptyMessage="No samples in common library"
          />
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={getContextMenuActions()}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}
