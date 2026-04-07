/**
 * Hook for scanning S3000XL programs from library storage.
 *
 * Scans the `library/s3k/programs/` directory for serialized
 * S3000XL program bundles (directories with `program.s3k.yaml`)
 * and converts them to TreeNode format for the library browser.
 */

import { useCallback } from 'react';
import type { TreeNode } from '@audiocontrol/editor-core';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import { listStoredPrograms } from '@/lib/program-storage';
import { useLibraryStore } from '@/stores/libraryStore';

export interface UseLibraryProgramsResult {
  /** Scan the programs directory and update the store */
  refreshPrograms: () => Promise<void>;
}

/**
 * Scan stored S3000XL programs and populate the library store's program nodes.
 */
export function useLibraryPrograms(
  root: StorageDirectoryHandle | null,
): UseLibraryProgramsResult {
  const setProgramNodes = useLibraryStore((s) => s.setProgramNodes);

  const refreshPrograms = useCallback(async () => {
    if (!root) {
      setProgramNodes([]);
      return;
    }

    try {
      const programs = await listStoredPrograms(root);
      const nodes: TreeNode[] = programs.map((info) => ({
        id: `program:${info.dirName}`,
        name: info.name,
        type: 'program',
        meta: {
          dirName: info.dirName,
          keygroupCount: info.keygroupCount,
          sampleReferences: info.sampleReferences,
        },
      }));
      setProgramNodes(nodes);
    } catch {
      // If the programs directory doesn't exist yet, that's fine
      setProgramNodes([]);
    }
  }, [root, setProgramNodes]);

  return { refreshPrograms };
}
