/**
 * S3K editor dialog hook — wraps the shared useEditorDialogsCore
 * with S3K-specific behavior:
 *
 * - Device sample loading via SDS (strategy pattern)
 * - Device save handlers: loop points → sample header, audio → SDS upload
 * - S3K kit config for chopper dialog
 *
 * When a sample was loaded from the device (origin.type === 'device-sample'),
 * saves go back to the device. Library-origin samples save to the common area
 * via the shared hook's default handlers.
 */

import { useState, useMemo, useCallback } from 'react';
import type { StorageDirectoryHandle, ProgramYaml } from '@audiocontrol/sampler-library/browser';
import {
  useEditorDialogsCore,
  type EditorDialogStrategy,
  type EditorDialogsCoreResult,
  type WavData,
  type ErrorReporter,
} from '@audiocontrol/editor-core';
import * as s3k from '@audiocontrol/sampler-devices/s3k';
import type { S3000xlClientInterface } from '@audiocontrol/sampler-devices/s3k';
import {
  DEFAULT_S3K_KIT_CONFIG,
  type S3kKitConfig,
} from '@/components/library/S3kKitOutputConfig';

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

/** Extract the device sample index from a device-sample origin name. */
function parseDeviceSampleIndex(name: string): number | null {
  const indexStr = name.split(':')[1];
  if (indexStr === undefined) return null;
  const idx = parseInt(indexStr, 10);
  return isNaN(idx) ? null : idx;
}

// =========================================================================
// Result interface
// =========================================================================

export interface EditorDialogsResult extends EditorDialogsCoreResult {
  kitConfig: S3kKitConfig;
  setKitConfig: (config: S3kKitConfig) => void;
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

  // S3K strategy: loads device samples via SDS when nodeType is 'device-sample',
  // falls back to common-area loading for library items.
  const strategy = useMemo<EditorDialogStrategy>(() => ({
    loadWav: async (
      _root: StorageDirectoryHandle,
      name: string,
      nodeType: string,
    ): Promise<WavData | null> => {
      if (nodeType !== 'device-sample' || !client) return null;

      const sampleIndex = parseDeviceSampleIndex(name);
      if (sampleIndex === null) return null;

      const { header: sdsHeader, samples } = await client.receiveSampleViaSds(sampleIndex);
      const sampleRate = Math.round(1_000_000_000 / sdsHeader.samplePeriodNs);
      const sampleHeader = await client.fetchSampleHeader(sampleIndex);

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
  // Device-aware save handlers
  // ---------------------------------------------------------------------------

  /** Save loop points to device sample header (fast — no SDS re-upload). */
  const handleLoopEditorSave = useCallback(async (loopStart: number, loopEnd: number) => {
    const origin = core.loopEditor?.origin;
    if (!origin) return;

    if (origin.type === 'device-sample' && client) {
      const sampleIndex = parseDeviceSampleIndex(origin.name);
      if (sampleIndex === null) return;

      try {
        const header = await client.fetchSampleHeader(sampleIndex);
        const updated = { ...header, raw: [...header.raw] };

        // Write loop 1 start and length
        s3k.SampleHeader_writeLOOPAT1(updated, loopStart);
        updated.LOOPAT1 = loopStart;
        const loopLength = Math.max(0, loopEnd - loopStart);
        s3k.SampleHeader_writeLLNGTH1(updated, loopLength);
        updated.LLNGTH1 = loopLength;

        // Set loop count to 1 if it was 0
        if (updated.SLOOPS === 0) {
          s3k.SampleHeader_writeSLOOPS(updated, 1);
          updated.SLOOPS = 1;
        }

        // Set playback mode to looping if it was no-loop
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

    // Library origin — delegate to shared handler
    core.handleLoopEditorSave(loopStart, loopEnd);
  }, [core, client, errorReporter]);

  /** Save edited audio to device via SDS (overwrites original slot). */
  const handleSampleEditorSave = useCallback(async (samples: Int16Array, sampleRate: number) => {
    const origin = core.sampleEditor?.origin;
    if (!origin) return;

    if (origin.type === 'device-sample' && client) {
      const sampleIndex = parseDeviceSampleIndex(origin.name);
      if (sampleIndex === null) return;

      try {
        // Read the original sample header for loop/name metadata
        const header = await client.fetchSampleHeader(sampleIndex);
        const sampleName = header.SHNAME.trim();

        // Upload modified audio via SDS, overwriting the original slot
        await client.sendSampleViaSds(sampleIndex, samples, sampleRate, {
          name: sampleName,
          loopStart: header.LOOPAT1,
          loopEnd: header.LOOPAT1 + header.LLNGTH1,
        });

        client.invalidateSampleCache();
      } catch (err) {
        errorReporter.report(err instanceof Error ? err.message : 'Failed to save sample to device');
      }
      return;
    }

    // Library origin — delegate to shared handler
    core.handleSampleEditorSave(samples, sampleRate);
  }, [core, client, errorReporter]);

  return {
    ...core,
    handleLoopEditorSave,
    handleSampleEditorSave,
    kitConfig,
    setKitConfig,
  };
}
