/**
 * Storage exports for the sampler library module.
 * @packageDocumentation
 */

// Path utilities
export {
  getLibraryRoot,
  getDeviceLibraryPath,
  getTonesDirectory,
  getPatchesDirectory,
  getTemplatesDirectory,
  getTonePath,
  getToneWavePath,
  getPatchPath,
  getTemplatePath,
  sanitizeFilename,
  getBaseName,
} from './library-paths.js';

// Set path utilities
export {
  getSetsDirectory,
  getSetDirectory,
  getSetManifestPath,
  getSetTonesDirectory,
  getSetPatchesDirectory,
  getSetTonePath,
  getSetToneWavePath,
  getSetPatchPath,
  getToneFilename,
  getPatchFilename,
  parseToneFilename,
  parsePatchFilename,
} from './set-paths.js';

// File storage
export { FileStorage, fileStorage } from './file-storage.js';

// Set storage
export { SetStorage, setStorage } from './set-storage.js';

// Chopped sample path utilities
export {
  getChoppedSamplesDirectory,
  getChoppedSampleDirectory,
  getChoppedSampleManifestPath,
  getChoppedSampleSourcePath,
} from './chopped-sample-paths.js';

// Chopped sample storage
export { ChoppedSampleStorage, choppedSampleStorage } from './chopped-sample-storage.js';
