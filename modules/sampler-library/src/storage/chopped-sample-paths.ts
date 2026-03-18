/**
 * Path resolution utilities for chopped samples.
 *
 * Chopped samples are device-agnostic and stored outside device subdirectories:
 * ```
 * ~/Documents/AudioTools/library/chopped-samples/{name}/
 * ├── manifest.yaml
 * └── source.wav
 * ```
 *
 * @packageDocumentation
 */

import { join } from 'path';
import { getLibraryRoot, sanitizeFilename } from './library-paths.js';

/**
 * Get the root directory for all chopped samples.
 *
 * @returns Path to ~/Documents/AudioTools/library/chopped-samples/
 */
export function getChoppedSamplesDirectory(): string {
  return join(getLibraryRoot(), 'chopped-samples');
}

/**
 * Get the directory for a specific chopped sample.
 *
 * @param name - Sample name (will be sanitized for filesystem)
 * @returns Path to ~/Documents/AudioTools/library/chopped-samples/{name}/
 */
export function getChoppedSampleDirectory(name: string): string {
  const safeName = sanitizeFilename(name);
  return join(getChoppedSamplesDirectory(), safeName);
}

/**
 * Get the manifest path for a chopped sample.
 *
 * @param name - Sample name
 * @returns Path to ~/Documents/AudioTools/library/chopped-samples/{name}/manifest.yaml
 */
export function getChoppedSampleManifestPath(name: string): string {
  return join(getChoppedSampleDirectory(name), 'manifest.yaml');
}

/**
 * Get the source WAV path for a chopped sample.
 *
 * @param name - Sample name
 * @returns Path to ~/Documents/AudioTools/library/chopped-samples/{name}/source.wav
 */
export function getChoppedSampleSourcePath(name: string): string {
  return join(getChoppedSampleDirectory(name), 'source.wav');
}
