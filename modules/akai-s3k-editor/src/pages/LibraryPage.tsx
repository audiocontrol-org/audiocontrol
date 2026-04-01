/**
 * Library Page — browse and manage the S3000XL sampler library.
 *
 * Three-column layout via PluginLibraryBrowser:
 * - Left: Device memory (programs and samples on device)
 * - Center: Library browser (samples and programs from storage)
 * - Right: Preview/details panel for selected item
 *
 * Uses the plugin architecture for device-agnostic library browsing.
 * The s3kLibraryPlugin defines categories, item types, memory config,
 * and preview panel rendering. This page wires up data and callbacks.
 */

import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import {
  useLibraryConnection,
  LibraryConnectionUI,
  PluginLibraryBrowser,
  type TreeNode,
  type ItemSelection,
} from '@audiocontrol/editor-core';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import {
  deleteItem,
  createFolder,
  moveItem,
  importWavToCommonArea,
  listCommonSamplesTree,
} from '@audiocontrol/sampler-library/browser';
import { useLibraryStore } from '@/stores/libraryStore';
import { toTreeNode } from '@/lib/library-tree';
import { s3kLibraryPlugin } from '@/plugins/s3k-library-plugin';

const PICKER_ID = 'akai-s3k-library';

// =========================================================================
// Data loading
// =========================================================================

/**
 * Hook for loading and refreshing library tree data.
 *
 * Scans the common-area samples directory, converting results into
 * editor-core TreeNodes for the plugin browser. Programs tree scanning
 * will be added when sampler-library exports listCommonProgramsTree.
 */
function useLibraryTreeData(root: StorageDirectoryHandle | null) {
  const setSampleNodes = useLibraryStore((s) => s.setSampleNodes);
  const setProgramNodes = useLibraryStore((s) => s.setProgramNodes);
  const setLoading = useLibraryStore((s) => s.setLoading);
  const setError = useLibraryStore((s) => s.setError);
  const clear = useLibraryStore((s) => s.clear);

  const refresh = useCallback(async () => {
    if (!root) {
      clear();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const sampleTreeNodes = await listCommonSamplesTree(root);
      setSampleNodes(sampleTreeNodes.map(toTreeNode));
      // Programs tree scanning will be added when sampler-library
      // exports listCommonProgramsTree. For now, programs is empty.
      setProgramNodes([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to scan library';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [root, setSampleNodes, setProgramNodes, setLoading, setError, clear]);

  return { refresh };
}

// =========================================================================
// LibraryPage component
// =========================================================================

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

  const { refresh } = useLibraryTreeData(root);

  const sampleNodes = useLibraryStore((s) => s.sampleNodes);
  const programNodes = useLibraryStore((s) => s.programNodes);
  const loading = useLibraryStore((s) => s.loading);
  const error = useLibraryStore((s) => s.error);
  const clear = useLibraryStore((s) => s.clear);

  const [selection, setSelection] = useState<ItemSelection | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Record<string, Set<string>>>({});

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
      setSelection(null);
      setExpandedPaths({});
    }
  }, [isConnected, clear]);

  // Map store data to plugin category format
  const categoryData = useMemo<Record<string, TreeNode[]>>(() => ({
    samples: sampleNodes,
    programs: programNodes,
  }), [sampleNodes, programNodes]);

  // -----------------------------------------------------------------------
  // Callbacks
  // -----------------------------------------------------------------------

  const handleConnect = useCallback(
    (backend: 'local' | 'google-drive' | 'opfs') => {
      void connect(backend);
    },
    [connect],
  );

  const handleToggleExpand = useCallback(
    (categoryId: string, nodeId: string) => {
      setExpandedPaths((prev) => {
        const categorySet = new Set(prev[categoryId] ?? []);
        if (categorySet.has(nodeId)) {
          categorySet.delete(nodeId);
        } else {
          categorySet.add(nodeId);
        }
        return { ...prev, [categoryId]: categorySet };
      });
    },
    [],
  );

  const handleCreateFolder = useCallback(
    async (_categoryId: string, parentPath: string[]) => {
      if (!root) return;
      const name = window.prompt('Folder name:');
      if (!name) return;
      await createFolder(root, parentPath, name);
      void refresh();
    },
    [root, refresh],
  );

  const handleDelete = useCallback(
    async (_categoryId: string, node: TreeNode) => {
      if (!root) return;
      const meta = node.meta as { path?: string[] } | undefined;
      await deleteItem(root, node.name, meta?.path ?? []);
      void refresh();
    },
    [root, refresh],
  );

  const handleMove = useCallback(
    async (_categoryId: string, node: TreeNode, targetPath: string[]) => {
      if (!root) return;
      const meta = node.meta as { path?: string[] } | undefined;
      await moveItem(root, node.name, meta?.path ?? [], targetPath);
      void refresh();
    },
    [root, refresh],
  );

  const handleRename = useCallback(
    async (_categoryId: string, _node: TreeNode, _newName: string) => {
      // Rename support will be added when sampler-library exports renameItem
      throw new Error('Rename not yet implemented');
    },
    [],
  );

  const handleFileDrop = useCallback(
    async (_categoryId: string, files: File[], targetPath: string[]) => {
      if (!root) return;
      for (const file of files) {
        const buffer = await file.arrayBuffer();
        const data = new Uint8Array(buffer);
        await importWavToCommonArea(root, file.name, data, { targetPath });
      }
      void refresh();
    },
    [root, refresh],
  );

  // -----------------------------------------------------------------------
  // Slots
  // -----------------------------------------------------------------------

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

  // PluginLibraryBrowser.libraryHandle is typed as FileSystemDirectoryHandle
  // but only uses it for truthiness checks. StorageDirectoryHandle is the
  // broader abstraction from sampler-library that wraps OPFS, local FS, etc.
  // Guideline deviation: casting StorageDirectoryHandle to
  // FileSystemDirectoryHandle because the component only checks truthiness.
  // The prop type should be widened in editor-core; this cast is temporary.
  const libraryHandle = root as unknown as FileSystemDirectoryHandle | null;

  return (
    <div className="ac-page">
      <div className="ac-page-sticky-header">
        <div className="ac-page-header">
          <h2 className="text-xl font-bold">Library</h2>
        </div>
      </div>
      <div className="ac-page-content" style={{ height: 'calc(100vh - 8rem)' }}>
        <PluginLibraryBrowser
          plugin={s3kLibraryPlugin}
          libraryHandle={libraryHandle}
          categoryData={categoryData}
          expandedPaths={expandedPaths}
          selection={selection}
          onSelectionChange={setSelection}
          onToggleExpand={handleToggleExpand}
          onRefresh={refresh}
          onCreateFolder={handleCreateFolder}
          onDelete={handleDelete}
          onMove={handleMove}
          onRename={handleRename}
          onFileDrop={handleFileDrop}
          loading={loading}
          error={error ?? undefined}
          connectionSlot={connectionSlot}
        />
      </div>
    </div>
  );
}
