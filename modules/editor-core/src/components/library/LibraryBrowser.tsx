/**
 * Composed library browser component.
 *
 * Assembles LibraryPanel + TreeView + an optional detail panel into
 * a complete library browsing experience with built-in drag-and-drop,
 * folder creation, deletion, file import, and refresh. Consumers
 * provide storage callbacks and optional render props for
 * device-specific content.
 *
 * LibraryBrowser owns operation lifecycle — delete confirmation,
 * progress feedback, error display, and completion status are all
 * handled internally. Consumers just provide async callbacks.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LibraryPanel } from './LibraryPanel';
import { TreeView, type TreeNode } from './TreeView';
import { ConfirmDialog } from './ConfirmDialog';
import { ImportIcon } from './TreeIcons';
import { OperationProgressBar } from '../OperationStatus';
import type { OperationProgress } from '../../types/operation-progress';

const LIBRARY_MOVE_MIME = 'application/x-library-move';

/** How long to show the completion/error status bar (ms). */
const STATUS_DISPLAY_MS = 4000;

interface LibraryMoveData {
  nodeId: string;
  name: string;
  path: string[];
}

type StatusMessage = {
  level: 'info' | 'error';
  text: string;
};

export interface LibraryBrowserProps {
  /** Library tree data */
  nodes: TreeNode[];

  /** Core library operations — all async so LibraryBrowser can track lifecycle */
  onCreateFolder: (name: string) => Promise<void>;
  onDelete: (node: TreeNode) => Promise<void>;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -- Delete confirmation state ------------------------------------------
  const [deleteTarget, setDeleteTarget] = useState<TreeNode | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // -- Inline status bar --------------------------------------------------
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const showStatus = useCallback((level: 'info' | 'error', text: string) => {
    clearTimeout(statusTimerRef.current);
    setStatus({ level, text });
    statusTimerRef.current = setTimeout(() => setStatus(null), STATUS_DISPLAY_MS);
  }, []);

  // Clean up timer on unmount
  useEffect(() => () => clearTimeout(statusTimerRef.current), []);

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
    setDeleteError(null);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(deleteTarget);
      const name = deleteTarget.name;
      setDeleteTarget(null);
      showStatus('info', `Deleted "${name}"`);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, onDelete, showStatus]);

  const handleDeleteCancel = useCallback(() => {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError(null);
  }, [deleting]);

  // -- File import -------------------------------------------------------

  const doImport = useCallback(async (files: File[], targetPath: string[]) => {
    if (!onImportFiles || files.length === 0) return;
    setImporting(true);
    try {
      await onImportFiles(files, targetPath);
      showStatus('info', `Imported ${files.length} file${files.length !== 1 ? 's' : ''}`);
    } catch (err) {
      showStatus('error', err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }, [onImportFiles, showStatus]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    doImport(Array.from(files), []);
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
    if (e.dataTransfer.types.includes(LIBRARY_MOVE_MIME)) return true;
    if (onImportFiles && hasFilesDrag(e)) {
      e.dataTransfer.dropEffect = 'copy';
      return true;
    }
    return false;
  }, [onImportFiles]);

  const handleDrop = useCallback((targetNode: TreeNode, e: React.DragEvent) => {
    if (onImportFiles && hasFilesDrag(e)) {
      const targetMeta = targetNode.meta as { path?: string[] } | undefined;
      const targetPath = [...(targetMeta?.path ?? []), targetNode.name];
      const files = Array.from(e.dataTransfer.files);
      doImport(files, targetPath);
      return;
    }

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

  // -- Status bar content -------------------------------------------------

  const hasStatusContent = operationProgress || status;

  // -- Delete dialog message with error -----------------------------------

  const deleteMessage = deleteError
    ? (
      <>
        <p style={{ margin: '0 0 0.75rem' }}>Delete &ldquo;{deleteTarget?.name}&rdquo;? This cannot be undone.</p>
        <div className="ac-operation-error">{deleteError}</div>
      </>
    )
    : `Delete "${deleteTarget?.name}"? This cannot be undone.`;

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
          {hasStatusContent && (
            <div className="ac-library-browser-status">
              {operationProgress && (
                <OperationProgressBar progress={operationProgress} />
              )}
              {status && !operationProgress && (
                <div className={`ac-library-browser-status-msg ac-library-browser-status-msg--${status.level}`}>
                  {status.text}
                </div>
              )}
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
        message={deleteMessage}
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        danger
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
}
