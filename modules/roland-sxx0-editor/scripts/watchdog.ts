#!/usr/bin/env tsx
/**
 * Watchdog process for e2e tests.
 *
 * Monitors a heartbeat file and kills the test runner if the heartbeat
 * becomes stale (older than the configured threshold). This prevents
 * tests from hanging indefinitely when they get stuck.
 *
 * Usage: tsx scripts/watchdog.ts <runner-pid> <heartbeat-file>
 *
 * Exit codes:
 *   0 - Runner exited normally
 *   1 - Stuck test detected, runner killed
 *   2 - Invalid arguments
 */

import * as fs from 'node:fs';

const POLL_INTERVAL_MS = 500;
const STALE_THRESHOLD_MS = 90000; // MIDI SysEx transfers to vintage hardware can take 60s+

interface HeartbeatData {
  timestamp: number;
  event: string;
  detail: string;
  pid: number;
}

function parseArgs(): { runnerPid: number; heartbeatPath: string } {
  const args = process.argv.slice(2);

  if (args.length !== 2) {
    console.error('Usage: tsx scripts/watchdog.ts <runner-pid> <heartbeat-file>');
    process.exit(2);
  }

  const runnerPid = parseInt(args[0], 10);
  const heartbeatPath = args[1];

  if (isNaN(runnerPid) || runnerPid <= 0) {
    console.error(`Invalid runner PID: ${args[0]}`);
    process.exit(2);
  }

  return { runnerPid, heartbeatPath };
}

function isProcessAlive(pid: number): boolean {
  try {
    // Signal 0 doesn't kill but checks if process exists
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readHeartbeat(path: string): HeartbeatData | null {
  try {
    if (!fs.existsSync(path)) {
      return null;
    }
    const content = fs.readFileSync(path, 'utf-8');
    return JSON.parse(content) as HeartbeatData;
  } catch {
    return null;
  }
}

function killProcess(pid: number): void {
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // Process may have already exited
  }
}

function main(): void {
  const { runnerPid, heartbeatPath } = parseArgs();

  console.log(`[watchdog] Monitoring PID ${runnerPid}`);
  console.log(`[watchdog] Heartbeat file: ${heartbeatPath}`);
  console.log(`[watchdog] Stale threshold: ${STALE_THRESHOLD_MS}ms`);

  // Wait for heartbeat file to appear (give tests time to start)
  let waitAttempts = 0;
  const maxWaitAttempts = 20; // 10 seconds

  const waitForHeartbeat = setInterval(() => {
    waitAttempts++;

    // Check if runner died before producing heartbeat
    if (!isProcessAlive(runnerPid)) {
      console.log('[watchdog] Runner exited before heartbeat appeared');
      clearInterval(waitForHeartbeat);
      process.exit(0);
    }

    if (fs.existsSync(heartbeatPath)) {
      console.log('[watchdog] Heartbeat file detected, starting monitoring');
      clearInterval(waitForHeartbeat);
      startMonitoring(runnerPid, heartbeatPath);
      return;
    }

    if (waitAttempts >= maxWaitAttempts) {
      console.error('[watchdog] Heartbeat file never appeared, killing runner');
      killProcess(runnerPid);
      clearInterval(waitForHeartbeat);
      process.exit(1);
    }
  }, POLL_INTERVAL_MS);
}

function startMonitoring(runnerPid: number, heartbeatPath: string): void {
  const monitor = setInterval(() => {
    // Check if runner is still alive
    if (!isProcessAlive(runnerPid)) {
      console.log('[watchdog] Runner exited normally');
      clearInterval(monitor);
      process.exit(0);
    }

    // Read heartbeat
    const heartbeat = readHeartbeat(heartbeatPath);

    if (!heartbeat) {
      // Heartbeat file was cleaned up - runner finished
      console.log('[watchdog] Heartbeat file removed, runner completed');
      clearInterval(monitor);
      process.exit(0);
    }

    // Check if heartbeat is stale
    const age = Date.now() - heartbeat.timestamp;

    if (age > STALE_THRESHOLD_MS) {
      console.error(`[watchdog] STUCK TEST DETECTED`);
      console.error(`[watchdog] Last heartbeat: ${age}ms ago`);
      console.error(`[watchdog] Last event: ${heartbeat.event}`);
      console.error(`[watchdog] Detail: ${heartbeat.detail}`);
      console.error(`[watchdog] Killing runner PID ${runnerPid}`);

      killProcess(runnerPid);
      clearInterval(monitor);
      process.exit(1);
    }
  }, POLL_INTERVAL_MS);
}

main();
