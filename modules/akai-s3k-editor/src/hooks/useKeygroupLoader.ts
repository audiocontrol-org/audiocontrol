import { useCallback } from 'react';
import type { S3000xlClientInterface } from '@audiocontrol/sampler-devices/s3000xl-browser';
import { useKeygroupStore } from '@/stores/keygroupStore';
import { useEditorStore } from '@/stores/editorStore';

interface UseKeygroupLoaderResult {
  /** Fetch all keygroup headers for a program */
  loadKeygroups(programIndex: number, count: number): Promise<void>;
}

/**
 * Hook for loading keygroup data from the S3000XL device.
 *
 * Coordinates between the S3000XL MIDI client, the keygroup data store, and the
 * editor UI store (loading state, progress, errors).
 */
export function useKeygroupLoader(
  client: S3000xlClientInterface | null,
): UseKeygroupLoaderResult {
  const setKeygroup = useKeygroupStore((s) => s.setKeygroup);
  const setKeygroupCount = useKeygroupStore((s) => s.setKeygroupCount);
  const setLoading = useEditorStore((s) => s.setLoading);
  const setProgress = useEditorStore((s) => s.setProgress);
  const clearProgress = useEditorStore((s) => s.clearProgress);
  const setError = useEditorStore((s) => s.setError);

  const loadKeygroups = useCallback(
    async (programIndex: number, count: number) => {
      if (!client) {
        setError('No MIDI connection');
        return;
      }

      try {
        setLoading(true, 'Loading keygroups...');
        setKeygroupCount(count);

        for (let i = 0; i < count; i++) {
          setProgress(i + 1, count);
          const header = await client.fetchKeygroupHeader(programIndex, i);
          setKeygroup(i, header);
        }

        clearProgress();
        setLoading(false);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to load keygroups';
        setError(message);
      }
    },
    [client, setKeygroup, setKeygroupCount, setLoading, setProgress, clearProgress, setError],
  );

  return { loadKeygroups };
}
