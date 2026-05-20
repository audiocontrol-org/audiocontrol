/**
 * Unit tests for `useRolandSelectionMapping`.
 *
 * Pins the contract surfaced by #418: when a `LibraryTreeNode`'s `meta`
 * carries `{ directoryName, fileName, path }`, the hook must use those
 * fields rather than falling back to `node.name`. The fallback is the
 * YAML display name; the metadata fields are the on-disk identity.
 *
 * Without `meta` packing, `loadIndividualPatch` (and friends) receive
 * the wrong directory name whenever the YAML `name` differs from the
 * directory name on disk.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ItemSelection } from '@audiocontrol/editor-core';
import { useRolandSelectionMapping } from '@/hooks/useRolandSelectionMapping';

describe('useRolandSelectionMapping', () => {
  it('uses meta.directoryName for patches when YAML name differs from directory name', () => {
    const { result } = renderHook(() => useRolandSelectionMapping(null));

    const pluginSelection: ItemSelection = {
      categoryId: 'patches',
      node: {
        id: 'basic-patch',
        name: 'Basic Patch',
        type: 'patch',
      },
      meta: {
        directoryName: 'basic-patch',
        fileName: undefined,
        path: ['s330', 'patches'],
      },
    };

    act(() => {
      result.current.handlePluginSelectionChange(pluginSelection);
    });

    expect(result.current.selection).toEqual({
      source: 'library',
      type: 'individualPatch',
      name: 'basic-patch',
      path: ['s330', 'patches'],
    });
  });

  it('uses meta.fileName for tones when YAML name differs from file name', () => {
    const { result } = renderHook(() => useRolandSelectionMapping(null));

    const pluginSelection: ItemSelection = {
      categoryId: 'tones',
      node: {
        id: 'sine-A',
        name: 'Sine Wave',
        type: 'tone',
      },
      meta: {
        directoryName: undefined,
        fileName: 'sine-A',
        path: ['s330', 'tones'],
      },
    };

    act(() => {
      result.current.handlePluginSelectionChange(pluginSelection);
    });

    expect(result.current.selection).toEqual({
      source: 'library',
      type: 'individualTone',
      name: 'sine-A',
      path: ['s330', 'tones'],
    });
  });

  it('falls back to node.name when meta lacks the identity field', () => {
    const { result } = renderHook(() => useRolandSelectionMapping(null));

    const pluginSelection: ItemSelection = {
      categoryId: 'patches',
      node: {
        id: 'fallback-patch',
        name: 'Fallback Patch',
        type: 'patch',
      },
      meta: {},
    };

    act(() => {
      result.current.handlePluginSelectionChange(pluginSelection);
    });

    expect(result.current.selection).toEqual({
      source: 'library',
      type: 'individualPatch',
      name: 'Fallback Patch',
      path: undefined,
    });
  });

  it('clears selection when plugin selection is null', () => {
    const { result } = renderHook(() => useRolandSelectionMapping(null));

    act(() => {
      result.current.handlePluginSelectionChange({
        categoryId: 'patches',
        node: { id: 'p', name: 'P', type: 'patch' },
        meta: { directoryName: 'p', path: [] },
      });
    });

    expect(result.current.selection).not.toBeNull();

    act(() => {
      result.current.handlePluginSelectionChange(null);
    });

    expect(result.current.selection).toBeNull();
  });
});
