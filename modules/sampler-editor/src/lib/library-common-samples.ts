/**
 * Common-area sample and program operations.
 *
 * Re-exports shared functions from @audiocontrol/sampler-library for
 * listing and loading samples and programs from library/common/samples/.
 */

import {
  type SampleYaml,
  type ProgramYaml,
  type LibraryTreeNode,
  listCommonSamplesTree as listCommonSamplesTreeShared,
  loadSampleMeta,
  loadProgramMeta,
} from '@audiocontrol/sampler-library/browser';

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
// Loading - Re-export shared functions with browser-friendly signatures
// =========================================================================

/**
 * Load a sample's metadata from library/common/samples/{path}/{name}/sample.yaml.
 */
export async function loadCommonSample(
  directoryHandle: FileSystemDirectoryHandle,
  sampleName: string,
  path: string[] = []
): Promise<SampleYaml> {
  return loadSampleMeta(directoryHandle, sampleName, path);
}

/**
 * Load a program's metadata from library/common/samples/{path}/{name}/program.yaml.
 */
export async function loadCommonProgram(
  directoryHandle: FileSystemDirectoryHandle,
  programName: string,
  path: string[] = []
): Promise<ProgramYaml> {
  return loadProgramMeta(directoryHandle, programName, path);
}
