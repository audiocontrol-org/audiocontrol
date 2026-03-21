/**
 * Standalone dev harness for the loop editor.
 *
 * Provides test audio data and browser environment wiring so the
 * loop editor can be developed independently of sampler-editor.
 * Supports loading samples from and saving loop-edited samples
 * back to the library via local filesystem (FSAA) or Google Drive.
 */

import '@audiocontrol/editor-core/dev/styles.css';
import '@audiocontrol/editor-core/styles.css';

import React, { useState, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { LoopEditor } from '@/ui/LoopEditor';
import { useLoopDetection } from '@audiocontrol/loop-editor/ui';
import {
  useNotifications,
  useLibraryConnection,
  NotificationArea,
  LibraryBrowser,
  SampleDetailPanel,
  CacheMetricsModal,
  AudioFileIcon,
  OperationProgressBar,
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
  createFolder,
  deleteItem,
  moveItem,
  importWavToCommonArea,
  type LibraryTreeNode,
  type SampleYaml,
} from '@audiocontrol/sampler-library/browser';
import { createDevEnvironment } from './environment';

const env = createDevEnvironment();

/** Map LibraryTreeNode[] to TreeNode[] for the shared TreeView. */
function toTreeNodes(nodes: LibraryTreeNode[]): TreeNode[] {
  return nodes.map((node) => ({
    id: node.id,
    name: node.name,
    type: node.type,
    children: node.children ? toTreeNodes(node.children) : undefined,
    // Samples use directoryName, other types use fileName
    meta: { directoryName: node.directoryName ?? node.fileName, path: node.path },
  }));
}

/** Generate a test tone with a clean loop region. */
function generateTestAudio(sampleRate: number, durationSeconds: number): Int16Array {
  const length = sampleRate * durationSeconds;
  const samples = new Int16Array(length);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const fundamental = Math.sin(2 * Math.PI * 440 * t);
    const harmonic2 = 0.5 * Math.sin(2 * Math.PI * 880 * t);
    const harmonic3 = 0.25 * Math.sin(2 * Math.PI * 1320 * t);
    const envelope = Math.min(1, t * 20);
    const value = (fundamental + harmonic2 + harmonic3) * envelope * 0.6;
    samples[i] = Math.round(value * 32767);
  }

  return samples;
}

function DevHarness() {
  const defaultSampleRate = 30000;
  const [samples, setSamples] = useState(() => generateTestAudio(defaultSampleRate, 2));
  const [sampleRate, setSampleRate] = useState(defaultSampleRate);
  const [loopPoint, setLoopPoint] = useState(Math.floor(defaultSampleRate * 0.5));
  const [endPoint, setEndPoint] = useState(Math.floor(defaultSampleRate * 1.5));
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState<number | undefined>(undefined);
  const [sampleName, setSampleName] = useState('Test Tone');

  // Library connection via shared hook
  const library = useLibraryConnection({
    pickerId: 'loop-editor-library',
    googleDrive: import.meta.env.VITE_GOOGLE_CLIENT_ID
      ? { clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID, clientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET }
      : undefined,
  });

  // Library state
  const [libraryItems, setLibraryItems] = useState<LibraryTreeNode[]>([]);
  const [libraryOrigin, setLibraryOrigin] = useState<{ name: string; path: string[] } | null>(null);
  const [selectedNodeInfo, setSelectedNodeInfo] = useState<{ directoryName: string; path: string[] } | null>(null);
  const [selectedSampleMeta, setSelectedSampleMeta] = useState<SampleYaml | null>(null);
  const [importProgress, setImportProgress] = useState<OperationProgress | undefined>(undefined);
  const [loadProgress, setLoadProgress] = useState<OperationProgress | undefined>(undefined);
  const [saveProgress, setSaveProgress] = useState<OperationProgress | undefined>(undefined);
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [metricsModalOpen, setMetricsModalOpen] = useState(false);
  const { notifications, notify, dismiss } = useNotifications();

  const {
    isSearching,
    progress,
    candidates,
    error: loopDetectionError,
    searchLoopPoints,
    clearResults,
  } = useLoopDetection();

  // Track previous search state to detect when search completes
  const wasSearchingRef = React.useRef(false);

  // Surface loop detection errors as notifications
  useEffect(() => {
    if (loopDetectionError) {
      notify('error', `Loop detection failed: ${loopDetectionError}`);
    }
  }, [loopDetectionError]);

  // Notify when search completes with no candidates
  useEffect(() => {
    if (wasSearchingRef.current && !isSearching) {
      // Search just completed
      if (!loopDetectionError && candidates.length === 0) {
        notify('info', 'No loop candidates found. Try adjusting the sample or end point.');
      }
    }
    wasSearchingRef.current = isSearching;
  }, [isSearching, candidates.length, loopDetectionError]);

  // Load library tree when hook connects (including OAuth restore)
  const prevRootRef = React.useRef(library.root);
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

  const handleAutoDetect = useCallback(() => {
    clearResults();
    setSelectedCandidateIndex(undefined);
    const samplesCopy = new Int16Array(samples);
    searchLoopPoints(samplesCopy, sampleRate, endPoint);
  }, [samples, sampleRate, endPoint, clearResults, searchLoopPoints]);

  const handleApplyCandidate = useCallback((loopStart: number, loopEnd: number) => {
    setLoopPoint(loopStart);
    setEndPoint(loopEnd);
  }, []);

  // Library: refresh listing
  const refreshLibrary = useCallback(async (clearCache = false) => {
    if (!library.root) return;
    setIsLoadingTree(true);
    try {
      if (clearCache) {
        library.clearCache();
      }
      const items = await listCommonSamplesTree(library.root);
      setLibraryItems(items);
    } finally {
      setIsLoadingTree(false);
    }
  }, [library.root, library.clearCache]);

  // Library: load a sample
  const handleLoadSample = useCallback(async (node: LibraryTreeNode) => {
    if (node.type !== 'sample' || !node.directoryName) return;
    if (!library.root) return;
    try {
      const result = await loadSample(library.root, node.directoryName, node.path, {
        onProgress: setLoadProgress,
      });
      setLoadProgress(undefined);
      const wavData = parseWav(result.wavData);
      setSamples(wavData.samples);
      setSampleRate(wavData.sampleRate);
      setSampleName(result.yaml.name);
      setLoopPoint(result.yaml.loopStart ?? 0);
      setEndPoint(result.yaml.loopEnd ?? wavData.samples.length);
      setLibraryOrigin({ name: node.directoryName, path: node.path });
      setSelectedSampleMeta(result.yaml);
      clearResults();
      setSelectedCandidateIndex(undefined);
      notify('info', `Loaded "${result.yaml.name}"`);
    } catch (err) {
      setLoadProgress(undefined);
      notify('error', `Load failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }, [library.root, clearResults]);

  // TreeView select handler — loads sample metadata for the detail panel
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
      // Use loadSampleMeta (not loadSample) to avoid downloading the WAV file
      const yaml = await loadSampleMeta(library.root, directoryName, path);
      setSelectedSampleMeta(yaml);
    } catch {
      setSelectedSampleMeta(null);
    } finally {
      setIsLoadingMeta(false);
    }
  }, [library.root]);

  // Load the selected sample into the editor
  const handleLoadSelectedIntoEditor = useCallback(() => {
    if (!selectedSampleMeta || !selectedNodeInfo) return;
    if (!library.root) return;
    const libNode = {
      type: 'sample' as const,
      directoryName: selectedNodeInfo.directoryName,
      path: selectedNodeInfo.path,
    } as LibraryTreeNode;
    handleLoadSample(libNode);
  }, [selectedSampleMeta, library.root, selectedNodeInfo, handleLoadSample]);

  // Library: create a new folder (called by LibraryBrowser when user creates folder)
  const handleCreateFolder = useCallback(async (name: string, parentPath: string[]) => {
    if (!library.root) throw new Error('Not connected');
    await createFolder(library.root, parentPath, name);
    await refreshLibrary();
    notify('info', `Created folder "${name}"`);
  }, [library.root, refreshLibrary]);

  // Library: delete a sample or folder (confirmation + feedback handled by LibraryBrowser)
  const handleDeleteItem = useCallback(async (node: TreeNode) => {
    const meta = node.meta as { directoryName?: string; path?: string[] } | undefined;
    if (!library.root) throw new Error('Not connected');
    // Use the filesystem name (meta.directoryName), not the display name (node.name)
    const fsName = meta?.directoryName ?? node.name;
    await deleteItem(library.root, fsName, meta?.path ?? []);
  }, [library.root]);

  // Library: move item to a new directory
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

  // Library: import WAV files
  const handleImportFiles = useCallback(async (files: File[], targetPath: string[]) => {
    if (!library.root) return;
    const wavFiles = files.filter((f) => f.name.toLowerCase().endsWith('.wav'));
    const skipped = files.length - wavFiles.length;
    if (skipped > 0) {
      notify('error', `Skipped ${skipped} non-WAV file${skipped !== 1 ? 's' : ''}`);
    }
    if (wavFiles.length === 0) return;

    const totalBytes = wavFiles.reduce((sum, f) => sum + f.size, 0);
    let completedBytes = 0;
    let imported = 0;

    for (let i = 0; i < wavFiles.length; i++) {
      const file = wavFiles[i];
      setImportProgress({
        currentStep: i + 1,
        totalSteps: wavFiles.length,
        stepLabel: `Importing ${file.name}`,
        bytesSent: 0,
        bytesTotal: file.size,
        bytesSentAllSteps: completedBytes,
        bytesTotalAllSteps: totalBytes,
      });
      try {
        const data = new Uint8Array(await file.arrayBuffer());
        setImportProgress({
          currentStep: i + 1,
          totalSteps: wavFiles.length,
          stepLabel: `Importing ${file.name}`,
          bytesSent: file.size,
          bytesTotal: file.size,
          bytesSentAllSteps: completedBytes,
          bytesTotalAllSteps: totalBytes,
        });
        await importWavToCommonArea(library.root, file.name, data, { targetPath });
        completedBytes += file.size;
        imported++;
      } catch (err) {
        notify('error', `Import "${file.name}" failed: ${err instanceof Error ? err.message : 'unknown error'}`);
        completedBytes += file.size;
      }
    }
    setImportProgress(undefined);
  }, [library.root]);

  // Library: save current sample with loop points
  const handleSaveToLibrary = useCallback(async () => {
    if (!library.root) return;

    const name = libraryOrigin?.name ?? sampleName;
    const path = libraryOrigin?.path ?? [];

    const yaml: SampleYaml = {
      format: 'sample',
      version: 1,
      name,
      file: `${name}.wav`,
      sampleRate,
      loopMode: 'forward',
      loopStart: loopPoint,
      loopEnd: endPoint,
      modifiedAt: new Date().toISOString(),
    };

    const wavData = createWav(samples, sampleRate);

    try {
      await saveSample(library.root, { name, yaml, wavData }, path, {
        onProgress: setSaveProgress,
      });
      setSaveProgress(undefined);
      setLibraryOrigin({ name, path });
      notify('info', `Saved "${name}" to library`);
      await refreshLibrary();
    } catch (err) {
      setSaveProgress(undefined);
      notify('error', `Save failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }, [library.root, libraryOrigin, sampleName, sampleRate, loopPoint, endPoint, samples, refreshLibrary]);

  const cacheMetrics = library.getMetrics() as CacheMetricsData | undefined;
  const hasCacheMetrics = cacheMetrics !== undefined;

  const showLibrary = library.isConnected && libraryItems.length > 0;

  return (
    <div style={{ maxWidth: showLibrary ? 1440 : 960, margin: '0 auto', padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 className="ac-title-md" style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
          Loop Editor — Dev Harness
        </h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {library.isConnected && (
            <button className="ac-btn ac-btn-primary ac-btn-sm" onClick={handleSaveToLibrary}>
              Save to Library
            </button>
          )}
          {library.hasLocalFS && (
            <button className="ac-btn ac-btn-sm" onClick={() => library.connect('local')}>
              {library.activeBackend === 'local' ? 'Change Local' : 'Local FS'}
            </button>
          )}
          {library.hasGoogleDrive && (
            <button className="ac-btn ac-btn-sm" onClick={() => library.connect('google-drive')}>
              {library.activeBackend === 'google-drive' ? 'Google Drive ✓' : 'Google Drive'}
            </button>
          )}
          {hasCacheMetrics && (
            <button className="ac-btn ac-btn-sm" onClick={() => setMetricsModalOpen(true)}>
              Cache Stats
            </button>
          )}
        </div>
      </div>

      <p className="ac-text-muted" style={{ fontSize: 14, marginBottom: 24 }}>
        {sampleName} — {sampleRate} Hz, {samples.length} samples
        {libraryOrigin && <span> (from library)</span>}
      </p>

      {/* Main content: editor left, library right */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 0%', minWidth: 0 }}>
          <LoopEditor
            samples={samples}
            sampleRate={sampleRate}
            startPoint={0}
            loopPoint={loopPoint}
            endPoint={endPoint}
            onLoopPointChange={setLoopPoint}
            onEndPointChange={setEndPoint}
            candidates={candidates}
            selectedCandidateIndex={selectedCandidateIndex}
            onCandidateSelect={setSelectedCandidateIndex}
            onApplyCandidate={handleApplyCandidate}
            onAutoDetect={handleAutoDetect}
            isSearching={isSearching}
            searchProgress={progress}
            audio={env.workflow.audio}
          />
          {(loadProgress || saveProgress) && (
            <div style={{ marginTop: 16 }}>
              <OperationProgressBar progress={(loadProgress ?? saveProgress)!} />
            </div>
          )}
          {notifications.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <NotificationArea notifications={notifications} onDismiss={dismiss} />
            </div>
          )}
        </div>

        {showLibrary && (
          <div style={{ flex: '0 0 560px', position: 'sticky', top: 24, maxHeight: 'calc(100vh - 48px)', overflow: 'hidden' }}>
            <LibraryBrowser
              nodes={toTreeNodes(libraryItems)}
              title={library.activeBackend === 'google-drive' ? 'Google Drive' : 'Local Library'}
              onCreateFolder={handleCreateFolder}
              onDelete={handleDeleteItem}
              onMove={handleMoveItem}
              onRefresh={() => refreshLibrary(true)}
              onImportFiles={handleImportFiles}
              operationProgress={importProgress}
              onSelect={handleTreeSelect}
              loading={isLoadingTree}
              emptyMessage="No samples in library"
              renderIcon={(node) => node.type === 'sample' ? <AudioFileIcon /> : undefined}
              renderDetail={(_node) => (
                <SampleDetailPanel
                  sample={selectedSampleMeta}
                  loading={isLoadingMeta}
                  actions={
                    selectedSampleMeta ? (
                      <button
                        className="ac-btn ac-btn-sm ac-btn-primary"
                        onClick={handleLoadSelectedIntoEditor}
                      >
                        Load into Editor
                      </button>
                    ) : undefined
                  }
                />
              )}
            />
          </div>
        )}
      </div>

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
