/**
 * Import Sample Dialog
 *
 * Dialog for importing a WAV file from disk to a tone slot on the S-330.
 * Handles WAV parsing, conversion to S-330 format, and upload to device.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

export interface ImportSampleDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onOpenChange: (open: boolean) => void;
  /** Target tone index to import to */
  toneIndex: number;
  /** Current tone name (for default naming) */
  toneName?: string;
  /** Callback to perform the import */
  onImport: (params: {
    toneIndex: number;
    name: string;
    waveData: Uint8Array;
    waveBank: 0 | 1;
    segmentTop: number;
    segmentLength: number;
    sampleRate: '15kHz' | '30kHz';
    loopMode: 'forward' | 'alternating' | 'one-shot' | 'reverse';
    loopPoint: number;
  }) => Promise<void>;
  /** Whether import is in progress */
  isImporting: boolean;
  /** Import progress (0-100) */
  importProgress?: number;
  /** Import error message */
  importError?: string | null;
}

interface WavInfo {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  duration: number;
  sampleCount: number;
  data: Float32Array;
}

function parseWavFile(arrayBuffer: ArrayBuffer): WavInfo {
  const view = new DataView(arrayBuffer);

  // Check RIFF header
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (riff !== 'RIFF') {
    throw new Error('Not a valid WAV file (missing RIFF header)');
  }

  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  if (wave !== 'WAVE') {
    throw new Error('Not a valid WAV file (missing WAVE format)');
  }

  // Find fmt chunk
  let offset = 12;
  let fmtFound = false;
  let audioFormat = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;

  while (offset < arrayBuffer.byteLength - 8) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === 'fmt ') {
      audioFormat = view.getUint16(offset + 8, true);
      channels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
      fmtFound = true;
    }

    if (chunkId === 'data') {
      if (!fmtFound) {
        throw new Error('WAV file has data chunk before fmt chunk');
      }

      if (audioFormat !== 1 && audioFormat !== 3) {
        throw new Error(`Unsupported audio format: ${audioFormat} (only PCM supported)`);
      }

      const dataSize = chunkSize;
      const bytesPerSample = bitsPerSample / 8;
      const sampleCount = dataSize / bytesPerSample / channels;

      // Convert to mono float32
      const data = new Float32Array(sampleCount);
      const dataOffset = offset + 8;

      for (let i = 0; i < sampleCount; i++) {
        let sample = 0;

        // Read all channels and average for mono
        for (let ch = 0; ch < channels; ch++) {
          const sampleOffset = dataOffset + (i * channels + ch) * bytesPerSample;

          if (audioFormat === 3) {
            // 32-bit float
            sample += view.getFloat32(sampleOffset, true);
          } else if (bitsPerSample === 16) {
            sample += view.getInt16(sampleOffset, true) / 32768;
          } else if (bitsPerSample === 24) {
            const b0 = view.getUint8(sampleOffset);
            const b1 = view.getUint8(sampleOffset + 1);
            const b2 = view.getUint8(sampleOffset + 2);
            const val = (b2 << 16) | (b1 << 8) | b0;
            const signed = val > 0x7fffff ? val - 0x1000000 : val;
            sample += signed / 8388608;
          } else if (bitsPerSample === 8) {
            sample += (view.getUint8(sampleOffset) - 128) / 128;
          } else {
            throw new Error(`Unsupported bit depth: ${bitsPerSample}`);
          }
        }

        data[i] = sample / channels;
      }

      return {
        sampleRate,
        channels,
        bitsPerSample,
        duration: sampleCount / sampleRate,
        sampleCount,
        data,
      };
    }

    offset += 8 + chunkSize;
    // Align to word boundary
    if (chunkSize % 2 === 1) offset++;
  }

  throw new Error('WAV file missing data chunk');
}

function resampleAudio(input: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (inputRate === outputRate) {
    return input;
  }

  const ratio = inputRate / outputRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1);
    const frac = srcIndex - srcIndexFloor;

    // Linear interpolation
    output[i] = input[srcIndexFloor] * (1 - frac) + input[srcIndexCeil] * frac;
  }

  return output;
}

function convertToS330Format(samples: Float32Array): Uint8Array {
  // S-330 uses 12-bit samples packed as 2 bytes per sample (high nibble unused)
  // Format: each sample is 2 bytes, little-endian, 12-bit value left-shifted by 4
  const output = new Uint8Array(samples.length * 2);

  for (let i = 0; i < samples.length; i++) {
    // Clamp and convert to 12-bit signed (-2048 to 2047)
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const value = Math.round(clamped * 2047);

    // Convert to unsigned 12-bit (0 to 4095)
    const unsigned = value < 0 ? value + 4096 : value;

    // Pack as 2 bytes (little-endian, shifted left by 4)
    const shifted = unsigned << 4;
    output[i * 2] = shifted & 0xff;
    output[i * 2 + 1] = (shifted >> 8) & 0xff;
  }

  return output;
}

export function ImportSampleDialog({
  open,
  onOpenChange,
  toneIndex,
  toneName,
  onImport,
  isImporting,
  importProgress,
  importError,
}: ImportSampleDialogProps): JSX.Element {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [wavInfo, setWavInfo] = useState<WavInfo | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [name, setName] = useState(toneName || '');
  const [targetSampleRate, setTargetSampleRate] = useState<'15kHz' | '30kHz'>('30kHz');
  const [waveBank, setWaveBank] = useState<0 | 1>(0);
  const [targetSegment, setTargetSegment] = useState(0);
  const [loopMode, setLoopMode] = useState<'forward' | 'alternating' | 'one-shot' | 'reverse'>('one-shot');
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedFile(null);
      setWavInfo(null);
      setParseError(null);
      setName(toneName || '');
      setTargetSampleRate('30kHz');
      setWaveBank(0);
      setTargetSegment(0);
      setLoopMode('one-shot');
      setLocalError(null);
    }
  }, [open, toneName]);

  // Calculate segments needed based on output sample count after resampling
  const segmentsNeeded = wavInfo
    ? Math.ceil(
        (wavInfo.sampleCount * ((targetSampleRate === '30kHz' ? 30000 : 15000) / wavInfo.sampleRate)) / 12000
      )
    : 1;

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setParseError(null);
    setWavInfo(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const info = parseWavFile(arrayBuffer);
      setWavInfo(info);

      // Auto-set name from filename if not already set
      if (!name) {
        const baseName = file.name.replace(/\.wav$/i, '').slice(0, 8);
        setName(baseName);
      }

      // Auto-select sample rate closest to source
      if (info.sampleRate <= 22500) {
        setTargetSampleRate('15kHz');
      } else {
        setTargetSampleRate('30kHz');
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse WAV file');
    }
  }, [name]);

  const handleImport = useCallback(async () => {
    if (!wavInfo || !name.trim()) {
      setLocalError('Please select a file and enter a name');
      return;
    }

    setLocalError(null);

    try {
      // Resample to target rate
      const targetRate = targetSampleRate === '30kHz' ? 30000 : 15000;
      const resampled = resampleAudio(wavInfo.data, wavInfo.sampleRate, targetRate);

      // Convert to S-330 format
      const waveData = convertToS330Format(resampled);

      await onImport({
        toneIndex,
        name: name.trim(),
        waveData,
        waveBank,
        segmentTop: targetSegment,
        segmentLength: Math.ceil(resampled.length / 12000),
        sampleRate: targetSampleRate,
        loopMode,
        loopPoint: 0,
      });
    } catch (err) {
      // Error handled by parent
    }
  }, [wavInfo, name, targetSampleRate, targetSegment, loopMode, toneIndex, onImport]);

  const handleClose = useCallback(() => {
    if (!isImporting) {
      onOpenChange(false);
    }
  }, [isImporting, onOpenChange]);

  const error = localError || parseError || importError;
  const isComplete = importProgress === 100 && !isImporting;

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-s330-panel border border-s330-accent rounded-lg shadow-xl w-full max-w-md p-6">
          <Dialog.Title className="text-lg font-bold text-s330-text mb-4">
            Import Sample to T{toneIndex + 11}
          </Dialog.Title>

          {isComplete ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Sample imported successfully!</span>
              </div>
              <div className="flex justify-end">
                <button onClick={handleClose} className="ac-btn ac-btn-primary">
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <Dialog.Description className="text-sm text-s330-muted">
                Select a WAV file to import to this tone slot.
              </Dialog.Description>

              {/* File Selection */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".wav,audio/wav"
                  onChange={handleFileSelect}
                  disabled={isImporting}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className={cn(
                    'w-full py-8 border-2 border-dashed rounded-lg text-center',
                    'hover:border-s330-highlight hover:bg-s330-highlight/5',
                    'transition-colors cursor-pointer',
                    selectedFile ? 'border-s330-highlight' : 'border-s330-accent/50',
                    isImporting && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {selectedFile ? (
                    <div>
                      <div className="text-s330-text font-medium">{selectedFile.name}</div>
                      <div className="text-s330-muted text-sm">Click to change file</div>
                    </div>
                  ) : (
                    <div className="text-s330-muted">Click to select a WAV file</div>
                  )}
                </button>
              </div>

              {/* WAV Info */}
              {wavInfo && (
                <div className="bg-s330-bg rounded p-3 text-sm">
                  <div className="text-s330-muted mb-1">File Info:</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-s330-muted">Sample Rate:</span>
                      <span className="ml-2 text-s330-text">{wavInfo.sampleRate} Hz</span>
                    </div>
                    <div>
                      <span className="text-s330-muted">Duration:</span>
                      <span className="ml-2 text-s330-text">{wavInfo.duration.toFixed(2)}s</span>
                    </div>
                    <div>
                      <span className="text-s330-muted">Channels:</span>
                      <span className="ml-2 text-s330-text">{wavInfo.channels}</span>
                    </div>
                    <div>
                      <span className="text-s330-muted">Bit Depth:</span>
                      <span className="ml-2 text-s330-text">{wavInfo.bitsPerSample}-bit</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tone Name */}
              <div>
                <label htmlFor="toneName" className="block text-sm text-s330-muted mb-1">
                  Tone Name
                </label>
                <input
                  id="toneName"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 8))}
                  disabled={isImporting}
                  maxLength={8}
                  className={cn(
                    'w-full bg-s330-bg border rounded px-3 py-2 text-s330-text font-mono',
                    'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                    'border-s330-accent/50',
                    isImporting && 'opacity-50'
                  )}
                  placeholder="Enter tone name (max 8 chars)"
                />
              </div>

              {/* Sample Rate Selection */}
              <div>
                <label htmlFor="sampleRate" className="block text-sm text-s330-muted mb-1">
                  Target Sample Rate
                </label>
                <select
                  id="sampleRate"
                  value={targetSampleRate}
                  onChange={(e) => setTargetSampleRate(e.target.value as '15kHz' | '30kHz')}
                  disabled={isImporting}
                  className={cn(
                    'w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text',
                    'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                    isImporting && 'opacity-50'
                  )}
                >
                  <option value="30kHz">30 kHz (higher quality)</option>
                  <option value="15kHz">15 kHz (uses less memory)</option>
                </select>
              </div>

              {/* Wave Bank and Segment */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="waveBank" className="block text-sm text-s330-muted mb-1">
                    Wave Bank
                  </label>
                  <select
                    id="waveBank"
                    value={waveBank}
                    onChange={(e) => setWaveBank(Number(e.target.value) as 0 | 1)}
                    disabled={isImporting}
                    className={cn(
                      'w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text',
                      'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                      isImporting && 'opacity-50'
                    )}
                  >
                    <option value={0}>Bank A</option>
                    <option value={1}>Bank B</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="targetSegment" className="block text-sm text-s330-muted mb-1">
                    Segment (needs {segmentsNeeded})
                  </label>
                  <select
                    id="targetSegment"
                    value={targetSegment}
                    onChange={(e) => setTargetSegment(Number(e.target.value))}
                    disabled={isImporting}
                    className={cn(
                      'w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text',
                      'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                      isImporting && 'opacity-50'
                    )}
                  >
                    {Array.from({ length: 18 - segmentsNeeded + 1 }, (_, i) => (
                      <option key={i} value={i}>
                        {i} - {i + segmentsNeeded - 1}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-s330-muted -mt-2">
                Warning: This will overwrite existing wave data in the target segment(s).
              </p>

              {/* Loop Mode */}
              <div>
                <label htmlFor="loopMode" className="block text-sm text-s330-muted mb-1">
                  Loop Mode
                </label>
                <select
                  id="loopMode"
                  value={loopMode}
                  onChange={(e) => setLoopMode(e.target.value as typeof loopMode)}
                  disabled={isImporting}
                  className={cn(
                    'w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text',
                    'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                    isImporting && 'opacity-50'
                  )}
                >
                  <option value="one-shot">One-Shot (no loop)</option>
                  <option value="forward">Forward Loop</option>
                  <option value="alternating">Alternating Loop</option>
                  <option value="reverse">Reverse</option>
                </select>
              </div>

              {/* Progress Bar */}
              {isImporting && importProgress !== undefined && (
                <div>
                  <div className="h-2 bg-s330-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-s330-highlight transition-all duration-150 ease-out"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-s330-muted mt-1 text-right">
                    Uploading to device... {importProgress.toFixed(0)}%
                  </p>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="text-sm text-red-400 bg-red-900/20 rounded p-2">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleClose}
                  disabled={isImporting}
                  className={cn(
                    'ac-btn ac-btn-ghost',
                    isImporting && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={isImporting || !wavInfo || !name.trim()}
                  className={cn(
                    'ac-btn ac-btn-primary',
                    (isImporting || !wavInfo || !name.trim()) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {isImporting ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                      Importing...
                    </>
                  ) : (
                    'Import Sample'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Close button */}
          <Dialog.Close asChild>
            <button
              className="absolute top-4 right-4 text-s330-muted hover:text-s330-text"
              aria-label="Close"
              disabled={isImporting}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
