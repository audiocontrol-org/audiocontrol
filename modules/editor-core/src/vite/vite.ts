/**
 * Shared Vite configuration for all audiocontrol editors.
 *
 * Usage in an editor's vite.config.ts:
 *
 *   import { createEditorConfig } from '@audiocontrol/editor-core/vite';
 *
 *   export default createEditorConfig({
 *     port: 3300,
 *     dirname: __dirname,
 *     proxy: { ... },
 *   });
 */

import { defineConfig, type UserConfig, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';
import path from 'path';
import { execSync } from 'child_process';

// ---------------------------------------------------------------------------
// Crash protection — prevent dev server from dying on connection drops
// (common with mobile browsers dropping WebSocket/TLS connections)
// ---------------------------------------------------------------------------

const IGNORABLE_ERRORS = new Set([
  'ECONNRESET',
  'EPIPE',
  'ECONNABORTED',
  'ERR_STREAM_WRITE_AFTER_END',
]);

process.on('uncaughtException', (err) => {
  if ('code' in err && IGNORABLE_ERRORS.has(err.code as string)) return;
  console.error('Uncaught exception:', err);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Build metadata
// ---------------------------------------------------------------------------

function getGitInfo() {
  try {
    const commitHash = execSync('git rev-parse --short HEAD').toString().trim();
    const commitDate = execSync('git log -1 --format=%ci').toString().trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
    const isDirty = execSync('git status --porcelain').toString().trim().length > 0;
    return { commitHash, commitDate, branch, isDirty };
  } catch {
    return { commitHash: 'unknown', commitDate: '', branch: 'unknown', isDirty: false };
  }
}

// ---------------------------------------------------------------------------
// Shared config factory
// ---------------------------------------------------------------------------

export interface EditorViteConfig {
  /** Dev server port. */
  port: number;
  /** The editor module's __dirname (for resolving the @/ alias). */
  dirname: string;
  /** Additional Vite proxy rules (e.g., SCSI bridge). */
  proxy?: Record<string, string | ProxyOptions>;
  /** Additional Vite config to merge. */
  overrides?: UserConfig;
}

export function createEditorConfig(options: EditorViteConfig): ReturnType<typeof defineConfig> {
  const { port, dirname, proxy, overrides } = options;
  const useMkcert = process.env.VISUAL_HTTP !== '1';
  const gitInfo = getGitInfo();
  const buildTime = new Date().toISOString();

  return defineConfig({
    base: process.env.VITE_BASE_PATH || '/',
    plugins: [
      react(),
      ...(useMkcert
        ? [mkcert({
            hosts: ['localhost', 'orion-m1', 'orion-m4'],
          })]
        : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(dirname, './src'),
      },
    },
    define: {
      __BUILD_TIME__: JSON.stringify(buildTime),
      __GIT_COMMIT__: JSON.stringify(gitInfo.commitHash),
      __GIT_BRANCH__: JSON.stringify(gitInfo.branch),
      __GIT_DATE__: JSON.stringify(gitInfo.commitDate),
      __GIT_DIRTY__: JSON.stringify(gitInfo.isDirty),
    },
    server: {
      port,
      host: true,
      allowedHosts: ['orion-m1', 'orion-m4'],
      proxy,
    },
    preview: {
      proxy,
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
    ...overrides,
  });
}
