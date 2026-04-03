/**
 * Hook managing state and handlers for the three editor dialogs:
 * Loop Editor, Sample Editor, and Sample Chopper.
 *
 * Loads audio from the common-area library, opens dialogs with parsed
 * WAV data, and saves results back. Device-agnostic — works with any
 * sample stored in the common area.
 */

import { useState, useCallback } from 'react';
import { stringify as stringifyYaml } from 'yaml';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import {
  loadSample,
  loadSampleMeta,
  saveSample,
  parseWav,
  createWav,
  getNestedDirectory,
  sanitizeForFilename,
  type SampleYaml,
} from '@audiocontrol/sampler-library/browser';
import type { ChopperSavePayload } from '@audiocontrol/sample-chopper/ui';

// =========================================================================
// State types
// =========================================================================

interface EditorDialogBase {
  open: boolean;
  samples: Int16Array | null;
  sampleRate: number;
  sampleName: string;
  origin: { name: string; type: string; path?: string[] } | null;
}

interface LoopEditorDialogState extends EditorDialogBase {
  loopStart?: number;
  loopEnd?: number;
  rootKey?: number;
}

type SampleEditorDialogState = EditorDialogBase;
type ChopperDialogState = EditorDialogBase;

export interface EditorDialogsResult {
  loopEditor: LoopEditorDialogState | null;
  sampleEditor: SampleEditorDialogState | null;
  chopper: ChopperDialogState | null;
  handleOpenInLoopEditor: (name: string, type: string, path?: string[]) => void;
  handleOpenInSampleEditor: (name: string, type: string, path?: string[]) => void;
  handleOpenInChopper: (name: string, type: string, path?: string[]) => void;
  handleLoopEditorSave: (loopStart: number, loopEnd: number) => Promise<void>;
  handleSampleEditorSave: (samples: Int16Array, sampleRate: number) => Promise<void>;
  handleChopperSave: (payload: ChopperSavePayload) => Promise<void>;
  closeLoopEditor: () => void;
  closeSampleEditor: () => void;
  closeChopper: () => void;
}

// =========================================================================
// Hook
// =========================================================================

export function useEditorDialogs(
  libraryRoot: StorageDirectoryHandle | null,
  onRefresh: () => void,
  onError: (message: string) => void,
): EditorDialogsResult {
  const [loopEditor, setLoopEditor] = useState<LoopEditorDialogState | null>(null);
  const [sampleEditor, setSampleEditor] = useState<SampleEditorDialogState | null>(null);
  const [chopper, setChopper] = useState<ChopperDialogState | null>(null);

  // ---------------------------------------------------------------------------
  // Open handlers — load WAV data from library, parse, and set dialog state
  // ---------------------------------------------------------------------------

  const handleOpenInLoopEditor = useCallback(
    async (name: string, nodeType: string, path?: string[]) => {
      if (!libraryRoot) return;
      try {
        if (nodeType !== 'sample' && nodeType !== 'chopped-sample') {
          throw new Error(`Unsupported node type for loop editor: ${nodeType}`);
        }
        const result = await loadSample(libraryRoot, name, path);
        const wav = parseWav(result.wavData);
        setLoopEditor({
          open: true,
          samples: wav.samples,
          sampleRate: wav.sampleRate,
          sampleName: name,
          loopStart: result.yaml.loopStart ?? undefined,
          loopEnd: result.yaml.loopEnd ?? undefined,
          rootKey: typeof result.yaml.rootKey === 'number' ? result.yaml.rootKey : undefined,
          origin: { name, type: nodeType, path },
        });
      } catch (err) {
        console.error('[useEditorDialogs] Failed to load WAV for loop editor:', err);
        onError(err instanceof Error ? err.message : 'Failed to load sample');
      }
    },
    [libraryRoot, onError],
  );

  const handleOpenInSampleEditor = useCallback(
    async (name: string, nodeType: string, path?: string[]) => {
      if (!libraryRoot) return;
      try {
        if (nodeType !== 'sample' && nodeType !== 'chopped-sample') {
          throw new Error(`Unsupported node type for sample editor: ${nodeType}`);
        }
        const result = await loadSample(libraryRoot, name, path);
        const wav = parseWav(result.wavData);
        setSampleEditor({
          open: true,
          samples: wav.samples,
          sampleRate: wav.sampleRate,
          sampleName: name,
          origin: { name, type: nodeType, path },
        });
      } catch (err) {
        console.error('[useEditorDialogs] Failed to load WAV for sample editor:', err);
        onError(err instanceof Error ? err.message : 'Failed to load sample');
      }
    },
    [libraryRoot, onError],
  );

  const handleOpenInChopper = useCallback(
    async (name: string, nodeType: string, path?: string[]) => {
      if (!libraryRoot) return;
      try {
        if (nodeType !== 'sample' && nodeType !== 'chopped-sample') {
          throw new Error(`Unsupported node type for chopper: ${nodeType}`);
        }
        const result = await loadSample(libraryRoot, name, path);
        const wav = parseWav(result.wavData);
        setChopper({
          open: true,
          samples: wav.samples,
          sampleRate: wav.sampleRate,
          sampleName: name,
          origin: { name, type: nodeType, path },
        });
      } catch (err) {
        console.error('[useEditorDialogs] Failed to load WAV for chopper:', err);
        onError(err instanceof Error ? err.message : 'Failed to load sample');
      }
    },
    [libraryRoot, onError],
  );

  // ---------------------------------------------------------------------------
  // Save handlers
  // ---------------------------------------------------------------------------

  const handleLoopEditorSave = useCallback(
    async (loopStart: number, loopEnd: number) => {
      if (!loopEditor?.origin || !libraryRoot) return;
      const { name, path } = loopEditor.origin;

      try {
        const yaml = await loadSampleMeta(libraryRoot, name, path ? [...path] : []);
        yaml.loopStart = loopStart;
        yaml.loopEnd = loopEnd;
        yaml.loopMode = 'forward';
        yaml.modifiedAt = new Date().toISOString();

        const fullPath = ['library', 'common', 'samples', ...(path ?? [])];
        const safeName = sanitizeForFilename(name);
        const samplesDir = await getNestedDirectory(libraryRoot, fullPath);
        const sampleDir = await samplesDir.getDirectoryHandle(safeName);
        const yamlHandle = await sampleDir.getFileHandle('sample.yaml', { create: true });
        const writable = await yamlHandle.createWritable();
        await writable.write(stringifyYaml(yaml, { indent: 2, lineWidth: 120 }));
        await writable.close();
      } catch (err) {
        console.error('[useEditorDialogs] Failed to save loop points:', err);
        onError(err instanceof Error ? err.message : 'Failed to save loop points');
      }
    },
    [loopEditor, libraryRoot, onError],
  );

  const handleSampleEditorSave = useCallback(
    async (samples: Int16Array, sampleRate: number) => {
      if (!sampleEditor?.origin || !libraryRoot) return;
      const { name, path } = sampleEditor.origin;

      try {
        const existingMeta = await loadSampleMeta(libraryRoot, name, path ?? []);
        existingMeta.sampleRate = sampleRate;
        existingMeta.modifiedAt = new Date().toISOString();

        const wavData = createWav(samples, sampleRate);
        await saveSample(libraryRoot, { name, yaml: existingMeta, wavData }, path ?? []);
        onRefresh();
      } catch (err) {
        console.error('[useEditorDialogs] Failed to save edited sample:', err);
        onError(err instanceof Error ? err.message : 'Failed to save edited sample');
      }
    },
    [sampleEditor, libraryRoot, onRefresh, onError],
  );

  const handleChopperSave = useCallback(
    async (payload: ChopperSavePayload) => {
      if (!chopper?.origin || !libraryRoot) return;

      const yaml: SampleYaml = {
        format: 'sample',
        version: 1,
        name: payload.name,
        file: 'sample.wav',
        sampleRate: payload.sourceAudio.sampleRate,
        slices: payload.slices.map((s) => ({
          label: s.label,
          startSample: s.startSample,
          endSample: s.endSample,
        })),
        triggers: payload.triggers,
        playback: payload.playbackConfig,
        modifiedAt: new Date().toISOString(),
      };

      const wavData = createWav(payload.sourceAudio.samples, payload.sourceAudio.sampleRate);
      const savePath = chopper.origin.path ?? [];

      try {
        await saveSample(libraryRoot, { name: payload.name, yaml, wavData }, savePath);
        onRefresh();
      } catch (err) {
        console.error('[useEditorDialogs] Failed to save chopped sample:', err);
        onError(err instanceof Error ? err.message : 'Failed to save chopped sample');
      }
    },
    [chopper, libraryRoot, onRefresh, onError],
  );

  // ---------------------------------------------------------------------------
  // Close handlers
  // ---------------------------------------------------------------------------

  const closeLoopEditor = useCallback(() => setLoopEditor(null), []);
  const closeSampleEditor = useCallback(() => setSampleEditor(null), []);
  const closeChopper = useCallback(() => setChopper(null), []);

  return {
    loopEditor,
    sampleEditor,
    chopper,
    handleOpenInLoopEditor,
    handleOpenInSampleEditor,
    handleOpenInChopper,
    handleLoopEditorSave,
    handleSampleEditorSave,
    handleChopperSave,
    closeLoopEditor,
    closeSampleEditor,
    closeChopper,
  };
}
