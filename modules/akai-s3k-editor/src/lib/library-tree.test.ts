import { describe, it, expect } from 'vitest';
import { toTreeNode } from '@/lib/library-tree';
import type { LibraryTreeNode } from '@audiocontrol/sampler-library/browser';

describe('toTreeNode', () => {
  it('converts a flat LibraryTreeNode', () => {
    const input: LibraryTreeNode = {
      id: 'kick',
      name: 'kick',
      type: 'sample',
      path: ['drums'],
      fileName: 'kick',
    };

    const result = toTreeNode(input);

    expect(result.id).toBe('kick');
    expect(result.name).toBe('kick');
    expect(result.type).toBe('sample');
    expect(result.children).toBeUndefined();
    expect(result.meta).toEqual({
      fileName: 'kick',
      directoryName: undefined,
      path: ['drums'],
      toneCount: undefined,
      kitCount: undefined,
      sliceCount: undefined,
      hasDrumKit: undefined,
      description: undefined,
    });
  });

  it('converts a directory with children recursively', () => {
    const input: LibraryTreeNode = {
      id: 'drums',
      name: 'drums',
      type: 'directory',
      path: [],
      children: [
        {
          id: 'drums/kick',
          name: 'kick',
          type: 'sample',
          path: ['drums'],
          fileName: 'kick',
        },
      ],
    };

    const result = toTreeNode(input);

    expect(result.type).toBe('directory');
    expect(result.children).toHaveLength(1);
    expect(result.children?.[0].id).toBe('drums/kick');
    expect(result.children?.[0].type).toBe('sample');
  });

  it('preserves all metadata fields including hasDrumKit', () => {
    const input: LibraryTreeNode = {
      id: 'kit1',
      name: 'Kit 1',
      type: 'sample',
      path: [],
      directoryName: 'kit-1',
      kitCount: 8,
      description: 'A drum kit',
      sliceCount: 4,
      hasDrumKit: true,
    };

    const result = toTreeNode(input);

    expect(result.meta).toEqual({
      fileName: undefined,
      directoryName: 'kit-1',
      path: [],
      toneCount: undefined,
      kitCount: 8,
      sliceCount: 4,
      hasDrumKit: true,
      description: 'A drum kit',
    });
  });

  it('converts a sample with slices', () => {
    const input: LibraryTreeNode = {
      id: 'break',
      name: 'Amen Break',
      type: 'sample',
      path: ['breaks'],
      directoryName: 'amen-break',
      sliceCount: 8,
    };

    const result = toTreeNode(input);

    expect(result.type).toBe('sample');
    expect(result.meta).toEqual({
      fileName: undefined,
      directoryName: 'amen-break',
      path: ['breaks'],
      toneCount: undefined,
      kitCount: undefined,
      sliceCount: 8,
      hasDrumKit: undefined,
      description: undefined,
    });
  });
});
