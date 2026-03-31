import { useCallback } from 'react';
import type { S3000xlClientInterface } from '@audiocontrol/sampler-devices/s3k';
import { useProgramStore } from '@/stores/programStore';
import { useEditorStore } from '@/stores/editorStore';

interface UseProgramLoaderResult {
  /** Fetch all program names from the device */
  loadProgramNames(): Promise<void>;
  /** Fetch a single program header by index */
  loadProgram(index: number): Promise<void>;
  /** Fetch all program headers with progress reporting */
  loadAllPrograms(): Promise<void>;
}

/**
 * Hook for loading program data from the S3000XL device.
 *
 * Coordinates between the S3000XL MIDI client, the program data store, and the
 * editor UI store (loading state, progress, errors).
 */
export function useProgramLoader(
  client: S3000xlClientInterface | null,
): UseProgramLoaderResult {
  const setProgramNames = useProgramStore((s) => s.setProgramNames);
  const setProgram = useProgramStore((s) => s.setProgram);
  const setLoading = useEditorStore((s) => s.setLoading);
  const setProgress = useEditorStore((s) => s.setProgress);
  const clearProgress = useEditorStore((s) => s.clearProgress);
  const setError = useEditorStore((s) => s.setError);

  const loadProgramNames = useCallback(async () => {
    if (!client) {
      setError('No MIDI connection');
      return;
    }

    try {
      setLoading(true, 'Loading program names...');
      const names = await client.fetchProgramNames();
      setProgramNames(names);
      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load program names';
      setError(message);
    }
  }, [client, setProgramNames, setLoading, setError]);

  const loadProgram = useCallback(async (index: number) => {
    if (!client) {
      setError('No MIDI connection');
      return;
    }

    try {
      setLoading(true, `Loading program ${index}...`);
      const header = await client.fetchProgramHeader(index);
      setProgram(index, header);
      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to load program ${index}`;
      setError(message);
    }
  }, [client, setProgram, setLoading, setError]);

  const loadAllPrograms = useCallback(async () => {
    if (!client) {
      setError('No MIDI connection');
      return;
    }

    const names = useProgramStore.getState().programNames;
    if (names.length === 0) {
      setError('No programs found. Load program names first.');
      return;
    }

    try {
      setLoading(true, 'Loading all programs...');
      for (let i = 0; i < names.length; i++) {
        setProgress(i + 1, names.length);
        const header = await client.fetchProgramHeader(i);
        setProgram(i, header);
      }
      clearProgress();
      setLoading(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load programs';
      setError(message);
    }
  }, [client, setProgram, setLoading, setProgress, clearProgress, setError]);

  return { loadProgramNames, loadProgram, loadAllPrograms };
}
