/**
 * Common-area sample operations — listing and loading samples and
 * programs from library/common/samples/.
 */

import {
  SampleYamlSchema,
  ProgramYamlSchema,
  type SampleYaml,
  type ProgramYaml,
  type LibraryTreeNode,
  listCommonSamplesTree as listCommonSamplesTreeShared,
  getNestedDirectory,
} from '@audiocontrol/sampler-library/browser';
import { parseYaml } from '@/lib/library-io';

// =========================================================================
// Listing
// =========================================================================

/**
 * List all common-area content (samples, programs, legacy chopped samples)
 * from library/common/samples/ as a hierarchical tree.
 */
export async function listCommonSamplesTree(
  directoryHandle: FileSystemDirectoryHandle
): Promise<LibraryTreeNode[]> {
  return listCommonSamplesTreeShared(directoryHandle);
}

// =========================================================================
// Loading
// =========================================================================

/**
 * Load a sample YAML from library/common/samples/{path}/{name}.yaml.
 */
export async function loadCommonSample(
  directoryHandle: FileSystemDirectoryHandle,
  sampleName: string,
  path: string[] = []
): Promise<SampleYaml> {
  const samplesDir = await getNestedDirectory(directoryHandle, [
    'library', 'common', 'samples', ...path
  ]);

  const yamlHandle = await samplesDir.getFileHandle(`${sampleName}.yaml`);
  const file = await yamlHandle.getFile();
  const text = await file.text();
  const parsed = parseYaml(text);

  return SampleYamlSchema.parse(parsed);
}

/**
 * Load a program YAML from library/common/samples/{path}/{name}/program.yaml.
 */
export async function loadCommonProgram(
  directoryHandle: FileSystemDirectoryHandle,
  programName: string,
  path: string[] = []
): Promise<ProgramYaml> {
  const programDir = await getNestedDirectory(directoryHandle, [
    'library', 'common', 'samples', ...path, programName
  ]);

  const yamlHandle = await programDir.getFileHandle('program.yaml');
  const file = await yamlHandle.getFile();
  const text = await file.text();
  const parsed = parseYaml(text);

  return ProgramYamlSchema.parse(parsed);
}
