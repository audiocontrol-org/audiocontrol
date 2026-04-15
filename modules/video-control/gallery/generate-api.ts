import { readdirSync } from 'node:fs';
import { spawn, ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

interface ScenarioInfo {
  name: string;
  description: string;
  mode: string;
  outputTier: string;
  file: string;
}

type GenerateStatus =
  | { status: 'idle' }
  | { status: 'generating'; scenario: string; output: string }
  | { status: 'complete'; scenario: string }
  | { status: 'error'; scenario: string; error: string };

const MODULE_ROOT = resolve(__dirname, '..');
const SCENARIOS_DIR = resolve(MODULE_ROOT, 'scenarios');

let currentProcess: ChildProcess | null = null;
let lastStatus: GenerateStatus = { status: 'idle' };
let outputLines: string[] = [];

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

async function scanScenarios(): Promise<ScenarioInfo[]> {
  const files = readdirSync(SCENARIOS_DIR).filter((f) => f.endsWith('.ts'));
  const scenarios: ScenarioInfo[] = [];

  for (const file of files) {
    const filePath = resolve(SCENARIOS_DIR, file);
    const mod: Record<string, unknown> = await import(filePath);
    const metadata = mod['metadata'] as
      | { name: string; description: string; mode: string; outputTier: string }
      | undefined;

    if (metadata && typeof metadata.name === 'string') {
      scenarios.push({
        name: metadata.name,
        description: metadata.description,
        mode: metadata.mode,
        outputTier: metadata.outputTier,
        file,
      });
    }
  }

  return scenarios.sort((a, b) => a.name.localeCompare(b.name));
}

function handleGenerate(body: { scenario: string; tier: string }): {
  status: number;
  json: Record<string, string>;
} {
  if (currentProcess) {
    return {
      status: 409,
      json: {
        error: 'Generation already in progress',
        scenario:
          lastStatus.status === 'generating' ? lastStatus.scenario : 'unknown',
      },
    };
  }

  const scenarioFile = `scenarios/${body.scenario}.ts`;
  const tier = body.tier || 'scripted';

  outputLines = [];
  lastStatus = { status: 'generating', scenario: body.scenario, output: '' };

  const child = spawn('tsx', ['src/cli.ts', scenarioFile, 'about:blank', '--tier', tier], {
    cwd: MODULE_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  currentProcess = child;

  child.stdout.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean);
    outputLines.push(...lines);
    if (outputLines.length > 50) {
      outputLines = outputLines.slice(-50);
    }
    if (lastStatus.status === 'generating') {
      lastStatus = {
        status: 'generating',
        scenario: body.scenario,
        output: outputLines.slice(-10).join('\n'),
      };
    }
  });

  child.stderr.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean);
    outputLines.push(...lines);
    if (outputLines.length > 50) {
      outputLines = outputLines.slice(-50);
    }
  });

  child.on('close', (code) => {
    currentProcess = null;
    if (code === 0) {
      lastStatus = { status: 'complete', scenario: body.scenario };
    } else {
      lastStatus = {
        status: 'error',
        scenario: body.scenario,
        error: outputLines.slice(-5).join('\n') || `Process exited with code ${code}`,
      };
    }
  });

  child.on('error', (err) => {
    currentProcess = null;
    lastStatus = {
      status: 'error',
      scenario: body.scenario,
      error: err.message,
    };
  });

  return {
    status: 202,
    json: { status: 'generating', scenario: body.scenario },
  };
}

function sendJson(
  res: ServerResponse,
  statusCode: number,
  data: unknown,
): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function handleScenariosRequest(
  _req: IncomingMessage,
  res: ServerResponse,
): void {
  scanScenarios()
    .then((scenarios) => sendJson(res, 200, scenarios))
    .catch((err: Error) =>
      sendJson(res, 500, { error: err.message }),
    );
}

function handleGenerateRequest(
  req: IncomingMessage,
  res: ServerResponse,
): void {
  readBody(req)
    .then((raw) => {
      const body = JSON.parse(raw) as { scenario: string; tier: string };
      if (!body.scenario) {
        sendJson(res, 400, { error: 'Missing "scenario" field' });
        return;
      }
      const result = handleGenerate(body);
      sendJson(res, result.status, result.json);
    })
    .catch((err: Error) =>
      sendJson(res, 400, { error: err.message }),
    );
}

function handleStatusRequest(
  _req: IncomingMessage,
  res: ServerResponse,
): void {
  sendJson(res, 200, lastStatus);
}

export { handleScenariosRequest, handleGenerateRequest, handleStatusRequest };
