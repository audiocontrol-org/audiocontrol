import path from 'node:path';
import { existsSync, createReadStream } from 'node:fs';
import type { Plugin } from 'vite';
import { createEditorConfig } from '@audiocontrol/editor-core/vite';

/**
 * Dev-only middleware: serve sampler-devices NDJSON fixtures at
 * `/test-fixtures/<deviceType>/<scenario>.ndjson` so the simulated MIDI
 * harness URL works in `pnpm dev` without copying fixtures into `public/`.
 *
 * The fixture root is `modules/sampler-devices/test/fixtures/`.
 *
 * Defense in depth against path traversal:
 *   1. Decode percent-encoding explicitly (rejecting malformed encodings)
 *      so `%2e%2e` cannot smuggle `..` past a literal-string check.
 *   2. Strict allowlist regex: only `/<deviceType>/<scenario>.ndjson` with
 *      kebab-case alphanumeric segments. This rejects backslashes, null
 *      bytes, dot-segments, and any path shape we don't intend to serve.
 *   3. Belt-and-suspenders: still resolve and verify the result is inside
 *      `fixturesRoot`, in case the regex is ever loosened.
 */
function fixtureServerPlugin(): Plugin {
  const fixturesRoot = path.resolve(__dirname, '../sampler-devices/test/fixtures');
  // Allowlist: /<deviceType>/<scenario>.ndjson where each segment starts
  // with [a-z0-9] and contains only kebab-case-friendly chars.
  const FIXTURE_PATH = /^\/[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9._-]*\.ndjson$/i;
  return {
    name: 'sampler-fixture-server',
    configureServer(server) {
      server.middlewares.use('/test-fixtures', (req, res, next) => {
        const requestPath = (req.url ?? '').split('?')[0];
        let decoded: string;
        try {
          decoded = decodeURIComponent(requestPath);
        } catch {
          res.statusCode = 400;
          res.end('Bad Request');
          return;
        }
        if (!FIXTURE_PATH.test(decoded)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }
        const filePath = path.join(fixturesRoot, decoded);
        const resolved = path.resolve(filePath);
        if (!resolved.startsWith(fixturesRoot + path.sep)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }
        if (!existsSync(resolved)) {
          next();
          return;
        }
        res.setHeader('Content-Type', 'application/x-ndjson');
        createReadStream(resolved).pipe(res);
      });
    },
  };
}

export default createEditorConfig({
  port: 3330,
  dirname: __dirname,
  overrides: {
    plugins: [fixtureServerPlugin()],
  },
});
