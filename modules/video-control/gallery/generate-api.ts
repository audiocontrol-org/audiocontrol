import { readdirSync } from 'node:fs';
import { spawn, ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { PipelineStep, OutputTier, OverlayMode } from '@/types.js';

interface ScenarioInfo {
  name: string;
  description: string;
  mode: string;
  outputTier: string;
  file: string;
}

interface StepInfo {
  step: string;
  status: 'pending' | 'running' | 'done';
  startedAt: number | null;
  completedAt: number | null;
  elapsedMs: number | null;
}

type GenerateStatus =
  | { status: 'idle' }
  | {
      status: 'generating';
      scenario: string;
      currentStep: string;
      steps: StepInfo[];
      elapsedMs: number;
      estimatedRemainingMs: number | null;
    }
  | { status: 'complete'; scenario: string; elapsedMs: number }
  | { status: 'error'; scenario: string; error: string; elapsedMs: number };

/** Default durations per step (ms) used for ETA estimation */
const DEFAULT_STEP_DURATIONS: Record<PipelineStep, number> = {
  'launching-browser': 2000,
  'recording-scenario': 30000,
  'finalizing-video': 2000,
  'converting-mp4': 3000,
  'converting-gif': 5000,
  'generating-captions': 500,
  'generating-vo-script': 500,
  'burning-captions': 5000,
  'complete': 0,
};

const VALID_TIERS = new Set<OutputTier>(['silent', 'captioned', 'scripted']);
const VALID_OVERLAYS = new Set<OverlayMode>(['none', 'burned', 'both']);

function parseOutputTier(value: string): OutputTier {
  if (VALID_TIERS.has(value as OutputTier)) {
    return value as OutputTier;
  }
  throw new Error(`Invalid tier: ${value}. Must be one of: ${[...VALID_TIERS].join(', ')}`);
}

function parseOverlayMode(value: string): OverlayMode {
  if (VALID_OVERLAYS.has(value as OverlayMode)) {
    return value as OverlayMode;
  }
  throw new Error(`Invalid overlay: ${value}. Must be one of: ${[...VALID_OVERLAYS].join(', ')}`);
}

const MODULE_ROOT = resolve(__dirname, '..');
const SCENARIOS_DIR = resolve(MODULE_ROOT, 'scenarios');

let currentProcess: ChildProcess | null = null;
let lastStatus: GenerateStatus = { status: 'idle' };
let outputLines: string[] = [];
let generationStartedAt = 0;
let allSteps: StepInfo[] = [];

function buildStepsList(tier: OutputTier, overlay: OverlayMode): StepInfo[] {
  const steps: PipelineStep[] = [
    'launching-browser',
    'recording-scenario',
    'finalizing-video',
    'converting-mp4',
    'converting-gif',
  ];

  if (tier === 'captioned' || tier === 'scripted') {
    steps.push('generating-captions');
  }
  if (tier === 'scripted') {
    steps.push('generating-vo-script');
  }
  if (overlay === 'burned' || overlay === 'both') {
    steps.push('burning-captions');
  }

  steps.push('complete');

  return steps.map((step) => ({
    step,
    status: 'pending' as const,
    startedAt: null,
    completedAt: null,
    elapsedMs: null,
  }));
}

function estimateRemainingMs(steps: StepInfo[]): number | null {
  let remaining = 0;
  let hasRunning = false;

  for (const s of steps) {
    if (s.status === 'running') {
      hasRunning = true;
      const elapsed = s.startedAt !== null ? Date.now() - s.startedAt : 0;
      const defaultDuration = DEFAULT_STEP_DURATIONS[s.step as PipelineStep] ?? 0;
      remaining += Math.max(0, defaultDuration - elapsed);
    } else if (s.status === 'pending') {
      remaining += DEFAULT_STEP_DURATIONS[s.step as PipelineStep] ?? 0;
    }
  }

  return hasRunning ? remaining : null;
}

function handleStepMarker(stepName: string, scenario: string): void {
  const now = Date.now();

  // Mark the previous running step as done
  for (const s of allSteps) {
    if (s.status === 'running') {
      s.status = 'done';
      s.completedAt = now;
      s.elapsedMs = s.startedAt !== null ? now - s.startedAt : null;
    }
  }

  // Mark the new step as running
  const target = allSteps.find((s) => s.step === stepName);
  if (target) {
    target.status = 'running';
    target.startedAt = now;
  }

  lastStatus = {
    status: 'generating',
    scenario,
    currentStep: stepName,
    steps: allSteps,
    elapsedMs: now - generationStartedAt,
    estimatedRemainingMs: estimateRemainingMs(allSteps),
  };
}

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

function handleGenerate(body: { scenario: string; tier: string; overlay?: string }): {
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
  const tier = parseOutputTier(body.tier || 'scripted');
  const overlay = parseOverlayMode(body.overlay || 'none');

  outputLines = [];
  generationStartedAt = Date.now();
  allSteps = buildStepsList(tier, overlay);

  lastStatus = {
    status: 'generating',
    scenario: body.scenario,
    currentStep: 'pending',
    steps: allSteps,
    elapsedMs: 0,
    estimatedRemainingMs: estimateRemainingMs(allSteps),
  };

  const args = ['src/cli.ts', scenarioFile, 'about:blank', '--tier', tier];
  if (overlay !== 'none') {
    args.push('--overlay', overlay);
  }

  const child = spawn('tsx', args, {
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

    // Parse [STEP] markers
    for (const line of lines) {
      const match = line.match(/^\[STEP\]\s+(.+)$/);
      if (match) {
        handleStepMarker(match[1], body.scenario);
      }
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
    const elapsedMs = Date.now() - generationStartedAt;
    if (code === 0) {
      lastStatus = { status: 'complete', scenario: body.scenario, elapsedMs };
    } else {
      lastStatus = {
        status: 'error',
        scenario: body.scenario,
        error: outputLines.slice(-5).join('\n') || `Process exited with code ${code}`,
        elapsedMs,
      };
    }
  });

  child.on('error', (err) => {
    currentProcess = null;
    const elapsedMs = Date.now() - generationStartedAt;
    lastStatus = {
      status: 'error',
      scenario: body.scenario,
      error: err.message,
      elapsedMs,
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
      const body = JSON.parse(raw) as { scenario: string; tier: string; overlay?: string };
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
