#!/usr/bin/env tsx
/**
 * Validates the SCSI MIDI bridge is running and the sampler is reachable.
 * Called by run-scsi-midi-e2e.sh after deploying and starting services.
 *
 * Usage: tsx validate-scsi-bridge.ts [bridge-url]
 * Default bridge URL: http://s3k.local:7033
 *
 * Outputs JSON on success: {"found": true, "bridgeUrl": "...", "version": "..."}
 * Exit code 0 = sampler reachable, 1 = not reachable
 */

const bridgeUrl =
  process.argv[2] ||
  process.env.E2E_SCSI_BRIDGE_URL ||
  'http://s3k.local:7033';

interface BridgeStatus {
  version: string;
  scsi2piVersion: string;
  boardId: number;
  samplerReachable: boolean;
}

async function main(): Promise<void> {
  try {
    const res = await fetch(`${bridgeUrl}/status`);
    if (!res.ok) {
      console.error(`Bridge returned HTTP ${res.status}`);
      process.exit(1);
    }

    const status: BridgeStatus = await res.json();

    if (!status.samplerReachable) {
      console.error('Bridge is running but sampler is not reachable');
      console.error('Ensure the S3000XL is powered on and connected via SCSI');
      process.exit(1);
    }

    console.log(
      JSON.stringify({
        found: true,
        bridgeUrl,
        version: status.version,
        scsi2piVersion: status.scsi2piVersion,
      })
    );
  } catch (err) {
    console.error(`Cannot reach bridge at ${bridgeUrl}: ${err}`);
    process.exit(1);
  }
}

main();
