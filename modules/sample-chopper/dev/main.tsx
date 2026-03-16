/**
 * Dev harness for the sample chopper.
 *
 * Loads a WAV file via file picker or drag-and-drop,
 * then opens the SampleChopperDialog for testing.
 */

import { createRoot } from 'react-dom/client';
import { useState, useCallback, useRef } from 'react';
import {
  SampleChopperDialog,
  type ChopperResult,
} from '@/ui/index.js';
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
  const [result, setResult] = useState<ChopperResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFile = useCallback(async (file: File) => {
    setError(null);
    setResult(null);
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

  return (
    <div className="harness">
      <h1>Sample Chopper Dev Harness</h1>

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

      <SampleChopperDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        samples={samples}
        sampleRate={sampleRate}
        sourceName={fileName}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
