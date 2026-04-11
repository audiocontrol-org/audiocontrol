/**
 * Hook managing selection state and mapping between editor-core's
 * ItemSelection and Roland's page-level RolandPageSelection type.
 *
 * Handles plugin selection changes, device/library item selection,
 * and drum kit bundle loading on selection.
 */

import { useState, useCallback } from 'react';
import type { ItemSelection as PluginItemSelection } from '@audiocontrol/editor-core';
import type { StorageDirectoryHandle } from '@/lib/library-service';
import type { RolandPageSelection } from '@/pages/LibraryPage';

// =========================================================================
// Result interface
// =========================================================================

export interface RolandSelectionMappingResult {
  selection: RolandPageSelection | null;
  setSelection: (selection: RolandPageSelection | null) => void;
  handlePluginSelectionChange: (pluginSelection: PluginItemSelection | null) => void;
  handleSelectDevice: (type: 'tone' | 'patch', index: number) => void;
  handleSelectLibrary: (type: 'tone' | 'patch' | 'set', name: string, setName?: string) => void;
}

// =========================================================================
// Hook
// =========================================================================

export function useRolandSelectionMapping(
  _libraryHandle: StorageDirectoryHandle | null,
): RolandSelectionMappingResult {
  const [selection, setSelection] = useState<RolandPageSelection | null>(null);

  const handlePluginSelectionChange = useCallback((pluginSelection: PluginItemSelection | null) => {
    if (!pluginSelection) {
      setSelection(null);
      return;
    }

    const { categoryId, node, meta } = pluginSelection;
    const nodeMeta = (meta ?? {}) as { fileName?: string; directoryName?: string; path?: string[] };

    let pageSelection: RolandPageSelection;

    if (categoryId === 'tones') {
      pageSelection = {
        source: 'library',
        type: 'individualTone',
        name: nodeMeta.fileName ?? node.name,
        path: nodeMeta.path,
      };
    } else if (categoryId === 'patches') {
      pageSelection = {
        source: 'library',
        type: 'individualPatch',
        name: nodeMeta.directoryName ?? node.name,
        path: nodeMeta.path,
      };
    } else if (categoryId === 'samples') {
      if (node.type === 'program') {
        pageSelection = {
          source: 'library',
          type: 'program',
          name: nodeMeta.directoryName ?? node.name,
          path: nodeMeta.path,
        };
      } else {
        pageSelection = {
          source: 'library',
          type: 'sample',
          name: nodeMeta.directoryName ?? node.name,
          path: nodeMeta.path,
        };
      }
    } else {
      pageSelection = {
        source: 'library',
        type: 'individualTone',
        name: node.name,
        path: nodeMeta.path,
      };
    }

    setSelection(pageSelection);
  }, []);

  const handleSelectDevice = useCallback(
    (type: 'tone' | 'patch', index: number) => setSelection({ source: 'device', type, index }),
    [],
  );

  const handleSelectLibrary = useCallback(
    (type: 'tone' | 'patch' | 'set', name: string, setName?: string) => {
      setSelection({ source: 'library', type, name, setName });
    },
    [],
  );

  return {
    selection,
    setSelection,
    handlePluginSelectionChange,
    handleSelectDevice,
    handleSelectLibrary,
  };
}
