/**
 * Shared editor dialog management for sampler library pages.
 *
 * Provides the full complement of common-area editing tools:
 * - Sample Editor (trim, normalize, fade, reverse)
 * - Loop Editor (edit loop points)
 * - Sample Chopper (slice samples into drum kits)
 * - Drum Kit Editor (edit kit metadata and per-pad config)
 * - Slice Edit Dialog (edit existing drum kit slices)
 *
 * Device-agnostic — loads WAV data from the common area by default.
 * Device-specific loading is handled by the EditorDialogStrategy
 * (e.g., loading Roland tones or S3K program samples).
 *
 * Editing a device-specific object saves to the common area (Zone 4).
 * This is an implicit promotion — editors produce vendor-agnostic output.
 */

import { useState, useCallback } from 'react';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import { stringify as stringifyYaml } from 'yaml';
import {
  loadSample,
  loadSampleMeta,
  saveSample,
  parseWav,
  createWav,
  getNestedDirectory,
  sanitizeForFilename,
  type SampleYaml,
  type TriggerMapping,
  type PlaybackConfig,
} from '@audiocontrol/sampler-library/browser';

// Types from sample-chopper/ui — declared locally to avoid adding
// sample-chopper as a dependency of editor-core.

export interface InitialSliceDefinition {
  label: string;
  startSample: number;
  endSample: number;
}

export interface ChopperSavePayload {
  name: string;
  sourceAudio: { samples: Int16Array; sampleRate: number };
  slices: Array<{ label: string; startSample: number; endSample: number }>;
  triggers?: TriggerMapping[];
  playbackConfig?: PlaybackConfig;
}

// =========================================================================
// WAV data type
// =========================================================================

export interface WavData {
  samples: Int16Array;
  sampleRate: number;
  loopStart?: number;
  loopEnd?: number;
  rootKey?: number;
}

// =========================================================================
// Strategy interface
// =========================================================================

/**
 * Device-specific strategy for loading WAV data from non-common-area sources.
 *
 * The shared hook tries the strategy first. If loadWav returns null, the hook
 * falls back to common-area loading. This lets editors support device-specific
 * node types (Roland tones, S3K programs) alongside common-area samples.
 */
export interface EditorDialogStrategy {
  /**
   * Load WAV data for a device-specific node type.
   * Return null if this strategy doesn't handle the given nodeType —
   * the shared hook will fall back to common-area loading.
   */
  loadWav(
    root: StorageDirectoryHandle,
    name: string,
    nodeType: string,
    path?: string[],
  ): Promise<WavData | null>;

  /**
   * Transform chopper save YAML before writing to common area.
   * Use to inject device-specific metadata (e.g., S3K drum kit config).
   * If not provided, the YAML is saved as-is.
   */
  transformChopperYaml?(yaml: SampleYaml): SampleYaml;
}

// =========================================================================
// Dialog state types
// =========================================================================

export interface EditorDialogBase {
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

export type SampleEditorDialogState = EditorDialogBase;

export type ChopperDialogState = EditorDialogBase & {
  initialSlices?: InitialSliceDefinition[];
  initialLabels?: string;
};

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

export interface DrumKitEditorDialogState {
  open: boolean;
  kitName: string;
  kitPath: string[];
}

// =========================================================================
// Result interface
// =========================================================================

export interface EditorDialogsCoreResult {
  // Dialog state
  loopEditor: LoopEditorDialogState | null;
  sampleEditor: SampleEditorDialogState | null;
  chopper: ChopperDialogState | null;
  sliceEditDialog: SliceEditDialogState | null;
  drumKitEditor: DrumKitEditorDialogState | null;

  // Open handlers
  handleOpenInLoopEditor: (name: string, nodeType: string, path?: string[]) => void;
  handleOpenInSampleEditor: (name: string, nodeType: string, path?: string[]) => void;
  handleOpenInChopper: (name: string, nodeType: string, path?: string[]) => void;
  handleOpenDrumKitEditor: (name: string, path?: string[]) => void;

  /**
   * Create a callback that dispatches editor action IDs to the appropriate
   * open handler. Use as the `onEditorAction` argument to `useLibraryOperations`.
   */
  createEditorActionHandler: () => (actionId: string, name: string, nodeType: string, path?: string[]) => void;

  // Save handlers
  handleLoopEditorSave: (loopStart: number, loopEnd: number) => Promise<void>;
  handleSampleEditorSave: (samples: Int16Array, sampleRate: number) => Promise<void>;
  handleChopperSave: (payload: ChopperSavePayload) => Promise<void>;

  // Slice edit dialog state setters (for per-editor drum kit handling)
  setSliceEditDialog: (state: SliceEditDialogState | null) => void;
  setSampleEditor: (state: SampleEditorDialogState | null) => void;

  // Close handlers
  closeLoopEditor: () => void;
  closeSampleEditor: () => void;
  closeChopper: () => void;
  closeSliceEditDialog: () => void;
  closeDrumKitEditor: () => void;
}

// =========================================================================
// Default (empty) strategy
// =========================================================================

const EMPTY_STRATEGY: EditorDialogStrategy = {
  loadWav: async () => null,
};

// =========================================================================
// Shared hook
// =========================================================================

export function useEditorDialogsCore(
  libraryRoot: StorageDirectoryHandle | null,
  strategy: EditorDialogStrategy = EMPTY_STRATEGY,
  onRefresh: () => void,
  onError: (message: string) => void,
): EditorDialogsCoreResult {
  const [loopEditor, setLoopEditor] = useState<LoopEditorDialogState | null>(null);
  const [sampleEditor, setSampleEditor] = useState<SampleEditorDialogState | null>(null);
  const [chopper, setChopper] = useState<ChopperDialogState | null>(null);
  const [sliceEditDialog, setSliceEditDialog] = useState<SliceEditDialogState | null>(null);
  const [drumKitEditor, setDrumKitEditor] = useState<DrumKitEditorDialogState | null>(null);

  // ---------------------------------------------------------------------------
  // WAV loading: strategy first, common-area fallback
  // ---------------------------------------------------------------------------

  const loadWavData = useCallback(async (
    name: string,
    nodeType: string,
    path?: string[],
  ): Promise<WavData> => {
    if (!libraryRoot) throw new Error('Library not connected');

    // Try device-specific strategy first
    const strategyResult = await strategy.loadWav(libraryRoot, name, nodeType, path);
    if (strategyResult) return strategyResult;

    // Common-area fallback for sample types (all share sample.yaml + sample.wav)
    if (nodeType === 'sample' || nodeType === 'chopped-sample' || nodeType === 'drum-kit') {
      const result = await loadSample(libraryRoot, name, path);
      const wav = parseWav(result.wavData);
      return {
        samples: wav.samples,
        sampleRate: wav.sampleRate,
        loopStart: result.yaml.loopStart ?? undefined,
        loopEnd: result.yaml.loopEnd ?? undefined,
        rootKey: typeof result.yaml.rootKey === 'number' ? result.yaml.rootKey : undefined,
      };
    }

    throw new Error(`Unsupported node type: ${nodeType}`);
  }, [libraryRoot, strategy]);

  // ---------------------------------------------------------------------------
  // Loop editor
  // ---------------------------------------------------------------------------

  const handleOpenInLoopEditor = useCallback(
    async (name: string, nodeType: string, path?: string[]) => {
      try {
        const wav = await loadWavData(name, nodeType, path);
        setLoopEditor({
          open: true, samples: wav.samples, sampleRate: wav.sampleRate,
          sampleName: name, loopStart: wav.loopStart, loopEnd: wav.loopEnd,
          rootKey: wav.rootKey,
          origin: { name, type: nodeType, path },
        });
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Failed to load sample');
      }
    },
    [loadWavData, onError],
  );

  const handleLoopEditorSave = useCallback(async (loopStart: number, loopEnd: number) => {
    if (!loopEditor?.origin || !libraryRoot) return;
    const { name, path } = loopEditor.origin;

    try {
      const yaml = await loadSampleMeta(libraryRoot, name, path ?? []);
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
      onError(err instanceof Error ? err.message : 'Failed to save loop points');
    }
  }, [loopEditor, libraryRoot, onError]);

  // ---------------------------------------------------------------------------
  // Sample editor
  // ---------------------------------------------------------------------------

  const handleOpenInSampleEditor = useCallback(
    async (name: string, nodeType: string, path?: string[]) => {
      try {
        const wav = await loadWavData(name, nodeType, path);
        setSampleEditor({
          open: true, samples: wav.samples, sampleRate: wav.sampleRate,
          sampleName: name,
          origin: { name, type: nodeType, path },
        });
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Failed to load sample');
      }
    },
    [loadWavData, onError],
  );

  const handleSampleEditorSave = useCallback(async (samples: Int16Array, sampleRate: number) => {
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
      onError(err instanceof Error ? err.message : 'Failed to save edited sample');
    }
  }, [sampleEditor, libraryRoot, onRefresh, onError]);

  // ---------------------------------------------------------------------------
  // Sample chopper
  // ---------------------------------------------------------------------------

  const handleOpenInChopper = useCallback(
    async (name: string, nodeType: string, path?: string[]) => {
      try {
        const wav = await loadWavData(name, nodeType, path);

        // Load existing slice definitions from sample metadata (if available)
        let initialSlices: InitialSliceDefinition[] | undefined;
        let initialLabels: string | undefined;
        if (libraryRoot && (nodeType === 'sample' || nodeType === 'chopped-sample' || nodeType === 'drum-kit')) {
          try {
            const meta = await loadSampleMeta(libraryRoot, name, path);
            if (meta.slices && meta.slices.length > 0) {
              initialSlices = meta.slices.map((s) => ({
                label: s.label, startSample: s.startSample, endSample: s.endSample,
              }));
              initialLabels = meta.slices.map((s) => s.label).join(',');
            }
          } catch {
            // No existing slices — that's fine
          }
        }

        setChopper({
          open: true, samples: wav.samples, sampleRate: wav.sampleRate,
          sampleName: name,
          origin: { name, type: nodeType, path },
          initialSlices, initialLabels,
        });
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Failed to load sample');
      }
    },
    [loadWavData, libraryRoot, onError],
  );

  const handleChopperSave = useCallback(async (payload: ChopperSavePayload) => {
    if (!libraryRoot || !chopper?.origin) return;

    let yaml: SampleYaml = {
      format: 'sample',
      version: 1,
      name: payload.name,
      file: 'sample.wav',
      sampleRate: payload.sourceAudio.sampleRate,
      slices: payload.slices.map((s) => ({
        label: s.label, startSample: s.startSample, endSample: s.endSample,
      })),
      triggers: payload.triggers,
      playback: payload.playbackConfig,
      modifiedAt: new Date().toISOString(),
    };

    // Let strategy add device-specific metadata (e.g., S3K drum kit config)
    if (strategy.transformChopperYaml) {
      yaml = strategy.transformChopperYaml(yaml);
    }

    const wavData = createWav(payload.sourceAudio.samples, payload.sourceAudio.sampleRate);
    const savePath = chopper.origin.path ?? [];

    try {
      await saveSample(libraryRoot, { name: payload.name, yaml, wavData }, savePath);
      onRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save chopped sample');
    }
  }, [libraryRoot, chopper, strategy, onRefresh, onError]);

  // ---------------------------------------------------------------------------
  // Drum kit editor (metadata/pad editing)
  // ---------------------------------------------------------------------------

  const handleOpenDrumKitEditor = useCallback(
    (name: string, path?: string[]) => {
      setDrumKitEditor({ open: true, kitName: name, kitPath: path ?? [] });
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Close handlers
  // ---------------------------------------------------------------------------

  const closeLoopEditor = useCallback(() => setLoopEditor(null), []);
  const closeSampleEditor = useCallback(() => setSampleEditor(null), []);
  const closeChopper = useCallback(() => setChopper(null), []);
  const closeSliceEditDialog = useCallback(() => setSliceEditDialog(null), []);
  const closeDrumKitEditor = useCallback(() => setDrumKitEditor(null), []);

  const createEditorActionHandler = useCallback(
    () => (actionId: string, name: string, nodeType: string, path?: string[]) => {
      if (actionId === 'open-loop-editor') handleOpenInLoopEditor(name, nodeType, path);
      else if (actionId === 'open-chopper') handleOpenInChopper(name, nodeType, path);
      else if (actionId === 'open-sample-editor') handleOpenInSampleEditor(name, nodeType, path);
    },
    [handleOpenInLoopEditor, handleOpenInChopper, handleOpenInSampleEditor],
  );

  return {
    loopEditor, sampleEditor, chopper, sliceEditDialog, drumKitEditor,
    handleOpenInLoopEditor, handleOpenInSampleEditor, handleOpenInChopper,
    handleOpenDrumKitEditor,
    createEditorActionHandler,
    handleLoopEditorSave, handleSampleEditorSave, handleChopperSave,
    setSliceEditDialog, setSampleEditor,
    closeLoopEditor, closeSampleEditor, closeChopper,
    closeSliceEditDialog, closeDrumKitEditor,
  };
}
