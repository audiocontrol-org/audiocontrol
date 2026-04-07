/**
 * Hook managing state and handlers for the editor dialogs on the Library page:
 * Slice Edit (drum kit), Loop Editor, Sample Chopper, and Sample Editor.
 *
 * Loads audio from both device-specific (tones) and common-area (samples)
 * library sections, opens dialogs with parsed WAV data, and saves results back.
 *
 * Roland-specific: supports tone/individualTone and drumKit node types in
 * addition to common-area samples.
 */

import { useState, useCallback } from 'react';
import type { StorageDirectoryHandle } from '@/lib/library-service';
import {
  loadDrumKitBundle, loadDrumKitSource, saveDrumKitSource, updateDrumKitSlices,
  loadIndividualTone, loadIndividualToneWavSamples,
} from '@/lib/library-service';
import { parseWav } from '@/core/midi/S330Client';
import type { ResolvedDrumKitBundle } from '@audiocontrol/sampler-library/browser';
import {
  loadSample, loadSampleMeta, saveSample, createWav,
  getNestedDirectory, sanitizeForFilename,
  type SampleYaml,
} from '@audiocontrol/sampler-library/browser';
import { parseYaml, stringifyYaml } from '@/lib/library-io';
import type { InitialSliceDefinition, SliceDefinitionOutput, ChopperSavePayload } from '@audiocontrol/sample-chopper/ui';

// =========================================================================
// State types
// =========================================================================

export interface SliceEditDialogState {
  open: boolean;
  kitName: string;
  path?: string[];
  samples: Int16Array | null;
  sampleRate: number;
  slices: InitialSliceDefinition[];
  kitConfig: {
    name: string;
    sampleRate: 15000 | 30000;
    baseNote: number;
    transpose?: number;
    velocitySensitivity?: number;
  };
}

interface EditorDialogBase {
  open: boolean;
  samples: Int16Array | null;
  sampleRate: number;
  sampleName: string;
  origin: { name: string; type: string; path?: string[] } | null;
}

export interface LoopEditorDialogState extends EditorDialogBase {
  loopStart?: number;
  loopEnd?: number;
  rootKey?: number;
}

export type ChopperDialogState = EditorDialogBase & {
  initialSlices?: InitialSliceDefinition[];
  initialLabels?: string;
};

export type SampleEditorDialogState = EditorDialogBase;

// =========================================================================
// Result interface
// =========================================================================

export interface RolandEditorDialogsResult {
  sliceEditDialog: SliceEditDialogState | null;
  loopEditorDialog: LoopEditorDialogState | null;
  chopperDialog: ChopperDialogState | null;
  sampleEditorDialog: SampleEditorDialogState | null;

  handleEditKit: () => Promise<void>;
  handleOpenDrumKitInSampleEditor: () => Promise<void>;
  handleSlicesUpdated: (slices: SliceDefinitionOutput[], kitConfig: { transpose?: number; velocitySensitivity?: number }) => Promise<void>;
  handleOpenInLoopEditor: (name: string, nodeType: string, path?: string[]) => Promise<void>;
  handleOpenInChopper: (name: string, nodeType: string, path?: string[]) => Promise<void>;
  handleChopperSave: (payload: ChopperSavePayload) => Promise<void>;
  handleOpenInSampleEditor: (name: string, nodeType: string, path?: string[]) => Promise<void>;
  handleSampleEditorSave: (samples: Int16Array, sampleRate: number) => Promise<void>;
  handleLoopEditorSave: (loopStart: number, loopEnd: number) => Promise<void>;
  handleOpenSliceEditorFromSampleEditor: () => void;

  closeSliceEditDialog: () => void;
  closeLoopEditor: () => void;
  closeChopper: () => void;
  closeSampleEditor: () => void;
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
  const [sliceEditDialog, setSliceEditDialog] = useState<SliceEditDialogState | null>(null);
  const [loopEditorDialog, setLoopEditorDialog] = useState<LoopEditorDialogState | null>(null);
  const [chopperDialog, setChopperDialog] = useState<ChopperDialogState | null>(null);
  const [sampleEditorDialog, setSampleEditorDialog] = useState<SampleEditorDialogState | null>(null);

  // ---------------------------------------------------------------------------
  // Drum kit slice editing
  // ---------------------------------------------------------------------------

  const handleEditKit = useCallback(async () => {
    if (!libraryHandle || !selection || selection.type !== 'drumKit' || !selectedDrumKitBundle) return;
    const bundle = selectedDrumKitBundle;
    if (!bundle.source || !bundle.slices) {
      console.error('[useRolandEditorDialogs] Cannot edit kit: not v2 format');
      return;
    }
    setLoading(true, 'Loading source audio...');
    try {
      const sourceWav = await loadDrumKitSource(libraryHandle, selection.name!, bundle.source, selection.path);
      setSliceEditDialog({
        open: true, kitName: selection.name!, path: selection.path,
        samples: sourceWav.samples, sampleRate: sourceWav.sampleRate,
        slices: bundle.slices.map((s) => ({ label: s.label, startSample: s.startSample, endSample: s.endSample })),
        kitConfig: {
          name: bundle.name, sampleRate: bundle.sampleRate, baseNote: bundle.baseNote,
          transpose: bundle.transpose, velocitySensitivity: bundle.velocitySensitivity,
        },
      });
    } catch (err) {
      console.error('[useRolandEditorDialogs] Failed to load source audio:', err);
      onError(err instanceof Error ? err.message : 'Failed to load source audio');
    } finally {
      setLoading(false);
    }
  }, [libraryHandle, selection, selectedDrumKitBundle, setLoading, onError]);

  const handleOpenDrumKitInSampleEditor = useCallback(async () => {
    if (!libraryHandle || !selection || selection.type !== 'drumKit' || !selectedDrumKitBundle) return;
    const bundle = selectedDrumKitBundle;
    if (!bundle.source) return;

    setLoading(true, 'Loading source audio...');
    try {
      const sourceWav = await loadDrumKitSource(libraryHandle, selection.name!, bundle.source, selection.path);
      setSampleEditorDialog({
        open: true,
        samples: sourceWav.samples,
        sampleRate: sourceWav.sampleRate,
        sampleName: bundle.name || selection.name!,
        origin: { name: selection.name!, type: 'drumKit', path: selection.path },
      });
    } catch (err) {
      console.error('[useRolandEditorDialogs] Failed to load source audio for sample editor:', err);
      onError(err instanceof Error ? err.message : 'Failed to load source audio');
    } finally {
      setLoading(false);
    }
  }, [libraryHandle, selection, selectedDrumKitBundle, setLoading, onError]);

  const handleSlicesUpdated = useCallback(async (
    slices: SliceDefinitionOutput[],
    kitConfig: { transpose?: number; velocitySensitivity?: number },
  ) => {
    if (!libraryHandle || !sliceEditDialog) return;
    setLoading(true, 'Saving slice changes...');
    try {
      await updateDrumKitSlices(libraryHandle, sliceEditDialog.kitName, slices, kitConfig, sliceEditDialog.path);
      setSelectedDrumKitBundle(await loadDrumKitBundle(libraryHandle, sliceEditDialog.kitName, sliceEditDialog.path));
    } catch (err) {
      console.error('[useRolandEditorDialogs] Failed to update slices:', err);
      onError(err instanceof Error ? err.message : 'Failed to save slices');
    } finally {
      setLoading(false);
      setSliceEditDialog(null);
    }
  }, [libraryHandle, sliceEditDialog, setLoading, onError, setSelectedDrumKitBundle]);

  // Transition from slice editor to sample editor (keeping the audio data)
  const handleOpenSliceEditorFromSampleEditor = useCallback(() => {
    const dialog = sliceEditDialog;
    if (!dialog) return;
    setSliceEditDialog(null);
    setSampleEditorDialog({
      open: true,
      samples: dialog.samples,
      sampleRate: dialog.sampleRate,
      sampleName: dialog.kitName,
      origin: { name: dialog.kitName, type: 'drumKit', path: dialog.path },
    });
  }, [sliceEditDialog]);

  // ---------------------------------------------------------------------------
  // Loop editor
  // ---------------------------------------------------------------------------

  const handleOpenInLoopEditor = useCallback(async (name: string, nodeType: string, path?: string[]) => {
    if (!libraryHandle) return;
    try {
      let samples: Int16Array;
      let sampleRate: number;
      let loopStart: number | undefined;
      let loopEnd: number | undefined;
      let rootKey: number | undefined;

      if (nodeType === 'tone' || nodeType === 'individualTone') {
        const [wavResult, toneResult] = await Promise.all([
          loadIndividualToneWavSamples(libraryHandle, name, path ?? []),
          loadIndividualTone(libraryHandle, name, path ?? []),
        ]);
        samples = wavResult.samples;
        sampleRate = wavResult.sampleRate;
        loopStart = toneResult.yaml.wave.loopPoint;
        loopEnd = toneResult.yaml.wave.endPoint;
        rootKey = toneResult.yaml.s330?.originalKey ?? toneResult.yaml.s550?.originalKey;
      } else if (nodeType === 'sample') {
        const result = await loadSample(libraryHandle, name, path);
        const wav = parseWav(result.wavData);
        samples = wav.samples;
        sampleRate = wav.sampleRate;
        loopStart = result.yaml.loopStart;
        loopEnd = result.yaml.loopEnd;
        rootKey = typeof result.yaml.rootKey === 'number' ? result.yaml.rootKey : undefined;
      } else {
        throw new Error(`Unsupported node type for loop editor: ${nodeType}`);
      }

      setLoopEditorDialog({
        open: true, samples, sampleRate, sampleName: name,
        loopStart, loopEnd, rootKey,
        origin: { name, type: nodeType, path },
      });
    } catch (err) {
      console.error('[useRolandEditorDialogs] Failed to load WAV for loop editor:', err);
      onError(err instanceof Error ? err.message : 'Failed to load sample');
    }
  }, [libraryHandle, onError]);

  const handleLoopEditorSave = useCallback(async (loopStart: number, loopEnd: number) => {
    if (!loopEditorDialog?.origin || !libraryHandle) return;
    const { name, type: nodeType, path } = loopEditorDialog.origin;

    try {
      if (nodeType === 'sample') {
        const yaml = await loadSampleMeta(libraryHandle, name, path ?? []);
        yaml.loopStart = loopStart;
        yaml.loopEnd = loopEnd;
        yaml.loopMode = 'forward';
        yaml.modifiedAt = new Date().toISOString();

        const fullPath = ['library', 'common', 'samples', ...(path ?? [])];
        const safeName = sanitizeForFilename(name);
        const samplesDir = await getNestedDirectory(libraryHandle, fullPath);
        const sampleDir = await samplesDir.getDirectoryHandle(safeName);
        const yamlHandle = await sampleDir.getFileHandle('sample.yaml', { create: true });
        const writable = await yamlHandle.createWritable();
        await writable.write(stringifyYaml(yaml, { indent: 2, lineWidth: 120 }));
        await writable.close();
      } else if (nodeType === 'tone') {
        // Individual tone: update tone YAML's wave.loopPoint
        // All S-series devices share the s330 library section
        const fullPath = ['library', 's330', 'tones', ...(path ?? [])];
        const tonesDir = await getNestedDirectory(libraryHandle, fullPath);
        const toneHandle = await tonesDir.getFileHandle(`${name}.yaml`);
        const toneFile = await toneHandle.getFile();
        const yaml = parseYaml(await toneFile.text());
        if (yaml.wave) {
          yaml.wave.loopPoint = loopStart;
          yaml.wave.endPoint = loopEnd;
          yaml.wave.loopMode = 'forward';
        }
        const writable = await toneHandle.createWritable();
        await writable.write(stringifyYaml(yaml, { indent: 2, lineWidth: 120 }));
        await writable.close();
      }
    } catch (err) {
      console.error('[useRolandEditorDialogs] Failed to save loop points:', err);
      onError(err instanceof Error ? err.message : 'Failed to save loop points');
    }
  }, [loopEditorDialog, libraryHandle, onError]);

  // ---------------------------------------------------------------------------
  // Sample chopper
  // ---------------------------------------------------------------------------

  const handleOpenInChopper = useCallback(async (name: string, nodeType: string, path?: string[]) => {
    if (!libraryHandle) return;
    try {
      let samples: Int16Array;
      let sampleRate: number;

      if (nodeType === 'tone' || nodeType === 'individualTone') {
        const result = await loadIndividualToneWavSamples(libraryHandle, name, path ?? []);
        samples = result.samples;
        sampleRate = result.sampleRate;
      } else if (nodeType === 'sample') {
        const result = await loadSample(libraryHandle, name, path);
        const wav = parseWav(result.wavData);
        samples = wav.samples;
        sampleRate = wav.sampleRate;
      } else {
        throw new Error(`Unsupported node type for chopper: ${nodeType}`);
      }

      // Load existing slice definitions from sample metadata (if any)
      let initialSlices: InitialSliceDefinition[] | undefined;
      let initialLabels: string | undefined;
      if (nodeType === 'sample') {
        const meta = await loadSampleMeta(libraryHandle, name, path);
        if (meta.slices && meta.slices.length > 0) {
          initialSlices = meta.slices.map((s) => ({
            label: s.label,
            startSample: s.startSample,
            endSample: s.endSample,
          }));
          initialLabels = meta.slices.map((s) => s.label).join(',');
        }
      }

      setChopperDialog({
        open: true, samples, sampleRate, sampleName: name,
        origin: { name, type: nodeType, path },
        initialSlices,
        initialLabels,
      });
    } catch (err) {
      console.error('[useRolandEditorDialogs] Failed to load WAV for chopper:', err);
      onError(err instanceof Error ? err.message : 'Failed to load sample');
    }
  }, [libraryHandle, onError]);

  const handleChopperSave = useCallback(async (payload: ChopperSavePayload) => {
    if (!libraryHandle || !chopperDialog?.origin) return;

    const yaml: SampleYaml = {
      format: 'sample',
      version: 1,
      name: payload.name,
      file: 'sample.wav',
      sampleRate: payload.sourceAudio.sampleRate,
      slices: payload.slices.map((s) => ({ label: s.label, startSample: s.startSample, endSample: s.endSample })),
      triggers: payload.triggers,
      playback: payload.playbackConfig,
      modifiedAt: new Date().toISOString(),
    };

    const wavData = createWav(payload.sourceAudio.samples, payload.sourceAudio.sampleRate);
    const savePath = chopperDialog.origin.path ?? [];

    try {
      await saveSample(libraryHandle, { name: payload.name, yaml, wavData }, savePath);
      await onRefresh();
    } catch (err) {
      console.error('[useRolandEditorDialogs] Failed to save chopped sample:', err);
      onError(err instanceof Error ? err.message : 'Failed to save chopped sample');
    }
  }, [libraryHandle, chopperDialog, onRefresh, onError]);

  // ---------------------------------------------------------------------------
  // Sample editor
  // ---------------------------------------------------------------------------

  const handleOpenInSampleEditor = useCallback(async (name: string, nodeType: string, path?: string[]) => {
    if (!libraryHandle) return;
    try {
      let samples: Int16Array;
      let sampleRate: number;

      if (nodeType === 'tone' || nodeType === 'individualTone') {
        const result = await loadIndividualToneWavSamples(libraryHandle, name, path ?? []);
        samples = result.samples;
        sampleRate = result.sampleRate;
      } else if (nodeType === 'sample') {
        const result = await loadSample(libraryHandle, name, path);
        const wav = parseWav(result.wavData);
        samples = wav.samples;
        sampleRate = wav.sampleRate;
      } else {
        throw new Error(`Unsupported node type for sample editor: ${nodeType}`);
      }

      setSampleEditorDialog({
        open: true, samples, sampleRate, sampleName: name,
        origin: { name, type: nodeType, path },
      });
    } catch (err) {
      console.error('[useRolandEditorDialogs] Failed to load WAV for sample editor:', err);
      onError(err instanceof Error ? err.message : 'Failed to load sample');
    }
  }, [libraryHandle, onError]);

  const handleSampleEditorSave = useCallback(async (samples: Int16Array, sampleRate: number) => {
    if (!libraryHandle || !sampleEditorDialog?.origin) return;
    const { name, type: nodeType, path } = sampleEditorDialog.origin;

    try {
      if (nodeType === 'sample') {
        const existingMeta = await loadSampleMeta(libraryHandle, name, path ?? []);
        existingMeta.sampleRate = sampleRate;
        existingMeta.modifiedAt = new Date().toISOString();

        const wavData = createWav(samples, sampleRate);
        await saveSample(libraryHandle, { name, yaml: existingMeta, wavData }, path ?? []);
      } else if (nodeType === 'tone' || nodeType === 'individualTone') {
        const wavData = createWav(samples, sampleRate);
        const fullPath = ['library', 's330', 'tones', ...(path ?? [])];
        const tonesDir = await getNestedDirectory(libraryHandle, fullPath);
        const wavHandle = await tonesDir.getFileHandle(`${name}.wav`, { create: true });
        const writable = await wavHandle.createWritable();
        await writable.write(wavData);
        await writable.close();
      } else if (nodeType === 'drumKit') {
        const bundle = selectedDrumKitBundle;
        if (!bundle?.source) throw new Error('Cannot save: drum kit has no source file');
        await saveDrumKitSource(libraryHandle, name, bundle.source, samples, sampleRate, path);
      }
      await onRefresh();
    } catch (err) {
      console.error('[useRolandEditorDialogs] Failed to save edited sample:', err);
      onError(err instanceof Error ? err.message : 'Failed to save edited sample');
    }
  }, [libraryHandle, sampleEditorDialog, selectedDrumKitBundle, onRefresh, onError]);

  // ---------------------------------------------------------------------------
  // Close handlers
  // ---------------------------------------------------------------------------

  const closeSliceEditDialog = useCallback(() => setSliceEditDialog(null), []);
  const closeLoopEditor = useCallback(() => setLoopEditorDialog(null), []);
  const closeChopper = useCallback(() => setChopperDialog(null), []);
  const closeSampleEditor = useCallback(() => setSampleEditorDialog(null), []);

  return {
    sliceEditDialog,
    loopEditorDialog,
    chopperDialog,
    sampleEditorDialog,
    handleEditKit,
    handleOpenDrumKitInSampleEditor,
    handleSlicesUpdated,
    handleOpenInLoopEditor,
    handleOpenInChopper,
    handleChopperSave,
    handleOpenInSampleEditor,
    handleSampleEditorSave,
    handleLoopEditorSave,
    handleOpenSliceEditorFromSampleEditor,
    closeSliceEditDialog,
    closeLoopEditor,
    closeChopper,
    closeSampleEditor,
  };
}
