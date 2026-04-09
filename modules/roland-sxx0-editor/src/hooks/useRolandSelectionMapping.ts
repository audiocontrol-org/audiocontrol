/**
 * Hook managing selection state and mapping between editor-core's
 * ItemSelection and Roland's page-level ItemSelection type.
 *
 * Handles plugin selection changes, device/library item selection,
 * and drum kit bundle loading on selection.
 */

import { useState, useCallback } from 'react';
import type { ItemSelection as PluginItemSelection } from '@audiocontrol/editor-core';
import type { ResolvedDrumKitBundle } from '@audiocontrol/sampler-library/browser';
import { loadDrumKitBundle, type StorageDirectoryHandle } from '@/lib/library-service';
import type { ItemSelection } from '@/pages/LibraryPage';

// =========================================================================
// Result interface
// =========================================================================

export interface RolandSelectionMappingResult {
  selection: ItemSelection | null;
  setSelection: (selection: ItemSelection | null) => void;
  handlePluginSelectionChange: (pluginSelection: PluginItemSelection | null) => void;
  handleSelectDevice: (type: 'tone' | 'patch', index: number) => void;
  handleSelectLibrary: (type: 'tone' | 'patch' | 'set', name: string, setName?: string) => void;
}

// =========================================================================
// Hook
// =========================================================================

export function useRolandSelectionMapping(
  libraryHandle: StorageDirectoryHandle | null,
  setSelectedDrumKitBundle: (bundle: ResolvedDrumKitBundle | null) => void,
): RolandSelectionMappingResult {
  const [selection, setSelection] = useState<ItemSelection | null>(null);

  const handlePluginSelectionChange = useCallback((pluginSelection: PluginItemSelection | null) => {
    if (!pluginSelection) {
      setSelection(null);
      setSelectedDrumKitBundle(null);
      return;
    }

    const { categoryId, node, meta } = pluginSelection;
    const nodeMeta = (meta ?? {}) as { fileName?: string; directoryName?: string; path?: string[] };

    let pageSelection: ItemSelection;

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
    } else if (categoryId === 'drumKits') {
      pageSelection = {
        source: 'library',
        type: 'drumKit',
        name: nodeMeta.directoryName ?? node.name,
        path: nodeMeta.path,
      };
      if (libraryHandle) {
        loadDrumKitBundle(libraryHandle, nodeMeta.directoryName ?? node.name, nodeMeta.path)
          .then(setSelectedDrumKitBundle)
          .catch((err) => console.error('[useRolandSelectionMapping] Failed to load drum kit bundle:', err));
      }
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
    if (categoryId !== 'drumKits') setSelectedDrumKitBundle(null);
  }, [libraryHandle, setSelectedDrumKitBundle]);

  const handleSelectDevice = useCallback(
    (type: 'tone' | 'patch', index: number) => setSelection({ source: 'device', type, index }),
    [],
  );

  const handleSelectLibrary = useCallback(
    (type: 'tone' | 'patch' | 'set', name: string, setName?: string) => {
      setSelection({ source: 'library', type, name, setName });
      setSelectedDrumKitBundle(null);
    },
    [setSelectedDrumKitBundle],
  );

  return {
    selection,
    setSelection,
    handlePluginSelectionChange,
    handleSelectDevice,
    handleSelectLibrary,
  };
}
