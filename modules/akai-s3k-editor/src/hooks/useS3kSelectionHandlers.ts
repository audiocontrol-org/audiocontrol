/**
 * Hook for device memory selection handlers.
 *
 * Builds ItemSelection objects when the user clicks a program or sample
 * in the device memory panel, updating both the library store's selected
 * device state and the page-level selection.
 */

import { useCallback } from 'react';
import type { ItemSelection } from '@audiocontrol/editor-core';
import type { S3000xlClientInterface } from '@audiocontrol/sampler-devices/s3k';

interface UseS3kSelectionHandlersArgs {
  deviceProgramNames: string[];
  deviceSampleNames: string[];
  setSelectedDevice: (type: 'program' | 'sample', index: number) => void;
  setSelection: (selection: ItemSelection | null) => void;
  client?: S3000xlClientInterface | null;
}

export function useS3kSelectionHandlers({
  deviceProgramNames,
  deviceSampleNames,
  setSelectedDevice,
  setSelection,
  client,
}: UseS3kSelectionHandlersArgs) {
  const handleDeviceSelectProgram = useCallback(
    (index: number) => {
      setSelectedDevice('program', index);
      setSelection({
        categoryId: 'device',
        node: {
          id: `device-program:${index}`,
          name: deviceProgramNames[index] ?? `Program ${index}`,
          type: 'device-program',
        },
        meta: { deviceIndex: index },
      });
    },
    [setSelectedDevice, deviceProgramNames, setSelection],
  );

  const handleDeviceSelectSample = useCallback(
    (index: number) => {
      setSelectedDevice('sample', index);
      // Show selection immediately with basic meta
      const baseMeta = { deviceIndex: index };
      setSelection({
        categoryId: 'device',
        node: {
          id: `device-sample:${index}`,
          name: deviceSampleNames[index] ?? `Sample ${index}`,
          type: 'device-sample',
        },
        meta: baseMeta,
      });
      // Fetch sample header in background to enrich the preview
      if (client) {
        client.fetchSampleHeader(index).then((header) => {
          setSelection({
            categoryId: 'device',
            node: {
              id: `device-sample:${index}`,
              name: deviceSampleNames[index] ?? `Sample ${index}`,
              type: 'device-sample',
            },
            meta: {
              deviceIndex: index,
              sampleCount: header.SLNGTH,
              sampleRate: header.SSRATE,
            },
          });
        }).catch(() => { /* header fetch failed — preview shows without length */ });
      }
    },
    [setSelectedDevice, deviceSampleNames, setSelection, client],
  );

  return { handleDeviceSelectProgram, handleDeviceSelectSample };
}
