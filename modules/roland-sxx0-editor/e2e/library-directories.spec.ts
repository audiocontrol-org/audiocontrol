/**
 * Roland directory operations e2e tests.
 *
 * Thin wrapper that delegates to the shared factory in e2e-infra.
 */

// Deviation: relative import because e2e/ is outside src/ and @/ only applies to src/
import { registerDirectoryTests } from '../../e2e-infra/specs/library-directories.spec-factory';
import { initializeRolandOPFS } from '../../e2e-infra/helpers/library-ui-helpers';

registerDirectoryTests({
  libraryUrl: '/roland/s330/editor/library',
  baseUrl: '/',
  initializeOPFS: initializeRolandOPFS,
  editorName: 'Roland',
});
