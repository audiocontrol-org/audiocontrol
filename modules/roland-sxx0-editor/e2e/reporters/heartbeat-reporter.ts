/**
 * Heartbeat reporter for Playwright e2e tests.
 *
 * Writes a JSON heartbeat file on every test event to allow an external
 * watchdog process to detect stuck tests. The watchdog monitors the
 * heartbeat timestamp and kills the test runner if it becomes stale.
 *
 * Heartbeat file location: /tmp/e2e-heartbeat-{pid}.json
 * Format: { "timestamp": number, "event": string, "detail": string }
 */

import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
  TestStep,
} from '@playwright/test/reporter';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface HeartbeatData {
  timestamp: number;
  event: string;
  detail: string;
  pid: number;
}

/**
 * Custom Playwright reporter that writes heartbeat updates to a temp file.
 * This enables external watchdog processes to detect stuck tests.
 */
class HeartbeatReporter implements Reporter {
  private readonly heartbeatPath: string;

  constructor() {
    // Use env var if set (from run-hardware-e2e.sh), otherwise use PID
    const envPath = process.env.E2E_HEARTBEAT_FILE;
    this.heartbeatPath = envPath || path.join('/tmp', `e2e-heartbeat-${process.pid}.json`);
  }

  private writeHeartbeat(event: string, detail: string): void {
    const data: HeartbeatData = {
      timestamp: Date.now(),
      event,
      detail,
      pid: process.pid,
    };

    try {
      fs.writeFileSync(this.heartbeatPath, JSON.stringify(data, null, 2));
    } catch (error) {
      // Log but don't fail the test if heartbeat write fails
      console.error(`[heartbeat] Failed to write heartbeat: ${error}`);
    }
  }

  private cleanup(): void {
    try {
      if (fs.existsSync(this.heartbeatPath)) {
        fs.unlinkSync(this.heartbeatPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  onBegin(_config: FullConfig, _suite: Suite): void {
    this.writeHeartbeat('begin', 'Test suite starting');
    // Log heartbeat path so shell script can find it
    console.log(`[heartbeat] File: ${this.heartbeatPath}`);
  }

  onTestBegin(test: TestCase, _result: TestResult): void {
    this.writeHeartbeat('testBegin', `Starting: ${test.title}`);
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.writeHeartbeat(
      'testEnd',
      `Finished: ${test.title} (${result.status})`
    );
  }

  onStepBegin(test: TestCase, _result: TestResult, step: TestStep): void {
    this.writeHeartbeat('stepBegin', `${test.title}: ${step.title}`);
  }

  onStepEnd(test: TestCase, _result: TestResult, step: TestStep): void {
    this.writeHeartbeat('stepEnd', `${test.title}: ${step.title} completed`);
  }

  onEnd(_result: FullResult): void {
    this.writeHeartbeat('end', 'Test suite completed');
    this.cleanup();
  }

  async onExit(): Promise<void> {
    this.cleanup();
  }
}

export default HeartbeatReporter;
