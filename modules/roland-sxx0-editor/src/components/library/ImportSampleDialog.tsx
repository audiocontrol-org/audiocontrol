/**
 * Import Sample Dialog
 *
 * Dialog for importing a WAV file from disk to a tone slot on the S-330.
 * Handles WAV parsing, conversion to S-330 format, and upload to device.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { OperationState } from '@/types/import-operation';
import { isOperationComplete } from '@/types/import-operation';
import { cn } from '@/lib/utils';
import {
  prepareWavForS330,
  getWavFileInfo,
  calculateWavSegmentsNeeded,
  type WavFileInfo,
} from '@/lib/library-service';
import {
  OperationProgressBar,
  OperationErrorBanner,
  OperationSuccessScreen,
  OperationButtonContent,
  DialogCloseButton,
} from '@/components/ui/ImportStatus';

export interface ImportSampleDialogProps extends OperationState {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toneIndex: number;
  toneName?: string;
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
}

/** WAV file bytes for conversion */
interface WavFileState {
  info: WavFileInfo;
  bytes: ArrayBuffer;
}

export function ImportSampleDialog({
  open,
  onOpenChange,
  toneIndex,
  toneName,
  onImport,
  isOperating,
  progress,
  error: operationError,
}: ImportSampleDialogProps): JSX.Element {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [wavFile, setWavFile] = useState<WavFileState | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [name, setName] = useState(toneName || '');
  const [targetSampleRate, setTargetSampleRate] = useState<'15kHz' | '30kHz'>('15kHz');
  const [waveBank, setWaveBank] = useState<0 | 1>(0);
  const [targetSegment, setTargetSegment] = useState(0);
  const [loopMode, setLoopMode] = useState<'forward' | 'alternating' | 'one-shot' | 'reverse'>('one-shot');
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedFile(null);
      setWavFile(null);
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
  const segmentsNeeded = wavFile
    ? calculateWavSegmentsNeeded(wavFile.bytes, targetSampleRate === '30kHz' ? 30000 : 15000)
    : 1;

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setParseError(null);
    setWavFile(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const info = getWavFileInfo(arrayBuffer);
      setWavFile({ info, bytes: arrayBuffer });

      // Auto-set name from filename if not already set
      if (!name) {
        const baseName = file.name.replace(/\.wav$/i, '').slice(0, 8);
        setName(baseName);
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse WAV file');
    }
  }, [name]);

  const handleImport = useCallback(async () => {
    if (!wavFile || !name.trim()) {
      setLocalError('Please select a file and enter a name');
      return;
    }

    setLocalError(null);

    try {
      // Convert to S-330 format using the single code path
      const targetRate = targetSampleRate === '30kHz' ? 30000 : 15000;
      const prepared = prepareWavForS330(wavFile.bytes, targetRate);

      await onImport({
        toneIndex,
        name: name.trim(),
        waveData: prepared.data,
        waveBank,
        segmentTop: targetSegment,
        segmentLength: prepared.segmentLength,
        sampleRate: targetSampleRate,
        loopMode,
        loopPoint: 0,
      });
    } catch (err) {
      // Error handled by parent
    }
  }, [wavFile, name, targetSampleRate, targetSegment, loopMode, toneIndex, onImport, waveBank]);

  const handleClose = useCallback(() => {
    if (!isOperating) {
      onOpenChange(false);
    }
  }, [isOperating, onOpenChange]);

  const error = localError || parseError || operationError;
  const isComplete = isOperationComplete({ isOperating, progress, error: operationError });

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-s330-panel border border-s330-accent rounded-lg shadow-xl w-full max-w-md p-6">
          <Dialog.Title className="text-lg font-bold text-s330-text mb-4">
            Import Sample to T{toneIndex + 11}
          </Dialog.Title>

          {isComplete ? (
            <OperationSuccessScreen
              message="Sample imported successfully!"
              onDone={handleClose}
            />
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
                  disabled={isOperating}
                  data-testid="import-file-input"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isOperating}
                  data-testid="import-file-select"
                  className={cn(
                    'w-full py-8 border-2 border-dashed rounded-lg text-center',
                    'hover:border-s330-highlight hover:bg-s330-highlight/5',
                    'transition-colors cursor-pointer',
                    selectedFile ? 'border-s330-highlight' : 'border-s330-accent/50',
                    isOperating && 'opacity-50 cursor-not-allowed'
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
              {wavFile && (
                <div className="bg-s330-bg rounded p-3 text-sm">
                  <div className="text-s330-muted mb-1">File Info:</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-s330-muted">Sample Rate:</span>
                      <span className="ml-2 text-s330-text">{wavFile.info.sampleRate} Hz</span>
                    </div>
                    <div>
                      <span className="text-s330-muted">Duration:</span>
                      <span className="ml-2 text-s330-text">{wavFile.info.duration.toFixed(2)}s</span>
                    </div>
                    <div>
                      <span className="text-s330-muted">Channels:</span>
                      <span className="ml-2 text-s330-text">{wavFile.info.channels}</span>
                    </div>
                    <div>
                      <span className="text-s330-muted">Bit Depth:</span>
                      <span className="ml-2 text-s330-text">{wavFile.info.bitsPerSample}-bit</span>
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
                  disabled={isOperating}
                  data-testid="import-tone-name"
                  maxLength={8}
                  className={cn(
                    'w-full bg-s330-bg border rounded px-3 py-2 text-s330-text font-mono',
                    'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                    'border-s330-accent/50',
                    isOperating && 'opacity-50'
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
                  disabled={isOperating}
                  data-testid="import-sample-rate"
                  className={cn(
                    'w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text',
                    'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                    isOperating && 'opacity-50'
                  )}
                >
                  <option value="15kHz">15 kHz (default)</option>
                  <option value="30kHz">30 kHz (higher quality, uses more memory)</option>
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
                    disabled={isOperating}
                    data-testid="import-wave-bank"
                    className={cn(
                      'w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text',
                      'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                      isOperating && 'opacity-50'
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
                    disabled={isOperating}
                    data-testid="import-segment"
                    className={cn(
                      'w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text',
                      'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                      isOperating && 'opacity-50'
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
                  disabled={isOperating}
                  data-testid="import-loop-mode"
                  className={cn(
                    'w-full bg-s330-bg border border-s330-accent/50 rounded px-3 py-2 text-s330-text',
                    'focus:outline-none focus:ring-2 focus:ring-s330-highlight',
                    isOperating && 'opacity-50'
                  )}
                >
                  <option value="one-shot">One-Shot (no loop)</option>
                  <option value="forward">Forward Loop</option>
                  <option value="alternating">Alternating Loop</option>
                  <option value="reverse">Reverse</option>
                </select>
              </div>

              {isOperating && progress && (
                <OperationProgressBar progress={progress} />
              )}

              {error && <OperationErrorBanner error={error} />}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleClose}
                  disabled={isOperating}
                  className={cn(
                    'ac-btn ac-btn-ghost',
                    isOperating && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={isOperating || !wavFile || !name.trim()}
                  data-testid="import-submit"
                  className={cn(
                    'ac-btn ac-btn-primary',
                    (isOperating || !wavFile || !name.trim()) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <OperationButtonContent isOperating={isOperating} label="Import Sample" operatingLabel="Importing..." />
                </button>
              </div>
            </div>
          )}

          <Dialog.Close asChild>
            <DialogCloseButton disabled={isOperating} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
