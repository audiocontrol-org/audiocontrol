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
  LibraryConnectionUI,
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
import { promoteToCommonArea } from '@/lib/program-promotion';
import { DiskBrowserPanel, DISK_ITEM_MIME, type DiskDragPayload, type DiskBrowserHandle } from '@/components/library/DiskBrowserPanel';
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
  const [sendDialog, setSendDialog] = useState<SendDialogState>(SEND_DIALOG_CLOSED);
  const [receiveDialog, setReceiveDialog] = useState<ReceiveDialogState>(RECEIVE_DIALOG_CLOSED);
  const [diskToLibrary, setDiskToLibrary] = useState<DiskToLibraryDialogState>(DISK_TO_LIBRARY_CLOSED);
  const diskBrowserRef = useRef<DiskBrowserHandle>(null);
  const [dropTransfer, setDropTransfer] = useState<DropTransferState>(DROP_TRANSFER_IDLE);

  const handleExternalDrop = useCallback((categoryId: string, dataTransfer: DataTransfer, targetPath: string[] = []): boolean => {
    if (!root) return false;
    const raw = dataTransfer.getData(DISK_ITEM_MIME);
    if (!raw) return false;

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

    // Save directly — no confirmation dialog
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
            currentItem: name,
            currentIndex: 0,
            totalItems,
            bytesTransferred: 0,
            totalBytes,
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

  const handleEditorError = useCallback(
    (message: string) => setError(message),
    [setError],
  );
  const editorDialogs = useEditorDialogs(root, refreshLibrary, handleEditorError);

  // -----------------------------------------------------------------------
  // Shared library operations (create, delete, move, rename, drop, expand)
  // -----------------------------------------------------------------------

  const libraryStrategy = useS3kLibraryStrategy({ root, refreshPrograms });

  const libraryOps = useLibraryOperations(
    root,
    libraryStrategy,
    refreshLibrary,
    (msg) => setError(msg),
    editorDialogs.createEditorActionHandler(),
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

  // -----------------------------------------------------------------------
  // Preview state
  // -----------------------------------------------------------------------

  const canTransfer = isDeviceConnected && !!root;
  const hasLibrary = !!root;

  const handlePromoteToCommonArea = useCallback(
    async (dirName: string) => {
      if (!root) return;
      try {
        await promoteToCommonArea(root, dirName);
        void refreshLibrary();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to promote program to common area');
      }
    },
    [root, refreshLibrary, setError],
  );

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
  }), [
    canTransfer, hasLibrary, isDeviceConnected,
    transferCallbacks, drumKitTransfer.openDialog,
    editorDialogs.handleOpenInLoopEditor,
    editorDialogs.handleOpenInSampleEditor,
    editorDialogs.handleOpenInChopper,
    editorDialogs.handleOpenDrumKitEditor,
    handlePromoteToCommonArea,
  ]);

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
        // S3K native programs — use ImportProgramDialog
        transferCallbacks.handleSendProgramToDevice(dirName, displayName);
      } else {
        // Common-area programs — use ImportInstrumentDialog
        instrumentTransfer.openDialog(dirName, [], true);
      }
    } : undefined,
    isConnected: isDeviceConnected,
    isLoading: isDeviceLoading,
  }), [
    deviceProgramNames, deviceSampleNames,
    selectedDeviceIndex, selectedDeviceType,
    handleDeviceSelectProgram, handleDeviceSelectSample,
    refreshDevice, isDeviceConnected, isDeviceLoading,
    canTransfer, transferCallbacks.handleSendSampleToDevice,
    transferCallbacks.handleSendProgramToDevice,
    instrumentTransfer,
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
    <div className="ac-page">
      <div className="ac-page-sticky-header">
        <div className="ac-page-header">
          <h2 className="text-xl font-bold">Library</h2>
        </div>
      </div>
      <div className="ac-page-content flex" style={{ height: 'calc(100vh - 8rem)' }}>
        <div className="flex-1 min-w-0">
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
            onExternalDrop={handleExternalDrop}
            onContextMenuAction={libraryOps.onContextMenuAction}
            deviceMemoryState={deviceMemoryState}
            previewState={previewState}
            loading={loading}
            error={error ?? undefined}
            connectionSlot={connectionSlot}
          />
        </div>
        <div className="w-[36rem] border-l border-neutral-700 overflow-y-auto">
          <DiskBrowserPanel
            browserRef={diskBrowserRef}
            bridgeUrl={getActiveScsiUrl()}
            onSaveToLibrary={root ? (file, _targetId, partitionData, volumeStartBlock, ensureFileBlocks) => {
              setDiskToLibrary({ open: true, file, partitionData, volumeStartBlock, ensureFileBlocks });
            } : undefined}
          />
        </div>
      </div>

      {/* Transfer Dialogs (all require device client + library root) */}
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
            programIndex={programTransfer.exportDialog.programIndex}
            programName={programTransfer.exportDialog.programName}
            client={client}
            libraryRoot={root}
            deviceSampleNames={deviceSampleNames}
            onExportComplete={transferCallbacks.handleExportComplete}
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
              : dropTransfer.progress && dropTransfer.progress.currentIndex >= dropTransfer.progress.totalItems
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
                    width: `${dropTransfer.progress.totalBytes > 0
                      ? Math.max(2, Math.round((dropTransfer.progress.bytesTransferred / dropTransfer.progress.totalBytes) * 100))
                      : 2}%`,
                  }}
                />
              </div>
              <div className="text-xs text-gray-400 flex justify-between">
                <span>{dropTransfer.progress.currentIndex} / {dropTransfer.progress.totalItems} items</span>
                <span className="truncate ml-2">{dropTransfer.progress.currentItem}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
