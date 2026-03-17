/**
 * Dev harness for the sample chopper.
 *
 * Loads a WAV file via file picker or drag-and-drop,
 * then opens the SampleChopperDialog for testing.
 * Supports saving/loading chopped samples to the library
 * via the File System Access API.
 */

import { createRoot } from 'react-dom/client';
import { useState, useCallback, useRef } from 'react';
import {
  SampleChopperDialog,
  type ChopperResult,
  type ChopperSavePayload,
  type ChopperLoadPayload,
} from '@/ui/index.js';
import {
  hasFileSystemAccess,
  saveChoppedSample,
  loadChoppedSample,
  loadLibraryTone,
  loadLibraryDrumKit,
  getLibraryHandle,
  pickLibraryDirectory,
  type LibraryToneInfo,
  type LibraryDrumKitInfo,
} from './library.js';
import { LoadDialog } from './LoadDialog.js';
import { LibraryBrowser } from './LibraryBrowser.js';
import './styles.css';

function parseWavFile(buffer: ArrayBuffer): { samples: Int16Array; sampleRate: number } {
  const view = new DataView(buffer);

  // RIFF header
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (riff !== 'RIFF') throw new Error('Not a WAV file');

  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  if (wave !== 'WAVE') throw new Error('Not a WAV file');

  // Find fmt chunk
  let offset = 12;
  let sampleRate = 44100;
  let bitsPerSample = 16;
  let numChannels = 1;

  while (offset < buffer.byteLength - 8) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset), view.getUint8(offset + 1),
      view.getUint8(offset + 2), view.getUint8(offset + 3)
    );
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === 'fmt ') {
      numChannels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    }

    if (chunkId === 'data') {
      const dataOffset = offset + 8;
      const dataLength = chunkSize;

      if (bitsPerSample === 16) {
        const sampleCount = dataLength / (2 * numChannels);
        const samples = new Int16Array(sampleCount);

        for (let i = 0; i < sampleCount; i++) {
          // Take first channel only for multi-channel
          samples[i] = view.getInt16(dataOffset + i * 2 * numChannels, true);
        }

        return { samples, sampleRate };
      }

      if (bitsPerSample === 24) {
        const bytesPerFrame = 3 * numChannels;
        const sampleCount = dataLength / bytesPerFrame;
        const samples = new Int16Array(sampleCount);

        for (let i = 0; i < sampleCount; i++) {
          const byteOffset = dataOffset + i * bytesPerFrame;
          // Read 24-bit sample (little-endian), convert to 16-bit
          const lo = view.getUint8(byteOffset + 1);
          const hi = view.getInt8(byteOffset + 2);
          samples[i] = (hi << 8) | lo;
        }

        return { samples, sampleRate };
      }

      throw new Error(`Unsupported bit depth: ${bitsPerSample}`);
    }

    offset += 8 + chunkSize;
    if (chunkSize % 2 !== 0) offset++; // Pad byte
  }

  throw new Error('No data chunk found in WAV file');
}

function App() {
  const [samples, setSamples] = useState<Int16Array | null>(null);
  const [sampleRate, setSampleRate] = useState(44100);
  const [fileName, setFileName] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [initialSlices, setInitialSlices] = useState<Array<{ label: string; startSample: number; endSample: number }> | undefined>(undefined);
  const [editMode, setEditMode] = useState(false);
  const [result, setResult] = useState<ChopperResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [libraryConnected, setLibraryConnected] = useState(false);
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resolve/reject for the promise-based onLoad callback
  const loadResolverRef = useRef<{
    resolve: (payload: ChopperLoadPayload | null) => void;
  } | null>(null);

  const loadFile = useCallback(async (file: File) => {
    setError(null);
    setResult(null);
    setInitialSlices(undefined);
    setEditMode(false);
    try {
      const buffer = await file.arrayBuffer();
      const { samples: wavSamples, sampleRate: wavRate } = parseWavFile(buffer);
      setSamples(wavSamples);
      setSampleRate(wavRate);
      setFileName(file.name);
      setDialogOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file');
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  }, [loadFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, [loadFile]);

  const handleConfirm = useCallback((r: ChopperResult) => {
    setResult(r);
    console.log('Chopper result:', r);
  }, []);

  // Library: connect
  const handleConnectLibrary = useCallback(async () => {
    const handle = await pickLibraryDirectory();
    const connected = handle !== null;
    setLibraryConnected(connected);
    if (connected) setLibraryRefreshKey((k) => k + 1);
  }, []);

  // Check for existing library handle on mount
  useState(() => {
    getLibraryHandle().then((h) => setLibraryConnected(h !== null));
  });

  // Library: save callback for the dialog
  const handleSave = useCallback(async (payload: ChopperSavePayload) => {
    const name = window.prompt('Save chopped sample as:', payload.name.replace(/\.wav$/i, ''));
    if (!name) return;

    await saveChoppedSample({ ...payload, name });
    setLibraryRefreshKey((k) => k + 1);
  }, []);

  // Library: load callback for the dialog (promise-based)
  const handleLoad = useCallback((): Promise<ChopperLoadPayload | null> => {
    return new Promise((resolve) => {
      loadResolverRef.current = { resolve };
      setLoadDialogOpen(true);
    });
  }, []);

  const handleLoadSelect = useCallback(async (name: string) => {
    setLoadDialogOpen(false);
    try {
      const payload = await loadChoppedSample(name);
      // Update harness state with loaded audio
      setSamples(payload.sourceAudio.samples);
      setSampleRate(payload.sourceAudio.sampleRate);
      setFileName(name);
      loadResolverRef.current?.resolve(payload);
    } catch (err) {
      console.error('Failed to load sample:', err);
      loadResolverRef.current?.resolve(null);
    }
    loadResolverRef.current = null;
  }, []);

  // Library browser: open a saved sample in the chopper
  const handleOpenFromLibrary = useCallback(async (name: string) => {
    try {
      const payload = await loadChoppedSample(name);
      setSamples(payload.sourceAudio.samples);
      setSampleRate(payload.sourceAudio.sampleRate);
      setFileName(payload.name);
      setInitialSlices(payload.slices);
      setEditMode(true);
      setResult(null);
      setError(null);
      setDialogOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sample');
    }
  }, []);

  // Library browser: open a tone WAV in the chopper (raw audio, no slices)
  const handleOpenTone = useCallback(async (tone: LibraryToneInfo) => {
    try {
      const { samples: toneSamples, sampleRate: toneRate } = await loadLibraryTone(tone);
      setSamples(toneSamples);
      setSampleRate(toneRate);
      setFileName(`${tone.name} (${tone.device.toUpperCase()})`);
      setInitialSlices(undefined);
      setEditMode(false);
      setResult(null);
      setError(null);
      setDialogOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tone');
    }
  }, []);

  // Library browser: open a v2 drum kit with source WAV + pre-populated slices
  const handleOpenDrumKit = useCallback(async (kit: LibraryDrumKitInfo) => {
    try {
      const payload = await loadLibraryDrumKit(kit);
      setSamples(payload.samples);
      setSampleRate(payload.sampleRate);
      setFileName(`${kit.name} (${kit.device.toUpperCase()})`);
      setInitialSlices(payload.slices);
      setEditMode(true);
      setResult(null);
      setError(null);
      setDialogOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load drum kit');
    }
  }, []);

  const handleLoadCancel = useCallback(() => {
    setLoadDialogOpen(false);
    loadResolverRef.current?.resolve(null);
    loadResolverRef.current = null;
  }, []);

  const fsaaAvailable = hasFileSystemAccess();

  return (
    <div className="harness">
      <h1>Sample Chopper Dev Harness</h1>

      {/* Library connection status */}
      {fsaaAvailable && (
        <div className="library-bar">
          <span className={`library-status ${libraryConnected ? 'connected' : ''}`}>
            {libraryConnected ? 'Library connected' : 'Library not connected'}
          </span>
          <button className="library-btn" onClick={handleConnectLibrary}>
            {libraryConnected ? 'Change Directory' : 'Connect Library'}
          </button>
        </div>
      )}

      <div
        className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".wav"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <p>Drop a WAV file here or click to browse</p>
        {fileName && <p className="file-name">Loaded: {fileName}</p>}
      </div>

      {error && <div className="error">{error}</div>}

      {samples && !dialogOpen && (
        <div className="info">
          <p><strong>{fileName}</strong></p>
          <p>{sampleRate} Hz &middot; {samples.length} samples &middot; {((samples.length / sampleRate) * 1000).toFixed(0)}ms</p>
          <button className="open-btn" onClick={() => setDialogOpen(true)}>
            Open Chopper
          </button>
        </div>
      )}

      {result && (
        <div className="result">
          <h3>Result</h3>
          <p>{result.sliceDefinitions.length} slices created:</p>
          <table>
            <thead>
              <tr><th>#</th><th>Label</th><th>Start</th><th>End</th><th>Duration</th></tr>
            </thead>
            <tbody>
              {result.sliceDefinitions.map((s, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{s.label}</td>
                  <td>{s.startSample}</td>
                  <td>{s.endSample}</td>
                  <td>{((s.endSample - s.startSample) / sampleRate * 1000).toFixed(0)}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LibraryBrowser
        connected={libraryConnected}
        refreshKey={libraryRefreshKey}
        onOpen={handleOpenFromLibrary}
        onOpenTone={handleOpenTone}
        onOpenDrumKit={handleOpenDrumKit}
      />

      <SampleChopperDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        samples={samples}
        sampleRate={sampleRate}
        sourceName={fileName}
        onConfirm={handleConfirm}
        editMode={editMode}
        initialSlices={initialSlices}
        onSave={libraryConnected ? handleSave : undefined}
        onLoad={libraryConnected ? handleLoad : undefined}
      />

      <LoadDialog
        open={loadDialogOpen}
        onSelect={handleLoadSelect}
        onCancel={handleLoadCancel}
      />
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
