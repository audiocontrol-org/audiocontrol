/**
 * Composed library browser component.
 *
 * Assembles LibraryPanel + TreeView + an optional detail panel into
 * a complete library browsing experience with built-in drag-and-drop,
 * folder creation, deletion, and refresh. Consumers provide storage
 * callbacks and optional render props for device-specific content.
 */

import React, { useCallback, useState } from 'react';
import { LibraryPanel } from './LibraryPanel';
import { TreeView, type TreeNode } from './TreeView';

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

export function LibraryBrowser({
  nodes,
  onCreateFolder,
  onDelete,
  onMove,
  onRefresh,
  onSelect,
  renderDetail,
  renderIcon,
  renderTrailing,
  title,
  loading,
  error,
  emptyMessage = 'No items',
  connectionSlot,
  onContextMenu,
}: LibraryBrowserProps): JSX.Element {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const selectedNode = selectedId ? findNode(nodes, selectedId) : undefined;
  const showDetail = renderDetail !== undefined;
  const layoutClass = showDetail ? 'ac-library-browser ac-library-browser--split' : 'ac-library-browser';

  const handleSelect = useCallback((node: TreeNode) => {
    setSelectedId(node.id);
    onSelect?.(node);
  }, [onSelect]);

  // Built-in drag-and-drop
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
    return e.dataTransfer.types.includes(LIBRARY_MOVE_MIME);
  }, []);

  const handleDrop = useCallback((targetNode: TreeNode, e: React.DragEvent) => {
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
  }, [nodes, onMove]);

  return (
    <div className={layoutClass}>
      <div className="ac-library-browser-tree">
        <LibraryPanel
          title={title}
          loading={loading}
          error={error}
          emptyMessage={emptyMessage}
          isEmpty={nodes.length === 0}
          onRefresh={onRefresh}
          onCreateFolder={onCreateFolder}
          connectionSlot={connectionSlot}
        >
          <TreeView
            nodes={nodes}
            selectedId={selectedId}
            onSelect={handleSelect}
            onDelete={onDelete}
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
    </div>
  );
}
