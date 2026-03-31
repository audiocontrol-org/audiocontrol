/**
 * Converts LibraryTreeNode (from sampler-library) to TreeNode (from editor-core).
 *
 * The sampler-library scanning functions return LibraryTreeNode, while
 * editor-core's UI components expect TreeNode. This module bridges the two.
 */

import type { TreeNode } from '@audiocontrol/editor-core';
import type { LibraryTreeNode } from '@audiocontrol/sampler-library/browser';

/** Convert a LibraryTreeNode to an editor-core TreeNode, recursively. */
export function toTreeNode(node: LibraryTreeNode): TreeNode {
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    children: node.children?.map(toTreeNode),
    meta: {
      fileName: node.fileName,
      directoryName: node.directoryName,
      path: node.path,
      toneCount: node.toneCount,
      kitCount: node.kitCount,
      sampleCount: node.sampleCount,
      sliceCount: node.sliceCount,
      description: node.description,
    },
  };
}
