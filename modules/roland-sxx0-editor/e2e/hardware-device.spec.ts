/**
 * Hardware e2e tests for Roland S-series device connectivity.
 *
 * Short timeouts with fast-fail behavior to detect blocked tests quickly.
 */

import { test, expect } from '@playwright/test';

// Short timeouts - fail fast
test.setTimeout(10_000);

const MIDI_PORT = process.env.E2E_MIDI_PORT;
const DEVICE_ID = parseInt(process.env.E2E_DEVICE_ID || '0', 10);

// S-series protocol constants
const ROLAND_ID = 0x41;
const S_SERIES_MODEL_ID = 0x1E;
const RQD_COMMAND = 0x41;

test.describe('Device Connectivity', () => {
  test('Web MIDI API is available', async ({ page }) => {
    await page.goto('/', { timeout: 5000 });

    const hasMidi = await page.evaluate(() => 'requestMIDIAccess' in navigator);
    expect(hasMidi).toBe(true);
  });

  test('can request MIDI access with SysEx', async ({ page }) => {
    await page.goto('/', { timeout: 5000 });

    const result = await page.evaluate(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      try {
        const access = await navigator.requestMIDIAccess({ sysex: true });
        clearTimeout(timeout);
        return {
          success: true,
          sysexEnabled: access.sysexEnabled,
          inputCount: access.inputs.size,
          outputCount: access.outputs.size,
        };
      } catch (e) {
        clearTimeout(timeout);
        return { success: false, error: String(e) };
      }
    });

    console.log('MIDI access:', result);
    expect(result.success).toBe(true);
    expect(result.sysexEnabled).toBe(true);
  });

  test('expected MIDI port is available', async ({ page }) => {
    test.skip(!MIDI_PORT, 'E2E_MIDI_PORT not set');

    await page.goto('/', { timeout: 5000 });

    const result = await page.evaluate(async (portName) => {
      const access = await navigator.requestMIDIAccess({ sysex: true });
      const inputs = Array.from(access.inputs.values()).map(p => p.name);
      const outputs = Array.from(access.outputs.values()).map(p => p.name);
      return {
        inputs,
        outputs,
        hasInput: inputs.includes(portName),
        hasOutput: outputs.includes(portName),
      };
    }, MIDI_PORT);

    console.log('Ports:', result);
    expect(result.hasInput).toBe(true);
    expect(result.hasOutput).toBe(true);
  });

  test.skip('device responds to SysEx ping', async ({ page }) => {
    // SKIPPED: Browser Web MIDI SysEx has issues - use Node.js validation instead
    // Device connectivity is validated by scripts/validate-device.ts before tests run
    test.skip(!MIDI_PORT, 'E2E_MIDI_PORT not set');

    await page.goto('/', { timeout: 5000 });

    const result = await page.evaluate(
      async ({ midiPort, deviceId, rolandId, modelId, rqdCmd }) => {
        const SYSEX_TIMEOUT = 3000;

        const access = await navigator.requestMIDIAccess({ sysex: true });

        let input: MIDIInput | undefined;
        let output: MIDIOutput | undefined;

        access.inputs.forEach(p => { if (p.name === midiPort) input = p; });
        access.outputs.forEach(p => { if (p.name === midiPort) output = p; });

        if (!input || !output) {
          return { success: false, error: `Port not found: ${midiPort}` };
        }

        // Build RQD message
        const address = [0x00, 0x00, 0x00, 0x00];
        const size = [0x00, 0x00, 0x00, 0x02];
        const sum = address.reduce((a, b) => a + b, 0) + size.reduce((a, b) => a + b, 0);
        const checksum = (128 - (sum & 0x7f)) % 128;

        const rqd = new Uint8Array([
          0xf0, rolandId, deviceId, modelId, rqdCmd,
          ...address, ...size, checksum, 0xf7,
        ]);

        return new Promise<{ success: boolean; response?: string; error?: string }>((resolve) => {
          const timeout = setTimeout(() => {
            input!.onmidimessage = null;
            resolve({ success: false, error: 'No response within 3s' });
          }, SYSEX_TIMEOUT);

          input!.onmidimessage = (event) => {
            const bytes = Array.from(event.data as Uint8Array);

            // Valid S-series response (not echo)
            if (bytes[0] === 0xf0 && bytes[1] === rolandId &&
                bytes[3] === modelId && bytes[4] !== rqdCmd) {
              clearTimeout(timeout);
              input!.onmidimessage = null;

              const cmd = bytes[4];
              const type = cmd === 0x42 ? 'DAT' : cmd === 0x43 ? 'ACK' :
                           cmd === 0x4f ? 'ERR' : `0x${cmd.toString(16)}`;

              resolve({
                success: true,
                response: `${type}: ${bytes.map(b => b.toString(16).padStart(2, '0')).join(' ')}`,
              });
            }
          };

          output!.send(rqd);
        });
      },
      { midiPort: MIDI_PORT, deviceId: DEVICE_ID, rolandId: ROLAND_ID,
        modelId: S_SERIES_MODEL_ID, rqdCmd: RQD_COMMAND }
    );

    console.log('SysEx result:', result);
    expect(result.success).toBe(true);
  });
});
