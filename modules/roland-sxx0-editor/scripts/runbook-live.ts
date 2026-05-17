#!/usr/bin/env tsx

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

export interface RunbookLiveTarget {
  id: string;
  title: string;
  specs: string[];
  hardwareRequired: true;
}

const moduleRoot = process.cwd();

export const RUNBOOK_LIVE_TARGETS: readonly RunbookLiveTarget[] = [
  {
    id: '2.3',
    title: 'Re-run live Tones conformance for #428',
    specs: ['test/e2e/s550-D-TONE-live-envelope-and-slider.spec.ts'],
    hardwareRequired: true,
  },
  {
    id: '2.4-library',
    title: 'Capture live diagnostic evidence for #430',
    specs: ['test/e2e/s550-D-LIB-live-core.spec.ts'],
    hardwareRequired: true,
  },
  {
    id: '2.4-patches',
    title: 'Capture live diagnostic evidence for #431',
    specs: ['test/e2e/s550-D-PATCH-live-core.spec.ts'],
    hardwareRequired: true,
  },
  {
    id: '2.4',
    title: 'Capture live diagnostic evidence for #430 and #431',
    specs: [
      'test/e2e/s550-D-LIB-live-core.spec.ts',
      'test/e2e/s550-D-PATCH-live-core.spec.ts',
    ],
    hardwareRequired: true,
  },
] as const;

export function resolveTarget(raw: string | undefined): RunbookLiveTarget | null {
  if (!raw) {
    return null;
  }

  const normalized = raw.trim().toLowerCase();
  const aliases: Record<string, string> = {
    'runbook-2.3': '2.3',
    'runbook-2.4': '2.4',
    'runbook-2.4-library': '2.4-library',
    'runbook-2.4-patches': '2.4-patches',
    'live-s550-tones-001': '2.3',
    'live-s550-lib-002': '2.4-library',
    'live-s550-patch-001': '2.4-patches',
    '#428': '2.3',
    '#430': '2.4-library',
    '#431': '2.4-patches',
  };
  const id = aliases[normalized] ?? normalized;
  return RUNBOOK_LIVE_TARGETS.find((target) => target.id === id) ?? null;
}

export function getRequestedSection(argv: string[]): string | undefined {
  const candidate = argv[2];
  if (candidate === '--') {
    return argv[3];
  }
  return candidate;
}

function printUsage(): void {
  process.stdout.write('Usage: pnpm test:runbook:live -- <section>\n\n');
  process.stdout.write('Available runbook live sections:\n');
  for (const target of RUNBOOK_LIVE_TARGETS) {
    process.stdout.write(`  ${target.id.padEnd(12)} ${target.title}\n`);
  }
}

function runTarget(target: RunbookLiveTarget): number {
  const scriptPath = resolve(moduleRoot, 'scripts/run-http-midi-e2e.sh');
  const env = {
    ...process.env,
    E2E_DEVICE_TYPE: process.env.E2E_DEVICE_TYPE ?? 's550',
    PLAYWRIGHT_CONFIG:
      process.env.PLAYWRIGHT_CONFIG ?? 'playwright.s550-conformance.config.ts',
  };

  process.stdout.write(`[runbook-live] Section ${target.id}: ${target.title}\n`);
  process.stdout.write(
    `[runbook-live] Specs: ${target.specs.join(', ')}\n[runbook-live] Device type: ${env.E2E_DEVICE_TYPE}\n`,
  );

  for (const spec of target.specs) {
    const result = spawnSync(scriptPath, [spec], {
      cwd: moduleRoot,
      env,
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      return result.status ?? 1;
    }
  }

  return 0;
}

function main(): void {
  const arg = getRequestedSection(process.argv);

  if (!arg || arg === '--list') {
    printUsage();
    process.exit(arg ? 0 : 1);
  }

  const target = resolveTarget(arg);
  if (!target) {
    process.stderr.write(`[runbook-live] Unknown section: ${arg}\n`);
    printUsage();
    process.exit(1);
  }

  process.exit(runTarget(target));
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
const scriptPath = resolve(moduleRoot, 'scripts/runbook-live.ts');
if (invokedPath === scriptPath) {
  main();
}
