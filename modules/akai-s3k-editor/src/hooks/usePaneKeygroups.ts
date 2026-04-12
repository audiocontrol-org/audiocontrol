import { useState, useCallback, useRef } from 'react';
import type { S3000xlClientInterface, KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';

interface PaneKeygroupsResult {
  keygroups: (KeygroupHeader | undefined)[];
  keygroupCount: number;
  isLoading: boolean;
  loadKeygroups(programIndex: number, count: number): Promise<void>;
  clear(): void;
}

/**
 * Hook for loading keygroup data into local component state rather than a global store.
 *
 * Each call to this hook maintains its own independent keygroup array, so multiple
 * instances (e.g., two compare panes) do not interfere with each other.
 */
export function usePaneKeygroups(
  client: S3000xlClientInterface | null,
): PaneKeygroupsResult {
  const [keygroups, setKeygroups] = useState<(KeygroupHeader | undefined)[]>([]);
  const [keygroupCount, setKeygroupCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const loadIdRef = useRef(0);

  const loadKeygroups = useCallback(
    async (programIndex: number, count: number) => {
      if (!client) return;

      const thisLoadId = ++loadIdRef.current;
      setIsLoading(true);
      setKeygroupCount(count);
      setKeygroups(new Array<KeygroupHeader | undefined>(count).fill(undefined));

      try {
        for (let i = 0; i < count; i++) {
          // Abort if a newer load has started
          if (loadIdRef.current !== thisLoadId) return;

          const header = await client.fetchKeygroupHeader(programIndex, i);

          if (loadIdRef.current !== thisLoadId) return;

          setKeygroups((prev) => {
            const next = [...prev];
            next[i] = header;
            return next;
          });
        }
      } finally {
        if (loadIdRef.current === thisLoadId) {
          setIsLoading(false);
        }
      }
    },
    [client],
  );

  const clear = useCallback(() => {
    loadIdRef.current++;
    setKeygroups([]);
    setKeygroupCount(0);
    setIsLoading(false);
  }, []);

  return { keygroups, keygroupCount, isLoading, loadKeygroups, clear };
}
