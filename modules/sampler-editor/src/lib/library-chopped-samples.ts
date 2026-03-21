/**
 * Chopped sample operations — listing, loading, and reading
 * chopped samples from the common library (library/common/samples/).
 */

import { parseWav } from '@/core/midi/S330Client';
import {
  ChoppedSampleSchema,
  type ChoppedSample,
  type LibraryTreeNode,
  type StorageDirectoryHandle,
  listChoppedSamplesTree as listChoppedSamplesTreeShared,
  getNestedDirectory,
} from '@audiocontrol/sampler-library/browser';
import { parseYaml } from '@/lib/library-io';

// =========================================================================
// Listing
// =========================================================================

/**
 * List all chopped samples from library/common/samples/ as a hierarchical tree.
 */
export async function listChoppedSamplesTree(
  directoryHandle: StorageDirectoryHandle
): Promise<LibraryTreeNode[]> {
  return listChoppedSamplesTreeShared(directoryHandle);
}

// =========================================================================
// Loading
// =========================================================================

/**
 * Load a chopped sample manifest from library/common/samples/{path}/{name}/manifest.yaml.
 */
export async function loadChoppedSampleManifest(
  directoryHandle: StorageDirectoryHandle,
  sampleName: string,
  path: string[] = []
): Promise<ChoppedSample> {
  const sampleDir = await getNestedDirectory(directoryHandle, [
    'library', 'common', 'samples', ...path, sampleName
  ]);

  const manifestHandle = await sampleDir.getFileHandle('manifest.yaml');
  const file = await manifestHandle.getFile();
  const text = await file.text();
  const parsed = parseYaml(text);

  return ChoppedSampleSchema.parse(parsed);
}

/**
 * Load the source WAV from a chopped sample in library/common/samples/.
 */
export async function loadChoppedSampleSource(
  directoryHandle: StorageDirectoryHandle,
  sampleName: string,
  sourceFilename: string,
  path: string[] = []
): Promise<{ samples: Int16Array; sampleRate: number }> {
  const sampleDir = await getNestedDirectory(directoryHandle, [
    'library', 'common', 'samples', ...path, sampleName
  ]);

  const fileHandle = await sampleDir.getFileHandle(sourceFilename);
  const file = await fileHandle.getFile();
  const arrayBuffer = await file.arrayBuffer();
  const wavData = parseWav(arrayBuffer);

  return {
    samples: wavData.samples,
    sampleRate: wavData.sampleRate,
  };
}
