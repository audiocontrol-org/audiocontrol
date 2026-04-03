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
 *
 * Transfer dialogs:
 * - Sample SDS: SendSampleDialog, ReceiveSampleDialog
 * - Program SysEx: ExportProgramDialog, ImportProgramDialog
 * - Drum Kit: ImportDrumKitDialog
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
import type { S3kMemoryPanelState } from '@/plugins/s3k-library-plugin';
import { useS3000xlClient } from '@/hooks/useS3000xlClient';
import { useDeviceLibraryData } from '@/hooks/useDeviceLibraryData';
import { useLibraryPrograms } from '@/hooks/useLibraryPrograms';
import { useProgramTransfer } from '@/hooks/useProgramTransfer';
import { useDrumKitTransfer } from '@/hooks/useDrumKitTransfer';
import { SendSampleDialog } from '@/components/library/SendSampleDialog';
import { ReceiveSampleDialog } from '@/components/library/ReceiveSampleDialog';
import { ExportProgramDialog } from '@/components/library/ExportProgramDialog';
import { ImportProgramDialog } from '@/components/library/ImportProgramDialog';
import { ImportDrumKitDialog } from '@/components/library/ImportDrumKitDialog';
import type { S3kPreviewCustomState } from '@/components/library/S3kItemPreviewPanel';

const PICKER_ID = 'akai-s3k-library';

// =========================================================================
// Sample dialog state
// =========================================================================

interface SendDialogState {
  open: boolean;
  sampleName: string;
  samplePath: string[];
}

interface ReceiveDialogState {
  open: boolean;
  sampleIndex: number;
  sampleName: string;
}

const SEND_DIALOG_CLOSED: SendDialogState = {
  open: false, sampleName: '', samplePath: [],
};
const RECEIVE_DIALOG_CLOSED: ReceiveDialogState = {
  open: false, sampleIndex: 0, sampleName: '',
};

// =========================================================================
// Data loading hook
// =========================================================================

function useLibraryTreeData(root: StorageDirectoryHandle | null) {
  const setSampleNodes = useLibraryStore((s) => s.setSampleNodes);
  const setLoading = useLibraryStore((s) => s.setLoading);
  const setError = useLibraryStore((s) => s.setError);
  const clear = useLibraryStore((s) => s.clear);

  const { refreshPrograms } = useLibraryPrograms(root);

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
      await refreshPrograms();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to scan library';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [root, setSampleNodes, setLoading, setError, clear, refreshPrograms]);

  return { refresh, refreshPrograms };
}

// =========================================================================
// LibraryPage component
// =========================================================================

export function LibraryPage(): JSX.Element {
  const {
    activeBackend,
    isConnected: isLibraryConnected,
    root,
    connect,
    disconnect,
    hasLocalFS,
    hasGoogleDrive,
    hasOPFS,
  } = useLibraryConnection({ pickerId: PICKER_ID });

  const { refresh: refreshLibrary, refreshPrograms } = useLibraryTreeData(root);

  const { client, isConnected: isDeviceConnected } = useS3000xlClient();
  const { refresh: refreshDevice, isLoading: isDeviceLoading } =
    useDeviceLibraryData(client, isDeviceConnected);

  const sampleNodes = useLibraryStore((s) => s.sampleNodes);
  const programNodes = useLibraryStore((s) => s.programNodes);
  const loading = useLibraryStore((s) => s.loading);
  const error = useLibraryStore((s) => s.error);
  const clear = useLibraryStore((s) => s.clear);
  const deviceProgramNames = useLibraryStore((s) => s.deviceProgramNames);
  const deviceSampleNames = useLibraryStore((s) => s.deviceSampleNames);
  const selectedDeviceIndex = useLibraryStore((s) => s.selectedDeviceIndex);
  const selectedDeviceType = useLibraryStore((s) => s.selectedDeviceType);
  const setSelectedDevice = useLibraryStore((s) => s.setSelectedDevice);

  const [selection, setSelection] = useState<ItemSelection | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Record<string, Set<string>>>({});

  // Sample dialog state
  const [sendDialog, setSendDialog] = useState<SendDialogState>(SEND_DIALOG_CLOSED);
  const [receiveDialog, setReceiveDialog] = useState<ReceiveDialogState>(RECEIVE_DIALOG_CLOSED);

  // Program dialog state
  const programTransfer = useProgramTransfer(isDeviceConnected, !!root);

  // Drum kit dialog state
  const drumKitTransfer = useDrumKitTransfer(isDeviceConnected, !!root);

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
      setExpandedPaths({});
    }
  }, [isLibraryConnected, clear]);

  // Map store data to plugin category format
  const categoryData = useMemo<Record<string, TreeNode[]>>(() => ({
    samples: sampleNodes,
    programs: programNodes,
  }), [sampleNodes, programNodes]);

  // -----------------------------------------------------------------------
  // Device memory selection — creates preview-compatible ItemSelection
  // -----------------------------------------------------------------------

  const handleDeviceSelectProgram = useCallback(
    (index: number) => {
      setSelectedDevice('program', index);
      setSelection({
        categoryId: 'device',
        node: {
          id: `device-program:${index}`,
          name: deviceProgramNames[index] ?? `Program ${index}`,
          type: 'device-program',
        },
        meta: { deviceIndex: index },
      });
    },
    [setSelectedDevice, deviceProgramNames],
  );

  const handleDeviceSelectSample = useCallback(
    (index: number) => {
      setSelectedDevice('sample', index);
      setSelection({
        categoryId: 'device',
        node: {
          id: `device-sample:${index}`,
          name: deviceSampleNames[index] ?? `Sample ${index}`,
          type: 'device-sample',
        },
        meta: { deviceIndex: index },
      });
    },
    [setSelectedDevice, deviceSampleNames],
  );

  // -----------------------------------------------------------------------
  // Sample dialog callbacks
  // -----------------------------------------------------------------------

  const handleSendSampleToDevice = useCallback(
    (name: string, path?: string[]) => {
      if (!client || !root) return;
      setSendDialog({ open: true, sampleName: name, samplePath: path ?? [] });
    },
    [client, root],
  );

  const handleSaveDeviceSampleToLibrary = useCallback(
    (index: number, name: string) => {
      if (!client || !root) return;
      setReceiveDialog({ open: true, sampleIndex: index, sampleName: name });
    },
    [client, root],
  );

  // -----------------------------------------------------------------------
  // Program dialog callbacks
  // -----------------------------------------------------------------------

  const handleSaveDeviceProgramToLibrary = useCallback(
    (index: number, name: string) => {
      programTransfer.openExportDialog(index, name);
    },
    [programTransfer],
  );

  const handleSendProgramToDevice = useCallback(
    (dirName: string, name: string) => {
      const targetSlot = selectedDeviceType === 'program' && selectedDeviceIndex !== null
        ? selectedDeviceIndex
        : deviceProgramNames.length;
      programTransfer.openImportDialog(dirName, name, targetSlot);
    },
    [programTransfer, selectedDeviceType, selectedDeviceIndex, deviceProgramNames.length],
  );

  const handleExportComplete = useCallback(async () => {
    await refreshPrograms();
  }, [refreshPrograms]);

  const handleImportComplete = useCallback(async () => {
    await refreshDevice();
  }, [refreshDevice]);

  // -----------------------------------------------------------------------
  // Preview state
  // -----------------------------------------------------------------------

  const canTransfer = isDeviceConnected && !!root;

  const previewState = useMemo<S3kPreviewCustomState>(() => ({
    onSendSampleToDevice: canTransfer ? handleSendSampleToDevice : undefined,
    onSaveDeviceSampleToLibrary: canTransfer ? handleSaveDeviceSampleToLibrary : undefined,
    onSaveDeviceProgramToLibrary: canTransfer ? handleSaveDeviceProgramToLibrary : undefined,
    onSendProgramToDevice: canTransfer ? handleSendProgramToDevice : undefined,
    onImportDrumKit: canTransfer ? drumKitTransfer.openDialog : undefined,
  }), [
    canTransfer,
    handleSendSampleToDevice,
    handleSaveDeviceSampleToLibrary,
    handleSaveDeviceProgramToLibrary,
    handleSendProgramToDevice,
    drumKitTransfer.openDialog,
  ]);

  // -----------------------------------------------------------------------
  // Device memory panel state
  // -----------------------------------------------------------------------

  const deviceMemoryState = useMemo<S3kMemoryPanelState>(() => ({
    programNames: deviceProgramNames,
    sampleNames: deviceSampleNames,
    selectedIndex: selectedDeviceIndex,
    selectedType: selectedDeviceType,
    onSelectProgram: handleDeviceSelectProgram,
    onSelectSample: handleDeviceSelectSample,
    onRefresh: () => void refreshDevice(),
    isConnected: isDeviceConnected,
    isLoading: isDeviceLoading,
  }), [
    deviceProgramNames, deviceSampleNames,
    selectedDeviceIndex, selectedDeviceType,
    handleDeviceSelectProgram, handleDeviceSelectSample,
    refreshDevice, isDeviceConnected, isDeviceLoading,
  ]);

  // -----------------------------------------------------------------------
  // Standard library callbacks
  // -----------------------------------------------------------------------

  const handleConnect = useCallback(
    (backend: 'local' | 'google-drive' | 'opfs') => { void connect(backend); },
    [connect],
  );

  const handleToggleExpand = useCallback(
    (categoryId: string, nodeId: string) => {
      setExpandedPaths((prev) => {
        const set = new Set(prev[categoryId] ?? []);
        if (set.has(nodeId)) set.delete(nodeId); else set.add(nodeId);
        return { ...prev, [categoryId]: set };
      });
    },
    [],
  );

  const handleCreateFolder = useCallback(
    async (_catId: string, parentPath: string[]) => {
      if (!root) return;
      const name = window.prompt('Folder name:');
      if (!name) return;
      await createFolder(root, parentPath, name);
      void refreshLibrary();
    },
    [root, refreshLibrary],
  );

  const handleDelete = useCallback(
    async (_catId: string, node: TreeNode) => {
      if (!root) return;
      const meta = node.meta as { path?: string[] } | undefined;
      await deleteItem(root, node.name, meta?.path ?? []);
      void refreshLibrary();
    },
    [root, refreshLibrary],
  );

  const handleMove = useCallback(
    async (_catId: string, node: TreeNode, targetPath: string[]) => {
      if (!root) return;
      const meta = node.meta as { path?: string[] } | undefined;
      await moveItem(root, node.name, meta?.path ?? [], targetPath);
      void refreshLibrary();
    },
    [root, refreshLibrary],
  );

  const handleRename = useCallback(
    async (_catId: string, _node: TreeNode, _newName: string) => {
      throw new Error('Rename not yet implemented');
    },
    [],
  );

  const handleFileDrop = useCallback(
    async (_catId: string, files: File[], targetPath: string[]) => {
      if (!root) return;
      for (const file of files) {
        const buf = await file.arrayBuffer();
        await importWavToCommonArea(root, file.name, new Uint8Array(buf), { targetPath });
      }
      void refreshLibrary();
    },
    [root, refreshLibrary],
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

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

  // Guideline deviation: casting StorageDirectoryHandle to
  // FileSystemDirectoryHandle because PluginLibraryBrowser only checks
  // truthiness. The prop type should be widened in editor-core.
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
          onRefresh={refreshLibrary}
          onCreateFolder={handleCreateFolder}
          onDelete={handleDelete}
          onMove={handleMove}
          onRename={handleRename}
          onFileDrop={handleFileDrop}
          deviceMemoryState={deviceMemoryState}
          previewState={previewState}
          loading={loading}
          error={error ?? undefined}
          connectionSlot={connectionSlot}
        />
      </div>

      {/* Sample Transfer Dialogs */}
      {client && root && (
        <>
          <SendSampleDialog
            open={sendDialog.open}
            onClose={() => setSendDialog(SEND_DIALOG_CLOSED)}
            sampleName={sendDialog.sampleName}
            samplePath={sendDialog.samplePath}
            client={client}
            libraryRoot={root}
            deviceSampleCount={deviceSampleNames.length}
            onTransferComplete={() => refreshDevice()}
          />
          <ReceiveSampleDialog
            open={receiveDialog.open}
            onClose={() => setReceiveDialog(RECEIVE_DIALOG_CLOSED)}
            sampleIndex={receiveDialog.sampleIndex}
            sampleName={receiveDialog.sampleName}
            client={client}
            libraryRoot={root}
            onTransferComplete={() => refreshLibrary()}
          />
        </>
      )}

      {/* Drum Kit Import Dialog */}
      {client && root && (
        <ImportDrumKitDialog
          open={drumKitTransfer.dialog.open}
          onClose={drumKitTransfer.closeDialog}
          sampleName={drumKitTransfer.dialog.sampleName}
          samplePath={drumKitTransfer.dialog.samplePath}
          client={client}
          libraryRoot={root}
          onImportComplete={() => refreshDevice()}
        />
      )}

      {/* Program Transfer Dialogs */}
      {client && root && (
        <>
          <ExportProgramDialog
            open={programTransfer.exportDialog.open}
            onClose={programTransfer.closeExportDialog}
            programIndex={programTransfer.exportDialog.programIndex}
            programName={programTransfer.exportDialog.programName}
            client={client}
            libraryRoot={root}
            onExportComplete={handleExportComplete}
          />
          <ImportProgramDialog
            open={programTransfer.importDialog.open}
            onClose={programTransfer.closeImportDialog}
            programDirName={programTransfer.importDialog.programDirName}
            programName={programTransfer.importDialog.programName}
            targetProgramIndex={programTransfer.importDialog.targetProgramIndex}
            client={client}
            libraryRoot={root}
            deviceSampleNames={deviceSampleNames}
            onImportComplete={handleImportComplete}
          />
        </>
      )}
    </div>
  );
}
