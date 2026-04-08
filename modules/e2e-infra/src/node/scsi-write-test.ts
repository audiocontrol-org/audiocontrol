#!/usr/bin/env tsx
/**
 * SCSI Write Validation CLI Test Harness
 *
 * Thin CLI that talks directly to the SCSI bridge, bypassing the
 * browser/React/Playwright layers entirely. Tests whether writes to
 * the Akai S3000XL persist through the SCSI transport chain.
 *
 * Usage:
 *   pnpm --filter @audiocontrol/e2e-infra scsi-write-test -- --bridge-url http://s3k.local:7033
 *   pnpm --filter @audiocontrol/e2e-infra scsi-write-test -- --bridge-url http://s3k.local:7033 --verbose
 *   pnpm --filter @audiocontrol/e2e-infra scsi-write-test -- --bridge-url http://s3k.local:7033 --test connect
 */

import { createScsiMidiTransport } from '@audiocontrol/midi-core';
import type { MidiIO } from '@audiocontrol/midi-core';
import { createS3000xlClient } from '@audiocontrol/sampler-devices/s3k';
import { createLoggingMidiIO } from '@/node/lib/logging-midi-io.js';
import { runConnectionTests } from '@/node/lib/test-connection.js';
import { runReadTests } from '@/node/lib/test-reads.js';
import { runWriteTests } from '@/node/lib/test-writes.js';
import { runAllFieldTests } from '@/node/lib/test-all-fields.js';
import { runStructureTests } from '@/node/lib/test-structure.js';
import { runMultiTests } from '@/node/lib/test-multi.js';
import { runLatencyTests } from '@/node/lib/test-latency.js';
import { runStreamingTests } from '@/node/lib/test-streaming.js';
import { runSdsTests } from '@/node/lib/test-sds.js';
import { runScsiSdsTransferTests } from '@/node/lib/test-scsi-sds-transfer.js';
import { runDiskWriteTests } from '@/node/lib/test-disk-write.js';
import type { TestContext, TestResult } from '@/node/lib/test-types.js';

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  bridgeUrl?: string;
  channel: number;
  test?: string;
  verbose: boolean;
  noRestore: boolean;
  writeDelayMs: number;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const parsed: CliArgs = {
    channel: 0,
    verbose: false,
    noRestore: false,
    writeDelayMs: 500,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--bridge-url':
        parsed.bridgeUrl = args[++i];
        break;
      case '--channel':
        parsed.channel = parseInt(args[++i], 10);
        break;
      case '--test':
        parsed.test = args[++i];
        break;
      case '--verbose':
        parsed.verbose = true;
        break;
      case '--no-restore':
        parsed.noRestore = true;
        break;
      case '--write-delay':
        parsed.writeDelayMs = parseInt(args[++i], 10);
        break;
      case '--help':
        printUsage();
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument: ${args[i]}`);
        printUsage();
        process.exit(1);
    }
  }

  if (!parsed.bridgeUrl) {
    console.error('Error: --bridge-url is required');
    printUsage();
    process.exit(1);
  }

  return parsed;
}

function printUsage(): void {
  console.log(`
Usage: tsx src/node/scsi-write-test.ts [options]

Options:
  --bridge-url <url>   SCSI bridge URL (e.g., http://s3k.local:7033)
  --channel <n>        SysEx channel (default: 0)
  --test <name>        Run a specific test or group (default: all)
  --verbose            Log all SysEx bytes sent/received
  --no-restore         Skip restoring original values after write tests
  --write-delay <ms>   Delay between write and readback (default: 500)
  --help               Show this help

Available tests:
  Connection:  connect, scan
  Reads:       read-program-names, read-sample-names, read-program-header,
               read-keygroup-header, read-sample-header
  Writes:      write-program-name, write-polyphony, write-filter-freq,
               write-sample-name
  All Fields:  (runs all 248 field write-readback tests)
  SDS:         sds-round-trip
  SCSI SDS:    scsi-sds-download
  Disk Write:  disk-write-round-trip

Test groups:  connection, reads, writes, all-fields, sds, scsi-sds-transfer, disk-write, all
`);
}

// ---------------------------------------------------------------------------
// Test registry
// ---------------------------------------------------------------------------

interface TestGroup {
  name: string;
  run: (ctx: TestContext) => Promise<TestResult[]>;
}

const TEST_GROUPS: TestGroup[] = [
  { name: 'connection', run: runConnectionTests },
  { name: 'reads', run: runReadTests },
  { name: 'writes', run: runWriteTests },
  { name: 'all-fields', run: runAllFieldTests },
  { name: 'structure', run: runStructureTests },
  { name: 'multi', run: runMultiTests },
  { name: 'latency', run: runLatencyTests },
  { name: 'streaming', run: runStreamingTests },
  { name: 'sds', run: runSdsTests },
  { name: 'scsi-sds-transfer', run: runScsiSdsTransferTests },
  { name: 'disk-write', run: runDiskWriteTests },
];

const TEST_NAME_TO_GROUP: Record<string, string> = {
  'connect': 'connection',
  'scan': 'connection',
  'read-program-names': 'reads',
  'read-sample-names': 'reads',
  'read-program-header': 'reads',
  'read-keygroup-header': 'reads',
  'read-sample-header': 'reads',
  'write-program-name': 'writes',
  'write-polyphony': 'writes',
  'write-filter-freq': 'writes',
  'write-sample-name': 'writes',
  'sds-round-trip': 'sds',
  'scsi-sds-download': 'scsi-sds-transfer',
  'scsi-sds-round-trip': 'scsi-sds-transfer',
  'disk-write-round-trip': 'disk-write',
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs();

  console.log('=== SCSI Write Validation Test Harness ===\n');
  console.log(`Transport: SCSI bridge`);
  console.log(`URL: ${args.bridgeUrl}`);
  console.log(`Channel: ${args.channel}`);
  console.log(`Cache: DISABLED (noCache: true)`);
  console.log(`Write delay: ${args.writeDelayMs}ms`);
  console.log(`Verbose: ${args.verbose}`);
  console.log('');

  const scsi = createScsiMidiTransport({ bridgeUrl: args.bridgeUrl! });
  let midiIO: MidiIO = scsi.adapter;

  if (args.verbose) {
    midiIO = createLoggingMidiIO(midiIO);
  }

  const client = createS3000xlClient(midiIO, {
    channel: args.channel,
    noCache: true,
    writeFlushDelayMs: 0, // Flush immediately — we manage timing ourselves
    sdsChannel: scsi.sdsChannel, // Use dedicated WebSocket SDS channel
  });

  const ctx: TestContext = {
    client,
    midiIO,
    bridgeUrl: args.bridgeUrl!,
    verbose: args.verbose,
    noRestore: args.noRestore,
    writeDelayMs: args.writeDelayMs,
    log: (msg: string) => console.log(msg),
  };

  // Determine which tests to run
  let groupsToRun: TestGroup[];
  let singleTestName: string | undefined;

  if (!args.test || args.test === 'all') {
    groupsToRun = TEST_GROUPS;
  } else if (TEST_GROUPS.some((g) => g.name === args.test)) {
    groupsToRun = TEST_GROUPS.filter((g) => g.name === args.test);
  } else if (TEST_NAME_TO_GROUP[args.test]) {
    const groupName = TEST_NAME_TO_GROUP[args.test];
    groupsToRun = TEST_GROUPS.filter((g) => g.name === groupName);
    singleTestName = args.test;
  } else {
    console.error(`Unknown test: ${args.test}`);
    process.exit(1);
  }

  // Run tests
  const allResults: TestResult[] = [];

  for (const group of groupsToRun) {
    console.log(`--- ${group.name} ---`);
    const results = await group.run(ctx);

    for (const r of results) {
      if (singleTestName && r.name !== singleTestName) continue;
      allResults.push(r);
      console.log(`  [${r.status}] ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
    }
    console.log('');
  }

  // Summary
  scsi.disconnect();

  const passed = allResults.filter((r) => r.status === 'PASS').length;
  const failed = allResults.filter((r) => r.status === 'FAIL').length;
  const errors = allResults.filter((r) => r.status === 'ERROR').length;

  console.log('=== Summary ===');
  console.log(`  ${passed} passed, ${failed} failed, ${errors} errors (${allResults.length} total)`);

  if (failed > 0 || errors > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
