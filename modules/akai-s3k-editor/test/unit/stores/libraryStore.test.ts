import { describe, it, expect, beforeEach } from 'vitest';
import { useLibraryStore } from '@/stores/libraryStore';
import type { TreeNode } from '@audiocontrol/editor-core';

function makeNode(id: string, name: string, type: string): TreeNode {
  return { id, name, type };
}

describe('libraryStore', () => {
  beforeEach(() => {
    useLibraryStore.getState().clear();
  });

  it('starts with empty state', () => {
    const state = useLibraryStore.getState();
    expect(state.sampleNodes).toEqual([]);
    expect(state.programNodes).toEqual([]);
    expect(state.selectedNode).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('sets and clears sample nodes', () => {
    const nodes = [makeNode('s1', 'kick', 'sample')];
    useLibraryStore.getState().setSampleNodes(nodes);
    expect(useLibraryStore.getState().sampleNodes).toEqual(nodes);

    useLibraryStore.getState().clear();
    expect(useLibraryStore.getState().sampleNodes).toEqual([]);
  });

  it('sets and clears program nodes', () => {
    const nodes = [makeNode('p1', 'Piano', 'program')];
    useLibraryStore.getState().setProgramNodes(nodes);
    expect(useLibraryStore.getState().programNodes).toEqual(nodes);

    useLibraryStore.getState().clear();
    expect(useLibraryStore.getState().programNodes).toEqual([]);
  });

  it('manages selected node', () => {
    const node = makeNode('s1', 'kick', 'sample');
    useLibraryStore.getState().setSelectedNode(node);
    expect(useLibraryStore.getState().selectedNode).toEqual(node);

    useLibraryStore.getState().setSelectedNode(null);
    expect(useLibraryStore.getState().selectedNode).toBeNull();
  });

  it('manages loading state', () => {
    useLibraryStore.getState().setLoading(true);
    expect(useLibraryStore.getState().loading).toBe(true);

    useLibraryStore.getState().setLoading(false);
    expect(useLibraryStore.getState().loading).toBe(false);
  });

  it('manages error state', () => {
    useLibraryStore.getState().setError('Something went wrong');
    expect(useLibraryStore.getState().error).toBe('Something went wrong');

    useLibraryStore.getState().setError(null);
    expect(useLibraryStore.getState().error).toBeNull();
  });

  it('clear resets all state', () => {
    const node = makeNode('s1', 'kick', 'sample');
    const store = useLibraryStore.getState();
    store.setSampleNodes([node]);
    store.setProgramNodes([node]);
    store.setSelectedNode(node);
    store.setLoading(true);
    store.setError('error');

    useLibraryStore.getState().clear();
    const after = useLibraryStore.getState();
    expect(after.sampleNodes).toEqual([]);
    expect(after.programNodes).toEqual([]);
    expect(after.selectedNode).toBeNull();
    expect(after.loading).toBe(false);
    expect(after.error).toBeNull();
  });
});
