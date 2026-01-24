/**
 * Test function parameter writes on Roland S-330
 *
 * Verifies that WSD/DAT/EOD protocol works for function parameter writes
 * using the S330Client API. Tests that writes persist to hardware.
 *
 * Context from testing (January 2026):
 * - DT1 does NOT work for function parameters (silently ignored)
 * - WSD/DAT/EOD with address+size format works
 * - Must write all 8 values in a parameter group (size >= 8)
 * - Address format: 00 01 00 xx for function parameters
 */

import easymidi from 'easymidi';
import type { SysExCallback, S330MidiIO } from '../../../s330-editor/src/core/midi/types';
import { createS330Client } from '../../../s330-editor/src/core/midi/S330Client';


function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createEasymidiAdapter(
  input: easymidi.Input,
  output: easymidi.Output
): S330MidiIO {
  const listeners = new Map<SysExCallback, (msg: { bytes: number[] }) => void>();

  return {
    send(message: number[]): void {
      output.send('sysex', message);
    },
    onSysEx(callback: SysExCallback): void {
      const listener = (msg: { bytes: number[] }) => {
        callback(msg.bytes);
      };
      listeners.set(callback, listener);
      input.on('sysex', listener);
    },
    removeSysExListener(callback: SysExCallback): void {
      const listener = listeners.get(callback);
      if (listener) {
        input.removeListener('sysex', listener);
        listeners.delete(callback);
      }
    },
  };
}


async function main() {
  console.log('=== S-330 Function Parameter Write Test ===\n');
  console.log('Testing WSD/DAT/EOD protocol via S330Client.setMultiPatch()\n');

  const input = new easymidi.Input('Volt 4');
  const output = new easymidi.Output('Volt 4');

  const adapter = createEasymidiAdapter(input, output);
  const client = createS330Client(adapter, { deviceId: 0 });

  try {
    await client.connect();
    console.log('Connected to S-330\n');

    // Test: Write Part A patch index using S330Client.setMultiPatch
    console.log('=== Test: Part A Patch Assignment via S330Client ===');

    // Read original value
    console.log('\n1. Reading original value...');
    const originalData = await client.requestDataWithAddress([0x00, 0x01, 0x00, 0x32], 1);
    const originalPatch = originalData[0] ?? 0;
    console.log(`   Original patch index: ${originalPatch} (P${originalPatch + 11})`);

    const newPatch = originalPatch === 1 ? 2 : 1;

    // Write using S330Client.setMultiPatch (uses WSD/DAT/EOD internally)
    console.log(`\n2. Writing patch via client.setMultiPatch(0, ${newPatch})...`);
    await client.setMultiPatch(0, newPatch);
    console.log('   Write complete');

    // Wait for S-330 to process the change
    console.log('\n3. Waiting 500ms for S-330 to process...');
    await delay(500);

    // Read back and verify
    console.log('\n4. Reading back to verify...');
    const readbackData = await client.requestDataWithAddress([0x00, 0x01, 0x00, 0x32], 1);
    const readbackPatch = readbackData[0] ?? 0;
    console.log(`   Read back patch index: ${readbackPatch} (P${readbackPatch + 11})`);

    // Compare
    console.log('\n=== RESULT ===');
    if (readbackPatch === newPatch) {
      console.log(`✅ SUCCESS! Write persisted: ${originalPatch} → ${newPatch}`);
    } else {
      console.log(`❌ FAILED! Write did NOT persist`);
      console.log(`   Wrote: ${newPatch}`);
      console.log(`   Read:  ${readbackPatch}`);
    }

    // Restore original value
    console.log(`\n5. Restoring original value: ${originalPatch}...`);
    await client.setMultiPatch(0, originalPatch);
    await delay(200);

    console.log('\n=== Test complete ===');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    input.close();
    output.close();
  }
}

main();
