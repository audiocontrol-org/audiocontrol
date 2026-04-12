import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import {
  useLibraryConnection,
  LibraryConnectionUI,
  PluginLibraryBrowser,
  type TreeNode,
  type ItemSelection,
  useLibraryOperations,
} from '@audiocontrol/editor-core';
import { useLibraryStore } from '@/stores/libraryStore';
import { useLibraryData } from '@/hooks/use-library-data';
import { samplerLibraryPlugin } from '@/plugins/sampler-library-plugin';

const PICKER_ID = 'standalone-sampler-library';

export function LibraryPage(): JSX.Element {
  const {
    activeBackend,
    isConnected: isLibraryConnected,
    root, connect, disconnect,
    hasLocalFS, hasGoogleDrive, hasOPFS,
  } = useLibraryConnection({ pickerId: PICKER_ID });

  const { refresh: refreshLibrary } = useLibraryData(root);

  const sampleNodes = useLibraryStore((s) => s.sampleNodes);
  const programNodes = useLibraryStore((s) => s.programNodes);
  const loading = useLibraryStore((s) => s.loading);
  const error = useLibraryStore((s) => s.error);
  const clear = useLibraryStore((s) => s.clear);
  const setError = useLibraryStore((s) => s.setError);

  const [selection, setSelection] = useState<ItemSelection | null>(null);

  const libraryOps = useLibraryOperations(
    root,
    undefined,
    refreshLibrary,
    (msg: string) => setError(msg),
  );

  const hasInitiatedScan = useRef(false);

  // Scan library on first connect
  useEffect(() => {
    if (isLibraryConnected && root && !hasInitiatedScan.current) {
      hasInitiatedScan.current = true;
      void refreshLibrary();
    }
  }, [isLibraryConnected, root, refreshLibrary]);

  // Clear data on disconnect
  useEffect(() => {
    if (!isLibraryConnected) {
      hasInitiatedScan.current = false;
      clear();
      setSelection(null);
    }
  }, [isLibraryConnected, clear]);

  const categoryData = useMemo<Record<string, TreeNode[]>>(() => ({
    samples: sampleNodes,
    programs: programNodes,
  }), [sampleNodes, programNodes]);

  const handleConnect = useCallback(
    (backend: 'local' | 'google-drive' | 'opfs') => { void connect(backend); },
    [connect],
  );

  const connectionSlot = (
    <LibraryConnectionUI
      activeBackend={activeBackend}
      isConnected={isLibraryConnected}
      hasLocalFS={hasLocalFS}
      hasGoogleDrive={hasGoogleDrive}
      hasOPFS={hasOPFS}
      onConnect={handleConnect}
      onDisconnect={disconnect}
    />
  );

  return (
    <div className="ac-page">
      <div className="ac-page-sticky-header">
        <div className="ac-page-header">
          <h2 className="text-xl font-bold">Library</h2>
        </div>
      </div>
      <div className="ac-page-content flex" style={{ height: 'calc(100vh - 8rem)' }}>
        <div className="flex-1 min-w-0">
          <PluginLibraryBrowser
            plugin={samplerLibraryPlugin}
            libraryHandle={root}
            categoryData={categoryData}
            expandedPaths={libraryOps.expandedPaths}
            selection={selection}
            onSelectionChange={setSelection}
            onToggleExpand={libraryOps.onToggleExpand}
            onRefresh={refreshLibrary}
            onCreateFolder={libraryOps.onCreateFolder}
            onDelete={libraryOps.onDelete}
            onMove={libraryOps.onMove}
            onRename={libraryOps.onRename}
            onFileDrop={libraryOps.onFileDrop}
            onContextMenuAction={libraryOps.onContextMenuAction}
            loading={loading}
            error={error ?? undefined}
            connectionSlot={connectionSlot}
          />
        </div>
      </div>
    </div>
  );
}
