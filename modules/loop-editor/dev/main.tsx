/**
 * Standalone dev harness for the loop editor.
 *
 * Provides test audio data and browser environment wiring so the
 * loop editor can be developed independently of sampler-editor.
 * Supports loading samples from and saving loop-edited samples
 * back to the library via local filesystem (FSAA) or Google Drive.
 *
 * Uses the shared useLoopEditor hook for loop state, detection,
 * audio preview, and synth-core MIDI playback — same code path
 * as the production LoopEditorDialog.
 */

import '@audiocontrol/editor-core/dev/styles.css';
import '@audiocontrol/editor-core/styles.css';

import React, { useState, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { LoopEditor, useLoopEditor } from '@audiocontrol/loop-editor/ui';
import { createKeyboardNoteInput } from '@audiocontrol/synth-core';
import type { NoteInput } from '@audiocontrol/synth-core';
import {
  useNotifications,
  useLibraryConnection,
  NotificationArea,
  LibraryBrowser,
  SampleDetailPanel,
  CacheMetricsModal,
  AudioFileIcon,
  OperationProgressBar,
  createBrowserFileIO,
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

const fileIO = createBrowserFileIO();

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

const DEFAULT_SAMPLE_RATE = 30000;

// ---------------------------------------------------------------------------
// Test signal generators (inlined — same signals as sampler-library's
// loop-detector/testing/test-signals.ts and the sampler-editor test page)
// ---------------------------------------------------------------------------

function toneAt(i: number, sr: number, amplitude: number): number {
  const t = i / sr;
  return (Math.sin(2 * Math.PI * 440 * t) + 0.5 * Math.sin(2 * Math.PI * 880 * t) +
    0.25 * Math.sin(2 * Math.PI * 1320 * t)) * amplitude * 0.6;
}

const SIGNAL_GENERATORS: Record<string, (sr: number) => Int16Array> = {
  'sustain': (sr) => {
    const buf = new Int16Array(sr * 2);
    for (let i = 0; i < buf.length; i++) buf[i] = Math.round(toneAt(i, sr, 0.8) * 32767);
    return buf;
  },
  'leading-silence': (sr) => {
    const silence = Math.round(sr * 0.3);
    const buf = new Int16Array(sr * 2);
    for (let i = silence; i < buf.length; i++) {
      const fadeIn = Math.min(1, (i - silence) / (sr * 0.005));
      buf[i] = Math.round(toneAt(i, sr, fadeIn) * 32767);
    }
    return buf;
  },
  'trailing-silence': (sr) => {
    const toneLen = Math.round(sr * 1.5);
    const buf = new Int16Array(sr * 2);
    for (let i = 0; i < toneLen; i++) {
      const fadeOut = Math.min(1, (toneLen - i) / (sr * 0.005));
      buf[i] = Math.round(toneAt(i, sr, fadeOut) * 32767);
    }
    return buf;
  },
  'constant-decay': (sr) => {
    const buf = new Int16Array(sr * 2);
    const tau = buf.length / Math.log(1000);
    for (let i = 0; i < buf.length; i++) buf[i] = Math.round(toneAt(i, sr, Math.exp(-i / tau)) * 32767);
    return buf;
  },
  'decay-into-sustain': (sr) => {
    const attack = Math.round(sr * 0.01);
    const decay = Math.round(sr * 0.19);
    const buf = new Int16Array(sr * 2);
    for (let i = 0; i < buf.length; i++) {
      let env: number;
      if (i < attack) env = i / attack;
      else if (i < attack + decay) env = 0.6 + 0.4 * Math.exp(-((i - attack) / decay) * 5);
      else env = 0.6;
      buf[i] = Math.round(toneAt(i, sr, env) * 32767);
    }
    return buf;
  },
  'sustain-trailing-decay': (sr) => {
    const sustainLen = Math.round(sr * 1.5);
    const decayLen = Math.round(sr * 0.5);
    const buf = new Int16Array(sustainLen + decayLen);
    for (let i = 0; i < buf.length; i++) {
      const env = i < sustainLen ? 0.8 : 0.8 * Math.exp(-((i - sustainLen) / decayLen) * 5);
      buf[i] = Math.round(toneAt(i, sr, env) * 32767);
    }
    return buf;
  },
};

function getInitialSignal(): { samples: Int16Array; name: string } {
  const param = new URLSearchParams(window.location.search).get('signal') ?? 'sustain';
  const gen = SIGNAL_GENERATORS[param] ?? SIGNAL_GENERATORS['sustain']!;
  return { samples: gen(DEFAULT_SAMPLE_RATE), name: param };
}

function DevHarness() {
  const initial = React.useMemo(() => getInitialSignal(), []);
  const [samples, setSamples] = useState(initial.samples);
  const [sampleRate, setSampleRate] = useState(DEFAULT_SAMPLE_RATE);
  const [sampleName, setSampleName] = useState(initial.name);

  // Keyboard note input for MIDI playback without hardware
  const [keyboardInput, setKeyboardInput] = useState<NoteInput | null>(null);
  useEffect(() => {
    const input = createKeyboardNoteInput(60);
    setKeyboardInput(input);
    return () => input.dispose();
  }, []);

  // Shared loop editor hook — owns loop state, detection, audio, synth-core
  const editor = useLoopEditor({
    samples,
    sampleRate,
    initialLoopStart: Math.floor(DEFAULT_SAMPLE_RATE * 0.5),
    initialLoopEnd: Math.floor(DEFAULT_SAMPLE_RATE * 1.5),
    rootKey: 60,
    noteInput: keyboardInput,
  });

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

  // Track previous search state to detect when search completes
  const wasSearchingRef = React.useRef(false);

  // Surface loop detection errors as notifications
  useEffect(() => {
    if (editor.loopDetectionError) {
      notify('error', `Loop detection failed: ${editor.loopDetectionError}`);
    }
  }, [editor.loopDetectionError]);

  // Notify when search completes with no candidates
  useEffect(() => {
    if (wasSearchingRef.current && !editor.isSearching) {
      if (!editor.loopDetectionError && editor.candidates.length === 0) {
        notify('info', 'No loop candidates found. Try adjusting the sample or end point.');
      }
    }
    wasSearchingRef.current = editor.isSearching;
  }, [editor.isSearching, editor.candidates.length, editor.loopDetectionError]);

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
      editor.resetForNewSamples(result.yaml.loopStart ?? 0, result.yaml.loopEnd ?? wavData.samples.length);
      setLibraryOrigin({ name: node.directoryName, path: node.path });
      setSelectedSampleMeta(result.yaml);
      editor.clearResults();
      notify('info', `Loaded "${result.yaml.name}"`);
    } catch (err) {
      setLoadProgress(undefined);
      notify('error', `Load failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }, [library.root, editor.resetForNewSamples, editor.clearResults]);

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

  // Library: create a new folder
  const handleCreateFolder = useCallback(async (name: string, parentPath: string[]) => {
    if (!library.root) throw new Error('Not connected');
    await createFolder(library.root, parentPath, name);
    await refreshLibrary();
    notify('info', `Created folder "${name}"`);
  }, [library.root, refreshLibrary]);

  // Library: delete a sample or folder
  const handleDeleteItem = useCallback(async (node: TreeNode) => {
    const meta = node.meta as { directoryName?: string; path?: string[] } | undefined;
    if (!library.root) throw new Error('Not connected');
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

    for (let i = 0; i < wavFiles.length; i++) {
      const file = wavFiles[i]!;
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
        await importWavToCommonArea(library.root!, file.name, data, { targetPath });
        completedBytes += file.size;
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
      loopStart: editor.loopPoint,
      loopEnd: editor.endPoint,
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
  }, [library.root, libraryOrigin, sampleName, sampleRate, editor.loopPoint, editor.endPoint, samples, refreshLibrary]);

  // File load handler
  const handleLoadFile = useCallback(async () => {
    const handle = await fileIO.pickFile({ accept: { 'audio/wav': ['.wav'] } });
    if (!handle) return;
    const buffer = await fileIO.readFile(handle);
    const wavData = parseWav(new Uint8Array(buffer));
    setSamples(wavData.samples);
    setSampleRate(wavData.sampleRate);
    setSampleName(handle.name ?? 'Loaded File');
    editor.resetForNewSamples(0, wavData.samples.length);
    editor.clearResults();
    setLibraryOrigin(null);
  }, [editor.resetForNewSamples, editor.clearResults]);

  const cacheMetrics = library.getMetrics() as CacheMetricsData | undefined;
  const hasCacheMetrics = cacheMetrics !== undefined;

  const showLibrary = library.isConnected && libraryItems.length > 0;

  return (
    <div data-testid="loop-editor-test-page" style={{ maxWidth: showLibrary ? 1440 : 960, margin: '0 auto', padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 className="ac-title-md" style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
          Loop Editor
        </h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {editor.activeNotes.size > 0 && (
            <span className="ac-text-muted" style={{ fontSize: 12 }}>
              MIDI: {editor.activeNotes.size} {editor.activeNotes.size === 1 ? 'voice' : 'voices'}
            </span>
          )}
          <button className="ac-btn ac-btn-sm" onClick={handleLoadFile}>
            Load WAV
          </button>
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

      <span data-testid="signal-name" hidden>{initial.name}</span>
      <p data-testid="keyboard-input-status" className="ac-text-muted" style={{ fontSize: 14, marginBottom: 24 }}>
        {sampleName} — {sampleRate} Hz, {samples.length} samples
        {libraryOrigin && <span> (from library)</span>}
        {' · '}Keyboard input: {keyboardInput ? 'active' : 'initializing'}
      </p>

      {/* Main content: editor left, library right */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 0%', minWidth: 0 }}>
          <LoopEditor
            samples={samples}
            sampleRate={sampleRate}
            startPoint={0}
            loopPoint={editor.loopPoint}
            endPoint={editor.endPoint}
            onLoopPointChange={editor.setLoopPoint}
            onEndPointChange={editor.setEndPoint}
            candidates={editor.candidates}
            selectedCandidateIndex={editor.selectedCandidateIndex}
            onCandidateSelect={editor.setSelectedCandidateIndex}
            onApplyCandidate={editor.handleApplyCandidate}
            onAutoDetect={editor.handleAutoDetect}
            isSearching={editor.isSearching}
            searchProgress={editor.searchProgress}
            audio={editor.audio}
            playbackMode={editor.playbackMode}
            onPlaybackModeChange={editor.setPlaybackMode}
            discontinuity={editor.discontinuity}
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
