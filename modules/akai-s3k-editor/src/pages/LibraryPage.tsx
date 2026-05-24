/**
 * Library Page -- browse and manage the S3000XL sampler library.
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
 * - Instrument: ImportInstrumentDialog (common-area program -> S3K keygroups)
 *
 * Editor dialogs (device-agnostic):
 * - Loop Editor: edit loop points on samples
 * - Sample Editor: trim, normalize, fade, reverse samples
 * - Sample Chopper: slice samples into drum kits
 * - Drum Kit Editor: edit kit metadata and per-pad configuration
 */

import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import {
  useLibraryConnection,
  useErrorReporter,
  LibraryConnectionUI,
  PageTitleRow,
  PluginLibraryBrowser,
  type TreeNode,
  type ItemSelection,
  useLibraryOperations,
} from '@audiocontrol/editor-core';
import { LoopEditorDialog } from '@audiocontrol/loop-editor/ui';
import { SampleEditorDialog } from '@audiocontrol/sample-editor/ui';
import { SampleChopperDialog } from '@audiocontrol/sample-chopper/ui';
import { useLibraryStore } from '@/stores/libraryStore';
import { s3kLibraryPlugin } from '@/plugins/s3k-library-plugin';
import type { S3kMemoryPanelState } from '@/plugins/s3k-library-plugin';
import { useS3000xlClient } from '@/hooks/useS3000xlClient';
import { useDeviceLibraryData } from '@/hooks/useDeviceLibraryData';
import { useProgramTransfer } from '@/hooks/useProgramTransfer';
import { useDrumKitTransfer } from '@/hooks/useDrumKitTransfer';
import { useInstrumentTransfer } from '@/hooks/useInstrumentTransfer';
import { useEditorDialogs } from '@/hooks/useEditorDialogs';
import { useS3kLibraryData } from '@/hooks/useS3kLibraryData';
import { useS3kSelectionHandlers } from '@/hooks/useS3kSelectionHandlers';
import { useS3kLibraryStrategy } from '@/hooks/useS3kLibraryStrategy';
import { useS3kTransferCallbacks } from '@/hooks/useS3kTransferCallbacks';
import { usePromotionTransfer } from '@/hooks/usePromotionTransfer';
import {
  SAVE_DIALOG_CLOSED, SEND_DIALOG_CLOSED,
  type SaveToLibraryDialogState, type SendToDeviceDialogState,
} from '@audiocontrol/editor-core';
import { DiskBrowserPanel, DISK_ITEM_MIME, type DiskDragPayload, type DiskBrowserHandle } from '@/components/library/DiskBrowserPanel';
import { DEVICE_MEMORY_MIME, type DeviceMemoryDragPayload } from '@/components/library/DeviceMemoryPanel';
import { isAkaiSample, isAkaiProgram } from '@audiocontrol/sampler-devices/s3k';
import {
  DiskToLibraryDialog,
  saveToCommonLibrary,
  saveToS3kLibrary,
  collectSampleNames,
  estimateTotalBytes,
  type SaveProgress,
} from '@/components/library/DiskToLibraryDialog';
import { readFileData } from '@audiocontrol/sampler-devices/s3k';
import { getActiveScsiUrl } from '@audiocontrol/editor-core';
import type { AkaiDiskFileEntry } from '@audiocontrol/sampler-devices/s3k';
import { SendSampleDialog } from '@/components/library/SendSampleDialog';
import { ReceiveSampleDialog } from '@/components/library/ReceiveSampleDialog';
import { ExportProgramDialog } from '@/components/library/ExportProgramDialog';
import { ImportProgramDialog } from '@/components/library/ImportProgramDialog';
import { ImportDrumKitDialog } from '@/components/library/ImportDrumKitDialog';
import { ImportInstrumentDialog } from '@/components/library/ImportInstrumentDialog';
import { DrumKitEditorDialog } from '@/components/library/DrumKitEditorDialog';
import { S3kKitOutputConfig } from '@/components/library/S3kKitOutputConfig';
import type { S3kPreviewCustomState } from '@/components/library/S3kItemPreviewPanel';

const PICKER_ID = 'akai-s3k-library';

interface DiskToLibraryDialogState {
  open: boolean;
  file: AkaiDiskFileEntry | null;
  partitionData: Uint8Array | null;
  volumeStartBlock: number;
  ensureFileBlocks?: (fileEntry: AkaiDiskFileEntry) => Promise<void>;
}

interface DropTransferState {
  active: boolean;
  fileName: string;
  progress: SaveProgress | null;
  error: string | null;
}

const DROP_TRANSFER_IDLE: DropTransferState = {
  active: false, fileName: '', progress: null, error: null,
};

const DISK_TO_LIBRARY_CLOSED: DiskToLibraryDialogState = {
  open: false, file: null, partitionData: null, volumeStartBlock: 0,
};

// =========================================================================
// LibraryPage component
// =========================================================================

export function LibraryPage(): JSX.Element {
  const {
    activeBackend,
    isConnected: isLibraryConnected,
    root, connect, disconnect,
    hasLocalFS, hasGoogleDrive, hasOPFS,
  } = useLibraryConnection({ pickerId: PICKER_ID });

  const { refresh: refreshLibrary, refreshPrograms } = useS3kLibraryData(root);
  const { client, isConnected: isDeviceConnected } = useS3000xlClient();
  const { refresh: refreshDevice, isLoading: isDeviceLoading } =
    useDeviceLibraryData(client, isDeviceConnected);

  const sampleNodes = useLibraryStore((s) => s.sampleNodes);
  const commonProgramNodes = useLibraryStore((s) => s.commonProgramNodes);
  const programNodes = useLibraryStore((s) => s.programNodes);
  const loading = useLibraryStore((s) => s.loading);
  const error = useLibraryStore((s) => s.error);
  const clear = useLibraryStore((s) => s.clear);
  const setError = useLibraryStore((s) => s.setError);
  const deviceProgramNames = useLibraryStore((s) => s.deviceProgramNames);
  const deviceSampleNames = useLibraryStore((s) => s.deviceSampleNames);
  const selectedDeviceIndex = useLibraryStore((s) => s.selectedDeviceIndex);
  const selectedDeviceType = useLibraryStore((s) => s.selectedDeviceType);
  const setSelectedDevice = useLibraryStore((s) => s.setSelectedDevice);

  const [selection, setSelection] = useState<ItemSelection | null>(null);
  const [sendDialog, setSendDialog] = useState<SendToDeviceDialogState>(SEND_DIALOG_CLOSED);
  const [receiveDialog, setReceiveDialog] = useState<SaveToLibraryDialogState>(SAVE_DIALOG_CLOSED);
  const [diskToLibrary, setDiskToLibrary] = useState<DiskToLibraryDialogState>(DISK_TO_LIBRARY_CLOSED);
  const diskBrowserRef = useRef<DiskBrowserHandle>(null);
  const [dropTransfer, setDropTransfer] = useState<DropTransferState>(DROP_TRANSFER_IDLE);

  /**
   * Ref to the latest transfer callbacks. Used inside handleExternalDrop so
   * that the device-memory drop handler can call the current callbacks without
   * requiring handleExternalDrop to be re-created every time transferCallbacks
   * changes (which would cause PluginLibraryBrowser to re-render).
   */
  const transferCallbacksRef = useRef<ReturnType<typeof useS3kTransferCallbacks> | null>(null);

  const handleExternalDrop = useCallback((categoryId: string, dataTransfer: DataTransfer, targetPath: string[] = []): boolean => {
    console.log('[LibraryPage] handleExternalDrop:', categoryId, 'types:', Array.from(dataTransfer.types));
    if (!root) return false;

    // Handle device memory items dragged from the DeviceMemoryPanel.
    const deviceRaw = dataTransfer.getData(DEVICE_MEMORY_MIME);
    if (deviceRaw) {
      const callbacks = transferCallbacksRef.current;
      if (!callbacks) return false;
      const payload = JSON.parse(deviceRaw) as DeviceMemoryDragPayload;
      if (payload.type === 'program') {
        callbacks.handleSaveDeviceProgramToCommonArea(payload.index, payload.name);
      } else {
        callbacks.handleSaveDeviceSampleToLibraryDirect(payload.index, payload.name);
      }
      return true;
    }

    const raw = dataTransfer.getData(DISK_ITEM_MIME);
    if (!raw) { console.log('[LibraryPage] no DISK_ITEM_MIME data'); return false; }

    const payload = JSON.parse(raw) as DiskDragPayload;

    // Validate: samples only on sample categories, programs only on program categories.
    const isSample = isAkaiSample(payload.file.type);
    const isProgram = isAkaiProgram(payload.file.type);
    const sampleCategories = new Set(['samples']);
    const programCategories = new Set(['common-programs', 's3k-programs']);

    if (isSample && !sampleCategories.has(categoryId)) return false;
    if (isProgram && !programCategories.has(categoryId)) return false;

    const resolved = diskBrowserRef.current?.resolveDragPayload(payload);
    if (!resolved) return false;

    // Determine save target from drop category
    const saveTarget = categoryId === 's3k-programs' ? 's3k' : 'common';
    const name = payload.file.name.trim();
    const libraryRoot = root;

    // Save directly -- no confirmation dialog
    setDropTransfer({ active: true, fileName: name, progress: null, error: null });

    (async () => {
      try {
        await resolved.ensureFileBlocks(payload.file);
        const fileData = readFileData(resolved.partitionData, payload.file);

        const sampleNames = isProgram ? collectSampleNames(fileData) : [];
        const totalItems = 1 + sampleNames.length;
        const totalBytes = estimateTotalBytes(
          payload.file, sampleNames, resolved.partitionData, payload.volumeStartBlock,
        );

        setDropTransfer((prev) => ({
          ...prev,
          progress: {
            stepLabel: name,
            currentStep: 0,
            totalSteps: totalItems,
            bytesSent: 0,
            bytesTotal: totalBytes,
            bytesSentAllSteps: 0,
            bytesTotalAllSteps: totalBytes,
            startTime: Date.now(),
          },
        }));

        const onProgress = (update: Partial<SaveProgress>) => {
          setDropTransfer((prev) => ({
            ...prev,
            progress: prev.progress ? { ...prev.progress, ...update } : null,
          }));
        };

        if (saveTarget === 'common') {
          await saveToCommonLibrary(
            payload.file, fileData, resolved.partitionData,
            payload.volumeStartBlock, name, libraryRoot, onProgress,
            resolved.ensureFileBlocks, targetPath,
          );
        } else {
          await saveToS3kLibrary(
            payload.file, fileData, resolved.partitionData,
            payload.volumeStartBlock, name, libraryRoot, onProgress,
            resolved.ensureFileBlocks,
          );
        }

        await refreshLibrary();
        // Auto-dismiss after a brief success display
        setTimeout(() => setDropTransfer(DROP_TRANSFER_IDLE), 2000);
      } catch (err) {
        setDropTransfer((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : String(err),
        }));
        setTimeout(() => setDropTransfer(DROP_TRANSFER_IDLE), 5000);
      }
    })();

    return true;
  }, [root, refreshLibrary]);

  const programTransfer = useProgramTransfer(isDeviceConnected, !!root);
  const drumKitTransfer = useDrumKitTransfer(isDeviceConnected, !!root);
  const instrumentTransfer = useInstrumentTransfer(isDeviceConnected, !!root);

  const errorReporter = useErrorReporter(setError);
  const editorDialogs = useEditorDialogs(root, refreshLibrary, errorReporter);

  // -----------------------------------------------------------------------
  // Program promotion (S3K library -> common area)
  // -----------------------------------------------------------------------

  const promotionTransfer = usePromotionTransfer({
    root,
    errorReporter,
    onComplete: refreshLibrary,
  });

  // -----------------------------------------------------------------------
  // Shared library operations -- must be after transfer callbacks
  // -----------------------------------------------------------------------

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
    'common-programs': commonProgramNodes,
    's3k-programs': programNodes,
  }), [sampleNodes, commonProgramNodes, programNodes]);

  // -----------------------------------------------------------------------
  // Device memory selection
  // -----------------------------------------------------------------------

  const { handleDeviceSelectProgram, handleDeviceSelectSample } = useS3kSelectionHandlers({
    deviceProgramNames,
    deviceSampleNames,
    setSelectedDevice,
    setSelection,
    client,
  });

  // -----------------------------------------------------------------------
  // Transfer callbacks
  // -----------------------------------------------------------------------

  const transferCallbacks = useS3kTransferCallbacks({
    client,
    root,
    deviceProgramNames,
    selectedDeviceType,
    selectedDeviceIndex,
    programTransfer,
    instrumentTransfer,
    refreshDevice,
    refreshPrograms,
    setError,
    setSelection,
    setSendDialog,
    setReceiveDialog,
  });

  // Keep ref current so handleExternalDrop can access latest callbacks
  // without being re-created on every transferCallbacks change.
  transferCallbacksRef.current = transferCallbacks;

  // -----------------------------------------------------------------------
  // Preview state
  // -----------------------------------------------------------------------

  const canTransfer = isDeviceConnected && !!root;
  const hasLibrary = !!root;

  const handlePromoteToCommonArea = useCallback(
    (dirName: string) => {
      void promotionTransfer.promote(dirName);
    },
    [promotionTransfer],
  );

  const isPromoting = promotionTransfer.status.state === 'promoting';

  const previewState = useMemo<S3kPreviewCustomState>(() => ({
    onSendSampleToDevice: canTransfer ? transferCallbacks.handleSendSampleToDevice : undefined,
    onSaveDeviceSampleToLibrary: canTransfer ? transferCallbacks.handleSaveDeviceSampleToLibrary : undefined,
    onSaveDeviceProgramToLibrary: canTransfer ? transferCallbacks.handleSaveDeviceProgramToLibrary : undefined,
    onSendProgramToDevice: canTransfer ? transferCallbacks.handleSendProgramToDevice : undefined,
    onImportDrumKit: canTransfer ? drumKitTransfer.openDialog : undefined,
    onImportInstrument: canTransfer ? transferCallbacks.handleImportInstrument : undefined,
    onDeleteDeviceProgram: isDeviceConnected ? transferCallbacks.handleDeleteDeviceProgram : undefined,
    onDeleteDeviceSample: isDeviceConnected ? transferCallbacks.handleDeleteDeviceSample : undefined,
    onOpenInLoopEditor: hasLibrary ? editorDialogs.handleOpenInLoopEditor : undefined,
    onOpenInSampleEditor: hasLibrary ? editorDialogs.handleOpenInSampleEditor : undefined,
    onOpenInChopper: hasLibrary ? editorDialogs.handleOpenInChopper : undefined,
    onEditDrumKit: hasLibrary ? editorDialogs.handleOpenDrumKitEditor : undefined,
    onPromoteToCommonArea: hasLibrary ? handlePromoteToCommonArea : undefined,
    isPromoting,
  }), [
    canTransfer, hasLibrary, isDeviceConnected, isPromoting,
    transferCallbacks, drumKitTransfer.openDialog,
    editorDialogs.handleOpenInLoopEditor,
    editorDialogs.handleOpenInSampleEditor,
    editorDialogs.handleOpenInChopper,
    editorDialogs.handleOpenDrumKitEditor,
    handlePromoteToCommonArea,
  ]);

  // -----------------------------------------------------------------------
  // Shared library operations (create, delete, move, rename, drop, expand)
  // -----------------------------------------------------------------------

  const libraryStrategy = useS3kLibraryStrategy({
    root,
    refreshPrograms,
    transfers: {
      'send-sample-to-device': (name, path) => {
        if (!canTransfer) throw new Error('Connect to device and library to send samples');
        transferCallbacks.handleSendSampleToDevice(name, path);
      },
      'send-program-to-device': (dirName, name) => {
        if (!canTransfer) throw new Error('Connect to device and library to send programs');
        transferCallbacks.handleSendProgramToDevice(dirName, name);
      },
      'import-drum-kit': (name, path) => {
        if (!canTransfer) throw new Error('Connect to device and library to import drum kits');
        drumKitTransfer.openDialog(name, path);
      },
      'edit-drum-kit': (name, nodeType, path) => {
        if (!hasLibrary) throw new Error('Connect to library to edit drum kits');
        editorDialogs.handleOpenDrumKitEditor(name, nodeType, path);
      },
      'import-instrument': (dirName, path, fromProgramsDir) => {
        if (!canTransfer) throw new Error('Connect to device and library to import instruments');
        transferCallbacks.handleImportInstrument(dirName, path, fromProgramsDir);
      },
      'promote-to-common-area': (dirName) => {
        if (!hasLibrary) throw new Error('Connect to library to promote programs');
        void promotionTransfer.promote(dirName);
      },
    },
  });

  const libraryOps = useLibraryOperations(
    root,
    libraryStrategy,
    refreshLibrary,
    errorReporter,
    editorDialogs.createEditorActionHandler(),
  );

  const handleCloneDeviceProgram = useCallback(
    async (index: number, name: string) => {
      if (!client) return;
      try {
        const cloneName = `${name.trim().substring(0, 8)} CPY`.padEnd(12);
        await client.cloneProgram(index, cloneName);
        await refreshDevice();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to clone program');
      }
    },
    [client, refreshDevice, setError],
  );

  const handleCloneDeviceSample = useCallback(
    async (index: number, _name: string) => {
      if (!client) return;
      try {
        await client.cloneSample(index);
        await refreshDevice();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to clone sample');
      }
    },
    [client, refreshDevice, setError],
  );

  const deviceMemoryState = useMemo<S3kMemoryPanelState>(() => ({
    programNames: deviceProgramNames,
    sampleNames: deviceSampleNames,
    selectedIndex: selectedDeviceIndex,
    selectedType: selectedDeviceType,
    onSelectProgram: handleDeviceSelectProgram,
    onSelectSample: handleDeviceSelectSample,
    onRefresh: () => void refreshDevice(),
    onImportSample: canTransfer ? transferCallbacks.handleSendSampleToDevice : undefined,
    onImportProgram: canTransfer ? (dirName: string, displayName: string, categoryId: string) => {
      if (categoryId === 's3k-programs') {
        transferCallbacks.handleSendProgramToDevice(dirName, displayName);
      } else {
        instrumentTransfer.openDialog(dirName, [], true);
      }
    } : undefined,
    onDiskItemDrop: canTransfer ? (payload: DiskDragPayload) => {
      const resolved = diskBrowserRef.current?.resolveDragPayload(payload);
      if (!resolved || !root) return;
      const libraryRoot = root;
      const name = payload.file.name.trim();

      if (isAkaiSample(payload.file.type)) {
        // Save sample to common library, then open send-to-device dialog
        (async () => {
          try {
            await resolved.ensureFileBlocks(payload.file);
            const fileData = readFileData(resolved.partitionData, payload.file);
            const noop = () => { /* progress not shown for background save */ };
            await saveToCommonLibrary(
              payload.file, fileData, resolved.partitionData,
              payload.volumeStartBlock, name, libraryRoot, noop,
              resolved.ensureFileBlocks,
            );
            await refreshLibrary();
            transferCallbacks.handleSendSampleToDevice(name, []);
          } catch (err) {
            console.error('[LibraryPage] disk-to-device sample failed:', err);
          }
        })();
      } else if (isAkaiProgram(payload.file.type)) {
        // Save program to common library, then open ImportInstrumentDialog
        // which auto-sends samples and creates the program on device
        (async () => {
          try {
            await resolved.ensureFileBlocks(payload.file);
            const fileData = readFileData(resolved.partitionData, payload.file);
            const noop = () => { /* progress not shown for background save */ };
            await saveToCommonLibrary(
              payload.file, fileData, resolved.partitionData,
              payload.volumeStartBlock, name, libraryRoot, noop,
              resolved.ensureFileBlocks,
            );
            await refreshLibrary();
            instrumentTransfer.openDialog(name, [], true);
          } catch (err) {
            console.error('[LibraryPage] disk-to-device program failed:', err);
          }
        })();
      }
    } : undefined,
    onSaveSampleToCommonLibrary: canTransfer ? transferCallbacks.handleSaveDeviceSampleToLibraryDirect : undefined,
    onSaveSampleToDeviceLibrary: canTransfer ? transferCallbacks.handleSaveDeviceSampleToLibraryDirect : undefined,
    onSaveProgramToCommonLibrary: canTransfer ? transferCallbacks.handleSaveDeviceProgramToCommonArea : undefined,
    onSaveProgramToDeviceLibrary: canTransfer ? transferCallbacks.handleSaveDeviceProgramToLibraryDirect : undefined,
    onRenameSample: isDeviceConnected ? transferCallbacks.handleRenameDeviceSample : undefined,
    onRenameProgram: isDeviceConnected ? transferCallbacks.handleRenameDeviceProgram : undefined,
    onDeleteSample: isDeviceConnected ? transferCallbacks.handleDeleteDeviceSample : undefined,
    onDeleteProgram: isDeviceConnected ? transferCallbacks.handleDeleteDeviceProgram : undefined,
    onCloneProgram: isDeviceConnected ? handleCloneDeviceProgram : undefined,
    onCloneSample: isDeviceConnected ? handleCloneDeviceSample : undefined,
    isConnected: isDeviceConnected,
    isLoading: isDeviceLoading,
  }), [
    deviceProgramNames, deviceSampleNames,
    selectedDeviceIndex, selectedDeviceType,
    handleDeviceSelectProgram, handleDeviceSelectSample,
    refreshDevice, isDeviceConnected, isDeviceLoading,
    canTransfer, transferCallbacks,
    instrumentTransfer, handleCloneDeviceProgram, handleCloneDeviceSample,
  ]);

  // -----------------------------------------------------------------------
  // Standard library callbacks
  // -----------------------------------------------------------------------

  const handleConnect = useCallback(
    (backend: 'local' | 'google-drive' | 'opfs') => { void connect(backend); },
    [connect],
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

  const libraryHandle = root;

  return (
    <div className="ac-page ac-page-shell ac-page-shell--fixed-viewport">
      {/* Lean page header + height-bounded shell. The `.ac-page-shell-body`
          wrapper provides `flex: 1 1 auto; min-height: 0; overflow: hidden`
          so the PluginLibraryBrowser fills the remaining viewport and
          handles its own internal scroll — replacing the hand-rolled
          `style={{ height: 'calc(100vh - 8rem)' }}` height math.
          Matches Roland LibraryPage's canonical shape; promoted during
          akai-harmonization Phase 2 task 2.2. */}
      <PageTitleRow
        headingId="library-page-heading"
        headingText="Library"
      />

      <div className="ac-page-shell-body" data-capability="C-LIB-01">
        <PluginLibraryBrowser
            plugin={s3kLibraryPlugin}
            libraryHandle={libraryHandle}
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
            onBatchDelete={libraryOps.onBatchDelete}
            onBatchMove={libraryOps.onBatchMove}
            onExternalDrop={handleExternalDrop}
            onContextMenuAction={libraryOps.onContextMenuAction}
            deviceMemoryState={deviceMemoryState}
            previewState={previewState}
            loading={loading}
            error={error ?? undefined}
            connectionSlot={connectionSlot}
            devicePanelLeft={
              <DiskBrowserPanel
                browserRef={diskBrowserRef}
                bridgeUrl={getActiveScsiUrl()}
                onSaveToLibrary={root ? (file, _targetId, partitionData, volumeStartBlock, ensureFileBlocks) => {
                  setDiskToLibrary({ open: true, file, partitionData, volumeStartBlock, ensureFileBlocks });
                } : undefined}
                onSendToDevice={canTransfer && root ? (file, _targetId, partitionData, volumeStartBlock, ensureFileBlocks) => {
                  const libraryRoot = root;
                  const name = file.name.trim();
                  (async () => {
                    try {
                      const fileData = readFileData(partitionData, file);
                      const noop = () => {};
                      await saveToCommonLibrary(
                        file, fileData, partitionData,
                        volumeStartBlock, name, libraryRoot, noop,
                        ensureFileBlocks,
                      );
                      await refreshLibrary();
                      if (isAkaiSample(file.type)) {
                        transferCallbacks.handleSendSampleToDevice(name, []);
                      } else if (isAkaiProgram(file.type)) {
                        instrumentTransfer.openDialog(name, [], true);
                      }
                    } catch (err) {
                      console.error('[LibraryPage] disk-to-device failed:', err);
                    }
                  })();
                } : undefined}
              />
            }
          />
      </div>

      {/* Transfer Dialogs (all require device client + library root) */}
      {client && root && (
        <>
          <SendSampleDialog
            open={sendDialog.open}
            onClose={() => setSendDialog(SEND_DIALOG_CLOSED)}
            sampleName={sendDialog.itemName}
            samplePath={sendDialog.itemPath}
            client={client}
            libraryRoot={root}
            deviceSampleCount={deviceSampleNames.length}
            onTransferComplete={() => refreshDevice()}
          />
          <ReceiveSampleDialog
            open={receiveDialog.open}
            onClose={() => setReceiveDialog(SAVE_DIALOG_CLOSED)}
            sampleIndex={receiveDialog.itemIndex}
            sampleName={receiveDialog.itemName}
            client={client}
            libraryRoot={root}
            onTransferComplete={() => refreshLibrary()}
            autoStart={receiveDialog.autoStart}
          />
          <ImportDrumKitDialog
            open={drumKitTransfer.dialog.open}
            onClose={drumKitTransfer.closeDialog}
            sampleName={drumKitTransfer.dialog.sampleName}
            samplePath={drumKitTransfer.dialog.samplePath}
            client={client}
            libraryRoot={root}
            onImportComplete={() => refreshDevice()}
          />
          <ImportInstrumentDialog
            open={instrumentTransfer.dialog.open}
            onClose={instrumentTransfer.closeDialog}
            programDirName={instrumentTransfer.dialog.programDirName}
            programPath={instrumentTransfer.dialog.programPath}
            fromProgramsDir={instrumentTransfer.dialog.fromProgramsDir}
            client={client}
            libraryRoot={root}
            deviceSampleNames={deviceSampleNames}
            onImportComplete={transferCallbacks.handleImportComplete}
          />
          <ExportProgramDialog
            open={programTransfer.exportDialog.open}
            onClose={programTransfer.closeExportDialog}
            programIndex={programTransfer.exportDialog.itemIndex}
            programName={programTransfer.exportDialog.itemName}
            client={client}
            libraryRoot={root}
            deviceSampleNames={deviceSampleNames}
            onExportComplete={transferCallbacks.handleExportComplete}
            autoStart={programTransfer.exportDialog.autoStart}
            saveToCommonArea={programTransfer.exportDialog.saveToCommonArea}
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
            onImportComplete={transferCallbacks.handleImportComplete}
          />
        </>
      )}

      {/* Disk-to-Library Dialog (requires library root only, no device) */}
      {root && (
        <DiskToLibraryDialog
          open={diskToLibrary.open}
          onClose={() => setDiskToLibrary(DISK_TO_LIBRARY_CLOSED)}
          file={diskToLibrary.file}
          partitionData={diskToLibrary.partitionData}
          volumeStartBlock={diskToLibrary.volumeStartBlock}
          libraryRoot={root}
          onTransferComplete={() => refreshLibrary()}
          ensureFileBlocks={diskToLibrary.ensureFileBlocks}
        />
      )}

      {/* Editor Dialogs */}
      {editorDialogs.loopEditor && (
        <LoopEditorDialog
          open={editorDialogs.loopEditor.open}
          onOpenChange={(open) => { if (!open) editorDialogs.closeLoopEditor(); }}
          samples={editorDialogs.loopEditor.samples}
          sampleRate={editorDialogs.loopEditor.sampleRate}
          sampleName={editorDialogs.loopEditor.sampleName}
          loopStart={editorDialogs.loopEditor.loopStart}
          loopEnd={editorDialogs.loopEditor.loopEnd}
          rootKey={editorDialogs.loopEditor.rootKey}
          onSave={editorDialogs.handleLoopEditorSave}
        />
      )}
      {editorDialogs.chopper && (
        <SampleChopperDialog
          open={editorDialogs.chopper.open}
          onOpenChange={(open) => { if (!open) editorDialogs.closeChopper(); }}
          samples={editorDialogs.chopper.samples}
          sampleRate={editorDialogs.chopper.sampleRate}
          sourceName={editorDialogs.chopper.sampleName}
          editMode={!!editorDialogs.chopper.initialSlices}
          initialSlices={editorDialogs.chopper.initialSlices}
          initialLabels={editorDialogs.chopper.initialLabels}
          onConfirm={() => { editorDialogs.closeChopper(); }}
          onSave={root ? editorDialogs.handleChopperSave : undefined}
          renderOutputConfig={(state) => (
            <S3kKitOutputConfig
              state={state}
              config={editorDialogs.kitConfig}
              onConfigChange={editorDialogs.setKitConfig}
            />
          )}
        />
      )}
      {editorDialogs.sampleEditor && (
        <SampleEditorDialog
          open={editorDialogs.sampleEditor.open}
          onOpenChange={(open) => { if (!open) editorDialogs.closeSampleEditor(); }}
          samples={editorDialogs.sampleEditor.samples}
          sampleRate={editorDialogs.sampleEditor.sampleRate}
          sampleName={editorDialogs.sampleEditor.sampleName}
          onSave={root ? editorDialogs.handleSampleEditorSave : undefined}
        />
      )}
      {editorDialogs.drumKitEditor && root && (
        <DrumKitEditorDialog
          open={editorDialogs.drumKitEditor.open}
          onClose={editorDialogs.closeDrumKitEditor}
          kitName={editorDialogs.drumKitEditor.kitName}
          kitPath={editorDialogs.drumKitEditor.kitPath}
          nodeType={editorDialogs.drumKitEditor.nodeType}
          libraryRoot={root}
          onSave={refreshLibrary}
        />
      )}

      {/* Drop transfer progress toast */}
      {dropTransfer.active && (
        <div className="fixed bottom-4 right-4 w-80 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-4 z-50">
          <div className="text-sm font-medium text-gray-100 mb-2">
            {dropTransfer.error
              ? 'Transfer failed'
              : dropTransfer.progress && dropTransfer.progress.currentStep >= dropTransfer.progress.totalSteps
                ? `Saved ${dropTransfer.fileName}`
                : `Saving ${dropTransfer.fileName}...`
            }
          </div>
          {dropTransfer.error && (
            <div className="text-xs text-red-400">{dropTransfer.error}</div>
          )}
          {dropTransfer.progress && !dropTransfer.error && (
            <>
              <div className="w-full bg-gray-700 rounded-full h-1.5 mb-1">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: `${dropTransfer.progress.bytesTotal > 0
                      ? Math.max(2, Math.round((dropTransfer.progress.bytesSent / dropTransfer.progress.bytesTotal) * 100))
                      : 2}%`,
                  }}
                />
              </div>
              <div className="text-xs text-gray-400 flex justify-between">
                <span>{dropTransfer.progress.currentStep} / {dropTransfer.progress.totalSteps} items</span>
                <span className="truncate ml-2">{dropTransfer.progress.stepLabel}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Promotion status toast */}
      {promotionTransfer.status.state !== 'idle' && (
        <div
          className={`fixed bottom-4 right-4 w-80 border rounded-lg shadow-xl p-4 z-50 ${
            promotionTransfer.status.state === 'error'
              ? 'bg-gray-800 border-red-600/50'
              : promotionTransfer.status.state === 'success'
                ? 'bg-gray-800 border-green-600/50'
                : 'bg-gray-800 border-gray-600'
          }`}
          style={dropTransfer.active ? { bottom: '6rem' } : undefined}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              {promotionTransfer.status.state === 'promoting' && (
                <span className="ac-spinner ac-spinner-sm flex-shrink-0" />
              )}
              {promotionTransfer.status.state === 'success' && (
                <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {promotionTransfer.status.state === 'error' && (
                <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-100 truncate">
                  {promotionTransfer.status.state === 'promoting'
                    ? `Promoting "${promotionTransfer.status.programName}"...`
                    : promotionTransfer.status.state === 'success'
                      ? `Promoted "${promotionTransfer.status.programName}" to common area`
                      : `Failed to promote "${promotionTransfer.status.programName}"`
                  }
                </div>
                {promotionTransfer.status.state === 'error' && (
                  <div className="text-xs text-red-400 mt-1">{promotionTransfer.status.message}</div>
                )}
              </div>
            </div>
            {promotionTransfer.status.state !== 'promoting' && (
              <button
                className="text-gray-400 hover:text-gray-200 ml-2 flex-shrink-0"
                onClick={promotionTransfer.dismiss}
                title="Dismiss"
              >
                &times;
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
