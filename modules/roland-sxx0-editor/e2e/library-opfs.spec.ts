/**
 * Roland OPFS operations e2e tests.
 *
 * Thin wrapper that delegates to the shared factory in e2e-infra.
 */

// Deviation: relative import because e2e/ is outside src/ and @/ only applies to src/
import { registerOPFSTests } from '../../e2e-infra/specs/library-opfs.spec-factory';
import { initializeRolandOPFS } from '../../e2e-infra/helpers/library-ui-helpers';

registerOPFSTests({
  libraryUrl: '/roland/s330/editor/library',
  baseUrl: '/',
  initializeOPFS: initializeRolandOPFS,
  editorName: 'Roland',
});
