/**
 * Standalone dev harness for the sample editor.
 *
 * Uses the same library browsing pattern as the loop editor and
 * sample chopper, ensuring feature parity between editor surfaces.
 *
 * Initial state: library browser (auto-connects with ?library=mock)
 * with a drop zone for WAV files. Selecting a sample shows a detail
 * panel with "Open in Editor" which opens the SampleEditorDialog.
 */

import '@audiocontrol/editor-core/dev/styles.css';
import '@audiocontrol/editor-core/styles.css';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { SampleEditorDialog } from '@/ui/index.js';
import {
  useNotifications,
  useLibraryConnection,
  NotificationArea,
  LibraryBrowser,
  SampleDetailPanel,
  CacheMetricsModal,
  AudioFileIcon,
  type TreeNode,
  type OperationProgress,
  type CacheMetricsData,
} from '@audiocontrol/editor-core';
import {
  parseWav,
  createWav,
  listCommonSamplesTree,
  loadSample,
  loadSampleMeta,
  saveSample,
  getNestedDirectory,
  sanitizeForFilename,
  createFolder,
  deleteItem,
  moveItem,
  importWavToCommonArea,
  type LibraryTreeNode,
  type SampleYaml,
} from '@audiocontrol/sampler-library/browser';
import { stringify as stringifyYaml } from 'yaml';

/** Map LibraryTreeNode[] to TreeNode[] for the shared TreeView. */
function toTreeNodes(nodes: LibraryTreeNode[]): TreeNode[] {
  return nodes.map((node) => ({
    id: node.id,
    name: node.name,
    type: node.type,
    children: node.children ? toTreeNodes(node.children) : undefined,
    meta: { directoryName: node.directoryName ?? node.fileName, path: node.path },
  }));
}

function DevHarness() {
  // Library connection
  const library = useLibraryConnection({
    pickerId: 'sample-editor-library',
    googleDrive: import.meta.env.VITE_GOOGLE_CLIENT_ID
      ? { clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID, clientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET }
      : undefined,
  });

  // Library state
  const [libraryItems, setLibraryItems] = useState<LibraryTreeNode[]>([]);
  const [selectedNodeInfo, setSelectedNodeInfo] = useState<{ directoryName: string; path: string[] } | null>(null);
  const [selectedSampleMeta, setSelectedSampleMeta] = useState<SampleYaml | null>(null);
  const [importProgress, setImportProgress] = useState<OperationProgress | undefined>(undefined);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [metricsModalOpen, setMetricsModalOpen] = useState(false);
  const { notifications, notify, dismiss } = useNotifications();

  // Sample editor dialog state
  const [editorDialog, setEditorDialog] = useState<{
    open: boolean;
    samples: Int16Array | null;
    sampleRate: number;
    sampleName: string;
    origin?: { name: string; path: string[] };
  } | null>(null);

  // Drag-drop state
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load library tree when hook connects
  const prevRootRef = React.useRef<unknown>(null);
  useEffect(() => {
    if (library.root && library.root !== prevRootRef.current) {
      (async () => {
        setIsLoadingTree(true);
        try {
          const items = await listCommonSamplesTree(library.root!);
          setLibraryItems(items);
        } finally {
          setIsLoadingTree(false);
        }
      })();
    }
    prevRootRef.current = library.root;
  }, [library.root]);

  // Refresh library listing
  const refreshLibrary = useCallback(async (clearCache = false) => {
    if (!library.root) return;
    setIsLoadingTree(true);
    try {
      if (clearCache) library.clearCache();
      const items = await listCommonSamplesTree(library.root);
      setLibraryItems(items);
    } finally {
      setIsLoadingTree(false);
    }
  }, [library.root, library.clearCache]);

  // Open sample in editor from library
  const handleOpenInEditor = useCallback(async (name: string, path?: string[]) => {
    if (!library.root) return;
    try {
      const result = await loadSample(library.root, name, path);
      const wav = parseWav(result.wavData);
      setEditorDialog({
        open: true,
        samples: wav.samples,
        sampleRate: wav.sampleRate,
        sampleName: result.yaml.name,
        origin: { name, path: path ?? [] },
      });
    } catch (err) {
      notify('error', `Failed to load sample: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }, [library.root]);

  // Save edited sample back to library as sample.yaml + sample.wav
  const handleSave = useCallback(async (samples: Int16Array, sampleRate: number) => {
    if (!library.root || !editorDialog?.origin) return;
    const origin = editorDialog.origin;

    try {
      const existingMeta = await loadSampleMeta(library.root, origin.name, origin.path);
      const yaml: SampleYaml = {
        ...existingMeta,
        sampleRate,
        modifiedAt: new Date().toISOString(),
      };

      const wavData = createWav(samples, sampleRate);

      await saveSample(library.root, { name: origin.name, yaml, wavData }, origin.path);
      notify('info', `Saved sample "${origin.name}"`);
      await refreshLibrary();
    } catch (err) {
      notify('error', `Failed to save: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }, [library.root, editorDialog, refreshLibrary]);

  // Load WAV from a local file (file picker or drag-drop)
  const loadLocalWav = useCallback(async (file: File) => {
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      const wav = parseWav(data);
      setEditorDialog({
        open: true,
        samples: wav.samples,
        sampleRate: wav.sampleRate,
        sampleName: file.name.replace(/\.wav$/i, ''),
      });
    } catch (err) {
      notify('error', `Failed to load WAV: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }, []);

  // Tree node selection — load metadata for detail panel
  const handleTreeSelect = useCallback(async (treeNode: TreeNode) => {
    if (treeNode.type !== 'sample') {
      setSelectedSampleMeta(null);
      setSelectedNodeInfo(null);
      return;
    }
    const meta = treeNode.meta as { directoryName?: string; path?: string[] } | undefined;
    const directoryName = meta?.directoryName ?? treeNode.name;
    const path = meta?.path ?? [];
    setSelectedNodeInfo({ directoryName, path });
    if (!library.root) return;
    setIsLoadingMeta(true);
    try {
      const yaml = await loadSampleMeta(library.root, directoryName, path);
      setSelectedSampleMeta(yaml);
    } catch {
      setSelectedSampleMeta(null);
    } finally {
      setIsLoadingMeta(false);
    }
  }, [library.root]);

  // Library CRUD operations
  const handleCreateFolder = useCallback(async (name: string, parentPath: string[]) => {
    if (!library.root) throw new Error('Not connected');
    await createFolder(library.root, parentPath, name);
    await refreshLibrary();
    notify('info', `Created folder "${name}"`);
  }, [library.root, refreshLibrary]);

  const handleDeleteItem = useCallback(async (node: TreeNode) => {
    const meta = node.meta as { directoryName?: string; path?: string[] } | undefined;
    if (!library.root) throw new Error('Not connected');
    await deleteItem(library.root, meta?.directoryName ?? node.name, meta?.path ?? []);
  }, [library.root]);

  const handleMoveItem = useCallback(async (node: TreeNode, targetPath: string[]) => {
    const meta = node.meta as { path?: string[] } | undefined;
    if (!library.root) return;
    try {
      await moveItem(library.root, node.name, meta?.path ?? [], targetPath);
      await refreshLibrary();
      notify('info', `Moved "${node.name}"`);
    } catch (err) {
      notify('error', `Move failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }, [library.root, refreshLibrary]);

  const handleImportFiles = useCallback(async (files: File[], targetPath: string[]) => {
    if (!library.root) return;
    const wavFiles = files.filter((f) => f.name.toLowerCase().endsWith('.wav'));
    const skipped = files.length - wavFiles.length;
    if (skipped > 0) notify('error', `Skipped ${skipped} non-WAV file${skipped !== 1 ? 's' : ''}`);
    if (wavFiles.length === 0) return;

    const totalBytes = wavFiles.reduce((sum, f) => sum + f.size, 0);
    let completedBytes = 0;
    for (let i = 0; i < wavFiles.length; i++) {
      const file = wavFiles[i]!;
      setImportProgress({
        currentStep: i + 1, totalSteps: wavFiles.length,
        stepLabel: `Importing ${file.name}`,
        bytesSent: 0, bytesTotal: file.size,
        bytesSentAllSteps: completedBytes, bytesTotalAllSteps: totalBytes,
      });
      try {
        const data = new Uint8Array(await file.arrayBuffer());
        await importWavToCommonArea(library.root!, file.name, data, { targetPath });
        completedBytes += file.size;
      } catch (err) {
        notify('error', `Import "${file.name}" failed: ${err instanceof Error ? err.message : 'unknown error'}`);
        completedBytes += file.size;
      }
    }
    setImportProgress(undefined);
    await refreshLibrary();
  }, [library.root, refreshLibrary]);

  // Drop zone handlers
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadLocalWav(file);
  }, [loadLocalWav]);

  const cacheMetrics = library.getMetrics() as CacheMetricsData | undefined;

  return (
    <div data-testid="sample-editor-test-page" style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 className="ac-title-md" style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
          Sample Editor
        </h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {library.hasLocalFS && (
            <button className="ac-btn ac-btn-sm" onClick={() => library.connect('local')}>
              {library.activeBackend === 'local' ? 'Change Local' : 'Local FS'}
            </button>
          )}
          {library.hasGoogleDrive && (
            <button className="ac-btn ac-btn-sm" onClick={() => library.connect('google-drive')}>
              {library.activeBackend === 'google-drive' ? 'Google Drive \u2713' : 'Google Drive'}
            </button>
          )}
          {cacheMetrics && (
            <button className="ac-btn ac-btn-sm" onClick={() => setMetricsModalOpen(true)}>
              Cache Stats
            </button>
          )}
        </div>
      </div>

      {/* Library browser with sample detail panel */}
      {library.isConnected ? (
        <LibraryBrowser
          nodes={toTreeNodes(libraryItems)}
          title={library.activeBackend === 'google-drive' ? 'Google Drive' : 'Sample Library'}
          onCreateFolder={handleCreateFolder}
          onDelete={handleDeleteItem}
          onMove={handleMoveItem}
          onRefresh={() => refreshLibrary(true)}
          onImportFiles={handleImportFiles}
          operationProgress={importProgress}
          onSelect={handleTreeSelect}
          loading={isLoadingTree}
          emptyMessage="No samples — drop WAV files here or connect a library"
          renderIcon={(node) => node.type === 'sample' ? <AudioFileIcon /> : undefined}
          renderDetail={() => (
            <SampleDetailPanel
              sample={selectedSampleMeta}
              loading={isLoadingMeta}
              actions={
                selectedSampleMeta && selectedNodeInfo ? (
                  <button
                    className="ac-btn ac-btn-sm ac-btn-primary"
                    onClick={() => handleOpenInEditor(selectedNodeInfo.directoryName, selectedNodeInfo.path)}
                  >
                    Open in Editor
                  </button>
                ) : undefined
              }
            />
          )}
        />
      ) : (
        <div style={{ textAlign: 'center', padding: 64 }}>
          <p style={{ color: '#94a3b8', marginBottom: 24 }}>
            Open a WAV file or connect a sample library
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {/* WAV file picker */}
            <label
              style={{
                padding: '12px 24px', fontSize: 16, fontWeight: 600,
                background: '#2563eb', color: '#fff', border: 'none',
                borderRadius: 8, cursor: 'pointer', display: 'inline-block',
              }}
            >
              Open WAV File
              <input
                ref={fileInputRef}
                type="file"
                accept=".wav,audio/wav"
                style={{ display: 'none' }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) loadLocalWav(file);
                }}
              />
            </label>
            {library.hasLocalFS && (
              <button
                onClick={() => library.connect('local')}
                style={{
                  padding: '12px 24px', fontSize: 16, fontWeight: 600,
                  background: 'transparent', color: '#94a3b8', border: '1px solid #334155',
                  borderRadius: 8, cursor: 'pointer',
                }}
              >
                Connect Library Folder
              </button>
            )}
          </div>

          {/* Drop zone */}
          <div
            style={{
              marginTop: 32, border: `2px dashed ${dragOver ? '#f59e0b' : '#334155'}`,
              borderRadius: 12, padding: '48px 24px',
              background: dragOver ? 'rgba(245, 158, 11, 0.05)' : 'transparent',
              color: dragOver ? '#e2e8f0' : '#64748b',
              transition: 'all 0.2s', cursor: 'pointer',
            }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <p>Drop a WAV file here, or click to browse</p>
          </div>
        </div>
      )}

      {notifications.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <NotificationArea notifications={notifications} onDismiss={dismiss} />
        </div>
      )}

      {/* Sample Editor Dialog */}
      {editorDialog && (
        <SampleEditorDialog
          open={editorDialog.open}
          onOpenChange={(open) => { if (!open) setEditorDialog(null); }}
          samples={editorDialog.samples}
          sampleRate={editorDialog.sampleRate}
          sampleName={editorDialog.sampleName}
          onSave={library.isConnected && editorDialog.origin ? handleSave : undefined}
        />
      )}

      <CacheMetricsModal
        open={metricsModalOpen}
        metrics={cacheMetrics}
        onClose={() => setMetricsModalOpen(false)}
        onReset={() => library.resetMetrics()}
      />
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<React.StrictMode><DevHarness /></React.StrictMode>);
