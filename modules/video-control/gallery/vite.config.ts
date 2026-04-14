import { defineConfig, Plugin, ViteDevServer } from 'vite';
import { readdirSync, existsSync, statSync, createReadStream } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, join } from 'node:path';

interface DemoInfo {
  name: string;
  mp4Url: string;
  gifUrl: string | null;
  hasCaptions: boolean;
  hasVoScript: boolean;
  durationMs: number;
}

const DEMOS_DIR = resolve(__dirname, '../dist/demos');

function getDurationMs(mp4Path: string): number {
  try {
    const output = execSync(
      `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${mp4Path}"`,
      { encoding: 'utf-8' },
    ).trim();
    const seconds = parseFloat(output);
    if (isNaN(seconds)) return 0;
    return Math.round(seconds * 1000);
  } catch {
    return 0;
  }
}

function scanDemos(): DemoInfo[] {
  if (!existsSync(DEMOS_DIR)) return [];

  const entries = readdirSync(DEMOS_DIR, { withFileTypes: true });
  const demos: DemoInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const dir = join(DEMOS_DIR, entry.name);
    const mp4 = join(dir, 'video.mp4');
    if (!existsSync(mp4)) continue;

    demos.push({
      name: entry.name,
      mp4Url: `/videos/${entry.name}/video.mp4`,
      gifUrl: existsSync(join(dir, 'video.gif'))
        ? `/videos/${entry.name}/video.gif`
        : null,
      hasCaptions: existsSync(join(dir, 'captions.yaml')),
      hasVoScript: existsSync(join(dir, 'vo-script.txt')),
      durationMs: getDurationMs(mp4),
    });
  }

  return demos.sort((a, b) => a.name.localeCompare(b.name));
}

const MIME: Record<string, string> = {
  mp4: 'video/mp4',
  gif: 'image/gif',
  webm: 'video/webm',
  yaml: 'text/yaml',
  yml: 'text/yaml',
  txt: 'text/plain',
};

function galleryPlugin(): Plugin {
  return {
    name: 'gallery-api-and-videos',
    configureServer(server: ViteDevServer) {
      // JSON API
      server.middlewares.use('/api/demos', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(scanDemos()));
      });

      // Static video files
      server.middlewares.use('/videos', (req, res, next) => {
        if (!req.url) { next(); return; }

        const filePath = join(DEMOS_DIR, req.url);
        if (!existsSync(filePath) || !statSync(filePath).isFile()) {
          next();
          return;
        }

        const ext = filePath.split('.').pop() ?? '';
        res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream');
        createReadStream(filePath).pipe(res);
      });
    },
  };
}

export default defineConfig({
  root: __dirname,
  server: { port: 4200 },
  plugins: [galleryPlugin()],
  publicDir: false,
});
