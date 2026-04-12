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
 * Device-agnostic -- loads WAV data from the common area by default.
 * Device-specific loading is handled by the EditorDialogStrategy
 * (e.g., loading Roland tones or S3K program samples).
 *
 * Editing a device-specific object saves to the common area (Zone 4).
 * This is an implicit promotion -- editors produce vendor-agnostic output.
 */

import { useState, useCallback } from 'react';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import { stringify as stringifyYaml } from 'yaml';
import {
  loadSample,
  loadSampleMeta,
  loadProgram,
  loadProgramMeta,
  saveSample,
  saveProgram,
  parseWav,
  createWav,
  getNestedDirectory,
  sanitizeForFilename,
  type ProgramYaml,
  type Zone,
  type TriggerMapping,
  type PlaybackConfig,
} from '@audiocontrol/sampler-library/browser';

// Types from sample-chopper/ui -- declared locally to avoid adding
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
   * Return null if this strategy doesn't handle the given nodeType --
   * the shared hook will fall back to common-area loading.
   */
  loadWav(
    root: StorageDirectoryHandle,
    name: string,
    nodeType: string,
    path?: string[],
  ): Promise<WavData | null>;
  /**
   * Transform the program built from chopper output before saving.
   * Use to inject device-specific zone metadata (e.g., S3K drum kit
   * key mappings, mute groups). If not provided, the program is saved as-is.
   */
  transformChopperProgram?(program: ProgramYaml): ProgramYaml;
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
  /** Node type being edited: 'sample' (legacy) or 'program'. */
  nodeType: string;
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
  handleOpenDrumKitEditor: (name: string, nodeType: string, path?: string[]) => void;

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

    // Common-area samples: sample.yaml + sample.wav
    if (nodeType === 'sample') {
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

    // Common-area programs: program.yaml + samples/*.wav
    if (nodeType === 'program') {
      const programResult = await loadProgram(libraryRoot, name);
      if (programResult.wavFiles.length === 0) {
        throw new Error(`Program "${name}" has no WAV files`);
      }
      const firstWav = programResult.wavFiles[0];
      const wav = parseWav(firstWav.data);
      return {
        samples: wav.samples,
        sampleRate: wav.sampleRate,
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

        let initialSlices: InitialSliceDefinition[] | undefined;
        let initialLabels: string | undefined;
        let chopperSampleName = name;

        if (libraryRoot && nodeType === 'sample') {
          // Load existing slice definitions from sample metadata (if available)
          try {
            const meta = await loadSampleMeta(libraryRoot, name, path);
            if (meta.slices && meta.slices.length > 0) {
              initialSlices = meta.slices.map((s) => ({
                label: s.label, startSample: s.startSample, endSample: s.endSample,
              }));
              initialLabels = meta.slices.map((s) => s.label).join(',');
            }
          } catch {
            // No existing slices -- that's fine
          }
        } else if (libraryRoot && nodeType === 'program') {
          // Programs: load zone labels but no slice boundaries (zones don't
          // store startSample/endSample). The chopper shows the waveform
          // and the user re-slices from scratch.
          try {
            const programMeta = await loadProgramMeta(libraryRoot, name);
            initialLabels = programMeta.zones.map((z) => z.label ?? '').filter(Boolean).join(',');
            chopperSampleName = programMeta.sourceInfo?.sampleName ?? name;
          } catch {
            // Failed to load program metadata -- open chopper without labels
          }
        }

        setChopper({
          open: true, samples: wav.samples, sampleRate: wav.sampleRate,
          sampleName: chopperSampleName,
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

    const sampleFilename = 'sample.wav';

    // Build zones from slices -- all zones reference the same WAV file
    const zones: Zone[] = payload.slices.map((s, i) => {
      const zone: Zone = {
        sample: sampleFilename,
        label: s.label,
      };
      // Assign mute groups from playback config if present
      if (payload.playbackConfig?.muteGroups) {
        const muteGroupValue = payload.playbackConfig.muteGroups[i];
        if (muteGroupValue !== undefined && muteGroupValue !== 0) {
          zone.muteGroup = muteGroupValue;
        }
      }
      return zone;
    });

    // Resolve source sample name: for programs, use the original source
    // sample name from the program's metadata; otherwise use the origin name.
    const sourceSampleName = chopper.origin.type === 'program'
      ? chopper.sampleName
      : chopper.origin.name;

    let program: ProgramYaml = {
      format: 'program',
      version: 1,
      name: payload.name,
      zones,
      polyphony: payload.playbackConfig?.polyphony,
      playbackMode: payload.playbackConfig?.playbackMode,
      sourceInfo: {
        sampleName: sourceSampleName,
      },
      modifiedAt: new Date().toISOString(),
    };

    // Let strategy add device-specific metadata (e.g., S3K drum kit key mappings)
    if (strategy.transformChopperProgram) {
      program = strategy.transformChopperProgram(program);
    }

    const wavData = createWav(payload.sourceAudio.samples, payload.sourceAudio.sampleRate);

    try {
      await saveProgram(libraryRoot, {
        name: payload.name,
        yaml: program,
        wavFiles: [{ filename: sampleFilename, data: wavData }],
      });
      onRefresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save chopped program');
    }
  }, [libraryRoot, chopper, strategy, onRefresh, onError]);

  // ---------------------------------------------------------------------------
  // Drum kit editor (metadata/pad editing)
  // ---------------------------------------------------------------------------

  const handleOpenDrumKitEditor = useCallback(
    (name: string, nodeType: string, path?: string[]) => {
      setDrumKitEditor({ open: true, kitName: name, kitPath: path ?? [], nodeType });
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
