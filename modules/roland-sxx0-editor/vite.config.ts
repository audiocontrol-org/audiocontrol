import path from 'node:path';
import { existsSync, createReadStream } from 'node:fs';
import type { Plugin } from 'vite';
import { createEditorConfig } from '@audiocontrol/editor-core/vite';

/**
 * Dev-only middleware: serve sampler-devices NDJSON fixtures at
 * `/test-fixtures/<deviceType>/<scenario>.ndjson` so the simulated MIDI
 * harness URL works in `pnpm dev` without copying fixtures into `public/`.
 *
 * The fixture root is `modules/sampler-devices/test/fixtures/`. A path-
 * traversal guard rejects any resolved path that escapes that root.
 */
function fixtureServerPlugin(): Plugin {
  const fixturesRoot = path.resolve(__dirname, '../sampler-devices/test/fixtures');
  return {
    name: 'sampler-fixture-server',
    configureServer(server) {
      server.middlewares.use('/test-fixtures', (req, res, next) => {
        const requestPath = (req.url ?? '').split('?')[0];
        const filePath = path.join(fixturesRoot, requestPath);
        const resolved = path.resolve(filePath);
        if (!resolved.startsWith(fixturesRoot + path.sep) && resolved !== fixturesRoot) {
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
