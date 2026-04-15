/**
 * Hardware e2e tests for Roland S-series device connectivity via HTTP MIDI.
 *
 * These tests verify that the HTTP MIDI transport can communicate with
 * the device through midi-server. They test the transport layer directly,
 * not the app UI.
 *
 * Prerequisites:
 *   - midi-server running (started by run-http-midi-e2e.sh)
 *   - Device validated (run-http-midi-e2e.sh validates before tests)
 *
 * Environment variables (set by runner):
 *   E2E_MIDI_SERVER_PORT - midi-server HTTP port
 *   E2E_MIDI_INPUT_PORT - Discovered MIDI input port name
 *   E2E_MIDI_OUTPUT_PORT - Discovered MIDI output port name
 *   E2E_DEVICE_ID - Roland device ID
 */

import { test, expect } from '@playwright/test';

test.setTimeout(10_000);

const MIDI_SERVER_PORT = process.env.E2E_MIDI_SERVER_PORT;
const MIDI_INPUT_PORT = process.env.E2E_MIDI_INPUT_PORT;
const MIDI_OUTPUT_PORT = process.env.E2E_MIDI_OUTPUT_PORT;
const DEVICE_ID = parseInt(process.env.E2E_DEVICE_ID || '0', 10);

// Roland S-series protocol constants
const ROLAND_ID = 0x41;
const S_SERIES_MODEL_ID = 0x1e;
const RQD_COMMAND = 0x41;

// Fail fast if environment not set up
test.beforeAll(() => {
  if (!MIDI_SERVER_PORT) {
    throw new Error('E2E_MIDI_SERVER_PORT not set. Run via ./scripts/run-http-midi-e2e.sh');
  }
  if (!MIDI_INPUT_PORT || !MIDI_OUTPUT_PORT) {
    throw new Error('MIDI port not discovered. Device validation should have failed.');
  }
});

test.describe('HTTP MIDI Transport', () => {
  test('midi-server is running', async ({ request }) => {
    const response = await request.get(`http://localhost:${MIDI_SERVER_PORT}/health`);
    expect(response.ok()).toBe(true);
  });

  test('midi-server lists available ports', async ({ request }) => {
    const response = await request.get(`http://localhost:${MIDI_SERVER_PORT}/ports`);
    expect(response.ok()).toBe(true);

    const ports = await response.json();
    console.log('Available ports:', ports);

    expect(ports.inputs).toBeInstanceOf(Array);
    expect(ports.outputs).toBeInstanceOf(Array);
    expect(ports.inputs.length).toBeGreaterThan(0);
    expect(ports.outputs.length).toBeGreaterThan(0);
  });

  test('discovered ports are available on server', async ({ request }) => {
    const response = await request.get(`http://localhost:${MIDI_SERVER_PORT}/ports`);
    const ports = await response.json();

    console.log('Looking for input:', MIDI_INPUT_PORT);
    console.log('Looking for output:', MIDI_OUTPUT_PORT);
    console.log('Server inputs:', ports.inputs);
    console.log('Server outputs:', ports.outputs);

    expect(ports.inputs).toContain(MIDI_INPUT_PORT);
    expect(ports.outputs).toContain(MIDI_OUTPUT_PORT);
  });

  test('can open MIDI ports', async ({ request }) => {
    // Get port indices
    const portsResponse = await request.get(`http://localhost:${MIDI_SERVER_PORT}/ports`);
    const ports = await portsResponse.json();

    const inputIdx = ports.inputs.indexOf(MIDI_INPUT_PORT);
    const outputIdx = ports.outputs.indexOf(MIDI_OUTPUT_PORT);

    expect(inputIdx).toBeGreaterThanOrEqual(0);
    expect(outputIdx).toBeGreaterThanOrEqual(0);

    // Open input port
    const inputResponse = await request.post(
      `http://localhost:${MIDI_SERVER_PORT}/port/input-${inputIdx}`,
      {
        data: { name: MIDI_INPUT_PORT, type: 'input' },
      }
    );
    expect(inputResponse.ok()).toBe(true);

    // Open output port
    const outputResponse = await request.post(
      `http://localhost:${MIDI_SERVER_PORT}/port/output-${outputIdx}`,
      {
        data: { name: MIDI_OUTPUT_PORT, type: 'output' },
      }
    );
    expect(outputResponse.ok()).toBe(true);

    // Cleanup
    await request.delete(`http://localhost:${MIDI_SERVER_PORT}/port/input-${inputIdx}`);
    await request.delete(`http://localhost:${MIDI_SERVER_PORT}/port/output-${outputIdx}`);
  });

  test('device responds to SysEx via HTTP MIDI', async ({ request }) => {
    // Get port indices
    const portsResponse = await request.get(`http://localhost:${MIDI_SERVER_PORT}/ports`);
    const ports = await portsResponse.json();

    const inputIdx = ports.inputs.indexOf(MIDI_INPUT_PORT);
    const outputIdx = ports.outputs.indexOf(MIDI_OUTPUT_PORT);

    const inputId = `input-${inputIdx}`;
    const outputId = `output-${outputIdx}`;

    // Open ports
    await request.post(`http://localhost:${MIDI_SERVER_PORT}/port/${inputId}`, {
      data: { name: MIDI_INPUT_PORT, type: 'input' },
    });
    await request.post(`http://localhost:${MIDI_SERVER_PORT}/port/${outputId}`, {
      data: { name: MIDI_OUTPUT_PORT, type: 'output' },
    });

    // Build RQD message (Request Data)
    const address = [0x00, 0x00, 0x00, 0x00];
    const size = [0x00, 0x00, 0x00, 0x02];
    const sum = address.reduce((a, b) => a + b, 0) + size.reduce((a, b) => a + b, 0);
    const checksum = (128 - (sum & 0x7f)) % 128;

    const rqdMessage = [
      0xf0,
      ROLAND_ID,
      DEVICE_ID,
      S_SERIES_MODEL_ID,
      RQD_COMMAND,
      ...address,
      ...size,
      checksum,
      0xf7,
    ];

    console.log('Sending RQD:', rqdMessage.map(b => b.toString(16).padStart(2, '0')).join(' '));

    // Set up SSE listener for response
    const responsePromise = new Promise<number[]>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('No SysEx response within 3 seconds'));
      }, 3000);

      // Use fetch to get the SSE stream
      fetch(`http://localhost:${MIDI_SERVER_PORT}/port/${inputId}/events`)
        .then(async (res) => {
          const reader = res.body?.getReader();
          if (!reader) {
            clearTimeout(timeout);
            reject(new Error('No response body'));
            return;
          }

          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Parse SSE events
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data:')) {
                try {
                  const data = JSON.parse(line.slice(5).trim());
                  const bytes: number[] = data.bytes;

                  // Check for valid S-series response (not echo)
                  if (
                    bytes[0] === 0xf0 &&
                    bytes[1] === ROLAND_ID &&
                    bytes[3] === S_SERIES_MODEL_ID &&
                    bytes[4] !== RQD_COMMAND // Not an echo
                  ) {
                    clearTimeout(timeout);
                    reader.cancel();
                    resolve(bytes);
                    return;
                  }
                } catch {
                  // Ignore parse errors
                }
              }
            }
          }
        })
        .catch((err) => {
          clearTimeout(timeout);
          reject(err);
        });
    });

    // Send the message
    const sendResponse = await request.post(
      `http://localhost:${MIDI_SERVER_PORT}/port/${outputId}/send`,
      {
        data: { message: rqdMessage },
      }
    );
    expect(sendResponse.ok()).toBe(true);

    // Wait for response
    const response = await responsePromise;

    console.log('Received:', response.map(b => b.toString(16).padStart(2, '0')).join(' '));

    // Verify it's a valid response
    expect(response[0]).toBe(0xf0); // SysEx start
    expect(response[1]).toBe(ROLAND_ID);
    expect(response[3]).toBe(S_SERIES_MODEL_ID);

    const responseType = response[4];
    const typeNames: Record<number, string> = {
      0x42: 'DAT',
      0x43: 'ACK',
      0x44: 'EOD',
      0x4f: 'ERR',
    };
    console.log('Response type:', typeNames[responseType] || `0x${responseType.toString(16)}`);

    // Any valid response (DAT, ACK, EOD, ERR) proves device is communicating
    expect([0x42, 0x43, 0x44, 0x4f]).toContain(responseType);

    // Cleanup
    await request.delete(`http://localhost:${MIDI_SERVER_PORT}/port/${inputId}`);
    await request.delete(`http://localhost:${MIDI_SERVER_PORT}/port/${outputId}`);
  });
});
