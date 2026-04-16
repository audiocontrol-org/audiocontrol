import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, execSync, ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const MODULE_ROOT = resolve(__dirname, '../..');
const BASE_URL = 'http://localhost:4200';
const GALLERY_PORT = 4200;

interface DemoInfo {
  name: string;
  mp4Url: string;
  gifUrl: string | null;
  hasCaptions: boolean;
  hasCaptionedMp4: boolean;
  hasVoScript: boolean;
  durationMs: number;
}

interface ScenarioInfo {
  name: string;
  description: string;
  mode: string;
  outputTier: string;
  file: string;
}

interface DemoDetail {
  name: string;
  mp4Url: string | null;
  gifUrl: string | null;
  hasCaptions: boolean;
  hasCaptionedMp4: boolean;
  hasVoScript: boolean;
  durationMs: number;
  files: Array<{ name: string; size: number }>;
  captionsYaml: string | null;
  voScript: string | null;
}

interface GenerateStatus {
  status: string;
  scenario?: string;
}

let galleryProcess: ChildProcess | null = null;

function killPort(port: number): void {
  try {
    execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null`, {
      stdio: 'ignore',
    });
  } catch {
    // No process on the port — that's fine
  }
}

async function waitForServer(
  url: string,
  maxAttempts: number,
  delayMs: number,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(
    `Server did not become ready at ${url} after ${maxAttempts} attempts`,
  );
}

function ensureHelloWorldDemo(): void {
  const helloWorldMp4 = resolve(
    MODULE_ROOT,
    'dist/demos/hello-world/video.mp4',
  );
  if (existsSync(helloWorldMp4)) return;

  execSync(
    'tsx src/cli.ts scenarios/hello-world.ts about:blank --tier scripted',
    { cwd: MODULE_ROOT, stdio: 'inherit', timeout: 120000 },
  );

  if (!existsSync(helloWorldMp4)) {
    throw new Error('Failed to generate hello-world demo video');
  }
}

describe('gallery API', () => {
  beforeAll(async () => {
    ensureHelloWorldDemo();

    killPort(GALLERY_PORT);
    await new Promise((r) => setTimeout(r, 500));

    galleryProcess = spawn('pnpm', ['gallery'], {
      cwd: MODULE_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    await waitForServer(`${BASE_URL}/api/demos`, 20, 500);
  }, 180000);

  afterAll(() => {
    if (galleryProcess) {
      galleryProcess.kill('SIGTERM');
      galleryProcess = null;
    }
  });

  describe('GET /api/demos', () => {
    it('returns an array of demos', async () => {
      const res = await fetch(`${BASE_URL}/api/demos`);
      expect(res.status).toBe(200);
      const demos: DemoInfo[] = await res.json();
      expect(Array.isArray(demos)).toBe(true);
      expect(demos.length).toBeGreaterThan(0);
    });

    it('includes expected fields for each demo', async () => {
      const res = await fetch(`${BASE_URL}/api/demos`);
      const demos: DemoInfo[] = await res.json();
      for (const demo of demos) {
        expect(demo).toHaveProperty('name');
        expect(demo).toHaveProperty('mp4Url');
        expect(demo).toHaveProperty('gifUrl');
        expect(demo).toHaveProperty('hasCaptions');
        expect(demo).toHaveProperty('durationMs');
        expect(typeof demo.name).toBe('string');
        expect(typeof demo.mp4Url).toBe('string');
        expect(typeof demo.hasCaptions).toBe('boolean');
        expect(typeof demo.durationMs).toBe('number');
      }
    });

    it('includes hello-world in the list', async () => {
      const res = await fetch(`${BASE_URL}/api/demos`);
      const demos: DemoInfo[] = await res.json();
      const hw = demos.find((d) => d.name === 'hello-world');
      expect(hw).toBeDefined();
      expect(hw?.mp4Url).toContain('hello-world');
    });
  });

  describe('GET /api/scenarios', () => {
    it('returns an array of scenarios', async () => {
      const res = await fetch(`${BASE_URL}/api/scenarios`);
      expect(res.status).toBe(200);
      const scenarios: ScenarioInfo[] = await res.json();
      expect(Array.isArray(scenarios)).toBe(true);
      expect(scenarios.length).toBeGreaterThan(0);
    });

    it('includes expected fields for each scenario', async () => {
      const res = await fetch(`${BASE_URL}/api/scenarios`);
      const scenarios: ScenarioInfo[] = await res.json();
      for (const s of scenarios) {
        expect(typeof s.name).toBe('string');
        expect(typeof s.description).toBe('string');
        expect(typeof s.mode).toBe('string');
        expect(typeof s.outputTier).toBe('string');
        expect(typeof s.file).toBe('string');
      }
    });

    it('includes hello-world scenario', async () => {
      const res = await fetch(`${BASE_URL}/api/scenarios`);
      const scenarios: ScenarioInfo[] = await res.json();
      const hw = scenarios.find((s) => s.name === 'hello-world');
      expect(hw).toBeDefined();
      expect(hw?.file).toBe('hello-world.ts');
    });
  });

  describe('GET /api/demo?name=', () => {
    it('returns full detail for a known scenario', async () => {
      const res = await fetch(`${BASE_URL}/api/demo?name=hello-world`);
      expect(res.status).toBe(200);
      const detail: DemoDetail = await res.json();
      expect(detail.name).toBe('hello-world');
      expect(detail.mp4Url).toContain('hello-world');
      expect(typeof detail.hasCaptions).toBe('boolean');
      expect(typeof detail.durationMs).toBe('number');
    });

    it('includes files array with sizes', async () => {
      const res = await fetch(`${BASE_URL}/api/demo?name=hello-world`);
      const detail: DemoDetail = await res.json();
      expect(Array.isArray(detail.files)).toBe(true);
      expect(detail.files.length).toBeGreaterThan(0);
      for (const f of detail.files) {
        expect(typeof f.name).toBe('string');
        expect(typeof f.size).toBe('number');
        expect(f.size).toBeGreaterThan(0);
      }
    });

    it('includes captionsYaml content when captions exist', async () => {
      const res = await fetch(
        `${BASE_URL}/api/demo?name=s3k-zone-editor`,
      );
      const detail: DemoDetail = await res.json();
      expect(detail.hasCaptions).toBe(true);
      expect(detail.captionsYaml).not.toBeNull();
      expect(typeof detail.captionsYaml).toBe('string');
      expect(detail.captionsYaml?.length).toBeGreaterThan(0);
    });

    it('returns 404 for unknown scenario', async () => {
      const res = await fetch(
        `${BASE_URL}/api/demo?name=nonexistent-scenario`,
      );
      expect(res.status).toBe(404);
    });

    it('returns 400 for missing name param', async () => {
      const res = await fetch(`${BASE_URL}/api/demo`);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/save-captions', () => {
    it('writes content to captions.yaml and reads it back', async () => {
      // Read original content
      const before = await fetch(
        `${BASE_URL}/api/demo?name=hello-world`,
      );
      const beforeDetail: DemoDetail = await before.json();
      const originalContent = beforeDetail.captionsYaml;

      const testContent = 'project:\n  name: test-save\n';

      try {
        // Save new content
        const saveRes = await fetch(`${BASE_URL}/api/save-captions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scenario: 'hello-world',
            content: testContent,
          }),
        });
        expect(saveRes.status).toBe(200);

        // Read back to verify
        const after = await fetch(
          `${BASE_URL}/api/demo?name=hello-world`,
        );
        const afterDetail: DemoDetail = await after.json();
        expect(afterDetail.captionsYaml).toBe(testContent);
        expect(afterDetail.hasCaptions).toBe(true);
      } finally {
        // Restore original content
        if (originalContent !== null) {
          await fetch(`${BASE_URL}/api/save-captions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              scenario: 'hello-world',
              content: originalContent,
            }),
          });
        }
      }
    });

    it('returns 400 for missing scenario', async () => {
      const res = await fetch(`${BASE_URL}/api/save-captions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'test' }),
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 for path traversal attempt', async () => {
      const res = await fetch(`${BASE_URL}/api/save-captions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: '../../../etc/passwd',
          content: 'malicious',
        }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/save-vo-script', () => {
    it('writes content to vo-script.txt and reads it back', async () => {
      // Read original content
      const before = await fetch(
        `${BASE_URL}/api/demo?name=hello-world`,
      );
      const beforeDetail: DemoDetail = await before.json();
      const originalContent = beforeDetail.voScript;

      const testContent = 'Test voiceover script content.';

      try {
        const saveRes = await fetch(`${BASE_URL}/api/save-vo-script`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scenario: 'hello-world',
            content: testContent,
          }),
        });
        expect(saveRes.status).toBe(200);

        // Read back to verify
        const after = await fetch(
          `${BASE_URL}/api/demo?name=hello-world`,
        );
        const afterDetail: DemoDetail = await after.json();
        expect(afterDetail.voScript).toBe(testContent);
        expect(afterDetail.hasVoScript).toBe(true);
      } finally {
        // Restore original content
        if (originalContent !== null) {
          await fetch(`${BASE_URL}/api/save-vo-script`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              scenario: 'hello-world',
              content: originalContent,
            }),
          });
        }
      }
    });

    it('returns 400 for missing scenario', async () => {
      const res = await fetch(`${BASE_URL}/api/save-vo-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'test' }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/generate/status', () => {
    it('returns idle when nothing is generating', async () => {
      const res = await fetch(`${BASE_URL}/api/generate/status`);
      expect(res.status).toBe(200);
      const status: GenerateStatus = await res.json();
      expect(status.status).toBe('idle');
    });
  });

  describe('POST /api/generate', () => {
    it('returns 202 when starting generation', async () => {
      const res = await fetch(`${BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: 'hello-world',
          tier: 'silent',
        }),
      });
      expect(res.status).toBe(202);
      const body: GenerateStatus = await res.json();
      expect(body.status).toBe('generating');
      expect(body.scenario).toBe('hello-world');

      // Wait for generation to complete so it does not interfere
      // with the next test. Poll status with backoff.
      let attempts = 0;
      while (attempts < 60) {
        await new Promise((r) => setTimeout(r, 2000));
        const statusRes = await fetch(
          `${BASE_URL}/api/generate/status`,
        );
        const status: GenerateStatus = await statusRes.json();
        if (status.status !== 'generating') break;
        attempts++;
      }
    });

    it('returns 409 when generation is already in progress', async () => {
      // Start a generation
      const first = await fetch(`${BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: 'hello-world',
          tier: 'silent',
        }),
      });
      expect(first.status).toBe(202);

      // Immediately try to start another
      const second = await fetch(`${BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: 'hello-world',
          tier: 'silent',
        }),
      });
      expect(second.status).toBe(409);

      // Wait for the first generation to finish
      let attempts = 0;
      while (attempts < 60) {
        await new Promise((r) => setTimeout(r, 2000));
        const statusRes = await fetch(
          `${BASE_URL}/api/generate/status`,
        );
        const status: GenerateStatus = await statusRes.json();
        if (status.status !== 'generating') break;
        attempts++;
      }
    });
  });
});
