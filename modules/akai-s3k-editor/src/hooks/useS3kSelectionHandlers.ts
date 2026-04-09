/**
 * Hook for device memory selection handlers.
 *
 * Builds ItemSelection objects when the user clicks a program or sample
 * in the device memory panel, updating both the library store's selected
 * device state and the page-level selection.
 */

import { useCallback } from 'react';
import type { ItemSelection } from '@audiocontrol/editor-core';

interface UseS3kSelectionHandlersArgs {
  deviceProgramNames: string[];
  deviceSampleNames: string[];
  setSelectedDevice: (type: 'program' | 'sample', index: number) => void;
  setSelection: (selection: ItemSelection | null) => void;
}

export function useS3kSelectionHandlers({
  deviceProgramNames,
  deviceSampleNames,
  setSelectedDevice,
  setSelection,
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
      setSelection({
        categoryId: 'device',
        node: {
          id: `device-sample:${index}`,
          name: deviceSampleNames[index] ?? `Sample ${index}`,
          type: 'device-sample',
        },
        meta: { deviceIndex: index },
      });
    },
    [setSelectedDevice, deviceSampleNames, setSelection],
  );

  return { handleDeviceSelectProgram, handleDeviceSelectSample };
}
