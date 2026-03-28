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
  type DrumKitInfo,
  type LibraryToneInfo,
  type LibraryPatchInfo,
  type LibraryTreeNode,
  type LibraryCategory,
} from '@/lib/library-service';
import { cn } from '@/lib/utils';
import { useLibraryTreeDragDrop } from '@/hooks/useLibraryTreeDragDrop';
import { useLibraryTreeActions } from '@/hooks/useLibraryTreeActions';
import { type DeviceDragData } from './DeviceMemoryPanel';
import { TreeSection } from './LibraryTreeNode';
import { ContextMenu } from '@audiocontrol/editor-core';
import { WaveIcon, PatchIcon, DeleteButton } from './LibraryTreeIcons';
import { DrumKitItem } from './DrumKitItem';
import { SetItem } from './SetItem';

interface LibraryTreePanelProps {
  libraryHandle: StorageDirectoryHandle | null;
  sets: SetInfo[];
  drumKits: DrumKitInfo[];
  individualTones: LibraryToneInfo[];
  individualPatches: LibraryPatchInfo[];
  /** Hierarchical tree for tones (optional, falls back to flat list) */
  tonesTree?: LibraryTreeNode[];
  /** Hierarchical tree for patches (optional, falls back to flat list) */
  patchesTree?: LibraryTreeNode[];
  /** Hierarchical tree for drum kits (optional, falls back to flat list) */
  drumKitsTree?: LibraryTreeNode[];
  /** Hierarchical tree for chopped samples from common/samples/ */
  choppedSamplesTree?: LibraryTreeNode[];
  /** Hierarchical tree for common-area content (samples, programs, legacy chopped) */
  commonSamplesTree?: LibraryTreeNode[];
  /** Expanded directory paths per category */
  expandedPaths?: {
    tones: Set<string>;
    patches: Set<string>;
    drumKits: Set<string>;
    choppedSamples: Set<string>;
    commonSamples: Set<string>;
  };
  selectedName?: string;
  selectedType?: 'tone' | 'patch' | 'set' | 'drumKit' | 'individualTone' | 'individualPatch' | 'choppedSample' | 'sample' | 'program';
  selectedSetName?: string;
  /** Selected path for hierarchical items */
  selectedPath?: string[];
  onSelectSet: (name: string) => void;
  onSelectTone: (name: string, setName: string) => void;
  onSelectPatch: (name: string, setName: string) => void;
  onSelectDrumKit: (name: string, path?: string[]) => void;
  onSelectIndividualTone: (name: string, path?: string[]) => void;
  onSelectIndividualPatch: (name: string, path?: string[]) => void;
  onSelectChoppedSample?: (name: string, path?: string[]) => void;
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
  /** Callback to delete a drum kit */
  onDeleteDrumKit?: (directoryName: string, path?: string[]) => void;
  /** Callback to toggle directory expansion */
  onToggleDirectoryExpanded?: (category: 'tones' | 'patches' | 'drumKits' | 'choppedSamples' | 'commonSamples', path: string) => void;
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
  drumKits,
  individualTones,
  individualPatches,
  tonesTree,
  patchesTree,
  drumKitsTree,
  choppedSamplesTree,
  commonSamplesTree,
  expandedPaths,
  selectedName,
  selectedType,
  selectedSetName,
  selectedPath,
  onSelectSet,
  onSelectTone,
  onSelectPatch,
  onSelectDrumKit,
  onSelectIndividualTone,
  onSelectIndividualPatch,
  onSelectChoppedSample,
  onSelectSample,
  onSelectProgram,
  onRefresh,
  isLoading,
  onDropDeviceTone,
  onDropDevicePatch,
  onDeleteSet,
  onDeleteIndividualTone,
  onDeleteIndividualPatch,
  onDeleteDrumKit,
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
    handleDrumKitDragStart,
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
    onSelectDrumKit,
    onSelectIndividualTone,
    onSelectIndividualPatch,
    onSelectChoppedSample,
    onSelectSample,
    onSelectProgram,
    onToggleDirectoryExpanded,
    onDeleteIndividualTone,
    onDeleteIndividualPatch,
    onDeleteDrumKit,
    onDeleteDirectory,
    onCreateDirectory,
    onRenameDirectory,
    onMoveItem,
    onDropMoveItem,
    onRenameItem,
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
                  selectedItemType={selectedSetName === setInfo.name && selectedType !== 'drumKit' && selectedType !== 'individualTone' && selectedType !== 'individualPatch' && selectedType !== 'choppedSample' && selectedType !== 'sample' && selectedType !== 'program' ? selectedType : undefined}
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
          // Hierarchical tree view
          <TreeSection
            title="Individual Tones"
            nodes={tonesTree}
            category="tones"
            expandedPaths={expandedPaths?.tones ?? new Set()}
            selectedId={computeSelectedId('tones')}
            onToggleExpand={(nodeId) => onToggleDirectoryExpanded?.('tones', nodeId)}
            onSelect={(node) => handleTreeNodeSelect(node, 'tones')}
            onDelete={(node) => handleTreeNodeDelete(node, 'tones')}
            onContextMenu={(e, node) => handleTreeContextMenu(e, node, 'tones')}
            onDropOnDirectory={(targetPath, dragData) => handleDropOnDirectory('tones', targetPath, dragData)}
            onRename={(node, newName) => handleRename('tones', node, newName)}
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
              <div className="space-y-0.5">
                {individualTones.map((toneInfo) => (
                  <div
                    key={toneInfo.fileName}
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
          // Hierarchical tree view
          <TreeSection
            title="Individual Patches"
            nodes={patchesTree}
            category="patches"
            expandedPaths={expandedPaths?.patches ?? new Set()}
            selectedId={computeSelectedId('patches')}
            onToggleExpand={(nodeId) => onToggleDirectoryExpanded?.('patches', nodeId)}
            onSelect={(node) => handleTreeNodeSelect(node, 'patches')}
            onDelete={(node) => handleTreeNodeDelete(node, 'patches')}
            onContextMenu={(e, node) => handleTreeContextMenu(e, node, 'patches')}
            onDropOnDirectory={(targetPath, dragData) => handleDropOnDirectory('patches', targetPath, dragData)}
            onRename={(node, newName) => handleRename('patches', node, newName)}
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
              <div className="space-y-0.5">
                {individualPatches.map((patchInfo) => (
                  <div
                    key={patchInfo.directoryName}
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

        {/* Drum Kits Section */}
        {drumKitsTree ? (
          // Hierarchical tree view
          <TreeSection
            title="Drum Kits"
            nodes={drumKitsTree}
            category="drumKits"
            expandedPaths={expandedPaths?.drumKits ?? new Set()}
            selectedId={computeSelectedId('drumKits')}
            onToggleExpand={(nodeId) => onToggleDirectoryExpanded?.('drumKits', nodeId)}
            onSelect={(node) => handleTreeNodeSelect(node, 'drumKits')}
            onDelete={(node) => handleTreeNodeDelete(node, 'drumKits')}
            onContextMenu={(e, node) => handleTreeContextMenu(e, node, 'drumKits')}
            onDropOnDirectory={(targetPath, dragData) => handleDropOnDirectory('drumKits', targetPath, dragData)}
            onRename={(node, newName) => handleRename('drumKits', node, newName)}
            emptyMessage="No drum kits in library"
            headerActions={
              onCreateDirectory && (
                <button
                  onClick={() => onCreateDirectory('drum-kits', [])}
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
                    onDragStart={(e) => handleDrumKitDragStart(e, kitInfo)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
        {/* Common Samples Section (common/samples/ — samples, programs, legacy chopped) */}
        {commonSamplesTree && commonSamplesTree.length > 0 && (
          <TreeSection
            title="Samples"
            nodes={commonSamplesTree}
            category="commonSamples"
            expandedPaths={expandedPaths?.commonSamples ?? new Set()}
            selectedId={computeSelectedId('commonSamples')}
            onToggleExpand={(nodeId) => onToggleDirectoryExpanded?.('commonSamples', nodeId)}
            onSelect={(node) => handleTreeNodeSelect(node, 'commonSamples')}
            emptyMessage="No samples in common library"
          />
        )}
        {/* Legacy Chopped Samples Section — hidden when commonSamplesTree is provided */}
        {!commonSamplesTree && choppedSamplesTree && choppedSamplesTree.length > 0 && (
          <TreeSection
            title="Samples"
            nodes={choppedSamplesTree}
            category="choppedSamples"
            expandedPaths={expandedPaths?.choppedSamples ?? new Set()}
            selectedId={computeSelectedId('choppedSamples')}
            onToggleExpand={(nodeId) => onToggleDirectoryExpanded?.('choppedSamples', nodeId)}
            onSelect={(node) => handleTreeNodeSelect(node, 'choppedSamples')}
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
