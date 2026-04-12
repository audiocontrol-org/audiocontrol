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
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import {
  useEditorDialogsCore,
  type EditorDialogStrategy,
  type EditorDialogsCoreResult,
} from '@audiocontrol/editor-core';
import type { SampleYaml, ProgramYaml } from '@audiocontrol/sampler-library/browser';
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
  onError: (message: string) => void,
): EditorDialogsResult {
  const [kitConfig, setKitConfig] = useState<S3kKitConfig>(DEFAULT_S3K_KIT_CONFIG);

  // S3K strategy: common-area only loading (no device-specific paths yet),
  // but injects drum kit metadata into chopper saves.
  const strategy = useMemo<EditorDialogStrategy>(() => ({
    loadWav: async () => null, // all common-area — shared hook handles it

    /** @deprecated Use transformChopperProgram instead. */
    transformChopperYaml: (yaml: SampleYaml): SampleYaml => ({
      ...yaml,
      name: kitConfig.name || yaml.name,
      drumKit: {
        baseNote: kitConfig.baseNote,
        transpose: kitConfig.transpose !== 0 ? kitConfig.transpose : undefined,
        velocitySensitivity: kitConfig.velocitySensitivity,
      },
    }),

    transformChopperProgram: (program: ProgramYaml): ProgramYaml => ({
      ...program,
      name: kitConfig.name || program.name,
      zones: program.zones.map((zone, i) => ({
        ...zone,
        keyRange: [kitConfig.baseNote + i, kitConfig.baseNote + i] as [number, number],
        transpose: kitConfig.transpose !== 0 ? kitConfig.transpose : undefined,
      })),
    }),
  }), [kitConfig]);

  const core = useEditorDialogsCore(libraryRoot, strategy, onRefresh, onError);

  return {
    ...core,
    kitConfig,
    setKitConfig,
  };
}
