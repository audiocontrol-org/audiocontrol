/**
 * S3K directory operations e2e tests.
 *
 * Thin wrapper that delegates to the shared factory in e2e-infra.
 */

// Deviation: relative import because e2e/ is outside src/ and @/ only applies to src/
import { registerDirectoryTests } from '../../e2e-infra/specs/library-directories.spec-factory';
import { initializeS3kOPFS } from '../../e2e-infra/helpers/library-ui-helpers';

const port = process.env.E2E_PORT;
if (!port) {
  throw new Error('E2E_PORT must be set. Run via: ./scripts/run-library-e2e.sh');
}

registerDirectoryTests({
  libraryUrl: `https://localhost:${port}/akai/s3000xl/editor/library`,
  baseUrl: `https://localhost:${port}/akai/s3000xl/editor`,
  initializeOPFS: initializeS3kOPFS,
  editorName: 'S3K',
});
