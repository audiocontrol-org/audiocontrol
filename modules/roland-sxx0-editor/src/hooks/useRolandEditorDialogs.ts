/**
 * Roland editor dialog hook — wraps the shared useEditorDialogsCore
 * with Roland-specific WAV loading for tones.
 *
 * The shared hook provides the full complement of common-area editing
 * tools. This wrapper adds:
 * - Tone WAV loading from library/s330/tones/ (device-specific Zone 3)
 *
 * All editing operations save to the common area (Zone 4).
 * Editing a Roland tone promotes the result to the common area.
 */

import { useMemo } from 'react';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import {
  useEditorDialogsCore,
  type EditorDialogStrategy,
  type ErrorReporter,
  type WavData,
  type EditorDialogsCoreResult,
} from '@audiocontrol/editor-core';
import {
  loadIndividualTone, loadIndividualToneWavSamples,
} from '@/lib/library-service';

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

export interface RolandEditorDialogsResult extends EditorDialogsCoreResult {
}

// =========================================================================
// Hook
// =========================================================================

interface UseRolandEditorDialogsOptions {
  libraryHandle: StorageDirectoryHandle | null;
  selection: { type: string; name?: string; path?: string[] } | null;
  setLoading: (loading: boolean, message?: string) => void;
  errorReporter: ErrorReporter;
  onRefresh: () => Promise<void>;
}

export function useRolandEditorDialogs({
  libraryHandle,
  errorReporter,
  onRefresh,
}: UseRolandEditorDialogsOptions): RolandEditorDialogsResult {

  // Roland strategy: loads tone WAV from device-specific library
  const strategy = useMemo<EditorDialogStrategy>(() => ({
    loadWav: async (
      root: StorageDirectoryHandle,
      name: string,
      nodeType: string,
      path?: string[],
    ): Promise<WavData | null> => {
      if (nodeType === 'tone' || nodeType === 'individualTone') {
        const [wavResult, toneResult] = await Promise.all([
          loadIndividualToneWavSamples(root, name, path ?? []),
          loadIndividualTone(root, name, path ?? []),
        ]);
        return {
          samples: wavResult.samples,
          sampleRate: wavResult.sampleRate,
          loopStart: toneResult.yaml.wave.loopPoint,
          loopEnd: toneResult.yaml.wave.endPoint,
          rootKey: toneResult.yaml.s330?.originalKey ?? toneResult.yaml.s550?.originalKey,
        };
      }
      return null; // common-area fallback
    },
  }), []);

  const core = useEditorDialogsCore(libraryHandle, strategy, onRefresh, errorReporter);

  return {
    ...core,
  };
}
