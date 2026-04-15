/**
 * S3K editor dialog hook — wraps the shared useEditorDialogsCore
 * with S3K-specific kit configuration for the chopper dialog.
 *
 * The shared hook provides the full complement of common-area editing
 * tools. This wrapper adds:
 * - S3K kit config state (baseNote, transpose, velocitySensitivity)
 * - Chopper program transform to inject drum kit key mappings
 *
 * All editing operations save to the common area (Zone 4).
 */

import { useState, useMemo } from 'react';
import type { StorageDirectoryHandle, ProgramYaml } from '@audiocontrol/sampler-library/browser';
import {
  useEditorDialogsCore,
  type EditorDialogStrategy,
  type EditorDialogsCoreResult,
  type WavData,
  type ErrorReporter,
} from '@audiocontrol/editor-core';
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

      // Parse sample index from name format "device-sample:N"
      const indexStr = name.split(':')[1];
      if (indexStr === undefined) return null;
      const sampleIndex = parseInt(indexStr, 10);
      if (isNaN(sampleIndex)) return null;

      // Download sample audio data from device via SDS
      const { header: sdsHeader, samples } = await client.receiveSampleViaSds(sampleIndex);
      const sampleRate = Math.round(1_000_000_000 / sdsHeader.samplePeriodNs);

      // Read sample header for loop/root key metadata
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

  return {
    ...core,
    kitConfig,
    setKitConfig,
  };
}
