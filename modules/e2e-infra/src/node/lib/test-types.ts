/**
 * Shared types for the SCSI write validation test harness.
 */

import type { MidiIO } from '@audiocontrol/midi-core';
import type { S3000xlClientInterface } from '@audiocontrol/sampler-devices/s3k';

export interface TestContext {
  client: S3000xlClientInterface;
  midiIO: MidiIO;
  bridgeUrl: string;
  verbose: boolean;
  noRestore: boolean;
  writeDelayMs: number;
  log: (msg: string) => void;
}

export type TestStatus = 'PASS' | 'FAIL' | 'ERROR' | 'SKIP';

export interface TestResult {
  name: string;
  status: TestStatus;
  detail?: string;
}
