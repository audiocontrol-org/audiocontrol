#!/usr/bin/env node
// One-shot Playwright capture for Phase 4 (visual fidelity review).
// Captures live akai test-harness routes + the corresponding mockup HTML
// files at desktop + mobile viewports. Outputs to .tmp/visual-fidelity/
// (gitignored — operator-local scratch artifacts).
//
// Run from repo root with the dev server already running on https://localhost:3300:
//   node tools/visual-fidelity/capture.mjs
//
// Mockup serving strategy
// -----------------------
// The mockup HTML files reference editor-core / roland-sxx0-editor CSS via
// absolute paths (e.g., `/modules/editor-core/src/design/styles.css`).
// Under `file://` those absolute paths resolve relative to the filesystem
// root, not the repo root, so CSS never loads and the mockups render as
// unstyled Times New Roman (audit finding AUDIT-20260525-27).
//
// Fix: spawn a short-lived `python3 -m http.server` rooted at the repo
// root for the lifetime of this script. The repo root is the only root
// that satisfies BOTH the absolute `/modules/...` links AND the relative
// `./akai-dialect.css` link (which resolves to the mockups subdirectory
// via the URL path). Server is killed in the `finally` block.

import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
// Script lives at tools/visual-fidelity/capture.mjs; repo root is two dirs up.
const REPO_ROOT = resolve(__dirname, '../..');
const OUT_DIR = resolve(REPO_ROOT, '.tmp/visual-fidelity');
mkdirSync(OUT_DIR, { recursive: true });

// pnpm hoists multiple playwright-core versions side-by-side; the version
// whose browser binary is downloaded is `1.58.1` (pulled transitively by
// @vitest/browser). Resolve that explicit version from REPO_ROOT so the
// script stays machine-portable and doesn't depend on the .pnpm symlink
// alias pointing at the right version. If pnpm-lock.yaml moves to a newer
// playwright, update the path below to match.
const playwrightUrl = pathToFileURL(
  resolve(REPO_ROOT, 'node_modules/.pnpm/playwright-core@1.58.1/node_modules/playwright-core/index.mjs'),
).href;
const { chromium } = await import(playwrightUrl);

// --- Mockup HTTP server lifecycle ---------------------------------------

/** Ask the OS for a free port via a transient listener; return the port. */
async function pickFreePort() {
  return new Promise((resolvePort, rejectPort) => {
    const probe = createServer();
    probe.unref();
    probe.on('error', rejectPort);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolvePort(port));
    });
  });
}

/** Poll until the server answers on `/`; throw if it never does. */
async function waitForServer(port, { timeoutMs = 5000, intervalMs = 50 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      // Any HTTP response (200, 404, 403, ...) means the server is alive.
      if (res.status >= 200 && res.status < 600) return;
    } catch {
      // Connection refused — keep polling.
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`mockup http server on port ${port} did not become ready within ${timeoutMs}ms`);
}

const mockupPort = await pickFreePort();
const mockupServer = spawn('python3', ['-m', 'http.server', String(mockupPort), '--bind', '127.0.0.1'], {
  cwd: REPO_ROOT,
  stdio: ['ignore', 'ignore', 'inherit'],
});
mockupServer.on('error', (err) => {
  console.error(`mockup server spawn error: ${err.message}`);
});

try {
  await waitForServer(mockupPort);
  console.log(`mockup server ready at http://127.0.0.1:${mockupPort}/ (rooted at repo root)`);

  const TARGETS = [
    // Live (using test-harness routes; same chrome as production, isolated from device)
    { label: 'live-programs', url: 'https://localhost:3300/akai/s3000xl/editor/test/programs', kind: 'live' },
    { label: 'live-keygroups-shell', url: 'https://localhost:3300/akai/s3000xl/editor/test/keygroups-shell', kind: 'live' },
    { label: 'live-samples', url: 'https://localhost:3300/akai/s3000xl/editor/test/samples', kind: 'live' },
    { label: 'live-library-real', url: 'https://localhost:3300/akai/s3000xl/editor/test/library-real', kind: 'live' },
    // Production routes (what the operator actually views when device is connected)
    { label: 'live-prod-programs', url: 'https://localhost:3300/akai/s3000xl/editor/programs', kind: 'live' },
    { label: 'live-prod-keygroups', url: 'https://localhost:3300/akai/s3000xl/editor/keygroups', kind: 'live' },
    { label: 'live-prod-samples', url: 'https://localhost:3300/akai/s3000xl/editor/samples', kind: 'live' },
    { label: 'live-prod-library', url: 'https://localhost:3300/akai/s3000xl/editor/library', kind: 'live' },
    // Mockups (served via local http.server rooted at the repo root so the
    // mockups' absolute `/modules/...` <link> tags resolve)
    { label: 'mockup-programs', url: `http://127.0.0.1:${mockupPort}/docs/1.0/001-IN-PROGRESS/akai-harmonization/mockups/programs.html`, kind: 'mockup' },
    { label: 'mockup-keygroups', url: `http://127.0.0.1:${mockupPort}/docs/1.0/001-IN-PROGRESS/akai-harmonization/mockups/keygroups.html`, kind: 'mockup' },
    { label: 'mockup-samples', url: `http://127.0.0.1:${mockupPort}/docs/1.0/001-IN-PROGRESS/akai-harmonization/mockups/samples.html`, kind: 'mockup' },
    { label: 'mockup-library', url: `http://127.0.0.1:${mockupPort}/docs/1.0/001-IN-PROGRESS/akai-harmonization/mockups/library.html`, kind: 'mockup' },
  ];

  const VIEWPORTS = [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'mobile', width: 414, height: 896 },
  ];

  const browser = await chromium.launch();
  try {
    for (const target of TARGETS) {
      for (const vp of VIEWPORTS) {
        const ctx = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          ignoreHTTPSErrors: true,
        });
        const page = await ctx.newPage();
        try {
          await page.goto(target.url, { waitUntil: 'networkidle', timeout: 10000 });
          // Brief settle delay for React mount + any post-mount layout
          await page.waitForTimeout(800);
          const outPath = `${OUT_DIR}/${target.label}-${vp.name}.png`;
          await page.screenshot({ path: outPath, fullPage: false });
          console.log(`OK   ${target.label}-${vp.name}`);
        } catch (err) {
          console.log(`ERR  ${target.label}-${vp.name} ${err.message}`);
        }
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
  console.log('done');
} finally {
  if (!mockupServer.killed) {
    mockupServer.kill('SIGTERM');
  }
}
