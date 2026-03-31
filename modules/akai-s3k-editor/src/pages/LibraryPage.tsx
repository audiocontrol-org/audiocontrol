/**
 * Library Page — browse and manage the sampler library.
 *
 * Two-column layout:
 * - Left: Library browser tree (common-area samples and programs)
 * - Right: Detail panel for the selected item
 *
 * Uses editor-core's LibraryBrowser component for the tree view, and
 * editor-core's LibraryConnectionUI + useLibraryConnection for storage
 * backend management (OPFS, local filesystem, Google Drive).
 *
 * TODO: Device export/import buttons require S3000XL SDS (Sample Dump
 * Standard) implementation in sampler-devices. The client currently only
 * supports header read/write, not bulk sample transfer.
 */

import { useEffect, useCallback, useRef } from 'react';
import {
  useLibraryConnection,
  LibraryConnectionUI,
  LibraryBrowser,
  type TreeNode,
} from '@audiocontrol/editor-core';
import {
  deleteItem,
  createFolder,
  moveItem,
  importWavToCommonArea,
} from '@audiocontrol/sampler-library/browser';
import { useLibraryStore } from '@/stores/libraryStore';
import { useLibraryData } from '@/hooks/useLibraryData';
import { LibraryDetailPanel } from '@/components/library/LibraryDetailPanel';

const PICKER_ID = 'akai-s3k-library';

export function LibraryPage(): JSX.Element {
  const {
    activeBackend,
    isConnected,
    root,
    connect,
    disconnect,
    hasLocalFS,
    hasGoogleDrive,
    hasOPFS,
  } = useLibraryConnection({ pickerId: PICKER_ID });

  const { refresh } = useLibraryData(root);

  const sampleNodes = useLibraryStore((s) => s.sampleNodes);
  const setSelectedNode = useLibraryStore((s) => s.setSelectedNode);
  const loading = useLibraryStore((s) => s.loading);
  const error = useLibraryStore((s) => s.error);
  const clear = useLibraryStore((s) => s.clear);

  const hasInitiatedScan = useRef(false);

  // Scan library on first connect
  useEffect(() => {
    if (isConnected && root && !hasInitiatedScan.current) {
      hasInitiatedScan.current = true;
      void refresh();
    }
  }, [isConnected, root, refresh]);

  // Clear data on disconnect
  useEffect(() => {
    if (!isConnected) {
      hasInitiatedScan.current = false;
      clear();
    }
  }, [isConnected, clear]);

  const handleConnect = useCallback(
    (backend: 'local' | 'google-drive' | 'opfs') => {
      void connect(backend);
    },
    [connect],
  );

  const handleRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);

  const handleSelect = useCallback(
    (node: TreeNode) => {
      setSelectedNode(node);
    },
    [setSelectedNode],
  );

  const handleCreateFolder = useCallback(
    async (name: string, parentPath: string[]) => {
      if (!root) return;
      await createFolder(root, parentPath, name);
    },
    [root],
  );

  const handleDelete = useCallback(
    async (node: TreeNode) => {
      if (!root) return;
      const meta = node.meta as { path?: string[] } | undefined;
      await deleteItem(root, node.name, meta?.path ?? []);
    },
    [root],
  );

  const handleMove = useCallback(
    async (node: TreeNode, targetPath: string[]) => {
      if (!root) return;
      const meta = node.meta as { path?: string[] } | undefined;
      await moveItem(root, node.name, meta?.path ?? [], targetPath);
    },
    [root],
  );

  const handleImportFiles = useCallback(
    async (files: File[], targetPath: string[]) => {
      if (!root) return;
      for (const file of files) {
        const buffer = await file.arrayBuffer();
        const data = new Uint8Array(buffer);
        await importWavToCommonArea(root, file.name, data, { targetPath });
      }
    },
    [root],
  );

  const connectionSlot = (
    <LibraryConnectionUI
      activeBackend={activeBackend}
      isConnected={isConnected}
      hasLocalFS={hasLocalFS}
      hasGoogleDrive={hasGoogleDrive}
      hasOPFS={hasOPFS}
      onConnect={handleConnect}
      onDisconnect={disconnect}
    />
  );

  const renderDetail = useCallback(
    (node: TreeNode | null) => <LibraryDetailPanel node={node} />,
    [],
  );

  return (
    <div className="ac-page">
      <div className="ac-page-sticky-header">
        <div className="ac-page-header">
          <h2 className="text-xl font-bold">Library</h2>
        </div>
      </div>
      <div className="ac-page-content" style={{ height: 'calc(100vh - 8rem)' }}>
        <LibraryBrowser
          nodes={sampleNodes}
          title="Samples"
          loading={loading}
          error={error ?? undefined}
          emptyMessage="No samples in the library yet. Import WAV files to get started."
          connectionSlot={connectionSlot}
          onCreateFolder={handleCreateFolder}
          onDelete={handleDelete}
          onMove={handleMove}
          onRefresh={handleRefresh}
          onImportFiles={handleImportFiles}
          onSelect={handleSelect}
          renderDetail={renderDetail}
        />
      </div>
    </div>
  );
}
