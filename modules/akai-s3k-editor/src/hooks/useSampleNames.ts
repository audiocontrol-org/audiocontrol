import { useState, useEffect } from 'react';
import type { S3000xlClientInterface } from '@audiocontrol/sampler-devices/s3000xl-browser';

interface UseSampleNamesResult {
  sampleNames: string[];
  isLoading: boolean;
}

/**
 * Fetches the list of resident sample names from the device.
 * Results are cached in component state for the lifetime of the client reference.
 */
export function useSampleNames(client: S3000xlClientInterface | null): UseSampleNamesResult {
  const [sampleNames, setSampleNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!client) {
      setSampleNames([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    client.fetchSampleNames().then(
      (names) => {
        if (!cancelled) {
          setSampleNames(names);
          setIsLoading(false);
        }
      },
      (err: unknown) => {
        if (!cancelled) {
          setIsLoading(false);
          const message = err instanceof Error ? err.message : String(err);
          throw new Error(`Failed to fetch sample names: ${message}`);
        }
      },
    );

    return () => {
      cancelled = true;
    };
  }, [client]);

  return { sampleNames, isLoading };
}
