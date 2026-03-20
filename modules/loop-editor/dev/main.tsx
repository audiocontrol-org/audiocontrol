/**
 * Standalone dev harness for the loop editor.
 *
 * Provides test audio data and browser environment wiring so the
 * loop editor can be developed independently of sampler-editor.
 * Supports loading samples from and saving loop-edited samples
 * back to the library via local filesystem (FSAA) or Google Drive.
 */

import '@audiocontrol/editor-core/dev/styles.css';

import React, { useState, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { LoopEditor } from '@/ui/LoopEditor';
import { useLoopDetection } from '@/ui/hooks/useLoopDetection';
import {
  parseWav,
  createWav,
  listCommonSamplesTree,
  loadSample,
  saveSample,
  type LibraryTreeNode,
  type SampleYaml,
  type LibraryConnection,
} from '@audiocontrol/sampler-library/browser';
import { createDevEnvironment } from './environment';

const env = createDevEnvironment();

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

type StorageBackend = 'none' | 'local' | 'google-drive';

function DevHarness() {
  const defaultSampleRate = 30000;
  const [samples, setSamples] = useState(() => generateTestAudio(defaultSampleRate, 2));
  const [sampleRate, setSampleRate] = useState(defaultSampleRate);
  const [loopPoint, setLoopPoint] = useState(Math.floor(defaultSampleRate * 0.5));
  const [endPoint, setEndPoint] = useState(Math.floor(defaultSampleRate * 1.5));
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState<number | undefined>(undefined);
  const [sampleName, setSampleName] = useState('Test Tone');

  // Library state
  const [activeBackend, setActiveBackend] = useState<StorageBackend>('none');
  const [libraryItems, setLibraryItems] = useState<LibraryTreeNode[]>([]);
  const [libraryOrigin, setLibraryOrigin] = useState<{ name: string; path: string[] } | null>(null);
  const [notifications, setNotifications] = useState<Array<{ id: number; level: 'info' | 'error'; text: string }>>([]);
  const nextId = React.useRef(0);

  const notify = useCallback((level: 'info' | 'error', text: string) => {
    const id = nextId.current++;
    setNotifications((prev) => [...prev, { id, level, text }]);
    if (level === 'info') {
      setTimeout(() => setNotifications((prev) => prev.filter((n) => n.id !== id)), 5000);
    }
  }, []);

  const dismissNotification = useCallback((id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const {
    isSearching,
    progress,
    candidates,
    searchLoopPoints,
    clearResults,
  } = useLoopDetection();

  const activeConnection = (): LibraryConnection | null => {
    if (activeBackend === 'local') return env.fsaaLibrary;
    if (activeBackend === 'google-drive' && env.googleDrive) return env.googleDrive;
    return null;
  };

  // Handle Google Drive OAuth redirect on page load.
  // Guarded against React StrictMode double-firing, which would
  // consume the auth code on the first run and find nothing on the second.
  const oauthHandled = React.useRef(false);
  useEffect(() => {
    if (!env.googleDrive || oauthHandled.current) return;
    oauthHandled.current = true;

    (async () => {
      try {
        // Check if this is an OAuth callback
        const handled = await env.googleDrive!.handleRedirect();
        if (handled) {
          // Token is stored — now initialize the client
          const connected = await env.googleDrive!.tryRestore();
          if (connected) {
            setActiveBackend('google-drive');
            notify('info', 'Connected to Google Drive');
            const root = env.googleDrive!.getRoot();
            const items = await listCommonSamplesTree(root);
            setLibraryItems(items);
          } else {
            notify('error', 'Google Drive: token exchange succeeded but client init failed');
          }
          return;
        }

        // Try restoring an existing session
        const restored = await env.googleDrive!.tryRestore();
        if (restored) {
          setActiveBackend('google-drive');
          notify('info', 'Google Drive session restored');
          const root = env.googleDrive!.getRoot();
          const items = await listCommonSamplesTree(root);
          setLibraryItems(items);
        }
      } catch (err) {
        notify('error', `Google Drive init: ${err instanceof Error ? err.message : String(err)}`);
      }
    })();
  }, []);

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

  // Library: connect local filesystem
  const handleConnectLocal = useCallback(async () => {
    const connected = await env.fsaaLibrary.connect();
    if (connected) {
      setActiveBackend('local');
      notify('info', 'Connected to local filesystem');
      const root = env.fsaaLibrary.getRoot();
      const items = await listCommonSamplesTree(root);
      setLibraryItems(items);
    }
  }, []);

  // Library: connect Google Drive
  const handleConnectGoogleDrive = useCallback(async () => {
    if (!env.googleDrive) {
      notify('error', 'Google Drive not configured (missing VITE_GOOGLE_CLIENT_ID)');
      return;
    }
    try {
      await env.googleDrive.connect();
    } catch (err) {
      notify('error', `Google Drive: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  // Library: refresh listing
  const refreshLibrary = useCallback(async () => {
    const conn = activeConnection();
    if (!conn) return;
    const root = conn.getRoot();
    const items = await listCommonSamplesTree(root);
    setLibraryItems(items);
  }, [activeBackend]);

  // Library: load a sample
  const handleLoadSample = useCallback(async (node: LibraryTreeNode) => {
    if (node.type !== 'sample' || !node.fileName) return;
    const conn = activeConnection();
    if (!conn) return;
    try {
      const root = conn.getRoot();
      const result = await loadSample(root, node.fileName, node.path);
      const wavData = parseWav(result.wavData);
      setSamples(wavData.samples);
      setSampleRate(wavData.sampleRate);
      setSampleName(result.yaml.name);
      setLoopPoint(result.yaml.loopStart ?? 0);
      setEndPoint(result.yaml.loopEnd ?? wavData.samples.length);
      setLibraryOrigin({ name: node.fileName, path: node.path });
      clearResults();
      setSelectedCandidateIndex(undefined);
      notify('info', `Loaded "${result.yaml.name}"`);
    } catch (err) {
      notify('error', `Load failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }, [activeBackend, clearResults]);

  // Library: save current sample with loop points
  const handleSaveToLibrary = useCallback(async () => {
    const conn = activeConnection();
    if (!conn) return;

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
    const root = conn.getRoot();

    try {
      await saveSample(root, { name, yaml, wavData }, path);
      setLibraryOrigin({ name, path });
      notify('info', `Saved "${name}" to library`);
      await refreshLibrary();
    } catch (err) {
      notify('error', `Save failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }, [activeBackend, libraryOrigin, sampleName, sampleRate, loopPoint, endPoint, samples, refreshLibrary]);

  const isConnected = activeBackend !== 'none';
  const hasLocalFS = 'showDirectoryPicker' in globalThis;
  const hasGoogleDrive = env.googleDrive !== null;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 className="text-s330-text" style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
          Loop Editor — Dev Harness
        </h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isConnected && (
            <button className="ac-btn ac-btn-primary ac-btn-sm" onClick={handleSaveToLibrary}>
              Save to Library
            </button>
          )}
          {hasLocalFS && (
            <button className="ac-btn ac-btn-sm" onClick={handleConnectLocal}>
              {activeBackend === 'local' ? 'Change Local' : 'Local FS'}
            </button>
          )}
          {hasGoogleDrive && (
            <button className="ac-btn ac-btn-sm" onClick={handleConnectGoogleDrive}>
              {activeBackend === 'google-drive' ? 'Google Drive ✓' : 'Google Drive'}
            </button>
          )}
        </div>
      </div>

      {/* Notification area — always visible, stacks errors and info */}
      {notifications.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {notifications.map((n) => (
            <div
              key={n.id}
              className={n.level === 'error' ? 'ac-alert ac-alert-error' : 'ac-alert'}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', fontSize: 13 }}
            >
              <span>{n.text}</span>
              <div style={{ display: 'flex', gap: 4, marginLeft: 12, flexShrink: 0 }}>
                <button
                  className="ac-btn ac-btn-sm"
                  style={{ padding: '2px 8px', fontSize: 11 }}
                  onClick={() => navigator.clipboard.writeText(n.text)}
                >
                  copy
                </button>
                <button
                  className="ac-btn ac-btn-sm"
                  style={{ padding: '2px 8px', fontSize: 11 }}
                  onClick={() => dismissNotification(n.id)}
                >
                  dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-s330-muted" style={{ fontSize: 14, marginBottom: 24 }}>
        {sampleName} — {sampleRate} Hz, {samples.length} samples
        {libraryOrigin && <span> (from library)</span>}
      </p>

      {/* Library browser */}
      {isConnected && libraryItems.length > 0 && (
        <div className="ac-card" style={{ marginBottom: 24, maxHeight: 200, overflowY: 'auto' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }} className="text-s330-text">
            Library Samples ({activeBackend === 'google-drive' ? 'Google Drive' : 'Local'})
          </div>
          <SampleList items={libraryItems} onSelect={handleLoadSample} />
        </div>
      )}

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
    </div>
  );
}

/** Flat list of clickable sample nodes from the library tree. */
function SampleList({ items, onSelect }: {
  items: LibraryTreeNode[];
  onSelect: (node: LibraryTreeNode) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {items.map((node) => {
        if (node.type === 'directory' && node.children) {
          return (
            <div key={node.id}>
              <div className="text-s330-muted" style={{ fontSize: 11, fontWeight: 600, padding: '4px 0 2px' }}>
                {node.name}/
              </div>
              <div style={{ paddingLeft: 12 }}>
                <SampleList items={node.children} onSelect={onSelect} />
              </div>
            </div>
          );
        }
        if (node.type === 'sample') {
          return (
            <button
              key={node.id}
              className="ac-btn ac-btn-sm"
              style={{ textAlign: 'left', padding: '4px 8px', fontSize: 12 }}
              onClick={() => onSelect(node)}
            >
              {node.name}
            </button>
          );
        }
        return null;
      })}
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<React.StrictMode><DevHarness /></React.StrictMode>);
