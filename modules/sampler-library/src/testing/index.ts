export {
  InMemoryFile,
  InMemoryFileHandle,
  InMemoryDirectoryHandle,
} from './in-memory-storage.js';

export { seedMockLibrary } from './seed-mock-library.js';

export {
  NodeDirectoryHandle,
  createNodeStorage,
} from './node-fs-storage.js';

export {
  generatePureSustain,
  generateLeadingSilence,
  generateTrailingSilence,
  generateConstantDecay,
  generateDecayIntoSustain,
  generateSustainWithTrailingDecay,
  generateDiscontinuity,
} from '../loop-detector/testing/test-signals.js';
