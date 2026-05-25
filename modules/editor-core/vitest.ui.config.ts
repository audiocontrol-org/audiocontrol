import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest config for the editor-core UI test harness.
 *
 * The default `vitest.config.ts` picks up co-located `src/**\/*.test.ts(x)`
 * unit tests. This config targets the `test/ui/` directory, which holds
 * integration-style harness specs that exercise multiple primitives
 * end-to-end (currently: keyboard-navigation.spec.ts).
 *
 * Wired into `make test-ui-editor-core`. Phase 2 task 2.7 of
 * feature/akai-harmonization — closes the AUDIT-20260524-01 regression-
 * coverage gap that lets primitive a11y contracts silently drift between
 * audit passes.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['test/ui/**/*.spec.ts', 'test/ui/**/*.spec.tsx'],
    setupFiles: ['./src/testing/vitest.setup.ts'],
  },
});
