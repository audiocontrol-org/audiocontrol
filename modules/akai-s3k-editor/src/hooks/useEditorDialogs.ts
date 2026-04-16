/**
 * S3K editor dialog hook — wraps the shared useEditorDialogsCore
 * with S3K-specific behavior:
 *
 * - Device sample loading via SDS (strategy pattern)
 * - Device save handlers: loop points → sample header, audio → SDS upload
 * - Save target dialog state for choosing overwrite/new/library
 * - S3K kit config for chopper dialog
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import type { StorageDirectoryHandle, ProgramYaml } from '@audiocontrol/sampler-library/browser';
import {
  useEditorDialogsCore,
  type EditorDialogStrategy,
  type EditorDialogsCoreResult,
  type WavData,
  type ChopperSavePayload,
  type ErrorReporter,
} from '@audiocontrol/editor-core';
import * as s3k from '@audiocontrol/sampler-devices/s3k';
import type { S3000xlClientInterface } from '@audiocontrol/sampler-devices/s3k';
import {
  DEFAULT_S3K_KIT_CONFIG,
  type S3kKitConfig,
} from '@/components/library/S3kKitOutputConfig';
import type { SaveTarget } from '@/components/samples/SaveTargetDialog';

// =========================================================================
// Re-export types from shared hook for backward compatibility
// =========================================================================

export type {
  LoopEditorDialogState,
  SampleEditorDialogState,
  ChopperDialogState,
  SliceEditDialogState,
  DrumKitEditorDialogState,
} from '@audiocontrol/editor-core';

// =========================================================================
// Helpers
// =========================================================================

function parseDeviceSampleIndex(name: string): number | null {
  const indexStr = name.split(':')[1];
  if (indexStr === undefined) return null;
  const idx = parseInt(indexStr, 10);
  return isNaN(idx) ? null : idx;
}

// =========================================================================
// Save target dialog state
// =========================================================================

export interface SaveTargetState {
  open: boolean;
  sampleName: string;
  /** Pending save data — held until user picks a target */
  pendingSave: {
    samples: Int16Array;
    sampleRate: number;
    deviceSampleIndex: number;
  } | null;
}

const SAVE_TARGET_IDLE: SaveTargetState = { open: false, sampleName: '', pendingSave: null };

// =========================================================================
// SDS transfer progress state
// =========================================================================

export interface SdsLoadingState {
  open: boolean;
  sampleName: string;
  direction: 'download' | 'upload';
  progress: import('@audiocontrol/midi-core').SdsTransferProgress | null;
  startTime: number | null;
  cancelled: boolean;
}

const SDS_LOADING_IDLE: SdsLoadingState = { open: false, sampleName: '', direction: 'download', progress: null, startTime: null, cancelled: false };

// =========================================================================
// Result interface
// =========================================================================

export interface EditorDialogsResult extends EditorDialogsCoreResult {
  kitConfig: S3kKitConfig;
  setKitConfig: (config: S3kKitConfig) => void;
  saveTargetState: SaveTargetState;
  handleSaveTargetConfirm: (target: SaveTarget) => Promise<void>;
  handleSaveTargetCancel: () => void;
  sdsLoadingState: SdsLoadingState;
  handleSdsLoadingCancel: () => void;
}

// =========================================================================
// Hook
// =========================================================================

export function useEditorDialogs(
  libraryRoot: StorageDirectoryHandle | null,
  onRefresh: () => void,
  errorReporter: ErrorReporter,
  client?: S3000xlClientInterface | null,
): EditorDialogsResult {
  const [kitConfig, setKitConfig] = useState<S3kKitConfig>(DEFAULT_S3K_KIT_CONFIG);
  const [saveTargetState, setSaveTargetState] = useState<SaveTargetState>(SAVE_TARGET_IDLE);
  const [sdsLoadingState, setSdsLoadingState] = useState<SdsLoadingState>(SDS_LOADING_IDLE);
  const sdsLoadingStateRef = useRef(sdsLoadingState);
  sdsLoadingStateRef.current = sdsLoadingState;
  const sdsAbortRef = useRef<AbortController | null>(null);

  const strategy = useMemo<EditorDialogStrategy>(() => ({
    loadWav: async (
      _root: StorageDirectoryHandle | null,
      name: string,
      nodeType: string,
    ): Promise<WavData | null> => {
      if (nodeType !== 'device-sample' || !client) return null;

      const sampleIndex = parseDeviceSampleIndex(name);
      if (sampleIndex === null) return null;

      // Open progress drawer immediately — don't wait for device round-trip
      const abortController = new AbortController();
      sdsAbortRef.current = abortController;
      setSdsLoadingState({ open: true, sampleName: `Sample ${sampleIndex + 1}`, direction: 'download', progress: null, startTime: Date.now(), cancelled: false });

      // Fetch header for name and loop metadata
      const sampleHeader = await client.fetchSampleHeader(sampleIndex);

      if (abortController.signal.aborted) {
        setSdsLoadingState(SDS_LOADING_IDLE);
        return null;
      }

      setSdsLoadingState((prev) => ({ ...prev, sampleName: sampleHeader.SHNAME.trim() }));

      try {
        var { header: sdsHeader, samples } = await client.receiveSampleViaSds(
          sampleIndex,
          (progress) => setSdsLoadingState((prev) => ({ ...prev, progress })),
          abortController.signal,
        );
      } catch (err) {
        setSdsLoadingState(SDS_LOADING_IDLE);
        sdsAbortRef.current = null;
        if (abortController.signal.aborted) return null;
        throw err;
      }

      setSdsLoadingState(SDS_LOADING_IDLE);
      sdsAbortRef.current = null;

      const sampleRate = Math.round(1_000_000_000 / sdsHeader.samplePeriodNs);

      return {
        samples,
        sampleRate,
        loopStart: sampleHeader.LOOPAT1 > 0 ? sampleHeader.LOOPAT1 : undefined,
        loopEnd: sampleHeader.LLNGTH1 > 0 ? sampleHeader.LOOPAT1 + sampleHeader.LLNGTH1 : undefined,
        rootKey: sampleHeader.SPITCH > 0 ? sampleHeader.SPITCH : undefined,
      };
    },
    transformChopperProgram: (program: ProgramYaml): ProgramYaml => ({
      ...program,
      name: kitConfig.name || program.name,
      zones: program.zones.map((zone, i) => ({
        ...zone,
        keyRange: [kitConfig.baseNote + i, kitConfig.baseNote + i] as [number, number],
        transpose: kitConfig.transpose !== 0 ? kitConfig.transpose : undefined,
      })),
    }),
  }), [kitConfig, client]);

  const core = useEditorDialogsCore(libraryRoot, strategy, onRefresh, errorReporter);

  // ---------------------------------------------------------------------------
  // Device-aware loop editor save (fast — header only, no dialog needed)
  // ---------------------------------------------------------------------------

  const handleLoopEditorSave = useCallback(async (loopStart: number, loopEnd: number) => {
    const origin = core.loopEditor?.origin;
    if (!origin) return;

    if (origin.type === 'device-sample' && client) {
      const sampleIndex = parseDeviceSampleIndex(origin.name);
      if (sampleIndex === null) return;

      try {
        const header = await client.fetchSampleHeader(sampleIndex);
        const updated = { ...header, raw: [...header.raw] };

        s3k.SampleHeader_writeLOOPAT1(updated, loopStart);
        updated.LOOPAT1 = loopStart;
        const loopLength = Math.max(0, loopEnd - loopStart);
        s3k.SampleHeader_writeLLNGTH1(updated, loopLength);
        updated.LLNGTH1 = loopLength;

        if (updated.SLOOPS === 0) {
          s3k.SampleHeader_writeSLOOPS(updated, 1);
          updated.SLOOPS = 1;
        }
        if (updated.SPTYPE === 2) {
          s3k.SampleHeader_writeSPTYPE(updated, 0);
          updated.SPTYPE = 0;
        }

        await client.writeSampleHeader(updated);
        client.invalidateSampleCache();
      } catch (err) {
        errorReporter.report(err instanceof Error ? err.message : 'Failed to save loop points to device');
      }
      return;
    }

    core.handleLoopEditorSave(loopStart, loopEnd);
  }, [core, client, errorReporter]);

  // ---------------------------------------------------------------------------
  // Device-aware sample editor save (opens SaveTargetDialog for device origin)
  // ---------------------------------------------------------------------------

  const handleSampleEditorSave = useCallback(async (samples: Int16Array, sampleRate: number) => {
    const origin = core.sampleEditor?.origin;
    if (!origin) return;

    if (origin.type === 'device-sample' && client) {
      const sampleIndex = parseDeviceSampleIndex(origin.name);
      if (sampleIndex === null) return;

      // Read sample name for the dialog
      try {
        const header = await client.fetchSampleHeader(sampleIndex);
        setSaveTargetState({
          open: true,
          sampleName: header.SHNAME.trim(),
          pendingSave: { samples, sampleRate, deviceSampleIndex: sampleIndex },
        });
      } catch (err) {
        errorReporter.report(err instanceof Error ? err.message : 'Failed to read sample header');
      }
      return;
    }

    core.handleSampleEditorSave(samples, sampleRate);
  }, [core, client, errorReporter]);

  // ---------------------------------------------------------------------------
  // Save target dialog handlers
  // ---------------------------------------------------------------------------

  const handleSaveTargetConfirm = useCallback(async (target: SaveTarget) => {
    const pending = saveTargetState.pendingSave;
    if (!pending || !client) {
      setSaveTargetState(SAVE_TARGET_IDLE);
      return;
    }

    const { samples, sampleRate, deviceSampleIndex } = pending;
    const pendingSampleName = saveTargetState.sampleName;
    setSaveTargetState(SAVE_TARGET_IDLE);

    const onUploadProgress = (progress: import('@audiocontrol/midi-core').SdsTransferProgress) => {
      setSdsLoadingState((prev) => ({ ...prev, progress }));
    };

    try {
      if (target === 'device-overwrite') {
        setSdsLoadingState({ open: true, sampleName: pendingSampleName, direction: 'upload', progress: null, startTime: Date.now(), cancelled: false });
        const header = await client.fetchSampleHeader(deviceSampleIndex);
        await client.sendSampleViaSds(deviceSampleIndex, samples, sampleRate, {
          name: header.SHNAME.trim(),
          loopStart: header.LOOPAT1,
          loopEnd: header.LOOPAT1 + header.LLNGTH1,
          onProgress: onUploadProgress,
        });
        setSdsLoadingState(SDS_LOADING_IDLE);
        client.invalidateSampleCache();
      } else if (target === 'device-new') {
        const newName = pendingSampleName.substring(0, 8) + ' EDT';
        setSdsLoadingState({ open: true, sampleName: newName, direction: 'upload', progress: null, startTime: Date.now(), cancelled: false });
        const existingNames = await client.fetchSampleNames();
        const newSlot = existingNames.length;
        await client.sendSampleViaSds(newSlot, samples, sampleRate, {
          name: newName,
          onProgress: onUploadProgress,
        });
        setSdsLoadingState(SDS_LOADING_IDLE);
        client.invalidateSampleCache();
      } else if (target === 'library') {
        // Delegate to the core library save handler
        // Re-set the sampleEditor origin to trigger the library path
        core.handleSampleEditorSave(samples, sampleRate);
      }
    } catch (err) {
      errorReporter.report(err instanceof Error ? err.message : 'Failed to save sample');
    }
  }, [saveTargetState, client, core, errorReporter]);

  const handleSaveTargetCancel = useCallback(() => {
    setSaveTargetState(SAVE_TARGET_IDLE);
  }, []);

  // ---------------------------------------------------------------------------
  // Device-aware chopper save
  // ---------------------------------------------------------------------------

  const handleChopperSave = useCallback(async (payload: ChopperSavePayload) => {
    const origin = core.chopper?.origin;

    if (origin?.type === 'device-sample' && client) {
      // Upload each slice as a new device sample, then create a program
      try {
        const { sourceAudio, slices, name: programName } = payload;
        const existingNames = await client.fetchSampleNames();
        let nextSlot = existingNames.length;
        const sliceSampleNames: string[] = [];

        for (const slice of slices) {
          const sliceData = sourceAudio.samples.slice(slice.startSample, slice.endSample);
          const sliceName = slice.label.substring(0, 12).trim();
          await client.sendSampleViaSds(nextSlot, sliceData, sourceAudio.sampleRate, {
            name: sliceName,
          });
          sliceSampleNames.push(sliceName);
          nextSlot++;
        }

        // Create a program with keygroups mapping each slice to a note
        const baseNote = kitConfig.baseNote;
        const existingPrograms = await client.fetchProgramNames();
        const programIndex = existingPrograms.length;

        const programHeader = await client.fetchProgramHeader(0);
        const newHeader = { ...programHeader, raw: [...programHeader.raw] };
        s3k.ProgramHeader_writePRNAME(newHeader, programName.substring(0, 12));
        await client.createProgram(programIndex, newHeader);

        // Write keygroups
        for (let i = 0; i < sliceSampleNames.length; i++) {
          if (i > 0) {
            await client.createKeygroup(programIndex, i);
          }
          const kg = await client.fetchKeygroupHeader(programIndex, i);
          const updated = { ...kg, raw: [...kg.raw] };
          const note = baseNote + i;
          s3k.KeygroupHeader_writeLONOTE(updated, note);
          s3k.KeygroupHeader_writeHINOTE(updated, note);
          s3k.KeygroupHeader_writeSNAME1(updated, sliceSampleNames[i].padEnd(12));
          await client.writeKeygroupHeader(updated);
        }

        client.invalidateSampleCache();
        client.invalidateProgramCache();
      } catch (err) {
        errorReporter.report(err instanceof Error ? err.message : 'Failed to create device drum kit');
      }
      return;
    }

    // Library origin — delegate to shared handler
    core.handleChopperSave(payload);
  }, [core, client, kitConfig, errorReporter]);

  return {
    ...core,
    handleLoopEditorSave,
    handleSampleEditorSave,
    handleChopperSave,
    kitConfig,
    setKitConfig,
    saveTargetState,
    handleSaveTargetConfirm,
    handleSaveTargetCancel,
    sdsLoadingState,
    handleSdsLoadingCancel: useCallback(() => {
      sdsAbortRef.current?.abort();
      sdsAbortRef.current = null;
      setSdsLoadingState(SDS_LOADING_IDLE);
    }, []),
  };
}
