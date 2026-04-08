/**
 * Roland editor dialog hook — wraps the shared useEditorDialogsCore
 * with Roland-specific WAV loading for tones and drum kit sources.
 *
 * The shared hook provides the full complement of common-area editing
 * tools. This wrapper adds:
 * - Tone WAV loading from library/s330/tones/ (device-specific Zone 3)
 * - Drum kit slice editing (source loading + slice update)
 * - Drum kit source → sample editor transition
 *
 * All editing operations save to the common area (Zone 4).
 * Editing a Roland tone promotes the result to the common area.
 */

import { useCallback, useMemo } from 'react';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import {
  useEditorDialogsCore,
  type EditorDialogStrategy,
  type WavData,
  type EditorDialogsCoreResult,
} from '@audiocontrol/editor-core';
import {
  loadDrumKitBundle, loadDrumKitSource, updateDrumKitSlices,
  loadIndividualTone, loadIndividualToneWavSamples,
} from '@/lib/library-service';
import type { ResolvedDrumKitBundle } from '@audiocontrol/sampler-library/browser';
import type { SliceDefinitionOutput } from '@audiocontrol/sample-chopper/ui';

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
  handleEditKit: () => Promise<void>;
  handleOpenDrumKitInSampleEditor: () => Promise<void>;
  handleSlicesUpdated: (
    slices: SliceDefinitionOutput[],
    kitConfig: { transpose?: number; velocitySensitivity?: number },
  ) => Promise<void>;
  handleOpenSliceEditorFromSampleEditor: () => void;
}

// =========================================================================
// Hook
// =========================================================================

interface UseRolandEditorDialogsOptions {
  libraryHandle: StorageDirectoryHandle | null;
  selection: { type: string; name?: string; path?: string[] } | null;
  selectedDrumKitBundle: ResolvedDrumKitBundle | null;
  setSelectedDrumKitBundle: (bundle: ResolvedDrumKitBundle | null) => void;
  setLoading: (loading: boolean, message?: string) => void;
  onError: (message: string) => void;
  onRefresh: () => Promise<void>;
}

export function useRolandEditorDialogs({
  libraryHandle,
  selection,
  selectedDrumKitBundle,
  setSelectedDrumKitBundle,
  setLoading,
  onError,
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

  const core = useEditorDialogsCore(libraryHandle, strategy, onRefresh, onError);

  // ---------------------------------------------------------------------------
  // Drum kit slice editing (Roland-specific — uses device-specific kit paths)
  // ---------------------------------------------------------------------------

  const handleEditKit = useCallback(async () => {
    if (!libraryHandle || !selection || selection.type !== 'drumKit' || !selectedDrumKitBundle) return;
    const bundle = selectedDrumKitBundle;
    if (!bundle.source || !bundle.slices) {
      onError('Cannot edit kit: not v2 format');
      return;
    }
    setLoading(true, 'Loading source audio...');
    try {
      const sourceWav = await loadDrumKitSource(libraryHandle, selection.name!, bundle.source, selection.path);
      core.setSliceEditDialog({
        open: true, kitName: selection.name!, path: selection.path,
        samples: sourceWav.samples, sampleRate: sourceWav.sampleRate,
        slices: bundle.slices.map((s) => ({ label: s.label, startSample: s.startSample, endSample: s.endSample })),
        kitConfig: {
          name: bundle.name, sampleRate: bundle.sampleRate, baseNote: bundle.baseNote,
          transpose: bundle.transpose, velocitySensitivity: bundle.velocitySensitivity,
        },
      });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load source audio');
    } finally {
      setLoading(false);
    }
  }, [libraryHandle, selection, selectedDrumKitBundle, setLoading, onError, core]);

  const handleOpenDrumKitInSampleEditor = useCallback(async () => {
    if (!libraryHandle || !selection || selection.type !== 'drumKit' || !selectedDrumKitBundle) return;
    const bundle = selectedDrumKitBundle;
    if (!bundle.source) return;
    setLoading(true, 'Loading source audio...');
    try {
      const sourceWav = await loadDrumKitSource(libraryHandle, selection.name!, bundle.source, selection.path);
      core.setSampleEditor({
        open: true,
        samples: sourceWav.samples,
        sampleRate: sourceWav.sampleRate,
        sampleName: bundle.name || selection.name!,
        origin: { name: selection.name!, type: 'drumKit', path: selection.path },
      });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load source audio');
    } finally {
      setLoading(false);
    }
  }, [libraryHandle, selection, selectedDrumKitBundle, setLoading, onError, core]);

  const handleSlicesUpdated = useCallback(async (
    slices: SliceDefinitionOutput[],
    kitConfig: { transpose?: number; velocitySensitivity?: number },
  ) => {
    if (!libraryHandle || !core.sliceEditDialog) return;
    setLoading(true, 'Saving slice changes...');
    try {
      await updateDrumKitSlices(libraryHandle, core.sliceEditDialog.kitName, slices, kitConfig, core.sliceEditDialog.path);
      setSelectedDrumKitBundle(
        await loadDrumKitBundle(libraryHandle, core.sliceEditDialog.kitName, core.sliceEditDialog.path),
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save slices');
    } finally {
      setLoading(false);
      core.setSliceEditDialog(null);
    }
  }, [libraryHandle, core, setLoading, onError, setSelectedDrumKitBundle]);

  const handleOpenSliceEditorFromSampleEditor = useCallback(() => {
    const dialog = core.sliceEditDialog;
    if (!dialog) return;
    core.setSliceEditDialog(null);
    core.setSampleEditor({
      open: true,
      samples: dialog.samples,
      sampleRate: dialog.sampleRate,
      sampleName: dialog.kitName,
      origin: { name: dialog.kitName, type: 'drumKit', path: dialog.path },
    });
  }, [core]);

  return {
    ...core,
    handleEditKit,
    handleOpenDrumKitInSampleEditor,
    handleSlicesUpdated,
    handleOpenSliceEditorFromSampleEditor,
  };
}
