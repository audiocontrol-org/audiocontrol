import { existsSync, statSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFile, execSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

const MODULE_ROOT = resolve(__dirname, '..');

function sendJson(
  res: ServerResponse,
  statusCode: number,
  data: unknown,
): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

function isPathSafe(name: string): boolean {
  return !name.includes('/') && !name.includes('..') && !name.includes('\\');
}

function handleOpenFolderRequest(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  readBody(req)
    .then((raw) => {
      const body = JSON.parse(raw) as { scenario: string };
      if (!body.scenario) {
        sendJson(res, 400, { error: 'Missing "scenario" field' });
        return;
      }
      if (!isPathSafe(body.scenario)) {
        sendJson(res, 400, { error: 'Invalid scenario name' });
        return;
      }
      const folderPath = resolve(MODULE_ROOT, 'dist/demos', body.scenario);
      if (!existsSync(folderPath) || !statSync(folderPath).isDirectory()) {
        sendJson(res, 404, { error: `Scenario folder not found: ${body.scenario}` });
        return;
      }
      execFile('open', [folderPath], (err) => {
        if (err) {
          sendJson(res, 500, { error: err.message });
          return;
        }
        sendJson(res, 200, { ok: true });
      });
    })
    .catch((err: Error) =>
      sendJson(res, 400, { error: err.message }),
    );
}

function handleOpenFileRequest(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  readBody(req)
    .then((raw) => {
      const body = JSON.parse(raw) as { scenario: string; file: string };
      if (!body.scenario || !body.file) {
        sendJson(res, 400, { error: 'Missing "scenario" or "file" field' });
        return;
      }
      if (!isPathSafe(body.scenario) || !isPathSafe(body.file)) {
        sendJson(res, 400, { error: 'Invalid scenario or file name' });
        return;
      }
      const filePath = resolve(MODULE_ROOT, 'dist/demos', body.scenario, body.file);
      if (!existsSync(filePath) || !statSync(filePath).isFile()) {
        sendJson(res, 404, { error: `File not found: ${body.scenario}/${body.file}` });
        return;
      }
      execFile('open', [filePath], (err) => {
        if (err) {
          sendJson(res, 500, { error: err.message });
          return;
        }
        sendJson(res, 200, { ok: true });
      });
    })
    .catch((err: Error) =>
      sendJson(res, 400, { error: err.message }),
    );
}

interface FileInfo {
  name: string;
  size: number;
}

function handleDemoDetailRequest(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  const url = new URL(req.url ?? '', 'http://localhost');
  const name = url.searchParams.get('name');
  if (!name || !isPathSafe(name)) {
    sendJson(res, 400, { error: 'Missing or invalid "name" param' });
    return;
  }

  const dir = resolve(MODULE_ROOT, 'dist/demos', name);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    sendJson(res, 404, { error: `Scenario not found: ${name}` });
    return;
  }

  const mp4Path = resolve(dir, 'video.mp4');
  const hasMp4 = existsSync(mp4Path);
  const hasGif = existsSync(resolve(dir, 'video.gif'));
  const hasCaptions = existsSync(resolve(dir, 'captions.yaml'));
  const hasCaptionedMp4 = existsSync(resolve(dir, 'video-captioned.mp4'));
  const hasVoScript = existsSync(resolve(dir, 'vo-script.txt'));

  let durationMs = 0;
  if (hasMp4) {
    try {
      const out = execSync(
        `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${mp4Path}"`,
        { encoding: 'utf-8' },
      ).trim();
      const sec = parseFloat(out);
      if (!isNaN(sec)) durationMs = Math.round(sec * 1000);
    } catch { /* ffprobe not available */ }
  }

  const files: FileInfo[] = readdirSync(dir)
    .filter((f) => !f.startsWith('.'))
    .map((f) => ({ name: f, size: statSync(resolve(dir, f)).size }));

  const captionsYaml = hasCaptions
    ? readFileSync(resolve(dir, 'captions.yaml'), 'utf-8')
    : null;
  const voScript = hasVoScript
    ? readFileSync(resolve(dir, 'vo-script.txt'), 'utf-8')
    : null;

  sendJson(res, 200, {
    name,
    mp4Url: hasMp4 ? `/videos/${name}/video.mp4` : null,
    gifUrl: hasGif ? `/videos/${name}/video.gif` : null,
    hasCaptions,
    hasCaptionedMp4,
    hasVoScript,
    durationMs,
    files,
    captionsYaml,
    voScript,
  });
}

function handleSaveCaptionsRequest(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  readBody(req)
    .then((raw) => {
      const body = JSON.parse(raw) as { scenario: string; content: string };
      if (!body.scenario || typeof body.content !== 'string') {
        sendJson(res, 400, { error: 'Missing "scenario" or "content"' });
        return;
      }
      if (!isPathSafe(body.scenario)) {
        sendJson(res, 400, { error: 'Invalid scenario name' });
        return;
      }
      const filePath = resolve(MODULE_ROOT, 'dist/demos', body.scenario, 'captions.yaml');
      writeFileSync(filePath, body.content, 'utf-8');
      sendJson(res, 200, { ok: true });
    })
    .catch((err: Error) => sendJson(res, 400, { error: err.message }));
}

function handleSaveVoScriptRequest(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  readBody(req)
    .then((raw) => {
      const body = JSON.parse(raw) as { scenario: string; content: string };
      if (!body.scenario || typeof body.content !== 'string') {
        sendJson(res, 400, { error: 'Missing "scenario" or "content"' });
        return;
      }
      if (!isPathSafe(body.scenario)) {
        sendJson(res, 400, { error: 'Invalid scenario name' });
        return;
      }
      const filePath = resolve(MODULE_ROOT, 'dist/demos', body.scenario, 'vo-script.txt');
      writeFileSync(filePath, body.content, 'utf-8');
      sendJson(res, 200, { ok: true });
    })
    .catch((err: Error) => sendJson(res, 400, { error: err.message }));
}

export {
  handleOpenFolderRequest,
  handleOpenFileRequest,
  handleDemoDetailRequest,
  handleSaveCaptionsRequest,
  handleSaveVoScriptRequest,
};
