/**
 * Drum kit editor e2e tests for the Akai S3000XL editor.
 *
 * Thin wrapper that delegates to the shared factory in e2e-infra.
 * Run via: make test-e2e-s3k-library ARGS="--grep 'Drum Kit Editor'"
 */

// Deviation: Using relative imports because e2e/ is outside src/ and the @/
// path alias only applies to src/. This should not be copied to app code.
import { registerDrumKitEditorTests } from '../../e2e-infra/specs/library-drumkit-editor.spec-factory';
import { initializeS3kOPFS } from '../../e2e-infra/helpers/library-ui-helpers';

const port = process.env.E2E_PORT;
if (!port) {
  throw new Error('E2E_PORT must be set. Run via: ./scripts/run-library-e2e.sh');
}

registerDrumKitEditorTests({
  libraryUrl: `/akai/s3000xl/editor/library`,
  baseUrl: `https://localhost:${port}/akai/s3000xl/editor`,
  initializeOPFS: initializeS3kOPFS,
  editorName: 'S3K',
});
