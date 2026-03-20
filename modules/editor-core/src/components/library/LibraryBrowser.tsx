/**
 * Composed library browser component.
 *
 * Assembles LibraryPanel + TreeView + an optional detail panel into
 * a complete library browsing experience with built-in drag-and-drop,
 * folder creation, deletion, file import, and refresh. Consumers
 * provide storage callbacks and optional render props for
 * device-specific content.
 */

import React, { useCallback, useRef, useState } from 'react';
import { LibraryPanel } from './LibraryPanel';
import { TreeView, type TreeNode } from './TreeView';
import { ConfirmDialog } from './ConfirmDialog';
import { ImportIcon } from './TreeIcons';
import { OperationProgressBar } from '../OperationStatus';
import type { OperationProgress } from '../../types/operation-progress';

const LIBRARY_MOVE_MIME = 'application/x-library-move';

interface LibraryMoveData {
  nodeId: string;
  name: string;
  path: string[];
}

export interface LibraryBrowserProps {
  /** Library tree data */
  nodes: TreeNode[];

  /** Core library operations */
  onCreateFolder: (name: string) => Promise<void>;
  onDelete: (node: TreeNode) => void;
  onMove: (node: TreeNode, targetPath: string[]) => Promise<void>;
  onRefresh: () => void;

  /** Called when files are imported (via button or OS drag-drop).
   *  targetPath is the directory the files were dropped on, or []
   *  for root-level imports. */
  onImportFiles?: (files: File[], targetPath: string[]) => Promise<void>;

  /** Called when a non-directory node is selected */
  onSelect?: (node: TreeNode) => void;

  /** Render the detail panel for the selected node (or null when nothing is selected).
   *  When omitted, no detail panel is shown. When provided, the detail slot is always
   *  visible so the layout is stable. */
  renderDetail?: (node: TreeNode | null) => React.ReactNode;
  /** Render a custom icon per node */
  renderIcon?: (node: TreeNode, isExpanded: boolean) => React.ReactNode;
  /** Render trailing content per node (metadata, extra action buttons) */
  renderTrailing?: (node: TreeNode) => React.ReactNode;

  /** Panel chrome */
  title?: string;
  loading?: boolean;
  error?: string;
  emptyMessage?: string;

  /** Optional connection status widget */
  connectionSlot?: React.ReactNode;

  /** Structured progress for an in-flight operation (import, move, etc.) */
  operationProgress?: OperationProgress;

  /** TreeView passthrough for context menu */
  onContextMenu?: (e: React.MouseEvent, node: TreeNode) => void;
}

/** Find a node by ID in a tree. */
function findNode(nodes: TreeNode[], id: string): TreeNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

/** Check if a drag event contains OS files (not internal library moves). */
function hasFilesDrag(e: React.DragEvent): boolean {
  return e.dataTransfer.types.includes('Files')
    && !e.dataTransfer.types.includes(LIBRARY_MOVE_MIME);
}

export function LibraryBrowser({
  nodes,
  onCreateFolder,
  onDelete,
  onMove,
  onRefresh,
  onImportFiles,
  onSelect,
  renderDetail,
  renderIcon,
  renderTrailing,
  title,
  loading,
  error,
  emptyMessage = 'No items',
  connectionSlot,
  operationProgress,
  onContextMenu,
}: LibraryBrowserProps): JSX.Element {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [isFileDragOver, setIsFileDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TreeNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedNode = selectedId ? findNode(nodes, selectedId) : undefined;
  const showDetail = renderDetail !== undefined;
  const layoutClass = showDetail ? 'ac-library-browser ac-library-browser--split' : 'ac-library-browser';

  const handleSelect = useCallback((node: TreeNode) => {
    setSelectedId(node.id);
    onSelect?.(node);
  }, [onSelect]);

  // -- Delete confirmation ------------------------------------------------

  const handleDeleteClick = useCallback((node: TreeNode) => {
    setDeleteTarget(node);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (deleteTarget) {
      onDelete(deleteTarget);
      setDeleteTarget(null);
    }
  }, [deleteTarget, onDelete]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  // -- File import -------------------------------------------------------

  const doImport = useCallback(async (files: File[], targetPath: string[]) => {
    if (!onImportFiles || files.length === 0) return;
    setImporting(true);
    try {
      await onImportFiles(files, targetPath);
    } finally {
      setImporting(false);
    }
  }, [onImportFiles]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    doImport(Array.from(files), []);
    // Reset so the same file can be re-imported
    e.target.value = '';
  }, [doImport]);

  // -- Root-level file drop zone -----------------------------------------

  const handleRootDragOver = useCallback((e: React.DragEvent) => {
    if (!onImportFiles || !hasFilesDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, [onImportFiles]);

  const handleRootDragEnter = useCallback((e: React.DragEvent) => {
    if (!onImportFiles || !hasFilesDrag(e)) return;
    e.preventDefault();
    setIsFileDragOver(true);
  }, [onImportFiles]);

  const handleRootDragLeave = useCallback((e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const { clientX: x, clientY: y } = e;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsFileDragOver(false);
    }
  }, []);

  const handleRootDrop = useCallback((e: React.DragEvent) => {
    setIsFileDragOver(false);
    if (!onImportFiles || !hasFilesDrag(e)) return;
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    doImport(files, []);
  }, [onImportFiles, doImport]);

  // -- Built-in tree drag-and-drop (internal moves + file drops) ---------

  const handleDragStart = useCallback((node: TreeNode, e: React.DragEvent) => {
    const meta = node.meta as { path?: string[] } | undefined;
    const data: LibraryMoveData = {
      nodeId: node.id,
      name: node.name,
      path: meta?.path ?? [],
    };
    e.dataTransfer.setData(LIBRARY_MOVE_MIME, JSON.stringify(data));
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((_targetNode: TreeNode, e: React.DragEvent): boolean => {
    // Accept internal moves OR OS file drops
    if (e.dataTransfer.types.includes(LIBRARY_MOVE_MIME)) return true;
    if (onImportFiles && hasFilesDrag(e)) {
      e.dataTransfer.dropEffect = 'copy';
      return true;
    }
    return false;
  }, [onImportFiles]);

  const handleDrop = useCallback((targetNode: TreeNode, e: React.DragEvent) => {
    // OS file drop onto a directory
    if (onImportFiles && hasFilesDrag(e)) {
      const targetMeta = targetNode.meta as { path?: string[] } | undefined;
      const targetPath = [...(targetMeta?.path ?? []), targetNode.name];
      const files = Array.from(e.dataTransfer.files);
      doImport(files, targetPath);
      return;
    }

    // Internal library move
    const jsonData = e.dataTransfer.getData(LIBRARY_MOVE_MIME);
    if (!jsonData) return;
    try {
      const dragData = JSON.parse(jsonData) as LibraryMoveData;
      const sourceNode = findNode(nodes, dragData.nodeId);
      if (!sourceNode) return;
      const targetMeta = targetNode.meta as { path?: string[] } | undefined;
      const targetPath = [...(targetMeta?.path ?? []), targetNode.name];
      onMove(sourceNode, targetPath);
    } catch {
      // Silently ignore malformed drag data
    }
  }, [nodes, onMove, onImportFiles, doImport]);

  // -- Import button for header ------------------------------------------

  const importButton = onImportFiles ? (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".wav"
        multiple
        className="ac-sr-only"
        onChange={handleFileInputChange}
      />
      <button
        className="ac-btn ac-btn-sm"
        onClick={handleImportClick}
        disabled={loading || importing}
        title="Import samples"
      >
        <ImportIcon />
      </button>
    </>
  ) : undefined;

  const dropClass = isFileDragOver ? `${layoutClass} ac-library-browser--file-drag` : layoutClass;

  return (
    <div
      className={dropClass}
      onDragOver={handleRootDragOver}
      onDragEnter={handleRootDragEnter}
      onDragLeave={handleRootDragLeave}
      onDrop={handleRootDrop}
    >
      <div className="ac-library-browser-tree">
        <LibraryPanel
          title={title}
          loading={loading}
          error={error}
          emptyMessage={emptyMessage}
          isEmpty={nodes.length === 0}
          onRefresh={onRefresh}
          onCreateFolder={onCreateFolder}
          headerActions={importButton}
          connectionSlot={connectionSlot}
        >
          {operationProgress && (
            <div className="ac-library-browser-progress">
              <OperationProgressBar progress={operationProgress} />
            </div>
          )}
          <TreeView
            nodes={nodes}
            selectedId={selectedId}
            onSelect={handleSelect}
            onDelete={handleDeleteClick}
            onContextMenu={onContextMenu}
            renderIcon={renderIcon}
            renderTrailing={renderTrailing}
            draggable
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        </LibraryPanel>
      </div>
      {showDetail && (
        <div className="ac-library-browser-detail">
          {renderDetail(selectedNode ?? null)}
        </div>
      )}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
}
