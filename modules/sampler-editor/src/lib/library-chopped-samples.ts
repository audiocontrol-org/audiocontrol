/**
 * Chopped sample operations — loading samples with slice data
 * from the common library (library/common/samples/).
 *
 * Uses the unified sample.yaml format (samples with optional slices).
 */

import { parseWav } from '@/core/midi/S330Client';
import {
  SampleYamlSchema,
  type SampleYaml,
  type StorageDirectoryHandle,
  getNestedDirectory,
} from '@audiocontrol/sampler-library/browser';
import { parseYaml } from '@/lib/library-io';

// =========================================================================
// Loading
// =========================================================================

/**
 * Load sample metadata from library/common/samples/{path}/{name}/sample.yaml.
 */
export async function loadChoppedSampleManifest(
  directoryHandle: StorageDirectoryHandle,
  sampleName: string,
  path: string[] = []
): Promise<SampleYaml> {
  const sampleDir = await getNestedDirectory(directoryHandle, [
    'library', 'common', 'samples', ...path, sampleName
  ]);

  const yamlHandle = await sampleDir.getFileHandle('sample.yaml');
  const file = await yamlHandle.getFile();
  const text = await file.text();
  const parsed = parseYaml(text);

  return SampleYamlSchema.parse(parsed);
}

/**
 * Load the WAV from a sample in library/common/samples/.
 */
export async function loadChoppedSampleSource(
  directoryHandle: StorageDirectoryHandle,
  sampleName: string,
  _sourceFilename: string,
  path: string[] = []
): Promise<{ samples: Int16Array; sampleRate: number }> {
  const sampleDir = await getNestedDirectory(directoryHandle, [
    'library', 'common', 'samples', ...path, sampleName
  ]);

  const fileHandle = await sampleDir.getFileHandle('sample.wav');
  const file = await fileHandle.getFile();
  const arrayBuffer = await file.arrayBuffer();
  const wavData = parseWav(arrayBuffer);

  return {
    samples: wavData.samples,
    sampleRate: wavData.sampleRate,
  };
}
